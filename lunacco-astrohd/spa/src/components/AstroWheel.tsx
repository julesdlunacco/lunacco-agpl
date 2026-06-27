import { useMemo } from 'react';
import { WheelLayers, AspectToggles } from '../services/chartConfig';
import { toSabian } from '../services/sabian';
import { LunaccoAstroWheel } from './LunaccoAstroWheel';

/** Names treated as asteroids for the per-asteroid allow-list. */
const ASTEROID_NAMES = ['Ceres', 'Pallas', 'Juno', 'Vesta', 'Pholus'];

/** Map an ASPECT_TYPES name to its AspectToggles key. */
const ASPECT_TOGGLE_KEY: Record<string, keyof AspectToggles> = {
  Conjunction: 'conjunction',
  Opposition: 'opposition',
  Square: 'square',
  Trine: 'trine',
  Sextile: 'sextile',
  Quincunx: 'quincunx',
};

const ZODIAC_SIGNS = [
  { name: 'Aries',       element: 'fire'  },
  { name: 'Taurus',      element: 'earth' },
  { name: 'Gemini',      element: 'air'   },
  { name: 'Cancer',      element: 'water' },
  { name: 'Leo',         element: 'fire'  },
  { name: 'Virgo',       element: 'earth' },
  { name: 'Libra',       element: 'air'   },
  { name: 'Scorpio',     element: 'water' },
  { name: 'Sagittarius', element: 'fire'  },
  { name: 'Capricorn',   element: 'earth' },
  { name: 'Aquarius',    element: 'air'   },
  { name: 'Pisces',      element: 'water' },
];

const ELEMENT_COLOR: Record<string, string> = {
  fire: 'var(--astro-fire, #f87171)', 
  earth: 'var(--astro-earth, #86efac)', 
  air: 'var(--astro-air, #7dd3fc)', 
  water: 'var(--astro-water, #a5b4fc)',
};

const ELEMENT_BG: Record<string, string> = {
  fire: 'color-mix(in srgb, var(--astro-fire, #f87171) 8%, transparent)', 
  earth: 'color-mix(in srgb, var(--astro-earth, #86efac) 8%, transparent)',
  air: 'color-mix(in srgb, var(--astro-air, #7dd3fc) 8%, transparent)', 
  water: 'color-mix(in srgb, var(--astro-water, #a5b4fc) 8%, transparent)',
};

const ASPECT_TYPES = [
  { name: 'Conjunction', angle: 0,   orb: 8, symbol: '☌', color: 'var(--gold, #facc15)' },
  { name: 'Opposition',  angle: 180, orb: 8, symbol: '☍', color: 'var(--astro-fire, #f97316)' },
  { name: 'Square',      angle: 90,  orb: 8, symbol: '□', color: 'var(--astro-fire, #ef4444)' },
  { name: 'Trine',       angle: 120, orb: 8, symbol: '△', color: 'var(--astro-earth, #22c55e)' },
  { name: 'Sextile',     angle: 60,  orb: 6, symbol: '⚹', color: 'var(--astro-air, #38bdf8)' },
];

const PLANET_ORDER = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
  'Uranus', 'Neptune', 'Pluto', 'NorthNode', 'SouthNode', 'Chiron', 'Black Moon Lilith', 'Vulcan',
  'Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex',
];

const PLANET_SYMBOL: Record<string, string> = {
  Sun: '☉', Earth: '⊕', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃',
  Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇', NorthNode: '☊',
  SouthNode: '☋', Chiron: '⚷', 'Black Moon Lilith': '⚸', Vulcan: 'Vu',
  Ceres: '⚳', Pallas: '⚴', Juno: '⚵', Vesta: '⚶', Pholus: '⚿',
  Ascendant: 'ASC', Descendant: 'DSC', Midheaven: 'MC', 'Imum Coeli': 'IC', Vertex: 'VX',
};

const SIGN_ICON_MAP: Record<string, string> = {
  Aries:'Aries', Taurus:'Taurus', Gemini:'Gemini', Cancer:'Cancer',
  Leo:'Leo', Virgo:'Virgo', Libra:'Libra', Scorpio:'Scorpio',
  Sagittarius:'Sagittarius', Capricorn:'Capricorn', Aquarius:'Aquarius', Pisces:'Pisces',
};

const PLANET_ICON_MAP: Record<string, string> = {
  Sun:'Sun', Earth:'Earth', Moon:'Moon', Mercury:'Mercury', Venus:'Venus', Mars:'Mars',
  Jupiter:'Jupiter', Saturn:'Saturn', Uranus:'Uranus', Neptune:'Neptune',
  Pluto:'Pluto', Chiron:'Chiron', NorthNode:'NorthNode', SouthNode:'SouthNode',
  'Black Moon Lilith':'BlackMoonLilith', Vulcan: 'Vulcan',
  'Ascendant':'Ascendant', 'Descendant':'Descendant', 'Midheaven':'Midheaven', 'Imum Coeli': 'Imuncoeli', 'Vertex':'Vertex',
};

function polarToCartesian( cx: number, cy: number, r: number, angleDeg: number ) {
  const rad = ( angleDeg * Math.PI ) / 180;
  return { x: cx + r * Math.cos( rad ), y: cy + r * Math.sin( rad ) };
}

function eclipticToSvg( lon: number, asc: number ) {
  return 180 + asc - lon;
}

function getIconBase(): string {
  const modules = ( window as any ).LunaCcoData?.modules || {};
  const astro = modules['luna-astrohd'] || {};
  return astro.assets?.zodiacPath || ( ( window as any ).ahdSettings?.pluginUrl ? ( window as any ).ahdSettings.pluginUrl + 'assets/zodiac/' : '' );
}

function computeAspects( planets: Array<{ name: string; longitude: number }> ) {
  const results: Array<{
    p1: { name: string; longitude: number };
    p2: { name: string; longitude: number };
    aspect: typeof ASPECT_TYPES[0];
    orb: number
  }> = [];
  const pts = planets.filter(p => !['Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex'].includes(p.name));
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const diff = Math.abs((pts[i].longitude - pts[j].longitude + 360) % 360);
      const angle = diff > 180 ? 360 - diff : diff;
      for ( const asp of ASPECT_TYPES ) {
        const orb = Math.abs( angle - asp.angle );
        if ( orb <= asp.orb ) {
          results.push( { p1: planets[ i ], p2: planets[ j ], aspect: asp, orb } );
        }
      }
    }
  }
  return results;
}

function spreadPlanets( planets: Array<{ name: string; longitude: number; isRetrograde?: boolean }> ) {
  if ( !planets.length ) return [];
  const sorted = [ ...planets ].sort( ( a, b ) => a.longitude - b.longitude );
  const spread: any[] = sorted.map( p => ( { ...p, displayLon: p.longitude } ) );
  const minGap = 9;
  for ( let pass = 0; pass < 8; pass++ ) {
    for ( let i = 0; i < spread.length; i++ ) {
      const next = spread[ ( i + 1 ) % spread.length ];
      const diff = ( ( next.displayLon - spread[ i ].displayLon ) + 360 ) % 360;
      if ( diff < minGap && diff > 0 ) {
        const push = ( minGap - diff ) / 2;
        spread[ i ].displayLon = ( spread[ i ].displayLon - push + 360 ) % 360;
        next.displayLon = ( next.displayLon + push ) % 360;
      }
    }
  }
  return spread;
}

export function AstroWheel({
  activations,
  secondaryActivations,
  size = 520,
  hideAspects = false,
  showCrossPoints = true,
  layers,
  asteroidFilter,
  side,
  onElementClick,
  selectedPlanet,
  selectedSign,
  selectedHouse,
  selectedAspectKey,
  centerTitle,
  centerSubtitle,
  cusps,
}: {
  activations: Record<string, any>;
  secondaryActivations?: Record<string, any>;
  size?: number;
  hideAspects?: boolean;
  showCrossPoints?: boolean;
  /** Modular layer toggles. Omitted => full legacy rendering. */
  layers?: Partial<WheelLayers>;
  /** Allow-list of asteroid keys to draw. undefined => all; [] => none. */
  asteroidFilter?: string[];
  /** Optional side label for dual-wheel layouts. */
  side?: 'personality' | 'design';
  onElementClick?: (type: any, id: string, label?: string) => void;
  selectedPlanet?: string;
  selectedSign?: string;
  selectedHouse?: number;
  selectedAspectKey?: string;
  centerTitle?: string;
  centerSubtitle?: string;
  cusps?: number[];
}) {
  const isDoubleLayer = !!secondaryActivations;

  // The LunaCco wheel is the default style. It renders a single layer, so the
  // overlaid dual (combined) wheel keeps the classic procedural renderer.
  if ((layers?.style ?? 'lunacco') === 'lunacco' && !isDoubleLayer) {
    return (
      <LunaccoAstroWheel
        activations={activations}
        size={size}
        hideAspects={hideAspects}
        showCrossPoints={showCrossPoints}
        layers={layers}
        asteroidFilter={asteroidFilter}
        side={side}
        onElementClick={onElementClick}
        selectedPlanet={selectedPlanet}
        selectedHouse={selectedHouse}
        selectedAspectKey={selectedAspectKey}
        cusps={cusps}
      />
    );
  }

  // Resolve layer toggles. `layers` wins; otherwise fall back to legacy props.
  const showCross = layers?.chartPoints ?? showCrossPoints;
  const showHouses = layers?.houses ?? true;
  const showSabian = layers?.sabian ?? false;
  const aspectsIncludeAsteroids = layers?.aspectsIncludeAsteroids ?? true;
  const aspectToggles = layers?.aspects;
  const allowedAsteroids = layers?.asteroids ?? asteroidFilter;
  const aspectEnabled = (aspectName: string): boolean => {
    if (!aspectToggles) return true;
    const key = ASPECT_TOGGLE_KEY[aspectName];
    return key ? aspectToggles[key] !== false : true;
  };
  // Keep a planet iff it isn't an asteroid, or the asteroid is in the allow-list.
  const planetAllowed = (name: string): boolean => {
    if (!ASTEROID_NAMES.includes(name)) return true;
    if (allowedAsteroids === undefined) return true;
    return allowedAsteroids.includes(name);
  };
  const cx = size / 2, cy = size / 2;
  const baseUrl = getIconBase();

  const asc: number = activations.Ascendant?.longitude ?? 0;
  const hasAsc = activations.Ascendant != null;
  const ascSignStart = Math.floor( ( ( ( asc % 360 ) + 360 ) % 360 ) / 30 ) * 30;

  // Radii
  const R_OUTER      = size / 2 - 6;
  const ZODIAC_W     = size * 0.085;
  const R_ZODIAC_I   = R_OUTER - ZODIAC_W;
  const PLANET_BAND  = size * 0.11;
  const R_PLANET_O   = R_ZODIAC_I - 2;

  // Layer Radii
  const R_PLANET_OUTER   = R_ZODIAC_I - PLANET_BAND * 0.35;
  const R_PLANET_INNER   = R_ZODIAC_I - PLANET_BAND * 1.15;
  const R_PLANET_DIVIDER = R_ZODIAC_I - PLANET_BAND * 0.75;

  const R_PLANET_I   = isDoubleLayer ? R_ZODIAC_I - PLANET_BAND * 1.5 : R_ZODIAC_I - PLANET_BAND;
  const R_PLANET     = R_ZODIAC_I - PLANET_BAND * 0.5;

  const R_HOUSE_O    = R_PLANET_I;
  const HOUSE_NUM_BAND = Math.max( 14, size * 0.038 );
  const R_HOUSE_I    = R_HOUSE_O - HOUSE_NUM_BAND * 3.5;
  const R_HOUSE_NUM  = R_HOUSE_O - HOUSE_NUM_BAND * 1.8;
  const R_ASPECT     = R_HOUSE_I - 4;

  const planetCircleR  = Math.max( 9, size * 0.022 );
  const planetIconSize = planetCircleR * 1.5;
  const signFontSize   = Math.max( 12, size * 0.034 );
  const houseNumSize   = Math.max( 7, size * 0.016 );
  const rxSize         = Math.max( 7, size * 0.016 );
  const planetFontSize = Math.max( 10, size * 0.028 );

  const svgA = ( lon: number ) => eclipticToSvg( lon, asc );
  const aspectKey = ( a: { p1: { name: string }; p2: { name: string }; aspect: { name: string } } ) => `${ a.p1.name }-${ a.aspect.name }-${ a.p2.name }`;

  const CROSS_POINTS = ['Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex'];

  const rawPlanets = Object.keys(activations)
    .sort((a, b) => {
      const idxA = PLANET_ORDER.indexOf(a);
      const idxB = PLANET_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    })
    .filter(n => showCross || !CROSS_POINTS.includes(n))
    .filter(n => planetAllowed(n))
    .map(n => ({
      name: n,
      longitude: activations[n].longitude,
      isRetrograde: activations[n].isRetrograde,
      isCrossPoint: CROSS_POINTS.includes(n),
    }));

  const lonKey = rawPlanets.map( p => p.longitude ).join( ',' );
  const spread  = useMemo( () => spreadPlanets( rawPlanets ), [ lonKey ] );
  
  const rawSecondary = secondaryActivations ? Object.keys(secondaryActivations)
    .sort((a, b) => {
      const idxA = PLANET_ORDER.indexOf(a);
      const idxB = PLANET_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    })
    .filter(n => showCross || !CROSS_POINTS.includes(n))
    .filter(n => planetAllowed(n))
    .map(n => ({
      name: n,
      longitude: secondaryActivations[n].longitude,
      isRetrograde: secondaryActivations[n].isRetrograde,
      isCrossPoint: CROSS_POINTS.includes(n),
    })) : [];

  const secondaryLonKey = rawSecondary.map( p => p.longitude ).join( ',' );
  const secondarySpread = useMemo( () => spreadPlanets( rawSecondary ), [ secondaryLonKey ] );

  const aspectPlanets = aspectsIncludeAsteroids
    ? rawPlanets
    : rawPlanets.filter( p => !ASTEROID_NAMES.includes( p.name ) );
  const aspects = useMemo( () => computeAspects( aspectPlanets ), [ lonKey, aspectsIncludeAsteroids ] );
  const houseSectors = useMemo(
    () => {
      if (hasAsc) {
        if (cusps && cusps.length >= 13) {
          return Array.from( { length: 12 } ).map( ( _, i ) => {
            const startLon = cusps[i + 1];
            const endLon = cusps[i === 11 ? 1 : i + 2];
            const diff = ((endLon - startLon + 360) % 360) / 2;
            const midLon = (startLon + diff) % 360;
            return {
              house: i + 1,
              startSvg: svgA( startLon ),
              endSvg: svgA( endLon ),
              midSvg: svgA( midLon ),
              cuspLon: startLon,
            };
          } );
        } else {
          return Array.from( { length: 12 } ).map( ( _, i ) => {
            const startLon = ( ascSignStart + i * 30 ) % 360;
            const endLon = ( ascSignStart + ( i + 1 ) * 30 ) % 360;
            const midLon = ( startLon + 15 ) % 360;
            return {
              house: i + 1,
              startSvg: svgA( startLon ),
              endSvg: svgA( endLon ),
              midSvg: svgA( midLon ),
              cuspLon: startLon,
            };
          } );
        }
      }
      return [];
    },
    [ hasAsc, ascSignStart, asc, cusps ]
  );

  const stroke      = 'var(--astro-wheel-stroke, rgba(255,255,255,0.18))';
  const strokeFaint = 'color-mix(in srgb, var(--astro-wheel-stroke, rgba(255,255,255,0.18)) 40%, transparent)';
  const bg          = 'var(--astro-wheel-bg, #0d0d1a)';
  const ringBg      = 'color-mix(in srgb, var(--astro-wheel-stroke, rgba(255,255,255,0.18)) 15%, transparent)';
  const textMuted   = 'var(--mute, #64748b)';
  const accentAsc   = 'var(--astro-wheel-accent, #818cf8)';
  const selectedHouseFill = 'color-mix(in srgb, var(--gold, #d4af37) 16%, transparent)';
  const centerTitleSize = Math.max( 11, size * 0.024 );
  const centerMetaSize = Math.max( 8, size * 0.015 );
  const centerBaseY = cy - size * 0.06;

  return (
    <svg width={ size } height={ size } viewBox={ `0 0 ${ size } ${ size }` }
      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}>

      <circle cx={ cx } cy={ cy } r={ R_OUTER } fill={ bg } stroke={ stroke } strokeWidth="1.5" />

      { side && (
        <text x={ cx } y={ size * 0.05 } textAnchor="middle"
          fontSize={ Math.max( 9, size * 0.022 ) } fontWeight="700" letterSpacing="2"
          fill={ side === 'design' ? 'var(--hd-design, #f97316)' : 'var(--hd-personality, #818cf8)' }>
          { side === 'design' ? 'DESIGN' : 'PERSONALITY' }
        </text>
      ) }

      <defs>
        <filter id="colorize-accent">
          <feFlood floodColor={ accentAsc } result="flood" />
          <feComposite in="flood" in2="SourceAlpha" operator="in" />
        </filter>
      </defs>

      { isDoubleLayer && (
        <g>
          <circle 
            cx={ cx } cy={ cy } 
            r={ ( R_ZODIAC_I + R_PLANET_DIVIDER ) / 2 } 
            fill="none" 
            stroke="color-mix(in srgb, var(--hd-personality, #1b1830) 8%, transparent)" 
            strokeWidth={ R_ZODIAC_I - R_PLANET_DIVIDER } 
          />
          <circle 
            cx={ cx } cy={ cy } 
            r={ ( R_PLANET_DIVIDER + R_PLANET_I ) / 2 } 
            fill="none" 
            stroke="color-mix(in srgb, var(--hd-design, #a12f2f) 8%, transparent)" 
            strokeWidth={ R_PLANET_DIVIDER - R_PLANET_I } 
          />
          <circle cx={ cx } cy={ cy } r={ R_PLANET_DIVIDER } fill="none" stroke={ strokeFaint } strokeWidth="0.5" />
        </g>
      ) }

      { ZODIAC_SIGNS.map( ( sign, i ) => {
        const startSvg = svgA( i * 30 ), endSvg = svgA( i * 30 + 30 ), midSvg = svgA( i * 30 + 15 );
        const s1 = polarToCartesian( cx, cy, R_ZODIAC_I, startSvg );
        const e1 = polarToCartesian( cx, cy, R_ZODIAC_I, endSvg );
        const s2 = polarToCartesian( cx, cy, R_OUTER,    startSvg );
        const e2 = polarToCartesian( cx, cy, R_OUTER,    endSvg );
        const mid = polarToCartesian( cx, cy, ( R_OUTER + R_ZODIAC_I ) / 2, midSvg );
        const col = ELEMENT_COLOR[ sign.element ];
        const iconFile = SIGN_ICON_MAP[ sign.name ];
        return (
          <g key={ sign.name }>
            <path
              d={ `M ${ s1.x } ${ s1.y } A ${ R_ZODIAC_I } ${ R_ZODIAC_I } 0 0 0 ${ e1.x } ${ e1.y } L ${ e2.x } ${ e2.y } A ${ R_OUTER } ${ R_OUTER } 0 0 1 ${ s2.x } ${ s2.y } Z` }
              fill={ selectedSign === sign.name ? 'var(--gold-soft, rgba(212,175,55,0.2))' : ELEMENT_BG[ sign.element ] } 
              stroke={ selectedSign === sign.name ? 'var(--gold)' : stroke } 
              strokeWidth={ selectedSign === sign.name ? 1.5 : 0.5 }
              onClick={() => onElementClick?.('sign', sign.name, sign.name)}
              style={{ cursor: 'pointer' }}
            />
            { baseUrl && iconFile ? (
              <image
                href={ `${ baseUrl }${ iconFile }.svg` }
                x={ mid.x - signFontSize * 0.6 } y={ mid.y - signFontSize * 0.6 }
                width={ signFontSize * 1.2 } height={ signFontSize * 1.2 }
                style={{ filter: 'url(#colorize-accent)' }}
              />
            ) : (
              <text x={ mid.x } y={ mid.y } textAnchor="middle" dominantBaseline="middle"
                fontSize={ signFontSize } fill={ col } fontWeight="700" style={{ fontFamily: 'serif' }}>
                { sign.name[ 0 ] }
              </text>
            ) }
          </g>
        );
      } ) }

      <circle cx={ cx } cy={ cy } r={ R_PLANET_O } fill={ ringBg } stroke={ stroke } strokeWidth="0.5" />
      <circle cx={ cx } cy={ cy } r={ R_PLANET_I } fill={ bg }    stroke={ stroke } strokeWidth="0.5" />
      <circle cx={ cx } cy={ cy } r={ R_HOUSE_O } fill={ bg } stroke={ strokeFaint } strokeWidth="0.5" />

      { showHouses && houseSectors.map( sector => {
        const innerStart = polarToCartesian( cx, cy, R_HOUSE_I, sector.startSvg );
        const innerEnd = polarToCartesian( cx, cy, R_HOUSE_I, sector.endSvg );
        const outerStart = polarToCartesian( cx, cy, R_HOUSE_O, sector.startSvg );
        const outerEnd = polarToCartesian( cx, cy, R_HOUSE_O, sector.endSvg );
        const active = selectedHouse === sector.house;
        return (
          <path
            key={ `house-sector-${ sector.house }` }
            d={ `M ${ innerStart.x } ${ innerStart.y } A ${ R_HOUSE_I } ${ R_HOUSE_I } 0 0 0 ${ innerEnd.x } ${ innerEnd.y } L ${ outerEnd.x } ${ outerEnd.y } A ${ R_HOUSE_O } ${ R_HOUSE_O } 0 0 1 ${ outerStart.x } ${ outerStart.y } Z` }
            fill={ active ? selectedHouseFill : 'transparent' }
            stroke="none"
            onClick={() => onElementClick?.('house', String( sector.house ), `House ${ sector.house }`)}
            style={{ cursor: 'pointer' }}
          />
        );
      } ) }

      { showHouses && houseSectors.map( ( sector, i ) => {
        const cuspLon = sector.cuspLon;
        const ang = svgA( cuspLon );
        const inner = polarToCartesian( cx, cy, R_HOUSE_I, ang );
        const outer = polarToCartesian( cx, cy, R_HOUSE_O, ang );
        const isAxis = i === 0 || i === 3 || i === 6 || i === 9;
        const axisLabel = i === 0 ? 'ASC' : i === 6 ? 'DSC' : i === 9 ? 'MC' : i === 3 ? 'IC' : '';
        const numPos  = polarToCartesian( cx, cy, R_HOUSE_NUM, sector.midSvg );
        const axisPos = polarToCartesian( cx, cy, R_OUTER + 16, ang );
        return (
          <g key={ i }>
            <line x1={ inner.x } y1={ inner.y } x2={ outer.x } y2={ outer.y }
              stroke={ isAxis ? accentAsc : stroke } strokeWidth={ isAxis ? 2 : 0.8 }
              strokeDasharray={ isAxis ? '' : '4 3' } />
            <text x={ numPos.x } y={ numPos.y } textAnchor="middle" dominantBaseline="middle"
              fontSize={ houseNumSize } fill={ selectedHouse === i + 1 ? 'var(--gold)' : isAxis ? accentAsc : textMuted }
              fontWeight={ selectedHouse === i + 1 ? '800' : isAxis ? '700' : '500' }
              onClick={() => onElementClick?.('house', String( i + 1 ), `House ${ i + 1 }`)}
              style={{ cursor: 'pointer' }}
            >{ i + 1 }</text>
            { isAxis && axisLabel && showCross && (
              <text x={ axisPos.x } y={ axisPos.y } textAnchor="middle" dominantBaseline="middle"
                fontSize={ houseNumSize + 1 } fontWeight="800" fill={ accentAsc }>{ axisLabel }</text>
            ) }
          </g>
        );
      } ) }

      <circle cx={ cx } cy={ cy } r={ R_HOUSE_I } fill={ bg } stroke={ strokeFaint } strokeWidth="0.5" />

      { !hideAspects && aspects.filter( asp => aspectEnabled( asp.aspect.name ) ).map( ( asp, idx ) => {
        const p1 = polarToCartesian( cx, cy, R_ASPECT, svgA( asp.p1.longitude ) );
        const p2 = polarToCartesian( cx, cy, R_ASPECT, svgA( asp.p2.longitude ) );
        const midX = ( p1.x + p2.x ) / 2, midY = ( p1.y + p2.y ) / 2;
        const col     = asp.aspect.color;
        const opacity = Math.max( 0.25, 1 - asp.orb / 9 );
        const lineW   = Math.max( 0.5, 2 - asp.orb * 0.2 );
        const isSelected = selectedAspectKey === aspectKey( asp );
        return (
          <g key={ idx }>
            <line x1={ p1.x } y1={ p1.y } x2={ p2.x } y2={ p2.y }
              stroke={ col } strokeWidth={ isSelected ? lineW + 1 : lineW } opacity={ isSelected ? 1 : opacity } />
            <line x1={ p1.x } y1={ p1.y } x2={ p2.x } y2={ p2.y }
              stroke="transparent" strokeWidth={ 14 }
              onClick={() => onElementClick?.('aspect', aspectKey( asp ), `${ asp.p1.name } ${ asp.aspect.name } ${ asp.p2.name }`)}
              style={{ cursor: 'pointer' }} />
            <circle cx={ midX } cy={ midY } r={ size * 0.018 }
              fill={ isSelected ? 'color-mix(in srgb, var(--gold, #d4af37) 12%, var(--astro-wheel-bg, #0d0d1a))' : bg } stroke={ col } strokeWidth={ isSelected ? 1.6 : 0.7 } opacity={ isSelected ? 1 : opacity }
              onClick={() => onElementClick?.('aspect', aspectKey( asp ), `${ asp.p1.name } ${ asp.aspect.name } ${ asp.p2.name }`)}
              style={{ cursor: 'pointer' }} />
            <text x={ midX } y={ midY } textAnchor="middle" dominantBaseline="middle"
              fontSize={ size * 0.018 } fill={ col } opacity={ isSelected ? 1 : opacity }
              onClick={() => onElementClick?.('aspect', aspectKey( asp ), `${ asp.p1.name } ${ asp.aspect.name } ${ asp.p2.name }`)}
              style={{ cursor: 'pointer' }}
            >{ asp.aspect.symbol }</text>
          </g>
        );
      } ) }

      { (isDoubleLayer ? secondarySpread : []).map( planet => {
        const displayAng = svgA( planet.displayLon );
        const trueAng    = svgA( planet.longitude );
        const pos        = polarToCartesian( cx, cy, R_PLANET_INNER, displayAng );
        const tickOuter  = polarToCartesian( cx, cy, R_PLANET_DIVIDER, trueAng );
        const tickInner  = polarToCartesian( cx, cy, R_PLANET_DIVIDER - size * 0.015, trueAng );
        const signIdx    = Math.floor( ( ( planet.longitude % 360 ) + 360 ) % 360 / 30 );
        const signCol    = ELEMENT_COLOR[ ZODIAC_SIGNS[ signIdx ]?.element ?? 'air' ];
        const iconFile   = PLANET_ICON_MAP[ planet.name ];
        const iconSrc    = baseUrl && iconFile ? `${ baseUrl }${ encodeURIComponent( iconFile ) }.svg` : null;
        const half       = planetIconSize / 2;
        const sym        = PLANET_SYMBOL[ planet.name ] ?? planet.name[ 0 ];

        return (
          <g key={ "design-" + planet.name }>
            <line x1={ tickInner.x } y1={ tickInner.y } x2={ tickOuter.x } y2={ tickOuter.y }
              stroke={ signCol } strokeWidth="1" />
            { Math.abs( planet.displayLon - planet.longitude ) > 1 && (
              <line x1={ tickInner.x } y1={ tickInner.y } x2={ pos.x } y2={ pos.y }
                stroke={ strokeFaint } strokeWidth="0.4" />
            ) }
            <circle 
                cx={ pos.x } cy={ pos.y } r={ planetCircleR } 
                fill={ selectedPlanet === planet.name ? 'var(--gold-soft)' : bg } 
                stroke={ selectedPlanet === planet.name ? 'var(--gold)' : signCol } 
                strokeWidth={ selectedPlanet === planet.name ? 2.5 : 1.2 } 
                onClick={() => onElementClick?.('planet', planet.name, planet.name)}
                style={{ cursor: 'pointer' }}
            />
            { iconSrc ? (
              <image href={ iconSrc } x={ pos.x - half } y={ pos.y - half }
                width={ planetIconSize } height={ planetIconSize }
                style={{ filter: 'url(#colorize-accent)', cursor: 'pointer' }}
                onClick={() => onElementClick?.('planet', planet.name, planet.name)} />
            ) : (
              <text x={ pos.x } y={ pos.y } textAnchor="middle" dominantBaseline="middle"
                fontSize={ planetFontSize } fill="var(--ink, #1b1830)" style={{ fontFamily: 'serif', cursor: 'pointer' }}
                onClick={() => onElementClick?.('planet', planet.name, planet.name)}>{ sym }</text>
            ) }
          </g>
        );
      } ) }

      { spread.map( planet => {
        const displayAng = svgA( planet.displayLon );
        const trueAng    = svgA( planet.longitude );
        const pos        = polarToCartesian( cx, cy, isDoubleLayer ? R_PLANET_OUTER : R_PLANET, displayAng );
        const tickOuter  = polarToCartesian( cx, cy, R_PLANET_O, trueAng );
        const tickInner  = polarToCartesian( cx, cy, R_PLANET_O - size * 0.018, trueAng );
        const signIdx    = Math.floor( ( ( planet.longitude % 360 ) + 360 ) % 360 / 30 );
        const signCol    = ELEMENT_COLOR[ ZODIAC_SIGNS[ signIdx ]?.element ?? 'air' ];
        const iconFile   = PLANET_ICON_MAP[ planet.name ];
        const iconSrc    = baseUrl && iconFile ? `${ baseUrl }${ encodeURIComponent( iconFile ) }.svg` : null;
        const half       = planetIconSize / 2;
        const sym        = PLANET_SYMBOL[ planet.name ] ?? planet.name[ 0 ];

        return (
          <g key={ planet.name }>
            <line x1={ tickInner.x } y1={ tickInner.y } x2={ tickOuter.x } y2={ tickOuter.y }
              stroke={ signCol } strokeWidth="1.5" />
            { Math.abs( planet.displayLon - planet.longitude ) > 1 && (
              <line x1={ tickInner.x } y1={ tickInner.y } x2={ pos.x } y2={ pos.y }
                stroke={ strokeFaint } strokeWidth="0.5" />
            ) }
            <circle 
                cx={ pos.x } cy={ pos.y } r={ planetCircleR } 
                fill={ selectedPlanet === planet.name ? 'var(--gold-soft)' : bg } 
                stroke={ selectedPlanet === planet.name ? 'var(--gold)' : signCol } 
                strokeWidth={ selectedPlanet === planet.name ? 2.5 : 1.5 } 
                onClick={() => onElementClick?.('planet', planet.name, planet.name)}
                style={{ cursor: 'pointer' }}
            />
            { iconSrc ? (
              <image href={ iconSrc } x={ pos.x - half } y={ pos.y - half }
                width={ planetIconSize } height={ planetIconSize }
                style={{ filter: 'url(#colorize-accent)', cursor: 'pointer' }}
                onClick={() => onElementClick?.('planet', planet.name, planet.name)} />
            ) : (
              <text x={ pos.x } y={ pos.y } textAnchor="middle" dominantBaseline="middle"
                fontSize={ planetFontSize } fill="var(--ink, #1b1830)" style={{ fontFamily: 'serif', cursor: 'pointer' }}
                onClick={() => onElementClick?.('planet', planet.name, planet.name)}>{ sym }</text>
            ) }
            { planet.isRetrograde && (
              <text x={ pos.x + planetCircleR * 0.85 } y={ pos.y - planetCircleR * 0.75 }
                fontSize={ rxSize } fontWeight="800" fill="#f87171" textAnchor="middle">ℛ</text>
            ) }
            { showSabian && !planet.isCrossPoint && (
              <text x={ pos.x } y={ pos.y + planetCircleR * 1.9 } textAnchor="middle" dominantBaseline="middle"
                fontSize={ rxSize } fontWeight="700" fill="var(--gold, #d4af37)">
                <title>{ `Sabian: ${ toSabian( planet.longitude ).sign } ${ toSabian( planet.longitude ).degree }` }</title>
                { toSabian( planet.longitude ).degree }°
              </text>
            ) }
          </g>
        );
      } ) }

      <g>
        <circle cx={ cx } cy={ cy } r={ R_HOUSE_I - 10 } fill="color-mix(in srgb, var(--paper, #f8f5ef) 4%, transparent)" stroke={ strokeFaint } strokeWidth="0.75" />
        <circle cx={ cx } cy={ cy } r={ R_HOUSE_I - 26 } fill="transparent" stroke={ strokeFaint } strokeDasharray="2 5" strokeWidth="0.8" />
        <text x={ cx } y={ centerBaseY - 18 } textAnchor="middle" fontSize={ centerMetaSize } fill="var(--gold, #d4af37)" fontWeight="700" letterSpacing="2.5">
          { centerTitle ?? "ASTROLOGY MAP" }
        </text>
        <text x={ cx } y={ centerBaseY + 2 } textAnchor="middle" fontSize={ centerTitleSize } fill="#e8e5dc" style={{ fontFamily: 'var(--font-display, serif)', fontStyle: 'italic' }}>
          { centerSubtitle ?? (activations.Ascendant?.sign ? `${ activations.Ascendant.sign } Rising` : 'Natal Wheel') }
        </text>
        <text x={ cx } y={ centerBaseY + 22 } textAnchor="middle" fontSize={ centerMetaSize } fill={ textMuted }>
          { activations.Sun?.sign || '—' } Sun • { activations.Moon?.sign || '—' } Moon
        </text>
      </g>

      <circle cx={ cx } cy={ cy } r={ size * 0.008 } fill={ accentAsc } />
      <circle cx={ cx } cy={ cy } r={ size * 0.004 } fill={ bg } />
    </svg>
  );
}
