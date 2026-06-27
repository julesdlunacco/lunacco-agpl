<?php
/**
 * Default definition-set scaffold for luna-astrohd.
 *
 * Returns the keyed structure used when seeding the initial default set.
 * Each row: { item_key, title } — short_text/long_text/keywords/extra_meta filled via admin UI.
 *
 * extra_meta shape per section type:
 *   hd_centers       — { defined: '', undefined: '' }
 *   hd_variables     — { direction: 'left'|'right', color: 1-6, tone: 1-6, color_name: '', tone_name: '', stream: 'Design'|'Personality' }
 *   hd_profiles      — { line_1_modality: 'fixed'|'mutable'|'cardinal', line_2_modality: 'fixed'|'mutable'|'cardinal' }
 *   hd_planets       — { stream: 'Design'|'Personality'|'Both', hd_role: '', gate_affinity: [] }
 *   hd_angles_points — { hd_significance: '', axis_pair: '', gate_affinity: [] }
 *   astro_planets    — { higher_expression: '', shadow_expression: '', lilith_notes: '' }
 *
 * Variable arrow positions (prl/prr/pel/per renamed):
 *   digestion   — Design (red), top-left;   how you take in food & information
 *   perspective — Personality (black), top-right; your cognitive vantage point
 *   environment — Design (red), bottom-left; ideal physical environment
 *   motivation  — Personality (black), bottom-right; what drives your cognition
 *
 * Profile line modalities:
 *   Lines 1 & 4 = fixed  |  Lines 2 & 5 = mutable  |  Lines 3 & 6 = cardinal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function luna_astrohd_definition_set_scaffold(): array {
	$scaffold = [
		// -- Human Design
		'hd_gates'               => array_map( fn( $n ) => [ 'item_key' => (string) $n, 'title' => "Gate $n" ], range( 1, 64 ) ),
		'hd_channels'            => array_map( fn( $k ) => [ 'item_key' => $k, 'title' => "Channel $k" ], [
			'1-8', '2-14', '3-60', '4-63', '5-15', '6-59', '7-31', '9-52',
			'10-20', '10-34', '10-57', '11-56', '12-22', '13-33', '16-48', '17-62',
			'18-58', '19-49', '20-34', '20-57', '21-45', '23-43', '24-61', '25-51',
			'26-44', '27-50', '28-38', '29-46', '30-41', '32-54', '34-57', '35-36',
			'37-40', '39-55', '42-53', '47-64',
		] ),
		// Centers: split into Defined and Undefined variants (18 items total)
		'hd_centers'             => ( function() {
			$base = [
				'head'         => 'Head',
				'ajna'         => 'Ajna',
				'throat'       => 'Throat',
				'g-center'     => 'G-Center',
				'ego'          => 'Ego',
				'spleen'       => 'Spleen',
				'sacral'       => 'Sacral',
				'solar-plexus' => 'Solar Plexus',
				'root'         => 'Root',
			];
			$out = [];
			foreach ( $base as $key => $label ) {
				$out[] = [ 'item_key' => "{$key}-defined",   'title' => "{$label} (Defined)" ];
				$out[] = [ 'item_key' => "{$key}-undefined", 'title' => "{$label} (Undefined / Open)" ];
			}
			return $out;
		} )(),
		'hd_types'               => [
			[ 'item_key' => 'manifestor',   'title' => 'Manifestor' ],
			[ 'item_key' => 'generator',    'title' => 'Generator' ],
			[ 'item_key' => 'mg',           'title' => 'Manifesting Generator' ],
			[ 'item_key' => 'projector',    'title' => 'Projector' ],
			[ 'item_key' => 'reflector',    'title' => 'Reflector' ],
		],
		'hd_authorities'         => array_map( fn( $k ) => [ 'item_key' => $k, 'title' => ucwords( str_replace( '-', ' ', $k ) ) ], [
			'emotional', 'sacral', 'splenic', 'ego', 'self-projected', 'mental', 'lunar',
		] ),
		// Profiles: 36 variations (12 profiles * 3 modalities)
		'hd_profiles'            => ( function() {
			$profiles = [
				'1/3' => 'Investigator / Martyr',      '1/4' => 'Investigator / Opportunist',
				'2/4' => 'Hermit / Opportunist',       '2/5' => 'Hermit / Heretic',
				'3/5' => 'Martyr / Heretic',           '3/6' => 'Martyr / Role Model',
				'4/6' => 'Opportunist / Role Model',   '4/1' => 'Opportunist / Investigator',
				'5/1' => 'Heretic / Investigator',     '5/2' => 'Heretic / Hermit',
				'6/2' => 'Role Model / Hermit',        '6/3' => 'Role Model / Martyr',
			];
			$out = [];
			foreach ( $profiles as $key => $label ) {
				foreach ( [ 'Fixed', 'Mutable', 'Cardinal' ] as $mod ) {
					$out[] = [
						'item_key' => "{$key}-{$mod}",
						'title'    => "Profile {$key} — {$label} ({$mod})",
					];
				}
			}
			return $out;
		} )(),
		'hd_lines'               => array_map( fn( $n ) => [ 'item_key' => (string) $n, 'title' => "Line $n" ], range( 1, 6 ) ),
		'hd_incarnation_crosses' => ( function() {
			$list = require __DIR__ . '/incarnation-cross-list.php';
			return $list;
		} )(),
		// Variable arrows: the quick "this arrow is about…" snippet. The real meaning
		// lives in hd_variable_colors (the 48 color+direction combos) below.
		'hd_variables'           => [
			[ 'item_key' => 'brain',       'title' => 'Brain / Digestion (Top Left)',  'extra_meta' => [ 'stream' => 'Design',      'position' => 'top-left' ] ],
			[ 'item_key' => 'environment', 'title' => 'Environment (Bottom Left)',      'extra_meta' => [ 'stream' => 'Design',      'position' => 'bottom-left' ] ],
			[ 'item_key' => 'motivation',  'title' => 'Motivation (Top Right)',         'extra_meta' => [ 'stream' => 'Personality', 'position' => 'top-right' ] ],
			[ 'item_key' => 'perspective', 'title' => 'Perspective (Bottom Right)',      'extra_meta' => [ 'stream' => 'Personality', 'position' => 'bottom-right' ] ],
		],
		// Variable tones: the flavor layer. Authored once per side — six Design tones
		// (the two left arrows) and six Personality tones (the two right arrows).
		'hd_variable_tones'      => ( function() {
			$out = [];
			foreach ( [ 'design' => 'Design', 'personality' => 'Personality' ] as $stream_key => $stream ) {
				for ( $t = 1; $t <= 6; $t++ ) {
					$out[] = [
						'item_key'   => "{$stream_key}-t{$t}",
						'title'      => "{$stream} Tone {$t}",
						'extra_meta' => [ 'stream' => $stream, 'tone' => $t ],
					];
				}
			}
			return $out;
		} )(),
		// Variable colors: 48 items (4 arrows * 6 colors * 2 directions) — the meat.
		'hd_variable_colors'     => ( function() {
			$arrows = [
				'brain'       => [ 'name' => 'Brain (Top Left)',       'stream' => 'Design' ],
				'environment' => [ 'name' => 'Environment (Bottom Left)', 'stream' => 'Design' ],
				'motivation'  => [ 'name' => 'Motivation (Top Right)',    'stream' => 'Personality' ],
				'perspective' => [ 'name' => 'Perspective (Bottom Right)', 'stream' => 'Personality' ],
			];
			$colors = [
				'environment' => [ 1 => 'Caves', 2 => 'Markets', 3 => 'Kitchens', 4 => 'Mountains', 5 => 'Valleys', 6 => 'Shores' ],
				'digestion'   => [ 1 => 'Appetite', 2 => 'Taste', 3 => 'Thirst', 4 => 'Touch', 5 => 'Sound', 6 => 'Light' ],
				'motivation'  => [ 1 => 'Fear', 2 => 'Hope', 3 => 'Desire', 4 => 'Need', 5 => 'Guilt', 6 => 'Innocence' ],
				'perspective' => [ 1 => 'Survival', 2 => 'Possibility', 3 => 'Power', 4 => 'Want', 5 => 'Probability', 6 => 'Personal' ],
			];
			// Map bodygraph location to variable type for color names
			$type_map = [
				'brain'       => 'digestion',
				'environment' => 'environment',
				'motivation'  => 'motivation',
				'perspective' => 'perspective',
			];

			$out = [];
			foreach ( $arrows as $arrow_key => $arrow ) {
				$v_type = $type_map[ $arrow_key ];
				for ( $c = 1; $c <= 6; $c++ ) {
					$color_name = $colors[ $v_type ][ $c ] ?? "Color $c";
					foreach ( [ 'Left', 'Right' ] as $dir ) {
						$title = "{$arrow['name']} — {$color_name} ({$dir})";
						$out[] = [
							'item_key'   => "{$arrow_key}-c{$c}-{$dir}",
							'title'      => $title,
							'extra_meta' => [
								'stream'    => $arrow['stream'],
								'direction' => strtolower( $dir ),
								'color'     => $c,
								'color_name' => $color_name,
							],
						];
					}
				}
			}
			return $out;
		} )(),
		'hd_circuitry'           => [
			[ 'item_key' => 'knowing',       'title' => 'Knowing Circuit (Individual)',          'extra_meta' => [ 'group' => 'Individual' ] ],
			[ 'item_key' => 'centering',     'title' => 'Centering Circuit (Individual)',        'extra_meta' => [ 'group' => 'Individual' ] ],
			[ 'item_key' => 'understanding', 'title' => 'Logic / Understanding Circuit (Collective)', 'extra_meta' => [ 'group' => 'Collective' ] ],
			[ 'item_key' => 'sensing',       'title' => 'Abstract / Sensing Circuit (Collective)',   'extra_meta' => [ 'group' => 'Collective' ] ],
			[ 'item_key' => 'defense',       'title' => 'Defense Circuit (Tribal)',              'extra_meta' => [ 'group' => 'Tribal' ] ],
			[ 'item_key' => 'ego',           'title' => 'Ego Circuit (Tribal)',                  'extra_meta' => [ 'group' => 'Tribal' ] ],
			[ 'item_key' => 'integration',   'title' => 'Integration Channels',                  'extra_meta' => [ 'group' => 'Integration' ] ],
		],
		'hd_definition_types'    => array_map( fn( $k ) => [ 'item_key' => $k, 'title' => ucfirst( str_replace( '-', ' ', $k ) ) ], [
			'single', 'split', 'triple-split', 'quad-split', 'no-definition',
		] ),
		'hd_quarters'            => [
			[ 'item_key' => 'initiation',   'title' => 'Quarter of Initiation' ],
			[ 'item_key' => 'civilization', 'title' => 'Quarter of Civilization' ],
			[ 'item_key' => 'duality',      'title' => 'Quarter of Duality' ],
			[ 'item_key' => 'mutation',     'title' => 'Quarter of Mutation' ],
		],
		'hd_strategies'          => [
			[ 'item_key' => 'to-inform',            'title' => 'Strategy: To Inform (Manifestor)' ],
			[ 'item_key' => 'to-respond',           'title' => 'Strategy: To Respond (Generator / MG)' ],
			[ 'item_key' => 'wait-for-invitation',  'title' => 'Strategy: Wait for the Invitation (Projector)' ],
			[ 'item_key' => 'wait-a-lunar-cycle',   'title' => 'Strategy: Wait a Lunar Cycle (Reflector)' ],
		],
		'hd_destiny_points'      => [
			[ 'item_key' => 'life-purpose', 'title' => 'Life Purpose (Personality)', 'extra_meta' => [ 'stream' => 'Personality' ] ],
			[ 'item_key' => 'soul-purpose', 'title' => 'Soul Purpose (Design)', 'extra_meta' => [ 'stream' => 'Design' ] ],
		],
		// HD planets: split into Personality (Conscious) and Design (Unconscious)
		'hd_planets'             => ( function() {
			$base = [
				'sun', 'earth', 'moon', 'north-node', 'south-node',
				'mercury', 'venus', 'mars', 'jupiter', 'saturn',
				'uranus', 'neptune', 'pluto', 'chiron', 'lilith',
			];
			$out = [];
			foreach ( $base as $key ) {
				$label = ucfirst( str_replace( '-', ' ', $key ) );
				$out[] = [ 
					'item_key' => "personality-{$key}", 
					'title' => "{$label} (Personality / Conscious)",
					'extra_meta' => [ 'stream' => 'Personality' ]
				];
				$out[] = [ 
					'item_key' => "design-{$key}", 
					'title' => "{$label} (Design / Unconscious)",
					'extra_meta' => [ 'stream' => 'Design' ]
				];
			}
			return $out;
		} )(),
		// HD chart angles: split into Personality and Design
		'hd_angles_points'       => ( function() {
			$base = [
				'asc'    => 'Ascendant',
				'dc'     => 'Descendant',
				'mc'     => 'Midheaven',
				'ic'     => 'Imum Coeli',
				'vertex' => 'Vertex',
			];
			$out = [];
			foreach ( $base as $key => $label ) {
				$out[] = [ 
					'item_key' => "personality-{$key}", 
					'title' => "{$label} (Personality / Conscious)",
					'extra_meta' => [ 'stream' => 'Personality' ]
				];
				$out[] = [ 
					'item_key' => "design-{$key}", 
					'title' => "{$label} (Design / Unconscious)",
					'extra_meta' => [ 'stream' => 'Design' ]
				];
			}
			return $out;
		} )(),
		// -- Astrology
		// Includes Lilith; HD planets are in hd_planets (separate meanings)
		'astro_planets'          => array_map( fn( $k ) => [ 'item_key' => $k, 'title' => ucfirst( $k ) ], [
			'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
			'uranus', 'neptune', 'pluto', 'chiron', 'north-node', 'south-node', 'lilith',
		] ),
		'astro_signs'            => array_map( fn( $k ) => [ 'item_key' => $k, 'title' => ucfirst( $k ) ], [
			'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
			'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
		] ),
		'astro_houses'           => array_map( fn( $n ) => [ 'item_key' => (string) $n, 'title' => "House $n" ], range( 1, 12 ) ),
		'astro_house_cusps'      => array_map( fn( $n ) => [ 'item_key' => (string) $n, 'title' => "House $n Cusp" ], range( 1, 12 ) ),
		'astro_moon_phases'      => [
			[ 'item_key' => 'new',             'title' => 'New Moon' ],
			[ 'item_key' => 'first-quarter',   'title' => 'First Quarter' ],
			[ 'item_key' => 'waxing-gibbous',  'title' => 'Waxing Gibbous' ],
			[ 'item_key' => 'full',            'title' => 'Full Moon' ],
			[ 'item_key' => 'waning-gibbous',  'title' => 'Waning Gibbous' ],
			[ 'item_key' => 'last-quarter',    'title' => 'Last Quarter' ],
		],
		'astro_aspects'          => array_map( fn( $k ) => [ 'item_key' => $k, 'title' => ucfirst( $k ) ], [
			'conjunction', 'opposition', 'square', 'trine', 'sextile', 'quincunx',
		] ),
		// Astro-context angles (distinct from hd_angles_points)
		'astro_angles_points'    => array_map( fn( $k ) => [ 'item_key' => $k, 'title' => strtoupper( $k ) ], [
			'asc', 'mc', 'dsc', 'ic', 'vertex', 'part-of-fortune',
		] ),
		'astro_elements'         => [
			[ 'item_key' => 'fire',  'title' => 'Fire' ],
			[ 'item_key' => 'earth', 'title' => 'Earth' ],
			[ 'item_key' => 'air',   'title' => 'Air' ],
			[ 'item_key' => 'water', 'title' => 'Water' ],
		],
		'astro_modalities'       => [
			[ 'item_key' => 'cardinal', 'title' => 'Cardinal' ],
			[ 'item_key' => 'fixed',    'title' => 'Fixed' ],
			[ 'item_key' => 'mutable',  'title' => 'Mutable' ],
		],
		'astro_asteroids'        => array_map( fn( $name ) => [ 'item_key' => sanitize_title( $name ), 'title' => $name ], [
			'Ceres', 'Pallas', 'Juno', 'Vesta', 'Pholus',
			'Iris', 'Hygeia', 'Psyche', 'Melpomene', 'Fortuna', 'Themis', 'Urania', 'Pomona', 'Circe', 'Fides',
			'Daphne', 'Isis', 'Echo', 'Niobe', 'Feronia', 'Freia', 'Klio', 'Aurora', 'Hekate', 'Artemis',
			'Felicitas', 'Kassandra', 'Lachesis', 'Liberatrix', 'Nemesis', 'Elektra', 'Abundantia', 'Bertha',
			'Sibylla', 'Eucharis', 'Medea', 'Sophia', 'Tyche', 'Magdalena', 'Gabriella', 'Bona', 'Hades',
			'Fama', 'Hybris', 'Pythia', 'Eros', 'Photographica', 'Damocles', 'Achilles', 'Charis', 'Moira',
			'Pax', 'Raphaela', 'Sphinx', 'Sirene', 'Aesculapia', 'Copia', 'Demeter', 'Pecunia', 'Atlantis',
			'Hypnos', 'Aura', 'Apollo', 'Sisyphus', 'Anubis', 'Horus', 'Lucifer', 'Midas', 'Bacchus', 'Tantalus',
			'Ganesa', 'Merlin', 'Magion', 'Parvati', 'Panacea', 'Makhaon', 'Bounty', 'Glo', 'Wisdom', 'Kafka',
			'Opportunity', 'Angst', 'Kaali', 'Spacewatch', 'Child', 'Sybil', 'Gold', 'Reiki', 'Telephus',
			'Silver', 'Akashi', 'Destinn', 'Mony', 'Chariklo', 'Angel', 'Fast', 'Talent', 'Spirit', 'Opportunity',
			'Hawaii/Lemuria', 'DNA', 'Logos/Persuasia', 'Hermes', 'Sedna', 'Bless', 'Maia', 'Eris', 'Makemake', 'Jobse',
		] ),
		'astro_modifiers'        => [
			[ 'item_key' => 'domicile',                     'title' => 'Domicile' ],
			[ 'item_key' => 'exaltation',                   'title' => 'Exaltation' ],
			[ 'item_key' => 'detriment',                    'title' => 'Detriment' ],
			[ 'item_key' => 'fall',                         'title' => 'Fall' ],
			[ 'item_key' => 'natal_retrograde',             'title' => 'Natal Retrograde' ],
			[ 'item_key' => 'transit_retrograde',           'title' => 'Transit Retrograde' ],
			[ 'item_key' => 'chart_ruler',                  'title' => 'Chart Ruler' ],
			[ 'item_key' => 'house_ruler',                  'title' => 'House Ruler' ],
			[ 'item_key' => 'stellium_sign',                'title' => 'Stellium in Sign' ],
			[ 'item_key' => 'stellium_house',               'title' => 'Stellium in House' ],
			[ 'item_key' => 'stellium_participating_planet', 'title' => 'Stellium Participating Planet' ],
			[ 'item_key' => 'exact_aspect',                 'title' => 'Exact Aspect (0° Orb)' ],
			[ 'item_key' => 'tight_orb',                    'title' => 'Tight Aspect Orb' ],
			[ 'item_key' => 'wide_orb',                     'title' => 'Wide Aspect Orb' ],
		],
		'astro_body_in_sign'     => ( function() {
			$bodies = [ 'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'north-node', 'south-node', 'lilith' ];
			$signs  = [ 'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces' ];
			$out    = [];
			foreach ( $bodies as $body ) {
				foreach ( $signs as $sign ) {
					$body_label = ucfirst( str_replace( '-', ' ', $body ) );
					$sign_label = ucfirst( $sign );
					$out[] = [
						'item_key'   => "{$body}_in_{$sign}",
						'title'      => "{$body_label} in {$sign_label}",
						'extra_meta' => [ 'body' => $body, 'sign' => $sign ]
					];
				}
			}
			return $out;
		} )(),
		'astro_body_in_house'    => ( function() {
			$bodies   = [ 'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'north-node', 'south-node', 'lilith' ];
			$ordinals = [
				1 => '1st', 2 => '2nd', 3 => '3rd', 4 => '4th', 5 => '5th', 6 => '6th',
				7 => '7th', 8 => '8th', 9 => '9th', 10 => '10th', 11 => '11th', 12 => '12th'
			];
			$out      = [];
			foreach ( $bodies as $body ) {
				foreach ( range( 1, 12 ) as $house ) {
					$body_label = ucfirst( str_replace( '-', ' ', $body ) );
					$out[] = [
						'item_key'   => "{$body}_in_house_{$house}",
						'title'      => "{$body_label} in the {$ordinals[$house]} House",
						'extra_meta' => [ 'body' => $body, 'house' => "house_{$house}" ]
					];
				}
			}
			return $out;
		} )(),
		'astro_patterns'         => [
			[ 'item_key' => 'empty_house',          'title' => 'Empty House' ],
			[ 'item_key' => 'stellium_in_house',    'title' => 'Stellium in House' ],
			[ 'item_key' => 'stellium_in_sign',     'title' => 'Stellium in Sign' ],
			[ 'item_key' => 'chart_ruler_in_house', 'title' => 'Chart Ruler in House' ],
			[ 'item_key' => 'unaspected_planet',    'title' => 'Unaspected Planet' ],
			[ 'item_key' => 'out_of_bounds_planet', 'title' => 'Out-of-Bounds Planet' ],
		],
		'astro_chart_patterns'   => [
			[ 'item_key' => 'yod',              'title' => 'Yod' ],
			[ 'item_key' => 't-square',         'title' => 'T-Square' ],
			[ 'item_key' => 'grand-trine',      'title' => 'Grand Trine' ],
			[ 'item_key' => 'grand-cross',      'title' => 'Grand Cross' ],
			[ 'item_key' => 'mystic-rectangle', 'title' => 'Mystic Rectangle' ],
			[ 'item_key' => 'kite',             'title' => 'Kite' ],
			[ 'item_key' => 'cradle',           'title' => 'Cradle' ],
			[ 'item_key' => 'bowl',             'title' => 'Bowl Shape' ],
			[ 'item_key' => 'bucket',           'title' => 'Bucket Shape' ],
			[ 'item_key' => 'bundle',           'title' => 'Bundle Shape' ],
			[ 'item_key' => 'locomotive',       'title' => 'Locomotive Shape' ],
			[ 'item_key' => 'seesaw',           'title' => 'Seesaw Shape' ],
			[ 'item_key' => 'splash',           'title' => 'Splash Shape' ],
			[ 'item_key' => 'splay',            'title' => 'Splay Shape' ],
		],
		// 72 Angels (Shem HaMephorash) — each governs a 5° zodiac segment.
		// Section key 'angel_shem' matches the recognized entity type + baseline entity keys
		// (shem_01..shem_72), so these surface in the "Angels" worksheet group and reuse the
		// pre-seeded angel entities rather than creating duplicates.
		// extra_meta: angel_number, sign, degree_start (inclusive), degree_end (exclusive),
		// hd_gate_primary (closest gate association) — for resolving against natal placements,
		// the big three, and incarnation crosses.
		'angel_shem'             => ( function() {
			$names = [
				'Vehuiah', 'Jeliel', 'Sitael', 'Elemiah', 'Mahasiah', 'Lelahel',
				'Achaiah', 'Cahetel', 'Haziel', 'Aladiah', 'Lauviah', 'Hahaiah',
				'Iezalel', 'Mebahel', 'Hariel', 'Hekamiah', 'Lauviah II', 'Caliel',
				'Leuviah', 'Pahaliah', 'Nelchael', 'Yeiayel', 'Melahel', 'Haheuiah',
				'Nith-Haiah', 'Haaiah', 'Yeratel', 'Seheiah', 'Reiyel', 'Omael',
				'Lecabel', 'Vasariah', 'Yehuiah', 'Lehahiah', 'Chavakhiah', 'Menadel',
				'Aniel', 'Haamiah', 'Rehael', 'Ieiazel', 'Hahahel', 'Mikael',
				'Veuliah', 'Yelahiah', 'Sealiah', 'Ariel', 'Asaliah', 'Mihael',
				'Vehuel', 'Daniel', 'Hahasiah', 'Imamiah', 'Nanael', 'Nithael',
				'Mebahiah', 'Poyel', 'Nemamiah', 'Yeialel', 'Harahel', 'Mitzrael',
				'Umabel', 'Iah-Hel', 'Anauel', 'Mehiel', 'Damabiah', 'Manakel',
				'Eyael', 'Habuhiah', 'Rochel', 'Jabamiah', 'Haiyael', 'Mumiah',
			];
			// Closest HD gate association per angel, in 5° order around the zodiac.
			$gates = [
				25, 17, 21, 51, 42,  3, 27, 24,  2, 23,  8, 20,
				16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33,
				 7,  4, 29, 59, 40, 64, 47,  6, 46, 18, 48, 57,
				32, 50, 28, 44,  1, 43, 14, 34,  9, 26, 11, 10,
				58, 38, 54, 61, 60, 41, 19, 13, 49, 30, 55, 37,
				63, 22, 36, 25, 17, 21, 51, 42,  3, 27, 24,  2,
			];
			$signs = [
				'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
				'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
			];
			$out = [];
			foreach ( $names as $i => $name ) {
				$num        = $i + 1;
				$sign       = $signs[ intdiv( $i, 6 ) ];
				$deg_start  = ( $i % 6 ) * 5;
				$out[] = [
					'item_key'   => sprintf( 'shem_%02d', $num ),
					'title'      => "{$num} — {$name}",
					'extra_meta' => [
						'angel_number'    => $num,
						'sign'            => $sign,
						'degree_start'    => $deg_start,
						'degree_end'      => $deg_start + 5,
						'hd_gate_primary' => $gates[ $i ],
					],
				];
			}
			return $out;
		} )(),
	];

	// Sabian symbols: 12 signs × 30 degrees, each sign its own section for easy editing.
	// The modernized symbol phrase IS the title — baked in here so it pulls straight
	// through to natal/transit chart rendering. The SPA requests these by the
	// `degree-{n}` key (see spa/src/services/sabian.ts → toSabianEntityRef()); the
	// definition engine's resolver maps that to the bare `{n}` key seeded here.
	$sabian_phrases = require __DIR__ . '/sabian-symbols.php';
	$sabian_signs   = [ 'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces' ];
	foreach ( $sabian_signs as $sign ) {
		$scaffold[ 'sabian_' . $sign ] = array_map(
			function ( $n ) use ( $sign, $sabian_phrases ) {
				$phrase = $sabian_phrases[ $sign ][ $n ] ?? '';
				$degree = ucfirst( $sign ) . " {$n}\u{00B0}";
				return [
					'item_key' => (string) $n,
					'title'    => $phrase ? "{$degree} — {$phrase}" : $degree,
				];
			},
			range( 1, 30 )
		);
	}

	return $scaffold;
}
