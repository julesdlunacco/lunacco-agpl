<?php
/**
 * Promos — generic promotion system for any purchasable item.
 *
 * luna_promos rows can match:
 *   item_type='db_chart_preset', item_id=5   → one specific preset
 *   item_type='db_document',     item_id=2   → one specific document
 *   item_type='*',               item_id=NULL → site-wide discount
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_Promos {

	private string $table;

	public function __construct() {
		global $wpdb;
		$this->table = $wpdb->prefix . 'luna_promos';
	}

	// ------------------------------------------------------------------
	// Table
	// ------------------------------------------------------------------

	public function ensure_table(): void {
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$sql = "CREATE TABLE {$this->table} (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			slug varchar(100) NOT NULL,
			label varchar(255) NOT NULL,
			kind enum('percent_off','credits_off') NOT NULL DEFAULT 'percent_off',
			amount decimal(10,2) NOT NULL DEFAULT 0,
			item_type varchar(64) NOT NULL DEFAULT '*',
			item_id bigint(20) NULL DEFAULT NULL,
			active_from datetime NULL DEFAULT NULL,
			active_until datetime NULL DEFAULT NULL,
			is_active tinyint(1) NOT NULL DEFAULT 1,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY slug (slug)
		) $charset_collate;";

		dbDelta( $sql );
	}

	// ------------------------------------------------------------------
	// Read
	// ------------------------------------------------------------------

	public function get_all(): array {
		global $wpdb;
		return $wpdb->get_results( "SELECT * FROM {$this->table} ORDER BY id DESC", ARRAY_A ) ?: [];
	}

	public function get( int $id ): ?array {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->table} WHERE id = %d", $id ), ARRAY_A ) ?: null;
	}

	/**
	 * Find active promos that match item_type + item_id right now.
	 * Returns the best single promo (highest discount value).
	 */
	public function find_best( string $item_type, ?int $item_id ): ?array {
		global $wpdb;
		$now = current_time( 'mysql' );

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$this->table}
				 WHERE is_active = 1
				   AND (active_from  IS NULL OR active_from  <= %s)
				   AND (active_until IS NULL OR active_until >= %s)
				   AND (
				       item_type = '*'
				       OR (item_type = %s AND (item_id IS NULL OR item_id = %d))
				   )
				 ORDER BY amount DESC LIMIT 1",
				$now, $now, $item_type, (int) $item_id
			),
			ARRAY_A
		);

		return $rows[0] ?? null;
	}

	/**
	 * Resolve final credit cost after applying the best matching promo.
	 *
	 * @param string   $item_type  e.g. 'db_chart_preset'
	 * @param int|null $item_id
	 * @param int      $base       Original credit cost.
	 * @return array{ final: int, promo: ?array }
	 */
	public function resolve_price( string $item_type, ?int $item_id, int $base ): array {
		$promo = $this->find_best( $item_type, $item_id );

		if ( ! $promo || $base === 0 ) {
			return [ 'final' => $base, 'promo' => null ];
		}

		if ( $promo['kind'] === 'percent_off' ) {
			$discount = (int) round( $base * ( (float) $promo['amount'] / 100 ) );
			$final    = max( 0, $base - $discount );
		} else {
			$final = max( 0, $base - (int) $promo['amount'] );
		}

		return [ 'final' => $final, 'promo' => $promo ];
	}

	// ------------------------------------------------------------------
	// Write
	// ------------------------------------------------------------------

	public function save( array $data ): int|WP_Error {
		global $wpdb;

		if ( empty( $data['slug'] ) || empty( $data['label'] ) ) {
			return new WP_Error( 'missing_fields', 'Slug and label are required.' );
		}

		$row = [
			'slug'         => sanitize_key( $data['slug'] ),
			'label'        => sanitize_text_field( $data['label'] ),
			'kind'         => in_array( $data['kind'] ?? '', [ 'percent_off', 'credits_off' ], true ) ? $data['kind'] : 'percent_off',
			'amount'       => (float) ( $data['amount'] ?? 0 ),
			'item_type'    => sanitize_text_field( $data['item_type'] ?? '*' ),
			'item_id'      => $data['item_id'] ? (int) $data['item_id'] : null,
			'active_from'  => $data['active_from'] ?: null,
			'active_until' => $data['active_until'] ?: null,
			'is_active'    => (int) ( $data['is_active'] ?? 1 ),
			'updated_at'   => current_time( 'mysql' ),
		];

		$id = (int) ( $data['id'] ?? 0 );
		if ( $id ) {
			$wpdb->update( $this->table, $row, [ 'id' => $id ] );
			return $id;
		}

		$row['created_at'] = current_time( 'mysql' );
		$wpdb->insert( $this->table, $row );
		return $wpdb->insert_id ?: new WP_Error( 'db_error', 'Failed to save promo.' );
	}

	public function delete( int $id ): bool {
		global $wpdb;
		return (bool) $wpdb->delete( $this->table, [ 'id' => $id ], [ '%d' ] );
	}
}
