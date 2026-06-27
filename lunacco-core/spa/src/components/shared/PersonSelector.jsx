import { useState, useEffect, useRef } from 'react';
import { X, User, ChevronDown, Pencil, Trash2, Plus } from 'lucide-react';
import CitySearchInput from './CitySearchInput.jsx';
import { useModuleRegistry } from '../../contexts/ModuleContext.jsx';

// ------------------------------------------------------------------
// PersonModal — add / edit a person
// ------------------------------------------------------------------
function PersonModal( { initial = {}, onSave, onClose } ) {
  const { modules } = useModuleRegistry();
  const hasEastern = modules.some( m => m.id === 'lunacco-eastern' );

  const [ form, setForm ] = useState( {
    display_name:   '',
    full_name:      '',
    nickname:       '',
    birthdate:      '',
    city:           '',
    region:         '',
    country:        '',
    birth_time:     '',
    birth_location: '',
    birth_lat:      '',
    birth_lng:      '',
    birth_timezone: '',
    luck_cycle_polarity: '',
    ...initial,
  } );
  const f = ( key ) => ( e ) => setForm( p => ( { ...p, [ key ]: e.target.value } ) );

  const iCls = 'w-full bg-[var(--card)] border border-[var(--hair)] px-4 py-2.5 text-sm text-[var(--ink)] placeholder-[var(--ink)]/30 outline-none focus:border-[var(--indigo)] transition-colors';
  const lCls = 'block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] mb-2';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--ink)]/40 backdrop-blur-sm" onClick={ onClose }>
      <div className="bg-[var(--paper)] border border-[var(--hair)] p-8 w-full max-w-md shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto" onClick={ e => e.stopPropagation() }>
        <div className="flex items-center justify-between border-b border-[var(--hair)] pb-4 -mx-2 px-2">
          <h3 className="text-xl font-normal italic text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>{ initial.id ? 'Edit Person' : 'Add Person' }</h3>
          <button onClick={ onClose } className="text-[var(--mute)] hover:text-[var(--ink)] transition-colors"><X size={ 20 } /></button>
        </div>

        <div className="space-y-4">
          { /* Identity */ }
          <div>
            <label className={ lCls }>Nickname / Label *</label>
            <input className={ iCls } placeholder="e.g. Mom, Jules, BFF" value={ form.display_name } onChange={ f( 'display_name' ) } />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={ lCls }>Full / Legal Name</label>
              <input className={ iCls } placeholder="Full legal name" value={ form.full_name } onChange={ f( 'full_name' ) } />
            </div>
            <div>
              <label className={ lCls }>Known As / Nickname</label>
              <input className={ iCls } placeholder="e.g. Jules" value={ form.nickname } onChange={ f( 'nickname' ) } />
            </div>
          </div>
          <div>
            <label className={ lCls }>Birthdate</label>
            <input type="date" className={ iCls } value={ form.birthdate } onChange={ f( 'birthdate' ) } />
          </div>

          { /* Birth Details for Human Design */ }
          <div className="pt-2 border-t border-[var(--hair)]">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] mb-4">
              Birth Details <span className="normal-case font-normal italic opacity-60">(for Human Design)</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className={ lCls }>Birth Time</label>
                <input type="time" className={ iCls } value={ form.birth_time } onChange={ f( 'birth_time' ) } />
              </div>
              <div>
                <label className={ lCls }>Birth Location</label>
                <CitySearchInput
                  value={ form.birth_location }
                  onChange={ ( v ) => setForm( p => ( { ...p, birth_location: v } ) ) }
                  onSelect={ ( { label, lat, lng, timezone } ) => setForm( p => ( {
                    ...p,
                    birth_location: label,
                    birth_lat:      lat,
                    birth_lng:      lng,
                    birth_timezone: timezone,
                  } ) ) }
                  placeholder="Search city…"
                  inputClass={ iCls }
                />
              </div>
              { form.birth_timezone && (
                <p className="text-[10px] text-[var(--mute)] italic">Timezone: { form.birth_timezone }</p>
              ) }
              { hasEastern && (
                <div>
                  <label className={ lCls }>Luck Cycle Polarity</label>
                  <select className={ iCls } value={ form.luck_cycle_polarity || '' } onChange={ f( 'luck_cycle_polarity' ) }>
                    <option value="">Other / None / Unsure</option>
                    <option value="yang">Yang</option>
                    <option value="yin">Yin</option>
                  </select>
                  <p className="text-[10px] text-[var(--mute)] italic mt-2 leading-relaxed">
                    Used by some BaZi luck-cycle methods to choose pillar direction. Choose what fits the reading context; unsure shows both directions.
                  </p>
                </div>
              ) }
            </div>
          </div>

          { /* Home Location for Where to Live */ }
          <div className="pt-2 border-t border-[var(--hair)]">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] mb-4">
              Home Location <span className="normal-case font-normal italic opacity-60">(for Where to Live)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <input className={ iCls } placeholder="City" value={ form.city } onChange={ f( 'city' ) } />
              <input className={ iCls } placeholder="Region / State" value={ form.region } onChange={ f( 'region' ) } />
              <div className="col-span-2">
                <input className={ iCls } placeholder="Country" value={ form.country } onChange={ f( 'country' ) } />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={ onClose }
            className="flex-1 py-3 text-[10px] font-bold uppercase tracking-[0.2em] border border-[var(--hair)] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--indigo)]/5 transition-all"
          >
            Cancel
          </button>
          <button
            disabled={ !form.display_name.trim() }
            onClick={ () => onSave( form ) }
            className="flex-1 py-3 text-[10px] font-bold uppercase tracking-[0.2em] bg-[var(--indigo)] text-[var(--btn-fg)] hover:opacity-90 disabled:opacity-30 transition-all"
          >
            Save Person
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// PersonSelector — dropdown to pick Myself or a saved person
// ------------------------------------------------------------------
export default function PersonSelector( {
  people           = [],
  selectedId,
  onSelect,
  onBirthdateChange,
  onNameChange,
  onKnownNameChange,
  onBirthDataChange,  // optional: ({ birth_time, birth_lat, birth_lng, birth_timezone, birth_location }) => void
  profileIdentity,
  savePerson,
  deletePerson,
} ) {
  const [ open,  setOpen  ] = useState( false );
  const [ modal, setModal ] = useState( null );
  const ref = useRef( null );

  useEffect( () => {
    const close = ( e ) => { if ( ref.current && !ref.current.contains( e.target ) ) setOpen( false ); };
    document.addEventListener( 'mousedown', close );
    return () => document.removeEventListener( 'mousedown', close );
  }, [] );

  const selected = selectedId === null
    ? { display_name: 'Myself', birthdate: profileIdentity?.birthdate || '', full_name: profileIdentity?.full_name || '' }
    : people.find( p => p.id === selectedId );

  async function handleSavePerson( form ) {
    if ( modal?.id ) {
      await savePerson( form, modal.id );
    } else {
      const newId = await savePerson( form );
      if ( newId ) onSelect( newId );
    }
    setModal( null );
  }

  async function handleDelete( id ) {
    if ( !confirm( 'Are you sure you want to delete this person?' ) ) return;
    await deletePerson( id );
    if ( selectedId === id ) onSelect( null );
  }

  function pickPerson( id ) {
    onSelect( id );
    setOpen( false );
    const p = id === null
      ? {
          birthdate:      profileIdentity?.birthdate      || '',
          full_name:      profileIdentity?.full_name       || '',
          nickname:       profileIdentity?.nickname        || '',
          birth_time:     profileIdentity?.birth_time      || '',
          birth_lat:      profileIdentity?.birth_lat       || '',
          birth_lng:      profileIdentity?.birth_lng       || '',
          birth_timezone: profileIdentity?.birth_timezone  || '',
          birth_location: profileIdentity?.birth_location  || '',
          luck_cycle_polarity: profileIdentity?.luck_cycle_polarity || '',
        }
      : people.find( x => x.id === id );

    if ( p ) {
      onBirthdateChange( p.birthdate || '' );
      if ( onNameChange )      onNameChange( p.full_name || '' );
      if ( onKnownNameChange ) onKnownNameChange( id === null ? ( profileIdentity?.nickname || '' ) : ( p.nickname || '' ) );
      if ( onBirthDataChange ) onBirthDataChange( {
        birth_time:     p.birth_time     || '',
        birth_lat:      String( p.birth_lat  || '' ),
        birth_lng:      String( p.birth_lng  || '' ),
        birth_timezone: p.birth_timezone || '',
        birth_location: p.birth_location || '',
        luck_cycle_polarity: p.luck_cycle_polarity || '',
      } );
    }
  }

  const initials = ( selected?.display_name || '?' )[ 0 ].toUpperCase();

  return (
    <div ref={ ref } className="relative">
      <button
        type="button"
        onClick={ () => setOpen( p => !p ) }
        className="w-full flex items-center gap-2.5 bg-[var(--card)] border border-[var(--hair)] px-2.5 py-2 text-left hover:border-[var(--indigo)] transition-all"
      >
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: 'var(--indigo)', color: 'var(--btn-fg, white)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13,
        }}>
          { initials }
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink)] truncate">
            { selected?.display_name || 'Select person…' }
          </div>
          { people.length > 0 && (
            <div className="text-[9px] text-[var(--mute)] leading-none mt-0.5">{ people.length } saved</div>
          ) }
        </div>
        <ChevronDown size={ 13 } className="text-[var(--mute)] shrink-0" />
      </button>

      { open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--paper)] border border-[var(--hair)] shadow-2xl z-[60] py-1">
          { /* Myself */ }
          <button
            type="button"
            onClick={ () => pickPerson( null ) }
            className={ `w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--indigo)]/5 transition-colors ${ selectedId === null ? 'bg-[var(--indigo)]/5' : '' }` }
          >
            <User size={ 14 } className={ selectedId === null ? 'text-[var(--indigo)]' : 'text-[var(--mute)]' } />
            <span className={ `text-[11px] font-bold uppercase tracking-[0.1em] ${ selectedId === null ? 'text-[var(--indigo)]' : 'text-[var(--ink)]' }` }>
              Myself
            </span>
            { selectedId === null && <div className="ml-auto w-1 h-1 bg-[var(--indigo)] rotate-45" /> }
          </button>

          { people.length > 0 && <div className="h-px bg-[var(--hair)] mx-4 my-1" /> }

          { /* Saved people */ }
          { people.map( p => (
            <div key={ p.id } className="flex items-center group hover:bg-[var(--indigo)]/5 transition-colors">
              <button
                type="button"
                onClick={ () => pickPerson( p.id ) }
                className={ `flex-1 flex items-center gap-3 px-4 py-3 text-left ${ selectedId === p.id ? 'bg-[var(--indigo)]/5' : '' }` }
              >
                <User size={ 14 } className={ selectedId === p.id ? 'text-[var(--indigo)]' : 'text-[var(--mute)]' } />
                <div className="min-w-0">
                  <div className={ `text-[11px] font-bold uppercase tracking-[0.1em] truncate ${ selectedId === p.id ? 'text-[var(--indigo)]' : 'text-[var(--ink)]' }` }>
                    { p.display_name }
                  </div>
                  { p.birthdate && (
                    <div className="text-[9px] font-medium tracking-wider text-[var(--mute)]">
                      { p.birthdate }{ p.birth_time ? ` · ${ p.birth_time }` : '' }
                    </div>
                  ) }
                </div>
                { selectedId === p.id && <div className="ml-auto w-1 h-1 bg-[var(--indigo)] rotate-45" /> }
              </button>

              <div className="flex pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={ () => setModal( p ) } className="p-2 text-[var(--mute)] hover:text-[var(--indigo)]"><Pencil size={ 13 } /></button>
                <button type="button" onClick={ () => handleDelete( p.id ) } className="p-2 text-[var(--mute)] hover:text-red-600"><Trash2 size={ 13 } /></button>
              </div>
            </div>
          ) ) }

          <div className="h-px bg-[var(--hair)] mx-4 my-1" />
          <button
            type="button"
            onClick={ () => { setModal( 'add' ); setOpen( false ); } }
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-[var(--indigo)] hover:bg-[var(--indigo)]/5 transition-colors"
          >
            <Plus size={ 14 } className="shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-[0.1em]">Add Person</span>
          </button>
        </div>
      ) }

      { modal && (
        <PersonModal
          initial={ modal === 'add' ? {} : modal }
          onSave={ handleSavePerson }
          onClose={ () => setModal( null ) }
        />
      ) }
    </div>
  );
}
