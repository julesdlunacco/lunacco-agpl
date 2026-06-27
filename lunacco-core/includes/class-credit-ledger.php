<?php
/**
 * Credit ledger — low-level database queries for wp_luna_credits_log.
 *
 * Migrated from luna-tarot's includes/class-luna-credit-ledger.php.
 * Class renamed from LunaTarot_Credit_Ledger to LunaCco_Credit_Ledger.
 * All behaviour preserved identically.
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_Credit_Ledger {

	/** @var callable|null */
	private $debug_logger;

	public function __construct( $debug_logger = null ) {
		$this->debug_logger = is_callable( $debug_logger ) ? $debug_logger : null;
	}

	private function debug( string $message, array $context = [] ): void {
		if ( $this->debug_logger ) {
			call_user_func( $this->debug_logger, $message, $context );
		}
	}

	// ------------------------------------------------------------------
	// Meta encoding / decoding
	// ------------------------------------------------------------------

	public function encode_entry_meta( $meta ) {
		if ( ! is_array( $meta ) || empty( $meta ) ) {
			return null;
		}
		$encoded = wp_json_encode( $this->sanitize_meta( $meta ) );
		return $encoded ?: null;
	}

	public function decode_entry_meta( $raw_meta ) {
		if ( is_array( $raw_meta ) ) {
			return $this->sanitize_meta( $raw_meta );
		}
		if ( ! is_string( $raw_meta ) || trim( $raw_meta ) === '' ) {
			return [];
		}
		$decoded = json_decode( $raw_meta, true );
		if ( ! is_array( $decoded ) ) {
			return [];
		}
		return $this->sanitize_meta( $decoded );
	}

	private function sanitize_meta( array $meta ): array {
		$clean = [];
		foreach ( $meta as $key => $value ) {
			$meta_key = sanitize_key( (string) $key );
			if ( $meta_key === '' ) {
				continue;
			}
			if ( is_array( $value ) ) {
				$clean[ $meta_key ] = $this->sanitize_meta( $value );
				continue;
			}
			if ( is_bool( $value ) || is_numeric( $value ) ) {
				$clean[ $meta_key ] = $value;
				continue;
			}
			$clean[ $meta_key ] = sanitize_text_field( (string) $value );
		}
		return $clean;
	}

	// ------------------------------------------------------------------
	// History row fetching
	// ------------------------------------------------------------------

	public function fetch_user_history_rows( int $user_id, int $limit = 100 ): array {
		global $wpdb;

		$user_id = (int) $user_id;
		$limit   = max( 1, (int) $limit );
		if ( $user_id <= 0 ) {
			return [];
		}

		$table      = $wpdb->prefix . 'luna_credits_log';
		$has_meta   = $this->column_exists( $table, 'entry_meta' );
		$select_meta = $has_meta ? ', entry_meta' : ', NULL AS entry_meta';

		return $wpdb->get_results( $wpdb->prepare(
			"SELECT id, user_id, amount, action_type, order_id, timestamp{$select_meta}
			FROM {$table}
			WHERE user_id = %d
			ORDER BY timestamp DESC, id DESC
			LIMIT %d",
			$user_id,
			$limit
		), ARRAY_A ) ?: [];
	}

	public function fetch_user_history_rows_chronological( int $user_id, int $limit = 1000 ): array {
		global $wpdb;

		$user_id = (int) $user_id;
		$limit   = max( 1, (int) $limit );
		if ( $user_id <= 0 ) {
			return [];
		}

		$table      = $wpdb->prefix . 'luna_credits_log';
		$has_meta   = $this->column_exists( $table, 'entry_meta' );
		$select_meta = $has_meta ? ', entry_meta' : ', NULL AS entry_meta';

		return $wpdb->get_results( $wpdb->prepare(
			"SELECT id, user_id, amount, action_type, order_id, timestamp{$select_meta}
			FROM {$table}
			WHERE user_id = %d
			ORDER BY timestamp ASC, id ASC
			LIMIT %d",
			$user_id,
			$limit
		), ARRAY_A ) ?: [];
	}

	// ------------------------------------------------------------------
	// Balance rebuilding
	// ------------------------------------------------------------------

	public function rebuild_user_balances( int $user_id ): array {
		$rows               = $this->fetch_user_history_rows_chronological( $user_id, 5000 );
		$membership_balance = 0;
		$purchased_balance  = 0;

		foreach ( $rows as $row ) {
			$amount      = (int) ( $row['amount'] ?? 0 );
			$action_type = sanitize_key( (string) ( $row['action_type'] ?? '' ) );

			if ( $amount === 0 ) {
				continue;
			}

			if ( $amount > 0 && $this->is_membership_reset_action( $action_type ) ) {
				$membership_balance = $amount;
				continue;
			}

			if ( $amount > 0 && $this->is_membership_award_action( $action_type ) ) {
				$membership_balance += $amount;
				continue;
			}

			if ( $amount > 0 ) {
				$purchased_balance += $amount;
				continue;
			}

			$remaining       = abs( $amount );
			$membership_used = min( $membership_balance, $remaining );
			$membership_balance -= $membership_used;
			$remaining          -= $membership_used;

			$purchased_used = min( $purchased_balance, $remaining );
			$purchased_balance -= $purchased_used;
		}

		return [
			'membership_balance' => max( 0, (int) $membership_balance ),
			'purchased_balance'  => max( 0, (int) $purchased_balance ),
			'total_balance'      => max( 0, (int) $membership_balance ) + max( 0, (int) $purchased_balance ),
			'rows_processed'     => count( $rows ),
		];
	}

	// ------------------------------------------------------------------
	// Display formatting
	// ------------------------------------------------------------------

	public function build_display_rows( array $rows ): array {
		return array_map( [ $this, 'build_display_row' ], $rows );
	}

	public function build_display_row( array $row ): array {
		$meta        = $this->decode_entry_meta( $row['entry_meta'] ?? null );
		$amount      = (int) ( $row['amount'] ?? 0 );
		$action_type = sanitize_key( (string) ( $row['action_type'] ?? '' ) );
		$date_label  = '';

		if ( ! empty( $row['timestamp'] ) ) {
			$date_label = mysql2date(
				get_option( 'date_format', 'F j, Y' ) . ' ' . get_option( 'time_format', 'g:i a' ),
				$row['timestamp']
			);
		}

		return [
			'id'              => (int) ( $row['id'] ?? 0 ),
			'amount'          => $amount,
			'amount_label'    => ( $amount > 0 ? '+' : '' ) . (string) $amount,
			'action_type'     => $action_type,
			'action_label'    => $this->build_action_label( $action_type, $meta ),
			'bucket'          => $this->resolve_bucket_label( $action_type, $meta, $amount ),
			'date_label'      => $date_label,
			'timestamp'       => (string) ( $row['timestamp'] ?? '' ),
			'order_id'        => (string) ( $row['order_id'] ?? '' ),
			'reference_label' => $this->build_reference_label( $row, $meta ),
			'reading_name'    => sanitize_text_field( (string) ( $meta['reading_name'] ?? '' ) ),
			'direction'       => $amount >= 0 ? 'credit' : 'debit',
			'reason'          => sanitize_text_field( (string) ( $meta['refund_reason_label'] ?? $meta['reason_label'] ?? '' ) ),
			'is_refund'       => $action_type === 'reading_refund',
			'meta'            => $meta,
		];
	}

	public function build_monthly_summary( int $user_id ): array {
		$rows    = $this->fetch_user_history_rows_chronological( $user_id, 5000 );
		$summary = [];

		foreach ( $rows as $row ) {
			$month_key = '';
			if ( ! empty( $row['timestamp'] ) ) {
				$month_key = mysql2date( 'Y-m', $row['timestamp'] );
			}
			if ( $month_key === '' ) {
				continue;
			}

			if ( ! isset( $summary[ $month_key ] ) ) {
				$summary[ $month_key ] = [
					'month_key'        => $month_key,
					'month_label'      => date_i18n( 'F Y', strtotime( $month_key . '-01' ) ),
					'membership_added' => 0,
					'purchased_added'  => 0,
					'credits_used'     => 0,
					'refunds'          => 0,
					'adjustments'      => 0,
				];
			}

			$amount      = (int) ( $row['amount'] ?? 0 );
			$action_type = sanitize_key( (string) ( $row['action_type'] ?? '' ) );
			$meta        = $this->decode_entry_meta( $row['entry_meta'] ?? null );

			if ( $amount > 0 && $this->is_membership_award_action( $action_type ) ) {
				$summary[ $month_key ]['membership_added'] += $amount;
			} elseif ( $amount > 0 && $action_type === 'reading_refund' ) {
				$summary[ $month_key ]['refunds'] += $amount;
			} elseif ( $amount > 0 && $this->is_manual_adjustment( $action_type, $meta ) ) {
				$summary[ $month_key ]['adjustments'] += $amount;
			} elseif ( $amount > 0 ) {
				$summary[ $month_key ]['purchased_added'] += $amount;
			} elseif ( $amount < 0 ) {
				$summary[ $month_key ]['credits_used'] += abs( $amount );
			}
		}

		return array_values( array_reverse( $summary ) );
	}

	// ------------------------------------------------------------------
	// Admin user summaries
	// ------------------------------------------------------------------

	public function fetch_admin_user_summaries( string $search = '', int $limit = 75 ): array {
		global $wpdb;

		$limit    = max( 1, (int) $limit );
		$search   = trim( (string) $search );
		$table    = $wpdb->prefix . 'luna_credits_log';
		$user_ids = [];

		if ( $search !== '' ) {
			$users = get_users( [
				'search'         => '*' . $search . '*',
				'search_columns' => [ 'ID', 'user_email', 'user_login', 'display_name' ],
				'number'         => $limit,
				'fields'         => [ 'ID', 'display_name', 'user_email', 'user_login' ],
			] );
			foreach ( $users as $user ) {
				$user_ids[] = (int) $user->ID;
			}
		} else {
			$user_ids = $wpdb->get_col( $wpdb->prepare(
				"SELECT user_id FROM {$table}
				WHERE user_id > 0
				GROUP BY user_id
				ORDER BY MAX(timestamp) DESC
				LIMIT %d",
				$limit
			) );
		}

		$user_ids = array_values( array_unique( array_map( 'intval', $user_ids ) ) );
		$results  = [];

		foreach ( $user_ids as $user_id ) {
			$user = get_user_by( 'id', $user_id );
			if ( ! $user ) {
				continue;
			}
			$results[] = [
				'user_id'            => $user_id,
				'name'               => $user->display_name,
				'email'              => $user->user_email,
				'username'           => $user->user_login,
				'membership_balance' => max( 0, (int) get_user_meta( $user_id, 'lt_membership_balance', true ) ),
				'purchased_balance'  => max( 0, (int) get_user_meta( $user_id, 'lt_purchased_balance', true ) ),
				'current_balance'    => max( 0, (int) get_user_meta( $user_id, 'lt_current_balance', true ) ),
			];
		}

		return $results;
	}

	// ------------------------------------------------------------------
	// Label helpers
	// ------------------------------------------------------------------

	public function build_reference_label( array $row, array $meta = [] ): string {
		$meta  = is_array( $meta ) ? $meta : [];
		$parts = [];

		$product_name   = sanitize_text_field( (string) ( $meta['product_name'] ?? '' ) );
		$variation_name = sanitize_text_field( (string) ( $meta['variation_name'] ?? '' ) );
		if ( $product_name !== '' ) {
			$parts[] = $product_name . ( $variation_name !== '' ? ' — ' . $variation_name : '' );
		}

		$reading_name = sanitize_text_field( (string) ( $meta['reading_name'] ?? '' ) );
		if ( $reading_name !== '' ) {
			$parts[] = $reading_name;
		}

		$reason_label = sanitize_text_field( (string) ( $meta['refund_reason_label'] ?? $meta['reason_label'] ?? '' ) );
		if ( $reason_label !== '' ) {
			$parts[] = $reason_label;
		}

		if ( ! empty( $parts ) ) {
			return implode( ' • ', array_unique( $parts ) );
		}

		$legacy = $this->build_legacy_reference_label( (string) ( $row['order_id'] ?? '' ) );
		if ( $legacy !== '' ) {
			return $legacy;
		}

		return (string) ( $row['order_id'] ?? '' );
	}

	private function build_legacy_reference_label( string $order_id ): string {
		if ( $order_id === '' ) {
			return '';
		}
		if ( preg_match( '/^order_(\d+)_item_(\d+)$/', $order_id, $matches ) ) {
			$item = $this->fetch_order_item_record( (int) $matches[1], (int) $matches[2] );
			if ( ! empty( $item ) ) {
				return $this->get_product_variation_label( (int) ( $item['product_id'] ?? 0 ), (int) ( $item['variation_id'] ?? 0 ) );
			}
		}
		if ( preg_match( '/^order_(\d+)_product_(\d+)_var_(\d+)$/', $order_id, $matches ) ) {
			return $this->get_product_variation_label( (int) $matches[2], (int) $matches[3] );
		}
		return '';
	}

	public function get_product_variation_label( int $product_id, int $variation_id = 0 ): string {
		$product_name   = $product_id > 0 ? get_the_title( $product_id ) : '';
		$variation_name = $variation_id > 0 ? get_the_title( $variation_id ) : '';

		$product_name   = is_string( $product_name ) ? trim( $product_name ) : '';
		$variation_name = is_string( $variation_name ) ? trim( $variation_name ) : '';

		if ( $product_name !== '' && $variation_name !== '' && strcasecmp( $product_name, $variation_name ) !== 0 ) {
			return $product_name . ' — ' . $variation_name;
		}
		if ( $product_name !== '' ) {
			return $product_name;
		}
		if ( $variation_name !== '' ) {
			return $variation_name;
		}
		return '';
	}

	public function build_action_label( string $action_type, array $meta = [] ): string {
		$action_type  = sanitize_key( (string) $action_type );
		$custom_label = sanitize_text_field( (string) ( $meta['action_label'] ?? '' ) );
		if ( $custom_label !== '' ) {
			return $custom_label;
		}

		$labels = [
			'purchase'                    => 'Credits Added',
			'subscription_renewal'        => 'Membership Credits Added',
			'free_account_signup'         => 'Free Account Credits Added',
			'free_account_monthly_reset'  => 'Free Monthly Credits Reset',
			'reading_usage'               => 'AI Reading Charge',
			'spread_usage'                => 'Reading Pull Charge',
			'reading_refund'              => 'Auto Refund',
			'manual_admin'                => 'Admin Adjustment',
		];

		return $labels[ $action_type ] ?? ucwords( str_replace( '_', ' ', $action_type ) );
	}

	private function resolve_bucket_label( string $action_type, array $meta, int $amount ): string {
		$bucket = sanitize_key( (string) ( $meta['bucket'] ?? '' ) );
		if ( $bucket === 'membership' ) {
			return 'Membership';
		}
		if ( $bucket === 'purchased' ) {
			return 'Purchased';
		}
		if ( $amount < 0 ) {
			return 'Usage';
		}
		if ( $this->is_membership_award_action( $action_type ) ) {
			return 'Membership';
		}
		return 'Purchased';
	}

	// ------------------------------------------------------------------
	// Action type classification helpers
	// ------------------------------------------------------------------

	private function is_membership_reset_action( string $action_type ): bool {
		return in_array( $action_type, [ 'subscription_renewal', 'free_account_monthly_reset' ], true );
	}

	private function is_membership_award_action( string $action_type ): bool {
		return in_array( $action_type, [ 'subscription_renewal', 'free_account_monthly_reset' ], true );
	}

	private function is_manual_adjustment( string $action_type, array $meta ): bool {
		if ( $action_type === 'manual_admin' ) {
			return true;
		}
		return ! empty( $meta['manual_adjustment'] );
	}

	// ------------------------------------------------------------------
	// DB helpers
	// ------------------------------------------------------------------

	private function fetch_order_item_record( int $order_id, int $item_id ): array {
		global $wpdb;

		if ( $order_id <= 0 || $item_id <= 0 ) {
			return [];
		}

		$items_table = $wpdb->prefix . 'fct_order_items';
		if ( ! $this->table_exists( $items_table ) ) {
			return [];
		}

		$product_column   = $this->column_exists( $items_table, 'product_id' ) ? 'product_id' : 'post_id';
		$variation_column = $this->column_exists( $items_table, 'variation_id' )
			? 'variation_id'
			: ( $this->column_exists( $items_table, 'object_id' ) ? 'object_id' : null );
		$select_variation = $variation_column ? "{$variation_column} AS variation_id" : '0 AS variation_id';

		return $wpdb->get_row( $wpdb->prepare(
			"SELECT id, {$product_column} AS product_id, {$select_variation}
			FROM {$items_table}
			WHERE order_id = %d AND id = %d
			LIMIT 1",
			$order_id,
			$item_id
		), ARRAY_A ) ?: [];
	}

	private function table_exists( string $table_name ): bool {
		global $wpdb;
		$found = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table_name ) );
		return $found === $table_name;
	}

	private function column_exists( string $table_name, string $column_name ): bool {
		global $wpdb;
		if ( ! $this->table_exists( $table_name ) ) {
			return false;
		}
		$found = $wpdb->get_var( $wpdb->prepare( "SHOW COLUMNS FROM {$table_name} LIKE %s", $column_name ) );
		return ! empty( $found );
	}
}
