/**
 * CoreApp — root component for the LunaCco SPA shell.
 *
 * Provider tree:
 *   AppConfigProvider
 *     ModuleProvider
 *       AuthProvider
 *         UserProvider
 *           Shell (desktop or mobile layout)
 *             <CurrentView /> (resolved from module registry)
 *
 * The shell renders two distinct layouts based on viewport:
 *   - Desktop (>1024px): horizontal header + view content + footer overlay
 *   - Mobile (≤1024px): compact header + view content + bottom tab nav
 */

import React, { useCallback } from 'react';
import { AppConfigProvider } from './contexts/AppConfigContext.jsx';
import { ModuleProvider } from './contexts/ModuleContext.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { UserProvider } from './contexts/UserContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { HeaderExtrasProvider } from './contexts/HeaderExtrasContext.jsx';
import { useResponsive } from './hooks/useResponsive.js';
import { useRouter } from './hooks/useRouter.js';
import { useAuth } from './contexts/AuthContext.jsx';
import { useModuleRegistry } from './contexts/ModuleContext.jsx';

import DesktopAppHeader from './components/shell/DesktopAppHeader.jsx';
import MobileAppHeader from './components/shell/MobileAppHeader.jsx';
import MobileBottomNav from './components/shell/MobileBottomNav.jsx';
import AppFooter, { DisclaimerButton } from './components/shell/AppFooter.jsx';
import LoginModal from './components/auth/LoginModal.jsx';
import ProfileView from './components/profile/ProfileView.jsx';
import CoreSettingsView from './components/shell/CoreSettingsView.jsx';
import CoreDashboardView from './components/shell/CoreDashboardView.jsx';
import AdminThemeBuilderView from './components/shell/AdminThemeBuilderView.jsx';
import CoreChartsView from './components/shell/CoreChartsView.jsx';
import CoreCalendarView from './components/shell/CoreCalendarView.jsx';
import DefinitionsAdminView from './components/definitions/DefinitionsAdminView.jsx';
import SecurityAdminView from './components/security/SecurityAdminView.jsx';
import AdminFeaturedView from './components/shell/AdminFeaturedView.jsx';

// ------------------------------------------------------------------
// Shell — rendered inside all providers
// ------------------------------------------------------------------

function Shell() {
  const { isMobile } = useResponsive();
  const { view, param, setView: routerSetView } = useRouter();
  const { getViewComponent, setActiveModuleId, getViewModuleId } = useModuleRegistry();

  // Wrap setView so navigating to any view auto-switches the active module tab.
  // Accepts an optional deep-link param (e.g. a chart id or `spread:deck`).
  const setView = useCallback( ( key, nextParam = null ) => {
    const moduleId = getViewModuleId( key );
    if ( moduleId ) setActiveModuleId( moduleId );
    routerSetView( key, nextParam );
  }, [ routerSetView, getViewModuleId, setActiveModuleId ] );

  // Core-owned views take priority over module-registered view keys.
  let ViewComponent = null;
  if ( view === 'profile' ) {
    ViewComponent = ProfileView;
  } else if ( view === 'settings' ) {
    ViewComponent = CoreSettingsView;
  } else if ( view === 'dashboard' ) {
    ViewComponent = CoreDashboardView;
  } else if ( view === 'theme-builder' ) {
    ViewComponent = AdminThemeBuilderView;
  } else if ( view === 'charts' || view === 'core-charts' ) {
    // Chart shell lives in core; numerology + astrohd modules supply their pieces via window globals.
    ViewComponent = CoreChartsView;
  } else if ( view === 'core-calendar' ) {
    ViewComponent = CoreCalendarView;
  } else if ( view === 'admin-featured' ) {
    ViewComponent = AdminFeaturedView;
  } else {
    ViewComponent = getViewComponent( view );
  }

  if ( isMobile ) {
    return (
      <div className="flex flex-col h-dvh overflow-hidden text-[var(--ink)]">
        { /* Global background — always present behind all modules */ }
        <div className="fixed inset-0 -z-10 bg-[var(--paper)] transition-colors duration-700" />
        <MobileAppHeader setView={ setView } view={ view } />
        <main className="flex-1 min-h-0 overflow-y-auto relative z-0">
          <div className="min-h-full flex flex-col">
            <div className="flex-1 min-h-0 relative z-0">
              { ViewComponent ? <ViewComponent isMobileViewport={ true } setView={ setView } view={ view } routeParam={ param } /> : <NoViewPlaceholder view={ view } /> }
            </div>
            <AppFooter view={ view } showDisclaimerInline />
          </div>
        </main>
        <MobileBottomNav view={ view } setView={ setView } />
        <LoginModal />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh overflow-hidden text-[var(--ink)]">
      { /* Global background — always present behind all modules */ }
      <div className="fixed inset-0 -z-10 bg-[var(--paper)] transition-colors duration-700" />
      <DesktopAppHeader view={ view } setView={ setView } />
      <main className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
        { ViewComponent ? <ViewComponent isMobileViewport={ false } setView={ setView } view={ view } routeParam={ param } /> : <NoViewPlaceholder view={ view } /> }
      </main>
      { /* Fixed disclaimer button (bottom-left). The copyright/legal/AGPL footer renders
           in-flow at the bottom of each view's content column (see CoreDashboardView /
           CoreChartsView) so it scrolls with content and never overlaps the sidebar. */ }
      <DisclaimerButton view={ view } />
      <LoginModal />
    </div>
  );
}

function NoViewPlaceholder( { view } ) {
  return (
    <div className="flex items-center justify-center h-full text-[var(--mute)] text-sm">
      { view ? `View "${ view }" not found — no module has registered it.` : 'Loading…' }
    </div>
  );
}

// ------------------------------------------------------------------
// Root export — wraps Shell in all providers
// ------------------------------------------------------------------

export default function CoreApp() {
  if ( window.LunaCcoData?.appMode === 'definitions-admin' ) {
    return (
      <AppConfigProvider>
        <ModuleProvider>
          <AuthProvider>
            <UserProvider>
              <ThemeProvider>
                <HeaderExtrasProvider>
                  <DefinitionsAdminView />
                </HeaderExtrasProvider>
              </ThemeProvider>
            </UserProvider>
          </AuthProvider>
        </ModuleProvider>
      </AppConfigProvider>
    );
  }

  if ( window.LunaCcoData?.appMode === 'security-admin' ) {
    return (
      <AppConfigProvider>
        <ModuleProvider>
          <AuthProvider>
            <UserProvider>
              <ThemeProvider>
                <HeaderExtrasProvider>
                  <SecurityAdminView />
                </HeaderExtrasProvider>
              </ThemeProvider>
            </UserProvider>
          </AuthProvider>
        </ModuleProvider>
      </AppConfigProvider>
    );
  }

  return (
    <AppConfigProvider>
      <ModuleProvider>
        <AuthProvider>
          <UserProvider>
            <ThemeProvider>
              <HeaderExtrasProvider>
                <Shell />
              </HeaderExtrasProvider>
            </ThemeProvider>
          </UserProvider>
        </AuthProvider>
      </ModuleProvider>
    </AppConfigProvider>
  );
}
