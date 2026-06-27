<?php
/**
 * Luna AstroHD — Definition Manager.
 *
 * Handles CRUD for definition sets + sections and seeding the default set.
 * Admin UI lives in class-admin-pages.php; this file is the data layer.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once LUNA_ASTROHD_DIR . 'includes/data/definition-set-templates.php';

class Luna_AstroHD_Definition_Manager {

	const DEFAULT_SET_SLUG = 'astrohd-default';

	public static function seed_default_set_if_empty(): void {
		global $wpdb;
		$table_sets = $wpdb->prefix . 'lt_astrohd_definition_sets';
		$count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table_sets}" );
		if ( $count > 0 ) {
			return;
		}
		self::create_default_set();
	}

	public static function create_default_set(): int {
		global $wpdb;
		$table_sets     = $wpdb->prefix . 'lt_astrohd_definition_sets';
		$table_sections = $wpdb->prefix . 'lt_astrohd_definition_sections';

		// If the default set already exists (e.g. slug collision), return its id.
		$existing_id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM `{$table_sets}` WHERE slug = %s LIMIT 1",
			self::DEFAULT_SET_SLUG
		) );
		if ( $existing_id > 0 ) {
			return $existing_id;
		}

		$wpdb->query( $wpdb->prepare(
			"INSERT INTO `{$table_sets}` (slug, label, description, system_type, owner_id, is_default, is_public) VALUES (%s, %s, %s, %s, %d, %d, %d)",
			self::DEFAULT_SET_SLUG,
			'AstroHD Default Definitions',
			'Default scaffold for Human Design + Astrology definitions. Fill in content via the Definitions admin page.',
			'hd',
			0, 1, 1
		) );
		$set_id = (int) $wpdb->insert_id;

		if ( $set_id <= 0 ) {
			return 0;
		}

		$scaffold = luna_astrohd_definition_set_scaffold();
		foreach ( $scaffold as $section_type => $rows ) {
			foreach ( $rows as $row ) {
				$extra_meta = isset( $row['extra_meta'] ) ? wp_json_encode( $row['extra_meta'] ) : null;
				// INSERT IGNORE survives repeated calls without duplicate-key errors.
				$wpdb->query( $wpdb->prepare(
					"INSERT IGNORE INTO `{$table_sections}` (set_id, section_type, item_key, title, short_text, long_text, extra_meta) VALUES (%d, %s, %s, %s, '', '', %s)",
					$set_id,
					$section_type,
					(string) $row['item_key'],
					(string) $row['title'],
					$extra_meta
				) );
			}
		}

		return $set_id;
	}

	/**
	 * Resolve a single definition for the document-builder contributor.
	 *
	 * @param int    $set_id
	 * @param string $section_type e.g. 'hd_gates', 'astro_planets'
	 * @param string $item_key     e.g. '1', 'sun'
	 * @return array { short, long, title, slots }
	 */
	public static function resolve( int $set_id, string $section_type, string $item_key ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'lt_astrohd_definition_sections';

		if ( $set_id <= 0 ) {
			$set_id = self::get_default_set_id();
		}

		$row = $wpdb->get_row( $wpdb->prepare(
			"SELECT title, short_text, long_text FROM {$table} WHERE set_id=%d AND section_type=%s AND item_key=%s LIMIT 1",
			$set_id, $section_type, $item_key
		), ARRAY_A );

		if ( ! $row ) {
			return [ 'short' => '', 'long' => '', 'title' => '', 'slots' => [] ];
		}

		return [
			'short' => (string) $row['short_text'],
			'long'  => (string) $row['long_text'],
			'title' => (string) $row['title'],
			'slots' => [],
		];
	}

	public static function migrate_set( int $set_id ): array {
		global $wpdb;
		$table_sections = $wpdb->prefix . 'lt_astrohd_definition_sections';
		$table_sets     = $wpdb->prefix . 'lt_astrohd_definition_sets';

		$set = $wpdb->get_row( $wpdb->prepare( "SELECT category FROM `{$table_sets}` WHERE id=%d", $set_id ), ARRAY_A );
		$category = $set['category'] ?? 'astrohd';

		// 1. Rename variable keys if they are in the old swapped state.
		// Old 'perspective' rows (actually Motivation/Fear) should become 'motivation'
		// Old 'processing' rows (actually Perspective/Survival) should become 'perspective'
		$has_processing = $wpdb->get_var( $wpdb->prepare(
			"SELECT 1 FROM `{$table_sections}` WHERE set_id=%d AND section_type='hd_variables' AND item_key LIKE 'processing-%%' LIMIT 1",
			$set_id
		) );

		if ( $has_processing ) {
			// Collision protection: remove empty new keys if they exist from a previous partial migration
			$wpdb->query( $wpdb->prepare( 
				"DELETE FROM `{$table_sections}` 
				 WHERE set_id=%d AND section_type='hd_variables' AND item_key LIKE 'motivation-%%' 
				 AND (long_text='' OR long_text IS NULL) AND (short_text='' OR short_text IS NULL)", 
				$set_id 
			) );

			// Rename perspective -> motivation
			$wpdb->query( $wpdb->prepare( 
				"UPDATE IGNORE `{$table_sections}` SET item_key = REPLACE(item_key, 'perspective-', 'motivation-') 
				 WHERE set_id=%d AND section_type='hd_variables' AND item_key LIKE 'perspective-%%'", 
				$set_id 
			) );

			// Rename processing -> perspective
			$wpdb->query( $wpdb->prepare( 
				"UPDATE IGNORE `{$table_sections}` SET item_key = REPLACE(item_key, 'processing-', 'perspective-') 
				 WHERE set_id=%d AND section_type='hd_variables' AND item_key LIKE 'processing-%%'", 
				$set_id 
			) );
		}

		// 2. Split HD planets and angles into Personality/Design if they are still using old combined keys.
		$has_old_planets = $wpdb->get_var( $wpdb->prepare(
			"SELECT 1 FROM `{$table_sections}` WHERE set_id=%d AND section_type IN ('hd_planets', 'hd_angles_points') AND item_key NOT LIKE 'personality-%%' AND item_key NOT LIKE 'design-%%' LIMIT 1",
			$set_id
		) );
		if ( $has_old_planets ) {
			// Pre-emptive: move content from 'sun' to 'personality-sun', etc.
			// We only do this for keys that are in the known planet/angle list.
			$planet_keys = [ 'sun', 'earth', 'moon', 'north-node', 'south-node', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'lilith' ];
			$angle_keys  = [ 'asc', 'dc', 'mc', 'ic', 'vertex' ];
			$all_to_migrate = array_merge( $planet_keys, $angle_keys );

			foreach ( $all_to_migrate as $key ) {
				$old_row = $wpdb->get_row( $wpdb->prepare(
					"SELECT * FROM `{$table_sections}` WHERE set_id=%d AND item_key=%s AND section_type IN ('hd_planets', 'hd_angles_points')",
					$set_id, $key
				), ARRAY_A );

				if ( $old_row ) {
					$new_key = 'personality-' . $key;
					// Check if personality variant already exists
					$exists = $wpdb->get_var( $wpdb->prepare(
						"SELECT 1 FROM `{$table_sections}` WHERE set_id=%d AND item_key=%s AND section_type=%s LIMIT 1",
						$set_id, $new_key, $old_row['section_type']
					) );
					
					if ( ! $exists ) {
						// Update the existing row to the new key and title
						$wpdb->update( $table_sections, [
							'item_key' => $new_key,
							'title'    => $old_row['title'] . ' (Personality / Conscious)'
						], [ 'id' => $old_row['id'] ] );
					} else {
						// New key already exists (maybe from a previous partial run), so just delete the old one
						// unless the old one has content and the new one doesn't?
						$new_row = $wpdb->get_row( $wpdb->prepare( "SELECT id, long_text FROM `{$table_sections}` WHERE set_id=%d AND item_key=%s", $set_id, $new_key ), ARRAY_A );
						if ( empty( $new_row['long_text'] ) && ! empty( $old_row['long_text'] ) ) {
							$wpdb->update( $table_sections, [ 'long_text' => $old_row['long_text'] ], [ 'id' => $new_row['id'] ] );
						}
						$wpdb->delete( $table_sections, [ 'id' => $old_row['id'] ] );
					}
				}
			}
		}

		$scaffold = luna_astrohd_definition_set_scaffold();
		$added    = 0;
		$updated  = 0;

		foreach ( $scaffold as $section_type => $rows ) {
			// Category filtering
			if ( $category === 'human_design' && strpos( $section_type, 'hd_' ) !== 0 ) continue;
			if ( $category === 'astrology' && strpos( $section_type, 'astro_' ) !== 0 ) continue;

			foreach ( $rows as $row ) {
				$item_key = (string) $row['item_key'];
				$existing_id = (int) $wpdb->get_var( $wpdb->prepare(
					"SELECT id FROM `{$table_sections}` WHERE set_id=%d AND section_type=%s AND item_key=%s LIMIT 1",
					$set_id, $section_type, $item_key
				) );

				$extra_meta = isset( $row['extra_meta'] ) ? wp_json_encode( $row['extra_meta'] ) : null;

				if ( ! $existing_id ) {
					// Migration fallback: if it's an incarnation cross, check if an old-style key (with gates) exists
					if ( $section_type === 'hd_incarnation_crosses' ) {
						$old_id = (int) $wpdb->get_var( $wpdb->prepare(
							"SELECT id FROM `{$table_sections}` WHERE set_id=%d AND section_type=%s AND (item_key LIKE %s OR item_key = %s) LIMIT 1",
							$set_id, $section_type, '% — ' . $item_key, (string) $row['title']
						) );
						if ( $old_id > 0 ) {
							$wpdb->update( $table_sections, [ 
								'item_key' => $item_key,
								'title'    => (string) $row['title']
							], [ 'id' => $old_id ] );
							$updated++;
							continue;
						}
					}

					$wpdb->insert( $table_sections, [
						'set_id'       => $set_id,
						'section_type' => $section_type,
						'item_key'     => $item_key,
						'title'        => (string) $row['title'],
						'short_text'   => '',
						'long_text'    => '',
						'extra_meta'   => $extra_meta,
					] );
					$added++;
				} else {
					// For variables, always update title and extra_meta to match the latest logic/scaffold
					if ( $section_type === 'hd_variables' ) {
						$wpdb->update( $table_sections, [
							'title'      => (string) $row['title'],
							'extra_meta' => $extra_meta,
						], [ 'id' => $existing_id ] );
						$updated++;
					} elseif ( $extra_meta ) {
						// For other types, only update extra_meta if it's currently empty
						$wpdb->query( $wpdb->prepare(
							"UPDATE `{$table_sections}` SET extra_meta=%s WHERE id=%d AND (extra_meta IS NULL OR extra_meta='')",
							$extra_meta, $existing_id
						) );
					}
				}
			}
		}

		// 3. Cleanup: remove entries from specific sections that are not in the current scaffold.
		// This ensures no redundant old keys (like 'sun') remain after they've been split/migrated.
		foreach ( [ 'hd_planets', 'hd_angles_points', 'hd_variables' ] as $stype ) {
			if ( ! isset( $scaffold[ $stype ] ) ) continue;
			$valid_keys = array_column( $scaffold[ $stype ], 'item_key' );
			if ( empty( $valid_keys ) ) continue;

			$wpdb->query( $wpdb->prepare(
				"DELETE FROM `{$table_sections}` 
				 WHERE set_id=%d AND section_type=%s 
				 AND item_key NOT IN ('" . implode( "','", array_map( 'esc_sql', $valid_keys ) ) . "')",
				$set_id, $stype
			) );
		}

		return [ 'success' => true, 'added' => $added, 'updated' => $updated ];
	}

	public static function set_default_set( int $set_id ): bool {
		global $wpdb;
		$table = $wpdb->prefix . 'lt_astrohd_definition_sets';
		
		$wpdb->update( $table, [ 'is_default' => 0 ], [ 'category' => 'astrohd' ] );
		$wpdb->update( $table, [ 'is_default' => 1 ], [ 'id' => $set_id ] );
		
		return true;
	}

	public static function delete_set( int $set_id ): bool {
		global $wpdb;
		$table_sets     = $wpdb->prefix . 'lt_astrohd_definition_sets';
		$table_sections = $wpdb->prefix . 'lt_astrohd_definition_sections';

		// Don't delete the default set? Or maybe yes if they really want to.
		$wpdb->delete( $table_sections, [ 'set_id' => $set_id ], [ '%d' ] );
		$wpdb->delete( $table_sets,     [ 'id' => $set_id ],     [ '%d' ] );

		return true;
	}

	public static function export_set( int $set_id ): ?array {
		global $wpdb;
		$table_sets     = $wpdb->prefix . 'lt_astrohd_definition_sets';
		$table_sections = $wpdb->prefix . 'lt_astrohd_definition_sections';

		$set = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table_sets} WHERE id=%d", $set_id ), ARRAY_A );
		if ( ! $set ) return null;

		$sections = $wpdb->get_results( $wpdb->prepare( "SELECT section_type, item_key, title, short_text, long_text, extra_meta FROM {$table_sections} WHERE set_id=%d", $set_id ), ARRAY_A );

		return [
			'set'      => $set,
			'sections' => $sections,
		];
	}

	public static function import_set( array $data ): int {
		global $wpdb;
		$table_sets     = $wpdb->prefix . 'lt_astrohd_definition_sets';
		$table_sections = $wpdb->prefix . 'lt_astrohd_definition_sections';

		$set_data = $data['set'];
		unset( $set_data['id'] );
		$set_data['slug'] = $set_data['slug'] . '-imported-' . time();
		$set_data['is_default'] = 0;

		$wpdb->insert( $table_sets, $set_data );
		$set_id = (int) $wpdb->insert_id;

		if ( $set_id > 0 && isset( $data['sections'] ) ) {
			foreach ( $data['sections'] as $sec ) {
				$sec['set_id'] = $set_id;
				$wpdb->insert( $table_sections, $sec );
			}
		}

		return $set_id;
	}

	public static function import_manifest( int $set_id, string $section_type, string $markdown ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'lt_astrohd_definition_sections';
		$imported = 0;

		// Clean up the markdown (normalize line endings)
		$markdown = str_replace( ["\r\n", "\r"], "\n", $markdown );

		// Split by "# " at the start of a line
		$parts = preg_split( '/^#\s+/m', $markdown );

		// Cache all rows for this section to avoid repeated DB hits
		$candidates = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, title, item_key FROM `{$table}` WHERE set_id=%d AND section_type=%s",
			$set_id, $section_type
		), ARRAY_A );

		foreach ( $parts as $part ) {
			$part = trim( $part );
			if ( ! $part ) continue;

			$lines = explode( "\n", $part );
			$raw_title = trim( array_shift( $lines ) );
			$content = trim( implode( "\n", $lines ) );
			if ( ! $raw_title ) continue;

			$target_id = null;

			// 1. Direct match by title or item_key
			foreach ( $candidates as $cand ) {
				if ( $cand['title'] === $raw_title || $cand['item_key'] === $raw_title ) {
					$target_id = (int) $cand['id'];
					break;
				}
			}

			// 2. Token-based flexible match
			if ( ! $target_id ) {
				$norm_input = strtolower( $raw_title );

				// Special handling for Profiles: Exact number order match
				if ( $section_type === 'hd_profiles' ) {
					$clean_input = str_replace( [ 'profile', ' ', '/' ], '-', $norm_input );
					$clean_input = trim( $clean_input, '-' );

					foreach ( $candidates as $cand ) {
						$clean_cand = str_replace( [ 'profile', ' ', '/' ], '-', strtolower( $cand['item_key'] ) );
						$clean_cand = trim( $clean_cand, '-' );

						// Match if the profile numbers match exactly (e.g. 1-4 matches 1-4-fixed)
						if ( $clean_cand === $clean_input || strpos( $clean_cand, $clean_input . '-' ) === 0 ) {
							$target_id = (int) $cand['id'];
							break;
						}
					}
				}

				// Special handling for Incarnation Crosses: Match by the name part (after dash)
				if ( ! $target_id && $section_type === 'hd_incarnation_crosses' ) {
					// Split by any dash: em-dash, en-dash, or hyphen
					$parts = preg_split( '/\s*[—–-]\s*/u', $raw_title );
					$name_part = trim( end( $parts ) ); 
					
					if ( $name_part ) {
						$norm_name = strtolower( $name_part );
						foreach ( $candidates as $cand ) {
							// Check title
							$cand_parts = preg_split( '/\s*[—–-]\s*/u', $cand['title'] );
							$cand_name  = strtolower( trim( end( $cand_parts ) ) );
							if ( $cand_name === $norm_name ) {
								$target_id = (int) $cand['id'];
								break;
							}
							
							// Check item_key
							$cand_parts = preg_split( '/\s*[—–-]\s*/u', $cand['item_key'] );
							$cand_name  = strtolower( trim( end( $cand_parts ) ) );
							if ( $cand_name === $norm_name ) {
								$target_id = (int) $cand['id'];
								break;
							}
						}
					}
				}
				if ( ! $target_id && $section_type !== 'hd_incarnation_crosses' ) {
					// Special handling for Houses: "1st house" -> "house 1"
					if ( strpos( $section_type, 'houses' ) !== false ) {
						$norm_input = preg_replace( '/(\d+)(st|nd|rd|th)/', '$1', $norm_input );
					}

					$norm_input = str_replace( [ 'profile', 'center', 'asteroid', 'house', '—', '(', ')', '/', '-', ' ', 'defined', 'undefined', 'open' ], ' ', $norm_input );
					$input_tokens = array_filter( explode( ' ', $norm_input ) );
					
					// We also want to know if 'defined' or 'undefined' was in the input
					$is_defined = stripos( $raw_title, 'undefined' ) === false && stripos( $raw_title, 'open' ) === false && stripos( $raw_title, 'defined' ) !== false;
					$is_undefined = stripos( $raw_title, 'undefined' ) !== false || stripos( $raw_title, 'open' ) !== false;
					foreach ( $candidates as $cand ) {
						$norm_cand = strtolower( $cand['title'] . ' ' . $cand['item_key'] );
						$norm_cand = str_replace( [ 'profile', 'center', '—', '(', ')', '/', '-', ' ', 'defined', 'undefined', 'open' ], ' ', $norm_cand );
						$cand_tokens = array_filter( explode( ' ', $norm_cand ) );

						// Check if all critical input tokens exist in the candidate
						$all_match = true;
						foreach ( $input_tokens as $t ) {
							if ( ! in_array( $t, $cand_tokens ) ) {
								$all_match = false;
								break;
							}
						}

						if ( $all_match ) {
							// For Centers, check defined/undefined state
							if ( strpos( $section_type, 'centers' ) !== false ) {
								$cand_is_def = strpos( $cand['item_key'], 'defined' ) !== false;
								$cand_is_undef = strpos( $cand['item_key'], 'undefined' ) !== false;
								
								if ( $is_defined && ! $cand_is_def ) continue;
								if ( $is_undefined && ! $cand_is_undef ) continue;
							}

							$target_id = (int) $cand['id'];
							break;
						}
					}
				}
			}

			if ( $target_id ) {
				$wpdb->update( $table, [
					'long_text'  => $content,
					'short_text' => '',
					'keywords'   => '',
				], [ 'id' => $target_id ] );
				$imported++;
			}
		}

		return [ 'success' => true, 'imported' => $imported ];
	}

	public static function get_default_set_id(): int {
		global $wpdb;
		$table = $wpdb->prefix . 'lt_astrohd_definition_sets';
		
		// 1. Try is_default = 1
		$id = (int) $wpdb->get_var( "SELECT id FROM {$table} WHERE is_default=1 LIMIT 1" );
		if ( $id > 0 ) return $id;

		// 2. Try default slug
		$id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$table} WHERE slug=%s LIMIT 1",
			self::DEFAULT_SET_SLUG
		) );
		if ( $id > 0 ) return $id;

		// 3. Fallback to the first available set
		return (int) $wpdb->get_var( "SELECT id FROM {$table} ORDER BY id ASC LIMIT 1" ) ?: 0;
	}
}
