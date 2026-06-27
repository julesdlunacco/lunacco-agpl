<?php
/**
 * AI configuration — encryption, API key management, persona catalog,
 * pricing config, lens helpers, and OpenRouter model fetching.
 *
 * Migrated from luna-tarot's backend.php (lines 346-368, 2664-2943,
 * 4513-4681) and luna-tarot.php (persona catalog helpers).
 *
 * What stays in luna-tarot:
 *   - generate_ai_reading()       (tarot-specific prompt assembly + AI call)
 *   - generate_deck_meanings()    (tarot-specific AI deck generation)
 *   - ajax_stream_deck_meanings() (tarot-specific streaming AJAX)
 *   - ajax_stream_spread_create() (tarot-specific streaming AJAX)
 *
 * Option keys (unchanged from luna-tarot):
 *   lt_openrouter_key_enc, lt_openrouter_key (legacy plain),
 *   lt_ai_model, lt_ai_system_prompt, lt_ai_deck_system_prompt,
 *   lt_ai_persona_prompts, lt_ai_favorite_models,
 *   lt_ai_report_base_cost, lt_ai_lens_default_cost,
 *   lt_ai_generation_logging_enabled,
 *   lt_ai_models_cache, lt_ai_models_cache_updated_at
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_AI_Config {

	// ------------------------------------------------------------------
	// Encryption (AES-256-CBC, key derived from WP secret keys)
	// ------------------------------------------------------------------

	/**
	 * Encryption key derived from WP secret keys — never leaves server.
	 */
	private function get_encryption_key(): string {
		return substr( hash( 'sha256', AUTH_KEY . SECURE_AUTH_KEY ), 0, 32 );
	}

	public function encrypt( string $value ): string {
		if ( $value === '' ) {
			return '';
		}
		$iv  = random_bytes( 16 );
		$enc = openssl_encrypt( $value, 'AES-256-CBC', $this->get_encryption_key(), 0, $iv );
		return base64_encode( $iv . $enc );
	}

	public function decrypt( string $stored ): string {
		if ( $stored === '' ) {
			return '';
		}
		$raw  = base64_decode( $stored );
		$iv   = substr( $raw, 0, 16 );
		$data = substr( $raw, 16 );
		$dec  = openssl_decrypt( $data, 'AES-256-CBC', $this->get_encryption_key(), 0, $iv );
		return $dec !== false ? $dec : '';
	}

	// ------------------------------------------------------------------
	// API key
	// ------------------------------------------------------------------

	/**
	 * Retrieve the OpenRouter API key (falls back to legacy plain-text option).
	 */
	public function get_api_key(): string {
		$key = $this->decrypt( (string) get_option( 'lt_openrouter_key_enc', '' ) );
		if ( $key === '' ) {
			$key = (string) get_option( 'lt_openrouter_key', '' );
		}
		return trim( $key );
	}

	/**
	 * Save an API key (encrypts and deletes legacy plain-text option).
	 * Redirects back to the AI settings page on completion.
	 *
	 * Hooked to: admin_post_lt_save_api_key
	 */
	public function admin_post_save_api_key(): void {
		check_admin_referer( 'lt_save_api_key' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		$key = trim( (string) ( $_POST['lt_openrouter_key'] ?? '' ) );
		if ( $key !== '' ) {
			update_option( 'lt_openrouter_key_enc', $this->encrypt( $key ) );
			delete_option( 'lt_openrouter_key' );
		}

		wp_redirect( admin_url( 'admin.php?page=lunacco-ai&saved=1' ) );
		exit;
	}

	// ------------------------------------------------------------------
	// Persona catalog
	// ------------------------------------------------------------------

	/**
	 * Built-in persona catalog (tone, focus, lens entries).
	 */
	public function get_default_persona_catalog(): array {
		return [
			'tone'  => [
				[
					'key'    => 'gentle',
					'label'  => 'Gentle',
					'prompt' => 'Use a soothing, supportive, compassionate tone.',
					'cost'   => 0,
				],
				[
					'key'    => 'playful',
					'label'  => 'Playful',
					'prompt' => 'Use warm humor, approachable language, and a light but insightful voice.',
					'cost'   => 0,
				],
			],
			'focus' => [
				[
					'key'    => 'romance',
					'label'  => 'Romance',
					'prompt' => 'Speak to emotional connection, intimacy, communication, and relational growth.',
					'cost'   => 0,
				],
				[
					'key'    => 'business',
					'label'  => 'Business',
					'prompt' => 'Focus on strategy, leadership, risk, timing, and practical execution.',
					'cost'   => 0,
				],
			],
			'lens'  => [
				[
					'key'            => 'astrology',
					'label'          => 'Astrology Lens',
					'prompt'         => 'Integrate astrology context where relevant, and connect themes to natal patterns if provided.',
					'cost'           => 1,
					'profile_source' => 'astrology',
				],
				[
					'key'            => 'human-design',
					'label'          => 'Human Design Lens',
					'prompt'         => 'Frame guidance through Human Design strategy, authority, and energetic alignment if provided.',
					'cost'           => 1,
					'profile_source' => 'human_design',
				],
				[
					'key'            => 'numerology',
					'label'          => 'Numerology Lens',
					'prompt'         => 'Use numerology symbolism and personal number patterns where relevant if provided.',
					'cost'           => 1,
					'profile_source' => 'numerology',
				],
			],
		];
	}

	/**
	 * Returns the active persona catalog, merging saved `lt_ai_persona_prompts`
	 * with the built-in defaults.  Falls back to defaults for any empty category.
	 *
	 * Accepts both the new JSON array format and the legacy key:prompt line format.
	 */
	public function get_persona_catalog(): array {
		$defaults    = $this->get_default_persona_catalog();
		$raw_persona = get_option( 'lt_ai_persona_prompts', '' );

		if ( ! is_string( $raw_persona ) || trim( $raw_persona ) === '' ) {
			return $defaults;
		}

		$catalog     = [ 'tone' => [], 'focus' => [], 'lens' => [] ];
		$parsed_json = json_decode( $raw_persona, true );

		if ( is_array( $parsed_json ) ) {
			foreach ( $parsed_json as $entry ) {
				if ( ! is_array( $entry ) ) {
					continue;
				}

				$key    = sanitize_key( $entry['key'] ?? $entry['id'] ?? '' );
				$type   = sanitize_key( $entry['type'] ?? 'focus' );
				$prompt = trim( (string) ( $entry['prompt'] ?? '' ) );

				if ( $key === '' || $prompt === '' ) {
					continue;
				}
				if ( ! isset( $catalog[ $type ] ) ) {
					$type = 'focus';
				}

				$catalog[ $type ][] = [
					'key'            => $key,
					'label'          => sanitize_text_field( $entry['label'] ?? $key ),
					'prompt'         => $prompt,
					'cost'           => $type === 'lens' ? max( 0, (int) ( $entry['cost'] ?? 0 ) ) : 0,
					'profile_source' => $type === 'lens' ? sanitize_key( $entry['profile_source'] ?? '' ) : '',
				];
			}
		} else {
			// Legacy key:prompt line format (one entry per line).
			foreach ( preg_split( '/\r\n|\r|\n/', $raw_persona ) as $line ) {
				$line = trim( (string) $line );
				if ( $line === '' || strpos( $line, ':' ) === false ) {
					continue;
				}
				[ $k, $v ] = array_map( 'trim', explode( ':', $line, 2 ) );
				$clean_key  = sanitize_key( $k );
				if ( $clean_key === '' || $v === '' ) {
					continue;
				}
				$catalog['focus'][] = [
					'key'    => $clean_key,
					'label'  => ucwords( str_replace( [ '-', '_' ], ' ', $clean_key ) ),
					'prompt' => $v,
					'cost'   => 0,
				];
			}
		}

		// Fall back to defaults for any empty category.
		foreach ( [ 'tone', 'focus', 'lens' ] as $category ) {
			if ( empty( $catalog[ $category ] ) ) {
				$catalog[ $category ] = $defaults[ $category ];
			}
		}

		return $catalog;
	}

	/**
	 * Validate a persona category selection against the catalog.
	 * Returns the value if valid, empty string otherwise.
	 */
	public function normalize_persona_category_selection( string $value, array $catalog_entries ): string {
		$value = sanitize_key( $value );
		if ( $value === '' ) {
			return '';
		}
		foreach ( $catalog_entries as $entry ) {
			if ( sanitize_key( $entry['key'] ?? '' ) === $value ) {
				return $value;
			}
		}
		return '';
	}

	/**
	 * Validate and normalise all persona selections (tone, focus, lens) from request params.
	 */
	public function normalize_persona_selection( array $params, array $persona_catalog ): array {
		$selection = is_array( $params['persona_selection'] ?? null ) ? $params['persona_selection'] : [];

		return [
			'tone'  => $this->normalize_persona_category_selection(
				$selection['tone']  ?? ( $params['tone']  ?? '' ),
				$persona_catalog['tone'] ?? []
			),
			'focus' => $this->normalize_persona_category_selection(
				$selection['focus'] ?? ( $params['focus'] ?? '' ),
				$persona_catalog['focus'] ?? []
			),
			'lens'  => $this->normalize_persona_category_selection(
				$selection['lens']  ?? ( $params['lens']  ?? '' ),
				$persona_catalog['lens'] ?? []
			),
		];
	}

	// ------------------------------------------------------------------
	// Pricing config
	// ------------------------------------------------------------------

	public function get_report_pricing_config(): array {
		return [
			'base_cost'        => max( 0, (int) get_option( 'lt_ai_report_base_cost', 1 ) ),
			'lens_default_cost' => max( 0, (int) get_option( 'lt_ai_lens_default_cost', 1 ) ),
		];
	}

	// ------------------------------------------------------------------
	// Lens helpers
	// ------------------------------------------------------------------

	public function get_lens_profile_source_options(): array {
		return [
			'astrology'    => 'astrology',
			'human_design' => 'human_design',
			'numerology'   => 'numerology',
		];
	}

	private function get_lens_config_map(): array {
		return [
			'astrology'    => [
				'profile_key'     => 'astrology',
				'required_fields' => [ 'sun_sign', 'moon_sign', 'rising_sign' ],
				'allowed_fields'  => [ 'sun_sign', 'moon_sign', 'rising_sign', 'stellium_sign_house' ],
				'prompt_labels'   => [
					'sun_sign'            => 'Sun',
					'moon_sign'           => 'Moon',
					'rising_sign'         => 'Rising',
					'stellium_sign_house' => 'Stellium',
				],
			],
			'human_design' => [
				'profile_key'     => 'human_design',
				'required_fields' => [ 'type', 'profile', 'incarnation_cross' ],
				'allowed_fields'  => [ 'type', 'profile', 'incarnation_cross' ],
				'prompt_labels'   => [
					'type'              => 'Type',
					'profile'           => 'Profile',
					'incarnation_cross' => 'Incarnation Cross',
				],
			],
			'numerology'   => [
				'profile_key'     => 'numerology',
				'required_fields' => [ 'life_path_number', 'expression_number', 'personality_number' ],
				'allowed_fields'  => [ 'life_path_number', 'expression_number', 'personality_number' ],
				'prompt_labels'   => [
					'life_path_number'   => 'Life Path Number',
					'expression_number'  => 'Expression Number',
					'personality_number' => 'Personality Number',
				],
			],
		];
	}

	/**
	 * Look up a lens catalog entry from the persona catalog by key.
	 */
	public function get_lens_persona_entry( string $lens_key ): array {
		$lens_key = sanitize_key( $lens_key );
		if ( $lens_key === '' ) {
			return [];
		}
		$catalog = $this->get_persona_catalog();
		foreach ( ( $catalog['lens'] ?? [] ) as $entry ) {
			if ( sanitize_key( $entry['key'] ?? '' ) === $lens_key ) {
				return is_array( $entry ) ? $entry : [];
			}
		}
		return [];
	}

	/**
	 * Resolve the profile_source key for a given lens key.
	 * Falls back to using the lens key itself (normalising human-design → human_design).
	 */
	public function get_lens_profile_source_key( string $lens_key ): string {
		$lens_entry     = $this->get_lens_persona_entry( $lens_key );
		$profile_source = sanitize_key( $lens_entry['profile_source'] ?? '' );
		$allowed        = $this->get_lens_profile_source_options();

		if ( $profile_source !== '' && isset( $allowed[ $profile_source ] ) ) {
			return $profile_source;
		}

		$fallback = sanitize_key( $lens_key );
		if ( $fallback === 'human-design' ) {
			$fallback = 'human_design';
		}

		return isset( $allowed[ $fallback ] ) ? $fallback : '';
	}

	/**
	 * Return the full lens config (required_fields, allowed_fields, prompt_labels) for a lens key.
	 */
	public function get_lens_config( string $lens_key ): array {
		$config_map     = $this->get_lens_config_map();
		$profile_source = $this->get_lens_profile_source_key( $lens_key );

		if ( $profile_source === '' ) {
			return [];
		}
		if ( $profile_source === 'human-design' ) {
			$profile_source = 'human_design';
		}

		return is_array( $config_map[ $profile_source ] ?? null ) ? $config_map[ $profile_source ] : [];
	}

	/**
	 * Extract the relevant sub-array from a user profile for a given lens key.
	 */
	public function get_lens_profile_context( array $profile_data, string $lens_key ): array {
		$config      = $this->get_lens_config( $lens_key );
		$profile_key = (string) ( $config['profile_key'] ?? '' );
		if ( $profile_key === '' ) {
			return [];
		}
		return is_array( $profile_data[ $profile_key ] ?? null ) ? $profile_data[ $profile_key ] : [];
	}

	/**
	 * Return the required fields for a lens.
	 */
	public function get_lens_requirements( string $lens_key ): array {
		$config = $this->get_lens_config( $lens_key );
		return is_array( $config['required_fields'] ?? null ) ? $config['required_fields'] : [];
	}

	/**
	 * Sanitise lens input against allowed fields.
	 */
	public function normalize_lens_input( array $lens_input, string $lens_key ): array {
		$config  = $this->get_lens_config( $lens_key );
		$allowed = is_array( $config['allowed_fields'] ?? null ) ? $config['allowed_fields'] : [];

		$normalized = [];
		foreach ( $allowed as $field ) {
			$normalized[ $field ] = sanitize_text_field( $lens_input[ $field ] ?? '' );
		}
		return $normalized;
	}

	/**
	 * Return a list of required lens fields that are missing from the provided context.
	 */
	public function get_missing_lens_fields( string $lens_key, array $lens_context ): array {
		$missing = [];
		foreach ( $this->get_lens_requirements( $lens_key ) as $field ) {
			if ( trim( (string) ( $lens_context[ $field ] ?? '' ) ) === '' ) {
				$missing[] = $field;
			}
		}
		return $missing;
	}

	/**
	 * Build a human-readable prompt fragment from lens context data.
	 */
	public function build_lens_context_prompt( string $lens_key, array $lens_context ): string {
		if ( empty( $lens_context ) ) {
			return '';
		}

		$config         = $this->get_lens_config( $lens_key );
		$allowed_fields = is_array( $config['allowed_fields'] ?? null ) ? $config['allowed_fields'] : [];
		$prompt_labels  = is_array( $config['prompt_labels'] ?? null ) ? $config['prompt_labels'] : [];

		if ( empty( $allowed_fields ) ) {
			return '';
		}

		$parts = [];
		foreach ( $allowed_fields as $field ) {
			$value = trim( (string) ( $lens_context[ $field ] ?? '' ) );
			if ( $value === '' ) {
				continue;
			}
			$parts[] = ( $prompt_labels[ $field ] ?? ucwords( str_replace( '_', ' ', $field ) ) ) . ': ' . $value;
		}

		return implode( '; ', $parts );
	}

	// ------------------------------------------------------------------
	// Logging helpers (used by luna-tarot's AI generation code and admin pages)
	// ------------------------------------------------------------------

	public function is_generation_logging_enabled(): bool {
		return get_option( 'lt_ai_generation_logging_enabled', '0' ) === '1';
	}

	// ------------------------------------------------------------------
	// OpenRouter model fetching
	// ------------------------------------------------------------------

	/**
	 * REST handler: GET lunacco/v1/ai/models
	 */
	public function rest_get_models( WP_REST_Request $request ) {
		$models = $this->get_cached_models( false );
		if ( is_wp_error( $models ) ) {
			return $models;
		}
		return rest_ensure_response( $models );
	}

	/**
	 * AJAX handler: wp_ajax_lt_fetch_models
	 */
	public function ajax_fetch_models(): void {
		check_ajax_referer( 'lt_fetch_models' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( 'Unauthorized' );
		}

		$force  = ! empty( $_POST['force'] );
		$models = $this->get_cached_models( $force );
		if ( is_wp_error( $models ) ) {
			wp_send_json_error( $models->get_error_message() );
		}

		wp_send_json_success( [
			'models'     => $models,
			'updated_at' => (string) get_option( 'lt_ai_models_cache_updated_at', '' ),
		] );
	}

	/**
	 * AJAX handler: wp_ajax_lt_save_ai_model
	 */
	public function ajax_save_ai_model(): void {
		check_ajax_referer( 'lt_save_ai_model' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( 'Unauthorized' );
		}

		$model = sanitize_text_field( $_POST['model'] ?? '' );
		if ( $model === '' ) {
			wp_send_json_error( 'Model is required' );
		}

		update_option( 'lt_ai_model', $model );
		wp_send_json_success( [ 'saved' => true ] );
	}

	/**
	 * AJAX handler: wp_ajax_lt_test_api_connection
	 */
	public function ajax_test_api_connection(): void {
		check_ajax_referer( 'lt_test_api_connection' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( 'Unauthorized' );
		}

		$api_key = $this->get_api_key();
		if ( $api_key === '' ) {
			wp_send_json_error( 'No API key saved.' );
		}

		$res = wp_remote_get( 'https://openrouter.ai/api/v1/models', [
			'timeout' => 15,
			'headers' => [ 'Authorization' => 'Bearer ' . $api_key ],
		] );

		if ( is_wp_error( $res ) ) {
			wp_send_json_error( $res->get_error_message() );
		}

		$code = (int) wp_remote_retrieve_response_code( $res );
		if ( $code !== 200 ) {
			wp_send_json_error( 'HTTP ' . $code );
		}

		wp_send_json_success( [ 'ok' => true ] );
	}

	// ------------------------------------------------------------------
	// Model cache helpers (private)
	// ------------------------------------------------------------------

	/**
	 * @return array|WP_Error
	 */
	private function get_cached_models( bool $force_refresh = false ) {
		$cached = get_option( 'lt_ai_models_cache', [] );
		if ( ! $force_refresh && is_array( $cached ) && ! empty( $cached ) ) {
			return $cached;
		}

		$models = $this->fetch_models_from_api();
		if ( is_wp_error( $models ) ) {
			return $models;
		}

		update_option( 'lt_ai_models_cache', $models, false );
		update_option( 'lt_ai_models_cache_updated_at', current_time( 'mysql' ), false );

		return $models;
	}

	/**
	 * @return array|WP_Error
	 */
	private function fetch_models_from_api() {
		$api_key = $this->get_api_key();
		if ( $api_key === '' ) {
			return new WP_Error( 'no_key', 'API key not configured', [ 'status' => 400 ] );
		}

		$res = wp_remote_get( 'https://openrouter.ai/api/v1/models', [
			'timeout' => 20,
			'headers' => [ 'Authorization' => 'Bearer ' . $api_key ],
		] );

		if ( is_wp_error( $res ) ) {
			return new WP_Error( 'fetch_err', $res->get_error_message(), [ 'status' => 500 ] );
		}

		$body   = json_decode( wp_remote_retrieve_body( $res ), true );
		$models = array_map(
			function ( $m ) {
				return [
					'id'             => $m['id'],
					'name'           => $m['name'] ?? $m['id'],
					'context_length' => $m['context_length'] ?? 0,
					'pricing'        => $m['pricing'] ?? [],
				];
			},
			$body['data'] ?? []
		);

		usort( $models, fn( $a, $b ) => strcmp( $a['id'], $b['id'] ) );
		return $models;
	}

	// ------------------------------------------------------------------
	// Definition section generation (shared endpoint for all modules)
	// ------------------------------------------------------------------

	/**
	 * REST handler: POST lunacco/v1/ai/generate-definition-section
	 *
	 * Generates one or more position-specific definition sections using OpenRouter.
	 * Body params:
	 *   number                — the number or arcana being defined (e.g. "1", "7")
	 *   numbers               — optional array of up to 5 numbers for batch generation
	 *   section_name          — the position section to generate (e.g. "Life Path") or "ALL"
	 *   sections              — optional array of section names for batch
	 *   set_type              — 'pythagorean', 'big5', 'name_arcana', or 'core7'
	 *   main_content          — existing ## Main content to use as generation context
	 *   model                 — optional model override (falls back to lt_ai_model option)
	 *   additional_instructions — optional extra instructions appended to the user prompt
	 */
	public function rest_generate_definition_section( WP_REST_Request $request ) {
		$params       = $request->get_json_params();
		$number       = sanitize_text_field( $params['number'] ?? '' );
		$section_name = sanitize_text_field( $params['section_name'] ?? '' );
		$set_type     = sanitize_text_field( $params['set_type'] ?? 'pythagorean' );
		$main_content = sanitize_textarea_field( $params['main_content'] ?? '' );
		$model        = sanitize_text_field( $params['model'] ?? '' );
		$max_tokens   = isset( $params['max_tokens'] ) ? max( 256, min( 8192, (int) $params['max_tokens'] ) ) : 2048;
		$extra_instructions = sanitize_textarea_field( $params['additional_instructions'] ?? '' );

		// Batch: multiple numbers and/or multiple sections.
		$numbers  = is_array( $params['numbers'] ?? null )
			? array_slice( array_map( 'sanitize_text_field', $params['numbers'] ), 0, 5 )
			: ( $number ? [ $number ] : [] );
		$sections = is_array( $params['sections'] ?? null )
			? array_map( 'sanitize_text_field', $params['sections'] )
			: ( $section_name ? [ $section_name ] : [] );

		if ( empty( $numbers ) || empty( $sections ) ) {
			return new WP_Error( 'missing_params', 'number(s) and section_name(s) are required.', [ 'status' => 400 ] );
		}

		$api_key = $this->get_api_key();
		if ( ! $api_key ) {
			return new WP_Error( 'no_api_key', 'OpenRouter API key not configured.', [ 'status' => 500 ] );
		}

		if ( ! $model ) {
			$model = (string) get_option( 'lt_ai_model', 'openai/gpt-4o-mini' );
		}

		// Per-type system prompts.
		$set_type_labels = [
			'pythagorean' => 'Pythagorean numerology',
			'big5'        => 'Big 5 ADN (Aquarian Destiny Numerology)',
			'name_arcana' => 'Name Arcana ADN (Aquarian Destiny Numerology)',
			'core7'       => 'ADN Core 7 (Aquarian Destiny Numerology — includes Money Flow and Relationship channels)',
		];
		$system_label = $set_type_labels[ $set_type ] ?? $set_type;

		$prompt_option_map = [
			'pythagorean' => 'lt_ai_num_def_prompt_pythagorean',
			'name_arcana' => 'lt_ai_num_def_prompt_name_arcana',
			'core7'       => 'lt_ai_num_def_prompt_adm_core7',
		];
		$default_prompts = [
			'pythagorean' => 'You are an expert Pythagorean numerologist and spiritual teacher. Write clear, grounded, insightful definitions that empower the reader. Focus on practical life wisdom and soul growth.',
			'name_arcana' => 'You are an expert in Name Arcana numerology within the Aquarian Destiny Numerology (ADN) system. Write poetic, soul-centred definitions for name number positions. Focus on identity, soul expression, and life integration.',
			'core7'       => 'You are an expert in the Aquarian Destiny Numerology (ADN) Core 7 system. Write definitions for all 7 positions including the Money Flow channel (material abundance, flow, and financial karma) and the Relationship channel (love, intimacy, and relational karma). Write empowering, spiritually rich content.',
		];
		// Pythagorean falls through to the legacy general prompt if not set.
		$option_key    = $prompt_option_map[ $set_type ] ?? null;
		$system_prompt = $option_key ? trim( (string) get_option( $option_key, $default_prompts[ $set_type ] ?? '' ) ) : '';
		if ( ! $system_prompt ) {
			$system_prompt = trim( (string) get_option( 'lt_ai_numerology_system_prompt', 'You are an expert numerologist and spiritual teacher. Write clear, insightful definitions that empower the reader.' ) );
		}
		if ( ! $system_prompt ) {
			$system_prompt = 'You are an expert numerologist and spiritual teacher. Write clear, insightful definitions that empower the reader.';
		}

		// Run generations — one API call per (number × section) combination (sequentially).
		$results = [];
		$errors  = [];

		foreach ( $numbers as $num ) {
			foreach ( $sections as $sec ) {
				$user_prompt = "Write a definition for the number {$num} in {$system_label}, specifically for the \"{$sec}\" position.\n\n";

				if ( $main_content ) {
					$user_prompt .= "Here is the existing general (Main) definition for context:\n\n{$main_content}\n\n";
				}

				if ( $extra_instructions ) {
					$user_prompt .= "Additional instructions: {$extra_instructions}\n\n";
				}

				$user_prompt .= "Return two parts:\n1. A SHORT version (1-2 sentences, for quick display)\n2. A LONG version (2-4 paragraphs, for full reading)\n\nFormat your response EXACTLY as:\n### Short\n[short version here]\n\n### Long\n[long version here]";

				$response = wp_remote_post( 'https://openrouter.ai/api/v1/chat/completions', [
					'timeout' => 90,
					'headers' => [
						'Authorization' => 'Bearer ' . $api_key,
						'Content-Type'  => 'application/json',
						'HTTP-Referer'  => home_url(),
					],
					'body' => wp_json_encode( [
						'model'    => $model,
						'messages' => [
							[ 'role' => 'system', 'content' => $system_prompt ],
							[ 'role' => 'user',   'content' => $user_prompt ],
						],
						'max_tokens' => $max_tokens,
					] ),
				] );

				$log_entry = [
					'timestamp'    => time(),
					'model'        => $model,
					'tokens'       => null,
					'cost'         => null,
					'meta'         => [
						'feature'      => 'num_def_generate',
						'set_type'     => $set_type,
						'number'       => $num,
						'section_name' => $sec,
					],
				];

				if ( is_wp_error( $response ) ) {
					$errors[] = [ 'number' => $num, 'section' => $sec, 'error' => $response->get_error_message() ];
					$log_entry['error']        = $response->get_error_message();
					$log_entry['response_raw'] = '';
					$log_entry['response']     = '';
					$this->append_generation_log( $log_entry );
					continue;
				}

				$body = json_decode( wp_remote_retrieve_body( $response ), true );
				$code = (int) wp_remote_retrieve_response_code( $response );

				$log_entry['tokens']       = $body['usage']['total_tokens'] ?? null;
				$log_entry['response_raw'] = wp_remote_retrieve_body( $response );

				if ( $code !== 200 || empty( $body['choices'][0]['message']['content'] ) ) {
					$msg = $body['error']['message'] ?? 'Unknown error from OpenRouter.';
					$errors[] = [ 'number' => $num, 'section' => $sec, 'error' => $msg ];
					$log_entry['error']    = $msg;
					$log_entry['response'] = '';
					$this->append_generation_log( $log_entry );
					continue;
				}

				$content = trim( $body['choices'][0]['message']['content'] );
				$results[] = [ 'number' => $num, 'section' => $sec, 'content' => $content ];

				$log_entry['response'] = $content;
				$this->append_generation_log( $log_entry );
			}
		}

		// Single result shorthand for backwards compat.
		if ( count( $numbers ) === 1 && count( $sections ) === 1 ) {
			if ( ! empty( $errors ) ) {
				return new WP_Error( 'generation_failed', $errors[0]['error'], [ 'status' => 502 ] );
			}
			return rest_ensure_response( [ 'content' => $results[0]['content'] ] );
		}

		return rest_ensure_response( [ 'results' => $results, 'errors' => $errors ] );
	}

	/**
	 * Append an entry to the generation log (shared with luna-tarot's log).
	 */
	private function append_generation_log( array $entry ): void {
		if ( get_option( 'lt_ai_generation_logging_enabled', '0' ) !== '1' ) {
			return;
		}
		$logs = get_option( 'lt_ai_generation_logs', [] );
		if ( ! is_array( $logs ) ) {
			$logs = [];
		}
		// Cap log at 200 entries.
		if ( count( $logs ) >= 200 ) {
			$logs = array_slice( $logs, -199 );
		}
		$logs[] = $entry;
		update_option( 'lt_ai_generation_logs', $logs, false );
	}
}
