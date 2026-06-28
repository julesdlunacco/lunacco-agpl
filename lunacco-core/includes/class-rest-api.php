<?php
/**
 * Core REST API — registers all lunacco/v1/* endpoints.
 *
 * Routes registered here:
 *   POST   lunacco/v1/user/login
 *   POST   lunacco/v1/user/register
 *   POST   lunacco/v1/user/logout
 *   GET    lunacco/v1/user/context
 *   GET    lunacco/v1/user/profile
 *   POST   lunacco/v1/user/profile
 *   POST   lunacco/v1/user/sync-credits
 *   GET    lunacco/v1/ai/models
 *   POST   lunacco/v1/ai/generate-definition-section
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_REST_API {

	private LunaCco_Auth_Handler $auth;
	private LunaCco_User_Profile $profile;
	private LunaCco_AI_Config    $ai;
	private LunaCco_Theme_Manager $themes;
	private LunaCco_Definition_Engine $definitions;

	public function __construct(
		LunaCco_Auth_Handler $auth,
		LunaCco_User_Profile $profile,
		LunaCco_AI_Config    $ai,
		LunaCco_Theme_Manager $themes,
		LunaCco_Definition_Engine $definitions
	) {
		$this->auth    = $auth;
		$this->profile = $profile;
		$this->ai      = $ai;
		$this->themes  = $themes;
		$this->definitions = $definitions;
	}

	/**
	 * Called on rest_api_init — registers all core routes.
	 */
	public function register_routes(): void {
		$ns = 'lunacco/v1';

		// Auth.
		register_rest_route( $ns, '/user/login', [
			'methods'             => 'POST',
			'callback'            => [ $this->auth, 'handle_login' ],
			'permission_callback' => '__return_true',
		] );

		register_rest_route( $ns, '/user/register', [
			'methods'             => 'POST',
			'callback'            => [ $this->auth, 'handle_register' ],
			'permission_callback' => '__return_true',
		] );

		register_rest_route( $ns, '/user/logout', [
			'methods'             => 'POST',
			'callback'            => [ $this->auth, 'handle_logout' ],
			'permission_callback' => '__return_true',
		] );

		// User context.
		register_rest_route( $ns, '/user/context', [
			'methods'             => 'GET',
			'callback'            => [ $this->auth, 'handle_get_context' ],
			'permission_callback' => '__return_true',
		] );

		// Locations.
		register_rest_route( $ns, '/locations/countries', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_locations_countries' ],
			'permission_callback' => '__return_true',
		] );

		register_rest_route( $ns, '/locations/cities', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_locations_cities' ],
			'permission_callback' => '__return_true',
		] );

		// Profile.
		register_rest_route( $ns, '/user/profile', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this->profile, 'rest_get' ],
				'permission_callback' => 'is_user_logged_in',
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this->profile, 'rest_save' ],
				'permission_callback' => 'is_user_logged_in',
			],
		] );

		// Profile avatar upload — lets any logged-in user (incl. customers without
		// the upload_files cap) set an optional profile image.
		register_rest_route( $ns, '/user/avatar', [
			'methods'             => 'POST',
			'callback'            => [ $this->profile, 'rest_upload_avatar' ],
			'permission_callback' => 'is_user_logged_in',
		] );

		// People.
		register_rest_route( $ns, '/people', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this->profile, 'rest_list_people' ],
				'permission_callback' => 'is_user_logged_in',
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this->profile, 'rest_create_person' ],
				'permission_callback' => 'is_user_logged_in',
			],
		] );

		register_rest_route( $ns, '/people/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ $this->profile, 'rest_update_person' ],
				'permission_callback' => 'is_user_logged_in',
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this->profile, 'rest_delete_person' ],
				'permission_callback' => 'is_user_logged_in',
			],
		] );

		// Credit sync.
		register_rest_route( $ns, '/user/sync-credits', [
			'methods'             => 'POST',
			'callback'            => [ $this->auth, 'handle_sync_credits' ],
			'permission_callback' => 'is_user_logged_in',
		] );

		// Magic login — user-facing email request (no auth required).
		register_rest_route( $ns, '/user/magic-login/request', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'handle_magic_login_request' ],
			'permission_callback' => '__return_true',
		] );

		// Forgot password endpoint.
		register_rest_route( $ns, '/user/forgot-password', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'handle_forgot_password' ],
			'permission_callback' => '__return_true',
		] );

		// AI models (admin only — permission enforced inside handler).
		register_rest_route( $ns, '/ai/models', [
			'methods'             => 'GET',
			'callback'            => [ $this->ai, 'rest_get_models' ],
			'permission_callback' => function () {
				return current_user_can( 'manage_options' );
			},
		] );

		// AI definition section generation — shared by all modules (admin only).
		register_rest_route( $ns, '/ai/generate-definition-section', [
			'methods'             => 'POST',
			'callback'            => [ $this->ai, 'rest_generate_definition_section' ],
			'permission_callback' => function () {
				return current_user_can( 'manage_options' );
			},
		] );

		// Themes. Reading is public — every visitor's SPA needs the custom
		// themes and the site default to render correctly. Writing stays
		// admin-only below.
		register_rest_route( $ns, '/admin/themes', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this->themes, 'rest_get_themes' ],
				'permission_callback' => '__return_true',
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this->themes, 'rest_save_theme' ],
				'permission_callback' => function () { return current_user_can( 'manage_options' ); },
			],
		] );

		register_rest_route( $ns, '/admin/themes/(?P<id>[a-zA-Z0-9_\-]+)', [
			'methods'             => 'DELETE',
			'callback'            => [ $this->themes, 'rest_delete_theme' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/admin/themes/default', [
			'methods'             => 'POST',
			'callback'            => [ $this->themes, 'rest_set_default_theme' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		// Security admin (manage_options only).
		$admin_only = function () { return current_user_can( 'manage_options' ); };
		register_rest_route( $ns, '/admin/security/settings', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_security_get_settings' ],
				'permission_callback' => $admin_only,
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_security_save_settings' ],
				'permission_callback' => $admin_only,
			],
		] );
		register_rest_route( $ns, '/admin/security/my-ip', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_security_my_ip' ],
			'permission_callback' => $admin_only,
		] );
		register_rest_route( $ns, '/admin/security/blocks', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_security_blocks_list' ],
				'permission_callback' => $admin_only,
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_security_block_add' ],
				'permission_callback' => $admin_only,
			],
		] );
		register_rest_route( $ns, '/admin/security/blocks/(?P<ip>[^/]+)', [
			'methods'             => 'DELETE',
			'callback'            => [ $this, 'rest_security_block_remove' ],
			'permission_callback' => $admin_only,
		] );
		register_rest_route( $ns, '/admin/security/log', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_security_log_get' ],
				'permission_callback' => $admin_only,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'rest_security_log_clear' ],
				'permission_callback' => $admin_only,
			],
		] );
		register_rest_route( $ns, '/admin/security/magic-link', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_security_generate_magic_link' ],
			'permission_callback' => $admin_only,
		] );

		// Definition engine.
		register_rest_route( $ns, '/definitions/style-guide', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_definition_style_guide' ],
			'permission_callback' => 'is_user_logged_in',
		] );

		register_rest_route( $ns, '/definitions/blueprints', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_definition_blueprints' ],
			'permission_callback' => 'is_user_logged_in',
		] );

		register_rest_route( $ns, '/definitions/module-contracts', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_definition_module_contracts' ],
			'permission_callback' => 'is_user_logged_in',
		] );

		register_rest_route( $ns, '/definitions/sets', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_definition_sets_list' ],
				'permission_callback' => 'is_user_logged_in',
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_definition_sets_save' ],
				'permission_callback' => function () { return current_user_can( 'manage_options' ); },
			],
		] );

		register_rest_route( $ns, '/definitions/sets/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_definition_set_get' ],
				'permission_callback' => 'is_user_logged_in',
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'rest_definition_set_delete' ],
				'permission_callback' => function () { return current_user_can( 'manage_options' ); },
			],
		] );

		register_rest_route( $ns, '/definitions/sets/(?P<id>\d+)/export', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_definition_set_export' ],
			'permission_callback' => 'is_user_logged_in',
		] );

		register_rest_route( $ns, '/definitions/template-fragments', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_definition_template_fragments' ],
			'permission_callback' => 'is_user_logged_in',
		] );

		register_rest_route( $ns, '/definitions/bundles/validate', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_bundle_validate' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/bundles/import', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_bundle_import' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/import', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_import' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/markdown/import', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_markdown_import' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/sets/(?P<id>\d+)/export-markdown', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_definition_set_export_markdown' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/entities', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_definition_entities_list' ],
				'permission_callback' => 'is_user_logged_in',
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_definition_entities_save' ],
				'permission_callback' => function () { return current_user_can( 'manage_options' ); },
			],
		] );

		register_rest_route( $ns, '/definitions/entities/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ $this, 'rest_definition_entity_delete' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/relationships', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_definition_relationships_list' ],
				'permission_callback' => 'is_user_logged_in',
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_definition_relationships_save' ],
				'permission_callback' => function () { return current_user_can( 'manage_options' ); },
			],
		] );

		register_rest_route( $ns, '/definitions/relationships/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ $this, 'rest_definition_relationship_delete' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/entries', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_definition_entries_list' ],
				'permission_callback' => 'is_user_logged_in',
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_definition_entries_save' ],
				'permission_callback' => function () { return current_user_can( 'manage_options' ); },
			],
		] );

		register_rest_route( $ns, '/definitions/entries/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ $this, 'rest_definition_entry_delete' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/variants', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_definition_variants_list' ],
				'permission_callback' => 'is_user_logged_in',
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_definition_variants_save' ],
				'permission_callback' => function () { return current_user_can( 'manage_options' ); },
			],
		] );

		register_rest_route( $ns, '/definitions/variants/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ $this, 'rest_definition_variant_delete' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/tags', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_definition_tags_list' ],
				'permission_callback' => 'is_user_logged_in',
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_definition_tags_save' ],
				'permission_callback' => function () { return current_user_can( 'manage_options' ); },
			],
		] );

		register_rest_route( $ns, '/definitions/tags/suggest', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_tags_suggest' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/templates', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_definition_templates_list' ],
				'permission_callback' => 'is_user_logged_in',
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_definition_templates_save' ],
				'permission_callback' => function () { return current_user_can( 'manage_options' ); },
			],
		] );

		register_rest_route( $ns, '/definitions/templates/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ $this, 'rest_definition_template_delete' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/chart-presets', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_definition_chart_presets_list' ],
				'permission_callback' => 'is_user_logged_in',
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_definition_chart_presets_save' ],
				'permission_callback' => function () { return current_user_can( 'manage_options' ); },
			],
		] );

		register_rest_route( $ns, '/definitions/chart-presets/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ $this, 'rest_definition_chart_preset_delete' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		// Unified, module-agnostic chart governance (built-in charts + Chart-Maker presets).
		register_rest_route( $ns, '/charts', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_charts_list' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );
		register_rest_route( $ns, '/charts/settings', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_charts_save_settings' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );
		register_rest_route( $ns, '/charts/preset-flags', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_charts_save_preset_flags' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );
		register_rest_route( $ns, '/definitions/sets/(?P<id>\d+)/refresh-templates', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_refresh_templates' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/resolve', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_resolve' ],
			'permission_callback' => 'is_user_logged_in',
		] );

		register_rest_route( $ns, '/definitions/resolve-slot', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_resolve_slot' ],
			'permission_callback' => 'is_user_logged_in',
		] );

		register_rest_route( $ns, '/definitions/resolve-slots', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_resolve_slots' ],
			'permission_callback' => 'is_user_logged_in',
		] );

		register_rest_route( $ns, '/definitions/search', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_definition_search' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/synthesis/theme-scores', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_synthesis_theme_scores' ],
			'permission_callback' => 'is_user_logged_in',
		] );

		register_rest_route( $ns, '/definitions/migrations/astrohd/(?P<legacy_set_id>\d+)', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_migrate_astrohd' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/project/astrohd/(?P<set_id>\d+)', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_definition_project_astrohd' ],
			'permission_callback' => 'is_user_logged_in',
		] );

		register_rest_route( $ns, '/definitions/module-active-set', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_definition_module_active_set' ],
			'permission_callback' => 'is_user_logged_in',
		] );

		register_rest_route( $ns, '/definitions/reset', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_reset' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/seed/astrohd', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_seed_astrohd' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/prune', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_prune' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		register_rest_route( $ns, '/definitions/cleanup/astrohd', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_definition_cleanup_astrohd' ],
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		] );

		// Featured items & per-item level/popular meta (admin only to write).
		register_rest_route( $ns, '/admin/featured', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_featured_get' ],
				'permission_callback' => function () { return current_user_can( 'manage_options' ); },
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_featured_save' ],
				'permission_callback' => function () { return current_user_can( 'manage_options' ); },
			],
		] );
	}

	// ------------------------------------------------------------------
	// Featured handlers
	// ------------------------------------------------------------------

	public function rest_featured_get( WP_REST_Request $request ): WP_REST_Response {
		$data = get_option( 'lunacco_featured', null );
		return new WP_REST_Response( [ 'featured' => $data ], 200 );
	}

	public function rest_featured_save( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params();

		// items: array of { moduleId, id, kind }
		$items = [];
		if ( isset( $params['items'] ) && is_array( $params['items'] ) ) {
			foreach ( $params['items'] as $item ) {
				if ( ! isset( $item['moduleId'], $item['id'], $item['kind'] ) ) continue;
				$items[] = [
					'moduleId' => sanitize_text_field( $item['moduleId'] ),
					'id'       => sanitize_text_field( $item['id'] ),
					'kind'     => sanitize_text_field( $item['kind'] ),
				];
			}
		}

		// meta: { id => { level, popular, featured } }
		$meta = [];
		if ( isset( $params['meta'] ) && is_array( $params['meta'] ) ) {
			foreach ( $params['meta'] as $id => $m ) {
				if ( ! is_array( $m ) ) continue;
				$clean = [];
				if ( isset( $m['level'] ) )    $clean['level']    = sanitize_text_field( $m['level'] );
				if ( isset( $m['popular'] ) )  $clean['popular']  = (bool) $m['popular'];
				if ( isset( $m['featured'] ) ) $clean['featured'] = (bool) $m['featured'];
				$meta[ sanitize_text_field( $id ) ] = $clean;
			}
		}

		$stored = [ 'items' => $items, 'meta' => $meta ];
		update_option( 'lunacco_featured', $stored, false );

		return new WP_REST_Response( [ 'ok' => true, 'featured' => $stored ], 200 );
	}

	/**
	 * POST lunacco/v1/user/magic-login/request
	 *
	 * Accepts { email } and sends a magic login link if the feature is enabled
	 * and the email is registered. Always returns a generic success response to
	 * prevent email enumeration.
	 */
	public function handle_magic_login_request( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		$email  = sanitize_email( (string) ( $params['email'] ?? '' ) );
		$ip     = sanitize_text_field( (string) ( $_SERVER['REMOTE_ADDR'] ?? '' ) );

		if ( $email === '' || ! is_email( $email ) ) {
			return new WP_Error( 'invalid_email', 'Please enter a valid email address.', [ 'status' => 400 ] );
		}

		// Fire and forget — we don't reveal whether the email was found or sent.
		lunacco_core()->auth_security()->request_magic_login_by_email( $email, $ip );

		return rest_ensure_response( [
			'success' => true,
			'message' => 'If that email is registered, a sign-in link is on its way. Check your inbox (and spam folder).',
		] );
	}

	/**
	 * POST lunacco/v1/user/forgot-password
	 *
	 * Sends a WordPress password reset link for the provided username or email.
	 */
	public function handle_forgot_password( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		$login  = sanitize_text_field( (string) ( $params['username_or_email'] ?? '' ) );

		if ( empty( $login ) ) {
			return new WP_Error( 'empty_username', 'Please enter your username or email address.', [ 'status' => 400 ] );
		}

		$user = null;
		if ( is_email( $login ) ) {
			$user = get_user_by( 'email', $login );
		} else {
			$user = get_user_by( 'login', $login );
		}

		if ( ! $user ) {
			// Always return success to prevent email verification probing
			return rest_ensure_response( [
				'success' => true,
				'message' => 'If that account exists, a password reset link has been sent to your email.',
			] );
		}

		$errors = retrieve_password( $user->user_login );

		if ( is_wp_error( $errors ) ) {
			return new WP_Error( 'retrieve_password_failed', $errors->get_error_message(), [ 'status' => 500 ] );
		}

		return rest_ensure_response( [
			'success' => true,
			'message' => 'A password reset link has been sent to your email.',
		] );
	}

	// ------------------------------------------------------------------
	// Security admin REST handlers
	// ------------------------------------------------------------------

	public function rest_security_get_settings(): WP_REST_Response {
		return rest_ensure_response( [
			'max_login_attempts'        => (int) get_option( 'lunacco_max_login_attempts', 3 ),
			'lockout_duration'          => (int) get_option( 'lunacco_lockout_duration', 60 ),
			'permanent_block_threshold' => (int) get_option( 'lunacco_permanent_block_threshold', 0 ),
			'ip_whitelist'              => (string) get_option( 'lunacco_ip_whitelist', '' ),
			'magic_login_enabled'       => get_option( 'lunacco_magic_login_enabled', '0' ) === '1',
			'magic_login_expiry'        => (int) get_option( 'lunacco_magic_login_expiry', 15 ),
			'post_login_redirect_url'   => (string) get_option( 'lunacco_post_login_redirect_url', '' ),
			'lockout_log_enabled'       => get_option( 'lunacco_lockout_log_enabled', '1' ) === '1',
			'block_notify_admin'        => get_option( 'lunacco_block_notify_admin', '0' ) === '1',
		] );
	}

	public function rest_security_save_settings( WP_REST_Request $request ): WP_REST_Response {
		$p = (array) $request->get_json_params();
		if ( isset( $p['max_login_attempts'] ) )        update_option( 'lunacco_max_login_attempts',        max( 1, (int) $p['max_login_attempts'] ) );
		if ( isset( $p['lockout_duration'] ) )           update_option( 'lunacco_lockout_duration',           max( 1, (int) $p['lockout_duration'] ) );
		if ( isset( $p['permanent_block_threshold'] ) )  update_option( 'lunacco_permanent_block_threshold',  max( 0, (int) $p['permanent_block_threshold'] ) );
		if ( isset( $p['ip_whitelist'] ) )               update_option( 'lunacco_ip_whitelist',               sanitize_textarea_field( (string) $p['ip_whitelist'] ) );
		if ( isset( $p['magic_login_enabled'] ) )        update_option( 'lunacco_magic_login_enabled',        empty( $p['magic_login_enabled'] ) ? '0' : '1' );
		if ( isset( $p['magic_login_expiry'] ) )         update_option( 'lunacco_magic_login_expiry',         max( 1, min( 1440, (int) $p['magic_login_expiry'] ) ) );
		if ( isset( $p['post_login_redirect_url'] ) )    update_option( 'lunacco_post_login_redirect_url',    esc_url_raw( (string) $p['post_login_redirect_url'] ) );
		if ( isset( $p['lockout_log_enabled'] ) )        update_option( 'lunacco_lockout_log_enabled',        empty( $p['lockout_log_enabled'] ) ? '0' : '1' );
		if ( isset( $p['block_notify_admin'] ) )         update_option( 'lunacco_block_notify_admin',         empty( $p['block_notify_admin'] ) ? '0' : '1' );
		return rest_ensure_response( [ 'success' => true ] );
	}

	public function rest_security_my_ip( WP_REST_Request $request ): WP_REST_Response {
		$ip = '';
		foreach ( [ 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR' ] as $key ) {
			if ( ! empty( $_SERVER[ $key ] ) ) {
				$candidate = trim( explode( ',', $_SERVER[ $key ] )[0] );
				if ( filter_var( $candidate, FILTER_VALIDATE_IP ) ) {
					$ip = $candidate;
					break;
				}
			}
		}
		$security = lunacco_core()->auth_security();
		return rest_ensure_response( [
			'ip'          => $ip,
			'whitelisted' => $ip ? $security->is_whitelisted( $ip ) : false,
		] );
	}

	public function rest_security_blocks_list(): WP_REST_Response {
		$security = lunacco_core()->auth_security();
		$blocks   = [];
		foreach ( $security->get_permanent_blocks() as $ip => $data ) {
			$blocks[] = array_merge( [ 'ip' => $ip, 'type' => 'permanent' ], $data );
		}
		return rest_ensure_response( [ 'blocks' => $blocks ] );
	}

	public function rest_security_block_add( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$p      = (array) $request->get_json_params();
		$ip     = sanitize_text_field( (string) ( $p['ip'] ?? '' ) );
		$reason = sanitize_text_field( (string) ( $p['reason'] ?? 'manual' ) );
		if ( ! filter_var( $ip, FILTER_VALIDATE_IP ) ) {
			return new WP_Error( 'invalid_ip', 'Invalid IP address.', [ 'status' => 400 ] );
		}
		lunacco_core()->auth_security()->add_permanent_block( $ip, $reason ?: 'manual', (string) get_current_user_id() );
		return rest_ensure_response( [ 'success' => true ] );
	}

	public function rest_security_block_remove( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$ip = sanitize_text_field( urldecode( (string) ( $request['ip'] ?? '' ) ) );
		if ( ! filter_var( $ip, FILTER_VALIDATE_IP ) ) {
			return new WP_Error( 'invalid_ip', 'Invalid IP address.', [ 'status' => 400 ] );
		}
		lunacco_core()->auth_security()->remove_permanent_block( $ip, (string) get_current_user_id() );
		return rest_ensure_response( [ 'success' => true ] );
	}

	public function rest_security_log_get(): WP_REST_Response {
		return rest_ensure_response( [ 'log' => lunacco_core()->auth_security()->get_log() ] );
	}

	public function rest_security_log_clear(): WP_REST_Response {
		lunacco_core()->auth_security()->clear_log();
		return rest_ensure_response( [ 'success' => true ] );
	}

	public function rest_security_generate_magic_link( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		if ( get_option( 'lunacco_magic_login_enabled', '0' ) !== '1' ) {
			return new WP_Error( 'magic_disabled', 'Magic login is not enabled.', [ 'status' => 400 ] );
		}
		$p     = (array) $request->get_json_params();
		$email = sanitize_email( (string) ( $p['email'] ?? '' ) );
		$user  = get_user_by( 'email', $email );
		if ( ! $user ) {
			return new WP_Error( 'user_not_found', 'No user found with that email address.', [ 'status' => 404 ] );
		}
		$security = lunacco_core()->auth_security();
		$token    = $security->generate_magic_token( $user->ID, get_current_user_id() );
		$url      = $security->build_magic_login_url( $user->ID, $token );
		$expiry   = (int) get_option( 'lunacco_magic_login_expiry', 15 );
		return rest_ensure_response( [
			'success'        => true,
			'url'            => $url,
			'expiry_minutes' => $expiry,
			'display_name'   => $user->display_name,
		] );
	}

	public function rest_definition_style_guide() {
		// Enriched, tier-aware blueprint (same keys as the raw guide, plus layer + tier
		// so the worksheet can show light MVP fields vs advanced options).
		return rest_ensure_response( $this->definitions->get_slot_blueprint() );
	}

	public function rest_definition_blueprints() {
		return rest_ensure_response( [
			'blueprints'  => $this->definitions->get_astrohd_blueprints(),
			'style_guide' => $this->definitions->get_slot_blueprint(),
		] );
	}

	public function rest_definition_module_contracts() {
		return rest_ensure_response( $this->definitions->get_module_contracts() );
	}

	public function rest_definition_sets_list( WP_REST_Request $request ) {
		return rest_ensure_response( $this->definitions->list_sets( $request->get_params() ) );
	}

	public function rest_definition_sets_save( WP_REST_Request $request ) {
		$result = $this->definitions->create_or_update_set( (array) $request->get_json_params() );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_set_get( WP_REST_Request $request ) {
		$set = $this->definitions->get_set( (int) $request['id'] );
		return $set ? rest_ensure_response( $set ) : new WP_Error( 'not_found', 'Definition set not found.', [ 'status' => 404 ] );
	}

	public function rest_definition_set_delete( WP_REST_Request $request ) {
		return rest_ensure_response( [ 'success' => $this->definitions->delete_set( (int) $request['id'] ) ] );
	}

	public function rest_definition_set_export( WP_REST_Request $request ) {
		$module_ids = [];
		$module_param = (string) ( $request->get_param( 'module_id' ) ?? '' );
		if ( '' !== $module_param ) {
			$module_ids = array_filter( array_map( 'trim', explode( ',', $module_param ) ) );
		}
		$result = $this->definitions->export_set( (int) $request['id'], [
			'module_ids'    => $module_ids,
			'section'       => sanitize_key( (string) ( $request->get_param( 'section' ) ?? '' ) ),
			'overlay_key'   => sanitize_key( (string) ( $request->get_param( 'overlay_key' ) ?? '' ) ),
			'tone_key'      => sanitize_key( (string) ( $request->get_param( 'tone_key' ) ?? '' ) ),
			'status'        => sanitize_key( (string) ( $request->get_param( 'status' ) ?? '' ) ),
			'chart_context' => sanitize_key( (string) ( $request->get_param( 'chart_context' ) ?? '' ) ),
		] );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_template_fragments() {
		return rest_ensure_response( $this->definitions->get_template_fragments() );
	}

	public function rest_definition_markdown_import( WP_REST_Request $request ) {
		$result = $this->definitions->import_markdown( (array) $request->get_json_params() );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_set_export_markdown( WP_REST_Request $request ) {
		$layers = array_filter( array_map( 'trim', explode( ',', (string) ( $request->get_param( 'layers' ) ?? '' ) ) ) );
		$markdown = $this->definitions->export_set_markdown( (int) $request['id'], [
			'module_id'   => sanitize_key( (string) ( $request->get_param( 'module_id' ) ?? '' ) ),
			'overlay_key' => sanitize_key( (string) ( $request->get_param( 'overlay_key' ) ?? '' ) ),
			'layers'      => $layers,
		] );
		return rest_ensure_response( [ 'markdown' => $markdown ] );
	}

	public function rest_definition_bundle_validate( WP_REST_Request $request ) {
		$result = $this->definitions->validate_bundle( (array) $request->get_json_params() );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_bundle_import( WP_REST_Request $request ) {
		$result = $this->definitions->import_bundle( (array) $request->get_json_params() );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_import( WP_REST_Request $request ) {
		$result = $this->definitions->import_set( (array) $request->get_json_params() );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_entities_list( WP_REST_Request $request ) {
		return rest_ensure_response( $this->definitions->list_entities( $request->get_params() ) );
	}

	public function rest_definition_entities_save( WP_REST_Request $request ) {
		$result = $this->definitions->upsert_entity( (array) $request->get_json_params() );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_entity_delete( WP_REST_Request $request ) {
		return rest_ensure_response( [ 'success' => $this->definitions->delete_entity( (int) $request['id'] ) ] );
	}

	public function rest_definition_relationships_list( WP_REST_Request $request ) {
		return rest_ensure_response( $this->definitions->list_relationships( $request->get_params() ) );
	}

	public function rest_definition_relationships_save( WP_REST_Request $request ) {
		$result = $this->definitions->upsert_relationship( (array) $request->get_json_params() );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_relationship_delete( WP_REST_Request $request ) {
		return rest_ensure_response( [ 'success' => $this->definitions->delete_relationship( (int) $request['id'] ) ] );
	}

	public function rest_definition_entries_list( WP_REST_Request $request ) {
		return rest_ensure_response( $this->definitions->list_entries( $request->get_params() ) );
	}

	public function rest_definition_entries_save( WP_REST_Request $request ) {
		$result = $this->definitions->upsert_entry( (array) $request->get_json_params() );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_entry_delete( WP_REST_Request $request ) {
		return rest_ensure_response( [ 'success' => $this->definitions->delete_entry( (int) $request['id'] ) ] );
	}

	public function rest_definition_variants_list( WP_REST_Request $request ) {
		return rest_ensure_response( $this->definitions->list_entry_variants( $request->get_params() ) );
	}

	public function rest_definition_variants_save( WP_REST_Request $request ) {
		$result = $this->definitions->upsert_entry_variant( (array) $request->get_json_params() );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_variant_delete( WP_REST_Request $request ) {
		return rest_ensure_response( [ 'success' => $this->definitions->delete_entry_variant( (int) $request['id'] ) ] );
	}

	public function rest_definition_tags_list( WP_REST_Request $request ) {
		return rest_ensure_response( $this->definitions->list_tags( $request->get_params() ) );
	}

	public function rest_definition_tags_save( WP_REST_Request $request ) {
		$result = $this->definitions->upsert_tag( (array) $request->get_json_params() );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_tags_suggest( WP_REST_Request $request ) {
		$params = (array) $request->get_json_params();
		return rest_ensure_response( $this->definitions->suggest_tags_for_text( (string) ( $params['text'] ?? '' ) ) );
	}

	public function rest_definition_templates_list( WP_REST_Request $request ) {
		return rest_ensure_response( $this->definitions->list_templates( $request->get_params() ) );
	}

	public function rest_definition_templates_save( WP_REST_Request $request ) {
		$result = $this->definitions->upsert_template( (array) $request->get_json_params() );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_template_delete( WP_REST_Request $request ) {
		return rest_ensure_response( [ 'success' => $this->definitions->delete_template( (int) $request['id'] ) ] );
	}

	public function rest_definition_chart_presets_list( WP_REST_Request $request ) {
		return rest_ensure_response( $this->definitions->list_chart_presets( $request->get_params() ) );
	}

	public function rest_definition_chart_presets_save( WP_REST_Request $request ) {
		$result = $this->definitions->upsert_chart_preset( (array) $request->get_json_params() );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_chart_preset_delete( WP_REST_Request $request ) {
		return rest_ensure_response( [ 'success' => $this->definitions->delete_chart_preset( (int) $request['id'] ) ] );
	}

	/**
	 * Unified chart list: built-in charts (registered by modules) + Chart-Maker
	 * presets, each normalized to { source, id, module_id, key, label, group,
	 * enabled, admin_only, is_premium, credit_cost }.
	 */
	public function rest_charts_list( WP_REST_Request $request ) {
		$builtins = [];
		foreach ( lunacco_get_registered_chart_types() as $type ) {
			$setting    = lunacco_get_chart_setting( $type['module_id'], $type['key'] );
			$row        = array_merge( [
				'source'    => 'builtin',
				'id'        => lunacco_chart_setting_id( $type['module_id'], $type['key'] ),
				'module_id' => $type['module_id'],
				'key'       => $type['key'],
				'label'     => $type['label'],
				'group'     => $type['module_id'] . ( $type['category'] ? ' · ' . $type['category'] : '' ),
			], $setting );
			// Resolved sidebar layers (catalog defaults merged with overrides) so the
			// admin can render and edit the per-chart Layers panel. Set after the merge so
			// it wins over the raw override map carried in $setting['layers'].
			$row['layers'] = array_values( lunacco_get_chart_layers( $type['module_id'], $type['key'] ) );
			// Resolved per-card-type template/slot config (catalog defaults merged with
			// overrides) so the admin can bind a template to each clickable card type.
			$row['card_types'] = array_values( lunacco_get_chart_card_types( $type['module_id'], $type['key'] ) );
			$builtins[]    = $row;
		}

		$presets = [];
		foreach ( $this->definitions->list_chart_presets( [] ) as $preset ) {
			$config = is_array( $preset['config'] ?? null ) ? $preset['config'] : ( is_array( $preset['config_json'] ?? null ) ? $preset['config_json'] : [] );
			$flags  = lunacco_chart_preset_flags( $config );
			$presets[] = array_merge( [
				'source'     => 'preset',
				'id'         => (int) $preset['id'],
				'module_id'  => (string) ( $preset['module_id'] ?? '' ),
				'key'        => (string) ( $preset['preset_key'] ?? '' ),
				'label'      => (string) ( $preset['title'] ?? $preset['preset_key'] ?? '' ),
				'set_id'     => (int) ( $preset['set_id'] ?? 0 ),
				'group'      => (string) ( $preset['module_id'] ?? '' ) . ' · Chart Maker',
			], $flags );
		}

		// Templates available to bind as a chart's sidebar reading (from the default set).
		$default_set = null;
		foreach ( $this->definitions->list_sets() as $set ) {
			if ( 1 === (int) ( $set['is_default'] ?? 0 ) ) { $default_set = $set; break; }
			if ( null === $default_set ) { $default_set = $set; }
		}
		$templates = [];
		if ( $default_set ) {
			foreach ( $this->definitions->list_templates( [ 'set_id' => (int) $default_set['id'] ] ) as $tpl ) {
				$templates[] = [
					'key'            => (string) $tpl['template_key'],
					'title'          => (string) ( $tpl['title'] ?? $tpl['template_key'] ),
					'output_context' => (string) ( $tpl['output_context'] ?? '' ),
					// Ordered slot keys this template renders (from its rules), so the
					// admin/sidebar can derive a card type's slot order from its template.
					'slots'          => array_values( array_filter( array_map(
						static fn( $r ) => sanitize_key( (string) ( $r['slot_key'] ?? '' ) ),
						(array) ( $tpl['rules'] ?? [] )
					) ) ),
				];
			}
		}

		return rest_ensure_response( [ 'builtins' => $builtins, 'presets' => $presets, 'templates' => $templates ] );
	}

	/** Re-seed only the chart templates + presets for a set (definitions untouched). */
	public function rest_definition_refresh_templates( WP_REST_Request $request ) {
		$result = $this->definitions->refresh_chart_templates( (int) $request['id'] );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	/** Save built-in chart settings. Body: { settings: { "module::key": {...} } }. */
	public function rest_charts_save_settings( WP_REST_Request $request ) {
		$params = (array) $request->get_json_params();
		$rows   = is_array( $params['settings'] ?? null ) ? $params['settings'] : [];
		$ok     = lunacco_update_chart_display_settings( $rows );
		return rest_ensure_response( [ 'success' => $ok ] );
	}

	/** Save governance flags for one Chart-Maker preset (merged into config_json). */
	public function rest_charts_save_preset_flags( WP_REST_Request $request ) {
		$params = (array) $request->get_json_params();
		$id     = (int) ( $params['id'] ?? 0 );
		$flags  = is_array( $params['flags'] ?? null ) ? $params['flags'] : [];
		$result = $this->definitions->update_chart_preset_flags( $id, $flags );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_resolve( WP_REST_Request $request ) {
		return rest_ensure_response( $this->definitions->resolve( (array) $request->get_json_params() ) );
	}

	public function rest_definition_resolve_slot( WP_REST_Request $request ) {
		return rest_ensure_response( $this->definitions->resolve_slot( (array) $request->get_json_params() ) );
	}

	public function rest_definition_resolve_slots( WP_REST_Request $request ) {
		$params   = (array) $request->get_json_params();
		$requests = is_array( $params['requests'] ?? null ) ? $params['requests'] : [];
		$shared   = is_array( $params['shared'] ?? null ) ? $params['shared'] : array_diff_key( $params, [ 'requests' => true ] );
		return rest_ensure_response( [ 'results' => $this->definitions->resolve_slots( $requests, $shared ) ] );
	}

	public function rest_definition_search( WP_REST_Request $request ) {
		return rest_ensure_response( $this->definitions->search_definitions( [
			'q'           => (string) $request->get_param( 'q' ),
			'set_id'      => (int) $request->get_param( 'set_id' ),
			'module_id'   => (string) $request->get_param( 'module_id' ),
			'entity_type' => (string) $request->get_param( 'entity_type' ),
			'limit'       => (int) ( $request->get_param( 'limit' ) ?: 30 ),
		] ) );
	}

	public function rest_definition_synthesis_theme_scores( WP_REST_Request $request ) {
		return rest_ensure_response( $this->definitions->synthesize_theme_scores( (array) $request->get_json_params() ) );
	}

	public function rest_definition_migrate_astrohd( WP_REST_Request $request ) {
		$result = $this->definitions->migrate_legacy_astrohd_set( (int) $request['legacy_set_id'] );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_project_astrohd( WP_REST_Request $request ) {
		return rest_ensure_response( $this->definitions->project_astrohd_set( (int) $request['set_id'] ) );
	}

	public function rest_definition_module_active_set( WP_REST_Request $request ) {
		$module_id  = sanitize_key( (string) $request->get_param( 'module_id' ) );
		$system_key = sanitize_key( (string) ( $request->get_param( 'system_key' ) ?? '' ) );
		if ( '' === $module_id ) {
			return new WP_Error( 'missing_module_id', 'module_id is required.', [ 'status' => 400 ] );
		}

		$set = $this->definitions->get_active_set_for_module( $module_id, $system_key );
		return $set ? rest_ensure_response( $set ) : new WP_Error( 'not_found', 'No active set found for that module.', [ 'status' => 404 ] );
	}

	public function rest_definition_reset( WP_REST_Request $request ) {
		return rest_ensure_response( $this->definitions->reset_all_definition_data( (array) $request->get_json_params() ) );
	}

	public function rest_definition_seed_astrohd( WP_REST_Request $request ) {
		$result = $this->definitions->seed_fresh_astrohd_set( (array) $request->get_json_params() );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_definition_prune( WP_REST_Request $request ) {
		$body    = (array) $request->get_json_params();
		$set_id  = (int) ( $body['set_id'] ?? 0 );
		$section = sanitize_key( (string) ( $body['section_type'] ?? '' ) );
		return rest_ensure_response( $this->definitions->prune_off_template_entries( $set_id, $section ) );
	}

	public function rest_definition_cleanup_astrohd( WP_REST_Request $request ) {
		$params = (array) $request->get_json_params();
		$result = $this->definitions->cleanup_astrohd_set( (int) ( $params['set_id'] ?? 0 ) );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public function rest_locations_countries( WP_REST_Request $request ) {
		$countries = lunacco_core()->locations()->get_active_countries();
		return rest_ensure_response( $countries );
	}

	public function rest_locations_cities( WP_REST_Request $request ) {
		$country = sanitize_text_field( $request->get_param( 'country' ) );
		$q       = sanitize_text_field( $request->get_param( 'q' ) );

		if ( empty( $country ) || strlen( $q ) < 2 ) {
			return rest_ensure_response( [] );
		}

		$cities = lunacco_core()->locations()->search_cities( $country, $q );
		return rest_ensure_response( $cities );
	}
}
