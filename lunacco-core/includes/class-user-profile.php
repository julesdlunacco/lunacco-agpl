<?php
/**
 * User profile — profile CRUD and user context data.
 *
 * Migrated from luna-tarot's backend.php (lines 2392-2568).
 *
 * Profile data is stored as JSON in user meta key 'lt_user_profile'.
 * The structure covers the three shared lens sources:
 *   astrology (sun_sign, moon_sign, rising_sign, stellium_sign_house)
 *   human_design (type, profile, incarnation_cross)
 *   numerology (life_path_number, expression_number, personality_number)
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_User_Profile {

	// ------------------------------------------------------------------
	// Profile structure
	// ------------------------------------------------------------------

	public function get_empty_profile(): array {
		return [
			'identity'       => [
				'full_name'      => '',
				'nickname'       => '',
				'birthdate'      => '', // YYYY-MM-DD
				'city'           => '',
				'region'         => '',
				'country'        => '',
				'birth_time'       => '',
				'birth_location'   => '',
				'birth_lat'        => '',
				'birth_lng'        => '',
				'birth_timezone'   => '',
				'luck_cycle_polarity' => '',
				'current_timezone' => '',
			],
			'preferred_tone' => '',
			'astrology'      => [
				'sun_sign'            => '',
				'moon_sign'           => '',
				'rising_sign'         => '',
				'ascendant_longitude' => '',
				'stellium_sign_house' => '',
			],
			'human_design'   => [
				'type'             => '',
				'profile'          => '',
				'incarnation_cross' => '',
			],
			'numerology'     => [
				'life_path_number'   => '',
				'expression_number'  => '',
				'personality_number' => '',
				'motivation_number'  => '',
				'destiny_number'     => '',
				'profile_chart_id'   => '',
			],
			'settings'       => [
				'theme_id'     => 'lavender',
				'font_display' => '',
				'font_ui'      => '',
				'font_mono'    => '',
			],
			'chart_cache'    => [],
		];
	}

	public function sanitize( $profile ): array {
		$profile = is_array( $profile ) ? $profile : [];
		$empty   = $this->get_empty_profile();

		return [
			'identity'       => [
				'full_name'      => sanitize_text_field( $profile['identity']['full_name']      ?? $empty['identity']['full_name'] ),
				'nickname'       => sanitize_text_field( $profile['identity']['nickname']        ?? $empty['identity']['nickname'] ),
				'birthdate'      => sanitize_text_field( $profile['identity']['birthdate']       ?? $empty['identity']['birthdate'] ),
				'city'           => sanitize_text_field( $profile['identity']['city']            ?? $empty['identity']['city'] ),
				'region'         => sanitize_text_field( $profile['identity']['region']          ?? $empty['identity']['region'] ),
				'country'        => sanitize_text_field( $profile['identity']['country']         ?? $empty['identity']['country'] ),
				'birth_time'       => sanitize_text_field( $profile['identity']['birth_time']        ?? $empty['identity']['birth_time'] ),
				'birth_location'   => sanitize_text_field( $profile['identity']['birth_location']    ?? $empty['identity']['birth_location'] ),
				'birth_lat'        => sanitize_text_field( $profile['identity']['birth_lat']         ?? $empty['identity']['birth_lat'] ),
				'birth_lng'        => sanitize_text_field( $profile['identity']['birth_lng']         ?? $empty['identity']['birth_lng'] ),
				'birth_timezone'   => sanitize_text_field( $profile['identity']['birth_timezone']    ?? $empty['identity']['birth_timezone'] ),
				'luck_cycle_polarity' => sanitize_text_field( $profile['identity']['luck_cycle_polarity'] ?? $empty['identity']['luck_cycle_polarity'] ),
				'current_timezone' => sanitize_text_field( $profile['identity']['current_timezone']  ?? $empty['identity']['current_timezone'] ),
			],
			'preferred_tone' => sanitize_text_field( $profile['preferred_tone'] ?? $empty['preferred_tone'] ),
			'astrology'      => [
				'sun_sign'            => sanitize_text_field( $profile['astrology']['sun_sign']            ?? $empty['astrology']['sun_sign'] ),
				'moon_sign'           => sanitize_text_field( $profile['astrology']['moon_sign']           ?? $empty['astrology']['moon_sign'] ),
				'rising_sign'         => sanitize_text_field( $profile['astrology']['rising_sign']         ?? $empty['astrology']['rising_sign'] ),
				'ascendant_longitude' => sanitize_text_field( $profile['astrology']['ascendant_longitude'] ?? $empty['astrology']['ascendant_longitude'] ),
				'stellium_sign_house' => sanitize_text_field( $profile['astrology']['stellium_sign_house'] ?? $empty['astrology']['stellium_sign_house'] ),
			],
			'human_design'   => [
				'type'              => sanitize_text_field( $profile['human_design']['type']              ?? $empty['human_design']['type'] ),
				'profile'           => sanitize_text_field( $profile['human_design']['profile']           ?? $empty['human_design']['profile'] ),
				'incarnation_cross' => sanitize_text_field( $profile['human_design']['incarnation_cross'] ?? $empty['human_design']['incarnation_cross'] ),
			],
			'numerology'     => [
				'life_path_number'   => sanitize_text_field( $profile['numerology']['life_path_number']   ?? $empty['numerology']['life_path_number'] ),
				'expression_number'  => sanitize_text_field( $profile['numerology']['expression_number']  ?? $empty['numerology']['expression_number'] ),
				'personality_number' => sanitize_text_field( $profile['numerology']['personality_number'] ?? $empty['numerology']['personality_number'] ),
				'motivation_number'  => sanitize_text_field( $profile['numerology']['motivation_number']  ?? $empty['numerology']['motivation_number'] ),
				'destiny_number'     => sanitize_text_field( $profile['numerology']['destiny_number']     ?? $empty['numerology']['destiny_number'] ),
				'profile_chart_id'   => sanitize_text_field( $profile['numerology']['profile_chart_id']   ?? $empty['numerology']['profile_chart_id'] ),
			],
			'settings'       => [
				'theme_id'     => sanitize_text_field( $profile['settings']['theme_id']     ?? $empty['settings']['theme_id'] ),
				'font_display' => sanitize_text_field( $profile['settings']['font_display'] ?? $empty['settings']['font_display'] ),
				'font_ui'      => sanitize_text_field( $profile['settings']['font_ui']      ?? $empty['settings']['font_ui'] ),
				'font_mono'    => sanitize_text_field( $profile['settings']['font_mono']    ?? $empty['settings']['font_mono'] ),
			],
			'chart_cache'    => is_array( $profile['chart_cache'] ?? null ) ? $profile['chart_cache'] : $empty['chart_cache'],
		];
	}

	// ------------------------------------------------------------------
	// Getters / setters
	// ------------------------------------------------------------------

	public function get( int $user_id ): array {
		if ( ! $user_id ) {
			return $this->get_empty_profile();
		}

		$stored = get_user_meta( $user_id, 'lt_user_profile', true );
		if ( is_string( $stored ) && $stored !== '' ) {
			$decoded = json_decode( $stored, true );
			if ( is_array( $decoded ) ) {
				$stored = $decoded;
			}
		}

		return $this->sanitize( is_array( $stored ) ? $stored : [] );
	}

	public function save( int $user_id, array $profile ): array {
		$clean = $this->sanitize( $profile );
		update_user_meta( $user_id, 'lt_user_profile', $clean );
		return $clean;
	}

	// ------------------------------------------------------------------
	// REST endpoint handlers
	// ------------------------------------------------------------------

	public function rest_get( WP_REST_Request $request ) {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return new WP_Error( 'not_logged_in', 'You must be logged in to view your profile.', [ 'status' => 401 ] );
		}
		return rest_ensure_response( [ 'profile' => $this->get( $user_id ) ] );
	}

	public function rest_save( WP_REST_Request $request ) {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return new WP_Error( 'not_logged_in', 'You must be logged in to update your profile.', [ 'status' => 401 ] );
		}

		$params  = $request->get_json_params();
		$profile = $this->save( $user_id, $params['profile'] ?? [] );

		return rest_ensure_response( [ 'success' => true, 'profile' => $profile ] );
	}

	/**
	 * Ensure the people table exists in the database.
	 */
	public function ensure_people_table(): void {
		global $wpdb;
		$table = $wpdb->prefix . 'luna_people';

		// Check if table exists
		if ( $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $table ) ) !== $table ) {
			$charset_collate = $wpdb->get_charset_collate();
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';

			$sql = "CREATE TABLE {$table} (
				id bigint(20) NOT NULL AUTO_INCREMENT,
				user_id bigint(20) NOT NULL,
				display_name varchar(100) NOT NULL DEFAULT '',
				full_name varchar(150) NOT NULL DEFAULT '',
				nickname varchar(150) NOT NULL DEFAULT '',
				birthdate varchar(20) NOT NULL DEFAULT '',
				city varchar(150) NOT NULL DEFAULT '',
				region varchar(150) NOT NULL DEFAULT '',
				country varchar(150) NOT NULL DEFAULT '',
				notes longtext,
				birth_time varchar(10) NOT NULL DEFAULT '',
				birth_location varchar(255) NOT NULL DEFAULT '',
				birth_lat varchar(30) NOT NULL DEFAULT '',
				birth_lng varchar(30) NOT NULL DEFAULT '',
				birth_timezone varchar(100) NOT NULL DEFAULT '',
				luck_cycle_polarity varchar(20) NOT NULL DEFAULT '',
				chart_cache longtext,
				created_at datetime DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				KEY user_id (user_id)
			) $charset_collate;";

			dbDelta( $sql );
		} else {
			// Ensure luck_cycle_polarity column exists
			$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW COLUMNS FROM ' . $table . ' LIKE %s', 'luck_cycle_polarity' ) );
			if ( ! $exists ) {
				$wpdb->query( 'ALTER TABLE ' . $table . " ADD luck_cycle_polarity varchar(20) NOT NULL DEFAULT '' AFTER birth_timezone" );
			}
			$cache_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW COLUMNS FROM ' . $table . ' LIKE %s', 'chart_cache' ) );
			if ( ! $cache_exists ) {
				$wpdb->query( 'ALTER TABLE ' . $table . " ADD chart_cache longtext AFTER luck_cycle_polarity" );
			}
		}
	}

	// ------------------------------------------------------------------
	// Saved People REST handlers
	// ------------------------------------------------------------------

	public function rest_list_people( WP_REST_Request $request ) {
		global $wpdb;
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return new WP_Error( 'not_logged_in', 'You must be logged in.', [ 'status' => 401 ] );
		}
		$rows    = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, display_name, full_name, nickname, birthdate, city, region, country, notes, birth_time, birth_location, birth_lat, birth_lng, birth_timezone, luck_cycle_polarity, chart_cache, created_at FROM {$wpdb->prefix}luna_people WHERE user_id = %d ORDER BY display_name ASC",
				$user_id
			),
			ARRAY_A
		);
		if ( is_array( $rows ) ) {
			foreach ( $rows as &$row ) {
				if ( ! empty( $row['chart_cache'] ) ) {
					$decoded = json_decode( $row['chart_cache'], true );
					$row['chart_cache'] = is_array( $decoded ) ? $decoded : [];
				} else {
					$row['chart_cache'] = [];
				}
			}
		}
		return rest_ensure_response( [ 'people' => $rows ?: [] ] );
	}

	public function rest_create_person( WP_REST_Request $request ) {
		global $wpdb;
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return new WP_Error( 'not_logged_in', 'You must be logged in.', [ 'status' => 401 ] );
		}
		$params  = $request->get_json_params();

		$display_name = sanitize_text_field( $params['display_name'] ?? '' );
		if ( ! $display_name ) {
			return new WP_Error( 'missing_name', 'display_name is required.', [ 'status' => 400 ] );
		}

		$wpdb->insert(
			$wpdb->prefix . 'luna_people',
			[
				'user_id'      => $user_id,
				'display_name' => $display_name,
				'full_name'    => sanitize_text_field( $params['full_name'] ?? '' ),
				'nickname'     => sanitize_text_field( $params['nickname'] ?? '' ),
				'birthdate'    => sanitize_text_field( $params['birthdate'] ?? '' ),
				'city'         => sanitize_text_field( $params['city'] ?? '' ),
				'region'       => sanitize_text_field( $params['region'] ?? '' ),
				'country'      => sanitize_text_field( $params['country'] ?? '' ),
				'notes'          => sanitize_textarea_field( $params['notes'] ?? '' ),
				'birth_time'     => sanitize_text_field( $params['birth_time'] ?? '' ),
				'birth_location' => sanitize_text_field( $params['birth_location'] ?? '' ),
				'birth_lat'      => sanitize_text_field( $params['birth_lat'] ?? '' ),
				'birth_lng'      => sanitize_text_field( $params['birth_lng'] ?? '' ),
				'birth_timezone' => sanitize_text_field( $params['birth_timezone'] ?? '' ),
				'luck_cycle_polarity' => sanitize_text_field( $params['luck_cycle_polarity'] ?? '' ),
				'chart_cache'    => isset( $params['chart_cache'] ) ? wp_json_encode( $params['chart_cache'] ) : '',
				'created_at'     => current_time( 'mysql' ),
			]
		);

		$id = $wpdb->insert_id;
		if ( ! $id ) {
			return new WP_Error( 'db_error', 'Failed to create person.', [ 'status' => 500 ] );
		}

		return rest_ensure_response( [ 'success' => true, 'id' => $id ] );
	}

	public function rest_update_person( WP_REST_Request $request ) {
		global $wpdb;
		$user_id   = get_current_user_id();
		if ( ! $user_id ) {
			return new WP_Error( 'not_logged_in', 'You must be logged in.', [ 'status' => 401 ] );
		}
		$person_id = (int) $request->get_param( 'id' );

		$row = $wpdb->get_row( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}luna_people WHERE id = %d AND user_id = %d",
			$person_id, $user_id
		) );

		if ( ! $row ) {
			return new WP_Error( 'not_found', 'Person not found.', [ 'status' => 404 ] );
		}

		$params = $request->get_json_params();
		$update = [];

		if ( isset( $params['display_name'] ) ) $update['display_name'] = sanitize_text_field( $params['display_name'] );
		if ( isset( $params['full_name'] ) )    $update['full_name']    = sanitize_text_field( $params['full_name'] );
		if ( isset( $params['nickname'] ) )     $update['nickname']     = sanitize_text_field( $params['nickname'] );
		if ( isset( $params['birthdate'] ) )    $update['birthdate']    = sanitize_text_field( $params['birthdate'] );
		if ( isset( $params['city'] ) )         $update['city']         = sanitize_text_field( $params['city'] );
		if ( isset( $params['region'] ) )       $update['region']       = sanitize_text_field( $params['region'] );
		if ( isset( $params['country'] ) )      $update['country']      = sanitize_text_field( $params['country'] );
		if ( isset( $params['notes'] ) )          $update['notes']          = sanitize_textarea_field( $params['notes'] );
		if ( isset( $params['birth_time'] ) )     $update['birth_time']     = sanitize_text_field( $params['birth_time'] );
		if ( isset( $params['birth_location'] ) ) $update['birth_location'] = sanitize_text_field( $params['birth_location'] );
		if ( isset( $params['birth_lat'] ) )      $update['birth_lat']      = sanitize_text_field( $params['birth_lat'] );
		if ( isset( $params['birth_lng'] ) )      $update['birth_lng']      = sanitize_text_field( $params['birth_lng'] );
		if ( isset( $params['birth_timezone'] ) ) $update['birth_timezone'] = sanitize_text_field( $params['birth_timezone'] );
		if ( isset( $params['luck_cycle_polarity'] ) ) $update['luck_cycle_polarity'] = sanitize_text_field( $params['luck_cycle_polarity'] );
		if ( isset( $params['chart_cache'] ) )  $update['chart_cache']  = wp_json_encode( $params['chart_cache'] );

		if ( $update ) {
			$wpdb->update( $wpdb->prefix . 'luna_people', $update, [ 'id' => $person_id ] );
		}

		return rest_ensure_response( [ 'success' => true ] );
	}

	public function rest_delete_person( WP_REST_Request $request ) {
		global $wpdb;
		$user_id   = get_current_user_id();
		if ( ! $user_id ) {
			return new WP_Error( 'not_logged_in', 'You must be logged in.', [ 'status' => 401 ] );
		}
		$person_id = (int) $request->get_param( 'id' );

		$deleted = $wpdb->delete(
			$wpdb->prefix . 'luna_people',
			[ 'id' => $person_id, 'user_id' => $user_id ],
			[ '%d', '%d' ]
		);

		if ( ! $deleted ) {
			return new WP_Error( 'not_found', 'Person not found.', [ 'status' => 404 ] );
		}

		return rest_ensure_response( [ 'success' => true ] );
	}
}
