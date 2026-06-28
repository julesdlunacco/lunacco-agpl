/**
 * CoreDashboardView — bento-grid landing page shown when 2+ modules are active.
 *
 * Reads entirely from existing context — no module-specific imports.
 * Tarot daily card is read from window.LunaCcoDailyCard (published by luna-tarot/main.jsx
 * and updated by TarotContext when real deck data loads).
 */
import { useMemo, useState, useEffect } from 'react';
import { Sparkles, Star, Calendar, BarChart3, ArrowRight, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { getFeaturedItems } from '../../utils/featurables.js';
import CitySearchInput from '../shared/CitySearchInput.jsx';
import AppFooter from './AppFooter.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useUser } from '../../contexts/UserContext.jsx';
import { useModuleRegistry } from '../../contexts/ModuleContext.jsx';
import { useAppConfig } from '../../contexts/AppConfigContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';

const preventCtxMenu = ( e ) => e.preventDefault();

function adnUniversalDayDash( month, day, year ) {
  let s = [ ...String( month ), ...String( day ), ...String( year ) ]
    .reduce( ( acc, c ) => acc + parseInt( c, 10 ), 0 );
  while ( s > 22 ) s = [ ...String( s ) ].reduce( ( acc, c ) => acc + parseInt( c, 10 ), 0 );
  return Math.max( s, 1 );
}

function sumDigits( n ) {
  return String( n ).split( '' ).reduce( ( s, d ) => s + parseInt( d, 10 ), 0 );
}
function reduce( n ) {
  while ( n > 9 && n !== 11 && n !== 22 && n !== 33 ) n = sumDigits( n );
  return n;
}
function reduce22( n ) {
  let s = n;
  while ( s > 22 ) s = String( s ).split( '' ).reduce( ( acc, d ) => acc + parseInt( d, 10 ), 0 );
  return Math.max( s, 1 );
}
function getPersonalNumbers( birthdate, targetDate = new Date() ) {
  if ( !birthdate ) return null;
  const parts = birthdate.split( birthdate.includes( '-' ) ? '-' : '/' );
  let bm, bd, by;
  if ( birthdate.includes( '-' ) ) { bm = parseInt( parts[1] ); bd = parseInt( parts[2] ); by = parseInt( parts[0] ); }
  else { bm = parseInt( parts[0] ); bd = parseInt( parts[1] ); by = parseInt( parts[2] ); }
  if ( !bm || !bd ) return null;

  const ty = targetDate.getFullYear();
  const tm = targetDate.getMonth() + 1;
  const td = targetDate.getDate();

  // Pythagorean
  const pythYear  = reduce( bm + bd + [ ...String( ty ) ].reduce( ( s, c ) => s + parseInt( c ), 0 ) );
  const pythMonth = reduce( pythYear + tm );
  const pythDay   = reduce( pythMonth + td );

  // ADM
  const A = bd > 22 ? reduce22( bd ) : bd;
  const B = bm;
  const C = reduce22( String( by ).split( '' ).reduce( ( s, d ) => s + parseInt( d, 10 ), 0 ) );
  const D = reduce22( A + B + C );
  const E = reduce22( A + B + C + D );
  const admYear  = reduce22( A + B + C + D + E + ty );
  const admMonth = reduce22( admYear + tm );
  const admDay   = adnUniversalDayDash( tm, td, ty ); // Aligned to universal day in squares

  return { pythYear, pythMonth, pythDay, admYear, admMonth, admDay };
}

// ------------------------------------------------------------------
// NumberBadge
// ------------------------------------------------------------------
function NumberBadge( { label, value, accent = false } ) {
  return (
    <div className={ `flex flex-col items-center justify-center p-3 border transition-all ${ accent ? 'bg-[var(--gold)]/10 border-[var(--gold)]/30 shadow-sm' : 'bg-[var(--card)] border-[var(--hair)]' }` } style={{ borderRadius: 'var(--radius-card, 0px)' }}>
      <span className={ `text-[9px] font-bold uppercase tracking-[0.18em] ${ accent ? 'text-[var(--gold)]' : 'text-[var(--mute)]' } mb-1` }>{ label }</span>
      <span className={ `text-3xl font-light italic ${ accent ? 'text-[var(--gold)]' : 'text-[var(--ink)]' }` } style={{ fontFamily: 'var(--font-display)' }}>{ value }</span>
    </div>
  );
}

// ------------------------------------------------------------------
// Collective numerology helpers (no birth date needed)
// ------------------------------------------------------------------
function getCollectiveNumbers() {
  const now           = new Date();
  const year          = now.getFullYear();
  const month         = now.getMonth() + 1;
  const day           = now.getDate();
  const universalYear = reduce( [ ...String( year ) ].reduce( ( s, c ) => s + parseInt( c ), 0 ) );
  const universalMonth = reduce( universalYear + month );
  const universalDay   = reduce( universalMonth + day );
  return { universalYear, universalMonth, universalDay };
}

// ------------------------------------------------------------------
// ProfileSetupCard — shown only when identity birthdate is not yet set
// ------------------------------------------------------------------
function ProfileSetupCard( { setView } ) {
  const { profileData, profileLoading, saveProfile, profileSaving } = useUser();
  const [ fields, setFields ] = useState( {
    full_name: '', birthdate: '', birth_time: '',
    birth_location: '', birth_lat: '', birth_lng: '', birth_timezone: '',
  } );
  const [ saved,  setSaved  ] = useState( false );
  const [ seeded, setSeeded ] = useState( false );

  // Seed the form from any identity data already saved (so a user who only has a
  // birthdate sees it pre-filled and just needs to add the missing time / location).
  useEffect( () => {
    if ( seeded || profileLoading || ! profileData?.identity ) return;
    const id = profileData.identity;
    setFields( ( p ) => ( {
      ...p,
      full_name:      id.full_name      || '',
      birthdate:      id.birthdate      || '',
      birth_time:     id.birth_time     || '',
      birth_location: id.birth_location || '',
      birth_lat:      id.birth_lat      || '',
      birth_lng:      id.birth_lng      || '',
      birth_timezone: id.birth_timezone || '',
    } ) );
    setSeeded( true );
  }, [ profileData, profileLoading, seeded ] );

  // Don't render while profile is loading from server (prevents flash on refresh)
  if ( profileLoading ) return null;

  // Chart essentials = birth date + birth time + birth location. All three are
  // required for an accurate astrology / Human Design chart, so the card shows until
  // all are present. Users who don't know their time get a help link (configurable in
  // Business Settings) walking them through where to find it / rectification.
  const id = profileData?.identity || {};
  const profileHasEssentials = !! id.birthdate && !! id.birth_time && !! id.birth_location;
  if ( saved || profileHasEssentials ) return null;

  const birthTimeHelpUrl = window.LunaCcoData?.birthTimeHelpUrl || '';

  const f = ( key ) => ( e ) => setFields( p => ( { ...p, [ key ]: e.target.value } ) );
  const inputCls = 'w-full bg-[var(--paper)] border border-[var(--hair)] px-3 py-2 text-sm text-[var(--ink)] placeholder-[var(--ink)]/30 outline-none focus:border-[var(--indigo)]';
  const captionCls = 'block text-[10px] font-bold uppercase tracking-widest text-[var(--mute)] mb-1';

  const handleSave = async () => {
    // Merge identity into existing profileData so other sections are not wiped
    await saveProfile( { ...profileData, identity: { ...( profileData?.identity || {} ), ...fields } }, { includeChartCache: false } );
    setSaved( true );
  };

  const canSave = ! profileSaving && fields.birthdate && fields.birth_time && fields.birth_location;

  return (
    <div className="bg-[var(--indigo)]/5 border border-[var(--indigo)]/20 p-6 shadow-sm" style={{ borderRadius: 'var(--radius-card, 0px)' }}>
      <div className="flex items-center gap-2 mb-4">
        <User size={ 15 } className="text-[var(--indigo)]" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--mute)]">Complete Your Profile</h3>
      </div>
      <p className="text-[var(--ink)]/60 text-xs mb-5">Add your birth date, time, and place — these power accurate astrology and Human Design charts. Your <strong>birth time and location</strong> matter most.</p>
      <div className="grid grid-cols-1 gap-4">
        <div>
          <span className={ captionCls }>Full name</span>
          <input
            type="text"
            placeholder="Full name"
            value={ fields.full_name }
            onChange={ f( 'full_name' ) }
            className={ inputCls }
            style={{ borderRadius: 'var(--radius-card, 0px)', fontFamily: 'var(--font-display)' }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={ captionCls }>Birth date</span>
            <input
              type="date"
              value={ fields.birthdate }
              onChange={ f( 'birthdate' ) }
              className={ inputCls }
              style={{ borderRadius: 'var(--radius-card, 0px)' }}
            />
          </div>
          <div>
            <span className={ captionCls }>Birth time</span>
            <input
              type="time"
              value={ fields.birth_time }
              onChange={ f( 'birth_time' ) }
              className={ inputCls }
              style={{ borderRadius: 'var(--radius-card, 0px)' }}
            />
          </div>
        </div>
        <p className="text-[var(--ink)]/45 text-[11px] -mt-1">
          As exact as you can — birth time sets your rising sign and houses, so it's required for an accurate chart.
          { birthTimeHelpUrl && (
            <>
              { ' ' }
              <a
                href={ birthTimeHelpUrl }
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--indigo)] font-bold border-b border-[var(--indigo)]/40 hover:border-[var(--indigo)] transition-colors"
              >
                What if I don't know my birth time?
              </a>
            </>
          ) }
        </p>
        <div className="bg-[var(--indigo)]/[0.06] border border-[var(--indigo)]/25 p-3" style={{ borderRadius: 'var(--radius-card, 0px)' }}>
          <span className={ captionCls }>Birth location <span className="text-[var(--indigo)] normal-case tracking-normal font-bold">— required for an accurate chart</span></span>
          <CitySearchInput
            value={ fields.birth_location }
            onChange={ ( v ) => setFields( p => ( { ...p, birth_location: v } ) ) }
            onSelect={ ( { label, lat, lng, timezone } ) => setFields( p => ( {
              ...p,
              birth_location: label,
              birth_lat:      lat,
              birth_lng:      lng,
              birth_timezone: timezone,
            } ) ) }
            placeholder="Search your birth city…"
            inputClass={ inputCls }
          />
        </div>
      </div>
      <div className="flex items-center gap-4 mt-6">
        <button
          onClick={ handleSave }
          disabled={ ! canSave }
          className="px-6 py-2 bg-[var(--indigo)] hover:opacity-90 disabled:opacity-40 text-[var(--btn-fg)] text-xs font-bold uppercase tracking-widest transition-all"
        >
          { profileSaving ? 'Saving…' : 'Save Details' }
        </button>
        <button
          onClick={ () => setView( 'profile' ) }
          className="text-xs text-[var(--mute)] hover:text-[var(--ink)] transition-colors border-b border-current"
        >
          Edit in profile →
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// NumerologyWidget
// ------------------------------------------------------------------
function NumerologyWidget( { userContext, setView } ) {
  const collective = useMemo( () => getCollectiveNumbers(), [] );

  const profileChart = userContext?.numerology_profile_chart;
  const { profileData } = useUser();
  const birthdate = profileChart?.input_data?.birthdate || profileData?.identity?.birthdate || '';
  const fullName  = profileData?.identity?.full_name  || profileChart?.input_data?.name     || '';
  const knownName = profileData?.identity?.nickname   || '';

  // Personal cycles numbers via the luna-numerology calculator (exposed as window global)
  const cyclesResult = useMemo( () => {
    const calc = window.LunaCcoNumerologyCalc?.calculatePythagoreanCycles;
    if ( !calc || !birthdate || !fullName ) return null;
    const res = calc( birthdate, fullName, knownName );
    return res.error ? null : res;
  }, [ birthdate, fullName, knownName ] );

  const today        = new Date();
  const currentMonth = cyclesResult?.personalMonths?.find( m => m.isCurrent );
  const currentCycle = cyclesResult?.cycles?.find( c => today >= c.startDate && today < c.endDate );

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={ 15 } className="text-[var(--gold)]" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--mute)]">Numerology</h3>
        </div>
        <button
          onClick={ () => setView( 'charts' ) }
          className="text-[9px] font-bold uppercase tracking-widest text-[var(--gold)] hover:text-[var(--gold-2)] flex items-center gap-1 transition-colors"
        >
          Full Charts <ArrowRight size={ 10 } />
        </button>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        { /* Collective — always visible */ }
        <div className="flex items-center gap-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] opacity-50 whitespace-nowrap">Collective Today</p>
          <div className="h-px bg-[var(--hair)] flex-1" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <NumberBadge label="Year"  value={ collective.universalYear  } />
          <NumberBadge label="Month" value={ collective.universalMonth } />
          <NumberBadge label="Day"   value={ collective.universalDay   } accent />
        </div>

        { /* Personal cycles numbers */ }
        { cyclesResult && (
          <>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] opacity-50 whitespace-nowrap">Personal Today</p>
              <div className="h-px bg-[var(--hair)] flex-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberBadge label="Personal Year"
                value={
                  cyclesResult.yearRaw !== cyclesResult.yearValue
                    ? `${ cyclesResult.yearRaw }/${ cyclesResult.yearValue }`
                    : cyclesResult.yearRaw > 9
                    ? `${ cyclesResult.yearRaw }/${ cyclesResult.yearForCalc }`
                    : cyclesResult.yearValue
                }
                accent />
              { currentCycle && <NumberBadge label={ `Cycle ${ currentCycle.number }` } value={ currentCycle.value } /> }
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberBadge label="Month" value={ currentMonth?.value ?? '—' } />
              <NumberBadge label="Day"   value={ cyclesResult.todayPersonalDay } accent />
            </div>
          </>
        ) }

        { !cyclesResult && birthdate && (
          <p className="text-[10px] text-[var(--mute)] italic mt-2 opacity-60">Add full name to profile to see personal numbers.</p>
        ) }
        { !birthdate && (
          <p className="text-[10px] text-[var(--mute)] italic mt-2 opacity-60">Add birthdate to profile to see personal numbers.</p>
        ) }
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// AstroHDWidget — reads window.LunaCcoAstroHDDaily published by luna-astrohd
// kind: 'moon' | 'ingresses' | 'retrogrades' | 'stelliums'
// ------------------------------------------------------------------

const ASTRO_META = {
  moon:        { label: 'Moon Phase',        accent: 'var(--indigo)' },
  ingresses:   { label: 'Upcoming Ingresses', accent: 'var(--gold)'   },
  retrogrades: { label: 'Retrogrades',        accent: 'var(--ink)'    },
  stelliums:   { label: 'Stelliums',          accent: 'var(--indigo)' },
  skyNow:      { label: 'Sky Overview',       accent: 'var(--gold)'   },
};

function formatIngressDate( iso, tz ) {
  if ( ! iso ) return '';
  try {
    const d = new Date( iso );
    return d.toLocaleString( undefined, {
      timeZone: tz || undefined,
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    } );
  } catch {
    return iso;
  }
}

function formatRetroDate( iso, tz ) {
  if ( ! iso ) return '';
  try {
    return new Date( iso ).toLocaleDateString( undefined, {
      timeZone: tz || undefined,
      month: 'short',
      day: 'numeric',
    } );
  } catch {
    return iso;
  }
}

function getIngressKind( item ) {
  if ( item?.ingressType === 'hd-gate' || item?.ingressType === 'astrology' ) {
    return item.ingressType;
  }
  const label = String( item?.label || '' ).toLowerCase();
  return label.includes( '-> g' ) || label.includes( '→ g' ) ? 'hd-gate' : 'astrology';
}

function AstroIngressList( { items, title, iconBase, activeThemeId, astroIconFilter, natalAscendant, getHouseStr, getPlanetFromName, userTz } ) {
  if ( !items.length ) return null;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 pb-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--mute)] opacity-50 whitespace-nowrap">{ title }</p>
        <div className="h-px bg-[var(--hair)] flex-1" />
      </div>
      <div className="flex flex-col divide-y divide-[var(--hair)]">
        { items.map( ( item, i ) => (
          <div key={ `${ title }-${ i }` } className="py-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                { iconBase && item.label && (
                  <img
                    key={ `${ getPlanetFromName( item.label ) }-${ title }-${ i }-${ activeThemeId }` }
                    src={ `${ iconBase }${ encodeURIComponent( getPlanetFromName( item.label ) ) }.svg` }
                    alt=""
                    className="w-4 h-4 opacity-70"
                    style={{ filter: astroIconFilter }}
                  />
                ) }
                <span className="text-[15px] font-medium text-[var(--ink)] leading-snug tracking-wide" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                  { item.label.replace( /[^\x00-\x7F]/g, '' ).trim() }
                </span>
              </div>
              { natalAscendant !== undefined && item.longitude !== undefined && (
                <span className="text-[11px] font-bold text-[var(--indigo)] opacity-60 bg-[var(--indigo)]/5 px-1.5 py-0.5">{ getHouseStr( item.longitude ) }</span>
              ) }
            </div>
            { item.iso && (
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--mute)] opacity-70">
                { formatIngressDate( item.iso, userTz ) }
              </span>
            ) }
            { item.detail && getIngressKind( item ) === 'hd-gate' && (
              <span className="text-[10px] text-[var(--mute)] opacity-70">{ item.detail }</span>
            ) }
          </div>
        ) ) }
      </div>
    </div>
  );
}

function AstroHDWidget( { kind, setView, natalAscendant } ) {
  const [ data, setData ] = useState( () => window.LunaCcoAstroHDDaily || null );
  const { profileData } = useUser();
  const { activeThemeId, theme } = useTheme();
  const userTz = profileData?.identity?.current_timezone || undefined;

  useEffect( () => {
    const handler = ( e ) => setData( e.detail || window.LunaCcoAstroHDDaily || null );
    window.addEventListener( 'lunacco:astrohd-daily', handler );
    return () => window.removeEventListener( 'lunacco:astrohd-daily', handler );
  }, [] );

  const meta    = ASTRO_META[ kind ];
  const loading = ! data || data.computedAt === new Date( 0 ).toISOString();
  const payload = data && data[ kind ];
  const isRetrogrades = kind === 'retrogrades';
  const isEmpty = ! payload || (
    isRetrogrades
      ? !payload.current?.length && !payload.upcoming?.length
      : Array.isArray( payload ) && payload.length === 0
  );
  const astroIconFilter = theme?.tokens?.['--astro-icon-filter'] || ( theme?.mode === 'dark' ? 'invert(1) brightness(1.6)' : 'none' );

  // Helper to get icon base path
    const getIconBase = () => {
    const modules = window.LunaCcoData?.modules || {};
    const astro = modules['luna-astrohd'] || {};
    return astro.assets?.zodiacPath || '';
  };
  const iconBase = getIconBase();

  // Helper to get clean SVG name
  const getSvgName = ( name ) => {
    if ( ! name ) return '';
    // Strip non-ASCII characters (like zodiac symbols) and spaces
    let clean = name.replace( /[^\x00-\x7F]/g, '' ).replace( /\s+/g, '' );
    if ( clean.toLowerCase() === 'lilith' ) return 'BlackMoonLilith';
    return clean;
  };

  // Helper to calculate house string
  const getHouseStr = ( longitude ) => {
    if ( natalAscendant === undefined || longitude === undefined ) return '';
    const ascLong = typeof natalAscendant === 'string' ? parseFloat( natalAscendant ) : natalAscendant;
    const ascSign = Math.floor( ( ( ( ascLong % 360 ) + 360 ) % 360 ) / 30 );
    const planetSign = Math.floor( ( ( ( longitude % 360 ) + 360 ) % 360 ) / 30 );
    const house = ( ( planetSign - ascSign + 12 ) % 12 ) + 1;
    return `H${ house }`;
  };

  // Helper to extract planet name from a label like "Moon in Aries" or "Black Moon Lilith ingress"
  const getPlanetFromName = ( label ) => {
    if ( ! label ) return '';
    const lower = label.toLowerCase();
    if ( lower.includes( 'black moon lilith' ) || lower.includes( 'lilith' ) ) return 'BlackMoonLilith';
    if ( lower.includes( 'north node' ) ) return 'NorthNode';
    if ( lower.includes( 'south node' ) ) return 'SouthNode';
    if ( lower.includes( 'sun' ) )     return 'Sun';
    if ( lower.includes( 'moon' ) )    return 'Moon';
    if ( lower.includes( 'mercury' ) ) return 'Mercury';
    if ( lower.includes( 'venus' ) )   return 'Venus';
    if ( lower.includes( 'mars' ) )    return 'Mars';
    if ( lower.includes( 'jupiter' ) ) return 'Jupiter';
    if ( lower.includes( 'saturn' ) )  return 'Saturn';
    if ( lower.includes( 'uranus' ) )  return 'Uranus';
    if ( lower.includes( 'neptune' ) ) return 'Neptune';
    if ( lower.includes( 'pluto' ) )   return 'Pluto';
    if ( lower.includes( 'chiron' ) )  return 'Chiron';
    // Clean non-ASCII and split
    return label.replace( /[^\x00-\x7F]/g, '' ).trim().split( ' ' )[ 0 ];
  };

  return (
    <div className="flex flex-col h-full gap-4" data-theme-refresh={ activeThemeId }>
      { /* Header rule */ }
      <div className="flex items-center gap-3">
        <span className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: meta.accent }}>{ meta.label }</span>
        <div className="flex-1 h-px" style={{ background: meta.accent, opacity: 0.18 }} />
      </div>

      { /* Content */ }
      <div className="flex-1">
        { loading && (
          <div className="flex items-center gap-2 opacity-40">
            <span className="text-xs text-[var(--mute)] italic">Calculating…</span>
          </div>
        ) }

        { ! loading && isEmpty && (
          <p className="text-xs text-[var(--mute)] italic opacity-60">Nothing active right now.</p>
        ) }

        { ! loading && ! isEmpty && kind === 'moon' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-3">
                { iconBase && (
                  <img key={ `Moon-${ activeThemeId }` } src={ `${ iconBase }Moon.svg` } alt="" className="w-8 h-8 opacity-90" style={{ filter: astroIconFilter }} />
                ) }
                <p className="text-4xl font-light tracking-tight text-[var(--ink)] leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                  { payload.phase }
                </p>
              </div>
              { natalAscendant !== undefined && payload.moonLongitude !== undefined && (
                <span className="text-[11px] font-bold text-[var(--indigo)] bg-[var(--indigo)]/10 px-2 py-1 border border-[var(--indigo)]/20">{ getHouseStr( payload.moonLongitude ) }</span>
              ) }
            </div>
            <div className="flex items-center gap-2">
              { iconBase && payload.sign && (
                <img key={ `${ getSvgName( payload.sign ) }-${ activeThemeId }` } src={ `${ iconBase }${ encodeURIComponent( getSvgName( payload.sign ) ) }.svg` } alt="" className="w-5 h-5 opacity-80" style={{ filter: astroIconFilter }} />
              ) }
              <p className="text-base font-medium text-[var(--ink)] opacity-70">in { getSvgName( payload.sign ) }</p>
            </div>
            { payload.note && (
              <p className="text-[11px] text-[var(--mute)] border-t border-[var(--hair)] pt-3 mt-1">
                { payload.note }
              </p>
            ) }
            { payload.nextPhases && payload.nextPhases.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--hair)] space-y-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] opacity-50">Upcoming Phases</p>
                <div className="flex flex-col gap-3">
                  { payload.nextPhases.map( ( p, i ) => (
                    <div key={ i } className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-[var(--ink)] leading-none italic" style={{ fontFamily: 'var(--font-display)' }}>{ p.label.replace( /[^\x00-\x7F]/g, '' ).trim() }</p>
                        <p className="text-[10px] text-[var(--mute)] mt-1.5 uppercase font-bold tracking-widest">{ formatIngressDate( p.date, userTz )?.split( ',' )[ 0 ] }</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        { natalAscendant !== undefined && p.longitude !== undefined && (
                          <span className="text-[10px] font-bold text-[var(--indigo)] opacity-60 bg-[var(--indigo)]/5 px-1.5 py-0.5">{ getHouseStr( p.longitude ) }</span>
                        ) }
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--paper-2)] border border-[var(--hair)]">
                          { iconBase && (
                            <img key={ `${ getSvgName( p.sign ) }-${ i }-${ activeThemeId }` } src={ `${ iconBase }${ encodeURIComponent( getSvgName( p.sign ) ) }.svg` } alt={ getSvgName( p.sign ) } className="w-3.5 h-3.5" style={{ filter: astroIconFilter }} />
                          ) }
                          <p className="text-[11px] font-bold text-[var(--gold)] uppercase tracking-tighter">{ getSvgName( p.sign ) }</p>
                        </div>
                      </div>
                    </div>
                  ) ) }
                </div>
              </div>
            ) }
          </div>
        ) }

        { ! loading && kind === 'skyNow' && Array.isArray( payload ) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-px bg-[var(--hair)] border border-[var(--hair)]">
            { payload.map( ( p, i ) => (
              <div key={ i } className="bg-[var(--card)] p-4 flex flex-col items-center justify-center text-center gap-2 group hover:bg-[var(--paper)] transition-colors">
                <div className="w-8 h-8 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                  { iconBase && p.name ? (
                    <img key={ `${ getSvgName( p.name ) }-${ activeThemeId }` } src={ `${ iconBase }${ encodeURIComponent( getSvgName( p.name ) ) }.svg` } alt={ p.name } className="w-6 h-6 object-contain" style={{ filter: astroIconFilter }} />
                  ) : (
                    <span className="text-xl text-[var(--ink)]">{ p.symbol }</span>
                  ) }
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--mute)] opacity-60">{ p.name }</span>
                <div className="flex flex-col items-center gap-1.5 mt-1">
                  <div className="flex items-center gap-1.5">
                    { iconBase && p.signSymbol && (
                      <img key={ `${ getSvgName( p.sign ) }-sky-${ i }-${ activeThemeId }` } src={ `${ iconBase }${ encodeURIComponent( getSvgName( p.sign ) ) }.svg` } alt={ getSvgName( p.sign ) } className="w-4 h-4" style={{ filter: astroIconFilter }} />
                    ) }
                    <span className="text-[10px] font-bold text-[var(--gold)] uppercase tracking-tighter opacity-80">{ getSvgName( p.sign ) }</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-light italic text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>G{ p.gate }</span>
                    { natalAscendant !== undefined && (
                      <span className="text-[10px] font-bold text-[var(--indigo)] opacity-60 bg-[var(--indigo)]/5 px-1 rounded-sm">{ getHouseStr( p.longitude ) }</span>
                    ) }
                  </div>
                </div>
              </div>
            ) ) }
          </div>
        ) }

        { ! loading && isRetrogrades && payload && (
          <div className="flex flex-col gap-4">
            { payload.current?.length > 0 && (
              <div className="flex flex-col divide-y divide-[var(--hair)]">
                <p className="pb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] opacity-50">Current</p>
                { payload.current.map( ( item, i ) => (
                  <div key={ `current-${ i }` } className="py-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        { iconBase && item.label && (
                          <img key={ `${ getPlanetFromName( item.label ) }-current-${ i }-${ activeThemeId }` } src={ `${ iconBase }${ encodeURIComponent( getPlanetFromName( item.label ) ) }.svg` } alt="" className="w-4 h-4 opacity-70" style={{ filter: astroIconFilter }} />
                        ) }
                        <span className="text-[15px] font-medium text-[var(--ink)] leading-snug tracking-wide" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                          { item.label.replace( /[^\x00-\x7F]/g, '' ).trim() }
                        </span>
                      </div>
                      { natalAscendant !== undefined && item.longitude !== undefined && (
                        <span className="text-[11px] font-bold text-[var(--indigo)] opacity-60 bg-[var(--indigo)]/5 px-1.5 py-0.5">{ getHouseStr( item.longitude ) }</span>
                      ) }
                    </div>
                    { item.detail && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--mute)] opacity-70">
                        { item.detail }
                      </span>
                    ) }
                    { item.endIso && (
                      <span className="text-[10px] text-[var(--gold)] opacity-80">Ends { formatRetroDate( item.endIso, userTz ) }</span>
                    ) }
                  </div>
                ) ) }
              </div>
            ) }

            { payload.upcoming?.length > 0 && (
              <div className="pt-4 border-t border-[var(--hair)] flex flex-col divide-y divide-[var(--hair)]">
                <p className="pb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] opacity-50">Next 3 Months</p>
                { payload.upcoming.slice( 0, 5 ).map( ( item, i ) => (
                  <div key={ `upcoming-${ i }` } className="py-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        { iconBase && item.label && (
                          <img key={ `${ getPlanetFromName( item.label ) }-upcoming-${ i }-${ activeThemeId }` } src={ `${ iconBase }${ encodeURIComponent( getPlanetFromName( item.label ) ) }.svg` } alt="" className="w-4 h-4 opacity-70" style={{ filter: astroIconFilter }} />
                        ) }
                        <span className="text-[15px] font-medium text-[var(--ink)] leading-snug tracking-wide" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                          { item.label.replace( /[^\x00-\x7F]/g, '' ).trim() }
                        </span>
                      </div>
                      { natalAscendant !== undefined && item.longitude !== undefined && item.longitude !== 0 && (
                        <span className="text-[11px] font-bold text-[var(--indigo)] opacity-60 bg-[var(--indigo)]/5 px-1.5 py-0.5">{ getHouseStr( item.longitude ) }</span>
                      ) }
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--mute)] opacity-70">
                      Starts { formatRetroDate( item.startIso, userTz ) }
                      { item.endIso ? ` · Ends ${ formatRetroDate( item.endIso, userTz ) }` : '' }
                    </span>
                    { item.detail && (
                      <span className="text-[10px] text-[var(--mute)] opacity-70">{ item.detail }</span>
                    ) }
                  </div>
                ) ) }
              </div>
            ) }
          </div>
        ) }

        { ! loading && Array.isArray( payload ) && payload.length > 0 && kind !== 'skyNow' && ! isRetrogrades && (
          kind === 'ingresses' ? (
            <div className="flex flex-col gap-5">
              <AstroIngressList
                title="Astrology"
                items={ payload.filter( item => getIngressKind( item ) === 'astrology' ).slice( 0, 6 ) }
                iconBase={ iconBase }
                activeThemeId={ activeThemeId }
                astroIconFilter={ astroIconFilter }
                natalAscendant={ natalAscendant }
                getHouseStr={ getHouseStr }
                getPlanetFromName={ getPlanetFromName }
                userTz={ userTz }
              />
              <AstroIngressList
                title="HD Gates"
                items={ payload.filter( item => getIngressKind( item ) === 'hd-gate' ).slice( 0, 6 ) }
                iconBase={ iconBase }
                activeThemeId={ activeThemeId }
                astroIconFilter={ astroIconFilter }
                natalAscendant={ natalAscendant }
                getHouseStr={ getHouseStr }
                getPlanetFromName={ getPlanetFromName }
                userTz={ userTz }
              />
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--hair)]">
              { payload.slice( 0, 5 ).map( ( item, i ) => (
                <div key={ i } className="py-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       { iconBase && item.label && (
                         <img key={ `${ getPlanetFromName( item.label ) }-${ i }-${ activeThemeId }` } src={ `${ iconBase }${ encodeURIComponent( getPlanetFromName( item.label ) ) }.svg` } alt="" className="w-4 h-4 opacity-70" style={{ filter: astroIconFilter }} />
                       ) }
                      <span className="text-[15px] font-medium text-[var(--ink)] leading-snug tracking-wide" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                        { item.label.replace( /[^\x00-\x7F]/g, '' ).trim() }
                      </span>
                    </div>
                    { natalAscendant !== undefined && item.longitude !== undefined && (
                      <span className="text-[11px] font-bold text-[var(--indigo)] opacity-60 bg-[var(--indigo)]/5 px-1.5 py-0.5">{ getHouseStr( item.longitude ) }</span>
                    ) }
                  </div>
                  { item.detail && (
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--mute)] opacity-70">
                      { item.detail }
                    </span>
                  ) }
                </div>
              ) ) }
            </div>
          )
        ) }
      </div>

      { /* Footer link */ }
      <button
        onClick={ () => setView( kind === 'moon' ? 'astrohd-snapshot' : kind === 'skyNow' ? 'astrohd-natal' : 'astrohd-transit' ) }
        className="text-[9px] font-black uppercase tracking-[0.2em] hover:opacity-60 transition-opacity self-start"
        style={{ color: meta.accent }}
      >
        Explore →
      </button>
    </div>
  );
}

// ------------------------------------------------------------------
// TarotWidget — shows daily card using window.LunaCcoDailyCard
// ------------------------------------------------------------------
function TarotWidget( { setView } ) {
  const [ dailyCard,   setDailyCard   ] = useState( () => window.LunaCcoDailyCard || null );
  const [ zoomedImage, setZoomedImage ] = useState( null );

  useEffect( () => {
    const handler = ( e ) => setDailyCard( e.detail );
    window.addEventListener( 'lunacco:dailycard', handler );
    if ( window.LunaCcoDailyCard ) setDailyCard( window.LunaCcoDailyCard );
    return () => window.removeEventListener( 'lunacco:dailycard', handler );
  }, [] );

  return (
    <div className="flex flex-col gap-6 h-full">
      { /* Zoomed card lightbox */ }
      { zoomedImage && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/95 p-8 cursor-zoom-out"
          onClick={ () => setZoomedImage( null ) }
          onContextMenu={ preventCtxMenu }
        >
          <img
            src={ zoomedImage.src }
            alt={ zoomedImage.alt }
            className={ `max-w-full max-h-full object-contain drop-shadow-[0_0_40px_rgba(255,255,255,0.2)] ${ zoomedImage.isReversed ? 'rotate-180' : '' }` }
          />
        </div>
      ) }

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star size={ 15 } className="text-[var(--indigo)]" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--mute)]">Card of the Day</h3>
        </div>
        <button
          onClick={ () => setView( 'pick' ) }
          className="text-[9px] font-bold uppercase tracking-widest text-[var(--indigo)] hover:text-[var(--indigo-2)] flex items-center gap-1 transition-colors"
        >
          Pick Cards <ArrowRight size={ 10 } />
        </button>
      </div>

      { dailyCard ? (
        <div className="flex-1 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          { /* Card image — click to zoom */ }
          <div
            className="shrink-0 w-32 sm:w-40 bg-[var(--card)] border border-[var(--hair)] shadow-xl overflow-hidden cursor-zoom-in group"
            onContextMenu={ preventCtxMenu }
            onClick={ () => {
              if ( dailyCard.card.image?.startsWith( 'http' ) ) {
                setZoomedImage( { src: dailyCard.card.image, alt: dailyCard.card.name, isReversed: dailyCard.isReversed } );
              }
            } }
            style={{ borderRadius: 'var(--radius-card, 0px)' }}
          >
            { dailyCard.card.image?.startsWith( 'http' ) ? (
              <img
                src={ dailyCard.card.image }
                alt={ dailyCard.card.name }
                className={ `w-full h-auto block transition-transform group-hover:scale-105 duration-500 ${ dailyCard.isReversed ? 'rotate-180' : '' }` }
              />
            ) : (
              <div className={ `aspect-[2/3] flex items-center justify-center text-4xl bg-[var(--indigo)]/10 ${ dailyCard.isReversed ? 'rotate-180' : '' }` }>
                { dailyCard.card.image || '🃏' }
              </div>
            ) }
          </div>

          { /* Card info */ }
          <div className="flex-1 text-center sm:text-left min-w-0">
            <p className="text-2xl sm:text-3xl font-light italic tracking-wide text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>
              { dailyCard.card.name }
              { dailyCard.isReversed && <span className="text-[var(--gold)] text-[10px] ml-3 font-bold uppercase tracking-widest leading-none">(Reversed)</span> }
            </p>
            <p className="text-[var(--mute)] text-[10px] font-bold uppercase tracking-[0.2em] mb-4 opacity-60">{ dailyCard.deck.name }</p>
            <div className="text-[13px] text-[var(--ink)] opacity-70 leading-relaxed line-clamp-6 prose-invert max-w-none">
              { dailyCard.isReversed ? ( dailyCard.card.reverse || '' ) : ( dailyCard.card.meaning || '' ) }
            </div>
            <button 
              onClick={() => setView('pick')}
              className="mt-6 text-[10px] font-bold uppercase tracking-widest text-[var(--indigo)] border-b border-[var(--indigo)]/30 hover:border-[var(--indigo)] transition-all pb-0.5"
            >
              Read full card meaning →
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8 bg-[var(--indigo)]/[0.03] border border-dashed border-[var(--indigo)]/20" style={{ borderRadius: 'var(--radius-card, 0px)' }}>
          <div className="w-12 h-16 bg-[var(--indigo)]/10 border border-[var(--indigo)]/20 flex items-center justify-center">
            <Star size={ 20 } className="text-[var(--indigo)] opacity-30" />
          </div>
          <p className="text-[10px] text-[var(--mute)] uppercase tracking-widest">No card selected today</p>
          <button
            onClick={ () => setView( 'pick' ) }
            className="px-6 py-2 bg-[var(--indigo)] text-[var(--btn-fg)] text-[10px] font-bold uppercase tracking-widest transition-all hover:opacity-90"
          >
            Pull Today's Card
          </button>
        </div>
      ) }
    </div>
  );
}

// ------------------------------------------------------------------
// CyclesCalendarWidget — personal birth-year month calendar
// ------------------------------------------------------------------
const CAL_DOW = [ 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa' ];

function CyclesCalendarWidget( { setView, birthdate, fullName, knownName } ) {
  const [ offset, setOffset ] = useState( 0 ); // personal-month offset from current

  // Run cycles calculator
  const cyclesResult = useMemo( () => {
    const calc = window.LunaCcoNumerologyCalc?.calculatePythagoreanCycles;
    if ( !calc || !birthdate || !fullName ) return null;
    const res = calc( birthdate, fullName, knownName || '' );
    return res.error ? null : res;
  }, [ birthdate, fullName, knownName ] );

  // Build calendar data for the selected personal month
  const calMonth = useMemo( () => {
    const build = window.LunaCcoNumerologyCalc?.buildCalendarData;
    if ( !build || !cyclesResult ) return null;
    const currentIdx = cyclesResult.personalMonths.findIndex( m => m.isCurrent );
    const base = Math.max( 0, Math.min( ( currentIdx >= 0 ? currentIdx : 0 ) + offset, 11 ) );
    const months = build( cyclesResult, 1, base );
    return months[ 0 ] || null;
  }, [ cyclesResult, offset ] );

  const today   = new Date();
  const todayTs = new Date( today.getFullYear(), today.getMonth(), today.getDate() ).getTime();

  if ( !birthdate || !fullName ) {
    return (
      <div className="flex flex-col gap-4 h-full">
        <div className="flex items-center gap-2">
          <Calendar size={ 15 } className="text-[var(--indigo)]" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--mute)]">Cycles Calendar</h3>
        </div>
        <p className="text-[10px] text-[var(--mute)] italic mt-2 opacity-60">
          { !birthdate ? 'Add birthdate' : 'Add full name' } to profile to see your personal calendar.
        </p>
      </div>
    );
  }

  if ( !calMonth ) return null;

  const cycleIdx   = Math.floor( ( calMonth.number - 1 ) / 4 );
  const accent     = 'var(--indigo)';
  const startDow   = calMonth.days[ 0 ]?.dayOfWeek ?? 0;
  const fmtDs      = window.LunaCcoNumerologyCalc?.fmtDateShort;

  // Peak/action timestamps for this month
  const peakTs = new Date( calMonth.peak.year, calMonth.peak.month - 1, calMonth.peak.day ).getTime();
  const act1Ts = new Date( calMonth.act1.year, calMonth.act1.month - 1, calMonth.act1.day ).getTime();
  const act2Ts = new Date( calMonth.act2.year, calMonth.act2.month - 1, calMonth.act2.day ).getTime();

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={ 15 } className="text-[var(--indigo)]" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--mute)]">Cycles Calendar</h3>
        </div>
        <button onClick={ () => setView( 'calendar' ) }
          className="text-[9px] font-bold uppercase tracking-widest text-[var(--indigo)] hover:text-[var(--indigo-2)] flex items-center gap-1 transition-colors">
          View Full <ArrowRight size={ 10 } />
        </button>
      </div>

      { /* Month nav */ }
      <div className="flex items-center justify-between bg-[var(--paper-2)] p-2" style={{ borderRadius: 'var(--radius-card, 0px)' }}>
        <button onClick={ () => setOffset( o => o - 1 ) } disabled={ offset <= -( cyclesResult?.personalMonths?.findIndex( m => m.isCurrent ) ?? 0 ) }
          className="p-1 text-[var(--mute)] hover:text-[var(--ink)] disabled:opacity-10 transition-colors"><ChevronLeft size={ 16 } /></button>
        <div className="text-center">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--ink)]">
            { ( () => {
              if ( !fmtDs ) return `Month ${ calMonth.number }`;
              const lastDay = new Date( calMonth.endDate.getTime() - 86400000 );
              const endObj  = { year: lastDay.getFullYear(), month: lastDay.getMonth() + 1, day: lastDay.getDate() };
              return `Month ${ calMonth.number } · ${ fmtDs( calMonth.start ) } – ${ fmtDs( endObj ) }`;
            } )() }
          </div>
          <div className="text-[10px] mt-0.5 opacity-60 font-bold uppercase tracking-tighter text-[var(--indigo)]">
            Personal Month { calMonth.value } · Cycle { cycleIdx + 1 }
          </div>
        </div>
        <button onClick={ () => setOffset( o => o + 1 ) } disabled={ offset >= 11 - ( cyclesResult?.personalMonths?.findIndex( m => m.isCurrent ) ?? 0 ) }
          className="p-1 text-[var(--mute)] hover:text-[var(--ink)] disabled:opacity-10 transition-colors"><ChevronRight size={ 16 } /></button>
      </div>

      { /* Legend */ }
      <div className="flex gap-4 px-1">
        <span className="text-[8px] font-bold uppercase tracking-widest text-[var(--gold)]">★ Peak</span>
        <span className="text-[8px] font-bold uppercase tracking-widest text-[var(--indigo)]">⚡ Action</span>
        <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-500 opacity-80">● Today</span>
      </div>

      { /* DOW headers */ }
      <div style={ { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' } }>
        { CAL_DOW.map( d => (
          <div key={ d } className="text-[8px] font-bold uppercase text-[var(--mute)] text-center opacity-40">{ d }</div>
        ) ) }
      </div>

      { /* Day cells */ }
      <div style={ { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', flex: 1 } }>
        { Array.from( { length: startDow } ).map( ( _, i ) => <div key={ `b${ i }` } style={ { aspectRatio: '1' } } /> ) }
        { calMonth.days.map( ( day, i ) => {
          const ts      = new Date( day.year, day.month - 1, day.day ).getTime();
          const isToday = ts === todayTs;
          const isPeak  = ts === peakTs;
          const isAct   = ts === act1Ts || ts === act2Ts;

          const bg = isToday ? 'rgba(16,185,129,0.1)'
            : isPeak  ? 'color-mix(in srgb, var(--gold-2), transparent 85%)'
            : isAct   ? 'color-mix(in srgb, var(--indigo-2), transparent 85%)'
            : 'var(--paper-2)';
          const border = isToday ? '1px solid rgba(16,185,129,0.3)'
            : isPeak  ? '1px solid color-mix(in srgb, var(--gold), transparent 60%)'
            : isAct   ? '1px solid color-mix(in srgb, var(--indigo), transparent 60%)'
            : '1px solid var(--hair)';
          const numColor = isToday ? '#10b981' : isPeak ? 'var(--gold)' : isAct ? 'var(--indigo)' : 'var(--mute)';

          return (
            <div key={ i } style={ { background: bg, border, borderRadius: 'var(--radius-card, 0px)', aspectRatio: '1', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
              <span style={ { position: 'absolute', top: '2px', left: '3px', fontSize: '8px', fontWeight: 'bold', color: isToday ? '#10b981' : 'var(--mute)', opacity: isToday ? 0.8 : 0.3, lineHeight: 1 } }>{ day.day }</span>
              <span style={ { fontSize: '0.9rem', fontWeight: 300, color: numColor, lineHeight: 1, fontFamily: 'var(--font-display)', fontStyle: 'italic' } }>{ day.personalDay }</span>
              { isPeak  && <span style={ { position: 'absolute', bottom: '1px', right: '2px', fontSize: '7px', color: 'var(--gold)' } }>★</span> }
              { isAct   && <span style={ { position: 'absolute', bottom: '1px', right: '2px', fontSize: '7px', color: 'var(--indigo)' } }>⚡</span> }
              { isToday && <span style={ { position: 'absolute', bottom: '1px', right: '2px', fontSize: '7px', color: '#10b981' } }>●</span> }
            </div>
          );
        } ) }
      </div>
    </div>
  );
}

// ==================================================================
// Editorial almanac sections (the "Broadsheet" EditorialDashboard kit)
// ==================================================================

function dashIconBase() {
  const modules = window.LunaCcoData?.modules || {};
  return modules['luna-astrohd']?.assets?.zodiacPath || '';
}
function dashSvgName( name ) {
  if ( ! name ) return '';
  const clean = String( name ).replace( /[^\x00-\x7F]/g, '' ).replace( /\s+/g, '' );
  return clean.toLowerCase() === 'lilith' ? 'BlackMoonLilith' : clean;
}

// Tarot of the Day — full-width editorial strip (card · reading · pull a spread).
function EpgTarot( { setView } ) {
  const [ dailyCard, setDailyCard ] = useState( () => window.LunaCcoDailyCard || null );
  const [ zoomed, setZoomed ] = useState( false );
  useEffect( () => {
    const h = ( e ) => setDailyCard( e.detail );
    window.addEventListener( 'lunacco:dailycard', h );
    if ( window.LunaCcoDailyCard ) setDailyCard( window.LunaCcoDailyCard );
    return () => window.removeEventListener( 'lunacco:dailycard', h );
  }, [] );
  if ( ! dailyCard?.card ) return null;
  const c = dailyCard.card;
  const hasImg = c.image?.startsWith( 'http' );
  return (
    <div className="epg-tarot" style={{ marginTop: 0 }}>
      { zoomed && hasImg && (
        <div onClick={ () => setZoomed( false ) }
          style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.95)', padding: 32, cursor: 'zoom-out' }}>
          <img src={ c.image } alt={ c.name }
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transform: dailyCard.isReversed ? 'rotate(180deg)' : 'none', filter: 'drop-shadow(0 0 40px rgba(255,255,255,0.2))' }} />
        </div>
      ) }
      <div className="card-col">
        <div className="card-img" onClick={ () => hasImg && setZoomed( true ) }>
          { hasImg
            ? <img src={ c.image } alt={ c.name } style={{ width: '100%', height: '100%', objectFit: 'cover', transform: dailyCard.isReversed ? 'rotate(180deg)' : 'none' }} />
            : <><div className="ci-g">★</div><div className="ci-n">{ c.name }</div></> }
        </div>
      </div>
      <div className="vr" />
      <div className="body-col">
        <div className="tc-kicker">
          <span className="eyebrow coral">Card of the Day</span>
          { dailyCard.deck?.name && <span className="deck">{ dailyCard.deck.name }</span> }
        </div>
        <div className="tc-name">{ c.name }{ dailyCard.isReversed && <span className="rx">Reversed</span> }</div>
        <div className="tc-body">{ dailyCard.isReversed ? ( c.reverse || '' ) : ( c.meaning || '' ) }</div>
        <a className="tc-more" style={{ cursor: 'pointer' }} onClick={ () => setView( 'pick' ) }>Pull Your Own Card →</a>
      </div>
      <div className="vr" />
      <div className="pick-col">
        <div className="ph">Pull a spread</div>
        { ( () => {
          const deckId = dailyCard?.deck?.id || '';
          const openSpread = ( spreadId ) => {
            // Publish intent globally — TarotApp reads this on mount before canAccessView issues
            window.LunaCcoTarotPreselect = { spreadId, deckId };
            window.dispatchEvent( new CustomEvent( 'lunacco:tarot-preselect', { detail: { spreadId, deckId } } ) );
            setView( 'reading' );
          };
          // Featured spreads first; fall back to raw spreads list
          const featuredSpreads = getFeaturedItems( window.LunaCcoData?.featured || null )
            .filter( i => i.kind === 'spread' )
            .slice( 0, 3 );
          if ( featuredSpreads.length ) {
            return featuredSpreads.map( ( sp, i ) => (
              <button key={ sp.id } className={ 'pick-btn' + ( i === 0 ? ' active' : '' ) }
                onClick={ () => openSpread( sp.param ) }>
                { sp.label }
              </button>
            ) );
          }
          // Fallback: first 3 raw spreads
          const rawSpreads = ( window.LunaCcoTarotSpreads?.spreads || [] ).slice( 0, 3 );
          if ( !rawSpreads.length ) {
            return <button className="pick-btn active" onClick={ () => setView( 'pick' ) }>Daily Card</button>;
          }
          return rawSpreads.map( ( sp, i ) => (
            <button key={ sp.id } className={ 'pick-btn' + ( i === 0 ? ' active' : '' ) }
              onClick={ () => openSpread( sp.id ) }>
              { sp.name }
            </button>
          ) );
        } )() }
      </div>
    </div>
  );
}

// Personal-year banner — four numerology cells (Year · Month · Day · Cycle).
function EpgPersonalYear( { profileData, userContext } ) {
  const collective = useMemo( () => getCollectiveNumbers(), [] );
  const birthdate = profileData?.identity?.birthdate || userContext?.numerology_profile_chart?.input_data?.birthdate || '';
  const fullName  = profileData?.identity?.full_name  || userContext?.numerology_profile_chart?.input_data?.name || '';
  const knownName = profileData?.identity?.nickname || '';
  const cycles = useMemo( () => {
    const calc = window.LunaCcoNumerologyCalc?.calculatePythagoreanCycles;
    if ( ! calc || ! birthdate || ! fullName ) return null;
    const res = calc( birthdate, fullName, knownName );
    return res?.error ? null : res;
  }, [ birthdate, fullName, knownName ] );
  if ( ! cycles ) return null;
  const today = new Date();
  const currentMonth = cycles.personalMonths?.find( m => m.isCurrent );
  const currentCycle = cycles.cycles?.find( c => today >= c.startDate && today < c.endDate );
  const yearVal = cycles.yearRaw !== cycles.yearValue ? `${ cycles.yearRaw }/${ cycles.yearValue }`
    : ( cycles.yearRaw > 9 ? `${ cycles.yearRaw }/${ cycles.yearForCalc }` : cycles.yearValue );
  const cells = [
    [ 'Personal Year', yearVal ],
    [ 'Personal Month', currentMonth?.value ?? '—' ],
    [ 'Personal Day', cycles.todayPersonalDay ?? '—' ],
    currentCycle ? [ `Cycle ${ currentCycle.number }`, currentCycle.value ] : [ 'Universal Day', collective.universalDay ],
  ];
  return (
    <div className="epg-py-row" style={{ marginTop: 20 }}>
      { cells.map( ( [ k, v ] ) => (
        <div className="epg-py-cell" key={ k }>
          <div className="pk">{ k }</div>
          <div className="pv">{ v }</div>
        </div>
      ) ) }
    </div>
  );
}

// The Sky Today — editorial sky table from LunaCcoAstroHDDaily.skyNow.
function EpgSkyTable( { natalAscendant } ) {
  const [ data, setData ] = useState( () => window.LunaCcoAstroHDDaily || null );
  const { activeThemeId, theme } = useTheme();
  useEffect( () => {
    const h = ( e ) => setData( e.detail || window.LunaCcoAstroHDDaily || null );
    window.addEventListener( 'lunacco:astrohd-daily', h );
    return () => window.removeEventListener( 'lunacco:astrohd-daily', h );
  }, [] );
  const sky = data?.skyNow;
  if ( ! Array.isArray( sky ) || ! sky.length ) return null;
  const iconBase = dashIconBase();
  const filter = theme?.tokens?.['--astro-icon-filter'] || ( theme?.mode === 'dark' ? 'invert(1) brightness(1.6)' : 'none' );
  const deg = ( lon ) => { const i = ( ( ( lon % 30 ) + 30 ) % 30 ); const d = Math.floor( i ); const m = Math.floor( ( i - d ) * 60 ); return `${ d }°${ String( m ).padStart( 2, '0' ) }'`; };
  const houseStr = ( lon ) => {
    if ( natalAscendant === undefined || natalAscendant === null || lon === undefined ) return '';
    const asc = typeof natalAscendant === 'string' ? parseFloat( natalAscendant ) : natalAscendant;
    const a = Math.floor( ( ( ( asc % 360 ) + 360 ) % 360 ) / 30 ), p = Math.floor( ( ( ( lon % 360 ) + 360 ) % 360 ) / 30 );
    return `H${ ( ( p - a + 12 ) % 12 ) + 1 }`;
  };
  const renderTable = ( rows ) => (
    <div className="sky-table">
      <div className="sth"><span /><span>Body</span><span>Sign</span><span>Degree</span><span>House</span><span>Gate·Line</span></div>
      { rows.map( ( p, i ) => (
        <div className="str" key={ i }>
          <span className="sg2">{ iconBase && p.name
            ? <img src={ `${ iconBase }${ encodeURIComponent( dashSvgName( p.name ) ) }.svg` } alt={ p.name } style={{ width: 16, height: 16, filter }} />
            : ( p.symbol || p.name?.[0] ) }</span>
          <span className="bd2">{ p.name }</span>
          <span className="sn2" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            { iconBase && p.sign && <img src={ `${ iconBase }${ encodeURIComponent( dashSvgName( p.sign ) ) }.svg` } alt="" style={{ width: 14, height: 14, filter }} /> }
            { p.sign }
          </span>
          <span className="dg2">{ p.longitude !== undefined ? deg( p.longitude ) : '' }</span>
          <span className="h2">{ houseStr( p.longitude ) }</span>
          <span className="gt2">{ p.gate ? `${ p.gate }${ p.line ? '.' + p.line : '' }` : '' }</span>
        </div>
      ) ) }
    </div>
  );
  const half = Math.ceil( sky.length / 2 );
  return (
    <div data-theme-refresh={ activeThemeId }>
      <div className="epg-sky-h"><div><span className="eyebrow">The Sky Today</span></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        { renderTable( sky.slice( 0, half ) ) }
        { renderTable( sky.slice( half ) ) }
      </div>
    </div>
  );
}

const MODULE_TC = { 'luna-numerology': 'num', 'luna-astrohd': 'ahd', 'lunacco-eastern': 'eas', 'luna-tarot': 'ast' };
const MODULE_TAG = { 'luna-numerology': 'NUM', 'luna-astrohd': 'AHD', 'lunacco-eastern': 'EAS', 'luna-tarot': 'TAROT' };
const LEVEL_DOT_COLOR = { beginner: 'var(--level-beginner)', intermediate: 'var(--level-intermediate)', advanced: 'var(--level-advanced)' };

// Chart spotlights — curated featured items from cross-module registry.
function EpgSpots( { setView } ) {
  const storedFeatured = window.LunaCcoData?.featured || null;
  const spots = useMemo( () => getFeaturedItems( storedFeatured ).slice( 0, 6 ), [ storedFeatured ] );

  if ( ! spots.length ) return null;

  return (
    <div className="epg-spots">
      <div className="epg-spots-head"><span className="rn">—</span><span className="ti">Featured</span></div>
      <div className="epg-spots-grid">
        { spots.map( ( s ) => {
          const tc = MODULE_TC[ s.moduleId ] || 'num';
          const tag = MODULE_TAG[ s.moduleId ] || 'CHART';
          return (
            <button key={ `${ s.moduleId }-${ s.id }` } className="epg-spot" style={{ textAlign: 'left', cursor: 'pointer' }}
              onClick={ () => setView( s.viewKey, s.param ) }>
              <div className="sp-sys">
                <span className={ `sp-tag ${ tc }` }>{ tag }</span>
                { s.kind === 'spread' && <span className="sp-tag ast" style={{ fontSize: 8 }}>SPREAD</span> }
              </div>
              <div className="sp-nm">
                { s.level && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: LEVEL_DOT_COLOR[ s.level ] || 'var(--mute)', marginRight: 5, verticalAlign: 'middle', opacity: 0.8 }} /> }
                { s.label }
              </div>
              <div className="sp-open">Open <span aria-hidden>→</span></div>
            </button>
          );
        } ) }
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// CoreDashboardView
// ------------------------------------------------------------------
export default function CoreDashboardView( { setView } ) {
  const { isLoggedIn, openLoginModal } = useAuth();
  const { userContext, profileData } = useUser();
  const { modules } = useModuleRegistry();
  const { appHeaderTitle, signupPromoText } = useAppConfig();
  const { activeThemeId } = useTheme();

  const today = new Date().toLocaleDateString( undefined, { weekday: 'long', month: 'long', day: 'numeric' } );

  const hasTarot      = modules.some( m => m.id === 'luna-tarot' );
  const hasNumerology = modules.some( m => m.id === 'luna-numerology' );
  const hasAstroHD    = modules.some( m => m.id === 'luna-astrohd' );


  const welcomeName = (() => {
    const nickname = (profileData?.identity?.nickname || '').trim();
    if (nickname) return nickname.split(' ')[0];
    const fullName = (profileData?.identity?.full_name || '').trim();
    if (fullName) return fullName.split(' ')[0];
    if (userContext?.display_name) return userContext.display_name.split(' ')[0];
    return '';
  })();

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[var(--paper)]">
      <div className="w-full max-w-6xl mx-auto px-8 py-12 flex flex-col gap-12">

        { /* Editorial nameplate masthead */ }
        <div>
          <div className="epg-np">
            <div className="np-l">{ today }</div>
            <div className="np-c">{ appHeaderTitle || 'LunaCco Oracle' }</div>
            <div className="np-r">{ isLoggedIn ? 'Member Edition' : 'Daily Edition' }</div>
          </div>
          <div className="epg-welcome">
            <h1>
              { isLoggedIn
                ? <>Welcome back{ welcomeName ? <em>, { welcomeName }</em> : '' }</>
                : 'Your daily reading' }
            </h1>
            { isLoggedIn && profileData?.birthdate && (
              <span className="birth">Born { profileData.birthdate }</span>
            ) }
          </div>
        </div>

        { /* Profile setup prompt — disappears once birthdate is saved */ }
        { isLoggedIn && <ProfileSetupCard setView={ setView } /> }

        { /* Module widgets */ }
        <div className="grid grid-cols-1 gap-8">
          { hasTarot && (
            window.LunaCcoDailyCard
              ? <EpgTarot setView={ setView } />
              : <div className="bg-[var(--card)] border border-[var(--hair)] p-8 shadow-sm" style={{ borderRadius: 'var(--radius-card, 0px)' }}><TarotWidget setView={ setView } /></div>
          ) }

          { isLoggedIn ? (
            <>
              { hasNumerology && (
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--mute)] opacity-50 whitespace-nowrap">Your Numbers Today</p>
                    <div className="h-px bg-[var(--hair)] flex-1" />
                  </div>
                  <EpgPersonalYear profileData={ profileData } userContext={ userContext } />
                </div>
              ) }

              { hasAstroHD && (
                <div className="space-y-8">
                  <div>
                    { /* Section label */ }
                    <div className="flex items-center gap-4 mb-6">
                      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--mute)] opacity-50 whitespace-nowrap">Today · The Sky</p>
                      <div className="h-px bg-[var(--hair)] flex-1" />
                    </div>
                    { /* Editorial almanac three-column row: Moon · Ingresses · Retrogrades + Stelliums */ }
                    {( () => {
                      const asc = profileData?.astrology?.ascendant_longitude || userContext?.astrohd_profile_chart?.data?.angles?.ascendant;
                      return (
                        <div className="epg-row1" style={{ marginTop: 0 }}>
                          <div className="epg-col">
                            <AstroHDWidget key={ `moon-${ activeThemeId }` } kind="moon" setView={ setView } natalAscendant={ asc } />
                          </div>
                          <div className="vr" />
                          <div className="epg-col">
                            <AstroHDWidget key={ `ingresses-${ activeThemeId }` } kind="ingresses" setView={ setView } natalAscendant={ asc } />
                          </div>
                          <div className="vr" />
                          <div className="epg-col" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <AstroHDWidget key={ `retrogrades-${ activeThemeId }` } kind="retrogrades" setView={ setView } natalAscendant={ asc } />
                            <AstroHDWidget key={ `stelliums-${ activeThemeId }` } kind="stelliums" setView={ setView } natalAscendant={ asc } />
                          </div>
                        </div>
                      );
                    } )()}
                  </div>

                  { /* The Sky Today — editorial sky table */ }
                  <EpgSkyTable natalAscendant={ profileData?.astrology?.ascendant_longitude || userContext?.astrohd_profile_chart?.data?.angles?.ascendant } />
                </div>
              ) }

              { /* Chart spotlights */ }
              <EpgSpots setView={ setView } />
            </>
          ) : (
            <div className="bg-[var(--card)] border border-[var(--hair)] p-12 text-center" style={{ borderRadius: 'var(--radius-card, 0px)' }}>
              { signupPromoText && (
                <div
                  style={{
                    padding: '16px',
                    border: '1px solid var(--gold)',
                    background: 'color-mix(in srgb, var(--gold) 5%, transparent)',
                    color: 'var(--gold)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '.08em',
                    textAlign: 'center',
                    marginBottom: '24px',
                    fontFamily: 'var(--font-mono, monospace)',
                    maxWidth: '480px',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                  }}
                >
                  { signupPromoText }
                </div>
              ) }
              <p className="text-[var(--ink)] opacity-60 text-base mb-8 max-w-md mx-auto">Sign in to see your personal numbers, calculate detailed natal charts, and save your readings to your journal.</p>
              <button
                onClick={ openLoginModal }
                className="px-10 py-3 bg-[var(--indigo)] hover:opacity-90 text-[var(--btn-fg)] text-xs font-bold uppercase tracking-[0.2em] transition-all"
              >
                Sign In to Your Account
              </button>
            </div>
          ) }
        </div>

      </div>
      <AppFooter view="dashboard" />
    </div>
  );
}
