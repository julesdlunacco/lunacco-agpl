/**
 * CoreSettingsView — unified admin settings page.
 *
 * Rendered by core Shell when view === 'settings'.
 * Each module registers a `settingsSection` component in its registry entry.
 * This view collects them all and renders them with module-name headings
 * (or tabs when there are multiple modules).
 */
import React, { useState } from 'react';
import { Settings } from 'lucide-react';

export default function CoreSettingsView( { isMobileViewport, setView } ) {
  const reg = window.LunaCcoModuleRegistry;
  const moduleEntries = Object.entries( reg?._modules || {} );

  // Collect modules that have a settingsSection component.
  const sections = moduleEntries
    .map( ( [ id, mod ] ) => ( { id, label: mod.label || id, Section: mod.settingsSection } ) )
    .filter( ( s ) => !!s.Section );

  const [ activeTab, setActiveTab ] = useState( sections[ 0 ]?.id || null );
  const active = sections.find( ( s ) => s.id === activeTab );

  if ( !sections.length ) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--mute)] text-sm italic">
        No settings sections registered by any module.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--paper)]">
      { /* Header */ }
      <div className="px-8 pt-8 pb-4 shrink-0 border-b border-[var(--hair)]">
        <h1 className="text-3xl font-light tracking-widest uppercase flex items-center gap-4 text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>
          <Settings size={ 24 } className="text-[var(--indigo)]" />
          Settings
        </h1>

        { /* Module tabs — only when multiple modules have settings */ }
        { sections.length > 1 && (
          <div className="flex gap-1 mt-6" role="tablist">
            { sections.map( ( s ) => (
              <button
                key={ s.id }
                role="tab"
                aria-selected={ activeTab === s.id }
                onClick={ () => setActiveTab( s.id ) }
                className={ `px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${ activeTab === s.id ? 'bg-[var(--indigo)] text-[var(--btn-fg)]' : 'text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--card)]' }` }
                style={{ borderRadius: 'var(--radius-card, 0px)' }}
              >
                { s.label }
              </button>
            ) ) }
          </div>
        ) }
      </div>

      { /* Active section */ }
      <div className="flex-1 min-h-0 overflow-y-auto" role="tabpanel">
        <div className="max-w-4xl mx-auto px-8 py-10">
          { active && <active.Section isMobileViewport={ isMobileViewport } setView={ setView } /> }
        </div>
      </div>
    </div>
  );
}
