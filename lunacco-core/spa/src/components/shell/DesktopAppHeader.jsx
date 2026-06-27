/**
 * DesktopAppHeader — horizontal nav bar for desktop viewports.
 *
 * Nav structure:
 *   Left:  Logo | [Module ▾ dropdown] per registered module
 *   Right: Theme picker (admin) | Save button | Profile menu
 *
 * Each module button opens a dropdown with that module's nav items on
 * hover or keyboard focus. Settings is accessible from the profile menu.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ChevronDown, Home, LogIn, LogOut, Moon, Save, Settings, Sparkles, Sun, User, Palette, ExternalLink, BarChart3, Calendar } from 'lucide-react';
import { useAppConfig } from '../../contexts/AppConfigContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useUser } from '../../contexts/UserContext.jsx';
import { useModuleRegistry } from '../../contexts/ModuleContext.jsx';
import { useHeaderExtras } from '../../contexts/HeaderExtrasContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';

// ------------------------------------------------------------------
// ModuleDropdown — a single top-level module nav item with submenu
// ------------------------------------------------------------------
function ModuleDropdown( { mod, isCurrentModule, navItems, view, setView, resolvedPickLabel } ) {
  const [ open, setOpen ] = useState( false );
  const closeTimer = useRef( null );
  const menuRef = useRef( null );

  const openMenu = useCallback( () => {
    clearTimeout( closeTimer.current );
    setOpen( true );
  }, [] );

  const scheduleClose = useCallback( () => {
    closeTimer.current = setTimeout( () => setOpen( false ), 120 );
  }, [] );

  const handleKeyDown = useCallback( ( e ) => {
    if ( e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' ) {
      e.preventDefault();
      setOpen( true );
      // Focus first menu item on next tick
      setTimeout( () => {
        const first = menuRef.current?.querySelector( '[role="menuitem"]' );
        first?.focus();
      }, 0 );
    }
    if ( e.key === 'Escape' ) setOpen( false );
  }, [] );

  const handleMenuKeyDown = useCallback( ( e, idx ) => {
    if ( e.key === 'Escape' ) { setOpen( false ); return; }
    if ( e.key === 'ArrowDown' ) {
      e.preventDefault();
      const items = menuRef.current?.querySelectorAll( '[role="menuitem"]' );
      items?.[ idx + 1 ]?.focus();
    }
    if ( e.key === 'ArrowUp' ) {
      e.preventDefault();
      const items = menuRef.current?.querySelectorAll( '[role="menuitem"]' );
      items?.[ idx - 1 ]?.focus();
    }
    if ( e.key === 'Tab' ) setOpen( false );
  }, [] );

  if ( !navItems.length ) return null;

  // Split regular vs admin items for the optional separator.
  const regular = navItems.filter( ( i ) => !i.requiresAdmin );
  const admin   = navItems.filter( ( i ) => i.requiresAdmin );

  return (
    <div
      className="relative"
      onMouseEnter={ openMenu }
      onMouseLeave={ scheduleClose }
    >
      <button
        aria-haspopup="menu"
        aria-expanded={ open }
        onFocus={ openMenu }
        onBlur={ scheduleClose }
        onKeyDown={ handleKeyDown }
        onClick={ () => setOpen( ( p ) => !p ) }
        className={ `flex items-center gap-1.5 px-4 py-1.5 border transition uppercase tracking-widest text-[11px] font-bold whitespace-nowrap ${ isCurrentModule ? 'bg-[var(--indigo)] text-[var(--btn-fg)] border-[var(--indigo)]' : 'border-transparent hover:border-[var(--ink)]' }` }
      >
        { mod.label }
        <ChevronDown size={ 12 } className={ `transition-transform ${ open ? 'rotate-180' : '' }` } />
      </button>

      { open && (
        <div
          ref={ menuRef }
          role="menu"
          onMouseEnter={ openMenu }
          onMouseLeave={ scheduleClose }
          className="absolute left-0 top-full mt-1 min-w-[200px] bg-[var(--card)] border border-[var(--indigo)] shadow-2xl overflow-hidden z-[600] py-1 animate-in fade-in slide-in-from-top-1 duration-200"
        >
          { /* Top accent bar */ }
          <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--indigo)]" />
          
          <div className="pt-1">
            { regular.map( ( item, idx ) => (
              <button
                key={ item.key }
                role="menuitem"
                tabIndex={ -1 }
                onKeyDown={ ( e ) => handleMenuKeyDown( e, idx ) }
                onClick={ () => { setView( item.key ); setOpen( false ); } }
                className={ `w-full text-left px-4 py-2 text-[12px] uppercase tracking-wider transition hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] ${ view === item.key ? 'text-[var(--indigo)] font-bold bg-[var(--mute)]/5' : 'text-[var(--ink)]' }` }
              >
                { item.key === 'home' ? resolvedPickLabel : item.label }
              </button>
            ) ) }
            { regular.length > 0 && admin.length > 0 && (
              <div className="my-1 border-t border-[var(--hair)]" />
            ) }
            { admin.map( ( item, idx ) => (
              <button
                key={ item.key }
                role="menuitem"
                tabIndex={ -1 }
                onKeyDown={ ( e ) => handleMenuKeyDown( e, regular.length + idx ) }
                onClick={ () => { setView( item.key ); setOpen( false ); } }
                className={ `w-full text-left px-4 py-2 text-[11px] uppercase tracking-wider transition hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] ${ view === item.key ? 'text-[var(--indigo)] font-bold bg-[var(--mute)]/5' : 'text-[var(--mute)]' }` }
              >
                { item.label }
              </button>
            ) ) }
          </div>
        </div>
      ) }
    </div>
  );
}

// ------------------------------------------------------------------
// ThemeSelector — dropdown for families + mode toggle
// ------------------------------------------------------------------
function ThemeSelector( { setView } ) {
  const { themes, activeThemeId, setTheme, setMode, setFamily } = useTheme();
  const { isAdmin } = useAuth();
  const [ open, setOpen ] = useState( false );
  const dropdownRef = useRef( null );

  const activeTheme = themes.find( t => t.id === activeThemeId );
  
  const families = useMemo(() => {
    const seen = new Set();
    return themes.filter(t => {
      if (seen.has(t.family)) return false;
      seen.add(t.family);
      return true;
    });
  }, [themes]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="flex items-center gap-2" ref={dropdownRef}>
      {/* Mode Toggle */}
      <button 
        onClick={() => setMode(activeTheme?.mode === 'light' ? 'dark' : 'light')}
        className="p-2 border border-[var(--hair)] hover:border-[var(--ink)] transition bg-[var(--card)] text-[var(--ink)]"
        title={`Switch to ${activeTheme?.mode === 'light' ? 'Dark' : 'Light'} Mode`}
      >
        {activeTheme?.mode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
      </button>

      {/* Family Swatch Selector */}
      <div className="relative">
        <button 
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-1.5 border border-[var(--hair)] hover:border-[var(--ink)] transition bg-[var(--card)]"
        >
          <div className="w-3 h-3" style={{ backgroundColor: activeTheme?.color }} />
          <span className="text-[11px] font-bold uppercase tracking-widest hidden lg:block">{activeTheme?.name}</span>
          <ChevronDown size={12} className={open ? 'rotate-180 transition' : 'transition'} />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--card)] border border-[var(--indigo)] shadow-2xl z-[700] p-1 animate-in fade-in slide-in-from-top-1 duration-200">
            { /* Top accent bar */ }
            <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--indigo)]" />
            
            <div className="px-3 py-2 text-[9px] uppercase tracking-widest font-bold text-[var(--mute)] border-b border-[var(--hair)] mb-1 pt-3">
              Color Families
            </div>
            <div className="grid grid-cols-2 gap-1 p-1">
              {families.filter(f => !f.id.startsWith('custom-')).map(f => (
                <button
                  key={f.family}
                  onClick={() => { setFamily(f.family); setOpen(false); }}
                  className={`flex items-center gap-2 px-2 py-2 text-[10px] uppercase tracking-wider hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] transition ${activeTheme?.family === f.family ? 'font-bold text-[var(--indigo)] bg-[var(--mute)]/5' : 'text-[var(--ink)]'}`}
                >
                  <div className="w-3 h-3 shrink-0 border border-[var(--mute)]/20" style={{ backgroundColor: f.color }} />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>

            {themes.some(t => t.id.startsWith('custom-')) && (
              <>
                <div className="px-3 py-2 text-[9px] uppercase tracking-widest font-bold text-[var(--mute)] border-t border-b border-[var(--hair)] my-1">
                  Custom Themes
                </div>
                <div className="flex flex-col p-1">
                  {themes.filter(t => t.id.startsWith('custom-')).map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setTheme(t.id); setOpen(false); }}
                      className={`flex items-center gap-2 px-2 py-2 text-[10px] uppercase tracking-wider hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] transition ${activeThemeId === t.id ? 'font-bold text-[var(--indigo)] bg-[var(--mute)]/5' : 'text-[var(--ink)]'}`}
                    >
                      <div className="w-3 h-3 shrink-0 border border-[var(--mute)]/20" style={{ backgroundColor: t.tokens['--paper'] }} />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {isAdmin && (
              <div className="p-1 border-t border-[var(--hair)] mt-1">
                <button
                  onClick={() => { setView('theme-builder'); setOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 px-2 py-2 text-[10px] uppercase tracking-widest font-bold hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] transition text-[var(--mute)]"
                >
                  <Palette size={12} /> Manage Themes
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// DesktopAppHeader
// ------------------------------------------------------------------
export default function DesktopAppHeader( { view, setView } ) {
  const {
    appHeaderTitle, appHeaderLogoUrl,
    returnMainUrl, returnMainLabel, pickLabel,
    buyCreditsUrl, becomeMemberUrl,
    authButtonLabel,
  } = useAppConfig();
  const { isLoggedIn, isAdmin, openLoginModal, performLogout } = useAuth();
  const { userContext } = useUser();
  const { modules, activeModuleId, getNavItemsForModule, getViewModuleId } = useModuleRegistry();
  const { saveConfig } = useHeaderExtras();
  const [ showProfileMenu, setShowProfileMenu ] = useState( false );
  const profileCloseTimer = useRef( null );

  const openProfileMenu  = () => { clearTimeout( profileCloseTimer.current ); setShowProfileMenu( true ); };
  const closeProfileMenu = () => { profileCloseTimer.current = setTimeout( () => setShowProfileMenu( false ), 120 ); };

  const isSubscriberUser = !!userContext.is_subscriber;
  const resolvedReturnMainLabel = userContext.return_main_label || returnMainLabel;
  const resolvedPickLabel       = userContext.pick_label || pickLabel;
  const resolvedAuthButtonLabel = userContext.auth_button_label || authButtonLabel;

  // Modules that feed into the shared Charts / Calendar / Admin nav.
  // Their nav items are not rendered as their own module dropdown.
  const CHART_MODULE_IDS = new Set( [ 'luna-numerology', 'luna-astrohd' ] );
  const CALENDAR_VIEW_KEYS = new Set( [ 'calendar', 'core-calendar' ] );

  // Collect admin nav items from chart modules + core admin views for the shared Admin dropdown.
  const adminNavItems = useMemo( () => {
    const moduleItems = modules
      .filter( ( mod ) => CHART_MODULE_IDS.has( mod.id ) )
      .flatMap( ( mod ) =>
        getNavItemsForModule( mod.id ).filter( ( item ) => item.requiresAdmin )
      );
    if ( isAdmin ) {
      moduleItems.push( { key: 'admin-featured', label: 'Featured & Levels', requiresAdmin: true, order: 99 } );
    }
    return moduleItems;
  }, [ modules, getNavItemsForModule, isAdmin ] );

  // Standalone modules (e.g. Tarot) keep their own dropdown in the nav.
  const standaloneModuleNavItems = useMemo( () => {
    return modules
      .filter( ( mod ) => !CHART_MODULE_IDS.has( mod.id ) )
      .map( ( mod ) => ( {
        mod,
        items: getNavItemsForModule( mod.id ).filter( ( item ) => {
          if ( item.requiresAuth && !isLoggedIn ) return false;
          if ( item.requiresAdmin && !isAdmin ) return false;
          return true;
        } ),
      } ) );
  }, [ modules, getNavItemsForModule, isLoggedIn, isAdmin ] );

  // Which module does the current view belong to?
  const currentViewModuleId = getViewModuleId( view );

  // Highlight states for top-level nav buttons.
  const isChartModuleView = CHART_MODULE_IDS.has( currentViewModuleId ) && !CALENDAR_VIEW_KEYS.has( view );
  const isChartsActive    = view === 'core-charts' || isChartModuleView;
  const isCalendarActive  = CALENDAR_VIEW_KEYS.has( view );
  const isAdminActive     = adminNavItems.some( ( item ) => item.key === view ) || view === 'admin-featured';

  return (
    <header className="w-full relative z-[300] p-4 flex justify-between items-center bg-[var(--paper)] border-b border-[var(--hair)] shrink-0 gap-6">

      { /* Left: logo + module nav */ }
      <div className="flex items-center gap-6 min-w-0 flex-1">
        { /* Logo / title */ }
        <div className="flex items-center gap-4 shrink-0">
          { returnMainUrl ? (
            <a href={ returnMainUrl } className="flex items-center gap-2 hover:opacity-90 transition shrink-0" title="Return to main page">
              { appHeaderLogoUrl
                ? <img src={ appHeaderLogoUrl } alt={ appHeaderTitle } className="h-9 w-auto object-contain" />
                : <h1 className="text-2xl italic font-normal tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>{ appHeaderTitle }</h1>
              }
            </a>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              { appHeaderLogoUrl
                ? <img src={ appHeaderLogoUrl } alt={ appHeaderTitle } className="h-9 w-auto object-contain" />
                : <h1 className="text-2xl italic font-normal tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>{ appHeaderTitle }</h1>
              }
            </div>
          ) }
        </div>

        { /* Navigation */ }
        <nav className="flex gap-1 items-center" aria-label="Main navigation">
          { /* Home → dashboard */ }
          { modules.length >= 1 && (
            <button
              onClick={ () => setView( 'dashboard' ) }
              className={ `px-4 py-1.5 border transition uppercase tracking-widest text-[11px] font-bold whitespace-nowrap shrink-0 ${ view === 'dashboard' ? 'bg-[var(--indigo)] text-[var(--btn-fg)] border-[var(--indigo)]' : 'border-transparent hover:border-[var(--ink)]' }` }
            >
              Home
            </button>
          ) }

          { /* Charts — top-level, shown when any chart module is active */ }
          { modules.some( ( m ) => CHART_MODULE_IDS.has( m.id ) ) && (
            <button
              onClick={ () => setView( 'core-charts' ) }
              className={ `flex items-center gap-1.5 px-4 py-1.5 border transition uppercase tracking-widest text-[11px] font-bold whitespace-nowrap shrink-0 ${ isChartsActive ? 'bg-[var(--indigo)] text-[var(--btn-fg)] border-[var(--indigo)]' : 'border-transparent hover:border-[var(--ink)]' }` }
            >
              <BarChart3 size={ 12 } />
              Charts
            </button>
          ) }

          { /* Calendar — top-level. Numerology-only for now; an AstroHD calendar
               is a later-todo, after which this can include astrohd again. */ }
          { modules.some( ( m ) => m.id === 'luna-numerology' ) && (
            <button
              onClick={ () => setView( 'core-calendar' ) }
              className={ `flex items-center gap-1.5 px-4 py-1.5 border transition uppercase tracking-widest text-[11px] font-bold whitespace-nowrap shrink-0 ${ isCalendarActive ? 'bg-[var(--indigo)] text-[var(--btn-fg)] border-[var(--indigo)]' : 'border-transparent hover:border-[var(--ink)]' }` }
            >
              <Calendar size={ 12 } />
              Calendar
            </button>
          ) }

          { /* Admin dropdown — collects admin pages from chart modules */ }
          { isAdmin && adminNavItems.length > 0 && (
            <ModuleDropdown
              mod={ { id: '__admin__', label: 'Admin' } }
              isCurrentModule={ isAdminActive }
              navItems={ adminNavItems }
              view={ view }
              setView={ setView }
              resolvedPickLabel={ resolvedPickLabel }
            />
          ) }

          { /* Standalone modules (e.g. Tarot) keep their own dropdown */ }
          { standaloneModuleNavItems.map( ( { mod, items } ) => (
            <ModuleDropdown
              key={ mod.id }
              mod={ mod }
              isCurrentModule={ currentViewModuleId === mod.id }
              navItems={ items }
              view={ view }
              setView={ setView }
              resolvedPickLabel={ resolvedPickLabel }
            />
          ) ) }
        </nav>
      </div>

      { /* Right: theme selector, save button, profile/auth */ }
      <div className="flex gap-4 items-center shrink-0">

        { /* Theme selector */ }
        <ThemeSelector setView={ setView } />

        { /* Save button — when active module registers a save handler */ }
        { saveConfig && (
          <button
            onClick={ saveConfig.onSave }
            className="flex items-center gap-2 px-4 py-1.5 bg-[var(--indigo)] text-[var(--btn-fg)] border border-[var(--indigo)] hover:bg-[var(--indigo-2)] transition uppercase tracking-widest text-[11px] font-bold shadow-sm"
          >
            { saveConfig.saving ? '...' : ( saveConfig.label || 'Save' ) }
            <Save size={ 14 } />
          </button>
        ) }

        { /* Auth / profile */ }
        { isLoggedIn ? (
          <>
            { !isAdmin && (
              <div className="bg-[var(--card)] px-3 py-1.5 border border-[var(--hair)] text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 shrink-0">
                <Sparkles size={ 14 } className="text-[var(--gold)]" />
                <span className="whitespace-nowrap">{ userContext.balance } Credits</span>
              </div>
            ) }
            <div
              className="relative shrink-0"
              onMouseEnter={ openProfileMenu }
              onMouseLeave={ closeProfileMenu }
            >
              <button
                onClick={ () => setShowProfileMenu( ( prev ) => !prev ) }
                onFocus={ openProfileMenu }
                onBlur={ closeProfileMenu }
                className="flex items-center gap-2 bg-[var(--card)] border border-[var(--hair)] px-2.5 py-1.5 hover:border-[var(--ink)] transition"
                aria-label="Open account menu"
                aria-haspopup="menu"
                aria-expanded={ showProfileMenu }
              >
                <div className="w-6 h-6 border border-[var(--ink)] bg-[var(--paper-2)] flex items-center justify-center overflow-hidden">
                  { userContext.avatar_url
                    ? <img src={ userContext.avatar_url } alt={ `${ userContext.display_name || userContext.username || 'User' } avatar` } className="w-full h-full object-cover" />
                    : <User size={ 12 } className="text-[var(--ink)]" />
                  }
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest max-w-[120px] truncate">{ userContext.display_name || userContext.username || 'Profile' }</span>
                <ChevronDown size={ 14 } className={ `transform transition-transform ${ showProfileMenu ? 'rotate-180' : '' }` } />
              </button>

              { showProfileMenu && (
                <div className="absolute right-0 mt-1 w-64 bg-[var(--card)] border border-[var(--indigo)] shadow-2xl overflow-hidden z-[600] animate-in fade-in slide-in-from-top-1 duration-200">
                  { /* Top accent bar */ }
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--indigo)]" />
                  
                  <div className="p-4 border-b border-[var(--hair)] bg-[var(--paper-2)] pt-5">
                    <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--ink)] truncate">{ userContext.display_name || userContext.username || 'User' }</p>
                    <p className="text-[10px] text-[var(--mute)] truncate">{ userContext.email || '' }</p>
                  </div>
                  <div className="p-1 flex flex-col">
                    { modules.length >= 2 && (
                      <button
                        onClick={ () => { setView( 'dashboard' ); setShowProfileMenu( false ); } }
                        className={ `px-3 py-2 text-[11px] uppercase tracking-wider text-left hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] transition flex items-center gap-2 ${ view === 'dashboard' ? 'text-[var(--indigo)] font-bold bg-[var(--mute)]/5' : 'text-[var(--ink)]' }` }
                      >
                        <Home size={ 14 } /> Dashboard
                      </button>
                    ) }
                    <button
                      onClick={ () => { setView( 'profile' ); setShowProfileMenu( false ); } }
                      className="px-3 py-2 text-[11px] uppercase tracking-wider text-left hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] transition flex items-center gap-2 text-[var(--ink)]"
                    >
                      <User size={ 14 } /> Profile &amp; Lens Data
                    </button>
                    { isAdmin && (
                      <>
                        <button
                          onClick={ () => { setView( 'settings' ); setShowProfileMenu( false ); } }
                          className={ `px-3 py-2 text-[11px] uppercase tracking-wider text-left hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] transition flex items-center gap-2 ${ view === 'settings' ? 'text-[var(--indigo)] font-bold bg-[var(--mute)]/5' : 'text-[var(--ink)]' }` }
                        >
                          <Settings size={ 14 } /> Settings
                        </button>
                        <button
                          onClick={ () => { setView( 'theme-builder' ); setShowProfileMenu( false ); } }
                          className={ `px-3 py-2 text-[11px] uppercase tracking-wider text-left hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] transition flex items-center gap-2 ${ view === 'theme-builder' ? 'text-[var(--indigo)] font-bold bg-[var(--mute)]/5' : 'text-[var(--ink)]' }` }
                        >
                          <Palette size={ 14 } /> Theme Builder
                        </button>
                        <button
                          onClick={ () => { setView( 'admin-featured' ); setShowProfileMenu( false ); } }
                          className={ `px-3 py-2 text-[11px] uppercase tracking-wider text-left hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] transition flex items-center gap-2 ${ view === 'admin-featured' ? 'text-[var(--indigo)] font-bold bg-[var(--mute)]/5' : 'text-[var(--ink)]' }` }
                        >
                          ★ Featured &amp; Levels
                        </button>
                      </>
                    ) }
                    <a href={ userContext.account_url || `${ window.location.origin }/account` } target="_blank" rel="noreferrer" className="px-3 py-2 text-[11px] uppercase tracking-wider hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] transition flex items-center gap-2 text-[var(--ink)]">
                      <ExternalLink size={ 14 } /> Manage Account
                    </a>
                    { !!returnMainUrl && (
                      <a href={ returnMainUrl } className="px-3 py-2 text-[11px] uppercase tracking-wider hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] transition text-[var(--ink)]">{ resolvedReturnMainLabel }</a>
                    ) }
                    { !isSubscriberUser && !!buyCreditsUrl && (
                      <a href={ buyCreditsUrl } target="_blank" rel="noreferrer" className="px-3 py-2 text-[11px] uppercase tracking-wider hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] transition text-[var(--ink)]">Buy Credits</a>
                    ) }
                    { !isSubscriberUser && !!becomeMemberUrl && (
                      <a href={ becomeMemberUrl } target="_blank" rel="noreferrer" className="px-3 py-2 text-[11px] uppercase tracking-wider hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] transition text-[var(--ink)]">Become a Member</a>
                    ) }
                    <button onClick={ performLogout } className="px-3 py-2 text-[11px] uppercase tracking-wider text-left hover:bg-rose-500 hover:text-white transition flex items-center gap-2 text-[var(--ink)]">
                      <LogOut size={ 14 } /> Logout
                    </button>
                  </div>
                </div>
              ) }
            </div>
          </>
        ) : (
          <button
            className="px-6 py-2 bg-[var(--indigo)] hover:bg-[var(--indigo-2)] text-[var(--btn-fg)] font-bold text-[11px] uppercase tracking-widest transition flex items-center gap-2 shrink-0 border border-[var(--indigo)]"
            onClick={ openLoginModal }
          >
            <LogIn size={ 16 } /> { resolvedAuthButtonLabel }
          </button>
        ) }
      </div>
    </header>
  );
}
