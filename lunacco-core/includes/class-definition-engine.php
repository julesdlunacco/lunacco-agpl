<?php
/**
 * Shared definition engine for all LunaCco modules.
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_Definition_Engine {

	public const DB_VERSION = '1.3.0';
	public const DB_VERSION_OPTION = 'lunacco_definition_engine_db_version';

	/** @var array<string, array<string, mixed>> */
	private array $module_contracts = [];

	public function __construct() {
		add_action( 'plugins_loaded', [ $this, 'ensure_schema_if_needed' ], 30 );
	}

	public function ensure_schema_if_needed(): void {
		if ( get_option( self::DB_VERSION_OPTION, '0' ) !== self::DB_VERSION ) {
			$this->ensure_schema();
		}
	}

	public function ensure_schema(): void {
		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset_collate = $wpdb->get_charset_collate();
		$p               = $wpdb->prefix . 'lunacco_def_';

		$sql_sets = "CREATE TABLE {$p}sets (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			slug varchar(120) NOT NULL,
			label varchar(190) NOT NULL,
			description text NULL,
			set_type varchar(60) NOT NULL DEFAULT 'base',
			owner_id bigint(20) NOT NULL DEFAULT 0,
			is_default tinyint(1) NOT NULL DEFAULT 0,
			is_public tinyint(1) NOT NULL DEFAULT 0,
			is_enabled tinyint(1) NOT NULL DEFAULT 1,
			sort_order int NOT NULL DEFAULT 0,
			metadata_json longtext NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY slug (slug),
			KEY owner_id (owner_id),
			KEY set_type (set_type),
			KEY is_default (is_default),
			KEY is_enabled (is_enabled)
		) {$charset_collate};";

		$sql_set_modules = "CREATE TABLE {$p}set_modules (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			set_id bigint(20) NOT NULL,
			module_id varchar(80) NOT NULL,
			system_key varchar(80) NOT NULL DEFAULT '',
			is_required tinyint(1) NOT NULL DEFAULT 0,
			sort_order int NOT NULL DEFAULT 0,
			metadata_json longtext NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY set_module_system (set_id, module_id, system_key),
			KEY module_id (module_id),
			KEY set_id (set_id)
		) {$charset_collate};";

		$sql_entities = "CREATE TABLE {$p}entities (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			module_id varchar(80) NOT NULL,
			entity_type varchar(80) NOT NULL,
			entity_key varchar(120) NOT NULL,
			label varchar(190) NOT NULL DEFAULT '',
			description text NULL,
			metadata_json longtext NULL,
			is_enabled tinyint(1) NOT NULL DEFAULT 1,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY module_type_key (module_id, entity_type, entity_key),
			KEY entity_type (entity_type),
			KEY entity_key (entity_key),
			KEY module_id (module_id)
		) {$charset_collate};";

		$sql_relationships = "CREATE TABLE {$p}entity_relationships (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			source_entity_id bigint(20) NOT NULL,
			relationship_type varchar(80) NOT NULL,
			target_entity_id bigint(20) NOT NULL,
			sort_order int NOT NULL DEFAULT 0,
			is_enabled tinyint(1) NOT NULL DEFAULT 1,
			metadata_json longtext NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY source_entity_id (source_entity_id),
			KEY target_entity_id (target_entity_id),
			KEY relationship_type (relationship_type)
		) {$charset_collate};";

		$sql_entries = "CREATE TABLE {$p}entries (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			set_id bigint(20) NOT NULL,
			module_id varchar(80) NOT NULL DEFAULT '',
			entry_key varchar(120) NOT NULL,
			title varchar(190) NOT NULL DEFAULT '',
			entry_kind varchar(40) NOT NULL DEFAULT 'atomic',
			output_context varchar(80) NOT NULL DEFAULT '',
			template_id bigint(20) NULL,
			specificity_score int NOT NULL DEFAULT 0,
			sort_order int NOT NULL DEFAULT 0,
			is_enabled tinyint(1) NOT NULL DEFAULT 1,
			is_public tinyint(1) NOT NULL DEFAULT 0,
			legacy_source varchar(120) NOT NULL DEFAULT '',
			metadata_json longtext NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY set_entry_key (set_id, entry_key),
			KEY set_id (set_id),
			KEY module_id (module_id),
			KEY output_context (output_context),
			KEY entry_kind (entry_kind)
		) {$charset_collate};";

		$sql_entry_entities = "CREATE TABLE {$p}entry_entities (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			entry_id bigint(20) NOT NULL,
			entity_id bigint(20) NOT NULL,
			role_key varchar(80) NOT NULL DEFAULT 'primary',
			match_operator varchar(20) NOT NULL DEFAULT 'all_of',
			sort_order int NOT NULL DEFAULT 0,
			metadata_json longtext NULL,
			PRIMARY KEY (id),
			UNIQUE KEY entry_entity_role (entry_id, entity_id, role_key),
			KEY entry_id (entry_id),
			KEY entity_id (entity_id)
		) {$charset_collate};";

		$sql_entry_slots = "CREATE TABLE {$p}entry_slots (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			entry_id bigint(20) NOT NULL,
			slot_key varchar(80) NOT NULL,
			slot_value longtext NULL,
			slot_format varchar(20) NOT NULL DEFAULT 'text',
			output_context varchar(80) NOT NULL DEFAULT '',
			is_required tinyint(1) NOT NULL DEFAULT 0,
			sort_order int NOT NULL DEFAULT 0,
			metadata_json longtext NULL,
			PRIMARY KEY (id),
			KEY entry_id (entry_id),
			KEY slot_key (slot_key),
			KEY output_context (output_context)
		) {$charset_collate};";

		$sql_templates = "CREATE TABLE {$p}templates (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			set_id bigint(20) NOT NULL,
			module_id varchar(80) NOT NULL DEFAULT '',
			template_key varchar(120) NOT NULL,
			title varchar(190) NOT NULL DEFAULT '',
			output_context varchar(80) NOT NULL DEFAULT '',
			render_mode varchar(40) NOT NULL DEFAULT 'slot_concat',
			is_enabled tinyint(1) NOT NULL DEFAULT 1,
			sort_order int NOT NULL DEFAULT 0,
			metadata_json longtext NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY set_template_key (set_id, template_key),
			KEY set_id (set_id),
			KEY module_id (module_id),
			KEY output_context (output_context)
		) {$charset_collate};";

		$sql_template_rules = "CREATE TABLE {$p}template_rules (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			template_id bigint(20) NOT NULL,
			rule_key varchar(120) NOT NULL,
			rule_type varchar(40) NOT NULL DEFAULT 'slot',
			source_type varchar(40) NOT NULL DEFAULT 'matched_entry',
			source_ref varchar(190) NOT NULL DEFAULT '',
			slot_key varchar(80) NOT NULL DEFAULT '',
			fallback_slot_key varchar(80) NOT NULL DEFAULT '',
			prefix_text text NULL,
			suffix_text text NULL,
			sort_order int NOT NULL DEFAULT 0,
			metadata_json longtext NULL,
			PRIMARY KEY (id),
			KEY template_id (template_id),
			KEY rule_type (rule_type),
			KEY source_type (source_type)
		) {$charset_collate};";

		$sql_render_logs = "CREATE TABLE {$p}render_logs (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			set_id bigint(20) NOT NULL,
			module_id varchar(80) NOT NULL DEFAULT '',
			output_context varchar(80) NOT NULL DEFAULT '',
			request_hash varchar(64) NOT NULL,
			resolution_mode varchar(40) NOT NULL DEFAULT '',
			payload_json longtext NULL,
			result_json longtext NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY set_id (set_id),
			KEY request_hash (request_hash),
			KEY created_at (created_at)
		) {$charset_collate};";

		$sql_chart_presets = "CREATE TABLE {$p}chart_presets (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			set_id bigint(20) NOT NULL DEFAULT 0,
			module_id varchar(80) NOT NULL DEFAULT '',
			preset_key varchar(120) NOT NULL,
			title varchar(190) NOT NULL DEFAULT '',
			description text NULL,
			chart_type varchar(80) NOT NULL DEFAULT '',
			output_context varchar(80) NOT NULL DEFAULT 'chart_snippet',
			is_enabled tinyint(1) NOT NULL DEFAULT 1,
			sort_order int NOT NULL DEFAULT 0,
			config_json longtext NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY set_preset_key (set_id, preset_key),
			KEY set_id (set_id),
			KEY module_id (module_id),
			KEY chart_type (chart_type),
			KEY is_enabled (is_enabled)
		) {$charset_collate};";

		$sql_variants = "CREATE TABLE {$p}entry_variants (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			entry_id bigint(20) NOT NULL,
			variant_key varchar(160) NOT NULL,
			chart_context varchar(80) NOT NULL DEFAULT '',
			output_context varchar(80) NOT NULL DEFAULT '',
			overlay_key varchar(80) NOT NULL DEFAULT 'base',
			tone_key varchar(80) NOT NULL DEFAULT 'default',
			audience_key varchar(80) NOT NULL DEFAULT '',
			status varchar(40) NOT NULL DEFAULT 'draft',
			slots_json longtext NULL,
			theme_weights_json longtext NULL,
			metadata_json longtext NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY entry_variant (entry_id, variant_key),
			KEY entry_id (entry_id),
			KEY chart_context (chart_context),
			KEY output_context (output_context),
			KEY overlay_key (overlay_key),
			KEY tone_key (tone_key),
			KEY status (status)
		) {$charset_collate};";

		$sql_tags = "CREATE TABLE {$p}tags (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			tag_key varchar(120) NOT NULL,
			label varchar(190) NOT NULL DEFAULT '',
			tag_group varchar(80) NOT NULL DEFAULT 'theme',
			description text NULL,
			metadata_json longtext NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY tag_key (tag_key),
			KEY tag_group (tag_group)
		) {$charset_collate};";

		$sql_tag_synonyms = "CREATE TABLE {$p}tag_synonyms (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			tag_id bigint(20) NOT NULL,
			synonym varchar(190) NOT NULL,
			weight smallint NOT NULL DEFAULT 1,
			PRIMARY KEY (id),
			UNIQUE KEY tag_synonym (tag_id, synonym),
			KEY tag_id (tag_id),
			KEY synonym (synonym)
		) {$charset_collate};";

		$sql_entry_tags = "CREATE TABLE {$p}entry_tags (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			entry_id bigint(20) NOT NULL,
			tag_id bigint(20) NOT NULL,
			source varchar(40) NOT NULL DEFAULT 'manual',
			weight smallint NOT NULL DEFAULT 1,
			metadata_json longtext NULL,
			PRIMARY KEY (id),
			UNIQUE KEY entry_tag (entry_id, tag_id),
			KEY entry_id (entry_id),
			KEY tag_id (tag_id),
			KEY source (source)
		) {$charset_collate};";

		$sql_theme_weights = "CREATE TABLE {$p}theme_weights (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			entry_id bigint(20) NOT NULL,
			variant_id bigint(20) NOT NULL DEFAULT 0,
			tag_id bigint(20) NOT NULL,
			weight smallint NOT NULL DEFAULT 1,
			source varchar(40) NOT NULL DEFAULT 'manual',
			metadata_json longtext NULL,
			PRIMARY KEY (id),
			UNIQUE KEY weighted_theme (entry_id, variant_id, tag_id),
			KEY entry_id (entry_id),
			KEY variant_id (variant_id),
			KEY tag_id (tag_id)
		) {$charset_collate};";

		dbDelta( $sql_sets );
		dbDelta( $sql_set_modules );
		dbDelta( $sql_entities );
		dbDelta( $sql_relationships );
		dbDelta( $sql_entries );
		dbDelta( $sql_entry_entities );
		dbDelta( $sql_entry_slots );
		dbDelta( $sql_templates );
		dbDelta( $sql_template_rules );
		dbDelta( $sql_render_logs );
		dbDelta( $sql_chart_presets );
		dbDelta( $sql_variants );
		$sql_search_index = "CREATE TABLE {$p}search_index (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			entry_id bigint(20) NOT NULL,
			set_id bigint(20) NOT NULL DEFAULT 0,
			module_id varchar(80) NOT NULL DEFAULT '',
			entity_type varchar(80) NOT NULL DEFAULT '',
			entity_key varchar(120) NOT NULL DEFAULT '',
			title varchar(190) NOT NULL DEFAULT '',
			body longtext NULL,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY entry_id (entry_id),
			KEY set_id (set_id),
			KEY module_id (module_id),
			KEY entity_type (entity_type),
			FULLTEXT KEY search_body (title, body)
		) {$charset_collate};";

		dbDelta( $sql_tags );
		dbDelta( $sql_tag_synonyms );
		dbDelta( $sql_entry_tags );
		dbDelta( $sql_theme_weights );
		dbDelta( $sql_search_index );

		update_option( self::DB_VERSION_OPTION, self::DB_VERSION, false );
	}

	public function register_module_contract( string $module_id, array $contract ): void {
		$this->module_contracts[ $module_id ] = wp_parse_args( $contract, [
			'label'              => $module_id,
			'entity_types'       => [],
			'relationship_types' => [],
			'output_contexts'    => array_keys( $this->get_slot_style_guide() ),
			'seed_scaffolds'     => [],
			'resolver_inputs'    => [],
			'default_templates'  => [],
		] );
	}

	/** @return array<string, array<string, mixed>> */
	public function get_module_contracts(): array {
		return $this->module_contracts;
	}

	/** @return array<string, array<string, mixed>> */
	public function get_slot_style_guide(): array {
		return [
			// Doc-aligned standalone definitions — render on their own in tooltips, chart boxes, reports.
			'short_def'         => [ 'purpose' => 'Standalone: short definition for tooltips and quick chart surfaces', 'target_length' => '12-45 words', 'audience' => 'general', 'template_safe' => false, 'group' => 'definition', 'kind' => 'standalone' ],
			'long_def'          => [ 'purpose' => 'Standalone: full definition for panels and reports', 'target_length' => '60-220 words', 'audience' => 'general', 'template_safe' => false, 'group' => 'definition', 'kind' => 'standalone' ],
			'shadow_recessive'  => [ 'purpose' => 'Standalone: recessive shadow expression (collapsing inward / withdrawn)', 'target_length' => '20-110 words', 'audience' => 'general', 'template_safe' => false, 'group' => 'polarity', 'kind' => 'standalone', 'subfield' => [ 'parent' => 'shadow', 'area' => 'recessive' ] ],
			'shadow_reactive'   => [ 'purpose' => 'Standalone: reactive shadow expression (pushing outward / charged)', 'target_length' => '20-110 words', 'audience' => 'general', 'template_safe' => false, 'group' => 'polarity', 'kind' => 'standalone', 'subfield' => [ 'parent' => 'shadow', 'area' => 'reactive' ] ],
			'gift'              => [ 'purpose' => 'Standalone: gift / higher expression', 'target_length' => '20-130 words', 'audience' => 'general', 'template_safe' => false, 'group' => 'polarity', 'kind' => 'standalone' ],
			'coaching_key_notes'=> [ 'purpose' => 'Standalone: key coaching notes for readers/coaches', 'target_length' => '3-8 bullets', 'audience' => 'reader', 'template_safe' => false, 'group' => 'coaching', 'kind' => 'standalone' ],
			'coaching_questions'=> [ 'purpose' => 'Standalone: coaching questions to ask (later tier)', 'target_length' => '3-8 questions', 'audience' => 'reader', 'template_safe' => false, 'group' => 'coaching', 'kind' => 'standalone' ],
			'coaching_notes'    => [ 'purpose' => 'Standalone: extended coaching notes (later tier)', 'target_length' => '60-200 words', 'audience' => 'reader', 'template_safe' => false, 'group' => 'coaching', 'kind' => 'standalone' ],
			'relationships'     => [ 'purpose' => 'Data: related entities — e.g. gate→channel, circuit, center, quarter (one per line)', 'target_length' => 'list', 'audience' => 'system', 'template_safe' => false, 'group' => 'data', 'kind' => 'standalone' ],
			'projected'         => [ 'purpose' => 'Data: is this a projected gate/channel? (Yes / No)', 'target_length' => '1 word', 'audience' => 'system', 'template_safe' => false, 'group' => 'data', 'kind' => 'standalone' ],

			'theme_short'       => [ 'purpose' => 'Reusable core theme phrase for cards, headings, and synthesis labels', 'target_length' => '3-18 words', 'audience' => 'system', 'template_safe' => true, 'group' => 'core' ],
			'theme_long'        => [ 'purpose' => 'Fragment: core meaning paragraph for templates and fallback text', 'target_length' => '35-120 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'core' ],
			'keywords'          => [ 'purpose' => 'Comma-separated search and auto-tag seed terms. Used for tag suggestions.', 'target_length' => '5-20 terms', 'audience' => 'system', 'template_safe' => true, 'group' => 'core' ],
			'gift_short'        => [ 'purpose' => 'Compact gift or strength language for quick chart surfaces', 'target_length' => '8-35 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'polarity' ],
			'gift_long'         => [ 'purpose' => 'Expanded gift language for paid reports and reader context', 'target_length' => '70-180 words', 'audience' => 'general', 'template_safe' => false, 'group' => 'polarity' ],
			'shadow_short'      => [ 'purpose' => 'Compact shadow/tension language for quick chart surfaces', 'target_length' => '8-35 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'polarity' ],
			'shadow_long'       => [ 'purpose' => 'Expanded shadow pattern language for paid reports and reader context', 'target_length' => '70-180 words', 'audience' => 'general', 'template_safe' => false, 'group' => 'polarity' ],
			'growth_short'      => [ 'purpose' => 'Brief integration or growth direction', 'target_length' => '8-40 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'polarity' ],
			'growth_long'       => [ 'purpose' => 'Expanded integration language for reports and coaching', 'target_length' => '70-180 words', 'audience' => 'general', 'template_safe' => false, 'group' => 'polarity' ],
			'full_sidebar'      => [ 'purpose' => 'Standalone: complete short sidebar definition', 'target_length' => '12-70 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'output' ],
			'full_chart'        => [ 'purpose' => 'Standalone: complete chart panel definition', 'target_length' => '25-120 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'output' ],
			'full_report'       => [ 'purpose' => 'Standalone: complete medium report block', 'target_length' => '45-180 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'output' ],
			'full_pdf'          => [ 'purpose' => 'Standalone: complete long-form PDF/report definition', 'target_length' => '140-420 words', 'audience' => 'general', 'template_safe' => false, 'group' => 'output' ],
			'full_reader'       => [ 'purpose' => 'Standalone: complete reader/practitioner interpretation notes', 'target_length' => '4-10 bullets or 80-220 words', 'audience' => 'reader', 'template_safe' => false, 'group' => 'output' ],
			'full_ai_context'   => [ 'purpose' => 'Standalone: complete AI/synthesis grounding context', 'target_length' => '60-200 words', 'audience' => 'system', 'template_safe' => true, 'group' => 'output' ],
			'sidebar_short'     => [ 'purpose' => 'Legacy alias for full_sidebar; prefer full_sidebar for new work', 'target_length' => '12-70 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'legacy_output' ],
			'chart_snippet'     => [ 'purpose' => 'Legacy alias for full_chart; prefer full_chart for new work', 'target_length' => '25-120 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'legacy_output' ],
			'report_snippet'    => [ 'purpose' => 'Legacy alias for full_report; prefer full_report for new work', 'target_length' => '45-180 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'legacy_output' ],
			'pdf_long'          => [ 'purpose' => 'Legacy alias for full_pdf; prefer full_pdf for new work', 'target_length' => '140-420 words', 'audience' => 'general', 'template_safe' => false, 'group' => 'legacy_output' ],
			'reader_keynotes'   => [ 'purpose' => 'Reader-facing session notes, bullets, angles, and interpretation cues', 'target_length' => '3-8 bullets', 'audience' => 'reader', 'template_safe' => true, 'group' => 'output' ],
			'ai_context'        => [ 'purpose' => 'Grounding context used by optional AI/synthesis features', 'target_length' => '50-180 words', 'audience' => 'system', 'template_safe' => true, 'group' => 'output' ],
			'style_short'       => [ 'purpose' => 'Short style/expression phrase, especially for signs and lenses', 'target_length' => '3-18 words', 'audience' => 'system', 'template_safe' => true, 'group' => 'template_token' ],
			'style_long'        => [ 'purpose' => 'Expanded style/expression language for signs, tones, or lenses', 'target_length' => '30-110 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'template_token' ],
			'area_short'        => [ 'purpose' => 'Short life-area phrase, especially for houses', 'target_length' => '3-18 words', 'audience' => 'system', 'template_safe' => true, 'group' => 'template_token' ],
			'area_long'         => [ 'purpose' => 'Expanded life-area language, especially for houses', 'target_length' => '30-110 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'template_token' ],
			'dynamic_short'     => [ 'purpose' => 'Short interaction/dynamic phrase, especially for aspects and combos', 'target_length' => '3-24 words', 'audience' => 'system', 'template_safe' => true, 'group' => 'template_token' ],
			'dynamic_long'      => [ 'purpose' => 'Expanded interaction/dynamic language, especially for aspects and combos', 'target_length' => '40-140 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'template_token' ],
			'modifier_short'    => [ 'purpose' => 'Short modifier phrase for dignity, retrograde, motion, rulership, definition states, etc.', 'target_length' => '5-35 words', 'audience' => 'system', 'template_safe' => true, 'group' => 'template_token' ],
			'modifier_long'     => [ 'purpose' => 'Expanded modifier language for reports', 'target_length' => '35-130 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'template_token' ],
			'angel_theme_short' => [ 'purpose' => 'Short angel overlay theme phrase', 'target_length' => '3-18 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'angel' ],
			'angel_theme_long'  => [ 'purpose' => 'Expanded angel overlay interpretation for Sun, Moon, Rising, or HD incarnation cross placements', 'target_length' => '70-220 words', 'audience' => 'general', 'template_safe' => false, 'group' => 'angel' ],
			'angel_gift_short'  => [ 'purpose' => 'Short gift language for an angel overlay', 'target_length' => '8-35 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'angel' ],
			'angel_gift_long'   => [ 'purpose' => 'Expanded gift language for an angel overlay', 'target_length' => '70-180 words', 'audience' => 'general', 'template_safe' => false, 'group' => 'angel' ],
			'angel_shadow_short'=> [ 'purpose' => 'Short shadow/tension language for an angel overlay', 'target_length' => '8-35 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'angel' ],
			'angel_shadow_long' => [ 'purpose' => 'Expanded shadow/tension language for an angel overlay', 'target_length' => '70-180 words', 'audience' => 'general', 'template_safe' => false, 'group' => 'angel' ],
			'angel_guidance_short' => [ 'purpose' => 'Short practical guidance for an angel overlay', 'target_length' => '8-35 words', 'audience' => 'general', 'template_safe' => true, 'group' => 'angel' ],
			'angel_guidance_long'  => [ 'purpose' => 'Expanded practical guidance for an angel overlay', 'target_length' => '70-180 words', 'audience' => 'general', 'template_safe' => false, 'group' => 'angel' ],
			'journal_prompt'    => [ 'purpose' => 'Journal or reflection prompt', 'target_length' => '1-3 prompts', 'audience' => 'general', 'template_safe' => true, 'group' => 'practice' ],
			'affirmation'       => [ 'purpose' => 'Affirmation or integration statement', 'target_length' => '1-3 sentences', 'audience' => 'general', 'template_safe' => true, 'group' => 'practice' ],
			'practice_prompt'   => [ 'purpose' => 'Concrete embodiment, ritual, business, relationship, or shadow-work practice', 'target_length' => '2-8 steps or bullets', 'audience' => 'general', 'template_safe' => true, 'group' => 'practice' ],
			'synthesis_note'    => [ 'purpose' => 'Optional helper note for repeated-theme synthesis. Tags drive the scoring automatically.', 'target_length' => '25-120 words', 'audience' => 'system', 'template_safe' => true, 'group' => 'synthesis' ],
			'accepted_tags'     => [ 'purpose' => 'Canonical tags approved for this entry; auto-tag suggestions can fill this later', 'target_length' => 'comma-separated list', 'audience' => 'system', 'template_safe' => false, 'group' => 'synthesis' ],
		];
	}

	/**
	 * The "light" MVP layers pre-seeded as empty placeholders on every atom, so the
	 * worksheet opens with the fast-fill fields ready to type into.
	 *
	 * @return array<int, string>
	 */
	public function get_mvp_slot_layers(): array {
		// Default standalone layers pre-seeded on every atom (sections add shadow/gift etc.).
		return [ 'short_def', 'long_def', 'coaching_key_notes', 'keywords' ];
	}

	/**
	 * The full set of light "MVP" layers across sections — used for tier tagging.
	 *
	 * @return array<int, string>
	 */
	public function get_mvp_tier_layers(): array {
		return [ 'short_def', 'long_def', 'shadow_recessive', 'shadow_reactive', 'gift', 'coaching_key_notes', 'keywords' ];
	}

	/**
	 * Per-layer authoring tier so the worksheet can show "light vs advanced" options:
	 * mvp = light fields, advanced = available depth, legacy = aliases to avoid.
	 *
	 * @return array<string, string>
	 */
	public function get_slot_tiers(): array {
		$mvp   = array_flip( $this->get_mvp_tier_layers() );
		$tiers = [];
		foreach ( $this->get_slot_style_guide() as $key => $config ) {
			$group = (string) ( $config['group'] ?? '' );
			if ( isset( $mvp[ $key ] ) ) {
				$tiers[ $key ] = 'mvp';
			} elseif ( 'legacy_output' === $group ) {
				$tiers[ $key ] = 'legacy';
			} else {
				$tiers[ $key ] = 'advanced';
			}
		}
		return $tiers;
	}

	/**
	 * Whether a layer is a standalone definition (renders alone) or a template
	 * fragment (only woven into synthesis). Derived from group + explicit kind hint.
	 */
	public function slot_kind( string $layer, array $config = [] ): string {
		if ( ! empty( $config['kind'] ) ) {
			return (string) $config['kind'];
		}
		$group = (string) ( $config['group'] ?? '' );
		if ( in_array( $group, [ 'template_token', 'core', 'synthesis' ], true ) ) {
			return 'fragment';
		}
		// output / definition / polarity / coaching / practice / angel / legacy_output render standalone.
		return 'standalone';
	}

	/**
	 * Worksheet blueprint: the style guide enriched with layer key, tier, and kind
	 * (fragment vs standalone), for the worksheet and the /style-guide REST route.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public function get_slot_blueprint(): array {
		$tiers = $this->get_slot_tiers();
		$out   = [];
		foreach ( $this->get_slot_style_guide() as $key => $config ) {
			$out[ $key ] = array_merge( $config, [
				'layer' => $key,
				'tier'  => $tiers[ $key ] ?? 'advanced',
				'kind'  => $this->slot_kind( $key, $config ),
			] );
		}
		return $out;
	}

	/**
	 * Per-section authoring blueprint: for each AstroHD atom entity type, which
	 * standalone layers, fragment layers, subfields, and modifiers apply, plus whether
	 * the section carries the Personality/Design side. The worksheet and seeder both
	 * read this so placeholders and UI are section-correct.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public function get_astrohd_blueprints(): array {
		// Defaults every atom gets. Standalone = renders alone; fragments = woven into
		// synthesis templates (theme_short/long are the core template pieces; keywords seeds
		// search/auto-tagging). Templates need these — keywords alone is not enough.
		$base_standalone = [ 'short_def', 'long_def', 'coaching_key_notes' ];
		$base_fragment   = [ 'theme_short', 'theme_long', 'keywords' ];
		$shadow_gift     = [ 'shadow_recessive', 'shadow_reactive', 'gift' ];

		$mk = static function ( string $system, string $label, array $opts = [] ) use ( $base_standalone, $base_fragment, $shadow_gift ): array {
			$standalone = $base_standalone;
			if ( ! empty( $opts['shadow_gift'] ) ) {
				$standalone = array_merge( $standalone, $shadow_gift );
			}
			if ( ! empty( $opts['standalone_extra'] ) ) {
				$standalone = array_merge( $standalone, (array) $opts['standalone_extra'] );
			}
			// Full replacement of the standalone/fragment sets (e.g. a snippet-only atom).
			if ( isset( $opts['standalone'] ) ) {
				$standalone = (array) $opts['standalone'];
			}
			$fragments = isset( $opts['fragment'] )
				? (array) $opts['fragment']
				: array_merge( $base_fragment, (array) ( $opts['fragment_extra'] ?? [] ) );
			return [
				'system'            => $system,
				'label'             => $label,
				'standalone_layers' => array_values( array_unique( $standalone ) ),
				'fragment_layers'   => array_values( array_unique( $fragments ) ),
				'subfields'         => ! empty( $opts['shadow_gift'] ) ? [ 'shadow' => [ 'recessive', 'reactive' ] ] : [],
				'modifiers'         => (array) ( $opts['modifiers'] ?? [] ),
				'has_side'          => ! empty( $opts['has_side'] ),
			];
		};

		$hd = 'Human Design';
		$as = 'Astrology';

		$blueprints = [
			// Human Design
			'hd_gate'             => $mk( $hd, 'Gates', [ 'shadow_gift' => true, 'modifiers' => [ 'line' ], 'standalone_extra' => [ 'relationships', 'projected' ] ] ),
			'hd_channel'          => $mk( $hd, 'Channels', [ 'shadow_gift' => true, 'standalone_extra' => [ 'relationships', 'projected' ] ] ),
			'hd_center'           => $mk( $hd, 'Centers', [ 'shadow_gift' => true, 'modifiers' => [ 'state', 'shadow_chart' ] ] ),
			'hd_type'             => $mk( $hd, 'Types' ),
			'hd_strategy'         => $mk( $hd, 'Strategies' ),
			'hd_authority'        => $mk( $hd, 'Authorities' ),
			'hd_profile'          => $mk( $hd, 'Profiles', [ 'modifiers' => [ 'modality' ] ] ),
			'hd_line'             => $mk( $hd, 'Lines', [ 'modifiers' => [ 'fixation' ] ] ),
			'hd_circuitry'        => $mk( $hd, 'Circuitry' ),
			'hd_quarter'          => $mk( $hd, 'Quarters' ),
			'hd_definition_type'  => $mk( $hd, 'Definition' ),
			'hd_incarnation_cross'=> $mk( $hd, 'Incarnation Crosses' ),
			// Variables, reworked: the arrow itself is just a quick "this arrow is about…"
			// snippet; the *meat* lives in each color+direction combo (hd_variable_color),
			// and tones are the flavor modifiers, authored once per side (hd_variable_tone).
			'hd_variable'         => $mk( $hd, 'Variable Arrows', [ 'standalone' => [ 'short_def' ], 'fragment' => [ 'keywords' ] ] ),
			'hd_variable_color'   => $mk( $hd, 'Variable Colors & Directions', [ 'standalone_extra' => [ 'gift', 'shadow_recessive' ] ] ),
			'hd_variable_tone'    => $mk( $hd, 'Variable Tones', [ 'standalone' => [ 'short_def', 'long_def' ], 'fragment' => [ 'keywords' ] ] ),
			'hd_destiny_point'    => $mk( $hd, 'Destiny Points' ),
			// Astrology
			'astro_planet'        => $mk( $as, 'Planets', [ 'has_side' => true, 'modifiers' => [ 'dignity', 'motion', 'stellium' ] ] ),
			'astro_sign'          => $mk( $as, 'Signs', [ 'shadow_gift' => true, 'fragment_extra' => [ 'style_short', 'style_long' ] ] ),
			'astro_house'         => $mk( $as, 'Houses', [ 'fragment_extra' => [ 'area_short', 'area_long' ], 'modifiers' => [ 'house_ruler', 'chart_ruler' ] ] ),
			'astro_house_cusp'    => $mk( $as, 'House Cusps' ),
			'astro_aspect'        => $mk( $as, 'Aspects', [ 'fragment_extra' => [ 'dynamic_short', 'dynamic_long' ] ] ),
			'astro_angle_point'   => $mk( $as, 'Angles & Points', [ 'has_side' => true ] ),
			'astro_asteroid'      => $mk( $as, 'Asteroids', [ 'has_side' => true ] ),
			'astro_element'       => $mk( $as, 'Elements' ),
			'astro_modality'      => $mk( $as, 'Modalities' ),
			'astro_hemisphere_quadrant' => $mk( $as, 'Hemispheres & Quadrants' ),
			'astro_moon_phase'    => $mk( $as, 'Moon Phases' ),
			'astro_chart_pattern' => $mk( $as, 'Chart Patterns' ),
			// Decans — 3 per sign (36). Authored once as astrology atoms; numerology
			// references them by compound number (see luna-numerology association map).
			'astro_decanate'      => $mk( $as, 'Decanates', [ 'shadow_gift' => true ] ),
		];

		// 72 Shem HaMephorash angels — overlay atoms that resolve against the big three
		// (Sun/Moon/Rising) and the HD incarnation cross. Uses the dedicated angel_* slot
		// layers (theme / gift / shadow / guidance) so the worksheet opens with angel-specific
		// fields, and groups under the "Angels" rail system.
		$blueprints['angel_shem'] = $mk( 'Angels', 'Shem Angels', [
			'standalone' => [ 'short_def', 'long_def', 'angel_gift_short', 'angel_gift_long', 'angel_shadow_short', 'angel_shadow_long', 'angel_guidance_short', 'angel_guidance_long' ],
			'fragment'   => [ 'angel_theme_short', 'angel_theme_long', 'keywords' ],
		] );

		// Sabian symbols get their own area, split into the 12 signs as sections so
		// the 360 degrees are easy to edit one sign at a time.
		foreach ( [ 'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces' ] as $sign ) {
			$blueprints[ 'sabian_' . $sign ] = $mk( 'Sabian', ucfirst( $sign ), [ 'shadow_gift' => true ] );
		}

		/**
		 * Let modules contribute their own section blueprints (e.g. numerology's
		 * num_pythagorean / num_adn) without crossing the AGPL file boundary — they
		 * receive the same `$mk( $system, $label, $opts )` builder so the shape stays
		 * consistent, and add keys to the blueprint map by reference of the return.
		 *
		 * @param array<string,array> $blueprints Accumulated blueprints.
		 * @param callable            $mk         Blueprint builder: ($system,$label,$opts).
		 */
		$blueprints = apply_filters( 'lunacco_definition_blueprints', $blueprints, $mk );

		return $blueprints;
	}

	public function create_or_update_set( array $data ): array|WP_Error {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_sets';
		$id    = (int) ( $data['id'] ?? 0 );
		$slug  = sanitize_title( (string) ( $data['slug'] ?? '' ) );
		$label = sanitize_text_field( (string) ( $data['label'] ?? '' ) );

		if ( '' === $slug || '' === $label ) {
			return new WP_Error( 'missing_fields', 'Set slug and label are required.' );
		}

		$row = [
			'slug'          => $slug,
			'label'         => $label,
			'description'   => sanitize_textarea_field( (string) ( $data['description'] ?? '' ) ),
			'set_type'      => sanitize_key( (string) ( $data['set_type'] ?? 'base' ) ),
			'owner_id'      => (int) ( $data['owner_id'] ?? get_current_user_id() ),
			'is_public'     => empty( $data['is_public'] ) ? 0 : 1,
			'is_enabled'    => array_key_exists( 'is_enabled', $data ) ? ( empty( $data['is_enabled'] ) ? 0 : 1 ) : 1,
			'sort_order'    => (int) ( $data['sort_order'] ?? 0 ),
			'metadata_json' => $this->encode_json( $data['metadata_json'] ?? [] ),
		];

		// Only touch is_default when explicitly provided — so a rename or other
		// edit never silently un-defaults a set. New sets default to NOT default.
		$set_default = array_key_exists( 'is_default', $data ) ? ( empty( $data['is_default'] ) ? 0 : 1 ) : null;
		if ( null !== $set_default ) {
			$row['is_default'] = $set_default;
		} elseif ( $id <= 0 ) {
			$row['is_default'] = 0;
		}

		if ( $id > 0 ) {
			$updated = $wpdb->update( $table, $row, [ 'id' => $id ] );
			if ( false === $updated ) {
				return new WP_Error( 'db_update_failed', 'Failed to update set.' );
			}
		} else {
			$inserted = $wpdb->insert( $table, $row );
			if ( ! $inserted ) {
				return new WP_Error( 'db_insert_failed', 'Failed to create set.' );
			}
			$id = (int) $wpdb->insert_id;
		}

		if ( isset( $data['modules'] ) && is_array( $data['modules'] ) ) {
			$this->replace_set_modules( $id, $data['modules'] );
		}

		if ( 1 === $set_default ) {
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$table} SET is_default = 0 WHERE id <> %d",
					$id
				)
			);
		}

		return $this->get_set( $id ) ?: new WP_Error( 'set_missing', 'Set was saved but could not be reloaded.' );
	}

	public function get_set( int $set_id ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_sets';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $set_id ),
			ARRAY_A
		);

		if ( ! $row ) {
			return null;
		}

		$row['metadata_json'] = $this->decode_json( $row['metadata_json'] ?? '' );
		$row['modules']       = $this->list_set_modules( $set_id );
		return $this->cast_set_row( $row );
	}

	/** Coerce DB string flags to real ints so JSON clients don't trip on "0" being truthy. */
	private function cast_set_row( array $row ): array {
		foreach ( [ 'id', 'owner_id', 'is_default', 'is_public', 'is_enabled', 'sort_order' ] as $field ) {
			if ( array_key_exists( $field, $row ) ) {
				$row[ $field ] = (int) $row[ $field ];
			}
		}
		return $row;
	}

	public function list_sets( array $filters = [] ): array {
		global $wpdb;

		$table  = $wpdb->prefix . 'lunacco_def_sets';
		$where  = [ '1=1' ];
		$params = [];

		if ( isset( $filters['id'] ) ) {
			$where[]  = 'id = %d';
			$params[] = (int) $filters['id'];
		}
		if ( ! empty( $filters['slug'] ) ) {
			$where[]  = 'slug = %s';
			$params[] = sanitize_title( (string) $filters['slug'] );
		}
		if ( ! empty( $filters['set_type'] ) ) {
			$where[]  = 'set_type = %s';
			$params[] = sanitize_key( (string) $filters['set_type'] );
		}
		if ( isset( $filters['is_enabled'] ) ) {
			$where[]  = 'is_enabled = %d';
			$params[] = empty( $filters['is_enabled'] ) ? 0 : 1;
		}

		$sql = "SELECT * FROM {$table} WHERE " . implode( ' AND ', $where ) . ' ORDER BY is_default DESC, sort_order ASC, label ASC';
		if ( $params ) {
			$sql = $wpdb->prepare( $sql, ...$params );
		}

		$rows = $wpdb->get_results( $sql, ARRAY_A ) ?: [];
		foreach ( $rows as &$row ) {
			$row['metadata_json'] = $this->decode_json( $row['metadata_json'] ?? '' );
			$row['modules']       = $this->list_set_modules( (int) $row['id'] );
			$row                  = $this->cast_set_row( $row );
		}
		unset( $row );

		return $rows;
	}

	public function list_sets_for_module( string $module_id, string $system_key = '' ): array {
		$module_id = sanitize_key( $module_id );
		$system_key = sanitize_key( $system_key );
		$sets = $this->list_sets( [ 'is_enabled' => 1 ] );

		return array_values( array_filter( $sets, static function ( array $set ) use ( $module_id, $system_key ): bool {
			foreach ( (array) ( $set['modules'] ?? [] ) as $module ) {
				if ( sanitize_key( (string) ( $module['module_id'] ?? '' ) ) !== $module_id ) {
					continue;
				}
				if ( '' !== $system_key && sanitize_key( (string) ( $module['system_key'] ?? '' ) ) !== $system_key ) {
					continue;
				}
				return true;
			}
			return false;
		} ) );
	}

	public function get_active_set_for_module( string $module_id, string $system_key = '' ): ?array {
		$sets = $this->list_sets_for_module( $module_id, $system_key );
		if ( empty( $sets ) ) {
			return null;
		}

		foreach ( $sets as $set ) {
			if ( ! empty( $set['is_default'] ) ) {
				return $set;
			}
		}

		return $sets[0];
	}

	public function delete_set( int $set_id ): bool {
		global $wpdb;

		$prefix = $wpdb->prefix . 'lunacco_def_';
		$entry_ids = $wpdb->get_col(
			$wpdb->prepare( "SELECT id FROM {$prefix}entries WHERE set_id = %d", $set_id )
		);
		$template_ids = $wpdb->get_col(
			$wpdb->prepare( "SELECT id FROM {$prefix}templates WHERE set_id = %d", $set_id )
		);

		if ( $entry_ids ) {
			$in = implode( ',', array_map( 'intval', $entry_ids ) );
			$wpdb->query( "DELETE FROM {$prefix}entry_slots WHERE entry_id IN ({$in})" );
			$wpdb->query( "DELETE FROM {$prefix}entry_entities WHERE entry_id IN ({$in})" );
			$wpdb->query( "DELETE FROM {$prefix}entry_variants WHERE entry_id IN ({$in})" );
			$wpdb->query( "DELETE FROM {$prefix}entry_tags WHERE entry_id IN ({$in})" );
			$wpdb->query( "DELETE FROM {$prefix}theme_weights WHERE entry_id IN ({$in})" );
			$wpdb->query( "DELETE FROM {$prefix}entries WHERE id IN ({$in})" );
		}

		if ( $template_ids ) {
			$in = implode( ',', array_map( 'intval', $template_ids ) );
			$wpdb->query( "DELETE FROM {$prefix}template_rules WHERE template_id IN ({$in})" );
			$wpdb->query( "DELETE FROM {$prefix}templates WHERE id IN ({$in})" );
		}

		$wpdb->delete( "{$prefix}set_modules", [ 'set_id' => $set_id ], [ '%d' ] );
		$wpdb->delete( "{$prefix}chart_presets", [ 'set_id' => $set_id ], [ '%d' ] );
		return false !== $wpdb->delete( "{$prefix}sets", [ 'id' => $set_id ], [ '%d' ] );
	}

	public function reset_all_definition_data( array $options = [] ): array {
		global $wpdb;

		$options = wp_parse_args( $options, [
			'wipe_core'           => true,
			'wipe_legacy_astrohd' => true,
			'wipe_legacy_numerology' => true,
			'seed_astrohd'        => true,
		] );

		$tables_reset = [];

		if ( ! empty( $options['wipe_core'] ) ) {
			foreach ( [
				$wpdb->prefix . 'lunacco_def_render_logs',
				$wpdb->prefix . 'lunacco_def_template_rules',
				$wpdb->prefix . 'lunacco_def_templates',
				$wpdb->prefix . 'lunacco_def_chart_presets',
				$wpdb->prefix . 'lunacco_def_theme_weights',
				$wpdb->prefix . 'lunacco_def_entry_tags',
				$wpdb->prefix . 'lunacco_def_tag_synonyms',
				$wpdb->prefix . 'lunacco_def_tags',
				$wpdb->prefix . 'lunacco_def_entry_variants',
				$wpdb->prefix . 'lunacco_def_entry_slots',
				$wpdb->prefix . 'lunacco_def_entry_entities',
				$wpdb->prefix . 'lunacco_def_entries',
				$wpdb->prefix . 'lunacco_def_entity_relationships',
				$wpdb->prefix . 'lunacco_def_entities',
				$wpdb->prefix . 'lunacco_def_set_modules',
				$wpdb->prefix . 'lunacco_def_sets',
			] as $table ) {
				if ( $this->truncate_table_if_exists( $table ) ) {
					$tables_reset[] = $table;
				}
			}
		}

		if ( ! empty( $options['wipe_legacy_astrohd'] ) ) {
			foreach ( [
				$wpdb->prefix . 'lt_astrohd_definition_index',
				$wpdb->prefix . 'lt_astrohd_definition_sections',
				$wpdb->prefix . 'lt_astrohd_definition_sets',
			] as $table ) {
				if ( $this->truncate_table_if_exists( $table ) ) {
					$tables_reset[] = $table;
				}
			}
		}

		if ( ! empty( $options['wipe_legacy_numerology'] ) ) {
			foreach ( [
				$wpdb->prefix . 'luna_numerology_definitions',
				$wpdb->prefix . 'luna_definition_set_explainers',
				$wpdb->prefix . 'luna_position_definitions',
				$wpdb->prefix . 'luna_number_definitions',
				$wpdb->prefix . 'luna_definition_sets',
			] as $table ) {
				if ( $this->truncate_table_if_exists( $table ) ) {
					$tables_reset[] = $table;
				}
			}
		}

		$seeded = [];
		if ( ! empty( $options['seed_astrohd'] ) ) {
			$astrohd_set = $this->seed_fresh_astrohd_set();
			if ( ! is_wp_error( $astrohd_set ) ) {
				$seeded['astrohd'] = $astrohd_set;
			}
		}

		return [
			'success'      => true,
			'tables_reset' => $tables_reset,
			'seeded'       => $seeded,
		];
	}

	public function replace_set_modules( int $set_id, array $modules ): void {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_set_modules';
		$wpdb->delete( $table, [ 'set_id' => $set_id ], [ '%d' ] );

		foreach ( array_values( $modules ) as $index => $module ) {
			if ( empty( $module['module_id'] ) ) {
				continue;
			}

			$wpdb->insert( $table, [
				'set_id'        => $set_id,
				'module_id'     => sanitize_key( (string) $module['module_id'] ),
				'system_key'    => sanitize_key( (string) ( $module['system_key'] ?? '' ) ),
				'is_required'   => empty( $module['is_required'] ) ? 0 : 1,
				'sort_order'    => isset( $module['sort_order'] ) ? (int) $module['sort_order'] : $index,
				'metadata_json' => $this->encode_json( $module['metadata_json'] ?? [] ),
			] );
		}
	}

	public function list_set_modules( int $set_id ): array {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_set_modules';
		$rows  = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE set_id = %d ORDER BY sort_order ASC, id ASC", $set_id ),
			ARRAY_A
		) ?: [];

		foreach ( $rows as &$row ) {
			$row['metadata_json'] = $this->decode_json( $row['metadata_json'] ?? '' );
		}
		unset( $row );

		return $rows;
	}

	public function upsert_entity( array $data ): array|WP_Error {
		global $wpdb;

		$table      = $wpdb->prefix . 'lunacco_def_entities';
		$id         = (int) ( $data['id'] ?? 0 );
		$module_id  = sanitize_key( (string) ( $data['module_id'] ?? '' ) );
		$entity_type = sanitize_key( (string) ( $data['entity_type'] ?? '' ) );
		$entity_key = $this->normalize_astrohd_entity_key( $entity_type, sanitize_key( (string) ( $data['entity_key'] ?? '' ) ) );

		if ( '' === $module_id || '' === $entity_type || '' === $entity_key ) {
			return new WP_Error( 'missing_fields', 'module_id, entity_type, and entity_key are required.' );
		}

		$row = [
			'module_id'     => $module_id,
			'entity_type'   => $entity_type,
			'entity_key'    => $entity_key,
			'label'         => sanitize_text_field( (string) ( $data['label'] ?? '' ) ),
			'description'   => sanitize_textarea_field( (string) ( $data['description'] ?? '' ) ),
			'metadata_json' => $this->encode_json( $data['metadata_json'] ?? [] ),
			'is_enabled'    => array_key_exists( 'is_enabled', $data ) ? ( empty( $data['is_enabled'] ) ? 0 : 1 ) : 1,
		];

		if ( $id > 0 ) {
			$updated = $wpdb->update( $table, $row, [ 'id' => $id ] );
			if ( false === $updated ) {
				return new WP_Error( 'db_update_failed', 'Failed to update entity.' );
			}
		} else {
			$existing_id = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT id FROM {$table} WHERE module_id = %s AND entity_type = %s AND entity_key = %s",
					$module_id,
					$entity_type,
					$entity_key
				)
			);
			if ( $existing_id > 0 ) {
				$wpdb->update( $table, $row, [ 'id' => $existing_id ] );
				$id = $existing_id;
			} else {
				$inserted = $wpdb->insert( $table, $row );
				if ( ! $inserted ) {
					return new WP_Error( 'db_insert_failed', 'Failed to create entity.' );
				}
				$id = (int) $wpdb->insert_id;
			}
		}

		return $this->get_entity( $id ) ?: new WP_Error( 'entity_missing', 'Entity was saved but could not be reloaded.' );
	}

	public function get_entity( int $entity_id ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_entities';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $entity_id ),
			ARRAY_A
		);

		if ( ! $row ) {
			return null;
		}

		$row['metadata_json'] = $this->decode_json( $row['metadata_json'] ?? '' );
		return $row;
	}

	public function list_entities( array $filters = [] ): array {
		global $wpdb;

		$table  = $wpdb->prefix . 'lunacco_def_entities';
		$where  = [ '1=1' ];
		$params = [];

		foreach ( [ 'module_id', 'entity_type', 'entity_key' ] as $field ) {
			if ( ! empty( $filters[ $field ] ) ) {
				$where[]  = "{$field} = %s";
				$params[] = sanitize_key( (string) $filters[ $field ] );
			}
		}
		if ( isset( $filters['is_enabled'] ) ) {
			$where[]  = 'is_enabled = %d';
			$params[] = empty( $filters['is_enabled'] ) ? 0 : 1;
		}
		if ( ! empty( $filters['search'] ) ) {
			$where[]  = '(label LIKE %s OR entity_key LIKE %s OR description LIKE %s)';
			$search   = '%' . $wpdb->esc_like( (string) $filters['search'] ) . '%';
			$params[] = $search;
			$params[] = $search;
			$params[] = $search;
		}

		$sql = "SELECT * FROM {$table} WHERE " . implode( ' AND ', $where ) . ' ORDER BY module_id ASC, entity_type ASC, entity_key ASC';
		if ( $params ) {
			$sql = $wpdb->prepare( $sql, ...$params );
		}
		$rows = $wpdb->get_results( $sql, ARRAY_A ) ?: [];

		foreach ( $rows as &$row ) {
			$row['metadata_json'] = $this->decode_json( $row['metadata_json'] ?? '' );
		}
		unset( $row );

		return $rows;
	}

	public function delete_entity( int $entity_id ): bool {
		global $wpdb;

		$prefix = $wpdb->prefix . 'lunacco_def_';
		$wpdb->delete( "{$prefix}entry_entities", [ 'entity_id' => $entity_id ], [ '%d' ] );
		$wpdb->delete( "{$prefix}entity_relationships", [ 'source_entity_id' => $entity_id ], [ '%d' ] );
		$wpdb->delete( "{$prefix}entity_relationships", [ 'target_entity_id' => $entity_id ], [ '%d' ] );
		return false !== $wpdb->delete( "{$prefix}entities", [ 'id' => $entity_id ], [ '%d' ] );
	}

	public function upsert_relationship( array $data ): array|WP_Error {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_entity_relationships';
		$id    = (int) ( $data['id'] ?? 0 );
		$row   = [
			'source_entity_id' => (int) ( $data['source_entity_id'] ?? 0 ),
			'relationship_type' => sanitize_key( (string) ( $data['relationship_type'] ?? '' ) ),
			'target_entity_id' => (int) ( $data['target_entity_id'] ?? 0 ),
			'sort_order'       => (int) ( $data['sort_order'] ?? 0 ),
			'is_enabled'       => array_key_exists( 'is_enabled', $data ) ? ( empty( $data['is_enabled'] ) ? 0 : 1 ) : 1,
			'metadata_json'    => $this->encode_json( $data['metadata_json'] ?? [] ),
		];

		if ( empty( $row['source_entity_id'] ) || empty( $row['target_entity_id'] ) || '' === $row['relationship_type'] ) {
			return new WP_Error( 'missing_fields', 'source_entity_id, target_entity_id, and relationship_type are required.' );
		}

		if ( $id > 0 ) {
			$updated = $wpdb->update( $table, $row, [ 'id' => $id ] );
			if ( false === $updated ) {
				return new WP_Error( 'db_update_failed', 'Failed to update relationship.' );
			}
		} else {
			$inserted = $wpdb->insert( $table, $row );
			if ( ! $inserted ) {
				return new WP_Error( 'db_insert_failed', 'Failed to create relationship.' );
			}
			$id = (int) $wpdb->insert_id;
		}

		return $this->get_relationship( $id ) ?: new WP_Error( 'relationship_missing', 'Relationship was saved but could not be reloaded.' );
	}

	public function get_relationship( int $relationship_id ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_entity_relationships';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $relationship_id ),
			ARRAY_A
		);
		if ( ! $row ) {
			return null;
		}
		$row['metadata_json'] = $this->decode_json( $row['metadata_json'] ?? '' );
		return $row;
	}

	public function list_relationships( array $filters = [] ): array {
		global $wpdb;

		$table  = $wpdb->prefix . 'lunacco_def_entity_relationships';
		$where  = [ '1=1' ];
		$params = [];
		foreach ( [ 'source_entity_id', 'target_entity_id' ] as $field ) {
			if ( ! empty( $filters[ $field ] ) ) {
				$where[]  = "{$field} = %d";
				$params[] = (int) $filters[ $field ];
			}
		}
		if ( ! empty( $filters['relationship_type'] ) ) {
			$where[]  = 'relationship_type = %s';
			$params[] = sanitize_key( (string) $filters['relationship_type'] );
		}

		$sql = "SELECT * FROM {$table} WHERE " . implode( ' AND ', $where ) . ' ORDER BY sort_order ASC, id ASC';
		if ( $params ) {
			$sql = $wpdb->prepare( $sql, ...$params );
		}
		$rows = $wpdb->get_results( $sql, ARRAY_A ) ?: [];

		foreach ( $rows as &$row ) {
			$row['metadata_json'] = $this->decode_json( $row['metadata_json'] ?? '' );
		}
		unset( $row );

		return $rows;
	}

	public function delete_relationship( int $relationship_id ): bool {
		global $wpdb;
		return false !== $wpdb->delete( $wpdb->prefix . 'lunacco_def_entity_relationships', [ 'id' => $relationship_id ], [ '%d' ] );
	}

	public function upsert_template( array $data ): array|WP_Error {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_templates';
		$id    = (int) ( $data['id'] ?? 0 );
		$row   = [
			'set_id'         => (int) ( $data['set_id'] ?? 0 ),
			'module_id'      => sanitize_key( (string) ( $data['module_id'] ?? '' ) ),
			'template_key'   => sanitize_key( (string) ( $data['template_key'] ?? '' ) ),
			'title'          => sanitize_text_field( (string) ( $data['title'] ?? '' ) ),
			'output_context' => sanitize_key( (string) ( $data['output_context'] ?? '' ) ),
			'render_mode'    => sanitize_key( (string) ( $data['render_mode'] ?? 'slot_concat' ) ),
			'is_enabled'     => array_key_exists( 'is_enabled', $data ) ? ( empty( $data['is_enabled'] ) ? 0 : 1 ) : 1,
			'sort_order'     => (int) ( $data['sort_order'] ?? 0 ),
			'metadata_json'  => $this->encode_json( $data['metadata_json'] ?? [] ),
		];

		if ( empty( $row['set_id'] ) || '' === $row['template_key'] ) {
			return new WP_Error( 'missing_fields', 'set_id and template_key are required.' );
		}

		if ( $id <= 0 ) {
			// Idempotent: reuse an existing template with the same set + key (re-seeding).
			$id = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT id FROM {$table} WHERE set_id = %d AND template_key = %s",
					$row['set_id'],
					$row['template_key']
				)
			);
		}

		if ( $id > 0 ) {
			$updated = $wpdb->update( $table, $row, [ 'id' => $id ] );
			if ( false === $updated ) {
				return new WP_Error( 'db_update_failed', 'Failed to update template.' );
			}
		} else {
			$inserted = $wpdb->insert( $table, $row );
			if ( ! $inserted ) {
				return new WP_Error( 'db_insert_failed', 'Failed to create template.' );
			}
			$id = (int) $wpdb->insert_id;
		}

		if ( isset( $data['rules'] ) && is_array( $data['rules'] ) ) {
			$this->replace_template_rules( $id, $data['rules'] );
		}

		return $this->get_template( $id ) ?: new WP_Error( 'template_missing', 'Template was saved but could not be reloaded.' );
	}

	public function get_template( int $template_id ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_templates';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $template_id ),
			ARRAY_A
		);
		if ( ! $row ) {
			return null;
		}
		$row['metadata_json'] = $this->decode_json( $row['metadata_json'] ?? '' );
		$row['rules']         = $this->list_template_rules( $template_id );
		return $row;
	}

	public function list_templates( array $filters = [] ): array {
		global $wpdb;

		$table  = $wpdb->prefix . 'lunacco_def_templates';
		$where  = [ '1=1' ];
		$params = [];
		foreach ( [ 'module_id', 'output_context', 'template_key' ] as $field ) {
			if ( ! empty( $filters[ $field ] ) ) {
				$where[]  = "{$field} = %s";
				$params[] = sanitize_key( (string) $filters[ $field ] );
			}
		}
		if ( ! empty( $filters['set_id'] ) ) {
			$where[]  = 'set_id = %d';
			$params[] = (int) $filters['set_id'];
		}

		$sql = "SELECT * FROM {$table} WHERE " . implode( ' AND ', $where ) . ' ORDER BY sort_order ASC, id ASC';
		if ( $params ) {
			$sql = $wpdb->prepare( $sql, ...$params );
		}
		$rows = $wpdb->get_results( $sql, ARRAY_A ) ?: [];

		foreach ( $rows as &$row ) {
			$row['metadata_json'] = $this->decode_json( $row['metadata_json'] ?? '' );
			$row['rules']         = $this->list_template_rules( (int) $row['id'] );
		}
		unset( $row );

		return $rows;
	}

	public function delete_template( int $template_id ): bool {
		global $wpdb;

		$prefix = $wpdb->prefix . 'lunacco_def_';
		$wpdb->delete( "{$prefix}template_rules", [ 'template_id' => $template_id ], [ '%d' ] );
		return false !== $wpdb->delete( "{$prefix}templates", [ 'id' => $template_id ], [ '%d' ] );
	}

	public function upsert_chart_preset( array $data ): array|WP_Error {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_chart_presets';
		$id    = (int) ( $data['id'] ?? 0 );
		$row   = [
			'set_id'         => (int) ( $data['set_id'] ?? 0 ),
			'module_id'      => sanitize_key( (string) ( $data['module_id'] ?? '' ) ),
			'preset_key'     => sanitize_key( (string) ( $data['preset_key'] ?? '' ) ),
			'title'          => sanitize_text_field( (string) ( $data['title'] ?? '' ) ),
			'description'    => sanitize_textarea_field( (string) ( $data['description'] ?? '' ) ),
			'chart_type'     => sanitize_key( (string) ( $data['chart_type'] ?? '' ) ),
			'output_context' => sanitize_key( (string) ( $data['output_context'] ?? 'chart_snippet' ) ),
			'is_enabled'     => array_key_exists( 'is_enabled', $data ) ? ( empty( $data['is_enabled'] ) ? 0 : 1 ) : 1,
			'sort_order'     => (int) ( $data['sort_order'] ?? 0 ),
			'config_json'    => $this->encode_json( $data['config_json'] ?? $data['config'] ?? [] ),
		];

		if ( empty( $row['set_id'] ) || '' === $row['module_id'] || '' === $row['preset_key'] ) {
			return new WP_Error( 'missing_fields', 'set_id, module_id, and preset_key are required.' );
		}

		if ( $id > 0 ) {
			$updated = $wpdb->update( $table, $row, [ 'id' => $id ] );
			if ( false === $updated ) {
				return new WP_Error( 'db_update_failed', 'Failed to update chart preset.' );
			}
		} else {
			$existing_id = (int) $wpdb->get_var(
				$wpdb->prepare( "SELECT id FROM {$table} WHERE set_id = %d AND preset_key = %s", $row['set_id'], $row['preset_key'] )
			);
			if ( $existing_id > 0 ) {
				$wpdb->update( $table, $row, [ 'id' => $existing_id ] );
				$id = $existing_id;
			} else {
				$inserted = $wpdb->insert( $table, $row );
				if ( ! $inserted ) {
					return new WP_Error( 'db_insert_failed', 'Failed to create chart preset.' );
				}
				$id = (int) $wpdb->insert_id;
			}
		}

		return $this->get_chart_preset( $id ) ?: new WP_Error( 'chart_preset_missing', 'Chart preset was saved but could not be reloaded.' );
	}

	public function get_chart_preset( int $preset_id ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_chart_presets';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $preset_id ),
			ARRAY_A
		);
		return $row ? $this->hydrate_chart_preset_row( $row ) : null;
	}

	public function list_chart_presets( array $filters = [] ): array {
		global $wpdb;

		$table  = $wpdb->prefix . 'lunacco_def_chart_presets';
		$where  = [ '1=1' ];
		$params = [];
		foreach ( [ 'module_id', 'chart_type', 'preset_key', 'output_context' ] as $field ) {
			if ( ! empty( $filters[ $field ] ) ) {
				$where[]  = "{$field} = %s";
				$params[] = sanitize_key( (string) $filters[ $field ] );
			}
		}
		if ( ! empty( $filters['set_id'] ) ) {
			$where[]  = 'set_id = %d';
			$params[] = (int) $filters['set_id'];
		}
		if ( isset( $filters['is_enabled'] ) ) {
			$where[]  = 'is_enabled = %d';
			$params[] = empty( $filters['is_enabled'] ) ? 0 : 1;
		}

		$sql = "SELECT * FROM {$table} WHERE " . implode( ' AND ', $where ) . ' ORDER BY sort_order ASC, title ASC, id ASC';
		if ( $params ) {
			$sql = $wpdb->prepare( $sql, ...$params );
		}

		return array_map(
			fn( array $row ): array => $this->hydrate_chart_preset_row( $row ),
			$wpdb->get_results( $sql, ARRAY_A ) ?: []
		);
	}

	public function delete_chart_preset( int $preset_id ): bool {
		global $wpdb;
		return false !== $wpdb->delete( $wpdb->prefix . 'lunacco_def_chart_presets', [ 'id' => $preset_id ], [ '%d' ] );
	}

	/**
	 * Update only the governance flags (enabled / admin_only / is_premium /
	 * credit_cost) of a chart preset, merging them into config_json so the rest
	 * of the ChartConfig is untouched. Used by the unified Charts admin.
	 */
	public function update_chart_preset_flags( int $preset_id, array $flags ): array|WP_Error {
		$preset = $this->get_chart_preset( $preset_id );
		if ( ! $preset ) {
			return new WP_Error( 'chart_preset_missing', 'Chart preset not found.' );
		}
		$config = is_array( $preset['config'] ?? null ) ? $preset['config'] : [];
		$config['enabled']     = ! empty( $flags['enabled'] );
		$config['admin_only']  = ! empty( $flags['admin_only'] );
		$config['is_premium']  = ! empty( $flags['is_premium'] );
		$config['credit_cost'] = max( 0, (int) ( $flags['credit_cost'] ?? 0 ) );

		return $this->upsert_chart_preset( [
			'id'             => $preset_id,
			'set_id'         => (int) $preset['set_id'],
			'module_id'      => (string) $preset['module_id'],
			'preset_key'     => (string) $preset['preset_key'],
			'title'          => (string) $preset['title'],
			'description'    => (string) ( $preset['description'] ?? '' ),
			'chart_type'     => (string) $preset['chart_type'],
			'output_context' => (string) $preset['output_context'],
			'is_enabled'     => $config['enabled'] ? 1 : 0,
			'sort_order'     => (int) ( $preset['sort_order'] ?? 0 ),
			'config_json'    => $config,
		] );
	}

	public function replace_template_rules( int $template_id, array $rules ): void {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_template_rules';
		$wpdb->delete( $table, [ 'template_id' => $template_id ], [ '%d' ] );

		foreach ( array_values( $rules ) as $index => $rule ) {
			$wpdb->insert( $table, [
				'template_id'       => $template_id,
				'rule_key'          => sanitize_key( (string) ( $rule['rule_key'] ?? 'rule_' . $index ) ),
				'rule_type'         => sanitize_key( (string) ( $rule['rule_type'] ?? 'slot' ) ),
				'source_type'       => sanitize_key( (string) ( $rule['source_type'] ?? 'matched_entry' ) ),
				'source_ref'        => sanitize_text_field( (string) ( $rule['source_ref'] ?? '' ) ),
				'slot_key'          => sanitize_key( (string) ( $rule['slot_key'] ?? '' ) ),
				'fallback_slot_key' => sanitize_key( (string) ( $rule['fallback_slot_key'] ?? '' ) ),
				'prefix_text'       => sanitize_textarea_field( (string) ( $rule['prefix_text'] ?? '' ) ),
				'suffix_text'       => sanitize_textarea_field( (string) ( $rule['suffix_text'] ?? '' ) ),
				'sort_order'        => isset( $rule['sort_order'] ) ? (int) $rule['sort_order'] : $index,
				'metadata_json'     => $this->encode_json( $rule['metadata_json'] ?? [] ),
			] );
		}
	}

	public function list_template_rules( int $template_id ): array {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_template_rules';
		$rows  = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE template_id = %d ORDER BY sort_order ASC, id ASC", $template_id ),
			ARRAY_A
		) ?: [];

		foreach ( $rows as &$row ) {
			$row['metadata_json'] = $this->decode_json( $row['metadata_json'] ?? '' );
		}
		unset( $row );

		return $rows;
	}

	public function upsert_entry( array $data ): array|WP_Error {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_entries';
		$id    = (int) ( $data['id'] ?? 0 );
		$row   = [
			'set_id'            => (int) ( $data['set_id'] ?? 0 ),
			'module_id'         => sanitize_key( (string) ( $data['module_id'] ?? '' ) ),
			'entry_key'         => sanitize_key( (string) ( $data['entry_key'] ?? '' ) ),
			'title'             => sanitize_text_field( (string) ( $data['title'] ?? '' ) ),
			'entry_kind'        => sanitize_key( (string) ( $data['entry_kind'] ?? 'atomic' ) ),
			'output_context'    => sanitize_key( (string) ( $data['output_context'] ?? '' ) ),
			'template_id'       => empty( $data['template_id'] ) ? null : (int) $data['template_id'],
			'specificity_score' => (int) ( $data['specificity_score'] ?? 0 ),
			'sort_order'        => (int) ( $data['sort_order'] ?? 0 ),
			'is_enabled'        => array_key_exists( 'is_enabled', $data ) ? ( empty( $data['is_enabled'] ) ? 0 : 1 ) : 1,
			'is_public'         => empty( $data['is_public'] ) ? 0 : 1,
			'legacy_source'     => sanitize_text_field( (string) ( $data['legacy_source'] ?? '' ) ),
			'metadata_json'     => $this->encode_json( $data['metadata_json'] ?? [] ),
		];

		if ( empty( $row['set_id'] ) || '' === $row['entry_key'] ) {
			return new WP_Error( 'missing_fields', 'set_id and entry_key are required.' );
		}

		if ( $id > 0 ) {
			$updated = $wpdb->update( $table, $row, [ 'id' => $id ] );
			if ( false === $updated ) {
				return new WP_Error( 'db_update_failed', 'Failed to update entry.' );
			}
		} else {
			$existing_id = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT id FROM {$table} WHERE set_id = %d AND entry_key = %s",
					$row['set_id'],
					$row['entry_key']
				)
			);
			if ( $existing_id > 0 ) {
				$wpdb->update( $table, $row, [ 'id' => $existing_id ] );
				$id = $existing_id;
			} else {
				$inserted = $wpdb->insert( $table, $row );
				if ( ! $inserted ) {
					return new WP_Error( 'db_insert_failed', 'Failed to create entry.' );
				}
				$id = (int) $wpdb->insert_id;
			}
		}

		if ( isset( $data['entities'] ) && is_array( $data['entities'] ) ) {
			$this->replace_entry_entities( $id, $data['entities'] );
		}
		if ( isset( $data['slots'] ) && is_array( $data['slots'] ) ) {
			$this->replace_entry_slots( $id, $data['slots'] );
		}

		$this->reindex_entry( $id );

		return $this->get_entry( $id ) ?: new WP_Error( 'entry_missing', 'Entry was saved but could not be reloaded.' );
	}

	public function get_entry( int $entry_id ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_entries';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $entry_id ),
			ARRAY_A
		);
		if ( ! $row ) {
			return null;
		}
		return $this->hydrate_entry_row( $row );
	}

	public function list_entries( array $filters = [] ): array {
		global $wpdb;

		$table  = $wpdb->prefix . 'lunacco_def_entries';
		$where  = [ '1=1' ];
		$params = [];

		foreach ( [ 'module_id', 'entry_kind', 'output_context', 'entry_key' ] as $field ) {
			if ( ! empty( $filters[ $field ] ) ) {
				$where[]  = "{$field} = %s";
				$params[] = sanitize_key( (string) $filters[ $field ] );
			}
		}
		foreach ( [ 'set_id', 'template_id' ] as $field ) {
			if ( ! empty( $filters[ $field ] ) ) {
				$where[]  = "{$field} = %d";
				$params[] = (int) $filters[ $field ];
			}
		}
		if ( isset( $filters['is_enabled'] ) ) {
			$where[]  = 'is_enabled = %d';
			$params[] = empty( $filters['is_enabled'] ) ? 0 : 1;
		}
		// Restrict to an explicit set of entry ids (used by resolve() to hydrate only the
		// handful of candidate entries instead of the whole set).
		if ( isset( $filters['entry_ids'] ) ) {
			$ids = array_values( array_unique( array_filter( array_map( 'intval', (array) $filters['entry_ids'] ) ) ) );
			if ( empty( $ids ) ) {
				return [];
			}
			$where[] = 'id IN (' . implode( ',', $ids ) . ')';
		}

		$sql = "SELECT * FROM {$table} WHERE " . implode( ' AND ', $where ) . ' ORDER BY specificity_score DESC, sort_order ASC, id ASC';
		if ( $params ) {
			$sql = $wpdb->prepare( $sql, ...$params );
		}
		$rows = $wpdb->get_results( $sql, ARRAY_A ) ?: [];

		return array_map( fn( array $row ): array => $this->hydrate_entry_row( $row ), $rows );
	}

	public function delete_entry( int $entry_id ): bool {
		global $wpdb;

		$prefix = $wpdb->prefix . 'lunacco_def_';
		$wpdb->delete( "{$prefix}entry_slots", [ 'entry_id' => $entry_id ], [ '%d' ] );
		$wpdb->delete( "{$prefix}entry_entities", [ 'entry_id' => $entry_id ], [ '%d' ] );
		$wpdb->delete( "{$prefix}entry_variants", [ 'entry_id' => $entry_id ], [ '%d' ] );
		$wpdb->delete( "{$prefix}entry_tags", [ 'entry_id' => $entry_id ], [ '%d' ] );
		$wpdb->delete( "{$prefix}theme_weights", [ 'entry_id' => $entry_id ], [ '%d' ] );
		$wpdb->delete( "{$prefix}search_index", [ 'entry_id' => $entry_id ], [ '%d' ] );
		return false !== $wpdb->delete( "{$prefix}entries", [ 'id' => $entry_id ], [ '%d' ] );
	}

	/**
	 * Remove "off-template" atoms from a set: entries whose atom either belongs to an
	 * unknown section type, or whose key isn't in the seeded scaffold for its section.
	 * This cleans up ghost atoms that an earlier (un-validated) import created from
	 * mistyped addresses. Sections that have no canonical scaffold are left untouched,
	 * and only the given $section_type is considered when provided.
	 *
	 * @return array{removed:int, removed_atoms:array<int,string>}
	 */
	public function prune_off_template_entries( int $set_id, string $section_type = '' ): array {
		global $wpdb;
		if ( $set_id <= 0 ) {
			return [ 'removed' => 0, 'removed_atoms' => [] ];
		}

		// Canonical key set per entity_type, from the filtered scaffold.
		$scaffold = function_exists( 'luna_astrohd_definition_set_scaffold' ) ? luna_astrohd_definition_set_scaffold() : [];
		$scaffold = apply_filters( 'lunacco_definition_scaffold', $scaffold, '' );
		$canonical = [];
		foreach ( $scaffold as $sec => $rows ) {
			$etype = $this->astrohd_entity_type_from_section( (string) $sec );
			foreach ( (array) $rows as $row ) {
				$k = $this->normalize_astrohd_entity_key( $etype, sanitize_key( (string) ( $row['item_key'] ?? '' ) ) );
				if ( '' !== $k ) {
					$canonical[ $etype ][ $k ] = true;
				}
			}
		}
		$valid_types = array_fill_keys( array_keys( $this->get_astrohd_blueprints() ), true );
		$filter_type = '' !== $section_type ? $this->astrohd_entity_type_from_section( $section_type ) : '';

		$removed = [];
		foreach ( $this->list_entries( [ 'set_id' => $set_id ] ) as $entry ) {
			$ent = null;
			foreach ( (array) ( $entry['entities'] ?? [] ) as $link ) {
				if ( ! empty( $link['entity'] ) ) { $ent = $link['entity']; break; }
			}
			if ( ! $ent ) {
				continue;
			}
			$etype = sanitize_key( (string) ( $ent['entity_type'] ?? '' ) );
			$ekey  = sanitize_key( (string) ( $ent['entity_key'] ?? '' ) );
			if ( '' !== $filter_type && $etype !== $filter_type ) {
				continue;
			}

			$is_ghost = false;
			if ( empty( $valid_types[ $etype ] ) ) {
				$is_ghost = true;                                   // unknown section entirely
			} elseif ( isset( $canonical[ $etype ] ) && empty( $canonical[ $etype ][ $ekey ] ) ) {
				$is_ghost = true;                                   // valid section, key not in template
			}
			if ( ! $is_ghost ) {
				continue;
			}

			$this->delete_entry( (int) $entry['id'] );
			$eid = (int) ( $ent['id'] ?? 0 );
			if ( $eid > 0 ) {
				$still = (int) $wpdb->get_var( $wpdb->prepare(
					"SELECT COUNT(*) FROM {$wpdb->prefix}lunacco_def_entry_entities WHERE entity_id = %d",
					$eid
				) );
				if ( 0 === $still ) {
					$this->delete_entity( $eid );
				}
			}
			$removed[] = $etype . ':' . $ekey;
		}

		return [ 'removed' => count( $removed ), 'removed_atoms' => array_values( array_slice( $removed, 0, 100 ) ) ];
	}

	public function replace_entry_entities( int $entry_id, array $entities ): void {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_entry_entities';
		$wpdb->delete( $table, [ 'entry_id' => $entry_id ], [ '%d' ] );

		foreach ( array_values( $entities ) as $index => $entity ) {
			$entity_id = 0;
			if ( ! empty( $entity['entity_id'] ) ) {
				$entity_id = (int) $entity['entity_id'];
			} elseif ( ! empty( $entity['module_id'] ) && ! empty( $entity['entity_type'] ) && ! empty( $entity['entity_key'] ) ) {
				$resolved = $this->find_entity_id(
					sanitize_key( (string) $entity['module_id'] ),
					sanitize_key( (string) $entity['entity_type'] ),
					sanitize_key( (string) $entity['entity_key'] )
				);
				$entity_id = $resolved > 0 ? $resolved : 0;
			}
			if ( $entity_id <= 0 ) {
				continue;
			}

			$wpdb->insert( $table, [
				'entry_id'        => $entry_id,
				'entity_id'       => $entity_id,
				'role_key'        => sanitize_key( (string) ( $entity['role_key'] ?? 'primary' ) ),
				'match_operator'  => sanitize_key( (string) ( $entity['match_operator'] ?? 'all_of' ) ),
				'sort_order'      => isset( $entity['sort_order'] ) ? (int) $entity['sort_order'] : $index,
				'metadata_json'   => $this->encode_json( $entity['metadata_json'] ?? [] ),
			] );
		}
	}

	public function replace_entry_slots( int $entry_id, array $slots ): void {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_entry_slots';
		$wpdb->delete( $table, [ 'entry_id' => $entry_id ], [ '%d' ] );

		foreach ( array_values( $slots ) as $index => $slot ) {
			if ( empty( $slot['slot_key'] ) ) {
				continue;
			}
			$wpdb->insert( $table, [
				'entry_id'        => $entry_id,
				'slot_key'        => sanitize_key( (string) $slot['slot_key'] ),
				'slot_value'      => isset( $slot['slot_value'] ) ? wp_kses_post( (string) $slot['slot_value'] ) : '',
				'slot_format'     => sanitize_key( (string) ( $slot['slot_format'] ?? 'text' ) ),
				'output_context'  => sanitize_key( (string) ( $slot['output_context'] ?? '' ) ),
				'is_required'     => empty( $slot['is_required'] ) ? 0 : 1,
				'sort_order'      => isset( $slot['sort_order'] ) ? (int) $slot['sort_order'] : $index,
				'metadata_json'   => $this->encode_json( $slot['metadata_json'] ?? [] ),
			] );
		}
	}

	public function upsert_entry_variant( array $data ): array|WP_Error {
		global $wpdb;

		$table    = $wpdb->prefix . 'lunacco_def_entry_variants';
		$id       = (int) ( $data['id'] ?? 0 );
		$entry_id = (int) ( $data['entry_id'] ?? 0 );
		$variant_key = sanitize_key( (string) ( $data['variant_key'] ?? '' ) );

		if ( $entry_id <= 0 || '' === $variant_key ) {
			return new WP_Error( 'missing_fields', 'entry_id and variant_key are required.' );
		}

		// Sanitize each variant slot value (these bypass replace_entry_slots' wp_kses_post,
		// so do it here) — strips <script> and event-handler injection while keeping
		// markdown + safe inline HTML.
		$slots_in    = (array) ( $data['slots_json'] ?? $data['slots'] ?? [] );
		$slots_clean = [];
		foreach ( $slots_in as $sk => $sv ) {
			$slots_clean[ sanitize_key( (string) $sk ) ] = is_string( $sv ) ? wp_kses_post( $sv ) : $sv;
		}

		$row = [
			'entry_id'            => $entry_id,
			'variant_key'         => $variant_key,
			'chart_context'       => sanitize_key( (string) ( $data['chart_context'] ?? '' ) ),
			'output_context'      => sanitize_key( (string) ( $data['output_context'] ?? '' ) ),
			'overlay_key'         => sanitize_key( (string) ( $data['overlay_key'] ?? 'base' ) ),
			'tone_key'            => sanitize_key( (string) ( $data['tone_key'] ?? 'default' ) ),
			'audience_key'        => sanitize_key( (string) ( $data['audience_key'] ?? '' ) ),
			'status'              => sanitize_key( (string) ( $data['status'] ?? 'draft' ) ),
			'slots_json'          => $this->encode_json( $slots_clean ),
			'theme_weights_json'  => $this->encode_json( $data['theme_weights_json'] ?? $data['theme_weights'] ?? [] ),
			'metadata_json'       => $this->encode_json( $data['metadata_json'] ?? [] ),
		];

		if ( $id > 0 ) {
			$updated = $wpdb->update( $table, $row, [ 'id' => $id ] );
			if ( false === $updated ) {
				return new WP_Error( 'db_update_failed', 'Failed to update variant.' );
			}
		} else {
			$existing_id = (int) $wpdb->get_var(
				$wpdb->prepare( "SELECT id FROM {$table} WHERE entry_id = %d AND variant_key = %s", $entry_id, $variant_key )
			);
			if ( $existing_id > 0 ) {
				$wpdb->update( $table, $row, [ 'id' => $existing_id ] );
				$id = $existing_id;
			} else {
				$inserted = $wpdb->insert( $table, $row );
				if ( ! $inserted ) {
					return new WP_Error( 'db_insert_failed', 'Failed to create variant.' );
				}
				$id = (int) $wpdb->insert_id;
			}
		}

		return $this->get_entry_variant( $id ) ?: new WP_Error( 'variant_missing', 'Variant was saved but could not be reloaded.' );
	}

	public function get_entry_variant( int $variant_id ): ?array {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}lunacco_def_entry_variants WHERE id = %d", $variant_id ),
			ARRAY_A
		);
		return $row ? $this->hydrate_entry_variant_row( $row ) : null;
	}

	public function list_entry_variants( array $filters = [] ): array {
		global $wpdb;

		$table  = $wpdb->prefix . 'lunacco_def_entry_variants';
		$where  = [ '1=1' ];
		$params = [];
		foreach ( [ 'variant_key', 'chart_context', 'output_context', 'overlay_key', 'tone_key', 'audience_key', 'status' ] as $field ) {
			if ( isset( $filters[ $field ] ) && '' !== (string) $filters[ $field ] ) {
				$where[]  = "{$field} = %s";
				$params[] = sanitize_key( (string) $filters[ $field ] );
			}
		}
		if ( ! empty( $filters['entry_id'] ) ) {
			$where[]  = 'entry_id = %d';
			$params[] = (int) $filters['entry_id'];
		}
		if ( ! empty( $filters['set_id'] ) ) {
			$where[]  = "entry_id IN (SELECT id FROM {$wpdb->prefix}lunacco_def_entries WHERE set_id = %d)";
			$params[] = (int) $filters['set_id'];
		}

		$sql = "SELECT * FROM {$table} WHERE " . implode( ' AND ', $where ) . ' ORDER BY status ASC, overlay_key ASC, tone_key ASC, id ASC';
		if ( $params ) {
			$sql = $wpdb->prepare( $sql, ...$params );
		}
		return array_map( fn( array $row ): array => $this->hydrate_entry_variant_row( $row ), $wpdb->get_results( $sql, ARRAY_A ) ?: [] );
	}

	public function delete_entry_variant( int $variant_id ): bool {
		global $wpdb;
		return false !== $wpdb->delete( $wpdb->prefix . 'lunacco_def_entry_variants', [ 'id' => $variant_id ], [ '%d' ] );
	}

	public function upsert_tag( array $data ): array|WP_Error {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_tags';
		$id    = (int) ( $data['id'] ?? 0 );
		$key   = sanitize_key( (string) ( $data['tag_key'] ?? $data['key'] ?? '' ) );
		if ( '' === $key ) {
			return new WP_Error( 'missing_tag_key', 'tag_key is required.' );
		}
		$row = [
			'tag_key'       => $key,
			'label'         => sanitize_text_field( (string) ( $data['label'] ?? ucwords( str_replace( '_', ' ', $key ) ) ) ),
			'tag_group'     => sanitize_key( (string) ( $data['tag_group'] ?? 'theme' ) ),
			'description'   => sanitize_textarea_field( (string) ( $data['description'] ?? '' ) ),
			'metadata_json' => $this->encode_json( $data['metadata_json'] ?? [] ),
		];
		if ( $id > 0 ) {
			$wpdb->update( $table, $row, [ 'id' => $id ] );
		} else {
			$existing_id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE tag_key = %s", $key ) );
			if ( $existing_id > 0 ) {
				$wpdb->update( $table, $row, [ 'id' => $existing_id ] );
				$id = $existing_id;
			} else {
				$wpdb->insert( $table, $row );
				$id = (int) $wpdb->insert_id;
			}
		}
		if ( isset( $data['synonyms'] ) ) {
			$this->replace_tag_synonyms( $id, (array) $data['synonyms'] );
		}
		return $this->get_tag( $id ) ?: new WP_Error( 'tag_missing', 'Tag was saved but could not be reloaded.' );
	}

	public function get_tag( int $tag_id ): ?array {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}lunacco_def_tags WHERE id = %d", $tag_id ), ARRAY_A );
		return $row ? $this->hydrate_tag_row( $row ) : null;
	}

	public function list_tags( array $filters = [] ): array {
		global $wpdb;
		$where = [ '1=1' ];
		$params = [];
		if ( ! empty( $filters['tag_group'] ) ) {
			$where[] = 'tag_group = %s';
			$params[] = sanitize_key( (string) $filters['tag_group'] );
		}
		$sql = "SELECT * FROM {$wpdb->prefix}lunacco_def_tags WHERE " . implode( ' AND ', $where ) . ' ORDER BY tag_group ASC, label ASC';
		if ( $params ) {
			$sql = $wpdb->prepare( $sql, ...$params );
		}
		return array_map( fn( array $row ): array => $this->hydrate_tag_row( $row ), $wpdb->get_results( $sql, ARRAY_A ) ?: [] );
	}

	public function suggest_tags_for_text( string $text ): array {
		$text = strtolower( wp_strip_all_tags( $text ) );
		$suggestions = [];
		foreach ( $this->list_tags() as $tag ) {
			$score = 0;
			$terms = array_merge( [ $tag['tag_key'], $tag['label'] ], array_column( (array) $tag['synonyms'], 'synonym' ) );
			foreach ( $terms as $term ) {
				$term = strtolower( trim( (string) $term ) );
				if ( '' !== $term && false !== strpos( $text, $term ) ) {
					$score++;
				}
			}
			if ( $score > 0 ) {
				$suggestions[] = [ 'tag' => $tag, 'score' => $score ];
			}
		}
		usort( $suggestions, static fn( array $a, array $b ): int => $b['score'] <=> $a['score'] );
		return $suggestions;
	}

	public function synthesize_theme_scores( array $payload ): array {
		$set_id    = (int) ( $payload['set_id'] ?? 0 );
		$module_id = sanitize_key( (string) ( $payload['module_id'] ?? '' ) );
		$active_ids = $this->resolve_active_entity_ids( (array) ( $payload['active_entities'] ?? [] ) );
		$entries = $this->list_entries( [
			'set_id'     => $set_id,
			'module_id'  => $module_id,
			'is_enabled' => 1,
		] );
		$scores = [];
		foreach ( $entries as $entry ) {
			$entry_entity_ids = array_map( fn( array $entity ): int => (int) $entity['entity_id'], (array) $entry['entities'] );
			if ( ! empty( $entry_entity_ids ) && array_diff( $entry_entity_ids, $active_ids ) ) {
				continue;
			}
			foreach ( (array) ( $entry['tags'] ?? [] ) as $tag ) {
				$key = sanitize_key( (string) ( $tag['tag_key'] ?? '' ) );
				if ( '' === $key ) {
					continue;
				}
				if ( ! isset( $scores[ $key ] ) ) {
					$scores[ $key ] = [
						'tag_key' => $key,
						'label'   => (string) ( $tag['label'] ?? $key ),
						'score'   => 0,
						'sources' => [],
					];
				}
				$scores[ $key ]['score'] += max( 1, (int) ( $tag['weight'] ?? 1 ) );
				$scores[ $key ]['sources'][] = [
					'entry_key' => (string) ( $entry['entry_key'] ?? '' ),
					'title'     => (string) ( $entry['title'] ?? '' ),
				];
			}
			$accepted_tags = $this->get_scoped_slot_value( (array) ( $entry['slots'] ?? [] ), 'accepted_tags', '', [] );
			foreach ( array_filter( array_map( 'trim', explode( ',', $accepted_tags ) ) ) as $tag_key ) {
				$key = sanitize_key( (string) $tag_key );
				if ( '' === $key ) {
					continue;
				}
				if ( ! isset( $scores[ $key ] ) ) {
					$scores[ $key ] = [ 'tag_key' => $key, 'label' => ucwords( str_replace( '_', ' ', $key ) ), 'score' => 0, 'sources' => [] ];
				}
				$scores[ $key ]['score']++;
				$scores[ $key ]['sources'][] = [
					'entry_key' => (string) ( $entry['entry_key'] ?? '' ),
					'title'     => (string) ( $entry['title'] ?? '' ),
				];
			}
			foreach ( (array) ( $entry['variants'] ?? [] ) as $variant ) {
				if ( 'approved' !== sanitize_key( (string) ( $variant['status'] ?? '' ) ) ) {
					continue;
				}
				foreach ( (array) ( $variant['theme_weights'] ?? [] ) as $tag_key => $weight ) {
					$key = sanitize_key( (string) $tag_key );
					if ( '' === $key ) {
						continue;
					}
					if ( ! isset( $scores[ $key ] ) ) {
						$scores[ $key ] = [ 'tag_key' => $key, 'label' => ucwords( str_replace( '_', ' ', $key ) ), 'score' => 0, 'sources' => [] ];
					}
					$scores[ $key ]['score'] += max( 1, (int) $weight );
					$scores[ $key ]['sources'][] = [
						'entry_key' => (string) ( $entry['entry_key'] ?? '' ),
						'title'     => (string) ( $entry['title'] ?? '' ),
						'variant'   => (string) ( $variant['variant_key'] ?? '' ),
					];
				}
			}
		}
		$dominant = array_values( $scores );
		usort( $dominant, static fn( array $a, array $b ): int => $b['score'] <=> $a['score'] );
		return [
			'dominant_themes' => array_slice( $dominant, 0, max( 1, (int) ( $payload['limit'] ?? 8 ) ) ),
			'all_scores'      => $dominant,
		];
	}

	public function export_set( int $set_id, array $filters = [] ): array|WP_Error {
		$set = $this->get_set( $set_id );
		if ( ! $set ) {
			return new WP_Error( 'set_not_found', 'Set not found.' );
		}

		$module_ids = array_values( array_filter( array_map(
			static fn( $module_id ): string => sanitize_key( (string) $module_id ),
			(array) ( $filters['module_ids'] ?? [] )
		) ) );
		if ( empty( $module_ids ) && ! empty( $filters['module_id'] ) ) {
			$module_ids = [ sanitize_key( (string) $filters['module_id'] ) ];
		}

		$entry_filters = [ 'set_id' => $set_id ];
		if ( 1 === count( $module_ids ) ) {
			$entry_filters['module_id'] = $module_ids[0];
		}

		$entries = $this->list_entries( $entry_filters );
		if ( count( $module_ids ) > 1 ) {
			$entries = array_values( array_filter( $entries, static fn( array $entry ): bool => in_array( sanitize_key( (string) $entry['module_id'] ), $module_ids, true ) ) );
		}
		$section_filter = sanitize_key( (string) ( $filters['section'] ?? '' ) );
		if ( '' !== $section_filter ) {
			$entries = array_values( array_filter( $entries, static function ( array $entry ) use ( $section_filter ): bool {
				$meta = (array) ( $entry['metadata_json'] ?? [] );
				$entity = $entry['entities'][0]['entity'] ?? [];
				return $section_filter === sanitize_key( (string) ( $meta['bundle_section'] ?? $meta['section_type'] ?? ( is_array( $entity ) ? ( $entity['metadata_json']['section_type'] ?? $entity['entity_type'] ?? '' ) : '' ) ) );
			} ) );
		}

		$entry_ids = array_values( array_filter( array_map( static fn( array $entry ): int => (int) ( $entry['id'] ?? 0 ), $entries ) ) );
		$variant_filters = [
			'set_id' => $set_id,
		];
		foreach ( [ 'overlay_key', 'tone_key', 'status', 'chart_context' ] as $variant_filter_key ) {
			if ( ! empty( $filters[ $variant_filter_key ] ) ) {
				$variant_filters[ $variant_filter_key ] = sanitize_key( (string) $filters[ $variant_filter_key ] );
			}
		}
		$variants = $this->list_entry_variants( $variant_filters );
		if ( $entry_ids ) {
			$variants = array_values( array_filter( $variants, static fn( array $variant ): bool => in_array( (int) ( $variant['entry_id'] ?? 0 ), $entry_ids, true ) ) );
		}
		if ( ! empty( $filters['overlay_key'] ) || ! empty( $filters['tone_key'] ) || ! empty( $filters['status'] ) || ! empty( $filters['chart_context'] ) ) {
			$variant_entry_ids = array_values( array_unique( array_filter( array_map( static fn( array $variant ): int => (int) ( $variant['entry_id'] ?? 0 ), $variants ) ) ) );
			$entries = array_values( array_filter( $entries, static fn( array $entry ): bool => in_array( (int) ( $entry['id'] ?? 0 ), $variant_entry_ids, true ) ) );
		}

		$templates = $this->list_templates( [ 'set_id' => $set_id ] );
		if ( ! empty( $module_ids ) ) {
			$templates = array_values( array_filter( $templates, static fn( array $template ): bool => in_array( sanitize_key( (string) $template['module_id'] ), $module_ids, true ) ) );
		}
		$chart_presets = $this->list_chart_presets( [ 'set_id' => $set_id ] );
		if ( ! empty( $module_ids ) ) {
			$chart_presets = array_values( array_filter( $chart_presets, static fn( array $preset ): bool => in_array( sanitize_key( (string) $preset['module_id'] ), $module_ids, true ) ) );
		}

		$entity_ids = [];
		foreach ( $entries as $entry ) {
			foreach ( (array) $entry['entities'] as $entity_link ) {
				if ( ! empty( $entity_link['entity_id'] ) ) {
					$entity_ids[] = (int) $entity_link['entity_id'];
				}
			}
		}
		$entity_ids = array_values( array_unique( array_filter( $entity_ids ) ) );
		$entities   = $entity_ids ? array_values( array_filter(
			array_map( fn( int $entity_id ): ?array => $this->get_entity( $entity_id ), $entity_ids )
		) ) : [];

		return [
			'export_version' => '1.2.0',
			'filters'        => [
				'module_ids'    => $module_ids,
				'section'       => $section_filter,
				'overlay_key'   => sanitize_key( (string) ( $filters['overlay_key'] ?? '' ) ),
				'tone_key'      => sanitize_key( (string) ( $filters['tone_key'] ?? '' ) ),
				'status'        => sanitize_key( (string) ( $filters['status'] ?? '' ) ),
				'chart_context' => sanitize_key( (string) ( $filters['chart_context'] ?? '' ) ),
			],
			'set'            => $set,
			'entities'       => $entities,
			'entries'        => $entries,
			'templates'      => $templates,
			'chart_presets'  => $chart_presets,
			'tags'           => $this->list_tags(),
			'variants'       => $variants,
		];
	}

	public function get_template_fragments(): array {
		$fragments = [];
		foreach ( $this->get_slot_style_guide() as $key => $config ) {
			$fragments[] = [
				'key'             => $key,
				'token'           => '{' . $key . '}',
				'purpose'         => (string) ( $config['purpose'] ?? '' ),
				'target_length'   => (string) ( $config['target_length'] ?? '' ),
				'audience'        => (string) ( $config['audience'] ?? '' ),
				'template_safe'   => ! empty( $config['template_safe'] ),
			];
		}
		return $fragments;
	}

	public function validate_bundle( array $payload ): array|WP_Error {
		$parsed = $this->parse_bundle_payload( $payload );
		if ( is_wp_error( $parsed ) ) {
			return $parsed;
		}

		$module_id = sanitize_key( (string) ( $payload['module_id'] ?? $parsed['module_id'] ?? '' ) );
		$section   = sanitize_key( str_replace( '.', '_', (string) ( $parsed['section'] ?? '' ) ) );
		$errors    = [];
		$warnings  = [];
		$entries   = [];

		if ( '' === $module_id ) {
			$errors[] = 'module_id is required.';
		}
		if ( '' === $section ) {
			$errors[] = 'section is required.';
		}

		foreach ( (array) ( $parsed['entries'] ?? [] ) as $index => $entry ) {
			$type = sanitize_key( (string) ( $entry['type'] ?? '' ) );
			$key  = $this->normalize_astrohd_entity_key( $type, sanitize_key( (string) ( $entry['key'] ?? '' ) ) );
			if ( '' === $key || '' === $type ) {
				$errors[] = 'Entry #' . ( $index + 1 ) . ' requires key and type.';
				continue;
			}

			$entity_id = $module_id ? $this->find_entity_id( $module_id, $type, $key ) : 0;
			if ( $entity_id <= 0 ) {
				if ( $this->is_auto_creatable_definition_entity_type( $type ) ) {
					$warnings[] = "Will create composite entity {$module_id}:{$type}:{$key} on import.";
				} else {
					$errors[] = "Missing registered entity {$module_id}:{$type}:{$key}.";
				}
			}

			$slots = $this->bundle_slots_from_entry( (array) $entry );
			if ( empty( $slots ) && empty( $entry['variants'] ) ) {
				$warnings[] = "Entry {$key} has no slots, modifiers, or variants.";
			}

			$entries[] = [
				'key'       => $key,
				'type'      => $type,
				'label'     => (string) ( $entry['label'] ?? $key ),
				'entity_id' => $entity_id,
				'slots'     => count( $slots ) + count( (array) ( $entry['variants'] ?? [] ) ),
			];
		}

		return [
			'valid'    => empty( $errors ),
			'section'  => $section,
			'module_id'=> $module_id,
			'entries'  => $entries,
			'errors'   => $errors,
			'warnings' => $warnings,
		];
	}

	public function import_bundle( array $payload ): array|WP_Error {
		$validation = $this->validate_bundle( $payload );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}
		if ( empty( $validation['valid'] ) ) {
			return new WP_Error( 'invalid_bundle', 'Bundle validation failed.', [ 'validation' => $validation ] );
		}
		if ( ! empty( $payload['dry_run'] ) ) {
			return $validation;
		}

		$parsed    = $this->parse_bundle_payload( $payload );
		$set_id    = (int) ( $payload['set_id'] ?? 0 );
		$module_id = sanitize_key( (string) $validation['module_id'] );
		$section   = sanitize_key( (string) $validation['section'] );
		if ( $set_id <= 0 ) {
			return new WP_Error( 'missing_set_id', 'set_id is required for bundle import.' );
		}

		$imported = 0;
		$updated  = [];
		foreach ( (array) ( $parsed['entries'] ?? [] ) as $index => $entry ) {
			$type      = sanitize_key( (string) ( $entry['type'] ?? '' ) );
			$key       = $this->normalize_astrohd_entity_key( $type, sanitize_key( (string) ( $entry['key'] ?? '' ) ) );
			$entity_id = $this->find_entity_id( $module_id, $type, $key );
			if ( $entity_id <= 0 ) {
				if ( ! $this->is_auto_creatable_definition_entity_type( $type ) ) {
					continue;
				}
				$entity = $this->upsert_entity( [
					'module_id'     => $module_id,
					'entity_type'   => $type,
					'entity_key'    => $key,
					'label'         => sanitize_text_field( (string) ( $entry['label'] ?? ucwords( str_replace( '_', ' ', $key ) ) ) ),
					'metadata_json' => [
						'section_type' => $section,
						'auto_created' => true,
						'components'   => (array) ( $entry['components'] ?? [] ),
					],
				] );
				if ( is_wp_error( $entity ) ) {
					continue;
				}
				$entity_id = (int) $entity['id'];
			}

			$result = $this->upsert_entry( [
				'set_id'            => $set_id,
				'module_id'         => $module_id,
				'entry_key'         => sanitize_key( $section . '-' . $key ),
				'title'             => sanitize_text_field( (string) ( $entry['label'] ?? $key ) ),
				'entry_kind'        => count( (array) ( $entry['entities'] ?? [] ) ) > 1 ? 'composite' : 'atomic',
				'specificity_score' => 10,
				'sort_order'        => $index,
				'metadata_json'     => [
					'bundle_section' => $section,
					'import_source'  => 'yaml_bundle',
					'raw_key'        => (string) ( $entry['key'] ?? '' ),
					'section_type'   => $section,
					'item_key'       => $key,
					'variants'       => array_keys( (array) ( $entry['variants'] ?? [] ) ),
					'modifiers'      => array_keys( (array) ( $entry['modifiers'] ?? [] ) ),
				],
				'entities'          => [
					[
						'entity_id'      => $entity_id,
						'role_key'       => 'primary',
						'match_operator' => 'all_of',
						'sort_order'     => 0,
					],
				],
				'slots'             => $this->bundle_slots_from_entry( (array) $entry ),
			] );

			if ( ! is_wp_error( $result ) ) {
				foreach ( (array) ( $entry['variants'] ?? [] ) as $variant_key => $variant ) {
					if ( ! is_array( $variant ) ) {
						continue;
					}
					$this->upsert_entry_variant( [
						'entry_id'           => (int) $result['id'],
						'variant_key'        => sanitize_key( (string) $variant_key ),
						'chart_context'      => sanitize_key( (string) ( $variant['chart_context'] ?? '' ) ),
						'output_context'     => sanitize_key( (string) ( $variant['output_context'] ?? '' ) ),
						'overlay_key'        => sanitize_key( (string) ( $variant['overlay_key'] ?? $variant['overlay'] ?? 'base' ) ),
						'tone_key'           => sanitize_key( (string) ( $variant['tone_key'] ?? $variant['tone'] ?? 'default' ) ),
						'audience_key'       => sanitize_key( (string) ( $variant['audience_key'] ?? $variant['audience'] ?? '' ) ),
						'status'             => sanitize_key( (string) ( $variant['status'] ?? 'draft' ) ),
						'slots'              => (array) ( $variant['slots'] ?? [] ),
						'theme_weights_json' => (array) ( $variant['theme_weights'] ?? [] ),
						'metadata_json'      => array_diff_key( $variant, array_flip( [ 'slots', 'theme_weights' ] ) ),
					] );
				}
				$imported++;
				$updated[] = [
					'id'        => (int) $result['id'],
					'entry_key' => (string) $result['entry_key'],
					'title'     => (string) $result['title'],
				];
			}
		}

		return [
			'success'    => true,
			'imported'   => $imported,
			'validation' => $validation,
			'entries'    => $updated,
		];
	}

	public function import_set( array $payload ): array|WP_Error {
		$set_payload = $payload['set'] ?? [];
		if ( ! is_array( $set_payload ) ) {
			return new WP_Error( 'invalid_payload', 'Payload must include a set object.' );
		}

		unset( $set_payload['id'] );
		$set = $this->create_or_update_set( $set_payload );
		if ( is_wp_error( $set ) ) {
			return $set;
		}

		$imported_entities = 0;
		foreach ( (array) ( $payload['entities'] ?? [] ) as $entity_payload ) {
			unset( $entity_payload['id'] );
			$result = $this->upsert_entity( (array) $entity_payload );
			if ( ! is_wp_error( $result ) ) {
				$imported_entities++;
			}
		}

		$imported_tags = 0;
		foreach ( (array) ( $payload['tags'] ?? [] ) as $tag_payload ) {
			unset( $tag_payload['id'] );
			$result = $this->upsert_tag( (array) $tag_payload );
			if ( ! is_wp_error( $result ) ) {
				$imported_tags++;
			}
		}

		$imported_templates = 0;
		foreach ( (array) ( $payload['templates'] ?? [] ) as $template_payload ) {
			unset( $template_payload['id'] );
			$template_payload['set_id'] = (int) $set['id'];
			$result = $this->upsert_template( (array) $template_payload );
			if ( ! is_wp_error( $result ) ) {
				$imported_templates++;
			}
		}

		$imported_entries = 0;
		foreach ( (array) ( $payload['entries'] ?? [] ) as $entry_payload ) {
			unset( $entry_payload['id'] );
			$entry_payload['set_id'] = (int) $set['id'];
			$result = $this->upsert_entry( (array) $entry_payload );
			if ( ! is_wp_error( $result ) ) {
				$imported_entries++;
			}
		}

		$imported_variants = 0;
		$entry_key_to_id = [];
		foreach ( $this->list_entries( [ 'set_id' => (int) $set['id'] ] ) as $entry ) {
			$entry_key_to_id[ (string) $entry['entry_key'] ] = (int) $entry['id'];
		}
		foreach ( (array) ( $payload['variants'] ?? [] ) as $variant_payload ) {
			unset( $variant_payload['id'] );
			if ( empty( $variant_payload['entry_id'] ) && ! empty( $variant_payload['entry_key'] ) ) {
				$variant_payload['entry_id'] = $entry_key_to_id[ (string) $variant_payload['entry_key'] ] ?? 0;
			}
			$result = $this->upsert_entry_variant( (array) $variant_payload );
			if ( ! is_wp_error( $result ) ) {
				$imported_variants++;
			}
		}

		$imported_chart_presets = 0;
		foreach ( (array) ( $payload['chart_presets'] ?? [] ) as $preset_payload ) {
			unset( $preset_payload['id'] );
			$preset_payload['set_id'] = (int) $set['id'];
			$result = $this->upsert_chart_preset( (array) $preset_payload );
			if ( ! is_wp_error( $result ) ) {
				$imported_chart_presets++;
			}
		}

		return [
			'set'                => $this->get_set( (int) $set['id'] ),
			'imported_entities'  => $imported_entities,
			'imported_tags'      => $imported_tags,
			'imported_templates' => $imported_templates,
			'imported_entries'   => $imported_entries,
			'imported_variants'  => $imported_variants,
			'imported_chart_presets' => $imported_chart_presets,
		];
	}

	public function resolve( array $payload ): array {
		$set_id         = (int) ( $payload['set_id'] ?? 0 );
		$module_id      = sanitize_key( (string) ( $payload['module_id'] ?? '' ) );
		$output_context = sanitize_key( (string) ( $payload['output_context'] ?? '' ) );
		$render_context = $this->normalize_render_context( $payload );
		$chart_preset   = $this->resolve_chart_preset_for_payload( $payload );
		if ( $chart_preset && '' === $output_context ) {
			$output_context = sanitize_key( (string) ( $chart_preset['output_context'] ?? '' ) );
		}
		if ( $chart_preset ) {
			$payload = $this->apply_chart_preset_to_payload( $payload, $chart_preset );
			$render_context = $this->normalize_render_context( $payload );
		}
		$template_key   = sanitize_key( (string) ( $payload['template_key'] ?? '' ) );
		if ( '' === $template_key && $chart_preset ) {
			$preset_config = is_array( $chart_preset['config'] ?? null ) ? $chart_preset['config'] : [];
			$template_key  = sanitize_key( (string) ( $preset_config['template_key'] ?? '' ) );
		}
		$active_ids     = $this->resolve_active_entity_ids( (array) ( $payload['active_entities'] ?? [] ) );
		// Per-request role overrides (entity_id => role_key) so synth templates can weave
		// two same-type pieces distinctly (planet_a / planet_b, sign_a / sign_b, …).
		$render_context['role_overrides'] = $this->resolve_active_entity_roles( (array) ( $payload['active_entities'] ?? [] ) );

		// Only entries that reference one of the active entities can match (composite or
		// atomic). Narrow by SQL first, then hydrate just those — avoids loading and
		// hydrating every entry in the set on each resolve (the synthesis-card hot path).
		$candidate_entry_ids = $this->find_candidate_entry_ids_for_active( $set_id, $active_ids );
		$entries = empty( $candidate_entry_ids )
			? []
			: $this->list_entries( [
				'set_id'     => $set_id,
				'module_id'  => $module_id,
				'is_enabled' => 1,
				'entry_ids'  => $candidate_entry_ids,
			] );

		$composite_candidates = [];
		$atomic_candidates    = [];
		$fallback_candidates  = [];

		foreach ( $entries as $entry ) {
			$entry_entity_ids = array_map( fn( array $entity ): int => (int) $entity['entity_id'], $entry['entities'] );
			$matches_context  = '' === $output_context || '' === (string) $entry['output_context'] || $entry['output_context'] === $output_context;
			if ( ! $matches_context ) {
				continue;
			}

			if ( empty( $entry_entity_ids ) ) {
				$fallback_candidates[] = $entry;
				continue;
			}

			$missing = array_diff( $entry_entity_ids, $active_ids );
			if ( ! empty( $missing ) ) {
				continue;
			}

			if ( count( $entry_entity_ids ) > 1 || 'composite' === $entry['entry_kind'] ) {
				$composite_candidates[] = $entry;
			} else {
				$atomic_candidates[] = $entry;
			}
		}

		$sorter = static function ( array $a, array $b ): int {
			$a_score = count( $a['entities'] ) + (int) $a['specificity_score'];
			$b_score = count( $b['entities'] ) + (int) $b['specificity_score'];
			if ( $a_score !== $b_score ) {
				return $b_score <=> $a_score;
			}
			if ( (int) $a['sort_order'] !== (int) $b['sort_order'] ) {
				return (int) $a['sort_order'] <=> (int) $b['sort_order'];
			}
			return (int) $a['id'] <=> (int) $b['id'];
		};

		usort( $composite_candidates, $sorter );
		usort( $atomic_candidates, $sorter );
		usort( $fallback_candidates, $sorter );

		if ( ! empty( $composite_candidates ) ) {
			$selected = $composite_candidates[0];
			$result   = [
				'mode'            => 'exact_composite',
				'matched_entry'   => $selected,
				'matched_entries' => [ $selected ],
				'matched_variants' => $render_context['variants'],
				'matched_modifiers' => $render_context['modifiers'],
				'rendered_text'   => $this->append_modifier_riders( $this->render_entry_slots( $selected, $output_context, $render_context ), [ $selected ], $output_context, $render_context ),
			];
			$result = $this->decorate_result_with_chart_preset( $result, $chart_preset, $output_context, $render_context );
			$this->log_render( $set_id, $module_id, $output_context, $payload, $result );
			return $result;
		}

		$template = $this->find_best_template( $set_id, $module_id, $output_context, $template_key );
		if ( ! empty( $atomic_candidates ) ) {
			$result = [
				'mode'            => $template ? 'template' : 'atomic_fallback',
				'matched_entry'   => null,
				'matched_entries' => $atomic_candidates,
				'template'        => $template,
				'matched_variants' => $render_context['variants'],
				'matched_modifiers' => $render_context['modifiers'],
				'rendered_text'   => $this->append_modifier_riders( $template ? $this->render_template( $template, $atomic_candidates, $output_context, $render_context ) : $this->render_entries_fallback( $atomic_candidates, $output_context, $render_context ), $atomic_candidates, $output_context, $render_context ),
			];
			$result = $this->decorate_result_with_chart_preset( $result, $chart_preset, $output_context, $render_context );
			$this->log_render( $set_id, $module_id, $output_context, $payload, $result );
			return $result;
		}

		// Reached only when no composite/atomic entry matched: lazily hydrate the set's
		// entity-less fallback entries (excluded from the narrowed query above) and pick one.
		$fallback_entries = $this->list_entries( [
			'set_id'     => $set_id,
			'module_id'  => $module_id,
			'is_enabled' => 1,
			'entry_ids'  => $this->find_entityless_entry_ids( $set_id ),
		] );
		foreach ( $fallback_entries as $entry ) {
			if ( ! empty( $entry['entities'] ) ) {
				continue;
			}
			$matches_context = '' === $output_context || '' === (string) $entry['output_context'] || $entry['output_context'] === $output_context;
			if ( $matches_context ) {
				$fallback_candidates[] = $entry;
			}
		}
		usort( $fallback_candidates, $sorter );

		$result = [
			'mode'            => ! empty( $fallback_candidates ) ? 'set_fallback' : 'empty',
			'matched_entry'   => $fallback_candidates[0] ?? null,
			'matched_entries' => $fallback_candidates ? [ $fallback_candidates[0] ] : [],
			'matched_variants' => $render_context['variants'],
			'matched_modifiers' => $render_context['modifiers'],
			'rendered_text'   => ! empty( $fallback_candidates ) ? $this->append_modifier_riders( $this->render_entry_slots( $fallback_candidates[0], $output_context, $render_context ), [ $fallback_candidates[0] ], $output_context, $render_context ) : '',
		];
		$result = $this->decorate_result_with_chart_preset( $result, $chart_preset, $output_context, $render_context );
		$this->log_render( $set_id, $module_id, $output_context, $payload, $result );
		return $result;
	}

	/**
	 * Resolve a single addressable slot for one entity.
	 *
	 * This is the first-class "pull any slot on its own" API used by chart boxes,
	 * report panels, and synthesis templates. It returns exactly one field's value,
	 * walking the fallback ladder: requested overlay/tone variant -> base/general.
	 *
	 * @param array{
	 *   set_id:int, module_id:string, entity_type:string, entity_key:string,
	 *   layer?:string, slot_key?:string,
	 *   overlay?:string, overlay_key?:string, tone?:string, tone_key?:string,
	 *   context?:string, chart_context?:string, audience?:string, audience_key?:string,
	 *   modifier_type?:string, modifier_key?:string, modifier?:string,
	 *   statuses?:array, include_unapproved?:bool
	 * } $args
	 * @return array{value:string, format:string, resolved_address:string, fallback_used:bool, found:bool, entity_id:int, entry_key:string, matched_variant_key:string}
	 */
	public function resolve_slot( array $args, &$memo = null ): array {
		// Request-scoped memo (supplied by resolve_slots for batch calls): avoids
		// re-running entity lookup, entry hydration, and variant application when the
		// same entity appears for multiple slots/cards in one batch. A standalone call
		// gets a throwaway local memo.
		$local = [ 'entities' => [], 'variants' => [] ];
		if ( ! is_array( $memo ) ) {
			$memo = &$local;
		}

		$set_id      = (int) ( $args['set_id'] ?? 0 );
		$module_id   = sanitize_key( (string) ( $args['module_id'] ?? '' ) );
		$entity_type = sanitize_key( (string) ( $args['entity_type'] ?? '' ) );
		$entity_key  = sanitize_key( str_replace( '/', '-', (string) ( $args['entity_key'] ?? '' ) ) );
		$layer       = sanitize_key( (string) ( $args['layer'] ?? $args['slot_key'] ?? '' ) );

		$empty = [
			'value'               => '',
			'format'              => 'markdown',
			'resolved_address'    => '',
			'fallback_used'       => false,
			'found'               => false,
			'entity_id'           => 0,
			'entry_key'           => '',
			'matched_variant_key' => '',
		];

		if ( $set_id <= 0 || '' === $module_id || '' === $entity_type || '' === $entity_key || '' === $layer ) {
			return $empty;
		}

		// Load (and memoize) the entity id + hydrated base entry by entity coordinates.
		// The same entity is requested once per slot, so this is the bulk of the savings.
		$entity_coord = $set_id . '|' . $module_id . '|' . $entity_type . '|' . $entity_key;
		if ( ! array_key_exists( $entity_coord, $memo['entities'] ) ) {
			$loaded = [ 'entity_id' => 0, 'entry' => null ];
			$loaded['entity_id'] = $this->find_entity_id( $module_id, $entity_type, $entity_key );
			if ( $loaded['entity_id'] > 0 ) {
				$loaded_entry_id = $this->find_atomic_entry_id_for_entity( $set_id, $loaded['entity_id'] );
				if ( $loaded_entry_id > 0 ) {
					$loaded['entry'] = $this->get_entry( $loaded_entry_id );
				}
			}
			$memo['entities'][ $entity_coord ] = $loaded;
		}
		$entity_id  = (int) $memo['entities'][ $entity_coord ]['entity_id'];
		$base_entry = $memo['entities'][ $entity_coord ]['entry'];

		if ( $entity_id <= 0 ) {
			return $empty;
		}
		if ( ! $base_entry ) {
			return array_merge( $empty, [ 'entity_id' => $entity_id ] );
		}

		// Build a render context honoring overlay (side) / tone / context / audience / modifier.
		$context_payload = [];
		if ( '' !== ( $overlay = sanitize_key( (string) ( $args['overlay'] ?? $args['overlay_key'] ?? '' ) ) ) ) {
			$context_payload['overlay_key'] = $overlay;
		}
		if ( '' !== ( $tone = sanitize_key( (string) ( $args['tone'] ?? $args['tone_key'] ?? '' ) ) ) ) {
			$context_payload['tone_key'] = $tone;
		}
		if ( '' !== ( $chart_context = sanitize_key( (string) ( $args['context'] ?? $args['chart_context'] ?? '' ) ) ) ) {
			$context_payload['chart_context'] = $chart_context;
		}
		if ( '' !== ( $audience = sanitize_key( (string) ( $args['audience'] ?? $args['audience_key'] ?? '' ) ) ) ) {
			$context_payload['audience_key'] = $audience;
		}
		$modifier_key = sanitize_key( (string) ( $args['modifier_key'] ?? $args['modifier'] ?? '' ) );
		$modifier_type = sanitize_key( (string) ( $args['modifier_type'] ?? '' ) );
		if ( '' !== $modifier_key ) {
			$modifiers = [ $modifier_key ];
			if ( '' !== $modifier_type ) {
				$modifiers[] = $modifier_type . '_' . $modifier_key;
			}
			$context_payload['modifier_keys'] = $modifiers;
		}
		if ( ! empty( $args['statuses'] ) ) {
			$context_payload['statuses'] = (array) $args['statuses'];
		}
		if ( ! empty( $args['include_unapproved'] ) ) {
			$context_payload['include_unapproved'] = true;
		}

		$render_context = $this->normalize_render_context( $context_payload );

		// Variant application is deterministic given (base entry, render context), so memoize
		// it per entity+context — the same entity resolved for several slots shares one result.
		$variant_coord = $entity_coord . '#' . md5( (string) wp_json_encode( $render_context ) );
		if ( ! array_key_exists( $variant_coord, $memo['variants'] ) ) {
			$memo['variants'][ $variant_coord ] = $this->apply_best_variant_to_entry( $base_entry, '', $render_context );
		}
		$entry           = $memo['variants'][ $variant_coord ];
		$matched_variant = is_array( $entry['matched_variant'] ?? null ) ? $entry['matched_variant'] : [];
		$value           = $this->get_scoped_slot_value( (array) ( $entry['slots'] ?? [] ), $layer, '', $render_context );

		// Determine which slot scope satisfied the request so callers know whether a
		// specific overlay/tone was honored or we fell back to the general/base atom.
		$matched_scope = $this->scope_of_resolved_slot( (array) ( $entry['slots'] ?? [] ), $layer, '', $render_context );
		$requested_specific = ( '' !== $overlay && 'base' !== $overlay && 'general' !== $overlay )
			|| ( '' !== $tone && 'default' !== $tone )
			|| ( '' !== $chart_context && 'natal' !== $chart_context )
			|| ( '' !== $modifier_key );
		$fallback_used = $requested_specific && 'variant' !== $matched_scope && 'modifier' !== $matched_scope;

		$address_parts = [ $module_id, $entity_type, $entity_key ];
		if ( '' !== $modifier_key ) {
			$address_parts[] = ( '' !== $modifier_type ? $modifier_type . ':' : '' ) . $modifier_key;
		}
		$resolved_address = implode( ':', $address_parts ) . '.' . $layer;
		if ( '' !== $overlay ) {
			$resolved_address .= '@' . $overlay;
		}

		return [
			'value'               => $value,
			'format'              => 'markdown',
			'resolved_address'    => $resolved_address,
			'fallback_used'       => $fallback_used,
			'found'               => '' !== trim( $value ),
			'entity_id'           => $entity_id,
			'entry_key'           => (string) ( $entry['entry_key'] ?? '' ),
			'matched_variant_key' => (string) ( $matched_variant['variant_key'] ?? '' ),
		];
	}

	/**
	 * Batch variant of resolve_slot. Each request may carry its own address/coordinates
	 * and inherits the shared defaults passed in $shared (set_id, module_id, overlay, tone...).
	 *
	 * @param array<int, array<string, mixed>> $requests
	 * @param array<string, mixed>             $shared
	 * @return array<int, array<string, mixed>>
	 */
	public function resolve_slots( array $requests, array $shared = [] ): array {
		$results = [];
		$memo    = [ 'entities' => [], 'variants' => [] ];
		foreach ( $requests as $request ) {
			if ( ! is_array( $request ) ) {
				continue;
			}
			$results[] = $this->resolve_slot( array_merge( $shared, $request ), $memo );
		}
		return $results;
	}

	/**
	 * Find the best entry that represents a single entity within a set. Prefers an
	 * atomic single-entity entry over a composite one.
	 */
	/**
	 * Entry ids in a set that reference at least one of the given active entity ids.
	 * Lets resolve() hydrate only candidate entries instead of the whole set.
	 *
	 * @param array<int,int> $active_ids
	 * @return array<int,int>
	 */
	private function find_candidate_entry_ids_for_active( int $set_id, array $active_ids ): array {
		global $wpdb;
		$ids = array_values( array_unique( array_filter( array_map( 'intval', $active_ids ) ) ) );
		if ( $set_id <= 0 || empty( $ids ) ) {
			return [];
		}
		$p   = $wpdb->prefix . 'lunacco_def_';
		$in  = implode( ',', $ids );
		return array_map( 'intval', $wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT ee.entry_id
				 FROM {$p}entry_entities ee
				 INNER JOIN {$p}entries e ON e.id = ee.entry_id
				 WHERE e.set_id = %d AND e.is_enabled = 1 AND ee.entity_id IN ({$in})",
				$set_id
			)
		) );
	}

	/**
	 * Entry ids in a set that have no linked entities (the set-wide fallback entries).
	 *
	 * @return array<int,int>
	 */
	private function find_entityless_entry_ids( int $set_id ): array {
		global $wpdb;
		if ( $set_id <= 0 ) {
			return [];
		}
		$p = $wpdb->prefix . 'lunacco_def_';
		return array_map( 'intval', $wpdb->get_col(
			$wpdb->prepare(
				"SELECT e.id
				 FROM {$p}entries e
				 LEFT JOIN {$p}entry_entities ee ON ee.entry_id = e.id
				 WHERE e.set_id = %d AND e.is_enabled = 1 AND ee.id IS NULL",
				$set_id
			)
		) );
	}

	private function find_atomic_entry_id_for_entity( int $set_id, int $entity_id ): int {
		global $wpdb;

		$p = $wpdb->prefix . 'lunacco_def_';
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT e.id
				 FROM {$p}entries e
				 INNER JOIN {$p}entry_entities ee ON ee.entry_id = e.id
				 WHERE e.set_id = %d AND ee.entity_id = %d AND e.is_enabled = 1
				 ORDER BY ( e.entry_kind = 'atomic' ) DESC,
				          ( SELECT COUNT(*) FROM {$p}entry_entities x WHERE x.entry_id = e.id ) ASC,
				          e.specificity_score ASC, e.id ASC
				 LIMIT 1",
				$set_id,
				$entity_id
			)
		);
	}

	/**
	 * Mirror of get_scoped_slot_value that reports which scope (variant/modifier/base)
	 * supplied the value, used to decide whether a fallback occurred.
	 */
	private function scope_of_resolved_slot( array $slots, string $slot_key, string $output_context, array $render_context ): string {
		foreach ( [ 'variant', 'modifier', 'base' ] as $scope ) {
			foreach ( $slots as $slot ) {
				if ( (string) $slot['slot_key'] !== $slot_key ) {
					continue;
				}
				if ( '' !== $output_context && '' !== (string) $slot['output_context'] && (string) $slot['output_context'] !== $output_context ) {
					continue;
				}
				if ( ! $this->slot_matches_scope( $slot, $scope, $render_context ) ) {
					continue;
				}
				if ( '' !== trim( (string) ( $slot['slot_value'] ?? '' ) ) ) {
					return $scope;
				}
			}
		}
		return '';
	}

	/**
	 * Fast cross-module FULLTEXT search over the denormalized search index.
	 *
	 * @return array{query:string, total:int, results:array<int, array<string, mixed>>}
	 */
	public function search_definitions( array $args ): array {
		global $wpdb;

		$query = trim( (string) ( $args['q'] ?? '' ) );
		$limit = max( 1, min( 100, (int) ( $args['limit'] ?? 30 ) ) );
		if ( '' === $query ) {
			return [ 'query' => '', 'total' => 0, 'results' => [] ];
		}

		$table = $wpdb->prefix . 'lunacco_def_search_index';

		// Boolean-mode prefix match so partial words (e.g. "gemin") still hit.
		$boolean = implode( ' ', array_map(
			static fn( string $term ): string => '+' . $term . '*',
			array_filter( preg_split( '/\s+/', preg_replace( '/[+\-><\(\)~*\"@]+/', ' ', $query ) ?: $query ) )
		) );
		$relevance_sql = 'MATCH(title, body) AGAINST(%s IN BOOLEAN MODE)';
		$like          = '%' . $wpdb->esc_like( $query ) . '%';

		// FULLTEXT for relevance, OR a forgiving LIKE across title / key / body so a
		// definition's title words always match even on short tokens.
		$where  = [ "( {$relevance_sql} OR title LIKE %s OR entity_key LIKE %s OR body LIKE %s )" ];
		$params = [ $boolean, $like, $like, $like ];

		if ( ! empty( $args['set_id'] ) ) {
			$where[]  = 'set_id = %d';
			$params[] = (int) $args['set_id'];
		}
		foreach ( [ 'module_id', 'entity_type' ] as $str_field ) {
			if ( ! empty( $args[ $str_field ] ) ) {
				$where[]  = "{$str_field} = %s";
				$params[] = sanitize_key( (string) $args[ $str_field ] );
			}
		}

		$sql = "SELECT entry_id, set_id, module_id, entity_type, entity_key, title, {$relevance_sql} AS relevance
			FROM {$table}
			WHERE " . implode( ' AND ', $where ) . "
			ORDER BY relevance DESC, title ASC
			LIMIT %d";
		// relevance_sql appears in SELECT and WHERE, so the boolean param leads twice.
		$prepared_params = array_merge( [ $boolean ], $params, [ $limit ] );

		$rows = $wpdb->get_results( $wpdb->prepare( $sql, ...$prepared_params ), ARRAY_A ) ?: [];

		return [
			'query'   => $query,
			'total'   => count( $rows ),
			'results' => array_map( static function ( array $row ): array {
				return [
					'entry_id'    => (int) $row['entry_id'],
					'set_id'      => (int) $row['set_id'],
					'module_id'   => (string) $row['module_id'],
					'entity_type' => (string) $row['entity_type'],
					'entity_key'  => (string) $row['entity_key'],
					'title'       => (string) $row['title'],
					'relevance'   => (float) $row['relevance'],
				];
			}, $rows ),
		];
	}

	/** Rebuild the search index for a single entry (called whenever an entry's slots change). */
	public function reindex_entry( int $entry_id ): void {
		global $wpdb;

		$entry = $this->get_entry( $entry_id );
		$table = $wpdb->prefix . 'lunacco_def_search_index';
		if ( ! $entry ) {
			$wpdb->delete( $table, [ 'entry_id' => $entry_id ], [ '%d' ] );
			return;
		}

		$primary_entity = [];
		foreach ( (array) ( $entry['entities'] ?? [] ) as $link ) {
			if ( is_array( $link['entity'] ?? null ) ) {
				$primary_entity = $link['entity'];
				break;
			}
		}

		$parts = [ (string) ( $entry['title'] ?? '' ), (string) ( $primary_entity['label'] ?? '' ), (string) ( $primary_entity['entity_key'] ?? '' ) ];
		foreach ( (array) ( $entry['slots'] ?? [] ) as $slot ) {
			$parts[] = (string) ( $slot['slot_value'] ?? '' );
		}
		$body = trim( wp_strip_all_tags( implode( "\n", array_filter( $parts ) ) ) );

		$wpdb->replace( $table, [
			'entry_id'    => $entry_id,
			'set_id'      => (int) ( $entry['set_id'] ?? 0 ),
			'module_id'   => (string) ( $entry['module_id'] ?? '' ),
			'entity_type' => (string) ( $primary_entity['entity_type'] ?? '' ),
			'entity_key'  => (string) ( $primary_entity['entity_key'] ?? '' ),
			'title'       => (string) ( $entry['title'] ?? '' ),
			'body'        => $body,
		] );
	}

	/**
	 * Merge duplicate atomic entries that point at the same entity (e.g. a seeded
	 * "hd_types-generator" plus an imported "hd_type-generator"). Keeps the lowest-id
	 * entry, folds in every non-empty slot/variant from the others, and deletes the rest.
	 *
	 * @return int number of duplicate entries removed
	 */
	public function dedupe_set_entries( int $set_id ): int {
		$entries  = $this->list_entries( [ 'set_id' => $set_id ] );
		$by_entity = [];
		foreach ( $entries as $entry ) {
			$eid = 0;
			foreach ( (array) ( $entry['entities'] ?? [] ) as $link ) {
				if ( ! empty( $link['entity_id'] ) ) { $eid = (int) $link['entity_id']; break; }
			}
			if ( $eid <= 0 ) { continue; }
			$by_entity[ $eid ][] = $entry;
		}

		$removed = 0;
		foreach ( $by_entity as $group ) {
			if ( count( $group ) < 2 ) { continue; }
			usort( $group, static fn( array $a, array $b ): int => (int) $a['id'] <=> (int) $b['id'] );
			$keeper = $group[0];

			// Union slots across all duplicates, preferring non-empty values.
			$slot_map = [];
			foreach ( $group as $entry ) {
				foreach ( (array) ( $entry['slots'] ?? [] ) as $sl ) {
					$meta = is_array( $sl['metadata_json'] ?? null ) ? $sl['metadata_json'] : [ 'scope' => 'base' ];
					$mkey = ( $meta['scope'] ?? 'base' ) . '|' . ( $meta['modifier'] ?? '' ) . '|' . $sl['slot_key'];
					$val  = (string) ( $sl['slot_value'] ?? '' );
					if ( ! isset( $slot_map[ $mkey ] ) || ( '' === trim( (string) $slot_map[ $mkey ]['slot_value'] ) && '' !== trim( $val ) ) ) {
						$slot_map[ $mkey ] = [
							'slot_key'       => (string) $sl['slot_key'],
							'slot_value'     => $val,
							'slot_format'    => (string) ( $sl['slot_format'] ?? 'markdown' ),
							'output_context' => (string) ( $sl['output_context'] ?? '' ),
							'metadata_json'  => $meta,
						];
					}
				}
			}

			$this->upsert_entry( [
				'id'         => (int) $keeper['id'],
				'set_id'     => $set_id,
				'module_id'  => (string) $keeper['module_id'],
				'entry_key'  => (string) $keeper['entry_key'],
				'title'      => (string) $keeper['title'],
				'entry_kind' => 'atomic',
				'entities'   => array_map( static fn( array $l ): array => [ 'entity_id' => (int) $l['entity_id'], 'role_key' => (string) ( $l['role_key'] ?? 'primary' ) ], (array) $keeper['entities'] ),
				'slots'      => array_values( $slot_map ),
			] );

			foreach ( array_slice( $group, 1 ) as $dup ) {
				foreach ( (array) ( $dup['variants'] ?? [] ) as $v ) {
					$this->upsert_entry_variant( [
						'entry_id'      => (int) $keeper['id'],
						'variant_key'   => (string) ( $v['variant_key'] ?? '' ),
						'chart_context' => (string) ( $v['chart_context'] ?? '' ),
						'overlay_key'   => (string) ( $v['overlay_key'] ?? 'base' ),
						'tone_key'      => (string) ( $v['tone_key'] ?? 'default' ),
						'status'        => (string) ( $v['status'] ?? 'draft' ),
						'slots'         => is_array( $v['slots'] ?? null ) ? $v['slots'] : [],
					] );
				}
				$this->delete_entry( (int) $dup['id'] );
				$removed++;
			}
		}
		return $removed;
	}

	/** Rebuild the entire search index (optionally scoped to one set). */
	public function rebuild_search_index( int $set_id = 0 ): int {
		$entries = $this->list_entries( $set_id > 0 ? [ 'set_id' => $set_id ] : [] );
		foreach ( $entries as $entry ) {
			$this->reindex_entry( (int) $entry['id'] );
		}
		return count( $entries );
	}

	/**
	 * Parse a Markdown+frontmatter authoring document into addressable units.
	 *
	 * Document shape (units repeat; a stray "---" line must not appear in a body —
	 * use *** for a horizontal rule instead):
	 *
	 *   ---
	 *   address: astro_planet:sun.shadow_short
	 *   overlay: design
	 *   usage_tags: [chart_tooltip, report_body]
	 *   ---
	 *   <markdown body for this one slot>
	 *
	 * `address` is shorthand for entity_type:entity_key.layer and may be split into
	 * explicit entity_type/entity_key/layer keys instead. Pure string work, no DB —
	 * kept static so it is unit-testable outside WordPress.
	 *
	 * @return array<int, array{frontmatter:array<string,mixed>, body:string}>
	 */
	public static function parse_markdown_units( string $content ): array {
		$content = str_replace( [ "\r\n", "\r" ], "\n", $content );
		$lines   = explode( "\n", $content );

		// Collect indexes of lines that are exactly a "---" fence.
		$fences = [];
		foreach ( $lines as $i => $line ) {
			if ( '---' === trim( $line ) ) {
				$fences[] = $i;
			}
		}

		$units = [];
		// Fences alternate: open-fm, close-fm, (next open-fm), ...
		for ( $f = 0; $f + 1 < count( $fences ); $f += 2 ) {
			$open  = $fences[ $f ];
			$close = $fences[ $f + 1 ];
			$fm_lines = array_slice( $lines, $open + 1, $close - $open - 1 );

			$body_end   = $fences[ $f + 2 ] ?? count( $lines );
			$body_lines = array_slice( $lines, $close + 1, $body_end - $close - 1 );

			// The next unit's decorative "## Title  (key)" header and blank lines live
			// outside the fences and would otherwise be swallowed into THIS body. Drop a
			// trailing run of blank lines and heading-with-parens lines so the round-trip
			// is lossless (a normal "## Summary" without parens is left intact).
			while ( ! empty( $body_lines ) ) {
				$last = trim( (string) end( $body_lines ) );
				if ( '' === $last ) { array_pop( $body_lines ); continue; }
				if ( preg_match( '/^#{1,6}\s+.*\(.+\)\s*$/', $last ) ) { array_pop( $body_lines ); continue; }
				break;
			}
			$body = implode( "\n", $body_lines );

			$frontmatter = self::parse_frontmatter_block( $fm_lines );
			if ( empty( $frontmatter ) ) {
				continue;
			}
			$units[] = [
				'frontmatter' => $frontmatter,
				'body'        => trim( $body, "\n" ),
			];
		}

		return $units;
	}

	/**
	 * Parse a constrained flat frontmatter block (key: value, inline [a, b] lists,
	 * quoted strings). Deliberately not a general YAML parser.
	 *
	 * @param array<int, string> $lines
	 * @return array<string, mixed>
	 */
	private static function parse_frontmatter_block( array $lines ): array {
		$out = [];
		foreach ( $lines as $line ) {
			$line = rtrim( $line );
			if ( '' === trim( $line ) || str_starts_with( ltrim( $line ), '#' ) ) {
				continue;
			}
			$colon = strpos( $line, ':' );
			if ( false === $colon ) {
				continue;
			}
			$key = trim( substr( $line, 0, $colon ) );
			$val = trim( substr( $line, $colon + 1 ) );
			if ( '' === $key ) {
				continue;
			}

			if ( '' === $val ) {
				$out[ $key ] = '';
				continue;
			}
			// Inline list: [a, b, c]
			if ( str_starts_with( $val, '[' ) && str_ends_with( $val, ']' ) ) {
				$inner = trim( substr( $val, 1, -1 ) );
				$out[ $key ] = '' === $inner
					? []
					: array_values( array_filter( array_map(
						static fn( string $v ): string => trim( trim( $v ), "\"'" ),
						explode( ',', $inner )
					), static fn( string $v ): bool => '' !== $v ) );
				continue;
			}
			// Scalar, strip surrounding quotes.
			$out[ $key ] = trim( $val, "\"'" );
		}
		return $out;
	}

	/**
	 * Normalize one parsed unit into a coordinate set + body. Resolves the `address`
	 * shorthand and applies defaults (overlay=general, context=natal, tone=default).
	 *
	 * @param array{frontmatter:array<string,mixed>, body:string} $unit
	 * @return array<string, mixed>|null
	 */
	private function normalize_markdown_unit( array $unit, string $default_module ): ?array {
		$fm   = $unit['frontmatter'];
		$type = sanitize_key( (string) ( $fm['entity_type'] ?? '' ) );
		$key  = sanitize_key( str_replace( '/', '-', (string) ( $fm['entity_key'] ?? '' ) ) );
		$layer = sanitize_key( (string) ( $fm['layer'] ?? $fm['slot_key'] ?? '' ) );

		// address shorthand: entity_type:entity_key.layer  (e.g. astro_planet:sun.shadow_short)
		if ( ( '' === $type || '' === $key || '' === $layer ) && ! empty( $fm['address'] ) ) {
			$address = (string) $fm['address'];
			if ( preg_match( '/^([a-z0-9_]+):([a-z0-9_\-]+)\.([a-z0-9_]+)$/i', $address, $m ) ) {
				$type  = '' !== $type ? $type : sanitize_key( $m[1] );
				$key   = '' !== $key ? $key : sanitize_key( str_replace( '/', '-', $m[2] ) );
				$layer = '' !== $layer ? $layer : sanitize_key( $m[3] );
			}
		}

		if ( '' === $type || '' === $key || '' === $layer ) {
			return null;
		}

		$overlay = sanitize_key( (string) ( $fm['overlay'] ?? $fm['side'] ?? 'general' ) ) ?: 'general';
		$tone    = sanitize_key( (string) ( $fm['tone'] ?? 'default' ) ) ?: 'default';
		$context = sanitize_key( (string) ( $fm['context'] ?? $fm['chart_context'] ?? '' ) );
		$status  = sanitize_key( (string) ( $fm['status'] ?? 'draft' ) ) ?: 'draft';

		$modifier_type = '';
		$modifier_key  = '';
		if ( ! empty( $fm['modifier'] ) ) {
			$mod = (string) $fm['modifier'];
			if ( str_contains( $mod, ':' ) ) {
				[ $modifier_type, $modifier_key ] = array_map( 'sanitize_key', explode( ':', $mod, 2 ) );
			} else {
				$modifier_key = sanitize_key( $mod );
			}
		}

		$usage_tags = array_values( array_filter( array_map( 'sanitize_key', (array) ( $fm['usage_tags'] ?? [] ) ) ) );

		return [
			'module_id'     => sanitize_key( (string) ( $fm['module'] ?? $fm['module_id'] ?? $default_module ) ),
			'entity_type'   => $type,
			'entity_key'    => $key,
			'label'         => (string) ( $fm['label'] ?? ucwords( str_replace( [ '_', '-' ], ' ', $key ) ) ),
			'layer'         => $layer,
			'overlay'       => $overlay,
			'tone'          => $tone,
			'context'       => $context,
			'status'        => $status,
			'modifier_type' => $modifier_type,
			'modifier_key'  => $modifier_key,
			'usage_tags'    => $usage_tags,
			'body'          => (string) ( $unit['body'] ?? '' ),
		];
	}

	/**
	 * Import a Markdown+frontmatter authoring document into a set. Units are grouped
	 * by entity; general/default-tone/natal units become base slots, anything with a
	 * non-default overlay/tone/context becomes an entry variant, and modifier units
	 * become modifier-scoped slots.
	 *
	 * @return array{success:bool, imported_entries:int, units:int, skipped:int}|WP_Error
	 */
	public function import_markdown( array $payload ): array|WP_Error {
		$set_id  = (int) ( $payload['set_id'] ?? 0 );
		$module  = sanitize_key( (string) ( $payload['module_id'] ?? '' ) );
		$content = (string) ( $payload['content'] ?? $payload['markdown'] ?? '' );
		// Merge mode: only the pasted (non-empty) fields are applied; every other slot
		// already on the entry is preserved. Lets you paste a partial section (e.g. just
		// theme_short + short_def from AI) without wiping the rest of the worksheet.
		$merge   = ! empty( $payload['merge'] );

		if ( $set_id <= 0 ) {
			return new WP_Error( 'missing_set_id', 'set_id is required for markdown import.' );
		}
		if ( '' === trim( $content ) ) {
			return new WP_Error( 'empty_markdown', 'No markdown content provided.' );
		}

		$units   = self::parse_markdown_units( $content );
		$skipped = 0;
		$skipped_addresses = [];
		$grouped = [];
		// Whitelist: only real sections (blueprint keys) and real fields (style-guide
		// slot keys) may be imported. A mistyped address must be REFUSED, never turned
		// into a brand-new atom (that's what created the duplicate ghost entries).
		$valid_types  = array_fill_keys( array_keys( $this->get_astrohd_blueprints() ), true );
		$valid_layers = array_fill_keys( array_keys( $this->get_slot_style_guide() ), true );
		foreach ( $units as $unit ) {
			$norm = $this->normalize_markdown_unit( $unit, $module );
			if ( null === $norm || '' === $norm['module_id'] ) {
				$skipped++;
				$skipped_addresses[] = (string) ( $unit['frontmatter']['address'] ?? '(malformed block)' );
				continue;
			}
			$group_key = $norm['module_id'] . ':' . $norm['entity_type'] . ':' . $norm['entity_key'];
			$grouped[ $group_key ][] = $norm;
		}

		$imported = 0;
		$index    = 0;
		foreach ( $grouped as $group ) {
			$first     = $group[0];
			$module_id = $first['module_id'];
			$type      = $first['entity_type'];
			$key       = $this->normalize_astrohd_entity_key( $type, $first['entity_key'] );
			$addr      = $type . ':' . $key;

			// Reject unknown section types outright.
			if ( empty( $valid_types[ $type ] ) ) {
				$skipped += count( $group );
				$skipped_addresses[] = $addr . ' — unknown section "' . $type . '"';
				continue;
			}

			// STRICT: the atom must already exist (seeded). Never mint a new entity from a
			// worksheet address — a typo would otherwise create a duplicate ghost atom.
			$entity_id = $this->find_entity_id( $module_id, $type, $key );
			if ( $entity_id <= 0 ) {
				$skipped += count( $group );
				$skipped_addresses[] = $addr . ' — no such atom (not seeded)';
				continue;
			}

			// Drop any units pointing at a field that isn't in the style guide.
			$group = array_values( array_filter( $group, function ( $u ) use ( $valid_layers, $addr, &$skipped, &$skipped_addresses ) {
				if ( empty( $valid_layers[ $u['layer'] ] ) ) {
					$skipped++;
					$skipped_addresses[] = $addr . '.' . $u['layer'] . ' — unknown field';
					return false;
				}
				return true;
			} ) );
			if ( empty( $group ) ) {
				continue;
			}

			$base_slots = [];
			$variants   = [];
			$sort       = 0;
			foreach ( $group as $unit ) {
				// In merge mode, blank pasted fields neither overwrite nor delete.
				if ( $merge && '' === trim( (string) $unit['body'] ) ) {
					continue;
				}
				$is_general = in_array( $unit['overlay'], [ 'general', 'base', '' ], true )
					&& in_array( $unit['tone'], [ 'default', '' ], true )
					&& in_array( $unit['context'], [ 'natal', '' ], true );

				if ( '' !== $unit['modifier_key'] ) {
					$base_slots[] = [
						'slot_key'      => $unit['layer'],
						'slot_value'    => $unit['body'],
						'slot_format'   => 'markdown',
						'sort_order'    => $sort++,
						'metadata_json' => [
							'scope'         => 'modifier',
							'modifier'      => $unit['modifier_key'],
							'modifier_type' => $unit['modifier_type'],
							'usage_tags'    => $unit['usage_tags'],
						],
					];
					continue;
				}

				if ( $is_general ) {
					$base_slots[] = [
						'slot_key'      => $unit['layer'],
						'slot_value'    => $unit['body'],
						'slot_format'   => 'markdown',
						'sort_order'    => $sort++,
						'metadata_json' => [ 'scope' => 'base', 'usage_tags' => $unit['usage_tags'] ],
					];
					continue;
				}

				$variant_key = implode( '_', array_filter( [
					$unit['context'] ?: 'natal',
					$unit['overlay'],
					$unit['tone'],
				] ) );
				$variants[ $variant_key ]['meta'] = [
					'chart_context' => $unit['context'],
					'overlay_key'   => $unit['overlay'],
					'tone_key'      => $unit['tone'],
					'status'        => $unit['status'],
				];
				$variants[ $variant_key ]['slots'][ $unit['layer'] ] = $unit['body'];
			}

			$title = sanitize_text_field( $first['label'] );

			// Always reuse the entity's existing atomic entry (the seed uses a section-based
			// entry_key like "hd_types-generator"; never mint a second row for the same entity).
			$existing_id    = $this->find_atomic_entry_id_for_entity( $set_id, $entity_id );
			$existing_entry = $existing_id ? $this->get_entry( $existing_id ) : null;
			if ( $existing_entry ) {
				$title = (string) ( $existing_entry['title'] ?: $title );
			}

			if ( $merge && $existing_entry ) {
				// Keep the existing title and carry over every slot the paste did not touch.
				$title = (string) ( $existing_entry['title'] ?: $title );
				$have  = [];
				foreach ( $base_slots as $sl ) {
					$have[ ( $sl['metadata_json']['scope'] ?? 'base' ) . '|' . ( $sl['metadata_json']['modifier'] ?? '' ) . '|' . $sl['slot_key'] ] = true;
				}
				foreach ( (array) ( $existing_entry['slots'] ?? [] ) as $sl ) {
					$meta  = is_array( $sl['metadata_json'] ?? null ) ? $sl['metadata_json'] : [ 'scope' => 'base' ];
					$mkey  = ( $meta['scope'] ?? 'base' ) . '|' . ( $meta['modifier'] ?? '' ) . '|' . $sl['slot_key'];
					if ( isset( $have[ $mkey ] ) ) {
						continue;
					}
					$base_slots[] = [
						'slot_key'       => (string) $sl['slot_key'],
						'slot_value'     => (string) ( $sl['slot_value'] ?? '' ),
						'slot_format'    => (string) ( $sl['slot_format'] ?? 'markdown' ),
						'output_context' => (string) ( $sl['output_context'] ?? '' ),
						'sort_order'     => $sort++,
						'metadata_json'  => $meta,
					];
				}
			}

			$entry = $this->upsert_entry( [
				'id'            => $existing_id ?: 0,
				'set_id'        => $set_id,
				'module_id'     => $module_id,
				'entry_key'     => $existing_entry ? (string) $existing_entry['entry_key'] : sanitize_key( $type . '-' . $key ),
				'title'         => $title,
				'entry_kind'    => 'atomic',
				'sort_order'    => $index++,
				'metadata_json' => [ 'import_source' => 'markdown_frontmatter' ],
				'entities'      => [ [ 'entity_id' => $entity_id, 'role_key' => 'primary' ] ],
				'slots'         => $base_slots,
			] );
			if ( is_wp_error( $entry ) ) {
				$skipped += count( $group );
				continue;
			}

			foreach ( $variants as $variant_key => $variant ) {
				// Merge pasted variant slots over whatever the variant already had.
				if ( $merge && $existing_entry ) {
					foreach ( (array) ( $existing_entry['variants'] ?? [] ) as $ev ) {
						if ( sanitize_key( (string) ( $ev['variant_key'] ?? '' ) ) === sanitize_key( (string) $variant_key ) ) {
							$ev_slots = is_array( $ev['slots'] ?? null ) ? $ev['slots'] : ( is_array( $ev['slots_json'] ?? null ) ? $ev['slots_json'] : [] );
							$variant['slots'] = array_merge( $ev_slots, (array) ( $variant['slots'] ?? [] ) );
							break;
						}
					}
				}
				$this->upsert_entry_variant( [
					'entry_id'      => (int) $entry['id'],
					'variant_key'   => sanitize_key( $variant_key ),
					'chart_context' => sanitize_key( (string) ( $variant['meta']['chart_context'] ?? '' ) ),
					'overlay_key'   => sanitize_key( (string) ( $variant['meta']['overlay_key'] ?? 'base' ) ),
					'tone_key'      => sanitize_key( (string) ( $variant['meta']['tone_key'] ?? 'default' ) ),
					'status'        => sanitize_key( (string) ( $variant['meta']['status'] ?? 'draft' ) ),
					'slots'         => (array) ( $variant['slots'] ?? [] ),
				] );
			}

			$imported++;
		}

		return [
			'success'            => true,
			'imported_entries'   => $imported,
			'units'              => count( $units ),
			'skipped'            => $skipped,
			'skipped_addresses'  => array_values( array_slice( $skipped_addresses, 0, 50 ) ),
		];
	}

	/**
	 * Export a set (optionally sliced by module/overlay/tone/layer) as a
	 * Markdown+frontmatter authoring document — the inverse of import_markdown.
	 */
	public function export_set_markdown( int $set_id, array $filters = [] ): string {
		$set = $this->get_set( $set_id );
		if ( ! $set ) {
			return '';
		}

		$module_filter = sanitize_key( (string) ( $filters['module_id'] ?? '' ) );
		$layer_filter  = array_values( array_filter( array_map( 'sanitize_key', (array) ( $filters['layers'] ?? [] ) ) ) );
		$overlay_filter = sanitize_key( (string) ( $filters['overlay_key'] ?? '' ) );

		$entry_filters = [ 'set_id' => $set_id ];
		if ( '' !== $module_filter ) {
			$entry_filters['module_id'] = $module_filter;
		}
		$entries = $this->list_entries( $entry_filters );

		$blocks = [
			"# Definition set: {$set['label']} ({$set['slug']})",
			'# Format: Markdown + YAML frontmatter. One block per addressable slot.',
			'# A "---" line is reserved as a fence — use *** for horizontal rules in a body.',
			'',
		];

		foreach ( $entries as $entry ) {
			$primary = [];
			foreach ( (array) $entry['entities'] as $link ) {
				if ( is_array( $link['entity'] ?? null ) ) {
					$primary = $link['entity'];
					break;
				}
			}
			if ( empty( $primary ) ) {
				continue;
			}
			$module_id   = (string) ( $entry['module_id'] ?: $primary['module_id'] );
			$entity_type = (string) $primary['entity_type'];
			$entity_key  = (string) $primary['entity_key'];
			$label       = (string) ( $entry['title'] ?: $primary['label'] );

			// Base + modifier slots.
			foreach ( (array) ( $entry['slots'] ?? [] ) as $slot ) {
				$layer = (string) $slot['slot_key'];
				if ( $layer_filter && ! in_array( $layer, $layer_filter, true ) ) {
					continue;
				}
				$meta     = is_array( $slot['metadata_json'] ?? null ) ? $slot['metadata_json'] : [];
				$scope    = (string) ( $meta['scope'] ?? 'base' );
				$modifier = (string) ( $meta['modifier'] ?? '' );
				if ( '' !== $overlay_filter && 'general' !== $overlay_filter && 'modifier' !== $scope ) {
					continue;
				}
				$blocks[] = $this->markdown_unit_block( [
					'module'        => $module_id,
					'entity_type'   => $entity_type,
					'entity_key'    => $entity_key,
					'label'         => $label,
					'layer'         => $layer,
					'modifier'      => '' !== $modifier ? ( ( (string) ( $meta['modifier_type'] ?? '' ) ) ? $meta['modifier_type'] . ':' . $modifier : $modifier ) : '',
					'usage_tags'    => (array) ( $meta['usage_tags'] ?? [] ),
				], (string) ( $slot['slot_value'] ?? '' ) );
			}

			// Variant slots (overlay/tone/context).
			foreach ( (array) ( $entry['variants'] ?? [] ) as $variant ) {
				$overlay = (string) ( $variant['overlay_key'] ?? 'base' );
				if ( '' !== $overlay_filter && $overlay_filter !== $overlay ) {
					continue;
				}
				foreach ( (array) ( $variant['slots'] ?? [] ) as $layer => $value ) {
					if ( is_array( $value ) ) {
						continue;
					}
					if ( $layer_filter && ! in_array( sanitize_key( (string) $layer ), $layer_filter, true ) ) {
						continue;
					}
					$blocks[] = $this->markdown_unit_block( [
						'module'      => $module_id,
						'entity_type' => $entity_type,
						'entity_key'  => $entity_key,
						'label'       => $label,
						'layer'       => sanitize_key( (string) $layer ),
						'overlay'     => 'base' === $overlay ? 'general' : $overlay,
						'tone'        => (string) ( $variant['tone_key'] ?? 'default' ),
						'context'     => (string) ( $variant['chart_context'] ?? '' ),
						'status'      => (string) ( $variant['status'] ?? 'draft' ),
					], (string) $value );
				}
			}
		}

		return implode( "\n", $blocks ) . "\n";
	}

	/** Serialize one frontmatter+body unit. */
	private function markdown_unit_block( array $coords, string $body ): string {
		$type = (string) $coords['entity_type'];
		$key  = (string) $coords['entity_key'];
		$layer = (string) $coords['layer'];

		$fm = [ 'address: ' . $type . ':' . $key . '.' . $layer ];
		$fm[] = 'module: ' . (string) $coords['module'];
		if ( ! empty( $coords['label'] ) ) {
			$fm[] = 'label: ' . (string) $coords['label'];
		}
		$overlay = (string) ( $coords['overlay'] ?? 'general' );
		$fm[] = 'overlay: ' . ( '' !== $overlay ? $overlay : 'general' );
		if ( ! empty( $coords['tone'] ) && 'default' !== $coords['tone'] ) {
			$fm[] = 'tone: ' . (string) $coords['tone'];
		}
		if ( ! empty( $coords['context'] ) ) {
			$fm[] = 'context: ' . (string) $coords['context'];
		}
		if ( ! empty( $coords['modifier'] ) ) {
			$fm[] = 'modifier: ' . (string) $coords['modifier'];
		}
		if ( ! empty( $coords['usage_tags'] ) ) {
			$fm[] = 'usage_tags: [' . implode( ', ', array_map( 'sanitize_key', (array) $coords['usage_tags'] ) ) . ']';
		}
		if ( ! empty( $coords['status'] ) ) {
			$fm[] = 'status: ' . (string) $coords['status'];
		}

		return "---\n" . implode( "\n", $fm ) . "\n---\n" . trim( $body ) . "\n";
	}

	public function migrate_legacy_astrohd_set( int $legacy_set_id ): array|WP_Error {
		global $wpdb;

		$legacy_set_table     = $wpdb->prefix . 'lt_astrohd_definition_sets';
		$legacy_section_table = $wpdb->prefix . 'lt_astrohd_definition_sections';

		$legacy_set = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$legacy_set_table} WHERE id = %d", $legacy_set_id ),
			ARRAY_A
		);

		if ( ! $legacy_set ) {
			return new WP_Error( 'legacy_set_not_found', 'Legacy AstroHD set not found.' );
		}

		$core_set = $this->create_or_update_set( [
			'slug'        => sanitize_title( (string) $legacy_set['slug'] ) . '-core',
			'label'       => sanitize_text_field( (string) $legacy_set['label'] ),
			'description' => sanitize_textarea_field( (string) ( $legacy_set['description'] ?? '' ) ),
			'set_type'    => 'legacy_import',
			'owner_id'    => (int) ( $legacy_set['owner_id'] ?? 0 ),
			'is_default'  => empty( $legacy_set['is_default'] ) ? 0 : 1,
			'is_public'   => empty( $legacy_set['is_public'] ) ? 0 : 1,
			'modules'     => [
				[
					'module_id'     => 'luna-astrohd',
					'system_key'    => sanitize_key( (string) ( $legacy_set['category'] ?? 'astrohd' ) ),
					'is_required'   => 1,
					'sort_order'    => 0,
					'metadata_json' => [ 'legacy_set_id' => $legacy_set_id ],
				],
			],
			'metadata_json' => [
				'legacy_source' => 'astrohd',
				'legacy_set_id' => $legacy_set_id,
			],
		] );

		if ( is_wp_error( $core_set ) ) {
			return $core_set;
		}

		$sections = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$legacy_section_table} WHERE set_id = %d ORDER BY section_type ASC, id ASC", $legacy_set_id ),
			ARRAY_A
		) ?: [];

		$imported_entities = 0;
		$imported_entries  = 0;
		foreach ( $sections as $section ) {
			$entity_type = $this->astrohd_entity_type_from_section( (string) $section['section_type'] );
			$entity      = $this->upsert_entity( [
				'module_id'    => 'luna-astrohd',
				'entity_type'  => $entity_type,
				'entity_key'   => sanitize_key( (string) $section['item_key'] ),
				'label'        => sanitize_text_field( (string) $section['title'] ),
				'description'  => '',
				'metadata_json' => [
					'legacy_section_type' => (string) $section['section_type'],
					'legacy_item_key'     => (string) $section['item_key'],
					'legacy_section_id'   => (int) $section['id'],
					'extra_meta'          => $this->decode_json( (string) ( $section['extra_meta'] ?? '' ) ),
				],
			] );
			if ( is_wp_error( $entity ) ) {
				continue;
			}
			$imported_entities++;

			$entry = $this->upsert_entry( [
				'set_id'         => (int) $core_set['id'],
				'module_id'      => 'luna-astrohd',
				'entry_key'      => sanitize_key( (string) $section['section_type'] . '-' . (string) $section['item_key'] ),
				'title'          => sanitize_text_field( (string) $section['title'] ),
				'entry_kind'     => 'atomic',
				'legacy_source'  => 'astrohd_definition_section',
				'specificity_score' => 10,
				'metadata_json'  => [
					'legacy_section_type' => (string) $section['section_type'],
					'legacy_item_key'     => (string) $section['item_key'],
					'legacy_section_id'   => (int) $section['id'],
				],
				'entities'       => [
					[
						'entity_id'      => (int) $entity['id'],
						'role_key'       => 'primary',
						'match_operator' => 'all_of',
					],
				],
				'slots'          => array_values( array_filter( [
					[
						'slot_key'       => 'sidebar_short',
						'slot_value'     => (string) ( $section['short_text'] ?? '' ),
						'output_context' => 'sidebar_short',
						'sort_order'     => 0,
					],
					[
						'slot_key'       => 'report_snippet',
						'slot_value'     => (string) ( $section['short_text'] ?? '' ),
						'output_context' => 'report_snippet',
						'sort_order'     => 1,
					],
					[
						'slot_key'       => 'pdf_long',
						'slot_value'     => (string) ( $section['long_text'] ?? '' ),
						'output_context' => 'pdf_long',
						'sort_order'     => 2,
					],
					[
						'slot_key'       => 'keywords',
						'slot_value'     => (string) ( $section['keywords'] ?? '' ),
						'output_context' => '',
						'sort_order'     => 3,
					],
				], static function ( array $slot ): bool {
					return trim( (string) $slot['slot_value'] ) !== '';
				} ) ),
			] );

			if ( ! is_wp_error( $entry ) ) {
				$imported_entries++;
			}
		}

		return [
			'legacy_set_id'      => $legacy_set_id,
			'core_set_id'        => (int) $core_set['id'],
			'imported_entities'  => $imported_entities,
			'imported_entries'   => $imported_entries,
			'set'                => $this->get_set( (int) $core_set['id'] ),
		];
	}

	public function project_astrohd_set( int $core_set_id ): array {
		global $wpdb;
		$p = $wpdb->prefix . 'lunacco_def_';

		// Bulk-load the three things this projection actually needs (entry row, its first
		// entity, its slots) in a fixed number of queries, instead of hydrating every entry
		// one-by-one with its variants/tags/all-entities (the old list_entries path ran
		// ~5.5k queries / ~2.4s on a full set — this is the chart's initial-load hot path).
		$entries = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, title, metadata_json FROM {$p}entries
				 WHERE set_id = %d AND module_id = %s AND is_enabled = 1
				 ORDER BY specificity_score DESC, sort_order ASC, id ASC",
				$core_set_id,
				'luna-astrohd'
			),
			ARRAY_A
		) ?: [];
		if ( empty( $entries ) ) {
			return [];
		}

		$entry_ids = array_map( static fn( array $r ): int => (int) $r['id'], $entries );
		$in        = implode( ',', $entry_ids );

		// First entity per entry (ordered like get_entry_entities: sort_order, id).
		$first_entity = [];
		$entity_rows  = $wpdb->get_results(
			"SELECT ee.entry_id, en.entity_type, en.entity_key, en.metadata_json
			 FROM {$p}entry_entities ee
			 INNER JOIN {$p}entities en ON en.id = ee.entity_id
			 WHERE ee.entry_id IN ({$in})
			 ORDER BY ee.entry_id ASC, ee.sort_order ASC, ee.id ASC",
			ARRAY_A
		) ?: [];
		foreach ( $entity_rows as $er ) {
			$eid = (int) $er['entry_id'];
			if ( ! isset( $first_entity[ $eid ] ) ) {
				$first_entity[ $eid ] = $er;
			}
		}

		// All slots per entry, metadata decoded so scope resolution matches the old path.
		$slots_by_entry = [];
		$slot_rows      = $wpdb->get_results(
			"SELECT entry_id, slot_key, slot_value, output_context, metadata_json
			 FROM {$p}entry_slots
			 WHERE entry_id IN ({$in})
			 ORDER BY entry_id ASC, sort_order ASC, id ASC",
			ARRAY_A
		) ?: [];
		foreach ( $slot_rows as $sr ) {
			$sr['metadata_json']                      = $this->decode_json( $sr['metadata_json'] ?? '' );
			$slots_by_entry[ (int) $sr['entry_id'] ][] = $sr;
		}

		$rows = [];
		foreach ( $entries as $entry ) {
			$eid        = (int) $entry['id'];
			$entity_ref = $first_entity[ $eid ] ?? null;
			if ( ! is_array( $entity_ref ) ) {
				continue;
			}
			$entity_ref['metadata_json'] = $this->decode_json( $entity_ref['metadata_json'] ?? '' );
			$entry['slots']              = $slots_by_entry[ $eid ] ?? [];
			$entry['metadata_json']      = $this->decode_json( $entry['metadata_json'] ?? '' );

			$entry_meta   = is_array( $entry['metadata_json'] ) ? $entry['metadata_json'] : [];
			$entity_meta  = is_array( $entity_ref['metadata_json'] ?? null ) ? $entity_ref['metadata_json'] : [];
			$section_type = (string) ( $entry_meta['legacy_section_type'] ?? $entry_meta['section_type'] ?? $entity_meta['legacy_section_type'] ?? $entity_meta['section_type'] ?? $this->astrohd_section_from_entity_type( (string) $entity_ref['entity_type'] ) );
			$item_key     = (string) ( $entry_meta['legacy_item_key'] ?? $entry_meta['item_key'] ?? $entity_meta['legacy_item_key'] ?? $entity_meta['item_key'] ?? $entity_ref['entity_key'] );

			$rows[] = [
				'id'         => (int) $entry['id'],
				'section_type' => $section_type,
				'item_key'   => $item_key,
				'title'      => (string) $entry['title'],
				'short_text' => $this->get_slot_value_for_context( $entry['slots'], 'sidebar_short', [ 'report_snippet' ] ),
				'long_text'  => $this->get_slot_value_for_context( $entry['slots'], 'pdf_long', [ 'report_snippet', 'sidebar_short' ] ),
				'keywords'   => $this->get_slot_value_for_context( $entry['slots'], '', [ 'keywords' ] ),
				'extra_meta' => $entry_meta['extra_meta'] ?? $entity_meta['extra_meta'] ?? [],
				'image_url'  => (string) ( $entry_meta['image_url'] ?? '' ),
			];
		}

		return $rows;
	}

	public function seed_fresh_astrohd_set( array $data = [] ): array|WP_Error {
		global $wpdb;
		$requested_set_id = (int) ( $data['set_id'] ?? 0 );

		// Seeding into an existing set must respect its own slug/label (otherwise the
		// hardcoded 'astrohd-core' slug collides on the UNIQUE index and 500s).
		$existing_set = $requested_set_id > 0 ? $this->get_set( $requested_set_id ) : null;

		$slug        = sanitize_title( (string) ( $data['slug'] ?? ( $existing_set['slug'] ?? 'astrohd-core' ) ) );
		$label       = sanitize_text_field( (string) ( $data['label'] ?? ( $existing_set['label'] ?? 'AstroHD Core' ) ) );
		$description = sanitize_textarea_field( (string) ( $data['description'] ?? ( $existing_set['description'] ?? 'Fresh core-owned AstroHD definition set.' ) ) );
		$category    = sanitize_key( (string) ( $data['category'] ?? ( $existing_set['metadata_json']['category'] ?? 'astrohd' ) ) );
		$module_id   = sanitize_key( (string) ( $data['module_id'] ?? ( $existing_set['metadata_json']['module'] ?? 'luna-astrohd' ) ) );

		// Scaffold = AstroHD's base set + any module contributions (numerology, decanates…).
		// Filter-driven so it works whether or not AstroHD is active.
		$scaffold = function_exists( 'luna_astrohd_definition_set_scaffold' ) ? luna_astrohd_definition_set_scaffold() : [];
		/** @param array $scaffold section_type => rows[]. @param string $category set category. */
		$scaffold = apply_filters( 'lunacco_definition_scaffold', $scaffold, $category );
		if ( empty( $scaffold ) ) {
			return new WP_Error( 'def_scaffold_missing', 'No definition scaffold available to seed.' );
		}
		// Preserve an existing set's default flag; brand-new sets are NOT default
		// (no auto-steal) — the default is chosen explicitly via the star toggle, and
		// is only forced on when this is the very first set in the system.
		$is_default = $existing_set ? (int) ( $existing_set['is_default'] ?? 0 ) : ( empty( $this->list_sets() ) ? 1 : 0 );

		$existing = $requested_set_id > 0 ? [] : $this->list_sets( [ 'slug' => $slug ] );
		$set_id   = $requested_set_id > 0 ? $requested_set_id : ( ! empty( $existing[0]['id'] ) ? (int) $existing[0]['id'] : 0 );
		$set      = $this->create_or_update_set( [
			'id'          => $set_id,
			'slug'        => $slug,
			'label'       => $label,
			'description' => $description,
			'set_type'    => 'base',
			'is_default'  => $is_default,
			'is_enabled'  => 1,
			'modules'     => [
				[
					'module_id'   => $module_id,
					'system_key'  => $category,
					'is_required' => 1,
					'sort_order'  => 0,
				],
			],
			'metadata_json' => [
				'definition_model' => 'core_fresh_start',
				'module'           => $module_id,
				'category'         => $category,
			],
		] );

		if ( is_wp_error( $set ) ) {
			return $set;
		}

		foreach ( $scaffold as $section_type => $rows ) {
			if ( 'human_design' === $category && 0 !== strpos( $section_type, 'hd_' ) ) {
				continue;
			}
			if ( 'astrology' === $category && 0 !== strpos( $section_type, 'astro_' ) ) {
				continue;
			}
			// Numerology atoms (num_*) only belong in a numerology-category set, and a
			// numerology set holds only num_* sections.
			if ( 'numerology' === $category && 0 !== strpos( $section_type, 'num_' ) ) {
				continue;
			}
			if ( 'numerology' !== $category && 0 === strpos( $section_type, 'num_' ) ) {
				continue;
			}
			// Planets and angles are shared entities (astro_planet / astro_angle_point); the
			// hd_* sections already cover them WITH the Personality/Design side data, so skip
			// the plain astro_* duplicates unless we're seeding an astrology-only set.
			if ( 'astrology' !== $category && in_array( $section_type, [ 'astro_planets', 'astro_angles_points' ], true ) ) {
				continue;
			}

			$center_rows = [];
			if ( 'hd_centers' === $section_type ) {
				foreach ( $rows as $row ) {
					$raw_key = $this->normalize_astrohd_entity_key( 'hd_center', sanitize_key( (string) ( $row['item_key'] ?? '' ) ) );
					if ( preg_match( '/^(.+)-(defined|undefined|open)$/', $raw_key, $matches ) ) {
						$center_rows[ $matches[1] ][ $matches[2] ] = $row;
						continue;
					}
					$center_rows[ $raw_key ]['base'] = $row;
				}
				$rows = [];
				foreach ( $center_rows as $center_key => $state_rows ) {
					$base_row = $state_rows['base'] ?? reset( $state_rows );
					$label    = preg_replace( '/\s*\((Defined|Undefined \/ Open|Undefined|Open)\)\s*$/i', '', (string) ( $base_row['title'] ?? $center_key ) );
					$rows[]   = [
						'item_key'  => $center_key,
						'title'     => $label,
						'modifiers' => array_filter( [
							'defined'   => $state_rows['defined'] ?? null,
							'undefined' => $state_rows['undefined'] ?? $state_rows['open'] ?? null,
						] ),
					];
				}
			}
			if ( 'hd_profiles' === $section_type ) {
				$profile_rows = [];
				foreach ( $rows as $row ) {
					$raw_key = sanitize_key( (string) ( $row['item_key'] ?? '' ) );
					if ( preg_match( '/^([0-9]+-[0-9]+)-(fixed|mutable|cardinal)$/', $raw_key, $matches ) ) {
						$profile_rows[ $matches[1] ][ $matches[2] ] = $row;
						continue;
					}
					$profile_rows[ $raw_key ]['base'] = $row;
				}
				$rows = [];
				foreach ( $profile_rows as $profile_key => $modality_rows ) {
					$base_row = $modality_rows['base'] ?? reset( $modality_rows );
					$label    = preg_replace( '/\s*\((Fixed|Mutable|Cardinal)\)\s*$/i', '', (string) ( $base_row['title'] ?? $profile_key ) );
					$rows[]   = [
						'item_key'  => $profile_key,
						'title'     => $label,
						'modifiers' => array_filter( [
							'fixed'    => $modality_rows['fixed'] ?? null,
							'mutable'  => $modality_rows['mutable'] ?? null,
							'cardinal' => $modality_rows['cardinal'] ?? null,
						] ),
					];
				}
			}
			if ( in_array( $section_type, [ 'hd_planets', 'hd_angles_points' ], true ) ) {
				$side_rows = [];
				foreach ( $rows as $row ) {
					$raw_key = sanitize_key( (string) ( $row['item_key'] ?? '' ) );
					if ( preg_match( '/^(personality|design)-(.+)$/', $raw_key, $matches ) ) {
						$side_rows[ $matches[2] ][ $matches[1] ] = $row;
						continue;
					}
					$side_rows[ $raw_key ]['base'] = $row;
				}
				$rows = [];
				foreach ( $side_rows as $item_key => $side_group ) {
					$base_row = $side_group['base'] ?? reset( $side_group );
					$label    = preg_replace( '/\s*\((Personality \/ Conscious|Design \/ Unconscious)\)\s*$/i', '', (string) ( $base_row['title'] ?? $item_key ) );
					$rows[]   = [
						'item_key' => $item_key,
						'title'    => $label,
						'variants' => array_filter( [
							'personality' => $side_group['personality'] ?? null,
							'design'      => $side_group['design'] ?? null,
						] ),
					];
				}
			}
			// Variables are no longer collapsed: hd_variable_colors seeds the 48
			// color+direction combos as atoms, hd_variables the 4 arrow snippets, and
			// hd_variable_tones the two per-side tone sets — each straight from the scaffold.

			foreach ( $rows as $index => $row ) {
				$entity_type = $this->astrohd_entity_type_from_section( (string) $section_type );
				// Only seed true atoms as worksheet sections. Modifiers live under their
				// parent atom; synthesis combos are template-driven (Phase 4) — skip both.
				if ( 'atom' !== $this->classify_astrohd_type( $entity_type ) ) {
					continue;
				}
				$item_key    = $this->normalize_astrohd_entity_key( $entity_type, sanitize_key( (string) ( $row['item_key'] ?? '' ) ) );
				$title       = sanitize_text_field( (string) ( $row['title'] ?? $item_key ) );
				$entity      = $this->upsert_entity( [
					'module_id'    => $module_id,
					'entity_type'  => $entity_type,
					'entity_key'   => sanitize_key( $item_key ),
					'label'        => $title,
					'metadata_json' => [
						'section_type' => (string) $section_type,
						'item_key'     => $item_key,
						'seeded'       => true,
					],
				] );

				if ( is_wp_error( $entity ) ) {
					continue;
				}

				// NON-DESTRUCTIVE RESEED: if an entry with this key already exists in the set,
				// it may contain author-written slot content. replace_entry_slots() deletes all
				// slots before re-inserting, so passing the empty scaffold slots here would WIPE
				// that content. Only seed placeholder slots for brand-new atoms; for existing
				// entries we omit 'slots' entirely so their saved definitions are preserved.
				$entry_key_full    = sanitize_key( (string) $section_type . '-' . $item_key );
				$existing_entry_id = (int) $wpdb->get_var( $wpdb->prepare(
					"SELECT id FROM {$wpdb->prefix}lunacco_def_entries WHERE set_id = %d AND entry_key = %s",
					(int) $set['id'],
					$entry_key_full
				) );

				$entry_payload = [
					'set_id'            => (int) $set['id'],
					'module_id'         => $module_id,
					'entry_key'         => $entry_key_full,
					'title'             => $title,
					'entry_kind'        => 'atomic',
					'specificity_score' => 10,
					'sort_order'        => $index,
					'metadata_json'     => [
						'section_type' => (string) $section_type,
						'item_key'     => $item_key,
						'seeded'       => true,
					],
					'entities'          => [
						[
							'entity_id'      => (int) $entity['id'],
							'role_key'       => 'primary',
							'match_operator' => 'all_of',
						],
					],
				];

				// Only seed empty placeholder slots when creating a NEW atom.
				if ( $existing_entry_id <= 0 ) {
					$entry_payload['slots'] = $this->seed_slots_from_scaffold_row( $row, $entity_type );
				}

				$this->upsert_entry( $entry_payload );
			}
		}

		$this->seed_astrohd_v2_baseline_entities();
		$this->seed_astrohd_v2_templates_and_profiles( (int) $set['id'] );
		$this->dedupe_set_entries( (int) $set['id'] );
		$this->rebuild_search_index( (int) $set['id'] );

		return $this->get_set( (int) $set['id'] ) ?: new WP_Error( 'astrohd_seed_missing', 'AstroHD seed set could not be loaded.' );
	}

	public function cleanup_astrohd_set( int $set_id ): array|WP_Error {
		if ( $set_id <= 0 || ! $this->get_set( $set_id ) ) {
			return new WP_Error( 'set_not_found', 'Definition set not found.' );
		}

		$entries = $this->list_entries( [
			'set_id'    => $set_id,
			'module_id' => 'luna-astrohd',
		] );

		$center_groups = [];
		foreach ( $entries as $entry ) {
			$entity = $entry['entities'][0]['entity'] ?? null;
			if ( ! is_array( $entity ) || 'hd_center' !== (string) ( $entity['entity_type'] ?? '' ) ) {
				continue;
			}
			$key = (string) ( $entity['entity_key'] ?? '' );
			if ( preg_match( '/^(.+)-(defined|undefined|open)$/', $key, $matches ) ) {
				$center_groups[ $matches[1] ][ $matches[2] ] = $entry;
			}
		}

		$collapsed = 0;
		$deleted   = 0;
		foreach ( $center_groups as $center_key => $state_entries ) {
			$base_entity_id = $this->find_entity_id( 'luna-astrohd', 'hd_center', $center_key );
			if ( $base_entity_id <= 0 ) {
				$label = ucwords( str_replace( '_', ' ', $center_key ) ) . ' Center';
				$entity = $this->upsert_entity( [
					'module_id'   => 'luna-astrohd',
					'entity_type' => 'hd_center',
					'entity_key'  => $center_key,
					'label'       => $label,
				] );
				if ( is_wp_error( $entity ) ) {
					continue;
				}
				$base_entity_id = (int) $entity['id'];
			}

			$base_entry = null;
			foreach ( $entries as $entry ) {
				$entity = $entry['entities'][0]['entity'] ?? null;
				if ( is_array( $entity ) && 'hd_center' === (string) ( $entity['entity_type'] ?? '' ) && $center_key === (string) ( $entity['entity_key'] ?? '' ) ) {
					$base_entry = $entry;
					break;
				}
			}

			$slots = $base_entry['slots'] ?? [];
			foreach ( [ 'defined', 'undefined', 'open' ] as $state ) {
				if ( empty( $state_entries[ $state ] ) ) {
					continue;
				}
				$state_entry = $state_entries[ $state ];
				$state_slot  = $this->get_slot_value_for_context( $state_entry['slots'] ?? [], 'sidebar_short', [ 'chart_snippet', 'report_snippet', 'pdf_long' ] );
				$slots[] = [
					'slot_key'       => 'sidebar_short',
					'slot_value'     => $state_slot,
					'slot_format'    => 'markdown',
					'output_context' => '',
					'sort_order'     => count( $slots ),
					'metadata_json'  => [
						'scope'    => 'modifier',
						'modifier' => 'open' === $state ? 'undefined' : $state,
					],
				];
			}

			$title = $base_entry['title'] ?? preg_replace( '/\s*\((Defined|Undefined \/ Open|Undefined|Open)\)\s*$/i', '', (string) ( reset( $state_entries )['title'] ?? $center_key ) );
			$result = $this->upsert_entry( [
				'id'                => (int) ( $base_entry['id'] ?? 0 ),
				'set_id'            => $set_id,
				'module_id'         => 'luna-astrohd',
				'entry_key'         => sanitize_key( 'hd_centers-' . $center_key ),
				'title'             => sanitize_text_field( $title ),
				'entry_kind'        => 'atomic',
				'specificity_score' => 10,
				'metadata_json'     => [
					'section_type' => 'hd_centers',
					'item_key'     => $center_key,
					'cleaned'      => true,
				],
				'entities'          => [
					[ 'entity_id' => $base_entity_id, 'role_key' => 'primary', 'match_operator' => 'all_of' ],
				],
				'slots'             => $slots,
			] );

			if ( is_wp_error( $result ) ) {
				continue;
			}
			$collapsed++;
			foreach ( $state_entries as $state_entry ) {
				if ( empty( $base_entry['id'] ) || (int) $state_entry['id'] !== (int) $base_entry['id'] ) {
					if ( $this->delete_entry( (int) $state_entry['id'] ) ) {
						$deleted++;
					}
				}
			}
		}

		$legacy_groups = [];
		foreach ( $entries as $entry ) {
			$entity = $entry['entities'][0]['entity'] ?? null;
			if ( ! is_array( $entity ) ) {
				continue;
			}
			$type = (string) ( $entity['entity_type'] ?? '' );
			$key  = sanitize_key( (string) ( $entity['entity_key'] ?? '' ) );
			$group = null;
			if ( 'hd_profile' === $type && preg_match( '/^([0-9]+-[0-9]+)-(fixed|mutable|cardinal)$/', $key, $matches ) ) {
				$group = [ 'type' => 'hd_profile', 'key' => $matches[1], 'scope' => 'modifier', 'scope_key' => $matches[2], 'section' => 'hd_profiles' ];
			} elseif ( in_array( $type, [ 'hd_planet', 'astro_planet', 'hd_angle_point', 'astro_angle_point' ], true ) && preg_match( '/^(personality|design)-(.+)$/', $key, $matches ) ) {
				$target_type = str_contains( $type, 'angle' ) ? 'astro_angle_point' : 'astro_planet';
				$section     = str_contains( $type, 'angle' ) ? 'astro_angles_points' : 'astro_planets';
				$group = [ 'type' => $target_type, 'key' => $matches[2], 'scope' => 'variant', 'scope_key' => $matches[1], 'section' => $section ];
			}
			if ( $group ) {
				$legacy_groups[ $group['type'] . ':' . $group['key'] ][] = [ 'entry' => $entry, 'group' => $group ];
			}
		}

		foreach ( $legacy_groups as $items ) {
			$first = $items[0]['group'];
			$base_entity_id = $this->find_entity_id( 'luna-astrohd', $first['type'], $first['key'] );
			if ( $base_entity_id <= 0 ) {
				$entity = $this->upsert_entity( [
					'module_id'   => 'luna-astrohd',
					'entity_type' => $first['type'],
					'entity_key'  => $first['key'],
					'label'       => ucwords( str_replace( [ '-', '_' ], ' ', $first['key'] ) ),
				] );
				if ( is_wp_error( $entity ) ) {
					continue;
				}
				$base_entity_id = (int) $entity['id'];
			}

			$base_entry = null;
			foreach ( $entries as $entry ) {
				$entity = $entry['entities'][0]['entity'] ?? null;
				if ( is_array( $entity ) && $first['type'] === (string) ( $entity['entity_type'] ?? '' ) && $first['key'] === $this->normalize_astrohd_entity_key( $first['type'], (string) ( $entity['entity_key'] ?? '' ) ) ) {
					$base_entry = $entry;
					break;
				}
			}

			$slots = $base_entry['slots'] ?? [];
			foreach ( $items as $item ) {
				$entry = $item['entry'];
				$group = $item['group'];
				$value = $this->get_slot_value_for_context( $entry['slots'] ?? [], 'sidebar_short', [ 'chart_snippet', 'report_snippet', 'pdf_long' ] );
				foreach ( explode( ',', $group['scope_key'] ) as $scope_key ) {
					$slots[] = [
						'slot_key'       => 'sidebar_short',
						'slot_value'     => $value,
						'slot_format'    => 'markdown',
						'output_context' => '',
						'sort_order'     => count( $slots ),
						'metadata_json'  => [
							'scope' => $group['scope'],
							$group['scope'] => $scope_key,
						],
					];
				}
			}

			$result = $this->upsert_entry( [
				'id'                => (int) ( $base_entry['id'] ?? 0 ),
				'set_id'            => $set_id,
				'module_id'         => 'luna-astrohd',
				'entry_key'         => sanitize_key( $first['section'] . '-' . $first['key'] ),
				'title'             => sanitize_text_field( (string) ( $base_entry['title'] ?? ucwords( str_replace( [ '-', '_' ], ' ', $first['key'] ) ) ) ),
				'entry_kind'        => 'atomic',
				'specificity_score' => 10,
				'metadata_json'     => [
					'section_type' => $first['section'],
					'item_key'     => $first['key'],
					'cleaned'      => true,
				],
				'entities'          => [
					[ 'entity_id' => $base_entity_id, 'role_key' => 'primary', 'match_operator' => 'all_of' ],
				],
				'slots'             => $slots,
			] );
			if ( is_wp_error( $result ) ) {
				continue;
			}
			$collapsed++;
			foreach ( $items as $item ) {
				if ( empty( $base_entry['id'] ) || (int) $item['entry']['id'] !== (int) $base_entry['id'] ) {
					if ( $this->delete_entry( (int) $item['entry']['id'] ) ) {
						$deleted++;
					}
				}
			}
		}

		$latest_entries = $this->list_entries( [ 'set_id' => $set_id, 'module_id' => 'luna-astrohd' ] );
		$duplicate_groups = [];
		foreach ( $latest_entries as $entry ) {
			$entity = $entry['entities'][0]['entity'] ?? null;
			if ( ! is_array( $entity ) ) {
				continue;
			}
			$type = (string) ( $entity['entity_type'] ?? '' );
			$key  = $this->normalize_astrohd_entity_key( $type, (string) ( $entity['entity_key'] ?? '' ) );
			$duplicate_groups[ $type . ':' . $key ][] = $entry;
		}

		foreach ( $duplicate_groups as $group_entries ) {
			if ( count( $group_entries ) < 2 ) {
				continue;
			}
			usort( $group_entries, static fn( array $a, array $b ): int => (int) $a['id'] <=> (int) $b['id'] );
			$keeper = array_shift( $group_entries );
			$slots  = $keeper['slots'] ?? [];
			foreach ( $group_entries as $duplicate ) {
				$slots = array_merge( $slots, $duplicate['slots'] ?? [] );
			}
			$this->upsert_entry( [
				'id'                => (int) $keeper['id'],
				'set_id'            => $set_id,
				'module_id'         => 'luna-astrohd',
				'entry_key'         => (string) $keeper['entry_key'],
				'title'             => (string) $keeper['title'],
				'entry_kind'        => (string) $keeper['entry_kind'],
				'specificity_score' => (int) $keeper['specificity_score'],
				'sort_order'        => (int) $keeper['sort_order'],
				'metadata_json'     => $keeper['metadata_json'] ?? [],
				'entities'          => array_map( static fn( array $entity_ref ): array => [
					'entity_id'      => (int) $entity_ref['entity_id'],
					'role_key'       => (string) $entity_ref['role_key'],
					'match_operator' => (string) $entity_ref['match_operator'],
					'sort_order'     => (int) $entity_ref['sort_order'],
				], (array) ( $keeper['entities'] ?? [] ) ),
				'slots'             => $slots,
			] );
			foreach ( $group_entries as $duplicate ) {
				if ( $this->delete_entry( (int) $duplicate['id'] ) ) {
					$deleted++;
				}
			}
		}

		return [
			'set_id'            => $set_id,
			'collapsed_centers' => $collapsed,
			'deleted_entries'   => $deleted,
		];
	}

	private function seed_slots_from_scaffold_row( array $row, string $entity_type = '' ): array {
		$slots = [];
		$order = 0;

		$blueprints = $this->get_astrohd_blueprints();
		$blueprint  = $blueprints[ $entity_type ] ?? null;
		$standalone = $blueprint ? (array) $blueprint['standalone_layers'] : $this->get_mvp_slot_layers();
		$fragments  = $blueprint ? (array) $blueprint['fragment_layers'] : [ 'theme_short', 'theme_long', 'keywords' ];

		// Base atom: section-correct standalone AND fragment layers as empty placeholders,
		// so the worksheet opens with exactly the fields (incl. template fragments like
		// theme_short / theme_long) that apply to this section.
		foreach ( array_merge( $standalone, $fragments ) as $layer ) {
			$slots[] = [
				'slot_key'       => $layer,
				'slot_value'     => '',
				'slot_format'    => 'markdown',
				'output_context' => '',
				'sort_order'     => $order++,
				'metadata_json'  => [ 'scope' => 'base' ],
			];
		}

		// Side (personality / design) overlay placeholders — only for sections that carry
		// it (driven by the scaffold's variant groups, which match has_side sections).
		foreach ( (array) ( $row['variants'] ?? [] ) as $variant_key => $variant_row ) {
			$overlay = sanitize_key( (string) $variant_key );
			foreach ( [ 'short_def', 'long_def' ] as $layer ) {
				$slots[] = [
					'slot_key'       => $layer,
					'slot_value'     => '',
					'slot_format'    => 'markdown',
					'output_context' => '',
					'sort_order'     => $order++,
					'metadata_json'  => [
						'scope'       => 'variant',
						'variant'     => $overlay,
						'overlay_key' => $overlay,
						'label'       => (string) ( $variant_row['title'] ?? ucfirst( (string) $variant_key ) ),
					],
				];
			}
		}

		// Modifiers (line, dignity, defined/open, motion, color/arrow, etc.) get a
		// modifier_short placeholder each; deeper layers added on demand.
		foreach ( (array) ( $row['modifiers'] ?? [] ) as $modifier_key => $modifier_row ) {
			$slots[] = [
				'slot_key'       => 'modifier_short',
				'slot_value'     => '',
				'slot_format'    => 'markdown',
				'output_context' => '',
				'sort_order'     => $order++,
				'metadata_json'  => [
					'scope'    => 'modifier',
					'modifier' => sanitize_key( (string) $modifier_key ),
					'label'    => (string) ( $modifier_row['title'] ?? '' ),
				],
			];
		}

		return $slots;
	}

	private function seed_astrohd_v2_baseline_entities(): void {
		$entities = [
			'hd_consciousness' => [
				'personality' => 'Personality / Conscious',
				'design'      => 'Design / Unconscious',
			],
			'hd_center_state' => [
				'defined'   => 'Defined',
				'undefined' => 'Undefined',
				'open'      => 'Open',
			],
			'hd_variable_direction' => [
				'left'  => 'Left',
				'right' => 'Right',
			],
			'hd_quarter' => [
				'initiation'   => 'Quarter of Initiation',
				'civilization' => 'Quarter of Civilization',
				'duality'      => 'Quarter of Duality',
				'mutation'     => 'Quarter of Mutation',
			],
			'hd_center' => [
				'head'       => 'Head Center',
				'ajna'       => 'Ajna Center',
				'throat'     => 'Throat Center',
				'g_center'   => 'G Center',
				'heart'      => 'Heart / Ego Center',
				'spleen'     => 'Spleen Center',
				'solar_plexus' => 'Solar Plexus Center',
				'sacral'     => 'Sacral Center',
				'root'       => 'Root Center',
			],
			'astro_chart_context' => [
				'astrology_only' => 'Astrology Only',
				'hd_only'        => 'Human Design Only',
				'combined'       => 'Combined AstroHD',
				'natal'          => 'Natal',
				'transit'        => 'Transit',
				'connection'     => 'Connection',
				'return_chart'   => 'Return Chart',
			],
			'astro_dignity' => [
				'domicile'    => 'Domicile',
				'exaltation'  => 'Exaltation',
				'detriment'   => 'Detriment',
				'fall'        => 'Fall',
				'peregrine'   => 'Peregrine',
			],
			'astro_planetary_condition' => [
				'direct'     => 'Direct',
				'retrograde' => 'Retrograde',
			],
			'angel_overlay' => [
				'astrology_big_3' => 'Angels for Sun, Moon, and Rising',
				'hd_cross'        => 'Angels for Incarnation Cross',
			],
		];

		for ( $angel = 1; $angel <= 72; $angel++ ) {
			$key = 'shem_' . str_pad( (string) $angel, 2, '0', STR_PAD_LEFT );
			$entities['angel_shem'][ $key ] = 'Shem Angel ' . $angel;
			$entities['angel_degree_range'][ $key . '_degrees' ] = 'Shem Angel ' . $angel . ' Degree Range';
		}

		for ( $line = 1; $line <= 6; $line++ ) {
			$entities['hd_line'][ (string) $line ] = 'Line ' . $line;
		}

		// Variable colors (48 combos) and tones (two per-side sets) are now seeded as
		// authorable atoms from the scaffold (hd_variable_colors / hd_variable_tones),
		// so no entity-only baselines are created here.

		foreach ( $entities as $entity_type => $rows ) {
			foreach ( $rows as $entity_key => $label ) {
				$this->upsert_entity( [
					'module_id'     => 'luna-astrohd',
					'entity_type'   => $entity_type,
					'entity_key'    => $entity_key,
					'label'         => $label,
					'metadata_json' => [
						'seeded' => true,
						'model'  => 'astrohd_v2_baseline',
					],
				] );
			}
		}
	}

	/**
	 * Re-seed ONLY the chart templates + presets for a set (purging legacy ones),
	 * leaving all authored definitions untouched. Lets the admin pull in updated
	 * templates without a full reseed / hard reset.
	 */
	public function refresh_chart_templates( int $set_id ): array|WP_Error {
		$set = $this->get_set( $set_id );
		if ( ! $set ) {
			return new WP_Error( 'set_missing', 'Set not found.' );
		}
		$this->seed_astrohd_v2_templates_and_profiles( $set_id );
		return [ 'success' => true, 'set_id' => $set_id, 'templates' => $this->list_templates( [ 'set_id' => $set_id ] ) ];
	}

	private function seed_astrohd_v2_templates_and_profiles( int $set_id ): void {
		// Purge legacy templates from the old definition model (chunky, labelled,
		// referenced slots we no longer author) so they stop surfacing on charts.
		global $wpdb;
		$legacy_template_keys = [
			'planet_placement', 'pdf_planet_placement', 'aspect_group', 'aspect_combo',
			'moon_phase', 'transit_placement', 'connection_aspect', 'angel_overlay_block',
		];
		foreach ( $legacy_template_keys as $legacy_key ) {
			$wpdb->delete( $wpdb->prefix . 'lunacco_def_templates', [ 'set_id' => $set_id, 'template_key' => $legacy_key ], [ '%d', '%s' ] );
		}

		// First templates — CURRENT blueprint vocab only. Bodies are deliberately
		// prose (a single authored field, no inline "Gift:/Shadow:" labels) so they
		// read as cohesive copy. Gift / shadow / coaching surface as separate display
		// boxes via the chart preset, not jammed into the paragraph. The token renderer
		// drops empty {slot}s, and the chart panel falls back to short_def if a template
		// renders blank.
		$templates = [
			'quick_synth' => [
				'title' => 'Quick Synthesis (chart sidebar)',
				'output_context' => 'full_sidebar',
				'body' => "{short_def}",
			],
			'placement_full' => [
				'title' => 'Placement — full chart',
				'output_context' => 'full_chart',
				'body' => "{long_def}",
			],
			'placement_pdf' => [
				'title' => 'Placement — PDF / report',
				'output_context' => 'full_pdf',
				'body' => "{long_def}",
			],
			'synthesis_summary' => [
				'title' => 'Synthesis Summary',
				'output_context' => 'full_report',
				'body' => "{long_def}",
			],
			// Multi-part woven synthesis — uses role tokens filled from the entities
			// selected together on the chart. Empty roles collapse cleanly (tidy step),
			// so a partly-authored set still reads. Authors edit the connective copy.
			'astro_placement_synth' => [
				'title' => 'Astro Placement Synthesis (planet · sign · house)',
				'output_context' => 'full_sidebar',
				'body' => "Your {planet.label} in {sign.label}, in the {house.label}.\n\n{planet.short_def} Filtered through {sign.label}, {sign.theme_short} Lived out in the {house.label}, {house.theme_short}",
			],
			'hd_placement_synth' => [
				'title' => 'HD Placement Synthesis (planet · gate · line · sign · house)',
				'output_context' => 'full_sidebar',
				'body' => "Your {planet.label} activates {gate.label}, line {line.label} — in {sign.label}, {house.label}.\n\n{gate.short_def} Through line {line.label}, {line.theme_short} Coloured by {planet.label} in {sign.label}, this plays out in the {house.label}: {house.theme_short}",
			],
			// Aspect synthesis — the dispatch tags each side with distinct roles
			// (planet_a/sign_a · aspect · planet_b/sign_b), so this weaves planet A in its
			// sign, the aspect dynamic, then planet B in its sign. Empty slots collapse.
			'astro_aspect_synth' => [
				'title' => 'Astro Aspect Synthesis (planet A · aspect · planet B)',
				'output_context' => 'full_sidebar',
				'body' => "{planet_a.label} in {sign_a.label} {aspect.label} {planet_b.label} in {sign_b.label}.\n\n{planet_a.short_def} In {sign_a.label}, {sign_a.theme_short} {aspect.dynamic_short} {planet_b.short_def} In {sign_b.label}, {sign_b.theme_short} Together, {aspect.dynamic_long}",
			],
			// Advanced aspect synthesis — also brings in each planet's house.
			'astro_aspect_synth_advanced' => [
				'title' => 'Astro Aspect Synthesis — Advanced (+ houses)',
				'output_context' => 'full_sidebar',
				'body' => "{planet_a.label} in {sign_a.label}, {house_a.label} {aspect.label} {planet_b.label} in {sign_b.label}, {house_b.label}.\n\n{planet_a.short_def} In {sign_a.label}, {sign_a.theme_short} Playing out through the {house_a.label}, {house_a.theme_short} {aspect.dynamic_short} {planet_b.short_def} In {sign_b.label}, {sign_b.theme_short} Playing out through the {house_b.label}, {house_b.theme_short} Together, {aspect.dynamic_long}",
			],
			// Stellium synthesis — the dispatch sends the sign (role sign), each clustered
			// planet (planet_a..d), and the shared house. Says what a stellium is, then
			// weaves each planet's meaning in that sign + house.
			'astro_stellium_synth' => [
				'title' => 'Astro Stellium Synthesis (sign · clustered planets)',
				'output_context' => 'full_sidebar',
				'body' => "A stellium gathers several planets in {sign.label}, concentrating and intensifying its themes. {sign.theme_short}\n\n{planet_a.label}: {planet_a.short_def} {planet_b.label}: {planet_b.short_def} {planet_c.label}: {planet_c.short_def} {planet_d.label}: {planet_d.short_def}\n\nGathered in {sign.label} and the {house.label}, {sign.theme_long}",
			],
			// Moon-phase synthesis — weaves the phase, the Moon's sign, and its house.
			'astro_moon_phase_synth' => [
				'title' => 'Astro Moon Phase Synthesis (phase · sign · house)',
				'output_context' => 'full_sidebar',
				'body' => "Born under the {moon_phase.label}, Moon in {sign.label}.\n\n{moon_phase.short_def} Coloured by {sign.label}, {sign.theme_short} Expressed through the {house.label}, {house.theme_short}",
			],
			// Chart-shape synthesis — a single chart-pattern entity (Bowl, Bucket, …).
			'astro_chart_shape_synth' => [
				'title' => 'Astro Chart Shape Synthesis',
				'output_context' => 'full_sidebar',
				'body' => "Your chart forms a {label} pattern.\n\n{short_def} {long_def}",
			],
		];

		foreach ( $templates as $key => $template ) {
			$this->upsert_template( [
				'set_id'         => $set_id,
				'module_id'      => 'luna-astrohd',
				'template_key'   => $key,
				'title'          => $template['title'],
				'output_context' => $template['output_context'],
				'render_mode'    => 'token_template',
				'is_enabled'     => 1,
				'metadata_json'  => [
					'template_body' => $template['body'],
					'model'         => 'astrohd_v2',
				],
			] );
		}

		$profiles = [
			'astrology_basic_sidebar' => [ 'Astrology Basic Sidebar', 'natal', 'full_sidebar', [ 'astrology' ], [ 'base' ], 'default', 'quick_synth' ],
			'astrology_natal_report'  => [ 'Astrology Natal Report', 'natal', 'full_pdf', [ 'astrology' ], [ 'base' ], 'default', 'placement_pdf' ],
			'astrology_angels_report' => [ 'Astrology + Angels Report', 'natal', 'full_pdf', [ 'astrology', 'angels' ], [ 'base', 'angelic' ], 'default', 'placement_pdf' ],
			'astrohd_combined_report' => [ 'AstroHD Combined Report', 'combined', 'full_pdf', [ 'astrology', 'human_design', 'angels', 'synthesis' ], [ 'base', 'angelic' ], 'default', 'synthesis_summary' ],
			'reader_astrology_report' => [ 'Reader Astrology Report', 'natal', 'full_reader', [ 'astrology' ], [ 'base' ], 'professional', 'placement_full' ],
		];

		foreach ( $profiles as $key => $profile ) {
			global $wpdb;
			$table       = $wpdb->prefix . 'lunacco_def_chart_presets';
			$existing_id = (int) $wpdb->get_var(
				$wpdb->prepare( "SELECT id FROM {$table} WHERE set_id = %d AND preset_key = %s", $set_id, $key )
			);

			$seed_config = [
				'enabled_systems' => $profile[3],
				'overlays'        => $profile[4],
				'tone_key'        => $profile[5],
				'chart_context'   => $profile[1],
				'template_key'    => $profile[6],
				'visible_sections'=> [ 'placements', 'synthesis' ],
				'visible_slots'   => [],
				'display_boxes'   => [ 'gift', 'shadow_recessive', 'shadow_reactive', 'coaching_key_notes' ],
				'component_rules' => [
					'placements' => [
						'template_key'        => $profile[6],
						'slots'               => [ 'long_def', 'theme_long' ],
						'full_slot_fallback'  => [ 'short_def' ],
						'boxes'               => [ 'gift', 'shadow_recessive', 'coaching_key_notes' ],
					],
				],
				'public_statuses' => [ 'approved' ],
			];

			if ( $existing_id > 0 ) {
				// Preset already exists — preserve the user's config_json entirely.
				// Only refresh structural identity fields (title, chart_type, output_context).
				$wpdb->update(
					$table,
					[
						'title'          => $profile[0],
						'description'    => 'Core Definition Engine V2 chart profile.',
						'chart_type'     => $profile[1],
						'output_context' => $profile[2],
					],
					[ 'id' => $existing_id ]
				);
			} else {
				$this->upsert_chart_preset( [
					'set_id'         => $set_id,
					'module_id'      => 'luna-astrohd',
					'preset_key'     => $key,
					'title'          => $profile[0],
					'description'    => 'Core Definition Engine V2 chart profile.',
					'chart_type'     => $profile[1],
					'output_context' => $profile[2],
					'is_enabled'     => 1,
					'config_json'    => $seed_config,
				] );
			}
		}
	}

	private function parse_bundle_payload( array $payload ): array|WP_Error {
		if ( ! empty( $payload['bundle'] ) && is_array( $payload['bundle'] ) ) {
			return $payload['bundle'];
		}

		$source = (string) ( $payload['yaml'] ?? $payload['content'] ?? '' );
		if ( '' === trim( $source ) ) {
			return new WP_Error( 'empty_bundle', 'Bundle content is required.' );
		}

		$json = json_decode( $source, true );
		if ( is_array( $json ) ) {
			return $json;
		}

		if ( function_exists( 'yaml_parse' ) ) {
			$yaml = @yaml_parse( $source );
			if ( is_array( $yaml ) ) {
				return $yaml;
			}
		}

		$parsed = $this->parse_simple_yaml( $source );
		if ( is_wp_error( $parsed ) ) {
			return $parsed;
		}
		if ( ! is_array( $parsed ) ) {
			return new WP_Error( 'invalid_bundle', 'Bundle content could not be parsed.' );
		}
		return $parsed;
	}

	private function bundle_slots_from_entry( array $entry ): array {
		$slots = [];
		$order = 0;

		foreach ( (array) ( $entry['slots'] ?? [] ) as $slot_key => $slot_value ) {
			if ( is_array( $slot_value ) ) {
				continue;
			}
			$slots[] = [
				'slot_key'       => sanitize_key( (string) $slot_key ),
				'slot_value'     => (string) $slot_value,
				'slot_format'    => 'markdown',
				'output_context' => '',
				'sort_order'     => $order++,
				'metadata_json'  => [ 'scope' => 'base' ],
			];
		}

		$accepted_tags = array_values( array_unique( array_filter( array_map( 'sanitize_key', array_merge(
			(array) ( $entry['tags'] ?? [] ),
			(array) ( $entry['auto_tagging']['accepted_tags'] ?? [] )
		) ) ) ) );
		if ( $accepted_tags ) {
			$slots[] = [
				'slot_key'       => 'accepted_tags',
				'slot_value'     => implode( ', ', $accepted_tags ),
				'slot_format'    => 'text',
				'output_context' => '',
				'sort_order'     => $order++,
				'metadata_json'  => [ 'scope' => 'base', 'system' => true ],
			];
		}

		foreach ( (array) ( $entry['modifiers'] ?? [] ) as $modifier_key => $modifier ) {
			foreach ( (array) ( $modifier['slots'] ?? [] ) as $slot_key => $slot_value ) {
				if ( is_array( $slot_value ) ) {
					continue;
				}
				$slots[] = [
					'slot_key'       => sanitize_key( (string) $slot_key ),
					'slot_value'     => (string) $slot_value,
					'slot_format'    => 'markdown',
					'output_context' => '',
					'sort_order'     => $order++,
					'metadata_json'  => [
						'scope'    => 'modifier',
						'modifier' => sanitize_key( (string) $modifier_key ),
					],
				];
			}
		}

		return $slots;
	}

	private function is_auto_creatable_definition_entity_type( string $type ): bool {
		return in_array( sanitize_key( $type ), [
			'astro_body_in_sign',
			'astro_body_in_house',
			'astro_body_in_sign_house',
			'astro_aspect_combo',
			'astro_moon_phase_combo',
			'astro_pattern',
			'angel_degree_range',
		], true );
	}

	private function parse_simple_yaml( string $source ): array|WP_Error {
		$source = str_replace( [ "\r\n", "\r" ], "\n", $source );
		$lines  = explode( "\n", $source );
		$index  = 0;
		$result = $this->parse_yaml_block( $lines, $index, 0 );
		return is_array( $result ) ? $result : new WP_Error( 'invalid_yaml', 'YAML bundle could not be parsed.' );
	}

	private function parse_yaml_block( array $lines, int &$index, int $indent ) {
		$is_list = null;
		$result  = [];

		while ( $index < count( $lines ) ) {
			$line = rtrim( (string) $lines[ $index ] );
			if ( '' === trim( $line ) || $this->string_starts_with( ltrim( $line ), '#' ) ) {
				$index++;
				continue;
			}

			$current_indent = strlen( $line ) - strlen( ltrim( $line, ' ' ) );
			if ( $current_indent < $indent ) {
				break;
			}
			if ( $current_indent > $indent ) {
				break;
			}

			$trimmed = trim( $line );
			if ( null === $is_list ) {
				$is_list = $this->string_starts_with( $trimmed, '- ' );
				$result  = $is_list ? [] : [];
			}

			if ( $is_list ) {
				if ( ! $this->string_starts_with( $trimmed, '- ' ) ) {
					break;
				}
				$item_text = trim( substr( $trimmed, 2 ) );
				$index++;
				$item = [];
				if ( '' !== $item_text ) {
					$kv = $this->parse_yaml_key_value( $item_text );
					if ( $kv ) {
						[ $key, $value ] = $kv;
						$item[ $key ] = $this->parse_yaml_scalar_or_block( $value, $lines, $index, $indent + 2 );
					} else {
						$item = $this->parse_yaml_scalar( $item_text );
					}
				}
				if ( is_array( $item ) ) {
					$children = $this->parse_yaml_block( $lines, $index, $indent + 2 );
					if ( is_array( $children ) ) {
						$item = array_merge( $item, $children );
					}
				}
				$result[] = $item;
				continue;
			}

			$kv = $this->parse_yaml_key_value( $trimmed );
			if ( ! $kv ) {
				$index++;
				continue;
			}
			[ $key, $value ] = $kv;
			$index++;
			$result[ $key ] = $this->parse_yaml_scalar_or_block( $value, $lines, $index, $indent + 2 );
		}

		return $result;
	}

	private function parse_yaml_key_value( string $line ): ?array {
		if ( ! preg_match( '/^([A-Za-z0-9_.\/-]+)\s*:\s*(.*)$/', $line, $matches ) ) {
			return null;
		}
		return [ (string) $matches[1], (string) $matches[2] ];
	}

	private function parse_yaml_scalar_or_block( string $value, array $lines, int &$index, int $child_indent ) {
		$value = trim( $value );
		if ( '|' === $value || '>' === $value ) {
			$parts = [];
			while ( $index < count( $lines ) ) {
				$line = rtrim( (string) $lines[ $index ] );
				if ( '' === trim( $line ) ) {
					$parts[] = '';
					$index++;
					continue;
				}
				$current_indent = strlen( $line ) - strlen( ltrim( $line, ' ' ) );
				if ( $current_indent < $child_indent ) {
					break;
				}
				$parts[] = substr( $line, min( $child_indent, strlen( $line ) ) );
				$index++;
			}
			return '>' === $value ? trim( preg_replace( '/\s+/', ' ', implode( ' ', $parts ) ) ) : rtrim( implode( "\n", $parts ) );
		}
		if ( '' === $value ) {
			return $this->parse_yaml_block( $lines, $index, $child_indent );
		}
		return $this->parse_yaml_scalar( $value );
	}

	private function parse_yaml_scalar( string $value ) {
		$value = trim( $value );
		if ( ( $this->string_starts_with( $value, '"' ) && $this->string_ends_with( $value, '"' ) ) || ( $this->string_starts_with( $value, "'" ) && $this->string_ends_with( $value, "'" ) ) ) {
			return substr( $value, 1, -1 );
		}
		if ( in_array( strtolower( $value ), [ 'true', 'false' ], true ) ) {
			return 'true' === strtolower( $value );
		}
		if ( is_numeric( $value ) ) {
			return false !== strpos( $value, '.' ) ? (float) $value : (int) $value;
		}
		return $value;
	}

	private function string_starts_with( string $haystack, string $needle ): bool {
		return '' === $needle || 0 === strpos( $haystack, $needle );
	}

	private function string_ends_with( string $haystack, string $needle ): bool {
		if ( '' === $needle ) {
			return true;
		}
		return substr( $haystack, -strlen( $needle ) ) === $needle;
	}

	private function hydrate_entry_row( array $row ): array {
		$row['metadata_json'] = $this->decode_json( $row['metadata_json'] ?? '' );
		$row['entities']      = $this->get_entry_entities( (int) $row['id'] );
		$row['slots']         = $this->get_entry_slots( (int) $row['id'] );
		$row['variants']      = $this->list_entry_variants( [ 'entry_id' => (int) $row['id'] ] );
		$row['tags']          = $this->get_entry_tags( (int) $row['id'] );
		return $row;
	}

	private function hydrate_entry_variant_row( array $row ): array {
		$row['id']                 = (int) $row['id'];
		$row['entry_id']           = (int) $row['entry_id'];
		$row['slots_json']         = $this->decode_json( (string) ( $row['slots_json'] ?? '' ) );
		$row['slots']              = $row['slots_json'];
		$row['theme_weights_json'] = $this->decode_json( (string) ( $row['theme_weights_json'] ?? '' ) );
		$row['theme_weights']      = $row['theme_weights_json'];
		$row['metadata_json']      = $this->decode_json( (string) ( $row['metadata_json'] ?? '' ) );
		return $row;
	}

	private function hydrate_tag_row( array $row ): array {
		global $wpdb;
		$row['id']            = (int) $row['id'];
		$row['metadata_json'] = $this->decode_json( (string) ( $row['metadata_json'] ?? '' ) );
		$row['synonyms']      = $wpdb->get_results(
			$wpdb->prepare( "SELECT id, synonym, weight FROM {$wpdb->prefix}lunacco_def_tag_synonyms WHERE tag_id = %d ORDER BY weight DESC, synonym ASC", (int) $row['id'] ),
			ARRAY_A
		) ?: [];
		return $row;
	}

	private function replace_tag_synonyms( int $tag_id, array $synonyms ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'lunacco_def_tag_synonyms';
		$wpdb->delete( $table, [ 'tag_id' => $tag_id ], [ '%d' ] );
		foreach ( $synonyms as $synonym ) {
			$value = is_array( $synonym ) ? (string) ( $synonym['synonym'] ?? '' ) : (string) $synonym;
			$value = sanitize_text_field( $value );
			if ( '' === $value ) {
				continue;
			}
			$wpdb->insert( $table, [
				'tag_id'  => $tag_id,
				'synonym' => $value,
				'weight'  => is_array( $synonym ) ? (int) ( $synonym['weight'] ?? 1 ) : 1,
			] );
		}
	}

	private function get_entry_tags( int $entry_id ): array {
		global $wpdb;
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT et.*, t.tag_key, t.label, t.tag_group FROM {$wpdb->prefix}lunacco_def_entry_tags et INNER JOIN {$wpdb->prefix}lunacco_def_tags t ON t.id = et.tag_id WHERE et.entry_id = %d ORDER BY et.weight DESC, t.label ASC",
				$entry_id
			),
			ARRAY_A
		) ?: [];
		foreach ( $rows as &$row ) {
			$row['metadata_json'] = $this->decode_json( (string) ( $row['metadata_json'] ?? '' ) );
		}
		unset( $row );
		return $rows;
	}

	private function hydrate_chart_preset_row( array $row ): array {
		$row['config_json'] = $this->decode_json( (string) ( $row['config_json'] ?? '' ) );
		$row['config']      = $row['config_json'];
		return $row;
	}

	private function get_entry_entities( int $entry_id ): array {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_entry_entities';
		$rows  = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE entry_id = %d ORDER BY sort_order ASC, id ASC", $entry_id ),
			ARRAY_A
		) ?: [];

		foreach ( $rows as &$row ) {
			$row['entity_id']      = (int) $row['entity_id'];
			$row['metadata_json']  = $this->decode_json( $row['metadata_json'] ?? '' );
			$row['entity']         = $this->get_entity( (int) $row['entity_id'] );
		}
		unset( $row );

		return $rows;
	}

	private function get_entry_slots( int $entry_id ): array {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_entry_slots';
		$rows  = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE entry_id = %d ORDER BY sort_order ASC, id ASC", $entry_id ),
			ARRAY_A
		) ?: [];

		foreach ( $rows as &$row ) {
			$row['metadata_json'] = $this->decode_json( $row['metadata_json'] ?? '' );
		}
		unset( $row );

		return $rows;
	}

	/**
	 * Build a map of entity_id => requested role_key from active_entities that carry an
	 * explicit role_key (e.g. planet_a / planet_b / sign_a). Lets a synth template weave
	 * two same-type pieces distinctly (e.g. both planets of an aspect) instead of
	 * collapsing them to one entity_type-derived role. Entities without a role_key are
	 * omitted (they fall back to the entity_type-derived role as before).
	 */
	private function resolve_active_entity_roles( array $active_entities ): array {
		$roles = [];
		foreach ( $active_entities as $entity ) {
			if ( ! is_array( $entity ) ) {
				continue;
			}
			$role_key = sanitize_key( (string) ( $entity['role_key'] ?? '' ) );
			if ( '' === $role_key || 'primary' === $role_key ) {
				continue;
			}
			$id = (int) ( $entity['entity_id'] ?? 0 );
			if ( $id <= 0 && ! empty( $entity['module_id'] ) && ! empty( $entity['entity_type'] ) && ! empty( $entity['entity_key'] ) ) {
				$id = $this->find_entity_id_flexible( (string) $entity['module_id'], (string) $entity['entity_type'], (string) $entity['entity_key'] );
			}
			if ( $id > 0 ) {
				if ( ! isset( $roles[ $id ] ) ) {
					$roles[ $id ] = [];
				}
				if ( ! in_array( $role_key, $roles[ $id ], true ) ) {
					$roles[ $id ][] = $role_key;
				}
			}
		}
		return $roles;
	}

	private function resolve_active_entity_ids( array $active_entities ): array {
		$ids = [];
		foreach ( $active_entities as $entity ) {
			if ( is_numeric( $entity ) ) {
				$ids[] = (int) $entity;
				continue;
			}
			if ( is_array( $entity ) && ! empty( $entity['entity_id'] ) ) {
				$ids[] = (int) $entity['entity_id'];
				continue;
			}
			if ( is_array( $entity ) && ! empty( $entity['module_id'] ) && ! empty( $entity['entity_type'] ) && ! empty( $entity['entity_key'] ) ) {
				$resolved = $this->find_entity_id_flexible( (string) $entity['module_id'], (string) $entity['entity_type'], (string) $entity['entity_key'] );
				if ( $resolved > 0 ) {
					$ids[] = $resolved;
				}
				continue;
			}
			if ( is_string( $entity ) ) {
				$parts = explode( ':', $entity );
				if ( 3 === count( $parts ) ) {
					$resolved = $this->find_entity_id_flexible( $parts[0], $parts[1], $parts[2] );
					if ( $resolved > 0 ) {
						$ids[] = $resolved;
					}
				}
			}
		}
		return array_values( array_unique( array_filter( array_map( 'intval', $ids ) ) ) );
	}

	/**
	 * Resolve an entity id tolerantly so chart selections match how atoms are
	 * actually seeded:
	 *  - exact match first;
	 *  - strip a personality-/design- side prefix (side is an OVERLAY, not part of
	 *    the entity key, so hd_planet:personality-sun → hd_planet:sun);
	 *  - try the sibling type (astro_planet ⇄ hd_planet, astro_angle_point ⇄
	 *    hd_angle_point) since a set seeds only one side of that pair.
	 */
	private function find_entity_id_flexible( string $module_id, string $entity_type, string $entity_key ): int {
		$module_id   = sanitize_key( $module_id );
		$entity_type = sanitize_key( $entity_type );
		$entity_key  = sanitize_key( str_replace( '/', '-', $entity_key ) );

		$keys = [ $entity_key ];
		$stripped = preg_replace( '/^(personality|design)-/', '', $entity_key );
		if ( $stripped !== $entity_key ) {
			$keys[] = $stripped;
		}
		// Sabian symbols are seeded by bare degree number (1..30) but the SPA requests
		// them as `degree-{n}` (sabian.ts → toSabianEntityRef). Accept both forms.
		if ( preg_match( '/^sabian_/', $entity_type ) && preg_match( '/^degree-([0-9]+)$/', $entity_key, $m ) ) {
			$keys[] = $m[1];
		}

		$siblings = [
			'astro_planet'      => 'hd_planet',
			'hd_planet'         => 'astro_planet',
			'astro_angle_point' => 'hd_angle_point',
			'hd_angle_point'    => 'astro_angle_point',
		];
		$types = [ $entity_type ];
		if ( isset( $siblings[ $entity_type ] ) ) {
			$types[] = $siblings[ $entity_type ];
		}

		foreach ( $types as $type ) {
			foreach ( $keys as $key ) {
				$id = $this->find_entity_id( $module_id, $type, $key );
				if ( $id > 0 ) {
					return $id;
				}
			}
		}

		// Angles dispatched as "planets" (e.g. HD bodygraph rows send
		// hd_planet:personality-ascendant) — map the angle name to its angle-point
		// key and try the angle_point entity types.
		$angle_aliases = [
			'ascendant' => 'asc', 'asc' => 'asc',
			'descendant' => 'dc', 'desc' => 'dc', 'dsc' => 'dc', 'dc' => 'dc',
			'midheaven' => 'mc', 'mc' => 'mc',
			'imum-coeli' => 'ic', 'imum_coeli' => 'ic', 'ic' => 'ic',
			'vertex' => 'vertex',
		];
		foreach ( $keys as $key ) {
			if ( isset( $angle_aliases[ $key ] ) ) {
				foreach ( [ 'astro_angle_point', 'hd_angle_point' ] as $type ) {
					$id = $this->find_entity_id( $module_id, $type, $angle_aliases[ $key ] );
					if ( $id > 0 ) {
						return $id;
					}
				}
			}
		}
		return 0;
	}

	private function find_best_template( int $set_id, string $module_id, string $output_context, string $template_key = '' ): ?array {
		if ( '' !== $template_key ) {
			$templates = $this->list_templates( [
				'set_id'       => $set_id,
				'module_id'    => $module_id,
				'template_key' => $template_key,
			] );
			if ( ! empty( $templates ) ) {
				return $templates[0];
			}
		}

		$templates = $this->list_templates( [
			'set_id'         => $set_id,
			'module_id'      => $module_id,
			'output_context' => $output_context,
		] );

		if ( ! empty( $templates ) ) {
			return $templates[0];
		}

		$templates = $this->list_templates( [
			'set_id'         => $set_id,
			'module_id'      => $module_id,
		] );

		return $templates[0] ?? null;
	}

	private function resolve_chart_preset_for_payload( array $payload ): ?array {
		$preset_id  = (int) ( $payload['chart_preset_id'] ?? 0 );
		$preset_key = sanitize_key( (string) ( $payload['chart_preset_key'] ?? '' ) );
		$set_id     = (int) ( $payload['set_id'] ?? 0 );
		$module_id  = sanitize_key( (string) ( $payload['module_id'] ?? '' ) );

		if ( $preset_id > 0 ) {
			return $this->get_chart_preset( $preset_id );
		}

		if ( '' === $preset_key || $set_id <= 0 ) {
			return null;
		}

		$filters = [
			'set_id'     => $set_id,
			'preset_key' => $preset_key,
		];
		if ( '' !== $module_id ) {
			$filters['module_id'] = $module_id;
		}
		$presets = $this->list_chart_presets( $filters );
		return $presets[0] ?? null;
	}

	private function apply_chart_preset_to_payload( array $payload, array $chart_preset ): array {
		$config = is_array( $chart_preset['config'] ?? null ) ? $chart_preset['config'] : [];
		foreach ( [ 'overlay_key', 'tone_key', 'audience_key', 'chart_context' ] as $key ) {
			if ( empty( $payload[ $key ] ) && ! empty( $config[ $key ] ) ) {
				$payload[ $key ] = $config[ $key ];
			}
		}
		foreach ( [ 'overlays', 'overlay_keys', 'tones', 'statuses', 'variants', 'modifiers' ] as $key ) {
			if ( empty( $payload[ $key ] ) && ! empty( $config[ $key ] ) ) {
				$payload[ $key ] = $config[ $key ];
			}
		}
		if ( empty( $payload['output_context'] ) && ! empty( $chart_preset['output_context'] ) ) {
			$payload['output_context'] = $chart_preset['output_context'];
		}
		return $payload;
	}

	private function apply_best_variant_to_entry( array $entry, string $output_context, array $render_context ): array {
		$variant = $this->select_best_entry_variant( (array) ( $entry['variants'] ?? [] ), $output_context, $render_context );
		if ( ! $variant ) {
			return $entry;
		}

		$variant_slots = [];
		foreach ( (array) ( $variant['slots'] ?? [] ) as $slot_key => $slot_value ) {
			if ( is_array( $slot_value ) ) {
				continue;
			}
			$variant_slots[] = [
				'id'             => 'variant-' . (int) $variant['id'] . '-' . sanitize_key( (string) $slot_key ),
				'entry_id'       => (int) ( $entry['id'] ?? 0 ),
				'slot_key'       => sanitize_key( (string) $slot_key ),
				'slot_value'     => (string) $slot_value,
				'slot_format'    => 'markdown',
				'output_context' => sanitize_key( (string) ( $variant['output_context'] ?? '' ) ),
				'is_required'    => 0,
				'sort_order'     => -100,
				'metadata_json'  => [
					'scope'         => 'variant',
					'variant'       => sanitize_key( (string) ( $variant['chart_context'] ?: $variant['variant_key'] ) ),
					'overlay_key'   => sanitize_key( (string) ( $variant['overlay_key'] ?? 'base' ) ),
					'tone_key'      => sanitize_key( (string) ( $variant['tone_key'] ?? 'default' ) ),
					'status'        => sanitize_key( (string) ( $variant['status'] ?? 'draft' ) ),
				],
			];
		}

		if ( $variant_slots ) {
			$entry['slots'] = array_merge( $variant_slots, (array) ( $entry['slots'] ?? [] ) );
		}
		$entry['matched_variant'] = $variant;
		return $entry;
	}

	private function select_best_entry_variant( array $variants, string $output_context, array $render_context ): ?array {
		$candidates = [];
		$statuses   = (array) ( $render_context['statuses'] ?? [ 'approved' ] );
		$overlays   = (array) ( $render_context['overlays'] ?? [ 'base' ] );
		$tones      = (array) ( $render_context['tones'] ?? [ 'default' ] );
		$chart_ctx  = sanitize_key( (string) ( $render_context['chart_context'] ?? '' ) );
		$audience   = sanitize_key( (string) ( $render_context['audience_key'] ?? '' ) );

		foreach ( $variants as $variant ) {
			if ( ! in_array( sanitize_key( (string) ( $variant['status'] ?? '' ) ), $statuses, true ) ) {
				continue;
			}
			$v_output = sanitize_key( (string) ( $variant['output_context'] ?? '' ) );
			if ( '' !== $output_context && '' !== $v_output && $v_output !== $output_context ) {
				continue;
			}
			$v_overlay = sanitize_key( (string) ( $variant['overlay_key'] ?? 'base' ) );
			if ( ! in_array( $v_overlay, $overlays, true ) && 'base' !== $v_overlay ) {
				continue;
			}
			$v_tone = sanitize_key( (string) ( $variant['tone_key'] ?? 'default' ) );
			if ( ! in_array( $v_tone, $tones, true ) && 'default' !== $v_tone ) {
				continue;
			}
			$v_chart = sanitize_key( (string) ( $variant['chart_context'] ?? '' ) );
			if ( '' !== $chart_ctx && '' !== $v_chart && $v_chart !== $chart_ctx ) {
				continue;
			}
			$v_audience = sanitize_key( (string) ( $variant['audience_key'] ?? '' ) );
			if ( '' !== $audience && '' !== $v_audience && $v_audience !== $audience ) {
				continue;
			}
			$score = 0;
			$score += ( $v_output === $output_context ) ? 16 : 0;
			$score += ( '' !== $chart_ctx && $v_chart === $chart_ctx ) ? 8 : 0;
			$score += in_array( $v_overlay, $overlays, true ) ? 4 : 0;
			$score += in_array( $v_tone, $tones, true ) ? 2 : 0;
			$score += ( 'approved' === sanitize_key( (string) $variant['status'] ) ) ? 1 : 0;
			$candidates[] = [ 'score' => $score, 'variant' => $variant ];
		}

		if ( empty( $candidates ) ) {
			return null;
		}
		usort( $candidates, static fn( array $a, array $b ): int => $b['score'] <=> $a['score'] );
		return $candidates[0]['variant'];
	}

	private function decorate_result_with_chart_preset( array $result, ?array $chart_preset, string $output_context, array $render_context ): array {
		if ( ! $chart_preset ) {
			return $result;
		}

		$config        = is_array( $chart_preset['config'] ?? null ) ? $chart_preset['config'] : [];
		$visible_slots = array_values( array_filter( array_map( 'sanitize_key', (array) ( $config['visible_slots'] ?? [] ) ) ) );
		$display_boxes = array_values( array_filter( array_map( 'sanitize_key', (array) ( $config['display_boxes'] ?? [] ) ) ) );

		$result['chart_preset'] = [
			'id'             => (int) ( $chart_preset['id'] ?? 0 ),
			'preset_key'     => (string) ( $chart_preset['preset_key'] ?? '' ),
			'title'          => (string) ( $chart_preset['title'] ?? '' ),
			'chart_type'     => (string) ( $chart_preset['chart_type'] ?? '' ),
			'output_context' => (string) ( $chart_preset['output_context'] ?? '' ),
			'config'         => $config,
		];
		$result['visible_slots'] = $this->collect_preset_slots( (array) ( $result['matched_entries'] ?? [] ), $visible_slots, $output_context, $render_context );
		$result['display_boxes'] = $this->collect_preset_slots( (array) ( $result['matched_entries'] ?? [] ), $display_boxes, $output_context, $render_context );

		return $result;
	}

	private function collect_preset_slots( array $entries, array $slot_keys, string $output_context, array $render_context ): array {
		$items = [];
		foreach ( $slot_keys as $slot_key ) {
			foreach ( $entries as $entry ) {
				$entry = $this->apply_best_variant_to_entry( $entry, $output_context, $render_context );
				$value = $this->get_scoped_slot_value( (array) ( $entry['slots'] ?? [] ), $slot_key, $output_context, $render_context );
				if ( '' === trim( $value ) ) {
					continue;
				}
				$items[] = [
					'slot_key'  => $slot_key,
					'title'     => (string) ( $entry['title'] ?? '' ),
					'entry_key' => (string) ( $entry['entry_key'] ?? '' ),
					'value'     => $value,
				];
				break;
			}
		}
		return $items;
	}

	private function normalize_render_context( array $payload ): array {
		$variants  = [];
		$modifiers = [];
		$overlays  = [];
		$tones     = [];
		$statuses  = [];

		foreach ( (array) ( $payload['variants'] ?? [] ) as $variant ) {
			$variant = sanitize_key( (string) $variant );
			if ( '' !== $variant ) {
				$variants[] = $variant;
			}
		}

		foreach ( [ 'chart_context', 'consciousness' ] as $field ) {
			if ( ! empty( $payload[ $field ] ) ) {
				$variants[] = sanitize_key( (string) $payload[ $field ] );
			}
		}
		foreach ( (array) ( $payload['overlays'] ?? $payload['overlay_keys'] ?? [] ) as $overlay ) {
			$overlay = sanitize_key( (string) $overlay );
			if ( '' !== $overlay ) {
				$overlays[] = $overlay;
			}
		}
		if ( ! empty( $payload['overlay_key'] ) ) {
			$overlays[] = sanitize_key( (string) $payload['overlay_key'] );
		}
		foreach ( (array) ( $payload['tones'] ?? [] ) as $tone ) {
			$tone = sanitize_key( (string) $tone );
			if ( '' !== $tone ) {
				$tones[] = $tone;
			}
		}
		if ( ! empty( $payload['tone_key'] ) ) {
			$tones[] = sanitize_key( (string) $payload['tone_key'] );
		}
		if ( empty( $overlays ) ) {
			$overlays[] = 'base';
		}
		if ( empty( $tones ) ) {
			$tones[] = 'default';
		}
		foreach ( (array) ( $payload['statuses'] ?? [] ) as $status ) {
			$status = sanitize_key( (string) $status );
			if ( '' !== $status ) {
				$statuses[] = $status;
			}
		}
		if ( ! empty( $payload['status'] ) ) {
			$statuses[] = sanitize_key( (string) $payload['status'] );
		}
		if ( empty( $statuses ) ) {
			$statuses = ! empty( $payload['include_unapproved'] ) && current_user_can( 'manage_options' )
				? [ 'approved', 'needs_review', 'ai_generated', 'draft' ]
				: [ 'approved' ];
		}

		foreach ( (array) ( $payload['modifiers'] ?? [] ) as $modifier_key => $modifier_value ) {
			if ( is_array( $modifier_value ) ) {
				foreach ( $modifier_value as $value ) {
					$value = sanitize_key( (string) $value );
					if ( '' !== $value ) {
						$modifiers[] = $value;
					}
				}
				continue;
			}

			$key = is_string( $modifier_key ) ? sanitize_key( $modifier_key ) : '';
			$value = sanitize_key( (string) $modifier_value );
			if ( '' !== $value ) {
				$modifiers[] = $value;
			}
			if ( '' !== $key && ! in_array( $key, [ '0', '1', '2', '3' ], true ) ) {
				$modifiers[] = $key . '_' . $value;
			}
		}

		foreach ( (array) ( $payload['modifier_keys'] ?? [] ) as $modifier ) {
			$modifier = sanitize_key( (string) $modifier );
			if ( '' !== $modifier ) {
				$modifiers[] = $modifier;
			}
		}

		return [
			'variants'  => array_values( array_unique( array_filter( $variants ) ) ),
			'modifiers' => array_values( array_unique( array_filter( $modifiers ) ) ),
			'overlays'  => array_values( array_unique( array_filter( $overlays ) ) ),
			'tones'     => array_values( array_unique( array_filter( $tones ) ) ),
			'statuses'  => array_values( array_unique( array_filter( $statuses ) ) ),
			'chart_context'  => sanitize_key( (string) ( $payload['chart_context'] ?? '' ) ),
			'audience_key'   => sanitize_key( (string) ( $payload['audience_key'] ?? '' ) ),
			'blocks'         => is_array( $payload['blocks'] ?? null ) ? $payload['blocks'] : [],
		];
	}

	/**
	 * Append any matched modifier riders (e.g. a planet's retrograde / dignity /
	 * stellium note) to already-rendered text. Modifier slots live under their parent
	 * atom keyed by slot_key (modifier_short) and are never pulled by normal template
	 * rules, so without this a passed-in modifier (motion:retrograde, …) would never
	 * surface in the sidebar. No active modifiers ⇒ text is returned untouched.
	 */
	private function append_modifier_riders( string $text, array $entries, string $output_context, array $render_context ): string {
		$active = (array) ( $render_context['modifiers'] ?? [] );
		if ( empty( $active ) ) {
			return $text;
		}
		$riders = [];
		foreach ( $entries as $entry ) {
			foreach ( (array) ( $entry['slots'] ?? [] ) as $slot ) {
				$meta = is_array( $slot['metadata_json'] ?? null ) ? $slot['metadata_json'] : [];
				if ( 'modifier' !== sanitize_key( (string) ( $meta['scope'] ?? '' ) ) ) {
					continue;
				}
				$modifier = sanitize_key( (string) ( $meta['modifier'] ?? '' ) );
				$mtype    = sanitize_key( (string) ( $meta['modifier_type'] ?? '' ) );
				$hit = ( '' !== $modifier && in_array( $modifier, $active, true ) )
					|| ( '' !== $mtype && '' !== $modifier && in_array( $mtype . '_' . $modifier, $active, true ) );
				if ( ! $hit ) {
					continue;
				}
				$oc = (string) ( $slot['output_context'] ?? '' );
				if ( '' !== $output_context && '' !== $oc && $oc !== $output_context ) {
					continue;
				}
				$value = trim( (string) ( $slot['slot_value'] ?? '' ) );
				if ( '' !== $value && ! in_array( $value, $riders, true ) ) {
					$riders[] = $value;
				}
			}
		}
		if ( empty( $riders ) ) {
			return $text;
		}
		return trim( trim( $text ) . "\n\n" . implode( "\n\n", $riders ) );
	}

	private function render_entry_slots( array $entry, string $output_context, array $render_context = [] ): string {
		$entry = $this->apply_best_variant_to_entry( $entry, $output_context, $render_context );
		return $this->get_slot_value_for_context( $entry['slots'], $output_context, [ 'full_chart', 'full_report', 'full_pdf', 'full_sidebar', 'full_reader', 'chart_snippet', 'report_snippet', 'pdf_long', 'sidebar_short', 'ai_context' ], $render_context );
	}

	private function render_entries_fallback( array $entries, string $output_context, array $render_context = [] ): string {
		$parts = [];
		foreach ( $entries as $entry ) {
			$text = $this->render_entry_slots( $entry, $output_context, $render_context );
			if ( '' === trim( $text ) ) {
				continue;
			}
			$parts[] = trim( $entry['title'] . "\n" . $text );
		}
		return implode( "\n\n", $parts );
	}

	private function render_template( array $template, array $matched_entries, string $output_context, array $render_context = [] ): string {
		$matched_entries = array_map( fn( array $entry ): array => $this->apply_best_variant_to_entry( $entry, $output_context, $render_context ), $matched_entries );
		if ( 'token_template' === (string) ( $template['render_mode'] ?? '' ) ) {
			return $this->render_token_template( $template, $matched_entries, $output_context, $render_context );
		}

		$parts = [];
		$rules = $template['rules'] ?? [];
		foreach ( $rules as $rule ) {
			$slot_key = (string) ( $rule['slot_key'] ?? '' );
			if ( '' === $slot_key ) {
				continue;
			}

			$source_ref = (string) ( $rule['source_ref'] ?? '' );
			$candidates = $matched_entries;
			if ( '' !== $source_ref ) {
				$candidates = array_values( array_filter( $matched_entries, static function ( array $entry ) use ( $source_ref ): bool {
					foreach ( (array) $entry['entities'] as $entity_link ) {
						$entity = $entity_link['entity'] ?? null;
						if ( is_array( $entity ) ) {
							$entity_ref = $entity['module_id'] . ':' . $entity['entity_type'] . ':' . $entity['entity_key'];
							if ( $entity_ref === $source_ref || (string) $entity['entity_type'] === $source_ref ) {
								return true;
							}
						}
					}
					return false;
				} ) );
			}

			foreach ( $candidates as $candidate ) {
				$value = $this->get_slot_value_for_context(
					$candidate['slots'],
					$output_context,
					array_filter( [ $slot_key, (string) ( $rule['fallback_slot_key'] ?? '' ), 'chart_snippet', 'report_snippet', 'sidebar_short', 'pdf_long' ] ),
					$render_context
				);
				if ( '' === trim( $value ) ) {
					continue;
				}
				$parts[] = trim( (string) ( $rule['prefix_text'] ?? '' ) . $value . (string) ( $rule['suffix_text'] ?? '' ) );
				break;
			}
		}

		if ( empty( $parts ) ) {
			return $this->render_entries_fallback( $matched_entries, $output_context, $render_context );
		}

		return implode( "\n\n", array_filter( $parts ) );
	}

	/**
	 * Map an entity type to a synthesis role token (planet/gate/line/sign/house/…).
	 * Drives {role.slot} tokens for woven multi-part readings. The personality-/
	 * design-side hd planet/point types still resolve to planet/point.
	 */
	private function entity_type_to_role( string $entity_type ): string {
		$entity_type = sanitize_key( $entity_type );
		$map = [
			'astro_planet'      => 'planet',
			'hd_planet'         => 'planet',
			'hd_gate'           => 'gate',
			'hd_line'           => 'line',
			'astro_sign'        => 'sign',
			'astro_house'       => 'house',
			'astro_aspect'      => 'aspect',
			'hd_channel'        => 'channel',
			'hd_center'         => 'center',
			// Angles (ASC/MC/…) are placements too — give them the 'planet' role so
			// they fill the same placement templates as planets.
			'astro_angle_point' => 'planet',
			'hd_angle_point'    => 'planet',
			'astro_asteroid'    => 'asteroid',
			'hd_type'           => 'type',
			'hd_authority'      => 'authority',
			'hd_profile'        => 'profile',
			'astro_moon_phase'  => 'moon_phase',
			'sabian_degree'     => 'sabian',
		];
		return $map[ $entity_type ] ?? '';
	}

	private function render_token_template( array $template, array $matched_entries, string $output_context, array $render_context = [] ): string {
		$metadata = is_array( $template['metadata_json'] ?? null ) ? $template['metadata_json'] : [];
		$body     = (string) ( $metadata['template_body'] ?? '' );
		if ( '' === trim( $body ) ) {
			return $this->render_entries_fallback( $matched_entries, $output_context, $render_context );
		}

		$values = [];
		foreach ( $this->get_template_fragments() as $fragment ) {
			$key = (string) ( $fragment['key'] ?? '' );
			if ( '' === $key ) {
				continue;
			}
			foreach ( $matched_entries as $entry ) {
				$value = $this->get_scoped_slot_value( (array) ( $entry['slots'] ?? [] ), $key, $output_context, $render_context );
				if ( '' !== trim( $value ) ) {
					$values[ '{' . $key . '}' ] = trim( $value );
					break;
				}
			}
		}

		$values['{title}'] = (string) ( $matched_entries[0]['title'] ?? '' );
		$values['{label}'] = $values['{label}'] ?? (string) ( $matched_entries[0]['title'] ?? '' );
		// Role tokens for multi-part synthesis: {planet.label}, {sign.short_def}, etc.
		// Roles come from an explicit role_key when present, otherwise derived from
		// the entity_type (planet/gate/line/sign/house/aspect/channel…) so a plain
		// chart selection of several atoms can be woven into one reading. Explicit
		// roles and earlier entries win (no clobbering).
		$role_overrides = (array) ( $render_context['role_overrides'] ?? [] );
		foreach ( $matched_entries as $entry ) {
			foreach ( (array) ( $entry['entities'] ?? [] ) as $entity_link ) {
				$entity = is_array( $entity_link['entity'] ?? null ) ? $entity_link['entity'] : [];
				$role   = sanitize_key( (string) ( $entity_link['role_key'] ?? '' ) );
				// Per-request role override (planet_a / planet_b / sign_a …) wins so a
				// synth can weave two same-type pieces distinctly.
				$entity_id      = (int) ( $entity_link['entity_id'] ?? ( $entity['id'] ?? 0 ) );
				
				$override_roles = [];
				if ( $entity_id > 0 && isset( $role_overrides[ $entity_id ] ) ) {
					$override_roles = (array) $role_overrides[ $entity_id ];
				}

				if ( empty( $override_roles ) ) {
					if ( '' === $role || 'primary' === $role ) {
						// 'primary' is the generic default role on every atom — derive a
						// meaningful role (planet/sign/house/…) from the entity type so role
						// tokens actually fill.
						$derived = $this->entity_type_to_role( (string) ( $entity['entity_type'] ?? '' ) );
						if ( '' !== $derived ) {
							$override_roles = [ $derived ];
						}
					} else {
						$override_roles = [ $role ];
					}
				}

				foreach ( $override_roles as $r ) {
					$r = sanitize_key( (string) $r );
					if ( '' === $r ) {
						continue;
					}
					if ( ! isset( $values[ '{' . $r . '.label}' ] ) ) {
						$values[ '{' . $r . '.label}' ] = (string) ( $entity['label'] ?? $entry['title'] ?? '' );
					}
					foreach ( (array) ( $entry['slots'] ?? [] ) as $slot ) {
						$slot_key = sanitize_key( (string) ( $slot['slot_key'] ?? '' ) );
						if ( '' === $slot_key || isset( $values[ '{' . $r . '.' . $slot_key . '}' ] ) ) {
							continue;
						}
						$value = $this->get_scoped_slot_value( (array) ( $entry['slots'] ?? [] ), $slot_key, $output_context, $render_context );
						if ( '' !== trim( $value ) ) {
							$values[ '{' . $r . '.' . $slot_key . '}' ] = $value;
						}
					}
				}
			}
		}
		foreach ( [ 'aspect_group_block', 'angel_overlay_block', 'synthesis_summary_block' ] as $block_key ) {
			$values[ '{{' . $block_key . '}}' ] = (string) ( $render_context['blocks'][ $block_key ] ?? '' );
		}

		$rendered = strtr( $body, $values );
		$rendered = preg_replace( '/\{\{[A-Za-z0-9_]+\}\}/', '', $rendered ) ?: $rendered;
		$rendered = preg_replace( '/\{[A-Za-z0-9_.]+\}/', '', $rendered ) ?: $rendered;
		return $this->tidy_rendered_text( $rendered );
	}

	/**
	 * Clean up after token substitution so woven templates read well even when a
	 * role's field was empty: drop dangling connectors/punctuation, collapse extra
	 * spaces, and remove blank lines. Keeps the prose tight without the author
	 * having to guard every token.
	 */
	private function tidy_rendered_text( string $text ): string {
		$lines = preg_split( '/\R/', $text ) ?: [];
		$clean = [];
		foreach ( $lines as $line ) {
			$line = preg_replace( '/[ \t]{2,}/', ' ', $line );      // collapse runs of spaces
			$line = preg_replace( '/\s+([,.;:])/', '$1', $line );    // " ," -> ","
			$line = preg_replace( '/\(\s*\)/', '', $line );          // empty parens
			$line = preg_replace( '/([,;:])\s*([.])/', '$2', $line ); // ", ." -> "."
			$line = preg_replace( '/^[\s,.;:—-]+/', '', $line );     // leading orphan punctuation
			$line = trim( $line );
			// Drop lines that are now just punctuation/labels with no content.
			if ( '' === $line || preg_match( '/^[\s,.;:—()-]*$/', $line ) ) {
				$clean[] = '';
				continue;
			}
			$clean[] = $line;
		}
		$out = implode( "\n", $clean );
		$out = preg_replace( '/\n{3,}/', "\n\n", $out ) ?: $out; // collapse blank-line runs
		return trim( $out );
	}

	/** @param array<int, array<string, mixed>> $slots */
	private function get_slot_value_for_context( array $slots, string $output_context, array $fallback_keys = [], array $render_context = [] ): string {
		$preferred_keys = array_values( array_filter( array_unique( array_merge(
			$output_context ? [ $output_context ] : [],
			$fallback_keys
		) ) ) );

		foreach ( $preferred_keys as $preferred_key ) {
			$scoped_value = $this->get_scoped_slot_value( $slots, $preferred_key, $output_context, $render_context );
			if ( '' !== trim( $scoped_value ) ) {
				return $scoped_value;
			}
		}

		if ( '' !== $output_context ) {
			foreach ( [ 'variant', 'modifier', 'base' ] as $scope ) {
				foreach ( $slots as $slot ) {
					if ( (string) ( $slot['output_context'] ?? '' ) !== $output_context ) {
						continue;
					}
					if ( ! $this->slot_matches_scope( $slot, $scope, $render_context ) ) {
						continue;
					}
					return (string) ( $slot['slot_value'] ?? '' );
				}
			}
		}

		return '';
	}

	private function get_scoped_slot_value( array $slots, string $slot_key, string $output_context, array $render_context ): string {
		foreach ( [ 'variant', 'modifier', 'base' ] as $scope ) {
			foreach ( $slots as $slot ) {
				if ( (string) $slot['slot_key'] !== $slot_key ) {
					continue;
				}
				if ( '' !== $output_context && '' !== (string) $slot['output_context'] && (string) $slot['output_context'] !== $output_context ) {
					continue;
				}
				if ( ! $this->slot_matches_scope( $slot, $scope, $render_context ) ) {
					continue;
				}
				return (string) ( $slot['slot_value'] ?? '' );
			}
		}

		return '';
	}

	private function slot_matches_scope( array $slot, string $scope, array $render_context ): bool {
		$meta = is_array( $slot['metadata_json'] ?? null ) ? $slot['metadata_json'] : [];
		$slot_scope = sanitize_key( (string) ( $meta['scope'] ?? 'base' ) );

		if ( 'base' === $scope ) {
			return '' === $slot_scope || 'base' === $slot_scope;
		}

		if ( $slot_scope !== $scope ) {
			return false;
		}

		if ( 'variant' === $scope ) {
			$variant = sanitize_key( (string) ( $meta['variant'] ?? '' ) );
			$status = sanitize_key( (string) ( $meta['status'] ?? 'approved' ) );
			if ( ! in_array( $status, (array) ( $render_context['statuses'] ?? [ 'approved' ] ), true ) ) {
				return false;
			}
			$overlay = sanitize_key( (string) ( $meta['overlay_key'] ?? '' ) );
			if ( '' !== $overlay && ! in_array( $overlay, (array) ( $render_context['overlays'] ?? [ 'base' ] ), true ) && 'base' !== $overlay ) {
				return false;
			}
			$tone = sanitize_key( (string) ( $meta['tone_key'] ?? '' ) );
			if ( '' !== $tone && ! in_array( $tone, (array) ( $render_context['tones'] ?? [ 'default' ] ), true ) && 'default' !== $tone ) {
				return false;
			}
			return '' !== $variant && ( in_array( $variant, (array) ( $render_context['variants'] ?? [] ), true ) || '' !== $overlay || '' !== $tone );
		}

		if ( 'modifier' === $scope ) {
			$modifier = sanitize_key( (string) ( $meta['modifier'] ?? '' ) );
			return '' !== $modifier && in_array( $modifier, (array) ( $render_context['modifiers'] ?? [] ), true );
		}

		return false;
	}

	private function find_entity_id( string $module_id, string $entity_type, string $entity_key ): int {
		global $wpdb;
		$entity_key = $this->normalize_astrohd_entity_key( $entity_type, $entity_key );
		$found = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$wpdb->prefix}lunacco_def_entities WHERE module_id = %s AND entity_type = %s AND entity_key = %s",
				$module_id,
				$entity_type,
				$entity_key
			)
		);
		if ( $found > 0 ) {
			return $found;
		}
		foreach ( $this->astrohd_entity_key_aliases( $entity_type, $entity_key ) as $alias ) {
			$found = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT id FROM {$wpdb->prefix}lunacco_def_entities WHERE module_id = %s AND entity_type = %s AND entity_key = %s",
					$module_id,
					$entity_type,
					$alias
				)
			);
			if ( $found > 0 ) {
				return $found;
			}
		}
		return 0;
	}

	private function astrohd_entity_key_aliases( string $entity_type, string $entity_key ): array {
		$aliases = [
			'hd_center' => [
				'g_center'     => [ 'g-center' ],
				'solar_plexus' => [ 'solar-plexus' ],
				'heart'        => [ 'ego' ],
			],
		];
		return $aliases[ $entity_type ][ $entity_key ] ?? [];
	}

	private function normalize_astrohd_entity_key( string $entity_type, string $entity_key ): string {
		$key = sanitize_key( str_replace( '/', '-', $entity_key ) );
		if ( preg_match( '/^(.+)-(defined|undefined|open)$/', $key, $matches ) ) {
			return $this->normalize_astrohd_entity_key( $entity_type, $matches[1] ) . '-' . $matches[2];
		}
		if ( preg_match( '/^(personality|design)-(.+)$/', $key, $matches ) ) {
			return $matches[1] . '-' . $this->normalize_astrohd_entity_key( $entity_type, $matches[2] );
		}
		if ( preg_match( '/^([0-9]+)-([0-9]+)-(fixed|mutable|cardinal)$/', $key, $matches ) ) {
			return $matches[1] . '-' . $matches[2] . '-' . $matches[3];
		}
		$map = [
			'hd_center' => [
				'g-center'     => 'g_center',
				'solar-plexus' => 'solar_plexus',
				'ego'          => 'heart',
			],
			'astro_house' => [
				'1' => 'house_1',
				'2' => 'house_2',
				'3' => 'house_3',
				'4' => 'house_4',
				'5' => 'house_5',
				'6' => 'house_6',
				'7' => 'house_7',
				'8' => 'house_8',
				'9' => 'house_9',
				'10' => 'house_10',
				'11' => 'house_11',
				'12' => 'house_12',
			],
		];
		return $map[ $entity_type ][ $key ] ?? $key;
	}

	private function log_render( int $set_id, string $module_id, string $output_context, array $payload, array $result ): void {
		global $wpdb;

		$table = $wpdb->prefix . 'lunacco_def_render_logs';
		$wpdb->insert( $table, [
			'set_id'          => $set_id,
			'module_id'       => $module_id,
			'output_context'  => $output_context,
			'request_hash'    => md5( wp_json_encode( $payload ) ?: '' ),
			'resolution_mode' => sanitize_key( (string) ( $result['mode'] ?? 'unknown' ) ),
			'payload_json'    => $this->encode_json( $payload ),
			'result_json'     => $this->encode_json( $result ),
		] );
	}

	private function astrohd_entity_type_from_section( string $section_type ): string {
		$map = [
			'hd_gates'              => 'hd_gate',
			'hd_channels'           => 'hd_channel',
			'hd_centers'            => 'hd_center',
			'hd_types'              => 'hd_type',
			'hd_authorities'        => 'hd_authority',
			'hd_profiles'           => 'hd_profile',
			'hd_lines'              => 'hd_line',
			'hd_incarnation_crosses' => 'hd_incarnation_cross',
			'hd_variables'          => 'hd_variable',
			'hd_variable_colors'    => 'hd_variable_color',
			'hd_variable_tones'     => 'hd_variable_tone',
			'hd_circuitry'          => 'hd_circuitry',
			'hd_quarters'           => 'hd_quarter',
			'hd_strategies'         => 'hd_strategy',
			'hd_destiny_points'     => 'hd_destiny_point',
			'hd_definition_types'   => 'hd_definition_type',
			'hd_planets'            => 'astro_planet',
			'hd_angles_points'      => 'astro_angle_point',
			'hd_birth_moon_phase'   => 'hd_birth_moon_phase',
			'hd_birth_eclipse'      => 'hd_birth_eclipse',
			'astro_planets'         => 'astro_planet',
			'astro_signs'           => 'astro_sign',
			'astro_houses'          => 'astro_house',
			'astro_house_cusps'     => 'astro_house_cusp',
			'astro_aspects'         => 'astro_aspect',
			'astro_angles_points'   => 'astro_angle_point',
			'astro_asteroids'       => 'astro_asteroid',
			'astro_elements'        => 'astro_element',
			'astro_modalities'      => 'astro_modality',
			'astro_hemispheres_quadrants' => 'astro_hemisphere_quadrant',
			'astro_moon_phases'     => 'astro_moon_phase',
			'astro_dignities'       => 'astro_dignity',
			'astro_planetary_conditions' => 'astro_planetary_condition',
			'astro_chart_patterns'  => 'astro_chart_pattern',
			'astro_modifiers'       => 'astro_modifier',
			'astro_body_in_sign'    => 'astro_body_in_sign',
			'astro_body_in_house'   => 'astro_body_in_house',
			'astro_body_in_sign_house' => 'astro_body_in_sign_house',
			'astro_aspect_combos'   => 'astro_aspect_combo',
			'astro_moon_phase_combos' => 'astro_moon_phase_combo',
			'astro_patterns'        => 'astro_pattern',
			'angel_shem'            => 'angel_shem',
			'angel_degree_ranges'   => 'angel_degree_range',
			'astro_decanates'       => 'astro_decanate',
			'num_pythagorean'       => 'num_pythagorean',
			'num_adn'               => 'num_adn',
			'astro_birth_moon_phase' => 'astro_birth_moon_phase',
			'astro_birth_eclipse'   => 'astro_birth_eclipse',
		];

		return $map[ $section_type ] ?? sanitize_key( $section_type );
	}

	/**
	 * Classify an AstroHD entity type for the worksheet:
	 *  - atom: a real standalone placement (gets its own worksheet section + entries)
	 *  - modifier: authored under a parent atom (line, dignity, retro, color/arrow…), not standalone
	 *  - synthesis: a combination (planet-in-sign, aspect combo…) driven by templates — hidden until Phase 4
	 */
	public function classify_astrohd_type( string $entity_type ): string {
		$entity_type = sanitize_key( $entity_type );

		$synthesis = [
			'astro_body_in_sign', 'astro_body_in_house', 'astro_body_in_sign_house',
			'astro_aspect_combo', 'astro_moon_phase_combo', 'astro_pattern', 'angel_degree_range',
			'hd_incarnation_cross_family', 'hd_incarnation_cross_variant',
		];
		// hd_variable_color (color+direction combos) and hd_variable_tone (the two
		// per-side tone sets) are now authorable ATOMS — the real meaning of a variable
		// lives there, with the arrow reduced to a snippet. Only the bare direction flag
		// remains a modifier.
		$modifier = [
			'hd_consciousness', 'hd_center_state', 'hd_variable_direction',
			'astro_dignity', 'astro_planetary_condition', 'astro_modifier', 'astro_chart_context',
		];

		if ( in_array( $entity_type, $synthesis, true ) ) {
			return 'synthesis';
		}
		if ( in_array( $entity_type, $modifier, true ) ) {
			return 'modifier';
		}
		return 'atom';
	}

	private function truncate_table_if_exists( string $table ): bool {
		global $wpdb;

		$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
		if ( $exists !== $table ) {
			return false;
		}

		$wpdb->query( "TRUNCATE TABLE `{$table}`" );
		return true;
	}

	private function astrohd_section_from_entity_type( string $entity_type ): string {
		$map = [
			'hd_gate'                 => 'hd_gates',
			'hd_channel'              => 'hd_channels',
			'hd_center'               => 'hd_centers',
			'hd_type'                 => 'hd_types',
			'hd_authority'            => 'hd_authorities',
			'hd_profile'              => 'hd_profiles',
			'hd_line'                 => 'hd_lines',
			'hd_incarnation_cross'    => 'hd_incarnation_crosses',
			'hd_variable'             => 'hd_variables',
			'hd_variable_color'       => 'hd_variable_colors',
			'hd_variable_tone'        => 'hd_variable_tones',
			'hd_circuitry'            => 'hd_circuitry',
			'hd_definition_type'      => 'hd_definition_types',
			'astro_planet'            => 'astro_planets',
			'astro_sign'              => 'astro_signs',
			'astro_house'             => 'astro_houses',
			'astro_aspect'            => 'astro_aspects',
			'astro_angle_point'       => 'astro_angles_points',
			'astro_element'           => 'astro_elements',
			'astro_modality'          => 'astro_modalities',
			'astro_hemisphere_quadrant' => 'astro_hemispheres_quadrants',
			'astro_dignity'           => 'astro_dignities',
			'astro_planetary_condition' => 'astro_planetary_conditions',
			'astro_chart_pattern'     => 'astro_chart_patterns',
			'astro_modifier'          => 'astro_modifiers',
			'astro_body_in_sign'      => 'astro_body_in_sign',
			'astro_body_in_house'     => 'astro_body_in_house',
			'astro_body_in_sign_house'=> 'astro_body_in_sign_house',
			'astro_aspect_combo'      => 'astro_aspect_combos',
			'astro_moon_phase_combo'  => 'astro_moon_phase_combos',
			'astro_pattern'           => 'astro_patterns',
			'angel_shem'              => 'angel_shem',
			'angel_degree_range'      => 'angel_degree_ranges',
		];

		return $map[ $entity_type ] ?? sanitize_key( $entity_type );
	}

	private function encode_json( $value ): string {
		return wp_json_encode( $value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ?: '{}';
	}

	/**
	 * @return array<string, mixed>
	 */
	private function decode_json( string $json ): array {
		if ( '' === trim( $json ) ) {
			return [];
		}
		$decoded = json_decode( $json, true );
		return is_array( $decoded ) ? $decoded : [];
	}
}
