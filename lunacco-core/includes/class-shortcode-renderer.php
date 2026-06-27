<?php
/**
 * Shortcode renderer — mounts the SPA, enqueues assets, localizes LunaCcoData.
 *
 * Migrated from luna-tarot's luna-tarot.php (lines 1907-1973).
 *
 * Shortcodes registered (by bootstrap):
 *   [lunacco_app]  — primary
 *   [luna_tarot]   — permanent alias for backward compatibility
 *
 * Script handle:   lunacco-core-app
 * Localized var:   LunaCcoData
 * Module data is added under LunaCcoData.modules[module_id] via the 'lunacco_localize_data' filter.
 *
 * Module data is populated by modules via the 'lunacco_localize_data' filter,
 * which adds their data under LunaCcoData.modules[module_id].
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_Shortcode_Renderer {

	private LunaCco_Module_Registry $modules;

	public function __construct( LunaCco_Module_Registry $modules ) {
		$this->modules = $modules;
	}

	// ------------------------------------------------------------------
	// Script enqueue (hooked to wp_enqueue_scripts)
	// ------------------------------------------------------------------

	/**
	 * Find and enqueue the built SPA JS + CSS from the core dist folder.
	 * Called on wp_enqueue_scripts — enqueue is deferred until the shortcode
	 * is actually rendered (script + style only added when shortcode is present).
	 */
	public function enqueue_scripts(): void {
		// Scripts are only enqueued when the shortcode is actually on the page.
		// This method registers them; the shortcode render triggers the enqueue.
	}

	// ------------------------------------------------------------------
	// Shortcode render
	// ------------------------------------------------------------------

	/**
	 * Render the SPA mount point, enqueue JS/CSS, and localize data.
	 *
	 * @param array|string $atts  Shortcode attributes (unused for now).
	 * @return string             The mount-point HTML div.
	 */
	public function render( $atts = [] ): string {
		$scheme     = $this->get_preferred_scheme();
		$plugin_url = set_url_scheme( plugin_dir_url( LUNACCO_CORE_FILE ), $scheme );
		$plugin_dir = plugin_dir_path( LUNACCO_CORE_FILE );

		$js_paths  = glob( $plugin_dir . 'spa/dist/assets/*.js' );
		$css_paths = glob( $plugin_dir . 'spa/dist/assets/*.css' );

		if ( ! empty( $js_paths ) ) {
			$js_path    = $js_paths[0];
			$js_url     = set_url_scheme( $plugin_url . 'spa/dist/assets/' . basename( $js_path ), $scheme );
			$js_version = file_exists( $js_path ) ? (string) filemtime( $js_path ) : LUNACCO_CORE_VERSION;

			wp_enqueue_script( 'lunacco-core-app', $js_url, [], $js_version, true );

			// Build the core data payload.
			$app_url = get_permalink();
			if ( ! $app_url ) {
				$app_url = home_url( '/' );
			}
			$app_url = set_url_scheme( $app_url, $scheme );

			$data = [
				'root'            => esc_url_raw( rest_url( '', $scheme ) ),
				'ajaxUrl'         => esc_url_raw( set_url_scheme( admin_url( 'admin-ajax.php' ), $scheme ) ),
				'nonce'           => wp_create_nonce( 'wp_rest' ),
				'pluginUrl'       => esc_url_raw( $plugin_url ),
				'isAdmin'         => current_user_can( 'manage_options' ),
				'isLoggedIn'      => is_user_logged_in(),
				'loginUrl'        => esc_url_raw( set_url_scheme( wp_login_url( $app_url ), $scheme ) ),
				'appUrl'          => esc_url_raw( $app_url ),
				'returnMainUrl'   => esc_url_raw( $this->normalize_url( get_option( 'lt_return_main_url', '' ), $scheme ) ),
				'returnMainLabel' => sanitize_text_field( get_option( 'lt_nav_return_main_label', 'Home' ) ),
				'pickLabel'       => sanitize_text_field( get_option( 'lt_nav_pick_label', 'Pick' ) ),
				'buyCreditsUrl'   => esc_url_raw( $this->normalize_url( get_option( 'lt_buy_credits_url', '' ), $scheme ) ),
				'becomeMemberUrl' => esc_url_raw( $this->normalize_url( get_option( 'lt_become_member_url', '' ), $scheme ) ),
				'appHeaderTitle'  => sanitize_text_field( get_option( 'lt_app_header_title', 'Cosmic Oracle' ) ),
				'appHeaderLogoUrl' => esc_url_raw( $this->normalize_url( get_option( 'lt_app_header_logo_url', '' ), $scheme ) ),
				'footerDisclaimer' => sanitize_text_field( get_option( 'lt_footer_disclaimer', 'For entertainment purposes only. Some reports may use AI to help with assembly and personalization.' ) ),
				'authModalDisabled' => get_option( 'lt_disable_auth_modal', '0' ) === '1',
				'authPageUrl'     => esc_url_raw( $this->normalize_url( get_option( 'lt_auth_page_url', '' ), $scheme ) ),
				'birthTimeHelpUrl' => esc_url_raw( $this->normalize_url( get_option( 'lt_birth_time_help_url', '' ), $scheme ) ),
				'footerLinks'     => array_values( array_filter( [
					[ 'label' => 'Privacy Policy',      'url' => esc_url_raw( $this->normalize_url( get_option( 'lt_link_privacy', '' ),    $scheme ) ) ],
					[ 'label' => 'Terms & Conditions',  'url' => esc_url_raw( $this->normalize_url( get_option( 'lt_link_terms', '' ),      $scheme ) ) ],
					[ 'label' => 'Refund Policy',       'url' => esc_url_raw( $this->normalize_url( get_option( 'lt_link_refund', '' ),     $scheme ) ) ],
					[ 'label' => 'Disclaimer',          'url' => esc_url_raw( $this->normalize_url( get_option( 'lt_link_disclaimer', '' ), $scheme ) ) ],
				], static fn( $l ) => ! empty( $l['url'] ) ) ),
				'agplSourceUrl'   => esc_url_raw( $this->normalize_url( get_option( 'lt_agpl_source_url', '' ), $scheme ) ),
				'footerCopyrightText'      => sanitize_textarea_field( get_option( 'lt_footer_copyright_text', '' ) ),
				'footerCopyrightTextTarot' => sanitize_textarea_field( get_option( 'lt_footer_copyright_text_tarot', '' ) ),
				'authButtonLabel'   => 'Sign Up or Login',
				'signupPromoText'   => $this->get_signup_promo_text(),
				'ai_favorite_models' => current_user_can( 'manage_options' ) ? sanitize_text_field( get_option( 'lt_ai_favorite_models', '' ) ) : '',
				'pdfSettings'     => [
					'useHeaderLogo'  => get_option( 'lt_pdf_use_header_logo', '1' ) === '1',
					'copyrightCompany' => sanitize_text_field( get_option( 'lt_pdf_copyright_company', 'Cosmic Oracle' ) ),
					'copyrightYear'  => (int) get_option( 'lt_pdf_copyright_year', (int) gmdate( 'Y' ) ),
					'copyrightNoticeCustom' => sanitize_textarea_field( get_option( 'lt_pdf_copyright_notice_custom', '' ) ),
				],
				'featured'        => get_option( 'lunacco_featured', null ),
				'modules'         => [],

				// Module-scoped footer notices (e.g. AGPL attribution for astrohd).
				// Each entry: [ 'id' => string, 'text' => string, 'show_on_views' => string[] ]
				// Empty show_on_views = visible on all views.
				'moduleFooterNotices' => (array) apply_filters( 'lunacco_footer_notices', [] ),
			];

			// Allow modules to append their own data under data['modules'][module_id].
			$data = (array) apply_filters( 'lunacco_localize_data', $data );

			// Also populate via module registry localize callbacks.
			$data['modules'] = array_merge(
				(array) ( $data['modules'] ?? [] ),
				$this->modules->get_localize_data()
			);

			wp_localize_script( 'lunacco-core-app', 'LunaCcoData', $data );

			// Allow modules to enqueue their own JS bundles (IIFEs that depend on core).
			do_action( 'lunacco_enqueue_module_scripts' );
		}

		if ( ! empty( $css_paths ) ) {
			$css_path    = $css_paths[0];
			$css_url     = set_url_scheme( $plugin_url . 'spa/dist/assets/' . basename( $css_path ), $scheme );
			$css_version = file_exists( $css_path ) ? (string) filemtime( $css_path ) : LUNACCO_CORE_VERSION;
			wp_enqueue_style( 'lunacco-core-app', $css_url, [], $css_version );
		}

		// The SPA mounts to #lunacco-app.
		return '<div id="lunacco-app"></div>';
	}

	// ------------------------------------------------------------------
	// Template override (full-page SPA support)
	// ------------------------------------------------------------------

	/**
	 * If the current singular post uses [lunacco_app] or [luna_tarot], swap in
	 * the core full-page template (if it exists).
	 *
	 * @param string $template  Path to the currently-selected template.
	 * @return string
	 */
	public function handle_template_include( string $template ): string {
		global $post;
		if ( ! is_singular() || ! is_a( $post, 'WP_Post' ) ) {
			return $template;
		}

		if ( has_shortcode( $post->post_content, 'lunacco_app' ) || has_shortcode( $post->post_content, 'luna_tarot' ) ) {
			// The page bakes a per-user REST nonce into LunaCcoData. A cached copy
			// served to a logged-in user carries a stale/guest nonce, so every
			// authenticated REST call (user/context, people, credits) silently fails
			// and the SPA shows empty state. Forbid caching of this page for logged-in
			// users so the nonce is always fresh (no more ?nocache= needed).
			if ( is_user_logged_in() ) {
				if ( ! defined( 'DONOTCACHEPAGE' ) ) {
					define( 'DONOTCACHEPAGE', true );
				}
				nocache_headers();
			}

			$custom = plugin_dir_path( LUNACCO_CORE_FILE ) . 'templates/lunacco-page.php';
			if ( file_exists( $custom ) ) {
				return $custom;
			}
		}

		return $template;
	}

	// ------------------------------------------------------------------
	// Helpers
	// ------------------------------------------------------------------

	private function get_preferred_scheme(): string {
		$home_scheme = strtolower( (string) wp_parse_url( home_url( '/' ), PHP_URL_SCHEME ) );
		return $home_scheme === 'https' ? 'https' : ( is_ssl() ? 'https' : 'http' );
	}

	private function normalize_url( string $url, string $scheme ): string {
		if ( $url === '' ) {
			return '';
		}
		return set_url_scheme( $url, $scheme );
	}

	private function get_signup_promo_text(): string {
		$credits = max( 0, (int) get_option( 'lt_free_account_credit_amount', 3 ) );
		if ( $credits <= 0 ) {
			return '';
		}
		return sprintf( 'Get %d free credit%s when you sign up.', $credits, $credits === 1 ? '' : 's' );
	}
}
