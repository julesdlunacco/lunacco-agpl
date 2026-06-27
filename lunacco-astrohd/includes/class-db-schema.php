<?php
/**
 * Luna AstroHD — database schema.
 *
 * All tables prefixed wp_lt_astrohd_*. Uses dbDelta (idempotent).
 * Tables:
 *   - lt_astrohd_definition_sets       Per-user/default definition sets
 *   - lt_astrohd_definition_sections   Individual gate/channel/planet/sign entries
 *   - lt_astrohd_definition_index      Full-text search index (simple keywords column)
 *   - lt_astrohd_charts                Saved natal/transit/connection charts
 *   - lt_astrohd_chart_cache           Cached computed chart JSON (avoid re-WASM)
 *   - lt_astrohd_themes                Bodygraph color presets (chart builder)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Luna_AstroHD_DB_Schema {

	const DB_VERSION_OPTION = 'luna_astrohd_db_version';

	public static function install(): void {
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$p = $wpdb->prefix;

		$sql_sets = "CREATE TABLE {$p}lt_astrohd_definition_sets (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			slug varchar(100) NOT NULL,
			label varchar(150) NOT NULL,
			description text,
			system_type varchar(20) NOT NULL DEFAULT 'hd',
			category varchar(30) NOT NULL DEFAULT 'astrohd',
			owner_id bigint(20) NOT NULL DEFAULT 0,
			is_default tinyint(1) NOT NULL DEFAULT 0,
			is_public tinyint(1) NOT NULL DEFAULT 0,
			sort_order int NOT NULL DEFAULT 0,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY slug (slug),
			KEY owner_id (owner_id),
			KEY system_type (system_type),
			KEY category (category)
		) $charset_collate;";

		$sql_sections = "CREATE TABLE {$p}lt_astrohd_definition_sections (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			set_id bigint(20) NOT NULL,
			section_type varchar(60) NOT NULL,
			item_key varchar(100) NOT NULL,
			title varchar(255) NOT NULL DEFAULT '',
			short_text text,
			long_text longtext,
			keywords text,
			extra_meta longtext,
			image_url varchar(500) DEFAULT '',
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY set_section_item (set_id, section_type, item_key),
			KEY set_id (set_id),
			KEY section_type (section_type)
		) $charset_collate;";

		$sql_index = "CREATE TABLE {$p}lt_astrohd_definition_index (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			section_id bigint(20) NOT NULL,
			token varchar(100) NOT NULL,
			weight smallint NOT NULL DEFAULT 1,
			PRIMARY KEY  (id),
			KEY token (token),
			KEY section_id (section_id)
		) $charset_collate;";

		$sql_charts = "CREATE TABLE {$p}lt_astrohd_charts (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			user_id bigint(20) NOT NULL,
			chart_type varchar(40) NOT NULL,
			title varchar(255) NOT NULL DEFAULT '',
			person_id bigint(20) DEFAULT NULL,
			input_data longtext NOT NULL,
			chart_data longtext,
			tags longtext,
			notes longtext,
			is_profile_chart tinyint(1) NOT NULL DEFAULT 0,
			cost_type varchar(20) NOT NULL DEFAULT 'free',
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY user_id (user_id),
			KEY chart_type (chart_type),
			KEY is_profile_chart (is_profile_chart)
		) $charset_collate;";

		// NOTE: lt_astrohd_chart_cache (the input-hash chart cache) was removed — it was
		// written but never read (views use the per-person chart_cache column). No longer
		// created; the existing table can be dropped.

		$sql_themes = "CREATE TABLE {$p}lt_astrohd_themes (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			user_id bigint(20) NOT NULL DEFAULT 0,
			slug varchar(100) NOT NULL,
			label varchar(150) NOT NULL,
			is_default tinyint(1) NOT NULL DEFAULT 0,
			tokens longtext NOT NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY user_slug (user_id, slug),
			KEY is_default (is_default)
		) $charset_collate;";

		$sql_chart_presets = "CREATE TABLE {$p}lt_astrohd_chart_presets (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			slug varchar(100) NOT NULL,
			label varchar(200) NOT NULL,
			description text,
			chart_type varchar(40) NOT NULL DEFAULT 'natal',
			category varchar(30) NOT NULL DEFAULT 'astrohd',
			default_inputs longtext,
			is_enabled tinyint(1) NOT NULL DEFAULT 1,
			is_premium tinyint(1) NOT NULL DEFAULT 0,
			admin_only tinyint(1) NOT NULL DEFAULT 0,
			credit_cost int NOT NULL DEFAULT 0,
			sort_order int NOT NULL DEFAULT 0,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY slug (slug),
			KEY chart_type (chart_type),
			KEY category (category),
			KEY is_enabled (is_enabled)
		) $charset_collate;";

		dbDelta( $sql_sets );
		dbDelta( $sql_sections );
		dbDelta( $sql_index );
		dbDelta( $sql_charts );
		dbDelta( $sql_themes );
		dbDelta( $sql_chart_presets );

		update_option( self::DB_VERSION_OPTION, LUNA_ASTROHD_VERSION );

		// Seed default set if nothing exists yet.
		if ( class_exists( 'Luna_AstroHD_Definition_Manager' ) ) {
			Luna_AstroHD_Definition_Manager::seed_default_set_if_empty();
		}
	}
}

// Run dbDelta when plugin version changes (idempotent).
add_action( 'plugins_loaded', function () {
	if ( get_option( Luna_AstroHD_DB_Schema::DB_VERSION_OPTION, '0' ) !== LUNA_ASTROHD_VERSION ) {
		Luna_AstroHD_DB_Schema::install();
	}
}, 25 );
