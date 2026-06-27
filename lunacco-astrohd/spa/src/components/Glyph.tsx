import React from 'react';

/**
 * Glyph — renders a planet or zodiac sign using the bundled SVG assets
 * (NOT emoji/unicode). Mirrors the asset resolution used by AstroWheel so the
 * editorial chrome (interpretation cards, tables, sidebars) shows real glyphs.
 *
 * Astrology-domain only: the asset maps live here, so this is intentionally an
 * astrohd component, not a global core primitive.
 */

function getIconBase(): string {
  const modules = (window as any).LunaCcoData?.modules || {};
  const astro = modules['luna-astrohd'] || {};
  return (
    astro.assets?.zodiacPath ||
    ((window as any).ahdSettings?.pluginUrl
      ? (window as any).ahdSettings.pluginUrl + 'assets/zodiac/'
      : '')
  );
}

const SIGN_ICON_MAP: Record<string, string> = {
  Aries: 'Aries', Taurus: 'Taurus', Gemini: 'Gemini', Cancer: 'Cancer',
  Leo: 'Leo', Virgo: 'Virgo', Libra: 'Libra', Scorpio: 'Scorpio',
  Sagittarius: 'Sagittarius', Capricorn: 'Capricorn', Aquarius: 'Aquarius', Pisces: 'Pisces',
};

const PLANET_ICON_MAP: Record<string, string> = {
  Sun: 'Sun', Earth: 'Earth', Moon: 'Moon', Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars',
  Jupiter: 'Jupiter', Saturn: 'Saturn', Uranus: 'Uranus', Neptune: 'Neptune',
  Pluto: 'Pluto', Chiron: 'Chiron', NorthNode: 'NorthNode', SouthNode: 'SouthNode',
  'Black Moon Lilith': 'BlackMoonLilith', Vulcan: 'Vulcan',
  Ascendant: 'Ascendant', Descendant: 'Descendant', Midheaven: 'Midheaven',
  'Imum Coeli': 'Imuncoeli', Vertex: 'Vertex',
};

/** Short text fallback when the asset base/file isn't available. */
const TEXT_FALLBACK: Record<string, string> = {
  Ascendant: 'ASC', Descendant: 'DSC', Midheaven: 'MC', 'Imum Coeli': 'IC', Vertex: 'VX',
};

interface GlyphProps {
  kind: 'planet' | 'sign';
  name: string;
  /** Pixel size of the glyph box. Default 18. */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export const Glyph: React.FC<GlyphProps> = ({ kind, name, size = 18, className, style, title }) => {
  const base = getIconBase();
  const file = kind === 'sign' ? SIGN_ICON_MAP[name] : PLANET_ICON_MAP[name];
  const src = base && file ? `${base}${encodeURIComponent(file)}.svg` : null;

  if (src) {
    return (
      <img
        src={src}
        alt={title || name}
        title={title || name}
        width={size}
        height={size}
        className={className}
        style={{
          display: 'inline-block',
          verticalAlign: 'middle',
          // dark-mode aware: inverts the dark asset art when the theme is dark
          filter: 'var(--astro-icon-filter, none)',
          ...style,
        }}
      />
    );
  }

  // No asset — fall back to a short label (never emoji).
  return (
    <span
      className={className}
      title={title || name}
      style={{ display: 'inline-block', fontFamily: 'var(--font-display), serif', ...style }}
    >
      {TEXT_FALLBACK[name] || name.slice(0, 3)}
    </span>
  );
};

export default Glyph;
