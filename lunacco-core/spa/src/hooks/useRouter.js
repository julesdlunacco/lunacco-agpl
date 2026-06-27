/**
 * useRouter — hash-based router that reads valid view keys from the module registry.
 *
 * Provides:
 *   view              — current active view key (string)
 *   setView(key)      — update view and push hash
 *   canAccessView(key, { isLoggedIn, isAdmin }) — access guard
 */
import { useState, useEffect, useCallback } from 'react';
import { parseHash, pushViewHash } from '../utils/appViews.js';
import { useModuleRegistry } from '../contexts/ModuleContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

// Core-owned views that don't live in any module registry but are always valid.
const CORE_VIEWS = new Set( [ 'profile', 'settings', 'dashboard', 'theme-builder', 'core-charts', 'core-calendar', 'admin-featured' ] );

export function useRouter() {
  const { getAllViewKeys, getNavItems, modules } = useModuleRegistry();
  const { isLoggedIn, isAdmin } = useAuth();

  const canAccessView = useCallback( ( key ) => {
    if ( CORE_VIEWS.has( key ) ) return true; // core handles auth internally
    const allKeys = getAllViewKeys();
    if ( !allKeys.includes( key ) ) return false;

    const navItems = getNavItems();
    const item = navItems.find( ( n ) => n.key === key );
    if ( !item ) return true; // no auth requirement declared
    if ( item.requiresAuth && !isLoggedIn ) return false;
    if ( item.requiresAdmin && !isAdmin ) return false;
    return true;
  }, [ getAllViewKeys, getNavItems, isLoggedIn, isAdmin ] );

  // Module home views that yield to the shared dashboard when 2+ modules are active.
  const MODULE_HOME_KEYS = new Set( [ 'num-home' ] );

  // Resolve the view key + opaque deep-link param from the current hash.
  const resolveRoute = useCallback( () => {
    const allKeys = [ ...getAllViewKeys(), ...CORE_VIEWS ];
    const { view: fromHash, param } = parseHash( window.location.hash, allKeys, null );

    // Default to dashboard when 2+ modules are active OR if only numerology is active.
    if ( modules.length >= 2 || ( modules.length === 1 && modules[ 0 ].id === 'luna-numerology' ) ) {
      if ( fromHash && !MODULE_HOME_KEYS.has( fromHash ) && canAccessView( fromHash ) ) return { view: fromHash, param };
      return { view: 'dashboard', param: null };
    }

    if ( canAccessView( fromHash ) ) return { view: fromHash, param };
    // Fall back to first accessible module view key
    const first = getAllViewKeys().find( ( k ) => canAccessView( k ) );
    return { view: first || 'home', param: null };
  }, [ canAccessView, getAllViewKeys, modules ] );

  const [ route, setRoute ] = useState( () => resolveRoute() );
  const { view, param } = route;

  const setView = useCallback( ( key, nextParam = null ) => {
    if ( !canAccessView( key ) ) return;
    setRoute( { view: key, param: nextParam } );
    pushViewHash( key, nextParam );
  }, [ canAccessView ] );

  useEffect( () => {
    const syncFromHash = () => {
      const next = resolveRoute();
      setRoute( next );
      const expectedHash = `#${ next.param ? `${ next.view }/${ encodeURIComponent( next.param ) }` : next.view }`;
      if ( window.location.hash !== expectedHash ) {
        window.location.hash = expectedHash;
      }
    };
    syncFromHash();
    window.addEventListener( 'hashchange', syncFromHash );
    return () => window.removeEventListener( 'hashchange', syncFromHash );
  }, [ resolveRoute ] );

  return { view, param, setView, canAccessView };
}
