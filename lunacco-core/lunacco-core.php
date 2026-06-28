<?php
/**
 * Plugin Name: LunaCco Core
 * Description: Core SPA shell, authentication, credit system, profiles, AI configuration, and admin pages for the LunaCco platform.
 * Version: 1.1.0
 * Author: LunaCco
 * License: AGPL-3.0-or-later
 * License URI: https://www.gnu.org/licenses/agpl-3.0.html
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LUNACCO_CORE_VERSION', '1.1.0' );
define( 'LUNACCO_CORE_FILE', __FILE__ );
define( 'LUNACCO_CORE_DIR', plugin_dir_path( __FILE__ ) );
define( 'LUNACCO_CORE_URL', plugin_dir_url( __FILE__ ) );

// Autoload all includes.
require_once LUNACCO_CORE_DIR . 'includes/class-promos.php';
require_once LUNACCO_CORE_DIR . 'includes/class-module-registry.php';
require_once LUNACCO_CORE_DIR . 'includes/class-definition-engine.php';
require_once LUNACCO_CORE_DIR . 'includes/class-chart-registry.php';
require_once LUNACCO_CORE_DIR . 'includes/class-credit-ledger.php';
require_once LUNACCO_CORE_DIR . 'includes/class-credit-system.php';
require_once LUNACCO_CORE_DIR . 'includes/class-auth-security.php';
require_once LUNACCO_CORE_DIR . 'includes/class-auth-handler.php';
require_once LUNACCO_CORE_DIR . 'includes/class-user-profile.php';
require_once LUNACCO_CORE_DIR . 'includes/class-ai-config.php';
require_once LUNACCO_CORE_DIR . 'includes/class-fluentcart.php';
require_once LUNACCO_CORE_DIR . 'includes/class-locations.php';
require_once LUNACCO_CORE_DIR . 'includes/class-admin-pages.php';
require_once LUNACCO_CORE_DIR . 'includes/class-rest-api.php';
require_once LUNACCO_CORE_DIR . 'includes/class-theme-manager.php';
require_once LUNACCO_CORE_DIR . 'includes/class-shortcode-renderer.php';
require_once LUNACCO_CORE_DIR . 'includes/class-core-bootstrap.php';

/**
 * Returns the shared LunaCco_Core_Bootstrap instance.
 *
 * @return LunaCco_Core_Bootstrap
 */
function lunacco_core() {
	return LunaCco_Core_Bootstrap::instance();
}

// Boot the plugin.
lunacco_core();
