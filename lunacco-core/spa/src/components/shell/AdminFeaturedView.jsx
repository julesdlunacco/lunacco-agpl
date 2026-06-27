/**
 * AdminFeaturedView — in-app admin to curate Featured items + set level/popular.
 *
 * Admin-only. Matches Definition Engine admin styling.
 * Lists all cross-module featurables; allows drag-order (via move buttons),
 * Featured toggle, and level/popular override.
 */
import { useState, useEffect, useCallback } from 'react';
import { Star, ChevronUp, ChevronDown, GripVertical, Save, RefreshCw } from 'lucide-react';
import { buildFeaturables, MODULE_LABELS } from '../../utils/featurables.js';
import { useAppConfig } from '../../contexts/AppConfigContext.jsx';

const LEVEL_OPTIONS = [
  { value: '', label: '— unset —' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const MODULE_TAG_CLASS = {
  'luna-numerology': 'num',
  'luna-astrohd':   'ahd',
  'lunacco-eastern': 'eas',
  'luna-tarot':     'ast',
};

function KindBadge( { kind, moduleId } ) {
  const tc = MODULE_TAG_CLASS[ moduleId ] || 'num';
  const tag = kind === 'spread' ? 'SPREAD' : ( MODULE_LABELS[ moduleId ]?.toUpperCase().slice( 0, 5 ) || 'CHART' );
  return <span className={ `sp-tag ${ tc }` } style={{ fontSize: 9, padding: '2px 6px' }}>{ tag }</span>;
}

export default function AdminFeaturedView() {
  const { root } = useAppConfig();
  const [ items, setItems ] = useState( [] );
  const [ saving, setSaving ] = useState( false );
  const [ saved, setSaved ] = useState( false );
  const [ error, setError ] = useState( '' );

  // Build initial list from globals + server-stored meta
  const rebuild = useCallback( () => {
    const stored = window.LunaCcoData?.featured || null;
    const list = buildFeaturables( stored );
    // Separate featured (ordered) from non-featured
    const feat = list.filter( i => i.featured );
    const rest = list.filter( i => !i.featured );
    setItems( [ ...feat, ...rest ] );
  }, [] );

  useEffect( () => {
    rebuild();
  }, [] );

  // Move item up/down in the list
  const move = ( idx, dir ) => {
    setItems( prev => {
      const next = [ ...prev ];
      const swap = idx + dir;
      if ( swap < 0 || swap >= next.length ) return prev;
      [ next[ idx ], next[ swap ] ] = [ next[ swap ], next[ idx ] ];
      return next;
    } );
    setSaved( false );
  };

  const toggleFeatured = ( idx ) => {
    setItems( prev => prev.map( ( it, i ) => i === idx ? { ...it, featured: !it.featured } : it ) );
    setSaved( false );
  };

  const setLevel = ( idx, level ) => {
    setItems( prev => prev.map( ( it, i ) => i === idx ? { ...it, level: level || null } : it ) );
    setSaved( false );
  };

  const setPopular = ( idx, popular ) => {
    setItems( prev => prev.map( ( it, i ) => i === idx ? { ...it, popular } : it ) );
    setSaved( false );
  };

  const handleSave = async () => {
    setSaving( true );
    setError( '' );
    try {
      const featuredItems = items.filter( i => i.featured ).map( i => ({
        moduleId: i.moduleId, id: i.id, kind: i.kind,
      }) );
      const meta = {};
      for ( const it of items ) {
        meta[ it.id ] = { level: it.level, popular: it.popular, featured: it.featured };
      }
      const nonce = window.LunaCcoData?.nonce || '';
      const apiRoot = root || window.LunaCcoData?.root || '/wp-json/';
      const res = await fetch( `${ apiRoot }lunacco/v1/admin/featured`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
        body: JSON.stringify( { items: featuredItems, meta } ),
      } );
      if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
      const data = await res.json();
      // Patch the in-memory LunaCcoData so EpgSpots picks up change without reload
      if ( window.LunaCcoData ) window.LunaCcoData.featured = data.featured;
      setSaved( true );
    } catch ( e ) {
      setError( `Save failed: ${ e.message }` );
    } finally {
      setSaving( false );
    }
  };

  const featCount = items.filter( i => i.featured ).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[var(--paper)]">
      <div className="w-full max-w-4xl mx-auto px-8 py-10 flex flex-col gap-8">

        { /* Header */ }
        <div className="flex items-end justify-between gap-4 border-b border-[var(--hair)] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star size={ 14 } className="text-[var(--gold)]" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--mute)]">Admin</span>
            </div>
            <h1 className="text-2xl font-light text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
              Featured &amp; Levels
            </h1>
            <p className="text-xs text-[var(--mute)] mt-1">
              Toggle Featured to show items in the dashboard spotlight · { featCount } featured
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={ rebuild }
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--hair)] text-[var(--mute)] text-[10px] font-bold uppercase tracking-widest hover:border-[var(--ink)] transition-colors"
              title="Reload from globals"
            >
              <RefreshCw size={ 11 } /> Reload
            </button>
            <button
              onClick={ handleSave }
              disabled={ saving }
              className="flex items-center gap-1.5 px-5 py-2 bg-[var(--indigo)] hover:opacity-90 disabled:opacity-40 text-[var(--btn-fg)] text-[10px] font-bold uppercase tracking-widest transition-all"
            >
              <Save size={ 11 } /> { saving ? 'Saving…' : 'Save' }
            </button>
          </div>
        </div>

        { saved && (
          <div className="px-4 py-2 bg-[var(--astro-earth)]/10 border border-[var(--astro-earth)]/30 text-[10px] font-bold uppercase tracking-widest text-[var(--astro-earth)]">
            Saved — dashboard will reflect changes on next page load.
          </div>
        ) }
        { error && (
          <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-[10px] text-red-600">{ error }</div>
        ) }

        { /* Column headers */ }
        <div className="grid items-center gap-3 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--mute)]"
          style={{ gridTemplateColumns: '32px 1fr 90px 140px 80px 56px' }}>
          <span />
          <span>Item</span>
          <span>Featured</span>
          <span>Level</span>
          <span>Popular</span>
          <span className="text-center">Move</span>
        </div>

        { /* Items */ }
        <div className="flex flex-col divide-y divide-[var(--hair)] border border-[var(--hair)]">
          { items.map( ( item, idx ) => (
            <div
              key={ item.id }
              className={ `grid items-center gap-3 px-3 py-3 transition-colors ${ item.featured ? 'bg-[var(--gold)]/5' : 'bg-[var(--card)]' }` }
              style={{ gridTemplateColumns: '32px 1fr 90px 140px 80px 56px' }}
            >
              { /* Grip icon */ }
              <GripVertical size={ 14 } className="text-[var(--mute)] opacity-30 mx-auto" />

              { /* Label + kind badge */ }
              <div className="flex items-center gap-2 min-w-0">
                <KindBadge kind={ item.kind } moduleId={ item.moduleId } />
                <span className="text-sm text-[var(--ink)] truncate" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                  { item.label }
                </span>
              </div>

              { /* Featured toggle */ }
              <label className="flex items-center gap-2 cursor-pointer select-none justify-center">
                <input
                  type="checkbox"
                  checked={ item.featured }
                  onChange={ () => toggleFeatured( idx ) }
                  className="w-4 h-4 accent-[var(--gold)]"
                />
                { item.featured && <Star size={ 11 } className="text-[var(--gold)]" /> }
              </label>

              { /* Level */ }
              <select
                value={ item.level || '' }
                onChange={ e => setLevel( idx, e.target.value ) }
                className="bg-[var(--paper)] border border-[var(--hair)] px-2 py-1 text-[11px] text-[var(--ink)] outline-none focus:border-[var(--indigo)] w-full"
              >
                { LEVEL_OPTIONS.map( o => <option key={ o.value } value={ o.value }>{ o.label }</option> ) }
              </select>

              { /* Popular */ }
              <label className="flex items-center gap-2 cursor-pointer justify-center">
                <input
                  type="checkbox"
                  checked={ !!item.popular }
                  onChange={ e => setPopular( idx, e.target.checked ) }
                  className="w-4 h-4 accent-[var(--indigo)]"
                />
              </label>

              { /* Move up/down */ }
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={ () => move( idx, -1 ) }
                  disabled={ idx === 0 }
                  className="p-0.5 text-[var(--mute)] hover:text-[var(--ink)] disabled:opacity-20 transition-colors"
                >
                  <ChevronUp size={ 14 } />
                </button>
                <button
                  onClick={ () => move( idx, 1 ) }
                  disabled={ idx === items.length - 1 }
                  className="p-0.5 text-[var(--mute)] hover:text-[var(--ink)] disabled:opacity-20 transition-colors"
                >
                  <ChevronDown size={ 14 } />
                </button>
              </div>
            </div>
          ) ) }
        </div>

        { items.length === 0 && (
          <p className="text-[var(--mute)] text-sm italic text-center py-8">
            No modules loaded yet — navigate to a chart view first so modules register their types, then return here.
          </p>
        ) }
      </div>
    </div>
  );
}
