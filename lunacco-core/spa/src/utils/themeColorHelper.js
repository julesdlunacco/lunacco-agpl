/**
 * themeColorHelper.js
 *
 * Derivation helpers for the Theme Builder. Given a primary brand colour
 * (--indigo) and an accent (--gold), these functions fill out the full token
 * set with sensible, in-family values — matching the ratios the built-in
 * themes (e.g. Navy) are generated from in themeTokens.js. The admin can then
 * tweak any field afterwards; this just gets things in the ballpark and fills
 * the empty slots.
 */

/* ---------- colour math ---------- */

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

// Accepts #rgb / #rrggbb (with optional trailing 2-hex alpha stripped). Returns
// {r,g,b} 0–255, or null if the value isn't a parseable hex colour.
export function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6); // drop alpha pair
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h, s, l) {
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb) : null;
}

// Append an alpha channel to a hex colour as 8-digit hex (#rrggbbaa). The
// Theme Builder only renders hex, so every token the helper emits stays hex.
function alphaHex(hex, a) {
  const { r, g, b } = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
  const aa = Math.round(clamp(a, 0, 1) * 255).toString(16).padStart(2, '0');
  const h2 = x => x.toString(16).padStart(2, '0');
  return `#${h2(r)}${h2(g)}${h2(b)}${aa}`;
}

// Translucent colour (as 8-digit hex) from a hue/sat/light, e.g. for shadow
// centers & highlights.
function hslaHex(h, s, l, a) {
  return alphaHex(hslToHex(h, s, l), a);
}

/* ---------- token derivation ---------- */

// Build the full foundation + element token set from a seed. Mirrors the
// proportions used by createTheme() in themeTokens.js so auto-filled themes sit
// naturally alongside the built-ins.
export function deriveTokens({ indigo, gold, mode = 'light', fontDisplay, fontUI, displayScale, uiScale }) {
  const base = hexToHsl(indigo) || { h: 230, s: 50, l: 40 };
  const h = base.h;
  const light = mode === 'light';

  // Foundation colours keyed off the primary hue.
  const paper     = light ? hslToHex(h, 100, 96.5) : hslToHex(h, 42, 7.5);
  const card      = light ? hslToHex(h, 100, 99)   : hslToHex(h, 33, 12);
  const ink       = light ? hslToHex(h, 32, 14)    : hslToHex(h, 80, 95);
  const mute      = light ? hslToHex(h, 26, 51)    : hslToHex(h, 24, 62);
  const highlight = light
    ? hslToHex(h, 70, 89)
    : hslaHex(h, 60, 73, 0.14);

  return {
    '--ink': ink,
    '--ink-soft': light ? `${ink}dd` : `${ink}bb`,
    '--indigo': indigo,
    '--indigo-2': light ? `${indigo}ee` : `${indigo}dd`,
    '--gold': gold,
    '--gold-2': light ? `${gold}ee` : `${gold}dd`,
    '--paper': paper,
    '--paper-2': light ? `${paper}ee` : `${paper}dd`,
    '--paper-3': `${paper}cc`,
    '--hair': light ? alphaHex('#000000', 0.08) : alphaHex('#ffffff', 0.12),
    '--hair-2': light ? alphaHex('#000000', 0.04) : alphaHex('#ffffff', 0.06),
    '--mute': mute,
    '--card': card,
    '--card-2': light ? `${card}ee` : `${card}dd`,
    '--btn-fg': paper,
    '--highlight': highlight,
    '--highlight-bd': light ? `${highlight}aa` : highlight,
    '--hd-design': light ? '#a12f2f' : '#e69191',
    '--hd-personality': ink,
    '--hd-active': gold,
    '--hd-gate-circle': light ? paper : alphaHex('#ffffff', 0.1),
    '--hd-gate-text-active': ink,
    '--hd-gate-text-inactive': mute,
    '--hd-variable-arrow': ink,
    '--hd-shadow-center': light ? alphaHex('#4570af', 0.24) : alphaHex('#91aae6', 0.28),
    '--hd-shadow-defined-center': light ? alphaHex('#787882', 0.14) : alphaHex('#d2d2dc', 0.12),
    '--hd-shadow-conditioning': light ? '#2f9f6b' : '#7bd6a8',
    '--hd-shadow-mental': light ? '#c23b4a' : '#f08a96',
    '--hd-shadow-transpersonal': light ? '#3f7fc0' : '#87b8ef',
    '--hd-shadow-harmonic': light ? '#8c5fbf' : '#c9a2ef',
    '--level-beginner': light ? '#2f8b57' : '#7bd6a8',
    '--level-intermediate': indigo,
    '--level-advanced': light ? '#c0563a' : '#e6a08a',
    '--popular': gold,
    '--astro-fire': '#f87171',
    '--astro-earth': '#86efac',
    '--astro-air': '#7dd3fc',
    '--astro-water': '#a5b4fc',
    '--astro-wheel-bg': light ? paper : '#0d0d1a',
    '--astro-wheel-stroke': light ? alphaHex('#000000', 0.1) : alphaHex('#ffffff', 0.18),
    '--astro-wheel-accent': indigo,
    '--astro-icon-filter': light ? 'none' : 'invert(1) brightness(1.6)',
    '--font-display-id': fontDisplay || 'Cormorant Garamond',
    '--font-ui-id': fontUI || 'Inter',
    '--font-display-scale': displayScale || '1.0',
    '--font-ui-scale': uiScale || '1.0',
  };
}

// Auto-fill: regenerate the colour/element tokens from the theme's current
// --indigo and --gold, preserving the admin's font choices and scales.
export function autoFillTheme(theme) {
  const t = theme.tokens || {};
  const indigo = (hexToRgb(t['--indigo']) ? t['--indigo'] : '#2f4ba1');
  const gold = t['--gold'] || '#6b82d1';
  return {
    ...theme,
    tokens: deriveTokens({
      indigo,
      gold,
      mode: theme.mode || 'light',
      fontDisplay: t['--font-display-id'],
      fontUI: t['--font-ui-id'],
      displayScale: t['--font-display-scale'],
      uiScale: t['--font-ui-scale'],
    }),
  };
}

// Generate the dark-mode counterpart of a (typically light) theme. The brand
// colours are lightened for legibility on dark surfaces, the rest is derived.
export function generateDarkVariant(theme) {
  const t = theme.tokens || {};
  const indigoHsl = hexToHsl(t['--indigo']) || { h: 230, s: 50, l: 40 };
  const goldHsl = hexToHsl(t['--gold']);
  const indigoDark = hslToHex(indigoHsl.h, clamp(indigoHsl.s, 30, 70), 73);
  // Keep amber-ish accents as-is when already light; otherwise lift them.
  const goldDark = goldHsl && goldHsl.l < 60
    ? hslToHex(goldHsl.h, goldHsl.s, 70)
    : (t['--gold'] || '#fbbf24');

  return {
    ...theme,
    id: '', // new theme — let the server assign an id
    name: `${(theme.name || 'Theme').replace(/\s*\((Light|Dark)\)$/i, '')} (Dark)`,
    mode: 'dark',
    tokens: deriveTokens({
      indigo: indigoDark,
      gold: goldDark,
      mode: 'dark',
      fontDisplay: t['--font-display-id'],
      fontUI: t['--font-ui-id'],
      displayScale: t['--font-display-scale'],
      uiScale: t['--font-ui-scale'],
    }),
  };
}

/* ---------- import / export ---------- */

function triggerDownload(filename, dataStr) {
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const slug = s => String(s || 'theme').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function exportTheme(theme) {
  const payload = { lunaccoThemeExport: 1, version: 1, themes: [theme] };
  triggerDownload(`lunacco-theme-${slug(theme.name || theme.id)}.json`, JSON.stringify(payload, null, 2));
}

export function exportAllThemes(themes) {
  const payload = { lunaccoThemeExport: 1, version: 1, themes };
  triggerDownload(`lunacco-themes-all-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2));
}

// Parse an exported file back into an array of theme objects. Tolerates either
// the wrapped { themes: [...] } form or a bare theme / array of themes.
export function parseThemeImport(json) {
  let data;
  try { data = typeof json === 'string' ? JSON.parse(json) : json; }
  catch { return []; }
  const list = Array.isArray(data) ? data
    : Array.isArray(data?.themes) ? data.themes
    : data?.tokens ? [data]
    : [];
  return list.filter(t => t && t.tokens && typeof t.tokens === 'object');
}
