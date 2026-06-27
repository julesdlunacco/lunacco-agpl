/**
 * HeaderExtrasContext — core-level header state shared across all modules.
 *
 * Manages:
 *   registerSave(config) — modules call this to wire a Save button into the header
 *                          config: { onSave, saving, label? }
 *                          pass null to unregister.
 *
 * By living in core, the Save button works on every view,
 * not just when a specific module is mounted.
 */
import { createContext, useContext, useState, useCallback } from 'react';

const HeaderExtrasContext = createContext( null );

export function useHeaderExtras() {
  const ctx = useContext( HeaderExtrasContext );
  if ( !ctx ) throw new Error( 'useHeaderExtras must be used within HeaderExtrasProvider' );
  return ctx;
}

export function HeaderExtrasProvider( { children } ) {
  // Modules register { onSave, saving, label } or null to clear.
  const [ saveConfig, setSaveConfig ] = useState( null );

  const registerSave = useCallback( ( config ) => {
    setSaveConfig( config ? { label: 'Save', ...config } : null );
  }, [] );

  return (
    <HeaderExtrasContext.Provider value={ { saveConfig, registerSave } }>
      { children }
    </HeaderExtrasContext.Provider>
  );
}
