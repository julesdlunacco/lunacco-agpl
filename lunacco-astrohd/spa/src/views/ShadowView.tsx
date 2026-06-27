import { useEffect, useMemo, useRef, useState } from 'react';
import { EphemerisService } from '../services/EphemerisService';
import { Bodygraph } from '../components/Bodygraph';
import ChartAttributionFooter from '../components/ChartAttributionFooter';
import { analyzeShadowChart, SHADOW_TYPE_LABELS, ShadowConditioningType } from '../services/ShadowChartLogic';

const REST_ROOT = ( () => {
  const d = ( window as any ).LunaCcoData || {};
  return ( d.root || '/wp-json/' ).replace( /\/$/, '' ) + '/';
} )();
const NONCE = ( () => ( ( window as any ).LunaCcoData || {} ).nonce || '' )();

async function fetchJSON( path: string, init: RequestInit = {} ) {
  const res = await fetch( REST_ROOT + path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce':   NONCE,
      ...( init.headers || {} ),
    },
  } );
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse( text ) : null; } catch { body = text; }
  if ( ! res.ok ) throw new Error( ( body && body.message ) || `${ res.status } ${ res.statusText }` );
  return body;
}

type Props = {
  initialDate?: string;
  initialTime?: string;
  initialLat?: string;
  initialLng?: string;
  initialTimezone?: string;
  triggerCalc?: number;
  onChartReady?: ( data: any ) => void;
  isMyself?: boolean;
  profileIdentity?: any;
};

const SHADOW_THEME = {
  shadowUndefinedCenterColor: 'var(--hd-shadow-center, rgba(69, 112, 175, 0.24))',
  shadowDefinedCenterColor: 'var(--hd-shadow-defined-center, rgba(120, 120, 130, 0.14))',
  shadowConditioningColor: 'var(--hd-shadow-conditioning, #2f9f6b)',
  shadowMentalColor: 'var(--hd-shadow-mental, #c23b4a)',
  shadowTranspersonalColor: 'var(--hd-shadow-transpersonal, #3f7fc0)',
  shadowHarmonicColor: 'var(--hd-shadow-harmonic, #8c5fbf)',
  activeGateCircleColor: 'var(--paper, #ffffff)',
};

const TYPE_COPY: Record<ShadowConditioningType, string> = {
  'conditioning-receptor': 'Defined gates held inside an undefined center.',
  'mental-conditioner': 'Undefined gates in undefined centers, reaching toward a defined opposite gate.',
  'transpersonal-conditioner': 'Undefined gates in undefined centers where the whole channel is open.',
  'harmonic-influencer': 'The harmonic gate opposite a mental conditioner when it is not itself a receptor.',
};

export default function ShadowView( {
  initialDate = '',
  initialTime = '',
  initialLat = '',
  initialLng = '',
  initialTimezone = '',
  triggerCalc = 0,
  onChartReady,
  isMyself,
  profileIdentity,
}: Props ) {
  const [ busy, setBusy ] = useState( false );
  const [ error, setError ] = useState<string | null>( null );
  const [ chartData, setChartData ] = useState<any>( null );
  const [ selectedGate, setSelectedGate ] = useState<number | undefined>();
  const prevTrigger = useRef( triggerCalc );

  // Hook pulled once during render — never inside calculate() (avoids React error #321).
  const { saveChartCache } = ( window as any ).LunaCcoHooks?.useUser?.() || {};

  const form = {
    date: initialDate,
    time: initialTime || '12:00',
    latitude: initialLat,
    longitude: initialLng,
    timezone: initialTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };

  const analysis = useMemo( () => chartData ? analyzeShadowChart( chartData ) : null, [ chartData ] );

  async function calculate() {
    if ( ! form.date || ! form.latitude || ! form.longitude ) {
      setError( 'Birth date and location are required. Please fill in the profile or select a person.' );
      return;
    }
    setError( null );
    setChartData( null );
    setBusy( true );
    try {
      // 1. Check persistent chart cache for natal whole_house
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

      // 2. Otherwise calculate
      const personId = profileIdentity?.id !== undefined ? profileIdentity.id : null;
      const tokenRes = await fetchJSON( 'luna-astrohd/v1/calc-token', {
        method: 'POST',
        body: JSON.stringify( { chart_type: 'shadow', person_id: personId } ),
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

  useEffect( () => {
    if ( triggerCalc !== prevTrigger.current ) {
      prevTrigger.current = triggerCalc;
      calculate();
    }
  } );

  useEffect( () => {
    if ( initialDate && initialLat && initialLng ) calculate();
  }, [] );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      { busy && <div style={{ padding: '10px 24px', background: 'var(--indigo)', color: 'var(--btn-fg, white)', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', flexShrink: 0 }}>Calculating shadow chart...</div> }
      { error && <div style={{ padding: '10px 24px', background: '#fef2f2', color: '#b91c1c', fontSize: 12, flexShrink: 0 }}>{ error }</div> }

      { !chartData && !busy && !error && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.35, gap: 12, padding: 40 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink)', textAlign: 'center' }}>Select a person and press Calculate<br />to reveal the shadow chart.</p>
        </div>
      ) }

      { chartData && analysis && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }}>
          <div style={{ marginBottom: 24, borderBottom: '1px solid var(--ink)', paddingBottom: 18 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>Natal · Shadow Chart</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 32, color: 'var(--ink)', lineHeight: 1.1, margin: 0 }}>
              { profileIdentity?.full_name || profileIdentity?.display_name || profileIdentity?.nickname || 'Your' }{ ( profileIdentity?.full_name || profileIdentity?.display_name || profileIdentity?.nickname ) ? "'s" : '' } <em style={{ color: 'var(--gold)' }}>Open Centers</em>
            </h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 520px) minmax(280px, 1fr)', gap: 24, alignItems: 'start' }}>
            <div style={{ border: '1px solid var(--hair)', background: 'var(--card)', padding: '10px 10px 4px' }}>
              <Bodygraph
                data={ chartData }
                hideVariables={ true }
                shadowMode={ true }
                shadowAnalysis={ analysis }
                theme={ SHADOW_THEME }
                highlightedGate={ selectedGate }
                onElementClick={ ( type, id ) => type === 'gate' && setSelectedGate( Number( id ) ) }
              />
              <ShadowKey />
            </div>

            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: 'var(--ink)', margin: '0 0 14px' }}>Conditioning by Center</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                { analysis.centers.map( ( center ) => (
                  <section key={ center.center } style={{ border: '1px solid var(--hair)', background: 'var(--card)', padding: 16 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10 }}>{ center.center }</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      { center.gates.map( ( item ) => (
                        <button
                          key={ `${ item.gate }-${ item.type }` }
                          onClick={ () => setSelectedGate( item.gate ) }
                          style={{ border: `1px solid ${ colorForType( item.type ) }`, background: selectedGate === item.gate ? colorForType( item.type ) : 'transparent', color: selectedGate === item.gate ? 'white' : 'var(--ink)', padding: '6px 9px', borderRadius: 0, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          title={ SHADOW_TYPE_LABELS[ item.type ] }
                        >
                          Gate { item.gate }
                        </button>
                      ) ) }
                    </div>
                  </section>
                ) ) }
              </div>
            </div>
          </div>
          <ChartAttributionFooter />
        </div>
      ) }
    </div>
  );
}

function ShadowKey() {
  const items = Object.entries( SHADOW_TYPE_LABELS ) as Array<[ ShadowConditioningType, string ]>;
  return (
    <div style={{ padding: '12px 10px 10px', borderTop: '1px solid var(--hair)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      { items.map( ( [ type, label ] ) => (
        <div key={ type } style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ width: 9, height: 9, marginTop: 2, background: colorForType( type ), flexShrink: 0 }} />
          <span>
            <strong style={{ display: 'block', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink)' }}>{ label }</strong>
            <span style={{ display: 'block', fontSize: 10, lineHeight: 1.35, color: 'var(--mute)' }}>{ TYPE_COPY[ type ] }</span>
          </span>
        </div>
      ) ) }
    </div>
  );
}

function colorForType( type: ShadowConditioningType ): string {
  return {
    'conditioning-receptor': 'var(--hd-shadow-conditioning, #2f9f6b)',
    'mental-conditioner': 'var(--hd-shadow-mental, #c23b4a)',
    'transpersonal-conditioner': 'var(--hd-shadow-transpersonal, #3f7fc0)',
    'harmonic-influencer': 'var(--hd-shadow-harmonic, #8c5fbf)',
  }[ type ];
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
  };
}
