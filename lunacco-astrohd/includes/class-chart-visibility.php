<?php
/**
 * Luna AstroHD — chart visibility + premium/credit gating settings.
 *
 * Per-chart-type flags stored in option lt_astrohd_chart_display_settings.
 * Chart types:
 *   natal, transit, connection,
 *   snapshot_quick, snapshot_standard, snapshot_deep, snapshot_moon.
 *
 * Defaults: all enabled, none premium.
 * Admins tweak via admin.php?page=luna-astrohd-chart-settings.
 * SPA reads via LunaCcoData.modules['luna-astrohd'].chartDisplaySettings.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const LUNA_ASTROHD_CHART_SETTINGS_OPTION = 'lt_astrohd_chart_display_settings';

function luna_astrohd_chart_types(): array {
	return [
		'natal'         => 'Natal Bodygraph',
		'shadow'        => 'Shadow Chart',
		'wheel'         => 'Astrology Wheel',
		'dual_wheel'    => 'Dual Astrology Map',
		'combined'      => 'Combined (HD + Astro)',
		'transit'       => 'Daily Transits',
		'transit_birth' => 'Transit + Birth Overlay',
		'connection'    => 'Connection Chart',
		'asteroids'     => 'Asteroid Chart',
	];
}

function luna_astrohd_default_chart_display_settings(): array {
	$out = [];
	foreach ( array_keys( luna_astrohd_chart_types() ) as $key ) {
		$out[ $key ] = [
			'enabled'          => true,
			'is_premium'       => false,
			'admin_only'       => false,
			'credit_cost'      => 0,
			'sidebar_template' => '',
		];
	}
	return $out;
}

/**
 * Register this module's built-in chart types into the core chart registry so
 * the unified core Charts admin governs them alongside every other module.
 */
add_filter( 'lunacco_chart_types', 'luna_astrohd_register_chart_types' );
function luna_astrohd_register_chart_types( array $types ): array {
	foreach ( luna_astrohd_chart_types() as $key => $label ) {
		$types[] = [ 'module_id' => 'luna-astrohd', 'key' => $key, 'label' => $label, 'category' => 'astrohd' ];
	}
	return $types;
}

/**
 * Per-chart display settings keyed by bare chart key (the shape the credit gate
 * expects). Core is the source of truth; falls back to the legacy local option
 * for back-compat / one-time migration when core has nothing stored yet.
 */
function luna_astrohd_get_chart_display_settings(): array {
	$default = luna_astrohd_default_chart_display_settings();

	if ( function_exists( 'lunacco_get_module_chart_settings' ) ) {
		$core    = lunacco_get_module_chart_settings( 'luna-astrohd' );
		$has_core = is_array( get_option( LUNACCO_CHART_SETTINGS_OPTION, null ) );
		if ( $has_core && ! empty( $core ) ) {
			foreach ( $default as $key => $def ) {
				if ( isset( $core[ $key ] ) ) {
					$default[ $key ] = array_merge( $def, $core[ $key ] );
				}
			}
			return luna_astrohd_attach_chart_layers( $default );
		}
	}

	// Legacy fallback (pre-core-governance installs).
	$stored = get_option( LUNA_ASTROHD_CHART_SETTINGS_OPTION, [] );
	if ( is_array( $stored ) ) {
		foreach ( $default as $key => $def ) {
			if ( isset( $stored[ $key ] ) && is_array( $stored[ $key ] ) ) {
				$default[ $key ] = array_merge( $def, $stored[ $key ] );
			}
		}
	}
	return luna_astrohd_attach_chart_layers( $default );
}

/**
 * Write settings. Persists to the core option (keyed module::key) when available,
 * and mirrors to the legacy local option for back-compat.
 */
function luna_astrohd_update_chart_display_settings( array $settings ): bool {
	$types = array_keys( luna_astrohd_chart_types() );
	$clean = [];
	$core  = [];
	foreach ( $types as $key ) {
		$row           = $settings[ $key ] ?? [];
		$clean[ $key ] = [
			'enabled'     => ! empty( $row['enabled'] ),
			'is_premium'  => ! empty( $row['is_premium'] ),
			'admin_only'  => ! empty( $row['admin_only'] ),
			'credit_cost' => max( 0, (int) ( $row['credit_cost'] ?? 0 ) ),
		];
		$core[ 'luna-astrohd::' . $key ] = $clean[ $key ];
	}
	if ( function_exists( 'lunacco_update_chart_display_settings' ) ) {
		lunacco_update_chart_display_settings( $core );
	}
	return update_option( LUNA_ASTROHD_CHART_SETTINGS_OPTION, $clean );
}

/**
 * Optional sidebar layers per chart family.
 *  - Astro charts: chart ruler, house rulers, aspects, stelliums, chart shape (all on).
 *  - HD charts: type / authority / profile / definition / channels (on); circuitry,
 *    variables (off until toggled).
 *  - Combined: the union.
 */
function luna_astrohd_chart_layer_definitions(): array {
	$astro = [
		[ 'key' => 'chart_ruler',  'label' => 'Chart Ruler',            'default_enabled' => true ],
		[ 'key' => 'house_rulers', 'label' => 'House Rulers',           'default_enabled' => true ],
		[ 'key' => 'aspects',      'label' => 'Aspects',                'default_enabled' => true, 'default_limit' => 3 ],
		[ 'key' => 'stelliums',    'label' => 'Stelliums',              'default_enabled' => true ],
		[ 'key' => 'chart_shape',  'label' => 'Chart Shape & Patterns', 'default_enabled' => true ],
	];
	$hd = [
		[ 'key' => 'type',       'label' => 'Type',       'default_enabled' => true ],
		[ 'key' => 'authority',  'label' => 'Authority',  'default_enabled' => true ],
		[ 'key' => 'profile',    'label' => 'Profile',    'default_enabled' => true ],
		[ 'key' => 'definition', 'label' => 'Definition', 'default_enabled' => true ],
		[ 'key' => 'channels',   'label' => 'Channels',   'default_enabled' => true ],
		[ 'key' => 'circuitry',  'label' => 'Circuitry',  'default_enabled' => false ],
		[ 'key' => 'variables',  'label' => 'Variables',  'default_enabled' => true ],
	];

	$map = [];
	foreach ( [ 'natal', 'shadow', 'connection' ] as $k ) {
		$map[ $k ] = $hd;
	}
	foreach ( [ 'wheel', 'dual_wheel', 'transit', 'transit_birth', 'asteroids' ] as $k ) {
		$map[ $k ] = $astro;
	}
	$map['combined'] = array_merge( $hd, $astro );
	return $map;
}

add_filter( 'lunacco_chart_layer_catalog', 'luna_astrohd_register_chart_layers' );
function luna_astrohd_register_chart_layers( array $catalog ): array {
	foreach ( luna_astrohd_chart_layer_definitions() as $key => $layers ) {
		$catalog[ 'luna-astrohd::' . $key ] = $layers;
	}
	return $catalog;
}

/** Attach resolved layers (catalog + overrides) to each chart's display settings row. */
function luna_astrohd_attach_chart_layers( array $settings ): array {
	if ( ! function_exists( 'lunacco_get_chart_layers' ) ) {
		return $settings;
	}
	foreach ( $settings as $key => $row ) {
		$settings[ $key ]['layers']     = lunacco_get_chart_layers( 'luna-astrohd', (string) $key );
		if ( function_exists( 'lunacco_get_chart_card_types' ) ) {
			$settings[ $key ]['card_types'] = lunacco_get_chart_card_types( 'luna-astrohd', (string) $key );
		}
	}
	return $settings;
}

/**
 * Clickable card types per chart family. Each is a resolver entity_type the user
 * can click in the chart; the admin binds a template (and optional slot list) to
 * each so every card type resolves its own definition rather than sharing one
 * global template. Aspects intentionally default to a relational template/slot
 * set distinct from placement cards.
 */
function luna_astrohd_chart_card_type_definitions(): array {
	$hd = [
		[ 'key' => 'hd_gate',             'label' => 'Gates',            'default_enabled' => true,  'default_slots' => [ 'short_def', 'long_def' ] ],
		[ 'key' => 'hd_channel',          'label' => 'Channels',         'default_enabled' => true,  'default_slots' => [ 'short_def', 'long_def' ] ],
		[ 'key' => 'hd_center',           'label' => 'Centers',          'default_enabled' => true,  'default_slots' => [ 'short_def', 'long_def' ] ],
		[ 'key' => 'hd_type',             'label' => 'Type & Strategy',  'default_enabled' => true,  'default_slots' => [ 'short_def', 'long_def' ] ],
		[ 'key' => 'hd_authority',        'label' => 'Authority',        'default_enabled' => true,  'default_slots' => [ 'short_def', 'long_def' ] ],
		[ 'key' => 'hd_profile',          'label' => 'Profile',          'default_enabled' => true,  'default_slots' => [ 'short_def', 'long_def' ] ],
		[ 'key' => 'hd_definition_type',  'label' => 'Definition',       'default_enabled' => true,  'default_slots' => [ 'short_def', 'long_def' ] ],
		[ 'key' => 'hd_incarnation_cross','label' => 'Incarnation Cross', 'default_enabled' => true,  'default_slots' => [ 'short_def', 'long_def' ] ],
		[ 'key' => 'hd_variable',         'label' => 'Variables',        'default_enabled' => true,  'default_slots' => [ 'short_def', 'long_def' ] ],
		[ 'key' => 'hd_planet',           'label' => 'HD Planets (gate activations)', 'default_enabled' => true, 'default_slots' => [ 'short_def', 'long_def' ] ],
		[ 'key' => 'angel_shem',          'label' => 'Angels (Shem)',    'default_enabled' => true,  'default_slots' => [ 'short_def', 'long_def' ] ],
	];
	$astro = [
		[ 'key' => 'astro_planet',      'label' => 'Planets',     'default_enabled' => true,  'default_slots' => [ 'short_def', 'long_def' ] ],
		[ 'key' => 'astro_sign',        'label' => 'Signs',       'default_enabled' => true,  'default_slots' => [ 'short_def', 'long_def' ] ],
		[ 'key' => 'astro_house',       'label' => 'Houses',      'default_enabled' => true,  'default_slots' => [ 'short_def', 'long_def' ] ],
		[ 'key' => 'astro_aspect',      'label' => 'Aspects',     'default_enabled' => true,  'default_template' => 'astro_aspect_synth', 'default_slots' => [] ],
		[ 'key' => 'astro_angle_point', 'label' => 'Angles & Points', 'default_enabled' => true, 'default_slots' => [ 'short_def', 'long_def' ] ],
		[ 'key' => 'astro_moon_phase',  'label' => 'Moon Phase',  'default_enabled' => true,  'default_template' => 'astro_moon_phase_synth', 'default_slots' => [] ],
		// Composite "card key" entries (not real entity types) — the sidebar dispatch maps
		// the Stelliums / Chart Shape facets to these so they get their own synth + boxes
		// instead of collapsing to a planet/sign placement card.
		[ 'key' => 'astro_stellium',    'label' => 'Stelliums',   'default_enabled' => true,  'default_template' => 'astro_stellium_synth', 'default_slots' => [] ],
		[ 'key' => 'astro_chart_shape', 'label' => 'Chart Shape', 'default_enabled' => true,  'default_template' => 'astro_chart_shape_synth', 'default_slots' => [] ],
		[ 'key' => 'angel_shem',        'label' => 'Angels (Shem)', 'default_enabled' => true, 'default_slots' => [ 'short_def', 'long_def' ] ],
	];

	$map = [];
	foreach ( [ 'natal', 'shadow', 'connection' ] as $k ) {
		$map[ $k ] = $hd;
	}
	foreach ( [ 'wheel', 'dual_wheel', 'transit', 'transit_birth', 'asteroids' ] as $k ) {
		$map[ $k ] = $astro;
	}
	$map['combined'] = array_merge( $hd, $astro );
	return $map;
}

add_filter( 'lunacco_chart_card_type_catalog', 'luna_astrohd_register_chart_card_types' );
function luna_astrohd_register_chart_card_types( array $catalog ): array {
	foreach ( luna_astrohd_chart_card_type_definitions() as $key => $card_types ) {
		$catalog[ 'luna-astrohd::' . $key ] = $card_types;
	}
	return $catalog;
}

function luna_astrohd_get_customer_service_email(): string {
	return get_option( 'lt_astrohd_customer_service_email', '' );
}

function luna_astrohd_update_customer_service_email( string $email ): bool {
	return update_option( 'lt_astrohd_customer_service_email', sanitize_email( $email ) );
}
