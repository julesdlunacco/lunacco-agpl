/**
 * Daily Snapshot — scans a date range for astrological events.
 * Modes roughly map to AstrologyWidgetsService.getCalendarEvents flags.
 */

import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { AstrologyWidgetsService } from '../services/AstrologyWidgetsService';

type Mode = 'quick' | 'standard' | 'deep' | 'moon';

const MODES: Record<Mode, { label: string; options: any }> = {
  quick:    { label: 'Quick',    options: { includeVoc: false, includeTightAspects: false, includeCriticalDegrees: false, includeConcentration: false } },
  standard: { label: 'Standard', options: { includeVoc: true,  includeTightAspects: true,  includeCriticalDegrees: false, includeConcentration: false, tightAspectOrb: 2 } },
  deep:     { label: 'Deep',     options: { includeVoc: true,  includeTightAspects: true,  includeCriticalDegrees: true,  includeConcentration: true,  tightAspectOrb: 3 } },
  moon:     { label: 'Moon',     options: { includeVoc: true,  includeTightAspects: false, includeCriticalDegrees: false, includeConcentration: false } },
};

export default function SnapshotView() {
  const [ mode,    setMode    ] = useState<Mode>( 'standard' );
  const [ days,    setDays    ] = useState<number>( 14 );
  const [ events,  setEvents  ] = useState<any[]>( [] );
  const [ loading, setLoading ] = useState( false );
  const [ error,   setError   ] = useState<string | null>( null );

  async function run() {
    setLoading( true );
    setError( null );
    try {
      const svc   = new AstrologyWidgetsService();
      const start = DateTime.now();
      const end   = start.plus( { days } );
      const list  = await svc.getCalendarEvents( start, end, undefined, undefined, MODES[ mode ].options );
      setEvents( ( list as any[] ).filter( e => mode !== 'moon' || String( e.type || '' ).includes( 'moon' ) ) );
    } catch ( e: any ) {
      setError( e?.message || 'Failed.' );
    } finally {
      setLoading( false );
    }
  }

  useEffect( () => { run(); /* initial */ }, [] ); // eslint-disable-line

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--ink)' }}>Daily Snapshot</h1>
      <p style={{ color: 'var(--mute)', marginBottom: '1.5rem' }}>Upcoming astrological events over the next { days } days.</p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        { ( Object.entries( MODES ) as [ Mode, { label: string } ][] ).map( ( [ k, v ] ) => (
          <button
            key={ k }
            onClick={ () => setMode( k ) }
            style={{
              padding: '0.4rem 0.9rem', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em',
              border: '1px solid var(--hair)', cursor: 'pointer',
              background: mode === k ? 'var(--ink)' : 'var(--card)',
              color:      mode === k ? 'var(--paper)' : 'var(--ink)',
            }}>
            { v.label }
          </button>
        ) ) }
        <input
          type="number" min={ 1 } max={ 90 }
          value={ days } onChange={ ( e ) => setDays( Math.max( 1, Math.min( 90, Number( e.target.value ) || 14 ) ) ) }
          style={{ width: 80, padding: '0.4rem', border: '1px solid var(--hair)', background: 'var(--card)', color: 'var(--ink)' }}
        />
        <button onClick={ run } disabled={ loading } style={{ padding: '0.4rem 0.9rem', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', border: 'none', background: 'var(--indigo)', color: 'var(--btn-fg, white)', cursor: 'pointer' }}>
          { loading ? 'Scanning…' : 'Refresh' }
        </button>
      </div>

      { error && <p style={{ color: '#b91c1c' }}>{ error }</p> }

      <div style={{ border: '1px solid var(--hair)', background: 'var(--card)' }}>
        { events.length === 0 && ! loading && <p style={{ padding: '1rem', color: 'var(--mute)' }}>No events in range.</p> }
        { events.map( ( e, i ) => (
          <div key={ i } style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--hair)', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ color: 'var(--ink)', fontSize: 14 }}>{ e.title || e.description || e.type }</div>
            <div style={{ color: 'var(--mute)', fontSize: 12, whiteSpace: 'nowrap' }}>
              { e.dateTime?.toFormat ? e.dateTime.toFormat( 'LLL d, HH:mm' ) : ( e.date || '' ) }
            </div>
          </div>
        ) ) }
      </div>
    </div>
  );
}
