<?php
/**
 * Luna AstroHD — Credit Gate.
 *
 * Issues a short-lived signed token after consuming credits for a chart type.
 * The SPA calls /luna-astrohd/v1/calc-token BEFORE running the WASM calc,
 * then presents the token when POSTing computed chart data to /charts.
 *
 * Token flow:
 *   1. SPA posts { chart_type, client_id? } → calc-token
 *   2. Server reads lt_astrohd_chart_display_settings[chart_type]
 *      - if disabled → 403
 *      - if is_premium → consume_credits(user, credit_cost, 'astrohd_<type>', idempotency)
 *   3. Server stores nonce in transient (60s TTL) and returns it
 *   4. SPA runs WASM calc, posts result + nonce to /charts
 *   5. Server validates + consumes transient (one-shot)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Luna_AstroHD_Credit_Gate {

	const TRANSIENT_PREFIX = 'lt_astrohd_tok_';
	const TTL_SECONDS      = 60;

	/**
	 * Resolve the premium/visibility config for the chart the user actually picked.
	 *
	 * Presets (chart-maker charts) carry their own is_premium / credit_cost /
	 * admin_only in the definition-engine preset config, keyed by preset_key.
	 * Built-in default charts use the AstroHD chart-display settings, keyed by
	 * chart_type. Returns null when the chart/preset is unknown.
	 */
	private static function resolve_config( string $chart_type, ?string $preset_key ): ?array {
		if ( $preset_key && function_exists( 'lunacco_core' ) ) {
			$set = lunacco_core()->definitions()->get_active_set_for_module( 'luna-astrohd' );
			if ( ! empty( $set['id'] ) ) {
				$presets = lunacco_core()->definitions()->list_chart_presets( [
					'set_id'     => (int) $set['id'],
					'module_id'  => 'luna-astrohd',
					'preset_key' => $preset_key,
				] );
				if ( ! empty( $presets[0] ) ) {
					$p   = $presets[0];
					$cfg = is_array( $p['config'] ?? null ) ? $p['config'] : [];
					return [
						'enabled'     => ! isset( $cfg['enabled'] ) || ! empty( $cfg['enabled'] ),
						'admin_only'  => ! empty( $cfg['admin_only'] ),
						'is_premium'  => ! empty( $cfg['is_premium'] ),
						'credit_cost' => (int) ( $cfg['credit_cost'] ?? 0 ),
						'label'       => (string) ( $p['title'] ?: $preset_key ),
						'item_key'    => 'preset:' . $preset_key,
						'action_type' => 'astrohd_preset_' . $preset_key,
					];
				}
			}
			return null; // preset_key supplied but not found
		}

		$settings = luna_astrohd_get_chart_display_settings();
		$row      = $settings[ $chart_type ] ?? null;
		if ( ! $row ) {
			return null;
		}
		$labels = function_exists( 'luna_astrohd_chart_types' ) ? luna_astrohd_chart_types() : [];
		return [
			'enabled'     => ! empty( $row['enabled'] ),
			'admin_only'  => ! empty( $row['admin_only'] ),
			'is_premium'  => ! empty( $row['is_premium'] ),
			'credit_cost' => (int) ( $row['credit_cost'] ?? 0 ),
			'label'       => (string) ( $labels[ $chart_type ] ?? $chart_type ),
			'item_key'    => 'chart:' . $chart_type,
			'action_type' => 'astrohd_' . $chart_type,
		];
	}

	public static function issue( int $user_id, string $chart_type, string $idempotency_key, ?int $person_id = null, ?string $preset_key = null ): array {
		$cfg = self::resolve_config( $chart_type, $preset_key );

		if ( ! $cfg ) {
			return [ 'ok' => false, 'code' => 'unknown_chart_type', 'message' => 'Unknown chart type.' ];
		}
		if ( ! $cfg['enabled'] ) {
			return [ 'ok' => false, 'code' => 'chart_disabled', 'message' => 'This chart is currently disabled.' ];
		}

		// Admin-only charts are never available to non-admins — server-side gate
		// (LunaCco hard rule: the frontend may hide them, but PHP enforces it).
		if ( $cfg['admin_only'] && ! user_can( $user_id, 'manage_options' ) ) {
			return [ 'ok' => false, 'code' => 'admin_only', 'message' => 'This chart is not available.' ];
		}

		$cost     = $cfg['is_premium'] ? (int) $cfg['credit_cost'] : 0;
		$consumed = false;
		// person_id 0 = the user's own profile (self).
		$pid = ( $person_id !== null && $person_id > 0 ) ? (int) $person_id : 0;

		// Admin bypass — admins never pay or run out (server-side only).
		if ( $cost > 0 && $user_id > 0 && user_can( $user_id, 'manage_options' ) ) {
			$cost = 0;
		}

		// Already purchased this exact chart for this exact person → free re-view.
		// Ownership is tracked explicitly in the entitlements ledger, NOT inferred
		// from cached chart data (the data is computed regardless; what's premium is
		// the chart's presentation/definitions).
		if ( $cost > 0 && $user_id > 0 && function_exists( 'lunacco_core' )
			&& lunacco_core()->credits()->has_entitlement( $user_id, 'luna-astrohd', $cfg['item_key'], $pid ) ) {
			$cost = 0;
		}

		if ( $cost > 0 ) {
			if ( $user_id <= 0 ) {
				return [ 'ok' => false, 'code' => 'auth_required', 'message' => 'Sign in to use premium charts.' ];
			}
			if ( ! function_exists( 'lunacco_core' ) ) {
				return [ 'ok' => false, 'code' => 'core_unavailable', 'message' => 'LunaCco core not loaded.' ];
			}
			$ok = lunacco_core()->credits()->consume_credits(
				$user_id,
				$cost,
				$cfg['action_type'],
				$idempotency_key,
				[
					'chart_type'   => $chart_type,
					'preset_key'   => $preset_key,
					'person_id'    => $pid,
					'item_key'     => $cfg['item_key'],
					'action_label' => $cfg['label'],
				]
			);
			if ( ! $ok ) {
				return [ 'ok' => false, 'code' => 'insufficient_credits', 'message' => 'Not enough credits.' ];
			}
			$consumed = true;

			// Record the one-time entitlement so future views of this chart for this
			// person are free. Idempotent on (user, module, item_key, person).
			lunacco_core()->credits()->record_entitlement(
				$user_id, 'luna-astrohd', $cfg['item_key'], $pid, $cost, $cfg['label'], $idempotency_key
			);
		}

		$nonce = wp_generate_password( 32, false, false );
		set_transient( self::TRANSIENT_PREFIX . $nonce, [
			'user_id'    => $user_id,
			'chart_type' => $chart_type,
			'cost'       => $cost,
			'consumed'   => $consumed,
			'issued_at'  => time(),
		], self::TTL_SECONDS );

		return [
			'ok'         => true,
			'token'      => $nonce,
			'expires_in' => self::TTL_SECONDS,
			'cost'       => $cost,
		];
	}

	public static function redeem( string $token, string $chart_type, int $user_id ): bool {
		$key  = self::TRANSIENT_PREFIX . $token;
		$data = get_transient( $key );
		if ( ! is_array( $data ) ) {
			return false;
		}
		delete_transient( $key );

		if ( $data['chart_type'] !== $chart_type ) {
			return false;
		}
		if ( (int) $data['user_id'] !== $user_id ) {
			return false;
		}
		return true;
	}
}
