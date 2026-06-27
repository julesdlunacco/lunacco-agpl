import { useState, useEffect, useRef, useMemo } from 'react';
import { EphemerisService } from '../services/EphemerisService';
import { Bodygraph } from '../components/Bodygraph';
import ChartAttributionFooter from '../components/ChartAttributionFooter';
import { AstroWheel } from '../components/AstroWheel';
import { PlanetDetailsTable } from '../components/PlanetDetailsTable';
import { analyzeAstroInsights, AstroInsights, AstroPlanetLike } from '../services/AstroInsights';
import { fetchDefinitions, resolveDefinition, Definition } from '../services/DefinitionService';
import { ChartConfig } from '../services/chartConfig';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODERN_RULERS: Record<string, string> = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Pluto',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Uranus', Pisces: 'Neptune',
};

const ZODIAC_SIGNS = [
  { name: 'Aries' }, { name: 'Taurus' }, { name: 'Gemini' }, { name: 'Cancer' },
  { name: 'Leo' }, { name: 'Virgo' }, { name: 'Libra' }, { name: 'Scorpio' },
  { name: 'Sagittarius' }, { name: 'Capricorn' }, { name: 'Aquarius' }, { name: 'Pisces' },
];

// ─── REST helpers ─────────────────────────────────────────────────────────────

const REST_ROOT = ( () => {
  const d = ( window as any ).LunaCcoData || {};
  return ( d.root || '/wp-json/' ).replace( /\/$/, '' ) + '/';
} )();
const NONCE = ( () => ( ( window as any ).LunaCcoData || {} ).nonce || '' )();

async function fetchJSON( path: string, init: RequestInit = {} ) {
  const res = await fetch( REST_ROOT + path, {
    credentials: 'same-origin', ...init,
    headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': NONCE, ...( ( init as any ).headers || {} ) },
  } );
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse( text ) : null; } catch { body = text; }
  if ( !res.ok ) throw new Error( ( body && body.message ) || `${ res.status }` );
  return body;
}

// ─── View component ───────────────────────────────────────────────────────────

type Props = {
  initialDate?:     string;
  initialTime?:     string;
  initialLat?:      string;
  initialLng?:      string;
  initialTimezone?: string;
  triggerCalc?:     number;
  onChartReady?:    ( data: any ) => void;
  profileIdentity?: any;
  config?:          ChartConfig;
};

export default function CombinedView( {
  initialDate = '', initialTime = '', initialLat = '', initialLng = '',
  initialTimezone = '', triggerCalc = 0, onChartReady,
  profileIdentity, config, gateChartType = 'combined', gatePresetKey = null,
}: Props ) {
  const degreeFormat = config?.wheels?.degreeFormat || 'compact';
  const gateDetail = config?.bodygraph?.gateDetail;
  const [ busy,      setBusy      ] = useState( false );
  const [ error,     setError     ] = useState<string | null>( null );
  const [ chartData, setChartData ] = useState<any>( null );
  const [ activeTab, setActiveTab ] = useState('Combined');
  const [ selectedItem,   setSelectedItem   ] = useState<{ section_type: string, item_key: string, title?: string } | null>(null);
  const prevTrigger = useRef( triggerCalc );

  // Hook pulled once during render — never inside calculate() (avoids React error #321).
  const { saveChartCache } = ( window as any ).LunaCcoHooks?.useUser?.() || {};

  const form = {
    date:      initialDate,
    time:      initialTime  || '12:00',
    latitude:  initialLat,
    longitude: initialLng,
    timezone:  initialTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };

  async function calculate() {
    if ( !form.date || !form.latitude || !form.longitude ) {
      setError( 'Birth date and location are required.' );
      return;
    }
    setError( null ); setChartData( null ); setBusy( true );
    try {
      const cache = profileIdentity?.chart_cache || {};
      const cacheKey = 'natal_whole_house';
      if ( cache[cacheKey] ) {
        const cached = cache[cacheKey];
        const cachedDate = cached.input?.date?.substring( 0, 16 );
        const formDate = form.date?.substring( 0, 16 );
        if ( cachedDate === formDate ) {
          const deserialized = deserializeChart( cached.data );
          setChartData( deserialized );
          onChartReady?.( deserialized );
          setBusy( false );
          return;
        }
      }

      const personId = profileIdentity?.id !== undefined ? profileIdentity.id : null;
      const tokenRes = await fetchJSON( 'luna-astrohd/v1/calc-token', {
        method: 'POST',
        body: JSON.stringify( { chart_type: gateChartType || 'combined', preset_key: gatePresetKey || undefined, person_id: personId } )
      } );
      const formWithHouse = { ...form, houseSystem: 'whole_house' as const };
      const data = await EphemerisService.getInstance().getChartData( formWithHouse );
      setChartData( data );
      onChartReady?.( data );

      if ( typeof saveChartCache === 'function' ) {
        await saveChartCache( personId, cacheKey, {
          input: formWithHouse,
          data: serializeChart( data ),
          token: tokenRes?.token,
        } );
      }
    } catch ( e: any ) {
      setError( e?.message || 'Calculation failed.' );
    } finally {
      setBusy( false );
    }
  }

  useEffect( () => { if ( triggerCalc !== prevTrigger.current ) { prevTrigger.current = triggerCalc; calculate(); } } );
  useEffect( () => { if ( initialDate && initialLat && initialLng ) calculate(); }, [] ); // eslint-disable-line

  // Dispatch selection event for shell panel
  const handleElementClick = (type: any, id: string, label?: string) => {
    let sectionType = '';
    let itemKey = id;

    switch (type) {
      case 'gate':   sectionType = 'hd_gates'; break;
      case 'center': sectionType = 'hd_centers'; break;
      case 'planet': 
        sectionType = 'hd_planets'; 
        break;
      case 'sign':   sectionType = 'astro_signs'; break;
      case 'house':  sectionType = 'astro_houses'; break;
      case 'hd_destiny_points': sectionType = 'hd_destiny_points'; break;
      case 'hd_variables': sectionType = 'hd_variables'; break;
    }

    if (sectionType) {
      setSelectedItem({ section_type: sectionType, item_key: itemKey, title: label });
      window.dispatchEvent(new CustomEvent('astrohd:select-element', { 
        detail: { sectionType, itemKey, title: label } 
      }));
    }
  };

  const acts = chartData?.birthActivations || {};
  const designActs = chartData?.designActivations || {};

  // ─── Astrological Calculations ──────────────────────────────────────────────

  const insights = useMemo<AstroInsights | null>(() => {
    if (!chartData) return null;
    const planets: AstroPlanetLike[] = Object.entries(acts).map(([name, data]: [string, any]) => ({
      name, longitude: data.longitude, sign: data.sign, house: data.house,
    }));
    return analyzeAstroInsights(planets);
  }, [chartData, acts]);

  const moonPhase = useMemo(() => {
    if (!acts.Sun || !acts.Moon) return null;
    const sunLong = acts.Sun.longitude, moonLong = acts.Moon.longitude;
    let phaseAngle = (moonLong - sunLong + 360) % 360;
    let phaseName = '', phaseEmoji = '';
    if (phaseAngle < 22.5) { phaseName = 'New Moon'; phaseEmoji = '🌑'; }
    else if (phaseAngle < 67.5) { phaseName = 'Waxing Crescent'; phaseEmoji = '🌒'; }
    else if (phaseAngle < 112.5) { phaseName = 'First Quarter'; phaseEmoji = '🌓'; }
    else if (phaseAngle < 157.5) { phaseName = 'Waxing Gibbous'; phaseEmoji = '🌔'; }
    else if (phaseAngle < 202.5) { phaseName = 'Full Moon'; phaseEmoji = '🌕'; }
    else if (phaseAngle < 247.5) { phaseName = 'Waning Gibbous'; phaseEmoji = '🌖'; }
    else if (phaseAngle < 292.5) { phaseName = 'Last Quarter'; phaseEmoji = '🌗'; }
    else if (phaseAngle < 337.5) { phaseName = 'Waning Crescent'; phaseEmoji = '🌘'; }
    else { phaseName = 'New Moon'; phaseEmoji = '🌑'; }
    return { phaseName, phaseEmoji, angle: phaseAngle, sign: acts.Moon.sign, house: acts.Moon.house };
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
    let best: any = null, bestVal = -1;
    allowed.forEach(name => {
      const p = acts[name];
      if (p) {
        const val = p.longitude % 30;
        if (val > bestVal) { bestVal = val; best = { name, ...p }; }
      }
    });
    return best;
  }, [acts, chartData]);

  const formatDeg = (lon: number) => {
    const inSign = lon % 30, d = Math.floor(inSign), m = Math.floor((inSign - d) * 60);
    return `${d}°${String(m).padStart(2, '0')}'`;
  };

  const primary = 'var(--gold, #d4af37)';
  const displayName = profileIdentity?.full_name || profileIdentity?.display_name || profileIdentity?.nickname || 'Natal';
  const hasName = !!(profileIdentity?.full_name || profileIdentity?.display_name || profileIdentity?.nickname);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      { busy && (
        <div style={{ padding: '10px 24px', background: 'var(--indigo)', color: 'var(--btn-fg, white)', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', flexShrink: 0 }}>
          Calculating chart…
        </div>
      ) }
      { error && (
        <div style={{ padding: '10px 24px', background: '#fef2f2', color: '#b91c1c', fontSize: 12, flexShrink: 0 }}>{ error }</div>
      ) }

      { !chartData && !busy && !error && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.35, padding: 40 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink)', textAlign: 'center' }}>
            Select a person and press Calculate<br />to generate the combined chart.
          </p>
        </div>
      ) }

      { chartData && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }}>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>
                Combined · AstroHD
              </p>
              <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--ink)', lineHeight: 1.1, margin: 0 }}>
                { displayName }{hasName ? "'s" : ""} Map
                <em style={{ fontSize: 16, fontWeight: 400, color: 'var(--mute)', marginLeft: 12 }}>{ chartData.profile } { chartData.modality }</em>
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {['Combined', 'Astro Insights', 'Astro Aspects'].map(t => (
                <button key={t} onClick={() => setActiveTab(t)} style={{
                  fontFamily: 'var(--font-display)', fontSize: 15, fontStyle: 'italic',
                  color: activeTab === t ? 'var(--ink)' : 'var(--mute)', background: 'none', border: 'none',
                  borderBottom: activeTab === t ? `2px solid ${primary}` : 'none', cursor: 'pointer', paddingBottom: 2
                }}>{t}</button>
              ))}
            </div>
          </div>

          { activeTab === 'Combined' ? (
            <>
              <div style={{ display: 'flex', border: '1px solid var(--ink)', marginBottom: 24 }}>
                { [
                  [ 'Type',       chartData.type || '—',            'hd_types', chartData.strategy ],
                  [ 'Profile',    `${ chartData.profile || '—' } ${ chartData.modality || '' }`, 'hd_profiles' ],
                  [ 'Authority',  chartData.authority || '—', 'hd_authorities' ],
                  [ 'Sun ☉',     acts.Sun?.sign || '—',            'hd_planets', designActs.Sun?.sign ],
                  [ 'Moon ☽',    acts.Moon?.sign || '—',           'hd_planets', designActs.Moon?.sign ],
                  [ 'ASC',        acts.Ascendant?.sign || '—',      'hd_angles_points', designActs.Ascendant?.sign ],
                ].map( ( [ label, val, section, sub ]: any, i ) => (
                  <div 
                    key={ label as string } 
                    onClick={() => handleElementClick(section, val, label)}
                    style={{ flex: 1, padding: '8px 12px', borderRight: i < 5 ? '1px solid var(--hair)' : 'none', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>{ label }</div>
                    { i < 3 ? (
                      <div style={{ minHeight: 34, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, lineHeight: 1.1, color: 'var(--ink)' }}>{ val }</div>
                        { sub && <div style={{ fontSize: 9, color: 'var(--mute)', marginTop: 2, fontStyle: 'italic' }}>{ sub }</div> }
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--hd-personality, #1b1830)' }}></div>
                          <span style={{ fontSize: 7, fontWeight: 800, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pers</span>
                          <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink)', marginLeft: 'auto' }}>{ val }</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--hair)', paddingTop: 4 }}>
                          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--hd-design, #a12f2f)' }}></div>
                          <span style={{ fontSize: 7, fontWeight: 800, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Design</span>
                          <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink)', marginLeft: 'auto' }}>{ sub || '—' }</span>
                        </div>
                      </div>
                    ) }
                  </div>
                ) ) }
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start', marginBottom: 48 }}>
                <div>
                  <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 16, opacity: 0.7 }}>
                    Fig. I · Human Design Bodygraph
                  </p>
                  <div style={{ border: '1px solid var(--hair)', background: 'var(--card)', padding: '24px 16px' }}>
                    <Bodygraph 
                        data={ chartData } 
                        hideVariables={ true } 
                        onElementClick={handleElementClick}
                        highlightedGate={selectedItem?.section_type === 'hd_gates' ? parseInt(selectedItem.item_key) : undefined}
                        highlightedCenter={selectedItem?.section_type === 'hd_centers' ? selectedItem.item_key : undefined}
                    />
                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--hair)', background: 'rgba(0,0,0,0.02)', marginTop: 12 }}>
                      <p style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                        { chartData.type } · { chartData.strategy }
                      </p>
                      <p style={{ textAlign: 'center', fontSize: 9, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, opacity: 0.8 }}>
                        { chartData.profile } { chartData.modality } · { chartData.definitionType }
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 16, opacity: 0.7 }}>
                    Fig. II · Natal Astrology Wheel
                  </p>
                  <div style={{ border: '1px solid var(--hair)', background: 'var(--card)', padding: '24px 16px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <AstroWheel 
                        activations={ acts } 
                        secondaryActivations={ designActs } 
                        size={ 500 } 
                        hideAspects={ true } 
                        onElementClick={handleElementClick}
                        selectedPlanet={selectedItem?.section_type === 'hd_planets' || selectedItem?.section_type === 'astro_planets' ? selectedItem.item_key : undefined}
                        selectedSign={selectedItem?.section_type === 'astro_signs' ? selectedItem.item_key : undefined}
                      />
                    </div>
                    <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--card)', padding: '12px 16px', border: '1px solid var(--hair)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--gold)', marginBottom: 2 }}>Elements</span>
                      { [ { name: 'fire', col: 'var(--astro-fire, #f87171)' }, { name: 'earth', col: 'var(--astro-earth, #86efac)' }, { name: 'air', col: 'var(--astro-air, #7dd3fc)' }, { name: 'water', col: 'var(--astro-water, #a5b4fc)' } ].map( el => (
                        <div key={ el.name } style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: el.col }}></div>
                          <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink)' }}>{ el.name }</span>
                        </div>
                      ) ) }
                    </div>
                    <p style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mute)', marginTop: 16, opacity: 0.6 }}>
                      { acts.Ascendant ? `ASC ${ acts.Ascendant.sign }` : 'No ASC — enter birth time for houses' }
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '2px solid var(--ink)', paddingTop: 24, marginBottom: 32 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: 'var(--ink)', margin: '0 0 16px' }}>Planet Activations</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <PlanetDetailsTable
                    activations={ designActs }
                    title="Design · Body"
                    color="var(--hd-design, #a12f2f)"
                    onSelect={handleElementClick}
                    selectedPlanet={selectedItem?.item_key}
                    degreeFormat={degreeFormat}
                    gateDetail={gateDetail}
                  />
                  <PlanetDetailsTable
                    activations={ acts }
                    title="Personality · Mind"
                    color="var(--hd-personality, #1b1830)"
                    onSelect={handleElementClick}
                    selectedPlanet={selectedItem?.item_key}
                    degreeFormat={degreeFormat}
                    gateDetail={gateDetail}
                  />
                </div>
              </div>

              { /* Destiny Points Map */ }
              <DestinyPointsMap data={ chartData } onSelect={handleElementClick} />
            </>
          ) : activeTab === 'Astro Insights' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div style={{ background: 'var(--card)', padding: 24, borderRadius: 12, border: '1px solid var(--hair)' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: primary, fontSize: 18, marginBottom: 16 }}>✦ Celestial Signature</h3>
                  {moonPhase && <div style={{ marginBottom: 12 }}><strong style={{ fontSize: 12, color: 'var(--mute)' }}>MOON PHASE</strong><div style={{ fontSize: 16, color: 'var(--ink)' }}>{moonPhase.phaseEmoji} {moonPhase.phaseName} in {moonPhase.sign} (H{moonPhase.house})</div></div>}
                  {destinyLifePurpose && <div style={{ marginBottom: 12 }}><strong style={{ fontSize: 12, color: 'var(--mute)' }}>DESTINY PURPOSE</strong><div style={{ fontSize: 16, color: 'var(--ink)' }}>{destinyLifePurpose.name} · {destinyLifePurpose.sign} {formatDeg(destinyLifePurpose.longitude)} (H{destinyLifePurpose.house} · Gate {destinyLifePurpose.gate})</div></div>}
                  {insights && <div><strong style={{ fontSize: 12, color: 'var(--mute)' }}>CHART SHAPE</strong><div style={{ fontSize: 16, color: 'var(--ink)' }}>{insights.chartShape}</div></div>}
                </div>
                <div style={{ background: 'var(--card)', padding: 24, borderRadius: 12, border: '1px solid var(--hair)' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: primary, fontSize: 18, marginBottom: 16 }}>✦ Tight Aspects</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {insights?.tightAspects.map((a,i) => (
                      <div key={i} style={{ padding: '6px 10px', background: 'rgba(212,175,55,0.05)', border: `1px solid ${primary}33`, borderRadius: 6, fontSize: 12 }}>
                        {a.p1.name} <span style={{ color: a.aspect.color }}>{a.aspect.symbol}</span> {a.p2.name} ({a.orb.toFixed(1)}°)
                      </div>
                    ))}
                    {(!insights?.tightAspects.length) && <div style={{ color: 'var(--mute)', fontStyle: 'italic', fontSize: 13 }}>No tight aspects (≤2°).</div>}
                  </div>
                </div>
              </div>

              {insights?.stelliums && insights.stelliums.length > 0 && (
                <div style={{ background: 'var(--card)', padding: 24, borderRadius: 12, border: '1px solid var(--hair)' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: primary, fontSize: 18, marginBottom: 16 }}>✦ Stelliums</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {insights.stelliums.map((s, i) => (
                      <div key={i} style={{ color: 'var(--ink)', fontSize: 14 }}>
                        <strong>Stellium in {s.sign} (H{s.planets[0]?.house || '—'}):</strong> {s.planets.map(p => p.name).join(', ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ background: 'var(--card)', padding: 24, borderRadius: 12, border: '1px solid var(--hair)' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: primary, fontSize: 18, marginBottom: 16 }}>✦ House Rulers</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--hair)', textAlign: 'left' }}><th style={{ padding: 8 }}>House</th><th style={{ padding: 8 }}>Sign</th><th style={{ padding: 8 }}>Ruler</th><th style={{ padding: 8 }}>Current Location</th></tr></thead>
                    <tbody>
                      {houseRulers.map(r => (
                        <tr key={r.house} style={{ borderBottom: '1px solid var(--hair)' }}>
                          <td style={{ padding: 8, fontWeight: 700 }}>{r.house}</td>
                          <td style={{ padding: 8 }}>{r.houseSign}</td>
                          <td style={{ padding: 8, color: primary }}>{r.rulerName}</td>
                          <td style={{ padding: 8, color: 'var(--mute)' }}>in H{r.currentHouse} ({r.sign}) Gate {r.gate}.{r.line}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {insights?.patternAlerts && insights.patternAlerts.length > 0 && (
                <div style={{ background: 'var(--card)', padding: 24, borderRadius: 12, border: '1px solid var(--hair)' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: primary, fontSize: 18, marginBottom: 16 }}>✦ Celestial Patterns</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {insights.patternAlerts.map((a, i) => (
                      <div key={i} style={{ color: 'var(--ink)', fontSize: 14 }}>{a}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--card)', border: '1px solid var(--hair)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--hair)', background: 'rgba(0,0,0,0.02)', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr 1fr', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                <span>Planet 1</span>
                <span style={{ textAlign: 'center' }}>Aspect</span>
                <span>Planet 2</span>
                <span style={{ textAlign: 'right' }}>Orb</span>
              </div>
              {insights?.allAspects && insights.allAspects.map((a, i) => (
                <div key={i} style={{ 
                  padding: '14px 20px', 
                  borderBottom: i === insights.allAspects.length - 1 ? 'none' : '1px solid var(--hair)', 
                  display: 'grid', 
                  gridTemplateColumns: '1.5fr 1fr 1.5fr 1fr', 
                  alignItems: 'center',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)'
                }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink)' }}>{a.p1.name}</span>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ color: a.aspect.color, fontSize: 20, lineHeight: 1 }}>{a.aspect.symbol}</span>
                    <div style={{ fontSize: 8, color: a.aspect.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{a.aspect.name}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink)' }}>{a.p2.name}</span>
                  <span style={{ textAlign: 'right', fontSize: 13, color: 'var(--mute)', fontWeight: 300 }}>{a.orb.toFixed(2)}°</span>
                </div>
              ))}
            </div>
          )}
          {/* Attribution + legal links (text dynamic from Business Settings) */}
          <ChartAttributionFooter />
        </div>
      ) }
    </div>
  );
}

// ------------------------------------------------------------------
// Destiny Points Map
// ------------------------------------------------------------------
function DestinyPointsMap( { data, onSelect }: { data: any, onSelect: any } ) {
  const dActs = data?.designActivations || {};
  const pActs = data?.birthActivations || {};

  const findHighest = ( activations: any ) => {
    const order = [ 'Sun', 'Earth', 'NorthNode', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto' ];
    let best: any = null, bestVal = -1;
    order.forEach( name => {
      const p = activations[ name ];
      if ( p ) {
        const val = p.longitude % 30;
        if ( val > bestVal ) { bestVal = val; best = { name, ...p }; }
      }
    } );
    return best;
  };

  const lifePurpose = findHighest( pActs );
  const soulPurpose = findHighest( dActs );

  if ( ! lifePurpose && ! soulPurpose ) return null;

  return (
    <div style={{ marginTop: 40, borderTop: '2px solid var(--ink)', paddingTop: 24 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: 'var(--ink)', margin: '0 0 20px' }}>Destiny Map</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        { lifePurpose && (
          <div 
            onClick={() => onSelect('hd_destiny_points', 'life-purpose', 'Life Purpose')}
            style={{ background: 'var(--card)', padding: 20, border: '1px solid var(--hair)', borderRadius: 12, cursor: 'pointer' }}
          >
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>✦ Life Purpose (Personality)</div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--ink)', marginBottom: 4 }}>
              { lifePurpose.name } in { lifePurpose.sign }
            </div>
            <div style={{ fontSize: 13, color: 'var(--mute)' }}>
              Gate { lifePurpose.gate }.{ lifePurpose.line } · House { lifePurpose.house || '—' }
            </div>
          </div>
        ) }
        { soulPurpose && (
          <div 
            onClick={() => onSelect('hd_destiny_points', 'soul-purpose', 'Soul Purpose')}
            style={{ background: 'var(--card)', padding: 20, border: '1px solid var(--hair)', borderRadius: 12, cursor: 'pointer' }}
          >
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>✦ Soul Purpose (Design)</div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--ink)', marginBottom: 4 }}>
              { soulPurpose.name } in { soulPurpose.sign }
            </div>
            <div style={{ fontSize: 13, color: 'var(--mute)' }}>
              Gate { soulPurpose.gate }.{ soulPurpose.line } · House { soulPurpose.house || '—' }
            </div>
          </div>
        ) }
      </div>
    </div>
  );
}

function serializeChart( data: any ): any {
  return JSON.parse( JSON.stringify( data, ( _k, v ) => {
    if ( v instanceof Set ) return Array.from( v );
    if ( v instanceof Map ) return Object.fromEntries( v );
    return v;
  } ) );
}

function deserializeChart( data: any ): any {
  if ( ! data ) return null;
  return {
    ...data,
    activeGates:    new Set( data.activeGates || [] ),
    definedCenters: new Set( data.definedCenters || [] ),
    designActiveGates: new Set( data.designActiveGates || [] ),
    designDefinedCenters: new Set( data.designDefinedCenters || [] ),
  };
}

