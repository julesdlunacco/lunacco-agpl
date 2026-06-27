<?php
/**
 * Core bootstrap — singleton that wires up all sub-systems and WordPress hooks.
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_Core_Bootstrap {

	private static ?LunaCco_Core_Bootstrap $instance = null;

	private LunaCco_Module_Registry    $module_registry;
	private LunaCco_Definition_Engine  $definition_engine;
	private LunaCco_Credit_System      $credit_system;
	private LunaCco_Promos             $promos;
	private LunaCco_Auth_Security      $auth_security;
	private LunaCco_Auth_Handler       $auth_handler;
	private LunaCco_User_Profile       $user_profile;
	private LunaCco_AI_Config          $ai_config;
	private LunaCco_FluentCart         $fluentcart;
	private LunaCco_Admin_Pages        $admin_pages;
	private LunaCco_REST_API           $rest_api;
	private LunaCco_Theme_Manager      $theme_manager;
	private LunaCco_Shortcode_Renderer $shortcode_renderer;
	private LunaCco_Locations          $locations;

	private function __construct() {
		$this->module_registry    = new LunaCco_Module_Registry();
		$this->definition_engine  = new LunaCco_Definition_Engine();
		$this->credit_system      = new LunaCco_Credit_System();
		$this->promos             = new LunaCco_Promos();
		$this->auth_security      = new LunaCco_Auth_Security();
		$this->auth_handler       = new LunaCco_Auth_Handler( $this->auth_security, $this->credit_system );
		$this->user_profile       = new LunaCco_User_Profile();
		$this->ai_config          = new LunaCco_AI_Config();
		$this->fluentcart         = new LunaCco_FluentCart( $this->credit_system );
		$this->admin_pages        = new LunaCco_Admin_Pages();
		$this->theme_manager      = new LunaCco_Theme_Manager();
		$this->locations          = new LunaCco_Locations();
		$this->rest_api           = new LunaCco_REST_API( $this->auth_handler, $this->user_profile, $this->ai_config, $this->theme_manager, $this->definition_engine );
		$this->shortcode_renderer = new LunaCco_Shortcode_Renderer( $this->module_registry );

		$this->register_hooks();
	}

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	// ------------------------------------------------------------------
	// Activation
	// ------------------------------------------------------------------

	public function activate(): void {
		$this->definition_engine->ensure_schema();
		$this->credit_system->ensure_table();
		$this->credit_system->ensure_entitlements_table();
		$this->promos->ensure_table();
		$this->user_profile->ensure_people_table();
		$this->locations->ensure_table();
	}

	// ------------------------------------------------------------------
	// Hook registration
	// ------------------------------------------------------------------

	private function register_hooks(): void {
		// Activation hook.
		register_activation_hook( LUNACCO_CORE_FILE, [ $this, 'activate' ] );

		// Ensure DB tables on plugins_loaded.
		add_action( 'plugins_loaded', [ $this->user_profile, 'ensure_people_table' ], 10 );

		// Module registration (after all plugins loaded).
		add_action( 'plugins_loaded', [ $this, 'fire_module_registration' ], 20 );

		// REST API.
		add_action( 'rest_api_init', [ $this->rest_api, 'register_routes' ] );

		// WordPress auth hooks.
		add_action( 'user_register', [ $this->auth_handler, 'on_user_register' ] );

		// Admin menu + settings.
		add_action( 'admin_menu', [ $this->admin_pages, 'add_admin_menu' ] );
		add_action( 'admin_init', [ $this->admin_pages, 'register_settings' ] );
		add_action( 'admin_enqueue_scripts', [ $this->admin_pages, 'enqueue_admin_assets' ] );

		// Shortcode.
		add_action( 'wp_enqueue_scripts', [ $this->shortcode_renderer, 'enqueue_scripts' ] );
		add_shortcode( 'lunacco_app', [ $this->shortcode_renderer, 'render' ] );
		add_shortcode( 'luna_tarot',  [ $this->shortcode_renderer, 'render' ] ); // Backward compat alias.

		// Template override (full-page SPA support).
		add_filter( 'template_include', [ $this->shortcode_renderer, 'handle_template_include' ] );

		// Admin AJAX — AI config.
		add_action( 'wp_ajax_lt_fetch_models',        [ $this->ai_config, 'ajax_fetch_models' ] );
		add_action( 'wp_ajax_lt_save_ai_model',       [ $this->ai_config, 'ajax_save_ai_model' ] );
		add_action( 'wp_ajax_lt_test_api_connection', [ $this->ai_config, 'ajax_test_api_connection' ] );

		// Admin AJAX — locations import.
		add_action( 'wp_ajax_lunacco_locations_start_decompress', [ $this->locations, 'ajax_start_decompress' ] );
		add_action( 'wp_ajax_lunacco_locations_import_chunk',      [ $this->locations, 'ajax_import_chunk' ] );
		add_action( 'wp_ajax_lunacco_locations_clear',             [ $this->locations, 'ajax_clear' ] );

		// Admin POST — API key save.
		add_action( 'admin_post_lt_save_api_key', [ $this->ai_config, 'admin_post_save_api_key' ] );

		// Admin POST — manual credit adjustment + FC order sync (handled by admin_pages).
		add_action( 'admin_post_lt_manual_credit',             [ $this->admin_pages, 'admin_post_manual_credit' ] );
		add_action( 'admin_post_lt_sync_fc_orders',            [ $this->admin_pages, 'admin_post_sync_fc_orders' ] );
		add_action( 'admin_post_lt_rebuild_credit_balance',      [ $this->admin_pages, 'admin_post_rebuild_credit_balance' ] );
		add_action( 'admin_post_lt_rebuild_all_credit_balances', [ $this->admin_pages, 'admin_post_rebuild_all_credit_balances' ] );
		add_action( 'admin_post_lt_import_data',               [ $this->admin_pages, 'admin_post_import_data' ] );
		add_action( 'admin_post_lt_export_data',               [ $this->admin_pages, 'admin_post_export_data' ] );

		// Security & access actions are now handled via REST (lunacco/v1/admin/security/*)
		// from the Security & Access SPA admin page — the old admin-post handlers were removed.

		// Magic login — handle ?lunacco_magic=1 on the frontend.
		add_action( 'init', [ $this->auth_security, 'handle_magic_login_request' ], 1 );

		// Core-owned decanate atoms (36 = 3 per sign) for the definition engine. Astrology
		// content, so it lives in core; numerology references it by compound number.
		add_filter( 'lunacco_definition_scaffold', [ $this, 'add_core_decanate_scaffold' ] );
	}

	/**
	 * Provide the 36 decanate atoms (Aries–Pisces × 3) as scaffold rows. Each is an
	 * astrology atom (entity_type astro_decanate) authored once; numerology routes a
	 * compound number to the right decanate via its own association map.
	 *
	 * @param array<string,array> $scaffold
	 * @return array<string,array>
	 */
	public function add_core_decanate_scaffold( array $scaffold ): array {
		if ( ! empty( $scaffold['astro_decanate'] ) ) {
			return $scaffold;
		}
		// decanate_id => [ name, chaldean ruler, sign co-ruler ].
		$decans = [
			'aries_1' => [ 'Activity', 'Mars', '' ],          'aries_2' => [ 'Elevation', 'Sun', 'Leo' ],         'aries_3' => [ 'Propaganda', 'Venus', 'Sagittarius' ],
			'taurus_1' => [ 'Determination', 'Mercury', '' ], 'taurus_2' => [ 'Struggle', 'Moon', 'Virgo' ],      'taurus_3' => [ 'Mastership', 'Saturn', 'Capricorn' ],
			'gemini_1' => [ 'Intuition', 'Jupiter', 'Libra' ],'gemini_2' => [ 'Fidelity', 'Mars', 'Libra' ],      'gemini_3' => [ 'Reason', 'Sun', 'Aquarius' ],
			'cancer_1' => [ 'Moods', 'Venus', '' ],           'cancer_2' => [ 'Revelation', 'Mercury', 'Scorpio' ],'cancer_3' => [ 'Research', 'Moon', 'Pisces' ],
			'leo_1' => [ 'Rulership', 'Saturn', '' ],         'leo_2' => [ 'Reformation', 'Jupiter', 'Sagittarius' ],'leo_3' => [ 'Ambition', 'Mars', 'Aries' ],
			'virgo_1' => [ 'Achievement', 'Sun', '' ],        'virgo_2' => [ 'Experience', 'Venus', 'Capricorn' ],'virgo_3' => [ 'Renunciation', 'Mercury', 'Taurus' ],
			'libra_1' => [ 'Policy', 'Moon', '' ],            'libra_2' => [ 'Independence', 'Saturn', 'Aquarius' ],'libra_3' => [ 'Expiation', 'Jupiter', 'Gemini' ],
			'scorpio_1' => [ 'Resourcefulness', 'Mars', '' ], 'scorpio_2' => [ 'Responsibility', 'Sun', 'Pisces' ],'scorpio_3' => [ 'Attainment', 'Venus', 'Cancer' ],
			'sagittarius_1' => [ 'Devotion', 'Mercury', '' ], 'sagittarius_2' => [ 'Exploration', 'Moon', 'Aries' ],'sagittarius_3' => [ 'Illumination', 'Saturn', 'Leo' ],
			'capricorn_1' => [ 'Organization', 'Jupiter', '' ],'capricorn_2' => [ 'Martyrdom', 'Mars', 'Taurus' ],'capricorn_3' => [ 'Idealism', 'Sun', 'Virgo' ],
			'aquarius_1' => [ 'Originality', 'Venus', '' ],   'aquarius_2' => [ 'Inspiration', 'Mercury', 'Gemini' ],'aquarius_3' => [ 'Repression', '', 'Libra' ],
			'pisces_1' => [ 'Verity', 'Saturn', '' ],         'pisces_2' => [ 'Self Sacrifice', 'Jupiter', 'Cancer' ],'pisces_3' => [ 'Vicissitudes', 'Mars', 'Scorpio' ],
		];
		$rows = [];
		foreach ( $decans as $id => $info ) {
			[ $name, $ruler, $co ] = $info;
			[ $sign, $n ]          = explode( '_', $id );
			$rulers = array_values( array_filter( [ $ruler, $co ], static fn( $x ) => '' !== $x && 'None' !== $x ) );
			$suffix = $rulers ? ' (' . implode( ' · ', $rulers ) . ')' : '';
			$rows[] = [
				'item_key' => $id,
				'title'    => ucfirst( $sign ) . ' Decan ' . $n . ' · ' . $name . $suffix,
			];
		}
		$scaffold['astro_decanate'] = $rows;
		return $scaffold;
	}

	// ------------------------------------------------------------------
	// Module registration
	// ------------------------------------------------------------------

	public function fire_module_registration(): void {
		do_action( 'lunacco_register_modules', $this->module_registry );
		do_action( 'lunacco_register_definition_modules', $this->definition_engine );
		do_action( 'lunacco_core_ready', $this );
	}

	// ------------------------------------------------------------------
	// Sub-system accessors (used by modules and internal classes)
	// ------------------------------------------------------------------

	public function modules(): LunaCco_Module_Registry     { return $this->module_registry; }
	public function definitions(): LunaCco_Definition_Engine { return $this->definition_engine; }
	public function promos(): LunaCco_Promos               { return $this->promos; }
	public function credits(): LunaCco_Credit_System       { return $this->credit_system; }
	public function auth_security(): LunaCco_Auth_Security { return $this->auth_security; }
	public function auth(): LunaCco_Auth_Handler           { return $this->auth_handler; }
	public function profile(): LunaCco_User_Profile        { return $this->user_profile; }
	public function ai(): LunaCco_AI_Config                { return $this->ai_config; }
	public function fluentcart(): LunaCco_FluentCart       { return $this->fluentcart; }
	public function admin(): LunaCco_Admin_Pages           { return $this->admin_pages; }
	public function rest(): LunaCco_REST_API               { return $this->rest_api; }
	public function themes(): LunaCco_Theme_Manager        { return $this->theme_manager; }
	public function shortcode(): LunaCco_Shortcode_Renderer { return $this->shortcode_renderer; }
	public function locations(): LunaCco_Locations          { return $this->locations; }
}
