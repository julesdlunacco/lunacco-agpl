/**
 * LunaCco Core — SPA entry point.
 *
 * Boot sequence:
 *  1. Expose window.React, window.ReactJSXRuntime, window.LunaCcoHooks so that
 *     module bundles (IIFE, loaded after core via WP script deps) can share the
 *     same React instance and call core context hooks.
 *  2. Define window.LunaCcoModuleRegistry so module scripts can register their
 *     views/navItems BEFORE React mounts.
 *  3. On DOMContentLoaded, defer mount by one tick (setTimeout 0) so synchronous
 *     module IIFE scripts finish calling register() first.
 *  4. Mount CoreApp into #lunacco-app (production) or #root (Vite dev server).
 */

import React, { StrictMode } from 'react';
import * as ReactJSXRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as FramerMotion from 'framer-motion';
import * as LucideReact from 'lucide-react';
import './index.css';
// Global editorial primitives (the "Broadsheet" design language), re-tokenized onto
// the live theme system. Loaded after index.css so component classes win the cascade.
import './styles/broadsheet.css';
import CoreApp from './CoreApp.jsx';
import { useAuth } from './contexts/AuthContext.jsx';
import { useUser } from './contexts/UserContext.jsx';
import { useAppConfig } from './contexts/AppConfigContext.jsx';
import { useHeaderExtras } from './contexts/HeaderExtrasContext.jsx';
import { useModuleRegistry } from './contexts/ModuleContext.jsx';
import PersonSelector from './components/shared/PersonSelector.jsx';
import CitySearchInput from './components/shared/CitySearchInput.jsx';
import { EditorialCard, EditorialCards, Keynote, Question } from './components/shared/editorial/EditorialCard.jsx';

// Expose shared React globals for module bundles that externalize react.
window.React            = React;
window.ReactJSXRuntime  = ReactJSXRuntime;
window.ReactDOM         = ReactDOM;

// Expose framer-motion and lucide-react so module bundles use the SAME
// instance. Multiple framer-motion instances sharing one React runtime
// conflict in getSnapshotBeforeUpdate and cause crashes.
window.FramerMotion = FramerMotion;
window.LucideReact  = LucideReact;

// Expose core context hooks so module bundles can call them inside components
// that are rendered within CoreApp's provider tree.
window.LunaCcoHooks = { useAuth, useUser, useAppConfig, useHeaderExtras, useModuleRegistry };

// Expose shared UI components so module bundles can use core-owned components
// without duplicating them across plugin bundles.
window.LunaCcoShared = { PersonSelector, CitySearchInput, EditorialCard, EditorialCards, Keynote, Question };

// ------------------------------------------------------------------
// Module registry — defined here so module bundles (loaded as WP
// script dependencies) can call window.LunaCcoModuleRegistry.register()
// before React renders.
// ------------------------------------------------------------------
if ( ! window.LunaCcoModuleRegistry ) {
  window.LunaCcoModuleRegistry = {
    _modules: {},

    /**
     * Register a module's client-side configuration.
     *
     * @param {string} moduleId  Unique slug matching the PHP registry, e.g. 'luna-tarot'.
     * @param {object} config
     * @param {object} config.views     Map of viewKey → React component, e.g. { home: HomeView }.
     * @param {Array}  config.navItems  [{ key, label, icon, order, requiresAuth, requiresAdmin }]
     */
    register( moduleId, config ) {
      this._modules[ moduleId ] = {
        views:    {},
        navItems: [],
        ...config,
      };
    },

    /** Returns the component registered for a view key, or null. */
    getViewComponent( viewKey ) {
      for ( const mod of Object.values( this._modules ) ) {
        if ( mod.views[ viewKey ] ) return mod.views[ viewKey ];
      }
      return null;
    },

    /** Returns merged, ordered nav items from all modules. */
    getNavItems() {
      const items = [];
      for ( const mod of Object.values( this._modules ) ) {
        items.push( ...( mod.navItems || [] ) );
      }
      return items.sort( ( a, b ) => ( a.order ?? 99 ) - ( b.order ?? 99 ) );
    },

    /** Returns all view keys contributed by all modules. */
    getAllViewKeys() {
      const keys = [];
      for ( const mod of Object.values( this._modules ) ) {
        keys.push( ...Object.keys( mod.views || {} ) );
      }
      return [ ...new Set( keys ) ];
    },
  };
}

// ------------------------------------------------------------------
// Mount React
// ------------------------------------------------------------------
function mount() {
  const container =
    document.getElementById( 'lunacco-app' ) ||
    // Vite dev server fallback.
    ( import.meta.env.DEV ? document.getElementById( 'root' ) : null );

  if ( ! container ) return;

  createRoot( container ).render(
    <StrictMode>
      <CoreApp />
    </StrictMode>,
  );
}

// Defer mount by one tick after DOMContentLoaded so that synchronous module
// IIFE scripts (loaded as WP script dependents of lunacco-core-app) have had a
// chance to call window.LunaCcoModuleRegistry.register() before React renders.
if ( document.readyState === 'loading' ) {
  document.addEventListener( 'DOMContentLoaded', () => setTimeout( mount, 0 ) );
} else {
  setTimeout( mount, 0 );
}
