import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { EphemerisService } from '../services/EphemerisService';
import { AstroWheel } from '../components/AstroWheel';
import ChartAttributionFooter from '../components/ChartAttributionFooter';
import { analyzeAstroInsights, AstroInsights, AstroPlanetLike } from '../services/AstroInsights';
import { getAngelOverlay, formatAngelDegree } from '../services/AngelOverlayService';
import { AstroPlacementsTable, AstroAspectsTable } from '../components/AstroDataTables';
import { HouseSystemToggle } from '../components/HouseSystemToggle';

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

export default function WheelView({
  initialDate = '',
  initialTime = '',
  initialLat = '',
  initialLng = '',
  initialTimezone = '',
  triggerCalc = 0,
  onChartReady,
  chartData: externalChartData,
  profileIdentity,
  gateChartType = 'wheel',
  gatePresetKey = null,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localChartData, setLocalChartData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('Wheel');
  const [showAspects, setShowAspects] = useState(true);
  const [showCrossPoints, setShowCrossPoints] = useState(true);
  const [focus, setFocus] = useState<FocusState>({});

  // Hook pulled once during render — never inside calculate() (avoids React error #321).
  const { saveChartCache, profileData } = (window as any).LunaCcoHooks?.useUser?.() || {};
  // House system defaults to the user's profile preference (Koch by default).
  const housePref = ( profileData?.settings?.house_system as 'whole_house' | 'placidus' | 'koch' ) || 'koch';
  const [houseSystem, setHouseSystem] = useState<'whole_house' | 'placidus' | 'koch'>(housePref);
  const userTouchedHouse = useRef(false);

  // Sync to the saved preference once it loads, unless the user picked manually.
  useEffect(() => {
    if (!userTouchedHouse.current && profileData?.settings?.house_system) {
      setHouseSystem(profileData.settings.house_system);
    }
  }, [profileData?.settings?.house_system]);

  const prevTrigger = useRef(triggerCalc);
  const prevHouseSystem = useRef(houseSystem);
  const chartData = externalChartData || localChartData;

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
        body: JSON.stringify({ chart_type: gateChartType || 'wheel', preset_key: gatePresetKey || undefined, person_id: personId })
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

  const acts = chartData?.birthActivations || {};

  const insights = useMemo<AstroInsights | null>(() => {
    if (!chartData) return null;
    const planets: AstroPlanetLike[] = Object.entries(acts).map(([name, data]: [string, any]) => ({
      name,
      longitude: data.longitude,
      sign: data.sign,
      house: data.house,
    }));
    return analyzeAstroInsights(planets);
  }, [chartData, acts]);

  const placements = useMemo(
    () => Object.entries(acts).sort((a: any, b: any) => {
      const order = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'NorthNode', 'SouthNode', 'Black Moon Lilith', 'Vulcan', 'Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex'];
      return order.indexOf(a[0]) - order.indexOf(b[0]);
    }).filter(([name]) => name !== 'Earth'),
    [acts]
  );

  const moonPhase = useMemo(() => {
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
  }, [acts]);

  const houseRulers = useMemo(() => {
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
  }, [acts]);

  const destinyLifePurpose = useMemo(() => {
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
  }, [acts, chartData]);

  const dominantPlacement = useMemo(() => {
    const sun = acts.Sun ? { name: 'Sun', ...acts.Sun } : null;
    const moon = acts.Moon ? { name: 'Moon', ...acts.Moon } : null;
    const rising = acts.Ascendant ? { name: 'Ascendant', ...acts.Ascendant } : null;
    return sun || moon || rising;
  }, [acts]);

  const chartRuler = useMemo(() => {
    const risingSign = acts.Ascendant?.sign;
    if (!risingSign) return null;
    const rulerName = MODERN_RULERS[risingSign];
    const planet = acts[rulerName];
    return planet ? { name: rulerName, ...planet } : null;
  }, [acts]);

  const tightAspects = insights?.tightAspects || [];

  const formatDeg = (lon: number) => {
    const inSign = lon % 30;
    const d = Math.floor(inSign);
    const m = Math.floor((inSign - d) * 60);
    return `${d}°${String(m).padStart(2, '0')}'`;
  };

  const angelLine = ( longitude: number | undefined ) => {
    const angel = getAngelOverlay( longitude );
    return angel ? `${angel.name} · ${formatAngelDegree( angel )}` : '';
  };

  const dispatchSelection = (items: SidebarSelectionItem[], nextFocus?: FocusState) => {
    const filtered = items.filter(item => item.sectionType && item.itemKey);
    if (!filtered.length) return;
    if (nextFocus) setFocus(nextFocus);
    window.dispatchEvent(new CustomEvent('astrohd:select-element', { detail: { items: filtered } }));
  };

  const buildPlacementItems = (planetName: string, data: any): SidebarSelectionItem[] => {
    const isAngle = ['Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex'].includes(planetName);
    // One placement item only (angle OR planet) so the sidebar title isn't doubled.
    const items: SidebarSelectionItem[] = [
      isAngle
        ? { sectionType: 'astro_angles_points', itemKey: astroAngleKey(planetName), title: planetName }
        : { sectionType: 'astro_planets', itemKey: astroPlanetKey(planetName), title: planetName },
    ];
    if (data?.sign) items.push({ sectionType: 'astro_signs', itemKey: data.sign, title: data.sign });
    if (data?.house) items.push({ sectionType: 'astro_houses', itemKey: String(data.house), title: `House ${data.house}` });
    return items;
  };

  const openPlacement = (planetName: string) => {
    const data = acts[planetName];
    if (!data) return;
    dispatchSelection(buildPlacementItems(planetName, data), {
      planet: planetName,
      sign: data.sign,
      house: data.house || undefined,
      aspectKey: undefined,
      activeMoonPhase: undefined,
      activeDestiny: undefined,
      activeStellium: undefined,
      activeChartShape: undefined,
    });
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

  const openAspect = (aspect: any) => {
    const a1 = acts[aspect.p1.name] || {};
    const a2 = acts[aspect.p2.name] || {};
    const items = [
      { sectionType: 'astro_aspects', itemKey: aspect.aspect.name, title: aspect.aspect.name, role: 'aspect' },
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
        activeMoonPhase: undefined,
        activeDestiny: undefined,
        activeStellium: undefined,
        activeChartShape: undefined,
      }
    );
  };

  const openMoonPhase = () => {
    if (!moonPhase) return;
    const key = getMoonPhaseKey(moonPhase.angle);
    dispatchSelection(
      [
        { sectionType: 'astro_moon_phases', itemKey: key, title: moonPhase.phaseName, role: 'moon_phase' },
        { sectionType: 'astro_signs', itemKey: String(moonPhase.sign).toLowerCase(), title: moonPhase.sign, role: 'sign' },
        { sectionType: 'astro_houses', itemKey: String(moonPhase.house), title: `House ${moonPhase.house}`, role: 'house' },
      ],
      {
        planet: 'Moon',
        sign: moonPhase.sign,
        house: moonPhase.house || undefined,
        aspectKey: undefined,
        activeMoonPhase: true,
        activeDestiny: undefined,
        activeStellium: undefined,
        activeChartShape: undefined,
      }
    );
  };

  const openDestinyPoint = () => {
    if (!destinyLifePurpose) return;
    dispatchSelection(
      [
        { sectionType: 'hd_destiny_points', itemKey: 'life-purpose', title: 'Life Purpose', role: 'destiny_point' },
        { sectionType: 'hd_gates', itemKey: String(destinyLifePurpose.gate), title: `Gate ${destinyLifePurpose.gate}`, role: 'gate' },
        { sectionType: 'astro_houses', itemKey: String(destinyLifePurpose.house), title: `House ${destinyLifePurpose.house}`, role: 'house' }
      ],
      {
        planet: destinyLifePurpose.name,
        sign: destinyLifePurpose.sign,
        house: destinyLifePurpose.house || undefined,
        aspectKey: undefined,
        activeMoonPhase: undefined,
        activeDestiny: true,
        activeStellium: undefined,
        activeChartShape: undefined,
      }
    );
  };

  const openChartShape = (shape: string) => {
    if (!shape || ['Unclassified', 'Mixed'].includes(shape)) return;
    dispatchSelection(
      [
        { sectionType: 'astro_chart_patterns', itemKey: shape, title: `Chart Shape · ${shape}`, role: 'chart_pattern' }
      ],
      {
        planet: undefined,
        sign: undefined,
        house: undefined,
        aspectKey: undefined,
        activeMoonPhase: undefined,
        activeDestiny: undefined,
        activeStellium: undefined,
        activeChartShape: shape,
      }
    );
  };

  const openStellium = (s: any) => {
    const ROLES = ['planet_a', 'planet_b', 'planet_c', 'planet_d'];
    const items = [
      { sectionType: 'astro_stelliums', itemKey: String(s.sign).toLowerCase(), title: `${s.sign} Stellium`, role: 'stellium' },
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
      activeMoonPhase: undefined,
      activeDestiny: undefined,
      activeStellium: s.sign,
      activeChartShape: undefined,
    });
  };

  const openHouseRuler = (ruler: any) => {
    dispatchSelection([
      { sectionType: 'astro_houses', itemKey: String(ruler.house), title: `House ${ruler.house}` },
      { sectionType: 'astro_signs', itemKey: ruler.houseSign, title: ruler.houseSign },
      { sectionType: 'astro_planets', itemKey: ruler.rulerName, title: ruler.rulerName },
    ], {
      house: ruler.house,
      sign: ruler.houseSign,
      planet: ruler.rulerName,
      aspectKey: undefined,
      activeMoonPhase: undefined,
      activeDestiny: undefined,
      activeStellium: undefined,
      activeChartShape: undefined,
    });
  };

  const handleWheelElementClick = (type: string, id: string, label?: string) => {
    if (type === 'planet') {
      openPlacement(id);
      return;
    }
    if (type === 'sign') {
      dispatchSelection([{ sectionType: 'astro_signs', itemKey: id, title: label || id }], {
        planet: undefined,
        sign: id,
        house: undefined,
        aspectKey: undefined,
      });
      return;
    }
    if (type === 'house') {
      dispatchSelection([{ sectionType: 'astro_houses', itemKey: id, title: label || `House ${id}` }], {
        planet: undefined,
        sign: undefined,
        house: Number(id),
        aspectKey: undefined,
      });
      return;
    }
    if (type === 'aspect' && insights?.allAspects) {
      const aspect = insights.allAspects.find(a => aspectKeyOf(a) === id);
      if (aspect) openAspect(aspect);
    }
  };

  const quickActions = useMemo(() => {
    const actions: Array<{ label: string; kicker: string; onClick: () => void; active: boolean }> = [];
    if (acts.Sun) {
      actions.push({
        label: 'Sun',
        kicker: `${acts.Sun.sign}${acts.Sun.house ? ` · H${acts.Sun.house}` : ''}`,
        onClick: () => openPlacement('Sun'),
        active: focus.planet === 'Sun',
      });
    }
    if (acts.Moon) {
      actions.push({
        label: 'Moon',
        kicker: `${acts.Moon.sign}${acts.Moon.house ? ` · H${acts.Moon.house}` : ''}`,
        onClick: () => openPlacement('Moon'),
        active: focus.planet === 'Moon',
      });
    }
    if (acts.Ascendant) {
      actions.push({
        label: 'Rising',
        kicker: `${acts.Ascendant.sign} · H1`,
        onClick: () => openPlacement('Ascendant'),
        active: focus.planet === 'Ascendant',
      });
    }
    if (chartRuler) {
      actions.push({
        label: 'Chart Ruler',
        kicker: `${chartRuler.name} · ${chartRuler.sign}`,
        onClick: () => openPlacement(chartRuler.name),
        active: focus.planet === chartRuler.name,
      });
    }
    if (acts.NorthNode) {
      actions.push({
        label: 'North Node',
        kicker: `${acts.NorthNode.sign}${acts.NorthNode.house ? ` · H${acts.NorthNode.house}` : ''}`,
        onClick: () => openPlacement('NorthNode'),
        active: focus.planet === 'NorthNode',
      });
    }
    if (destinyLifePurpose) {
      actions.push({
        label: 'Destiny Point',
        kicker: `${destinyLifePurpose.name} · ${destinyLifePurpose.sign}`,
        onClick: openDestinyPoint,
        active: !!focus.activeDestiny,
      });
    }
    return actions.slice(0, 6);
  }, [acts, chartRuler, destinyLifePurpose, focus]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '20px 24px 28px' }}>
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

      <div style={{ marginBottom: 24, borderBottom: '1px solid var(--ink)', paddingBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
          Natal · Astrology Map
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 32, color: 'var(--ink)', lineHeight: 1.1, margin: 0 }}>
          {displayName}{hasName ? "'s" : ''} <em style={{ color: 'var(--gold)' }}>Astrology Map</em>
        </h1>
        </div>

        <HouseSystemToggle value={houseSystem} onChange={(h) => { userTouchedHouse.current = true; setHouseSystem(h); }} />
      </div>

      <div style={{ display: 'flex', gap: 28, marginBottom: 28, paddingBottom: 12, borderBottom: '1px solid var(--hair)', alignItems: 'center' }}>
        {['Wheel', 'Insights', 'Aspects', 'Placements'].map(t => (
          <button
            key={t}
            className={`astro-wheel-tab${activeTab === t ? ' active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
        {activeTab === 'Wheel' && chartData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: 24, alignItems: 'start' }}>
            <div style={{ ...editorialCardStyle(Boolean(focus.planet || focus.sign || focus.house || focus.aspectKey)), padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>
                    Wheel Interactions
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--mute)', fontStyle: 'italic' }}>
                    Click planets, sign rings, house numbers, or aspect glyphs to load their definitions in the sidebar.
                  </div>
                </div>
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
              </div>

              <div style={{ background: 'radial-gradient(circle at 50% 40%, rgba(212,175,55,0.08) 0%, rgba(0,0,0,0) 48%), linear-gradient(180deg, rgba(20,18,16,0.02) 0%, rgba(20,18,16,0.06) 100%)', padding: 18, border: '1px solid color-mix(in srgb, var(--gold, #d4af37) 10%, var(--hair))' }}>
                <AstroWheel
                  activations={acts}
                  size={560}
                  hideAspects={!showAspects}
                  showCrossPoints={showCrossPoints}
                  onElementClick={handleWheelElementClick}
                  selectedPlanet={focus.planet}
                  selectedSign={focus.sign}
                  selectedHouse={focus.house}
                  selectedAspectKey={focus.aspectKey}
                  cusps={chartData?.houseCusps}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {quickActions.map(action => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  style={{
                    ...editorialCardStyle(action.active),
                    textAlign: 'left',
                    padding: '16px 16px 15px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 5 }}>
                    {action.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 17, color: 'var(--ink)', lineHeight: 1.15 }}>
                    {action.kicker}
                  </div>
                  {['Sun', 'Moon', 'Rising'].includes(action.label) && (
                    <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 6, lineHeight: 1.35 }}>
                      {angelLine(action.label === 'Rising' ? acts.Ascendant?.longitude : acts[action.label]?.longitude)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Insights' && insights && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, maxWidth: 1040 }}>
            {moonPhase && (
              <button
                onClick={openMoonPhase}
                style={{ ...editorialCardStyle(!!focus.activeMoonPhase), padding: 20, textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Moon Phase</div>
                <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                  {moonPhase.phaseEmoji} {moonPhase.phaseName}
                </div>
                <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                  Moon in {moonPhase.sign} · House {moonPhase.house || '—'}
                </div>
              </button>
            )}

            {destinyLifePurpose && (
              <button
                onClick={openDestinyPoint}
                style={{ ...editorialCardStyle(!!focus.activeDestiny), padding: 20, textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Purpose Marker</div>
                <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                  {destinyLifePurpose.name}
                </div>
                <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                  {destinyLifePurpose.sign} {formatDeg(destinyLifePurpose.longitude)} · H{destinyLifePurpose.house || '—'}
                </div>
              </button>
            )}

            {dominantPlacement && (
              <button
                onClick={() => openPlacement(dominantPlacement.name)}
                style={{ ...editorialCardStyle(focus.planet === dominantPlacement.name), padding: 20, textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Signature Placement</div>
                <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                  {dominantPlacement.name} in {dominantPlacement.sign}
                </div>
                <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                  {formatDeg(dominantPlacement.longitude)} · House {dominantPlacement.house || '—'}
                </div>
              </button>
            )}

            {chartRuler && (
              <button
                onClick={() => openPlacement(chartRuler.name)}
                style={{ ...editorialCardStyle(focus.planet === chartRuler.name), padding: 20, textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Chart Ruler</div>
                <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                  {chartRuler.name} in {chartRuler.sign}
                </div>
                <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                  Rising sign {acts.Ascendant?.sign} · House {chartRuler.house || '—'}
                </div>
              </button>
            )}

            <button
              onClick={() => openChartShape(insights.chartShape)}
              style={{ ...editorialCardStyle(focus.activeChartShape === insights.chartShape), padding: 20, textAlign: 'left', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Chart Shape</div>
              <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
                {insights.chartShape}
              </div>
              <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.5 }}>
                Use the placements and aspects cards to open the components that create this pattern.
              </div>
            </button>

            <div style={{ ...editorialCardStyle(false), padding: 20, gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>Tight Aspects (≤2°)</div>
              {tightAspects.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {tightAspects.map((aspect, idx) => (
                    <button
                      key={`${aspectKeyOf(aspect)}-${idx}`}
                      onClick={() => openAspect(aspect)}
                      style={{
                        padding: '10px 12px',
                        border: focus.aspectKey === aspectKeyOf(aspect) ? '1px solid var(--gold)' : '1px solid var(--hair)',
                        background: focus.aspectKey === aspectKeyOf(aspect) ? 'color-mix(in srgb, var(--gold, #d4af37) 10%, var(--card))' : 'var(--card)',
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

            {insights.stelliums.length > 0 && (
              <div style={{ ...editorialCardStyle(false), padding: 20, gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>Stelliums</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  {insights.stelliums.map((stellium, idx) => (
                    <button
                      key={`stellium-${idx}`}
                      onClick={() => openStellium(stellium)}
                      style={{ ...editorialCardStyle(focus.activeStellium === stellium.sign), padding: 16, textAlign: 'left', cursor: 'pointer' }}
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

            <div style={{ ...editorialCardStyle(false), padding: 20, gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>House Rulers</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {houseRulers.map(ruler => (
                  <button
                    key={`house-ruler-${ruler.house}`}
                    onClick={() => openHouseRuler(ruler)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 1.2fr 1fr 1.2fr',
                      gap: 12,
                      alignItems: 'center',
                      padding: '12px 14px',
                      border: focus.house === ruler.house ? '1px solid var(--gold)' : '1px solid var(--hair)',
                      background: focus.house === ruler.house ? 'color-mix(in srgb, var(--gold, #d4af37) 8%, var(--card))' : 'var(--card)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--ink)' }}>H{ruler.house}</div>
                    <div style={{ fontSize: 14, color: 'var(--ink)' }}>{ruler.houseSign}</div>
                    <div style={{ fontSize: 14, color: primary }}>{ruler.rulerName}</div>
                    <div style={{ fontSize: 13, color: 'var(--mute)' }}>in H{ruler.currentHouse || '—'} · {ruler.sign}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Aspects' && insights?.allAspects && (
          <AstroAspectsTable
            aspects={insights.allAspects}
            aspectKey={aspectKeyOf}
            activeKey={focus.aspectKey}
            onSelect={(a) => openAspect(a)}
          />
        )}

        {activeTab === 'Placements' && chartData && (
          <AstroPlacementsTable
            rows={placements}
            activeName={focus.planet}
            onSelect={(name) => openPlacement(name)}
          />
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
  };
}

