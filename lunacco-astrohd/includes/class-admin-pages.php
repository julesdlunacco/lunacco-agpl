<?php
/**
 * Luna AstroHD — Admin pages.
 *
 * Menu: top-level "AstroHD" with subpages:
 *   - Definitions       (page=luna-astrohd-definitions)
 *   - Chart Settings    (page=luna-astrohd-chart-settings)  — visibility + premium/credit cost
 *   - Chart Builder     (page=luna-astrohd-chart-builder)   — bodygraph color theme editor (Phase 3+)
 *
 * Phase 3 ships functional Chart Settings (POST handler) + placeholder
 * Definitions/Chart Builder screens. Full definition editor lands later.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'admin_menu', 'luna_astrohd_register_admin_menu' );

function luna_astrohd_register_admin_menu(): void {
	add_submenu_page( null, 'AstroHD', 'AstroHD', 'manage_options', 'luna-astrohd', 'luna_astrohd_render_definitions_page' );
	add_submenu_page( null, 'AstroHD Definitions', 'AstroHD Definitions', 'manage_options', 'luna-astrohd-definitions', 'luna_astrohd_render_definitions_page' );
	add_submenu_page( null, 'Chart Presets', 'Chart Presets', 'manage_options', 'luna-astrohd-chart-presets', 'luna_astrohd_render_chart_presets_page' );
	add_submenu_page( null, 'Chart Settings', 'Chart Settings', 'manage_options', 'luna-astrohd-chart-settings', 'luna_astrohd_render_chart_settings_page' );
	add_submenu_page( null, 'Chart Builder', 'Chart Builder', 'manage_options', 'luna-astrohd-chart-builder', 'luna_astrohd_render_chart_builder_page' );
}

function luna_astrohd_render_definitions_page(): void {
	wp_safe_redirect( admin_url( 'admin.php?page=lunacco-definitions' ) );
	exit;
	echo '<div class="wrap"><h1>AstroHD Definitions</h1>';
	echo '<p>Definitions are edited in the SPA — navigate to the <strong>AstroHD Definitions</strong> tab inside the front-end app. Each definition set has Human Design and Astrology sections.</p>';
	echo '<p>Definition sets and sections are stored in <code>' . esc_html( $GLOBALS['wpdb']->prefix ) . 'lt_astrohd_definition_sets</code> and <code>' . esc_html( $GLOBALS['wpdb']->prefix ) . 'lt_astrohd_definition_sections</code>.</p>';
	echo '</div>';
}

function luna_astrohd_render_chart_presets_page(): void {
	wp_safe_redirect( admin_url( 'admin.php?page=lunacco-definitions&tab=chart-presets' ) );
	exit;

	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Insufficient permissions.' );
	}

	global $wpdb;
	$table = $wpdb->prefix . 'lt_astrohd_chart_presets';
	$msg   = '';

	// Handle delete
	if ( isset( $_POST['luna_astrohd_preset_delete_nonce'] ) && wp_verify_nonce( $_POST['luna_astrohd_preset_delete_nonce'], 'luna_astrohd_preset_delete' ) ) {
		$delete_id = (int) ( $_POST['delete_id'] ?? 0 );
		if ( $delete_id ) {
			$wpdb->delete( $table, [ 'id' => $delete_id ], [ '%d' ] );
			$msg = 'Preset deleted.';
		}
	}

	// Handle save / create
	if ( isset( $_POST['luna_astrohd_preset_nonce'] ) && wp_verify_nonce( $_POST['luna_astrohd_preset_nonce'], 'luna_astrohd_preset_save' ) ) {
		$edit_id     = (int) ( $_POST['preset_id'] ?? 0 );
		$label       = sanitize_text_field( $_POST['label'] ?? '' );
		$description = sanitize_textarea_field( $_POST['description'] ?? '' );
		$chart_type  = sanitize_key( $_POST['chart_type'] ?? 'natal' );
		$category    = sanitize_key( $_POST['category'] ?? 'astrohd' );
		$is_enabled  = (int) ! empty( $_POST['is_enabled'] );
		$is_premium  = (int) ! empty( $_POST['is_premium'] );
		$admin_only  = (int) ! empty( $_POST['admin_only'] );
		$credit_cost = max( 0, (int) ( $_POST['credit_cost'] ?? 0 ) );
		$sort_order  = (int) ( $_POST['sort_order'] ?? 0 );

		$allowed_categories = [ 'astrohd', 'human_design', 'astrology' ];
		if ( ! in_array( $category, $allowed_categories, true ) ) {
			$category = 'astrohd';
		}

		$row_data = compact( 'label', 'description', 'chart_type', 'category', 'is_enabled', 'is_premium', 'admin_only', 'credit_cost', 'sort_order' );

		if ( $edit_id ) {
			$wpdb->update( $table, $row_data, [ 'id' => $edit_id ] );
			$msg = 'Preset updated.';
		} else {
			$slug = sanitize_title( $label ) . '-' . substr( md5( uniqid() ), 0, 6 );
			$wpdb->insert( $table, array_merge( $row_data, [ 'slug' => $slug ] ) );
			$msg = 'Preset created.';
		}
	}

	$presets     = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY sort_order ASC, label ASC", ARRAY_A ) ?: [];
	$chart_types = [ 'natal' => 'Natal Bodygraph', 'transit' => 'Transits', 'connection' => 'Connection', 'snapshot' => 'Snapshot' ];
	$categories  = [ 'astrohd' => 'AstroHD (Combined)', 'human_design' => 'Human Design', 'astrology' => 'Astrology' ];
	?>
	<div class="wrap">
		<h1>AstroHD — Chart Presets</h1>
		<p>Configure chart presets that appear in the SPA Charts view. Each preset maps to a chart type, can have default inputs, and can be marked as premium.</p>
		<?php if ( $msg ) : ?><div class="notice notice-success"><p><?php echo esc_html( $msg ); ?></p></div><?php endif; ?>

		<h2 class="title">Existing Presets</h2>
		<?php if ( ! $presets ) : ?>
			<p><em>No presets yet. Create one below.</em></p>
		<?php else : ?>
		<table class="widefat striped" style="max-width: 960px; margin-bottom: 24px;">
			<thead><tr>
				<th>Label</th><th>Chart Type</th><th>Category</th>
				<th style="width:70px">Enabled</th><th style="width:70px">Admin Only</th><th style="width:70px">Premium</th>
				<th style="width:80px">Credits</th><th style="width:60px">Order</th><th>Actions</th>
			</tr></thead>
			<tbody>
			<?php foreach ( $presets as $p ) : ?>
				<tr>
					<td><strong><?php echo esc_html( $p['label'] ); ?></strong><br><code><?php echo esc_html( $p['slug'] ); ?></code></td>
					<td><?php echo esc_html( $chart_types[ $p['chart_type'] ] ?? $p['chart_type'] ); ?></td>
					<td><?php echo esc_html( $categories[ $p['category'] ] ?? $p['category'] ); ?></td>
					<td><?php echo $p['is_enabled'] ? '✓' : '—'; ?></td>
					<td><?php echo ! empty( $p['admin_only'] ) ? '✓' : '—'; ?></td>
					<td><?php echo $p['is_premium'] ? '✓' : '—'; ?></td>
					<td><?php echo (int) $p['credit_cost']; ?></td>
					<td><?php echo (int) $p['sort_order']; ?></td>
					<td>
						<form method="post" style="display:inline">
							<?php wp_nonce_field( 'luna_astrohd_preset_delete', 'luna_astrohd_preset_delete_nonce' ); ?>
							<input type="hidden" name="delete_id" value="<?php echo (int) $p['id']; ?>">
							<button type="submit" class="button button-small" onclick="return confirm('Delete this preset?')">Delete</button>
						</form>
					</td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>
		<?php endif; ?>

		<h2 class="title">Create New Preset</h2>
		<form method="post" style="max-width: 640px;">
			<?php wp_nonce_field( 'luna_astrohd_preset_save', 'luna_astrohd_preset_nonce' ); ?>
			<input type="hidden" name="preset_id" value="0">
			<table class="form-table">
				<tr><th>Label</th><td><input class="regular-text" type="text" name="label" required></td></tr>
				<tr><th>Description</th><td><textarea name="description" rows="2" class="large-text"></textarea></td></tr>
				<tr><th>Chart Type</th><td>
					<select name="chart_type">
						<?php foreach ( $chart_types as $k => $v ) : ?>
							<option value="<?php echo esc_attr( $k ); ?>"><?php echo esc_html( $v ); ?></option>
						<?php endforeach; ?>
					</select>
				</td></tr>
				<tr><th>Category</th><td>
					<select name="category">
						<?php foreach ( $categories as $k => $v ) : ?>
							<option value="<?php echo esc_attr( $k ); ?>"><?php echo esc_html( $v ); ?></option>
						<?php endforeach; ?>
					</select>
				</td></tr>
				<tr><th>Enabled</th><td><input type="checkbox" name="is_enabled" value="1" checked></td></tr>
				<tr><th>Admin Only</th><td><input type="checkbox" name="admin_only" value="1"></td></tr>
				<tr><th>Premium</th><td><input type="checkbox" name="is_premium" value="1"></td></tr>
				<tr><th>Credit Cost</th><td><input type="number" name="credit_cost" value="0" min="0" class="small-text"></td></tr>
				<tr><th>Sort Order</th><td><input type="number" name="sort_order" value="0" min="0" class="small-text"></td></tr>
			</table>
			<p><button type="submit" class="button button-primary">Create Preset</button></p>
		</form>
	</div>
	<?php
}

function luna_astrohd_render_chart_settings_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Insufficient permissions.' );
	}

	if ( isset( $_POST['luna_astrohd_chart_settings_nonce'] )
		&& wp_verify_nonce( $_POST['luna_astrohd_chart_settings_nonce'], 'luna_astrohd_chart_settings' ) ) {
		$submitted = isset( $_POST['charts'] ) && is_array( $_POST['charts'] ) ? wp_unslash( $_POST['charts'] ) : [];
		luna_astrohd_update_chart_display_settings( $submitted );

		if ( isset( $_POST['customer_service_email'] ) ) {
			luna_astrohd_update_customer_service_email( $_POST['customer_service_email'] );
		}

		echo '<div class="notice notice-success"><p>Saved.</p></div>';
	}

	$settings = luna_astrohd_get_chart_display_settings();
	$types    = luna_astrohd_chart_types();
	?>
	<div class="wrap">
		<h1>AstroHD — Chart Settings</h1>
		<p>Toggle frontend visibility, mark charts as premium, and set credit costs. Premium charts require credits via <code>lunacco-core</code>'s credit system before the browser runs ephemeris calculations.</p>
		<form method="post">
			<?php wp_nonce_field( 'luna_astrohd_chart_settings', 'luna_astrohd_chart_settings_nonce' ); ?>
			<table class="widefat striped" style="max-width: 900px;">
				<thead>
					<tr>
						<th>Chart</th>
						<th style="width: 100px;">Enabled</th>
						<th style="width: 100px;">Admin Only</th>
						<th style="width: 100px;">Premium</th>
						<th style="width: 140px;">Credit cost</th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ( $types as $key => $label ) :
						$s = $settings[ $key ] ?? [ 'enabled' => true, 'is_premium' => false, 'credit_cost' => 0 ]; ?>
						<tr>
							<td><strong><?php echo esc_html( $label ); ?></strong><br><code><?php echo esc_html( $key ); ?></code></td>
							<td><input type="checkbox" name="charts[<?php echo esc_attr( $key ); ?>][enabled]" value="1" <?php checked( ! empty( $s['enabled'] ) ); ?>></td>
							<td><input type="checkbox" name="charts[<?php echo esc_attr( $key ); ?>][admin_only]" value="1" <?php checked( ! empty( $s['admin_only'] ) ); ?>></td>
							<td><input type="checkbox" name="charts[<?php echo esc_attr( $key ); ?>][is_premium]" value="1" <?php checked( ! empty( $s['is_premium'] ) ); ?>></td>
							<td><input type="number" min="0" step="1" name="charts[<?php echo esc_attr( $key ); ?>][credit_cost]" value="<?php echo esc_attr( (int) $s['credit_cost'] ); ?>" class="small-text"></td>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>

			<h2 class="title">Support Settings</h2>
			<table class="form-table">
				<tr>
					<th scope="row"><label for="customer_service_email">Customer Service Email</label></th>
					<td>
						<input name="customer_service_email" type="email" id="customer_service_email" value="<?php echo esc_attr( luna_astrohd_get_customer_service_email() ); ?>" class="regular-text">
						<p class="description">Used for "Request Completion" links when an incarnation cross definition is missing.</p>
					</td>
				</tr>
			</table>

			<p><button type="submit" class="button button-primary">Save</button></p>
		</form>
	</div>
	<?php
}

function luna_astrohd_render_chart_builder_page(): void {
	wp_safe_redirect( admin_url( 'admin.php?page=lunacco-definitions&tab=chart-presets' ) );
	exit;
	echo '<div class="wrap"><h1>AstroHD — Chart Builder</h1>';
	echo '<p>Bodygraph color theme editor — live preview ships in the SPA-side admin view. Themes stored in <code>' . esc_html( $GLOBALS['wpdb']->prefix ) . 'lt_astrohd_themes</code>.</p>';
	echo '</div>';
}
