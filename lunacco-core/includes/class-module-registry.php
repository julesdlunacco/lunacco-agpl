<?php
/**
 * Module registry — modules register their views, nav items, and data endpoints here.
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_Module_Registry {

	/**
	 * Registered modules keyed by module ID.
	 *
	 * Each module entry is an array with these keys:
	 *   name             (string)   Human-readable name.
	 *   version          (string)   Semver.
	 *   views            (string[]) View/hash keys this module handles, e.g. ['home', 'reading'].
	 *   nav_items        (array[])  Navigation items: [key, label, icon, auth_required, order].
	 *   rest_namespace   (string)   WP REST namespace, e.g. 'luna-tarot/v1'.
	 *   localize_callback (callable|null) Returns array of data to merge into LunaCcoData.modules[id].
	 *
	 * @var array<string, array>
	 */
	private array $modules = [];

	/**
	 * Register a module.
	 *
	 * @param string $module_id Unique slug, e.g. 'luna-tarot'.
	 * @param array  $config    Module configuration (see property doc above).
	 */
	public function register( string $module_id, array $config ): void {
		$this->modules[ $module_id ] = wp_parse_args( $config, [
			'name'             => $module_id,
			'version'          => '1.0.0',
			'views'            => [],
			'nav_items'        => [],
			'rest_namespace'   => '',
			'localize_callback' => null,
		] );
	}

	/** @return array<string, array> */
	public function get_all(): array {
		return $this->modules;
	}

	public function get( string $module_id ): ?array {
		return $this->modules[ $module_id ] ?? null;
	}

	/** Returns every view key contributed by all registered modules. */
	public function get_all_view_keys(): array {
		$keys = [];
		foreach ( $this->modules as $module ) {
			$keys = array_merge( $keys, (array) $module['views'] );
		}
		return array_unique( $keys );
	}

	/** Returns merged nav items from all modules, sorted by 'order'. */
	public function get_all_nav_items(): array {
		$items = [];
		foreach ( $this->modules as $module_id => $module ) {
			foreach ( (array) $module['nav_items'] as $item ) {
				$item['module_id'] = $module_id;
				$items[]           = $item;
			}
		}
		usort( $items, fn( $a, $b ) => ( $a['order'] ?? 99 ) <=> ( $b['order'] ?? 99 ) );
		return $items;
	}

	/**
	 * Calls each module's localize_callback and returns a map of
	 * module_id => data array, to be embedded in LunaCcoData.modules.
	 */
	public function get_localize_data(): array {
		$data = [];
		foreach ( $this->modules as $module_id => $module ) {
			$cb = $module['localize_callback'];
			if ( is_callable( $cb ) ) {
				$data[ $module_id ] = (array) call_user_func( $cb );
			}
		}
		return $data;
	}
}
