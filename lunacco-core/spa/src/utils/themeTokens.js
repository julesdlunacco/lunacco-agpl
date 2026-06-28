/**
 * themeTokens.js
 * 
 * Canonical token schema for the redesign.
 * Defines semantic roles (bg, text, border, brand) that components consume.
 * Supports theme families with paired light/dark modes.
 */

// Flatten a tint over a background to an OPAQUE 6-digit hex. Bodygraph centers
// must be opaque so channels never show through them. `bg` is a #rrggbb hex.
const blendOpaque = (fg, bg, a) => {
  const toRgb = (h) => {
    const s = String(h).replace('#', '');
    const v = s.length === 3 ? s.split('').map(c => c + c).join('') : s.slice(0, 6);
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  };
  const [fr, fg_, fb] = toRgb(fg);
  const [br, bg_, bb] = toRgb(bg);
  const t = Math.max(0, Math.min(1, a));
  const mix = (f, b) => Math.round(f * t + b * (1 - t)).toString(16).padStart(2, '0');
  return `#${mix(fr, br)}${mix(fg_, bg_)}${mix(fb, bb)}`;
};

const createTheme = (family, mode, color, paper, ink, indigo, gold, card, mute, highlight, fontDisplay = 'Cormorant Garamond', fontUI = 'Inter') => ({
  id: `${family}-${mode}`,
  family,
  name: family.charAt(0).toUpperCase() + family.slice(1),
  mode,
  color,
  tokens: {
    '--ink': ink,
    '--ink-soft': mode === 'light' ? `${ink}dd` : `${ink}bb`,
    '--indigo': indigo,
    '--indigo-2': mode === 'light' ? `${indigo}ee` : `${indigo}dd`,
    '--gold': gold,
    '--gold-2': mode === 'light' ? `${gold}ee` : `${gold}dd`,
    '--paper': paper,
    '--paper-2': mode === 'light' ? `${paper}ee` : `${paper}dd`,
    '--paper-3': mode === 'light' ? `${paper}cc` : `${paper}cc`,
    '--hair': mode === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)',
    '--hair-2': mode === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
    '--mute': mute,
    '--card': card,
    '--card-2': mode === 'light' ? `${card}ee` : `${card}dd`,
    '--btn-fg': mode === 'light' ? paper : paper,
    '--highlight': highlight,
    '--highlight-bd': `${highlight}aa`,
    '--hd-design': mode === 'light' ? '#a12f2f' : '#e69191',
    '--hd-personality': ink,
    '--hd-active': gold,
    '--hd-gate-circle': mode === 'light' ? paper : 'rgba(255,255,255,0.1)',
    '--hd-gate-text-active': ink,
    '--hd-gate-text-inactive': mute,
    '--hd-variable-arrow': ink,
    // Opaque (blended over paper) so channels never show through the centers.
    '--hd-shadow-center': mode === 'light' ? blendOpaque('#4570af', paper, 0.24) : blendOpaque('#91aae6', paper, 0.28),
    '--hd-shadow-defined-center': mode === 'light' ? blendOpaque('#787882', paper, 0.14) : blendOpaque('#d2d2dc', paper, 0.12),
    '--hd-shadow-conditioning': mode === 'light' ? '#2f9f6b' : '#7bd6a8',
    '--hd-shadow-mental': mode === 'light' ? '#c23b4a' : '#f08a96',
    '--hd-shadow-transpersonal': mode === 'light' ? '#3f7fc0' : '#87b8ef',
    '--hd-shadow-harmonic': mode === 'light' ? '#8c5fbf' : '#c9a2ef',
    // Difficulty / popularity coding (charts + spreads filtering & recommendations).
    '--level-beginner':     mode === 'light' ? '#2f8b57' : '#7bd6a8',
    '--level-intermediate': indigo,
    '--level-advanced':     mode === 'light' ? '#c0563a' : '#e6a08a',
    '--popular':            gold,
    '--astro-fire': '#f87171',
    '--astro-earth': '#86efac',
    '--astro-air': '#7dd3fc',
    '--astro-water': '#a5b4fc',
    '--astro-wheel-bg': mode === 'light' ? paper : '#0d0d1a',
    '--astro-wheel-stroke': mode === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.18)',
    '--astro-wheel-accent': indigo,
    '--astro-icon-filter': mode === 'light' ? 'none' : 'invert(1) brightness(1.6)',
    '--font-display-id': fontDisplay,
    '--font-ui-id': fontUI,
    '--font-display-scale': '1.0',
    '--font-ui-scale': '1.0',
  }
});

// Refined color palettes
export const THEME_FAMILIES = {
  // LAVENDER
  'lavender-light': createTheme('lavender', 'light', '#3a2f8f', '#f2ecff', '#1b1830', '#3a2f8f', '#8a6bd1', '#faf6ff', '#6b63a1', '#ded1f7'),
  'lavender-dark':  createTheme('lavender', 'dark',  '#3a2f8f', '#141022', '#f4efff', '#c9b8ff', '#fbbf24', '#1c1630', '#8d82b8', 'rgba(251,191,36,0.14)'),

  // PLUM
  'plum-light': createTheme('plum', 'light', '#8b3a5a', '#fff0f5', '#2d1b24', '#8b3a5a', '#d16b8a', '#fffafc', '#a1637b', '#f7d1de'),
  'plum-dark':  createTheme('plum', 'dark',  '#8b3a5a', '#1a0a0f', '#fcebf1', '#e691b0', '#fbbf24', '#26131a', '#b88296', 'rgba(230,145,176,0.14)'),

  // RUBY
  'ruby-light': createTheme('ruby', 'light', '#a12f2f', '#fff0f0', '#301818', '#a12f2f', '#d16b6b', '#fffafa', '#a16363', '#f7d1d1'),
  'ruby-dark':  createTheme('ruby', 'dark',  '#a12f2f', '#1a0a0a', '#fcebeb', '#e69191', '#fbbf24', '#261313', '#b88282', 'rgba(230,145,145,0.14)'),

  // NAVY
  'navy-light': createTheme('navy', 'light', '#2f4ba1', '#f0f4ff', '#181c30', '#2f4ba1', '#6b82d1', '#fafbff', '#6371a1', '#d1dbf7'),
  'navy-dark':  createTheme('navy', 'dark',  '#2f4ba1', '#0a0c1a', '#ebedfc', '#91aae6', '#fbbf24', '#131626', '#828eb8', 'rgba(145,170,230,0.14)'),

  // EMERALD
  'emerald-light': createTheme('emerald', 'light', '#2f8b57', '#f0fff4', '#183021', '#2f8b57', '#6bd197', '#fafffb', '#63a17b', '#d1f7df'),
  'emerald-dark':  createTheme('emerald', 'dark',  '#2f8b57', '#0a1a0f', '#ebfcf1', '#91e6b0', '#fbbf24', '#13261a', '#82b896', 'rgba(145,230,176,0.14)'),

  // CORAL
  'coral-light': createTheme('coral', 'light', '#a15a2f', '#fff5f0', '#302118', '#a15a2f', '#d1976b', '#fffafb', '#a17b63', '#f7dfd1'),
  'coral-dark':  createTheme('coral', 'dark',  '#a15a2f', '#1a110a', '#fcf1eb', '#e6b091', '#fbbf24', '#261a13', '#b89682', 'rgba(230,176,145,0.14)'),
};

export const DEFAULT_THEME_ID = 'lavender-light';

export const SEMANTIC_MAP = {
  bgApp: 'var(--paper)',
  bgSurface: 'var(--card)',
  bgSurfaceHover: 'var(--card-2)',
  textPrimary: 'var(--ink)',
  textSecondary: 'var(--ink-soft)',
  textMuted: 'var(--mute)',
  brandPrimary: 'var(--indigo)',
  brandAccent: 'var(--gold)',
  borderSubtle: 'var(--hair)',
  borderStrong: 'var(--ink)',
  buttonFg: 'var(--btn-fg)',
  highlight: 'var(--highlight)',
  highlightBorder: 'var(--highlight-bd)',
};

export const SHAPE_TOKENS = {
  '--radius-card': '0px',
  '--radius-button': '0px',
  '--radius-input': '0px',
};

export const FONT_CATALOG = {
  google: [
    { id: 'Cormorant Garamond', name: 'Cormorant Garamond', type: 'serif', category: 'display' },
    { id: 'Inter', name: 'Inter', type: 'sans', category: 'ui' },
    { id: 'JetBrains Mono', name: 'JetBrains Mono', type: 'mono', category: 'mono' },
    { id: 'Playfair Display', name: 'Playfair Display', type: 'serif', category: 'display' },
    { id: 'Lora', name: 'Lora', type: 'serif', category: 'display' },
    { id: 'Montserrat', name: 'Montserrat', type: 'sans', category: 'ui' },
    { id: 'Open Sans', name: 'Open Sans', type: 'sans', category: 'ui' },
    { id: 'Roboto', name: 'Roboto', type: 'sans', category: 'ui' },
    { id: 'Source Code Pro', name: 'Source Code Pro', type: 'mono', category: 'mono' },
    { id: 'Outfit', name: 'Outfit', type: 'sans', category: 'ui' },
    { id: 'Cinzel', name: 'Cinzel', type: 'serif', category: 'display' },
  ],
  local: [
    { id: 'BloodRitual', name: 'Blood Ritual', type: 'display', file: 'BloodRitual.otf' },
    { id: 'CoffeeStains', name: 'Coffee Stains', type: 'display', file: 'CoffeeStains.otf' },
    { id: 'ColdBrewMe', name: 'Cold Brew Me', type: 'display', file: 'ColdBrewMe.otf' },
    { id: 'CrispBrewSans', name: 'Crisp Brew Sans', type: 'sans', file: 'CrispBrewSans.otf', bold: 'CrispBrewSans-Bold.otf', medium: 'CrispBrewSans-Medium.otf' },
    { id: 'StorylineSerif', name: 'Storyline Serif', type: 'serif', file: 'StorylineSerif.otf', bold: 'StorylineSerif-Bold.otf', italic: 'StorylineSerif-Italic.otf' },
    { id: 'MidnightBold', name: 'Midnight Bold', type: 'display', file: 'MidnightBold_Full.otf' },
    { id: 'MochaModerne', name: 'Mocha Moderne', type: 'sans', file: 'MochaModerne.otf', bold: 'MochaModerne-Bold.otf' },
    { id: 'TypeOfDuke', name: 'Type Of Duke', type: 'display', file: 'TypeOfDuke-Regular.otf', bold: 'TypeOfDuke-Bold.otf' },
    { id: 'LunaNotes', name: 'Luna Notes', type: 'handwriting', file: 'LunaNotes.otf' },
    { id: 'SeraphNotes', name: 'Seraph Notes', type: 'handwriting', file: 'SeraphNotes.otf', bold: 'SeraphNotes-Bold.otf' },
    { id: 'CursedCrush', name: 'Cursed Crush', type: 'display', file: 'CursedCrush.otf' },
    { id: 'EiraSuccess', name: 'Eira Success', type: 'serif', file: 'EiraSuccess.otf' },
    { id: 'FaerywoodManuscript', name: 'Faerywood Manuscript', type: 'display', file: 'FaerywoodManuscript.otf' },
    { id: 'GhostlightSans', name: 'Ghostlight Sans', type: 'sans', file: 'GhostlightSans.otf', bold: 'GhostlightSans-Bold.otf' },
    { id: 'InfernalGrimoire', name: 'Infernal Grimoire', type: 'display', file: 'InfernalGrimoire.otf' },
    { id: 'OpenDyslexic', name: 'Open Dyslexic', type: 'sans', file: 'OpenDyslexic-Regular.otf', bold: 'OpenDyslexic-Bold.otf', italic: 'OpenDyslexic-Italic.otf' },
    { id: 'SeraphaAntiquaCond', name: 'Serapha Antiqua Cond', type: 'serif', file: 'SeraphaAntiquaCond.otf', italic: 'SeraphaAntiquaCond-Italic.otf' },
    { id: 'SeraphaAntiquaReg', name: 'Serapha Antiqua Reg', type: 'serif', file: 'SeraphaAntiquaReg.otf', italic: 'SeraphaAntiquaReg-Italic.otf' },
    { id: 'ShadowDiary', name: 'Shadow Diary', type: 'display', file: 'ShadowDiary.otf' },
    { id: 'VeiledSerif', name: 'Veiled Serif', type: 'serif', file: 'VeiledSerif.otf' },
    { id: 'WhisperMyName', name: 'Whisper My Name', type: 'handwriting', file: 'WhisperMyName.otf' },
  ]
};
