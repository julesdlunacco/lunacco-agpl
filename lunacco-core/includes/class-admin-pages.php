<?php
/**
 * Admin pages — all WordPress admin page renderers.
 *
 * Pages: Dashboard, Credits & Plans, User Credit History,
 *        Business Settings, AI Settings, Generation Logs.
 *
 * Migrated from luna-tarot's backend.php (lines 447-1730).
 *
 * Key changes from luna-tarot:
 *   - Menu slug: luna-tarot → lunacco
 *   - Sub-page slugs: luna-tarot-* → lunacco-*
 *   - Settings groups: luna_tarot_* → lunacco_*
 *   - Option keys: ALL lt_* keys unchanged (no data migration needed)
 *   - FluentAuth shortcode fields removed from UI
 *   - New Security section in Business Settings (max attempts, lockout, whitelist)
 *   - Admin post handlers wired for manual credit, sync, rebuild
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_Admin_Pages {

	// ------------------------------------------------------------------
	// Menu registration
	// ------------------------------------------------------------------

	public function add_admin_menu(): void {
		add_menu_page(
			'LunaCco Core',
			'LunaCco Core',
			'manage_options',
			'lunacco',
			[ $this, 'page_dashboard' ],
			'dashicons-star-filled'
		);

		add_submenu_page( 'lunacco', 'FluentCart / Credits', 'Credits & Plans',     'manage_options', 'lunacco-cart',           [ $this, 'page_cart' ] );
		add_submenu_page( 'lunacco', 'Definition Engine',    'Definition Engine',    'manage_options', 'lunacco-definitions',    [ $this, 'page_definitions' ] );
		add_submenu_page( 'lunacco', 'User Credit History',  'User Credit History',  'manage_options', 'lunacco-credit-history', [ $this, 'page_credit_history' ] );
		add_submenu_page( 'lunacco', 'Business Settings',    'Business Settings',    'manage_options', 'lunacco-business',       [ $this, 'page_business' ] );
		add_submenu_page( 'lunacco', 'Security & Access',    'Security & Access',    'manage_options', 'lunacco-security',       [ $this, 'page_security' ] );
		add_submenu_page( 'lunacco', 'AI Settings',          'AI Settings',          'manage_options', 'lunacco-ai',             [ $this, 'page_ai' ] );
		add_submenu_page( 'lunacco', 'Generation Logs',      'Generation Logs',      'manage_options', 'lunacco-logs',           [ $this, 'page_logs' ] );
		add_submenu_page( 'lunacco', 'Promotions',           'Promotions',           'manage_options', 'lunacco-promos',         [ $this, 'page_promos' ] );
		add_submenu_page( 'lunacco', 'Location Data',         'Location Data',        'manage_options', 'lunacco-locations',      [ $this, 'page_locations' ] );
	}

	// ------------------------------------------------------------------
	// Settings registration
	// ------------------------------------------------------------------

	public function register_settings(): void {
		// Cart settings
		foreach ( [
			'lt_reading_product_id'        => 18,
			'lt_reading_var_1_id'          => 1,
			'lt_reading_var_1_credits'     => 5,
			'lt_reading_var_2_id'          => 2,
			'lt_reading_var_2_credits'     => 15,
			'lt_reading_var_3_id'          => 3,
			'lt_reading_var_3_credits'     => 30,
			'lt_reading_var_4_id'          => 4,
			'lt_reading_var_4_credits'     => 60,
			'lt_sub_product_id'            => 20,
			'lt_sub_monthly_var_id'        => 1,
			'lt_sub_monthly_credits'       => 100,
			'lt_sub_annual_var_id'         => 2,
			'lt_sub_annual_credits'        => 1200,
			'lt_daily_free_limit'          => 2,
			'lt_free_account_credit_amount' => 3,
			'lt_free_account_credit_mode'  => 'one_time',
		] as $key => $default ) {
			register_setting( 'lunacco_cart', $key, [ 'default' => $default ] );
		}

		// Business settings
		foreach ( [
			'lt_buy_credits_url'         => '',
			'lt_become_member_url'       => '',
			'lt_return_main_url'         => '',
			'lt_app_header_title'        => 'Cosmic Oracle',
			'lt_app_header_logo_url'     => '',
			'lt_nav_return_main_label'   => 'Home',
			'lt_nav_pick_label'          => 'Pick',
			'lt_disable_auth_modal'      => '0',
			'lt_auth_page_url'           => '',
			'lt_birth_time_help_url'     => '',
			'lt_link_privacy'            => '',
			'lt_link_terms'              => '',
			'lt_link_refund'             => '',
			'lt_link_disclaimer'         => '',
			'lt_agpl_source_url'         => '',
			'lt_footer_copyright_text'   => '',
			'lt_footer_copyright_text_tarot' => '',
			'lt_footer_disclaimer'       => 'For entertainment purposes only. Some reports may use AI to help with assembly and personalization.',
			'lt_pdf_use_header_logo'     => '1',
			'lt_pdf_copyright_company'   => 'Cosmic Oracle',
			'lt_pdf_copyright_year'      => (int) gmdate( 'Y' ),
			'lt_pdf_copyright_notice_custom' => '',
		] as $key => $default ) {
			register_setting( 'lunacco_business', $key, [ 'default' => $default ] );
		}

		// Security settings — own settings group (Security & Access page).
		register_setting( 'lunacco_security', 'lunacco_max_login_attempts',        [ 'default' => 3 ] );
		register_setting( 'lunacco_security', 'lunacco_lockout_duration',          [ 'default' => 60 ] );
		register_setting( 'lunacco_security', 'lunacco_ip_whitelist',             [ 'default' => '' ] );
		register_setting( 'lunacco_security', 'lunacco_permanent_block_threshold', [ 'default' => 0 ] );
		register_setting( 'lunacco_security', 'lunacco_magic_login_enabled',       [ 'default' => '0' ] );
		register_setting( 'lunacco_security', 'lunacco_magic_login_expiry',        [ 'default' => 15 ] );
		register_setting( 'lunacco_security', 'lunacco_post_login_redirect_url',   [ 'default' => '' ] );
		register_setting( 'lunacco_security', 'lunacco_lockout_log_enabled',       [ 'default' => '1' ] );

		// AI settings
		register_setting( 'lunacco_ai', 'lt_ai_model',                    [ 'default' => 'openai/gpt-4o-mini' ] );
		register_setting( 'lunacco_ai', 'lt_ai_system_prompt',            [ 'default' => 'You are an expert Tarot Reader.' ] );
		register_setting( 'lunacco_ai', 'lt_ai_deck_system_prompt',       [ 'default' => 'You are an expert tarot and oracle deck editor. Return JSON only. Preserve each requested card name exactly.' ] );
		register_setting( 'lunacco_ai', 'lt_ai_persona_prompts',          [ 'default' => '' ] );
		register_setting( 'lunacco_ai', 'lt_ai_report_base_cost',         [ 'default' => 1 ] );
		register_setting( 'lunacco_ai', 'lt_ai_lens_default_cost',        [ 'default' => 1 ] );
		register_setting( 'lunacco_ai', 'lt_ai_generation_logging_enabled', [ 'default' => '0' ] );
		register_setting( 'lunacco_ai', 'lt_ai_favorite_models',          [ 'default' => '' ] );
		register_setting( 'lunacco_ai', 'lt_ai_numerology_system_prompt', [ 'default' => 'You are an expert numerologist and spiritual teacher. Write clear, insightful definitions that empower the reader.' ] );
		register_setting( 'lunacco_ai', 'lt_ai_numerology_reading_prompt', [ 'default' => 'You are an expert numerologist and intuitive guide. Provide insightful, empowering readings that connect the numbers to the person\'s lived experience.' ] );
		register_setting( 'lunacco_ai', 'lt_ai_numerology_persona_prompts', [ 'default' => '' ] );
		register_setting( 'lunacco_ai', 'lt_ai_num_def_prompt_pythagorean', [ 'default' => 'You are an expert Pythagorean numerologist and spiritual teacher. Write clear, grounded, insightful definitions that empower the reader. Focus on practical life wisdom and soul growth.' ] );
		register_setting( 'lunacco_ai', 'lt_ai_num_def_prompt_name_arcana', [ 'default' => 'You are an expert in Name Arcana numerology within the Aquarian Destiny Numerology (ADN) system. Write poetic, soul-centred definitions for name number positions. Focus on identity, soul expression, and life integration.' ] );
		register_setting( 'lunacco_ai', 'lt_ai_num_def_prompt_adm_core7',   [ 'default' => 'You are an expert in the Aquarian Destiny Numerology (ADN) Core 7 system. Write definitions for all 7 positions including the Money Flow channel (material abundance, flow, and financial karma) and the Relationship channel (love, intimacy, and relational karma). Write empowering, spiritually rich content.' ] );
		// Legacy option — backward compat.
		register_setting( 'lunacco_ai', 'lt_ai_persona',                  [ 'default' => 'You are an expert Tarot Reader.' ] );
	}

	// ------------------------------------------------------------------
	// Admin asset enqueue
	// ------------------------------------------------------------------

	public function enqueue_admin_assets( string $hook ): void {
		$is_lunacco_page = strpos( $hook, 'lunacco-business' ) !== false
			|| strpos( $hook, 'lunacco-cart' ) !== false;
		if ( strpos( $hook, 'lunacco-definitions' ) !== false ) {
			$this->enqueue_definitions_app_assets();
			return;
		}
		if ( strpos( $hook, 'lunacco-security' ) !== false ) {
			$this->enqueue_security_app_assets();
			return;
		}
		if ( ! $is_lunacco_page ) {
			return;
		}

		wp_enqueue_media();
		wp_add_inline_script( 'jquery-core', "jQuery(function($){
			const logoField    = $('#lt_app_header_logo_url');
			const previewWrap  = $('#lt-logo-preview-wrap');
			const previewImg   = $('#lt-logo-preview');
			const pickBtn      = $('#lt-logo-picker-btn');
			const clearBtn     = $('#lt-logo-clear-btn');
			if (!logoField.length || !pickBtn.length) return;

			let frame;
			pickBtn.on('click', function(e){
				e.preventDefault();
				if (frame) { frame.open(); return; }
				frame = wp.media({
					title: 'Select Header Logo',
					button: { text: 'Use this logo' },
					library: { type: 'image' },
					multiple: false
				});
				frame.on('select', function(){
					const attachment = frame.state().get('selection').first().toJSON();
					if (!attachment || !attachment.url) return;
					logoField.val(attachment.url);
					previewImg.attr('src', attachment.url);
					previewWrap.show();
				});
				frame.open();
			});

			clearBtn.on('click', function(e){
				e.preventDefault();
				logoField.val('');
				previewImg.attr('src', '');
				previewWrap.hide();
			});
		});" );
	}

	private function enqueue_definitions_app_assets(): void {
		$scheme     = is_ssl() ? 'https' : 'http';
		$plugin_url = set_url_scheme( plugin_dir_url( LUNACCO_CORE_FILE ), $scheme );
		$plugin_dir = plugin_dir_path( LUNACCO_CORE_FILE );
		$js_paths   = glob( $plugin_dir . 'spa/dist/assets/*.js' );
		$css_paths  = glob( $plugin_dir . 'spa/dist/assets/*.css' );

		if ( ! empty( $js_paths ) ) {
			$js_path    = $js_paths[0];
			$js_url     = set_url_scheme( $plugin_url . 'spa/dist/assets/' . basename( $js_path ), $scheme );
			$js_version = file_exists( $js_path ) ? (string) filemtime( $js_path ) : LUNACCO_CORE_VERSION;

			wp_enqueue_script( 'lunacco-core-app', $js_url, [], $js_version, true );
			$this->mark_definitions_app_script_as_module();
			wp_localize_script( 'lunacco-core-app', 'LunaCcoData', [
				'root'             => esc_url_raw( rest_url( '', $scheme ) ),
				'ajaxUrl'          => esc_url_raw( set_url_scheme( admin_url( 'admin-ajax.php' ), $scheme ) ),
				'nonce'            => wp_create_nonce( 'wp_rest' ),
				'pluginUrl'        => esc_url_raw( $plugin_url ),
				'isAdmin'          => current_user_can( 'manage_options' ),
				'isLoggedIn'       => is_user_logged_in(),
				'appMode'          => 'definitions-admin',
				'appHeaderTitle'   => sanitize_text_field( get_option( 'lt_app_header_title', 'Cosmic Oracle' ) ),
				'appHeaderLogoUrl' => esc_url_raw( get_option( 'lt_app_header_logo_url', '' ) ),
				'footerDisclaimer' => sanitize_text_field( get_option( 'lt_footer_disclaimer', '' ) ),
				'returnMainUrl'    => esc_url_raw( admin_url( 'admin.php?page=lunacco' ) ),
				'returnMainLabel'  => 'Core Dashboard',
				'pickLabel'        => 'Pick',
				'appUrl'           => esc_url_raw( admin_url( 'admin.php?page=lunacco-definitions' ) ),
				'loginUrl'         => esc_url_raw( wp_login_url( admin_url( 'admin.php?page=lunacco-definitions' ) ) ),
				'modules'          => [],
				'moduleFooterNotices' => [],
				'definitionsAdmin' => [
					'pageTitle' => 'Definition Engine',
				],
			] );
		}

		if ( ! empty( $css_paths ) ) {
			$css_path    = $css_paths[0];
			$css_url     = set_url_scheme( $plugin_url . 'spa/dist/assets/' . basename( $css_path ), $scheme );
			$css_version = file_exists( $css_path ) ? (string) filemtime( $css_path ) : LUNACCO_CORE_VERSION;
			wp_enqueue_style( 'lunacco-core-app', $css_url, [], $css_version );
		}
	}

	private function enqueue_security_app_assets(): void {
		$scheme     = is_ssl() ? 'https' : 'http';
		$plugin_url = set_url_scheme( plugin_dir_url( LUNACCO_CORE_FILE ), $scheme );
		$plugin_dir = plugin_dir_path( LUNACCO_CORE_FILE );
		$js_paths   = glob( $plugin_dir . 'spa/dist/assets/*.js' );
		$css_paths  = glob( $plugin_dir . 'spa/dist/assets/*.css' );

		if ( ! empty( $js_paths ) ) {
			$js_path    = $js_paths[0];
			$js_url     = set_url_scheme( $plugin_url . 'spa/dist/assets/' . basename( $js_path ), $scheme );
			$js_version = file_exists( $js_path ) ? (string) filemtime( $js_path ) : LUNACCO_CORE_VERSION;

			wp_enqueue_script( 'lunacco-core-app', $js_url, [], $js_version, true );
			$this->mark_definitions_app_script_as_module();
			wp_localize_script( 'lunacco-core-app', 'LunaCcoData', [
				'root'             => esc_url_raw( rest_url( '', $scheme ) ),
				'nonce'            => wp_create_nonce( 'wp_rest' ),
				'pluginUrl'        => esc_url_raw( $plugin_url ),
				'isAdmin'          => current_user_can( 'manage_options' ),
				'isLoggedIn'       => is_user_logged_in(),
				'appMode'          => 'security-admin',
				'appHeaderTitle'   => sanitize_text_field( get_option( 'lt_app_header_title', 'Cosmic Oracle' ) ),
				'appHeaderLogoUrl' => esc_url_raw( get_option( 'lt_app_header_logo_url', '' ) ),
				'returnMainUrl'    => esc_url_raw( admin_url( 'admin.php?page=lunacco' ) ),
				'returnMainLabel'  => 'Core Dashboard',
				'modules'          => [],
				'moduleFooterNotices' => [],
			] );
		}

		if ( ! empty( $css_paths ) ) {
			$css_path    = $css_paths[0];
			$css_url     = set_url_scheme( $plugin_url . 'spa/dist/assets/' . basename( $css_path ), $scheme );
			$css_version = file_exists( $css_path ) ? (string) filemtime( $css_path ) : LUNACCO_CORE_VERSION;
			wp_enqueue_style( 'lunacco-core-app', $css_url, [], $css_version );
		}
	}

	private function mark_definitions_app_script_as_module(): void {
		wp_script_add_data( 'lunacco-core-app', 'type', 'module' );

		add_filter( 'script_loader_tag', static function ( string $tag, string $handle ): string {
			if ( 'lunacco-core-app' !== $handle || false !== strpos( $tag, ' type=' ) ) {
				return $tag;
			}

			return str_replace( '<script ', '<script type="module" ', $tag );
		}, 10, 2 );
	}

	// ------------------------------------------------------------------
	// Dashboard
	// ------------------------------------------------------------------

	public function page_dashboard(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1>LunaCco Core</h1>
			<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:20px;">
				<div class="card" style="padding:20px;">
					<h3>Credits &amp; Plans</h3>
					<p>Configure Fluent Cart product IDs and credit amounts.</p>
					<a class="button button-primary" href="?page=lunacco-cart">Open</a>
				</div>
				<div class="card" style="padding:20px;">
					<h3>Business Settings</h3>
					<p>Manage brand info, external links, and PDF settings.</p>
					<a class="button button-primary" href="?page=lunacco-business">Open</a>
				</div>
				<div class="card" style="padding:20px;">
					<h3>AI Integration</h3>
					<p>Set your OpenRouter key, pick a model, and configure your reader persona.</p>
					<a class="button button-primary" href="?page=lunacco-ai">Open</a>
				</div>
			</div>
		</div>
		<?php
	}

	public function page_definitions(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap" style="margin:0 0 0 -20px;">
			<div id="lunacco-app"></div>
		</div>
		<?php
	}

	// ------------------------------------------------------------------
	// Credits & Plans
	// ------------------------------------------------------------------

	public function page_cart(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$credits = lunacco_core()->credits();
		?>
		<div class="wrap">
			<h1>FluentCart Credit Settings</h1>

			<?php if ( isset( $_GET['rebuild_rows'] ) ) : ?>
				<div class="notice notice-success" style="margin:12px 0;">
					<p>Rebuilt balances using <strong><?php echo (int) $_GET['rebuild_rows']; ?></strong> ledger rows for user <strong><?php echo (int) ( $_GET['uid'] ?? 0 ); ?></strong>.</p>
				</div>
			<?php endif; ?>

			<?php if ( isset( $_GET['rebuilt_all_users'] ) ) : ?>
				<div class="notice notice-success" style="margin:12px 0;">
					<p>Rebuilt balances for <strong><?php echo (int) $_GET['rebuilt_all_users']; ?></strong> users using <strong><?php echo (int) ( $_GET['rebuilt_all_rows'] ?? 0 ); ?></strong> ledger rows.</p>
				</div>
			<?php endif; ?>

			<?php if ( isset( $_GET['credit_done'] ) ) : ?>
				<div class="notice notice-success" style="margin:12px 0;"><p>Credit adjustment applied.</p></div>
			<?php endif; ?>

			<form method="post" action="options.php">
				<?php settings_fields( 'lunacco_cart' ); ?>

				<h2>Reading Credits (Product #<?php echo esc_html( get_option( 'lt_reading_product_id', 18 ) ); ?>)</h2>
				<table class="form-table">
					<tr>
						<th>Reading Credits Product ID</th>
						<td><input type="number" name="lt_reading_product_id" value="<?php echo esc_attr( get_option( 'lt_reading_product_id', 18 ) ); ?>" /></td>
					</tr>
					<tr>
						<th>Variation 1 ID</th>
						<td><input type="number" name="lt_reading_var_1_id" value="<?php echo esc_attr( get_option( 'lt_reading_var_1_id', 1 ) ); ?>" /></td>
					</tr>
					<tr>
						<th>Variation 1 Credits</th>
						<td><input type="number" name="lt_reading_var_1_credits" value="<?php echo esc_attr( get_option( 'lt_reading_var_1_credits', 5 ) ); ?>" /> <small>(e.g. 5 credits)</small></td>
					</tr>
					<tr>
						<th>Variation 2 ID</th>
						<td><input type="number" name="lt_reading_var_2_id" value="<?php echo esc_attr( get_option( 'lt_reading_var_2_id', 2 ) ); ?>" /></td>
					</tr>
					<tr>
						<th>Variation 2 Credits</th>
						<td><input type="number" name="lt_reading_var_2_credits" value="<?php echo esc_attr( get_option( 'lt_reading_var_2_credits', 15 ) ); ?>" /></td>
					</tr>
					<tr>
						<th>Variation 3 ID</th>
						<td><input type="number" name="lt_reading_var_3_id" value="<?php echo esc_attr( get_option( 'lt_reading_var_3_id', 3 ) ); ?>" /></td>
					</tr>
					<tr>
						<th>Variation 3 Credits</th>
						<td><input type="number" name="lt_reading_var_3_credits" value="<?php echo esc_attr( get_option( 'lt_reading_var_3_credits', 30 ) ); ?>" /></td>
					</tr>
					<tr>
						<th>Variation 4 ID</th>
						<td><input type="number" name="lt_reading_var_4_id" value="<?php echo esc_attr( get_option( 'lt_reading_var_4_id', 4 ) ); ?>" /></td>
					</tr>
					<tr>
						<th>Variation 4 Credits</th>
						<td><input type="number" name="lt_reading_var_4_credits" value="<?php echo esc_attr( get_option( 'lt_reading_var_4_credits', 60 ) ); ?>" /></td>
					</tr>
				</table>

				<h2>Subscription (Product #<?php echo esc_html( get_option( 'lt_sub_product_id', 20 ) ); ?>)</h2>
				<table class="form-table">
					<tr>
						<th>Subscription Product ID</th>
						<td><input type="number" name="lt_sub_product_id" value="<?php echo esc_attr( get_option( 'lt_sub_product_id', 20 ) ); ?>" /></td>
					</tr>
					<tr>
						<th>Monthly Variation ID</th>
						<td><input type="number" name="lt_sub_monthly_var_id" value="<?php echo esc_attr( get_option( 'lt_sub_monthly_var_id', 1 ) ); ?>" /></td>
					</tr>
					<tr>
						<th>Variation 1 – Monthly Credits</th>
						<td><input type="number" name="lt_sub_monthly_credits" value="<?php echo esc_attr( get_option( 'lt_sub_monthly_credits', 100 ) ); ?>" /></td>
					</tr>
					<tr>
						<th>Annual Variation ID</th>
						<td><input type="number" name="lt_sub_annual_var_id" value="<?php echo esc_attr( get_option( 'lt_sub_annual_var_id', 2 ) ); ?>" /></td>
					</tr>
					<tr>
						<th>Variation 2 – Annual Credits</th>
						<td><input type="number" name="lt_sub_annual_credits" value="<?php echo esc_attr( get_option( 'lt_sub_annual_credits', 1200 ) ); ?>" /></td>
					</tr>
					<tr>
						<th>Daily Free Reading Limit (no credits)</th>
						<td><input type="number" min="0" name="lt_daily_free_limit" value="<?php echo esc_attr( get_option( 'lt_daily_free_limit', 2 ) ); ?>" /></td>
					</tr>
					<tr>
						<th>Free Account Starting Credits</th>
						<td>
							<input type="number" min="0" name="lt_free_account_credit_amount" value="<?php echo esc_attr( get_option( 'lt_free_account_credit_amount', 3 ) ); ?>" />
							<p class="description">Credits granted to a newly created free account.</p>
						</td>
					</tr>
					<tr>
						<th>Free Account Credit Schedule</th>
						<td>
							<?php $free_account_mode = $credits->get_signup_credit_mode(); ?>
							<select name="lt_free_account_credit_mode">
								<option value="one_time" <?php selected( $free_account_mode, 'one_time' ); ?>>One-time starter credits</option>
								<option value="monthly"  <?php selected( $free_account_mode, 'monthly' ); ?>>Monthly allowance reset</option>
							</select>
							<p class="description">One-time gives a starter pack that does not expire. Monthly resets the free-account allowance each month without rollover.</p>
						</td>
					</tr>
				</table>

				<?php submit_button( 'Save Credits Settings' ); ?>
			</form>

			<hr>
			<h2>Sync Existing FluentCart Orders</h2>
			<p>Use this to backfill credits for completed/paid FluentCart orders for a specific WordPress user.</p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="lt_sync_fc_orders">
				<?php wp_nonce_field( 'lt_sync_fc' ); ?>
				<table class="form-table">
					<tr>
						<th>User ID</th>
						<td><input type="number" name="user_id" /></td>
					</tr>
				</table>
				<?php submit_button( 'Sync Credits by User' ); ?>
			</form>

			<?php if ( isset( $_GET['synced'] ) ) : ?>
				<div class="notice notice-success" style="margin-top:12px;">
					<p>Synced <strong><?php echo (int) $_GET['synced']; ?></strong> ledger entries for user <strong><?php echo (int) ( $_GET['uid'] ?? 0 ); ?></strong>.</p>
				</div>
			<?php endif; ?>

			<hr>
			<h2>Rebuild Balances From Ledger</h2>
			<p>Use this if a user history is correct but their current visible balance is not. This recalculates remaining balances from the ledger and will not re-grant already used credits.</p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="lt_rebuild_credit_balance">
				<?php wp_nonce_field( 'lt_rebuild_credit_balance' ); ?>
				<table class="form-table">
					<tr>
						<th>User ID</th>
						<td><input type="number" name="user_id" /></td>
					</tr>
				</table>
				<?php submit_button( 'Rebuild User Balance' ); ?>
			</form>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin-top:16px;">
				<input type="hidden" name="action" value="lt_rebuild_all_credit_balances">
				<?php wp_nonce_field( 'lt_rebuild_all_credit_balances' ); ?>
				<?php submit_button( 'Rebuild All User Balances', 'secondary' ); ?>
			</form>

			<hr>
			<h2>Manual Credit Adjustment (Debug)</h2>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="lt_manual_credit">
				<?php wp_nonce_field( 'lt_manual_credit' ); ?>
				<table class="form-table">
					<tr>
						<th>User ID</th>
						<td><input type="number" name="user_id" /></td>
					</tr>
					<tr>
						<th>Amount (+/-)</th>
						<td><input type="number" name="amount" /></td>
					</tr>
					<tr>
						<th>Reason</th>
						<td><input type="text" name="reason" value="manual_admin" /></td>
					</tr>
				</table>
				<?php submit_button( 'Apply Credits' ); ?>
			</form>

			<?php
			/**
			 * Fires at the bottom of the Credits & Plans admin page.
			 * Modules can hook here to add their own credit/limit settings sections.
			 */
			do_action( 'lunacco_admin_cart_extra_sections' );
			?>
		</div>
		<?php
	}

	// ------------------------------------------------------------------
	// User Credit History
	// ------------------------------------------------------------------

	public function page_credit_history(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$credits          = lunacco_core()->credits();
		$ledger           = $credits->get_ledger();
		$selected_user_id = (int) ( $_GET['user_id'] ?? 0 );
		$search           = sanitize_text_field( (string) ( $_GET['s'] ?? '' ) );
		$users            = $ledger->fetch_admin_user_summaries( $search, 100 );
		?>
		<div class="wrap">
			<h1>User Credit History</h1>
			<form method="get" style="margin:16px 0;display:flex;gap:8px;align-items:center;">
				<input type="hidden" name="page" value="lunacco-credit-history" />
				<input type="search" name="s" value="<?php echo esc_attr( $search ); ?>" placeholder="Search by user ID, email, name" class="regular-text" />
				<?php submit_button( 'Search', 'secondary', '', false ); ?>
			</form>

			<table class="widefat striped">
				<thead>
					<tr>
						<th>User ID</th>
						<th>Name</th>
						<th>Email</th>
						<th>Membership</th>
						<th>Purchased</th>
						<th>Current Balance</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					<?php if ( empty( $users ) ) : ?>
						<tr><td colspan="7">No users found.</td></tr>
					<?php else : ?>
						<?php foreach ( $users as $row ) : ?>
							<tr>
								<td><?php echo (int) $row['user_id']; ?></td>
								<td><?php echo esc_html( $row['name'] ?: $row['username'] ); ?></td>
								<td><?php echo esc_html( $row['email'] ); ?></td>
								<td><?php echo (int) $row['membership_balance']; ?></td>
								<td><?php echo (int) $row['purchased_balance']; ?></td>
								<td><strong><?php echo (int) $row['current_balance']; ?></strong></td>
								<td><a class="button button-secondary" href="<?php echo esc_url( admin_url( 'admin.php?page=lunacco-credit-history&user_id=' . (int) $row['user_id'] ) ); ?>">View Details</a></td>
							</tr>
						<?php endforeach; ?>
					<?php endif; ?>
				</tbody>
			</table>

			<?php if ( $selected_user_id > 0 ) :
				$detail_rows   = $ledger->build_display_rows( $ledger->fetch_user_history_rows( $selected_user_id, 250 ) );
				$monthly       = $ledger->build_monthly_summary( $selected_user_id );
				$selected_user = get_user_by( 'id', $selected_user_id );
				?>
				<div class="card" style="margin-top:20px;padding:20px;max-width:none;">
					<h2 style="margin-top:0;">History for <?php echo esc_html( $selected_user ? ( $selected_user->display_name ?: $selected_user->user_login ) : ( 'User #' . $selected_user_id ) ); ?></h2>
					<p style="margin-top:0;">Current balance: <strong><?php echo (int) $credits->get_total_balance( $selected_user_id ); ?></strong></p>

					<h3>Monthly Summary</h3>
					<table class="widefat striped" style="margin-bottom:20px;">
						<thead>
							<tr>
								<th>Month</th>
								<th>Membership +</th>
								<th>Purchased +</th>
								<th>Refunds +</th>
								<th>Used -</th>
								<th>Adjustments</th>
							</tr>
						</thead>
						<tbody>
							<?php if ( empty( $monthly ) ) : ?>
								<tr><td colspan="6">No monthly summary available.</td></tr>
							<?php else : ?>
								<?php foreach ( $monthly as $month ) : ?>
									<tr>
										<td><?php echo esc_html( $month['month_label'] ); ?></td>
										<td><?php echo (int) $month['membership_added']; ?></td>
										<td><?php echo (int) $month['purchased_added']; ?></td>
										<td><?php echo (int) $month['refunds']; ?></td>
										<td><?php echo (int) $month['credits_used']; ?></td>
										<td><?php echo (int) $month['adjustments']; ?></td>
									</tr>
								<?php endforeach; ?>
							<?php endif; ?>
						</tbody>
					</table>

					<h3>Detailed Ledger</h3>
					<table class="widefat striped">
						<thead>
							<tr>
								<th>Date</th>
								<th>Type</th>
								<th>Bucket</th>
								<th>Amount</th>
								<th>Reference</th>
							</tr>
						</thead>
						<tbody>
							<?php if ( empty( $detail_rows ) ) : ?>
								<tr><td colspan="5">No ledger rows found.</td></tr>
							<?php else : ?>
								<?php foreach ( $detail_rows as $detail ) : ?>
									<tr>
										<td><?php echo esc_html( $detail['date_label'] ); ?></td>
										<td><?php echo esc_html( $detail['action_label'] ); ?></td>
										<td><?php echo esc_html( $detail['bucket'] ); ?></td>
										<td><?php echo esc_html( $detail['amount_label'] ); ?></td>
										<td><?php echo esc_html( $detail['reference_label'] ); ?></td>
									</tr>
								<?php endforeach; ?>
							<?php endif; ?>
						</tbody>
					</table>
				</div>
			<?php endif; ?>
		</div>
		<?php
	}

	// ------------------------------------------------------------------
	// Business Settings
	// ------------------------------------------------------------------

	public function page_business(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$logo_url = esc_url( get_option( 'lt_app_header_logo_url', '' ) );
		?>
		<div class="wrap">
			<h1>Business &amp; Brand Settings</h1>
			<form method="post" action="options.php">
				<?php settings_fields( 'lunacco_business' ); ?>

				<h2>App Configuration</h2>
				<table class="form-table">
					<tr>
						<th>Buy Credits Link</th>
						<td><input type="url" class="regular-text" name="lt_buy_credits_url" value="<?php echo esc_attr( get_option( 'lt_buy_credits_url', '' ) ); ?>" placeholder="https://..." /></td>
					</tr>
					<tr>
						<th>Become Member Link</th>
						<td><input type="url" class="regular-text" name="lt_become_member_url" value="<?php echo esc_attr( get_option( 'lt_become_member_url', '' ) ); ?>" placeholder="https://..." /></td>
					</tr>
					<tr>
						<th>Return to Main Page URL</th>
						<td>
							<input type="url" class="regular-text" name="lt_return_main_url" value="<?php echo esc_attr( get_option( 'lt_return_main_url', '' ) ); ?>" placeholder="https://..." />
							<p class="description">Shown as the header brand link in the app.</p>
						</td>
					</tr>
					<tr>
						<th>App Header Name</th>
						<td>
							<input type="text" class="regular-text" name="lt_app_header_title" value="<?php echo esc_attr( get_option( 'lt_app_header_title', 'Cosmic Oracle' ) ); ?>" placeholder="Cosmic Oracle" />
							<p class="description">Used when no logo URL is set.</p>
						</td>
					</tr>
					<tr>
						<th>External Main Link Label</th>
						<td>
							<input type="text" class="regular-text" name="lt_nav_return_main_label" value="<?php echo esc_attr( get_option( 'lt_nav_return_main_label', 'Home' ) ); ?>" placeholder="Home" />
							<p class="description">Label for the external link that returns to the main site.</p>
						</td>
					</tr>
					<tr>
						<th>Deck Picker Label</th>
						<td>
							<input type="text" class="regular-text" name="lt_nav_pick_label" value="<?php echo esc_attr( get_option( 'lt_nav_pick_label', 'Pick' ) ); ?>" placeholder="Pick" />
							<p class="description">Label for the in-app home/deck picker view.</p>
						</td>
					</tr>
					<tr>
						<th>Disable Auth Modal</th>
						<td>
							<input type="hidden" name="lt_disable_auth_modal" value="0" />
							<label>
								<input type="checkbox" name="lt_disable_auth_modal" value="1" <?php checked( get_option( 'lt_disable_auth_modal', '0' ), '1' ); ?> />
								Route auth button clicks to a dedicated page URL instead of opening the in-app modal
							</label>
							<p class="description">Use when you want to send users to a standalone login page.</p>
						</td>
					</tr>
					<tr>
						<th>Dedicated Auth Page URL</th>
						<td>
							<input type="url" class="regular-text" name="lt_auth_page_url" value="<?php echo esc_attr( get_option( 'lt_auth_page_url', '' ) ); ?>" placeholder="https://..." />
							<p class="description">When auth modals are disabled, login and sign-up actions will redirect here.</p>
						</td>
					</tr>
					<tr>
						<th>App Header Logo</th>
						<td>
							<input type="hidden" id="lt_app_header_logo_url" name="lt_app_header_logo_url" value="<?php echo esc_attr( $logo_url ); ?>" />
							<button type="button" class="button" id="lt-logo-picker-btn">Choose Logo</button>
							<button type="button" class="button" id="lt-logo-clear-btn">Clear</button>
							<p class="description">Uses the WordPress Media Library. This logo can also be reused in PDF reports.</p>
							<div id="lt-logo-preview-wrap" style="margin-top:10px;<?php echo $logo_url ? '' : 'display:none;'; ?>">
								<img id="lt-logo-preview" src="<?php echo esc_url( $logo_url ); ?>" alt="Logo Preview" style="max-height:56px;width:auto;border:1px solid #d0d0d7;border-radius:6px;padding:4px;background:#fff;" />
							</div>
						</td>
					</tr>
					<tr>
						<th>"Don't know your birth time?" Link</th>
						<td>
							<input type="url" class="regular-text" name="lt_birth_time_help_url" value="<?php echo esc_attr( get_option( 'lt_birth_time_help_url', '' ) ); ?>" placeholder="https://… (page explaining how to find a birth time)" />
							<p class="description">Shown as a help link in the "Complete your profile" birth-time field. Point it at a page that explains where to find a birth time (birth certificate, hospital records, family) and the rectification process. Leave blank to hide the link.</p>
						</td>
					</tr>
					<tr>
						<th>Footer Disclaimer</th>
						<td>
							<textarea name="lt_footer_disclaimer" rows="3" class="large-text"><?php echo esc_textarea( get_option( 'lt_footer_disclaimer', 'For entertainment purposes only. Some reports may use AI to help with assembly and personalization.' ) ); ?></textarea>
						</td>
					</tr>
				</table>

				<h2>Footer Links &amp; Legal</h2>
				<p class="description" style="margin-bottom:8px;">These appear in the small footer section at the bottom of each app page. Leave any URL blank to hide that link.</p>
				<table class="form-table">
					<tr>
						<th>Footer Copyright / Attribution Text</th>
						<td>
							<textarea name="lt_footer_copyright_text" rows="3" class="large-text" placeholder="© Year Company. Ephemeris calculations © Astrodienst AG · Swiss Ephemeris…"><?php echo esc_textarea( get_option( 'lt_footer_copyright_text', '' ) ); ?></textarea>
							<p class="description">Shown at the bottom of the dashboard and chart pages (AGPL modules). Include your copyright + any required Swiss Ephemeris / AGPL attribution. Leave blank to fall back to the standard copyright line.</p>
						</td>
					</tr>
					<tr>
						<th>Tarot Footer Text</th>
						<td>
							<textarea name="lt_footer_copyright_text_tarot" rows="3" class="large-text" placeholder="© Year Company. All rights reserved."><?php echo esc_textarea( get_option( 'lt_footer_copyright_text_tarot', '' ) ); ?></textarea>
							<p class="description">Shown on tarot pages instead of the text above (tarot is not an AGPL module, so it needs no Swiss Ephemeris / source attribution). Leave blank to fall back to the standard copyright line.</p>
						</td>
					</tr>
					<tr>
						<th>Privacy Policy URL</th>
						<td><input type="url" class="regular-text" name="lt_link_privacy" value="<?php echo esc_attr( get_option( 'lt_link_privacy', '' ) ); ?>" placeholder="https://…" /></td>
					</tr>
					<tr>
						<th>Terms &amp; Conditions URL</th>
						<td><input type="url" class="regular-text" name="lt_link_terms" value="<?php echo esc_attr( get_option( 'lt_link_terms', '' ) ); ?>" placeholder="https://…" /></td>
					</tr>
					<tr>
						<th>Refund Policy URL</th>
						<td><input type="url" class="regular-text" name="lt_link_refund" value="<?php echo esc_attr( get_option( 'lt_link_refund', '' ) ); ?>" placeholder="https://…" /></td>
					</tr>
					<tr>
						<th>Disclaimer Page URL</th>
						<td>
							<input type="url" class="regular-text" name="lt_link_disclaimer" value="<?php echo esc_attr( get_option( 'lt_link_disclaimer', '' ) ); ?>" placeholder="https://…" />
							<p class="description">Optional full disclaimer page (separate from the short disclaimer text above).</p>
						</td>
					</tr>
					<tr>
						<th>AGPL Source / GitHub URL</th>
						<td>
							<input type="url" class="regular-text" name="lt_agpl_source_url" value="<?php echo esc_attr( get_option( 'lt_agpl_source_url', '' ) ); ?>" placeholder="https://github.com/…" />
							<p class="description"><strong>AGPL compliance:</strong> the public source repository for the AGPL modules (AstroHD + Core). This link is shown to all end users in the footer so they can access the source. Required for compliance until a Swiss Ephemeris pro license removes the AGPL obligation.</p>
						</td>
					</tr>
				</table>

				<h2>PDF Branding</h2>
				<table class="form-table">
					<tr>
						<th>Use Header Logo in PDF</th>
						<td>
							<input type="hidden" name="lt_pdf_use_header_logo" value="0" />
							<label>
								<input type="checkbox" name="lt_pdf_use_header_logo" value="1" <?php checked( get_option( 'lt_pdf_use_header_logo', '1' ), '1' ); ?> />
								Include the same header logo at the top of PDF reports
							</label>
						</td>
					</tr>
					<tr>
						<th>Copyright Company</th>
						<td><input type="text" class="regular-text" name="lt_pdf_copyright_company" value="<?php echo esc_attr( get_option( 'lt_pdf_copyright_company', 'Cosmic Oracle' ) ); ?>" placeholder="Cosmic Oracle" /></td>
					</tr>
					<tr>
						<th>Copyright Year</th>
						<td><input type="number" min="1900" max="2999" name="lt_pdf_copyright_year" value="<?php echo esc_attr( (int) get_option( 'lt_pdf_copyright_year', (int) gmdate( 'Y' ) ) ); ?>" /></td>
					</tr>
					<tr>
						<th>Custom Copyright Notice (Optional)</th>
						<td><textarea name="lt_pdf_copyright_notice_custom" rows="3" class="large-text" placeholder="If blank, defaults to © Year Company. All rights reserved."><?php echo esc_textarea( get_option( 'lt_pdf_copyright_notice_custom', '' ) ); ?></textarea></td>
					</tr>
				</table>

				<p><a class="button" href="<?php echo esc_url( admin_url( 'admin.php?page=lunacco-security' ) ); ?>">Manage Security &amp; Access &rarr;</a></p>

				<?php submit_button( 'Save Business Settings' ); ?>
			</form>
		</div>
		<?php
	}

	// ------------------------------------------------------------------
	// Security & Access
	// ------------------------------------------------------------------

	public function page_security(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap" style="margin:0 0 0 -20px;">
			<div id="lunacco-app"></div>
		</div>
		<?php
	}

	// ------------------------------------------------------------------
	// AI Settings
	// ------------------------------------------------------------------

	public function page_ai(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$ai                          = lunacco_core()->ai();
		$key_saved                   = ! empty( get_option( 'lt_openrouter_key_enc' ) );
		$key_plain                   = $key_saved ? $ai->decrypt( (string) get_option( 'lt_openrouter_key_enc', '' ) ) : '';
		$key_tail                    = $key_plain ? substr( $key_plain, -6 ) : '';
		$cached_models               = get_option( 'lt_ai_models_cache', [] );
		$cached_models               = is_array( $cached_models ) ? $cached_models : [];
		$cached_updated_at           = (string) get_option( 'lt_ai_models_cache_updated_at', '' );
		$report_base_cost            = max( 0, (int) get_option( 'lt_ai_report_base_cost', 1 ) );
		$lens_default_cost           = max( 0, (int) get_option( 'lt_ai_lens_default_cost', 1 ) );
		$generation_logging_enabled  = $ai->is_generation_logging_enabled();
		$lens_profile_source_options = $ai->get_lens_profile_source_options();

		// Build persona rows for the repeater UI.
		$persona_rows = [];
		$raw_persona  = get_option( 'lt_ai_persona_prompts', '' );
		$parsed_json  = json_decode( $raw_persona, true );
		$catalog      = [];

		if ( is_array( $parsed_json ) ) {
			foreach ( $parsed_json as $entry ) {
				if ( is_array( $entry ) ) {
					$key = sanitize_key( $entry['key'] ?? '' );
					if ( $key !== '' ) {
						$catalog[ $key ] = [
							'label'          => sanitize_text_field( $entry['label'] ?? $key ),
							'type'           => sanitize_key( $entry['type'] ?? 'focus' ),
							'prompt'         => trim( (string) ( $entry['prompt'] ?? '' ) ),
							'profile_source' => sanitize_key( $entry['profile_source'] ?? '' ),
						];
					}
				}
			}
		} else {
			foreach ( preg_split( '/\r\n|\r|\n/', $raw_persona ) as $line ) {
				$line = trim( (string) $line );
				if ( $line === '' || strpos( $line, ':' ) === false ) {
					continue;
				}
				[ $k, $v ] = array_map( 'trim', explode( ':', $line, 2 ) );
				$clean_key = sanitize_key( $k );
				if ( $clean_key !== '' && $v !== '' ) {
					$catalog[ $clean_key ] = [
						'label'  => ucwords( str_replace( [ '-', '_' ], ' ', $clean_key ) ),
						'type'   => 'focus',
						'prompt' => $v,
					];
				}
			}
		}

		foreach ( $catalog as $persona_key => $persona_data ) {
			$persona_rows[] = [
				'key'            => $persona_key,
				'label'          => $persona_data['label'] ?? ucwords( str_replace( [ '-', '_' ], ' ', $persona_key ) ),
				'type'           => $persona_data['type'] ?? 'focus',
				'prompt'         => $persona_data['prompt'] ?? '',
				'profile_source' => sanitize_key( $persona_data['profile_source'] ?? '' ),
			];
		}

		// Build numerology persona rows.
		$num_persona_rows = [];
		$raw_num_persona  = get_option( 'lt_ai_numerology_persona_prompts', '' );
		$parsed_num_json  = json_decode( $raw_num_persona, true );

		if ( is_array( $parsed_num_json ) ) {
			foreach ( $parsed_num_json as $entry ) {
				if ( is_array( $entry ) ) {
					$key = sanitize_key( $entry['key'] ?? '' );
					if ( $key !== '' ) {
						$num_persona_rows[] = [
							'key'            => $key,
							'label'          => sanitize_text_field( $entry['label'] ?? $key ),
							'type'           => sanitize_key( $entry['type'] ?? 'focus' ),
							'prompt'         => trim( (string) ( $entry['prompt'] ?? '' ) ),
							'profile_source' => sanitize_key( $entry['profile_source'] ?? '' ),
						];
					}
				}
			}
		}
		?>
		<div class="wrap">
			<h1>AI Integration Settings</h1>

			<?php
			$ai_tab = sanitize_key( $_GET['ai_tab'] ?? 'general' );
			$tabs   = [
				'general'     => 'General / Models',
				'tarot'       => 'Tarot',
				'numerology'  => 'Numerology',
			];
			?>
			<nav class="nav-tab-wrapper" style="margin-bottom:20px;">
				<?php foreach ( $tabs as $slug => $label ) : ?>
					<a href="?page=lunacco-ai&ai_tab=<?php echo esc_attr( $slug ); ?>"
					   class="nav-tab <?php echo $ai_tab === $slug ? 'nav-tab-active' : ''; ?>">
						<?php echo esc_html( $label ); ?>
					</a>
				<?php endforeach; ?>
			</nav>

			<?php if ( $ai_tab === 'general' ) : ?>

			<div class="card" style="padding:20px;max-width:900px;margin-bottom:24px;">
				<h2>OpenRouter API Key</h2>
				<p>Your key is stored encrypted using AES-256 server-side. It is never exposed in the frontend.</p>
				<?php if ( $key_saved ) : ?>
					<p class="notice notice-success" style="padding:8px 12px;">API Key is saved and encrypted (<?php echo esc_html( str_repeat( '•', 12 ) . $key_tail ); ?>).</p>
				<?php endif; ?>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
					<input type="hidden" name="action" value="lt_save_api_key">
					<?php wp_nonce_field( 'lt_save_api_key' ); ?>
					<table class="form-table">
						<tr>
							<th>API Key</th>
							<td>
								<input type="password" name="lt_openrouter_key" value="" class="regular-text" placeholder="sk-or-v1-..." autocomplete="off" />
								<p class="description">Leave blank to keep existing key.</p>
							</td>
						</tr>
					</table>
					<?php submit_button( 'Save &amp; Encrypt Key' ); ?>
				</form>

				<hr>
				<h3>Validate &amp; Browse Models</h3>
				<p>Test your key, fetch current OpenRouter models, and pin favorites to the top.</p>
				<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
					<button class="button" id="lt-test-connection">Test Connection</button>
					<button class="button button-primary" id="lt-load-models">Refresh Models</button>
					<span id="lt-conn-status" style="font-weight:600;"></span>
				</div>

				<div id="lt-models-wrap" style="margin-top:16px;">
					<label for="lt_ai_model_select" style="display:block;margin-bottom:6px;font-weight:600;">Selected Model</label>
					<select id="lt_ai_model_select" style="width:100%;max-width:700px;margin-bottom:10px;"></select>
					<input type="hidden" id="lt_ai_model_preview" value="<?php echo esc_attr( get_option( 'lt_ai_model', 'openai/gpt-4o-mini' ) ); ?>" />
					<input type="text" id="lt-model-search" placeholder="Search models…" style="width:100%;margin-bottom:8px;" />
					<div id="lt-models-list" style="max-height:400px;overflow-y:auto;border:1px solid #ccc;border-radius:4px;"></div>
				</div>
			</div>

			<form method="post" action="options.php">
				<?php settings_fields( 'lunacco_ai' ); ?>
				<input type="hidden" name="lt_ai_model" id="lt_ai_model" value="<?php echo esc_attr( get_option( 'lt_ai_model', 'openai/gpt-4o-mini' ) ); ?>" />

				<div class="card" style="padding:20px;max-width:900px;margin-bottom:24px;">
					<h2>Favorite Models</h2>
					<p>Use the ★ in the model list to pin favorites. This input is auto-managed.</p>
					<table class="form-table">
						<tr>
							<th>Favorites</th>
							<td>
								<input type="text" id="lt_ai_favorite_models" name="lt_ai_favorite_models" value="<?php echo esc_attr( get_option( 'lt_ai_favorite_models', '' ) ); ?>" class="large-text" />
								<div id="lt-favorites-cards" style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;"></div>
							</td>
						</tr>
					</table>
				</div>

				<div class="card" style="padding:20px;max-width:900px;margin-bottom:24px;">
					<h2>General Settings</h2>
					<table class="form-table">
						<tr>
							<th>Base Report Credit Cost</th>
							<td>
								<input type="number" min="0" name="lt_ai_report_base_cost" value="<?php echo esc_attr( $report_base_cost ); ?>" />
								<p class="description">Credits charged for report generation before any lens add-on.</p>
							</td>
						</tr>
						<tr>
							<th>Default Lens Add-on Cost</th>
							<td>
								<input type="number" min="0" name="lt_ai_lens_default_cost" value="<?php echo esc_attr( $lens_default_cost ); ?>" />
								<p class="description">Fallback additional credits when a selected lens does not define a custom cost.</p>
							</td>
						</tr>
						<tr>
							<th>Generation Debug Logging</th>
							<td>
								<label style="display:inline-flex;align-items:center;gap:8px;">
									<input type="hidden" name="lt_ai_generation_logging_enabled" value="0" />
									<input type="checkbox" name="lt_ai_generation_logging_enabled" value="1" <?php checked( $generation_logging_enabled ); ?> />
									<span>Enable request/response logging for reports (success + failure)</span>
								</label>
								<p class="description">Recommended for temporary debugging. Disable when not troubleshooting.</p>
							</td>
						</tr>
					</table>
				</div>

				<?php submit_button( 'Save Settings' ); ?>
			</form>

			<?php elseif ( $ai_tab === 'tarot' ) : ?>

			<form method="post" action="options.php">
				<?php settings_fields( 'lunacco_ai' ); ?>
				<input type="hidden" name="lt_ai_model" id="lt_ai_model" value="<?php echo esc_attr( get_option( 'lt_ai_model', 'openai/gpt-4o-mini' ) ); ?>" />
				<input type="hidden" name="lt_ai_report_base_cost"          value="<?php echo esc_attr( $report_base_cost ); ?>" />
				<input type="hidden" name="lt_ai_lens_default_cost"          value="<?php echo esc_attr( $lens_default_cost ); ?>" />
				<input type="hidden" name="lt_ai_generation_logging_enabled" value="<?php echo esc_attr( get_option( 'lt_ai_generation_logging_enabled', '0' ) ); ?>" />
				<input type="hidden" name="lt_ai_favorite_models"            value="<?php echo esc_attr( get_option( 'lt_ai_favorite_models', '' ) ); ?>" id="lt_ai_favorite_models" />

				<div class="card" style="padding:20px;max-width:900px;margin-bottom:24px;">
					<h2>Tarot Prompt Configuration</h2>
					<table class="form-table">
						<tr>
							<th style="width:200px;">Tarot Reading System Prompt</th>
							<td>
								<textarea name="lt_ai_system_prompt" rows="8" class="large-text"><?php echo esc_textarea( get_option( 'lt_ai_system_prompt', 'You are an expert Tarot Reader.' ) ); ?></textarea>
								<p class="description">Included in all tarot reading AI calls.</p>
							</td>
						</tr>
						<tr>
							<th>Deck AI System Prompt</th>
							<td>
								<textarea name="lt_ai_deck_system_prompt" rows="6" class="large-text"><?php echo esc_textarea( get_option( 'lt_ai_deck_system_prompt', 'You are an expert tarot and oracle deck editor. Return JSON only. Preserve each requested card name exactly.' ) ); ?></textarea>
								<p class="description">Used only for deck AI generation in the admin deck manager.</p>
							</td>
						</tr>
						<tr>
							<th>Optional Persona Prompts</th>
							<td>
								<textarea id="lt_ai_persona_prompts" name="lt_ai_persona_prompts" rows="2" class="large-text" style="display:none;"><?php echo esc_textarea( wp_json_encode( $persona_rows ) ); ?></textarea>
								<div id="lt-persona-list" style="display:flex;flex-direction:column;gap:12px;"></div>
								<button type="button" id="lt-add-persona-row" class="button" style="margin-top:10px;">+ Add Persona</button>
								<p class="description">Optional modifiers (Tone, Focus, Lenses) selectable when generating a reading.</p>
							</td>
						</tr>
					</table>
				</div>

				<?php submit_button( 'Save Tarot Settings' ); ?>
			</form>

			<?php elseif ( $ai_tab === 'numerology' ) : ?>

			<form method="post" action="options.php">
				<?php settings_fields( 'lunacco_ai' ); ?>
				<input type="hidden" name="lt_ai_model" id="lt_ai_model" value="<?php echo esc_attr( get_option( 'lt_ai_model', 'openai/gpt-4o-mini' ) ); ?>" />
				<input type="hidden" name="lt_ai_report_base_cost"          value="<?php echo esc_attr( $report_base_cost ); ?>" />
				<input type="hidden" name="lt_ai_lens_default_cost"          value="<?php echo esc_attr( $lens_default_cost ); ?>" />
				<input type="hidden" name="lt_ai_generation_logging_enabled" value="<?php echo esc_attr( get_option( 'lt_ai_generation_logging_enabled', '0' ) ); ?>" />
				<input type="hidden" name="lt_ai_favorite_models"            value="<?php echo esc_attr( get_option( 'lt_ai_favorite_models', '' ) ); ?>" id="lt_ai_favorite_models" />
				<input type="hidden" name="lt_ai_system_prompt"              value="<?php echo esc_attr( get_option( 'lt_ai_system_prompt', '' ) ); ?>" />
				<input type="hidden" name="lt_ai_deck_system_prompt"         value="<?php echo esc_attr( get_option( 'lt_ai_deck_system_prompt', '' ) ); ?>" />
				<input type="hidden" name="lt_ai_persona_prompts"            value="<?php echo esc_attr( wp_json_encode( $persona_rows ) ); ?>" />
				<input type="hidden" name="lt_ai_numerology_persona_prompts" value="<?php echo esc_attr( wp_json_encode( $num_persona_rows ) ); ?>" id="lt_ai_numerology_persona_prompts" />

				<div class="card" style="padding:20px;max-width:900px;margin-bottom:24px;">
					<h2>Numerology Prompt Configuration</h2>
					<table class="form-table">
						<tr>
							<th style="width:200px;">Reading &amp; Report System Prompt</th>
							<td>
								<textarea name="lt_ai_numerology_reading_prompt" rows="8" class="large-text"><?php echo esc_textarea( get_option( 'lt_ai_numerology_reading_prompt', 'You are an expert numerologist and intuitive guide. Provide insightful, empowering readings that connect the numbers to the person\'s lived experience.' ) ); ?></textarea>
								<p class="description">Main system prompt used for all numerology AI readings and reports.</p>
							</td>
						</tr>
						<tr>
							<th>Definition Helper — Fallback Prompt</th>
							<td>
								<textarea name="lt_ai_numerology_system_prompt" rows="4" class="large-text"><?php echo esc_textarea( get_option( 'lt_ai_numerology_system_prompt', 'You are an expert numerologist and spiritual teacher. Write clear, insightful definitions that empower the reader.' ) ); ?></textarea>
								<p class="description">Fallback prompt used in the Definitions editor when no type-specific prompt is set below.</p>
							</td>
						</tr>
						<tr>
							<th>Definition Prompt — Pythagorean</th>
							<td>
								<textarea name="lt_ai_num_def_prompt_pythagorean" rows="5" class="large-text"><?php echo esc_textarea( get_option( 'lt_ai_num_def_prompt_pythagorean', 'You are an expert Pythagorean numerologist and spiritual teacher. Write clear, grounded, insightful definitions that empower the reader. Focus on practical life wisdom and soul growth.' ) ); ?></textarea>
								<p class="description">System prompt used when generating definitions in the <strong>Pythagorean</strong> set type.</p>
							</td>
						</tr>
						<tr>
							<th>Definition Prompt — Name Arcana</th>
							<td>
								<textarea name="lt_ai_num_def_prompt_name_arcana" rows="5" class="large-text"><?php echo esc_textarea( get_option( 'lt_ai_num_def_prompt_name_arcana', 'You are an expert in Name Arcana numerology within the Aquarian Destiny Numerology (ADN) system. Write poetic, soul-centred definitions for name number positions. Focus on identity, soul expression, and life integration.' ) ); ?></textarea>
								<p class="description">System prompt used when generating definitions in the <strong>Name Arcana</strong> set type.</p>
							</td>
						</tr>
						<tr>
							<th>Definition Prompt — ADN Core 7</th>
							<td>
								<textarea name="lt_ai_num_def_prompt_adm_core7" rows="5" class="large-text"><?php echo esc_textarea( get_option( 'lt_ai_num_def_prompt_adm_core7', 'You are an expert in the Aquarian Destiny Numerology (ADN) Core 7 system. Write definitions for all 7 positions including the Money Flow channel (material abundance, flow, and financial karma) and the Relationship channel (love, intimacy, and relational karma). Write empowering, spiritually rich content.' ) ); ?></textarea>
								<p class="description">System prompt used when generating definitions in the <strong>ADN Core 7</strong> set type.</p>
							</td>
						</tr>
						<tr>
							<th>Persona Modifiers</th>
							<td>
								<textarea id="lt_ai_numerology_persona_prompts_field" rows="2" class="large-text" style="display:none;"><?php echo esc_textarea( wp_json_encode( $num_persona_rows ) ); ?></textarea>
								<div id="lt-num-persona-list" style="display:flex;flex-direction:column;gap:12px;"></div>
								<button type="button" id="lt-add-num-persona-row" class="button" style="margin-top:10px;">+ Add Persona</button>
								<p class="description">Optional tone, focus, or lens modifiers selectable when generating a numerology reading. Works the same as the Tarot personas.</p>
							</td>
						</tr>
					</table>
				</div>

				<?php submit_button( 'Save Numerology Settings' ); ?>
			</form>

			<script>
			(function ($) {
				var numPersonaRows = <?php echo wp_json_encode( $num_persona_rows ); ?> || [];
				var lensProfileSourceOptions = <?php echo wp_json_encode( $lens_profile_source_options ); ?> || {};

				function syncNumPersonaInput() {
					var normalized = numPersonaRows.map(function (row) {
						return {
							key: (row.key || '').trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '_'),
							label: (row.label || '').trim(),
							type: (row.type || 'focus').trim(),
							prompt: (row.prompt || '').trim(),
							profile_source: row.type === 'lens' ? (row.profile_source || '').trim() : ''
						};
					}).filter(function (row) { return row.label && row.prompt; });
					$('#lt_ai_numerology_persona_prompts').val(JSON.stringify(normalized));
				}

				function renderNumLensProfileSourceSelect(row) {
					if ((row.type || 'focus') !== 'lens') return '';
					var currentValue = row.profile_source || '';
					var html = '<div style="margin-top:8px;display:flex;align-items:center;gap:8px;">';
					html += '<label style="font-weight:600;min-width:110px;">Profile Source</label>';
					html += '<select class="lt-num-persona-profile-source"><option value="">Use key match</option>';
					Object.keys(lensProfileSourceOptions).forEach(function (key) {
						html += '<option value="' + key + '" ' + (currentValue === key ? 'selected' : '') + '>' + key + '</option>';
					});
					html += '</select></div>';
					return html;
				}

				function renderNumPersonaRows() {
					var $list = $('#lt-num-persona-list');
					$list.empty();
					numPersonaRows.forEach(function (row, idx) {
						var html = '<div class="lt-num-persona-row" data-idx="' + idx + '" style="background:#f6f7f7;border:1px solid #ddd;border-radius:6px;padding:14px;position:relative;">';
						html += '<button type="button" class="lt-num-persona-remove button-link" style="position:absolute;top:10px;right:10px;color:#d63638;" data-idx="' + idx + '">&#x2715; Remove</button>';
						html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:10px;">';
						html += '<div><label style="font-weight:600;display:block;margin-bottom:4px;">Key (slug)</label><input type="text" class="lt-num-persona-key regular-text" value="' + $('<div>').text(row.key || '').html() + '" /></div>';
						html += '<div><label style="font-weight:600;display:block;margin-bottom:4px;">Label</label><input type="text" class="lt-num-persona-label regular-text" value="' + $('<div>').text(row.label || '').html() + '" /></div>';
						html += '<div><label style="font-weight:600;display:block;margin-bottom:4px;">Type</label><select class="lt-num-persona-type"><option value="tone" ' + (row.type === 'tone' ? 'selected' : '') + '>Tone</option><option value="focus" ' + (row.type === 'focus' ? 'selected' : '') + '>Focus</option><option value="lens" ' + (row.type === 'lens' ? 'selected' : '') + '>Lens</option></select></div>';
						html += '</div>';
						html += '<div><label style="font-weight:600;display:block;margin-bottom:4px;">Prompt</label><textarea class="lt-num-persona-prompt large-text" rows="3">' + $('<div>').text(row.prompt || '').html() + '</textarea></div>';
						html += renderNumLensProfileSourceSelect(row);
						html += '</div>';
						$list.append(html);
					});
				}

				function bindNumPersonaEvents() {
					$(document).on('input', '.lt-num-persona-key, .lt-num-persona-label, .lt-num-persona-prompt', function () {
						var $row = $(this).closest('.lt-num-persona-row');
						var idx = parseInt($row.data('idx'), 10);
						var cls = $(this).attr('class').split(' ').find(c => c.startsWith('lt-num-persona-'));
						if (cls === 'lt-num-persona-key')    numPersonaRows[idx].key    = $(this).val();
						if (cls === 'lt-num-persona-label')  numPersonaRows[idx].label  = $(this).val();
						if (cls === 'lt-num-persona-prompt') numPersonaRows[idx].prompt = $(this).val();
						syncNumPersonaInput();
					});
					$(document).on('change', '.lt-num-persona-type', function () {
						var $row = $(this).closest('.lt-num-persona-row');
						var idx = parseInt($row.data('idx'), 10);
						numPersonaRows[idx].type = $(this).val();
						syncNumPersonaInput();
						renderNumPersonaRows(); bindNumPersonaEvents();
					});
					$(document).on('change', '.lt-num-persona-profile-source', function () {
						var $row = $(this).closest('.lt-num-persona-row');
						var idx = parseInt($row.data('idx'), 10);
						numPersonaRows[idx].profile_source = $(this).val();
						syncNumPersonaInput();
					});
					$(document).on('click', '.lt-num-persona-remove', function () {
						var idx = parseInt($(this).data('idx'), 10);
						numPersonaRows.splice(idx, 1);
						syncNumPersonaInput();
						renderNumPersonaRows(); bindNumPersonaEvents();
					});
				}

				$('#lt-add-num-persona-row').on('click', function () {
					numPersonaRows.push({ key: '', label: '', type: 'focus', prompt: '', profile_source: '' });
					syncNumPersonaInput();
					renderNumPersonaRows(); bindNumPersonaEvents();
				});

				renderNumPersonaRows();
				bindNumPersonaEvents();
				syncNumPersonaInput();
			}(jQuery));
			</script>

			<?php endif; ?>

		</div>

		<script>
		(function ($) {
			var savedFavorites = $('#lt_ai_favorite_models').val().split(',').map(s => s.trim()).filter(Boolean);
			var selectedModel  = $('#lt_ai_model').val();
			var allModels      = <?php echo wp_json_encode( array_values( $cached_models ) ); ?> || [];
			var cacheUpdatedAt = <?php echo wp_json_encode( $cached_updated_at ); ?> || '';
			var personaRows    = <?php echo wp_json_encode( $persona_rows ); ?> || [];
			var lensProfileSourceOptions = <?php echo wp_json_encode( $lens_profile_source_options ); ?> || {};

			function setStatus(text, color) { $('#lt-conn-status').text(text).css('color', color || '#2271b1'); }
			function syncFavoriteInput() { $('#lt_ai_favorite_models').val(savedFavorites.join(',')); }
			function persistSelectedModel() {
				$.post(ajaxurl, { action: 'lt_save_ai_model', model: selectedModel, _ajax_nonce: '<?php echo wp_create_nonce( 'lt_save_ai_model' ); ?>' });
			}

			function syncPersonaInput() {
				var normalized = personaRows.map(function (row) {
					return {
						key: (row.key || '').trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '_'),
						label: (row.label || '').trim(),
						type: (row.type || 'focus').trim(),
						prompt: (row.prompt || '').trim(),
						profile_source: row.type === 'lens' ? (row.profile_source || '').trim() : ''
					};
				}).filter(function (row) { return row.label && row.prompt; });
				$('#lt_ai_persona_prompts').val(JSON.stringify(normalized));
			}

			function renderLensProfileSourceSelect(row) {
				if ((row.type || 'focus') !== 'lens') return '';
				var currentValue = row.profile_source || '';
				var html = '<div style="margin-top:8px;display:flex;align-items:center;gap:8px;">';
				html += '<label style="font-weight:600;min-width:110px;">Profile Source</label>';
				html += '<select class="lt-persona-profile-source"><option value="">Use key match</option>';
				Object.keys(lensProfileSourceOptions).forEach(function (key) {
					html += '<option value="' + key + '" ' + (currentValue === key ? 'selected' : '') + '>' + key + '</option>';
				});
				html += '</select>';
				html += '<span style="font-size:12px;color:#666;">Choose which saved profile data this lens should inject.</span>';
				html += '</div>';
				return html;
			}

			function renderPersonaRows() {
				var html = '';
				personaRows.forEach(function (row, idx) {
					var type = row.type || 'focus';
					html += '<div data-idx="' + idx + '" style="border:1px solid #dcdcde;border-radius:6px;padding:12px;background:#fff">';
					html += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">';
					html += '<select class="lt-persona-type">';
					html += '<option value="tone" '  + (type === 'tone'  ? 'selected' : '') + '>Tone</option>';
					html += '<option value="focus" ' + (type === 'focus' ? 'selected' : '') + '>Focus</option>';
					html += '<option value="lens" '  + (type === 'lens'  ? 'selected' : '') + '>Lens</option>';
					html += '</select>';
					html += '<input type="text" class="lt-persona-label regular-text" placeholder="Display Label (e.g. Shadow Work)" value="' + $('<div>').text(row.label || '').html() + '" style="flex:1;" />';
					html += '<span style="font-size:11px;color:#888;font-family:monospace;max-width:150px;overflow:hidden;text-overflow:ellipsis;" title="Auto-generated key: ' + $('<div>').text(row.key || '').html() + '">' + $('<div>').text(row.key || '').html() + '</span>';
					html += '<button type="button" class="button-link-delete lt-remove-persona" style="margin-left:auto;">Remove</button>';
					html += '</div>';
					html += '<textarea class="lt-persona-prompt large-text" rows="4" placeholder="Persona instructions...">' + $('<div>').text(row.prompt || '').html() + '</textarea>';
					html += renderLensProfileSourceSelect(row);
					html += '</div>';
				});
				if (!html) { html = '<p style="margin:0;color:#666;">No personas yet. Add one below.</p>'; }
				$('#lt-persona-list').html(html);
				syncPersonaInput();
			}

			function syncModelSelect() {
				var select = $('#lt_ai_model_select');
				select.empty();
				if (!allModels.length) {
					select.append('<option value="' + selectedModel + '">' + selectedModel + '</option>');
					select.val(selectedModel);
					return;
				}
				allModels.forEach(function (m) { select.append('<option value="' + m.id + '">' + m.name + ' (' + m.id + ')</option>'); });
				select.val(selectedModel);
				if (select.val() !== selectedModel) {
					select.prepend('<option value="' + selectedModel + '">' + selectedModel + ' (saved)</option>');
					select.val(selectedModel);
				}
			}

			$('#lt_ai_model_select').on('change', function () {
				selectedModel = $(this).val();
				$('#lt_ai_model').val(selectedModel);
				persistSelectedModel();
				renderModels(allModels);
				renderFavoriteCards();
			});

			$('#lt-test-connection').on('click', function (e) {
				e.preventDefault();
				var btn = $(this);
				btn.prop('disabled', true).text('Testing...');
				setStatus('Testing connection...', '#666');
				$.post(ajaxurl, { action: 'lt_test_api_connection', _ajax_nonce: '<?php echo wp_create_nonce( 'lt_test_api_connection' ); ?>' }, function (res) {
					if (res.success) { setStatus('Connected. Key is valid.', '#2f7d32'); }
					else { setStatus('Connection failed: ' + (res.data || 'Unknown error'), '#b32d2e'); }
					btn.prop('disabled', false).text('Test Connection');
				});
			});

			$('#lt-load-models').on('click', function (e) {
				e.preventDefault();
				var btn = $(this);
				btn.prop('disabled', true).text('Loading...');
				setStatus('Refreshing models...', '#666');
				$.post(ajaxurl, { action: 'lt_fetch_models', force: 1, _ajax_nonce: '<?php echo wp_create_nonce( 'lt_fetch_models' ); ?>' }, function (res) {
					if (res.success) {
						allModels = res.data.models || [];
						cacheUpdatedAt = res.data.updated_at || '';
						renderModels(allModels);
						syncModelSelect();
						renderFavoriteCards();
						setStatus('Loaded ' + allModels.length + ' models.', '#2f7d32');
					} else {
						setStatus('Model refresh failed: ' + (res.data || 'Could not fetch models'), '#b32d2e');
					}
					btn.prop('disabled', false).text('Refresh Models');
				});
			});

			$('#lt-model-search').on('input', function () {
				var q = $(this).val().toLowerCase();
				renderModels(allModels.filter(m => m.id.toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q)));
			});

			function fmtPrice(p) { return p ? '$' + (p * 1000000).toFixed(2) + '/M' : '—'; }
			function fmtCtx(n)   { return n ? (n / 1000).toFixed(0) + 'K ctx' : '—'; }

			function renderModels(list) {
				var html = '';
				var favList = list.filter(m => savedFavorites.includes(m.id));
				var rest    = list.filter(m => !savedFavorites.includes(m.id));
				[...favList, ...rest].forEach(function (m) {
					var isFav    = savedFavorites.includes(m.id);
					var isActive = m.id === selectedModel;
					var pricing  = m.pricing || {};
					html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #eee;background:' + (isActive ? '#e8f5e9' : '#fff') + '">';
					html += '<button class="lt-fav-btn button button-small" data-id="' + m.id + '" style="color:' + (isFav ? 'gold' : '#999') + ';" title="Toggle favorite">★</button>';
					html += '<div style="flex:1;min-width:0;"><strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + m.name + '</strong>';
					html += '<code style="font-size:11px;color:#666;">' + m.id + '</code></div>';
					html += '<div style="text-align:right;white-space:nowrap;font-size:12px;color:#555;">';
					html += '<span>In: ' + fmtPrice(pricing.prompt) + '</span> | <span>Out: ' + fmtPrice(pricing.completion) + '</span><br>';
					html += '<span>' + fmtCtx(m.context_length) + '</span></div>';
					html += '<button class="lt-select-btn button button-primary button-small" data-id="' + m.id + '">Select</button>';
					html += '</div>';
				});
				$('#lt-models-list').html(html || '<p style="padding:12px">No models found.</p>');
			}

			function renderFavoriteCards() {
				var html = '';
				savedFavorites.forEach(function (modelId) {
					var model = allModels.find(function (m) { return m.id === modelId; });
					if (!model) {
						html += '<div style="border:1px solid #dcdcde;border-radius:8px;padding:10px;background:#fff;">';
						html += '<strong style="display:block;margin-bottom:4px;">' + modelId + '</strong>';
						html += '<small style="color:#666;">Model metadata not cached yet. Refresh models.</small>';
						html += '</div>';
						return;
					}
					var pricing = model.pricing || {};
					html += '<div style="border:1px solid #dcdcde;border-radius:8px;padding:10px;background:' + (model.id === selectedModel ? '#f0f6fc' : '#fff') + ';">';
					html += '<strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (model.name || model.id) + '</strong>';
					html += '<code style="font-size:11px;color:#555;display:block;margin:4px 0 8px;">' + model.id + '</code>';
					html += '<div style="font-size:12px;color:#444;line-height:1.6;">';
					html += '<div>Input: ' + fmtPrice(pricing.prompt) + '</div>';
					html += '<div>Output: ' + fmtPrice(pricing.completion) + '</div>';
					html += '<div>Context: ' + fmtCtx(model.context_length) + '</div></div></div>';
				});
				if (!html) { html = '<p style="margin:0;color:#666;">No favorite models selected.</p>'; }
				$('#lt-favorites-cards').html(html);
			}

			$(document).on('click', '.lt-select-btn', function () {
				selectedModel = $(this).data('id');
				$('#lt_ai_model').val(selectedModel);
				persistSelectedModel();
				syncModelSelect();
				renderModels(allModels);
				renderFavoriteCards();
			});

			$(document).on('click', '.lt-fav-btn', function () {
				var id = $(this).data('id');
				if (savedFavorites.includes(id)) { savedFavorites = savedFavorites.filter(f => f !== id); }
				else { savedFavorites.push(id); }
				syncFavoriteInput();
				renderModels(allModels);
				renderFavoriteCards();
			});

			$('#lt-add-persona-row').on('click', function () {
				personaRows.push({ key: '', label: '', type: 'focus', prompt: '', profile_source: '' });
				renderPersonaRows();
			});

			$(document).on('input', '.lt-persona-label', function () {
				var idx = parseInt($(this).closest('[data-idx]').data('idx'), 10);
				if (!Number.isNaN(idx) && personaRows[idx]) {
					var label = $(this).val();
					personaRows[idx].label = label;
					personaRows[idx].key = label.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
					$(this).closest('[data-idx]').find('span').text(personaRows[idx].key).attr('title', 'Auto-generated key: ' + personaRows[idx].key);
					syncPersonaInput();
				}
			});

			$(document).on('change', '.lt-persona-type', function () {
				var idx = parseInt($(this).closest('[data-idx]').data('idx'), 10);
				if (!Number.isNaN(idx) && personaRows[idx]) {
					personaRows[idx].type = $(this).val();
					if (personaRows[idx].type !== 'lens') { personaRows[idx].profile_source = ''; }
					renderPersonaRows();
				}
			});

			$(document).on('change', '.lt-persona-profile-source', function () {
				var idx = parseInt($(this).closest('[data-idx]').data('idx'), 10);
				if (!Number.isNaN(idx) && personaRows[idx]) { personaRows[idx].profile_source = $(this).val(); syncPersonaInput(); }
			});

			$(document).on('input', '.lt-persona-prompt', function () {
				var idx = parseInt($(this).closest('[data-idx]').data('idx'), 10);
				if (!Number.isNaN(idx) && personaRows[idx]) { personaRows[idx].prompt = $(this).val(); syncPersonaInput(); }
			});

			$(document).on('click', '.lt-remove-persona', function () {
				var idx = parseInt($(this).closest('[data-idx]').data('idx'), 10);
				if (!Number.isNaN(idx)) { personaRows.splice(idx, 1); renderPersonaRows(); }
			});

			// Initial render.
			syncFavoriteInput();
			syncModelSelect();
			renderModels(allModels);
			renderFavoriteCards();
			renderPersonaRows();
			if (allModels.length) {
				setStatus('Loaded ' + allModels.length + ' cached models' + (cacheUpdatedAt ? (' (' + cacheUpdatedAt + ')') : '') + '.', '#2f7d32');
			}
		})(jQuery);
		</script>
		<?php
	}

	// ------------------------------------------------------------------
	// Generation Logs
	// ------------------------------------------------------------------

	public function page_logs(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$logs = get_option( 'lt_ai_generation_logs', [] );
		if ( ! is_array( $logs ) ) {
			$logs = [];
		}

		// Handle manual clear.
		if ( isset( $_POST['lt_clear_logs'] ) && check_admin_referer( 'lt_clear_logs_action' ) ) {
			$clear_range = sanitize_text_field( $_POST['lt_clear_logs_range'] ?? 'all' );
			$cutoff      = 0;
			if ( $clear_range === '24h' ) {
				$cutoff = time() - DAY_IN_SECONDS;
			} elseif ( $clear_range === '7d' ) {
				$cutoff = time() - ( 7 * DAY_IN_SECONDS );
			} elseif ( $clear_range === '30d' ) {
				$cutoff = time() - ( 30 * DAY_IN_SECONDS );
			}

			if ( $cutoff > 0 ) {
				$logs = array_values( array_filter( $logs, function ( $log ) use ( $cutoff ) {
					return ( (int) ( $log['timestamp'] ?? 0 ) ) < $cutoff;
				} ) );
			} else {
				$logs = [];
			}

			update_option( 'lt_ai_generation_logs', $logs, false );
			$logs = array_reverse( $logs );
			echo '<div class="notice notice-success"><p>Logs cleared successfully.</p></div>';
		} else {
			$logs = array_reverse( $logs );
		}
		?>
		<div class="wrap">
			<h1 style="display:flex;justify-content:space-between;align-items:center;">
				<span>AI Generation Logs</span>
				<form method="post" style="display:inline-flex;align-items:center;gap:8px;">
					<?php wp_nonce_field( 'lt_clear_logs_action' ); ?>
					<input type="hidden" name="lt_clear_logs" value="1">
					<select name="lt_clear_logs_range">
						<option value="24h">Clear last 24 hours</option>
						<option value="7d">Clear last 7 days</option>
						<option value="30d">Clear last 30 days</option>
						<option value="all" selected>Clear all logs</option>
					</select>
					<button type="submit" class="button button-secondary" onclick="return confirm('Are you sure you want to clear the selected generation logs? This cannot be undone.');">Clear Logs</button>
				</form>
			</h1>
			<p>Recent prompts and responses sent to OpenRouter. Stored until you clear them from this page.</p>

			<?php if ( empty( $logs ) ) : ?>
				<div class="notice notice-info">
					<p>No generation logs found. Generate a reading to see data here.</p>
				</div>
			<?php else : ?>
				<div id="lt-log-accordion" style="margin-top:20px;display:flex;flex-direction:column;gap:15px;">
					<?php foreach ( $logs as $log ) :
						$time      = isset( $log['timestamp'] ) ? date( 'M j, Y H:i:s', $log['timestamp'] ) : 'Unknown';
						$model     = esc_html( $log['model'] ?? 'Unknown Model' );
						$tokens    = esc_html( $log['tokens'] ?? '?' );
						$cost      = esc_html( isset( $log['cost'] ) ? '$' . number_format( (float) $log['cost'], 6 ) : 'Unknown' );
						$has_error = ! empty( $log['error'] );
						$status    = $has_error ? 'Failed' : 'Success';
						$color     = $has_error ? '#d63638' : '#00a32a';
						$feature   = esc_html( $log['meta']['feature'] ?? 'ai_reading' );
						?>
						<div class="log-item card" style="max-width:100%;padding:0;border-left:4px solid <?php echo $color; ?>">
							<div class="log-header" style="padding:15px;background:#f8f9f9;cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="jQuery(this).next('.log-body').slideToggle();">
								<div>
									<strong style="font-size:14px;"><?php echo esc_html( $time ); ?></strong>
									<span style="color:#646970;margin-left:10px;">Model: <?php echo $model; ?></span>
									<span style="color:#646970;margin-left:10px;">Feature: <?php echo $feature; ?></span>
								</div>
								<div style="display:flex;gap:15px;align-items:center;">
									<span style="color:#646970;font-size:12px;">Tokens: <?php echo $tokens; ?> | Est. Cost: <?php echo $cost; ?></span>
									<span style="font-weight:bold;color:<?php echo $color; ?>;"><?php echo $status; ?></span>
									<span class="dashicons dashicons-arrow-down-alt2"></span>
								</div>
							</div>
							<div class="log-body" style="display:none;padding:20px;border-top:1px solid #dcdcde;">
								<?php if ( ! empty( $log['error'] ) ) : ?>
									<div style="background:#fcf0f1;padding:15px;border-left:4px solid #d63638;margin-bottom:20px;">
										<strong>Error:</strong> <?php echo esc_html( $log['error'] ); ?>
									</div>
								<?php endif; ?>
								<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
									<div>
										<h4 style="margin-top:0;">Request Prompt</h4>
										<div style="background:#1d2327;color:#f0f0f1;padding:15px;border-radius:4px;font-family:monospace;white-space:pre-wrap;overflow-x:auto;max-height:500px;overflow-y:auto;font-size:12px;">
											<?php
											if ( isset( $log['request'] ) && is_array( $log['request'] ) ) {
												foreach ( $log['request'] as $msg ) {
													$role = strtoupper( $msg['role'] ?? 'UNKNOWN' );
													echo "<strong style='color:#72aee6'>[" . esc_html( $role ) . "]</strong>\n";
													echo esc_html( $msg['content'] ?? '' ) . "\n\n";
												}
											} else {
												echo 'No request data stored.';
											}
											?>
										</div>
									</div>
									<div>
										<h4 style="margin-top:0;">Readable Response</h4>
										<div style="background:#f6f7f7;color:#1d2327;padding:15px;border:1px solid #c3c4c7;border-radius:4px;white-space:pre-wrap;overflow-x:auto;max-height:500px;overflow-y:auto;font-size:13px;line-height:1.6;">
											<?php
											if ( isset( $log['response'] ) && is_string( $log['response'] ) && $log['response'] !== '' ) {
												echo esc_html( $log['response'] );
											} elseif ( isset( $log['response_raw'] ) && is_string( $log['response_raw'] ) ) {
												echo esc_html( $log['response_raw'] );
											} else {
												echo 'No response content stored.';
											}
											?>
										</div>
									</div>
								</div>
								<?php if ( ! empty( $log['response_raw'] ) ) : ?>
									<div style="margin-top:20px;">
										<h4 style="margin-top:0;">Raw Provider Payload</h4>
										<div style="background:#1d2327;color:#f0f0f1;padding:15px;border-radius:4px;font-family:monospace;white-space:pre-wrap;overflow-x:auto;max-height:500px;overflow-y:auto;font-size:12px;">
											<?php echo esc_html( $log['response_raw'] ); ?>
										</div>
									</div>
								<?php endif; ?>
							</div>
						</div>
					<?php endforeach; ?>
				</div>
			<?php endif; ?>
		</div>
		<?php
	}

	// ------------------------------------------------------------------
	// Admin POST handlers
	// ------------------------------------------------------------------

	public function admin_post_manual_credit(): void {
		check_admin_referer( 'lt_manual_credit' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		$uid    = (int) ( $_POST['user_id'] ?? 0 );
		$amount = (int) ( $_POST['amount'] ?? 0 );
		$reason = sanitize_text_field( $_POST['reason'] ?? 'manual_admin' );
		$credits = lunacco_core()->credits();

		if ( $uid && $amount !== 0 ) {
			if ( $amount > 0 ) {
				$credits->add_credits( $uid, $amount, $reason, null, [
					'bucket'           => 'purchased',
					'manual_adjustment' => 1,
					'reason_label'     => $reason,
					'action_label'     => 'Admin Adjustment',
				] );
				$credits->set_balances( $uid, $credits->get_membership_balance( $uid ), $credits->get_purchased_balance( $uid ) + $amount );
			} else {
				$balance = $credits->get_total_balance( $uid );
				if ( $balance >= abs( $amount ) ) {
					$credits->consume_credits( $uid, abs( $amount ), $reason, null, [
						'bucket'           => 'usage',
						'manual_adjustment' => 1,
						'reason_label'     => $reason,
						'action_label'     => 'Admin Adjustment',
					] );
				}
			}
		}

		wp_redirect( admin_url( 'admin.php?page=lunacco-cart&credit_done=1' ) );
		exit;
	}

	public function admin_post_sync_fc_orders(): void {
		check_admin_referer( 'lt_sync_fc' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		$user_id = (int) ( $_POST['user_id'] ?? 0 );
		$synced  = $user_id ? lunacco_core()->fluentcart()->sync_orders_for_user( $user_id ) : 0;

		wp_redirect( admin_url( 'admin.php?page=lunacco-cart&synced=' . $synced . '&uid=' . $user_id ) );
		exit;
	}

	public function admin_post_rebuild_credit_balance(): void {
		check_admin_referer( 'lt_rebuild_credit_balance' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		$user_id  = (int) ( $_POST['user_id'] ?? 0 );
		$balances = $user_id ? lunacco_core()->credits()->rebuild_balances_from_ledger( $user_id ) : [];

		wp_redirect( admin_url( 'admin.php?page=lunacco-cart&rebuild_rows=' . (int) ( $balances['rows_processed'] ?? 0 ) . '&uid=' . $user_id ) );
		exit;
	}

	public function admin_post_rebuild_all_credit_balances(): void {
		check_admin_referer( 'lt_rebuild_all_credit_balances' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		global $wpdb;
		$credits    = lunacco_core()->credits();
		$user_ids   = $wpdb->get_col( "SELECT DISTINCT user_id FROM {$wpdb->prefix}luna_credits_log" );
		$total_rows = 0;
		$count      = 0;

		foreach ( $user_ids as $uid ) {
			$uid = (int) $uid;
			if ( $uid <= 0 ) {
				continue;
			}
			$result    = $credits->rebuild_balances_from_ledger( $uid );
			$total_rows += (int) ( $result['rows_processed'] ?? 0 );
			$count++;
		}

		wp_redirect( admin_url( 'admin.php?page=lunacco-cart&rebuilt_all_users=' . $count . '&rebuilt_all_rows=' . $total_rows ) );
		exit;
	}

	public function admin_post_import_data(): void {
		// Placeholder — Import/Export not implemented yet.
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}
		wp_redirect( admin_url( 'admin.php?page=lunacco' ) );
		exit;
	}

	public function admin_post_export_data(): void {
		// Placeholder — Import/Export not implemented yet.
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}
		wp_redirect( admin_url( 'admin.php?page=lunacco' ) );
		exit;
	}

	// ------------------------------------------------------------------
	// Promotions page
	// ------------------------------------------------------------------

	public function page_promos(): void {
		if ( ! class_exists( 'LunaCco_Promos' ) ) {
			echo '<div class="wrap"><p>Promo system not available.</p></div>';
			return;
		}

		$promos = lunacco_core()->promos();
		$action = sanitize_key( $_GET['action'] ?? 'list' );
		$id     = (int) ( $_GET['id'] ?? 0 );
		$saved  = isset( $_GET['saved'] );
		$deleted= isset( $_GET['deleted'] );

		// Handle save.
		if ( isset( $_POST['luna_promos_nonce'] ) ) {
			check_admin_referer( 'luna_promos_save', 'luna_promos_nonce' );
			$result = $promos->save( [
				'id'           => (int) ( $_POST['id'] ?? 0 ),
				'slug'         => sanitize_key( $_POST['slug'] ?? '' ),
				'label'        => sanitize_text_field( $_POST['label'] ?? '' ),
				'kind'         => sanitize_key( $_POST['kind'] ?? 'percent_off' ),
				'amount'       => (float) ( $_POST['amount'] ?? 0 ),
				'item_type'    => sanitize_text_field( $_POST['item_type'] ?? '*' ),
				'item_id'      => $_POST['item_id'] ? (int) $_POST['item_id'] : null,
				'active_from'  => sanitize_text_field( $_POST['active_from'] ?? '' ) ?: null,
				'active_until' => sanitize_text_field( $_POST['active_until'] ?? '' ) ?: null,
				'is_active'    => isset( $_POST['is_active'] ) ? 1 : 0,
			] );
			if ( ! is_wp_error( $result ) ) {
				wp_redirect( admin_url( 'admin.php?page=lunacco-promos&saved=1' ) );
				exit;
			}
		}

		// Handle delete.
		if ( $action === 'delete' && $id ) {
			check_admin_referer( 'luna_promo_delete_' . $id );
			$promos->delete( $id );
			wp_redirect( admin_url( 'admin.php?page=lunacco-promos&deleted=1' ) );
			exit;
		}

		$editing = ( $action === 'edit' || $action === 'new' ) ? ( $id ? $promos->get( $id ) : [] ) : null;
		$all     = $promos->get_all();
		?>
		<div class="wrap">
			<h1 class="wp-heading-inline">Promotions</h1>
			<?php if ( $editing === null ) : ?>
				<a href="<?php echo esc_url( add_query_arg( 'action', 'new', admin_url( 'admin.php?page=lunacco-promos' ) ) ); ?>" class="page-title-action">Add New</a>
			<?php endif; ?>

			<?php if ( $saved ) : ?><div class="notice notice-success is-dismissible"><p>Promo saved.</p></div><?php endif; ?>
			<?php if ( $deleted ) : ?><div class="notice notice-success is-dismissible"><p>Promo deleted.</p></div><?php endif; ?>

			<?php if ( $editing !== null ) : ?>
				<h2><?php echo empty( $editing ) ? 'New Promo' : 'Edit Promo'; ?></h2>
				<a href="<?php echo esc_url( admin_url( 'admin.php?page=lunacco-promos' ) ); ?>">← Back</a>
				<form method="post" style="max-width:600px;margin-top:16px;">
					<?php wp_nonce_field( 'luna_promos_save', 'luna_promos_nonce' ); ?>
					<input type="hidden" name="id" value="<?php echo (int) ( $editing['id'] ?? 0 ); ?>">
					<table class="form-table">
						<tr><th><label>Slug</label></th><td><input name="slug" type="text" class="regular-text" value="<?php echo esc_attr( $editing['slug'] ?? '' ); ?>" required></td></tr>
						<tr><th><label>Label</label></th><td><input name="label" type="text" class="regular-text" value="<?php echo esc_attr( $editing['label'] ?? '' ); ?>" required></td></tr>
						<tr><th><label>Kind</label></th><td>
							<select name="kind">
								<option value="percent_off"  <?php selected( $editing['kind'] ?? '', 'percent_off' ); ?>>% Off</option>
								<option value="credits_off"  <?php selected( $editing['kind'] ?? '', 'credits_off' ); ?>>Credits Off</option>
							</select>
						</td></tr>
						<tr><th><label>Amount</label></th><td><input name="amount" type="number" min="0" step="0.01" class="small-text" value="<?php echo esc_attr( $editing['amount'] ?? '' ); ?>"> <span class="description">e.g. 25 for 25% off, or 3 for 3 credits off</span></td></tr>
						<tr><th><label>Item Type</label></th><td>
							<select name="item_type">
								<option value="*"                 <?php selected( $editing['item_type'] ?? '*', '*' ); ?>>* All items (site-wide)</option>
								<option value="db_chart_preset"   <?php selected( $editing['item_type'] ?? '', 'db_chart_preset' ); ?>>Chart Preset</option>
								<option value="db_document"       <?php selected( $editing['item_type'] ?? '', 'db_document' ); ?>>Document</option>
							</select>
						</td></tr>
						<tr><th><label>Item ID</label></th><td><input name="item_id" type="number" min="0" class="small-text" value="<?php echo esc_attr( $editing['item_id'] ?? '' ); ?>"> <span class="description">Leave blank for all items of that type</span></td></tr>
						<tr><th><label>Active From</label></th><td><input name="active_from" type="datetime-local" value="<?php echo esc_attr( $editing['active_from'] ?? '' ); ?>"></td></tr>
						<tr><th><label>Active Until</label></th><td><input name="active_until" type="datetime-local" value="<?php echo esc_attr( $editing['active_until'] ?? '' ); ?>"></td></tr>
						<tr><th>Active</th><td><label><input type="checkbox" name="is_active" value="1" <?php checked( (int) ( $editing['is_active'] ?? 1 ) ); ?>> Enabled</label></td></tr>
					</table>
					<?php submit_button( empty( $editing ) ? 'Create Promo' : 'Update Promo' ); ?>
				</form>
			<?php else : ?>
				<?php if ( empty( $all ) ) : ?>
					<p>No promotions yet.</p>
				<?php else : ?>
					<table class="wp-list-table widefat fixed striped" style="margin-top:16px;">
						<thead><tr><th>Slug</th><th>Label</th><th>Kind</th><th>Amount</th><th>Applies To</th><th>Range</th><th>Active</th><th>Actions</th></tr></thead>
						<tbody>
						<?php foreach ( $all as $p ) :
							$applies = $p['item_type'] === '*' ? 'All items' : $p['item_type'] . ( $p['item_id'] ? ' #' . $p['item_id'] : '' );
							$range   = $p['active_from'] ? esc_html( substr( $p['active_from'], 0, 10 ) . ' → ' . substr( $p['active_until'] ?? '', 0, 10 ) ) : '—';
						?>
							<tr>
								<td><code><?php echo esc_html( $p['slug'] ); ?></code></td>
								<td><?php echo esc_html( $p['label'] ); ?></td>
								<td><?php echo esc_html( $p['kind'] ); ?></td>
								<td><?php echo esc_html( $p['amount'] ); ?></td>
								<td><?php echo esc_html( $applies ); ?></td>
								<td class="description"><?php echo $range; ?></td>
								<td><?php echo $p['is_active'] ? '✓' : '—'; ?></td>
								<td>
									<a href="<?php echo esc_url( add_query_arg( [ 'action' => 'edit', 'id' => $p['id'] ], admin_url( 'admin.php?page=lunacco-promos' ) ) ); ?>">Edit</a>
									<a href="<?php echo esc_url( wp_nonce_url( add_query_arg( [ 'action' => 'delete', 'id' => $p['id'] ], admin_url( 'admin.php?page=lunacco-promos' ) ), 'luna_promo_delete_' . $p['id'] ) ); ?>" onclick="return confirm('Delete?')" style="color:#b32d2e;margin-left:6px;">Delete</a>
								</td>
							</tr>
						<?php endforeach; ?>
						</tbody>
					</table>
				<?php endif; ?>
			<?php endif; ?>
		</div>
		<?php
	}

	public function page_locations(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$locations_system = lunacco_core()->locations();
		$row_count = $locations_system->get_row_count();
		$default_gz_path = WP_PLUGIN_DIR . '/combined_locations.csv.gz';
		$file_exists = file_exists( $default_gz_path );
		$nonce = wp_create_nonce( 'lunacco_locations_admin' );
		?>
		<div class="wrap lunacco-locations-wrap">
			<h1>Location Data Service Importer</h1>
			
			<div class="card" style="max-width: 800px; margin-top: 20px; padding: 20px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
				<h2>Dataset Information & Importer</h2>
				<p>
					The location service stores cities, states, and coordinates to enable high-fidelity astronomical calculations.
				</p>
				<table class="form-table">
					<tr>
						<th>Current Database Records</th>
						<td>
							<strong id="lunacco-locations-count" style="font-size: 16px;"><?php echo number_format( $row_count ); ?></strong> cities
						</td>
					</tr>
					<tr>
						<th>Source File Method</th>
						<td>
							<fieldset>
								<label style="display:block; margin-bottom:12px;">
									<input type="radio" name="source_method" id="source-method-upload" value="upload" checked />
									Upload <code>combined_locations.csv.gz</code> file:
									<input type="file" id="lunacco-locations-file" accept=".gz" style="margin-left: 10px;" />
								</label>
								<label style="display:block;">
									<input type="radio" name="source_method" id="source-method-existing" value="existing" <?php disabled( ! $file_exists ); ?> />
									Use existing file from plugin root:
									<code><?php echo esc_html( basename( $default_gz_path ) ); ?></code>
									<?php if ( $file_exists ) : ?>
										<span style="color:#46b450; font-weight:bold;">(Found: <?php echo size_format( filesize( $default_gz_path ) ); ?>)</span>
									<?php else : ?>
										<span style="color:#dc3232; font-weight:bold;">(Not found)</span>
									<?php endif; ?>
								</label>
							</fieldset>
						</td>
					</tr>
				</table>

				<div style="margin-top: 20px; display: flex; gap: 10px;">
					<button type="button" id="lunacco-locations-import-btn" class="button button-primary">
						Start Import
					</button>
					<button type="button" id="lunacco-locations-clear-btn" class="button button-secondary" <?php disabled( $row_count === 0 ); ?>>
						Clear Locations Table
					</button>
				</div>
			</div>

			<div id="lunacco-locations-progress-card" class="card" style="max-width: 800px; margin-top: 20px; padding: 20px; display: none;">
				<h3>Import Progress</h3>
				<div style="background: #f0f0f1; border-radius: 4px; height: 20px; width: 100%; overflow: hidden; margin-bottom: 10px;">
					<div id="lunacco-locations-progressbar" style="background: #2271b1; height: 100%; width: 0%; transition: width 0.2s ease;"></div>
				</div>
				<div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 15px;">
					<span id="lunacco-locations-progress-percent">0%</span>
					<span id="lunacco-locations-progress-status">Uploading / Decompressing...</span>
				</div>

				<h4>Status Log</h4>
				<pre id="lunacco-locations-log" style="background: #1d2327; color: #3df33d; padding: 15px; font-family: monospace; font-size: 12px; border-radius: 4px; max-height: 250px; overflow-y: auto; line-height: 1.6;"></pre>
			</div>

			<div class="card" style="max-width: 800px; margin-top: 20px; padding: 15px; background-color: #f6f7f7; border-left: 4px solid #72dec2;">
				<p style="margin: 0; font-size: 12px; color: #50575e; line-height: 1.5;">
					<strong>Attribution:</strong> <?php echo esc_html( LunaCco_Locations::get_attribution_string() ); ?>
				</p>
			</div>
		</div>

		<!-- Custom Confirmation Modal (Non-blocking for testing / automation) -->
		<div id="lunacco-confirm-modal" style="display: none; position: fixed; z-index: 99999; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); align-items: center; justify-content: center;">
			<div class="card" style="background: #fff; padding: 20px; border-radius: 4px; max-width: 400px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2); margin: auto;">
				<h3 id="lunacco-confirm-title" style="margin-top: 0; font-size: 18px;">Confirm Action</h3>
				<p id="lunacco-confirm-message" style="margin: 15px 0; font-size: 14px; color: #50575e;"></p>
				<div style="display: flex; justify-content: center; gap: 10px; margin-top: 20px;">
					<button type="button" id="lunacco-confirm-yes" class="button button-primary">Confirm</button>
					<button type="button" id="lunacco-confirm-no" class="button button-secondary">Cancel</button>
				</div>
			</div>
		</div>

		<script type="text/javascript">
		jQuery(document).ready(function($) {
			const $importBtn = $('#lunacco-locations-import-btn');
			const $clearBtn = $('#lunacco-locations-clear-btn');
			const $countText = $('#lunacco-locations-count');
			const $progressCard = $('#lunacco-locations-progress-card');
			const $progressBar = $('#lunacco-locations-progressbar');
			const $progressPercent = $('#lunacco-locations-progress-percent');
			const $progressStatus = $('#lunacco-locations-progress-status');
			const $log = $('#lunacco-locations-log');

			const nonce = '<?php echo esc_js( $nonce ); ?>';

			let confirmCallback = null;
			function showConfirm(title, message, callback) {
				$('#lunacco-confirm-title').text(title);
				$('#lunacco-confirm-message').text(message);
				confirmCallback = callback;
				$('#lunacco-confirm-modal').css('display', 'flex');
			}

			$('#lunacco-confirm-yes').on('click', function() {
				$('#lunacco-confirm-modal').hide();
				if (confirmCallback) {
					confirmCallback();
				}
			});

			$('#lunacco-confirm-no').on('click', function() {
				$('#lunacco-confirm-modal').hide();
			});

			function addLog(msg) {
				const time = new Date().toLocaleTimeString();
				$log.append('[' + time + '] ' + msg + '\n');
				$log.scrollTop($log[0].scrollHeight);
			}

			$clearBtn.on('click', function() {
				showConfirm(
					'Clear Locations Table',
					'Are you sure you want to delete all stored locations? This cannot be undone.',
					function() {
						$clearBtn.prop('disabled', true);
						$importBtn.prop('disabled', true);

						$.post(ajaxurl, {
							action: 'lunacco_locations_clear',
							nonce: nonce
						}, function(res) {
							if (res.success) {
								$countText.text('0');
								$clearBtn.prop('disabled', true);
								addLog('Locations table cleared successfully.');
							} else {
								alert('Error: ' + res.data.message);
							}
							$importBtn.prop('disabled', false);
						}).fail(function() {
							alert('Request failed.');
							$importBtn.prop('disabled', false);
						});
					}
				);
			});

			$importBtn.on('click', function() {
				const useExisting = $('#source-method-existing').is(':checked');
				const fileInput = $('#lunacco-locations-file')[0];
				
				if (!useExisting && (!fileInput || fileInput.files.length === 0)) {
					alert('Please select a combined_locations.csv.gz file to upload.');
					return;
				}

				showConfirm(
					'Start Locations Import',
					'This will empty existing location data and reload the dataset. Continue?',
					function() {
						$importBtn.prop('disabled', true);
						$clearBtn.prop('disabled', true);
						$progressCard.show();
						$log.empty();
						$progressBar.css('width', '0%');
						$progressPercent.text('0%');
						$progressStatus.text('Uploading / Preparing source file...');

						addLog('Initializing import process...');

						const formData = new FormData();
						formData.append('action', 'lunacco_locations_start_decompress');
						formData.append('nonce', nonce);
						if (useExisting) {
							formData.append('use_existing', 'yes');
							addLog('Using existing file from plugin root...');
						} else {
							formData.append('locations_file', fileInput.files[0]);
							addLog('Uploading selected file: ' + fileInput.files[0].name + ' (' + (fileInput.files[0].size / (1024 * 1024)).toFixed(2) + ' MB)...');
						}

						// Step 1: Upload / Decompress
						$.ajax({
							url: ajaxurl,
							type: 'POST',
							data: formData,
							processData: false,
							contentType: false,
							success: function(res) {
								if (!res.success) {
									addLog('Error: ' + res.data.message);
									$progressStatus.text('Decompression failed');
									$importBtn.prop('disabled', false);
									$clearBtn.prop('disabled', false);
									return;
								}

								const totalSize = res.data.total_size;
								addLog('Decompressed successfully. Temp CSV file size: ' + (totalSize / (1024 * 1024)).toFixed(2) + ' MB.');
								addLog('Starting database insertion chunks...');

								// Step 2: Batch import loop
								runImportChunk(0, totalSize);
							},
							error: function() {
								addLog('Failed to upload/decompress file. Server upload limit might have been exceeded.');
								$progressStatus.text('Error');
								$importBtn.prop('disabled', false);
								$clearBtn.prop('disabled', false);
							}
						});
					}
				);
			});

			function runImportChunk(offset, totalSize) {
				$progressStatus.text('Importing data...');
				$.post(ajaxurl, {
					action: 'lunacco_locations_import_chunk',
					offset: offset,
					total_size: totalSize,
					nonce: nonce
				}, function(res) {
					if (!res.success) {
						addLog('Error at offset ' + offset + ': ' + res.data.message);
						$progressStatus.text('Import failed');
						$importBtn.prop('disabled', false);
						$clearBtn.prop('disabled', false);
						return;
					}

					const progress = res.data.progress;
					$progressBar.css('width', progress + '%');
					$progressPercent.text(progress + '%');

					if (res.data.done) {
						addLog('Import complete!');
						addLog('Stored ' + res.data.row_count.toLocaleString() + ' locations in database.');
						$progressStatus.text('Completed');
						$countText.text(res.data.row_count.toLocaleString());
						$importBtn.prop('disabled', false);
						$clearBtn.prop('disabled', ($countText.text() === '0'));
					} else {
						addLog('Chunk processed. Progress: ' + progress + '%');
						runImportChunk(res.data.offset, totalSize);
					}

				}).fail(function() {
					addLog('Chunk request failed. Retrying in 2 seconds...');
					setTimeout(function() {
						runImportChunk(offset, totalSize);
					}, 2000);
				});
			}
		});
		</script>
		<?php
	}
}
