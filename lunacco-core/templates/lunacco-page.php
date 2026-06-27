<?php
/**
 * Full-page template for the LunaCco SPA.
 *
 * Swap in by class-shortcode-renderer.php via the template_include filter
 * when a page contains [lunacco_app] or [luna_tarot].
 *
 * Mirrors the original luna-tarot/templates/luna-tarot-page.php but updated
 * for the lunacco-core architecture.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Hide admin bar for all users on this page.
add_filter( 'show_admin_bar', '__return_false' );

$app_title = sanitize_text_field( get_option( 'lt_app_header_title', 'Cosmic Oracle' ) );
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title><?php echo esc_html( $app_title ); ?></title>
	<?php wp_head(); ?>
	<style>
		html,
		body {
			margin: 0 !important;
			padding: 0 !important;
			width: 100%;
			height: 100%;
			background-color: #000;
			overflow: hidden;
		}

		#wpadminbar {
			display: none !important;
		}

		/* Prevent theme headers/footers from bleeding in */
		footer,
		header[class*="header"],
		.site-header,
		.site-footer,
		.wp-site-blocks > header,
		.wp-site-blocks > footer {
			display: none !important;
		}

		/* Reset theme container margins */
		.site-main,
		.entry-content,
		.wp-block-group {
			margin: 0 !important;
			padding: 0 !important;
			max-width: 100% !important;
		}

		/* Mount point must fill the viewport */
		#lunacco-app {
			width: 100%;
			height: 100%;
		}
	</style>
</head>
<body <?php body_class( 'lunacco-fullpage' ); ?>>
	<?php echo do_shortcode( '[lunacco_app]' ); ?>
	<?php wp_footer(); ?>
</body>
</html>
