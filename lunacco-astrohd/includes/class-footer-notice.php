<?php
/**
 * Luna AstroHD — Footer notice for AGPL / Swiss Ephemeris attribution.
 *
 * Registers one notice via the `lunacco_footer_notices` filter. It shows on:
 *   - All astrohd-* views
 *   - The core dashboard (view key is empty on the main landing in some flows,
 *     so we also include the null/empty case by adding a 'dashboard' sentinel
 *     and letting AppFooter match it)
 *
 * When the public source repository URL is known, set it via the option
 * `luna_astrohd_public_repo_url` (empty by default).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_filter( 'lunacco_footer_notices', 'luna_astrohd_register_footer_notice' );

function luna_astrohd_register_footer_notice( array $notices ): array {
	$repo_url = (string) get_option( 'luna_astrohd_public_repo_url', '' );
	$source   = $repo_url
		? sprintf( 'Source: %s', esc_url_raw( $repo_url ) )
		: 'Source available on request.';

	$notices[] = [
		'id'   => 'luna-astrohd-agpl',
		'text' => 'Astronomical calculations powered by Swiss Ephemeris © Astrodienst AG, used under AGPL-3.0. ' . $source,
		'show_on_views' => [
			'astrohd-natal',
			'astrohd-shadow',
			'astrohd-transit',
			'astrohd-connection',
			'astrohd-snapshot',
			'astrohd-definitions',
			'astrohd-settings',
			// Core dashboard view key (module-less landing). When empty string matches
			// the active view, AppFooter renders the notice — we add '' here via a
			// second entry below to keep the main notice tidy.
		],
	];

	// Separate entry for the dashboard so numerology/tarot-only users never see it.
	// Only surfaces when astrohd is actually active (this filter only runs if this
	// plugin is loaded), and the view is '' (unset) or the core home key.
	$notices[] = [
		'id'   => 'luna-astrohd-agpl-home',
		'text' => 'Astronomical data: Swiss Ephemeris © Astrodienst AG (AGPL-3.0).',
		'show_on_views' => [ '', 'home', 'dashboard' ],
	];

	return $notices;
}
