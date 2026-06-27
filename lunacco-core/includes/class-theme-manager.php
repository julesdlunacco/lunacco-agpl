<?php
/**
 * Theme manager — handles custom admin-defined themes and site-wide theme defaults.
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_Theme_Manager {

	private string $option_key = 'lunacco_custom_themes';
	private string $default_theme_key = 'lunacco_site_default_theme';

	/**
	 * Get all custom themes.
	 *
	 * @return array
	 */
	public function get_custom_themes(): array {
		$themes = get_option( $this->option_key, [] );
		return is_array( $themes ) ? $themes : [];
	}

	/**
	 * Save or update a custom theme.
	 *
	 * @param array $theme_data
	 * @return string|WP_Error Theme ID on success.
	 */
	public function save_theme( array $theme_data ) {
		$themes = $this->get_custom_themes();
		
		$id = sanitize_key( $theme_data['id'] ?? '' );
		if ( empty( $id ) ) {
			// Generate ID if missing (for new themes)
			$name = sanitize_text_field( $theme_data['name'] ?? 'New Theme' );
			$id = 'custom-' . sanitize_key( $name ) . '-' . wp_generate_password( 4, false );
		}

		$theme_data['id'] = $id;
		$theme_data['name'] = sanitize_text_field( $theme_data['name'] ?? 'Untitled Theme' );
		$theme_data['mode'] = sanitize_key( $theme_data['mode'] ?? 'light' );
		
		// Sanitize tokens
		if ( isset( $theme_data['tokens'] ) && is_array( $theme_data['tokens'] ) ) {
			foreach ( $theme_data['tokens'] as $key => $val ) {
				$theme_data['tokens'][ sanitize_text_field( $key ) ] = sanitize_text_field( $val );
			}
		}

		$themes[ $id ] = $theme_data;
		update_option( $this->option_key, $themes );

		return $id;
	}

	/**
	 * Delete a custom theme.
	 *
	 * @param string $id
	 * @return bool
	 */
	public function delete_theme( string $id ): bool {
		$themes = $this->get_custom_themes();
		if ( isset( $themes[ $id ] ) ) {
			unset( $themes[ $id ] );
			update_option( $this->option_key, $themes );
			return true;
		}
		return false;
	}

	/**
	 * Get site-wide default theme ID.
	 *
	 * @return string
	 */
	public function get_site_default_theme(): string {
		return (string) get_option( $this->default_theme_key, 'lavender-light' );
	}

	/**
	 * Set site-wide default theme ID.
	 *
	 * @param string $theme_id
	 */
	public function set_site_default_theme( string $theme_id ): void {
		update_option( $this->default_theme_key, sanitize_key( $theme_id ) );
	}

	/**
	 * REST handler: Get themes.
	 */
	public function rest_get_themes( WP_REST_Request $request ) {
		return rest_ensure_response( [
			'custom'  => $this->get_custom_themes(),
			'default' => $this->get_site_default_theme(),
		] );
	}

	/**
	 * REST handler: Save theme.
	 */
	public function rest_save_theme( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		$result = $this->save_theme( $params );
		
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return rest_ensure_response( [
			'success' => true,
			'id'      => $result,
		] );
	}

	/**
	 * REST handler: Delete theme.
	 */
	public function rest_delete_theme( WP_REST_Request $request ) {
		$id = $request->get_param( 'id' );
		$success = $this->delete_theme( $id );
		
		return rest_ensure_response( [
			'success' => $success,
		] );
	}

	/**
	 * REST handler: Set default theme.
	 */
	public function rest_set_default_theme( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		$theme_id = $params['theme_id'] ?? '';
		
		if ( empty( $theme_id ) ) {
			return new WP_Error( 'missing_id', 'Missing theme_id', [ 'status' => 400 ] );
		}

		$this->set_site_default_theme( $theme_id );
		
		return rest_ensure_response( [
			'success' => true,
		] );
	}
}
