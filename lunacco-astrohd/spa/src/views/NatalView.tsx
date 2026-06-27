import { useState, useEffect, useRef, useMemo } from 'react';
import { EphemerisService } from '../services/EphemerisService';
import { Bodygraph } from '../components/Bodygraph';
import ChartAttributionFooter from '../components/ChartAttributionFooter';
import { ChartConfig, DEFAULT_SECTION_TOGGLES, SectionToggles, ProfileLineTabs, GateDetailToggles } from '../services/chartConfig';
import { formatGateCode } from '../services/degreeFormat';
import { Glyph } from '../components/Glyph';
import { HouseSystemToggle } from '../components/HouseSystemToggle';
import { KitMeter } from '../components/KitBars';
import { fetchDefinitions, resolveDefinition, Definition } from '../services/DefinitionService';
import { FixingState } from '../services/fixationData';
import { getAngelOverlay, formatAngelDegree } from '../services/AngelOverlayService';

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
  initialDate?:     string;
  initialTime?:     string;
  initialLat?:      string;
  initialLng?:      string;
  initialTimezone?: string;
  triggerCalc?:     number;
  onChartReady?:    ( data: any ) => void;
  /** Modular chart config; when omitted every section + layer shows (legacy). */
  config?:          ChartConfig;
  /** Preview mode (Chart Maker): skip persisting the computed chart. */
  previewMode?:     boolean;
  /** Embedded inside a scrolling parent (e.g. Chart Maker preset) — disables this
   *  view's own inner scroll so there's a single scrollbar, not two. */
  embedded?:        boolean;
  /** Bare settings key to charge against (resolved by the CenterPane). */
  gateChartType?:   string;
};

export default function NatalView( {
  initialDate     = '',
  initialTime     = '',
  initialLat      = '',
  initialLng      = '',
  initialTimezone = '',
  triggerCalc     = 0,
  onChartReady,
  config,
  previewMode = false,
  gateChartType = 'natal',
  gatePresetKey = null,
  isMyself,
  profileIdentity,
  embedded = false,
}: Props & { isMyself?: boolean; profileIdentity?: any } ) {
  // Section visibility (defaults to all-on so legacy callers are unchanged).
  const S: SectionToggles = { ...DEFAULT_SECTION_TOGGLES, ...( config?.sections || {} ) };
  const bodygraphLayers = config?.bodygraph;
  const [ busy,           setBusy           ] = useState( false );
  const [ error,          setError          ] = useState<string | null>( null );
  const [ chartData,      setChartData      ] = useState<any>( null );
  const [ selectedItem,   setSelectedItem   ] = useState<{ section_type: string, item_key: string, title?: string } | null>(null);
  const [ houseSystem,    setHouseSystem    ] = useState<'whole_house' | 'placidus' | 'koch'>( config?.houseSystem || 'whole_house' );
  const [ asteroidData,   setAsteroidData   ] = useState<any[]>( [] );
  const prevTrigger = useRef( triggerCalc );
  const prevHouseSystem = useRef( houseSystem );

  // Follow the configured house system (e.g. live edits in the Chart Maker).
  useEffect( () => {
    if ( config?.houseSystem && config.houseSystem !== houseSystem ) {
      setHouseSystem( config.houseSystem );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ config?.houseSystem ] );

  const form = {
    date:      initialDate,
    time:      initialTime  || '12:00',
    latitude:  initialLat,
    longitude: initialLng,
    timezone:  initialTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };

  const { refreshUser, saveChartCache } = ( window as any ).LunaCcoHooks?.useUser?.() || {};

  async function calculate() {
    if ( ! form.date || ! form.latitude || ! form.longitude ) {
      setError( 'Birth date and location are required. Please fill in the profile or select a person.' );
      return;
    }
    setError( null );
    setChartData( null );
    setBusy( true );
    try {
      const svc = EphemerisService.getInstance();
      const userContext = ( window as any ).LunaCcoData?.userContext || {};
      const formWithHouse = {
        ...form,
        houseSystem,
      };

      // 1. Check persistent chart cache
      const cache = profileIdentity?.chart_cache || {};
      const cacheKey = `natal_${houseSystem}`;
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

      // Preview mode (Chart Maker): compute only, never persist or spend tokens.
      if ( previewMode ) {
        const data = await svc.getChartData( formWithHouse );
        setChartData( data );
        onChartReady?.( data );
        setBusy( false );
        return;
      }

      // 2. Otherwise calculate
      const personId = profileIdentity?.id !== undefined ? profileIdentity.id : null;
      const tokenRes = await fetchJSON( 'luna-astrohd/v1/calc-token', {
        method: 'POST',
        body:   JSON.stringify( { chart_type: gateChartType || 'natal', preset_key: gatePresetKey || undefined, person_id: personId } ),
      } );

      const data = await svc.getChartData( formWithHouse );
      setChartData( data );
      onChartReady?.( data );

      const isLoggedIn = !! ( ( window as any ).LunaCcoData || {} ).isLoggedIn;
      if ( isLoggedIn && typeof saveChartCache === 'function' ) {
        await saveChartCache( personId, cacheKey, {
          input: formWithHouse,
          data:  serializeChart( data ),
          token: tokenRes?.token,
        } );
      }
    } catch ( e: any ) {
      setError( e?.message || 'Calculation failed.' );
    } finally {
      setBusy( false );
    }
  }

  // Auto-calculate when triggerCalc or houseSystem increments/changes
  useEffect( () => {
    if ( triggerCalc !== prevTrigger.current || houseSystem !== prevHouseSystem.current ) {
      prevTrigger.current = triggerCalc;
      prevHouseSystem.current = houseSystem;
      calculate();
    }
  } );

  // Auto-calculate on first mount if we have data
  useEffect( () => {
    if ( initialDate && initialLat && initialLng ) {
      calculate();
    }
  }, [] );

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setSelectedItem({
          section_type: e.detail.sectionType,
          item_key: e.detail.itemKey,
          title: e.detail.title
        });
      }
    };
    window.addEventListener('astrohd:select-element', handler);
    return () => window.removeEventListener('astrohd:select-element', handler);
  }, []);

  // Compute positions for the curated asteroid selection (for the HD side boxes).
  const selectedAsteroids = config?.wheels?.asteroids;
  const asteroidKey = Array.isArray( selectedAsteroids ) ? selectedAsteroids.join( ',' ) : '';
  useEffect( () => {
    let cancelled = false;
    if ( ! chartData || ! Array.isArray( selectedAsteroids ) || selectedAsteroids.length === 0 ) {
      setAsteroidData( [] );
      return;
    }
    ( async () => {
      try {
        const svc = EphemerisService.getInstance();
        const data = await svc.getAsteroidsData( { ...form, houseSystem }, selectedAsteroids );
        if ( ! cancelled ) setAsteroidData( data || [] );
      } catch {
        if ( ! cancelled ) setAsteroidData( [] );
      }
    } )();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ chartData, asteroidKey, houseSystem ] );

  // Dispatch selection event for shell panel
  const handleElementClick = (type: any, id?: string, label?: string, stream?: string) => {
    // If type is an array, it's a bundle of items
    if (Array.isArray(type)) {
        window.dispatchEvent(new CustomEvent('astrohd:select-element', { 
            detail: { items: type } 
        }));
        return;
    }

    let sectionType = '';
    let itemKey = id;

    // Handle stream-specific planet keys
    if (type === 'planet' && stream) {
        itemKey = `${stream.toLowerCase()}-${(id || '').toLowerCase().replace(/\s+/g, '-')}`;
        // Map NorthNode/SouthNode camelCase to kebab-case
        itemKey = itemKey.replace('northnode', 'north-node').replace('southnode', 'south-node');
    }

    switch (type) {
      case 'gate':   sectionType = 'hd_gates'; break;
      case 'center': sectionType = 'hd_centers'; break;
      case 'planet': sectionType = 'hd_planets'; break;
      case 'sign':   sectionType = 'astro_signs'; break;
      case 'house':  sectionType = 'astro_houses'; break;
      case 'hd_destiny_points': sectionType = 'hd_destiny_points'; break;
      case 'hd_variables': sectionType = 'hd_variables'; break;
      case 'hd_types': sectionType = 'hd_types'; break;
      case 'hd_profiles': sectionType = 'hd_profiles'; break;
      case 'hd_definition_types': sectionType = 'hd_definition_types'; break;
      case 'hd_authorities': sectionType = 'hd_authorities'; break;
      case 'hd_incarnation_crosses': sectionType = 'hd_incarnation_crosses'; break;
      case 'hd_channels': sectionType = 'hd_channels'; break;
    }

    if (sectionType) {
      window.dispatchEvent(new CustomEvent('astrohd:select-element', { 
        detail: { sectionType, itemKey, title: label } 
      }));
    }
  };

  return (
    <div style={ embedded ? { display: 'flex', flexDirection: 'column' } : { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' } }>
      { /* Loading / error banner */ }
      { busy && (
        <div style={{ padding: '10px 24px', background: 'var(--indigo)', color: 'var(--btn-fg, white)', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', flexShrink: 0 }}>
          Calculating chart…
        </div>
      ) }
      { error && (
        <div style={{ padding: '10px 24px', background: '#fef2f2', color: '#b91c1c', fontSize: 12, flexShrink: 0 }}>
          { error }
        </div>
      ) }

      { /* Empty state */ }
      { ! chartData && ! busy && ! error && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.35, gap: 12, padding: 40 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="24" cy="24" r="8"  fill="currentColor" opacity="0.3" />
          </svg>
          <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink)', textAlign: 'center' }}>
            Select a person and press Calculate<br />to generate the bodygraph.
          </p>
        </div>
      ) }

      { /* Chart content */ }
      { chartData && (
        <div style={ embedded ? { padding: '20px 24px 32px' } : { flex: 1, overflowY: 'auto', padding: '20px 24px 32px' } }>
            
            { /* Header area */ }
            <div style={{ marginBottom: 24, borderBottom: '1px solid var(--ink)', paddingBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
                  Natal · Bodygraph
                </p>
                <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 32, color: 'var(--ink)', lineHeight: 1.1, margin: 0 }}>
                  { profileIdentity?.full_name || profileIdentity?.display_name || profileIdentity?.nickname || 'Your' }{ (profileIdentity?.full_name || profileIdentity?.display_name || profileIdentity?.nickname) ? "'s" : "" } <em style={{ color: 'var(--gold)' }}>Bodygraph</em>
                </h1>
              </div>

              { /* House System Toggle — universal flat editorial component. */ }
              {( !config || config.showHouseSystemToggle ) && !previewMode && (
                <HouseSystemToggle value={ houseSystem } onChange={ setHouseSystem } />
              )}
            </div>

            { /* Summary bar — Type · Profile · Incarnation Cross */ }
            { S.summaryBar && <ChartSummaryBar data={ chartData } onSelect={handleElementClick} /> }
            { S.angles && <AngelCrossPanel data={ chartData } onSelect={handleElementClick} /> }

            { /* Main bodygraph area */ }
            <div style={{ display: 'grid', gridTemplateColumns: S.gateColumns ? '264px 1fr 264px' : '1fr', gap: 16, marginTop: 16, alignItems: 'start' }}>
              { /* Left gate column — Design */ }
              { S.gateColumns && (
                <div>
                  <GateColumn title="Design · Body" stream="design" data={ chartData } onSelect={handleElementClick} selectedGate={selectedItem?.section_type === 'hd_gates' ? parseInt(selectedItem.item_key) : undefined} allow={ config?.planets?.design } bodygraph={ config?.bodygraph } />
                  { S.asteroidColumns && <AsteroidColumn stream="design" asteroids={ asteroidData } onSelect={handleElementClick} bodygraph={ config?.bodygraph } /> }
                </div>
              ) }

              { /* Center: variables panel + bodygraph */ }
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 500, margin: '0 auto', width: '100%' }}>
                { S.variables && chartData.variables && <VariablesPanel variables={ chartData.variables } onSelect={handleElementClick} /> }
                { ( !bodygraphLayers || bodygraphLayers.show ) && (
                <div style={{ border: '1px solid var(--hair)', background: 'var(--card)', padding: '8px 8px 4px' }}>
                  <Bodygraph
                    data={ chartData }
                    layers={ bodygraphLayers }
                    hideVariables={ true }
                    onElementClick={handleElementClick}
                    highlightedGate={selectedItem?.section_type === 'hd_gates' ? parseInt(selectedItem.item_key) : undefined}
                    highlightedCenter={selectedItem?.section_type === 'hd_centers' ? selectedItem.item_key : undefined}
                  />
                  <div style={{ padding: '10px 12px', borderTop: '1px solid var(--hair)', background: 'rgba(0,0,0,0.02)' }}>
                    <p style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                      { chartData.type } · { chartData.strategy }
                    </p>
                    <p style={{ textAlign: 'center', fontSize: 9, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, opacity: 0.8 }}>
                      { chartData.profile } { chartData.modality } · { chartData.definitionType } · { chartData.incarnationCross?.name }
                    </p>
                  </div>
                </div>
                ) }
              </div>

              { /* Right gate column — Personality */ }
              { S.gateColumns && (
                <div>
                  <GateColumn title="Personality · Mind" stream="personality" data={ chartData } onSelect={handleElementClick} selectedGate={selectedItem?.section_type === 'hd_gates' ? parseInt(selectedItem.item_key) : undefined} allow={ config?.planets?.personality } bodygraph={ config?.bodygraph } />
                  { S.asteroidColumns && <AsteroidColumn stream="personality" asteroids={ asteroidData } onSelect={handleElementClick} bodygraph={ config?.bodygraph } /> }
                </div>
              ) }
            </div>

            { /* Destiny Points Map */ }
            { S.destinyPoints && <DestinyPointsMap data={ chartData } onSelect={handleElementClick} /> }

            { /* Profile Lines Tally Comparison (lines / quarters / circuitry / repeats) */ }
            { S.profileLines && <ProfileLinesTally data={ chartData } tabs={ config?.profileLineTabs } /> }

            { /* Active Channels Grid */ }
            { S.activeChannels && <ActiveChannelsGrid data={ chartData } onSelect={handleElementClick} /> }


            { /* Attribution + legal links (text dynamic from Business Settings) */ }
            <ChartAttributionFooter />
        </div>
      ) }
    </div>
  );
}

// ------------------------------------------------------------------
// Summary bar
// ------------------------------------------------------------------
function ChartSummaryBar( { data, onSelect }: { data: any, onSelect: any } ) {
  const items: Array<[ string, string, string, string? ]> = [
    [ 'Type',             data?.type             || '—', 'hd_types' ],
    [ 'Authority',        data?.authority        || '—', 'hd_authorities' ],
    [ 'Profile',          data?.profile          || '—', 'hd_profiles', data?.modality ],
    [ 'Definition',       data?.definitionType   || '—', 'hd_definition_types' ],
    [ 'Incarnation Cross', ( data?.incarnationCross?.name || '—' ), 'hd_incarnation_crosses' ],
  ];
  return (
    <div style={{ display: 'flex', border: '1px solid var(--ink)', background: 'var(--card)' }}>
      { items.map( ( [ label, val, section, sub ], i ) => (
        <div 
            key={ label } 
            onClick={() => onSelect(
              section,
              section === 'hd_profiles' ? `${val}-${sub}` : val,
              section === 'hd_profiles' ? `${label} ${val}${sub ? ' · ' + sub : ''}` : `${label} — ${val}`
            )}
            style={{ flex: 1, padding: '10px 14px', borderRight: i < items.length - 1 ? '1px solid var(--hair)' : 'none', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 3 }}>{ label }</div>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, lineHeight: 1.1, color: 'var(--ink)' }}>{ val }</div>
          { sub && <div style={{ fontSize: 10, color: 'var(--mute)', marginTop: 2, fontStyle: 'italic' }}>{ sub }</div> }
        </div>
      ) ) }
    </div>
  );
}

function AngelCrossPanel( { data, onSelect }: { data: any, onSelect: any } ) {
  const rows = [
    [ 'Conscious Sun', 'personality', 'Sun', data?.birthActivations?.Sun ],
    [ 'Conscious Earth', 'personality', 'Earth', data?.birthActivations?.Earth ],
    [ 'Unconscious Sun', 'design', 'Sun', data?.designActivations?.Sun ],
    [ 'Unconscious Earth', 'design', 'Earth', data?.designActivations?.Earth ],
  ].map( ( [ label, stream, planet, act ]: any[] ) => ( {
    label,
    stream,
    planet,
    act,
    angel: getAngelOverlay( act?.longitude ),
  } ) ).filter( row => row.act && row.angel );

  if ( ! rows.length ) return null;

  return (
    <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
      { rows.map( row => (
        <button
          key={`${row.stream}-${row.planet}`}
          onClick={() => onSelect([
            { sectionType: 'angel_shem', itemKey: `shem_${String(row.angel.index).padStart(2, '0')}`, title: row.angel.name },
            { sectionType: 'hd_gates', itemKey: String(row.act.gate), title: `Gate ${row.act.gate}` },
            { sectionType: 'astro_planets', itemKey: String(row.planet).toLowerCase(), title: row.label },
            ...(row.act.line ? [{ sectionType: 'hd_lines', itemKey: String(row.act.line), title: `Line ${row.act.line}` }] : []),
            ...(row.act.sign ? [{ sectionType: 'astro_signs', itemKey: String(row.act.sign).toLowerCase(), title: row.act.sign }] : []),
            ...(row.act.house ? [{ sectionType: 'astro_houses', itemKey: String(row.act.house), title: `House ${row.act.house}` }] : []),
          ])}
          style={{ border: '1px solid var(--hair)', background: 'var(--card)', padding: '10px 12px', textAlign: 'left', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>{ row.label }</div>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink)', lineHeight: 1.15 }}>{ row.angel.name }</div>
          <div style={{ fontSize: 10, color: 'var(--mute)', marginTop: 4 }}>
            { formatAngelDegree( row.angel ) } · Gate { row.angel.gate }.{ row.angel.line }
          </div>
        </button>
      ) ) }
    </div>
  );
}

// ------------------------------------------------------------------
// Gate column (slim, left or right)
// ------------------------------------------------------------------
const PLANET_ORDER = [ 'Sun', 'Earth', 'NorthNode', 'SouthNode', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'Black Moon Lilith', 'Vulcan', 'Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex' ];
const PLANET_SYMBOLS: Record<string, string> = {
  Sun: '☉', Earth: '⊕', NorthNode: '☊', SouthNode: '☋', Moon: '☽',
  Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄',
  Uranus: '♅', Neptune: '♆', Pluto: '♇', Chiron: '⚷', 'Black Moon Lilith': '⚸', Vulcan: 'Vu',
  Ascendant: 'AC', Descendant: 'DC', Midheaven: 'MC', 'Imum Coeli': 'IC', Vertex: 'VX'
};

const PLANET_ICON_MAP: Record<string, string> = {
  Sun:'Sun', Earth:'Earth', Moon:'Moon', Mercury:'Mercury', Venus:'Venus', Mars:'Mars',
  Jupiter:'Jupiter', Saturn:'Saturn', Uranus:'Uranus', Neptune:'Neptune',
  Pluto:'Pluto', Chiron:'Chiron', NorthNode:'NorthNode', SouthNode:'SouthNode',
  'Black Moon Lilith':'BlackMoonLilith', Vulcan: 'Vulcan',
  'Ascendant':'Ascendant', 'Descendant':'Descendant', 'Midheaven':'Midheaven', 'Imum Coeli': 'Imuncoeli', 'Vertex':'Vertex',
};

function getIconBase(): string {
  const modules = ( window as any ).LunaCcoData?.modules || {};
  const astro = modules['luna-astrohd'] || {};
  return astro.assets?.zodiacPath || ( ( window as any ).ahdSettings?.pluginUrl ? ( window as any ).ahdSettings.pluginUrl + 'assets/zodiac/' : '' );
}

function GateColumn( { title, stream, data, onSelect, selectedGate, allow, bodygraph }: { title: string; stream: 'design' | 'personality'; data: any, onSelect: any, selectedGate?: number, allow?: string[], bodygraph?: ChartConfig['bodygraph'] } ) {
  const detail: GateDetailToggles | undefined = bodygraph?.gateDetail;
  const signGlyphs = !!bodygraph?.signGlyphs;
  const toneArrow = !!bodygraph?.gateToneArrow;
  const showToneArrow = toneArrow && !!detail?.tone;
  const showHouse = bodygraph?.showGateHouse !== false;
  const showPlanetLabel = bodygraph?.showGatePlanetLabel !== false;
  // Build the row grid from whichever columns are enabled. A leading arrow slot
  // (when tone direction is on) sits left of the planet glyph; the sign column
  // keeps a 20px floor so its glyph never gets squeezed when the gate code is long.
  const rowCols = [
    showToneArrow ? '12px' : null,
    '24px',
    'auto',
    'minmax(20px, 1fr)',
    showHouse ? '34px' : null,
    showPlanetLabel ? '40px' : null,
  ].filter(Boolean).join(' ');
  const color = stream === 'design'
    ? 'var(--hd-design, #a12f2f)'
    : 'var(--hd-personality, var(--ink, #1b1830))';

  const activations: Record<string, any> = stream === 'design'
    ? ( data?.designActivations  || {} )
    : ( data?.birthActivations   || {} );

  const planets = PLANET_ORDER
    .filter( name => activations[ name ] && ( !allow || allow.includes( name ) ) )
    .map( name => ( { planet: name, symbol: PLANET_SYMBOLS[ name ] || name[ 0 ], ...activations[ name ] } ) );


  if ( ! planets.length ) return (
    <div style={{ fontSize: 11, color: 'var(--mute)', padding: 8, fontStyle: 'italic' }}>{ title }</div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, background: color, borderRadius: '50%', flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mute)' }}>{ title }</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        { planets.map( ( p: any, i: number ) => (
          <div 
            key={ i } 
            onClick={() => onSelect([
                { sectionType: 'hd_planets', itemKey: `${stream}-${p.planet}`.toLowerCase().replace('northnode', 'north-node').replace('southnode', 'south-node'), title: `${stream === 'design' ? 'Design' : 'Personality'} ${p.planet}` },
                { sectionType: 'hd_gates', itemKey: String(p.gate), title: `Gate ${p.gate}` },
                ...(p.line ? [{ sectionType: 'hd_lines', itemKey: String(p.line), title: `Line ${p.line}` }] : []),
                ...(detail?.color && p.color != null ? [{ sectionType: 'hd_variable_colors', itemKey: String(p.color), title: `Color ${p.color}` }] : []),
                ...(detail?.tone && p.tone != null ? [{ sectionType: 'hd_variable_tones', itemKey: String(p.tone), title: `Tone ${p.tone}` }] : []),
                { sectionType: 'astro_signs', itemKey: p.sign, title: p.sign },
                { sectionType: 'astro_houses', itemKey: String(p.house), title: `House ${p.house}` }
            ])}
            style={{
            display: 'grid', gridTemplateColumns: rowCols, alignItems: 'center',
            padding: '5px 8px', border: '1px solid var(--hair)',
            background: selectedGate === p.gate ? 'var(--gold-soft, rgba(212,175,55,0.15))' : 'var(--card)',
            borderColor: selectedGate === p.gate ? 'var(--gold)' : 'var(--hair)',
            gap: 6, fontSize: 12.5,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}>
            { showToneArrow && (
              <span title={ p.tone != null ? `Tone ${p.tone} · ${p.tone <= 3 ? 'Left' : 'Right'}` : undefined }
                style={{ fontSize: 11, color: 'var(--hd-active, var(--gold))', lineHeight: 1, textAlign: 'center' }}>
                { p.tone != null ? ( p.tone <= 3 ? '◂' : '▸' ) : '' }
              </span>
            ) }
            <span style={{
              fontStyle: 'italic',
              color,
              fontFamily: 'var(--font-display)',
              fontSize: p.symbol.length > 1 ? 10 : 15,
              fontWeight: p.symbol.length > 1 ? 800 : 400,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              position: 'relative'
            }} title={p.planet}>
              { ( () => {
                const iconBase = getIconBase();
                const iconFile = PLANET_ICON_MAP[p.planet];
                if ( iconBase && iconFile ) {
                  return (
                    <img 
                      src={`${iconBase}${iconFile}.svg`} 
                      style={{ width: 18, height: 18, filter: 'brightness(0) saturate(100%) invert(43%) sepia(85%) saturate(347%) hue-rotate(357deg) brightness(91%) contrast(85%)' }} 
                      alt={p.planet}
                    />
                  );
                }
                return p.symbol;
              } )() }
              { p.isRetrograde && (
                <span 
                  title="Retrograde"
                  style={{ 
                    position: 'absolute',
                    top: -4,
                    right: -6,
                    fontSize: 10, 
                    fontStyle: 'normal',
                    fontWeight: 900,
                    color: 'var(--hd-active, var(--gold))',
                    lineHeight: 1,
                  }}
                >ℛ</span>
              )}
            </span>
            <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 11.5, color: 'var(--ink)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              { formatGateCode( p, detail ).split( '.' ).map( ( part: string, idx: number ) => (
                <span key={ idx }>
                  { idx > 0 && <span style={{ opacity: 0.4 }}>.</span> }{ part }
                </span>
              ) ) }
              {p.fixation === FixingState.Exalted && <span title="Exalted" style={{ fontSize: 12, color: 'var(--hd-fixation, var(--gold))', lineHeight: 1 }}>▲</span>}
              {p.fixation === FixingState.Detriment && <span title="Detriment" style={{ fontSize: 12, color: 'var(--hd-fixation, var(--gold))', lineHeight: 1 }}>▼</span>}
              {p.fixation === FixingState.Juxtaposed && <span title="Juxtaposed" style={{ fontSize: 14, color: 'var(--hd-fixation, var(--gold))', lineHeight: 1, marginTop: -2 }}>✶</span>}
            </span>
            <span title={p.sign} style={{ fontSize: 11, color: 'var(--mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center' }}>
              { signGlyphs ? <Glyph kind="sign" name={p.sign} size={15} /> : p.sign }
            </span>
            { showHouse && (
              <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 800, textAlign: 'center', background: 'rgba(212,175,55,0.1)', borderRadius: 2, padding: '2px 0' }}>
                { p.house ? `H${p.house}` : '—' }
              </span>
            ) }
            { showPlanetLabel && (
              <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--mute)', textAlign: 'right', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                { p.planet.length > 5 ? p.planet.substring(0,3) : p.planet }
              </span>
            ) }
          </div>
        ) ) }

      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Asteroid column (selected asteroids for one stream, beneath the gate column)
// ------------------------------------------------------------------
function AsteroidColumn( { stream, asteroids, onSelect, bodygraph }: { stream: 'design' | 'personality'; asteroids: any[]; onSelect: any; bodygraph?: ChartConfig['bodygraph'] } ) {
  if ( ! asteroids?.length ) return null;
  const detail: GateDetailToggles | undefined = bodygraph?.gateDetail;
  const signGlyphs = !!bodygraph?.signGlyphs;
  const showToneArrow = !!bodygraph?.gateToneArrow && !!detail?.tone;
  const showHouse = bodygraph?.showGateHouse !== false;
  const color = stream === 'design' ? 'var(--hd-design, #a12f2f)' : 'var(--hd-personality, var(--ink, #1b1830))';
  // Row grid mirrors the gate column: optional tone arrow, symbol, name, gate, sign, optional house.
  const rowCols = [
    showToneArrow ? '12px' : null,
    '18px',
    '1fr',
    'auto',
    '44px',
    showHouse ? '30px' : null,
  ].filter( Boolean ).join( ' ' );
  const rows = asteroids
    .map( a => ( { name: a.name, symbol: a.symbol, pos: stream === 'design' ? a.design : a.personality } ) )
    .filter( r => r.pos );
  if ( ! rows.length ) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, background: color, borderRadius: '50%', flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute)' }}>
          { stream === 'design' ? 'Design' : 'Personality' } · Asteroids
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        { rows.map( ( r, i ) => (
          <div
            key={ i }
            onClick={() => onSelect([
              ...(r.pos.gate ? [{ sectionType: 'hd_gates', itemKey: String(r.pos.gate), title: `Gate ${r.pos.gate}` }] : []),
              ...(r.pos.line ? [{ sectionType: 'hd_lines', itemKey: String(r.pos.line), title: `Line ${r.pos.line}` }] : []),
              ...(detail?.color && r.pos.color != null ? [{ sectionType: 'hd_variable_colors', itemKey: String(r.pos.color), title: `Color ${r.pos.color}` }] : []),
              ...(detail?.tone && r.pos.tone != null ? [{ sectionType: 'hd_variable_tones', itemKey: String(r.pos.tone), title: `Tone ${r.pos.tone}` }] : []),
              { sectionType: 'astro_signs', itemKey: r.pos.sign, title: r.pos.sign },
              { sectionType: 'astro_houses', itemKey: String(r.pos.house), title: `House ${r.pos.house}` },
            ])}
            style={{ display: 'grid', gridTemplateColumns: rowCols, alignItems: 'center', gap: 6,
              padding: '4px 8px', border: '1px solid var(--hair)', background: 'var(--card)', fontSize: 11.5, cursor: 'pointer' }}
            title={ r.name }
          >
            { showToneArrow && (
              <span title={ r.pos.tone != null ? `Tone ${r.pos.tone} · ${r.pos.tone <= 3 ? 'Left' : 'Right'}` : undefined }
                style={{ fontSize: 11, color: 'var(--hd-active, var(--gold))', lineHeight: 1, textAlign: 'center' }}>
                { r.pos.tone != null ? ( r.pos.tone <= 3 ? '◂' : '▸' ) : '' }
              </span>
            ) }
            <span style={{ color, fontWeight: 700 }}>{ r.symbol }</span>
            <span style={{ color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ r.name }</span>
            <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10.5, color: 'var(--ink)', fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
              { r.pos.gate ? formatGateCode( r.pos, detail ).split( '.' ).map( ( part: string, idx: number ) => (
                <span key={ idx }>{ idx > 0 && <span style={{ opacity: 0.4 }}>.</span> }{ part }</span>
              ) ) : '—' }
            </span>
            <span title={ r.pos.sign } style={{ color: 'var(--mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center' }}>
              { signGlyphs ? <Glyph kind="sign" name={ r.pos.sign } size={ 14 } /> : r.pos.sign }
            </span>
            { showHouse && (
              <span style={{ color: 'var(--gold)', fontWeight: 800, textAlign: 'center' }}>{ r.pos.house ? `H${r.pos.house}` : '—' }</span>
            ) }
          </div>
        ) ) }
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Variables panel (2×2 grid with labeled quadrants)
// ------------------------------------------------------------------
type VariableEntry = { orientation: 'Left' | 'Right'; color: number; tone: number };

function VariableCell( { id, label, entry, accent, onSelect }: { id: string; label: string; entry: VariableEntry; accent: string, onSelect: any } ) {
  const dir = entry.orientation === 'Left' ? '←' : '→';
  // Dispatch the variable as a proper bundle: the arrow + its color combo + its tone,
  // so the sidebar resolves all three (matching getHDVariableItems). 'brain'/'environment'
  // are Design-stream arrows; 'motivation'/'perspective' are Personality.
  const stream = ( id === 'brain' || id === 'environment' ) ? 'design' : 'personality';
  const dirLower = String( entry.orientation || '' ).toLowerCase();
  const selectVariable = () => onSelect([
    { sectionType: 'hd_variables', itemKey: id, title: label },
    ...( entry.color && ( dirLower === 'left' || dirLower === 'right' )
      ? [ { sectionType: 'hd_variable_colors', itemKey: `${id}-c${entry.color}-${dirLower}`, title: `${label} · Color ${entry.color}` } ] : [] ),
    ...( entry.tone
      ? [ { sectionType: 'hd_variable_tones', itemKey: `${stream}-t${entry.tone}`, title: `${stream} Tone ${entry.tone}` } ] : [] ),
  ]);

  return (
    <div
        onClick={selectVariable}
        style={{ flex: 1, padding: '8px 10px', background: 'var(--card)', border: '1px solid var(--hair)', display: 'flex', flexDirection: 'column', gap: 5, cursor: 'pointer' }}
    >
      <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mute)' }}>{ label }</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 15, color: accent, fontWeight: 700, lineHeight: 1 }}>{ dir }</span>
        <svg width="22" height="22" viewBox="0 0 22 22">
          <circle cx="11" cy="11" r="9" fill="none" stroke={ accent } strokeWidth="1.5" />
          <text x="11" y="15" textAnchor="middle" fontSize="9" fontWeight="700" fill={ accent }>{ entry.color }</text>
        </svg>
        <svg width="20" height="20" viewBox="0 0 20 20">
          <polygon points="10,1 1,18 19,18" fill="none" stroke={ accent } strokeWidth="1.5" />
          <text x="10" y="16" textAnchor="middle" fontSize="8" fontWeight="700" fill={ accent }>{ entry.tone }</text>
        </svg>
      </div>
    </div>
  );
}

function VariablesPanel( { variables, onSelect }: { variables: Record<string, VariableEntry>, onSelect: any } ) {
  const dColor = 'var(--hd-design, #a12f2f)';
  const pColor = 'var(--hd-personality, var(--ink, #1b1830))';
  return (
    <div style={{ border: '1px solid var(--hair)', borderBottom: 'none', background: 'var(--paper)' }}>
      <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--hair)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--hd-active, var(--gold))' }}>Variables</span>
        <div style={{ display: 'flex', gap: 10, fontSize: 8, color: 'var(--mute)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <span style={{ color: dColor }}>● Design</span>
          <span style={{ color: pColor }}>● Personality</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '8px 10px' }}>
        <VariableCell id="brain" label="Brain" entry={ variables.digestion }   accent={ dColor } onSelect={onSelect} />
        <VariableCell id="motivation" label="Motivation · Awareness" entry={ variables.motivation } accent={ pColor } onSelect={onSelect} />
        <VariableCell id="environment" label="Environment" entry={ variables.environment } accent={ dColor } onSelect={onSelect} />
        <VariableCell id="perspective" label="Perspective · View" entry={ variables.perspective }   accent={ pColor } onSelect={onSelect} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// Destiny Points Map
// ------------------------------------------------------------------
function DestinyPointsMap( { data, onSelect }: { data: any, onSelect: any } ) {
  const primary = 'var(--gold, #d4af37)';
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
  const lifeAngel = getAngelOverlay( lifePurpose?.longitude );
  const soulAngel = getAngelOverlay( soulPurpose?.longitude );

  if ( ! lifePurpose && ! soulPurpose ) return null;

  return (
    <div style={{ marginTop: 40, borderTop: '2px solid var(--ink)', paddingTop: 24 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: 'var(--ink)', margin: '0 0 20px' }}>Destiny Map</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        { soulPurpose && (
          <div 
            onClick={() => onSelect([
                { sectionType: 'hd_destiny_points', itemKey: 'soul-purpose', title: 'Soul Purpose' },
                { sectionType: 'hd_gates', itemKey: String(soulPurpose.gate), title: `Gate ${soulPurpose.gate}` },
                { sectionType: 'astro_houses', itemKey: String(soulPurpose.house), title: `House ${soulPurpose.house}` }
            ])}
            style={{ background: 'var(--card)', padding: 20, border: '1px solid var(--hair)', borderRadius: 0, cursor: 'pointer' }}
          >
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>✦ Soul Purpose (Design)</div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--ink)', marginBottom: 4 }}>
              { soulPurpose.name } in { soulPurpose.sign }
            </div>
            { soulAngel && <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 6 }}>Angel: { soulAngel.name } · { formatAngelDegree( soulAngel ) }</div> }
            <div style={{ fontSize: 13, color: 'var(--mute)' }}>
              Gate { soulPurpose.gate }.{ soulPurpose.line } · House { soulPurpose.house || '—' }
            </div>
          </div>
        ) }
        { lifePurpose && (
          <div 
            onClick={() => onSelect([
                { sectionType: 'hd_destiny_points', itemKey: 'life-purpose', title: 'Life Purpose' },
                { sectionType: 'hd_gates', itemKey: String(lifePurpose.gate), title: `Gate ${lifePurpose.gate}` },
                { sectionType: 'astro_houses', itemKey: String(lifePurpose.house), title: `House ${lifePurpose.house}` }
            ])}
            style={{ background: 'var(--card)', padding: 20, border: '1px solid var(--hair)', borderRadius: 0, cursor: 'pointer' }}
          >
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>✦ Life Purpose (Personality)</div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--ink)', marginBottom: 4 }}>
              { lifePurpose.name } in { lifePurpose.sign }
            </div>
            { lifeAngel && <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 6 }}>Angel: { lifeAngel.name } · { formatAngelDegree( lifeAngel ) }</div> }
            <div style={{ fontSize: 13, color: 'var(--mute)' }}>
              Gate { lifePurpose.gate }.{ lifePurpose.line } · House { lifePurpose.house || '—' }
            </div>
          </div>
        ) }
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Active Channels Grid
// ------------------------------------------------------------------
function ActiveChannelsGrid( { data, onSelect }: { data: any, onSelect: any } ) {
  const channels = data?.activeChannels || [];
  if ( ! channels.length ) return null;

  return (
    <div style={{ marginTop: 40, borderTop: '2px solid var(--ink)', paddingTop: 24 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: 'var(--ink)', margin: '0 0 20px' }}>Active Channels</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        { channels.map( ( ch: string ) => (
          <div 
            key={ ch }
            onClick={() => onSelect('hd_channels', ch, `Channel ${ch}`)}
            style={{ background: 'var(--card)', padding: '16px 20px', border: '1px solid var(--hair)', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>✦ Channel</div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--ink)' }}>
              { ch }
            </div>
          </div>
        ) ) }
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Profile Lines Tally Component
// ------------------------------------------------------------------
// Mappings for Quarters and Circuitry
const GATE_QUARTER_MAP: Record<number, string> = {
  13: 'Initiation', 49: 'Initiation', 30: 'Initiation', 55: 'Initiation', 37: 'Initiation',
  63: 'Initiation', 22: 'Initiation', 36: 'Initiation', 25: 'Initiation', 17: 'Initiation',
  21: 'Initiation', 51: 'Initiation', 42: 'Initiation', 3: 'Initiation', 27: 'Initiation',
  24: 'Initiation',
  2: 'Civilization', 23: 'Civilization', 8: 'Civilization', 20: 'Civilization', 16: 'Civilization',
  35: 'Civilization', 45: 'Civilization', 12: 'Civilization', 15: 'Civilization', 52: 'Civilization',
  39: 'Civilization', 53: 'Civilization', 62: 'Civilization', 56: 'Civilization', 31: 'Civilization',
  33: 'Civilization',
  7: 'Duality', 4: 'Duality', 29: 'Duality', 59: 'Duality', 40: 'Duality', 64: 'Duality',
  47: 'Duality', 6: 'Duality', 46: 'Duality', 18: 'Duality', 48: 'Duality', 57: 'Duality',
  32: 'Duality', 50: 'Duality', 28: 'Duality', 44: 'Duality',
  1: 'Mutation', 43: 'Mutation', 14: 'Mutation', 34: 'Mutation', 9: 'Mutation', 5: 'Mutation',
  26: 'Mutation', 11: 'Mutation', 10: 'Mutation', 58: 'Mutation', 38: 'Mutation', 54: 'Mutation',
  61: 'Mutation', 60: 'Mutation', 41: 'Mutation', 19: 'Mutation'
};

const GATE_CIRCUITS_MAP: Record<number, string[]> = {
  1: ['Individual (Knowing)'], 2: ['Individual (Knowing)'], 3: ['Individual (Knowing)'], 8: ['Individual (Knowing)'],
  12: ['Individual (Knowing)'], 14: ['Individual (Knowing)'], 22: ['Individual (Knowing)'], 23: ['Individual (Knowing)'],
  24: ['Individual (Knowing)'], 28: ['Individual (Knowing)'], 38: ['Individual (Knowing)'], 39: ['Individual (Knowing)'],
  43: ['Individual (Knowing)'], 55: ['Individual (Knowing)'], 60: ['Individual (Knowing)'], 61: ['Individual (Knowing)'],
  25: ['Individual (Centering)'], 51: ['Individual (Centering)'],
  20: ['Individual (Integration)'], 57: ['Individual (Integration)'],
  10: ['Individual (Centering)', 'Individual (Integration)'],
  34: ['Individual (Centering)', 'Individual (Integration)'],
  4: ['Collective (Logic)'], 5: ['Collective (Logic)'], 7: ['Collective (Logic)'], 9: ['Collective (Logic)'],
  15: ['Collective (Logic)'], 16: ['Collective (Logic)'], 17: ['Collective (Logic)'], 18: ['Collective (Logic)'],
  31: ['Collective (Logic)'], 48: ['Collective (Logic)'], 52: ['Collective (Logic)'], 58: ['Collective (Logic)'],
  62: ['Collective (Logic)'], 63: ['Collective (Logic)'],
  11: ['Collective (Abstract)'], 13: ['Collective (Abstract)'], 29: ['Collective (Abstract)'], 30: ['Collective (Abstract)'],
  33: ['Collective (Abstract)'], 35: ['Collective (Abstract)'], 36: ['Collective (Abstract)'], 41: ['Collective (Abstract)'],
  42: ['Collective (Abstract)'], 46: ['Collective (Abstract)'], 47: ['Collective (Abstract)'], 53: ['Collective (Abstract)'],
  56: ['Collective (Abstract)'], 64: ['Collective (Abstract)'],
  19: ['Tribal (Ego)'], 21: ['Tribal (Ego)'], 26: ['Tribal (Ego)'], 32: ['Tribal (Ego)'], 37: ['Tribal (Ego)'],
  40: ['Tribal (Ego)'], 44: ['Tribal (Ego)'], 45: ['Tribal (Ego)'], 49: ['Tribal (Ego)'], 54: ['Tribal (Ego)'],
  6: ['Tribal (Defense)'], 27: ['Tribal (Defense)'], 50: ['Tribal (Defense)'], 59: ['Tribal (Defense)']
};

const PROFILE_TAB_ORDER = ['lines', 'quarters', 'circuitry', 'repeats'] as const;

function ProfileLinesTally({ data, tabs }: { data: any, tabs?: ProfileLineTabs }) {
  const visibleTabs = PROFILE_TAB_ORDER.filter((t) => !tabs || tabs[t]);
  const [activeSubTab, setActiveSubTab] = useState<'lines' | 'quarters' | 'circuitry' | 'repeats'>(visibleTabs[0] || 'lines');
  // If the active tab was toggled off, fall back to the first visible one.
  const effectiveSubTab = visibleTabs.includes(activeSubTab) ? activeSubTab : (visibleTabs[0] || 'lines');
  if (!visibleTabs.length) return null;
  
  const dActs = data?.designActivations || {};
  const pActs = data?.birthActivations || {};
  
  const planetsToCount = ['Sun', 'Earth', 'NorthNode', 'SouthNode', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

  // 1. Setup counts
  const personalityLines = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };
  const designLines = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };

  const personalityQuarters = { Initiation: 0, Civilization: 0, Duality: 0, Mutation: 0 };
  const designQuarters = { Initiation: 0, Civilization: 0, Duality: 0, Mutation: 0 };

  const personalityCircuits = {
    'Individual (Knowing)': 0,
    'Individual (Centering)': 0,
    'Individual (Integration)': 0,
    'Collective (Logic)': 0,
    'Collective (Abstract)': 0,
    'Tribal (Ego)': 0,
    'Tribal (Defense)': 0
  };
  const designCircuits = {
    'Individual (Knowing)': 0,
    'Individual (Centering)': 0,
    'Individual (Integration)': 0,
    'Collective (Logic)': 0,
    'Collective (Abstract)': 0,
    'Tribal (Ego)': 0,
    'Tribal (Defense)': 0
  };

  planetsToCount.forEach(name => {
    const pAct = pActs[name];
    if (pAct) {
      if (pAct.line && String(pAct.line) in personalityLines) {
        personalityLines[String(pAct.line) as keyof typeof personalityLines]++;
      }
      if (pAct.gate) {
        const gateNum = Number(pAct.gate);
        const q = GATE_QUARTER_MAP[gateNum];
        if (q) personalityQuarters[q as keyof typeof personalityQuarters]++;
        
        const circuits = GATE_CIRCUITS_MAP[gateNum];
        if (circuits) {
          circuits.forEach(c => {
            personalityCircuits[c as keyof typeof personalityCircuits]++;
          });
        }
      }
    }
    const dAct = dActs[name];
    if (dAct) {
      if (dAct.line && String(dAct.line) in designLines) {
        designLines[String(dAct.line) as keyof typeof designLines]++;
      }
      if (dAct.gate) {
        const gateNum = Number(dAct.gate);
        const q = GATE_QUARTER_MAP[gateNum];
        if (q) designQuarters[q as keyof typeof designQuarters]++;
        
        const circuits = GATE_CIRCUITS_MAP[gateNum];
        if (circuits) {
          circuits.forEach(c => {
            designCircuits[c as keyof typeof designCircuits]++;
          });
        }
      }
    }
  });

  const personalityMajorCircuits = {
    Individual: personalityCircuits['Individual (Knowing)'] + personalityCircuits['Individual (Centering)'],
    Collective: personalityCircuits['Collective (Logic)'] + personalityCircuits['Collective (Abstract)'],
    Tribal: personalityCircuits['Tribal (Ego)'] + personalityCircuits['Tribal (Defense)']
  };

  const designMajorCircuits = {
    Individual: designCircuits['Individual (Knowing)'] + designCircuits['Individual (Centering)'],
    Collective: designCircuits['Collective (Logic)'] + designCircuits['Collective (Abstract)'],
    Tribal: designCircuits['Tribal (Ego)'] + designCircuits['Tribal (Defense)']
  };

  // Find repeating gates
  const gateActivations: Record<number, Array<{ stream: 'personality' | 'design'; planet: string; line: number }>> = {};

  planetsToCount.forEach(name => {
    const pAct = pActs[name];
    if (pAct && pAct.gate) {
      const g = Number(pAct.gate);
      if (!gateActivations[g]) gateActivations[g] = [];
      gateActivations[g].push({
        stream: 'personality',
        planet: name,
        line: pAct.line ? Number(pAct.line) : 0
      });
    }
    const dAct = dActs[name];
    if (dAct && dAct.gate) {
      const g = Number(dAct.gate);
      if (!gateActivations[g]) gateActivations[g] = [];
      gateActivations[g].push({
        stream: 'design',
        planet: name,
        line: dAct.line ? Number(dAct.line) : 0
      });
    }
  });

  const repeatingGates = Object.entries(gateActivations)
    .map(([gate, list]) => ({ gate: Number(gate), activations: list }))
    .filter(item => item.activations.length > 1)
    .sort((a, b) => b.activations.length - a.activations.length || a.gate - b.gate);

  // 2. Select data based on active tab
  let rowKeys: string[] = [];
  let rowDetails: Record<string, { label: string; color: string }> = {};
  let pCounts: Record<string, number> = {};
  let dCounts: Record<string, number> = {};
  const grandTotal = 26;

  if (effectiveSubTab === 'lines') {
    rowKeys = ['6', '5', '4', '3', '2', '1'];
    rowDetails = {
      '6': { label: '6 - Role Model', color: '#4cd137' },
      '5': { label: '5 - Universalizing Projection', color: '#e84118' },
      '4': { label: '4 - Fixed Externalizing', color: '#9b59b6' },
      '3': { label: '3 - Adapting', color: '#e84393' },
      '2': { label: '2 - Natural Projection', color: '#00a8ff' },
      '1': { label: '1 - Introspective', color: '#002fa7' },
    };
    pCounts = personalityLines;
    dCounts = designLines;
  } else if (effectiveSubTab === 'quarters') {
    rowKeys = ['Initiation', 'Civilization', 'Duality', 'Mutation'];
    rowDetails = {
      'Initiation': { label: 'Quarter of Initiation', color: '#4cd137' },
      'Civilization': { label: 'Quarter of Civilization', color: '#00a8ff' },
      'Duality': { label: 'Quarter of Duality', color: '#9b59b6' },
      'Mutation': { label: 'Quarter of Mutation', color: '#e84118' },
    };
    pCounts = personalityQuarters;
    dCounts = designQuarters;
  } else {
    rowKeys = [
      'Individual (Knowing)',
      'Individual (Centering)',
      'Individual (Integration)',
      'Collective (Logic)',
      'Collective (Abstract)',
      'Tribal (Ego)',
      'Tribal (Defense)'
    ];
    rowDetails = {
      'Individual (Knowing)': { label: 'Knowing Circuit', color: '#002fa7' },
      'Individual (Centering)': { label: 'Centering Circuit', color: '#00a8ff' },
      'Individual (Integration)': { label: 'Integration Channels', color: '#e84393' },
      'Collective (Logic)': { label: 'Logic / Understanding', color: '#9b59b6' },
      'Collective (Abstract)': { label: 'Abstract / Sensing', color: '#e84118' },
      'Tribal (Ego)': { label: 'Ego Circuit', color: '#4cd137' },
      'Tribal (Defense)': { label: 'Defense Circuit', color: '#f39c12' },
    };
    pCounts = personalityCircuits;
    dCounts = designCircuits;
  }

  const maxSingleBar = Math.max(
    1,
    ...Object.values(pCounts),
    ...Object.values(dCounts)
  );

  return (
    <div style={{ marginTop: 40, borderTop: '2px solid var(--ink)', paddingTop: 24 }}>
      {/* Subtab selection headers */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--hair)', gap: 24, marginBottom: 24 }}>
        {visibleTabs.map(tabKey => {
          const labels = {
            lines: 'Profile Lines',
            quarters: 'Incarnation Quarters',
            circuitry: 'Circuitry Grouping',
            repeats: 'Repeating Gates'
          };
          const isActive = effectiveSubTab === tabKey;
          return (
            <button
              key={tabKey}
              onClick={() => setActiveSubTab(tabKey)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2.5px solid var(--gold)' : '2.5px solid transparent',
                paddingBottom: 12,
                fontSize: 13.5,
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

      {effectiveSubTab === 'circuitry' && (
        <div style={{ marginBottom: 28, borderBottom: '1px solid var(--hair)', paddingBottom: 24 }}>
          <h3 style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 16 }}>
            Major Circuitry Groups (Overall)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {(['Individual', 'Collective', 'Tribal'] as const).map(group => {
              const pVal = personalityMajorCircuits[group] || 0;
              const dVal = designMajorCircuits[group] || 0;
              const groupTotal = pVal + dVal;
              const colors = {
                Individual: { label: 'Individual', color: '#002fa7', desc: 'Unique knowing & mutation' },
                Collective: { label: 'Collective', color: '#9b59b6', desc: 'Shared logic & sensing' },
                Tribal: { label: 'Tribal', color: '#4cd137', desc: 'Support, ego, & defense' }
              }[group];

              return (
                <div key={group} style={{ background: 'var(--card)', border: '1px solid var(--hair)', padding: '18px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, background: colors.color, borderRadius: '50%' }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{colors.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mute)', marginBottom: 14 }}>
                    {colors.desc}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>
                    {groupTotal} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--mute)' }}>Activations</span>
                  </div>
                  
                  {/* Personality Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 9, width: 14, fontWeight: 700, color: 'var(--gold, #d4af37)' }}>P</span>
                    <KitMeter value={pVal} max={13} color="var(--gold, #d4af37)" />
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gold, #d4af37)', minWidth: 12, textAlign: 'right' }}>{pVal}</span>
                  </div>

                  {/* Design Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 9, width: 14, fontWeight: 700, color: 'var(--hd-design, #a12f2f)' }}>D</span>
                    <KitMeter value={dVal} max={13} color="var(--hd-design, #a12f2f)" />
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--hd-design, #a12f2f)', minWidth: 12, textAlign: 'right' }}>{dVal}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {effectiveSubTab === 'repeats' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 13.5, color: 'var(--mute)', lineHeight: 1.5 }}>
            Repeating gates (also known as double activations or harmonic repetitions) represent gates that are activated by more than one planet in your chart. When a gate repeats, its energetic frequency is amplified, signifying a major theme in your life.
          </div>
          {repeatingGates.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg, #fbfbfb)', borderRadius: 0, border: '1px dashed var(--hair)' }}>
              <div style={{ fontSize: 14, color: 'var(--mute)' }}>No repeating gates found in this chart.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {repeatingGates.map(item => {
                const pCount = item.activations.filter(a => a.stream === 'personality').length;
                const dCount = item.activations.filter(a => a.stream === 'design').length;
                
                let streamLabel = 'Both Streams';
                let streamBg = 'linear-gradient(90deg, rgba(212,175,55,0.1) 0%, rgba(161,47,47,0.1) 100%)';
                let streamBorder = '1px solid rgba(212,175,55,0.2)';
                let streamColor = 'var(--ink)';

                if (pCount > 0 && dCount === 0) {
                  streamLabel = 'Personality Only';
                  streamBg = 'rgba(212,175,55,0.08)';
                  streamBorder = '1px solid rgba(212,175,55,0.3)';
                  streamColor = 'var(--gold, #d4af37)';
                } else if (dCount > 0 && pCount === 0) {
                  streamLabel = 'Design Only';
                  streamBg = 'rgba(161,47,47,0.08)';
                  streamBorder = '1px solid rgba(161,47,47,0.3)';
                  streamColor = 'var(--hd-design, #a12f2f)';
                }

                return (
                  <div key={item.gate} style={{
                    background: 'var(--card, #ffffff)',
                    border: '1px solid var(--hair, #e5e5e5)',
                    borderRadius: 0,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
                        Gate {item.gate}
                      </span>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '4px 8px',
                        borderRadius: 0,
                        background: streamBg,
                        border: streamBorder,
                        color: streamColor
                      }}>
                        {streamLabel}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {item.activations.map((act, idx) => {
                        const isP = act.stream === 'personality';
                        const color = isP ? 'var(--gold, #d4af37)' : 'var(--hd-design, #a12f2f)';
                        const dotColor = isP ? '#d4af37' : '#a12f2f';
                        return (
                          <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 0,
                            background: 'var(--bg, #fbfbfb)',
                            border: '1px solid var(--hair, #e5e5e5)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: dotColor
                              }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                                {act.planet}
                              </span>
                            </div>
                            <span style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: color
                            }}>
                              Line {act.line}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 28, alignItems: 'start' }}>
          {/* Tally Chart Comparison */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--hair, #e5e5e5)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--mute)' }}>Classification</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--mute)', width: '38%' }}>Distribution (P vs D)</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--hd-design, #a12f2f)' }}>Design</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gold, #d4af37)' }}>Personality</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--ink)' }}>Total</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--mute)' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {rowKeys.map(key => {
                  const pVal = pCounts[key] || 0;
                  const dVal = dCounts[key] || 0;
                  const rowTotal = pVal + dVal;
                  const percentage = ((rowTotal / grandTotal) * 100).toFixed(1) + '%';
                  const detail = rowDetails[key] || { label: key, color: '#ccc' };

                  return (
                    <tr key={key} style={{ borderBottom: '1px solid var(--hair, #e5e5e5)' }}>
                      {/* Label Column */}
                      <td style={{ padding: '14px 12px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, background: detail.color, borderRadius: '50%', flexShrink: 0 }} />
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{detail.label}</div>
                        </div>
                      </td>

                      {/* Bars Column */}
                      <td style={{ padding: '14px 12px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {/* Personality Bar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 8.5, width: 12, fontWeight: 700, color: 'var(--gold, #d4af37)' }}>P</span>
                            <KitMeter value={pVal} max={maxSingleBar} color="var(--gold, #d4af37)" />
                          </div>
                          {/* Design Bar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 8.5, width: 12, fontWeight: 700, color: 'var(--hd-design, #a12f2f)' }}>D</span>
                            <KitMeter value={dVal} max={maxSingleBar} color="var(--hd-design, #a12f2f)" />
                          </div>
                        </div>
                      </td>

                      {/* Counts Column */}
                      <td style={{ textAlign: 'center', padding: '14px 12px', fontWeight: 800, fontSize: 14, color: 'var(--hd-design, #a12f2f)', verticalAlign: 'middle' }}>
                        {dVal}
                      </td>
                      <td style={{ textAlign: 'center', padding: '14px 12px', fontWeight: 800, fontSize: 14, color: 'var(--gold, #d4af37)', verticalAlign: 'middle' }}>
                        {pVal}
                      </td>
                      <td style={{ textAlign: 'center', padding: '14px 12px', fontWeight: 800, fontSize: 14, color: 'var(--ink)', verticalAlign: 'middle' }}>
                        {rowTotal}
                      </td>

                      {/* Percentage Column */}
                      <td style={{ textAlign: 'right', padding: '14px 12px', fontWeight: 700, fontSize: 12, color: 'var(--ink)', verticalAlign: 'middle' }}>
                        {percentage}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Educational Explanations Side Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, border: '1px solid var(--hair)', borderRadius: 0, padding: 20, background: 'var(--card)' }}>
            {effectiveSubTab === 'lines' && (
              <>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                  Understanding Hexagram Lines
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--mute)', lineHeight: 1.5 }}>
                  Each of the 6 lines of the Hexagram carries a distinct frequency. Checking the lines distribution tells you which lines dominate your conscious (Personality) and unconscious (Design) profiles:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#002fa7' }}>Line 1 (Introspective):</strong> Research, study, finding a solid foundation, need for security.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#00a8ff' }}>Line 2 (Natural):</strong> Innate talent, projection field, hermit phase, waiting for the call.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#e84393' }}>Line 3 (Adapting):</strong> Trial and error, discovery, resilience, experiential wisdom.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#9b59b6' }}>Line 4 (Fixed):</strong> Networking, opportunities through friends, opportunist, influential.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#e84118' }}>Line 5 (Universalizing):</strong> Practical solutions, high expectations, projection field, savior/scapegoat.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#4cd137' }}>Line 6 (Role Model):</strong> Tripartite life phases (experiential, on the roof, role model), objective observer.
                  </div>
                </div>
              </>
            )}

            {effectiveSubTab === 'quarters' && (
              <>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                  Understanding Incarnation Quarters
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--mute)', lineHeight: 1.5 }}>
                  The Wheel of 64 gates is divided into four developmental quarters, shaping how your life purpose is experienced and fulfilled:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#4cd137' }}>Initiation (Mind):</strong> Fulfilling purpose through learning, conceptualization, and mental expansion.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#00a8ff' }}>Civilization (Form):</strong> Fulfilling purpose through physical manifestation, building structure, and materialization.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#9b59b6' }}>Duality (Bonding):</strong> Fulfilling purpose through relationship, collaboration, and tribal/collective bonds.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#e84118' }}>Mutation (Transformation):</strong> Fulfilling purpose through adaptation, mutation, transformation, and transcendence.
                  </div>
                </div>
              </>
            )}

            {effectiveSubTab === 'circuitry' && (
              <>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                  Understanding Circuitry Groups
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--mute)', lineHeight: 1.5 }}>
                  Circuitry outlines how energy flows through your chart, showing how you connect with yourself, others, and the world:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#002fa7' }}>Knowing Circuit:</strong> Individual mutation, unique wisdom, and acoustic knowing.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#00a8ff' }}>Centering Circuit:</strong> Individual empowerment, standing firm in one's unique direction.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#e84393' }}>Integration Channels:</strong> Primary survival, present-moment responding, self-integration.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#9b59b6' }}>Logic / Understanding:</strong> Collective patterns, future security, logic, and testing hypotheses.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#e84118' }}>Abstract / Sensing:</strong> Collective human experiences, past reflection, and storytelling.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#4cd137' }}>Ego Circuit:</strong> Tribal business, support, resource agreements, and material security.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    <strong style={{ color: '#f39c12' }}>Defense Circuit:</strong> Tribal protection, parenting, breeding, and caring.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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
  };
}
