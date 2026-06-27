<?php
/**
 * Luna AstroHD — Document Builder contributor registration.
 *
 * Registers astrohd's calculators (natal / transit) and definition set types
 * with lunacco-document-builder so the report builder can compose astrohd
 * sections. A composite / "super-report" renderer across numerology+astrohd
 * is deferred to Phase 2.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'lunacco_db_register_contributors', 'luna_astrohd_db_register_contributor' );

function luna_astrohd_db_register_contributor( $registry ): void {
	if ( ! is_object( $registry ) || ! method_exists( $registry, 'register' ) ) {
		return;
	}

	$registry->register( 'luna-astrohd', [
		'label'       => 'AstroHD',
		'calculators' => [
			'astrohd_natal' => [
				'label'          => 'AstroHD — Natal',
				'chart_types'    => [ 'natal_bodygraph', 'natal_astro' ],
				'points'         => [
					'type'        => 'Energy Type',
					'authority'   => 'Inner Authority',
					'strategy'    => 'Strategy',
					'profile'     => 'Profile',
					'definition'  => 'Definition',
					'sun_sign'    => 'Sun Sign',
					'moon_sign'   => 'Moon Sign',
					'rising'      => 'Rising (ASC)',
					'chart_shape' => 'Chart Shape',
				],
				'rest_calculate' => 'luna-astrohd/v1/calculate/natal',
				'input_fields'   => [ 'birthdate', 'birth_time', 'birth_place' ],
			],
			'astrohd_transit' => [
				'label'          => 'AstroHD — Transits',
				'chart_types'    => [ 'transit_bodygraph', 'transit_astro' ],
				'points'         => [
					'transit_sun'  => 'Transit Sun',
					'transit_moon' => 'Transit Moon',
					'active_gates' => 'Active Gates',
				],
				'rest_calculate' => 'luna-astrohd/v1/calculate/transit',
				'input_fields'   => [ 'date', 'time', 'place' ],
			],
		],
		'definition_set_types' => [ 'astrohd_hd', 'astrohd_astro' ],
		'resolve_definition'   => 'luna_astrohd_db_resolve_definition',
		'chart_normalizer'     => 'luna_astrohd_db_normalize_chart_factors',
		'available_sections'   => [ 'placements', 'aspects', 'moon_phase', 'angels', 'hd_profile', 'hd_centers', 'hd_gates', 'hd_channels', 'synthesis' ],
		'default_report_presets' => [ 'astrology_natal_report', 'astrology_angels_report', 'astrohd_combined_report' ],
	] );
}

/**
 * Resolve a definition for the document builder.
 *
 * The builder's signature is ( set_id, number, position ) but we accept
 * astrohd-style ( section_type, item_key ). We interpret:
 *   $number   as item_key (e.g. '1', 'sun', 'conjunction')
 *   $position as section_type (e.g. 'hd_gates', 'astro_planets')
 *
 * Returns { short, long, affirmation, slots } to match document-builder
 * contract (affirmation stays empty for astrohd).
 */
function luna_astrohd_db_resolve_definition( int $set_id, string $number, string $position ): array {
	if ( function_exists( 'lunacco_core' ) && method_exists( lunacco_core(), 'definitions' ) ) {
		$section_type = $position ?: 'hd_gates';
		$entity_type  = luna_astrohd_db_section_to_entity_type( $section_type );
		$active_set   = $set_id > 0 ? lunacco_core()->definitions()->get_set( $set_id ) : lunacco_core()->definitions()->get_active_set_for_module( 'luna-astrohd' );
		if ( ! empty( $active_set['id'] ) && $entity_type ) {
			$result = lunacco_core()->definitions()->resolve( [
				'set_id'          => (int) $active_set['id'],
				'module_id'       => 'luna-astrohd',
				'output_context'  => 'pdf_long',
				'chart_context'   => 'natal',
				'overlay_key'     => 'base',
				'tone_key'        => 'default',
				'active_entities' => [
					[
						'module_id'   => 'luna-astrohd',
						'entity_type' => $entity_type,
						'entity_key'  => $number,
					],
				],
			] );
			return [
				'short'       => (string) ( $result['visible_slots'][0]['value'] ?? $result['rendered_text'] ?? '' ),
				'long'        => (string) ( $result['rendered_text'] ?? '' ),
				'affirmation' => '',
				'slots'       => $result['visible_slots'] ?? [],
			];
		}
	}

	if ( ! class_exists( 'Luna_AstroHD_Definition_Manager' ) ) {
		return [ 'short' => '', 'long' => '', 'affirmation' => '', 'slots' => [] ];
	}

	// Heuristic: if caller doesn't pass a section_type in $position, default to hd_gates.
	$section_type = $position ?: 'hd_gates';

	$resolved = Luna_AstroHD_Definition_Manager::resolve( $set_id, $section_type, $number );

	return [
		'short'       => $resolved['short']  ?? '',
		'long'        => $resolved['long']   ?? '',
		'affirmation' => '',
		'slots'       => $resolved['slots']  ?? [],
	];
}

function luna_astrohd_db_section_to_entity_type( string $section_type ): string {
	$map = [
		'hd_gates' => 'hd_gate',
		'hd_channels' => 'hd_channel',
		'hd_centers' => 'hd_center',
		'hd_types' => 'hd_type',
		'hd_authorities' => 'hd_authority',
		'hd_profiles' => 'hd_profile',
		'hd_incarnation_crosses' => 'hd_incarnation_cross',
		'astro_planets' => 'astro_planet',
		'astro_signs' => 'astro_sign',
		'astro_houses' => 'astro_house',
		'astro_aspects' => 'astro_aspect',
		'astro_angles_points' => 'astro_angle_point',
		'astro_asteroids' => 'astro_asteroid',
		'astro_moon_phases' => 'astro_moon_phase',
		'angel_shem' => 'angel_shem',
		'angels' => 'angel_shem',
		'angel_degree_ranges' => 'angel_degree_range',
	];
	return $map[ $section_type ] ?? sanitize_key( $section_type );
}

function luna_astrohd_db_normalize_chart_factors( array $chart_data, array $profile = [] ): array {
	$factors = [];
	$overlays = (array) ( $profile['overlays'] ?? [ 'base' ] );
	$angel_enabled = in_array( 'angelic', $overlays, true ) || in_array( 'angels', $overlays, true );
	foreach ( (array) ( $chart_data['birthActivations'] ?? [] ) as $body => $activation ) {
		if ( ! is_array( $activation ) ) {
			continue;
		}
		$body_key = sanitize_key( (string) $body );
		$factors[] = [
			'body' => $body_key,
			'sign' => sanitize_key( (string) ( $activation['sign'] ?? '' ) ),
			'house' => ! empty( $activation['house'] ) ? 'house_' . (int) $activation['house'] : '',
			'chart_context' => sanitize_key( (string) ( $profile['chart_context'] ?? 'natal' ) ),
			'modifiers' => ! empty( $activation['isRetrograde'] ) ? [ 'retrograde' ] : [],
			'overlays' => $overlays,
		];
		if ( $angel_enabled && in_array( $body_key, [ 'sun', 'moon', 'rising', 'asc', 'ascendant' ], true ) ) {
			$degree = luna_astrohd_db_extract_absolute_degree( $activation );
			$angel_key = luna_astrohd_db_shem_angel_key_for_degree( $degree );
			if ( $angel_key ) {
				$factors[] = [
					'body' => $body_key,
					'angel' => $angel_key,
					'degree' => $degree,
					'chart_context' => sanitize_key( (string) ( $profile['chart_context'] ?? 'natal' ) ),
					'overlays' => [ 'angelic' ],
				];
			}
		}
	}
	return $factors;
}

function luna_astrohd_db_extract_absolute_degree( array $activation ): ?float {
	foreach ( [ 'absoluteDegree', 'absolute_degree', 'eclipticLongitude', 'longitude', 'degree' ] as $key ) {
		if ( isset( $activation[ $key ] ) && is_numeric( $activation[ $key ] ) ) {
			$degree = fmod( (float) $activation[ $key ], 360.0 );
			return $degree < 0 ? $degree + 360.0 : $degree;
		}
	}
	return null;
}

function luna_astrohd_db_shem_angel_key_for_degree( ?float $degree ): string {
	if ( null === $degree ) {
		return '';
	}
	$index = (int) floor( $degree / 5.0 ) + 1;
	$index = max( 1, min( 72, $index ) );
	return 'shem_' . $index;
}
