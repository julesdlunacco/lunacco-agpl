/**
 * TransitBirthView — natal bodygraph vs current transit composite.
 * Uses ConnectionLogic.classifyChannels for channel analysis and
 * HumanDesignLogic.determineChartProperties for the transit-only chart.
 * Layout: birth info | design panel | composite bodygraph | personality panel | transit info
 */

import { useState, useEffect, useRef } from 'react';
import { EphemerisService } from '../services/EphemerisService';
import { HumanDesignLogic, ChartData, Activation } from '../services/HumanDesignLogic';
import { ConnectionLogic, ConnectionAnalysis } from '../services/ConnectionLogic';
import { Bodygraph } from '../components/Bodygraph';
import ChartAttributionFooter from '../components/ChartAttributionFooter';
import { ConnectionPlanetPanel } from '../components/ConnectionPlanetPanel';

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

const CHANNEL_TYPES = [
  { key: 'electromagnetic' as const, label: 'Electromagnetic', color: '#8b5cf6' },
  { key: 'compromise'      as const, label: 'Compromise',      color: '#f59e0b' },
  { key: 'companion'       as const, label: 'Companion',       color: '#3b82f6' },
  { key: 'dominance'       as const, label: 'Dominance',       color: '#10b981' },
];

// ─── Channel section (Editorial Style) ────────────────────────────────────────

function ChannelSection( { analysis }: { analysis: ConnectionAnalysis } ) {
  const themeCode = analysis.compositeCenters.code;
  
  return (
    <div style={{ marginTop: 24, padding: '24px 32px', background: 'var(--card)', border: '1px solid var(--hair)', borderBottom: '4px solid var(--gold)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid var(--hair)', paddingBottom: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: 'var(--ink)', margin: 0 }}>
            Transit Alignment
          </h2>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--gold)', marginTop: 4 }}>
            Channel Classification
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 11, color: 'var(--mute)', fontStyle: 'italic' }}>
            Theme <strong style={{ color: 'var(--indigo)', fontStyle: 'normal' }}>{themeCode}</strong>
            {' '}·{' '}{analysis.compositeCenters.definedCenters.size} defined centers
          </span>
          {analysis.compositeCenters.definedByComposite.size > 0 && (
            <div style={{ fontSize: 9, color: 'var(--indigo)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>
              {[...analysis.compositeCenters.definedByComposite].join(', ')} Activated by transit
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
        {CHANNEL_TYPES.map(({ key, label, color }) => (
          <div key={key}>
            <div style={{ borderBottom: `2px solid ${color}`, paddingBottom: 6, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color }}>{label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--mute)' }}>{analysis[key].length}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {analysis[key].map(ch => (
                <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: color, opacity: 0.5 }} />
                  <div style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 500, fontFamily: 'monospace' }}>
                    {ch.id}
                  </div>
                </div>
              ))}
              {analysis[key].length === 0 && (
                <div style={{ fontSize: 10, color: 'var(--mute)', fontStyle: 'italic', opacity: 0.4 }}>No shared themes</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── View ─────────────────────────────────────────────────────────────────────

type Props = {
  initialDate?:     string;
  initialTime?:     string;
  initialLat?:      string;
  initialLng?:      string;
  initialTimezone?: string;
  triggerCalc?:     number;
  onChartReady?:    ( data: any ) => void;
  people?:          any[];
  profileIdentity?: any;
};

export default function TransitBirthView( {
  initialDate = '', initialTime = '', initialLat = '', initialLng = '',
  initialTimezone = '', triggerCalc = 0, onChartReady,
  profileIdentity, gateChartType = 'transit_birth', gatePresetKey = null,
}: Props ) {
  const [ busy,               setBusy               ] = useState( false );
  const [ error,              setError              ] = useState<string | null>( null );
  const [ birthChart,         setBirthChart         ] = useState<ChartData | null>( null );
  const [ transitChart,       setTransitChart       ] = useState<ChartData | null>( null );
  const [ compositeData,      setCompositeData      ] = useState<ChartData | null>( null );
  const [ connectionAnalysis, setConnectionAnalysis ] = useState<ConnectionAnalysis | null>( null );
  const [ transitDateStr,     setTransitDateStr     ] = useState( '' );
  const prevTrigger = useRef( triggerCalc );

  // Hook pulled once during render — never inside calculate() (avoids React error #321).
  const { saveChartCache } = ( window as any ).LunaCcoHooks?.useUser?.() || {};

  const form = {
    date:      initialDate,
    time:      initialTime || '12:00',
    latitude:  initialLat,
    longitude: initialLng,
    timezone:  initialTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };

  async function calculate() {
    if ( !form.date || !form.latitude || !form.longitude ) {
      setError( 'Birth date and location are required.' );
      return;
    }
    setError( null );
    setBirthChart( null );
    setTransitChart( null );
    setCompositeData( null );
    setConnectionAnalysis( null );
    setBusy( true );

    try {
      const svc = EphemerisService.getInstance();

      // 1. Calculate or load natal birth chart
      let birthData: ChartData;
      const cache = profileIdentity?.chart_cache || {};
      const cacheKey = 'natal_whole_house';
      if ( cache[cacheKey] ) {
        const cached = cache[cacheKey];
        const cachedDate = cached.input?.date?.substring( 0, 16 );
        const formDate = form.date?.substring( 0, 16 );
        if ( cachedDate === formDate ) {
          birthData = deserializeChart( cached.data );
        } else {
          const personId = profileIdentity?.id !== undefined ? profileIdentity.id : null;
          const tokenRes = await fetchJSON( 'luna-astrohd/v1/calc-token', {
            method: 'POST',
            body: JSON.stringify( { chart_type: gateChartType || 'transit_birth', preset_key: gatePresetKey || undefined, person_id: personId } )
          } );
          birthData = await svc.getChartData( form );
          if ( typeof saveChartCache === 'function' ) {
            await saveChartCache( personId, cacheKey, {
              input: { ...form, houseSystem: 'whole_house' },
              data: serializeChart( birthData ),
              token: tokenRes?.token,
            } );
          }
        }
      } else {
        const personId = profileIdentity?.id !== undefined ? profileIdentity.id : null;
        const tokenRes = await fetchJSON( 'luna-astrohd/v1/calc-token', {
          method: 'POST',
          body: JSON.stringify( { chart_type: gateChartType || 'transit_birth', preset_key: gatePresetKey || undefined, person_id: personId } )
        } );
        birthData = await svc.getChartData( form );
        if ( typeof saveChartCache === 'function' ) {
          await saveChartCache( personId, cacheKey, {
            input: { ...form, houseSystem: 'whole_house' },
            data: serializeChart( birthData ),
            token: tokenRes?.token,
          } );
        }
      }

      // 2. Calculate or load transit raw chart
      let transitRaw: ChartData;
      const nowMs = Date.now();
      const cachedTransitStr = localStorage.getItem('lunacco_transit_raw_cache_v2');
      let cachedTransit: any = null;
      if (cachedTransitStr) {
        try {
          const parsed = JSON.parse(cachedTransitStr);
          const age = nowMs - parsed.timestamp;
          if (age < 60 * 60 * 1000) { // 1 hour TTL
            cachedTransit = parsed.data;
          }
        } catch (e) {
          console.warn("Transit raw cache parse failed", e);
        }
      }

      const now = new Date();
      const transitDate = `${ now.getUTCFullYear() }-${ String( now.getUTCMonth() + 1 ).padStart( 2, '0' ) }-${ String( now.getUTCDate() ).padStart( 2, '0' ) }`;
      const transitTime = `${ String( now.getUTCHours() ).padStart( 2, '0' ) }:${ String( now.getUTCMinutes() ).padStart( 2, '0' ) }`;

      if (cachedTransit) {
        transitRaw = deserializeChart(cachedTransit);
      } else {
        const personId = profileIdentity?.id !== undefined ? profileIdentity.id : null;
        await fetchJSON( 'luna-astrohd/v1/calc-token', {
          method: 'POST',
          body: JSON.stringify( { chart_type: gateChartType || 'transit_birth', preset_key: gatePresetKey || undefined, person_id: personId } )
        } );
        transitRaw = await svc.getChartData( {
          date: transitDate, time: transitTime,
          latitude: '0', longitude: '0', timezone: 'UTC',
        } );
        localStorage.setItem('lunacco_transit_raw_cache_v2', JSON.stringify({
          timestamp: nowMs,
          data: serializeChart(transitRaw),
        }));
      }

      setTransitDateStr( `${ transitDate } ${ transitTime } UTC` );

      // Build personality-only transit using Sun+NorthNode as design clone
      const designClone: Record<string, Activation> = {};
      [ 'Sun', 'NorthNode' ].forEach( name => {
        const act = transitRaw.birthActivations[ name ];
        if ( act ) designClone[ name ] = { ...act };
      } );

      const transitOnly = HumanDesignLogic.determineChartProperties(
        transitRaw.birthActivations,
        designClone,
      );

      const taggedTransit: ChartData = {
        ...transitOnly,
        birthActivations:  transitRaw.birthActivations,
        designActivations: {},
        isTransit: true,
      } as any;

      // Run connection analysis
      const analysis = ConnectionLogic.classifyChannels( birthData, taggedTransit );

      // Build composite chart
      const compBirth: Record<string, Activation> = {};
      Object.entries( birthData.birthActivations ).forEach( ( [ k, v ] ) => { compBirth[ `Birth_${ k }` ] = v; } );
      Object.entries( taggedTransit.birthActivations ).forEach( ( [ k, v ] ) => { compBirth[ `Transit_${ k }` ] = v; } );

      const compDesign: Record<string, Activation> = {};
      Object.entries( birthData.designActivations ).forEach( ( [ k, v ] ) => { compDesign[ `Birth_${ k }` ] = v; } );

      const composite: ChartData = {
        birthActivations:  compBirth,
        designActivations: compDesign,
        activeGates:    analysis.compositeGates,
        activeChannels: analysis.compositeChannels,
        definedCenters: analysis.compositeCenters.definedCenters,
        type:           birthData.type,
        authority:      birthData.authority,
        profile:        birthData.profile,
        variables:      birthData.variables,
        definition:     `Transit Composite (${ analysis.compositeCenters.code })`,
        incarnationCross: '',
        modality: '',
      };

      setBirthChart( birthData );
      setTransitChart( taggedTransit );
      setCompositeData( composite );
      setConnectionAnalysis( analysis );
      onChartReady?.( birthData );
    } catch ( e: any ) {
      setError( e?.message || 'Calculation failed.' );
    } finally {
      setBusy( false );
    }
  }

  useEffect( () => { if ( triggerCalc !== prevTrigger.current ) { prevTrigger.current = triggerCalc; calculate(); } } );
  useEffect( () => { if ( initialDate && initialLat && initialLng ) calculate(); }, [] ); // eslint-disable-line

  const personalityColor = 'var(--hd-personality, var(--ink, #1b1830))';
  const designColor      = 'var(--hd-design, #a12f2f)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      { busy && (
        <div style={{ padding: '10px 24px', background: 'var(--indigo)', color: 'var(--btn-fg, white)', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', flexShrink: 0 }}>
          Calculating…
        </div>
      ) }
      { error && (
        <div style={{ padding: '10px 24px', background: '#fef2f2', color: '#b91c1c', fontSize: 12, flexShrink: 0 }}>{ error }</div>
      ) }

      { !birthChart && !busy && !error && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.35, padding: 40 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink)', textAlign: 'center' }}>
            Select a person and press Calculate<br />to see how today's transits activate your chart.
          </p>
        </div>
      ) }

      { birthChart && compositeData && connectionAnalysis && transitChart && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }}>
          { /* Header */ }
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>
                Transit + Birth Composite
              </p>
              <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: 'var(--ink)', lineHeight: 1.1, margin: 0 }}>
                { profileIdentity?.full_name || profileIdentity?.display_name || profileIdentity?.nickname || 'Your' }{ (profileIdentity?.full_name || profileIdentity?.display_name || profileIdentity?.nickname) ? "'s" : "" } Transit Alignment
              </h1>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mute)', opacity: 0.6 }}>Current Transit</div>
              <div style={{ fontSize: 12, color: 'var(--ink)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>{ transitDateStr }</div>
            </div>
          </div>

          { /* 5-column layout */ }
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'minmax(220px, 1fr) 130px 1.2fr 130px minmax(220px, 1fr)', 
            gap: 16, 
            alignItems: 'start',
            width: '100%'
          }}>

            { /* Birth info */ }
            <div>
              <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 4, opacity: 0.6 }}>
                Natal Birth
              </p>
              <div style={{ fontSize: 9, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 6, opacity: 0.8 }}>
                <div>{ birthChart.type }</div>
                <div>{ birthChart.profile } · { birthChart.authority }</div>
              </div>
              <div style={{ 
                border: '1px solid var(--hair)', background: 'var(--card)', padding: 0, 
                width: '100%', height: 320, overflow: 'hidden', position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{ transform: 'scale(0.5)', width: 400, height: 600, flexShrink: 0 }}>
                  <Bodygraph data={ birthChart } hideVariables={ true } />
                </div>
              </div>
            </div>

            { /* Design panel */ }
            <ConnectionPlanetPanel
              activationsA={ birthChart.designActivations }
              activationsB={ {} as Record<string, Activation> }
              side="design"
              colorA={ designColor }
              colorB={ designColor }
            />

            { /* Composite bodygraph */ }
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6, textAlign: 'center' }}>
                Composite
              </p>
              <div style={{ maxWidth: 320, margin: '0 auto', border: '1px solid var(--hair)', background: 'var(--paper-2)', padding: 12 }}>
                <Bodygraph data={ compositeData } connectionAnalysis={ connectionAnalysis } hideVariables={ true } />
              </div>
            </div>

            { /* Personality panel */ }
            <ConnectionPlanetPanel
              activationsA={ birthChart.birthActivations }
              activationsB={ transitChart.birthActivations }
              side="personality"
              colorA={ personalityColor }
              colorB="#a12f2f"
            />

            { /* Transit info */ }
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 4, opacity: 0.6 }}>
                Today's Transits
              </p>
              <div style={{ fontSize: 9, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 6, opacity: 0.8 }}>
                <div>Current Moment</div>
                <div>Global Alignments</div>
              </div>
              <div style={{ 
                border: '1px solid var(--hair)', background: 'var(--card)', padding: 0, 
                width: '100%', height: 320, overflow: 'hidden', position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{ transform: 'scale(0.5)', width: 400, height: 600, flexShrink: 0 }}>
                  <Bodygraph data={ transitChart } hideVariables={ true } />
                </div>
              </div>
            </div>
          </div>

          { /* Channel analysis (Editorial Style) */ }
          <ChannelSection analysis={ connectionAnalysis } />

          <ChartAttributionFooter />
        </div>
      ) }
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

