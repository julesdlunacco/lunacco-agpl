/**
 * CoreChartsView — unified chart shell for all LunaCco modules.
 *
 * Layout: left sidebar (type selector + form) | center canvas | right panel (interpretation + save)
 * Mobile: stacked single-column with type dropdown.
 *
 * Chart types and rendering components are supplied by each module via window globals:
 *   window.LunaCcoNumerologyModule  — numerology types, calculations, chart components, context
 *   window.LunaCcoAstroHDCharts     — astrohd chart types, AstroHDPanel, AstroHDCenterPane
 *
 * This file contains only shell/layout code. All numerology-specific rendering
 * is accessed through window.LunaCcoNumerologyModule.components.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  BarChart3, Star, Users, User, Briefcase, Calendar, Hash, Grid3x3, Type,
  Download, ChevronLeft, ChevronRight, Sparkles, CheckCircle, Lock, CreditCard, BookOpen,
  Search, Plus, ChevronDown, X, Monitor,
} from 'lucide-react';
import AppFooter from './AppFooter.jsx';

// ─── Desktop-recommended banner (shown on mobile chart pages) ──────────────────
function MobileDesktopBanner() {
  return (
    <div
      className="mx-4 mt-4 flex items-start gap-3 bg-[var(--indigo)]/[0.07] border border-[var(--indigo)]/25 p-3.5"
      style={{ borderRadius: 'var(--radius-card,0px)' }}
      role="note"
    >
      <Monitor size={ 16 } className="text-[var(--indigo)] shrink-0 mt-0.5" />
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--ink)] mb-1">Best viewed on a larger screen</p>
        <p className="text-[11px] text-[var(--ink)]/60 leading-relaxed">
          The charts are built for desktop, laptop, or a wide tablet for now. You can still use this page on
          mobile, but a dedicated mobile experience is coming in a future update.
        </p>
      </div>
    </div>
  );
}

// ─── Constants derived from module globals ─────────────────────────────────────

function getNumerologyTypes() {
  const all   = window.LunaCcoNumerologyModule?.CHART_TYPES || [];
  const cfgs  = window.LunaCcoNumerologyModule?._chartSettings || {};
  return all.filter( t => { const c = cfgs[ t.id ]; return c ? c.enabled : true; } );
}

function getAHDTypes() { return window.LunaCcoAstroHDCharts?.CHART_TYPES || []; }
function getEasternTypes() { return window.LunaCcoEasternCharts?.CHART_TYPES || []; }

// Maps an AstroHD preset chart's `chart_type` onto the bare settings key used by
// the server credit gate / chart-display-settings option.
const AHD_BASE_TYPE_MAP = {
  bodygraph: 'natal', human_design: 'natal', natal: 'natal',
  shadow: 'shadow', shadow_chart: 'shadow',
  astrology: 'wheel', wheel: 'wheel',
  dual_wheel: 'dual_wheel', dual_astrology: 'dual_wheel',
  combined: 'combined', transit: 'transit', transit_birth: 'transit_birth',
  connection: 'connection', asteroids: 'asteroids',
};

function getAHDSettingsMap() {
  return window.LunaCcoData?.modules?.[ 'luna-astrohd' ]?.chartDisplaySettings || {};
}

// Resolve the display/credit settings for a single AstroHD chart type.
// Preset (chart-maker) charts carry their OWN premium config on the definition-engine
// preset (is_premium / credit_cost / admin_only); built-in charts use chart settings.
function ahdCfgFor( type, ahdSettings ) {
  const id = type?.id || '';
  if ( id.startsWith( 'ahd_preset_' ) && type?.coreChartPreset ) {
    const c = type.coreChartPreset.config || type.coreChartPreset || {};
    return {
      enabled:     c.enabled !== false,
      admin_only:  !!c.admin_only,
      is_premium:  !!c.is_premium,
      credit_cost: Number( c.credit_cost || 0 ),
    };
  }
  const baseKey = id.replace( /^ahd_/, '' );
  return ahdSettings[ baseKey ] || { enabled: true, is_premium: false };
}

const BIRTHDATE_TYPES  = [ 'adn_big5', 'adn_core7', 'pyth_calendar', 'pyth_core', 'pyth_psychomatrix' ];
const PYTH_CORE_TYPES  = [ 'pyth_core' ];
const WHERE_TO_LIVE_TYPES = [ 'where_to_live' ];
const NAME_TYPES       = [ 'adn_name', 'adn_business' ];
const CHALDEAN_TYPES   = [ 'chaldean_name' ];
const COMPARE_TYPES    = [ 'adn_comparison' ];

// ─── Calendar download helpers ─────────────────────────────────────────────────

function adnDay( month, day, year ) {
  let s = [ ...String( month ), ...String( day ), ...String( year ) ]
    .reduce( ( acc, c ) => acc + parseInt( c, 10 ), 0 );
  while ( s > 22 ) s = [ ...String( s ) ].reduce( ( acc, c ) => acc + parseInt( c, 10 ), 0 );
  return Math.max( s, 1 );
}

function downloadFile( content, filename, mime ) {
  const blob = new Blob( [ content ], { type: mime } );
  const url  = URL.createObjectURL( blob );
  const a    = document.createElement( 'a' );
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL( url );
}

function downloadCalendarCSV( calendarData, birthdate = '' ) {
  const rows = [ 'Date,Day of Week,Personal Year,Personal Month,Personal Day,ADN Day Energy' ];
  const DOW  = [ 'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday' ];
  for ( const m of calendarData.months ) {
    for ( let d = 1; d <= Object.keys( m.days ).length; d++ ) {
      const dow = new Date( m.year, m.month - 1, d ).getDay();
      rows.push( `${ m.year }-${ String( m.month ).padStart( 2,'0' ) }-${ String( d ).padStart( 2,'0' ) },${ DOW[dow] },${ calendarData.personal_year },${ m.personal_month },${ m.days[d] },${ adnDay( m.month, d, m.year ) }` );
    }
  }
  downloadFile( rows.join( '\n' ), `numerology-calendar-${ birthdate || 'export' }.csv`, 'text/csv' );
}

function downloadCalendarICS( calendarData, birthdate = '' ) {
  const lines = [ 'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LunaCco//Numerology Calendar//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH' ];
  for ( const m of calendarData.months ) {
    for ( let d = 1; d <= Object.keys( m.days ).length; d++ ) {
      const ymd  = `${ m.year }${ String( m.month ).padStart(2,'0') }${ String(d).padStart(2,'0') }`;
      const next = new Date( m.year, m.month - 1, d + 1 );
      const nYmd = `${ next.getFullYear() }${ String( next.getMonth()+1 ).padStart(2,'0') }${ String( next.getDate() ).padStart(2,'0') }`;
      lines.push( 'BEGIN:VEVENT', `DTSTART;VALUE=DATE:${ ymd }`, `DTEND;VALUE=DATE:${ nYmd }`,
        `SUMMARY:Day ${ m.days[d] } | ADN ${ adnDay( m.month, d, m.year ) }`,
        `DESCRIPTION:Personal Year: ${ calendarData.personal_year }\\nPersonal Month: ${ m.personal_month }\\nPersonal Day: ${ m.days[d] }\\nADN Day: ${ adnDay( m.month, d, m.year ) }`,
        `UID:luna-num-${ ymd }@lunacco`, 'END:VEVENT' );
    }
  }
  lines.push( 'END:VCALENDAR' );
  downloadFile( lines.join( '\r\n' ), `numerology-calendar-${ birthdate || 'export' }.ics`, 'text/calendar' );
}

// ─── Generic UI helpers ─────────────────────────────────────────────────────────

function NumberCard( { label, value, theme = 'default' } ) {
  const themes = { amber: 'bg-[var(--gold)]/10 border-[var(--gold)]/30 text-[var(--gold)]', indigo: 'bg-[var(--indigo)]/10 border-[var(--indigo)]/30 text-[var(--indigo)]', default: 'bg-[var(--card)] border-[var(--hair)] text-[var(--ink)]' };
  const lThemes = { amber: 'text-[var(--gold)]/40', indigo: 'text-[var(--indigo)]/50', default: 'text-[var(--mute)]' };
  return (
    <div className={ `flex-1 flex flex-col items-center justify-center p-6 border transition-all ${ themes[theme] || themes.default }` } style={{ borderRadius: 'var(--radius-card,0px)' }}>
      <span className={ `text-[9px] font-bold uppercase tracking-widest mb-2 ${ lThemes[theme] || lThemes.default }` }>{ label }</span>
      <span className="text-5xl font-light italic" style={{ fontFamily: 'var(--font-display)' }}>{ value }</span>
    </div>
  );
}

function NameResult( { result } ) {
  return (
    <div className="w-full">
      <p className="text-center text-[var(--mute)] text-[10px] uppercase font-bold tracking-widest mb-4">{ result.name }</p>
      <div className="grid grid-cols-2 gap-4">
        { [ [ 'Expression', result.expressionNumber ], [ 'Soul Urge', result.motivationNumber ], [ 'Personality', result.personalityNumber ], [ 'Integration', result.integrationNumber ] ]
          .map( ( [ label, value ], i ) => <NumberCard key={ label } label={ label } value={ value } theme={ i === 0 ? 'indigo' : 'default' } /> ) }
      </div>
    </div>
  );
}

function CompareResult( { result } ) {
  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <NameResult result={ result.name_a } />
        <NameResult result={ result.name_b } />
      </div>
      <div className="flex flex-col items-center p-8 bg-[var(--indigo)]/5 border border-[var(--indigo)]/20" style={{ borderRadius: 'var(--radius-card,0px)' }}>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] mb-2">Compatibility</span>
        <span className="text-8xl font-light italic text-[var(--indigo)]" style={{ fontFamily: 'var(--font-display)' }}>{ result.compatibility }</span>
      </div>
    </div>
  );
}

function SavedChartPicker( { savedCharts, onLoad, allChartTypes } ) {
  const [ query, setQuery ] = useState( '' );
  const [ open,  setOpen  ] = useState( false );
  const ref = useRef( null );

  useEffect( () => {
    const close = ( e ) => { if ( ref.current && !ref.current.contains( e.target ) ) setOpen( false ); };
    document.addEventListener( 'mousedown', close );
    return () => document.removeEventListener( 'mousedown', close );
  }, [] );

  const filtered = savedCharts.filter( c => {
    const q = query.toLowerCase();
    if ( !q ) return true;
    return ( c.title || '' ).toLowerCase().includes( q ) || ( c.input_data?.birthdate || '' ).includes( q ) || ( c.input_data?.name || '' ).toLowerCase().includes( q ) || ( c.tags || [] ).some( t => t.toLowerCase().includes( q ) );
  } );

  if ( !savedCharts.length ) return null;

  return (
    <div ref={ ref } className="relative">
      <button onClick={ () => setOpen( p => !p ) }
        className="w-full flex items-center gap-3 bg-[var(--card)] border border-[var(--hair)] px-3 py-2 text-left hover:border-[var(--ink)] transition-all"
        style={{ borderRadius: 'var(--radius-card,0px)' }}>
        <BookOpen size={ 14 } className="text-[var(--indigo)] shrink-0" />
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-[var(--mute)]">Load saved chart…</span>
        <ChevronDown size={ 12 } className="text-[var(--hair)] shrink-0" />
      </button>
      { open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--card)] border border-[var(--ink)] shadow-2xl z-30 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--hair)]">
            <Search size={ 12 } className="text-[var(--mute)] shrink-0" />
            <input autoFocus value={ query } onChange={ e => setQuery( e.target.value ) } placeholder="Search…" className="flex-1 bg-transparent text-[11px] text-[var(--ink)] placeholder-[var(--mute)]/50 outline-none" />
            { query && <button onClick={ () => setQuery( '' ) } className="text-[var(--mute)] hover:text-[var(--ink)]"><X size={ 11 } /></button> }
          </div>
          <div className="max-h-56 overflow-y-auto">
            { !filtered.length && <p className="text-[var(--mute)] text-[11px] text-center py-4 italic">No charts match.</p> }
            { filtered.map( c => (
              <button key={ c.id } onClick={ () => { onLoad( c ); setOpen( false ); setQuery( '' ); } }
                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--card-2)] transition-colors border-b border-[var(--hair)] last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-[var(--ink)] font-bold uppercase tracking-wider truncate">{ c.title || c.chart_type }</div>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    { ( c.tags || [] ).slice( 0, 3 ).map( t => <span key={ t } className="text-[9px] text-[var(--gold)] uppercase font-bold">#{ t }</span> ) }
                  </div>
                </div>
                <span className="text-[9px] text-[var(--mute)] uppercase font-bold shrink-0 mt-0.5">{ allChartTypes.find( t => t.id === c.chart_type )?.shortLabel || c.chart_type }</span>
              </button>
            ) ) }
          </div>
        </div>
      ) }
    </div>
  );
}

function InputFields( { activeChartType, birthdate, setBirthdate, name, setName, knownName, setKnownName, nameB, setNameB, hideBirthdate = false } ) {
  const isPythCore = PYTH_CORE_TYPES.includes( activeChartType );
  const isChaldean = CHALDEAN_TYPES.includes( activeChartType );
  const iCls = 'w-full bg-transparent border-0 border-b border-[var(--ink)] py-2 text-[var(--ink)] text-lg italic placeholder-[var(--mute)]/30 focus:outline-none focus:border-[var(--gold)] transition-colors';
  const lCls = 'block text-[var(--mute)] text-[10px] font-bold uppercase tracking-[0.2em] mt-2';
  return (
    <div className="space-y-4">
      { BIRTHDATE_TYPES.includes( activeChartType ) && !hideBirthdate && (
        <div><label className={ lCls }>Birth Date</label><input type="date" value={ birthdate } onChange={ e => setBirthdate( e.target.value ) } className={ iCls } style={{ fontFamily: 'var(--font-display)' }} /></div>
      ) }
      { BIRTHDATE_TYPES.includes( activeChartType ) && hideBirthdate && (
        <p className="text-[10px] text-[var(--mute)] italic mt-2">Using birthdate from your profile.</p>
      ) }
      { ( NAME_TYPES.includes( activeChartType ) || COMPARE_TYPES.includes( activeChartType ) ) && (
        <div><label className={ lCls }>{ activeChartType === 'adn_name' ? 'Full Name' : 'Business Name' }</label><input type="text" value={ name } onChange={ e => setName( e.target.value ) } placeholder="Enter name…" className={ iCls } style={{ fontFamily: 'var(--font-display)' }} /></div>
      ) }
      { ( isPythCore || isChaldean ) && (
        <>
          <div><label className={ lCls }>Full / Legal Name</label><input type="text" value={ name } onChange={ e => setName( e.target.value ) } placeholder="e.g. Julia Anne Duquette" className={ iCls } style={{ fontFamily: 'var(--font-display)' }} /></div>
          <div><label className={ lCls }>Known As / Nickname <span className="normal-case font-normal text-[var(--mute)]/50">optional</span></label><input type="text" value={ knownName } onChange={ e => setKnownName( e.target.value ) } placeholder="e.g. Jules" className={ iCls } style={{ fontFamily: 'var(--font-display)' }} /></div>
        </>
      ) }
      { COMPARE_TYPES.includes( activeChartType ) && (
        <div><label className={ lCls }>Offering / Product</label><input type="text" value={ nameB } onChange={ e => setNameB( e.target.value ) } placeholder="Enter second name…" className={ iCls } style={{ fontFamily: 'var(--font-display)' }} /></div>
      ) }
    </div>
  );
}

function TagInput( { tags: tagsProp, setTags } ) {
  const tags = tagsProp || [];
  const [ raw, setRaw ] = useState( '' );
  function commit( v ) { const c = v.replace( /^#+/, '' ).trim(); if ( c && !tags.includes( c ) ) setTags( [ ...tags, c ] ); setRaw( '' ); }
  function onKeyDown( e ) {
    if ( [ 'Enter', ',', ' ' ].includes( e.key ) ) { e.preventDefault(); commit( raw ); }
    else if ( e.key === 'Backspace' && !raw && tags.length ) setTags( tags.slice( 0, -1 ) );
  }
  return (
    <div className="flex flex-wrap items-center gap-1 bg-[var(--card)] border border-[var(--hair)] px-2 py-1.5 min-h-[36px]" style={{ borderRadius: 'var(--radius-card,0px)' }}>
      { tags.map( t => <span key={ t } className="flex items-center gap-1 px-2 py-0.5 bg-[var(--indigo)]/10 border border-[var(--indigo)]/20 text-[10px] text-[var(--indigo)] font-bold uppercase tracking-widest">#{ t }<button onClick={ () => setTags( tags.filter( x => x !== t ) ) } className="text-[var(--indigo)]/50 hover:text-[var(--indigo)] leading-none">×</button></span> ) }
      <input value={ raw } onChange={ e => setRaw( e.target.value ) } onKeyDown={ onKeyDown } onBlur={ () => raw.trim() && commit( raw ) } placeholder={ tags.length ? '' : '#tag' } className="flex-1 min-w-[60px] bg-transparent text-[11px] text-[var(--ink)] placeholder-[var(--mute)]/30 outline-none uppercase font-bold tracking-widest" />
    </div>
  );
}

const inputCls = 'w-full bg-transparent border-0 border-b border-[var(--ink)] py-2 text-[var(--ink)] text-lg italic placeholder-[var(--mute)]/30 focus:outline-none focus:border-[var(--gold)] transition-colors';

function LocationRowsInput( { birthdate, setBirthdate, rows, setRows, person } ) {
  const update = ( i, f, v ) => setRows( p => p.map( ( r, j ) => j === i ? { ...r, [f]: v } : r ) );
  const pCity = person?.city || '', pReg = person?.region || '', pCnt = person?.country || '';
  return (
    <div className="space-y-6">
      <div><label className="block text-[var(--mute)] text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5">Birth Date <span className="normal-case font-normal text-[var(--mute)]/50">for Life Path comparison</span></label><input type="date" value={ birthdate } onChange={ e => setBirthdate( e.target.value ) } className={ inputCls } style={{ fontFamily: 'var(--font-display)' }} /></div>
      { pCity && <button type="button" onClick={ () => setRows( p => p.map( ( r, i ) => i === 0 ? { city: pCity, region: pReg, country: pCnt } : r ) ) } className="text-[10px] font-bold uppercase tracking-widest text-[var(--indigo)] hover:text-[var(--indigo-2)] transition-colors text-left">Use saved: { pCity }, { pReg }{ pCnt ? `, ${ pCnt }` : '' }</button> }
      { rows.map( ( row, idx ) => (
        <div key={ idx } className="p-4 border border-[var(--hair)] bg-[var(--paper-2)] space-y-4" style={{ borderRadius: 'var(--radius-card,0px)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--mute)]">Location { rows.length > 1 ? idx + 1 : '' }</span>
            { rows.length > 1 && <button type="button" onClick={ () => setRows( p => p.filter( ( _, i ) => i !== idx ) ) } className="text-[var(--mute)] hover:text-rose-500 transition-colors"><X size={ 14 } /></button> }
          </div>
          <input type="text" placeholder={ `City ${ pCity ? `(saved: ${ pCity })` : '' }` } value={ row.city } onChange={ e => update( idx, 'city', e.target.value ) } className={ inputCls } style={{ fontFamily: 'var(--font-display)' }} />
          <input type="text" placeholder={ `Region / State ${ pReg ? `(saved: ${ pReg })` : '' }` } value={ row.region } onChange={ e => update( idx, 'region', e.target.value ) } className={ inputCls } style={{ fontFamily: 'var(--font-display)' }} />
          <input type="text" placeholder={ `Country ${ pCnt ? `(saved: ${ pCnt })` : 'optional' }` } value={ row.country } onChange={ e => update( idx, 'country', e.target.value ) } className={ inputCls } style={{ fontFamily: 'var(--font-display)' }} />
        </div>
      ) ) }
      <button type="button" onClick={ () => setRows( p => [ ...p, { city:'', region:'', country:'' } ] ) }
        className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--indigo)] hover:text-[var(--indigo-2)] border border-dashed border-[var(--indigo)]/20 hover:border-[var(--indigo)]/50 transition-colors flex items-center justify-center gap-2"
        style={{ borderRadius: 'var(--radius-card,0px)' }}><Plus size={ 12 } /> Add Location to Compare</button>
    </div>
  );
}

function CompactSavePanel( { isLoggedIn, openLoginModal, freeRemaining, creditCost, saving, saveError, savedChartId, notesDraft, setNotesDraft, chartTitle, setChartTitle, chartTags, setChartTags, onSave, onViewJournal } ) {
  const [ noteOpen, setNoteOpen ] = useState( false );
  if ( savedChartId ) return (
    <div className="flex items-center gap-3 text-emerald-600 text-[11px] font-bold uppercase tracking-widest">
      <CheckCircle size={ 14 } /><span>Saved to Archive</span>
      <button onClick={ onViewJournal } className="ml-auto text-[var(--indigo)] flex items-center gap-1.5"><BookOpen size={ 14 } /> Journal</button>
    </div>
  );
  if ( !isLoggedIn ) return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[var(--mute)] text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"><Lock size={ 12 } /> Sign in to save</span>
      <button onClick={ openLoginModal } className="text-[10px] px-4 py-1.5 bg-[var(--indigo)] text-[var(--btn-fg)] font-bold uppercase tracking-widest">Sign In</button>
    </div>
  );
  const needsCredits = freeRemaining !== null && freeRemaining <= 0;
  return (
    <div className="flex flex-col gap-3">
      <input type="text" value={ chartTitle } onChange={ e => setChartTitle( e.target.value ) } placeholder="Chart name (auto if blank)" className="w-full bg-transparent border-0 border-b border-[var(--hair)] py-2 text-[var(--ink)] text-sm italic placeholder-[var(--mute)]/30 focus:outline-none focus:border-[var(--gold)] transition-colors" style={{ fontFamily: 'var(--font-display)' }} />
      <TagInput tags={ chartTags } setTags={ setChartTags } />
      { noteOpen && <textarea value={ notesDraft } onChange={ e => setNotesDraft( e.target.value ) } placeholder="Add reflections, insights…" rows={ 3 } className="w-full bg-[var(--paper)] border border-[var(--hair)] px-4 py-3 text-[var(--ink)] text-sm placeholder-[var(--ink)]/30 focus:outline-none focus:border-[var(--indigo)] transition-colors resize-none" /> }
      { saveError && <p className="text-red-600 text-xs font-bold uppercase tracking-widest">{ saveError }</p> }
      <div className="flex gap-2">
        <button onClick={ () => setNoteOpen( p => !p ) } className="text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 bg-[var(--card)] border border-[var(--hair)] text-[var(--mute)] hover:text-[var(--ink)] transition-all">{ noteOpen ? 'Hide Note' : 'Add Note' }</button>
        <button onClick={ onSave } disabled={ saving } className="flex-1 text-[10px] font-bold uppercase tracking-[0.2em] py-2 bg-[var(--indigo)] text-[var(--btn-fg)] hover:opacity-90 transition-all disabled:opacity-30">{ saving ? '…' : needsCredits ? `Save (${ creditCost } cr)` : 'Save Chart' }</button>
      </div>
      { needsCredits && <p className="text-amber-400/60 text-[10px] flex items-center gap-1"><CreditCard size={ 10 } /> { creditCost } credit{ creditCost !== 1 ? 's' : '' } required</p> }
    </div>
  );
}

function ReportButton( { chartType, system, inputData, points, notesDraft, reportPresets, exportChartPDF, compact = false } ) {
  const [ open, setOpen ] = useState( false );
  const [ downloading, setDownloading ] = useState( false );
  const ref = useRef( null );
  const PYTH_TYPES = [ 'pyth_core', 'pyth_psychomatrix', 'pyth_calendar' ];
  const anyHave = reportPresets.some( p => !!p.chart_type );
  const presets = anyHave ? reportPresets.filter( p => p.chart_type === chartType || ( PYTH_TYPES.includes( chartType ) && p.chart_type === 'pyth_core' ) ) : reportPresets;

  useEffect( () => {
    const close = e => { if ( ref.current && !ref.current.contains( e.target ) ) setOpen( false ); };
    document.addEventListener( 'mousedown', close );
    return () => document.removeEventListener( 'mousedown', close );
  }, [] );

  const download = async ( preset ) => {
    setOpen( false ); setDownloading( true );
    try { await exportChartPDF( { chartType, system, inputData, points, presetSlug: preset.slug } ); }
    finally { setDownloading( false ); }
  };

  if ( !presets.length ) return null;
  const btnCls = compact
    ? 'flex items-center gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] hover:text-[var(--ink)] bg-[var(--card)] border border-[var(--hair)] transition-all disabled:opacity-30'
    : 'flex items-center gap-3 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] bg-[var(--indigo)] text-[var(--btn-fg)] hover:opacity-90 transition-all shadow-sm disabled:opacity-30';

  if ( presets.length === 1 ) return <button onClick={ () => download( presets[0] ) } disabled={ downloading } className={ btnCls }><Download size={ 14 } />{ downloading ? 'Generating…' : 'Download Report' }</button>;

  return (
    <div className="relative" ref={ ref }>
      <button onClick={ () => setOpen( p => !p ) } disabled={ downloading } className={ btnCls }><Download size={ 14 } />{ downloading ? 'Generating…' : 'Download Report' }<ChevronDown size={ 13 } className={ `transition-transform ${ open ? 'rotate-180' : '' }` } /></button>
      { open && (
        <div className="absolute bottom-full mb-1 right-0 z-[60] bg-[var(--paper)] border border-[var(--hair)] shadow-2xl min-w-[220px] py-2">
          { presets.map( p => <button key={ p.slug } onClick={ () => download( p ) } className="w-full text-left px-5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--indigo)]/5 transition-colors flex items-center gap-3"><Download size={ 12 } className="text-[var(--indigo)] shrink-0" />{ p.label }</button> ) }
        </div>
      ) }
    </div>
  );
}

const NUM_GROUPS = [
  { label: 'ADN System',         types: [ 'adn_big5','adn_core7','adn_business','adn_comparison' ] },
  { label: 'Name Arcana',        types: [ 'adn_name' ] },
  { label: 'Pythagorean System', types: [ 'pyth_core','pyth_psychomatrix','pyth_calendar' ] },
  { label: 'Chaldean',           types: [ 'chaldean_name' ] },
  { label: 'Location',           types: [ 'where_to_live' ] },
];

function ChartsLandingPane( { visibleChartTypes, ahdTypes, easternTypes = [], selectType, premiumMetaFor } ) {
  const LEVEL_DOT = { beginner: 'beg', intermediate: 'int', advanced: 'adv' };
  const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
  const levelOf = ( t ) => t.level || 'beginner';
  const [ filter, setFilter ] = useState( 'All' );
  const matchFilter = ( t ) => filter === 'All' ? true : filter === 'Popular' ? !!t.popular : levelOf( t ) === filter.toLowerCase();

  // Editorial feature-card section (.cl-feat) — system tag, level/popular, name, desc.
  const FeatSection = ( { label, sysClass, tagText, types } ) => {
    const shown = types.filter( matchFilter );
    if ( !shown.length ) return null;
    return (
      <div>
        <div className="cl-lib-head" style={{ marginBottom: 18 }}>
          <h3>{ label }</h3>
          <span className="sub">{ shown.length } chart{ shown.length !== 1 ? 's' : '' }</span>
        </div>
        <div className="cl-feat-grid">
          { shown.map( t => { const lv = levelOf( t ); const prem = premiumMetaFor?.( t ); return (
            <button key={ t.id } className="cl-feat" onClick={ () => selectType( t ) } style={{ textAlign: 'left' }}>
              <div className="cf-top">
                <span className={ `cf-sys ${ sysClass }` }>{ tagText }</span>
                <div className="cf-lv">
                  { prem && (
                    <span title={ `Premium — ${ prem.cost } credit${ prem.cost !== 1 ? 's' : '' }` } style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} className="text-[9px] font-bold uppercase tracking-wider text-[var(--gold)]">
                      <Lock size={ 9 } /> { prem.cost > 0 ? `${ prem.cost } cr` : 'Pro' }
                    </span>
                  ) }
                  { t.popular && <span className="dot pop" title="Popular" /> }
                  <span className={ `dot ${ LEVEL_DOT[ lv ] }` } />
                  <span>{ LEVEL_LABEL[ lv ] }</span>
                </div>
              </div>
              <div className="cf-name">{ t.label }</div>
              <div className="cf-desc">{ t.desc }</div>
              <div className="cf-open">Open <span aria-hidden>→</span></div>
            </button>
          ); } ) }
        </div>
      </div>
    );
  };

  const FilterTabs = () => (
    <div className="cl-ftabs">
      { [ 'All', 'Popular', 'Beginner', 'Intermediate', 'Advanced' ].map( t => (
        <button key={ t } className={ filter === t ? 'on' : '' } onClick={ () => setFilter( t ) }>
          { t === 'Popular' && <span className="dot pop" /> }
          { t === 'Beginner' && <span className="dot beg" /> }
          { t === 'Intermediate' && <span className="dot int" /> }
          { t === 'Advanced' && <span className="dot adv" /> }
          { t }
        </button>
      ) ) }
    </div>
  );

  const astroCat = ( cat ) => ahdTypes.filter( t => ( t.category || 'astrohd' ) === cat );

  // Personal snapshot cards (.cl-snaps) — at-a-glance profile data, when present.
  const { profileData } = window.LunaCcoHooks.useUser();
  const astro = profileData?.astrology || {};
  const hd = profileData?.human_design || {};
  const num = profileData?.numerology || {};
  const HD_STRATEGY = { 'Generator': 'To Respond', 'Manifesting Generator': 'To Respond', 'Projector': 'Wait for the Invitation', 'Manifestor': 'To Inform', 'Reflector': 'Wait a Lunar Cycle' };
  const SIGN_MODALITY = { Aries: 'Cardinal', Taurus: 'Fixed', Gemini: 'Mutable', Cancer: 'Cardinal', Leo: 'Fixed', Virgo: 'Mutable', Libra: 'Cardinal', Scorpio: 'Fixed', Sagittarius: 'Mutable', Capricorn: 'Cardinal', Aquarius: 'Fixed', Pisces: 'Mutable' };
  const sunModality = astro.sun_sign ? SIGN_MODALITY[ astro.sun_sign ] : null;
  const big3 = [ [ 'Sun', astro.sun_sign ], [ 'Moon', astro.moon_sign ], [ 'Rising', astro.rising_sign ] ].filter( ( [ , v ] ) => v );
  const numLeaders = [ [ 'Expression', num.expression_number ], [ 'Soul Urge', num.soul_urge_number ?? num.motivation_number ], [ 'Personality', num.personality_number ] ].filter( ( [ , v ] ) => v != null && v !== '' );
  const hasNum = num.life_path_number != null && num.life_path_number !== '';
  // Compound life path: try calculatePythagoreanCore if birthdate available
  const lifePathDisplay = ( () => {
    const bd = profileData?.identity?.birthdate;
    const fn = profileData?.identity?.full_name || '';
    const calc = window.LunaCcoNumerologyModule?.calculations?.calculatePythagoreanCore;
    if ( bd && calc ) {
      try {
        const res = calc( bd, fn );
        const chain = res?.lifePath?.chain;
        if ( Array.isArray( chain ) && chain.length > 1 ) return chain.join( '/' );
        const raw = res?.lifePath?.unreduced;
        const val = res?.lifePath?.value ?? num.life_path_number;
        if ( raw && raw !== val ) return `${ raw }/${ val }`;
        return String( val );
      } catch { /* fall through */ }
    }
    return String( num.life_path_number );
  } )();
  const isNumActive = !!window.LunaCcoNumerologyModule;
  const showSnaps = big3.length || hd.type || ( isNumActive && hasNum );

  const goAstro = () => { const t = astroCat( 'astrology' )[0]; if ( t ) selectType( t ); };
  const goHd = () => { const t = astroCat( 'hd' )[0]; if ( t ) selectType( t ); };
  const goNum = () => { const t = visibleChartTypes.find( x => x.id === 'pyth_core' ) || visibleChartTypes[0]; if ( t ) selectType( t ); };

  return (
    <div className="flex-1 overflow-y-auto px-10 py-10 no-scrollbar">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="border-b border-[var(--ink)] pb-6">
          <h2 className="text-4xl font-normal italic text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>Charts</h2>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--mute)] mt-1 font-bold">Select a chart to begin your reading</p>
        </div>

        { showSnaps && (
          <div
            className="cl-snaps"
            style={{
              gridTemplateColumns: `repeat(${ [ big3.length > 0, !!hd.type, isNumActive && hasNum ].filter( Boolean ).length }, 1fr)`
            }}
          >
            { big3.length > 0 && (
              <div className="cl-snap" onClick={ goAstro }>
                <div className="sn-head"><span className="eyebrow">Astrology · Big Three</span><span className="sn-open">Open chart ›</span></div>
                { big3.map( ( [ label, sign ] ) => (
                  <div className="b3r" key={ label }><span className="bd">{ label }</span><span className="sg">{ sign }</span></div>
                ) ) }
                { sunModality && (
                  <div className="b3r" key="modality"><span className="bd">Modality</span><span className="sg" style={{ fontSize: 15 }}>{ sunModality }</span></div>
                ) }
              </div>
            ) }
            { hd.type && (
              <div className="cl-snap" onClick={ goHd }>
                <div className="sn-head"><span className="eyebrow">Human Design</span><span className="sn-open">Open chart ›</span></div>
                <div className="hd-type">{ hd.type }</div>
                { HD_STRATEGY[ hd.type ] && <div className="hd-strat">{ HD_STRATEGY[ hd.type ] }</div> }
                <div className="hd-rows">
                  { [ [ 'Authority', hd.authority ], [ 'Profile', hd.profile ], [ 'Inc. Cross', hd.incarnation_cross ] ].filter( ( [ , v ] ) => v ).map( ( [ k, v ] ) => (
                    <div className="hd-row" key={ k }>
                      <span className="k">{ k }</span>
                      <span className={ `v${ String( v ).length > 18 ? ' long' : '' }` }>{ v }</span>
                    </div>
                  ) ) }
                </div>
              </div>
            ) }
            { isNumActive && hasNum && (
              <div className="cl-snap" onClick={ goNum }>
                <div className="sn-head"><span className="eyebrow">Numerology · Life Path</span><span className="sn-open">Open chart ›</span></div>
                <div className="lp-inline"><div className="lp-n">{ lifePathDisplay }</div></div>
                { numLeaders.length > 0 && (
                  <div className="num-leaders">
                    { numLeaders.map( ( [ k, v ] ) => (
                      <div className="nl" key={ k }><span className="k">{ k }</span><span className="dots" /><span className="v">{ v }</span></div>
                    ) ) }
                  </div>
                ) }
              </div>
            ) }
          </div>
        ) }
        <FilterTabs />

        { NUM_GROUPS.map( group => (
          <FeatSection key={ group.label } label={ `Numerology · ${ group.label }` } sysClass="num" tagText="NUM"
            types={ visibleChartTypes.filter( t => group.types.includes( t.id ) ) } />
        ) ) }
        <FeatSection label="Astrology"     sysClass="ast" tagText="AST" types={ astroCat( 'astrology' ) } />
        <FeatSection label="Human Design"  sysClass="hd"  tagText="HD"  types={ astroCat( 'hd' ) } />
        <FeatSection label="AstroHD"       sysClass="ahd" tagText="AHD" types={ astroCat( 'astrohd' ) } />
        <FeatSection label="Eastern Systems" sysClass="eas" tagText="EAS" types={ easternTypes } />
        <AppFooter view="charts" />
      </div>
    </div>
  );
}

// The actual key placements of a numerology chart (NOT every number in the result),
// with their client-facing label and lookup number. Mirrors the placement models in
// the numerology interpretation components so the resolver scopes correctly.
const ADN_ARCANA = {
  1: 'The Pioneer', 2: 'The Secret', 3: 'Lunar', 4: 'Solar', 5: 'Sage', 6: 'Love',
  7: 'Movement', 8: 'Justice', 9: 'The Hermit', 10: 'The Wheel', 11: 'Strength',
  12: 'Suspension', 13: 'Threshold', 14: 'Flow', 15: 'Illusion', 16: 'The Tower',
  17: 'The Star', 18: 'The Moon', 19: 'The Sun', 20: 'Awakening', 21: 'The World', 22: 'Dreamer',
};
const ADN_POS_LABELS = { A: 'Character', B: 'Spiritual Talents', C: 'Material Talents', D: 'The Path', E: 'Comfort Zone', L: 'Money Flow', M: 'Relationships' };
const ADN_CHART_KEYS = {
  adn_big5:  [ 'A', 'B', 'C', 'D', 'E' ],
  adn_core7: [ 'A', 'B', 'C', 'D', 'E', 'L', 'M' ],
};
// Pythagorean key placements → path into the result. Birthday/year are intentionally
// excluded (not client-facing key placements). Soul Urge = heartDesire.
const PYTH_PLACEMENTS = [
  [ 'Life Path',   'lifePath' ],
  [ 'Expression',  'fullNums.expression' ],
  [ 'Soul Urge',   'fullNums.heartDesire' ],
  [ 'Personality', 'fullNums.personality' ],
  [ 'Maturity',    'maturity' ],
  [ 'Balance',     'balance' ],
];
const getPath = ( obj, path ) => path.split( '.' ).reduce( ( o, k ) => ( o == null ? o : o[ k ] ), obj );

function collectChartPlacements( result, system, activeChartType, showCompounds ) {
  if ( !result || typeof result !== 'object' ) return [];
  const out = [];
  if ( system === 'adn' ) {
    const keys = ADN_CHART_KEYS[ activeChartType ];
    if ( !keys ) return []; // unknown ADN chart (e.g. business) — handled later, don't dump all numbers
    keys.forEach( ( k ) => {
      const v = result[ k ];
      if ( typeof v === 'number' ) {
        out.push( { key: k, label: ADN_POS_LABELS[ k ] || k, value: v, reduced: v, title: ADN_ARCANA[ v ] || '' } );
      }
    } );
    return out;
  }
  // Pythagorean (and name): the real core placements only.
  PYTH_PLACEMENTS.forEach( ( [ label, path ] ) => {
    const o = getPath( result, path );
    if ( o == null ) return;
    const obj = typeof o === 'object' ? o : { value: o };
    if ( obj.value == null ) return;
    const compound = obj.unreduced != null ? obj.unreduced : obj.value;
    out.push( { key: label, label, value: showCompounds ? compound : obj.value, reduced: obj.value, title: '' } );
  } );
  return out;
}

// ─── CoreChartsViewInner ───────────────────────────────────────────────────────

function CoreChartsViewInner( { isMobileViewport, setView, routeParam } ) {
  const numMod = window.LunaCcoNumerologyModule || {};
  const PersonSelector = window.LunaCcoShared?.PersonSelector || ( () => null );
  const { useAuth, useAppConfig } = window.LunaCcoHooks;
  const { isLoggedIn, openLoginModal } = useAuth();
  const { signupPromoText, buyCreditsUrl, becomeMemberUrl } = useAppConfig ? useAppConfig() : {};
  const numCtx = numMod.useNumerology ? numMod.useNumerology() : {};
  const {
    setChartResult,
    currentInput,
    freeRemaining,   creditCost,
    saving,          saveError,          savedChartId,
    notesDraft,      setNotesDraft,
    chartTitle,      setChartTitle,
    chartTags,       setChartTags,
    saveCurrentChart,
    exportChartPDF,
    reportPresets,
    definitions,
    definitionsLoading,
    loadDefinitions,
    savedCharts,
    chartDisplaySettings,
  } = numCtx;

  // The numerology context normally OWNS the active-chart selection. When the
  // numerology module isn't active, fall back to local state so the core charts
  // page (AstroHD / Eastern) still works on its own.
  const numOwnsSelection = typeof numCtx.setActiveChartType === 'function';
  const [ localChartType, setLocalChartType ] = useState( '' );
  const [ localSystem,    setLocalSystem    ] = useState( '' );
  const activeChartType    = numOwnsSelection ? numCtx.activeChartType    : localChartType;
  const setActiveChartType = numOwnsSelection ? numCtx.setActiveChartType : setLocalChartType;
  const activeSystem       = numOwnsSelection ? numCtx.activeSystem       : localSystem;
  const setActiveSystem    = numOwnsSelection ? numCtx.setActiveSystem    : setLocalSystem;

  const { useUser: _useUser } = window.LunaCcoHooks;
  const {
    profileData,
    people,
    peopleLoading,
    loadPeople,
    savePerson,
    deletePerson,
    currentPersonId,
    setCurrentPersonId,
    userContext,
    refreshUser,
  } = _useUser();
  const isMyselfSelected = currentPersonId === null;
  const profileIdentity = isMyselfSelected
    ? { ...( profileData?.identity || {} ), id: null, chart_cache: profileData?.chart_cache }
    : ( ( people || [] ).find( p => p.id === currentPersonId ) || {} );

  const [ birthdate,     setBirthdate     ] = useState( '' );
  const [ name,          setName          ] = useState( '' );
  const [ knownName,     setKnownName     ] = useState( '' );
  const [ nameB,         setNameB         ] = useState( '' );
  const [ locationRows,  setLocationRows  ] = useState( [ { city:'', region:'', country:'' } ] );
  const [ birthTime,     setBirthTime     ] = useState( '' );
  const [ birthLat,      setBirthLat      ] = useState( '' );
  const [ birthLng,      setBirthLng      ] = useState( '' );
  const [ birthTimezone, setBirthTimezone ] = useState( '' );

  const isAdminUser    = !!userContext?.is_admin;
  const ahdSettingsMap = getAHDSettingsMap();
  const ahdTypes      = getAHDTypes().filter( t => {
    const cfg = ahdCfgFor( t, ahdSettingsMap );
    if ( cfg.enabled === false ) return false;
    if ( cfg.admin_only && !isAdminUser ) return false;
    return true;
  } );
  const easternTypes  = getEasternTypes();
  const isAstroHDType = ahdTypes.some( t => t.id === activeChartType );
  const isEasternType = easternTypes.some( t => t.id === activeChartType );
  const astroAvailable = !!window.LunaCcoAstroHDCharts;
  const easternAvailable = !!window.LunaCcoEasternCharts;

  const [ today ]              = useState( new Date() );
  const [ error,       setError       ] = useState( '' );
  const [ result,      setResult      ] = useState( null );
  const [ sidebarOpen, setSidebarOpen ] = useState( true );
  // Right interpretation panel as a slide-out drawer: open on load, closeable to a
  // thin handle, and re-opened automatically when a chart element is clicked.
  const [ drawerOpen, setDrawerOpen ] = useState( true );
  // Left sidebar drill-in state: null = system list, else the drilled system id.
  const [ navSystem, setNavSystem ] = useState( null );
  const [ triggerCalc, setTriggerCalc ] = useState( 0 );
  const [ ownedEntitlements, setOwnedEntitlements ] = useState( [] );
  const [ confirmedKeys, setConfirmedKeys ] = useState( () => new Set() );
  const [ entitlementsTick, setEntitlementsTick ] = useState( 0 );
  const [ ahdChartData, setAhdChartData ] = useState( null );
  const [ easternChartData, setEasternChartData ] = useState( null );
  const [ highlightedPoint, setHighlightedPoint ] = useState( null );
  const [ lastActionSource, setLastActionSource ] = useState( null );
  const [ selectedPythPos, setSelectedPythPos ] = useState( null );

  const goBackToLanding = () => {
    setActiveChartType?.( '' );
    setActiveSystem?.( '' );
    setResult( null );
    setAhdChartData( null );
    setEasternChartData( null );
    setError( '' );
    setView?.( 'core-charts', '' );
    setNavSystem( null );
  };

  // Auto-open the interpretation drawer when the user clicks something in a chart.
  // AstroHD/Eastern dispatch a window event; numerology charts set highlightedPoint.
  useEffect( () => {
    const open = () => setDrawerOpen( true );
    window.addEventListener( 'astrohd:select-element', open );
    return () => window.removeEventListener( 'astrohd:select-element', open );
  }, [] );
  useEffect( () => { if ( highlightedPoint != null ) setDrawerOpen( true ); }, [ highlightedPoint ] );

  // Which premium AstroHD charts the current user already owns for the selected person.
  // Drives the per-person "owned vs needs-purchase" gate; refetched on person change and
  // after a purchase (entitlementsTick).
  useEffect( () => {
    if ( !isLoggedIn || !astroAvailable ) { setOwnedEntitlements( [] ); return; }
    const d    = window.LunaCcoData || {};
    const root = ( d.root || '/wp-json/' ).replace( /\/$/, '' ) + '/';
    const pid  = currentPersonId == null ? 'myself' : currentPersonId;
    let cancelled = false;
    fetch( `${ root }luna-astrohd/v1/entitlements?person_id=${ encodeURIComponent( pid ) }`, {
      credentials: 'same-origin',
      headers: { 'X-WP-Nonce': d.nonce || '' },
    } )
      .then( r => ( r.ok ? r.json() : { owned: [] } ) )
      .then( j => { if ( !cancelled ) setOwnedEntitlements( Array.isArray( j.owned ) ? j.owned : [] ); } )
      .catch( () => { if ( !cancelled ) setOwnedEntitlements( [] ); } );
    return () => { cancelled = true; };
  }, [ isLoggedIn, astroAvailable, currentPersonId, entitlementsTick ] );

  const myselfCache = useRef( new Map() );
  const profileBirthdate  = profileIdentity?.birthdate || '';
  const profileFullName   = profileIdentity?.full_name  || '';
  const profileNickname   = profileIdentity?.nickname   || '';
  const currentPersonName = currentPersonId === null
    ? ( profileIdentity?.full_name || profileIdentity?.nickname || '' )
    : ( () => { const p = ( people || [] ).find( p => p.id === currentPersonId ); return p ? ( p.full_name || p.display_name || '' ) : ''; } )();

  useEffect( () => {
    if ( isLoggedIn && isMyselfSelected ) {
      if ( profileBirthdate ) setBirthdate( profileBirthdate );
      if ( profileFullName  ) setName( profileFullName );
      setKnownName( profileNickname );
      setBirthTime(     profileIdentity?.birth_time     || '' );
      setBirthLat(      String( profileIdentity?.birth_lat  || '' ) );
      setBirthLng(      String( profileIdentity?.birth_lng  || '' ) );
      setBirthTimezone( profileIdentity?.birth_timezone || '' );
    }
  }, [ isLoggedIn, isMyselfSelected, profileBirthdate, profileFullName, profileNickname, activeChartType ] );

  const hideBirthdate = isMyselfSelected && !!profileBirthdate;

  function myselfCacheKey( type, bd, nm, kn, locs ) { return `${ type }::${ bd }::${ nm }::${ kn }::${ JSON.stringify( locs ) }`; }

  useEffect( () => {
    if ( !isMyselfSelected || activeChartType === 'pyth_calendar' ) return;
    const key    = myselfCacheKey( activeChartType, profileBirthdate, profileFullName, profileNickname, locationRows );
    const cached = myselfCache.current.get( key );
    if ( cached ) { setResult( cached.result ); setChartResult?.( cached.result, cached.input, activeSystem, activeChartType ); setError( '' ); }
    else setResult( null );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ isMyselfSelected, activeChartType ] );

  const loadSavedChart = useCallback( async ( chart ) => {
    const input = chart.input_data || {};
    if ( input.birthdate )  setBirthdate( input.birthdate );
    if ( input.name )       setName( input.name );
    if ( input.known_name ) setKnownName( input.known_name );
    if ( input.name_b )     setNameB( input.name_b );
    setCurrentPersonId?.( chart.person_id || null );
    let chartData = chart.chart_data;
    if ( !chartData ) {
      try {
        const getChart = numMod.api?.getChart;
        if ( getChart ) { const res = await getChart( chart.id ); chartData = res.chart?.chart_data; }
      } catch { return; }
    }
    const type = ( numMod.CHART_TYPES || [] ).find( t => t.id === chart.chart_type );
    if ( type ) { setActiveChartType?.( type.id ); setActiveSystem?.( type.system ); }
    setResult( chartData );
    setChartResult?.( chartData, input, chart.system, chart.chart_type );
    setChartTitle?.( chart.title || '' );
    setChartTags?.( chart.tags || [] );
  }, [ setActiveChartType, setActiveSystem, setChartResult, setCurrentPersonId, setChartTitle, setChartTags, numMod ] );

  const chartSettings  = chartDisplaySettings?.charts || {};
  const showCompounds  = !!chartDisplaySettings?.show_compounds;
  const visibleNumTypes = ( numMod.CHART_TYPES || [] ).filter( t => {
    const cfg = chartSettings[ t.id ];
    const enabled = cfg ? cfg.enabled : true;
    if ( ! enabled ) return false;
    if ( cfg && cfg.admin_only && !isAdminUser ) return false;
    return true;
  } );
  const allChartTypes   = [ ...visibleNumTypes, ...ahdTypes, ...easternTypes ];

  // Premium badge data for a nav chart row: { cost } when premium, else null.
  const typePremiumMeta = ( t ) => {
    const cfg = ahdTypes.some( x => x.id === t.id )
      ? ahdCfgFor( t, ahdSettingsMap )
      : chartSettings[ t.id ];
    if ( ! cfg || ! cfg.is_premium ) return null;
    return { cost: Number( cfg.credit_cost || 0 ) };
  };

  // Editorial drill-in nav (left sidebar): systems → grouped chart lists. Built
  // from the same module-supplied type arrays, so it stays in sync automatically.
  const navSystems = [
    visibleNumTypes.length ? {
      id: 'numerology', tag: 'NUM', tc: 'num', nm: 'Numerology',
      groups: [
        { lbl: 'ADN System',  types: visibleNumTypes.filter( t => t.system === 'adn' ) },
        { lbl: 'Pythagorean', types: visibleNumTypes.filter( t => t.system === 'pythagorean' ) },
        { lbl: 'Other Systems', types: visibleNumTypes.filter( t => t.system === 'chaldean' || t.id === 'where_to_live' ) },
      ],
    } : null,
    astroAvailable && ahdTypes.some( t => ( t.category || 'astrohd' ) === 'astrology' ) ? {
      id: 'astrology', tag: 'AST', tc: 'ast', nm: 'Astrology',
      groups: [ { lbl: 'Charts', types: ahdTypes.filter( t => ( t.category || 'astrohd' ) === 'astrology' ) } ],
    } : null,
    astroAvailable && ahdTypes.some( t => ( t.category || 'astrohd' ) === 'hd' ) ? {
      id: 'humandesign', tag: 'HD', tc: 'hd', nm: 'Human Design',
      groups: [ { lbl: 'Charts', types: ahdTypes.filter( t => ( t.category || 'astrohd' ) === 'hd' ) } ],
    } : null,
    astroAvailable && ahdTypes.some( t => ( t.category || 'astrohd' ) === 'astrohd' ) ? {
      id: 'astrohd', tag: 'AHD', tc: 'ahd', nm: 'AstroHD',
      groups: [ { lbl: 'Charts', types: ahdTypes.filter( t => ( t.category || 'astrohd' ) === 'astrohd' ) } ],
    } : null,
    easternAvailable && easternTypes.length ? {
      id: 'eastern', tag: 'EAS', tc: 'eas', nm: 'Eastern',
      groups: [ { lbl: 'Charts', types: easternTypes } ],
    } : null,
  ].filter( Boolean ).map( s => ( { ...s, count: s.groups.reduce( ( n, g ) => n + g.types.length, 0 ) } ) );

  const activeType = allChartTypes.find( t => t.id === activeChartType ) || allChartTypes[0];

  const activeChartCfg = useMemo(() => {
    if (isAstroHDType) {
      return ahdCfgFor( activeType || { id: activeChartType }, ahdSettingsMap );
    }
    return chartSettings[ activeChartType ] || { enabled: true, is_premium: false };
  }, [isAstroHDType, activeChartType, chartSettings, activeType, ahdSettingsMap]);

  // Entitlement key for the active AstroHD chart — must match the server credit gate's
  // item_key ('preset:<preset_key>' for chart-maker presets, 'chart:<type>' for built-ins).
  const ahdItemKey = useMemo(() => {
    if ( !isAstroHDType ) return null;
    if ( activeChartType.startsWith( 'ahd_preset_' ) ) {
      const pk = activeType?.chartPresetKey || activeType?.coreChartPreset?.preset_key;
      return pk ? `preset:${ pk }` : null;
    }
    return `chart:${ activeChartType.replace( /^ahd_/, '' ) }`;
  }, [ isAstroHDType, activeChartType, activeType ]);

  const creditBalance     = Number( userContext?.balance ?? 0 );
  const ahdCreditCost     = Number( activeChartCfg.credit_cost || 0 );
  const ahdOwned          = !!ahdItemKey && ownedEntitlements.includes( ahdItemKey );
  // Premium = costs credits and the user isn't an admin. Ownership/affordability are
  // tracked separately — premium status itself is just the chart's config.
  const isChartPremium    = !isAdminUser && !!activeChartCfg.is_premium && ahdCreditCost > 0;
  const ahdConfirmKey     = ahdItemKey ? `${ currentPersonId ?? 'self' }::${ ahdItemKey }` : null;
  // A premium AstroHD chart that the user hasn't paid for (for this person) and hasn't yet
  // confirmed this session — the chart calc/credit charge is blocked until they confirm.
  const ahdNeedsPurchase  = isAstroHDType && isChartPremium && !ahdOwned
    && !( ahdConfirmKey && confirmedKeys.has( ahdConfirmKey ) );
  const ahdCanAfford      = creditBalance >= ahdCreditCost;

  const isCalendar     = activeSystem === 'pythagorean' && activeChartType === 'pyth_calendar';
  const isPythCore     = activeChartType === 'pyth_core';
  const isPsychomatrix = activeChartType === 'pyth_psychomatrix';
  const isChaldean     = CHALDEAN_TYPES.includes( activeChartType );
  const isNameType     = NAME_TYPES.includes( activeChartType ) || COMPARE_TYPES.includes( activeChartType );
  const isWhereToLive  = WHERE_TO_LIVE_TYPES.includes( activeChartType );

  const currentMonthData = ( isCalendar && result?.months ) ? ( result.months.find( m => m.year === today.getFullYear() && m.month === today.getMonth() + 1 ) || result.months[0] ) : null;

  // Resolve authored "Key Meanings" from the unified engine for the chart's numbers.
  // Pythagorean routes to compound vs traditional via showCompounds; ADN uses 1–22.
  useEffect( () => {
    if ( isAstroHDType || isEasternType || !result ) return;
    const placements = collectChartPlacements( result, activeSystem, activeChartType, showCompounds );
    if ( placements.length ) loadDefinitions?.( activeSystem, placements, showCompounds );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ result, activeSystem, activeChartType, showCompounds ] );

  function selectType( type, { push = true } = {} ) {
    setActiveChartType?.( type.id );
    setActiveSystem?.( type.system );
    setResult( null );
    setAhdChartData( null );
    setEasternChartData( null );
    setError( '' );
    // Reflect the selection in the hash so the chart is shareable/deep-linkable.
    if ( push ) setView?.( 'core-charts', type.id );
  }

  // Deep link: when the hash carries a chart id (#core-charts/<id>), open it.
  useEffect( () => {
    if ( ! routeParam ) return;
    const t = allChartTypes.find( x => x.id === routeParam );
    if ( t && t.id !== activeChartType ) selectType( t, { push: false } );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ routeParam, allChartTypes.length ] );

  // Module-specific components (accessed at render time)
  // Chart visuals + interpretation panels. The panels keep their editorial UI
  // (tabs, clickable placements) but resolve content from the unified engine.
  const {
    ADNChart, CalendarGrid, PythagoreanCoreChart, PsychomatrixChart,
    ChaldeanChart, WhereToLiveChart, ADNInterpretation, NameInterpretation,
    PythagoreanCoreInterpretation,
  } = numMod.components || {};

  const { calcPersYear, admPersonalYear } = numMod.calculations || {};

  const AstroHDCenterPaneComp = window.LunaCcoAstroHDCharts?.CenterPane;
  const AstroHDPanelComp      = window.LunaCcoAstroHDCharts?.Panel;
  const EasternCenterPaneComp = window.LunaCcoEasternCharts?.CenterPane;
  const EasternPanelComp      = window.LunaCcoEasternCharts?.Panel;

  const proceedCalc = () => setTriggerCalc( n => n + 1 );

  // Confirm a one-time premium purchase for the active chart + person. The charge
  // happens HERE — explicitly — not as a side effect of the chart calc, because the
  // chart DATA may be cached/reused (premium is about the presentation, not the data).
  // We call the credit gate directly; it consumes credits + records the entitlement.
  // The subsequent chart calc re-hits the gate but is now free (entitlement owned).
  const [ purchaseBusy, setPurchaseBusy ] = useState( false );
  const confirmPurchase = async () => {
    if ( purchaseBusy ) return;
    setPurchaseBusy( true );
    setError( '' );
    const d        = window.LunaCcoData || {};
    const root     = ( d.root || '/wp-json/' ).replace( /\/$/, '' ) + '/';
    const isPreset = activeChartType.startsWith( 'ahd_preset_' );
    const chartType = isPreset
      ? ( AHD_BASE_TYPE_MAP[ activeType?.chart_type ] || 'combined' )
      : activeChartType.replace( /^ahd_/, '' );
    const presetKey = isPreset ? ( activeType?.chartPresetKey || activeType?.coreChartPreset?.preset_key ) : undefined;
    const pid       = currentPersonId == null ? 'myself' : currentPersonId;
    try {
      const res = await fetch( root + 'luna-astrohd/v1/calc-token', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json', 'X-WP-Nonce': d.nonce || '' },
        body:        JSON.stringify( { chart_type: chartType, preset_key: presetKey, person_id: pid } ),
      } );
      if ( ! res.ok ) {
        const err = await res.json().catch( () => ( {} ) );
        setError( err?.message || 'Could not complete the purchase.' );
        setPurchaseBusy( false );
        return;
      }
    } catch {
      setError( 'Could not complete the purchase.' );
      setPurchaseBusy( false );
      return;
    }
    // Owned now — unblock the pane, refresh balance + entitlements, render the chart.
    if ( ahdItemKey ) setOwnedEntitlements( prev => prev.includes( ahdItemKey ) ? prev : [ ...prev, ahdItemKey ] );
    if ( ahdConfirmKey ) setConfirmedKeys( prev => new Set( prev ).add( ahdConfirmKey ) );
    setEntitlementsTick( t => t + 1 );
    if ( typeof refreshUser === 'function' ) refreshUser();
    setPurchaseBusy( false );
    proceedCalc();
  };

  // Shown in the chart pane instead of a premium AstroHD chart the user hasn't paid for.
  const ahdPurchaseGate = (
    <div className="bg-[var(--card)] border border-[var(--hair)] p-8 text-center space-y-4 max-w-md mx-auto my-8" style={{ borderRadius: 'var(--radius-card,0px)' }}>
      <div className="text-3xl">✨</div>
      <h4 className="text-sm font-bold text-[var(--gold)] uppercase tracking-wider">{ ahdCanAfford ? 'Confirm Purchase' : 'Credits Needed' }</h4>
      <p className="text-xs text-[var(--mute)] leading-relaxed">
        <strong className="text-[var(--ink)]">{ activeType?.label || 'This premium chart' }</strong> costs <strong className="text-[var(--ink)]">{ ahdCreditCost } credit{ ahdCreditCost !== 1 ? 's' : '' }</strong>, charged once for { isMyselfSelected ? 'yourself' : ( currentPersonName || 'this person' ) }. You have { creditBalance } credit{ creditBalance !== 1 ? 's' : '' }.
        { ahdCanAfford ? ' Once purchased, this chart stays free for them.' : '' }
      </p>
      { !isLoggedIn ? (
        <div className="flex flex-col gap-2 pt-1 max-w-[220px] mx-auto">
          <button type="button" onClick={ openLoginModal } className="w-full py-2 bg-[var(--indigo)] hover:opacity-90 text-[var(--btn-fg)] text-[10px] font-bold uppercase tracking-wider transition-all">Sign In / Register</button>
          <button type="button" onClick={ goBackToLanding } className="w-full py-2 border border-[var(--hair)] text-[var(--mute)] hover:text-[var(--ink)] text-[10px] font-bold uppercase tracking-wider transition-all">Back</button>
        </div>
      ) : ahdCanAfford ? (
        <>
          <div className="flex gap-2 justify-center pt-1">
            <button type="button" onClick={ goBackToLanding } disabled={ purchaseBusy } className="px-4 py-2 border border-[var(--hair)] text-[var(--mute)] hover:text-[var(--ink)] text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40">Cancel</button>
            <button type="button" onClick={ confirmPurchase } disabled={ purchaseBusy } className="px-4 py-2 bg-[var(--indigo)] hover:opacity-90 text-[var(--btn-fg)] text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-60">{ purchaseBusy ? 'Processing…' : `Purchase & View · ${ ahdCreditCost } cr` }</button>
          </div>
          { error && <p className="text-red-500 text-[11px] italic pt-1">{ error }</p> }
        </>
      ) : (
        <div className="flex flex-col gap-2 pt-1 max-w-[220px] mx-auto">
          { buyCreditsUrl && <a href={ buyCreditsUrl } target="_blank" rel="noopener noreferrer" className="w-full py-2 bg-[var(--gold)] hover:opacity-90 text-black text-center text-[10px] font-bold uppercase tracking-wider transition-all block" style={{ textDecoration: 'none' }}>Get Credits</a> }
          { becomeMemberUrl && <a href={ becomeMemberUrl } target="_blank" rel="noopener noreferrer" className="w-full py-2 bg-indigo-700 hover:opacity-90 text-white text-center text-[10px] font-bold uppercase tracking-wider transition-all block" style={{ textDecoration: 'none' }}>Become a Member</a> }
          <button type="button" onClick={ goBackToLanding } className="w-full py-2 border border-[var(--hair)] text-[var(--mute)] hover:text-[var(--ink)] text-[10px] font-bold uppercase tracking-wider transition-all">Back</button>
        </div>
      ) }
    </div>
  );

  function handleCalculate( e ) {
    e?.preventDefault();
    if ( isAstroHDType ) { proceedCalc(); return; }
    if ( isEasternType ) { setTriggerCalc( n => n + 1 ); return; }
    setError( '' );
    const calcs = numMod.calculations || {};
    let points = null, input = {};

    if ( isPsychomatrix ) {
      if ( !birthdate ) { setError( 'Please enter a birth date.' ); return; }
      input = { birthdate }; points = calcs.calculatePsychomatrix?.( birthdate );
      if ( points?.error ) { setError( points.error ); return; }
    } else if ( PYTH_CORE_TYPES.includes( activeChartType ) ) {
      if ( !birthdate ) { setError( 'Please enter a birth date.' ); return; }
      if ( !name.trim() ) { setError( 'Please enter a full name.' ); return; }
      input = { birthdate, name, known_name: knownName };
      points = calcs.calculatePythagoreanCore?.( birthdate, name.trim(), knownName.trim() );
      if ( points?.error ) { setError( points.error ); return; }
    } else if ( BIRTHDATE_TYPES.includes( activeChartType ) ) {
      if ( !birthdate ) { setError( 'Please enter a birth date.' ); return; }
      input = { birthdate };
      if ( activeSystem === 'pythagorean' ) {
        const [ y, m, d ] = birthdate.split( '-' );
        const cal = calcs.generateCalendar?.( `${ m }/${ d }/${ y }` );
        if ( cal?.error ) { setError( cal.error ); return; }
        points = cal;
      } else {
        const res = calcs.calculateADNFromBirthdate?.( birthdate );
        if ( res?.error ) { setError( res.error ); return; }
        points = res?.points;
      }
    } else if ( isChaldean ) {
      if ( !name.trim() ) { setError( 'Please enter a name.' ); return; }
      input = { name, known_name: knownName }; points = calcs.calculateChaldean?.( name.trim(), knownName.trim() );
      if ( points?.error ) { setError( points.error ); return; }
    } else if ( NAME_TYPES.includes( activeChartType ) ) {
      if ( !name ) { setError( 'Please enter a name.' ); return; }
      input = { name }; points = calcs.calculateName?.( name );
    } else if ( COMPARE_TYPES.includes( activeChartType ) ) {
      if ( !name || !nameB ) { setError( 'Please enter both names.' ); return; }
      input = { name, name_b: nameB }; points = calcs.compareNames?.( name, nameB );
    } else if ( isWhereToLive ) {
      const validRows = locationRows.filter( r => r.city.trim() );
      if ( !validRows.length ) { setError( 'Please enter at least one city.' ); return; }
      input  = { birthdate, locations: validRows };
      points = { locations: validRows.map( r => calcs.calculateWhereToLive?.( { birthdate, ...r } ) ), birthdate };
    }

    setResult( points );
    setChartResult?.( points, input, activeSystem, activeChartType );

    if ( isMyselfSelected && activeChartType !== 'pyth_calendar' ) {
      const key = myselfCacheKey( activeChartType, input.birthdate || '', input.name || '', input.known_name || '', input.locations || [] );
      myselfCache.current.set( key, { result: points, input } );
    }
    if ( isChartPremium && isLoggedIn ) setTimeout( () => saveCurrentChart?.(), 300 );
  }

  // ── Numerology center pane ───────────────────────────────────────────────────
  function renderNumCenter() {
    if ( !result ) return null;
    const bdParts = ( result.birth_date || '' ).split( '/' );
    const bm = parseInt( bdParts[0], 10 ), bd = parseInt( bdParts[1], 10 ), by = parseInt( bdParts[2], 10 );
    const curYear = today.getFullYear();
    const yearRows = [];
    if ( isCalendar && calcPersYear && admPersonalYear ) {
      for ( let yr = curYear; yr <= curYear + 7; yr++ ) yearRows.push( { year: yr, pyth: calcPersYear( bm, bd, yr ), adm: admPersonalYear( bd, bm, by, yr ) } );
    }
    return (
      <div className="flex-1 min-h-0 overflow-y-auto px-10 py-10 flex flex-col gap-10 items-center no-scrollbar">
        { /* Redundant header removed per user request */ }


        { !isCalendar && !isPythCore && !isPsychomatrix && !isChaldean && !isWhereToLive && ( activeChartType === 'adn_name' || !isNameType ) && ADNChart && (
          <div className="w-full flex justify-center py-6 px-4"><div className="w-full max-w-3xl"><ADNChart chartType={ activeChartType } points={ result } highlightedPoint={ highlightedPoint } onPointClick={ k => { setHighlightedPoint( k ); setLastActionSource( 'chart' ); } } /></div></div>
        ) }
        { isWhereToLive && WhereToLiveChart && <div className="w-full flex justify-center py-6"><div className="w-full max-w-4xl bg-[var(--card)] border border-[var(--hair)] p-8"><WhereToLiveChart data={ result } /></div></div> }
        { isCalendar && CalendarGrid && (
          <div className="w-full space-y-12">
            { yearRows.length > 0 && (
              <div className="p-8 bg-[var(--card)] border border-[var(--hair)] overflow-x-auto no-scrollbar">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] mb-6">Personal Year Overview</p>
                <div className="flex gap-4 min-w-max">
                  { yearRows.map( ( row, i ) => (
                    <div key={ row.year } className={ `flex flex-col items-center gap-2 px-6 py-4 border transition-colors ${ i === 0 ? 'border-[var(--indigo)] bg-[var(--indigo)]/5' : 'border-[var(--hair)] bg-[var(--paper)]' }` }>
                      <span className={ `text-[10px] font-bold uppercase tracking-widest ${ i === 0 ? 'text-[var(--indigo)]' : 'text-[var(--mute)]' }` }>{ row.year }</span>
                      <div className="flex items-center gap-2">
                        <span className={ `text-3xl font-light italic leading-none ${ i === 0 ? 'text-[var(--ink)]' : 'text-[var(--mute)]' }` } style={{ fontFamily: 'var(--font-display)' }}>{ row.pyth }</span>
                        <span className="text-[var(--hair)] text-sm">·</span>
                        <span className={ `text-3xl font-light italic leading-none ${ i === 0 ? 'text-[var(--indigo)]' : 'text-[var(--mute)]' }` } style={{ fontFamily: 'var(--font-display)' }}>{ row.adm }</span>
                      </div>
                      <div className="flex gap-3"><span className="text-[8px] text-[var(--mute)] font-bold uppercase tracking-tighter opacity-40">Pyth</span><span className="text-[8px] text-[var(--indigo)] font-bold uppercase tracking-tighter opacity-40">Adm</span></div>
                    </div>
                  ) ) }
                </div>
              </div>
            ) }
            <CalendarGrid calendarData={ result } hideHeader />
          </div>
        ) }
        { isNameType && !COMPARE_TYPES.includes( activeChartType ) && <div className="w-full flex justify-center py-4"><div className="w-full max-w-2xl"><NameResult result={ result } /></div></div> }
        { COMPARE_TYPES.includes( activeChartType ) && <div className="w-full max-w-4xl"><CompareResult result={ result } /></div> }
        { isPythCore && PythagoreanCoreChart && <div className="w-full flex justify-center py-6 px-4"><div className="w-full max-w-3xl"><PythagoreanCoreChart data={ result } showCompounds={ showCompounds } onSelectPosition={ pos => setSelectedPythPos( pos ) } /></div></div> }
        { isPsychomatrix && PsychomatrixChart && <div className="w-full flex justify-center py-6"><PsychomatrixChart data={ result } /></div> }
        { isChaldean && ChaldeanChart && <div className="w-full max-w-2xl py-6"><ChaldeanChart result={ result } /></div> }
        <div className="w-full"><AppFooter view="charts" /></div>
      </div>
    );
  }

  // ─── Mobile layout ─────────────────────────────────────────────────────────────
  if ( isMobileViewport ) {
    const mobileAllTypes = [ ...visibleNumTypes, ...( astroAvailable ? ahdTypes : [] ), ...( easternAvailable ? easternTypes : [] ) ];
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-[var(--paper)]">
        <MobileDesktopBanner />
        <div className="px-4 py-6 space-y-6">
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mute)]">Select Chart Type</p>
            <div className="relative">
              <select
                value={ activeChartType }
                onChange={ ( e ) => {
                  const type = mobileAllTypes.find( t => t.id === e.target.value );
                  if ( type ) selectType( type );
                } }
                className="w-full bg-[var(--card)] border border-[var(--hair)] px-4 py-3 text-xs font-bold uppercase tracking-widest text-[var(--ink)] appearance-none focus:outline-none focus:border-[var(--indigo)] transition-colors"
                style={{ borderRadius: 'var(--radius-card,0px)' }}
              >
                { visibleNumTypes.length > 0 && (
                  <optgroup label="Numerology">
                    { visibleNumTypes.map( type => <option key={ type.id } value={ type.id }>{ type.label }</option> ) }
                  </optgroup>
                ) }
                { astroAvailable && ahdTypes.length > 0 && (
                  <optgroup label="Astrology + Human Design">
                    { ahdTypes.map( type => <option key={ type.id } value={ type.id }>{ type.label }</option> ) }
                  </optgroup>
                ) }
                { easternAvailable && easternTypes.length > 0 && (
                  <optgroup label="Eastern Systems">
                    { easternTypes.map( type => <option key={ type.id } value={ type.id }>{ type.label }</option> ) }
                  </optgroup>
                ) }
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--mute)]">
                <ChevronDown size={ 14 } />
              </div>
            </div>
          </div>

          { isLoggedIn && ( savedCharts || [] ).length > 0 && !isAstroHDType && !isEasternType && (
            <SavedChartPicker savedCharts={ savedCharts } onLoad={ loadSavedChart } allChartTypes={ allChartTypes } />
          ) }

          <div className="bg-[var(--card)] border border-[var(--hair)] p-5 space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-normal italic tracking-tight text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>{ activeType?.label }</h2>
              <p className="text-[10px] uppercase tracking-widest text-[var(--mute)] font-bold">Calculation Details</p>
            </div>

            { isLoggedIn && (
              <PersonSelector
                people={ people } selectedId={ currentPersonId }
                onSelect={ setCurrentPersonId }
                onBirthdateChange={ setBirthdate }
                onNameChange={ setName }
                onKnownNameChange={ setKnownName }
                onBirthDataChange={ d => { setBirthTime( d.birth_time ); setBirthLat( d.birth_lat ); setBirthLng( d.birth_lng ); setBirthTimezone( d.birth_timezone ); } }
                profileIdentity={ profileIdentity }
                savePerson={ savePerson } deletePerson={ deletePerson } loadPeople={ loadPeople }
              />
            ) }

            { !isAstroHDType && !isEasternType && <InputFields activeChartType={ activeChartType } birthdate={ birthdate } setBirthdate={ setBirthdate } name={ name } setName={ setName } knownName={ knownName } setKnownName={ setKnownName } nameB={ nameB } setNameB={ setNameB } hideBirthdate={ hideBirthdate } /> }
            { isWhereToLive && <LocationRowsInput birthdate={ birthdate } setBirthdate={ setBirthdate } rows={ locationRows } setRows={ setLocationRows } person={ currentPersonId === null ? { city: profileIdentity?.city||'', region: profileIdentity?.region||'', country: profileIdentity?.country||'' } : ( people||[] ).find( p => p.id === currentPersonId ) || {} } /> }
            { error && <p className="text-red-500 text-xs italic">{ error }</p> }
            { !isAstroHDType && isChartPremium && ( !isLoggedIn || freeRemaining < ahdCreditCost ) && (
              <div className="p-4 bg-amber-500/10 border border-amber-400/20 text-center space-y-3 rounded-lg my-2">
                <div className="text-xl">✨</div>
                <h4 className="text-sm font-bold text-[var(--gold)] uppercase tracking-wider">Credits Needed</h4>
                <p className="text-xs text-[var(--mute)] leading-relaxed">
                  This premium reading costs { ahdCreditCost } credit{ ahdCreditCost !== 1 ? 's' : '' }. Please get credits or become a member to view your personalized chart.
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  { !isLoggedIn ? (
                    <button
                      type="button"
                      onClick={ openLoginModal }
                      className="w-full py-2 bg-[var(--indigo)] hover:opacity-90 text-[var(--btn-fg)] text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                      Sign In / Register
                    </button>
                  ) : (
                    <>
                      { buyCreditsUrl && (
                        <a
                          href={ buyCreditsUrl }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2 bg-[var(--gold)] hover:opacity-90 text-black text-center text-[10px] font-bold uppercase tracking-wider transition-all block font-semibold"
                          style={{ textDecoration: 'none' }}
                        >
                          Get Credits
                        </a>
                      ) }
                      { becomeMemberUrl && (
                        <a
                          href={ becomeMemberUrl }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2 bg-indigo-700 hover:opacity-90 text-white text-center text-[10px] font-bold uppercase tracking-wider transition-all block font-semibold"
                          style={{ textDecoration: 'none' }}
                        >
                          Become a Member
                        </a>
                      ) }
                    </>
                  ) }
                </div>
              </div>
            ) }

            { ( isAstroHDType || isEasternType || !isChartPremium || ( isLoggedIn && freeRemaining >= ahdCreditCost ) ) && (
              <>
                { isChartPremium && !isAstroHDType && (
                  <p className="text-[10px] text-[var(--gold)] text-center -mb-1 font-bold uppercase tracking-widest">
                    <Lock size={ 9 } className="inline mr-1 mb-px" /> Premium chart — costs { ahdCreditCost } credit{ ahdCreditCost !== 1 ? 's' : '' }
                  </p>
                ) }
                <button
                  type="button"
                  onClick={ handleCalculate }
                  className="w-full py-3 bg-[var(--indigo)] hover:opacity-90 text-[var(--btn-fg)] text-xs font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  { isChartPremium && !isAstroHDType && <Lock size={ 13 } /> }
                  Calculate Reading
                </button>
              </>
            ) }
          </div>

          { /* AstroHD result (shown regardless of numerology result state) */ }
          { isAstroHDType && astroAvailable && AstroHDCenterPaneComp && ( ahdNeedsPurchase ? ahdPurchaseGate : (
            <div className="space-y-6">
              <div className="bg-[var(--card)] border border-[var(--hair)] p-4 min-h-[400px] flex flex-col">
                <AstroHDCenterPaneComp
                  chartTypeId={ activeChartType }
                  birthdate={ birthdate } birthTime={ birthTime }
                  birthLat={ birthLat } birthLng={ birthLng } birthTimezone={ birthTimezone }
                  personKey={ `${ activeChartType }-${ currentPersonId }-${ triggerCalc }` }
                  triggerCalc={ triggerCalc }
                  onChartReady={ d => { setAhdChartData( d ); setChartResult?.( d, currentInput, 'astrohd', activeChartType ); setEntitlementsTick( t => t + 1 ); } }
                  people={ people } profileIdentity={ profileIdentity }
                  isMyself={ isMyselfSelected }
                />
              </div>
              { AstroHDPanelComp && <AstroHDPanelComp chartData={ ahdChartData } activeChart={ activeType } /> }
            </div>
          ) ) }

          { isEasternType && easternAvailable && EasternCenterPaneComp && (
            <div className="space-y-6">
              <div className="bg-[var(--card)] border border-[var(--hair)] p-4 min-h-[400px] flex flex-col">
                <EasternCenterPaneComp
                  chartTypeId={ activeChartType }
                  birthdate={ birthdate } birthTime={ birthTime } birthTimezone={ birthTimezone }
                  personKey={ `${ activeChartType }-${ currentPersonId }-${ triggerCalc }` }
                  triggerCalc={ triggerCalc }
                  onChartReady={ d => { setEasternChartData( d ); setChartResult?.( d, { birthdate, birth_time: birthTime, birth_timezone: birthTimezone, birth_lat: birthLat, birth_lng: birthLng, luck_cycle_polarity: ( isMyselfSelected ? profileIdentity : ( people || [] ).find( p => p.id === currentPersonId ) )?.luck_cycle_polarity || '' }, 'eastern', activeChartType ); } }
                  profileIdentity={ profileIdentity }
                  isMyself={ isMyselfSelected }
                />
              </div>
              { EasternPanelComp && <EasternPanelComp chartData={ easternChartData } activeChart={ activeType } /> }
            </div>
          ) }

          { /* Numerology result */ }
          { !isAstroHDType && !isEasternType && result && (
            <div className="space-y-8 pb-10">
              { !isCalendar && !isPythCore && !isPsychomatrix && !isChaldean && !isWhereToLive && ( activeChartType === 'adn_name' || !isNameType ) && ADNChart && (
                <div className="bg-[var(--card)] border border-[var(--hair)] p-4"><ADNChart chartType={ activeChartType } points={ result } /></div>
              ) }
              { isWhereToLive && WhereToLiveChart && <div className="bg-[var(--card)] border border-[var(--hair)] p-4"><WhereToLiveChart data={ result } /></div> }
              { isCalendar && CalendarGrid && ( () => {
                const bdP = ( result.birth_date || '' ).split('/');
                const bm2 = parseInt(bdP[0],10), bd2 = parseInt(bdP[1],10), by2 = parseInt(bdP[2],10);
                const curY = today.getFullYear();
                const yrs = [];
                if ( calcPersYear && admPersonalYear ) for (let yr=curY; yr<=curY+5; yr++) yrs.push({ year:yr, pyth: calcPersYear(bm2,bd2,yr), adm: admPersonalYear(bd2,bm2,by2,yr) });
                return (
                  <div className="overflow-x-auto no-scrollbar">
                    <div className="flex gap-2 min-w-max pb-1">
                      { yrs.map((row,i) => <div key={row.year} className={`flex flex-col items-center gap-1 px-4 py-3 border ${i===0?'border-[var(--indigo)] bg-[var(--indigo)]/5':'border-[var(--hair)] bg-[var(--card)]'}`}><span className={`text-[9px] font-bold tracking-widest uppercase ${i===0?'text-[var(--indigo)]':'text-[var(--mute)]'}`}>{row.year}</span><div className="flex items-center gap-1.5"><span className={`text-xl font-light italic ${i===0?'text-[var(--ink)]':'text-[var(--mute)]'}`} style={{fontFamily:'var(--font-display)'}}>{row.pyth}</span><span className="text-[var(--hair)]">·</span><span className={`text-xl font-light italic ${i===0?'text-[var(--indigo)]':'text-[var(--mute)]'}`} style={{fontFamily:'var(--font-display)'}}>{row.adm}</span></div></div>) }
                    </div>
                  </div>
                );
              } )() }
              { isCalendar && CalendarGrid && <CalendarGrid calendarData={ result } hideHeader /> }
              { isPythCore && PythagoreanCoreChart && <PythagoreanCoreChart data={ result } showCompounds={ showCompounds } /> }
              { isPsychomatrix && PsychomatrixChart && <PsychomatrixChart data={ result } /> }
              { isChaldean && ChaldeanChart && <ChaldeanChart result={ result } /> }
              { isNameType && !COMPARE_TYPES.includes( activeChartType ) && <NameResult result={ result } /> }
              { COMPARE_TYPES.includes( activeChartType ) && <CompareResult result={ result } /> }

              <div className="w-full flex justify-center">
                <ReportButton chartType={ activeChartType } system={ activeSystem } inputData={ { ...currentInput, name: currentInput?.name || currentPersonName } } points={ result } notesDraft={ notesDraft } reportPresets={ reportPresets || [] } exportChartPDF={ exportChartPDF } />
              </div>
              { /* Interpretation lives in the right drawer (resolved from the unified engine, click-scoped). */ }
            </div>
          ) }
        </div>
      </div>
    );
  }

  // ─── Desktop 3-panel layout ────────────────────────────────────────────────────
  const ahdBadges = { ahd_natal:'HD', ahd_transit:'NOW', ahd_transit_birth:'HD', ahd_combined:'ASTROHD', ahd_connection:'SYNTH' };

  return (
    <div className="flex h-full overflow-hidden bg-[var(--paper)] relative">

      { /* ── Left Sidebar ── */ }
      <aside className={ `flex-shrink-0 flex flex-col border-r border-[var(--hair)] bg-[var(--paper)] transition-all duration-300 overflow-hidden ${ sidebarOpen ? 'w-72' : 'w-14' }` }>
        <div className={ `flex items-center shrink-0 border-b border-[var(--hair)] ${ sidebarOpen ? 'px-5 py-4 justify-between' : 'px-0 py-4 justify-center' }` }>
          { sidebarOpen && (
            <div className="flex items-center gap-2">
              { ( result || activeChartType || navSystem ) && (
                <button onClick={ goBackToLanding } title="Back to landing" className="p-1 text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--hair)] transition-all">
                  <ChevronLeft size={ 13 } />
                </button>
              ) }
              <button onClick={ goBackToLanding } title="Back to landing" className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] hover:text-[var(--ink)] transition-colors focus:outline-none" style={{ cursor: ( result || activeChartType || navSystem ) ? 'pointer' : 'default' }}>
                { result ? 'Chart Type' : 'Charts' }
              </button>
            </div>
          ) }
          <button onClick={ () => setSidebarOpen( p => !p ) } className="p-1.5 text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--hair)] transition-all" title={ sidebarOpen ? 'Collapse' : 'Expand' }>{ sidebarOpen ? <ChevronLeft size={ 14 } /> : <ChevronRight size={ 14 } /> }</button>
        </div>
        { !sidebarOpen && (
          <div className="flex flex-col items-center pt-3 gap-2 px-2 flex-1">
            { navSystems.map( s => (
              <button key={ s.id } title={ s.nm }
                onClick={ () => { setSidebarOpen( true ); setNavSystem( s.id ); } }
                className={ `dsb-strip-icon ${ s.tc }` } style={{ cursor:'pointer' }}>{ s.tag }</button>
            ) ) }
          </div>
        ) }
        { sidebarOpen && (
          <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
            <div className="pt-2 pb-1">
              { !navSystem ? (
                /* ── system list ── */
                <div className="dsb-sys-list">
                  { navSystems.map( s => (
                    <div key={ s.id } className="dsb-sys-tile" onClick={ () => setNavSystem( s.id ) }>
                      <span className={ `tc ${ s.tc }` }>{ s.tag }</span>
                      <div className="info">
                        <div className="nm">{ s.nm }</div>
                        <div className="ct">{ s.count } chart{ s.count !== 1 ? 's' : '' }</div>
                      </div>
                      <span className="arr">›</span>
                    </div>
                  ) ) }
                </div>
              ) : (
                /* ── drilled-in chart list ── */
                <div className="dsb-chart-list">
                  <button className="dsb-back" onClick={ () => setNavSystem( null ) }>
                    <span className="ba">‹</span><span className="blab">All Systems</span>
                  </button>
                  { ( navSystems.find( s => s.id === navSystem )?.groups || [] ).map( g => (
                    g.types.length ? (
                      <div key={ g.lbl }>
                        <div className="dsb-grp-label">{ g.lbl }</div>
                        { g.types.map( t => { const active = activeChartType === t.id; const prem = typePremiumMeta( t ); return (
                          <div key={ t.id } className={ `dsb-chart-row${ active ? ' active' : '' }` } onClick={ () => selectType( t ) } style={{ display: 'flex', alignItems: 'center' }}>
                            <span className="cn">{ t.label }</span>
                            { prem && (
                              <span title={ `Premium — ${ prem.cost } credit${ prem.cost !== 1 ? 's' : '' }` } style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3 }} className="text-[9px] font-bold uppercase tracking-wider text-[var(--mute)]">
                                <Lock size={ 9 } /> { prem.cost > 0 ? `${ prem.cost } cr` : 'Pro' }
                              </span>
                            ) }
                          </div>
                        ); } ) }
                      </div>
                    ) : null
                  ) ) }
                </div>
              ) }
            </div>
            <form onSubmit={ handleCalculate } className="border-t border-[var(--hair)] px-5 py-5 pb-10 flex flex-col gap-5">
              { isLoggedIn && ( savedCharts || [] ).length > 0 && !isAstroHDType && !isEasternType && <SavedChartPicker savedCharts={ savedCharts } onLoad={ loadSavedChart } allChartTypes={ allChartTypes } /> }
              { !isAstroHDType && !isEasternType && <div className="space-y-1"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mute)]">{ activeType?.shortLabel || activeType?.label || '' }</p><p className="text-[var(--mute)] text-[11px] leading-relaxed italic opacity-80">{ activeType?.desc || '' }</p></div> }
              { isEasternType && <div className="space-y-1"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mute)]">{ activeType?.shortLabel || activeType?.label || '' }</p><p className="text-[var(--mute)] text-[11px] leading-relaxed italic opacity-80">{ activeType?.desc || '' }</p></div> }
              { isLoggedIn && <PersonSelector people={ people } selectedId={ currentPersonId } onSelect={ setCurrentPersonId } onBirthdateChange={ setBirthdate } onNameChange={ setName } onKnownNameChange={ setKnownName } onBirthDataChange={ d => { setBirthTime(d.birth_time); setBirthLat(d.birth_lat); setBirthLng(d.birth_lng); setBirthTimezone(d.birth_timezone); } } profileIdentity={ profileIdentity } savePerson={ savePerson } deletePerson={ deletePerson } loadPeople={ loadPeople } /> }
              { !isAstroHDType && !isEasternType && <InputFields activeChartType={ activeChartType } birthdate={ birthdate } setBirthdate={ setBirthdate } name={ name } setName={ setName } knownName={ knownName } setKnownName={ setKnownName } nameB={ nameB } setNameB={ setNameB } hideBirthdate={ hideBirthdate } /> }
              { isWhereToLive && <LocationRowsInput birthdate={ birthdate } setBirthdate={ setBirthdate } rows={ locationRows } setRows={ setLocationRows } person={ currentPersonId === null ? { city: profileIdentity?.city||'', region: profileIdentity?.region||'', country: profileIdentity?.country||'' } : ( people||[] ).find( p => p.id === currentPersonId ) || {} } /> }
              { error && <p className="text-red-500 text-xs italic">{ error }</p> }
              { !isAstroHDType && !isEasternType && isChartPremium && freeRemaining === 0 && <p className="text-[10px] text-[var(--gold)] text-center font-bold uppercase tracking-widest"><Lock size={ 9 } className="inline mr-1 mb-px" /> Premium · { creditCost } credit{ creditCost !== 1 ? 's' : '' }</p> }
              <button
                type={ ( isAstroHDType || isEasternType ) ? 'button' : 'submit' }
                onClick={ ( isAstroHDType || isEasternType ) ? proceedCalc : undefined }
                className="mb-4 py-3 bg-[var(--indigo)] hover:opacity-90 text-[var(--btn-fg)] text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
              >
                { !isAstroHDType && !isEasternType && isChartPremium && freeRemaining === 0 && <Lock size={ 11 } /> }
                Calculate
              </button>
            </form>
          </div>
        ) }
      </aside>

      { /* ── Center Canvas ── */ }
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--paper)]">
        { isAstroHDType && AstroHDCenterPaneComp ? ( ahdNeedsPurchase ? ahdPurchaseGate : (
          <AstroHDCenterPaneComp
            chartTypeId={ activeChartType }
            birthdate={ birthdate } birthTime={ birthTime } birthLat={ birthLat } birthLng={ birthLng } birthTimezone={ birthTimezone }
            personKey={ `${ currentPersonId ?? 'myself' }-${ birthdate }-${ birthLat }` }
            triggerCalc={ triggerCalc }
            onChartReady={ d => { setAhdChartData( d ); setEntitlementsTick( t => t + 1 ); } }
            people={ people }
            profileIdentity={ profileIdentity }
            isMyself={ isMyselfSelected }
          />
        ) ) : isEasternType && EasternCenterPaneComp ? (
          <EasternCenterPaneComp
            chartTypeId={ activeChartType }
            birthdate={ birthdate } birthTime={ birthTime } birthTimezone={ birthTimezone }
            personKey={ `${ currentPersonId ?? 'myself' }-${ birthdate }-${ birthTimezone }` }
            triggerCalc={ triggerCalc }
            onChartReady={ d => { setEasternChartData( d ); setChartResult?.( d, { birthdate, birth_time: birthTime, birth_timezone: birthTimezone, birth_lat: birthLat, birth_lng: birthLng, luck_cycle_polarity: ( isMyselfSelected ? profileIdentity : ( people || [] ).find( p => p.id === currentPersonId ) )?.luck_cycle_polarity || '' }, 'eastern', activeChartType ); } }
            profileIdentity={ profileIdentity }
            isMyself={ isMyselfSelected }
          />
        ) : result ? (
          renderNumCenter()
        ) : (
          <ChartsLandingPane visibleChartTypes={ visibleNumTypes } ahdTypes={ astroAvailable ? ahdTypes : [] } easternTypes={ easternAvailable ? easternTypes : [] } selectType={ selectType } premiumMetaFor={ typePremiumMeta } />
        ) }

        { result && !isAstroHDType && !isEasternType && (
          <div className="shrink-0 border-t border-[var(--hair)] bg-[var(--paper)] px-8 py-4 flex items-center gap-3 justify-end flex-wrap">
            { isCalendar && <>
              <button onClick={ () => downloadCalendarCSV( result, currentInput?.birthdate ) } className="flex items-center gap-2 px-5 py-2 text-[10px] text-[var(--mute)] hover:text-[var(--ink)] bg-[var(--card)] hover:bg-[var(--hair)] border border-[var(--hair)] transition-colors font-bold uppercase tracking-widest"><Download size={ 13 } /> CSV</button>
              <button onClick={ () => downloadCalendarICS( result, currentInput?.birthdate ) } className="flex items-center gap-2 px-5 py-2 text-[10px] text-[var(--mute)] hover:text-[var(--ink)] bg-[var(--card)] hover:bg-[var(--hair)] border border-[var(--hair)] transition-colors font-bold uppercase tracking-widest"><Download size={ 13 } /> ICS</button>
            </> }
            <ReportButton chartType={ activeChartType } system={ activeSystem } inputData={ { ...currentInput, name: currentInput?.name || currentPersonName } } points={ result } notesDraft={ notesDraft } reportPresets={ reportPresets || [] } exportChartPDF={ exportChartPDF } compact />
          </div>
        ) }
      </main>

      { /* ── Reopen handle — shown only when the drawer is closed ── */ }
      { !drawerOpen && (
        <button onClick={ () => setDrawerOpen( true ) } title="Open interpretation"
          className="shrink-0 w-9 border-l border-[var(--hair)] bg-[var(--paper-2)] hover:bg-[var(--card)] flex flex-col items-center justify-center gap-3 transition-colors">
          <ChevronLeft size={ 14 } className="text-[var(--mute)]" />
          <span style={{ writingMode:'vertical-rl', transform:'rotate(180deg)', fontSize:9, fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mute)' }}>Reading</span>
          <BookOpen size={ 13 } className="text-[var(--indigo)]" />
        </button>
      ) }

      { /* ── Right Panel — Interpretation (slide-out drawer) ── */ }
      <aside className={ `border-l border-[var(--hair)] bg-[var(--paper-2)] overflow-hidden flex flex-col h-full shrink-0 transition-all duration-300 ${ drawerOpen ? 'w-96' : 'w-0 border-l-0' }` }>
        <div className="px-6 py-4 border-b border-[var(--hair)] shrink-0 flex items-center justify-between">
          <div>
            <h2 style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:15, color:'var(--ink)', fontWeight:400, lineHeight:1.1, margin:0 }}>Reading</h2>
            <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mute)', opacity:0.55, marginTop:3, marginBottom:0 }}>Interpretation</p>
          </div>
          <div className="flex items-center gap-2">
            { result && !isAstroHDType && !isEasternType && <ReportButton chartType={ activeChartType } system={ activeSystem } inputData={ { ...currentInput, name: currentInput?.name || currentPersonName } } points={ result } notesDraft={ notesDraft } reportPresets={ reportPresets || [] } exportChartPDF={ exportChartPDF } compact /> }
            <button onClick={ () => setDrawerOpen( false ) } title="Close" className="p-1 text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--hair)] transition-all"><ChevronRight size={ 14 } /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 no-scrollbar">
          { isAstroHDType && AstroHDPanelComp && <AstroHDPanelComp chartData={ ahdChartData } activeChart={ activeType } /> }
          { isEasternType && EasternPanelComp && <EasternPanelComp chartData={ easternChartData } activeChart={ activeType } /> }
          { !isAstroHDType && !isEasternType && !result && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 px-8 space-y-4">
              <Sparkles size={ 24 } className="text-[var(--ink)]" />
              <p className="text-xs italic leading-relaxed" style={{ fontFamily:'var(--font-display)' }}>Calculate a chart to view the detailed interpretation here.</p>
            </div>
          ) }
          { !isAstroHDType && !isEasternType && result && (
            <div className="space-y-10 pb-20">
              { activeSystem === 'adn' && !isNameType && !isCalendar && ADNInterpretation && (
                <ADNInterpretation points={ result } highlightedPoint={ highlightedPoint } onHighlight={ k => { setHighlightedPoint(k); setLastActionSource('sidebar'); } } lastActionSource={ lastActionSource } activeChartType={ activeChartType } />
              ) }
              { activeSystem === 'adn' && isNameType && !isCalendar && NameInterpretation && (
                <NameInterpretation nameData={ result } highlightedPoint={ highlightedPoint } onHighlight={ k => { setHighlightedPoint(k); setLastActionSource('sidebar'); } } lastActionSource={ lastActionSource } />
              ) }
              { isPythCore && PythagoreanCoreInterpretation && <PythagoreanCoreInterpretation data={ result } showCompounds={ showCompounds } initialPosition={ selectedPythPos } /> }
            </div>
          ) }
        </div>
      </aside>

      { !isLoggedIn && (
        <div className="absolute inset-0 z-50 bg-[var(--paper)]/70 backdrop-blur-sm flex items-center justify-center p-6" style={{ pointerEvents: 'auto' }}>
          <div className="bg-[var(--card)] border border-[var(--hair)] p-12 text-center max-w-md shadow-2xl" style={{ borderRadius: 'var(--radius-card, 0px)' }}>
            <div className="modal-logo mb-2">Luna<b>Co</b></div>
            <div className="modal-sub mb-6">Natal intelligence · Your chart awaits</div>
            <h3 className="text-xl font-medium text-[var(--ink)] mb-4" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>Access Premium Charts</h3>
            
            { signupPromoText && (
              <div
                style={{
                  padding: '12px',
                  border: '1px solid var(--gold)',
                  background: 'color-mix(in srgb, var(--gold) 5%, transparent)',
                  color: 'var(--gold)',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                  textAlign: 'center',
                  marginBottom: '20px',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                { signupPromoText }
              </div>
            ) }

            <p className="text-[var(--ink)] opacity-60 text-sm mb-8">
              Sign in or create a free account to calculate your Astrology Map, Human Design Bodygraph, and Eastern charts.
            </p>
            <button
              onClick={ openLoginModal }
              className="w-full py-3.5 bg-[var(--ink)] hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] text-[var(--paper)] font-bold uppercase tracking-wider text-xs transition-colors"
            >
              Sign In to Your Account
            </button>
          </div>
        </div>
      ) }
    </div>
  );
}

// ─── CoreChartsView ───────────────────────────────────────────────────────────

export default function CoreChartsView( { isMobileViewport, setView, routeParam } ) {
  // Charts is a CORE view. The numerology module, when active, provides extra
  // context (its own chart state + saved-chart APIs) — so wrap in its provider
  // if present. When it isn't active, render directly so AstroHD/Eastern charts
  // still work on their own.
  const NumerologyProvider = window.LunaCcoNumerologyModule?.NumerologyProvider;
  const inner = <CoreChartsViewInner isMobileViewport={ isMobileViewport } setView={ setView } routeParam={ routeParam } />;

  return NumerologyProvider ? <NumerologyProvider>{ inner }</NumerologyProvider> : inner;
}
