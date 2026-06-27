/**
 * Luna AstroHD — module entry point (IIFE).
 *
 * Registers AstroHDApp for all view keys so AstroHDContext state
 * persists across navigation without unmounting.
 */

import { CircleDot, Orbit, Users, CalendarClock, Settings, Layers, GitMerge, Aperture, SlidersHorizontal, Star } from 'lucide-react';
import AstroHDApp from './AstroHDApp.jsx';
import NatalView          from './views/NatalView.tsx';
import ShadowView         from './views/ShadowView.tsx';
import TransitView        from './views/TransitView.tsx';
import SnapshotView       from './views/SnapshotView.tsx';
import ConnectionView     from './views/ConnectionView.jsx';
import WheelView          from './views/WheelView.tsx';
import DualWheelView      from './views/DualWheelView.tsx';
import CombinedView       from './views/CombinedView.tsx';
import TransitBirthView   from './views/TransitBirthView.tsx';
import AsteroidsView      from './views/AsteroidsView.tsx';
import { getAstroHDChartTypes, AstroHDPanel, AstroHDCenterPane } from './components/AstroHDShell.jsx';

const ALL_VIEWS = {
  'astrohd-natal':       AstroHDApp,
  'astrohd-shadow':      AstroHDApp,
  'astrohd-transit':     AstroHDApp,
  'astrohd-connection':  AstroHDApp,
  'astrohd-snapshot':    AstroHDApp,
  'astrohd-asteroids':   AstroHDApp,
  'astrohd-chart-maker': AstroHDApp,
  'astrohd-selection-presets': AstroHDApp,
  'astrohd-settings':    AstroHDApp,
};

const NAV_ITEMS = [
  { key: 'astrohd-natal',       label: 'Bodygraph',   icon: CircleDot,      requiresAuth: false, requiresAdmin: false, order: 20 },
  { key: 'astrohd-shadow',      label: 'Shadow',      icon: Aperture,       requiresAuth: false, requiresAdmin: false, order: 21 },
  { key: 'astrohd-transit',     label: 'Transits',    icon: Orbit,          requiresAuth: false, requiresAdmin: false, order: 22 },
  { key: 'astrohd-connection',  label: 'Connections', icon: Users,          requiresAuth: true,  requiresAdmin: false, order: 23 },
  { key: 'astrohd-snapshot',    label: 'Snapshot',    icon: CalendarClock,  requiresAuth: false, requiresAdmin: false, order: 24 },
  { key: 'astrohd-asteroids',   label: 'Asteroids',   icon: Layers,         requiresAuth: false, requiresAdmin: false, order: 25 },
  { key: 'astrohd-chart-maker', label: 'Chart Maker', icon: SlidersHorizontal, requiresAuth: true, requiresAdmin: true, order: 26 },
  { key: 'astrohd-selection-presets', label: 'Selection Presets', icon: Star, requiresAuth: true, requiresAdmin: true, order: 27 },
];

// Expose chart views + shell components + chart type definitions so CoreChartsView can embed them.
window.LunaCcoAstroHDCharts = {
  NatalView, ShadowView, TransitView, SnapshotView, ConnectionView,
  WheelView, DualWheelView, CombinedView, TransitBirthView, AsteroidsView,
  CHART_TYPES: getAstroHDChartTypes(),
  Panel:       AstroHDPanel,
  CenterPane:  AstroHDCenterPane,
};

if ( window.LunaCcoModuleRegistry ) {
  window.LunaCcoModuleRegistry.register( 'luna-astrohd', {
    label:    'AstroHD',
    views:    ALL_VIEWS,
    navItems: NAV_ITEMS,
  } );
}

// ------------------------------------------------------------------
// Dashboard daily data pipeline.
//
// Publishes window.LunaCcoAstroHDDaily and dispatches a
// 'lunacco:astrohd-daily' CustomEvent. Widgets in core's
// CoreDashboardView subscribe to both. Cached in sessionStorage
// (12h TTL) so WASM init only runs once per session.
// ------------------------------------------------------------------
import { computeAndPublishDaily } from './dashboardDaily.ts';

if ( typeof window !== 'undefined' ) {
  const kick = () => computeAndPublishDaily().catch( ( e ) => console.error( '[luna-astrohd]', e ) );
  if ( 'requestIdleCallback' in window ) {
    window.requestIdleCallback( kick, { timeout: 2000 } );
  } else {
    setTimeout( kick, 0 );
  }
}
