import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { EphemerisService } from '../services/EphemerisService';
import { AstroWheel } from '../components/AstroWheel';
import ChartAttributionFooter from '../components/ChartAttributionFooter';
import { analyzeAstroInsights, AstroInsights, AstroPlanetLike } from '../services/AstroInsights';
import { getAngelOverlay, formatAngelDegree } from '../services/AngelOverlayService';
import { HumanDesignLogic } from '../services/HumanDesignLogic';
import { ChartConfig, AstroCardToggles, DEFAULT_ASTRO_CARD_TOGGLES, ASPECT_ORB_MAX } from '../services/chartConfig';
import { AstroPlacementsTable, AstroAspectsTable } from '../components/AstroDataTables';
import { HouseSystemToggle } from '../components/HouseSystemToggle';
import { KitMeter } from '../components/KitBars';
import { formatLongitude } from '../services/degreeFormat';

const ELEMENT_COLOR: Record<string, string> = {
  fire: 'var(--astro-fire, #f87171)',
  earth: 'var(--astro-earth, #86efac)',
  air: 'var(--astro-air, #7dd3fc)',
  water: 'var(--astro-water, #a5b4fc)',
};

const ZODIAC_SIGNS = [
  { name: 'Aries', element: 'fire' },
  { name: 'Taurus', element: 'earth' },
  { name: 'Gemini', element: 'air' },
  { name: 'Cancer', element: 'water' },
  { name: 'Leo', element: 'fire' },
  { name: 'Virgo', element: 'earth' },
  { name: 'Libra', element: 'air' },
  { name: 'Scorpio', element: 'water' },
  { name: 'Sagittarius', element: 'fire' },
  { name: 'Capricorn', element: 'earth' },
  { name: 'Aquarius', element: 'air' },
  { name: 'Pisces', element: 'water' },
];

const MODERN_RULERS: Record<string, string> = {
  Aries: 'Mars',
  Taurus: 'Venus',
  Gemini: 'Mercury',
  Cancer: 'Moon',
  Leo: 'Sun',
  Virgo: 'Mercury',
  Libra: 'Venus',
  Scorpio: 'Pluto',
  Sagittarius: 'Jupiter',
  Capricorn: 'Saturn',
  Aquarius: 'Uranus',
  Pisces: 'Neptune',
};

const REST_ROOT = (() => {
  const d = (window as any).LunaCcoData || {};
  return (d.root || '/wp-json/').replace(/\/$/, '') + '/';
})();
const NONCE = (() => ((window as any).LunaCcoData || {}).nonce || '')();

async function fetchJSON(path: string, init: RequestInit = {}) {
  const res = await fetch(REST_ROOT + path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': NONCE,
      ...((init as any).headers || {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error((body && body.message) || `${res.status}`);
  return body;
}

type Props = {
  initialDate?: string;
  initialTime?: string;
  initialLat?: string;
  initialLng?: string;
  initialTimezone?: string;
  triggerCalc?: number;
  onChartReady?: (data: any) => void;
  chartData?: any;
  profileIdentity?: any;
  /** Chart Maker config: gates each card, design side, angels, cusps, wheel layers. */
  config?: ChartConfig;
  /** Preview mode hides the standalone chrome (header/house-system toggle, wheel checkboxes). */
  previewMode?: boolean;
  /** Selected asteroids (each with .personality/.design positions) to fold into placements + aspects. */
  asteroids?: any[];
  /** Embedded inside a scrolling parent (e.g. Chart Maker preset) — disables this
   *  view's own inner scroll so there's a single scrollbar, not two. */
  embedded?: boolean;
};

type SidebarSelectionItem = {
  sectionType: string;
  itemKey: string;
  title: string;
};

type FocusState = {
  planet?: string;
  sign?: string;
  house?: number;
  aspectKey?: string;
  stream?: 'personality' | 'design';
  activeMoonPhase?: boolean;
  activeDestiny?: boolean;
  activeStellium?: string;
  activeChartShape?: string;
};

function aspectKeyOf(a: { p1: { name: string }; p2: { name: string }; aspect: { name: string } }) {
  return `${a.p1.name}-${a.aspect.name}-${a.p2.name}`;
}

function astroAngleKey(planetName: string) {
  switch (planetName) {
    case 'Ascendant': return 'ASC';
    case 'Descendant': return 'DC';
    case 'Midheaven': return 'MC';
    case 'Imum Coeli': return 'IC';
    default: return planetName;
  }
}

function astroPlanetKey(planetName: string) {
  if (planetName === 'Black Moon Lilith') return 'Lilith';
  return planetName;
}

function editorialCardStyle(active = false): CSSProperties {
  // Flat broadsheet-kit card: hairline border, no radius, no shadow (matches .icard).
  return {
    background: active ? 'color-mix(in srgb, var(--gold, #d4af37) 6%, var(--card))' : 'var(--card)',
    border: active ? '1px solid var(--gold)' : '1px solid var(--hair)',
    borderRadius: 0,
  };
}

type TallyCategory = {
  name: string;
  key: string;
  details: string;
  desc: string;
  color: string;
};

const houseCategories: TallyCategory[] = [
  { name: 'Angular Houses', details: 'Houses 1, 4, 7, 10', key: 'angular', desc: 'Focuses on action, self-projection, foundations, relationships, and career.', color: 'var(--gold, #d4af37)' },
  { name: 'Succedent Houses', details: 'Houses 2, 5, 8, 11', key: 'succedent', desc: 'Focuses on resources, security, self-expression, and community.', color: 'var(--indigo, #5c59c2)' },
  { name: 'Cadent Houses', details: 'Houses 3, 6, 9, 12', key: 'cadent', desc: 'Focuses on learning, mental processing, local environment, and adaptation.', color: 'var(--hd-design, #a12f2f)' },
];

const elementCategories: TallyCategory[] = [
  { name: 'Fire Element', details: 'Aries, Leo, Sagittarius', key: 'fire', desc: 'Represents enthusiasm, passion, inspiration, drive, and vital energy.', color: 'var(--astro-fire, #f87171)' },
  { name: 'Earth Element', details: 'Taurus, Virgo, Capricorn', key: 'earth', desc: 'Represents practicality, stability, material reality, patience, and form.', color: 'var(--astro-earth, #86efac)' },
  { name: 'Air Element', details: 'Gemini, Libra, Aquarius', key: 'air', desc: 'Represents intellect, communication, social connections, ideas, and perspective.', color: 'var(--astro-air, #7dd3fc)' },
  { name: 'Water Element', details: 'Cancer, Scorpio, Pisces', key: 'water', desc: 'Represents emotions, intuition, depth, relationships, and spiritual adaptation.', color: 'var(--astro-water, #a5b4fc)' },
];

const modalityCategories: TallyCategory[] = [
  { name: 'Cardinal Modality', details: 'Aries, Cancer, Libra, Capricorn', key: 'cardinal', desc: 'Represents initiative, leadership, starting new projects, and forward momentum.', color: 'var(--gold, #d4af37)' },
  { name: 'Fixed Modality', details: 'Taurus, Leo, Scorpio, Aquarius', key: 'fixed', desc: 'Represents concentration, persistence, stability, determination, and consolidation.', color: 'var(--indigo, #5c59c2)' },
  { name: 'Mutable Modality', details: 'Gemini, Virgo, Sagittarius, Pisces', key: 'mutable', desc: 'Represents flexibility, adaptability, change, transition, and versatility.', color: 'var(--hd-design, #a12f2f)' },
];

function AstroTallyChart({ categories, personality, design, showDesign = true }: {
  categories: TallyCategory[];
  personality: Record<string, number>;
  design: Record<string, number>;
  showDesign?: boolean;
}) {
  const grandTotal = categories.reduce((sum, c) => sum + (personality[c.key] || 0) + (showDesign ? (design[c.key] || 0) : 0), 0) || 1;
  const maxSingleStream = Math.max(
    1,
    ...categories.map(c => personality[c.key] || 0),
    ...categories.map(c => showDesign ? (design[c.key] || 0) : 0)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--hair, #e5e5e5)' }}>
            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--mute)' }}>Classification</th>
            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--mute)', width: '35%' }}>{showDesign ? 'Distribution (P vs D)' : 'Distribution'}</th>
            {showDesign && <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--hd-design, #a12f2f)' }}>Design</th>}
            <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gold, #d4af37)' }}>Personality</th>
            <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--ink)' }}>Total</th>
            <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--mute)' }}>%</th>
          </tr>
        </thead>
        <tbody>
          {categories.map(c => {
            const pVal = personality[c.key] || 0;
            const dVal = showDesign ? (design[c.key] || 0) : 0;
            const rowTotal = pVal + dVal;
            const percentage = ((rowTotal / grandTotal) * 100).toFixed(1) + '%';
            
            // Determine dominance description
            let dominanceText = '';
            let dominanceColor = 'var(--mute)';
            if (pVal > dVal) {
              dominanceText = `Personality +${pVal - dVal}`;
              dominanceColor = 'var(--gold, #d4af37)';
            } else if (dVal > pVal) {
              dominanceText = `Design +${dVal - pVal}`;
              dominanceColor = 'var(--hd-design, #a12f2f)';
            } else {
              dominanceText = 'Balanced';
              dominanceColor = 'var(--mute)';
            }

            return (
              <tr key={c.key} style={{ borderBottom: '1px solid var(--hair, #e5e5e5)' }}>
                {/* Classification Info */}
                <td style={{ padding: '14px 12px', verticalAlign: 'middle' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>{c.details}</div>
                </td>
                
                {/* Visual Side-by-Side Horizontal Bars */}
                <td style={{ padding: '14px 12px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Personality Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, width: 12, fontWeight: 700, color: 'var(--gold, #d4af37)' }}>P</span>
                      <KitMeter value={pVal} max={maxSingleStream} color="var(--gold, #d4af37)" height={8} />
                    </div>
                    {/* Design Bar */}
                    {showDesign && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, width: 12, fontWeight: 700, color: 'var(--hd-design, #a12f2f)' }}>D</span>
                      <KitMeter value={dVal} max={maxSingleStream} color="var(--hd-design, #a12f2f)" height={8} />
                    </div>
                    )}
                  </div>
                </td>

                {/* Counts */}
                {showDesign && (
                <td style={{ textAlign: 'center', padding: '14px 12px', fontWeight: 800, fontSize: 15, color: 'var(--hd-design, #a12f2f)', verticalAlign: 'middle' }}>
                  {dVal}
                </td>
                )}
                <td style={{ textAlign: 'center', padding: '14px 12px', fontWeight: 800, fontSize: 15, color: 'var(--gold, #d4af37)', verticalAlign: 'middle' }}>
                  {pVal}
                </td>
                <td style={{ textAlign: 'center', padding: '14px 12px', fontWeight: 800, fontSize: 15, color: 'var(--ink)', verticalAlign: 'middle' }}>
                  {rowTotal}
                </td>
                
                {/* Percentage & Dominance indicator */}
                <td style={{ textAlign: 'right', padding: '14px 12px', verticalAlign: 'middle' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{percentage}</div>
                  {showDesign && (
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: dominanceColor, marginTop: 3 }}>
                      {dominanceText}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DualWheelView({
  initialDate = '',
  initialTime = '',
  initialLat = '',
  initialLng = '',
  initialTimezone = '',
  triggerCalc = 0,
  onChartReady,
  chartData: externalChartData,
  profileIdentity,
  config,
  previewMode = false,
  gateChartType = 'dual_wheel',
  gatePresetKey = null,
  asteroids = [],
  embedded = false,
}: Props) {
  // Card / design / angel gating. Without a config, behave exactly as the
  // standalone Dual Astrology Map (every card on, both streams shown).
  const cards: AstroCardToggles = config?.astroCards ?? DEFAULT_ASTRO_CARD_TOGGLES;
  const showDesign = config ? config.wheels.astroShowDesign : true;
  // Per-tab design inclusion. Without a config (standalone), show design everywhere.
  const designTabs = config
    ? (config.wheels.astroDesignTabs || { insights: false, aspects: false, placements: true })
    : { insights: true, aspects: true, placements: true };
  const designInInsights = showDesign && designTabs.insights;
  const designInAspects = showDesign && designTabs.aspects;
  const designInPlacements = showDesign && designTabs.placements;
  // Per-side planet allow-lists (undefined = all).
  const planetSel = config?.planets;
  const allowPlanet = (stream: 'personality' | 'design', name: string) => {
    const list = stream === 'design' ? planetSel?.design : planetSel?.personality;
    return !list || list.includes(name);
  };
  const filterActs = (acts: any, stream: 'personality' | 'design') => {
    const list = stream === 'design' ? planetSel?.design : planetSel?.personality;
    if (!list) return acts;
    const out: any = {};
    Object.keys(acts || {}).forEach((k) => { if (list.includes(k)) out[k] = acts[k]; });
    return out;
  };

  // Aspect display filter: respect per-type toggles + orb tier (Chart Maker only).
  const orbMax = config ? ASPECT_ORB_MAX[config.wheels.aspectOrbFilter] : Infinity;
  const aspectAllowed = (a: any) => {
    if (!a) return false;
    if (config) {
      const key = String(a.aspect?.name || '').toLowerCase();
      const toggles: any = config.wheels.aspects;
      if (key in toggles && !toggles[key]) return false;
    }
    return (a.orb ?? 0) <= orbMax;
  };
  const includeAsteroidAspects = config ? config.wheels.aspectsIncludeAsteroids : true;
  // Merge selected asteroids into an activations object so the wheel draws their glyphs.
  const withAsteroids = (acts: any, stream: 'personality' | 'design') => {
    if (!asteroids?.length) return acts;
    const out: any = { ...acts };
    asteroidRows(stream).forEach(([name, pos]) => {
      out[name] = { longitude: pos.longitude, sign: pos.sign, house: pos.house, isRetrograde: pos.isRetrograde };
    });
    return out;
  };
  // Asteroid placement rows for one side: [name, posData] like a placement entry.
  const asteroidRows = (stream: 'personality' | 'design') =>
    (asteroids || [])
      .map((a) => {
        const pos = stream === 'design' ? a.design : a.personality;
        return pos ? ([a.name, { ...pos, symbol: a.symbol, isAsteroid: true }] as [string, any]) : null;
      })
      .filter(Boolean) as Array<[string, any]>;
  const anyInsightCard = cards.classifications || cards.moonPhase || cards.purpose
    || cards.signature || cards.chartRuler || cards.chartShape || cards.tightAspects
    || cards.stelliums || cards.houseRulers;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localChartData, setLocalChartData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('Wheel');
  const [showAspects, setShowAspects] = useState(true);
  const [showCrossPoints, setShowCrossPoints] = useState(true);
  const [focus, setFocus] = useState<FocusState>({});
  const [insightsSubTab, setInsightsSubTab] = useState<'houses' | 'elements' | 'modalities'>('houses');
  const [houseSystem, setHouseSystem] = useState<'whole_house' | 'placidus' | 'koch'>(config?.houseSystem || 'whole_house');
  const [copiedPlacements, setCopiedPlacements] = useState(false);

  const prevTrigger = useRef(triggerCalc);
  const prevHouseSystem = useRef(houseSystem);
  const chartData = externalChartData || localChartData;

  // Hook pulled once during render — never inside calculate() (avoids React error #321).
  const { saveChartCache } = (window as any).LunaCcoHooks?.useUser?.() || {};

  const form = {
    date: initialDate,
    time: initialTime || '12:00',
    latitude: initialLat,
    longitude: initialLng,
    timezone: initialTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };

  async function calculate() {
    if (externalChartData) return;
    if (!form.date || !form.latitude || !form.longitude) {
      setError('Birth date and location are required.');
      return;
    }
    setError(null);
    setLocalChartData(null);
    setBusy(true);
    try {
      const svc = EphemerisService.getInstance();
      const formWithHouse = {
        ...form,
        houseSystem,
      };

      const cache = profileIdentity?.chart_cache || {};
      const cacheKey = `natal_${houseSystem}`;
      if (cache[cacheKey]) {
        const cached = cache[cacheKey];
        const cachedDate = cached.input?.date?.substring(0, 16);
        const formDate = form.date?.substring(0, 16);
        if (cachedDate === formDate) {
          const deserialized = deserializeChart(cached.data);
          setLocalChartData(deserialized);
          onChartReady?.(deserialized);
          setBusy(false);
          return;
        }
      }

      const personId = profileIdentity?.id !== undefined ? profileIdentity.id : null;
      const tokenRes = await fetchJSON('luna-astrohd/v1/calc-token', {
        method: 'POST',
        body: JSON.stringify({ chart_type: gateChartType || 'dual_wheel', preset_key: gatePresetKey || undefined, person_id: personId })
      });
      const data = await svc.getChartData(formWithHouse);
      setLocalChartData(data);
      onChartReady?.(data);

      if (typeof saveChartCache === 'function') {
        await saveChartCache(personId, cacheKey, {
          input: formWithHouse,
          data: serializeChart(data),
          token: tokenRes?.token,
        });
      }
    } catch (e: any) {
      setError(e?.message || 'Calculation failed.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (externalChartData) return;
    if (triggerCalc !== prevTrigger.current || houseSystem !== prevHouseSystem.current) {
      prevTrigger.current = triggerCalc;
      prevHouseSystem.current = houseSystem;
      calculate();
    }
  });

  useEffect(() => {
    if (externalChartData) return;
    if (initialDate && initialLat && initialLng) calculate();
  }, [externalChartData, houseSystem]); // eslint-disable-line

  const birthActs = chartData?.birthActivations || {};
  const designActs = chartData?.designActivations || {};

  const asteroidPoints = (stream: 'personality' | 'design'): AstroPlanetLike[] =>
    includeAsteroidAspects
      ? asteroidRows(stream).map(([name, pos]) => ({ name, longitude: pos.longitude, sign: pos.sign, house: pos.house }))
      : [];

  const personalityInsights = useMemo<AstroInsights | null>(() => {
    if (!chartData || !chartData.birthActivations) return null;
    const planets: AstroPlanetLike[] = Object.entries(chartData.birthActivations).map(([name, data]: [string, any]) => ({
      name,
      longitude: data.longitude,
      sign: data.sign,
      house: data.house,
    }));
    return analyzeAstroInsights([...planets, ...asteroidPoints('personality')]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, asteroids, includeAsteroidAspects]);

  const designInsights = useMemo<AstroInsights | null>(() => {
    if (!chartData || !chartData.designActivations) return null;
    const planets: AstroPlanetLike[] = Object.entries(chartData.designActivations).map(([name, data]: [string, any]) => ({
      name,
      longitude: data.longitude,
      sign: data.sign,
      house: data.house,
    }));
    return analyzeAstroInsights([...planets, ...asteroidPoints('design')]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, asteroids, includeAsteroidAspects]);

  // Aspects after applying per-type + orb-tier filters (Chart Maker).
  const pTightAspects = (personalityInsights?.tightAspects || []).filter(aspectAllowed);
  const dTightAspects = (designInsights?.tightAspects || []).filter(aspectAllowed);
  const pAllAspects = (personalityInsights?.allAspects || []).filter(aspectAllowed);
  const dAllAspects = (designInsights?.allAspects || []).filter(aspectAllowed);

  const getPlacements = (activations: any) => {
    if (!activations) return [];
    return Object.entries(activations).sort((a: any, b: any) => {
      const order = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'NorthNode', 'SouthNode', 'Black Moon Lilith', 'Vulcan', 'Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex'];
      return order.indexOf(a[0]) - order.indexOf(b[0]);
    }).filter(([name]) => name !== 'Earth');
  };

  const personalityPlacements = useMemo(
    () => getPlacements(chartData?.birthActivations).filter(([name]: [string, any]) => allowPlanet('personality', name)),
    [chartData, planetSel]); // eslint-disable-line react-hooks/exhaustive-deps
  const designPlacements = useMemo(
    () => getPlacements(chartData?.designActivations).filter(([name]: [string, any]) => allowPlanet('design', name)),
    [chartData, planetSel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Placement lists with selected asteroids folded in (display only).
  const personalityPlacementsDisplay = useMemo(
    () => [...personalityPlacements, ...asteroidRows('personality')],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [personalityPlacements, asteroids]);
  const designPlacementsDisplay = useMemo(
    () => [...designPlacements, ...asteroidRows('design')],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [designPlacements, asteroids]);

  const handleCopyPlacements = () => {
    if (!chartData) return;

    let text = '--- PERSONALITY PLACEMENTS ---\n';
    personalityPlacements.forEach(([name, data]: [string, any]) => {
      text += `${name} in ${data.sign} - ${formatDeg(data.longitude)} - House ${data.house || '—'} - Gate ${data.gate}.${data.line}${data.isRetrograde ? ' (℞)' : ''}\n`;
    });

    if (chartData.houseCusps && chartData.houseCusps.length >= 13) {
      text += '\nConscious House Cusps:\n';
      Array.from({ length: 12 }).forEach((_, idx) => {
        const houseNum = idx + 1;
        const lon = chartData.houseCusps[houseNum];
        const hd = HumanDesignLogic.calculateActivation(lon);
        text += `House ${houseNum} Cusp: ${hd.sign} - ${formatDeg(lon)} - Gate ${hd.gate}.${hd.line}\n`;
      });
    }

    text += '\n--- DESIGN PLACEMENTS ---\n';
    designPlacements.forEach(([name, data]: [string, any]) => {
      text += `${name} in ${data.sign} - ${formatDeg(data.longitude)} - House ${data.house || '—'} - Gate ${data.gate}.${data.line}${data.isRetrograde ? ' (℞)' : ''}\n`;
    });

    if (chartData.designHouseCusps && chartData.designHouseCusps.length >= 13) {
      text += '\nUnconscious House Cusps:\n';
      Array.from({ length: 12 }).forEach((_, idx) => {
        const houseNum = idx + 1;
        const lon = chartData.designHouseCusps[houseNum];
        const hd = HumanDesignLogic.calculateActivation(lon);
        text += `House ${houseNum} Cusp: ${hd.sign} - ${formatDeg(lon)} - Gate ${hd.gate}.${hd.line}\n`;
      });
    }

    const copyToClipboard = (val: string) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(val);
      }
      const textArea = document.createElement('textarea');
      textArea.value = val;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful ? Promise.resolve() : Promise.reject(new Error('execCommand copy failed'));
      } catch (err) {
        document.body.removeChild(textArea);
        return Promise.reject(err);
      }
    };

    copyToClipboard(text).then(() => {
      setCopiedPlacements(true);
      setTimeout(() => setCopiedPlacements(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const getHouseBreakdown = (placements: any[]) => {
    let angular = 0;
    let succedent = 0;
    let cadent = 0;

    placements.forEach(([name, p]) => {
      // Exclude angles/points
      if (['Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex'].includes(name)) return;
      const h = Number(p.house);
      if (!h) return;
      if ([1, 4, 7, 10].includes(h)) angular++;
      else if ([2, 5, 8, 11].includes(h)) succedent++;
      else if ([3, 6, 9, 12].includes(h)) cadent++;
    });

    return { angular, succedent, cadent };
  };

  const personalityHouseBreakdown = useMemo(() => getHouseBreakdown(personalityPlacements), [personalityPlacements]);
  const designHouseBreakdown = useMemo(() => getHouseBreakdown(designPlacements), [designPlacements]);

  const getElementBreakdown = (placements: any[]) => {
    let fire = 0;
    let earth = 0;
    let air = 0;
    let water = 0;

    placements.forEach(([name, p]) => {
      const sign = p.sign;
      if (!sign) return;
      
      if (['Aries', 'Leo', 'Sagittarius'].includes(sign)) fire++;
      else if (['Taurus', 'Virgo', 'Capricorn'].includes(sign)) earth++;
      else if (['Gemini', 'Libra', 'Aquarius'].includes(sign)) air++;
      else if (['Cancer', 'Scorpio', 'Pisces'].includes(sign)) water++;
    });

    return { fire, earth, air, water };
  };

  const getModalityBreakdown = (placements: any[]) => {
    let cardinal = 0;
    let fixed = 0;
    let mutable = 0;

    placements.forEach(([name, p]) => {
      const sign = p.sign;
      if (!sign) return;
      
      if (['Aries', 'Cancer', 'Libra', 'Capricorn'].includes(sign)) cardinal++;
      else if (['Taurus', 'Leo', 'Scorpio', 'Aquarius'].includes(sign)) fixed++;
      else if (['Gemini', 'Virgo', 'Sagittarius', 'Pisces'].includes(sign)) mutable++;
    });

    return { cardinal, fixed, mutable };
  };

  const personalityElementBreakdown = useMemo(() => getElementBreakdown(personalityPlacements), [personalityPlacements]);
  const designElementBreakdown = useMemo(() => getElementBreakdown(designPlacements), [designPlacements]);

  const personalityModalityBreakdown = useMemo(() => getModalityBreakdown(personalityPlacements), [personalityPlacements]);
  const designModalityBreakdown = useMemo(() => getModalityBreakdown(designPlacements), [designPlacements]);

  const getMoonPhase = (acts: any) => {
    if (!acts.Sun || !acts.Moon) return null;
    const sunLong = acts.Sun.longitude;
    const moonLong = acts.Moon.longitude;
    const phaseAngle = (moonLong - sunLong + 360) % 360;

    if (phaseAngle < 22.5) return { phaseName: 'New Moon', phaseEmoji: '🌑', angle: phaseAngle, sign: acts.Moon.sign, house: acts.Moon.house };
    if (phaseAngle < 67.5) return { phaseName: 'Waxing Crescent', phaseEmoji: '🌒', angle: phaseAngle, sign: acts.Moon.sign, house: acts.Moon.house };
    if (phaseAngle < 112.5) return { phaseName: 'First Quarter', phaseEmoji: '🌓', angle: phaseAngle, sign: acts.Moon.sign, house: acts.Moon.house };
    if (phaseAngle < 157.5) return { phaseName: 'Waxing Gibbous', phaseEmoji: '🌔', angle: phaseAngle, sign: acts.Moon.sign, house: acts.Moon.house };
    if (phaseAngle < 202.5) return { phaseName: 'Full Moon', phaseEmoji: '🌕', angle: phaseAngle, sign: acts.Moon.sign, house: acts.Moon.house };
    if (phaseAngle < 247.5) return { phaseName: 'Waning Gibbous', phaseEmoji: '🌖', angle: phaseAngle, sign: acts.Moon.sign, house: acts.Moon.house };
    if (phaseAngle < 292.5) return { phaseName: 'Last Quarter', phaseEmoji: '🌗', angle: phaseAngle, sign: acts.Moon.sign, house: acts.Moon.house };
    if (phaseAngle < 337.5) return { phaseName: 'Waning Crescent', phaseEmoji: '🌘', angle: phaseAngle, sign: acts.Moon.sign, house: acts.Moon.house };
    return { phaseName: 'New Moon', phaseEmoji: '🌑', angle: phaseAngle, sign: acts.Moon.sign, house: acts.Moon.house };
  };

  const personalityMoonPhase = useMemo(() => getMoonPhase(birthActs), [birthActs]);
  const designMoonPhase = useMemo(() => getMoonPhase(designActs), [designActs]);

  const getHouseRulers = (acts: any) => {
    if (!acts.Ascendant) return [];
    const ascLong = acts.Ascendant.longitude;
    const rulers = [];
    for (let i = 1; i <= 12; i++) {
      const ascSignIdx = Math.floor(ascLong / 30);
      const houseSignIdx = (ascSignIdx + i - 1) % 12;
      const houseSign = ZODIAC_SIGNS[houseSignIdx].name;
      const rulerName = MODERN_RULERS[houseSign];
      const rulerPlanet = acts[rulerName];
      if (rulerPlanet) {
        rulers.push({ house: i, houseSign, rulerName, currentHouse: rulerPlanet.house, sign: rulerPlanet.sign, gate: rulerPlanet.gate, line: rulerPlanet.line });
      }
    }
    return rulers;
  };

  const personalityHouseRulers = useMemo(() => getHouseRulers(birthActs), [birthActs]);
  const designHouseRulers = useMemo(() => getHouseRulers(designActs), [designActs]);

  const getDestinyLifePurpose = (acts: any) => {
    if (!chartData) return null;
    const allowed = ['Sun', 'Earth', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'NorthNode', 'Chiron'];
    let best: any = null;
    let bestVal = -1;
    allowed.forEach(name => {
      const p = acts[name];
      if (p) {
        const val = p.longitude % 30;
        if (val > bestVal) {
          bestVal = val;
          best = { name, ...p };
        }
      }
    });
    return best;
  };

  const personalityDestiny = useMemo(() => getDestinyLifePurpose(birthActs), [birthActs]);
  const designDestiny = useMemo(() => getDestinyLifePurpose(designActs), [designActs]);

  const getDominantPlacement = (acts: any) => {
    const sun = acts.Sun ? { name: 'Sun', ...acts.Sun } : null;
    const moon = acts.Moon ? { name: 'Moon', ...acts.Moon } : null;
    const rising = acts.Ascendant ? { name: 'Ascendant', ...acts.Ascendant } : null;
    return sun || moon || rising;
  };

  const personalityDominant = useMemo(() => getDominantPlacement(birthActs), [birthActs]);
  const designDominant = useMemo(() => getDominantPlacement(designActs), [designActs]);

  const getChartRuler = (acts: any) => {
    const risingSign = acts.Ascendant?.sign;
    if (!risingSign) return null;
    const rulerName = MODERN_RULERS[risingSign];
    const planet = acts[rulerName];
    return planet ? { name: rulerName, ...planet } : null;
  };

  const personalityChartRuler = useMemo(() => getChartRuler(birthActs), [birthActs]);
  const designChartRuler = useMemo(() => getChartRuler(designActs), [designActs]);

  const degreeFormat = config?.wheels?.degreeFormat || 'compact';
  const formatDeg = (lon: number) => formatLongitude(lon, degreeFormat);

  const angelLine = (longitude: number | undefined) => {
    const angel = getAngelOverlay(longitude);
    return angel ? `${angel.name} · ${formatAngelDegree(angel)}` : '';
  };

  const dispatchSelection = (items: SidebarSelectionItem[], nextFocus?: FocusState) => {
    const filtered = items.filter(item => item.sectionType && item.itemKey);
    if (!filtered.length) return;
    if (nextFocus) setFocus(nextFocus);
    window.dispatchEvent(new CustomEvent('astrohd:select-element', { detail: { items: filtered } }));
  };

  const buildPlacementItems = (planetName: string, data: any, stream: 'personality' | 'design'): SidebarSelectionItem[] => {
    const prefix = stream === 'personality' ? 'Personality' : 'Design';
    const isAngle = ['Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex'].includes(planetName);
    // Angles resolve as their own angle-point entity; planets as planets. Only ONE
    // placement item so the sidebar title isn't duplicated.
    const items: SidebarSelectionItem[] = [
      isAngle
        ? { sectionType: 'astro_angles_points', itemKey: astroAngleKey(planetName), title: `${prefix} ${planetName}` }
        : { sectionType: 'astro_planets', itemKey: astroPlanetKey(planetName), title: `${prefix} ${planetName}` },
    ];
    if (data?.sign) items.push({ sectionType: 'astro_signs', itemKey: data.sign, title: data.sign });
    if (data?.house) items.push({ sectionType: 'astro_houses', itemKey: String(data.house), title: `House ${data.house}` });
    // Fold in the Shem angel for this placement's degree so its meaning resolves
    // in the sidebar (and appears in the header), matching the HD side. Gated by
    // the chart's angel toggle.
    if (cards.angels) {
      const angel = getAngelOverlay(data?.longitude);
      if (angel) items.push({ sectionType: 'angel_shem', itemKey: `shem_${String(angel.index).padStart(2, '0')}`, title: angel.name });
    }
    return items;
  };

  const openPlacement = (planetName: string, stream: 'personality' | 'design') => {
    const acts = stream === 'personality' ? birthActs : designActs;
    const data = acts[planetName];
    if (!data) return;
    dispatchSelection(buildPlacementItems(planetName, data, stream), {
      planet: planetName,
      sign: data.sign,
      house: data.house || undefined,
      aspectKey: undefined,
      stream,
      activeMoonPhase: undefined,
      activeDestiny: undefined,
      activeStellium: undefined,
      activeChartShape: undefined,
    });
  };

  // Placement click that also handles folded-in asteroids (not in activations).
  const openPlacementRow = (name: string, data: any, stream: 'personality' | 'design') => {
    if (data?.isAsteroid) {
      const prefix = stream === 'personality' ? 'Personality' : 'Design';
      const items: SidebarSelectionItem[] = [];
      if (data.sign) items.push({ sectionType: 'astro_signs', itemKey: data.sign, title: `${prefix} ${name}` });
      if (data.house) items.push({ sectionType: 'astro_houses', itemKey: String(data.house), title: `House ${data.house}` });
      dispatchSelection(items, {
        planet: name,
        sign: data.sign,
        house: data.house || undefined,
        aspectKey: undefined,
        stream,
        activeMoonPhase: undefined,
        activeDestiny: undefined,
        activeStellium: undefined,
        activeChartShape: undefined,
      });
      return;
    }
    openPlacement(name, stream);
  };

  const getMoonPhaseKey = (angle: number) => {
    if (angle < 22.5) return 'new';
    if (angle < 67.5) return 'waxing-gibbous';
    if (angle < 112.5) return 'first-quarter';
    if (angle < 157.5) return 'waxing-gibbous';
    if (angle < 202.5) return 'full';
    if (angle < 247.5) return 'waning-gibbous';
    if (angle < 292.5) return 'last-quarter';
    if (angle < 337.5) return 'waning-gibbous';
    return 'new';
  };

  const openAspect = (aspect: any, stream: 'personality' | 'design') => {
    const prefix = stream === 'personality' ? 'Personality' : 'Design';
    const acts = stream === 'personality' ? birthActs : designActs;
    const a1 = acts[aspect.p1.name] || {};
    const a2 = acts[aspect.p2.name] || {};
    const items = [
      { sectionType: 'astro_aspects', itemKey: aspect.aspect.name, title: `${prefix} ${aspect.aspect.name}`, role: 'aspect' },
      { sectionType: 'astro_planets', itemKey: astroPlanetKey(aspect.p1.name), title: aspect.p1.name, role: 'planet_a' },
      { sectionType: 'astro_planets', itemKey: astroPlanetKey(aspect.p2.name), title: aspect.p2.name, role: 'planet_b' },
    ];
    if (a1.sign)  items.push({ sectionType: 'astro_signs',  itemKey: String(a1.sign).toLowerCase(), title: a1.sign, role: 'sign_a' });
    if (a2.sign)  items.push({ sectionType: 'astro_signs',  itemKey: String(a2.sign).toLowerCase(), title: a2.sign, role: 'sign_b' });
    if (a1.house) items.push({ sectionType: 'astro_houses', itemKey: String(a1.house), title: `House ${a1.house}`, role: 'house_a' });
    if (a2.house) items.push({ sectionType: 'astro_houses', itemKey: String(a2.house), title: `House ${a2.house}`, role: 'house_b' });

    dispatchSelection(
      items,
      {
        planet: undefined,
        sign: undefined,
        house: undefined,
        aspectKey: aspectKeyOf(aspect),
        stream,
        activeMoonPhase: undefined,
        activeDestiny: undefined,
        activeStellium: undefined,
        activeChartShape: undefined,
      }
    );
  };

  const openMoonPhase = (stream: 'personality' | 'design') => {
    const mPhase = stream === 'personality' ? personalityMoonPhase : designMoonPhase;
    if (!mPhase) return;
    const prefix = stream === 'personality' ? 'Personality' : 'Design';
    const key = getMoonPhaseKey(mPhase.angle);
    dispatchSelection(
      [
        { sectionType: 'astro_moon_phases', itemKey: key, title: `${prefix} ${mPhase.phaseName}`, role: 'moon_phase' },
        { sectionType: 'astro_signs', itemKey: String(mPhase.sign).toLowerCase(), title: mPhase.sign, role: 'sign' },
        { sectionType: 'astro_houses', itemKey: String(mPhase.house), title: `House ${mPhase.house}`, role: 'house' },
      ],
      {
        planet: 'Moon',
        sign: mPhase.sign,
        house: mPhase.house || undefined,
        aspectKey: undefined,
        stream,
        activeMoonPhase: true,
        activeDestiny: undefined,
        activeStellium: undefined,
        activeChartShape: undefined,
      }
    );
  };

  const openDestinyPoint = (stream: 'personality' | 'design') => {
    const dest = stream === 'personality' ? personalityDestiny : designDestiny;
    if (!dest) return;
    const prefix = stream === 'personality' ? 'Personality' : 'Design';
    dispatchSelection(
      [
        { sectionType: 'hd_destiny_points', itemKey: 'life-purpose', title: `${prefix} Life Purpose`, role: 'destiny_point' },
        { sectionType: 'hd_gates', itemKey: String(dest.gate), title: `Gate ${dest.gate}`, role: 'gate' },
        { sectionType: 'astro_houses', itemKey: String(dest.house), title: `House ${dest.house}`, role: 'house' }
      ],
      {
        planet: dest.name,
        sign: dest.sign,
        house: dest.house || undefined,
        aspectKey: undefined,
        stream,
        activeMoonPhase: undefined,
        activeDestiny: true,
        activeStellium: undefined,
        activeChartShape: undefined,
      }
    );
  };

  const openChartShape = (shape: string, stream: 'personality' | 'design') => {
    if (!shape || ['Unclassified', 'Mixed'].includes(shape)) return;
    const prefix = stream === 'personality' ? 'Personality' : 'Design';
    dispatchSelection(
      [
        { sectionType: 'astro_chart_patterns', itemKey: shape, title: `${prefix} Chart Shape · ${shape}`, role: 'chart_pattern' }
      ],
      {
        planet: undefined,
        sign: undefined,
        house: undefined,
        aspectKey: undefined,
        stream,
        activeMoonPhase: undefined,
        activeDestiny: undefined,
        activeStellium: undefined,
        activeChartShape: shape,
      }
    );
  };

  const openStellium = (s: any, stream: 'personality' | 'design') => {
    const ROLES = ['planet_a', 'planet_b', 'planet_c', 'planet_d'];
    const prefix = stream === 'personality' ? 'Personality' : 'Design';
    const acts = stream === 'personality' ? birthActs : designActs;
    const items = [
      { sectionType: 'astro_stelliums', itemKey: String(s.sign).toLowerCase(), title: `${prefix} ${s.sign} Stellium`, role: 'stellium' },
      { sectionType: 'astro_signs', itemKey: String(s.sign).toLowerCase(), title: s.sign, role: 'sign' }
    ];
    s.planets.slice(0, ROLES.length).forEach((p: any, i: number) => {
      items.push({
        sectionType: 'astro_planets',
        itemKey: astroPlanetKey(p.name),
        title: p.name,
        role: ROLES[i]
      });
    });
    const h = acts[s.planets[0]?.name]?.house;
    if (h) {
      items.push({
        sectionType: 'astro_houses',
        itemKey: String(h),
        title: `House ${h}`,
        role: 'house'
      });
    }
    dispatchSelection(items, {
      planet: undefined,
      sign: s.sign,
      house: h || undefined,
      aspectKey: undefined,
      stream,
      activeMoonPhase: undefined,
      activeDestiny: undefined,
      activeStellium: s.sign,
      activeChartShape: undefined,
    });
  };

  const openHouseRuler = (ruler: any, stream: 'personality' | 'design') => {
    const prefix = stream === 'personality' ? 'Personality' : 'Design';
    dispatchSelection([
      { sectionType: 'astro_houses', itemKey: String(ruler.house), title: `${prefix} House ${ruler.house}` },
      { sectionType: 'astro_signs', itemKey: ruler.houseSign, title: ruler.houseSign },
      { sectionType: 'astro_planets', itemKey: ruler.rulerName, title: ruler.rulerName },
    ], {
      house: ruler.house,
      sign: ruler.houseSign,
      planet: ruler.rulerName,
      aspectKey: undefined,
      stream,
      activeMoonPhase: undefined,
      activeDestiny: undefined,
      activeStellium: undefined,
      activeChartShape: undefined,
    });
  };

  const handleWheelElementClick = (stream: 'personality' | 'design', type: string, id: string, label?: string) => {
    if (type === 'planet') {
      const acts = stream === 'personality' ? birthActs : designActs;
      if (acts[id]) { openPlacement(id, stream); return; }
      // Asteroid glyph (folded into the wheel, not in the natal activations).
      const row = asteroidRows(stream).find(([n]) => n === id);
      if (row) { openPlacementRow(id, row[1], stream); return; }
      openPlacement(id, stream);
      return;
    }
    const prefix = stream === 'personality' ? 'Personality' : 'Design';
    if (type === 'sign') {
      dispatchSelection([{ sectionType: 'astro_signs', itemKey: id, title: `${prefix} ${label || id}` }], {
        planet: undefined,
        sign: id,
        house: undefined,
        aspectKey: undefined,
        stream,
      });
      return;
    }
    if (type === 'house') {
      dispatchSelection([{ sectionType: 'astro_houses', itemKey: id, title: `${prefix} House ${id}` }], {
        planet: undefined,
        sign: undefined,
        house: Number(id),
        aspectKey: undefined,
        stream,
      });
      return;
    }
    const targetInsights = stream === 'personality' ? personalityInsights : designInsights;
    if (type === 'aspect' && targetInsights?.allAspects) {
      const aspect = targetInsights.allAspects.find(a => aspectKeyOf(a) === id);
      if (aspect) openAspect(aspect, stream);
    }
  };

  const getQuickActions = (acts: any, destiny: any, ruler: any, stream: 'personality' | 'design') => {
    const actions: Array<{ label: string; kicker: string; onClick: () => void; active: boolean }> = [];
    if (acts.Sun) {
      actions.push({
        label: 'Sun',
        kicker: `${acts.Sun.sign}${acts.Sun.house ? ` · H${acts.Sun.house}` : ''}`,
        onClick: () => openPlacement('Sun', stream),
        active: focus.stream === stream && focus.planet === 'Sun',
      });
    }
    if (acts.Moon) {
      actions.push({
        label: 'Moon',
        kicker: `${acts.Moon.sign}${acts.Moon.house ? ` · H${acts.Moon.house}` : ''}`,
        onClick: () => openPlacement('Moon', stream),
        active: focus.stream === stream && focus.planet === 'Moon',
      });
    }
    if (acts.Ascendant) {
      actions.push({
        label: 'Rising',
        kicker: `${acts.Ascendant.sign} · H1`,
        onClick: () => openPlacement('Ascendant', stream),
        active: focus.stream === stream && focus.planet === 'Ascendant',
      });
    }
    if (ruler) {
      actions.push({
        label: 'Chart Ruler',
        kicker: `${ruler.name} · ${ruler.sign}`,
        onClick: () => openPlacement(ruler.name, stream),
        active: focus.stream === stream && focus.planet === ruler.name,
      });
    }
    if (acts.NorthNode) {
      actions.push({
        label: 'North Node',
        kicker: `${acts.NorthNode.sign}${acts.NorthNode.house ? ` · H${acts.NorthNode.house}` : ''}`,
        onClick: () => openPlacement('NorthNode', stream),
        active: focus.stream === stream && focus.planet === 'NorthNode',
      });
    }
    if (destiny) {
      actions.push({
        label: 'Destiny Point',
        kicker: `${destiny.name} · ${destiny.sign}`,
        onClick: () => openDestinyPoint(stream),
        active: focus.stream === stream && !!focus.activeDestiny,
      });
    }
    return actions.slice(0, 6);
  };

  const personalityQuickActions = useMemo(() => getQuickActions(birthActs, personalityDestiny, personalityChartRuler, 'personality'), [birthActs, personalityDestiny, personalityChartRuler, focus]);
  const designQuickActions = useMemo(() => getQuickActions(designActs, designDestiny, designChartRuler, 'design'), [designActs, designDestiny, designChartRuler, focus]);

  // Tabs available given the card toggles (Wheel / Insights / Aspects / Placements).
  const availableTabs = useMemo(() => {
    const t: string[] = [];
    if (cards.wheels) t.push('Wheel');
    if (anyInsightCard) t.push('Insights');
    if (cards.aspects) t.push('Aspects');
    if (cards.placements) t.push('Placements');
    return t.length ? t : ['Wheel'];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.wheels, anyInsightCard, cards.aspects, cards.placements]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) setActiveTab(availableTabs[0]);
  }, [availableTabs, activeTab]);

  const displayName = profileIdentity?.full_name || profileIdentity?.display_name || profileIdentity?.nickname || 'Your';
  const hasName = !!(profileIdentity?.full_name || profileIdentity?.display_name || profileIdentity?.nickname);
  const primary = 'var(--gold, #d4af37)';

  if (busy) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--mute)' }}>
        Calculating chart...
      </div>
    );
  }

  return (
    <div style={ embedded
      ? { display: 'flex', flexDirection: 'column', padding: '20px 24px 28px' }
      : { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '20px 24px 28px' } }>
      <style>{`
        .astro-wheel-tab {
          position: relative;
          padding: 0 0 10px;
          border: none;
          background: none;
          color: var(--mute);
          cursor: pointer;
          transition: color 0.2s ease, transform 0.2s ease;
          font-family: var(--font-display);
          font-size: 17px;
          font-style: italic;
        }
        .astro-wheel-tab:hover {
          color: var(--ink);
          transform: translateY(-1px);
        }
        .astro-wheel-tab.active {
          color: var(--ink);
        }
        .astro-wheel-tab.active::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, var(--gold, #d4af37) 18%, var(--gold, #d4af37) 82%, transparent 100%);
        }
      `}</style>

      {!previewMode && (
      <div style={{ marginBottom: 24, borderBottom: '1px solid var(--ink)', paddingBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
            Natal · Dual Astrology Map
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 32, color: 'var(--ink)', lineHeight: 1.1, margin: 0 }}>
            {displayName}{hasName ? "'s" : ''} <em style={{ color: 'var(--gold)' }}>Dual Astrology Map</em>
          </h1>
        </div>

        { /* House System Toggle — universal flat editorial component. */ }
        {(!config || config.showHouseSystemToggle) && (
          <HouseSystemToggle value={houseSystem} onChange={setHouseSystem} />
        )}
      </div>

      )}

      <div style={{ display: 'flex', gap: 28, marginBottom: 28, paddingBottom: 12, borderBottom: '1px solid var(--hair)', alignItems: 'center' }}>
        {availableTabs.map(t => (
          <button
            key={t}
            className={`astro-wheel-tab${activeTab === t ? ' active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={ embedded ? { paddingRight: 4 } : { flex: 1, overflowY: 'auto', paddingRight: 4 } }>
        {activeTab === 'Wheel' && chartData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            <div style={{ ...editorialCardStyle(false), padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>
                    Dual Wheel Interaction Map
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--mute)', fontStyle: 'italic' }}>
                    Click planets, sign rings, house numbers, or aspects on either wheel to load their standard astrology definitions in the sidebar.
                  </div>
                </div>
                {!previewMode && (
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--mute)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={showAspects} onChange={e => setShowAspects(e.target.checked)} />
                      Show Aspects
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--mute)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={showCrossPoints} onChange={e => setShowCrossPoints(e.target.checked)} />
                      Show Cross Points
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(450px, 100%), 1fr))', gap: 24, alignItems: 'start', minWidth: 0 }}>

              {/* Design Wheel Card */}
              {(!config || (config.wheels.design && !config.wheels.combined)) && (
              <div style={{ ...editorialCardStyle(focus.stream === 'design' && Boolean(focus.planet || focus.sign || focus.house || focus.aspectKey)), padding: 24, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--hd-design, #a12f2f)', marginBottom: 4, textAlign: 'center' }}>
                    Unconscious Stream
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: 'var(--ink)', margin: 0, textAlign: 'center' }}>
                    Design Astrology Wheel
                  </h2>
                </div>
                <div style={{ background: 'radial-gradient(circle at 50% 40%, rgba(161,47,47,0.08) 0%, rgba(0,0,0,0) 48%), linear-gradient(180deg, rgba(20,18,16,0.02) 0%, rgba(20,18,16,0.06) 100%)', padding: 18, border: '1px solid color-mix(in srgb, var(--hd-design, #a12f2f) 15%, var(--hair))', display: 'flex', justifyContent: 'center', minWidth: 0 }}>
                  <AstroWheel
                    activations={withAsteroids(filterActs(designActs, 'design'), 'design')}
                    size={460}
                    hideAspects={!showAspects}
                    showCrossPoints={showCrossPoints}
                    layers={config?.wheels}
                    asteroidFilter={config?.wheels.asteroids}
                    onElementClick={(type, id, label) => handleWheelElementClick('design', type, id, label)}
                    selectedPlanet={focus.stream === 'design' ? focus.planet : undefined}
                    selectedSign={focus.stream === 'design' ? focus.sign : undefined}
                    selectedHouse={focus.stream === 'design' ? focus.house : undefined}
                    selectedAspectKey={focus.stream === 'design' ? focus.aspectKey : undefined}
                    centerTitle="DESIGN"
                    centerSubtitle="Unconscious Map"
                    cusps={chartData?.designHouseCusps}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                  {designQuickActions.map(action => (
                    <button
                      key={action.label}
                      onClick={action.onClick}
                      style={{
                        ...editorialCardStyle(action.active),
                        textAlign: 'left',
                        padding: '12px 14px 11px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--hd-design, #a12f2f)', marginBottom: 4 }}>
                        {action.label}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink)', lineHeight: 1.15 }}>
                        {action.kicker}
                      </div>
                      {cards.angels && ['Sun', 'Moon', 'Rising'].includes(action.label) && (
                        <div style={{ fontSize: 9, color: 'var(--gold)', marginTop: 5, lineHeight: 1.3 }}>
                          {angelLine(action.label === 'Rising' ? designActs.Ascendant?.longitude : designActs[action.label]?.longitude)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Combined Wheel Card (preview only) */}
              {config?.wheels.combined && (
              <div style={{ ...editorialCardStyle(false), padding: 24, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4, textAlign: 'center' }}>
                    Combined Streams
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: 'var(--ink)', margin: 0, textAlign: 'center' }}>
                    Combined Astrology Wheel
                  </h2>
                </div>
                <div style={{ background: 'linear-gradient(180deg, rgba(20,18,16,0.02) 0%, rgba(20,18,16,0.06) 100%)', padding: 18, border: '1px solid var(--hair)', display: 'flex', justifyContent: 'center', minWidth: 0 }}>
                  <AstroWheel
                    activations={withAsteroids(filterActs(birthActs, 'personality'), 'personality')}
                    secondaryActivations={withAsteroids(filterActs(designActs, 'design'), 'design')}
                    size={520}
                    layers={config?.wheels}
                    asteroidFilter={config?.wheels.asteroids}
                    onElementClick={(type, id, label) => handleWheelElementClick('personality', type, id, label)}
                    centerTitle="COMBINED"
                    centerSubtitle="Personality + Design"
                    cusps={chartData?.houseCusps}
                  />
                </div>
              </div>
              )}

              {/* Personality Wheel Card */}
              {(!config || (config.wheels.personality && !config.wheels.combined)) && (
              <div style={{ ...editorialCardStyle(focus.stream === 'personality' && Boolean(focus.planet || focus.sign || focus.house || focus.aspectKey)), padding: 24, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4, textAlign: 'center' }}>
                    Conscious Stream
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: 'var(--ink)', margin: 0, textAlign: 'center' }}>
                    Personality Astrology Wheel
                  </h2>
                </div>
                <div style={{ background: 'radial-gradient(circle at 50% 40%, rgba(212,175,55,0.08) 0%, rgba(0,0,0,0) 48%), linear-gradient(180deg, rgba(20,18,16,0.02) 0%, rgba(20,18,16,0.06) 100%)', padding: 18, border: '1px solid color-mix(in srgb, var(--gold, #d4af37) 12%, var(--hair))', display: 'flex', justifyContent: 'center', minWidth: 0 }}>
                  <AstroWheel
                    activations={withAsteroids(filterActs(birthActs, 'personality'), 'personality')}
                    size={460}
                    hideAspects={!showAspects}
                    showCrossPoints={showCrossPoints}
                    layers={config?.wheels}
                    asteroidFilter={config?.wheels.asteroids}
                    onElementClick={(type, id, label) => handleWheelElementClick('personality', type, id, label)}
                    selectedPlanet={focus.stream === 'personality' ? focus.planet : undefined}
                    selectedSign={focus.stream === 'personality' ? focus.sign : undefined}
                    selectedHouse={focus.stream === 'personality' ? focus.house : undefined}
                    selectedAspectKey={focus.stream === 'personality' ? focus.aspectKey : undefined}
                    centerTitle="PERSONALITY"
                    centerSubtitle="Conscious Map"
                    cusps={chartData?.houseCusps}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                  {personalityQuickActions.map(action => (
                    <button
                      key={action.label}
                      onClick={action.onClick}
                      style={{
                        ...editorialCardStyle(action.active),
                        textAlign: 'left',
                        padding: '12px 14px 11px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>
                        {action.label}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink)', lineHeight: 1.15 }}>
                        {action.kicker}
                      </div>
                      {cards.angels && ['Sun', 'Moon', 'Rising'].includes(action.label) && (
                        <div style={{ fontSize: 9, color: 'var(--gold)', marginTop: 5, lineHeight: 1.3 }}>
                          {angelLine(action.label === 'Rising' ? birthActs.Ascendant?.longitude : birthActs[action.label]?.longitude)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              )}

            </div>
          </div>
        )}

        {activeTab === 'Insights' && personalityInsights && designInsights && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            
            {/* Tabbed Insights Comparison Graph */}
            {cards.classifications && (
            <div style={{ ...editorialCardStyle(false), padding: 24 }}>
              {/* Subtab selection headers */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--hair)', gap: 24, marginBottom: 20 }}>
                {(['houses', 'elements', 'modalities'] as const).map(tabKey => {
                  const labels = {
                    houses: 'House Classifications',
                    elements: 'Sign Elements',
                    modalities: 'Sign Modalities'
                  };
                  const isActive = insightsSubTab === tabKey;
                  return (
                    <button
                      key={tabKey}
                      onClick={() => setInsightsSubTab(tabKey)}
                      style={{
                        background: 'none',
                        border: 'none',
                        borderBottom: isActive ? '2.5px solid var(--gold)' : '2.5px solid transparent',
                        paddingBottom: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        color: isActive ? 'var(--ink)' : 'var(--mute)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        letterSpacing: '0.02em',
                        marginBottom: -1.5
                      }}
                    >
                      {labels[tabKey]}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 28, alignItems: 'center' }}>
                {insightsSubTab === 'houses' && (
                  <>
                    <AstroTallyChart categories={houseCategories} personality={personalityHouseBreakdown} design={designHouseBreakdown} showDesign={designInInsights} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ fontSize: 13, color: 'var(--mute)', lineHeight: 1.5 }}>
                        Astrological houses are divided into three quadruplicities (modalities). This comparison bar graph displays the distribution of conscious (Personality) and unconscious (Design) planetary placements in each house classification.
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                          🔑 <strong style={{ color: 'var(--gold, #d4af37)' }}>Angular (Houses 1, 4, 7, 10):</strong> Initiates action, outward movement, and primary life focus areas.
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                          💎 <strong style={{ color: 'var(--indigo, #5c59c2)' }}>Succedent (Houses 2, 5, 8, 11):</strong> Stabilizes, gathers resources, constructs security, and creates foundations.
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                          🌀 <strong style={{ color: 'var(--hd-design, #a12f2f)' }}>Cadent (Houses 3, 6, 9, 12):</strong> Disseminates knowledge, adapts to changes, and handles transitions/integration.
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {insightsSubTab === 'elements' && (
                  <>
                    <AstroTallyChart categories={elementCategories} personality={personalityElementBreakdown} design={designElementBreakdown} showDesign={designInInsights} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ fontSize: 13, color: 'var(--mute)', lineHeight: 1.5 }}>
                        Zodiac signs are grouped into four classical elements, representing different energetic qualities, temperaments, and modes of expression.
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                          🔥 <strong style={{ color: 'var(--astro-fire, #f87171)' }}>Fire (Aries, Leo, Sagittarius):</strong> Passionate, active, warm, adventurous, creative, and enthusiastic.
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                          🌱 <strong style={{ color: 'var(--astro-earth, #86efac)' }}>Earth (Taurus, Virgo, Capricorn):</strong> Grounded, practical, reliable, structured, patient, and sensory.
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                          💨 <strong style={{ color: 'var(--astro-air, #7dd3fc)' }}>Air (Gemini, Libra, Aquarius):</strong> Intellectual, communicative, social, objective, and conceptual.
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                          🌊 <strong style={{ color: 'var(--astro-water, #a5b4fc)' }}>Water (Cancer, Scorpio, Pisces):</strong> Emotional, intuitive, deep, empathetic, imaginative, and relational.
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {insightsSubTab === 'modalities' && (
                  <>
                    <AstroTallyChart categories={modalityCategories} personality={personalityModalityBreakdown} design={designModalityBreakdown} showDesign={designInInsights} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ fontSize: 13, color: 'var(--mute)', lineHeight: 1.5 }}>
                        Modality represents the sign's operational style and how it initiates, sustains, or adapts energy during the changing seasons.
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                          ⚡ <strong style={{ color: 'var(--gold, #d4af37)' }}>Cardinal (Aries, Cancer, Libra, Capricorn):</strong> Initiating energy, leadership, starting new projects, and driving change.
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                          🛡️ <strong style={{ color: 'var(--indigo, #5c59c2)' }}>Fixed (Taurus, Leo, Scorpio, Aquarius):</strong> Concentrated energy, stability, persistence, resistance to change, and consolidation.
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                          🌪️ <strong style={{ color: 'var(--hd-design, #a12f2f)' }}>Mutable (Gemini, Virgo, Sagittarius, Pisces):</strong> Flexible energy, adaptability, transitions, versatile learning, and communication.
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: designInInsights ? 'repeat(auto-fit, minmax(450px, 1fr))' : '1fr', gap: 28 }}>

              {/* Personality Insights Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ borderBottom: '1px solid var(--hair)', paddingBottom: 8 }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--gold)' }}>{designInInsights ? 'Personality Insights' : 'Insights'}</h2>
                </div>

              {cards.moonPhase && personalityMoonPhase && (
                <button
                  onClick={() => openMoonPhase('personality')}
                  style={{ ...editorialCardStyle(focus.stream === 'personality' && !!focus.activeMoonPhase), padding: 20, textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Moon Phase</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                    {personalityMoonPhase.phaseEmoji} {personalityMoonPhase.phaseName}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                    Moon in {personalityMoonPhase.sign} · House {personalityMoonPhase.house || '—'}
                  </div>
                </button>
              )}

              {cards.purpose && personalityDestiny && (
                <button
                  onClick={() => openDestinyPoint('personality')}
                  style={{ ...editorialCardStyle(focus.stream === 'personality' && !!focus.activeDestiny), padding: 20, textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Purpose Marker</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                    {personalityDestiny.name}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                    {personalityDestiny.sign} {formatDeg(personalityDestiny.longitude)} · H{personalityDestiny.house || '—'}
                  </div>
                </button>
              )}

              {cards.signature && personalityDominant && (
                <button
                  onClick={() => openPlacement(personalityDominant.name, 'personality')}
                  style={{ ...editorialCardStyle(focus.stream === 'personality' && focus.planet === personalityDominant.name), padding: 20, textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Signature Placement</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                    {personalityDominant.name} in {personalityDominant.sign}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                    {formatDeg(personalityDominant.longitude)} · House {personalityDominant.house || '—'}
                  </div>
                </button>
              )}

              {cards.chartRuler && personalityChartRuler && (
                <button
                  onClick={() => openPlacement(personalityChartRuler.name, 'personality')}
                  style={{ ...editorialCardStyle(focus.stream === 'personality' && focus.planet === personalityChartRuler.name), padding: 20, textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Chart Ruler</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                    {personalityChartRuler.name} in {personalityChartRuler.sign}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                    Rising sign {birthActs.Ascendant?.sign} · House {personalityChartRuler.house || '—'}
                  </div>
                </button>
              )}

              {cards.chartShape && (
              <button
                onClick={() => openChartShape(personalityInsights.chartShape, 'personality')}
                style={{ ...editorialCardStyle(focus.stream === 'personality' && focus.activeChartShape === personalityInsights.chartShape), padding: 20, textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Chart Shape</div>
                <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                  {personalityInsights.chartShape}
                </div>
                <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                  The geometry formed by conscious natal planetary distribution.
                </div>
              </button>
              )}

              {cards.tightAspects && (
              <div style={{ ...editorialCardStyle(false), padding: 20 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>Tight Aspects (≤2°)</div>
                {pTightAspects.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {pTightAspects.map((aspect, idx) => (
                      <button
                        key={`${aspectKeyOf(aspect)}-p-${idx}`}
                        onClick={() => openAspect(aspect, 'personality')}
                        style={{
                          padding: '10px 12px',

                          border: (focus.stream === 'personality' && focus.aspectKey === aspectKeyOf(aspect)) ? '1px solid var(--gold)' : '1px solid var(--hair)',
                          background: (focus.stream === 'personality' && focus.aspectKey === aspectKeyOf(aspect)) ? 'color-mix(in srgb, var(--gold, #d4af37) 10%, var(--card))' : 'var(--card)',
                          cursor: 'pointer',
                          color: 'var(--ink)',
                          fontSize: 13,
                        }}
                      >
                        {aspect.p1.name} {aspect.aspect.symbol} {aspect.p2.name} · {aspect.orb.toFixed(1)}°
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: 'var(--mute)', fontStyle: 'italic' }}>No aspects within a 2° orb.</div>
                )}
              </div>
              )}

              {cards.stelliums && personalityInsights.stelliums.length > 0 && (
                <div style={{ ...editorialCardStyle(false), padding: 20 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>Stelliums</div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {personalityInsights.stelliums.map((stellium, idx) => (
                      <button
                        key={`stellium-p-${idx}`}
                        onClick={() => openStellium(stellium, 'personality')}
                        style={{ ...editorialCardStyle(focus.stream === 'personality' && focus.activeStellium === stellium.sign), padding: 16, textAlign: 'left', cursor: 'pointer' }}
                      >
                        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: 'var(--ink)', marginBottom: 6 }}>
                          {stellium.sign}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--mute)', lineHeight: 1.5 }}>
                          House {stellium.planets[0]?.house || '—'} · {stellium.planets.map(p => p.name).join(', ')}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {cards.houseRulers && (
              <div style={{ ...editorialCardStyle(false), padding: 20 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>House Rulers</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {personalityHouseRulers.map(ruler => (
                    <button
                      key={`house-ruler-p-${ruler.house}`}
                      onClick={() => openHouseRuler(ruler, 'personality')}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '60px 1.2fr 1fr 1.2fr',
                        gap: 12,
                        alignItems: 'center',
                        padding: '10px 12px',
                        border: (focus.stream === 'personality' && focus.house === ruler.house) ? '1px solid var(--gold)' : '1px solid var(--hair)',

                        background: (focus.stream === 'personality' && focus.house === ruler.house) ? 'color-mix(in srgb, var(--gold, #d4af37) 8%, var(--card))' : 'var(--card)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink)' }}>H{ruler.house}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink)' }}>{ruler.houseSign}</div>
                      <div style={{ fontSize: 13, color: primary }}>{ruler.rulerName}</div>
                      <div style={{ fontSize: 12, color: 'var(--mute)' }}>in H{ruler.currentHouse || '—'} · {ruler.sign}</div>
                    </button>
                  ))}
                </div>
              </div>
              )}
            </div>

            {/* Design Insights Column */}
            {designInInsights && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ borderBottom: '1px solid var(--hair)', paddingBottom: 8 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--hd-design, #a12f2f)' }}>Design Insights</h2>
              </div>

              {cards.moonPhase && designMoonPhase && (
                <button
                  onClick={() => openMoonPhase('design')}
                  style={{ ...editorialCardStyle(focus.stream === 'design' && !!focus.activeMoonPhase), padding: 20, textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--hd-design, #a12f2f)', marginBottom: 8 }}>Moon Phase</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                    {designMoonPhase.phaseEmoji} {designMoonPhase.phaseName}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                    Moon in {designMoonPhase.sign} · House {designMoonPhase.house || '—'}
                  </div>
                </button>
              )}

              {cards.purpose && designDestiny && (
                <button
                  onClick={() => openDestinyPoint('design')}
                  style={{ ...editorialCardStyle(focus.stream === 'design' && !!focus.activeDestiny), padding: 20, textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--hd-design, #a12f2f)', marginBottom: 8 }}>Purpose Marker</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                    {designDestiny.name}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                    {designDestiny.sign} {formatDeg(designDestiny.longitude)} · H{designDestiny.house || '—'}
                  </div>
                </button>
              )}

              {cards.signature && designDominant && (
                <button
                  onClick={() => openPlacement(designDominant.name, 'design')}
                  style={{ ...editorialCardStyle(focus.stream === 'design' && focus.planet === designDominant.name), padding: 20, textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--hd-design, #a12f2f)', marginBottom: 8 }}>Signature Placement</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                    {designDominant.name} in {designDominant.sign}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                    {formatDeg(designDominant.longitude)} · House {designDominant.house || '—'}
                  </div>
                </button>
              )}

              {cards.chartRuler && designChartRuler && (
                <button
                  onClick={() => openPlacement(designChartRuler.name, 'design')}
                  style={{ ...editorialCardStyle(focus.stream === 'design' && focus.planet === designChartRuler.name), padding: 20, textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--hd-design, #a12f2f)', marginBottom: 8 }}>Chart Ruler</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                    {designChartRuler.name} in {designChartRuler.sign}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                    Rising sign {designActs.Ascendant?.sign} · House {designChartRuler.house || '—'}
                  </div>
                </button>
              )}

              {cards.chartShape && (
              <button
                onClick={() => openChartShape(designInsights.chartShape, 'design')}
                style={{ ...editorialCardStyle(focus.stream === 'design' && focus.activeChartShape === designInsights.chartShape), padding: 20, textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--hd-design, #a12f2f)', marginBottom: 8 }}>Chart Shape</div>
                <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                  {designInsights.chartShape}
                </div>
                <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                  The geometry formed by unconscious (design) planetary distribution.
                </div>
              </button>
              )}

              {cards.tightAspects && (
              <div style={{ ...editorialCardStyle(false), padding: 20 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--hd-design, #a12f2f)', marginBottom: 12 }}>Tight Aspects (≤2°)</div>
                {dTightAspects.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {dTightAspects.map((aspect, idx) => (
                      <button
                        key={`${aspectKeyOf(aspect)}-d-${idx}`}
                        onClick={() => openAspect(aspect, 'design')}
                        style={{
                          padding: '10px 12px',

                          border: (focus.stream === 'design' && focus.aspectKey === aspectKeyOf(aspect)) ? '1px solid var(--hd-design, #a12f2f)' : '1px solid var(--hair)',
                          background: (focus.stream === 'design' && focus.aspectKey === aspectKeyOf(aspect)) ? 'color-mix(in srgb, var(--hd-design, #a12f2f) 10%, var(--card))' : 'var(--card)',
                          cursor: 'pointer',
                          color: 'var(--ink)',
                          fontSize: 13,
                        }}
                      >
                        {aspect.p1.name} {aspect.aspect.symbol} {aspect.p2.name} · {aspect.orb.toFixed(1)}°
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: 'var(--mute)', fontStyle: 'italic' }}>No aspects within a 2° orb.</div>
                )}
              </div>
              )}

              {cards.stelliums && designInsights.stelliums.length > 0 && (
                <div style={{ ...editorialCardStyle(false), padding: 20 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--hd-design, #a12f2f)', marginBottom: 12 }}>Stelliums</div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {designInsights.stelliums.map((stellium, idx) => (
                      <button
                        key={`stellium-d-${idx}`}
                        onClick={() => openStellium(stellium, 'design')}
                        style={{ ...editorialCardStyle(focus.stream === 'design' && focus.activeStellium === stellium.sign), padding: 16, textAlign: 'left', cursor: 'pointer' }}
                      >
                        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: 'var(--ink)', marginBottom: 6 }}>
                          {stellium.sign}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--mute)', lineHeight: 1.5 }}>
                          House {stellium.planets[0]?.house || '—'} · {stellium.planets.map(p => p.name).join(', ')}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {cards.houseRulers && (
              <div style={{ ...editorialCardStyle(false), padding: 20 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--hd-design, #a12f2f)', marginBottom: 12 }}>House Rulers</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {designHouseRulers.map(ruler => (
                    <button
                      key={`house-ruler-d-${ruler.house}`}
                      onClick={() => openHouseRuler(ruler, 'design')}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '60px 1.2fr 1fr 1.2fr',
                        gap: 12,
                        alignItems: 'center',
                        padding: '10px 12px',
                        border: (focus.stream === 'design' && focus.house === ruler.house) ? '1px solid var(--hd-design, #a12f2f)' : '1px solid var(--hair)',

                        background: (focus.stream === 'design' && focus.house === ruler.house) ? 'color-mix(in srgb, var(--hd-design, #a12f2f) 8%, var(--card))' : 'var(--card)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink)' }}>H{ruler.house}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink)' }}>{ruler.houseSign}</div>
                      <div style={{ fontSize: 13, color: primary }}>{ruler.rulerName}</div>
                      <div style={{ fontSize: 12, color: 'var(--mute)' }}>in H{ruler.currentHouse || '—'} · {ruler.sign}</div>
                    </button>
                  ))}
                </div>
              </div>
              )}
            </div>
            )}

          </div>
          </div>
        )}

        {activeTab === 'Aspects' && personalityInsights?.allAspects && designInsights?.allAspects && (
          <div style={{ display: 'grid', gridTemplateColumns: designInAspects ? 'repeat(auto-fit, minmax(450px, 1fr))' : '1fr', gap: 28 }}>

            {/* Personality Aspects Column */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--hair)', paddingBottom: 8, marginBottom: 14 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--gold)', margin: 0 }}>{designInAspects ? 'Personality Aspects' : 'Aspects'}</h2>
                <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--mute)' }}>Tap an aspect for its full reading</span>
              </div>
              <AstroAspectsTable
                aspects={pAllAspects}
                aspectKey={aspectKeyOf}
                activeKey={focus.stream === 'personality' ? focus.aspectKey : undefined}
                onSelect={(a) => openAspect(a, 'personality')}
              />
            </div>

            {/* Design Aspects Column */}
            {designInAspects && (
            <div>
              <div style={{ borderBottom: '1px solid var(--hair)', paddingBottom: 8, marginBottom: 14 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--hd-design, #a12f2f)', margin: 0 }}>Design Aspects</h2>
              </div>
              <AstroAspectsTable
                aspects={dAllAspects}
                aspectKey={aspectKeyOf}
                activeKey={focus.stream === 'design' ? focus.aspectKey : undefined}
                onSelect={(a) => openAspect(a, 'design')}
              />
            </div>
            )}

          </div>
        )}

        {activeTab === 'Placements' && chartData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
              {copiedPlacements && (
                <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                  ✓ Copied to clipboard!
                </span>
              )}
              <button
                onClick={handleCopyPlacements}
                style={{
                  background: copiedPlacements ? '#10b981' : 'var(--ink, #1b1830)',
                  color: '#fff',
                  border: 'none',

                  padding: '8px 18px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              >
                {copiedPlacements ? 'Copied!' : 'Copy Placements'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: designInPlacements ? 'repeat(auto-fit, minmax(450px, 1fr))' : '1fr', gap: 28 }}>

            {/* Personality Placements Column */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--hair)', paddingBottom: 8, marginBottom: 14 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--gold)', margin: 0 }}>{designInPlacements ? 'Personality Placements' : 'Placements'}</h2>
                <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--mute)' }}>Tap a placement for its full reading</span>
              </div>
              <AstroPlacementsTable
                rows={personalityPlacementsDisplay}
                activeName={focus.stream === 'personality' ? focus.planet : undefined}
                onSelect={(name, data) => openPlacementRow(name, data, 'personality')}
                degreeFormat={degreeFormat}
                showGates={!!config?.wheels.placementGates}
              />

              {/* Personality House Cusps Subsection */}
              {cards.houseCusps && chartData.houseCusps && chartData.houseCusps.length >= 13 && (
                <>
                  <div style={{ borderBottom: '1px solid var(--hair)', paddingBottom: 8, marginTop: 32, marginBottom: 18 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--gold)' }}>Conscious House Cusps</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const houseNum = idx + 1;
                      const lon = chartData.houseCusps[houseNum];
                      const hd = HumanDesignLogic.calculateActivation(lon);
                      const signMeta = ZODIAC_SIGNS.find(s => s.name === hd.sign);
                      const active = focus.stream === 'personality' && focus.house === houseNum;
                      
                      return (
                        <div
                          key={`cusp-p-${houseNum}`}
                          style={{
                            ...editorialCardStyle(active),
                            padding: 12,
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${ELEMENT_COLOR[signMeta?.element || 'air']}08 0%, transparent 55%)`, pointerEvents: 'none' }} />
                          <div style={{ position: 'relative' }}>
                            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>
                              House {houseNum} Cusp
                            </div>
                            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink)', marginBottom: 2 }}>
                              {hd.sign}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--mute)' }}>
                              {formatDeg(lon)} · Gate {hd.gate}.{hd.line}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Design Placements Column */}
            {designInPlacements && (
            <div>
              <div style={{ borderBottom: '1px solid var(--hair)', paddingBottom: 8, marginBottom: 14 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--hd-design, #a12f2f)', margin: 0 }}>Design Placements</h2>
              </div>
              <AstroPlacementsTable
                rows={designPlacementsDisplay}
                activeName={focus.stream === 'design' ? focus.planet : undefined}
                onSelect={(name, data) => openPlacementRow(name, data, 'design')}
                degreeFormat={degreeFormat}
                showGates={!!config?.wheels.placementGates}
              />

              {/* Design House Cusps Subsection */}
              {cards.houseCusps && chartData.designHouseCusps && chartData.designHouseCusps.length >= 13 && (
                <>
                  <div style={{ borderBottom: '1px solid var(--hair)', paddingBottom: 8, marginTop: 32, marginBottom: 18 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--hd-design, #a12f2f)' }}>Unconscious House Cusps</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const houseNum = idx + 1;
                      const lon = chartData.designHouseCusps[houseNum];
                      const hd = HumanDesignLogic.calculateActivation(lon);
                      const signMeta = ZODIAC_SIGNS.find(s => s.name === hd.sign);
                      const active = focus.stream === 'design' && focus.house === houseNum;
                      
                      return (
                        <div
                          key={`cusp-d-${houseNum}`}
                          style={{
                            ...editorialCardStyle(active),
                            padding: 12,
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${ELEMENT_COLOR[signMeta?.element || 'air']}08 0%, transparent 55%)`, pointerEvents: 'none' }} />
                          <div style={{ position: 'relative' }}>
                            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--hd-design, #a12f2f)', marginBottom: 4 }}>
                              House {houseNum} Cusp
                            </div>
                            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink)', marginBottom: 2 }}>
                              {hd.sign}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--mute)' }}>
                              {formatDeg(lon)} · Gate {hd.gate}.{hd.line}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            )}
          </div>
        </div>
      )}
      <ChartAttributionFooter />
      </div>
    </div>
  );
}

function serializeChart(data: any): any {
  return JSON.parse(JSON.stringify(data, (_k, v) => {
    if (v instanceof Set) return Array.from(v);
    if (v instanceof Map) return Object.fromEntries(v);
    return v;
  }));
}

function deserializeChart(data: any): any {
  if (!data) return null;
  return {
    ...data,
    activeGates: new Set(data.activeGates || []),
    definedCenters: new Set(data.definedCenters || []),
    // Dual wheel has designActivations as well, make sure they also deserialize sets properly if present
    designActiveGates: new Set(data.designActiveGates || []),
    designDefinedCenters: new Set(data.designDefinedCenters || []),
  };
}

