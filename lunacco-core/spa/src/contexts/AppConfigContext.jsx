/**
 * AppConfigContext — read-only branding and URL configuration from LunaCcoData.
 *
 * All values come from window.LunaCcoData (populated by wp_localize_script).
 * This context is never updated after mount — it's purely a static snapshot.
 */

import { createContext, useContext, useMemo } from 'react';

export const AppConfigContext = createContext( null );

export function useAppConfig() {
  const ctx = useContext( AppConfigContext );
  if ( !ctx ) throw new Error( 'useAppConfig must be used within AppConfigProvider' );
  return ctx;
}

export function AppConfigProvider( { children } ) {
  const config = useMemo( () => {
    const d = window.LunaCcoData || {};
    return {
      // REST / AJAX
      root: d.root || '',
      ajaxUrl: d.ajaxUrl || '',
      nonce: d.nonce || '',
      pluginUrl: d.pluginUrl || '',

      // Auth flags (from WP at page load)
      isAdmin: !!d.isAdmin,
      isLoggedIn: !!d.isLoggedIn,

      // Branding
      appHeaderTitle: d.appHeaderTitle || 'Cosmic Oracle',
      appHeaderLogoUrl: d.appHeaderLogoUrl || '',
      footerDisclaimer: d.footerDisclaimer || '',

      // Footer legal links + AGPL source link (set in Business Settings)
      footerLinks: Array.isArray( d.footerLinks ) ? d.footerLinks : [],
      agplSourceUrl: d.agplSourceUrl || '',
      footerCopyrightText: d.footerCopyrightText || '',
      footerCopyrightTextTarot: d.footerCopyrightTextTarot || '',

      // Nav labels
      returnMainUrl: d.returnMainUrl || '',
      returnMainLabel: d.returnMainLabel || 'Home',
      pickLabel: d.pickLabel || 'Pick',

      // Commerce URLs
      buyCreditsUrl: d.buyCreditsUrl || '',
      becomeMemberUrl: d.becomeMemberUrl || '',

      // Auth modal
      authModalDisabled: !!d.authModalDisabled,
      authPageUrl: d.authPageUrl || '',
      authButtonLabel: d.authButtonLabel || 'Sign Up or Login',
      signupPromoText: d.signupPromoText || '',

      // App URL (current page permalink)
      appUrl: d.appUrl || window.location.href,
      loginUrl: d.loginUrl || '',

      // PDF settings
      pdfSettings: {
        useHeaderLogo: !!( d.pdfSettings?.useHeaderLogo ?? true ),
        copyrightCompany: d.pdfSettings?.copyrightCompany || 'Cosmic Oracle',
        copyrightYear: d.pdfSettings?.copyrightYear || new Date().getFullYear(),
        copyrightNoticeCustom: d.pdfSettings?.copyrightNoticeCustom || '',
      },

      // Module data (each module appends to this during localize)
      modules: d.modules || {},

      // Module-scoped footer notices. Each entry:
      //   { id, text, show_on_views: string[] }
      // Rendered by AppFooter when the active view key is in show_on_views.
      moduleFooterNotices: Array.isArray( d.moduleFooterNotices ) ? d.moduleFooterNotices : [],
    };
  }, [] );

  return (
    <AppConfigContext.Provider value={ config }>
      { children }
    </AppConfigContext.Provider>
  );
}
