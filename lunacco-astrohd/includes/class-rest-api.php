<?php
/**
 * Luna AstroHD — REST API.
 *
 * Namespace: luna-astrohd/v1
 *
 * Endpoints:
 *   POST /calc-token        — Issue pre-calc credit gate token
 *   POST /charts            — Persist a computed chart (requires token for premium types)
 *   GET  /charts            — List current user's saved charts
 *   GET  /charts/{id}       — Fetch a single saved chart
 *   DELETE /charts/{id}     — Delete a chart
 *   GET  /definitions       — Fetch definitions (optionally filter by section_type, set_id)
 *   PATCH /definitions/{id} — Update a definition (title, short_text, long_text, keywords, extra_meta)
 *   POST /ai-fill           — AI-generate short_text, long_text, keywords for an entry
 *   POST /dashboard-refresh — Trigger user-context widget re-cache (user-owned)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'rest_api_init', 'luna_astrohd_register_rest_routes' );

function luna_astrohd_register_rest_routes(): void {
	$ns = 'luna-astrohd/v1';

	register_rest_route( $ns, '/calc-token', [
		'methods'             => 'POST',
		'callback'            => 'luna_astrohd_rest_calc_token',
		'permission_callback' => '__return_true',
		'args'                => [
			'chart_type'       => [ 'required' => true,  'type' => 'string' ],
			'idempotency_key'  => [ 'required' => false, 'type' => 'string' ],
			'person_id'        => [ 'required' => false ],
			'preset_key'       => [ 'required' => false, 'type' => 'string' ],
		],
	] );

	register_rest_route( $ns, '/entitlements', [
		'methods'             => 'GET',
		'callback'            => 'luna_astrohd_rest_entitlements',
		'permission_callback' => function () { return is_user_logged_in(); },
		'args'                => [
			'person_id' => [ 'required' => false ],
		],
	] );

	register_rest_route( $ns, '/cities', [
		'methods'             => 'GET',
		'callback'            => 'luna_astrohd_rest_cities',
		'permission_callback' => '__return_true',
		'args'                => [
			'q' => [ 'required' => true, 'type' => 'string' ],
		],
	] );

	register_rest_route( $ns, '/charts', [
		[
			'methods'             => 'POST',
			'callback'            => 'luna_astrohd_rest_create_chart',
			'permission_callback' => function () { return is_user_logged_in(); },
		],
		[
			'methods'             => 'GET',
			'callback'            => 'luna_astrohd_rest_list_charts',
			'permission_callback' => function () { return is_user_logged_in(); },
		],
	] );

	register_rest_route( $ns, '/charts/(?P<id>\d+)', [
		[
			'methods'             => 'GET',
			'callback'            => 'luna_astrohd_rest_get_chart',
			'permission_callback' => function () { return is_user_logged_in(); },
		],
		[
			'methods'             => 'DELETE',
			'callback'            => 'luna_astrohd_rest_delete_chart',
			'permission_callback' => function () { return is_user_logged_in(); },
		],
	] );

	register_rest_route( $ns, '/definition-sets', [
		[
			'methods'             => 'GET',
			'callback'            => 'luna_astrohd_rest_list_definition_sets',
			'permission_callback' => function () { return is_user_logged_in(); },
		],
		[
			'methods'             => 'POST',
			'callback'            => 'luna_astrohd_rest_create_definition_set',
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		],
	] );

	register_rest_route( $ns, '/definitions', [
		'methods'             => 'GET',
		'callback'            => 'luna_astrohd_rest_list_definitions',
		'permission_callback' => function () { return is_user_logged_in(); },
	] );

	register_rest_route( $ns, '/definitions/(?P<id>\d+)', [
		'methods'             => 'PATCH',
		'callback'            => 'luna_astrohd_rest_update_definition',
		'permission_callback' => function () { return current_user_can( 'manage_options' ); },
	] );

	register_rest_route( $ns, '/ai-fill', [
		'methods'             => 'POST',
		'callback'            => 'luna_astrohd_rest_ai_fill',
		'permission_callback' => function () { return current_user_can( 'manage_options' ); },
	] );

	register_rest_route( $ns, '/ai-models', [
		'methods'             => 'GET',
		'callback'            => 'luna_astrohd_rest_ai_models',
		'permission_callback' => function () { return current_user_can( 'manage_options' ); },
	] );

	register_rest_route( $ns, '/migrate-set/(?P<id>\d+)', [
		'methods'             => 'POST',
		'callback'            => 'luna_astrohd_rest_migrate_set',
		'permission_callback' => function () { return current_user_can( 'manage_options' ); },
	] );

	register_rest_route( $ns, '/definition-sets/(?P<id>\d+)/set-default', [
		'methods'             => 'POST',
		'callback'            => 'luna_astrohd_rest_set_default_definition_set',
		'permission_callback' => function () { return current_user_can( 'manage_options' ); },
	] );

	register_rest_route( $ns, '/definition-sets/(?P<id>\d+)', [
		[
			'methods'             => 'PATCH',
			'callback'            => 'luna_astrohd_rest_update_definition_set',
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		],
		[
			'methods'             => 'DELETE',
			'callback'            => 'luna_astrohd_rest_delete_definition_set',
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		],
	] );

	register_rest_route( $ns, '/definition-sets/(?P<id>\d+)/export', [
		'methods'             => 'GET',
		'callback'            => 'luna_astrohd_rest_export_definition_set',
		'permission_callback' => function () { return current_user_can( 'manage_options' ); },
	] );

	register_rest_route( $ns, '/definition-sets/import', [
		'methods'             => 'POST',
		'callback'            => 'luna_astrohd_rest_import_definition_set',
		'permission_callback' => function () { return current_user_can( 'manage_options' ); },
	] );

	register_rest_route( $ns, '/core-definition-sets', [
		'methods'             => 'GET',
		'callback'            => 'luna_astrohd_rest_list_core_definition_sets',
		'permission_callback' => function () { return is_user_logged_in(); },
	] );

	register_rest_route( $ns, '/core-migrate-set/(?P<id>\d+)', [
		'methods'             => 'POST',
		'callback'            => 'luna_astrohd_rest_migrate_set_to_core',
		'permission_callback' => function () { return current_user_can( 'manage_options' ); },
	] );

	register_rest_route( $ns, '/definitions/import-manifest', [
		'methods'             => 'POST',
		'callback'            => 'luna_astrohd_rest_import_manifest',
		'permission_callback' => function () { return current_user_can( 'manage_options' ); },
	] );

	register_rest_route( $ns, '/dashboard-refresh', [
		'methods'             => 'POST',
		'callback'            => 'luna_astrohd_rest_dashboard_refresh',
		'permission_callback' => function () { return is_user_logged_in(); },
	] );

	// Selection presets — admin-defined asteroid + planet quick-pick layouts.
	register_rest_route( $ns, '/selection-presets', [
		[
			'methods'             => 'GET',
			'callback'            => 'luna_astrohd_rest_list_selection_presets',
			'permission_callback' => function () { return is_user_logged_in(); },
		],
		[
			'methods'             => 'POST',
			'callback'            => 'luna_astrohd_rest_save_selection_preset',
			'permission_callback' => function () { return current_user_can( 'manage_options' ); },
		],
	] );

	register_rest_route( $ns, '/selection-presets/(?P<key>[a-z0-9\-]+)', [
		'methods'             => 'DELETE',
		'callback'            => 'luna_astrohd_rest_delete_selection_preset',
		'permission_callback' => function () { return current_user_can( 'manage_options' ); },
	] );
}

// ------------------------------------------------------------------
// Selection presets (asteroid + planet quick-pick layouts)
// ------------------------------------------------------------------

const LUNA_ASTROHD_SELECTION_PRESETS_OPTION = 'luna_astrohd_selection_presets';

function luna_astrohd_get_selection_presets(): array {
	$raw = get_option( LUNA_ASTROHD_SELECTION_PRESETS_OPTION, [] );
	return is_array( $raw ) ? array_values( $raw ) : [];
}

function luna_astrohd_rest_list_selection_presets( WP_REST_Request $req ) {
	return rest_ensure_response( luna_astrohd_get_selection_presets() );
}

function luna_astrohd_rest_save_selection_preset( WP_REST_Request $req ) {
	$name = sanitize_text_field( (string) ( $req->get_param( 'name' ) ?? '' ) );
	if ( $name === '' ) {
		return new WP_Error( 'bad_payload', 'A preset name is required.', [ 'status' => 400 ] );
	}
	$key = sanitize_title( (string) ( $req->get_param( 'key' ) ?: $name ) );
	if ( $key === '' ) {
		return new WP_Error( 'bad_payload', 'Could not derive a preset key.', [ 'status' => 400 ] );
	}

	$clean = static function ( $list ) {
		if ( ! is_array( $list ) ) {
			return [];
		}
		$out = array_values( array_filter( array_map( static function ( $v ) {
			return sanitize_text_field( (string) $v );
		}, $list ) ) );
		return array_values( array_unique( $out ) );
	};

	$preset = [
		'key'                => $key,
		'name'               => $name,
		'asteroids'          => $clean( $req->get_param( 'asteroids' ) ),
		'planets_personality'=> $clean( $req->get_param( 'planets_personality' ) ),
		'planets_design'     => $clean( $req->get_param( 'planets_design' ) ),
	];

	$presets = luna_astrohd_get_selection_presets();
	$found   = false;
	foreach ( $presets as $i => $p ) {
		if ( ( $p['key'] ?? '' ) === $key ) {
			$presets[ $i ] = $preset;
			$found = true;
			break;
		}
	}
	if ( ! $found ) {
		$presets[] = $preset;
	}
	update_option( LUNA_ASTROHD_SELECTION_PRESETS_OPTION, $presets, false );

	return rest_ensure_response( [ 'ok' => true, 'preset' => $preset, 'presets' => array_values( $presets ) ] );
}

function luna_astrohd_rest_delete_selection_preset( WP_REST_Request $req ) {
	$key     = sanitize_title( (string) $req->get_param( 'key' ) );
	$presets = luna_astrohd_get_selection_presets();
	$presets = array_values( array_filter( $presets, static function ( $p ) use ( $key ) {
		return ( $p['key'] ?? '' ) !== $key;
	} ) );
	update_option( LUNA_ASTROHD_SELECTION_PRESETS_OPTION, $presets, false );
	return rest_ensure_response( [ 'ok' => true, 'presets' => $presets ] );
}

// ------------------------------------------------------------------
// Handlers
// ------------------------------------------------------------------

function luna_astrohd_rest_calc_token( WP_REST_Request $req ) {
	$chart_type      = sanitize_key( (string) $req->get_param( 'chart_type' ) );
	$idempotency_key = sanitize_text_field( (string) ( $req->get_param( 'idempotency_key' ) ?? wp_generate_uuid4() ) );
	$person_id       = $req->get_param( 'person_id' );
	$person_id       = ( $person_id !== null && $person_id !== '' && $person_id !== 'myself' ) ? (int) $person_id : null;
	$preset_key      = $req->get_param( 'preset_key' );
	$preset_key      = ( $preset_key !== null && $preset_key !== '' ) ? sanitize_key( (string) $preset_key ) : null;
	$user_id         = get_current_user_id();

	$result = Luna_AstroHD_Credit_Gate::issue( $user_id, $chart_type, $idempotency_key, $person_id, $preset_key );

	if ( empty( $result['ok'] ) ) {
		$status = in_array( $result['code'] ?? '', [ 'auth_required' ], true ) ? 401 :
		          ( in_array( $result['code'] ?? '', [ 'chart_disabled', 'unknown_chart_type', 'admin_only' ], true ) ? 403 : 402 );
		return new WP_Error( $result['code'] ?? 'token_error', $result['message'] ?? 'Failed.', [ 'status' => $status ] );
	}

	return rest_ensure_response( $result );
}

function luna_astrohd_rest_entitlements( WP_REST_Request $req ) {
	$user_id   = get_current_user_id();
	$person_id = $req->get_param( 'person_id' );
	$person_id = ( $person_id !== null && $person_id !== '' && $person_id !== 'myself' ) ? (int) $person_id : 0;
	if ( ! function_exists( 'lunacco_core' ) ) {
		return rest_ensure_response( [ 'owned' => [] ] );
	}
	$owned = lunacco_core()->credits()->list_entitlements( $user_id, 'luna-astrohd', $person_id );
	return rest_ensure_response( [ 'owned' => $owned, 'person_id' => $person_id ] );
}

function luna_astrohd_rest_create_chart( WP_REST_Request $req ) {
	$user_id    = get_current_user_id();
	$chart_type = sanitize_key( (string) $req->get_param( 'chart_type' ) );
	$token      = sanitize_text_field( (string) $req->get_param( 'token' ) );
	$title      = sanitize_text_field( (string) ( $req->get_param( 'title' ) ?? '' ) );
	$input      = $req->get_param( 'input_data' );
	$chart_data = $req->get_param( 'chart_data' );
	$is_profile = (int) ( $req->get_param( 'is_profile_chart' ) ?? 0 );
	$person_id  = $req->get_param( 'person_id' );
	$person_id  = ( $person_id !== null && $person_id !== '' && $person_id !== 'myself' ) ? (int) $person_id : null;

	if ( ! is_array( $input ) || ! is_array( $chart_data ) ) {
		return new WP_Error( 'bad_payload', 'input_data and chart_data must be objects.', [ 'status' => 400 ] );
	}

	$settings = luna_astrohd_get_chart_display_settings();
	$row      = $settings[ $chart_type ] ?? null;
	if ( ! $row || empty( $row['enabled'] ) || ( ! empty( $row['admin_only'] ) && ! current_user_can( 'manage_options' ) ) ) {
		return new WP_Error( 'chart_disabled', 'Chart type unavailable.', [ 'status' => 403 ] );
	}

	// Premium types require a valid one-shot token (credits already consumed).
	if ( ! empty( $row['is_premium'] ) && (int) $row['credit_cost'] > 0 ) {
		if ( ! $token || ! Luna_AstroHD_Credit_Gate::redeem( $token, $chart_type, $user_id ) ) {
			return new WP_Error( 'invalid_token', 'Missing or expired calculation token.', [ 'status' => 402 ] );
		}
	}

	global $wpdb;
	$table = $wpdb->prefix . 'lt_astrohd_charts';
	$wpdb->insert( $table, [
		'user_id'          => $user_id,
		'chart_type'       => $chart_type,
		'title'            => $title,
		'person_id'        => $person_id,
		'input_data'       => wp_json_encode( $input ),
		'chart_data'       => wp_json_encode( $chart_data ),
		'is_profile_chart' => $is_profile ? 1 : 0,
		'cost_type'        => ! empty( $row['is_premium'] ) ? 'premium' : 'free',
	] );

	$chart_id = (int) $wpdb->insert_id;

	// If this is a profile chart, sync relevant data to the user's core profile metadata.
	if ( $is_profile && $user_id && function_exists( 'lunacco_core' ) ) {
		$profile_mgr = lunacco_core()->profile();
		$profile     = $profile_mgr->get( $user_id );

		// Sync Identity
		$profile['identity']['birthdate']      = $input['birthdate']      ?? $profile['identity']['birthdate'];
		$profile['identity']['birth_time']     = $input['time']           ?? $profile['identity']['birth_time'];
		$profile['identity']['birth_location'] = $input['location']       ?? $profile['identity']['birth_location'];
		$profile['identity']['birth_lat']      = $input['latitude']       ?? ( $input['lat'] ?? $profile['identity']['birth_lat'] );
		$profile['identity']['birth_lng']      = $input['longitude']      ?? ( $input['lng'] ?? $profile['identity']['birth_lng'] );
		$profile['identity']['birth_timezone'] = $input['timezone']       ?? $profile['identity']['birth_timezone'];

		// Sync Astrology
		$asc_long = null;
		if ( isset( $chart_data['angles']['ascendant'] ) ) {
			$asc_long = $chart_data['angles']['ascendant'];
		} elseif ( isset( $chart_data['birthActivations']['Ascendant']['longitude'] ) ) {
			$asc_long = $chart_data['birthActivations']['Ascendant']['longitude'];
		}

		if ( $asc_long !== null ) {
			$signs = [ 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces' ];
			$profile['astrology']['rising_sign']         = $signs[ floor( $asc_long / 30 ) % 12 ];
			$profile['astrology']['ascendant_longitude'] = (string) $asc_long;
		}

		if ( isset( $chart_data['birthActivations']['Sun']['sign'] ) ) {
			$profile['astrology']['sun_sign'] = $chart_data['birthActivations']['Sun']['sign'];
		}
		if ( isset( $chart_data['birthActivations']['Moon']['sign'] ) ) {
			$profile['astrology']['moon_sign'] = $chart_data['birthActivations']['Moon']['sign'];
		}

		// Sync Human Design
		$profile['human_design']['type']              = $chart_data['type']               ?? $profile['human_design']['type'];
		$profile['human_design']['profile']           = $chart_data['profile']            ?? $profile['human_design']['profile'];
		$profile['human_design']['incarnation_cross'] = $chart_data['incarnationCross']['name'] ?? $profile['human_design']['incarnation_cross'];

		$profile_mgr->save( $user_id, $profile );
	}

	// NOTE: the legacy input-hash cache (Luna_AstroHD_Chart_Cache) was orphaned — it was
	// written here but never read by any load path (the views use the per-person
	// `chart_cache` column instead). Removed to stop accumulating dead rows. The
	// {prefix}lt_astrohd_chart_cache table can be dropped.

	return rest_ensure_response( [ 'id' => $chart_id ] );
}

function luna_astrohd_rest_list_charts( WP_REST_Request $req ) {
	global $wpdb;
	$user_id    = get_current_user_id();
	$person_id  = (int) $req->get_param( 'person_id' );
	$chart_type = sanitize_key( (string) $req->get_param( 'chart_type' ) );
	$table      = $wpdb->prefix . 'lt_astrohd_charts';

	$where  = [ 'user_id=%d' ];
	$params = [ $user_id ];

	if ( $person_id > 0 ) {
		$where[]  = 'person_id=%d';
		$params[] = $person_id;
	}
	if ( $chart_type ) {
		$where[]  = 'chart_type=%s';
		$params[] = $chart_type;
	}

	$fields = "id, chart_type, title, is_profile_chart, cost_type, created_at";
	if ( $person_id > 0 && $chart_type ) {
		$fields .= ", input_data, chart_data";
	}

	$rows = $wpdb->get_results( $wpdb->prepare(
		"SELECT {$fields} FROM {$table} WHERE " . implode( ' AND ', $where ) . " ORDER BY created_at DESC LIMIT 200",
		...$params
	), ARRAY_A );

	foreach ( $rows as &$row ) {
		if ( isset( $row['input_data'] ) ) {
			$row['input_data'] = json_decode( $row['input_data'], true );
		}
		if ( isset( $row['chart_data'] ) ) {
			$row['chart_data'] = json_decode( $row['chart_data'], true );
		}
	}

	return rest_ensure_response( $rows ?: [] );
}

function luna_astrohd_rest_get_chart( WP_REST_Request $req ) {
	global $wpdb;
	$user_id = get_current_user_id();
	$id      = (int) $req['id'];
	$table   = $wpdb->prefix . 'lt_astrohd_charts';
	$row     = $wpdb->get_row( $wpdb->prepare(
		"SELECT * FROM {$table} WHERE id=%d AND user_id=%d",
		$id, $user_id
	), ARRAY_A );
	if ( ! $row ) {
		return new WP_Error( 'not_found', 'Chart not found.', [ 'status' => 404 ] );
	}
	$row['input_data'] = json_decode( $row['input_data'], true );
	$row['chart_data'] = json_decode( $row['chart_data'], true );
	return rest_ensure_response( $row );
}

function luna_astrohd_rest_delete_chart( WP_REST_Request $req ) {
	global $wpdb;
	$user_id = get_current_user_id();
	$id      = (int) $req['id'];
	$table   = $wpdb->prefix . 'lt_astrohd_charts';
	$deleted = $wpdb->delete( $table, [ 'id' => $id, 'user_id' => $user_id ], [ '%d', '%d' ] );
	return rest_ensure_response( [ 'deleted' => (bool) $deleted ] );
}

function luna_astrohd_rest_list_definition_sets( WP_REST_Request $req ) {
	global $wpdb;
	$table = $wpdb->prefix . 'lt_astrohd_definition_sets';

	$table_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) === $table;
	if ( ! $table_exists ) return rest_ensure_response( [] );

	$columns      = $wpdb->get_col( "SHOW COLUMNS FROM `{$table}`" );
	$has_category = in_array( 'category', $columns, true );
	$cat_select   = $has_category ? ', `category`' : ", 'astrohd' AS category";

	$rows = $wpdb->get_results(
		"SELECT id, slug, label, description, system_type{$cat_select}, is_default, is_public, owner_id, created_at FROM `{$table}` ORDER BY is_default DESC, label ASC",
		ARRAY_A
	);
	
	$results = [];
	$found_default = false;
	foreach ( $rows as $row ) {
		$row['id']         = (int) $row['id'];
		$row['is_default'] = (bool) $row['is_default'];
		if ( $row['is_default'] ) {
			if ( $found_default ) $row['is_default'] = false; // Safety: only one true
			$found_default = true;
		}
		$results[] = $row;
	}
	
	return rest_ensure_response( $results );
}

function luna_astrohd_rest_create_definition_set( WP_REST_Request $req ) {
	global $wpdb;
	$label       = sanitize_text_field( (string) ( $req->get_param( 'label' ) ?? '' ) );
	$description = sanitize_textarea_field( (string) ( $req->get_param( 'description' ) ?? '' ) );
	$category    = sanitize_key( (string) ( $req->get_param( 'category' ) ?? 'astrohd' ) );

	if ( ! $label ) {
		return new WP_Error( 'missing_label', 'Label is required.', [ 'status' => 400 ] );
	}

	$allowed_categories = [ 'astrohd', 'human_design', 'astrology' ];
	if ( ! in_array( $category, $allowed_categories, true ) ) {
		$category = 'astrohd';
	}

	$slug  = sanitize_title( $label ) . '-' . wp_generate_uuid4();
	$table = $wpdb->prefix . 'lt_astrohd_definition_sets';
	$wpdb->query( $wpdb->prepare(
		"INSERT INTO `{$table}` (slug, label, description, system_type, category, owner_id, is_default, is_public) VALUES (%s, %s, %s, %s, %s, %d, %d, %d)",
		substr( $slug, 0, 100 ),
		$label,
		$description,
		'hd',
		$category,
		get_current_user_id(),
		0, 0
	) );
	$set_id = (int) $wpdb->insert_id;
	if ( ! $set_id ) {
		return new WP_Error( 'insert_failed', 'Failed to create set.', [ 'status' => 500 ] );
	}

	// Scaffold the new set with empty definitions from the default scaffold.
	$scaffold = luna_astrohd_definition_set_scaffold();
	$table_sections = $wpdb->prefix . 'lt_astrohd_definition_sections';
	foreach ( $scaffold as $section_type => $rows ) {
		// Filter by category
		if ( $category === 'human_design' && strpos( $section_type, 'hd_' ) !== 0 ) continue;
		if ( $category === 'astrology' && strpos( $section_type, 'astro_' ) !== 0 ) continue;

		foreach ( $rows as $row ) {
			$wpdb->insert( $table_sections, [
				'set_id'       => $set_id,
				'section_type' => $section_type,
				'item_key'     => (string) $row['item_key'],
				'title'        => (string) $row['title'],
				'short_text'   => '',
				'long_text'    => '',
			] );
		}
	}

	$created = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id=%d", $set_id ), ARRAY_A );
	return rest_ensure_response( $created );
}

function luna_astrohd_rest_update_definition_set( WP_REST_Request $req ) {
	global $wpdb;
	$id    = (int) $req['id'];
	$table = $wpdb->prefix . 'lt_astrohd_definition_sets';
	$label = $req->get_param( 'label' );

	if ( $label ) {
		$wpdb->update( $table, [ 'label' => sanitize_text_field( $label ) ], [ 'id' => $id ] );
	}
	return rest_ensure_response( [ 'success' => true ] );
}

function luna_astrohd_rest_delete_definition_set( WP_REST_Request $req ) {
	$id = (int) $req['id'];
	if ( ! $id ) return new WP_Error( 'bad_id', 'Invalid ID', [ 'status' => 400 ] );
	
	Luna_AstroHD_Definition_Manager::delete_set( $id );
	return rest_ensure_response( [ 'success' => true ] );
}

function luna_astrohd_rest_update_definition( WP_REST_Request $req ) {
	global $wpdb;
	$id    = (int) $req['id'];
	$table = $wpdb->prefix . 'lt_astrohd_definition_sections';

	$data = [];
	foreach ( [ 'title', 'short_text', 'long_text', 'keywords' ] as $field ) {
		$val = $req->get_param( $field );
		if ( $val !== null ) {
			$data[ $field ] = sanitize_textarea_field( (string) $val );
		}
	}

	// extra_meta: accept as JSON string or object/array
	$extra_meta = $req->get_param( 'extra_meta' );
	if ( $extra_meta !== null ) {
		if ( is_array( $extra_meta ) ) {
			$data['extra_meta'] = wp_json_encode( $extra_meta );
		} elseif ( is_string( $extra_meta ) ) {
			$decoded = json_decode( $extra_meta, true );
			$data['extra_meta'] = $decoded !== null ? wp_json_encode( $decoded ) : $extra_meta;
		}
	}

	if ( empty( $data ) ) {
		return new WP_Error( 'no_data', 'No fields to update.', [ 'status' => 400 ] );
	}

	$updated = $wpdb->update( $table, $data, [ 'id' => $id ] );
	if ( false === $updated ) {
		return new WP_Error( 'update_failed', 'Database update failed.', [ 'status' => 500 ] );
	}

	$row = $wpdb->get_row( $wpdb->prepare(
		"SELECT id, section_type, item_key, title, short_text, long_text, keywords, extra_meta FROM {$table} WHERE id=%d",
		$id
	), ARRAY_A );
	if ( $row && $row['extra_meta'] ) {
		$row['extra_meta'] = json_decode( $row['extra_meta'], true );
	}
	return rest_ensure_response( $row ?: [] );
}

function luna_astrohd_rest_list_definitions( WP_REST_Request $req ) {
	if ( class_exists( 'LunaCco_Definition_Engine' ) && function_exists( 'lunacco_core' ) ) {
		$core_set_id   = (int) ( $req->get_param( 'core_set_id' ) ?? 0 );
		if ( $core_set_id > 0 ) {
			return rest_ensure_response( lunacco_core()->definitions()->project_astrohd_set( $core_set_id ) );
		}
		$active_core_set = lunacco_core()->definitions()->get_active_set_for_module( 'luna-astrohd' );
		if ( ! empty( $active_core_set['id'] ) ) {
			return rest_ensure_response( lunacco_core()->definitions()->project_astrohd_set( (int) $active_core_set['id'] ) );
		}
	}

	return rest_ensure_response( [] );
}

/**
 * POST /ai-fill
 *
 * Uses the site's configured OpenRouter API key (option: luna_astrohd_openrouter_key)
 * to generate short_text, long_text, and keywords for a definition entry.
 * Also auto-generates Defined/Undefined for centers and Fixed/Mutable/Cardinal for profiles.
 *
 * Params: section_type, title, context (optional), model_id (optional)
 */
/**
 * Get the OpenRouter API key from lunacco-core's encrypted storage.
 */
function luna_astrohd_get_openrouter_key(): string {
	if ( class_exists( 'LunaCco_AI_Config' ) ) {
		return ( new LunaCco_AI_Config() )->get_api_key();
	}
	// Fallback: try legacy plain option
	return trim( (string) get_option( 'lt_openrouter_key', '' ) );
}

function luna_astrohd_rest_ai_models(): WP_REST_Response|WP_Error {
	$api_key = luna_astrohd_get_openrouter_key();
	if ( ! $api_key ) {
		return rest_ensure_response( [] );
	}
	$response = wp_remote_get( 'https://openrouter.ai/api/v1/models', [
		'timeout' => 15,
		'headers' => [
			'Authorization' => 'Bearer ' . $api_key,
		],
	] );
	if ( is_wp_error( $response ) ) {
		return rest_ensure_response( [] );
	}
	$body = json_decode( wp_remote_retrieve_body( $response ), true );
	$models = array_map( fn( $m ) => [ 'id' => $m['id'], 'name' => $m['name'] ?? $m['id'] ], $body['data'] ?? [] );
	return rest_ensure_response( $models );
}

function luna_astrohd_rest_ai_fill( WP_REST_Request $req ) {
	$section_type = sanitize_key( (string) ( $req->get_param( 'section_type' ) ?? '' ) );
	$title        = sanitize_text_field( (string) ( $req->get_param( 'title' ) ?? '' ) );
	$context      = sanitize_textarea_field( (string) ( $req->get_param( 'context' ) ?? '' ) );
	$model_id     = sanitize_text_field( (string) ( $req->get_param( 'model_id' ) ?? '' ) );

	if ( ! $section_type || ! $title ) {
		return new WP_Error( 'missing_params', 'section_type and title are required.', [ 'status' => 400 ] );
	}

	$api_key = luna_astrohd_get_openrouter_key();
	if ( ! $api_key ) {
		return new WP_Error( 'no_api_key', 'OpenRouter API key not configured in LunaCco Core AI settings.', [ 'status' => 503 ] );
	}

	if ( ! $model_id ) {
		$model_id = get_option( 'lt_ai_model', 'openai/gpt-4o-mini' );
	}

	$fields = [
		'Short', 'Long', 'What It Is', 'The Gift', 'The Shadow', 
		'How to Work With It', 'Coaching Questions', 'For Client', 
		'Affirmations', 'EFT Script', 'Acupressure Point', 
		'Correspondence', 'Free Video URL', 'Premium Video URL', 'Keywords'
	];

	$system_label = luna_astrohd_section_type_label( $section_type );
	$prompt = "You are an expert in {$system_label}. Write clear, accurate, client-friendly interpretations.\n\n";
	$prompt .= "Entry: {$title}\n";
	if ( $context ) {
		$prompt .= "Additional context: {$context}\n";
	}
	$prompt .= "\nReturn ONLY a markdown document with these sections in order:\n";
	foreach ( $fields as $f ) {
		$prompt .= "## {$f}\n";
	}
	$prompt .= "\nNo preamble, no extra headings.";

	$response = wp_remote_post( 'https://openrouter.ai/api/v1/chat/completions', [
		'timeout' => 60,
		'headers' => [
			'Authorization' => 'Bearer ' . $api_key,
			'Content-Type'  => 'application/json',
			'HTTP-Referer'  => get_site_url(),
		],
		'body' => wp_json_encode( [
			'model'    => $model_id,
			'messages' => [ [ 'role' => 'user', 'content' => $prompt ] ],
		] ),
	] );

	if ( is_wp_error( $response ) ) {
		return new WP_Error( 'api_error', $response->get_error_message(), [ 'status' => 502 ] );
	}

	$body = json_decode( wp_remote_retrieve_body( $response ), true );
	$content = $body['choices'][0]['message']['content'] ?? '';

	if ( ! $content ) {
		return new WP_Error( 'empty_response', 'AI returned no content.', [ 'status' => 502 ] );
	}

	// Parse ## Section blocks
	$parsed  = [];
	$current = null;
	$buffer  = [];
	foreach ( explode( "\n", $content ) as $line ) {
		if ( preg_match( '/^##\s+(.+)$/', $line, $m ) ) {
			if ( $current !== null ) {
				$parsed[ strtolower( trim( $current ) ) ] = trim( implode( "\n", $buffer ) );
			}
			$current = $m[1];
			$buffer  = [];
		} else {
			$buffer[] = $line;
		}
	}
	if ( $current !== null ) {
		$parsed[ strtolower( trim( $current ) ) ] = trim( implode( "\n", $buffer ) );
	}

	return rest_ensure_response( [
		'content'      => $content,
		'short_text'   => $parsed['short'] ?? '',
		'long_text'    => $parsed['long']  ?? '',
		'keywords'     => $parsed['keywords'] ?? '',
		'extra'        => array_diff_key( $parsed, array_flip( [ 'short', 'long', 'keywords' ] ) ),
		'model'        => $body['model'] ?? $model_id,
		'usage'        => $body['usage'] ?? null,
	] );
}

function luna_astrohd_section_type_label( string $section_type ): string {
	$map = [
		'hd_gates'            => 'Human Design (Gene Keys / I Ching gates)',
		'hd_channels'         => 'Human Design channels',
		'hd_centers'          => 'Human Design energy centers',
		'hd_types'            => 'Human Design types',
		'hd_authorities'      => 'Human Design inner authority',
		'hd_profiles'         => 'Human Design profiles',
		'hd_lines'            => 'Human Design lines',
		'hd_incarnation_crosses' => 'Human Design incarnation crosses',
		'hd_variables'        => 'Human Design variable arrows (Digestion / Perspective / Environment / Motivation)',
		'hd_circuitry'        => 'Human Design circuitry',
		'hd_definition_types' => 'Human Design definition types',
		'hd_destiny_points'   => 'Human Design destiny points (Life Purpose / Soul Purpose)',
		'hd_planets'          => 'Human Design planetary activations',
		'hd_angles_points'    => 'Human Design chart angles',
		'astro_planets'       => 'Western astrology planets',
		'astro_signs'         => 'Western astrology signs',
		'astro_houses'        => 'Western astrology houses',
		'astro_aspects'       => 'Western astrology aspects',
		'astro_angles_points' => 'Western astrology chart angles and points',
		'astro_elements'      => 'Western astrology elements',
		'astro_modalities'    => 'Western astrology modalities',
	];
	return $map[ $section_type ] ?? str_replace( [ 'hd_', 'astro_', '_' ], [ 'HD ', 'Astrology ', ' ' ], $section_type );
}

/**
 * POST /migrate-set/{id}
 *
 * Patches an existing definition set to add any sections missing from the current scaffold,
 * renames old variable keys (prl/prr/pel/per → digestion/perspective/environment/motivation),
 * and seeds extra_meta defaults for profiles, variables, centers, hd_planets, hd_angles_points.
 *
 * Safe to run repeatedly (uses INSERT IGNORE / UPDATE WHERE null).
 */
function luna_astrohd_rest_migrate_set( WP_REST_Request $req ) {
	$set_id = (int) $req->get_param( 'id' );
	$res    = Luna_AstroHD_Definition_Manager::migrate_set( $set_id );
	return rest_ensure_response( $res );
}

function luna_astrohd_rest_export_definition_set( WP_REST_Request $req ) {
	$set_id = (int) $req->get_param( 'id' );
	$data   = Luna_AstroHD_Definition_Manager::export_set( $set_id );
	if ( ! $data ) {
		return new WP_Error( 'not_found', 'Set not found.', [ 'status' => 404 ] );
	}
	return rest_ensure_response( $data );
}

function luna_astrohd_rest_import_definition_set( WP_REST_Request $req ) {
	$data = $req->get_json_params();
	if ( empty( $data['set'] ) ) {
		return new WP_Error( 'bad_payload', 'Missing set data.', [ 'status' => 400 ] );
	}
	$new_id = Luna_AstroHD_Definition_Manager::import_set( $data );
	return rest_ensure_response( [ 'id' => $new_id ] );
}

function luna_astrohd_rest_list_core_definition_sets( WP_REST_Request $req ) {
	if ( ! function_exists( 'lunacco_core' ) || ! method_exists( lunacco_core(), 'definitions' ) ) {
		return rest_ensure_response( [] );
	}

	return rest_ensure_response( lunacco_core()->definitions()->list_sets_for_module( 'luna-astrohd' ) );
}

function luna_astrohd_rest_migrate_set_to_core( WP_REST_Request $req ) {
	if ( ! function_exists( 'lunacco_core' ) || ! method_exists( lunacco_core(), 'definitions' ) ) {
		return new WP_Error( 'core_engine_unavailable', 'Core definition engine is not available.', [ 'status' => 503 ] );
	}

	$legacy_set_id = (int) $req->get_param( 'id' );
	$result = lunacco_core()->definitions()->migrate_legacy_astrohd_set( $legacy_set_id );

	return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
}

function luna_astrohd_rest_dashboard_refresh( WP_REST_Request $req ) {
	$user_id = get_current_user_id();
	delete_transient( 'lt_astrohd_dash_' . $user_id );
	return rest_ensure_response( [ 'ok' => true ] );
}

function luna_astrohd_rest_set_default_definition_set( WP_REST_Request $req ) {
	$id = (int) $req['id'];
	if ( ! $id ) return new WP_Error( 'bad_id', 'Invalid ID', [ 'status' => 400 ] );
	
	Luna_AstroHD_Definition_Manager::set_default_set( $id );
	return rest_ensure_response( [ 'success' => true ] );
}

function luna_astrohd_rest_import_manifest( WP_REST_Request $req ) {
	$set_id       = (int) $req->get_param( 'set_id' );
	$section_type = sanitize_key( $req->get_param( 'section_type' ) );
	$markdown     = $req->get_param( 'markdown' );

	if ( ! $set_id || ! $section_type || ! $markdown ) {
		return new WP_Error( 'missing_params', 'Missing set_id, section_type, or markdown.', [ 'status' => 400 ] );
	}

	$result = Luna_AstroHD_Definition_Manager::import_manifest( $set_id, $section_type, $markdown );
	return rest_ensure_response( $result );
}

/**
 * GET /cities — birth-location live search.
 *
 * Reads the bundled assets/worldcities.csv (columns:
 * city, admin_name, country, latitude, longitude) and returns matches for the
 * `q` query. Prefix matches rank first, then substring matches, then the more
 * populous-by-file-order rows. Replaces the old ahd-reader /ahd/v1/cities route.
 *
 * Note: this dataset has no timezone column, so `timezone` is returned empty;
 * callers fall back to the browser timezone until a tz-by-coordinate source is added.
 */
function luna_astrohd_rest_cities( WP_REST_Request $req ) {
	$q = trim( (string) $req->get_param( 'q' ) );
	if ( mb_strlen( $q ) < 2 ) {
		return rest_ensure_response( [] );
	}

	$path = LUNA_ASTROHD_DIR . 'assets/worldcities.csv';
	if ( ! is_readable( $path ) ) {
		return new WP_Error( 'cities_unavailable', 'City dataset not found.', [ 'status' => 503 ] );
	}

	$needle = function_exists( 'mb_strtolower' ) ? mb_strtolower( $q ) : strtolower( $q );
	$limit  = 15;

	$prefix    = [];
	$substring = [];

	$fh = fopen( $path, 'r' );
	if ( false === $fh ) {
		return new WP_Error( 'cities_unavailable', 'Could not open city dataset.', [ 'status' => 503 ] );
	}

	fgetcsv( $fh ); // discard header row
	while ( ( $row = fgetcsv( $fh ) ) !== false ) {
		if ( ! isset( $row[0] ) || '' === $row[0] ) {
			continue;
		}
		$city  = $row[0];
		$lower = function_exists( 'mb_strtolower' ) ? mb_strtolower( $city ) : strtolower( $city );
		$pos   = strpos( $lower, $needle );
		if ( false === $pos ) {
			continue;
		}

		$entry = [
			'city'       => $city,
			'admin_name' => $row[1] ?? '',
			'country'    => $row[2] ?? '',
			'latitude'   => isset( $row[3] ) ? (float) $row[3] : null,
			'longitude'  => isset( $row[4] ) ? (float) $row[4] : null,
			'timezone'   => '',
		];

		if ( 0 === $pos ) {
			$prefix[] = $entry;
		} else {
			$substring[] = $entry;
		}

		// Stop early once we have plenty of prefix hits (the most relevant).
		if ( count( $prefix ) >= $limit ) {
			break;
		}
	}
	fclose( $fh );

	$results = array_slice( array_merge( $prefix, $substring ), 0, $limit );
	return rest_ensure_response( $results );
}
