/**
 * MobileAppHeader — compact header for mobile/tablet viewports.
 *
 * Native-app-like design: logo/title on left, auth/profile button on right.
 */
import React, { useState } from 'react';
import { Moon, Sparkles, Sun, User, Palette, ExternalLink, LogOut, Home } from 'lucide-react';
import { useAppConfig } from '../../contexts/AppConfigContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useUser } from '../../contexts/UserContext.jsx';
import { useModuleRegistry } from '../../contexts/ModuleContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';

export default function MobileAppHeader( { setView, view } ) {
  const {
    appHeaderTitle, appHeaderLogoUrl,
    returnMainUrl, returnMainLabel,
    buyCreditsUrl, becomeMemberUrl,
    authButtonLabel,
  } = useAppConfig();
  const { isLoggedIn, isAdmin, openLoginModal, performLogout } = useAuth();
  const { userContext } = useUser();
  const { modules, activeModuleId, setActiveModuleId, getNavItemsForModule } = useModuleRegistry();
  const { activeThemeId, setTheme, setMode, themes } = useTheme();
  const [ showProfileMenu, setShowProfileMenu ] = useState( false );

  const activeTheme = themes.find( t => t.id === activeThemeId );

  const toggleMode = () => {
    setMode( activeTheme?.mode === 'light' ? 'dark' : 'light' );
  };

  return (
    <header className="px-4 py-3 border-b border-[var(--hair)] bg-[var(--paper)] shrink-0 relative z-[220]">
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          { appHeaderLogoUrl ? (
            <img src={ appHeaderLogoUrl } alt={ appHeaderTitle } className="h-9 w-auto object-contain" />
          ) : (
            <div className="min-w-0">
              <h1 className="text-xl italic font-normal truncate" style={{ fontFamily: 'var(--font-display)' }}>{ appHeaderTitle }</h1>
            </div>
          ) }
        </div>

        <div className="flex items-center gap-2">
          { /* Simple theme toggle for mobile */ }
          <button 
            onClick={ toggleMode }
            className="p-2 border border-[var(--hair)] bg-[var(--card)] text-[var(--ink)]"
          >
            { activeTheme?.mode === 'dark' ? <Moon size={16} /> : <Sun size={16} /> }
          </button>

          { !isLoggedIn ? (
            <button
              onClick={ openLoginModal }
              className="px-3 py-1.5 bg-[var(--indigo)] text-[var(--btn-fg)] text-[10px] font-bold uppercase tracking-widest border border-[var(--indigo)]"
            >
              { authButtonLabel }
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={ () => setShowProfileMenu( ( prev ) => !prev ) }
                className="flex items-center gap-2 bg-[var(--card)] border border-[var(--hair)] p-1"
                aria-label="Open account menu"
                aria-expanded={ showProfileMenu }
              >
                <div className="w-6 h-6 border border-[var(--ink)] bg-[var(--paper-2)] flex items-center justify-center overflow-hidden">
                  { userContext.avatar_url
                    ? <img src={ userContext.avatar_url } alt={ `${ userContext.display_name || userContext.username || 'User' } avatar` } className="w-full h-full object-cover" />
                    : <User size={ 13 } className="text-[var(--ink)]" />
                  }
                </div>
              </button>

              { showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-[var(--card)] border border-[var(--ink)] shadow-2xl p-1 z-[500]">
                  <div className="px-3 py-2 text-[9px] uppercase tracking-widest font-bold text-[var(--mute)] border-b border-[var(--hair)] mb-1">
                    Credits: { userContext.balance }
                  </div>
                  <button onClick={ () => { setView( 'profile' ); setShowProfileMenu( false ); } } className="w-full text-left px-3 py-2 text-[11px] uppercase tracking-wider hover:bg-[var(--card-2)] transition flex items-center gap-2 text-[var(--ink)]">
                    <User size={14} /> Profile
                  </button>
                  { isAdmin && (
                    <>
                      <button onClick={ () => { setView( 'theme-builder' ); setShowProfileMenu( false ); } } className="w-full text-left px-3 py-2 text-[11px] uppercase tracking-wider hover:bg-[var(--card-2)] transition flex items-center gap-2 text-[var(--ink)]">
                        <Palette size={14} /> Theme Builder
                      </button>
                      <button onClick={ () => { setView( 'admin-featured' ); setShowProfileMenu( false ); } } className="w-full text-left px-3 py-2 text-[11px] uppercase tracking-wider hover:bg-[var(--card-2)] transition flex items-center gap-2 text-[var(--ink)]">
                        ★ Featured &amp; Levels
                      </button>
                    </>
                  ) }
                  <a href={ userContext.account_url || `${ window.location.origin }/account` } target="_blank" rel="noreferrer" className="block px-3 py-2 text-[11px] uppercase tracking-wider hover:bg-[var(--card-2)] transition flex items-center gap-2 text-[var(--ink)]">
                    <ExternalLink size={14} /> Manage Account
                  </a>
                  { !!returnMainUrl && (
                    <a href={ returnMainUrl } className="block px-3 py-2 text-[11px] uppercase tracking-wider hover:bg-[var(--card-2)] transition flex items-center gap-2 text-[var(--ink)]">
                      <Home size={14} /> { returnMainLabel }
                    </a>
                  ) }
                  <div className="px-3 py-2 text-[9px] uppercase tracking-widest font-bold text-[var(--mute)] border-t border-b border-[var(--hair)] my-1">
                    Theme & Appearance
                  </div>
                  <div className="p-1 flex flex-col gap-1">
                    <button 
                      onClick={ toggleMode }
                      className="w-full text-left px-2 py-2 text-[10px] uppercase tracking-wider hover:bg-[var(--card-2)] transition flex items-center justify-between text-[var(--ink)]"
                    >
                      <div className="flex items-center gap-2">
                        { activeTheme?.mode === 'dark' ? <Moon size={14} /> : <Sun size={14} /> }
                        <span>{ activeTheme?.mode === 'dark' ? 'Dark' : 'Light' } Mode</span>
                      </div>
                      <span className="text-[8px] opacity-40">Toggle</span>
                    </button>
                    
                    <div className="grid grid-cols-2 gap-1 mt-1">
                       {themes.filter(t => !t.id.startsWith('custom-') && t.mode === activeTheme?.mode).map(f => (
                        <button
                          key={f.id}
                          onClick={() => { setTheme(f.id); }}
                          className={`flex items-center gap-2 px-2 py-2 text-[9px] uppercase tracking-wider hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] transition ${activeThemeId === f.id ? 'font-bold text-[var(--indigo)] bg-[var(--mute)]/5' : 'text-[var(--ink)]'}`}
                        >
                          <div className="w-2 h-2 shrink-0 border border-[var(--mute)]/20" style={{ backgroundColor: f.color }} />
                          <span className="truncate">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={ performLogout } className="w-full text-left px-3 py-2 text-[11px] uppercase tracking-wider hover:bg-[var(--card-2)] transition flex items-center gap-2 text-rose-500 font-bold border-t border-[var(--hair)] mt-1">
                    <LogOut size={14} /> Logout
                  </button>
                </div>
              ) }
            </div>
          ) }
        </div>
      </div>

      { /* Top-level tabs — shown when 1+ modules are registered */ }
      { modules.length >= 1 && ( () => {
        const CHART_MODULE_IDS = new Set( [ 'luna-numerology', 'luna-astrohd' ] );
        const CALENDAR_VIEWS   = new Set( [ 'calendar', 'core-calendar' ] );
        const hasChartModule   = modules.some( ( m ) => CHART_MODULE_IDS.has( m.id ) );
        // Calendar is numerology-only for now (AstroHD calendar is a later-todo).
        const hasNumerology    = modules.some( ( m ) => m.id === 'luna-numerology' );
        const hasTarot         = modules.some( ( m ) => m.id === 'luna-tarot' );
        const currentIsChart   = modules.some( ( m ) => CHART_MODULE_IDS.has( m.id ) && getNavItemsForModule( m.id ).some( ( i ) => i.key === view ) );
        const isChartActive    = view === 'core-charts' || ( currentIsChart && !CALENDAR_VIEWS.has( view ) );
        const isCalendarActive = CALENDAR_VIEWS.has( view );
        const isTarotActive    = modules.find( ( m ) => m.id === 'luna-tarot' ) && getNavItemsForModule( 'luna-tarot' ).some( ( i ) => i.key === view );

        const btnCls = ( active ) => `flex-1 py-1.5 border transition uppercase tracking-widest text-[9px] font-bold ${ active ? 'bg-[var(--indigo)] text-[var(--btn-fg)] border-[var(--indigo)]' : 'text-[var(--mute)] border-transparent hover:border-[var(--hair)]' }`;

        return (
          <div className="flex gap-1 mt-3">
            { hasChartModule && (
              <button onClick={ () => setView( 'core-charts' ) } className={ btnCls( isChartActive ) }>
                Charts
              </button>
            ) }
            { hasNumerology && (
              <button onClick={ () => setView( 'core-calendar' ) } className={ btnCls( isCalendarActive ) }>
                Calendar
              </button>
            ) }
            { hasTarot && (
              <button
                onClick={ () => {
                  const firstItem = getNavItemsForModule( 'luna-tarot' ).find( ( item ) => {
                    if ( item.requiresAuth && !isLoggedIn ) return false;
                    return true;
                  } );
                  if ( firstItem ) setView( firstItem.key );
                } }
                className={ btnCls( isTarotActive ) }
              >
                Tarot
              </button>
            ) }
          </div>
        );
      } )() }
    </header>
  );
}
