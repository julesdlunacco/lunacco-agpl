<?php
/**
 * Luna AstroHD — Chart cache.
 *
 * Simple key/value cache table wrapper (wp_lt_astrohd_chart_cache).
 * Cache keys are hashes over (chart_type + input JSON) so identical
 * birthdata re-used across users hits the same cached computed chart.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Luna_AstroHD_Chart_Cache {

	public static function key_for( string $chart_type, array $input ): string {
		ksort( $input );
		return substr( hash( 'sha256', $chart_type . '|' . wp_json_encode( $input ) ), 0, 96 );
	}

	public static function get( string $key ): ?array {
		global $wpdb;
		$table = $wpdb->prefix . 'lt_astrohd_chart_cache';
		$row   = $wpdb->get_row( $wpdb->prepare(
			"SELECT chart_data, expires_at FROM {$table} WHERE cache_key=%s LIMIT 1",
			$key
		), ARRAY_A );
		if ( ! $row ) {
			return null;
		}
		if ( ! empty( $row['expires_at'] ) && strtotime( $row['expires_at'] ) < time() ) {
			$wpdb->delete( $table, [ 'cache_key' => $key ] );
			return null;
		}
		$decoded = json_decode( $row['chart_data'], true );
		return is_array( $decoded ) ? $decoded : null;
	}

	public static function set( string $key, array $data, ?int $ttl_seconds = null ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'lt_astrohd_chart_cache';
		$wpdb->replace( $table, [
			'cache_key'  => $key,
			'chart_data' => wp_json_encode( $data ),
			'expires_at' => $ttl_seconds ? gmdate( 'Y-m-d H:i:s', time() + $ttl_seconds ) : null,
		] );
	}
}
