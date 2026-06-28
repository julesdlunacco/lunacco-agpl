import { useState, useMemo, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useAppConfig } from '../../contexts/AppConfigContext.jsx';
import { SEMANTIC_MAP } from '../../utils/themeTokens.js';
import { autoFillTheme, generateDarkVariant, exportTheme, exportAllThemes, parseThemeImport } from '../../utils/themeColorHelper.js';
import { Plus, Copy, Trash2, Save, Check, Settings, Eye, Moon, Sun, Palette, CircleDot, Orbit, Wand2, Download, Upload } from 'lucide-react';

export default function AdminThemeBuilderView() {
  const { themes, theme, setTheme, saveCustomTheme, deleteCustomTheme, setSiteDefaultTheme, siteDefaultThemeId, activeThemeId, fontCatalog, setPreviewFonts } = useTheme();
  const { isAdmin } = useAppConfig();

  const [editingTheme, setEditingTheme] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const importInputRef = useRef(null);

  // Push a full token map straight onto :root for instant live preview. Font-scale
  // tokens are skipped — they're previewed locally in the preview box (see
  // SCOPED_PREVIEW_TOKENS) so they never resize the whole window.
  const SCOPED_PREVIEW_TOKENS = new Set(['--font-display-scale', '--font-ui-scale']);
  const applyTokensLive = (tokens) => {
    Object.entries(tokens).forEach(([k, v]) => {
      if (!SCOPED_PREVIEW_TOKENS.has(k)) document.documentElement.style.setProperty(k, v);
    });
  };

  const handleAutoFill = () => {
    if (!editingTheme) return;
    const filled = autoFillTheme(editingTheme);
    setEditingTheme(filled);
    applyTokensLive(filled.tokens);
    setPreviewFonts({
      display: filled.tokens['--font-display-id'],
      ui: filled.tokens['--font-ui-id'],
    });
  };

  const handleGenerateDark = () => {
    if (!editingTheme) return;
    const dark = generateDarkVariant(editingTheme);
    setEditingTheme(dark);
    applyTokensLive(dark.tokens);
    setPreviewFonts({
      display: dark.tokens['--font-display-id'],
      ui: dark.tokens['--font-ui-id'],
    });
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const incoming = parseThemeImport(await file.text());
      if (!incoming.length) {
        window.alert('No valid themes found in that file.');
      } else {
        for (const t of incoming) {
          // Strip id so each import lands as a fresh custom theme.
          await saveCustomTheme({ ...t, id: '' });
        }
        window.alert(`Imported ${incoming.length} theme${incoming.length === 1 ? '' : 's'}.`);
      }
    } catch (err) {
      window.alert('Import failed: ' + (err?.message || 'invalid file'));
    } finally {
      e.target.value = '';
    }
  };

  // If not admin, don't show this
  if (!isAdmin) {
    return <div className="p-12 text-center">Unauthorized. Admin access required.</div>;
  }

  const builtInThemes = themes.filter(t => !t.id.startsWith('custom-'));
  const customThemes = themes.filter(t => t.id.startsWith('custom-'));

  const handleEdit = (t) => {
    setEditingTheme({ ...t, tokens: { ...t.tokens } });
    setTheme(t.id);
    setPreviewFonts({
      display: t.tokens['--font-display-id'],
      ui: t.tokens['--font-ui-id']
    });
  };

  const handleClone = (t) => {
    const newTheme = {
      ...t,
      id: '', // Will be generated
      name: `${t.name} (Copy)`,
      tokens: { ...t.tokens }
    };
    setEditingTheme(newTheme);
  };

  const handleTokenChange = (key, val) => {
    setEditingTheme(prev => ({
      ...prev,
      tokens: { ...prev.tokens, [key]: val }
    }));

    // Inject into document immediately for live preview (except scoped tokens).
    if (!SCOPED_PREVIEW_TOKENS.has(key)) {
      document.documentElement.style.setProperty(key, val);
    }

    // If it's a font token, trigger context font loading
    if (key === '--font-display-id' || key === '--font-ui-id') {
      setPreviewFonts(prev => ({
        ...prev,
        [key === '--font-display-id' ? 'display' : 'ui']: val
      }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const newId = await saveCustomTheme(editingTheme);
    setIsSaving(false);
    if (newId) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      setEditingTheme(prev => ({ ...prev, id: newId }));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this custom theme?')) {
      await deleteCustomTheme(id);
      if (editingTheme?.id === id) setEditingTheme(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-subtle" style={{ borderColor: 'var(--hair)' }}>
        <div className="flex items-center gap-3">
          <Palette className="w-6 h-6" />
          <h1 className="text-2xl font-display" style={{ fontFamily: 'var(--font-display)' }}>Theme Builder</h1>
        </div>
        <div className="flex items-center gap-3">
          <input ref={importInputRef} type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
          <button
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-subtle"
            style={{ borderColor: 'var(--hair)', background: 'var(--paper-2)' }}
            title="Import themes from a .json file"
          >
            <Upload className="w-4 h-4" /> Import
          </button>
          <button
            onClick={() => exportAllThemes(customThemes)}
            disabled={customThemes.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-subtle disabled:opacity-50"
            style={{ borderColor: 'var(--hair)', background: 'var(--paper-2)' }}
            title="Export all custom themes to a .json file"
          >
            <Download className="w-4 h-4" /> Export All
          </button>
          <button
            onClick={() => handleClone(themes.find(t => t.id === 'lavender-light'))}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-subtle"
            style={{ borderColor: 'var(--hair)', background: 'var(--paper-2)' }}
          >
            <Plus className="w-4 h-4" /> New Custom Theme
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Theme List & Controls */}
        <div className="w-80 border-r border-subtle flex flex-col overflow-hidden" style={{ borderColor: 'var(--hair)', background: 'var(--paper-2)' }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-8">
            
            {/* Custom Themes */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-3" style={{ color: 'var(--mute)' }}>Custom Themes</h3>
              <div className="space-y-2">
                {customThemes.length === 0 && <p className="text-sm text-muted italic">No custom themes yet.</p>}
                {customThemes.map(t => (
                  <div key={t.id} className="group relative">
                    <button
                      onClick={() => handleEdit(t)}
                      className={`w-full text-left p-3 flex items-center justify-between transition-colors ${activeThemeId === t.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-black/5'}`}
                      style={activeThemeId === t.id ? { background: 'var(--highlight)', borderColor: 'var(--highlight-bd)' } : {}}
                    >
                      <span className="text-sm font-medium">{t.name}</span>
                      <div className="flex items-center gap-2">
                        {siteDefaultThemeId === t.id && <Check className="w-3 h-3 text-green-600" />}
                        <div className="w-3 h-3 rounded-full" style={{ background: t.tokens['--paper'] }}></div>
                      </div>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                      className="absolute right-[-10px] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:text-red-700 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Built-in Themes */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-3" style={{ color: 'var(--mute)' }}>Built-in Families</h3>
              <div className="grid grid-cols-1 gap-2">
                {builtInThemes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleEdit(t)}
                    className={`w-full text-left p-3 flex items-center justify-between transition-colors ${activeThemeId === t.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-black/5'}`}
                    style={activeThemeId === t.id ? { background: 'var(--highlight)', borderColor: 'var(--highlight-bd)' } : {}}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{t.name}</span>
                      <span className="text-xs opacity-60 uppercase">{t.mode}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {siteDefaultThemeId === t.id && <Check className="w-3 h-3 text-green-600" />}
                      <div className="flex border border-subtle" style={{ borderColor: 'var(--hair)' }}>
                         <div className="w-3 h-3" style={{ background: t.tokens['--paper'] }}></div>
                         <div className="w-3 h-3" style={{ background: t.tokens['--indigo'] }}></div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 overflow-y-auto p-8" style={{ background: 'var(--paper)' }}>
          {editingTheme ? (
            <div className="max-w-4xl mx-auto space-y-10">
              {/* Theme Settings */}
              <div className="flex items-end justify-between border-b border-subtle pb-6" style={{ borderColor: 'var(--hair)' }}>
                <div className="space-y-4 flex-1 max-w-md">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Theme Name</label>
                    <input 
                      type="text" 
                      value={editingTheme.name}
                      onChange={(e) => setEditingTheme(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full text-xl font-display bg-transparent border-b border-subtle focus:border-indigo-500 outline-none pb-2"
                      style={{ borderColor: 'var(--hair)', fontFamily: 'var(--font-display)' }}
                    />
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Mode</label>
                      <div className="flex border border-subtle overflow-hidden" style={{ borderColor: 'var(--hair)' }}>
                        <button 
                          onClick={() => setEditingTheme(prev => ({ ...prev, mode: 'light' }))}
                          className={`px-4 py-2 text-xs flex items-center gap-2 ${editingTheme.mode === 'light' ? 'bg-indigo-600 text-white' : 'hover:bg-black/5'}`}
                          style={editingTheme.mode === 'light' ? { background: 'var(--indigo)', color: 'var(--paper)' } : {}}
                        >
                          <Sun className="w-3 h-3" /> Light
                        </button>
                        <button 
                          onClick={() => setEditingTheme(prev => ({ ...prev, mode: 'dark' }))}
                          className={`px-4 py-2 text-xs flex items-center gap-2 ${editingTheme.mode === 'dark' ? 'bg-indigo-600 text-white' : 'hover:bg-black/5'}`}
                          style={editingTheme.mode === 'dark' ? { background: 'var(--indigo)', color: 'var(--paper)' } : {}}
                        >
                          <Moon className="w-3 h-3" /> Dark
                        </button>
                      </div>
                    </div>
                    <div>
                       <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Site Default</label>
                       <button 
                        onClick={() => setSiteDefaultTheme(editingTheme.id)}
                        disabled={!editingTheme.id || siteDefaultThemeId === editingTheme.id}
                        className={`px-4 py-2 text-xs border border-subtle flex items-center gap-2 disabled:opacity-50 ${siteDefaultThemeId === editingTheme.id ? 'bg-green-100 text-green-800' : 'hover:bg-black/5'}`}
                        style={{ borderColor: 'var(--hair)' }}
                       >
                         {siteDefaultThemeId === editingTheme.id ? <><Check className="w-3 h-3" /> Site Default</> : 'Set as Site Default'}
                       </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleAutoFill}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium border border-subtle"
                    style={{ borderColor: 'var(--hair)', background: 'var(--paper-2)' }}
                    title="Fill all colours from the Primary & Accent brand colours"
                  >
                    <Wand2 className="w-4 h-4" /> Auto-fill Colours
                  </button>
                  <button
                    onClick={handleGenerateDark}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium border border-subtle"
                    style={{ borderColor: 'var(--hair)', background: 'var(--paper-2)' }}
                    title="Create a dark-mode variant of this theme as a new custom theme"
                  >
                    <Moon className="w-4 h-4" /> Generate Dark
                  </button>
                  <button
                    onClick={() => exportTheme(editingTheme)}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium border border-subtle"
                    style={{ borderColor: 'var(--hair)', background: 'var(--paper-2)' }}
                    title="Export this theme to a .json file"
                  >
                    <Download className="w-4 h-4" /> Export
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                    style={{ background: 'var(--indigo)', color: 'var(--paper)' }}
                  >
                    {isSaving ? 'Saving...' : saveSuccess ? <><Check className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save Custom Theme</>}
                  </button>
                </div>
              </div>

              {/* Tokens Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                
                {/* Backgrounds & Surfaces */}
                <div className="space-y-6">
                  <h4 className="flex items-center gap-2 text-sm font-bold border-b border-subtle pb-2" style={{ borderColor: 'var(--hair)' }}>
                    <Settings className="w-4 h-4" /> Foundations
                  </h4>
                  <div className="space-y-4">
                    <TokenRow label="App Background" token="--paper" value={editingTheme.tokens['--paper']} onChange={handleTokenChange} />
                    <TokenRow label="Panel/Sidebar" token="--paper-2" value={editingTheme.tokens['--paper-2']} onChange={handleTokenChange} />
                    <TokenRow label="Card Surface" token="--card" value={editingTheme.tokens['--card']} onChange={handleTokenChange} />
                    <TokenRow label="Card Hover" token="--card-2" value={editingTheme.tokens['--card-2']} onChange={handleTokenChange} />
                    <TokenRow label="Hairline Border" token="--hair" value={editingTheme.tokens['--hair']} onChange={handleTokenChange} isAlpha />
                  </div>
                </div>

                {/* Typography & Brand */}
                <div className="space-y-6">
                  <h4 className="flex items-center gap-2 text-sm font-bold border-b border-subtle pb-2" style={{ borderColor: 'var(--hair)' }}>
                    <Plus className="w-4 h-4" /> Brand & Accents
                  </h4>
                  <div className="space-y-4">
                    <TokenRow label="Primary Ink" token="--ink" value={editingTheme.tokens['--ink']} onChange={handleTokenChange} />
                    <TokenRow label="Muted Ink" token="--mute" value={editingTheme.tokens['--mute']} onChange={handleTokenChange} />
                    <TokenRow label="Primary Brand" token="--indigo" value={editingTheme.tokens['--indigo']} onChange={handleTokenChange} />
                    <TokenRow label="Accent Brand" token="--gold" value={editingTheme.tokens['--gold']} onChange={handleTokenChange} />
                    <TokenRow label="Selection Highlight" token="--highlight" value={editingTheme.tokens['--highlight']} onChange={handleTokenChange} isAlpha />
                  </div>
                </div>

                {/* Human Design */}
                <div className="space-y-6">
                  <h4 className="flex items-center gap-2 text-sm font-bold border-b border-subtle pb-2" style={{ borderColor: 'var(--hair)' }}>
                    <CircleDot className="w-4 h-4" /> Human Design
                  </h4>
                  <div className="space-y-4">
                    <TokenRow label="Design (Red)" token="--hd-design" value={editingTheme.tokens['--hd-design']} onChange={handleTokenChange} />
                    <TokenRow label="Personality (Black)" token="--hd-personality" value={editingTheme.tokens['--hd-personality']} onChange={handleTokenChange} />
                    <TokenRow label="Active Center" token="--hd-active" value={editingTheme.tokens['--hd-active']} onChange={handleTokenChange} />
                    <TokenRow label="Gate Circle" token="--hd-gate-circle" value={editingTheme.tokens['--hd-gate-circle']} onChange={handleTokenChange} isAlpha />
                    <TokenRow label="Gate Text (Active)" token="--hd-gate-text-active" value={editingTheme.tokens['--hd-gate-text-active']} onChange={handleTokenChange} />
                    <TokenRow label="Gate Text (Inactive)" token="--hd-gate-text-inactive" value={editingTheme.tokens['--hd-gate-text-inactive']} onChange={handleTokenChange} />
                    <TokenRow label="Variable Arrows" token="--hd-variable-arrow" value={editingTheme.tokens['--hd-variable-arrow']} onChange={handleTokenChange} />
                    <TokenRow label="Shadow Undefined Centers" token="--hd-shadow-center" value={editingTheme.tokens['--hd-shadow-center']} onChange={handleTokenChange} isAlpha />
                    <TokenRow label="Shadow Defined Centers" token="--hd-shadow-defined-center" value={editingTheme.tokens['--hd-shadow-defined-center']} onChange={handleTokenChange} isAlpha />
                    <TokenRow label="Shadow Conditioning" token="--hd-shadow-conditioning" value={editingTheme.tokens['--hd-shadow-conditioning']} onChange={handleTokenChange} />
                    <TokenRow label="Shadow Mental" token="--hd-shadow-mental" value={editingTheme.tokens['--hd-shadow-mental']} onChange={handleTokenChange} />
                    <TokenRow label="Shadow Transpersonal" token="--hd-shadow-transpersonal" value={editingTheme.tokens['--hd-shadow-transpersonal']} onChange={handleTokenChange} />
                    <TokenRow label="Shadow Harmonic" token="--hd-shadow-harmonic" value={editingTheme.tokens['--hd-shadow-harmonic']} onChange={handleTokenChange} />
                  </div>
                  
                  {/* Mini Preview Box */}
                  <div className="p-4 border border-subtle bg-white/5 flex flex-col items-center gap-4" style={{ borderColor: 'var(--hair)' }}>
                     <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Bodygraph Preview</span>
                     <MockBodygraph />
                  </div>
                </div>

                {/* Astrology */}
                <div className="space-y-6">
                  <h4 className="flex items-center gap-2 text-sm font-bold border-b border-subtle pb-2" style={{ borderColor: 'var(--hair)' }}>
                    <Orbit className="w-4 h-4" /> Astrology
                  </h4>
                  <div className="space-y-4">
                    <TokenRow label="Fire Signs" token="--astro-fire" value={editingTheme.tokens['--astro-fire']} onChange={handleTokenChange} />
                    <TokenRow label="Earth Signs" token="--astro-earth" value={editingTheme.tokens['--astro-earth']} onChange={handleTokenChange} />
                    <TokenRow label="Air Signs" token="--astro-air" value={editingTheme.tokens['--astro-air']} onChange={handleTokenChange} />
                    <TokenRow label="Water Signs" token="--astro-water" value={editingTheme.tokens['--astro-water']} onChange={handleTokenChange} />
                    <TokenRow label="Wheel Background" token="--astro-wheel-bg" value={editingTheme.tokens['--astro-wheel-bg']} onChange={handleTokenChange} />
                    <TokenRow label="Wheel Stroke" token="--astro-wheel-stroke" value={editingTheme.tokens['--astro-wheel-stroke']} onChange={handleTokenChange} isAlpha />
                    <TokenRow label="Wheel Accent" token="--astro-wheel-accent" value={editingTheme.tokens['--astro-wheel-accent']} onChange={handleTokenChange} />
                    <TokenRow label="Level · Beginner" token="--level-beginner" value={editingTheme.tokens['--level-beginner']} onChange={handleTokenChange} />
                    <TokenRow label="Level · Intermediate" token="--level-intermediate" value={editingTheme.tokens['--level-intermediate']} onChange={handleTokenChange} />
                    <TokenRow label="Level · Advanced" token="--level-advanced" value={editingTheme.tokens['--level-advanced']} onChange={handleTokenChange} />
                    <TokenRow label="Popular" token="--popular" value={editingTheme.tokens['--popular']} onChange={handleTokenChange} />
                  </div>
                  
                  {/* Mini Preview Box */}
                  <div className="p-4 border border-subtle bg-white/5 flex flex-col items-center gap-4" style={{ borderColor: 'var(--hair)' }}>
                     <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Astrology Preview</span>
                     <MockAstroWheel />
                  </div>
                </div>

              </div>
              
              {/* Typography Section */}
              <div className="pt-6 border-t border-subtle" style={{ borderColor: 'var(--hair)' }}>
                <h4 className="flex items-center gap-2 text-sm font-bold mb-6">
                   Typography
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                   <FontRow 
                      label="Display Font (Headers)" 
                      token="--font-display-id" 
                      value={editingTheme.tokens['--font-display-id'] || 'Cormorant Garamond'} 
                      options={fontCatalog} 
                      onChange={handleTokenChange} 
                   />
                   <FontRow 
                      label="UI Font (Body/Labels)" 
                      token="--font-ui-id" 
                      value={editingTheme.tokens['--font-ui-id'] || 'Inter'} 
                      options={fontCatalog} 
                      onChange={handleTokenChange} 
                   />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-8">
                   <ScaleRow 
                      label="Display Size Multiplier" 
                      token="--font-display-scale" 
                      value={editingTheme.tokens['--font-display-scale']} 
                      onChange={handleTokenChange} 
                   />
                   <ScaleRow 
                      label="UI Size Multiplier" 
                      token="--font-ui-scale" 
                      value={editingTheme.tokens['--font-ui-scale']} 
                      onChange={handleTokenChange} 
                   />
                </div>
              </div>

              {/* Live Preview Samples — the font-scale sliders only resize THIS box.
                  Sizes are em-based off a local px base so dragging never reflows the
                  whole window. */}
              {(() => {
                const uiScale = parseFloat(editingTheme.tokens['--font-ui-scale'] || 1) || 1;
                const dispScale = parseFloat(editingTheme.tokens['--font-display-scale'] || 1) || 1;
                return (
                <div className="space-y-6 pt-10">
                  <h4 className="flex items-center gap-2 text-sm font-bold border-b border-subtle pb-2" style={{ borderColor: 'var(--hair)' }}>
                    <Eye className="w-4 h-4" /> Live Component Preview <span className="opacity-40 font-normal normal-case">· reflects text size</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8" style={{ fontSize: `${16 * uiScale}px` }}>

                    {/* Card Sample */}
                    <div className="p-8 border border-subtle rounded-sm" style={{ background: 'var(--paper)', borderColor: 'var(--hair)' }}>
                      <div className="p-6 border border-subtle" style={{ background: 'var(--card)', borderColor: 'var(--hair)' }}>
                        <span className="uppercase tracking-widest font-bold mb-1 block" style={{ color: 'var(--mute)', fontSize: '0.625em' }}>Numerology Card</span>
                        <h5 className="font-display mb-4" style={{ fontFamily: 'var(--font-display)', fontSize: `${2.25 * dispScale}em` }}>11</h5>
                        <p className="leading-relaxed" style={{ color: 'var(--ink)', fontSize: '0.875em' }}>The Master Intuitive. High spiritual frequency and visionary insight.</p>
                        <button
                          className="mt-6 px-4 py-2 font-bold uppercase tracking-wider"
                          style={{ background: 'var(--indigo)', color: 'var(--paper)', fontSize: '0.75em' }}
                        >
                          Read More
                        </button>
                      </div>
                    </div>

                    {/* List/Sidebar Sample */}
                    <div className="p-8 border border-subtle rounded-sm" style={{ background: 'var(--paper-2)', borderColor: 'var(--hair)' }}>
                      <div className="space-y-1">
                        {['The Fool', 'The Magician', 'The High Priestess'].map((name, i) => (
                          <div
                            key={name}
                            className="p-3 flex items-center justify-between"
                            style={i === 1 ? { background: 'var(--highlight)', color: 'var(--ink)', fontSize: '0.875em' } : { color: 'var(--ink)', fontSize: '0.875em' }}
                          >
                            <span>{name}</span>
                            {i === 1 && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--indigo)' }}></div>}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
                );
              })()}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <Palette className="w-20 h-20 mb-4" />
              <h2 className="text-2xl font-display">Select a theme to edit</h2>
              <p>Choose an existing theme or create a new one to start customizing.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScaleRow({ label, token, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        <code className="text-[10px] opacity-40">{token}</code>
      </div>
      <div className="flex items-center gap-3">
        <input 
          type="range" 
          min="0.5" 
          max="2.0" 
          step="0.05"
          value={value || 1.0} 
          onChange={(e) => onChange(token, e.target.value)}
          className="w-32 accent-indigo-600"
          style={{ accentColor: 'var(--indigo)' }}
        />
        <span className="text-xs font-mono w-10">{parseFloat(value || 1.0).toFixed(2)}x</span>
      </div>
    </div>
  );
}

function FontRow({ label, token, value, onChange, options }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        <code className="text-[10px] opacity-40">{token}</code>
      </div>
      <select 
        value={value} 
        onChange={(e) => onChange(token, e.target.value)}
        className="w-48 text-xs p-1 border border-subtle bg-transparent outline-none"
        style={{ borderColor: 'var(--hair)', color: 'var(--ink)' }}
      >
        <optgroup label="Custom Fonts">
          {options.local.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </optgroup>
        <optgroup label="Google Fonts">
          {options.google.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </optgroup>
      </select>
    </div>
  );
}

function TokenRow({ label, token, value, onChange, isAlpha }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        <code className="text-[10px] opacity-40">{token}</code>
      </div>
      <div className="flex items-center gap-2">
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(token, e.target.value)}
          className="w-24 text-xs p-1 border border-subtle bg-transparent outline-none"
          style={{ borderColor: 'var(--hair)' }}
        />
        <div className="relative w-8 h-8 border border-subtle group overflow-hidden" style={{ borderColor: 'var(--hair)' }}>
          <div className="w-full h-full" style={{ background: value }}></div>
          <input 
            type="color" 
            value={value?.startsWith('#') ? value.substring(0, 7) : '#000000'} 
            onChange={(e) => onChange(token, e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

function MockBodygraph() {
  return (
    <svg width="120" height="180" viewBox="0 0 120 180" className="drop-shadow-sm">
      {/* Head */}
      <path d="M60 10 L80 35 L40 35 Z" fill="var(--hd-active)" stroke="var(--ink)" strokeWidth="1" />
      {/* Ajna */}
      <rect x="45" y="45" width="30" height="20" rx="4" fill="white" stroke="var(--ink)" strokeWidth="1" />
      {/* Throat */}
      <rect x="45" y="75" width="30" height="30" rx="4" fill="var(--hd-active)" stroke="var(--ink)" strokeWidth="1" />
      {/* Channels (Simplified lines) */}
      <line x1="60" y1="35" x2="60" y2="45" stroke="var(--hd-design)" strokeWidth="2" />
      <line x1="60" y1="65" x2="60" y2="75" stroke="var(--hd-personality)" strokeWidth="2" />
      
      {/* Gate Samples */}
      <g transform="translate(60, 140)">
        <circle cx="-20" cy="0" r="6" fill="var(--hd-gate-circle)" stroke="var(--hair)" />
        <text x="-20" y="3" textAnchor="middle" fontSize="8" fontWeight="bold" fill="var(--hd-gate-text-active)">61</text>
        
        <circle cx="20" cy="0" r="6" fill="none" />
        <text x="20" y="3" textAnchor="middle" fontSize="8" fill="var(--hd-gate-text-inactive)">24</text>
      </g>
      
      {/* Variable Samples */}
      <g transform="translate(10, 20)">
         <path d="M0 0 L6 3 L0 6 Z" fill="var(--hd-variable-arrow)" />
         <path d="M100 0 L94 3 L100 6 Z" fill="var(--hd-variable-arrow)" />
      </g>
    </svg>
  );
}

function MockAstroWheel() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="drop-shadow-sm">
      <circle cx="60" cy="60" r="58" fill="var(--astro-wheel-bg)" stroke="var(--astro-wheel-stroke)" strokeWidth="1" />
      
      {/* 12 segments */}
      {Array.from({ length: 12 }).map((_, i) => {
        const ang = i * 30;
        const x1 = 60 + 40 * Math.cos(ang * Math.PI / 180);
        const y1 = 60 + 40 * Math.sin(ang * Math.PI / 180);
        const x2 = 60 + 58 * Math.cos(ang * Math.PI / 180);
        const y2 = 60 + 58 * Math.sin(ang * Math.PI / 180);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--astro-wheel-stroke)" strokeWidth="0.5" />
        );
      })}
      
      <circle cx="60" cy="60" r="40" fill="none" stroke="var(--astro-wheel-stroke)" strokeWidth="0.5" />
      <circle cx="60" cy="60" r="2" fill="var(--astro-wheel-accent)" />
      
      {/* Sample Aspect */}
      <line x1="30" y1="60" x2="90" y2="60" stroke="var(--astro-fire)" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}
