/**
 * AstroPanels
 *
 * Astrology analytics as inner editorial tabs (Insights / Placements / Aspects /
 * Rulers / Modalities). Which tabs exist is controlled by SectionToggles, like
 * the HD profile-lines tabs. The Design side is included per the chart's
 * astroShowDesign / astroDesignScope settings (placements-only or all tabs).
 * Reuses CombinedView/DualWheelView computations.
 */

import { useMemo, useState } from 'react';
import { analyzeAstroInsights, AstroInsights, AstroPlanetLike } from '../services/AstroInsights';
import { SectionToggles } from '../services/chartConfig';
import { AstroPlacementsTable } from './AstroDataTables';
import { getAngelOverlay, formatAngelDegree } from '../services/AngelOverlayService';

const MODERN_RULERS: Record<string, string> = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Pluto',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Uranus', Pisces: 'Neptune',
};

const ZODIAC = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const ANGLE_NAMES = ['Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex'];

const DIST_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const DESTINY_PLANETS = ['Sun', 'Earth', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'NorthNode', 'Chiron'];

const primary = 'var(--gold, #d4af37)';
const cardStyle: React.CSSProperties = { background: 'var(--card)', padding: 18, border: '1px solid var(--hair)' };
const cardTitle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontStyle: 'italic', color: primary, fontSize: 16, marginBottom: 12, marginTop: 0 };

// ── Distribution categories (mirrors DualWheelView) ─────────────────────────
type TallyCategory = { name: string; key: string; details: string; color: string };
const houseCategories: TallyCategory[] = [
  { name: 'Angular', details: 'Houses 1, 4, 7, 10', key: 'angular', color: 'var(--gold, #d4af37)' },
  { name: 'Succedent', details: 'Houses 2, 5, 8, 11', key: 'succedent', color: 'var(--indigo, #5c59c2)' },
  { name: 'Cadent', details: 'Houses 3, 6, 9, 12', key: 'cadent', color: 'var(--hd-design, #a12f2f)' },
];
const elementCategories: TallyCategory[] = [
  { name: 'Fire', details: 'Aries, Leo, Sagittarius', key: 'fire', color: 'var(--astro-fire, #f87171)' },
  { name: 'Earth', details: 'Taurus, Virgo, Capricorn', key: 'earth', color: 'var(--astro-earth, #86efac)' },
  { name: 'Air', details: 'Gemini, Libra, Aquarius', key: 'air', color: 'var(--astro-air, #7dd3fc)' },
  { name: 'Water', details: 'Cancer, Scorpio, Pisces', key: 'water', color: 'var(--astro-water, #a5b4fc)' },
];
const modalityCategories: TallyCategory[] = [
  { name: 'Cardinal', details: 'Aries, Cancer, Libra, Capricorn', key: 'cardinal', color: 'var(--gold, #d4af37)' },
  { name: 'Fixed', details: 'Taurus, Leo, Scorpio, Aquarius', key: 'fixed', color: 'var(--indigo, #5c59c2)' },
  { name: 'Mutable', details: 'Gemini, Virgo, Sagittarius, Pisces', key: 'mutable', color: 'var(--hd-design, #a12f2f)' },
];

function formatDeg(lon: number) {
  const inSign = lon % 30, d = Math.floor(inSign), m = Math.floor((inSign - d) * 60);
  return `${d}°${String(m).padStart(2, '0')}'`;
}
function signFromLon(lon: number) { return ZODIAC[Math.floor((((lon % 360) + 360) % 360) / 30)]; }

function houseBreakdown(placements: Array<[string, any]>) {
  const r = { angular: 0, succedent: 0, cadent: 0 };
  placements.forEach(([name, p]) => {
    if (ANGLE_NAMES.includes(name)) return;
    const h = Number(p.house);
    if ([1, 4, 7, 10].includes(h)) r.angular++;
    else if ([2, 5, 8, 11].includes(h)) r.succedent++;
    else if ([3, 6, 9, 12].includes(h)) r.cadent++;
  });
  return r;
}
function elementBreakdown(placements: Array<[string, any]>) {
  const r = { fire: 0, earth: 0, air: 0, water: 0 };
  placements.forEach(([, p]) => {
    const s = p.sign;
    if (['Aries', 'Leo', 'Sagittarius'].includes(s)) r.fire++;
    else if (['Taurus', 'Virgo', 'Capricorn'].includes(s)) r.earth++;
    else if (['Gemini', 'Libra', 'Aquarius'].includes(s)) r.air++;
    else if (['Cancer', 'Scorpio', 'Pisces'].includes(s)) r.water++;
  });
  return r;
}
function modalityBreakdown(placements: Array<[string, any]>) {
  const r = { cardinal: 0, fixed: 0, mutable: 0 };
  placements.forEach(([, p]) => {
    const s = p.sign;
    if (['Aries', 'Cancer', 'Libra', 'Capricorn'].includes(s)) r.cardinal++;
    else if (['Taurus', 'Leo', 'Scorpio', 'Aquarius'].includes(s)) r.fixed++;
    else if (['Gemini', 'Virgo', 'Sagittarius', 'Pisces'].includes(s)) r.mutable++;
  });
  return r;
}

function highestPlanet(acts: Record<string, any>) {
  let best: any = null, bestVal = -1;
  DESTINY_PLANETS.forEach((name) => {
    const p = acts[name];
    if (p) { const v = p.longitude % 30; if (v > bestVal) { bestVal = v; best = { name, ...p }; } }
  });
  return best;
}

/** Comparison tally chart (Personality vs Design) — matches DualWheelView. */
function AstroTallyChart({ title, categories, personality, design, showDesign }: {
  title: string; categories: TallyCategory[];
  personality: Record<string, number>; design: Record<string, number>; showDesign: boolean;
}) {
  const grandTotal = categories.reduce((s, c) => s + (personality[c.key] || 0) + (showDesign ? (design[c.key] || 0) : 0), 0) || 1;
  const maxStream = Math.max(1, ...categories.map(c => personality[c.key] || 0), ...categories.map(c => showDesign ? (design[c.key] || 0) : 0));
  return (
    <div>
      <strong style={{ fontSize: 10, color: 'var(--mute)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{title}</strong>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {categories.map(c => {
          const pVal = personality[c.key] || 0;
          const dVal = showDesign ? (design[c.key] || 0) : 0;
          const total = pVal + dVal;
          return (
            <div key={c.key} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 64px', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--ink)' }}><span style={{ color: c.color }}>●</span> {c.name}</span>
              <span style={{ display: 'flex', gap: 3, alignItems: 'center', height: 14 }}>
                <span style={{ display: 'flex', justifyContent: 'flex-end', flex: 1 }}>
                  {showDesign && <span title={`Design ${dVal}`} style={{ height: 12, width: `${(dVal / maxStream) * 100}%`, background: 'var(--hd-design, #a12f2f)', borderRadius: '1px 0 0 1px', minWidth: dVal ? 3 : 0 }} />}
                </span>
                <span style={{ flex: 1 }}>
                  <span title={`Personality ${pVal}`} style={{ display: 'block', height: 12, width: `${(pVal / maxStream) * 100}%`, background: primary, borderRadius: '0 1px 1px 0', minWidth: pVal ? 3 : 0 }} />
                </span>
              </span>
              <span style={{ textAlign: 'right', color: 'var(--mute)' }}>
                {showDesign ? <span style={{ color: 'var(--hd-design, #a12f2f)' }}>{dVal}</span> : null}
                {showDesign ? ' / ' : ''}<span style={{ color: primary }}>{pVal}</span>
                <span style={{ opacity: 0.6 }}> · {((total / grandTotal) * 100).toFixed(0)}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type AstroTabKey = 'insights' | 'placements' | 'aspects' | 'rulers' | 'modalities';

export function AstroPanels({
  chartData,
  sections,
  showDesign,
  designAll,
  onSelect,
}: {
  chartData: any;
  sections: SectionToggles;
  showDesign: boolean;     // include design in placements
  designAll: boolean;      // include design in every tab
  onSelect: (sectionType: string, itemKey: string, title?: string) => void;
}) {
  const acts = chartData?.birthActivations || {};
  const designActs = chartData?.designActivations || {};
  const cusps: number[] | undefined = chartData?.houseCusps;
  const hasDesign = Object.keys(designActs).length > 0;
  const designInTabs = showDesign && designAll && hasDesign; // insights/aspects/modalities
  const designInPlacements = showDesign && hasDesign;

  const buildInsights = (a: Record<string, any>): AstroInsights | null => {
    if (!chartData) return null;
    const planets: AstroPlanetLike[] = Object.entries(a).map(([name, d]: [string, any]) => ({ name, longitude: d.longitude, sign: d.sign, house: d.house }));
    return analyzeAstroInsights(planets);
  };
  const insights = useMemo(() => buildInsights(acts), [chartData, acts]);
  const designInsights = useMemo(() => (designInTabs ? buildInsights(designActs) : null), [chartData, designActs, designInTabs]);

  const moonPhase = useMemo(() => {
    if (!acts.Sun || !acts.Moon) return null;
    const angle = (acts.Moon.longitude - acts.Sun.longitude + 360) % 360;
    const phases: Array<[number, string, string]> = [
      [22.5, 'New Moon', '🌑'], [67.5, 'Waxing Crescent', '🌒'], [112.5, 'First Quarter', '🌓'],
      [157.5, 'Waxing Gibbous', '🌔'], [202.5, 'Full Moon', '🌕'], [247.5, 'Waning Gibbous', '🌖'],
      [292.5, 'Last Quarter', '🌗'], [337.5, 'Waning Crescent', '🌘'],
    ];
    const [, phaseName, phaseEmoji] = phases.find(([deg]) => angle < deg) || [360, 'New Moon', '🌑'];
    return { phaseName, phaseEmoji, sign: acts.Moon.sign, house: acts.Moon.house };
  }, [acts]);

  const houseRulers = useMemo(() => {
    if (!acts.Ascendant) return [];
    const ascSignIdx = Math.floor(acts.Ascendant.longitude / 30);
    const rulers: any[] = [];
    for (let i = 1; i <= 12; i++) {
      const houseSign = ZODIAC[(ascSignIdx + i - 1) % 12];
      const rulerName = MODERN_RULERS[houseSign];
      const rp = acts[rulerName];
      const cuspLon = cusps && cusps.length >= 13 ? cusps[i] : (ascSignIdx + i - 1) % 12 * 30;
      if (rp) rulers.push({ house: i, houseSign, rulerName, currentHouse: rp.house, sign: rp.sign, gate: rp.gate, line: rp.line, isChartRuler: i === 1, cuspLon });
    }
    return rulers;
  }, [acts, cusps]);

  const pPlacements = useMemo(() => Object.entries(acts), [acts]);
  const dPlacements = useMemo(() => Object.entries(designActs), [designActs]);

  const tabs = useMemo(() => {
    const t: Array<[AstroTabKey, string]> = [];
    if (sections.astroInsights) t.push(['insights', 'Insights']);
    if (sections.astroPlacements) t.push(['placements', 'Placements']);
    if (sections.astroAspects) t.push(['aspects', 'Aspects']);
    if (sections.houseRulers) t.push(['rulers', 'Rulers']);
    if (sections.signsModalities) t.push(['modalities', 'Modalities']);
    return t;
  }, [sections]);

  const [active, setActive] = useState<AstroTabKey>('insights');
  const effective: AstroTabKey = tabs.some(([k]) => k === active) ? active : (tabs[0]?.[0] || 'insights');

  if (!chartData || !tabs.length) return null;

  const soul = designInPlacements ? highestPlanet(designActs) : null;
  const life = highestPlanet(acts);
  const hasCusps = cusps && cusps.length >= 13;

  const tightChips = (ins: AstroInsights, color: string) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {ins.tightAspects.map((a, i) => (
        <button key={i} onClick={() => onSelect('astro_aspects', a.aspect.name, `${a.p1.name} ${a.aspect.name} ${a.p2.name}`)}
          style={{ padding: '4px 8px', background: 'rgba(212,175,55,0.05)', border: `1px solid ${color}33`, fontSize: 11.5, cursor: 'pointer', color: 'var(--ink)' }}>
          {a.p1.name} <span style={{ color: a.aspect.color }}>{a.aspect.symbol}</span> {a.p2.name} ({a.orb.toFixed(1)}°)
        </button>
      ))}
      {!ins.tightAspects.length && <span style={{ color: 'var(--mute)', fontStyle: 'italic', fontSize: 12 }}>None.</span>}
    </div>
  );

  // Aspect "hardness" → operator accent (matches the editorial .asp op classes).
  const aspectKind = (name: string): 'hard' | 'soft' | 'conj' => {
    const n = name.toLowerCase();
    if (n.includes('conjun')) return 'conj';
    if (n.includes('opposi') || n.includes('square') || n.includes('quincunx') || n.includes('semisquare')) return 'hard';
    return 'soft'; // trine, sextile, etc.
  };

  const aspectGrid = (ins: AstroInsights, label?: string) => (
    <div>
      {label && <div style={{ marginBottom: 8, fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: label === 'Design' ? 'var(--hd-design, #a12f2f)' : primary }}>{label}</div>}
      <div className="asp">
        {ins.allAspects.map((a, i) => (
          <div key={i} onClick={() => onSelect('astro_aspects', a.aspect.name, `${a.p1.name} ${a.aspect.name} ${a.p2.name}`)}
            style={{ cursor: 'pointer' }} title={`${a.p1.name} ${a.aspect.name} ${a.p2.name}`}>
            <span className="pair">
              {a.p1.name}
              <span className={`op ${aspectKind(a.aspect.name)}`}>{a.aspect.symbol}</span>
              {a.p2.name}
            </span>
            <span className="orb">{a.orb.toFixed(2)}°</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ marginTop: 24 }}>
      {/* Inner editorial tab bar */}
      <div style={{ display: 'flex', gap: 22, borderBottom: '1px solid var(--hair)', marginBottom: 18 }}>
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setActive(key)}
            style={{ background: 'none', border: 'none', borderBottom: effective === key ? `2.5px solid ${primary}` : '2.5px solid transparent',
              paddingBottom: 10, marginBottom: -1, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15,
              color: effective === key ? 'var(--ink)' : 'var(--mute)', cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Insights ── */}
      {effective === 'insights' && insights && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={cardStyle}>
              <h3 style={cardTitle}>✦ Celestial Signature {designInTabs && <span style={{ fontSize: 10, color: primary }}>· Personality</span>}</h3>
              <div style={{ marginBottom: 10 }}>
                <strong style={{ fontSize: 11, color: 'var(--mute)' }}>CHART SHAPE</strong>
                <div style={{ fontSize: 14, color: 'var(--ink)' }}>{insights.chartShape}</div>
              </div>
              <strong style={{ fontSize: 11, color: 'var(--mute)' }}>TIGHT ASPECTS (≤2°)</strong>
              {tightChips(insights, primary)}
            </div>
            {designInTabs && designInsights ? (
              <div style={cardStyle}>
                <h3 style={{ ...cardTitle, color: 'var(--hd-design, #a12f2f)' }}>✦ Celestial Signature <span style={{ fontSize: 10 }}>· Design</span></h3>
                <div style={{ marginBottom: 10 }}>
                  <strong style={{ fontSize: 11, color: 'var(--mute)' }}>CHART SHAPE</strong>
                  <div style={{ fontSize: 14, color: 'var(--ink)' }}>{designInsights.chartShape}</div>
                </div>
                <strong style={{ fontSize: 11, color: 'var(--mute)' }}>TIGHT ASPECTS (≤2°)</strong>
                {tightChips(designInsights, 'var(--hd-design, #a12f2f)')}
              </div>
            ) : sections.moonPhase && moonPhase ? (
              <div style={cardStyle}>
                <h3 style={cardTitle}>✦ Moon Phase</h3>
                <div style={{ fontSize: 30 }}>{moonPhase.phaseEmoji}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--ink)', marginTop: 4 }}>{moonPhase.phaseName}</div>
                <button onClick={() => onSelect('astro_signs', moonPhase.sign, moonPhase.sign)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: 'var(--mute)', marginTop: 4 }}>
                  Moon in {moonPhase.sign} · House {moonPhase.house}
                </button>
              </div>
            ) : <div />}
          </div>
          {designInTabs && sections.moonPhase && moonPhase && (
            <div style={cardStyle}>
              <h3 style={cardTitle}>✦ Moon Phase</h3>
              <span style={{ fontSize: 22 }}>{moonPhase.phaseEmoji}</span> <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink)' }}>{moonPhase.phaseName} · Moon in {moonPhase.sign} (H{moonPhase.house})</span>
            </div>
          )}
          {(insights.stelliums.length > 0 || insights.patternAlerts.length > 0) && (
            <div style={cardStyle}>
              {insights.stelliums.length > 0 && (
                <div style={{ marginBottom: insights.patternAlerts.length ? 14 : 0 }}>
                  <h3 style={cardTitle}>✦ Stelliums</h3>
                  {insights.stelliums.map((s, i) => (
                    <button key={i} onClick={() => onSelect('astro_signs', s.sign, s.sign)}
                      style={{ display: 'block', background: 'none', border: 'none', padding: '2px 0', textAlign: 'left', cursor: 'pointer', color: 'var(--ink)', fontSize: 13.5 }}>
                      <strong>{s.sign} (H{s.planets[0]?.house || '—'}):</strong> {s.planets.map((p) => p.name).join(', ')}
                    </button>
                  ))}
                </div>
              )}
              {insights.patternAlerts.length > 0 && (
                <div>
                  <h3 style={cardTitle}>✦ Celestial Patterns</h3>
                  {insights.patternAlerts.map((a, i) => <div key={i} style={{ color: 'var(--ink)', fontSize: 13.5, padding: '2px 0' }}>{a}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Placements ── */}
      {effective === 'placements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: designInPlacements ? '1fr 1fr' : '1fr', gap: 16 }}>
            {designInPlacements && (
              <AstroPlacementsTable activations={designActs} title="Design" color="var(--hd-design, #a12f2f)"
                onSelect={(name) => onSelect('astro_planets', name, name)} />
            )}
            <AstroPlacementsTable activations={acts} title="Personality" color="var(--hd-personality, var(--ink, #1b1830))"
              onSelect={(name) => onSelect('astro_planets', name, name)} />
          </div>

          {(soul || life) && (
            <div style={{ display: 'grid', gridTemplateColumns: soul && life ? '1fr 1fr' : '1fr', gap: 16 }}>
              {soul && (
                <button onClick={() => onSelect('hd_destiny_points', 'soul-purpose', 'Soul Purpose')} style={{ ...cardStyle, textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: primary, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>✦ Soul Purpose (Design)</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink)' }}>{soul.name} in {soul.sign}</div>
                  <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 4 }}>{formatDeg(soul.longitude)} · House {soul.house || '—'} · Gate {soul.gate}.{soul.line}</div>
                </button>
              )}
              {life && (
                <button onClick={() => onSelect('hd_destiny_points', 'life-purpose', 'Life Purpose')} style={{ ...cardStyle, textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: primary, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>✦ Life Purpose (Personality)</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink)' }}>{life.name} in {life.sign}</div>
                  <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 4 }}>{formatDeg(life.longitude)} · House {life.house || '—'} · Gate {life.gate}.{life.line}</div>
                </button>
              )}
            </div>
          )}

          {sections.angles && (
            <div style={cardStyle}>
              <h3 style={cardTitle}>✦ Angels</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                {[
                  ['Conscious Sun', acts.Sun], ['Conscious Earth', acts.Earth],
                  ['Unconscious Sun', designActs.Sun], ['Unconscious Earth', designActs.Earth],
                ].map(([label, act]: any, i) => {
                  const angel = getAngelOverlay(act?.longitude);
                  if (!act || !angel) return null;
                  return (
                    <div key={i} style={{ border: '1px solid var(--hair)', padding: '8px 10px' }}>
                      <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: primary, marginBottom: 3 }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink)' }}>{angel.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--mute)' }}>{formatAngelDegree(angel)} · Gate {angel.gate}.{angel.line}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Aspects ── */}
      {effective === 'aspects' && insights && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {aspectGrid(insights, designInTabs ? 'Personality' : undefined)}
          {designInTabs && designInsights && designInsights.allAspects.length > 0 && aspectGrid(designInsights, 'Design')}
        </div>
      )}

      {/* ── Rulers (+ cusps when available) ── */}
      {effective === 'rulers' && houseRulers.length > 0 && (
        <div style={cardStyle}>
          <h3 style={cardTitle}>✦ House &amp; Chart Rulers</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead><tr style={{ borderBottom: '1px solid var(--hair)', textAlign: 'left', color: 'var(--mute)' }}>
                <th style={{ padding: 6 }}>House</th>{hasCusps && <th style={{ padding: 6 }}>Cusp</th>}<th style={{ padding: 6 }}>Sign</th><th style={{ padding: 6 }}>Ruler</th><th style={{ padding: 6 }}>Location</th>
              </tr></thead>
              <tbody>
                {houseRulers.map((r) => (
                  <tr key={r.house} style={{ borderBottom: '1px solid var(--hair)', cursor: 'pointer' }}
                    onClick={() => onSelect('astro_houses', String(r.house), `House ${r.house}`)}>
                    <td style={{ padding: 6, fontWeight: 700 }}>{r.house}</td>
                    {hasCusps && <td style={{ padding: 6, color: 'var(--mute)' }}>{formatDeg(r.cuspLon)} {signFromLon(r.cuspLon)}</td>}
                    <td style={{ padding: 6 }}>{r.houseSign}</td>
                    <td style={{ padding: 6, color: primary }}>{r.rulerName}{r.isChartRuler && <span title="Chart ruler" style={{ marginLeft: 4 }}>★</span>}</td>
                    <td style={{ padding: 6, color: 'var(--mute)' }}>H{r.currentHouse} ({r.sign}) · Gate {r.gate}.{r.line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 10, color: 'var(--mute)', marginTop: 8 }}>★ = chart ruler (ruler of the Ascendant sign){hasCusps ? ' · cusps from Placidus' : ''}</p>
        </div>
      )}

      {/* ── Modalities (rich tally graphs, P vs D) ── */}
      {effective === 'modalities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardStyle}>
            <AstroTallyChart title="House Quadruplicities" categories={houseCategories}
              personality={houseBreakdown(pPlacements)} design={houseBreakdown(dPlacements)} showDesign={designInTabs} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={cardStyle}>
              <AstroTallyChart title="Elements" categories={elementCategories}
                personality={elementBreakdown(pPlacements)} design={elementBreakdown(dPlacements)} showDesign={designInTabs} />
            </div>
            <div style={cardStyle}>
              <AstroTallyChart title="Modalities" categories={modalityCategories}
                personality={modalityBreakdown(pPlacements)} design={modalityBreakdown(dPlacements)} showDesign={designInTabs} />
            </div>
          </div>
          {designInTabs && <p style={{ fontSize: 10, color: 'var(--mute)' }}><span style={{ color: 'var(--hd-design, #a12f2f)' }}>●</span> Design &nbsp; <span style={{ color: primary }}>●</span> Personality</p>}
        </div>
      )}
    </div>
  );
}
