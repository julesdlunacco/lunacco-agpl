<?php
/**
 * Locations system — manages database table, imports GeoNames, and routes lookups.
 *
 * @package LunaCco_Core
 * @license GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LunaCco_Locations {

	/**
	 * Table name for locations.
	 *
	 * @var string
	 */
	private string $table_name;

	/**
	 * Constructor.
	 */
	public function __construct() {
		global $wpdb;
		$this->table_name = $wpdb->prefix . 'lunacco_locations';
	}

	/**
	 * Get the CC BY 4.0 attribution string.
	 *
	 * @return string
	 */
	public static function get_attribution_string(): string {
		return 'This plugin utilizes geographic data sourced from GeoNames, which is licensed under the Creative Commons Attribution 4.0 License. The original database has been modified, filtered, and optimized for location lookup performance.';
	}

	/**
	 * Create/update the database table.
	 *
	 * @return bool
	 */
	public function ensure_table(): bool {
		global $wpdb;

		$charset_collate = $wpdb->get_charset_collate();
		$sql = "CREATE TABLE {$this->table_name} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			country_code char(2) NOT NULL,
			city varchar(180) NOT NULL,
			state varchar(180) NOT NULL DEFAULT '',
			timezone varchar(64) NOT NULL DEFAULT '',
			latitude decimal(9,5) NOT NULL,
			longitude decimal(9,5) NOT NULL,
			population int(10) unsigned NOT NULL DEFAULT 0,
			PRIMARY KEY  (id),
			KEY country_city (country_code, city(24)),
			KEY country_pop (country_code, population)
		) {$charset_collate};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );

		return $this->table_exists();
	}

	/**
	 * Check if table exists.
	 *
	 * @return bool
	 */
	private function table_exists(): bool {
		global $wpdb;
		$found = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $this->table_name ) );
		return $found === $this->table_name;
	}

	/**
	 * Get full list of country codes to names.
	 *
	 * @return array
	 */
	public static function get_countries_map(): array {
		return [
			'AD' => 'Andorra', 'AE' => 'United Arab Emirates', 'AF' => 'Afghanistan', 'AG' => 'Antigua and Barbuda',
			'AI' => 'Anguilla', 'AL' => 'Albania', 'AM' => 'Armenia', 'AO' => 'Angola', 'AQ' => 'Antarctica',
			'AR' => 'Argentina', 'AS' => 'American Samoa', 'AT' => 'Austria', 'AU' => 'Australia', 'AW' => 'Aruba',
			'AX' => 'Åland Islands', 'AZ' => 'Azerbaijan', 'BA' => 'Bosnia and Herzegovina', 'BB' => 'Barbados',
			'BD' => 'Bangladesh', 'BE' => 'Belgium', 'BF' => 'Burkina Faso', 'BG' => 'Bulgaria', 'BH' => 'Bahrain',
			'BI' => 'Burundi', 'BJ' => 'Benin', 'BL' => 'Saint Barthélemy', 'BM' => 'Bermuda', 'BN' => 'Brunei Darussalam',
			'BO' => 'Bolivia', 'BQ' => 'Bonaire, Sint Eustatius and Saba', 'BR' => 'Brazil', 'BS' => 'Bahamas',
			'BT' => 'Bhutan', 'BV' => 'Bouvet Island', 'BW' => 'Botswana', 'BY' => 'Belarus', 'BZ' => 'Belize',
			'CA' => 'Canada', 'CC' => 'Cocos (Keeling) Islands', 'CD' => 'Congo, Democratic Republic', 'CF' => 'Central African Republic',
			'CG' => 'Congo', 'CH' => 'Switzerland', 'CI' => 'Côte d\'Ivoire', 'CK' => 'Cook Islands', 'CL' => 'Chile',
			'CM' => 'Cameroon', 'CN' => 'China', 'CO' => 'Colombia', 'CR' => 'Costa Rica', 'CU' => 'Cuba', 'CV' => 'Cabo Verde',
			'CW' => 'Curaçao', 'CX' => 'Christmas Island', 'CY' => 'Cyprus', 'CZ' => 'Czechia', 'DE' => 'Germany',
			'DJ' => 'Djibouti', 'DK' => 'Denmark', 'DM' => 'Dominica', 'DO' => 'Dominican Republic', 'DZ' => 'Algeria',
			'EC' => 'Ecuador', 'EE' => 'Estonia', 'EG' => 'Egypt', 'EH' => 'Western Sahara', 'ER' => 'Eritrea',
			'ES' => 'Spain', 'ET' => 'Ethiopia', 'FI' => 'Finland', 'FJ' => 'Fiji', 'FK' => 'Falkland Islands',
			'FM' => 'Micronesia', 'FO' => 'Faroe Islands', 'FR' => 'France', 'GA' => 'Gabon', 'GB' => 'United Kingdom',
			'GD' => 'Grenada', 'GE' => 'Georgia', 'GF' => 'French Guiana', 'GG' => 'Guernsey', 'GH' => 'Ghana',
			'GI' => 'Gibraltar', 'GL' => 'Greenland', 'GM' => 'Gambia', 'GN' => 'Guinea', 'GP' => 'Guadeloupe',
			'GQ' => 'Equatorial Guinea', 'GR' => 'Greece', 'GS' => 'South Georgia and South Sandwich Islands', 'GT' => 'Guatemala',
			'GU' => 'Guam', 'GW' => 'Guinea-Bissau', 'GY' => 'Guyana', 'HK' => 'Hong Kong', 'HM' => 'Heard Island and McDonald Islands',
			'HN' => 'Honduras', 'HR' => 'Croatia', 'HT' => 'Haiti', 'HU' => 'Hungary', 'ID' => 'Indonesia',
			'IE' => 'Ireland', 'IL' => 'Israel', 'IM' => 'Isle of Man', 'IN' => 'India', 'IO' => 'British Indian Ocean Territory',
			'IQ' => 'Iraq', 'IR' => 'Iran', 'IS' => 'Iceland', 'IT' => 'Italy', 'JE' => 'Jersey', 'JM' => 'Jamaica',
			'JO' => 'Jordan', 'JP' => 'Japan', 'KE' => 'Kenya', 'KG' => 'Kyrgyzstan', 'KH' => 'Cambodia', 'KI' => 'Kiribati',
			'KM' => 'Comoros', 'KN' => 'Saint Kitts and Nevis', 'KP' => 'North Korea', 'KR' => 'South Korea', 'KW' => 'Kuwait',
			'KY' => 'Cayman Islands', 'KZ' => 'Kazakhstan', 'LA' => 'Lao People\'s Democratic Republic', 'LB' => 'Lebanon',
			'LC' => 'Saint Lucia', 'LI' => 'Liechtenstein', 'LK' => 'Sri Lanka', 'LR' => 'Liberia', 'LS' => 'Lesotho',
			'LT' => 'Lithuania', 'LU' => 'Luxembourg', 'LV' => 'Latvia', 'LY' => 'Libya', 'MA' => 'Morocco', 'MC' => 'Monaco',
			'MD' => 'Moldova', 'ME' => 'Montenegro', 'MF' => 'Saint Martin', 'MG' => 'Madagascar', 'MH' => 'Marshall Islands',
			'MK' => 'North Macedonia', 'ML' => 'Mali', 'MM' => 'Myanmar', 'MN' => 'Mongolia', 'MO' => 'Macao',
			'MP' => 'Northern Mariana Islands', 'MQ' => 'Martinique', 'MR' => 'Mauritania', 'MS' => 'Montserrat',
			'MT' => 'Malta', 'MU' => 'Mauritius', 'MV' => 'Maldives', 'MW' => 'Malawi', 'MX' => 'Mexico', 'MY' => 'Malaysia',
			'MZ' => 'Mozambique', 'NA' => 'Namibia', 'NC' => 'New Caledonia', 'NE' => 'Niger', 'NF' => 'Norfolk Island',
			'NG' => 'Nigeria', 'NI' => 'Nicaragua', 'NL' => 'Netherlands', 'NO' => 'Norway', 'NP' => 'Nepal',
			'NR' => 'Nauru', 'NU' => 'Niue', 'NZ' => 'New Zealand', 'OM' => 'Oman', 'PA' => 'Panama', 'PE' => 'Peru',
			'PF' => 'French Polynesia', 'PG' => 'Papua New Guinea', 'PH' => 'Philippines', 'PK' => 'Pakistan',
			'PL' => 'Poland', 'PM' => 'Saint Pierre and Miquelon', 'PN' => 'Pitcairn', 'PR' => 'Puerto Rico',
			'PS' => 'Palestine', 'PT' => 'Portugal', 'PW' => 'Palau', 'PY' => 'Paraguay', 'QA' => 'Qatar', 'RE' => 'Réunion',
			'RO' => 'Romania', 'RS' => 'Serbia', 'RU' => 'Russian Federation', 'RW' => 'Rwanda', 'SA' => 'Saudi Arabia',
			'SB' => 'Solomon Islands', 'SC' => 'Seychelles', 'SD' => 'Sudan', 'SE' => 'Sweden', 'SG' => 'Singapore',
			'SH' => 'Saint Helena', 'SI' => 'Slovenia', 'SJ' => 'Svalbard and Jan Mayen', 'SK' => 'Slovakia',
			'SL' => 'Sierra Leone', 'SM' => 'San Marino', 'SN' => 'Senegal', 'SO' => 'Somalia', 'SR' => 'Suriname',
			'SS' => 'South Sudan', 'ST' => 'Sao Tome and Principe', 'SV' => 'El Salvador', 'SX' => 'Sint Maarten',
			'SY' => 'Syrian Arab Republic', 'SZ' => 'Eswatini', 'TC' => 'Turks and Caicos Islands', 'TD' => 'Chad',
			'TF' => 'French Southern Territories', 'TG' => 'Togo', 'TH' => 'Thailand', 'TJ' => 'Tajikistan',
			'TK' => 'Tokelau', 'TL' => 'Timor-Leste', 'TM' => 'Turkmenistan', 'TN' => 'Tunisia', 'TO' => 'Tonga',
			'TR' => 'Turkey', 'TT' => 'Trinidad and Tobago', 'TV' => 'Tuvalu', 'TW' => 'Taiwan', 'TZ' => 'Tanzania',
			'UA' => 'Ukraine', 'UG' => 'Uganda', 'UM' => 'United States Minor Outlying Islands', 'US' => 'United States',
			'UY' => 'Uruguay', 'UZ' => 'Uzbekistan', 'VA' => 'Holy See', 'VC' => 'Saint Vincent and the Grenadines',
			'VE' => 'Venezuela', 'VG' => 'Virgin Islands, British', 'VI' => 'Virgin Islands, U.S.', 'VN' => 'Vietnam',
			'VU' => 'Vanuatu', 'WF' => 'Wallis and Futuna', 'WS' => 'Samoa', 'YE' => 'Yemen', 'YT' => 'Mayotte',
			'ZA' => 'South Africa', 'ZM' => 'Zambia', 'ZW' => 'Zimbabwe'
		];
	}

	/**
	 * Get the list of countries actually present in the table.
	 *
	 * @return array Array of [ 'code' => ..., 'name' => ... ]
	 */
	public function get_active_countries(): array {
		global $wpdb;

		if ( ! $this->table_exists() ) {
			return [];
		}

		$codes = $wpdb->get_col( "SELECT DISTINCT country_code FROM {$this->table_name}" );
		if ( empty( $codes ) ) {
			return [];
		}

		$map = self::get_countries_map();
		$countries = [];
		foreach ( $codes as $code ) {
			$code = strtoupper( $code );
			$countries[] = [
				'code' => $code,
				'name' => $map[ $code ] ?? $code,
			];
		}

		// Sort by name.
		usort( $countries, function( $a, $b ) {
			return strcasecmp( $a['name'], $b['name'] );
		} );

		return $countries;
	}

	/**
	 * Search cities in a country by name query.
	 *
	 * @param string $country_code 2-letter country code.
	 * @param string $query        Search query string.
	 * @return array
	 */
	public function search_cities( string $country_code, string $query ): array {
		global $wpdb;

		$country_code = strtoupper( substr( sanitize_key( $country_code ), 0, 2 ) );
		if ( empty( $country_code ) || strlen( $query ) < 2 ) {
			return [];
		}

		if ( ! $this->table_exists() ) {
			return [];
		}

		$like_prefix = $wpdb->esc_like( $query ) . '%';

		// Prefix match first: this is index-usable via KEY country_city
		// (country_code, city) and resolves in ~tens of ms even for large countries.
		// A leading-wildcard substring match cannot use the index and full-scans the
		// whole country (~2-3s for the US), so we only fall back to it below when the
		// prefix returns too few results (e.g. a mid-word query like "york").
		$results = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT city, state, timezone, latitude, longitude, population
				 FROM {$this->table_name}
				 WHERE country_code = %s AND city LIKE %s
				 ORDER BY population DESC
				 LIMIT 15",
				$country_code,
				$like_prefix
			),
			ARRAY_A
		);

		if ( count( (array) $results ) < 5 && strlen( $query ) >= 3 ) {
			$like_anywhere = '%' . $wpdb->esc_like( $query ) . '%';
			$results = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT city, state, timezone, latitude, longitude, population
					 FROM {$this->table_name}
					 WHERE country_code = %s AND city LIKE %s
					 ORDER BY ( city LIKE %s ) DESC, population DESC
					 LIMIT 15",
					$country_code,
					$like_anywhere,
					$like_prefix
				),
				ARRAY_A
			);
		}
		if ( empty( $results ) ) {
			return [];
		}

		$map = self::get_countries_map();
		$country_name = $map[ $country_code ] ?? $country_code;

		return array_map( function( $row ) use ( $country_name ) {
			return [
				'city'       => $row['city'],
				'admin_name' => $row['state'],
				'country'    => $country_name,
				'latitude'   => $row['latitude'],
				'longitude'  => $row['longitude'],
				'timezone'   => $row['timezone'],
			];
		}, $results );
	}

	/**
	 * Decompress the GZIP location file to the temporary plain CSV file.
	 *
	 * @param string $gz_path Source path to locations.csv.gz.
	 * @return array Result message or file details.
	 */
	public function decompress_locations_file( string $gz_path ): array {
		if ( ! file_exists( $gz_path ) ) {
			return [
				'success' => false,
				'message' => 'Gzip file not found: ' . esc_html( basename( $gz_path ) ),
			];
		}

		$upload_dir = wp_upload_dir();
		$dest_dir   = $upload_dir['basedir'] . '/lunacco-locations';
		if ( ! file_exists( $dest_dir ) ) {
			wp_mkdir_p( $dest_dir );
		}

		$dest_file = $dest_dir . '/locations.csv';

		$gz = gzopen( $gz_path, 'rb' );
		if ( ! $gz ) {
			return [
				'success' => false,
				'message' => 'Could not open the gzip file.',
			];
		}

		$out = fopen( $dest_file, 'wb' );
		if ( ! $out ) {
			gzclose( $gz );
			return [
				'success' => false,
				'message' => 'Could not open destination temporary file.',
			];
		}

		// Chunked decompression to avoid memory issues.
		while ( ! gzeof( $gz ) ) {
			$chunk = gzread( $gz, 65536 );
			if ( $chunk === false ) {
				fclose( $out );
				gzclose( $gz );
				return [
					'success' => false,
					'message' => 'Error reading gzip file.',
				];
			}
			fwrite( $out, $chunk );
		}

		fclose( $out );
		gzclose( $gz );

		$total_size = filesize( $dest_file );

		return [
			'success'    => true,
			'total_size' => $total_size,
			'file_path'  => $dest_file,
		];
	}

	/**
	 * Import a chunk of the decompressed locations.csv file.
	 *
	 * @param int $offset     Byte offset in the file.
	 * @param int $total_size Total size of the file.
	 * @return array Progress result.
	 */
	public function import_chunk( int $offset, int $total_size ): array {
		global $wpdb;

		$upload_dir = wp_upload_dir();
		$csv_path   = $upload_dir['basedir'] . '/lunacco-locations/locations.csv';

		if ( ! file_exists( $csv_path ) ) {
			return [
				'success' => false,
				'message' => 'Temporary plain text CSV file not found. Restart import.',
			];
		}

		$handle = fopen( $csv_path, 'r' );
		if ( ! $handle ) {
			return [
				'success' => false,
				'message' => 'Could not open the temporary CSV file.',
			];
		}

		// Ensure table exists.
		$this->ensure_table();

		// Truncate table on starting offset.
		if ( $offset === 0 ) {
			$wpdb->query( "TRUNCATE TABLE {$this->table_name}" );

			// Check and skip header if present.
			$first_line = fgets( $handle );
			if ( strpos( $first_line, 'city|' ) !== 0 ) {
				fseek( $handle, 0 );
			}
		} else {
			fseek( $handle, $offset );
		}

		$max_lines = 5000;
		$line_count = 0;
		$batch = [];
		$placeholders = [];

		while ( $line_count < $max_lines ) {
			$line = fgets( $handle );
			if ( $line === false ) {
				break; // EOF
			}

			$line_count++;
			$parts = explode( '|', trim( $line ) );
			if ( count( $parts ) < 7 ) {
				continue; // Corrupt row
			}

			// city|state|country_code|timezone|latitude|longitude|population
			$city         = sanitize_text_field( $parts[0] );
			$state        = sanitize_text_field( $parts[1] );
			$country_code = strtoupper( substr( sanitize_key( $parts[2] ), 0, 2 ) );
			$timezone     = sanitize_text_field( $parts[3] );
			$latitude     = (float) $parts[4];
			$longitude    = (float) $parts[5];
			$population   = (int) $parts[6];

			if ( empty( $city ) || empty( $country_code ) ) {
				continue;
			}

			$batch[] = $country_code;
			$batch[] = $city;
			$batch[] = $state;
			$batch[] = $timezone;
			$batch[] = $latitude;
			$batch[] = $longitude;
			$batch[] = $population;

			$placeholders[] = '(%s, %s, %s, %s, %f, %f, %d)';

			// Perform insertion in subsets of 1,000 to manage SQL length
			if ( count( $placeholders ) >= 1000 ) {
				$this->execute_insert_batch( $placeholders, $batch );
				$batch = [];
				$placeholders = [];
			}
		}

		// Insert remaining.
		if ( ! empty( $placeholders ) ) {
			$this->execute_insert_batch( $placeholders, $batch );
		}

		$new_offset = ftell( $handle );
		$is_eof = feof( $handle ) || $new_offset >= $total_size;

		fclose( $handle );

		if ( $is_eof ) {
			// Done! Clean up.
			@unlink( $csv_path );

			$row_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$this->table_name}" );

			return [
				'success'   => true,
				'done'      => true,
				'progress'  => 100,
				'row_count' => $row_count,
			];
		}

		$progress = round( ( $new_offset / $total_size ) * 100, 1 );

		return [
			'success'  => true,
			'done'     => false,
			'offset'   => $new_offset,
			'progress' => $progress,
		];
	}

	/**
	 * Execute a batch insert.
	 *
	 * @param array $placeholders Array of query placeholders.
	 * @param array $values       Array of flattened values.
	 */
	private function execute_insert_batch( array $placeholders, array $values ): void {
		global $wpdb;

		$query = "INSERT INTO {$this->table_name} 
			(country_code, city, state, timezone, latitude, longitude, population) 
			VALUES " . implode( ', ', $placeholders );

		$wpdb->query( $wpdb->prepare( $query, $values ) );
	}

	/**
	 * Empty the locations table.
	 */
	public function clear_locations(): bool {
		global $wpdb;
		if ( ! $this->table_exists() ) {
			return false;
		}
		$wpdb->query( "TRUNCATE TABLE {$this->table_name}" );
		return true;
	}

	/**
	 * Get total row count.
	 *
	 * @return int
	 */
	public function get_row_count(): int {
		global $wpdb;
		if ( ! $this->table_exists() ) {
			return 0;
		}
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$this->table_name}" );
	}

	/**
	 * AJAX handler for starting decompression.
	 */
	public function ajax_start_decompress(): void {
		check_ajax_referer( 'lunacco_locations_admin', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized' ] );
		}

		$use_existing = isset( $_POST['use_existing'] ) && $_POST['use_existing'] === 'yes';
		$file_path = '';

		if ( $use_existing ) {
			$file_path = WP_PLUGIN_DIR . '/combined_locations.csv.gz';
		} else {
			if ( empty( $_FILES['locations_file']['tmp_name'] ) ) {
				wp_send_json_error( [ 'message' => 'No file was uploaded.' ] );
			}
			$file_path = $_FILES['locations_file']['tmp_name'];
		}

		$result = $this->decompress_locations_file( $file_path );
		if ( ! $result['success'] ) {
			wp_send_json_error( [ 'message' => $result['message'] ] );
		}

		wp_send_json_success( [
			'total_size' => $result['total_size'],
		] );
	}

	/**
	 * AJAX handler for importing chunk.
	 */
	public function ajax_import_chunk(): void {
		check_ajax_referer( 'lunacco_locations_admin', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized' ] );
		}

		$offset     = isset( $_POST['offset'] ) ? (int) $_POST['offset'] : 0;
		$total_size = isset( $_POST['total_size'] ) ? (int) $_POST['total_size'] : 0;

		if ( $total_size <= 0 ) {
			wp_send_json_error( [ 'message' => 'Invalid total file size.' ] );
		}

		$result = $this->import_chunk( $offset, $total_size );
		if ( ! $result['success'] ) {
			wp_send_json_error( [ 'message' => $result['message'] ] );
		}

		wp_send_json_success( $result );
	}

	/**
	 * AJAX handler for clearing locations.
	 */
	public function ajax_clear(): void {
		check_ajax_referer( 'lunacco_locations_admin', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized' ] );
		}

		$cleared = $this->clear_locations();
		if ( $cleared ) {
			wp_send_json_success( [ 'message' => 'Table truncated successfully.' ] );
		} else {
			wp_send_json_error( [ 'message' => 'Could not truncate table.' ] );
		}
	}
}

