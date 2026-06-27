<?php
/**
 * Plugin Name:  Luna AstroHD Module
 * Description:  Astrology + Human Design module for the LunaCco platform. Bodygraph charts, astrology insights, daily snapshots, dashboard widgets. Built on Swiss Ephemeris (AGPL).
 * Version:      1.1.2
 * Author:       LunaCco
 * Requires Plugins: lunacco-core
 * License:      AGPL-3.0-or-later
 * License URI:  https://www.gnu.org/licenses/agpl-3.0.html
 *
 * Astronomical calculations powered by the Swiss Ephemeris
 * (c) Astrodienst AG, Zurich — https://www.astro.com/swisseph/
 * Used under AGPL-3.0. See LICENSE for terms.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LUNA_ASTROHD_VERSION', '1.1.3' );
define( 'LUNA_ASTROHD_FILE',    __FILE__ );
define( 'LUNA_ASTROHD_DIR',     plugin_dir_path( __FILE__ ) );
define( 'LUNA_ASTROHD_URL',     plugin_dir_url( __FILE__ ) );

// ------------------------------------------------------------------
// Includes (phases ship incrementally — each file is optional at load)
// ------------------------------------------------------------------
foreach ( [
	'includes/class-db-schema.php',
	'includes/class-definition-manager.php',
	'includes/class-chart-visibility.php',
	'includes/class-credit-gate.php',
	'includes/class-chart-cache.php',
	'includes/class-rest-api.php',
	'includes/class-admin-pages.php',
	'includes/class-db-contributor.php',
	'includes/class-footer-notice.php',
] as $rel ) {
	$path = LUNA_ASTROHD_DIR . $rel;
	if ( file_exists( $path ) ) {
		require_once $path;
	}
}

// ------------------------------------------------------------------
// Module registration with lunacco-core
// ------------------------------------------------------------------
function luna_astrohd_register_module( LunaCco_Module_Registry $registry ): void {
	$nav_items = [
		[ 'key' => 'astrohd-natal',       'label' => 'Bodygraph',   'icon' => 'CircleDot',  'auth_required' => false, 'order' => 20 ],
		[ 'key' => 'astrohd-shadow',      'label' => 'Shadow',      'icon' => 'Aperture',   'auth_required' => false, 'order' => 21 ],
		[ 'key' => 'astrohd-transit',     'label' => 'Transits',    'icon' => 'Orbit',      'auth_required' => false, 'order' => 22 ],
		[ 'key' => 'astrohd-connection',  'label' => 'Connections', 'icon' => 'Users',      'auth_required' => true,  'order' => 23 ],
		[ 'key' => 'astrohd-snapshot',    'label' => 'Snapshot',    'icon' => 'CalendarClock', 'auth_required' => false, 'order' => 24 ],
		[ 'key' => 'astrohd-chart-maker', 'label' => 'Chart Maker', 'icon' => 'SlidersHorizontal', 'auth_required' => true, 'order' => 25, 'admin_only' => true ],
		[ 'key' => 'astrohd-selection-presets', 'label' => 'Selection Presets', 'icon' => 'Star', 'auth_required' => true, 'order' => 26, 'admin_only' => true ],
		[ 'key' => 'astrohd-settings',    'label' => 'AstroHD Settings', 'icon' => 'Settings', 'auth_required' => true, 'order' => 27, 'admin_only' => true ],
	];

	$views = [
		'astrohd-natal',
		'astrohd-shadow',
		'astrohd-transit',
		'astrohd-connection',
		'astrohd-snapshot',
		'astrohd-chart-maker',
		'astrohd-selection-presets',
		'astrohd-settings',
	];

	$registry->register( 'luna-astrohd', [
		'name'              => 'Luna AstroHD',
		'version'           => LUNA_ASTROHD_VERSION,
		'views'             => $views,
		'nav_items'         => $nav_items,
		'rest_namespace'    => 'luna-astrohd/v1',
		'localize_callback' => 'luna_astrohd_localize_data',
	] );
}
add_action( 'lunacco_register_modules', 'luna_astrohd_register_module' );
add_action( 'lunacco_register_definition_modules', 'luna_astrohd_register_definition_module_contract' );
add_action( 'lunacco_enqueue_module_scripts', 'luna_astrohd_enqueue_module_script' );

function luna_astrohd_register_definition_module_contract( LunaCco_Definition_Engine $engine ): void {
	$engine->register_module_contract( 'luna-astrohd', [
		'label' => 'Luna AstroHD',
		'entity_types' => [
			'hd_gate',
			'hd_channel',
			'hd_center',
			'hd_type',
			'hd_authority',
			'hd_profile',
			'hd_line',
			'hd_incarnation_cross',
			'hd_incarnation_cross_family',
			'hd_incarnation_cross_variant',
			'hd_variable',
			'hd_variable_direction',
			'hd_variable_color',
			'hd_variable_tone',
			'hd_circuitry',
			'hd_definition_type',
			'hd_consciousness',
			'hd_center_state',
			'hd_quarter',
			'hd_planet',
			'hd_angle_point',
			'hd_asteroid',
			'astro_planet',
			'astro_sign',
			'astro_house',
			'astro_aspect',
			'astro_angle_point',
			'astro_moon_phase',
			'astro_asteroid',
			'astro_element',
			'astro_modality',
			'astro_hemisphere_quadrant',
			'astro_dignity',
			'astro_planetary_condition',
			'astro_chart_context',
			'astro_chart_pattern',
			'astro_modifier',
			'astro_body_in_sign',
			'astro_body_in_house',
			'astro_body_in_sign_house',
			'astro_aspect_combo',
			'astro_moon_phase_combo',
			'astro_pattern',
			'mythic_deity',
			'mythic_archetype',
			'angel_shem',
			'angel_degree_range',
			'angel_overlay',
		],
		'relationship_types' => [
			'ruled_by',
			'associated_with',
			'belongs_to_center',
			'belongs_to_circuitry',
			'belongs_to_quarter',
			'belongs_to_variable',
			'has_profile_line',
			'has_personality_line',
			'has_design_line',
			'has_variant',
			'leading_gate',
			'sequence_gate',
			'has_direction',
			'has_color',
			'has_tone',
			'forms_channel',
			'pairs_with',
			'dignified_in',
			'exalted_in',
			'detriment_in',
			'fall_in',
		],
		'output_contexts' => [
			'sidebar_short',
			'chart_snippet',
			'report_snippet',
			'pdf_long',
			'gift_short',
			'gift_long',
			'shadow_short',
			'shadow_long',
			'coaching_asset',
			'resource_link',
			'affirmation',
			'eft_script',
			'journal_prompt',
			'ai_context',
		],
		'seed_scaffolds' => [
			'legacy_astrohd_definition_sets',
			'legacy_astrohd_definition_sections',
		],
		'resolver_inputs' => [
			'section_type',
			'item_key',
			'chart_type',
			'active_entities',
			'chart_context',
			'overlay_key',
			'overlay_keys',
			'tone_key',
			'audience_key',
			'statuses',
			'modifiers',
			'variants',
			'output_context',
			'reader_mode',
			'chart_preset_id',
		],
	] );
}

// ------------------------------------------------------------------
// SPA bundle enqueue (matches luna-numerology pattern)
// ------------------------------------------------------------------
function luna_astrohd_enqueue_module_script(): void {
	$dist_dir  = LUNA_ASTROHD_DIR . 'spa/dist/assets/';
	$js_paths  = glob( $dist_dir . 'luna-astrohd-module*.js' );
	$css_paths = glob( $dist_dir . '*.css' );

	if ( empty( $js_paths ) ) {
		return;
	}

	$js_path = $js_paths[0];
	$scheme  = strtolower( (string) wp_parse_url( home_url( '/' ), PHP_URL_SCHEME ) );
	$scheme  = in_array( $scheme, [ 'http', 'https' ], true ) ? $scheme : ( is_ssl() ? 'https' : 'http' );
	$js_url  = set_url_scheme( LUNA_ASTROHD_URL . 'spa/dist/assets/' . basename( $js_path ), $scheme );

	wp_enqueue_script(
		'luna-astrohd-module',
		$js_url,
		[ 'lunacco-core-app' ],
		(string) filemtime( $js_path ),
		true
	);

	if ( ! empty( $css_paths ) ) {
		$css_path = $css_paths[0];
		$css_url  = set_url_scheme( LUNA_ASTROHD_URL . 'spa/dist/assets/' . basename( $css_path ), $scheme );
		wp_enqueue_style(
			'luna-astrohd-module',
			$css_url,
			[ 'lunacco-core-app' ],
			(string) filemtime( $css_path )
		);
	}
}

// ------------------------------------------------------------------
// Localized data exposed to the SPA as LunaCcoData.modules['luna-astrohd']
// ------------------------------------------------------------------
function luna_astrohd_localize_data(): array {
	$asset_base = rtrim( LUNA_ASTROHD_URL, '/' ) . '/assets';
	$is_admin   = current_user_can( 'manage_options' );

	$display_settings = luna_astrohd_get_chart_display_settings();
	if ( ! $is_admin ) {
		// Non-admins keep the full row for charts they can see (the layers/card_types
		// drive definition rendering), but admin-only charts collapse to a flag-only
		// stub so the SPA can HIDE them (the chart-type list is otherwise hardcoded) —
		// without leaking their definition internals. The credit gate enforces this
		// server-side regardless.
		$filtered_display = [];
		foreach ( $display_settings as $key => $s ) {
			if ( empty( $s['admin_only'] ) ) {
				$filtered_display[ $key ] = $s;
			} else {
				$filtered_display[ $key ] = [
					'enabled'     => ! empty( $s['enabled'] ),
					'admin_only'  => true,
					'is_premium'  => ! empty( $s['is_premium'] ),
					'credit_cost' => (int) ( $s['credit_cost'] ?? 0 ),
				];
			}
		}
		$display_settings = $filtered_display;
	}

	// Fetch presets — filter by admin_only if not admin.
	global $wpdb;
	$table = $wpdb->prefix . 'lt_astrohd_chart_presets';
	$where = "is_enabled = 1";
	if ( ! $is_admin ) {
		$where .= " AND admin_only = 0";
	}
	$presets = $wpdb->get_results( "SELECT * FROM {$table} WHERE {$where} ORDER BY sort_order ASC", ARRAY_A ) ?: [];
	$core_chart_presets = [];
	if ( function_exists( 'lunacco_core' ) && class_exists( 'LunaCco_Definition_Engine' ) ) {
		$active_core_set = lunacco_core()->definitions()->get_active_set_for_module( 'luna-astrohd' );
		if ( ! empty( $active_core_set['id'] ) ) {
			$core_chart_presets = lunacco_core()->definitions()->list_chart_presets( [
				'set_id'     => (int) $active_core_set['id'],
				'module_id'  => 'luna-astrohd',
				'is_enabled' => 1,
			] );
			// Hide admin-only presets (and their config/definitions) from non-admins.
			if ( ! $is_admin ) {
				$core_chart_presets = array_values( array_filter(
					$core_chart_presets,
					fn( $p ) => empty( $p['config']['admin_only'] )
				) );
			}
		}
	}

	return [
		'adminDefinitionsUrl'   => esc_url_raw( admin_url( 'admin.php?page=lunacco-definitions' ) ),
		'adminChartSettingsUrl' => esc_url_raw( admin_url( 'admin.php?page=luna-astrohd-chart-settings' ) ),
		'assets'                => [
			'wasm'          => esc_url_raw( $asset_base . '/swisseph.wasm' ),
			'ephePath'      => esc_url_raw( $asset_base . '/ephe/' ),
			'bodygraphSvg'  => esc_url_raw( $asset_base . '/bodygraph.svg' ),
			'zodiacPath'    => esc_url_raw( $asset_base . '/zodiac/' ),
		],
		'chartDisplaySettings'  => $display_settings ?: new stdClass(),
		'customerServiceEmail'  => luna_astrohd_get_customer_service_email(),
		'presets'               => $presets,
		'coreChartPresets'      => $core_chart_presets,
		'restNamespace'         => 'luna-astrohd/v1',
		'license'               => [
			'name' => 'AGPL-3.0',
			'credit' => 'Swiss Ephemeris © Astrodienst AG',
			'url'  => 'https://www.astro.com/swisseph/',
		],
	];
}

// ------------------------------------------------------------------
// User context enrichment
// ------------------------------------------------------------------
function luna_astrohd_user_context( array $context, int $user_id ): array {
    if ( ! $user_id ) return $context;

    global $wpdb;
    $table = $wpdb->prefix . 'lt_astrohd_charts';
    
    // Fetch the most recent profile chart for this user
    $row = $wpdb->get_row( $wpdb->prepare(
        "SELECT id, chart_type, input_data, chart_data FROM {$table} WHERE user_id=%d AND is_profile_chart=1 AND chart_type='natal' ORDER BY created_at DESC LIMIT 1",
        $user_id
    ), ARRAY_A );

    if ( $row ) {
        $context['astrohd_profile_chart'] = [
            'id'         => (int) $row['id'],
            'chart_type' => $row['chart_type'],
            'input'      => json_decode( $row['input_data'], true ),
            'data'       => json_decode( $row['chart_data'], true ),
        ];
    }

    // Fetch the most recent asteroid profile chart
    $ast_row = $wpdb->get_row( $wpdb->prepare(
        "SELECT id, chart_type, input_data, chart_data FROM {$table} WHERE user_id=%d AND is_profile_chart=1 AND chart_type='asteroids' ORDER BY created_at DESC LIMIT 1",
        $user_id
    ), ARRAY_A );

    if ( $ast_row ) {
        $context['astrohd_asteroids_profile_chart'] = [
            'id'         => (int) $ast_row['id'],
            'chart_type' => $ast_row['chart_type'],
            'input'      => json_decode( $ast_row['input_data'], true ),
            'data'       => json_decode( $ast_row['chart_data'], true ),
        ];
    }

    return $context;
}
add_filter( 'lunacco_user_context_data', 'luna_astrohd_user_context', 10, 2 );

// ------------------------------------------------------------------
// Activation — run DB schema install when class is available
// ------------------------------------------------------------------
register_activation_hook( __FILE__, function () {
	if ( class_exists( 'Luna_AstroHD_DB_Schema' ) ) {
		Luna_AstroHD_DB_Schema::install();
	}
} );
