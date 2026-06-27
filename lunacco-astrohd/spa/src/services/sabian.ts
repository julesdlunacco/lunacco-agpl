/**
 * sabian.ts
 *
 * Maps an ecliptic longitude to its Sabian symbol address.
 *
 * Sabian symbols are 1-indexed *within each sign*: the very first degree of a
 * sign (0°00′–0°59′) is "degree 1", the second degree is "degree 2", and so on
 * up to "degree 30". So the rule is `floor(longitude mod 30) + 1`.
 *
 *   0°00′ Leo  -> { sign: 'leo', degree: 1 }
 *   14°20′ Leo -> { sign: 'leo', degree: 15 }
 *   29°50′ Leo -> { sign: 'leo', degree: 30 }
 *
 * The core Definition Engine stores Sabian entities per sign section, keyed
 * `sabian_{sign}` with entity_key `degree-{n}`. See toSabianEntityRef().
 */

const SIGN_KEYS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

const SIGN_LABELS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

export interface SabianAddress {
  /** Lowercase sign key, e.g. 'leo'. */
  sign: string;
  /** Display label, e.g. 'Leo'. */
  signLabel: string;
  /** 1-indexed degree within the sign (1..30). */
  degree: number;
}

/** Normalize any longitude into the [0, 360) range. */
function normalizeLongitude(longitude: number): number {
  return ((longitude % 360) + 360) % 360;
}

/** Convert an ecliptic longitude into its Sabian sign + 1-indexed degree. */
export function toSabian(longitude: number): SabianAddress {
  const lon = normalizeLongitude(longitude);
  const signIndex = Math.floor(lon / 30);
  const degree = Math.floor(lon % 30) + 1; // 1-indexed within the sign
  return {
    sign: SIGN_KEYS[signIndex],
    signLabel: SIGN_LABELS[signIndex],
    degree,
  };
}

/**
 * Build the core entity reference for the Sabian symbol at a longitude, e.g.
 * `luna-astrohd:sabian_leo:degree-15`. Pass to resolveCoreDefinition's
 * `active_entities` so the Sabian definition resolves like any other entity.
 */
export function toSabianEntityRef(longitude: number, moduleId: string = 'luna-astrohd'): string {
  const { sign, degree } = toSabian(longitude);
  return `${moduleId}:sabian_${sign}:degree-${degree}`;
}
