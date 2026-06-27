<?php
/**
 * Credit system — balance management, ledger writes, free-account credits.
 *
 * Migrated from luna-tarot's includes/backend.php (lines 106-343 and
 * the add_credits method at line 1894).
 *
 * User meta keys (unchanged from luna-tarot):
 *   lt_membership_balance, lt_purchased_balance, lt_current_balance,
 *   lt_is_subscriber, lt_has_free_daily, lt_last_free_daily_reading,
 *   lt_last_fc_sync, lt_sub_last_renewal,
 *   lt_free_account_credits_granted, lt_free_account_credit_period
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_Credit_System {

	/** @var LunaCco_Credit_Ledger|null */
	private ?LunaCco_Credit_Ledger $ledger = null;

	// ------------------------------------------------------------------
	// Activation — table creation
	// ------------------------------------------------------------------

	/**
	 * Creates the wp_luna_credits_log table if it does not exist.
	 * Called during lunacco-core activation; safe to run repeatedly (uses dbDelta).
	 */
	public function ensure_table(): bool {
		global $wpdb;

		$table = $wpdb->prefix . 'luna_credits_log';

		if ( $this->table_exists( $table ) ) {
			// Add entry_meta column if missing (schema upgrade for old installs).
			if ( ! $this->column_exists( $table, 'entry_meta' ) ) {
				$wpdb->query( "ALTER TABLE {$table} ADD COLUMN entry_meta longtext NULL AFTER order_id" );
			}
			return true;
		}

		$charset_collate = $wpdb->get_charset_collate();
		$sql = "CREATE TABLE {$table} (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			user_id bigint(20) NOT NULL,
			amount int(11) NOT NULL,
			action_type varchar(50) NOT NULL,
			order_id varchar(100) DEFAULT NULL,
			entry_meta longtext NULL,
			timestamp datetime DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY user_id (user_id),
			KEY order_id (order_id)
		) {$charset_collate};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );

		return $this->table_exists( $table );
	}

	// ------------------------------------------------------------------
	// Ledger accessor
	// ------------------------------------------------------------------

	public function get_ledger(): LunaCco_Credit_Ledger {
		if ( ! ( $this->ledger instanceof LunaCco_Credit_Ledger ) ) {
			$this->ledger = new LunaCco_Credit_Ledger( [ $this, 'debug' ] );
		}
		return $this->ledger;
	}

	// ------------------------------------------------------------------
	// Balance getters
	// ------------------------------------------------------------------

	public function get_membership_balance( int $user_id ): int {
		if ( $user_id <= 0 ) {
			return 0;
		}
		return max( 0, (int) get_user_meta( $user_id, 'lt_membership_balance', true ) );
	}

	public function get_purchased_balance( int $user_id ): int {
		if ( $user_id <= 0 ) {
			return 0;
		}
		return max( 0, (int) get_user_meta( $user_id, 'lt_purchased_balance', true ) );
	}

	public function get_total_balance( int $user_id ): int {
		return $this->get_membership_balance( $user_id ) + $this->get_purchased_balance( $user_id );
	}

	// ------------------------------------------------------------------
	// Balance setters
	// ------------------------------------------------------------------

	public function set_balances( int $user_id, int $membership, int $purchased ): void {
		$membership = max( 0, $membership );
		$purchased  = max( 0, $purchased );
		update_user_meta( $user_id, 'lt_membership_balance', $membership );
		update_user_meta( $user_id, 'lt_purchased_balance', $purchased );
		update_user_meta( $user_id, 'lt_current_balance', $membership + $purchased );
	}

	public function reset_membership_balance( int $user_id ): void {
		if ( $user_id <= 0 ) {
			return;
		}
		$this->set_balances( $user_id, 0, $this->get_purchased_balance( $user_id ) );
	}

	// ------------------------------------------------------------------
	// Credit writes
	// ------------------------------------------------------------------

	/**
	 * Insert a credit ledger row.
	 * Idempotent: if $order_id is provided and already exists in the log, returns false.
	 *
	 * @param int         $user_id
	 * @param int         $amount      Positive = credit, negative = debit.
	 * @param string      $action_type
	 * @param string|null $order_id    Idempotency key.
	 * @param array       $entry_meta
	 * @return bool
	 */
	public function add_credits( int $user_id, int $amount, string $action_type, ?string $order_id = null, array $entry_meta = [] ): bool {
		global $wpdb;

		if ( ! $this->ensure_table() ) {
			$this->debug( 'add_credits aborted: credits table missing', compact( 'user_id', 'amount', 'action_type', 'order_id' ) );
			return false;
		}

		if ( $order_id ) {
			$exists = $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}luna_credits_log WHERE order_id = %s",
				$order_id
			) );
			if ( $exists > 0 ) {
				$this->debug( 'add_credits skipped: idempotent hit', [ 'order_id' => $order_id ] );
				return false;
			}
		}

		$encoded_meta = $this->get_ledger()->encode_entry_meta( $entry_meta );
		$inserted     = $wpdb->insert( "{$wpdb->prefix}luna_credits_log", [
			'user_id'     => $user_id,
			'amount'      => $amount,
			'action_type' => $action_type,
			'order_id'    => $order_id,
			'entry_meta'  => $encoded_meta,
		] );

		if ( $inserted === false ) {
			$this->debug( 'add_credits insert failed', [ 'db_error' => $wpdb->last_error ] );
			return false;
		}

		$this->debug( 'add_credits success', [
			'user_id'     => $user_id,
			'amount'      => $amount,
			'action_type' => $action_type,
			'order_id'    => $order_id,
			'new_balance' => $this->get_total_balance( $user_id ),
		] );

		return true;
	}

	/**
	 * Award membership credits (resets membership bucket to this amount).
	 */
	public function award_membership_credits( int $user_id, int $amount, string $action_type, ?string $order_id = null, array $entry_meta = [] ): bool {
		$amount = max( 0, $amount );
		if ( $user_id <= 0 || $amount <= 0 ) {
			return false;
		}

		$added = $this->add_credits( $user_id, $amount, $action_type, $order_id, $entry_meta );
		if ( $added ) {
			$this->set_balances( $user_id, $amount, $this->get_purchased_balance( $user_id ) );
		}
		return $added;
	}

	/**
	 * Deduct credits from the user's balance.
	 * Consumes membership credits first, then purchased credits.
	 */
	public function consume_credits( int $user_id, int $amount, string $action_type, ?string $order_id = null, array $entry_meta = [] ): bool {
		$amount = max( 0, $amount );
		if ( $user_id <= 0 || $amount <= 0 ) {
			return false;
		}

		$membership = $this->get_membership_balance( $user_id );
		$purchased  = $this->get_purchased_balance( $user_id );

		if ( ( $membership + $purchased ) < $amount ) {
			return false;
		}

		$remaining       = $amount;
		$membership_used = min( $membership, $remaining );
		$membership      -= $membership_used;
		$remaining       -= $membership_used;

		$purchased_used = min( $purchased, $remaining );
		$purchased      -= $purchased_used;
		$remaining      -= $purchased_used;

		if ( $remaining > 0 ) {
			return false;
		}

		$deducted = $this->add_credits( $user_id, -$amount, $action_type, $order_id, $entry_meta );
		if ( $deducted ) {
			$this->set_balances( $user_id, $membership, $purchased );
		}
		return $deducted;
	}

	/**
	 * Rebuild user's balance meta from ledger history.
	 */
	public function rebuild_balances_from_ledger( int $user_id ): array {
		$user_id = (int) $user_id;
		if ( $user_id <= 0 ) {
			return [ 'membership_balance' => 0, 'purchased_balance' => 0, 'total_balance' => 0, 'rows_processed' => 0 ];
		}

		$balances = $this->get_ledger()->rebuild_user_balances( $user_id );
		$this->set_balances( $user_id, $balances['membership_balance'] ?? 0, $balances['purchased_balance'] ?? 0 );
		return $balances;
	}

	// ------------------------------------------------------------------
	// Entitlements — one-time per-(user, item, person) chart purchases
	// ------------------------------------------------------------------

	/**
	 * Creates the wp_lunacco_entitlements table if it does not exist.
	 * person_id = 0 means the user's own profile (self); a luna_people.id otherwise.
	 */
	public function ensure_entitlements_table(): bool {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_entitlements';
		if ( $this->table_exists( $table ) ) {
			return true;
		}

		$charset_collate = $wpdb->get_charset_collate();
		$sql = "CREATE TABLE {$table} (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			user_id bigint(20) NOT NULL,
			module_id varchar(50) NOT NULL,
			item_key varchar(100) NOT NULL,
			person_id bigint(20) NOT NULL DEFAULT 0,
			credits int(11) NOT NULL DEFAULT 0,
			label varchar(255) DEFAULT '',
			order_id varchar(100) DEFAULT NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uniq_ent (user_id, module_id, item_key, person_id),
			KEY user_id (user_id)
		) {$charset_collate};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );

		return $this->table_exists( $table );
	}

	/**
	 * Has the user already purchased this item for this person?
	 * person_id null/0 = the user's own profile.
	 */
	public function has_entitlement( int $user_id, string $module_id, string $item_key, ?int $person_id = 0 ): bool {
		global $wpdb;
		if ( $user_id <= 0 || $item_key === '' ) {
			return false;
		}
		$this->ensure_entitlements_table();
		$pid   = (int) ( $person_id ?? 0 );
		$found = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}lunacco_entitlements WHERE user_id = %d AND module_id = %s AND item_key = %s AND person_id = %d LIMIT 1",
			$user_id, $module_id, $item_key, $pid
		) );
		return ! empty( $found );
	}

	/**
	 * Record a one-time entitlement (idempotent on user/module/item/person).
	 * Call this AFTER consume_credits() succeeds.
	 */
	public function record_entitlement( int $user_id, string $module_id, string $item_key, ?int $person_id, int $credits, string $label = '', ?string $order_id = null ): bool {
		global $wpdb;
		if ( $user_id <= 0 || $item_key === '' ) {
			return false;
		}
		$this->ensure_entitlements_table();
		$pid = (int) ( $person_id ?? 0 );
		if ( $this->has_entitlement( $user_id, $module_id, $item_key, $pid ) ) {
			return true;
		}
		$inserted = $wpdb->insert( "{$wpdb->prefix}lunacco_entitlements", [
			'user_id'   => $user_id,
			'module_id' => $module_id,
			'item_key'  => $item_key,
			'person_id' => $pid,
			'credits'   => $credits,
			'label'     => $label,
			'order_id'  => $order_id,
		] );
		return $inserted !== false;
	}

	/**
	 * List item_keys the user owns for a module/person (for the SPA to pre-resolve
	 * "owned vs needs-purchase" before charging).
	 */
	public function list_entitlements( int $user_id, string $module_id, ?int $person_id = 0 ): array {
		global $wpdb;
		if ( $user_id <= 0 ) {
			return [];
		}
		$this->ensure_entitlements_table();
		$pid  = (int) ( $person_id ?? 0 );
		$keys = $wpdb->get_col( $wpdb->prepare(
			"SELECT item_key FROM {$wpdb->prefix}lunacco_entitlements WHERE user_id = %d AND module_id = %s AND person_id = %d",
			$user_id, $module_id, $pid
		) );
		return array_values( array_unique( array_map( 'strval', $keys ?: [] ) ) );
	}

	// ------------------------------------------------------------------
	// Free-account credits
	// ------------------------------------------------------------------

	public function get_signup_credit_mode(): string {
		$mode = sanitize_key( get_option( 'lt_free_account_credit_mode', 'one_time' ) );
		return in_array( $mode, [ 'one_time', 'monthly' ], true ) ? $mode : 'one_time';
	}

	public function award_free_account_credits( int $user_id, bool $force = false ): bool {
		$user_id = (int) $user_id;
		$amount  = max( 0, (int) get_option( 'lt_free_account_credit_amount', 3 ) );
		if ( $user_id <= 0 || $amount <= 0 ) {
			return false;
		}

		$mode = $this->get_signup_credit_mode();

		if ( $mode === 'one_time' && ! $force && get_user_meta( $user_id, 'lt_free_account_credits_granted', true ) === 'yes' ) {
			return false;
		}

		if ( $mode === 'monthly' ) {
			$current_period = current_time( 'Y-m' );
			$last_period    = (string) get_user_meta( $user_id, 'lt_free_account_credit_period', true );
			if ( ! $force && $last_period === $current_period ) {
				return false;
			}

			$awarded = $this->award_membership_credits(
				$user_id,
				$amount,
				'free_account_monthly_reset',
				'free_account_monthly_' . $user_id . '_' . $current_period,
				[
					'bucket'       => 'membership',
					'action_label' => 'Free Monthly Credits Reset',
					'reason_label' => 'Monthly free-account credit refresh',
				]
			);
			if ( $awarded ) {
				update_user_meta( $user_id, 'lt_free_account_credits_granted', 'yes' );
				update_user_meta( $user_id, 'lt_free_account_credit_period', $current_period );
			}
			return $awarded;
		}

		// one_time mode.
		$awarded = $this->add_credits(
			$user_id,
			$amount,
			'free_account_signup',
			'free_account_signup_' . $user_id,
			[
				'bucket'       => 'purchased',
				'action_label' => 'Free Account Credits Added',
				'reason_label' => 'New account starter credits',
			]
		);
		if ( $awarded ) {
			$this->set_balances( $user_id, $this->get_membership_balance( $user_id ), $this->get_purchased_balance( $user_id ) + $amount );
			update_user_meta( $user_id, 'lt_free_account_credits_granted', 'yes' );
		}
		return $awarded;
	}

	// ------------------------------------------------------------------
	// Helpers
	// ------------------------------------------------------------------

	public function debug( string $message, array $context = [] ): void {
		if ( ! defined( 'WP_DEBUG' ) || ! WP_DEBUG ) {
			return;
		}
		$line = '[LunaCco] ' . $message;
		if ( ! empty( $context ) ) {
			$line .= ' ' . wp_json_encode( $context );
		}
		error_log( $line );
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
