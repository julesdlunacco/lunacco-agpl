/**
 * LunaccoAstroWheel
 *
 * Procedurally draws the LunaCco astrology wheel frame as a live chart. The
 * Illustrator SVG is useful as a visual reference, but this renderer keeps the
 * chart geometry in code so the Placidus lines, labels, and planet ring can
 * move without the artwork exploding the layout.
 */

import React from 'react';
import { WheelLayers, AspectToggles } from '../services/chartConfig';

const ASPECT_TOGGLE_KEY: Record<string, keyof AspectToggles> = {
  Conjunction: 'conjunction', Opposition: 'opposition', Square: 'square',
  Trine: 'trine', Sextile: 'sextile', Quincunx: 'quincunx',
};

const ASPECT_TYPES = [
  { name: 'Conjunction', angle: 0,   orb: 8, color: 'var(--gold, #d4af37)' },
  { name: 'Opposition',  angle: 180, orb: 8, color: 'var(--astro-fire, #ef4444)' },
  { name: 'Square',      angle: 90,  orb: 8, color: 'var(--astro-fire, #ef4444)' },
  { name: 'Trine',       angle: 120, orb: 8, color: 'var(--astro-earth, #22c55e)' },
  { name: 'Sextile',     angle: 60,  orb: 6, color: 'var(--astro-air, #38bdf8)' },
];

const SIGN_GLYPHS = ['\u2648', '\u2649', '\u264A', '\u264B', '\u264C', '\u264D', '\u264E', '\u264F', '\u2650', '\u2651', '\u2652', '\u2653'];

const PLANET_SYMBOL: Record<string, string> = {
  Sun: '\u2609', Earth: '\u2295', Moon: '\u263D', Mercury: '\u263F', Venus: '\u2640', Mars: '\u2642',
  Jupiter: '\u2643', Saturn: '\u2644', Uranus: '\u2645', Neptune: '\u2646', Pluto: '\u2647',
  NorthNode: '\u260A', SouthNode: '\u260B', Chiron: '\u26B7', 'Black Moon Lilith': '\u26B8', Vulcan: 'Vu',
  Ceres: '\u26B3', Pallas: '\u26B4', Juno: '\u26B5', Vesta: '\u26B6', Pholus: '\u26BF',
  Ascendant: 'AC', Descendant: 'DC', Midheaven: 'MC', 'Imum Coeli': 'IC', Vertex: 'Vx',
};

const PLANET_ORDER = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  'NorthNode', 'SouthNode', 'Chiron', 'Black Moon Lilith', 'Vulcan', 'Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex',
];

const SIGN_ICON = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const SIGN_ELEMENT = ['fire', 'earth', 'air', 'water', 'fire', 'earth', 'air', 'water', 'fire', 'earth', 'air', 'water'] as const;
const ELEMENT_COLOR: Record<typeof SIGN_ELEMENT[number], string> = {
  fire: 'var(--astro-fire, #ef4444)',
  earth: 'var(--astro-earth, #22c55e)',
  air: 'var(--astro-air, #38bdf8)',
  water: 'var(--astro-water, #818cf8)',
};

const PLANET_ICON: Record<string, string> = {
  Sun: 'Sun', Earth: 'Earth', Moon: 'Moon', Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars',
  Jupiter: 'Jupiter', Saturn: 'Saturn', Uranus: 'Uranus', Neptune: 'Neptune', Pluto: 'Pluto',
  Chiron: 'Chiron', NorthNode: 'NorthNode', SouthNode: 'SouthNode', 'Black Moon Lilith': 'BlackMoonLilith', Vulcan: 'Vulcan',
  Ascendant: 'Ascendant', Descendant: 'Descendant', Midheaven: 'Midheaven', 'Imum Coeli': 'Imuncoeli', Vertex: 'Vertex',
};

const CROSS_POINTS = ['Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex'];
const ASTEROID_NAMES = ['Ceres', 'Pallas', 'Juno', 'Vesta', 'Pholus'];

function getIconBase(): string {
  const modules = (window as any).LunaCcoData?.modules || {};
  const astro = modules['luna-astrohd'] || {};
  return astro.assets?.zodiacPath || ((window as any).ahdSettings?.pluginUrl ? (window as any).ahdSettings.pluginUrl + 'assets/zodiac/' : '');
}

function norm360(a: number) { return ((a % 360) + 360) % 360; }
function eclipticToSvg(lon: number, asc: number) { return norm360(180 + asc - lon); }
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const delta = norm360(endDeg - startDeg);
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function houseArcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const delta = norm360(startDeg - endDeg);
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function sectorPath(cx: number, cy: number, rInner: number, rOuter: number, startDeg: number, endDeg: number) {
  const s1 = polar(cx, cy, rInner, startDeg);
  const e1 = polar(cx, cy, rInner, endDeg);
  const s2 = polar(cx, cy, rOuter, startDeg);
  const e2 = polar(cx, cy, rOuter, endDeg);
  const delta = norm360(endDeg - startDeg);
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${s1.x} ${s1.y} A ${rInner} ${rInner} 0 ${largeArc} 1 ${e1.x} ${e1.y} L ${e2.x} ${e2.y} A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${s2.x} ${s2.y} Z`;
}

function houseSectorPath(cx: number, cy: number, rInner: number, rOuter: number, startDeg: number, endDeg: number) {
  const s1 = polar(cx, cy, rInner, startDeg);
  const e1 = polar(cx, cy, rInner, endDeg);
  const s2 = polar(cx, cy, rOuter, startDeg);
  const e2 = polar(cx, cy, rOuter, endDeg);
  const delta = norm360(startDeg - endDeg);
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${s1.x} ${s1.y} A ${rInner} ${rInner} 0 ${largeArc} 0 ${e1.x} ${e1.y} L ${e2.x} ${e2.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${s2.x} ${s2.y} Z`;
}

function computeAspects(planets: Array<{ name: string; longitude: number }>, enabled: (n: string) => boolean) {
  const out: Array<{ p1: typeof planets[0]; p2: typeof planets[0]; aspect: typeof ASPECT_TYPES[0]; orb: number }> = [];
  const pts = planets.filter((p) => !CROSS_POINTS.includes(p.name));
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const diff = Math.abs(norm360(pts[i].longitude - pts[j].longitude));
      const angle = diff > 180 ? 360 - diff : diff;
      for (const asp of ASPECT_TYPES) {
        if (!enabled(asp.name)) continue;
        const orb = Math.abs(angle - asp.angle);
        if (orb <= asp.orb) out.push({ p1: pts[i], p2: pts[j], aspect: asp, orb });
      }
    }
  }
  return out;
}

function spread(planets: Array<{ name: string; longitude: number; isRetrograde?: boolean; isCrossPoint?: boolean }>) {
  if (!planets.length) return [];
  const sorted = [...planets].sort((a, b) => a.longitude - b.longitude).map((p) => ({ ...p, displayLon: p.longitude }));
  const minGap = 7;
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 0; i < sorted.length; i++) {
      const next = sorted[(i + 1) % sorted.length];
      const diff = norm360(next.displayLon - sorted[i].displayLon);
      if (diff < minGap && diff > 0) {
        const push = (minGap - diff) / 2;
        sorted[i].displayLon = norm360(sorted[i].displayLon - push);
        next.displayLon = norm360(next.displayLon + push);
      }
    }
  }
  return sorted;
}

export function LunaccoAstroWheel({
  activations,
  size = 520,
  hideAspects = false,
  showCrossPoints = true,
  layers,
  asteroidFilter,
  side,
  onElementClick,
  selectedPlanet,
  selectedHouse,
  selectedAspectKey,
  cusps,
}: {
  activations: Record<string, any>;
  size?: number;
  hideAspects?: boolean;
  showCrossPoints?: boolean;
  layers?: Partial<WheelLayers>;
  asteroidFilter?: string[];
  side?: 'personality' | 'design';
  onElementClick?: (type: any, id: string, label?: string) => void;
  selectedPlanet?: string;
  selectedHouse?: number;
  selectedAspectKey?: string;
  cusps?: number[];
}) {
  const showCross = layers?.chartPoints ?? showCrossPoints;
  const showHouses = layers?.houses ?? true;
  const aspectsIncludeAsteroids = layers?.aspectsIncludeAsteroids ?? true;
  const aspectToggles = layers?.aspects;
  const allowedAsteroids = layers?.asteroids ?? asteroidFilter;
  const aspectEnabled = (name: string) => {
    if (!aspectToggles) return true;
    const k = ASPECT_TOGGLE_KEY[name];
    return k ? aspectToggles[k] !== false : true;
  };
  const planetAllowed = (name: string) => {
    if (!ASTEROID_NAMES.includes(name)) return true;
    if (allowedAsteroids === undefined) return true;
    return allowedAsteroids.includes(name);
  };

  const asc: number = activations.Ascendant?.longitude ?? 0;
  const vb = 1000;
  const cx = 500;
  const cy = 500;
  const svgAng = (lon: number) => eclipticToSvg(lon, asc);
  const aspectKey = (a: { p1: { name: string }; p2: { name: string }; aspect: { name: string } }) => `${a.p1.name}-${a.aspect.name}-${a.p2.name}`;

  const rawPlanets = Object.keys(activations)
    .sort((a, b) => {
      const ia = PLANET_ORDER.indexOf(a), ib = PLANET_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    })
    .filter((n) => showCross || !CROSS_POINTS.includes(n))
    .filter((n) => planetAllowed(n))
    .map((n) => ({ name: n, longitude: activations[n].longitude, isRetrograde: activations[n].isRetrograde, isCrossPoint: CROSS_POINTS.includes(n) }));

  const lonKey = rawPlanets.map((p) => p.longitude).join(',');
  const spreadPlanets = React.useMemo(() => spread(rawPlanets), [lonKey]);
  const aspectPlanets = aspectsIncludeAsteroids ? rawPlanets : rawPlanets.filter((p) => !ASTEROID_NAMES.includes(p.name));
  const aspects = React.useMemo(() => computeAspects(aspectPlanets, aspectEnabled), [lonKey, aspectsIncludeAsteroids, JSON.stringify(aspectToggles)]);

  const cuspLons = React.useMemo(() => {
    const out: number[] = [];
    if (cusps && cusps.length >= 13) {
      for (let i = 1; i <= 12; i++) out.push(norm360(cusps[i]));
    } else {
      const start = Math.floor(norm360(asc) / 30) * 30;
      for (let i = 0; i < 12; i++) out.push(norm360(start + i * 30));
    }
    return out;
  }, [cusps, asc]);

  const houseMids = cuspLons.map((c, i) => {
    const next = cuspLons[(i + 1) % 12];
    const span = norm360(next - c);
    return { house: i + 1, cuspLon: c, midLon: norm360(c + span / 2) };
  });
  const interceptedSigns = React.useMemo(() => {
    const cuspSigns = new Set(cuspLons.map((lon) => Math.floor(norm360(lon) / 30)));
    return SIGN_ICON
      .map((_, signIdx) => ({ signIdx, midLon: norm360(signIdx * 30 + 15) }))
      .filter(({ signIdx }) => !cuspSigns.has(signIdx))
      .map((item) => {
        const houseIdx = cuspLons.findIndex((c, i) => {
          const span = norm360(cuspLons[(i + 1) % 12] - c);
          const distance = norm360(item.midLon - c);
          return distance > 0.01 && distance < span - 0.01;
        });
        return houseIdx >= 0 ? { ...item, house: houseIdx + 1 } : null;
      })
      .filter((item): item is { signIdx: number; midLon: number; house: number } => !!item);
  }, [cuspLons]);

  const stroke = 'var(--astro-wheel-stroke, rgba(120,110,90,0.52))';
  const accent = 'var(--astro-wheel-accent, #818cf8)';
  const textMuted = 'var(--mute, #6b6456)';
  const ink = 'var(--ink, #1b1830)';
  const paper = 'var(--paper, #fff)';
  const baseUrl = getIconBase();

  const rOuter = 468;
  const rOuterInner = 448;
  const rZodiac = 396;
  const rCuspWell = 393;
  const rHouseLabel = 424;
  const rInterceptedSign = 370;
  const rHouseLineOuter = 350;
  const rPlanet = 288;
  const rCenter = 176;
  const rAspect = 166;
  const signImg = 35;
  const planetImg = 36;
  const interceptedSignImg = 30;
  const cuspWellSize = 72;
  const majorLineWidth = 4.5;
  const headerFont = 'var(--font-display, Georgia, serif)';

  return (
    <div style={{ width: '100%', maxWidth: size, minWidth: 0, margin: '0 auto', flex: '0 1 auto' }}>
      {side && (
        <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', marginBottom: 4,
          color: side === 'design' ? 'var(--hd-design, #a12f2f)' : 'var(--hd-personality, #818cf8)' }}>
          {side === 'design' ? 'DESIGN' : 'PERSONALITY'}
        </div>
      )}

      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${vb} ${vb}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        <defs>
          <radialGradient id="lunacco-wheel-paper" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor={paper} />
            <stop offset="100%" stopColor="color-mix(in srgb, var(--gold, #d4af37) 8%, var(--paper, #fff))" />
          </radialGradient>
          <filter id="lunacco-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="rgba(20,16,10,0.12)" />
          </filter>
          <filter id="lunacco-icon-tint">
            <feFlood floodColor={textMuted} result="flood" />
            <feComposite in="flood" in2="SourceAlpha" operator="in" />
          </filter>
          {Object.entries(ELEMENT_COLOR).map(([element, color]) => (
            <filter key={element} id={`lunacco-${element}-tint`}>
              <feFlood floodColor={color} result="flood" />
              <feComposite in="flood" in2="SourceAlpha" operator="in" />
            </filter>
          ))}
        </defs>

        <circle cx={cx} cy={cy} r={rOuter} fill="url(#lunacco-wheel-paper)" stroke={textMuted} strokeWidth="6" />
        <circle cx={cx} cy={cy} r={rOuterInner} fill="none" stroke={textMuted} strokeWidth="4" opacity="0.92" />
        <circle cx={cx} cy={cy} r={rZodiac} fill="none" stroke={textMuted} strokeWidth="4" opacity="0.72" />
        <circle cx={cx} cy={cy} r={rCenter} fill={paper} stroke={textMuted} strokeWidth="3.5" opacity="0.96" />
        <circle cx={cx} cy={cy} r={rCenter - 10} fill="none" stroke={textMuted} strokeWidth="2" opacity="0.55" />

        {showHouses && houseMids.map((h, i) => {
          const next = houseMids[(i + 1) % 12];
          const start = svgAng(h.cuspLon);
          const end = svgAng(next.cuspLon);
          return (
            <path
              key={`house-band-${h.house}`}
              d={houseSectorPath(cx, cy, rZodiac, rOuterInner, start, end)}
              fill={i % 2 ? 'rgba(255,255,255,0.2)' : 'color-mix(in srgb, var(--gold, #d4af37) 5%, transparent)'}
              stroke="none"
            />
          );
        })}

        {showHouses && houseMids.map((h) => {
          const ang = svgAng(h.cuspLon);
          const a = polar(cx, cy, rZodiac, ang);
          const b = polar(cx, cy, rOuterInner, ang);
          return <line key={`cusp-band-tick-${h.house}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={textMuted} strokeWidth="2" opacity="0.46" />;
        })}

        {showHouses && cuspLons.map((lon, i) => {
          const ang = svgAng(lon);
          const a = polar(cx, cy, rCenter, ang);
          const b = polar(cx, cy, rHouseLineOuter, ang);
          const isAxis = i === 0 || i === 3 || i === 6 || i === 9;
          const axisLabel = i === 0 ? 'AC' : i === 3 ? 'IC' : i === 6 ? 'DC' : 'MC';
          const lp = polar(cx, cy, rHouseLineOuter + 26, ang);
          return (
            <g key={`div-${i}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isAxis ? accent : stroke} strokeWidth={majorLineWidth}
                opacity={isAxis ? 0.94 : 0.72} />
              {isAxis && showCross && (
                <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
                  fontFamily={headerFont} fontSize={18} fontStyle="italic" fontWeight="800" fill={accent}>{axisLabel}</text>
              )}
            </g>
          );
        })}

        {showHouses && houseMids.map((h, i) => {
          const next = houseMids[(i + 1) % 12];
          const start = svgAng(norm360(h.cuspLon + 3));
          const end = svgAng(norm360(next.cuspLon - 3));
          return <path key={`soft-arc-${h.house}`} d={houseArcPath(cx, cy, rHouseLineOuter, start, end)} fill="none" stroke={textMuted} strokeWidth="2" opacity="0.24" />;
        })}

        {showHouses && houseMids.map((h, i) => {
          const ang = svgAng(h.midLon);
          const labelPos = polar(cx, cy, rHouseLabel, ang);
          const active = selectedHouse === h.house;
          return (
            <g key={`hn-${h.house}`} onClick={() => onElementClick?.('house', String(h.house), `House ${h.house}`)}
              style={{ cursor: 'pointer' }}>
              <text x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="central"
                fontFamily={headerFont} fontSize={22} fontStyle="italic" fontWeight={active ? 900 : 700}
                fill={active ? 'var(--gold, #d4af37)' : ink}
                paintOrder="stroke" stroke={paper} strokeWidth="5" strokeLinejoin="round">
                {h.house}
              </text>
            </g>
          );
        })}

        {showHouses && interceptedSigns.map(({ signIdx, midLon, house }) => {
          const ang = svgAng(midLon);
          const pos = polar(cx, cy, rInterceptedSign, ang);
          const iconFile = SIGN_ICON[signIdx];
          const element = SIGN_ELEMENT[signIdx];
          const elementColor = ELEMENT_COLOR[element];
          return (
            <g key={`intercepted-${house}-${signIdx}`}
              onClick={() => onElementClick?.('sign', iconFile, `${iconFile} Intercepted in House ${house}`)}
              style={{ cursor: 'pointer' }}>
              {baseUrl && iconFile ? (
                <image href={`${baseUrl}${iconFile}.svg`}
                  x={pos.x - interceptedSignImg / 2} y={pos.y - interceptedSignImg / 2}
                  width={interceptedSignImg} height={interceptedSignImg}
                  preserveAspectRatio="xMidYMid meet"
                  style={{ filter: `url(#lunacco-${element}-tint)` }} />
              ) : (
                <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                  fontSize={28} fill={elementColor}>{SIGN_GLYPHS[signIdx]}</text>
              )}
            </g>
          );
        })}

        {showHouses && houseMids.map((h, i) => {
          const fixedAng = svgAng(h.cuspLon);
          const well = polar(cx, cy, rCuspWell, fixedAng);
          const signIdx = Math.floor(norm360(h.cuspLon) / 30);
          const element = SIGN_ELEMENT[signIdx];
          const elementColor = ELEMENT_COLOR[element];
          const deg = Math.floor(norm360(h.cuspLon) % 30);
          const iconFile = SIGN_ICON[signIdx];
          const isAxis = i === 0 || i === 3 || i === 6 || i === 9;
          return (
            <g key={`cusp-${h.house}`} onClick={() => onElementClick?.('house', String(h.house), `House ${h.house} Cusp`)}
              style={{ cursor: 'pointer' }}>
              <circle cx={well.x} cy={well.y} r={cuspWellSize / 2}
                fill={paper} stroke={isAxis ? accent : elementColor}
                strokeWidth={isAxis ? 4.5 : 3} filter="url(#lunacco-soft-shadow)" />
              {baseUrl && iconFile ? (
                <image href={`${baseUrl}${iconFile}.svg`} x={well.x - signImg / 2} y={well.y - signImg * 0.9}
                  width={signImg} height={signImg} preserveAspectRatio="xMidYMid meet"
                  style={{ filter: `url(#lunacco-${element}-tint)` }} />
              ) : (
                <text x={well.x} y={well.y - signImg * 0.35} textAnchor="middle" dominantBaseline="central"
                  fontSize={31} fill={elementColor}>{SIGN_GLYPHS[signIdx]}</text>
              )}
              <text x={well.x} y={well.y + signImg * 0.62} textAnchor="middle" dominantBaseline="central"
                fontSize={19} fontWeight="700" fill={textMuted}>{deg}°</text>
            </g>
          );
        })}

        {!hideAspects && aspects.map((asp, idx) => {
          const p1 = polar(cx, cy, rAspect, svgAng(asp.p1.longitude));
          const p2 = polar(cx, cy, rAspect, svgAng(asp.p2.longitude));
          const isSel = selectedAspectKey === aspectKey(asp);
          const opacity = Math.max(0.25, 1 - asp.orb / 9);
          return (
            <g key={idx}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={asp.aspect.color}
                strokeWidth={isSel ? 2.8 : Math.max(1, 2.2 - asp.orb * 0.18)} opacity={isSel ? 1 : opacity} />
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={14}
                onClick={() => onElementClick?.('aspect', aspectKey(asp), `${asp.p1.name} ${asp.aspect.name} ${asp.p2.name}`)}
                style={{ cursor: 'pointer' }} />
            </g>
          );
        })}

        {spreadPlanets.map((p) => {
          const dispAng = svgAng((p as any).displayLon);
          const trueAng = svgAng(p.longitude);
          const pos = polar(cx, cy, rPlanet, dispAng);
          const tickO = polar(cx, cy, rHouseLineOuter, trueAng);
          const tickI = polar(cx, cy, rHouseLineOuter - 16, trueAng);
          const degreePos = polar(cx, cy, rPlanet - 42, trueAng);
          const r = 24;
          const sel = selectedPlanet === p.name;
          const iconFile = PLANET_ICON[p.name];
          const iconSrc = baseUrl && iconFile ? `${baseUrl}${encodeURIComponent(iconFile)}.svg` : null;
          const deg = Math.floor(norm360(p.longitude) % 30);
          const signIdx = Math.floor(norm360(p.longitude) / 30);
          const element = SIGN_ELEMENT[signIdx];
          const elementColor = ELEMENT_COLOR[element];
          return (
            <g key={p.name}>
              <line x1={tickI.x} y1={tickI.y} x2={tickO.x} y2={tickO.y} stroke={elementColor} strokeWidth={majorLineWidth} />
              <text x={degreePos.x} y={degreePos.y} textAnchor="middle" dominantBaseline="central"
                fontFamily={headerFont} fontSize={13} fontStyle="italic" fontWeight="700" fill={textMuted}>{deg}°</text>
              <circle cx={pos.x} cy={pos.y} r={r} fill={paper}
                stroke={sel ? 'var(--gold, #d4af37)' : elementColor} strokeWidth={sel ? 3.2 : 1.8}
                onClick={() => onElementClick?.('planet', p.name, p.name)} style={{ cursor: 'pointer' }} />
              {iconSrc ? (
                <image href={iconSrc} x={pos.x - planetImg / 2} y={pos.y - planetImg / 2}
                  width={planetImg} height={planetImg} preserveAspectRatio="xMidYMid meet"
                  style={{ filter: `url(#lunacco-${element}-tint)`, cursor: 'pointer' }}
                  onClick={() => onElementClick?.('planet', p.name, p.name)} />
              ) : (
                <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fontSize={r * 1.25}
                  fill={elementColor} style={{ cursor: 'pointer' }}
                  onClick={() => onElementClick?.('planet', p.name, p.name)}>
                  {PLANET_SYMBOL[p.name] ?? p.name[0]}
                </text>
              )}
              {p.isRetrograde && (
                <text x={pos.x + r} y={pos.y - r * 0.8} fontSize={r * 0.8} fontWeight="800" fill="#ef4444" textAnchor="middle">℞</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default LunaccoAstroWheel;
