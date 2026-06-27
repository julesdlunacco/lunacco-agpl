<?php
/**
 * Auth handler — login, register, logout, user context REST endpoints.
 *
 * Migrated from luna-tarot's backend.php (lines 2260-2568).
 *
 * New in lunacco-core:
 *   - IP blocking via LunaCco_Auth_Security (integrated into handle_login)
 *   - FluentAuth references removed; built-in forms only
 *   - User context extensible via 'lunacco_user_context_data' filter
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_Auth_Handler {

	private LunaCco_Auth_Security $security;
	private LunaCco_Credit_System $credits;

	public function __construct( LunaCco_Auth_Security $security, LunaCco_Credit_System $credits ) {
		$this->security = $security;
		$this->credits  = $credits;
	}

	// ------------------------------------------------------------------
	// WordPress hooks
	// ------------------------------------------------------------------

	/**
	 * Called on 'user_register' action — awards free sign-up credits.
	 */
	public function on_user_register( int $user_id ): void {
		$this->credits->award_free_account_credits( $user_id );
	}

	// ------------------------------------------------------------------
	// REST endpoint handlers (registered by LunaCco_REST_API)
	// ------------------------------------------------------------------

	/** POST lunacco/v1/user/login */
	public function handle_login( WP_REST_Request $request ) {
		$params   = $request->get_json_params();
		$username = sanitize_text_field( $params['username'] ?? '' );
		$password = $params['password'] ?? '';

		// IP security check (Phase 5 — stubbed here, real logic in class-auth-security.php).
		$ip = $this->get_client_ip();
		if ( $this->security->check_ip_blocked( $ip ) ) {
			return new WP_Error(
				'ip_blocked',
				'Too many failed login attempts. Please try again later.',
				[ 'status' => 429 ]
			);
		}

		$user = wp_signon(
			[ 'user_login' => $username, 'user_password' => $password, 'remember' => true ],
			is_ssl()
		);

		if ( is_wp_error( $user ) ) {
			$this->security->record_failed_attempt( $ip, $username );
			return new WP_Error( 'login_failed', $user->get_error_message(), [ 'status' => 403 ] );
		}

		$this->security->clear_attempts( $ip );
		$this->security->log_event( 'login_success', $ip, $username, $user->ID );
		wp_set_current_user( $user->ID );
		wp_set_auth_cookie( $user->ID, true, is_ssl() );
		$this->process_subscription_check( $user->ID );

		// Backfill any FluentCart orders not yet credited.
		$synced = lunacco_core()->fluentcart()->sync_orders_for_user( $user->ID );

		$context                 = $this->build_user_context( $user->ID );
		$context['nonce']        = wp_create_nonce( 'wp_rest' );
		$context['fc_synced']    = $synced;
		$context['redirect_url'] = $this->get_post_login_redirect();

		return rest_ensure_response( $context );
	}

	/** POST lunacco/v1/user/register */
	public function handle_register( WP_REST_Request $request ) {
		$params       = $request->get_json_params();
		$email        = sanitize_email( $params['email'] ?? '' );
		$password     = (string) ( $params['password'] ?? '' );
		$display_name = sanitize_text_field( $params['display_name'] ?? '' );
		$username_raw = sanitize_user( $params['username'] ?? '', true );

		if ( $email === '' || ! is_email( $email ) ) {
			return new WP_Error( 'invalid_email', 'Please enter a valid email address.', [ 'status' => 400 ] );
		}
		if ( strlen( $password ) < 8 ) {
			return new WP_Error( 'invalid_password', 'Password must be at least 8 characters.', [ 'status' => 400 ] );
		}

		// Derive username from email if not provided.
		$username = $username_raw !== '' ? $username_raw : sanitize_user( current( explode( '@', $email ) ), true );
		if ( $username === '' ) {
			$username = 'user_' . wp_generate_password( 6, false, false );
		}

		// Ensure username is unique.
		$base   = $username;
		$suffix = 1;
		while ( username_exists( $username ) ) {
			$username = $base . $suffix++;
		}

		if ( email_exists( $email ) ) {
			return new WP_Error( 'email_exists', 'An account with that email already exists.', [ 'status' => 409 ] );
		}

		$user_id = wp_insert_user( [
			'user_login'   => $username,
			'user_pass'    => $password,
			'user_email'   => $email,
			'display_name' => $display_name !== '' ? $display_name : $username,
			'nickname'     => $display_name !== '' ? $display_name : $username,
			'role'         => get_option( 'default_role', 'subscriber' ),
		] );

		if ( is_wp_error( $user_id ) ) {
			return $user_id;
		}

		wp_set_current_user( $user_id );
		wp_set_auth_cookie( $user_id, true, is_ssl() );
		$this->security->log_event( 'register_success', $this->get_client_ip(), $username, $user_id );
		$this->credits->award_free_account_credits( $user_id );
		$this->process_subscription_check( $user_id );

		$context               = $this->build_user_context( $user_id );
		$context['nonce']      = wp_create_nonce( 'wp_rest' );
		$context['registered'] = true;

		return rest_ensure_response( $context );
	}

	/** POST lunacco/v1/user/logout */
	public function handle_logout( WP_REST_Request $request ) {
		wp_logout();
		return rest_ensure_response( [ 'success' => true, 'nonce' => wp_create_nonce( 'wp_rest' ) ] );
	}

	/** GET lunacco/v1/user/context */
	public function handle_get_context( WP_REST_Request $request ) {
		$user_id = get_current_user_id();

		if ( $user_id ) {
			$last_sync = get_user_meta( $user_id, 'lt_last_fc_sync', true );
			if ( ! $last_sync || strtotime( $last_sync ) < strtotime( '-5 minutes' ) ) {
				lunacco_core()->fluentcart()->sync_orders_for_user( $user_id );
				update_user_meta( $user_id, 'lt_last_fc_sync', current_time( 'mysql' ) );
			}
		}

		return rest_ensure_response( $this->build_user_context( $user_id ) );
	}

	/** POST lunacco/v1/user/sync-credits */
	public function handle_sync_credits( WP_REST_Request $request ) {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return new WP_Error( 'not_logged_in', 'Not logged in.', [ 'status' => 401 ] );
		}

		$synced = lunacco_core()->fluentcart()->sync_orders_for_user( $user_id );
		return rest_ensure_response( [
			'success'    => true,
			'fc_synced'  => $synced,
			'context'    => $this->build_user_context( $user_id ),
		] );
	}

	// ------------------------------------------------------------------
	// User context builder
	// ------------------------------------------------------------------

	/**
	 * Build the full user context array returned by GET /user/context.
	 *
	 * Modules can add their own data via the 'lunacco_user_context_data' filter.
	 *
	 * @param int $user_id  0 for guest.
	 * @return array
	 */
	public function build_user_context( int $user_id ): array {
		$user_profile = lunacco_core()->profile();

		if ( ! $user_id ) {
			$context = [
				'balance'                       => 0,
				'membership_balance'            => 0,
				'purchased_balance'             => 0,
				'is_subscriber'                 => false,
				'has_free_daily'                => false,
				'is_admin'                      => false,
				'logged_in'                     => false,
				'has_credits'                   => false,
				'display_name'                  => '',
				'username'                      => '',
				'email'                         => '',
				'avatar_url'                    => '',
				'profile'                       => $user_profile->get_empty_profile(),
				'account_url'                   => esc_url_raw( $this->normalize_url( trailingslashit( home_url( '/' ) ) . 'account' ) ),
				'buy_credits_url'               => esc_url_raw( $this->normalize_url( get_option( 'lt_buy_credits_url', '' ) ) ),
				'become_member_url'             => esc_url_raw( $this->normalize_url( get_option( 'lt_become_member_url', '' ) ) ),
				'auth_button_label'             => 'Sign Up or Login',
				'signup_promo_text'             => $this->get_signup_promo_text(),
				'auth_modal_disabled'           => get_option( 'lt_disable_auth_modal', '0' ) === '1',
				'auth_page_url'                 => esc_url_raw( $this->normalize_url( get_option( 'lt_auth_page_url', '' ) ) ),
			];
		} else {
			$user       = get_user_by( 'id', $user_id );
			$membership = $this->credits->get_membership_balance( $user_id );
			$purchased  = $this->credits->get_purchased_balance( $user_id );
			$balance    = $membership + $purchased;
			$is_sub     = get_user_meta( $user_id, 'lt_is_subscriber', true ) === 'yes';
			$is_admin   = user_can( $user_id, 'manage_options' );

			$context = [
				'balance'                       => $is_admin ? 999999 : $balance,
				'membership_balance'            => $membership,
				'purchased_balance'             => $purchased,
				'is_subscriber'                 => $is_sub,
				'has_free_daily'                => get_user_meta( $user_id, 'lt_has_free_daily', true ) === 'yes',
				'is_admin'                      => $is_admin,
				'logged_in'                     => true,
				'has_credits'                   => $is_admin || $balance > 0 || $is_sub,
				'display_name'                  => $user ? $user->display_name : '',
				'username'                      => $user ? $user->user_login : '',
				'email'                         => $user ? $user->user_email : '',
				'avatar_url'                    => esc_url_raw( $this->normalize_url( get_avatar_url( $user_id, [ 'size' => 96 ] ) ) ),
				'profile'                       => $user_profile->get( $user_id ),
				'account_url'                   => esc_url_raw( $this->normalize_url( trailingslashit( home_url( '/' ) ) . 'account' ) ),
				'buy_credits_url'               => esc_url_raw( $this->normalize_url( get_option( 'lt_buy_credits_url', '' ) ) ),
				'become_member_url'             => esc_url_raw( $this->normalize_url( get_option( 'lt_become_member_url', '' ) ) ),
				'auth_button_label'             => 'Sign Up or Login',
				'signup_promo_text'             => $this->get_signup_promo_text(),
				'auth_modal_disabled'           => get_option( 'lt_disable_auth_modal', '0' ) === '1',
				'auth_page_url'                 => esc_url_raw( $this->normalize_url( get_option( 'lt_auth_page_url', '' ) ) ),
			];
		}

		/**
		 * Allows modules to append their own data to the user context.
		 * Modules should key their data under their module id to avoid collisions.
		 *
		 * @param array $context  The base context array.
		 * @param int   $user_id  0 for guest.
		 */
		return (array) apply_filters( 'lunacco_user_context_data', $context, $user_id );
	}

	// ------------------------------------------------------------------
	// Subscription check
	// ------------------------------------------------------------------

	public function process_subscription_check( int $user_id ): void {
		lunacco_core()->fluentcart()->process_subscription_check( $user_id );
	}

	// ------------------------------------------------------------------
	// Helpers
	// ------------------------------------------------------------------

	private function get_signup_promo_text(): string {
		$credits = max( 0, (int) get_option( 'lt_free_account_credit_amount', 3 ) );
		if ( $credits <= 0 ) {
			return '';
		}
		return sprintf( 'Get %d free credit%s when you sign up.', $credits, $credits === 1 ? '' : 's' );
	}

	private function get_post_login_redirect(): string {
		$url = (string) get_option( 'lunacco_post_login_redirect_url', '' );
		return $url !== '' ? esc_url_raw( $this->normalize_url( $url ) ) : '';
	}

	private function normalize_url( $url ): string {
		if ( ! is_string( $url ) || $url === '' ) {
			return '';
		}
		$scheme = strtolower( (string) wp_parse_url( home_url( '/' ), PHP_URL_SCHEME ) ) === 'https' ? 'https' : ( is_ssl() ? 'https' : 'http' );
		return set_url_scheme( $url, $scheme );
	}

	private function get_client_ip(): string {
		return sanitize_text_field( (string) ( $_SERVER['REMOTE_ADDR'] ?? '' ) );
	}
}
