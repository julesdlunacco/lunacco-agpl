<?php
/**
 * Core Chart Registry — module-agnostic chart governance.
 *
 * One place to control every chart any module exposes: visibility, admin-only,
 * premium, and credit cost. Two kinds of chart live here:
 *
 *   1. Built-in charts — fixed views a module ships (natal, wheel, combined…).
 *      Modules register them via the `lunacco_chart_types` filter; their
 *      settings live in the option `lunacco_chart_display_settings`, keyed
 *      `<module_id>::<key>`.
 *   2. Chart-Maker presets — rows in the core `chart_presets` table. Their
 *      governance flags ride inside `config_json` (enabled/admin_only/
 *      is_premium/credit_cost), so no schema change is needed.
 *
 * Module credit gates read their slice via lunacco_get_module_chart_settings()
 * so the same toggles drive astrology today and numerology / eastern later.
 *
 * @package LunaCco_Core
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const LUNACCO_CHART_SETTINGS_OPTION = 'lunacco_chart_display_settings';

/**
 * Built-in chart types registered across all modules.
 * Each entry: [ module_id, key, label, category? ].
 */
function lunacco_get_registered_chart_types(): array {
	$types = apply_filters( 'lunacco_chart_types', [] );
	$clean = [];
	foreach ( (array) $types as $type ) {
		$module = sanitize_key( (string) ( $type['module_id'] ?? '' ) );
		$key    = sanitize_key( (string) ( $type['key'] ?? '' ) );
		if ( '' === $module || '' === $key ) {
			continue;
		}
		$clean[] = [
			'module_id' => $module,
			'key'       => $key,
			'label'     => sanitize_text_field( (string) ( $type['label'] ?? $key ) ),
			'category'  => sanitize_key( (string) ( $type['category'] ?? '' ) ),
		];
	}
	return $clean;
}

function lunacco_chart_setting_defaults(): array {
	return [ 'enabled' => true, 'admin_only' => false, 'is_premium' => false, 'credit_cost' => 0, 'sidebar_template' => '', 'layers' => [], 'card_types' => [] ];
}

/**
 * Catalog of optional sidebar layers per chart, keyed by setting id (`module::key`).
 * Modules register their layers here. Each layer:
 *   [ 'key' => 'chart_ruler', 'label' => 'Chart Ruler', 'default_enabled' => true, 'default_limit' => 0 ]
 * Per-chart admin overrides (enabled/template/limit) live in the settings option;
 * this provides the available set and their out-of-the-box defaults.
 */
function lunacco_chart_layer_catalog(): array {
	return apply_filters( 'lunacco_chart_layer_catalog', [] );
}

/**
 * Resolve a chart's layers: catalog definitions merged with stored overrides.
 * Returns map layer_key => [ key, label, enabled, template, limit ].
 */
function lunacco_get_chart_layers( string $module_id, string $key ): array {
	$catalog = lunacco_chart_layer_catalog();
	$defs    = is_array( $catalog[ lunacco_chart_setting_id( $module_id, $key ) ] ?? null )
		? $catalog[ lunacco_chart_setting_id( $module_id, $key ) ]
		: [];
	$setting   = lunacco_get_chart_setting( $module_id, $key );
	$overrides = is_array( $setting['layers'] ?? null ) ? $setting['layers'] : [];

	$out = [];
	foreach ( $defs as $def ) {
		$lkey = sanitize_key( (string) ( $def['key'] ?? '' ) );
		if ( '' === $lkey ) {
			continue;
		}
		$ov = is_array( $overrides[ $lkey ] ?? null ) ? $overrides[ $lkey ] : [];
		$out[ $lkey ] = [
			'key'      => $lkey,
			'label'    => (string) ( $def['label'] ?? $lkey ),
			'enabled'  => array_key_exists( 'enabled', $ov ) ? ! empty( $ov['enabled'] ) : ! empty( $def['default_enabled'] ),
			'template' => sanitize_key( (string) ( $ov['template'] ?? '' ) ),
			'limit'    => max( 0, (int) ( $ov['limit'] ?? ( $def['default_limit'] ?? 0 ) ) ),
		];
	}
	return $out;
}

/** Sanitize a per-chart layers override map for persistence. */
function lunacco_sanitize_chart_layers( $layers ): array {
	if ( ! is_array( $layers ) ) {
		return [];
	}
	$out = [];
	foreach ( $layers as $lkey => $cfg ) {
		$lkey = sanitize_key( (string) $lkey );
		if ( '' === $lkey || ! is_array( $cfg ) ) {
			continue;
		}
		$out[ $lkey ] = [
			'enabled'  => ! empty( $cfg['enabled'] ),
			'template' => sanitize_key( (string) ( $cfg['template'] ?? '' ) ),
			'limit'    => max( 0, (int) ( $cfg['limit'] ?? 0 ) ),
		];
	}
	return $out;
}

/**
 * Catalog of clickable card types per chart, keyed by setting id (`module::key`).
 *
 * Where "layers" are derived extra sidebar areas, "card types" are the things a
 * user actually clicks on the chart (a gate, a sign, a planet, an aspect…). Each
 * card type resolves its definition through its own template + slot list, so the
 * sidebar is no longer bound to a single global template per chart.
 *
 * Modules register their card types here. Each entry:
 *   [ 'key' => 'astro_sign', 'label' => 'Signs', 'default_enabled' => true,
 *     'default_template' => '', 'default_slots' => [ 'short_def', 'long_def' ] ]
 * `key` is the resolver entity_type (hd_gate, astro_sign, astro_planet, …).
 */
function lunacco_chart_card_type_catalog(): array {
	return apply_filters( 'lunacco_chart_card_type_catalog', [] );
}

/**
 * Resolve a chart's card types: catalog definitions merged with stored overrides.
 * Returns map entity_type => [ key, label, enabled, template, slots[] ].
 */
function lunacco_get_chart_card_types( string $module_id, string $key ): array {
	$catalog = lunacco_chart_card_type_catalog();
	$defs    = is_array( $catalog[ lunacco_chart_setting_id( $module_id, $key ) ] ?? null )
		? $catalog[ lunacco_chart_setting_id( $module_id, $key ) ]
		: [];
	$setting   = lunacco_get_chart_setting( $module_id, $key );
	$overrides = is_array( $setting['card_types'] ?? null ) ? $setting['card_types'] : [];

	$out = [];
	foreach ( $defs as $def ) {
		$ckey = sanitize_key( (string) ( $def['key'] ?? '' ) );
		if ( '' === $ckey ) {
			continue;
		}
		$ov = is_array( $overrides[ $ckey ] ?? null ) ? $overrides[ $ckey ] : [];
		$out[ $ckey ] = [
			'key'      => $ckey,
			'label'    => (string) ( $def['label'] ?? $ckey ),
			'enabled'  => array_key_exists( 'enabled', $ov ) ? ! empty( $ov['enabled'] ) : ! empty( $def['default_enabled'] ),
			'template' => sanitize_key( (string) ( $ov['template'] ?? $def['default_template'] ?? '' ) ),
			'slots'    => array_key_exists( 'slots', $ov )
				? array_values( array_filter( array_map( 'sanitize_key', (array) $ov['slots'] ) ) )
				: array_values( array_filter( array_map( 'sanitize_key', (array) ( $def['default_slots'] ?? [] ) ) ) ),
		];
	}
	return $out;
}

/** Sanitize a per-chart card-types override map for persistence. */
function lunacco_sanitize_chart_card_types( $card_types ): array {
	if ( ! is_array( $card_types ) ) {
		return [];
	}
	$out = [];
	foreach ( $card_types as $ckey => $cfg ) {
		$ckey = sanitize_key( (string) $ckey );
		if ( '' === $ckey || ! is_array( $cfg ) ) {
			continue;
		}
		$out[ $ckey ] = [
			'enabled'  => ! empty( $cfg['enabled'] ),
			'template' => sanitize_key( (string) ( $cfg['template'] ?? '' ) ),
			'slots'    => array_values( array_filter( array_map( 'sanitize_key', (array) ( $cfg['slots'] ?? [] ) ) ) ),
		];
	}
	return $out;
}

function lunacco_chart_setting_id( string $module_id, string $key ): string {
	return sanitize_key( $module_id ) . '::' . sanitize_key( $key );
}

function lunacco_get_all_chart_settings(): array {
	$stored = get_option( LUNACCO_CHART_SETTINGS_OPTION, [] );
	return is_array( $stored ) ? $stored : [];
}

function lunacco_get_chart_setting( string $module_id, string $key ): array {
	$all = lunacco_get_all_chart_settings();
	$row = is_array( $all[ lunacco_chart_setting_id( $module_id, $key ) ] ?? null )
		? $all[ lunacco_chart_setting_id( $module_id, $key ) ]
		: [];
	return array_merge( lunacco_chart_setting_defaults(), $row );
}

/**
 * Settings for one module keyed by the bare chart key (back-compat shape that
 * module credit gates expect, e.g. [ 'natal' => [...], 'wheel' => [...] ]).
 */
function lunacco_get_module_chart_settings( string $module_id ): array {
	$out = [];
	foreach ( lunacco_get_registered_chart_types() as $type ) {
		if ( $type['module_id'] !== sanitize_key( $module_id ) ) {
			continue;
		}
		$out[ $type['key'] ] = lunacco_get_chart_setting( $module_id, $type['key'] );
	}
	return $out;
}

/**
 * Persist built-in chart settings. $rows is keyed by setting id (`module::key`)
 * → { enabled, admin_only, is_premium, credit_cost }. Merges over existing.
 */
function lunacco_update_chart_display_settings( array $rows ): bool {
	$clean = lunacco_get_all_chart_settings();
	foreach ( $rows as $id => $row ) {
		if ( ! is_array( $row ) ) {
			continue;
		}
		$existing = is_array( $clean[ sanitize_text_field( (string) $id ) ] ?? null ) ? $clean[ sanitize_text_field( (string) $id ) ] : [];
		$clean[ sanitize_text_field( (string) $id ) ] = [
			'enabled'          => ! empty( $row['enabled'] ),
			'admin_only'       => ! empty( $row['admin_only'] ),
			'is_premium'       => ! empty( $row['is_premium'] ),
			'credit_cost'      => max( 0, (int) ( $row['credit_cost'] ?? 0 ) ),
			'sidebar_template' => array_key_exists( 'sidebar_template', $row )
				? sanitize_key( (string) $row['sidebar_template'] )
				: (string) ( $existing['sidebar_template'] ?? '' ),
			// Preserve existing layer overrides when a save omits them.
			'layers'           => array_key_exists( 'layers', $row )
				? lunacco_sanitize_chart_layers( $row['layers'] )
				: ( is_array( $existing['layers'] ?? null ) ? $existing['layers'] : [] ),
			// Per-card-type template/slot overrides; preserved when a save omits them.
			'card_types'       => array_key_exists( 'card_types', $row )
				? lunacco_sanitize_chart_card_types( $row['card_types'] )
				: ( is_array( $existing['card_types'] ?? null ) ? $existing['card_types'] : [] ),
		];
	}
	return update_option( LUNACCO_CHART_SETTINGS_OPTION, $clean );
}

/** Read the governance flags a Chart-Maker preset carries inside its config_json. */
function lunacco_chart_preset_flags( array $config ): array {
	return [
		'enabled'     => array_key_exists( 'enabled', $config ) ? ! empty( $config['enabled'] ) : ( $config['is_enabled'] ?? true ),
		'admin_only'  => ! empty( $config['admin_only'] ),
		'is_premium'  => ! empty( $config['is_premium'] ),
		'credit_cost' => max( 0, (int) ( $config['credit_cost'] ?? 0 ) ),
	];
}
