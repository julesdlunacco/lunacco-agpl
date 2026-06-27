/**
 * ThemeContext.jsx
 * 
 * Manages the active design theme and font settings.
 * Injects CSS variables into the document root.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from './UserContext.jsx';
import { useAuth } from './AuthContext.jsx';
import { useAppConfig } from './AppConfigContext.jsx';
import { THEME_FAMILIES, DEFAULT_THEME_ID, SHAPE_TOKENS, FONT_CATALOG } from '../utils/themeTokens.js';

const ThemeContext = createContext(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function ThemeProvider({ children }) {
  const { profileData, saveProfile } = useUser();
  const { isLoggedIn } = useAuth();
  const { pluginUrl, root, nonce } = useAppConfig();
  
  // Local state for immediate UI feedback
  const [themesRegistry, setThemesRegistry] = useState(THEME_FAMILIES);
  const [activeThemeId, setActiveThemeId] = useState(() => {
    const local = localStorage.getItem('lunacco_theme_id');
    return themesRegistry[local] ? local : DEFAULT_THEME_ID;
  });
  const [siteDefaultThemeId, setSiteDefaultThemeId] = useState(DEFAULT_THEME_ID);

  const [activeFonts, setActiveFonts] = useState({
    display: '',
    ui: '',
    mono: ''
  });
  const [previewFonts, setPreviewFonts] = useState(null);

  // Tracks whether the active theme reflects an explicit user choice (profile
  // setting or a manual pick this session). When false, the admin-set site
  // default theme is allowed to take over.
  const hasExplicitTheme = useRef(false);

  // Fetch custom themes on mount
  useEffect(() => {
    const fetchCustomThemes = async () => {
      try {
        const response = await fetch(`${root}lunacco/v1/admin/themes`, {
          headers: { 'X-WP-Nonce': nonce }
        });
        if (response.ok) {
          const data = await response.json();
          const custom = data.custom || {};
          setThemesRegistry(prev => ({ ...prev, ...custom }));
          if (data.default) setSiteDefaultThemeId(data.default);
        }
      } catch (err) {
        console.error('Failed to fetch custom themes:', err);
      }
    };
    fetchCustomThemes();
  }, [root, nonce]);

  // Sync with profile data when it loads
  useEffect(() => {
    const settings = profileData?.settings;
    if (settings) {
      if (settings.theme_id && themesRegistry[settings.theme_id]) {
        // User has an explicit personal theme — it wins over the site default.
        hasExplicitTheme.current = true;
        if (settings.theme_id !== activeThemeId) setActiveThemeId(settings.theme_id);
      }
      setActiveFonts({
        display: settings.font_display || '',
        ui: settings.font_ui || '',
        mono: settings.font_mono || ''
      });
    }
  }, [profileData?.settings, themesRegistry]);

  // Apply the admin-set site default whenever the user has no explicit choice.
  // Runs once the custom-theme registry and the default id have both loaded, so
  // a custom-* default resolves correctly. An explicit profile/manual pick wins.
  useEffect(() => {
    if (hasExplicitTheme.current) return;
    if (!siteDefaultThemeId || !themesRegistry[siteDefaultThemeId]) return;
    if (siteDefaultThemeId !== activeThemeId) setActiveThemeId(siteDefaultThemeId);
  }, [siteDefaultThemeId, themesRegistry, activeThemeId]);

  // Apply theme tokens and shape tokens
  useEffect(() => {
    const theme = themesRegistry[activeThemeId] || themesRegistry[DEFAULT_THEME_ID];
    if (!theme) return;

    const rootEl = document.documentElement;
    
    rootEl.setAttribute('data-theme', theme.id);
    rootEl.setAttribute('data-mode', theme.mode);

    Object.entries(theme.tokens).forEach(([key, val]) => {
      rootEl.style.setProperty(key, val);
    });

    Object.entries(SHAPE_TOKENS).forEach(([key, val]) => {
      rootEl.style.setProperty(key, val);
    });

    localStorage.setItem('lunacco_theme_id', activeThemeId);
  }, [activeThemeId, themesRegistry]);

  // Font loading & variable injection
  useEffect(() => {
    const theme = themesRegistry[activeThemeId] || themesRegistry[DEFAULT_THEME_ID];
    const fontsToLoad = {
      display: previewFonts?.display || activeFonts.display || theme?.tokens['--font-display-id'] || 'Cormorant Garamond',
      ui: previewFonts?.ui || activeFonts.ui || theme?.tokens['--font-ui-id'] || 'Inter',
      mono: activeFonts.mono || 'JetBrains Mono'
    };

    // 1. Inject CSS Variables
    const rootEl = document.documentElement;
    rootEl.style.setProperty('--font-display', `"${fontsToLoad.display}", serif`);
    rootEl.style.setProperty('--font-ui', `"${fontsToLoad.ui}", sans-serif`);
    rootEl.style.setProperty('--font-mono', `"${fontsToLoad.mono}", monospace`);

    // 2. Load Google Fonts
    const googleFamilies = Object.values(fontsToLoad)
      .map(id => FONT_CATALOG.google.find(f => f.id === id))
      .filter(Boolean)
      .map(f => f.id.replace(/ /g, '+'));
    
    if (googleFamilies.length > 0) {
      const linkId = 'lunacco-google-fonts';
      let link = document.getElementById(linkId);
      if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = `https://fonts.googleapis.com/css2?family=${googleFamilies.join('&family=')}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600&display=swap`;
    }

    // 3. Inject Local Font-Faces
    const localFonts = Object.values(fontsToLoad)
      .map(id => FONT_CATALOG.local.find(f => f.id === id))
      .filter(Boolean);

    if (localFonts.length > 0) {
      const styleId = 'lunacco-local-fonts';
      let style = document.getElementById(styleId);
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
      }
      
      let css = '';
      localFonts.forEach(f => {
        const baseUrl = `${pluginUrl}assets/fonts/`;
        css += `@font-face { font-family: "${f.id}"; src: url("${baseUrl}${f.file}"); font-weight: normal; font-style: normal; }\n`;
        if (f.bold) css += `@font-face { font-family: "${f.id}"; src: url("${baseUrl}${f.bold}"); font-weight: bold; font-style: normal; }\n`;
        if (f.italic) css += `@font-face { font-family: "${f.id}"; src: url("${baseUrl}${f.italic}"); font-weight: normal; font-style: italic; }\n`;
        if (f.medium) css += `@font-face { font-family: "${f.id}"; src: url("${baseUrl}${f.medium}"); font-weight: 500; font-style: normal; }\n`;
      });
      style.textContent = css;
    }
  }, [activeFonts, previewFonts, activeThemeId, pluginUrl]);

  const setTheme = useCallback((themeId) => {
    if (!themesRegistry[themeId]) return;
    hasExplicitTheme.current = true;
    setActiveThemeId(themeId);
    if (isLoggedIn) {
      saveProfile({
        ...profileData,
        settings: { ...profileData.settings, theme_id: themeId }
      });
    }
  }, [isLoggedIn, profileData, saveProfile, themesRegistry]);

  const setFont = useCallback((role, fontId) => {
    const newFonts = { ...activeFonts, [role]: fontId };
    setActiveFonts(newFonts);
    if (isLoggedIn) {
      saveProfile({
        ...profileData,
        settings: {
          ...profileData.settings,
          [`font_${role}`]: fontId
        }
      });
    }
  }, [activeFonts, isLoggedIn, profileData, saveProfile]);

  const setMode = useCallback((mode) => {
    const theme = themesRegistry[activeThemeId] || themesRegistry[DEFAULT_THEME_ID];
    const newId = `${theme.family}-${mode}`;
    if (themesRegistry[newId]) setTheme(newId);
  }, [activeThemeId, themesRegistry, setTheme]);

  const setFamily = useCallback((familyId) => {
    const theme = themesRegistry[activeThemeId] || themesRegistry[DEFAULT_THEME_ID];
    const newId = `${familyId}-${theme.mode}`;
    if (themesRegistry[newId]) setTheme(newId);
  }, [activeThemeId, themesRegistry, setTheme]);

  const saveCustomTheme = useCallback(async (themeData) => {
    try {
      const response = await fetch(`${root}lunacco/v1/admin/themes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
        body: JSON.stringify(themeData)
      });
      if (response.ok) {
        const result = await response.json();
        const fullTheme = { ...themeData, id: result.id };
        setThemesRegistry(prev => ({ ...prev, [result.id]: fullTheme }));
        return result.id;
      }
    } catch (err) {
      console.error('Failed to save custom theme:', err);
    }
  }, [root, nonce]);

  const deleteCustomTheme = useCallback(async (themeId) => {
    try {
      const response = await fetch(`${root}lunacco/v1/admin/themes/${themeId}`, {
        method: 'DELETE',
        headers: { 'X-WP-Nonce': nonce }
      });
      if (response.ok) {
        setThemesRegistry(prev => {
          const next = { ...prev };
          delete next[themeId];
          return next;
        });
        if (activeThemeId === themeId) setTheme(DEFAULT_THEME_ID);
      }
    } catch (err) {
      console.error('Failed to delete custom theme:', err);
    }
  }, [root, nonce, activeThemeId, setTheme]);

  const setSiteDefaultTheme = useCallback(async (themeId) => {
    try {
      const response = await fetch(`${root}lunacco/v1/admin/themes/default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
        body: JSON.stringify({ theme_id: themeId })
      });
      if (response.ok) {
        setSiteDefaultThemeId(themeId);
      }
    } catch (err) {
      console.error('Failed to set site default theme:', err);
    }
  }, [root, nonce]);

  const value = {
    activeThemeId,
    siteDefaultThemeId,
    activeFonts,
    theme: themesRegistry[activeThemeId] || themesRegistry[DEFAULT_THEME_ID],
    setTheme,
    setMode,
    setFamily,
    setFont,
    saveCustomTheme,
    deleteCustomTheme,
    setSiteDefaultTheme,
    setPreviewFonts,
    themes: Object.values(themesRegistry),
    fontCatalog: FONT_CATALOG
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
