/**
 * degreeFormat.ts
 *
 * Shared formatters for astrology zodiac degrees and Human Design gate notation.
 *
 * Two precisions for a zodiac longitude:
 *   - 'compact' →  2°54'              (degree + minute, the historical default)
 *   - 'full'    →  2°54'44.241"       (degree + minute + decimal seconds)
 * Either can optionally append the sign name, e.g. `2°54'44.241" Aquarius`.
 *
 * Gate notation extends the classic `gate.line` (e.g. 31.2) with the deeper HD
 * design figures color / tone / base on demand, e.g. 31.2.4.4.2.
 */

export type DegreeFormat = 'compact' | 'full';

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

/** Zodiac sign name for an absolute ecliptic longitude. */
export function signOfLongitude(longitude: number): string {
  const norm = ((longitude % 360) + 360) % 360;
  return SIGNS[Math.floor(norm / 30) % 12];
}

/**
 * Format an absolute ecliptic longitude as a zodiac position.
 * @param format    'compact' (deg+min) or 'full' (deg+min+decimal seconds)
 * @param withSign  append the sign name (e.g. `… Aquarius`)
 */
export function formatLongitude(
  longitude: number,
  format: DegreeFormat = 'compact',
  withSign = false,
): string {
  const norm = ((longitude % 360) + 360) % 360;
  const inSign = norm % 30;
  const d = Math.floor(inSign);

  let body: string;
  if (format === 'full') {
    const totalSeconds = (inSign - d) * 3600;
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds - m * 60; // keep the fractional part
    body = `${d}°${String(m).padStart(2, '0')}'${s.toFixed(3).padStart(6, '0')}"`;
  } else {
    const m = Math.floor((inSign - d) * 60);
    body = `${d}°${String(m).padStart(2, '0')}'`;
  }

  return withSign ? `${body} ${signOfLongitude(longitude)}` : body;
}

/** Which extra HD figures to append after `gate.line`. */
export interface GateDetail {
  color?: boolean;
  tone?: boolean;
  base?: boolean;
}

/**
 * Build the dotted gate notation (e.g. `31.2`, `31.2.4`, `31.2.4.4.2`).
 * Color/tone/base are appended only when both requested and present; once a
 * figure is omitted the deeper ones are dropped too, so the string never has
 * gaps.
 */
export function formatGateCode(
  act: { gate?: number; line?: number; color?: number; tone?: number; base?: number },
  detail?: GateDetail,
): string {
  const parts: Array<number | undefined> = [act.gate, act.line];
  if (detail?.color && act.color != null) {
    parts.push(act.color);
    if (detail.tone && act.tone != null) {
      parts.push(act.tone);
      if (detail.base && act.base != null) parts.push(act.base);
    }
  }
  return parts.filter((p) => p != null).join('.');
}
