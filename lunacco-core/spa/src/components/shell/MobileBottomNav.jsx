/**
 * MobileBottomNav — bottom tab navigation for mobile/tablet viewports.
 *
 * - When in Tarot context: shows Tarot module nav items.
 * - Otherwise: shows shared Charts / Calendar tabs plus a Tarot shortcut.
 */
import React from 'react';
import { BarChart3, Calendar, Star } from 'lucide-react';
import { useModuleRegistry } from '../../contexts/ModuleContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';

const CHART_MODULE_IDS  = new Set( [ 'luna-numerology', 'luna-astrohd' ] );
const CALENDAR_VIEW_KEYS = new Set( [ 'calendar', 'core-calendar' ] );

export default function MobileBottomNav( { view, setView } ) {
  const { modules, getNavItemsForModule, getViewModuleId } = useModuleRegistry();
  const { isLoggedIn, isAdmin } = useAuth();

  const currentModuleId = getViewModuleId( view );
  const isTarotView = currentModuleId === 'luna-tarot';

  // When inside Tarot, show Tarot's own nav items.
  if ( isTarotView ) {
    const tarotItems = getNavItemsForModule( 'luna-tarot' ).filter( ( item ) => {
      if ( item.requiresAuth && !isLoggedIn ) return false;
      if ( item.requiresAdmin && !isAdmin ) return false;
      return true;
    } );

    if ( !tarotItems.length ) return null;

    return (
      <nav
        className="shrink-0 border-t border-[var(--hair)] bg-[var(--paper)] backdrop-blur-lg px-2 py-2 grid gap-1 relative z-[220]"
        style={ { gridTemplateColumns: `repeat(${ tarotItems.length }, minmax(0, 1fr))` } }
        aria-label="Mobile navigation"
      >
        { tarotItems.map( ( item ) => {
          const Icon = item.icon;
          return (
            <button
              key={ item.key }
              onClick={ () => setView( item.key ) }
              className={ `rounded-xl py-1.5 text-xs font-semibold flex flex-col items-center gap-0.5 transition-colors ${ view === item.key ? 'text-[var(--indigo)]' : 'text-[var(--mute)] hover:text-[var(--ink)]' }` }
            >
              { Icon && <Icon size={ 18 } /> }
              <span className="text-[10px] uppercase tracking-wider">{ item.label }</span>
            </button>
          );
        } ) }
      </nav>
    );
  }

  // For Charts / Calendar / dashboard contexts, show top-level shared tabs.
  const hasChartModule = modules.some( ( m ) => CHART_MODULE_IDS.has( m.id ) );
  // Calendar is numerology-only for now (AstroHD calendar is a later-todo).
  const hasNumerology  = modules.some( ( m ) => m.id === 'luna-numerology' );
  const hasTarot       = modules.some( ( m ) => m.id === 'luna-tarot' );

  if ( !hasChartModule && !hasTarot ) return null;

  const isChartsActive   = view === 'core-charts' || ( CHART_MODULE_IDS.has( currentModuleId ) && !CALENDAR_VIEW_KEYS.has( view ) );
  const isCalendarActive = CALENDAR_VIEW_KEYS.has( view );

  const sharedItems = [];
  if ( hasChartModule ) {
    sharedItems.push( { key: 'core-charts',   label: 'Charts',   icon: BarChart3, active: isChartsActive } );
  }
  if ( hasNumerology ) {
    sharedItems.push( { key: 'core-calendar', label: 'Calendar', icon: Calendar,  active: isCalendarActive } );
  }
  if ( hasTarot ) {
    const firstTarot = getNavItemsForModule( 'luna-tarot' ).find( ( i ) => !i.requiresAuth || isLoggedIn );
    if ( firstTarot ) {
      sharedItems.push( { key: firstTarot.key, label: 'Tarot', icon: Star, active: currentModuleId === 'luna-tarot' } );
    }
  }

  return (
    <nav
      className="shrink-0 border-t border-[var(--hair)] bg-[var(--paper)] backdrop-blur-lg px-2 py-2 grid gap-1 relative z-[220]"
      style={ { gridTemplateColumns: `repeat(${ sharedItems.length }, minmax(0, 1fr))` } }
      aria-label="Mobile navigation"
    >
      { sharedItems.map( ( item ) => {
        const Icon = item.icon;
        return (
          <button
            key={ item.key }
            onClick={ () => setView( item.key ) }
            className={ `rounded-xl py-1.5 text-xs font-semibold flex flex-col items-center gap-0.5 transition-colors ${ item.active ? 'text-[var(--indigo)]' : 'text-[var(--mute)] hover:text-[var(--ink)]' }` }
          >
            <Icon size={ 18 } />
            <span className="text-[10px] uppercase tracking-wider">{ item.label }</span>
          </button>
        );
      } ) }
    </nav>
  );
}
