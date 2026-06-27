/**
 * ModuleContext — reads window.LunaCcoModuleRegistry and exposes helpers.
 *
 * Provides:
 *   getViewComponent(viewKey)         — returns React component registered for a view key
 *   getNavItems()                     — merged, ordered nav items from all modules
 *   getAllViewKeys()                   — every registered view key
 *   modules                           — array of { id, label } for all registered modules
 *   activeModuleId                    — currently active module tab id
 *   setActiveModuleId(id)             — switch active module tab
 *   getNavItemsForModule(moduleId)    — ordered nav items for a specific module
 *   getViewModuleId(viewKey)          — which module owns a given view key
 */

import { createContext, useContext, useMemo, useState, useCallback } from 'react';

export const ModuleContext = createContext( null );

export function useModuleRegistry() {
  const ctx = useContext( ModuleContext );
  if ( !ctx ) throw new Error( 'useModuleRegistry must be used within ModuleProvider' );
  return ctx;
}

export function ModuleProvider( { children } ) {
  // Derive static module list once on mount.
  const modules = useMemo( () => {
    const reg = window.LunaCcoModuleRegistry;
    return Object.entries( reg?._modules || {} ).map( ( [ id, mod ] ) => ( {
      id,
      label: mod.label || id,
    } ) );
  }, [] );

  const [ activeModuleId, setActiveModuleId ] = useState( () => modules[ 0 ]?.id || null );

  const getViewModuleId = useCallback( ( viewKey ) => {
    const reg = window.LunaCcoModuleRegistry;
    for ( const [ id, mod ] of Object.entries( reg?._modules || {} ) ) {
      if ( mod.views?.[ viewKey ] ) return id;
    }
    return null;
  }, [] );

  const getNavItemsForModule = useCallback( ( moduleId ) => {
    const reg = window.LunaCcoModuleRegistry;
    return ( reg?._modules?.[ moduleId ]?.navItems || [] )
      .slice()
      .sort( ( a, b ) => ( a.order ?? 99 ) - ( b.order ?? 99 ) );
  }, [] );

  const registry = useMemo( () => {
    const reg = window.LunaCcoModuleRegistry;
    return {
      getViewComponent: ( key ) => reg?.getViewComponent?.( key ) || null,
      getNavItems: () => reg?.getNavItems?.() || [],
      getAllViewKeys: () => reg?.getAllViewKeys?.() || [],
    };
  }, [] );

  const value = useMemo( () => ( {
    ...registry,
    modules,
    activeModuleId,
    setActiveModuleId,
    getNavItemsForModule,
    getViewModuleId,
  } ), [ registry, modules, activeModuleId, setActiveModuleId, getNavItemsForModule, getViewModuleId ] );

  return (
    <ModuleContext.Provider value={ value }>
      { children }
    </ModuleContext.Provider>
  );
}
