/**
 * Transit view — renders today's transit bodygraph for the user's current location/time.
 * Optimized for a single-side view (personality/transits only) without design activations.
 */

import { useEffect, useRef, useState } from 'react';
import { EphemerisService } from '../services/EphemerisService';
import { Bodygraph } from '../components/Bodygraph';
import ChartAttributionFooter from '../components/ChartAttributionFooter';
import { HumanDesignLogic } from '../services/HumanDesignLogic';
import { AstroWheel } from '../components/AstroWheel';
import { Glyph } from '../components/Glyph';
import { analyzeAstroInsights, AstroInsights, AstroPlanetLike } from '../services/AstroInsights';
import { useMemo } from 'react';
import { FixingState } from '../services/fixationData';
import { DateTime } from 'luxon';

const TRANSIT_CACHE_KEY = 'lunacco_transit_chart_cache_v2';
const CACHE_MINUTES = 60;

// ------------------------------------------------------------------
// Components copied/adapted from NatalView for consistency
// ------------------------------------------------------------------

const PLANET_ORDER = [ 
  'Sun', 'Earth', 'NorthNode', 'SouthNode', 'Moon', 'Mercury', 
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 
  'Chiron', 'Black Moon Lilith', 'Vulcan' 
];

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: '☉', Earth: '⊕', NorthNode: '☊', SouthNode: '☋', Moon: '☽',
  Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄',
  Uranus: '♅', Neptune: '♆', Pluto: '♇', Chiron: '⚷', 'Black Moon Lilith': '⚸', Vulcan: 'Vu'
};

function TransitGateList( { data }: { data: any } ) {
  const color = 'var(--hd-personality, var(--ink, #1b1830))';
  const activations = data?.birthActivations || {};

  const planets = PLANET_ORDER
    .filter( name => activations[ name ] )
    .map( name => ( { planet: name, symbol: PLANET_SYMBOLS[ name ] || name[ 0 ], ...activations[ name ] } ) );

  if ( ! planets.length ) return null;

  return (
    <div style={{ flex: 1, minWidth: 280 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, background: color, borderRadius: '50%', flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mute)' }}>Current Transits</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        { planets.map( ( p: any, i: number ) => (
          <div key={ i } style={{
            display: 'grid', gridTemplateColumns: '28px 50px 1fr 40px', alignItems: 'center',
            padding: '6px 10px', border: '1px solid var(--hair)', background: 'var(--card)',
            gap: 8, fontSize: 13,
          }}>
            <span style={{
              fontStyle: 'italic',
              color,
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              display: 'inline-flex',
              alignItems: 'baseline',
              justifyContent: 'center',
            }} title={p.planet}>
              <Glyph kind="planet" name={ p.planet } size={ 16 } />
              { p.isRetrograde && (
                <span 
                  title="Retrograde"
                  style={{ 
                    fontSize: 11, 
                    fontStyle: 'normal',
                    fontWeight: 900,
                    marginLeft: 2,
                    color: 'var(--hd-active, var(--gold))',
                    lineHeight: 1,
                    display: 'inline-block',
                    verticalAlign: 'super'
                  }}
                >ℛ</span>
              )}
            </span>
            <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 12, color: 'var(--ink)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              { p.gate }<span style={{ opacity: 0.4 }}>.</span>{ p.line }
              {p.fixation === FixingState.Exalted && <span title="Exalted" style={{ fontSize: 12, color: 'var(--hd-fixation, var(--gold))', lineHeight: 1 }}>▲</span>}
              {p.fixation === FixingState.Detriment && <span title="Detriment" style={{ fontSize: 12, color: 'var(--hd-fixation, var(--gold))', lineHeight: 1 }}>▼</span>}
              {p.fixation === FixingState.Juxtaposed && <span title="Juxtaposed" style={{ fontSize: 14, color: 'var(--hd-fixation, var(--gold))', lineHeight: 1, marginTop: -2 }}>✶</span>}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{ p.sign && <Glyph kind="sign" name={ p.sign } size={ 13 } /> }{ p.sign }</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--mute)', textAlign: 'right', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              { p.planet.length > 5 ? p.planet.substring(0,3) : p.planet }
            </span>
          </div>
        ) ) }
      </div>
    </div>
  );
}

function TransitPlacementTable( { activations, natalAsc }: { activations: any, natalAsc: number | null } ) {
  const svc = EphemerisService.getInstance();
  const planets = PLANET_ORDER
    .filter( name => activations[ name ] )
    .map( name => {
      const act = activations[ name ];
      const house = natalAsc !== null ? svc.getWholeSignHouse(act.longitude, natalAsc) : null;
      return {
        name,
        symbol: PLANET_SYMBOLS[ name ] || name[ 0 ],
        house,
        ...act
      };
    });

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--hair)', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--hair)', color: 'var(--mute)', textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <th style={{ padding: '12px 16px' }}>Planet</th>
            <th style={{ padding: '12px 16px' }}>Sign & Degree</th>
            <th style={{ padding: '12px 16px' }}>Gate</th>
            <th style={{ padding: '12px 16px' }}>House</th>
          </tr>
        </thead>
        <tbody>
          {planets.map((p, i) => {
            const inSign = p.longitude % 30;
            const deg = Math.floor(inSign);
            const min = Math.floor((inSign - deg) * 60);
            const degStr = `${deg}°${min.toString().padStart(2, '0')}'`;

            return (
              <tr key={i} style={{ borderTop: '1px solid var(--hair)' }}>
                <td style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Glyph kind="planet" name={ p.name } size={ 18 } />
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.name}</span>
                  {p.isRetrograde && <span style={{ color: 'var(--hd-active)', fontWeight: 900, fontSize: 10 }}>Rx</span>}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--mute)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{ p.sign && <Glyph kind="sign" name={ p.sign } size={ 14 } /> }{p.sign} {degStr}</span>
                </td>
                <td style={{ padding: '10px 16px', fontFamily: 'var(--mono)', color: 'var(--ink)' }}>
                  {p.gate}.{p.line}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  {p.house ? (
                    <span style={{ 
                      background: 'var(--hair)', 
                      padding: '2px 8px', 
                      borderRadius: 4, 
                      fontSize: 10, 
                      fontWeight: 700,
                      color: 'var(--indigo)'
                    }}>H{p.house}</span>
                  ) : (
                    <span style={{ color: 'var(--mute)', opacity: 0.3 }}>—</span>
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

// ------------------------------------------------------------------
// Main View
// ------------------------------------------------------------------

interface TransitViewProps {
  profileIdentity?: any;
  onChartReady?: ( data: any ) => void;
}

export default function TransitView( { onChartReady, profileIdentity }: TransitViewProps ) {
  const [ chart,   setChart   ] = useState<any>( null );
  const [ natalAsc, setNatalAsc ] = useState<number | null>( null );
  const [ loading, setLoading ] = useState( true );
  const [ error,   setError   ] = useState<string | null>( null );
  const [ activeTab, setActiveTab ] = useState<string>( 'HD' );

  // Keep the latest onChartReady in a ref so it does NOT have to be an effect
  // dependency. Passing it as a dep caused the effect to re-run on every parent
  // render (the callback is a new reference each time) — and since the effect
  // itself calls onChartReady, that re-rendered the parent and looped, leaking
  // swisseph-wasm memory until the tab crashed.
  const onChartReadyRef = useRef( onChartReady );
  onChartReadyRef.current = onChartReady;

  // Only the actual birth identity matters for recalculation, not the object
  // reference — depend on the primitive fields so a new-but-equal profile object
  // doesn't retrigger a full transit recompute.
  const identityKey = [
    profileIdentity?.birth_date,
    profileIdentity?.birth_time,
    profileIdentity?.birth_lat,
    profileIdentity?.birth_lng,
    profileIdentity?.birth_timezone,
  ].join( '|' );

  useEffect( () => {
    let cancelled = false;
    ( async () => {
      try {
        const svc = EphemerisService.getInstance();
        
        // 1. Check Cache
        const nowMs = Date.now();
        const cached = localStorage.getItem(TRANSIT_CACHE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            const age = nowMs - parsed.timestamp;
            if (age < CACHE_MINUTES * 60 * 1000) {
              // Robustly ensure Sets
              const ensureSet = (val: any) => {
                if (val instanceof Set) return val;
                if (Array.isArray(val)) return new Set(val);
                return new Set();
              };

              if (parsed.chart) {
                parsed.chart.activeGates = ensureSet(parsed.chart.activeGates);
                parsed.chart.definedCenters = ensureSet(parsed.chart.definedCenters);
              }
              setChart(parsed.chart);
              if (parsed.natalAsc !== undefined) setNatalAsc(parsed.natalAsc);
              setLoading(false);
              onChartReadyRef.current?.(parsed.chart);
              return;
            }
          } catch (e) {
            console.warn("Transit cache parse failed", e);
          }
        }

        // 2. Calculate if no cache or expired
        const now = DateTime.now().toUTC(); // Use UTC for transit consistency (matches TransitBirthView)
        
        // Transits use "birth" data as the current moment at Null Island
        const data = await svc.getChartData( {
          date:      now.toFormat('yyyy-MM-dd'),
          time:      now.toFormat('HH:mm'),
          latitude:  '0',
          longitude: '0',
          timezone:  'UTC',
        } );

        if ( cancelled ) return;

        // Recalculate properties using ONLY transits (personality activations) 
        // to ensure centers/channels are in sync and avoid phantom centers.
        const transitData = HumanDesignLogic.determineChartProperties(data.birthActivations, {});
        ( transitData as any ).isTransit = true;
        
        let ascVal: number | null = null;

        // If we have profile identity, get natal ascendant for house alignment
        if (profileIdentity?.birth_date) {
          try {
            const natal = await svc.getChartData({
              date: profileIdentity.birth_date,
              time: profileIdentity.birth_time || '12:00',
              latitude: profileIdentity.birth_lat || '0',
              longitude: profileIdentity.birth_lng || '0',
              timezone: profileIdentity.birth_timezone || 'UTC'
            });
            if (natal.birthActivations?.Ascendant) {
              ascVal = natal.birthActivations.Ascendant.longitude;
            }
          } catch (err) {
            console.error("Failed to load natal ascendant for transit alignment:", err);
          }
        }

        // 3. Update state and cache
        setChart( transitData );
        setNatalAsc( ascVal );
        
        localStorage.setItem(TRANSIT_CACHE_KEY, JSON.stringify({
          timestamp: nowMs,
          chart: {
            ...transitData,
            activeGates: Array.from(transitData.activeGates),
            definedCenters: Array.from(transitData.definedCenters)
          },
          natalAsc: ascVal
        }));

        setLoading( false );
        onChartReadyRef.current?.( transitData );
      } catch ( e: any ) {
        if ( cancelled ) return;
        setError( e?.message || 'Transit calculation failed.' );
        setLoading( false );
      }
    } )();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ identityKey ] );

  const acts = chart?.birthActivations || {};

  const insights = useMemo<AstroInsights | null>(() => {
    if (!chart) return null;
    const planets: AstroPlanetLike[] = Object.entries(acts).map(([name, data]: [string, any]) => ({
      name,
      longitude: data.longitude,
      sign: data.sign,
      // Use natal house calculation if we have natal asc
      house: natalAsc !== null ? EphemerisService.getInstance().getWholeSignHouse(data.longitude, natalAsc) : undefined
    }));
    return analyzeAstroInsights(planets);
  }, [chart, acts, natalAsc]);

  if ( loading ) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--mute)' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Calculating Today's Transits…</div>
    </div>
  );

  if ( error ) return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#b91c1c' }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{ error }</div>
    </div>
  );

  const primary = 'var(--gold, #d4af37)';

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 30, 
      maxWidth: 900, 
      margin: '0 auto',
      padding: '20px 0',
      height: '100%',
      overflowY: 'auto',
      scrollbarWidth: 'thin'
    }}>
      { /* Header */ }
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>Dynamic Alignment</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '2.5rem', color: 'var(--ink)', marginBottom: '0.5rem' }}>
          { profileIdentity?.full_name || profileIdentity?.display_name || profileIdentity?.nickname || 'Today' }{ (profileIdentity?.full_name || profileIdentity?.display_name || profileIdentity?.nickname) ? "'s" : "" } Transits
        </h1>
        <p style={{ fontSize: 12, color: 'var(--mute)', fontStyle: 'italic' }}>
          Current planetary activations for { new Date().toLocaleDateString( undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } ) }.
        </p>
      </div>

      { /* Tabs */ }
      <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', borderBottom: '1px solid var(--hair)', paddingBottom: '12px' }}>
        {['HD', 'Astro'].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px', fontStyle: 'italic',
              color: activeTab === t ? 'var(--ink)' : 'var(--mute)',
              background: 'none', border: 'none',
              borderBottom: activeTab === t ? `2px solid ${primary}` : '2px solid transparent',
              paddingBottom: '4px', cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {t === 'HD' ? 'Bodygraph Transits' : 'Astrology Wheel'}
          </button>
        ))}
      </div>

      { activeTab === 'HD' ? (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'minmax(300px, 1fr) 350px', 
          gap: 40,
          alignItems: 'start'
        }}>
          { /* Left: List */ }
          <TransitGateList data={ chart } />

          { /* Right: Bodygraph (Sized Down) */ }
          <div style={{ 
            background: 'var(--card)', 
            border: '1px solid var(--hair)', 
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ width: '100%', transform: 'scale(0.85)', transformOrigin: 'top center' }}>
              <Bodygraph data={ chart } />
            </div>
            <div style={{ marginTop: -40, textAlign: 'center' }}>
               <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--mute)' }}>Transit Alignment</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
               <AstroWheel 
                  activations={natalAsc !== null ? { ...acts, Ascendant: { longitude: natalAsc } } : acts} 
                  size={420} 
                  showCrossPoints={false}
               />
            </div>
            <TransitPlacementTable activations={acts} natalAsc={natalAsc} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            { /* Stelliums */ }
            <div style={{ background: 'var(--card)', padding: 24, borderRadius: 12, border: '1px solid var(--hair)' }}>
               <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: primary, fontSize: 20, marginBottom: 16 }}>✦ Transit Stelliums</h3>
               {insights?.stelliums.length ? (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                   {insights.stelliums.map((s, i) => (
                     <div key={i} style={{ color: 'var(--ink)', fontSize: 14 }}>
                       <strong>{s.sign}:</strong> {s.planets.map(p => p.name).join(', ')}
                     </div>
                   ))}
                 </div>
               ) : (
                 <p style={{ color: 'var(--mute)', fontSize: 13, fontStyle: 'italic' }}>No significant transit stelliums detected.</p>
               )}
            </div>

            { /* Tight Aspects */ }
            <div style={{ background: 'var(--card)', padding: 24, borderRadius: 12, border: '1px solid var(--hair)' }}>
               <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: primary, fontSize: 20, marginBottom: 16 }}>✦ Tight Aspects (0°–2°)</h3>
               {insights?.tightAspects.length ? (
                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                   {insights.tightAspects.map((a, i) => (
                     <div key={i} style={{ padding: '6px 10px', background: 'rgba(212,175,55,0.05)', border: `1px solid ${primary}33`, borderRadius: 6, fontSize: 12, color: 'var(--ink)' }}>
                        {a.p1.name} <span style={{ color: a.aspect.color }}>{a.aspect.symbol}</span> {a.p2.name}
                     </div>
                   ))}
                 </div>
               ) : (
                 <p style={{ color: 'var(--mute)', fontSize: 13, fontStyle: 'italic' }}>No tight aspects occurring currently.</p>
               )}
            </div>
          </div>
        </div>
      )}
      <ChartAttributionFooter />
    </div>
  );
}
