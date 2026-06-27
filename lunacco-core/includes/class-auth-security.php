<?php
/**
 * Auth security — IP blocking, login attempt tracking, whitelist, permanent blocks,
 * magic login tokens, and lockout audit log.
 *
 * Terminology:
 *   Lockout      — temporary block for `lunacco_lockout_duration` minutes after
 *                  `lunacco_max_login_attempts` consecutive failures. Clears on success
 *                  or when the transient expires.
 *   Permanent    — indefinite block stored in the `lunacco_ip_permanent_blocks` option.
 *                  Set manually by an admin or automatically when an IP accumulates
 *                  `lunacco_permanent_block_threshold` lockouts (0 = auto-promote disabled).
 *   Whitelist    — IPs that are never blocked, regardless of attempts.
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_Auth_Security {

	// Transient key prefixes (hashed IP suffix to avoid exposing IPs in keys).
	private const ATTEMPTS_PREFIX      = 'lc_login_att_';   // attempt counter during lockout window
	private const LOCKOUT_COUNT_PREFIX = 'lc_lockout_cnt_'; // cumulative lockout count (30-day window)

	// ------------------------------------------------------------------
	// Public API — called by LunaCco_Auth_Handler
	// ------------------------------------------------------------------

	/**
	 * Returns true if the IP is currently blocked (temporary or permanent).
	 * Whitelisted IPs always return false.
	 */
	public function check_ip_blocked( string $ip ): bool {
		if ( $this->is_whitelisted( $ip ) ) {
			return false;
		}
		if ( $this->is_permanently_blocked( $ip ) ) {
			return true;
		}
		$hash     = $this->ip_hash( $ip );
		$attempts = (int) get_transient( self::ATTEMPTS_PREFIX . $hash );
		$max      = (int) get_option( 'lunacco_max_login_attempts', 3 );
		return $attempts >= $max;
	}

	/**
	 * Increment the failed-attempt counter for an IP and log when a lockout threshold is hit.
	 *
	 * @param string $ip       Client IP.
	 * @param string $username The login identifier attempted (for the audit log).
	 */
	public function record_failed_attempt( string $ip, string $username = '' ): void {
		if ( $this->is_whitelisted( $ip ) ) {
			return;
		}

		$hash         = $this->ip_hash( $ip );
		$duration_min = (int) get_option( 'lunacco_lockout_duration', 60 );
		$duration_sec = max( 60, $duration_min * 60 );
		$max          = (int) get_option( 'lunacco_max_login_attempts', 3 );

		$attempts_key = self::ATTEMPTS_PREFIX . $hash;
		$attempts     = (int) get_transient( $attempts_key );
		$attempts++;
		set_transient( $attempts_key, $attempts, $duration_sec );

		// First time we hit the threshold → log a lockout and check for auto-promote.
		if ( $attempts === $max ) {
			$this->log_event( 'lockout', $ip, $username );
			$this->maybe_auto_permanent_block( $ip, $hash );
		}
	}

	/**
	 * Clear the failed-attempt transient for an IP (called on successful login).
	 */
	public function clear_attempts( string $ip ): void {
		delete_transient( self::ATTEMPTS_PREFIX . $this->ip_hash( $ip ) );
	}

	/**
	 * Check whether an IP is in the whitelist (one per line option).
	 */
	public function is_whitelisted( string $ip ): bool {
		$raw   = (string) get_option( 'lunacco_ip_whitelist', '' );
		$lines = array_filter( array_map( 'trim', explode( "\n", $raw ) ) );
		return in_array( $ip, array_values( $lines ), true );
	}

	/**
	 * Check whether an IP is in the permanent block list.
	 */
	public function is_permanently_blocked( string $ip ): bool {
		return isset( $this->get_permanent_blocks()[ $ip ] );
	}

	// ------------------------------------------------------------------
	// Permanent blocks
	// ------------------------------------------------------------------

	/**
	 * Add an IP to the permanent block list.
	 *
	 * @param string $ip     IP to block.
	 * @param string $reason 'manual' | 'auto'.
	 * @param string $actor  WordPress user ID or label of who triggered the block.
	 */
	public function add_permanent_block( string $ip, string $reason = 'manual', string $actor = '' ): void {
		$blocks        = $this->get_permanent_blocks();
		$blocks[ $ip ] = [
			'ip'         => $ip,
			'reason'     => $reason,
			'blocked_at' => current_time( 'mysql' ),
			'blocked_by' => $actor,
		];
		update_option( 'lunacco_ip_permanent_blocks', wp_json_encode( $blocks ), false );
		$this->log_event( 'permanent_block', $ip, '', 0, $actor );

		if ( get_option( 'lunacco_block_notify_admin', '0' ) === '1' ) {
			$this->notify_admin_of_block( $ip, $reason );
		}
	}

	/**
	 * Email the site admin when an IP is permanently blocked (if enabled).
	 */
	private function notify_admin_of_block( string $ip, string $reason ): void {
		$site  = get_option( 'lt_app_header_title', '' ) ?: get_bloginfo( 'name' );
		$admin = get_option( 'admin_email' );
		if ( ! $admin ) {
			return;
		}
		$subject  = sprintf( 'Security alert: IP blocked on %s', $site );
		$reason_l = ( 'auto' === $reason ) ? 'automatic (exceeded lockout threshold)' : 'manual';
		$message  = sprintf(
			"A new IP address has been permanently blocked on %s.\n\nIP address: %s\nReason: %s\nTime: %s\n\nManage blocks in the Security & Access admin page.",
			$site,
			$ip,
			$reason_l,
			current_time( 'mysql' )
		);
		wp_mail( $admin, $subject, $message );
	}

	/**
	 * Remove an IP from the permanent block list and clear its attempt transient.
	 */
	public function remove_permanent_block( string $ip, string $actor = '' ): void {
		$blocks = $this->get_permanent_blocks();
		if ( isset( $blocks[ $ip ] ) ) {
			unset( $blocks[ $ip ] );
			update_option( 'lunacco_ip_permanent_blocks', wp_json_encode( $blocks ), false );
		}
		$this->clear_attempts( $ip );
		$this->log_event( 'manual_unblock', $ip, '', 0, $actor );
	}

	/**
	 * Return all permanent blocks as an associative array keyed by IP.
	 *
	 * @return array<string, array{ip:string, reason:string, blocked_at:string, blocked_by:string}>
	 */
	public function get_permanent_blocks(): array {
		$raw  = (string) get_option( 'lunacco_ip_permanent_blocks', '' );
		$data = $raw ? json_decode( $raw, true ) : [];
		return is_array( $data ) ? $data : [];
	}

	// ------------------------------------------------------------------
	// Magic login
	// ------------------------------------------------------------------

	/**
	 * Generate a single-use magic login token for a WordPress user.
	 *
	 * Returns the raw (un-hashed) token string. The caller is responsible
	 * for building and delivering the URL — this class never handles email.
	 *
	 * @param int $user_id    Target user ID.
	 * @param int $created_by Admin user ID who generated the link.
	 * @return string Raw token (48 alphanumeric characters).
	 */
	public function generate_magic_token( int $user_id, int $created_by = 0 ): string {
		$token       = wp_generate_password( 48, false, false );
		$expiry_min  = max( 1, (int) get_option( 'lunacco_magic_login_expiry', 15 ) );
		$expiry_time = time() + ( $expiry_min * 60 );

		update_user_meta( $user_id, '_lunacco_magic_token',        wp_hash_password( $token ) );
		update_user_meta( $user_id, '_lunacco_magic_token_expiry', $expiry_time );

		$this->log_event( 'magic_login_generated', '', '', $user_id, (string) $created_by );

		return $token;
	}

	/**
	 * User-facing magic login request: look up a user by email, generate a token,
	 * and send the link via wp_mail().
	 *
	 * Returns true if the email was sent (user found + enabled).
	 * Returns false silently if the feature is disabled or the email is not registered —
	 * callers should return a generic response regardless to avoid email enumeration.
	 *
	 * Applies a per-IP rate limit (3 requests per 60 seconds) to prevent abuse.
	 *
	 * @param string $email   Email address entered by the user.
	 * @param string $client_ip  Client IP (for rate limiting).
	 * @return bool  Whether an email was actually sent.
	 */
	public function request_magic_login_by_email( string $email, string $client_ip = '' ): bool {
		if ( get_option( 'lunacco_magic_login_enabled', '0' ) !== '1' ) {
			return false;
		}

		// Rate limit: max 3 requests per IP per 60 seconds.
		if ( $client_ip !== '' ) {
			$rate_key   = 'lc_magic_rate_' . $this->ip_hash( $client_ip );
			$rate_count = (int) get_transient( $rate_key );
			if ( $rate_count >= 3 ) {
				return false;
			}
			set_transient( $rate_key, $rate_count + 1, 60 );
		}

		$user = get_user_by( 'email', sanitize_email( $email ) );
		if ( ! $user ) {
			return false;
		}

		$token   = $this->generate_magic_token( $user->ID, 0 );
		$url     = $this->build_magic_login_url( $user->ID, $token );
		$expiry  = (int) get_option( 'lunacco_magic_login_expiry', 15 );
		$site    = get_option( 'lt_app_header_title', '' ) ?: get_bloginfo( 'name' );

		$subject = sprintf( 'Your sign-in link for %s', $site );
		$html    = $this->build_magic_login_email_html( $user->display_name, $site, $url, $expiry );
		$headers = [ 'Content-Type: text/html; charset=UTF-8' ];

		return wp_mail( $user->user_email, $subject, $html, $headers );
	}

	/**
	 * Build the branded HTML body for the magic-login email. Uses the logo set in
	 * Business Settings (lt_app_header_logo_url) when present, falling back to the
	 * site name as a wordmark. Email-safe: table layout + inline styles only.
	 */
	private function build_magic_login_email_html( string $name, string $site, string $url, int $expiry ): string {
		$logo      = esc_url( get_option( 'lt_app_header_logo_url', '' ) );
		$site_esc  = esc_html( $site );
		$name_esc  = esc_html( $name );
		$url_esc   = esc_url( $url );
		$expiry    = (int) $expiry;

		$header = $logo
			? '<img src="' . $logo . '" alt="' . esc_attr( $site ) . '" style="max-height:44px;width:auto;display:block;margin:0 auto;" />'
			: '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:22px;font-style:italic;color:#1b1830;">' . $site_esc . '</div>';

		return '
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f2ec;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;padding:32px 0;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e3dfd4;">
      <tr><td style="padding:28px 32px 20px;text-align:center;border-bottom:1px solid #e3dfd4;">' . $header . '</td></tr>
      <tr><td style="padding:28px 32px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1b1830;">
        <p style="margin:0 0 16px;">Hi ' . $name_esc . ',</p>
        <p style="margin:0 0 24px;">Click the button below to sign in to <strong>' . $site_esc . '</strong>. The link expires in <strong>' . $expiry . ' minutes</strong> and can only be used once.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
          <tr><td style="background:#534ab7;border-radius:2px;">
            <a href="' . $url_esc . '" style="display:inline-block;padding:12px 32px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Sign in to ' . $site_esc . '</a>
          </td></tr>
        </table>
        <p style="margin:0 0 8px;font-size:13px;color:#6b6880;">Or paste this link into your browser:</p>
        <p style="margin:0 0 20px;font-size:12px;word-break:break-all;"><a href="' . $url_esc . '" style="color:#534ab7;">' . $url_esc . '</a></p>
        <p style="margin:0;font-size:13px;color:#9a97a8;">If you didn\'t request this, you can safely ignore this email — your account is not at risk.</p>
      </td></tr>
      <tr><td style="padding:16px 32px;border-top:1px solid #e3dfd4;text-align:center;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:#9a97a8;">' . $site_esc . '</td></tr>
    </table>
  </td></tr>
</table>
</body></html>';
	}

	/**
	 * Build the full magic login URL for a token.
	 */
	public function build_magic_login_url( int $user_id, string $token ): string {
		return add_query_arg(
			[ 'lunacco_magic' => '1', 'uid' => $user_id, 'token' => rawurlencode( $token ) ],
			home_url( '/' )
		);
	}

	/**
	 * Validate and consume a magic login token. Returns true on success (deletes token).
	 * Returns false if the token is missing, expired, or incorrect.
	 *
	 * @param int    $user_id Target user ID.
	 * @param string $token   Raw token from the URL.
	 */
	public function consume_magic_token( int $user_id, string $token ): bool {
		$stored_hash = (string) get_user_meta( $user_id, '_lunacco_magic_token', true );
		$expiry      = (int) get_user_meta( $user_id, '_lunacco_magic_token_expiry', true );

		// Always delete meta after a validation attempt to prevent replay.
		delete_user_meta( $user_id, '_lunacco_magic_token' );
		delete_user_meta( $user_id, '_lunacco_magic_token_expiry' );

		if ( ! $stored_hash || ! $expiry ) {
			return false;
		}
		if ( time() > $expiry ) {
			return false;
		}
		if ( ! wp_check_password( $token, $stored_hash ) ) {
			return false;
		}

		$this->log_event( 'magic_login_used', '', '', $user_id );
		return true;
	}

	/**
	 * Hooked to `init` — detects ?lunacco_magic=1&uid=X&token=Y, validates,
	 * logs the user in, and redirects to the app or the configured redirect URL.
	 */
	public function handle_magic_login_request(): void {
		if ( empty( $_GET['lunacco_magic'] ) || $_GET['lunacco_magic'] !== '1' ) {
			return;
		}
		if ( get_option( 'lunacco_magic_login_enabled', '0' ) !== '1' ) {
			return;
		}

		$user_id = (int) ( $_GET['uid'] ?? 0 );
		$token   = sanitize_text_field( (string) ( $_GET['token'] ?? '' ) );

		if ( $user_id <= 0 || $token === '' ) {
			wp_die( 'Invalid magic login link.', 'Magic Login', [ 'response' => 400 ] );
		}

		$user = get_user_by( 'id', $user_id );
		if ( ! $user ) {
			wp_die( 'Invalid magic login link.', 'Magic Login', [ 'response' => 404 ] );
		}

		if ( ! $this->consume_magic_token( $user_id, $token ) ) {
			wp_die(
				'This magic login link has expired or has already been used.',
				'Magic Login Expired',
				[ 'response' => 403 ]
			);
		}

		wp_set_current_user( $user_id );
		wp_set_auth_cookie( $user_id, false, is_ssl() );

		$redirect = (string) get_option( 'lunacco_post_login_redirect_url', '' );
		if ( $redirect === '' ) {
			$redirect = home_url( '/' );
		}

		wp_safe_redirect( esc_url_raw( $redirect ) );
		exit;
	}

	// ------------------------------------------------------------------
	// Audit log
	// ------------------------------------------------------------------

	/**
	 * Append an event to the rolling audit log (most-recent-first, capped at 200 entries).
	 *
	 * @param string $event_type One of: lockout | permanent_block | manual_unblock |
	 *                           magic_login_generated | magic_login_used |
	 *                           login_success | register_success.
	 * @param string $ip         IP address involved (empty for user-only events).
	 * @param string $username   Login identifier attempted (for lockout events).
	 * @param int    $user_id    WordPress user ID (0 for IP-only events).
	 * @param string $actor      Who triggered the action (admin user ID or empty).
	 */
	public function log_event(
		string $event_type,
		string $ip       = '',
		string $username = '',
		int    $user_id  = 0,
		string $actor    = ''
	): void {
		if ( get_option( 'lunacco_lockout_log_enabled', '1' ) !== '1' ) {
			return;
		}

		$log = $this->get_log();
		array_unshift( $log, [
			'time'     => current_time( 'mysql' ),
			'type'     => $event_type,
			'ip'       => $ip,
			'username' => $username,
			'user_id'  => $user_id,
			'actor'    => $actor,
		] );

		if ( count( $log ) > 200 ) {
			$log = array_slice( $log, 0, 200 );
		}

		update_option( 'lunacco_lockout_log', wp_json_encode( $log ), false );
	}

	/**
	 * Retrieve the full audit log array (most-recent-first).
	 *
	 * @return list<array{time:string, type:string, ip:string, username:string, user_id:int, actor:string}>
	 */
	public function get_log(): array {
		$raw  = (string) get_option( 'lunacco_lockout_log', '' );
		$data = $raw ? json_decode( $raw, true ) : [];
		return is_array( $data ) ? $data : [];
	}

	/** Delete all audit log entries. */
	public function clear_log(): void {
		update_option( 'lunacco_lockout_log', '[]', false );
	}

	// ------------------------------------------------------------------
	// Status helper (used by admin page to show live status for an IP)
	// ------------------------------------------------------------------

	/**
	 * Return a summary of the current block status for a given IP.
	 *
	 * @return array{attempts:int, max:int, locked:bool, permanent:bool, whitelisted:bool}
	 */
	public function get_ip_status( string $ip ): array {
		$hash     = $this->ip_hash( $ip );
		$attempts = (int) get_transient( self::ATTEMPTS_PREFIX . $hash );
		$max      = (int) get_option( 'lunacco_max_login_attempts', 3 );
		return [
			'attempts'    => $attempts,
			'max'         => $max,
			'locked'      => ! $this->is_whitelisted( $ip ) && $attempts >= $max,
			'permanent'   => $this->is_permanently_blocked( $ip ),
			'whitelisted' => $this->is_whitelisted( $ip ),
		];
	}

	// ------------------------------------------------------------------
	// Private helpers
	// ------------------------------------------------------------------

	/**
	 * Return a short non-reversible hash of an IP (avoids storing raw IPs in transient keys).
	 */
	private function ip_hash( string $ip ): string {
		return substr( md5( $ip . wp_salt( 'auth' ) ), 0, 16 );
	}

	/**
	 * After a lockout threshold is hit, increment the rolling 30-day lockout counter
	 * and automatically promote to a permanent block if the configured threshold is exceeded.
	 */
	private function maybe_auto_permanent_block( string $ip, string $hash ): void {
		$perm_threshold = (int) get_option( 'lunacco_permanent_block_threshold', 0 );
		if ( $perm_threshold <= 0 ) {
			return; // Auto-promote disabled.
		}

		$count_key = self::LOCKOUT_COUNT_PREFIX . $hash;
		$count     = (int) get_transient( $count_key ) + 1;
		set_transient( $count_key, $count, 30 * DAY_IN_SECONDS );

		if ( $count >= $perm_threshold && ! $this->is_permanently_blocked( $ip ) ) {
			$this->add_permanent_block( $ip, 'auto', 'system' );
		}
	}
}
