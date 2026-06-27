/**
 * CoreCalendarView — Calendar landing page.
 *
 * Aggregates calendar views from all modules.
 * Currently routes directly to Numerology's pythagorean calendar.
 * Will expand to include AstroHD transit calendar and others.
 */
import { useEffect } from 'react';
import { useModuleRegistry } from '../../contexts/ModuleContext.jsx';
import { Calendar, ChevronRight } from 'lucide-react';

const CALENDAR_OPTIONS = [
  {
    viewKey: 'calendar',
    label: 'Personal Year Calendar',
    desc: 'Pythagorean personal day, month & year cycles',
    moduleId: 'luna-numerology',
    moduleLabel: 'Numerology',
    icon: Calendar,
  },
];

export default function CoreCalendarView( { setView, isMobileViewport } ) {
  const { getAllViewKeys } = useModuleRegistry();
  const registeredViews = new Set( getAllViewKeys() );

  const available = CALENDAR_OPTIONS.filter( ( opt ) => registeredViews.has( opt.viewKey ) );

  // If only one calendar is available, go there directly.
  useEffect( () => {
    if ( available.length === 1 ) {
      setView( available[ 0 ].viewKey );
    }
  }, [] ); // eslint-disable-line react-hooks/exhaustive-deps

  if ( available.length <= 1 ) return null;

  return (
    <div className={ `overflow-y-auto ${ isMobileViewport ? 'p-4' : 'p-8' }` }>
      <div className={ `mx-auto ${ isMobileViewport ? 'max-w-full' : 'max-w-2xl' }` }>

        <div className="mb-8 border-b border-[var(--hair)] pb-6">
          <h2 className="text-2xl font-normal italic text-[var(--ink)]" style={ { fontFamily: 'var(--font-display)' } }>Calendar</h2>
          <p className="text-[11px] text-[var(--mute)] mt-1 uppercase tracking-[0.15em]">Choose a calendar view</p>
        </div>

        <div className="space-y-2">
          { available.map( ( opt ) => {
            const Icon = opt.icon;
            return (
              <button
                key={ opt.viewKey }
                type="button"
                onClick={ () => setView( opt.viewKey ) }
                className="group w-full flex items-center gap-4 p-4 border border-[var(--hair)] text-left hover:border-[var(--indigo)] hover:bg-[var(--indigo)]/5 transition-all"
              >
                <div className="shrink-0 w-10 h-10 flex items-center justify-center border border-[var(--hair)] text-[var(--indigo)] group-hover:bg-[var(--indigo)] group-hover:text-[var(--btn-fg)] transition-colors">
                  <Icon size={ 18 } />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink)] truncate">{ opt.label }</div>
                  <div className="text-[10px] text-[var(--mute)] mt-0.5 truncate">{ opt.desc }</div>
                </div>
                <ChevronRight size={ 14 } className="shrink-0 text-[var(--mute)] group-hover:text-[var(--indigo)] transition-colors" />
              </button>
            );
          } ) }
        </div>
      </div>
    </div>
  );
}
