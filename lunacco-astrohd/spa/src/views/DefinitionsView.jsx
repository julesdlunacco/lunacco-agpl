/**
 * AstroHD Definitions — markdown-based editor.
 *
 * Single textarea per item. Content uses ### headers:
 *   ### Short / ### Long / ### Keywords  — always present
 *   ### Defined / ### Undefined          — Centers only
 *   ### Fixed / ### Mutable / ### Cardinal — Profiles only
 *   ### Direction / ### Color / ### Tone — Variable Arrows
 *   ### HD Role                          — HD Planets
 *   ### Axis Pair / ### Significance     — HD Angles
 *
 * On save: Short/Long/Keywords → DB columns; all other headers → extra_meta JSON.
 * Structured extra_meta fields (stream, line modalities etc.) are preserved across saves.
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Database, Plus, X, Save, Eye, EyeOff, FileText, Sparkles, Star, Search,
  Upload, Download, Copy, ChevronDown, Check, Info, Trash2, Pencil,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_LABELS = {
  hd_gates:               'Gates',
  hd_channels:            'Channels',
  hd_centers:             'Centers',
  hd_types:               'Types',
  hd_authorities:         'Authorities (Ego, etc.)',
  hd_profiles:            'Profiles',
  hd_lines:               'Lines',
  hd_incarnation_crosses: 'Incarnation Crosses',
  hd_variables:           'Variable Arrows',
  hd_circuitry:           'Circuitry',
  hd_definition_types:    'Definition Types',
  hd_destiny_points:      'Destiny Points',
  hd_planets:             'HD Planets',
  hd_angles_points:       'HD Angles & Points',
  astro_planets:          'Planets',
  astro_signs:            'Signs',
  astro_houses:           'Houses',
  astro_aspects:          'Aspects',
  astro_angles_points:    'Angles & Points',
  astro_elements:         'Elements',
  astro_modalities:       'Modalities',
  astro_asteroids:        'Asteroids',
};

const HD_SECTIONS    = Object.keys( SECTION_LABELS ).filter( k => k.startsWith( 'hd_' ) );
const ASTRO_SECTIONS = Object.keys( SECTION_LABELS ).filter( k => k.startsWith( 'astro_' ) );

// Structured (non-text) extra_meta fields to preserve — never parsed from textarea
const STRUCTURED_KEYS = new Set( [
  'stream', 'color', 'tone', 'color_name', 'tone_name',
  'line_1_modality', 'line_2_modality', 'gate_affinity', 'hd_role',
] );

const MAX_TOKENS_OPTIONS = [ 512, 1024, 2048, 4096 ];

// ── REST helpers ──────────────────────────────────────────────────────────────

const REST_ROOT = ( () => {
  const d = window.LunaCcoData || {};
  return ( d.root || '/wp-json/' ).replace( /\/$/, '' ) + '/';
} )();
const NONCE = ( window.LunaCcoData || {} ).nonce || '';

async function fetchJSON( path, init = {} ) {
  const res = await fetch( REST_ROOT + path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': NONCE,
      ...( init.headers || {} ),
    },
  } );
  if ( ! res.ok ) {
    const body = await res.text();
    throw new Error( body || `${ res.status } ${ res.statusText }` );
  }
  return res.json();
}

// ── Markdown content helpers ──────────────────────────────────────────────────

/**
 * Build the textarea content string from a DB row.
 * Includes Short/Long/Keywords then any extra_meta text fields for this section type.
 */
function buildContent( row ) {
  // Just return the long_text which now holds the entire markdown block
  return ( row.long_text || '' ).trim();
}

/**
 * Parse textarea content back into DB fields.
 * Returns { short_text, long_text, keywords, extraText } where extraText holds
 * the other ### sections as { field_key: text }.
 */
function parseContent( content ) {
  // No more destructive parsing into columns. 
  // We send the whole block to the backend.
  return {
    short_text: '', // backend can extract if needed
    long_text: content,
    keywords: '',
    extraText: {},
  };
}

/** Build template content for a given section type. */
function buildTemplate( sectionType ) {
  return `### Short\n\n### Long\n\n#### **What It Is**\n\n#### **The Gift**\n\n#### **The Shadow**\n\n#### **How to Work With It**\n\n### Keywords`;
}

function isFilled( row ) {
  return !! ( row.short_text || row.long_text );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const SS = {
  background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--hair)',
  padding: '0.5rem 0.75rem', fontSize: '0.8125rem', outline: 'none', cursor: 'pointer',
};

function Modal( { title, onClose, children, wide = false } ) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--ink)]/40 backdrop-blur-sm">
      <div className={ `bg-[var(--paper)] border border-[var(--hair)] w-full ${ wide ? 'max-w-2xl' : 'max-w-lg' } max-h-[90vh] overflow-y-auto p-8 space-y-6` }>
        <div className="flex items-center justify-between pb-4 border-b border-[var(--hair)]">
          <h3 className="text-[var(--ink)] font-normal italic text-2xl" style={{ fontFamily: 'var(--font-display)' }}>{ title }</h3>
          <button onClick={ onClose } className="p-2 text-[var(--mute)] hover:text-[var(--ink)] transition-colors"><X size={ 20 } /></button>
        </div>
        <div className="space-y-6">{ children }</div>
      </div>
    </div>
  );
}

function Field( { label, children } ) {
  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mute)]">{ label }</label>
      { children }
    </div>
  );
}

function Btn( { children, onClick, variant = 'ghost', size = 'sm', disabled = false, className = '', type = 'button', title } ) {
  const base     = 'inline-flex items-center gap-2 font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed';
  const sizes    = { sm: 'text-[10px] px-3 py-1.5', md: 'text-[10px] px-5 py-2.5', icon: 'p-2' };
  const variants = {
    ghost:   'text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--hair)]',
    primary: 'bg-[var(--indigo)] hover:opacity-90 text-[var(--btn-fg)]',
    danger:  'text-red-500 hover:bg-red-500/10',
    outline: 'border border-[var(--hair)] text-[var(--mute)] hover:text-[var(--ink)] hover:border-[var(--mute)] bg-[var(--card)]',
  };
  return (
    <button type={ type } onClick={ onClick } disabled={ disabled } title={ title }
      className={ `${ base } ${ sizes[ size ] } ${ variants[ variant ] } ${ className }` }>
      { children }
    </button>
  );
}

// ── Model Picker Modal ────────────────────────────────────────────────────────

function ModelPickerModal( { activeItem, onClose, onGenerate } ) {
  const [ models,        setModels        ] = useState( [] );
  const [ loading,       setLoading       ] = useState( false );
  const [ loaded,        setLoaded        ] = useState( false );
  const [ search,        setSearch        ] = useState( '' );
  const [ showAll,       setShowAll       ] = useState( false );
  const [ selectedModel, setSelectedModel ] = useState( '' );
  const [ maxTokens,     setMaxTokens     ] = useState( 2048 );
  const [ extraInstr,    setExtraInstr    ] = useState( '' );

  const favorites = useMemo( () => {
    const f = ( window.LunaCcoData?.ai_favorite_models || '' );
    return f ? f.split( ',' ).map( s => s.trim() ).filter( Boolean ) : [];
  }, [] );

  useEffect( () => {
    if ( favorites.length ) setSelectedModel( favorites[0] );
    loadModels();
  }, [] ); // eslint-disable-line

  async function loadModels() {
    setLoading( true );
    try {
      const data = await fetchJSON( 'luna-astrohd/v1/ai-models' );
      setModels( Array.isArray( data ) ? data : [] );
      setLoaded( true );
    } catch {
      setLoaded( true );
    } finally {
      setLoading( false );
    }
  }

  const favSet       = new Set( favorites );
  const filtered     = models.filter( m =>
    m.id?.toLowerCase().includes( search.toLowerCase() ) ||
    m.name?.toLowerCase().includes( search.toLowerCase() )
  );
  const favModels    = filtered.filter( m => favSet.has( m.id ) );
  const otherModels  = filtered.filter( m => ! favSet.has( m.id ) );
  const displayList  = showAll ? [ ...favModels, ...otherModels ] : favModels;

  return (
    <Modal title="Generate Content" onClose={ onClose } wide>
      <div className="space-y-6">

        { activeItem && (
          <div className="bg-[var(--card)] border border-[var(--hair)] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--ink)]">{ activeItem.title }</span>
            <span className="ml-2 text-[10px] text-[var(--mute)] opacity-60">{ SECTION_LABELS[ activeItem.section_type ] || activeItem.section_type }</span>
          </div>
        ) }

        <Field label="Intelligence Model">
          <div className="space-y-3">
            <input value={ search } onChange={ e => setSearch( e.target.value ) }
              placeholder="Search models…"
              className="w-full bg-[var(--card)] border border-[var(--hair)] px-4 py-2.5 text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--indigo)] transition-all" />
            { loading && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--mute)] animate-pulse">Loading models…</p>
            ) }
            <div className="max-h-52 overflow-y-auto border border-[var(--hair)] bg-[var(--card)] no-scrollbar">
              { favModels.length > 0 && (
                <div className="px-4 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--gold)] bg-[var(--gold)]/5 border-b border-[var(--hair)]">
                  ★ Pinned Models
                </div>
              ) }
              { displayList.map( m => (
                <button key={ m.id } onClick={ () => setSelectedModel( m.id ) }
                  className={ `w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-between gap-4 border-b border-[var(--hair)] last:border-0 ${ selectedModel === m.id ? 'bg-[var(--indigo)]/10 text-[var(--indigo)]' : 'text-[var(--mute)] hover:bg-[var(--hair)]' }` }>
                  <span className="truncate">{ m.id }</span>
                  { favSet.has( m.id ) && <Star size={ 12 } className="text-[var(--gold)] shrink-0" fill="currentColor" /> }
                </button>
              ) ) }
              { loaded && displayList.length === 0 && (
                <p className="text-[var(--mute)] text-xs italic px-4 py-6 text-center">
                  { models.length === 0 ? 'No OpenRouter key configured, or no models available.' : 'No matching models.' }
                </p>
              ) }
            </div>
            <label className="flex items-center gap-3 text-xs text-[var(--mute)] cursor-pointer">
              <input type="checkbox" checked={ showAll } onChange={ e => setShowAll( e.target.checked ) } className="accent-[var(--indigo)] w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Show full model library</span>
            </label>
          </div>
        </Field>

        <Field label="Complexity (Max Tokens)">
          <select value={ maxTokens } onChange={ e => setMaxTokens( Number( e.target.value ) ) }
            style={{ ...SS, width: '100%', padding: '0.75rem' }}>
            { MAX_TOKENS_OPTIONS.map( n => <option key={ n } value={ n }>{ n.toLocaleString() } tokens</option> ) }
          </select>
        </Field>

        <Field label="Custom Directive (Optional)">
          <textarea value={ extraInstr } onChange={ e => setExtraInstr( e.target.value ) }
            rows={ 3 }
            placeholder="e.g. Use a contemplative, esoteric tone. Focus on shadow aspects."
            className="w-full bg-[var(--card)] border border-[var(--hair)] p-4 text-[var(--ink)] text-sm placeholder-[var(--mute)] italic focus:outline-none focus:border-[var(--indigo)] transition-all resize-none" />
        </Field>

        <div className="flex gap-4 pt-4 border-t border-[var(--hair)]">
          <Btn onClick={ () => onGenerate( selectedModel, maxTokens, extraInstr ) }
            disabled={ ! selectedModel }
            variant="primary" size="md" className="flex-1">
            <Sparkles size={ 14 } /> Generate
          </Btn>
          <Btn onClick={ onClose } variant="outline" size="md">Cancel</Btn>
        </div>

      </div>
    </Modal>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function DefinitionsView() {
  const [ setSource,   setSetSource   ] = useState( 'legacy' );
  const [ sets,        setSets        ] = useState( [] );
  const [ coreSets,    setCoreSets    ] = useState( [] );
  const [ activeSet,   setActiveSet   ] = useState( null );
  const [ rows,        setRows        ] = useState( [] );
  const [ loading,     setLoading     ] = useState( true );
  const [ setsLoading, setSetsLoading ] = useState( true );
  const [ error,       setError       ] = useState( null );
  const [ active,      setActive      ] = useState( null );
  const [ section,     setSection     ] = useState( 'hd_gates' );
  const [ query,       setQuery       ] = useState( '' );

  // Editor
  const [ content,     setContent     ] = useState( '' );
  const [ isDirty,     setIsDirty     ] = useState( false );
  const [ saving,      setSaving      ] = useState( false );
  const [ saveMsg,     setSaveMsg     ] = useState( '' );
  const [ showPreview, setShowPreview ] = useState( false );

  // AI
  const [ generating,  setGenerating  ] = useState( false );
  const [ genMsg,      setGenMsg      ] = useState( '' );
  const [ modal,       setModal       ] = useState( null ); // 'generate' | 'new-set'

  // Migrate
  const [ migrating,   setMigrating   ] = useState( false );
  const [ migrateMsg, setMigrateMsg ] = useState( '' );
  const [ importTarget, setImportTarget ] = useState( 'astro_asteroids' );
  const [ importText, setImportText ] = useState( '' );
  const [ importResult, setImportResult ] = useState( null );
  const [ importingManifest, setImportingManifest ] = useState( false );
  const [ editSetForm, setEditSetForm ] = useState( { label: '', description: '' } );

  // New set form
  const [ newSet,      setNewSet      ] = useState( { label: '', description: '', category: 'astrohd' } );
  const [ creatingSet, setCreatingSet ] = useState( false );

  // Keep a ref to current extra_meta so we can preserve structured fields on save
  const fileInputRef = useRef( null );
  const activeExtraMetaRef = useRef( null );

  // ── Load sets ──
  useEffect( () => {
    let cancelled = false;
    setSetsLoading( true );
    Promise.all( [
      fetchJSON( 'luna-astrohd/v1/definition-sets' ).catch( () => [] ),
      fetchJSON( 'luna-astrohd/v1/core-definition-sets' ).catch( () => [] ),
    ] )
      .then( ( [ legacyData, coreData ] ) => {
        if ( cancelled ) return;
        const legacyArr = Array.isArray( legacyData ) ? legacyData.map( s => ( { ...s, source: 'legacy' } ) ) : [];
        const coreArr   = Array.isArray( coreData ) ? coreData.map( s => ( { ...s, source: 'core' } ) ) : [];
        setSets( legacyArr );
        setCoreSets( coreArr );
        if ( ! activeSet ) {
          if ( legacyArr.length ) setActiveSet( legacyArr[0] );
          else if ( coreArr.length ) {
            setSetSource( 'core' );
            setActiveSet( coreArr[0] );
          } else setLoading( false );
        }
      } )
      .catch( () => { if ( ! cancelled ) setActiveSet( { id: 0, label: 'Default', is_default: true, source: 'legacy' } ); } )
      .finally( () => { if ( ! cancelled ) setSetsLoading( false ); } );
    return () => { cancelled = true; };
  }, [] ); // eslint-disable-line

  useEffect( () => {
    const available = setSource === 'core' ? coreSets : sets;
    if ( ! available.length ) {
      setActiveSet( null );
      return;
    }
    if ( ! activeSet || activeSet.source !== setSource ) {
      setActiveSet( available[0] );
      return;
    }
    const refreshed = available.find( s => String( s.id ) === String( activeSet.id ) );
    if ( refreshed ) setActiveSet( refreshed );
  }, [ setSource, sets, coreSets ] ); // eslint-disable-line

  // ── Load rows for active set ──
  useEffect( () => {
    if ( activeSet === null ) return;
    let cancelled = false;
    setLoading( true );
    setRows( [] );
    setActive( null );
    const url = activeSet?.source === 'core'
      ? `luna-astrohd/v1/definitions?engine=core&core_set_id=${ activeSet.id }`
      : ( activeSet.id
        ? `luna-astrohd/v1/definitions?set_id=${ activeSet.id }`
        : 'luna-astrohd/v1/definitions' );
    fetchJSON( url )
      .then( data => { if ( ! cancelled ) { setRows( Array.isArray( data ) ? data : [] ); setLoading( false ); } } )
      .catch( e  => { if ( ! cancelled ) { setError( e.message ); setLoading( false ); } } );
    return () => { cancelled = true; };
  }, [ activeSet ] );

  // ── Sync editor when active changes ──
  useEffect( () => {
    if ( active ) {
      setContent( buildContent( active ) );
      activeExtraMetaRef.current = active.extra_meta ? { ...active.extra_meta } : null;
      setIsDirty( false );
      setSaveMsg( '' );
      setGenMsg( '' );
      setShowPreview( false );
    }
  }, [ active ] );

  // ── Derived ──
  const sections = useMemo( () => {
    const counts = {};
    rows.forEach( r => { counts[ r.section_type ] = ( counts[ r.section_type ] || 0 ) + 1; } );
    return Object.entries( counts ).map( ( [ key, count ] ) => ( { key, label: SECTION_LABELS[ key ] || key, count } ) );
  }, [ rows ] );

  const hdSections    = useMemo( () => {
    if ( activeSet?.category === 'astrology' ) return [];
    return sections.filter( s => HD_SECTIONS.includes( s.key ) );
  }, [ sections, activeSet ] );

  const astroSections = useMemo( () => {
    if ( activeSet?.category === 'human_design' ) return [];
    return sections.filter( s => ASTRO_SECTIONS.includes( s.key ) );
  }, [ sections, activeSet ] );

  useEffect( () => {
    if ( sections.length && ! sections.find( s => s.key === section ) ) {
      setSection( sections[0].key );
    }
  }, [ sections ] ); // eslint-disable-line

  useEffect( () => {
    if ( active && active.section_type !== section ) setActive( null );
  }, [ section ] ); // eslint-disable-line

  const filtered = useMemo( () => {
    const q = query.trim().toLowerCase();
    return rows
      .filter( r => r.section_type === section )
      .filter( r => ! q || r.title?.toLowerCase().includes( q ) || r.item_key?.toLowerCase().includes( q ) );
  }, [ rows, section, query ] );

  const availableSets = setSource === 'core' ? coreSets : sets;
  const isCoreActive = activeSet?.source === 'core';

  // ── Save ──
  const handleSave = useCallback( async ( targetItem = null ) => {
    // If targetItem is an event (e.g. from a button click), ignore it and use active
    const itemToSave = ( targetItem && targetItem.id ) ? targetItem : active;
    if ( ! itemToSave ) return;
    if ( activeSet?.source === 'core' ) {
      setSaveMsg( 'Core-backed sets are read-only in this view for now.' );
      return;
    }
    setSaving( true );
    setSaveMsg( '' );
    try {
      const { short_text, long_text, keywords, extraText } = parseContent( content );

      // Merge parsed text headers back into extra_meta, preserving structured fields
      const preserved = activeExtraMetaRef.current || {};
      const merged    = { ...preserved };
      // Write text fields parsed from textarea
      for ( const [ rawKey, val ] of Object.entries( extraText ) ) {
        merged[ rawKey ] = val;
      }
      // Map display-friendly keys to storage keys (e.g. 'hd_role' → 'hd_role')
      const extra_meta = Object.keys( merged ).length ? merged : null;

      const payload = { short_text, long_text, keywords, extra_meta };
      const updated = await fetchJSON( `luna-astrohd/v1/definitions/${ itemToSave.id }`, {
        method: 'PATCH',
        body: JSON.stringify( payload ),
      } );
      setRows( prev => prev.map( r => r.id === itemToSave.id ? { ...r, ...updated } : r ) );
      if ( active?.id === itemToSave.id ) {
        setActive( prev => ( { ...prev, ...updated } ) );
        activeExtraMetaRef.current = updated.extra_meta || null;
      }
      setIsDirty( false );
      setSaveMsg( 'Saved.' );
      setTimeout( () => setSaveMsg( '' ), 2500 );
    } catch ( e ) {
      setSaveMsg( `Error: ${ e.message }` );
    } finally {
      setSaving( false );
    }
  }, [ active, content, activeSet ] );

  const safeSwitch = async ( type, val ) => {
    if ( isDirty && active ) {
      await handleSave();
    }
    if ( type === 'set' )     setActiveSet( val );
    if ( type === 'section' ) setSection( val );
    if ( type === 'item' )    setActive( val );
  };

  // ── Generate ──
  const handleGenerate = useCallback( async ( modelId, maxTokens, extraInstructions ) => {
    if ( ! active ) return;
    if ( activeSet?.source === 'core' ) {
      setGenMsg( 'Core-backed sets are read-only in this view for now.' );
      return;
    }
    setModal( null );
    setGenerating( true );
    setGenMsg( '' );
    try {
      const fieldList = [
        'Short', 'Long', 'What It Is', 'The Gift', 'The Shadow', 
        'How to Work With It', 'Coaching Questions', 'For Client', 
        'Affirmations', 'EFT Script', 'Acupressure Point', 
        'Correspondence', 'Free Video URL', 'Premium Video URL', 'Keywords'
      ];
      const res = await fetchJSON( 'luna-astrohd/v1/ai-fill', {
        method: 'POST',
        body: JSON.stringify( {
          section_type: active.section_type,
          title:        active.title || active.item_key,
          context:      ( extraInstructions || '' ) + "\n\nPlease write interpretations for as many of these sections as possible: " + fieldList.join( ', ' ) + ". Use ### [Section Name] for each.",
          model_id:     modelId,
        } ),
      } );
      if ( res.content ) {
        // Normalise ## → ### for our single-level header system
        let normalised = res.content;
        fieldList.forEach( f => {
          const rx = new RegExp( `^##\\s+${ f }\\b`, 'gim' );
          normalised = normalised.replace( rx, `### ${ f }` );
        } );
        setContent( normalised.trim() );
        setIsDirty( true );
      }
      setGenMsg( `Generated using ${ res.model } — review and save.` );
    } catch ( e ) {
      setGenMsg( `AI error: ${ e.message }` );
    } finally {
      setGenerating( false );
    }
  }, [ active, activeSet ] );

  // ── Migrate set ──
  const handleMigrateSet = useCallback( async () => {
    if ( ! activeSet?.id || activeSet?.source === 'core' ) return;
    setMigrating( true );
    setMigrateMsg( '' );
    try {
      const res  = await fetchJSON( `luna-astrohd/v1/core-migrate-set/${ activeSet.id }`, { method: 'POST' } );
      setMigrateMsg( `Migrated to core set #${ res.core_set_id }.` );
      const refreshedCore = await fetchJSON( 'luna-astrohd/v1/core-definition-sets' );
      const coreArr = Array.isArray( refreshedCore ) ? refreshedCore.map( s => ( { ...s, source: 'core' } ) ) : [];
      setCoreSets( coreArr );
      const migratedCoreSet = coreArr.find( s => String( s.id ) === String( res.core_set_id ) );
      if ( migratedCoreSet ) {
        setSetSource( 'core' );
        setActiveSet( migratedCoreSet );
      }
    } catch ( e ) {
      setMigrateMsg( `Error: ${ e.message }` );
    } finally {
      setMigrating( false );
    }
  }, [ activeSet ] );

  // ── Create new set ──
  const handleCreateSet = useCallback( async () => {
    if ( setSource === 'core' ) return;
    if ( ! newSet.label.trim() ) return;
    setCreatingSet( true );
    try {
      const created = await fetchJSON( 'luna-astrohd/v1/definition-sets', {
        method: 'POST',
        body: JSON.stringify( newSet ),
      } );
      setSets( prev => [ ...prev, created ] );
      setActiveSet( created );
      setModal( null );
      setNewSet( { label: '', description: '', category: 'astrohd' } );
    } catch ( e ) {
      alert( `Failed to create set: ${ e.message }` );
    } finally {
      setCreatingSet( false );
    }
  }, [ newSet, setSource ] );

  // ── Export / Import / Delete ──
  const handleExport = useCallback( async () => {
    if ( ! activeSet?.id ) return;
    try {
      const data = activeSet?.source === 'core'
        ? await fetchJSON( `lunacco/v1/definitions/sets/${ activeSet.id }/export` )
        : await fetchJSON( `luna-astrohd/v1/definition-sets/${ activeSet.id }/export` );
      const blob = new Blob( [ JSON.stringify( data, null, 2 ) ], { type: 'application/json' } );
      const url  = URL.createObjectURL( blob );
      const a    = document.createElement( 'a' );
      a.href     = url;
      a.download = `${ activeSet?.source === 'core' ? 'core' : 'astrohd' }-definitions-${ activeSet.slug || activeSet.id }.json`;
      a.click();
      URL.revokeObjectURL( url );
    } catch ( e ) {
      alert( `Export failed: ${ e.message }` );
    }
  }, [ activeSet ] );

  const handleImportManifest = useCallback( async () => {
    if ( ! activeSet?.id || ! importText.trim() || activeSet?.source === 'core' ) return;
    setImportingManifest( true );
    setImportResult( null );
    try {
      const res = await fetchJSON( 'luna-astrohd/v1/definitions/import-manifest', {
        method: 'POST',
        body: JSON.stringify( {
          set_id: activeSet.id,
          section_type: importTarget,
          markdown: importText,
        } ),
      } );
      setImportResult( { success: true, count: res.imported } );
      // Re-fetch ALL rows for this set so sidebar and lists are accurate
      const data = await fetchJSON( `luna-astrohd/v1/definitions?set_id=${ activeSet.id }` );
      setRows( Array.isArray( data ) ? data : [] );
    } catch ( e ) {
      setImportResult( { error: e.message } );
    } finally {
      setImportingManifest( false );
    }
  }, [ activeSet, importTarget, importText, section ] );

  const handleSetDefault = useCallback( async () => {
    if ( ! activeSet?.id || activeSet?.source === 'core' ) return;
    try {
      await fetchJSON( `luna-astrohd/v1/definition-sets/${ activeSet.id }/set-default`, { method: 'POST' } );
      const updated = await fetchJSON( 'luna-astrohd/v1/definition-sets' );
      setSets( Array.isArray( updated ) ? updated : [] );
      setActiveSet( updated.find( s => s.id === activeSet.id ) || activeSet );
    } catch ( e ) {
      alert( `Failed to set default: ${ e.message }` );
    }
  }, [ activeSet ] );

  const handleImportJSON = async ( e ) => {
    const file = e.target.files?.[0];
    if ( ! file ) return;
    const reader = new FileReader();
    reader.onload = async ( evt ) => {
      try {
        const data = JSON.parse( evt.target.result );
        const res  = await fetchJSON( 'luna-astrohd/v1/definition-sets/import', {
          method: 'POST',
          body: JSON.stringify( data ),
        } );
        setModal( null );
        alert( 'Imported successfully.' );
        const updated = await fetchJSON( 'luna-astrohd/v1/definition-sets' );
        setSets( Array.isArray( updated ) ? updated : [] );
      } catch ( err ) {
        alert( `Import failed: ${ err.message }` );
      }
    };
    reader.readAsText( file );
    e.target.value = '';
  };

  const handleDeleteSet = useCallback( async () => {
    if ( ! activeSet?.id || activeSet.is_default || activeSet?.source === 'core' ) return;
    if ( ! confirm( `Are you sure you want to delete "${ activeSet.label }"? This will remove all its definitions.` ) ) return;
    try {
      await fetchJSON( `luna-astrohd/v1/definition-sets/${ activeSet.id }`, { method: 'DELETE' } );
      setSets( prev => prev.filter( s => s.id !== activeSet.id ) );
      if ( sets.length > 1 ) setActiveSet( sets[0].id === activeSet.id ? sets[1] : sets[0] );
      else setActiveSet( null );
    } catch ( e ) {
      alert( `Delete failed: ${ e.message }` );
    }
  }, [ activeSet, sets ] );

  const handleSaveBulk = useCallback( async ( bulkMarkdown ) => {
    if ( ! activeSet?.id || activeSet?.source === 'core' ) return;
    setSaving( true );
    try {
      await fetchJSON( 'luna-astrohd/v1/definitions/import-manifest', {
        method: 'POST',
        body: JSON.stringify( {
          set_id: activeSet.id,
          section_type: section,
          markdown: bulkMarkdown,
        } ),
      } );
      // Re-fetch all
      const data = await fetchJSON( `luna-astrohd/v1/definitions?set_id=${ activeSet.id }` );
      setRows( Array.isArray( data ) ? data : [] );
      setModal( null );
      alert( 'Bulk update complete.' );
    } catch ( e ) {
      alert( `Bulk update failed: ${ e.message }` );
    } finally {
      setSaving( false );
    }
  }, [ activeSet, section ] );

  // ── Preview: parse current content ──
  const preview = useMemo( () => {
    if ( ! showPreview ) return null;
    const { short_text, long_text, keywords, extraText } = parseContent( content );
    return { short_text, long_text, keywords, extraText };
  }, [ showPreview, content ] );

  // ── Section groups for sidebar ──
  function SectionGroup( { label, items } ) {
    if ( ! items.length ) return null;
    return (
      <>
        <div className="px-4 py-2 text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--mute)] border-t border-[var(--hair)] sticky top-0 bg-[var(--paper)] z-10">{ label }</div>
        { items.map( s => (
          <button key={ s.key } onClick={ () => safeSwitch( 'section', s.key ) }
            className={ `w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-between border-l-2 ${ s.key === section ? 'bg-[var(--indigo)]/10 text-[var(--indigo)] border-[var(--indigo)]' : 'text-[var(--mute)] hover:bg-[var(--hair)] border-transparent hover:text-[var(--ink)]' }` }>
            <span className="truncate">{ s.label }</span>
            <span className="text-[9px] opacity-40">{ s.count }</span>
          </button>
        ) ) }
      </>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--paper)]">

      { /* ── Top bar ── */ }
      <div className="shrink-0 px-5 py-3 border-b border-[var(--hair)] flex flex-wrap items-center gap-3">
        <Database size={ 16 } className="text-[var(--indigo)] shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--ink)]">AstroHD Definitions</span>

        <div className="flex items-center gap-1 p-1 bg-[var(--card)] border border-[var(--hair)]">
          <button
            onClick={ () => setSetSource( 'legacy' ) }
            className={ `px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all ${ setSource === 'legacy' ? 'bg-[var(--indigo)] text-[var(--btn-fg)]' : 'text-[var(--mute)] hover:text-[var(--ink)]' }` }
          >
            Legacy Sets
          </button>
          <button
            onClick={ () => setSetSource( 'core' ) }
            className={ `px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all ${ setSource === 'core' ? 'bg-[var(--indigo)] text-[var(--btn-fg)]' : 'text-[var(--mute)] hover:text-[var(--ink)]' }` }
          >
            Core Sets
          </button>
        </div>

        { ! setsLoading && availableSets.length > 0 && (
          <div className="flex items-center gap-2">
            <select value={ activeSet?.id || '' }
              onChange={ e => { const f = availableSets.find( s => String( s.id ) === e.target.value ); if ( f ) safeSwitch( 'set', f ); } }
              style={ SS }>
              { availableSets.map( s => (
                <option key={ s.id } value={ s.id }>
                  { s.is_default ? '★ ' : '' }{ s.label }
                </option>
              ) ) }
            </select>

            { isCoreActive ? (
              <span className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest border border-[var(--hair)] text-[var(--mute)] bg-[var(--card)]">
                Read Only
              </span>
            ) : (
              <>
                <button
                  onClick={ () => setModal( 'rename-set' ) }
                  className="p-1.5 text-[var(--mute)] hover:text-[var(--ink)] transition-colors"
                  title="Rename set"
                >
                  <Pencil size={ 14 } />
                </button>

                { activeSet?.id && ! activeSet.is_default && (
                  <button
                    onClick={ handleSetDefault }
                    className="p-1.5 text-[var(--mute)] hover:text-[var(--gold)] transition-colors"
                    title="Set as site-wide default"
                  >
                    <Star size={ 14 } />
                  </button>
                ) }

                <button
                  onClick={ async () => {
                    if ( ! activeSet?.id ) return;
                    if ( ! confirm( `Delete set "${ activeSet.label }"? This cannot be undone.` ) ) return;
                    try {
                      await fetchJSON( `luna-astrohd/v1/definition-sets/${ activeSet.id }`, { method: 'DELETE' } );
                      const updated = await fetchJSON( 'luna-astrohd/v1/definition-sets' );
                      const legacyArr = Array.isArray( updated ) ? updated.map( s => ( { ...s, source: 'legacy' } ) ) : [];
                      setSets( legacyArr );
                      setActiveSet( legacyArr[0] || null );
                    } catch ( e ) { alert( e.message ); }
                  } }
                  className="p-1.5 text-[var(--mute)] hover:text-red-500 transition-colors"
                  title="Delete set"
                >
                  <Trash2 size={ 14 } />
                </button>
              </>
            ) }
          </div>
        ) }

        { /* Right actions */ }
        <div className="ml-auto flex items-center gap-2">
          { activeSet?.id && (
            <>
              { ! isCoreActive && <button
                onClick={ handleMigrateSet }
                disabled={ migrating }
                className="px-4 py-2 bg-[var(--card)] border border-[var(--hair)] text-[10px] font-bold uppercase tracking-widest text-[var(--mute)] hover:text-[var(--ink)] transition-all"
                title="Move this AstroHD set into the core definition engine"
              >
                { migrating ? 'Migrating…' : 'Migrate Set' }
              </button> }


              { ! isCoreActive && <button
                onClick={ () => {
                  setImportText( '' );
                  setImportResult( null );
                  setImportTarget( section );
                  setModal( 'import' );
                } }
                className="flex items-center gap-2 px-4 py-2 bg-[var(--card)] border border-[var(--hair)] text-[10px] font-bold uppercase tracking-widest text-[var(--mute)] hover:text-[var(--ink)] transition-all"
              >
                <Upload size={ 12 } /> Import
              </button> }

              <button
                onClick={ handleExport }
                className="flex items-center gap-2 px-4 py-2 bg-[var(--card)] border border-[var(--hair)] text-[10px] font-bold uppercase tracking-widest text-[var(--mute)] hover:text-[var(--ink)] transition-all"
              >
                <Download size={ 12 } /> Export
              </button>

              { ! isCoreActive && ! activeSet.is_default && (
                <button
                  onClick={ handleDeleteSet }
                  className="p-2 bg-[var(--card)] border border-red-500/20 text-red-500 hover:bg-red-500/5 transition-all"
                  title="Delete Set"
                >
                  <Trash2 size={ 14 } />
                </button>
              ) }
            </>
          ) }
          { ! isCoreActive && <Btn onClick={ () => setModal( 'new-set' ) }><Plus size={ 12 } /> New Set</Btn> }
        </div>
      </div>

      { /* ── Three columns ── */ }
      <div className="flex flex-1 min-h-0">

        { /* Left: section picker */ }
        <div className="w-52 shrink-0 border-r border-[var(--hair)] overflow-y-auto flex flex-col no-scrollbar">
          <SectionGroup label="Human Design" items={ hdSections } />
          <SectionGroup label="Astrology"    items={ astroSections } />
          { loading && <p className="px-4 py-3 text-[10px] text-[var(--mute)] animate-pulse">Loading…</p> }
          { error   && <p className="px-4 py-3 text-[10px] text-red-500">{ error }</p> }
        </div>

        { /* Middle: item list */ }
        <div className="w-56 shrink-0 border-r border-[var(--hair)] flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--hair)] shrink-0 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--mute)]">
                { section.replace( /_/g, ' ' ).replace( 'hd', 'HD' ) }
              </span>
              { ! isCoreActive && (
                <button
                  onClick={ () => setModal( 'bulk' ) }
                  className="text-[9px] font-bold uppercase tracking-widest text-[var(--indigo)] hover:opacity-70 transition-opacity"
                >
                  Bulk Edit
                </button>
              ) }
            </div>
            <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--hair)] px-3 py-1.5">
              <Search size={ 11 } className="text-[var(--mute)] shrink-0" />
              <input value={ query } onChange={ e => setQuery( e.target.value ) }
                placeholder="Search…"
                className="flex-1 bg-transparent text-[11px] text-[var(--ink)] outline-none placeholder-[var(--mute)]" />
              { query && <button onClick={ () => setQuery( '' ) }><X size={ 11 } className="text-[var(--mute)]" /></button> }
            </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar py-1">
            { filtered.map( row => (
              <button key={ row.id } onClick={ () => safeSwitch( 'item', row ) }
                className={ `w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-between gap-2 border-l-2 ${ active?.id === row.id ? 'bg-[var(--indigo)]/10 text-[var(--indigo)] border-[var(--indigo)]' : 'text-[var(--mute)] hover:bg-[var(--hair)] border-transparent hover:text-[var(--ink)]' } ${ ! isFilled( row ) ? 'opacity-50' : '' }` }>
                <span className="truncate">{ row.title }</span>
                { isFilled( row ) && <Check size={ 12 } className="text-[var(--indigo)] shrink-0" /> }
              </button>
            ) ) }
            { ! loading && filtered.length === 0 && (
              <p className="px-4 py-8 text-[10px] text-[var(--mute)] italic opacity-40 text-center">No items</p>
            ) }
          </div>
        </div>

        { /* Right: editor */ }
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          { ! active ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 opacity-20">
              <div className="w-16 h-16 border border-[var(--ink)] rotate-45 flex items-center justify-center">
                <Database size={ 24 } className="-rotate-45" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Select an item to edit</p>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">

              { /* Header */ }
              <div className="shrink-0 px-6 py-4 border-b border-[var(--hair)] flex items-center gap-4 bg-[var(--paper)]">
                <span className="text-xl font-normal italic text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>
                  { active.title }
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--mute)] opacity-40">
                  { SECTION_LABELS[ active.section_type ] || active.section_type }
                </span>
                { active.extra_meta?.stream && (
                  <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border"
                    style={{ color: active.extra_meta.stream === 'Design' ? '#c0392b' : '#2c3e50', borderColor: 'currentColor', opacity: 0.7 }}>
                    { active.extra_meta.stream }
                  </span>
                ) }
              </div>

              { /* Scrollable body */ }
              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 pt-6 pb-4">
                <textarea
                  value={ content }
                  onChange={ e => { setContent( e.target.value ); setIsDirty( true ); } }
                  disabled={ isCoreActive }
                  className="w-full bg-[var(--card)] border border-[var(--hair)] p-6 text-[var(--ink)] text-sm font-mono focus:outline-none focus:border-[var(--indigo)] transition-all resize-none shadow-inner"
                  placeholder={ buildTemplate( active.section_type ) }
                  style={{ minHeight: '480px' }}
                />
              </div>

              { /* Action bar */ }
              <div className="shrink-0 px-6 py-4 flex flex-wrap items-center gap-3 border-t border-[var(--hair)] bg-[var(--paper)]">
                { genMsg && (
                  <span className={ `text-[10px] font-bold uppercase tracking-widest ${ genMsg.toLowerCase().includes( 'error' ) ? 'text-red-500' : 'text-green-600' }` }>
                    { genMsg }
                  </span>
                ) }
                { isCoreActive && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--mute)]">
                    Core projection active. Editing stays in the core engine for now.
                  </span>
                ) }
                <div className="ml-auto flex items-center gap-3 flex-wrap">
                  <Btn onClick={ () => setShowPreview( p => ! p ) } variant="outline">
                    { showPreview ? <EyeOff size={ 14 } /> : <Eye size={ 14 } /> } Preview
                  </Btn>
                  { ! isCoreActive && (
                    <>
                  <Btn
                    variant="outline"
                    onClick={ () => {
                      const fieldList = [
                        '### Short\n',
                        '### Long\n',
                        '### What It Is\n',
                        '### The Gift\n',
                        '### The Shadow\n',
                        '### How to Work With It\n',
                        '### Coaching Questions\n',
                        '### For Client\n',
                        '### Affirmations\n',
                        '### EFT Script\n',
                        '### Acupressure Point\n',
                        '### Correspondence\n',
                        '### Free Video URL\n',
                        '### Premium Video URL\n',
                        '### Keywords'
                      ];
                      setContent( fieldList.join( '\n' ) );
                      setIsDirty( true );
                    } }
                  >
                    Template
                  </Btn>
                  <Btn onClick={ () => setModal( 'generate' ) } disabled={ generating } variant="outline">
                    <Sparkles size={ 14 } className={ generating ? 'animate-spin' : '' } />
                    { generating ? 'Generating…' : 'Generate' }
                  </Btn>
                  <Btn onClick={ handleSave } disabled={ saving || ! isDirty } variant="primary" size="md">
                    <Save size={ 14 } />
                    { saving ? 'Saving…' : saveMsg || 'Save' }
                  </Btn>
                    </>
                  ) }
                </div>
              </div>

              { /* Preview */ }
              { showPreview && preview && (
                <div className="shrink-0 border-t border-[var(--hair)] px-8 py-6 max-h-72 overflow-y-auto bg-[var(--card)] no-scrollbar space-y-4">
                  { preview.short_text && (
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] mb-2">Short</div>
                      <p className="text-[var(--ink)] text-sm italic">{ preview.short_text }</p>
                    </div>
                  ) }
                  { preview.long_text && (
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] mb-2">Long</div>
                      <p className="text-[var(--ink)] text-sm whitespace-pre-wrap leading-relaxed">{ preview.long_text }</p>
                    </div>
                  ) }
                  { preview.keywords && (
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] mb-2">Keywords</div>
                      <p className="text-[var(--ink)] text-sm">{ preview.keywords }</p>
                    </div>
                  ) }
                  { Object.entries( preview.extraText || {} ).map( ( [ k, v ] ) => v ? (
                    <div key={ k }>
                      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] mb-2">
                        { k.split( '_' ).map( w => w.charAt(0).toUpperCase() + w.slice(1) ).join( ' ' ) }
                      </div>
                      <p className="text-[var(--ink)] text-sm whitespace-pre-wrap leading-relaxed">{ v }</p>
                    </div>
                  ) : null ) }
                </div>
              ) }

            </div>
          ) }
        </div>
      </div>

      { /* Generate modal */ }
      { modal === 'generate' && (
        <ModelPickerModal
          activeItem={ active }
          onClose={ () => setModal( null ) }
          onGenerate={ ( { modelId, maxTokens, context } ) => handleGenerate( modelId, maxTokens, context ) }
        />
      ) }

      { /* Bulk Editor Modal */ }
      { modal === 'bulk' && (
        <Modal title={ `Bulk Edit: ${ SECTION_LABELS[ section ] }` } onClose={ () => setModal( null ) } wide>
          <div className="space-y-4">
            <textarea
              defaultValue={ rows.filter( r => r.section_type === section ).map( r => `# ${ r.title }\n${ r.long_text || '' }` ).join( '\n\n' ) }
              id="bulk-text"
              rows={ 20 }
              className="w-full bg-[var(--card)] border border-[var(--hair)] p-4 text-[var(--ink)] text-xs font-mono focus:outline-none focus:border-[var(--indigo)]"
            />
            <div className="flex gap-4">
              <Btn variant="primary" onClick={ () => handleSaveBulk( document.getElementById( 'bulk-text' ).value ) } disabled={ saving }>
                { saving ? 'Saving...' : 'Apply Bulk Changes' }
              </Btn>
              <Btn variant="outline" onClick={ () => setModal( null ) }>Cancel</Btn>
            </div>
          </div>
        </Modal>
      ) }

      { /* ── Import Modal ── */ }
      { modal === 'rename-set' && (
        <Modal onClose={ () => setModal( null ) } title="Rename Definition Set">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--mute)] mb-2">New Label</label>
              <input
                type="text"
                defaultValue={ activeSet?.label }
                id="rename-label-input"
                className="w-full bg-[var(--card)] border border-[var(--hair)] px-4 py-3 text-[12px] text-[var(--ink)] focus:outline-none"
              />
            </div>
            <button
              onClick={ async () => {
                const label = document.getElementById( 'rename-label-input' ).value;
                if ( ! label ) return;
                try {
                  await fetchJSON( `luna-astrohd/v1/definition-sets/${ activeSet.id }`, {
                    method: 'PATCH',
                    body: JSON.stringify( { label } ),
                  } );
                  const updated = await fetchJSON( 'luna-astrohd/v1/definition-sets' );
                  setSets( Array.isArray( updated ) ? updated : [] );
                  setModal( null );
                } catch ( e ) { alert( e.message ); }
              } }
              className="w-full bg-[var(--ink)] text-[var(--paper)] py-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Update Set
            </button>
          </div>
        </Modal>
      ) }
      { modal === 'import' && (
        <Modal title="Import Definitions" onClose={ () => setModal( null ) } wide>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-8">
              { /* JSON Import */ }
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] border-b border-[var(--hair)] pb-2">JSON Bundle</h3>
                <p className="text-xs text-[var(--mute)] italic">Import an entire definition set exported from another AstroHD instance.</p>
                <input ref={ fileInputRef } type="file" accept=".json" className="hidden" onChange={ handleImportJSON } />
                <button
                  onClick={ () => fileInputRef.current?.click() }
                  className="w-full py-6 border-2 border-dashed border-[var(--hair)] hover:border-[var(--indigo)] bg-[var(--card)] text-[var(--mute)] hover:text-[var(--indigo)] transition-all flex flex-col items-center gap-2"
                >
                  <Upload size={ 20 } />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Select JSON File</span>
                </button>
              </div>

              { /* Manifest Import */ }
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] border-b border-[var(--hair)] pb-2">Markdown Manifest</h3>
                <p className="text-xs text-[var(--mute)] italic">Bulk update content for a specific category using markdown headers.</p>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--mute)] opacity-60">Target Category</label>
                  <select
                    value={ importTarget }
                    onChange={ e => setImportTarget( e.target.value ) }
                    className="w-full bg-[var(--card)] border border-[var(--hair)] px-3 py-2 text-[var(--ink)] text-xs focus:outline-none focus:border-[var(--indigo)]"
                  >
                    { Object.entries( SECTION_LABELS ).map( ( [ k, v ] ) => (
                      <option key={ k } value={ k }>{ v }</option>
                    ) ) }
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--mute)] opacity-60">Manifest Content</label>
                <div className="text-[9px] font-bold text-[var(--indigo)] uppercase tracking-widest">
                  Header Format: # [Item Name]
                </div>
              </div>
              <textarea
                value={ importText }
                onChange={ e => setImportText( e.target.value ) }
                rows={ 10 }
                placeholder={ `# Aura\n### Short\nEnergy field summary...\n\n### Long\nDetailed explanation...\n\n# Parvati\n...` }
                className="w-full bg-[var(--card)] border border-[var(--hair)] p-4 text-[var(--ink)] text-xs font-mono focus:outline-none focus:border-[var(--indigo)] transition-all resize-none shadow-inner"
              />
            </div>

            { importResult && (
              <div className={ `p-4 border ${ importResult.error ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-green-500/10 border-green-500/20 text-green-500' } text-xs font-bold uppercase tracking-widest` }>
                { importResult.error || `SUCCESS: UPDATED ${ importResult.count } RECORDS` }
              </div>
            ) }

            <div className="flex gap-4 pt-4 border-t border-[var(--hair)]">
              <button
                onClick={ handleImportManifest }
                disabled={ importingManifest || ! importText.trim() }
                className="flex-1 py-3 bg-[var(--indigo)] text-[var(--btn-fg)] text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-[var(--indigo-hi)] transition-all disabled:opacity-50"
              >
                { importingManifest ? 'IMPORTING...' : 'INITIATE MANIFEST IMPORT' }
              </button>
              <button
                onClick={ () => setModal( null ) }
                className="px-8 py-3 border border-[var(--hair)] text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] hover:text-[var(--ink)] transition-all"
              >
                CANCEL
              </button>
            </div>
          </div>
        </Modal>
      ) }

      { /* New Set modal */ }
      { modal === 'new-set' && (
        <Modal title="New Definition Set" onClose={ () => setModal( null ) }>
          <Field label="Label">
            <input value={ newSet.label } onChange={ e => setNewSet( p => ( { ...p, label: e.target.value } ) ) }
              placeholder="e.g. My HD Definitions"
              className="w-full bg-[var(--card)] border border-[var(--hair)] px-4 py-2.5 text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--indigo)] transition-all" />
          </Field>
          <Field label="Description (optional)">
            <textarea value={ newSet.description } onChange={ e => setNewSet( p => ( { ...p, description: e.target.value } ) ) }
              rows={ 3 } className="w-full bg-[var(--card)] border border-[var(--hair)] px-4 py-2.5 text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--indigo)] transition-all resize-none" />
          </Field>
          <Field label="Category">
            <select value={ newSet.category } onChange={ e => setNewSet( p => ( { ...p, category: e.target.value } ) ) }
              style={{ ...SS, width: '100%' }}>
              <option value="astrohd">AstroHD (Combined)</option>
              <option value="human_design">Human Design</option>
              <option value="astrology">Astrology</option>
            </select>
          </Field>
          <div className="flex gap-4 pt-4 border-t border-[var(--hair)]">
            <Btn onClick={ handleCreateSet } disabled={ creatingSet || ! newSet.label.trim() } variant="primary" size="md" className="flex-1">
              { creatingSet ? 'Creating…' : 'Create Set' }
            </Btn>
            <Btn onClick={ () => setModal( null ) } variant="outline" size="md">Cancel</Btn>
          </div>
        </Modal>
      ) }

    </div>
  );
}
