<?php
/**
 * FluentCart integration — hooks, order processing, subscription management, credit sync.
 *
 * Migrated from luna-tarot's backend.php (lines 1734-4014):
 *   get_reading_credits_for_variation, get_subscription_credits_for_variation,
 *   handle_fluent_cart_paid, handle_fluent_cart_completed, handle_subscription_renewed,
 *   process_order, check_user_subscription_on_login, check_user_subscription_on_init,
 *   process_subscription_check, sync_fluent_cart_orders_for_user,
 *   and all supporting DB helpers.
 *
 * FluentCart tables (resolved dynamically with fallback):
 *   wp_fct_orders, wp_fct_order_items, wp_fct_customers
 *
 * Option keys used (all lt_* — unchanged from luna-tarot):
 *   lt_reading_product_id, lt_reading_var_[1-4]_id, lt_reading_var_[1-4]_credits,
 *   lt_sub_product_id, lt_sub_monthly_var_id, lt_sub_monthly_credits,
 *   lt_sub_annual_var_id, lt_sub_annual_credits, lt_daily_free_limit
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_FluentCart {

	private LunaCco_Credit_System $credits;

	public function __construct( LunaCco_Credit_System $credits ) {
		$this->credits = $credits;

		// FluentCart hook variants (all naming conventions).
		add_action( 'fluent_cart/order_paid',          [ $this, 'handle_order_paid' ],       10, 2 );
		add_action( 'fluent_cart/order_completed',     [ $this, 'handle_order_completed' ],   10, 1 );
		add_action( 'fluent_cart_order_completed',     [ $this, 'handle_order_completed' ],   10, 1 );
		add_action( 'fluentcart_order_completed',      [ $this, 'handle_order_completed' ],   10, 1 );
		add_action( 'fluent_cart/subscription_renewed',[ $this, 'handle_subscription_renewed' ], 10, 2 );

		// Subscription status checks.
		add_action( 'wp_login', [ $this, 'on_login' ],    10, 2 );
		add_action( 'init',     [ $this, 'on_init_check' ] );
	}

	// ------------------------------------------------------------------
	// WordPress hooks
	// ------------------------------------------------------------------

	/** 'fluent_cart/order_paid' fires with ($order, $customer) */
	public function handle_order_paid( $order, $customer = null ): void {
		$customer_user_id  = is_array( $customer ) ? ( $customer['user_id'] ?? 0 ) : ( $customer->user_id ?? 0 );
		$order_customer_id = is_array( $order )    ? ( $order['customer_id'] ?? 0 ) : ( $order->customer_id ?? 0 );
		$user_id           = $this->resolve_wp_user_id( $customer_user_id ?: $order_customer_id );

		if ( ! $user_id ) {
			$email   = is_array( $order ) ? ( $order['billing_email'] ?? '' ) : ( $order->billing_email ?? '' );
			$user_id = $this->resolve_wp_user_id( 0, $email );
		}

		if ( ! $user_id ) {
			return;
		}
		$this->process_order( $order, $user_id );
	}

	/** 'fluent_cart/order_completed' fires with just ($order) */
	public function handle_order_completed( $order ): void {
		$candidate_id = is_array( $order )
			? ( $order['user_id'] ?? ( $order['customer_id'] ?? 0 ) )
			: ( $order->user_id ?? ( $order->customer_id ?? 0 ) );
		$email        = is_array( $order ) ? ( $order['billing_email'] ?? '' ) : ( $order->billing_email ?? '' );
		$user_id      = $this->resolve_wp_user_id( $candidate_id, $email );

		if ( ! $user_id ) {
			return;
		}
		$this->process_order( $order, $user_id );
	}

	/** 'fluent_cart/subscription_renewed' */
	public function handle_subscription_renewed( $subscription, $order = null ): void {
		$candidate_id = $subscription->user_id ?? ( $subscription->customer_id ?? ( $order->customer_id ?? 0 ) );
		$email        = $order->billing_email ?? '';
		$user_id      = $this->resolve_wp_user_id( $candidate_id, $email );

		if ( ! $user_id ) {
			return;
		}

		$sub_product_id = (int) get_option( 'lt_sub_product_id', 20 );
		$product_id     = $subscription->product_id ?? 0;
		$variation_id   = $subscription->product_variation_id ?? ( $order->items[0]->variation_id ?? 0 );

		if ( $product_id != $sub_product_id ) {
			return;
		}

		$credits = $this->get_subscription_credits_for_variation( $variation_id );
		if ( $credits <= 0 ) {
			return;
		}

		$fallback_id = is_object( $subscription ) ? ( $subscription->id ?? time() ) : time();
		$order_key   = 'sub_renewal_' . ( $this->get_order_id_value( $order ) ?: $fallback_id );

		if ( $this->credit_log_exists( $order_key ) ) {
			return;
		}

		$this->credits->reset_membership_balance( $user_id );
		if ( $this->credits->award_membership_credits( $user_id, $credits, 'subscription_renewal', $order_key, [
			'bucket'       => 'membership',
			'action_label' => 'Membership Credits Added',
			'reason_label' => 'Subscription renewal credits',
			'product_name' => 'Subscription',
		] ) ) {
			update_user_meta( $user_id, 'lt_is_subscriber', 'yes' );
			update_user_meta( $user_id, 'lt_sub_last_renewal', current_time( 'mysql' ) );
		}
	}

	public function on_login( string $user_login, WP_User $user ): void {
		$this->process_subscription_check( $user->ID );
	}

	public function on_init_check(): void {
		if ( ! is_user_logged_in() ) {
			return;
		}
		$uid        = get_current_user_id();
		$last_check = get_user_meta( $uid, 'lt_last_sub_check', true );
		if ( ! $last_check || strtotime( $last_check ) < strtotime( '-12 hours' ) ) {
			$this->process_subscription_check( $uid );
			update_user_meta( $uid, 'lt_last_sub_check', current_time( 'mysql' ) );
		}
	}

	// ------------------------------------------------------------------
	// Order processing
	// ------------------------------------------------------------------

	private function process_order( $order, int $user_id ): void {
		$reading_product_id = (int) get_option( 'lt_reading_product_id', 18 );
		$sub_product_id     = (int) get_option( 'lt_sub_product_id', 20 );
		$order_id           = $this->get_order_id_value( $order );

		$items = is_array( $order )
			? ( $order['items'] ?? ( $order['order_items'] ?? [] ) )
			: ( $order->items ?? ( $order->order_items ?? [] ) );

		if ( empty( $items ) && $order_id > 0 ) {
			$items = $this->fetch_order_items_from_db( $order_id );
		}

		if ( empty( $items ) ) {
			return;
		}

		foreach ( $items as $item ) {
			$product_id   = is_array( $item ) ? ( $item['product_id'] ?? 0 ) : ( $item->product_id ?? 0 );
			$variation_id = is_array( $item ) ? ( $item['variation_id'] ?? 0 ) : ( $item->variation_id ?? ( $item->product_variation_id ?? 0 ) );
			$item_id      = is_array( $item ) ? ( $item['id'] ?? 0 ) : ( $item->id ?? 0 );
			$order_key    = $this->build_order_item_key( $order_id, $item_id, $product_id, $variation_id );

			if ( $product_id == $reading_product_id ) {
				$credits = $this->get_reading_credits_for_variation( $variation_id );
				if ( $credits > 0 ) {
					if ( $this->credits->add_credits( $user_id, $credits, 'purchase', $order_key, array_merge(
						[ 'bucket' => 'purchased', 'action_label' => 'Credits Added' ],
						$this->get_product_variation_meta( $product_id, $variation_id )
					) ) ) {
						$this->credits->set_balances(
							$user_id,
							$this->credits->get_membership_balance( $user_id ),
							$this->credits->get_purchased_balance( $user_id ) + $credits
						);
					}
				}
			} elseif ( $product_id == $sub_product_id ) {
				$credits = $this->get_subscription_credits_for_variation( $variation_id );
				if ( $credits <= 0 || $this->credit_log_exists( $order_key ) ) {
					continue;
				}
				$this->credits->reset_membership_balance( $user_id );
				if ( $this->credits->award_membership_credits( $user_id, $credits, 'subscription_renewal', $order_key, [
					'bucket'       => 'membership',
					'action_label' => 'Membership Credits Added',
					'reason_label' => 'Subscription renewal credits',
					'product_name' => 'Subscription',
				] ) ) {
					update_user_meta( $user_id, 'lt_is_subscriber', 'yes' );
					update_user_meta( $user_id, 'lt_sub_last_renewal', current_time( 'mysql' ) );
				}
			}
		}
	}

	// ------------------------------------------------------------------
	// Subscription status check
	// ------------------------------------------------------------------

	public function process_subscription_check( int $user_id ): void {
		$is_sub     = get_user_meta( $user_id, 'lt_is_subscriber', true );
		$last_daily = get_user_meta( $user_id, 'lt_last_free_daily_reading', true );
		$free_mode  = $this->credits->get_signup_credit_mode();

		if ( $is_sub === 'yes' ) {
			if ( ! $last_daily || date( 'Y-m-d', strtotime( $last_daily ) ) !== date( 'Y-m-d' ) ) {
				update_user_meta( $user_id, 'lt_has_free_daily', 'yes' );
			}
		}

		if ( $free_mode === 'monthly' && $is_sub !== 'yes' ) {
			$this->credits->award_free_account_credits( $user_id );
		}

		if ( user_can( $user_id, 'manage_options' ) ) {
			update_user_meta( $user_id, 'lt_current_balance', 999999 );
		}
	}

	// ------------------------------------------------------------------
	// Historical order sync
	// ------------------------------------------------------------------

	/**
	 * Backfill credits for all paid FluentCart orders not yet logged.
	 *
	 * @param int $user_id
	 * @return int Number of newly processed order entries.
	 */
	public function sync_orders_for_user( int $user_id ): int {
		global $wpdb;

		if ( ! $user_id ) {
			return 0;
		}
		if ( ! $this->credits->ensure_table() ) {
			return 0;
		}

		$reading_product_id = (int) get_option( 'lt_reading_product_id', 18 );
		$sub_product_id     = (int) get_option( 'lt_sub_product_id', 20 );
		$orders_table       = $this->get_table( 'orders' );
		$items_table        = $this->get_table( 'order_items' );
		$cust_table         = $this->get_table( 'customers' );

		if ( ! $this->table_exists( $orders_table ) || ! $this->table_exists( $items_table ) ) {
			return 0;
		}

		$user       = get_user_by( 'id', $user_id );
		$user_email = $user ? $user->user_email : '';

		// Gather FluentCart customer IDs for this WP user.
		$fc_customer_ids = [];
		if ( $this->table_exists( $cust_table ) ) {
			$fc_customer_ids = $wpdb->get_col( $wpdb->prepare(
				"SELECT id FROM {$cust_table} WHERE user_id = %d",
				$user_id
			) );
		}

		$where_parts = [];
		$query_args  = [];

		if ( ! empty( $fc_customer_ids ) ) {
			$placeholders  = implode( ',', array_fill( 0, count( $fc_customer_ids ), '%d' ) );
			$where_parts[] = "o.customer_id IN ({$placeholders})";
			foreach ( $fc_customer_ids as $cid ) {
				$query_args[] = (int) $cid;
			}
		}

		if ( $this->column_exists( $orders_table, 'user_id' ) ) {
			$where_parts[] = 'o.user_id = %d';
			$query_args[]  = $user_id;
		}

		if ( ! empty( $user_email ) && $this->column_exists( $orders_table, 'billing_email' ) ) {
			$where_parts[] = 'LOWER(o.billing_email) = LOWER(%s)';
			$query_args[]  = $user_email;
		}

		if ( empty( $where_parts ) ) {
			return 0;
		}

		$where_sql = '(' . implode( ' OR ', $where_parts ) . ')';
		$orders    = $wpdb->get_results( $wpdb->prepare(
			"SELECT o.id, o.status, o.payment_status, o.type
			FROM {$orders_table} o
			WHERE {$where_sql}
			  AND (
			      LOWER(COALESCE(o.payment_status, '')) IN ('paid', 'completed')
			      OR LOWER(COALESCE(o.status, '')) IN ('paid', 'completed', 'active', 'processing')
			  )
			ORDER BY o.id ASC",
			...$query_args
		), ARRAY_A );

		$processed       = 0;
		$latest_sub_item = null;

		foreach ( (array) $orders as $order ) {
			$order_id = $order['id'];
			$items    = $this->fetch_order_items_from_db( $order_id );

			foreach ( $items as $item ) {
				$item_id      = (int) $item['id'];
				$product_id   = (int) $item['product_id'];
				$variation_id = (int) ( $item['variation_id'] ?? 0 );
				$item_key     = $this->build_order_item_key( $order_id, $item_id, $product_id, $variation_id );

				if ( $product_id === $reading_product_id ) {
					$credits = $this->get_reading_credits_for_variation( $variation_id );
					if ( $credits > 0 && $this->credits->add_credits( $user_id, $credits, 'purchase', $item_key, array_merge(
						[ 'bucket' => 'purchased', 'action_label' => 'Credits Added' ],
						$this->get_product_variation_meta( $product_id, $variation_id )
					) ) ) {
						$this->credits->set_balances(
							$user_id,
							$this->credits->get_membership_balance( $user_id ),
							$this->credits->get_purchased_balance( $user_id ) + $credits
						);
						$processed++;
					}
				} elseif ( $product_id === $sub_product_id ) {
					if ( ! $latest_sub_item || $order_id > $latest_sub_item['order_id'] ) {
						$latest_sub_item = compact( 'order_id', 'item_id', 'product_id', 'variation_id' );
					}
				}
			}
		}

		if ( ! empty( $latest_sub_item ) ) {
			$credits = $this->get_subscription_credits_for_variation( $latest_sub_item['variation_id'] );
			if ( $credits > 0 ) {
				$item_key = $this->build_order_item_key(
					$latest_sub_item['order_id'],
					$latest_sub_item['item_id'],
					$latest_sub_item['product_id'],
					$latest_sub_item['variation_id']
				);
				if ( ! $this->credit_log_exists( $item_key ) ) {
					$this->credits->reset_membership_balance( $user_id );
					if ( $this->credits->award_membership_credits( $user_id, $credits, 'subscription_renewal', $item_key, [
						'bucket'       => 'membership',
						'action_label' => 'Membership Credits Added',
						'reason_label' => 'Subscription renewal credits',
						'product_name' => 'Subscription',
					] ) ) {
						update_user_meta( $user_id, 'lt_is_subscriber', 'yes' );
						update_user_meta( $user_id, 'lt_sub_last_renewal', current_time( 'mysql' ) );
						$processed++;
					}
				}
			}
		}

		return $processed;
	}

	// ------------------------------------------------------------------
	// Free reading helpers
	// ------------------------------------------------------------------

	public function get_daily_free_cap(): int {
		return max( 0, (int) get_option( 'lt_daily_free_limit', 2 ) );
	}

	public function get_guest_daily_key( string $ip ): string {
		return 'lt_free_' . md5( $ip . '|' . current_time( 'Y-m-d' ) );
	}

	// ------------------------------------------------------------------
	// Credit variation resolution
	// ------------------------------------------------------------------

	/**
	 * Returns how many reading credits a variation ID earns.
	 * Dynamically reads all configured variation slots from options.
	 */
	public function get_reading_credits_for_variation( int $variation_id ): int {
		// Collect all configured variation slots (supports unlimited via repeater in Phase 1.6).
		$slots_raw = get_option( 'lt_reading_variations', '' );
		if ( is_array( $slots_raw ) && ! empty( $slots_raw ) ) {
			foreach ( $slots_raw as $slot ) {
				if ( (int) ( $slot['id'] ?? 0 ) === $variation_id ) {
					return max( 0, (int) ( $slot['credits'] ?? 0 ) );
				}
			}
		}

		// Backward-compatible legacy 4-slot options.
		for ( $i = 1; $i <= 4; $i++ ) {
			if ( (int) get_option( "lt_reading_var_{$i}_id", $i ) === $variation_id ) {
				return max( 0, (int) get_option( "lt_reading_var_{$i}_credits", 0 ) );
			}
		}

		return 0;
	}

	public function get_subscription_credits_for_variation( int $variation_id ): int {
		// Supports repeater (Phase 1.6) or legacy two-slot options.
		$slots_raw = get_option( 'lt_sub_variations', '' );
		if ( is_array( $slots_raw ) && ! empty( $slots_raw ) ) {
			foreach ( $slots_raw as $slot ) {
				if ( (int) ( $slot['id'] ?? 0 ) === $variation_id ) {
					return max( 0, (int) ( $slot['credits'] ?? 0 ) );
				}
			}
		}

		$monthly_var = (int) get_option( 'lt_sub_monthly_var_id', 1 );
		$annual_var  = (int) get_option( 'lt_sub_annual_var_id', 2 );

		if ( $variation_id === $monthly_var ) {
			return max( 0, (int) get_option( 'lt_sub_monthly_credits', 100 ) );
		}
		if ( $variation_id === $annual_var ) {
			return max( 0, (int) get_option( 'lt_sub_annual_credits', 1200 ) );
		}

		return 0;
	}

	// ------------------------------------------------------------------
	// DB helpers
	// ------------------------------------------------------------------

	private function get_product_variation_meta( int $product_id, int $variation_id ): array {
		$label  = $this->credits->get_ledger()->get_product_variation_label( $product_id, $variation_id );
		$parts  = array_map( 'trim', explode( ' — ', $label, 2 ) );
		return [
			'product_id'     => $product_id,
			'variation_id'   => $variation_id,
			'product_name'   => $parts[0] ?? '',
			'variation_name' => $parts[1] ?? '',
		];
	}

	private function credit_log_exists( ?string $order_id ): bool {
		if ( ! $order_id ) {
			return false;
		}
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}luna_credits_log WHERE order_id = %s",
			$order_id
		) ) > 0;
	}

	private function resolve_wp_user_id( int $candidate_id, string $email = '' ): int {
		if ( $candidate_id > 0 ) {
			if ( get_user_by( 'id', $candidate_id ) ) {
				return $candidate_id;
			}
			// Try FluentCart customer → WP user mapping.
			global $wpdb;
			$cust_table = $this->get_table( 'customers' );
			if ( $this->table_exists( $cust_table ) ) {
				$mapped = (int) $wpdb->get_var( $wpdb->prepare(
					"SELECT user_id FROM {$cust_table} WHERE id = %d",
					$candidate_id
				) );
				if ( $mapped > 0 ) {
					return $mapped;
				}
			}
		}
		if ( ! empty( $email ) ) {
			$user = get_user_by( 'email', $email );
			if ( $user ) {
				return (int) $user->ID;
			}
		}
		return 0;
	}

	private function get_order_id_value( $order ): int {
		return (int) ( is_array( $order ) ? ( $order['id'] ?? 0 ) : ( $order->id ?? 0 ) );
	}

	private function fetch_order_items_from_db( int $order_id ): array {
		global $wpdb;

		if ( $order_id <= 0 ) {
			return [];
		}
		$items_table = $this->get_table( 'order_items' );
		if ( ! $this->table_exists( $items_table ) ) {
			return [];
		}

		$product_column   = $this->column_exists( $items_table, 'product_id' ) ? 'product_id' : 'post_id';
		$variation_column = $this->column_exists( $items_table, 'variation_id' ) ? 'variation_id' : 'object_id';

		if ( ! $this->column_exists( $items_table, $product_column ) ) {
			return [];
		}
		if ( ! $this->column_exists( $items_table, $variation_column ) ) {
			$variation_column = null;
		}

		$select_variation = $variation_column ? "{$variation_column} AS variation_id" : '0 AS variation_id';

		return $wpdb->get_results( $wpdb->prepare(
			"SELECT id, {$product_column} AS product_id, {$select_variation} FROM {$items_table} WHERE order_id = %d",
			$order_id
		), ARRAY_A ) ?: [];
	}

	private function build_order_item_key( int $order_id, int $item_id, int $product_id, int $variation_id ): string {
		if ( $order_id > 0 && $item_id > 0 ) {
			return "order_{$order_id}_item_{$item_id}";
		}
		return "order_{$order_id}_product_{$product_id}_var_{$variation_id}";
	}

	private function get_table( string $base_name ): string {
		global $wpdb;
		$candidate = $wpdb->prefix . 'fct_' . $base_name;
		return $this->table_exists( $candidate ) ? $candidate : $candidate;
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
