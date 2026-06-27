/**
 * Definitions Worksheet — section-aware, theme-matched.
 *
 * Primary view is an editable **Markdown worksheet** for the selected section: every
 * field/subfield/modifier that applies to that section (from the per-section blueprint),
 * pre-filled with existing content, fill-as-you-go, saved back through the
 * Markdown+frontmatter pipeline (import_markdown). A **Grid** tab offers the compact
 * cell view. Side (Personality/Design) appears only on sections that carry it, above
 * the fields. Styling consumes the app theme tokens, so it follows light/dark.
 *
 * Endpoints: lunacco/v1/definitions/{blueprints, sets, entries, markdown/import,
 * sets/{id}/export-markdown, seed/astrohd, search, entries(POST)}.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download, Upload, RefreshCw, Search, Plus, Save, Sparkles, Layers3, FileText, Grid3x3,
  AlertCircle, CheckCircle2, Loader2, ChevronRight, ChevronDown, ChevronLeft, PencilLine, Trash2, Copy, FileCode2, LayoutGrid, Star, FileUp,
} from 'lucide-react';
import { apiFetch } from '../../utils/api.js';
import { markdownToHtml } from '../../utils/markdown.jsx';
import TemplateEditor from './TemplateEditor.jsx';
import ChartsAdminView from './ChartsAdminView.jsx';

const API = 'lunacco/v1/definitions';
// Modules that author definitions through the engine. Each maps to the set
// "category" the seeder uses (drives which scaffold sections seed).
const MODULES = [
  { id: 'luna-astrohd',     label: 'AstroHD',     category: 'astrohd',    slug: 'astrohd-core',    setLabel: 'AstroHD Core' },
  { id: 'luna-numerology',  label: 'Numerology',  category: 'numerology', slug: 'numerology-core', setLabel: 'Numerology Core' },
];
const DEFAULT_MODULE_ID = 'luna-astrohd';
const SYSTEM_ORDER = ['Human Design', 'Astrology', 'Sabian', 'Angels', 'Mythic', 'Numerology', 'Other'];
const OVERLAYS = [
  { key: 'general', label: 'General', token: 'var(--ink)' },
  { key: 'personality', label: 'Personality', token: 'var(--hd-personality, var(--ink))' },
  { key: 'design', label: 'Design', token: 'var(--hd-design, var(--gold))' },
];

/* Value vocabulary per modifier dimension, used to author modifier meanings in the worksheet.
   Dimensions with no values (e.g. line — its own Lines section) are skipped. */
const MODIFIER_VALUES = {
  dignity: ['domicile', 'exaltation', 'detriment', 'fall'],
  motion: ['retrograde', 'direct'],
  stellium: ['member'],
  state: ['defined', 'open'],
  shadow_chart: ['receptor', 'mental', 'harmonic', 'transpersonal'],
  modality: ['fixed', 'mutable', 'cardinal'],
  // Variables reworked: color+direction combos and tones are now their own atom
  // sections (hd_variable_colors / hd_variable_tones), not modifiers — so no
  // position vocabulary here.
  house_ruler: ['ruler'],
  chart_ruler: ['ruler'],
  line: [], // Lines are their own section — skip here.
  fixation: [], // deeper line work, later.
};

/* Theme-token styles — inherit light/dark automatically. */
const T = {
  bg: 'var(--paper)', panel: 'var(--card)', border: 'var(--hair)', text: 'var(--ink)',
  dim: 'var(--mute)', accent: 'var(--indigo)', gold: 'var(--gold)', display: 'var(--font-display, serif)',
};
// Broadsheet kit: sharp rectangular surfaces (no radius), hairline borders,
// display serif for headings. Only true circles (the dirty dot) and the
// indeterminate progress bar keep a radius.
const s = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 620, background: T.bg, color: T.text, fontFamily: 'var(--font-ui, inherit)' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' },
  title: { fontFamily: T.display, fontStyle: 'italic', fontSize: 20, fontWeight: 600, letterSpacing: 0.3 },
  btn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 0, color: T.text, cursor: 'pointer', fontSize: 12.5 },
  btnP: { background: T.accent, borderColor: T.accent, color: 'var(--paper)' },
  select: { padding: '6px 10px', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 0, color: T.text, fontSize: 12.5 },
  body: { display: 'flex', flex: 1, minHeight: 0 },
  rail: { width: 240, borderRight: `1px solid ${T.border}`, overflowY: 'auto', padding: '6px 0', background: T.panel },
  railSys: { display: 'flex', alignItems: 'center', gap: 6, padding: '11px 14px 6px', fontSize: 10.5, letterSpacing: 0.7, textTransform: 'uppercase', color: T.dim, fontWeight: 700, cursor: 'pointer', userSelect: 'none' },
  railItem: (a) => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', cursor: 'pointer', background: a ? 'color-mix(in srgb, var(--indigo) 12%, transparent)' : 'transparent', borderLeft: `2px solid ${a ? T.accent : 'transparent'}`, color: a ? T.text : T.dim, fontWeight: a ? 600 : 400 }),
  railBack: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', cursor: 'pointer', color: T.accent, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${T.border}` },
  railAtomHead: { padding: '10px 14px 4px', fontFamily: T.display, fontStyle: 'italic', fontSize: 16, color: T.text },
  railAtom: { display: 'block', padding: '6px 16px', cursor: 'pointer', color: T.dim, fontSize: 12.5, borderLeft: `2px solid transparent` },
  count: { fontSize: 11, color: T.dim, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 0, padding: '1px 7px' },
  main: { flex: 1, minWidth: 0, overflow: 'auto', padding: 18 },
  sectionHead: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  h2: { fontFamily: T.display, fontStyle: 'italic', fontSize: 25, fontWeight: 600, margin: 0 },
  tabs: { display: 'inline-flex', border: `1px solid ${T.border}`, borderRadius: 0, overflow: 'hidden' },
  tab: (a) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', cursor: 'pointer', fontSize: 12.5, background: a ? T.accent : 'transparent', color: a ? 'var(--paper)' : T.dim }),
  overlayBar: { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 14px', padding: '8px 12px', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 0 },
  overlayTab: (a, token) => ({ padding: '4px 13px', borderRadius: 0, cursor: 'pointer', fontSize: 12.5, fontWeight: a ? 600 : 400, background: a ? 'color-mix(in srgb, var(--indigo) 14%, transparent)' : 'transparent', color: a ? token : T.dim, border: `1px solid ${a ? T.accent : T.border}` }),
  search: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 0, minWidth: 230 },
  searchInput: { background: 'transparent', border: 'none', outline: 'none', color: T.text, fontSize: 12.5, flex: 1 },
  mdArea: { width: '100%', minHeight: 460, resize: 'vertical', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 0, color: T.text, padding: 14, fontSize: 13, lineHeight: 1.55, fontFamily: 'var(--font-mono, ui-monospace, monospace)' },
  hint: { color: T.dim, fontSize: 12, margin: '0 0 10px' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0 },
  th: { position: 'sticky', top: 0, textAlign: 'left', padding: '9px 10px', borderBottom: `1px solid ${T.border}`, color: T.dim, fontWeight: 600, fontSize: 11, background: T.bg, whiteSpace: 'nowrap' },
  td: { padding: 6, borderBottom: `1px solid ${T.border}`, verticalAlign: 'top' },
  cell: { width: '100%', minWidth: 150, minHeight: 36, resize: 'vertical', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 0, color: T.text, padding: '6px 8px', fontSize: 12.5, fontFamily: 'inherit', lineHeight: 1.45 },
  badge: (kind) => ({ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.5, padding: '1px 6px', borderRadius: 0, color: kind === 'fragment' ? T.dim : 'var(--paper)', background: kind === 'fragment' ? 'transparent' : T.gold, border: kind === 'fragment' ? `1px solid ${T.border}` : 'none' }),
  modNote: { marginTop: 10, padding: '8px 12px', borderRadius: 0, background: 'color-mix(in srgb, var(--gold) 10%, transparent)', border: `1px solid ${T.border}`, fontSize: 12, color: T.dim },
  saveBar: { position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '10px 12px', background: 'color-mix(in srgb, var(--paper) 88%, transparent)', backdropFilter: 'blur(6px)', borderTop: `1px solid ${T.border}`, borderRadius: 0, zIndex: 5 },
  dirtyDot: { width: 8, height: 8, borderRadius: 8, background: 'var(--gold)' },
  caretBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mute)', padding: 2, display: 'inline-flex' },
  preview: { padding: '7px 10px', background: T.bg, border: `1px dashed ${T.border}`, borderRadius: 0, fontSize: 12.5, lineHeight: 1.5 },
  popover: { position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 20, width: 280, padding: 12, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 0, boxShadow: '0 10px 30px rgba(0,0,0,.25)' },
  modalBack: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { width: 'min(760px, 92vw)', maxHeight: '86vh', overflow: 'auto', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 0, padding: 18, color: T.text },
  empty: { padding: 48, textAlign: 'center', color: T.dim },
  toast: (k) => ({ position: 'fixed', bottom: 18, right: 18, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 15px', borderRadius: 0, background: T.panel, border: `1px solid ${k === 'error' ? 'var(--hd-design, #c33)' : 'var(--indigo)'}`, color: T.text, boxShadow: '0 8px 30px rgba(0,0,0,.25)' }),
};

function primaryEntity(entry) {
  const link = (entry?.entities || []).find((e) => e && e.entity);
  return link ? link.entity : null;
}
function baseSlot(entry, layer) {
  for (const sl of entry?.slots || []) {
    const scope = sl?.metadata_json?.scope || 'base';
    if ((scope === 'base' || scope === '') && sl.slot_key === layer) return sl.slot_value || '';
  }
  return '';
}
function overlaySlot(entry, overlay, layer) {
  for (const v of entry?.variants || []) {
    const ov = v.overlay_key && v.overlay_key !== 'base' ? v.overlay_key : 'general';
    if (ov !== overlay) continue;
    const slots = v.slots || v.slots_json || {};
    if (typeof slots[layer] === 'string') return slots[layer];
  }
  return '';
}
const slotFor = (entry, overlay, layer) => (overlay === 'general' ? baseSlot(entry, layer) : overlaySlot(entry, overlay, layer));

/* Clipboard that also works on http/local (no secure context): falls back to execCommand. */
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('copy command rejected');
}
function modifierSlot(entry, modType, modVal, layer) {
  for (const sl of entry?.slots || []) {
    const meta = sl?.metadata_json || {};
    if (meta.scope === 'modifier' && meta.modifier === modVal && (meta.modifier_type || '') === modType && sl.slot_key === layer) {
      return sl.slot_value || '';
    }
  }
  return '';
}

export default function DefinitionsAdminView() {
  const [sets, setSets] = useState([]);
  const [setId, setSetId] = useState(0);
  const [blueprints, setBlueprints] = useState({});
  const [styleGuide, setStyleGuide] = useState({});
  const [entries, setEntries] = useState([]);
  const [activeType, setActiveType] = useState('');
  const [overlay, setOverlay] = useState('general');
  const [view, setView] = useState('markdown'); // 'markdown' | 'grid'
  const [mode, setMode] = useState('worksheet'); // 'worksheet' | 'templates' | 'charts'
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState(null);
  const [mdText, setMdText] = useState('');
  const [savedMd, setSavedMd] = useState('');
  const [gridBuf, setGridBuf] = useState({});
  const [expandedRow, setExpandedRow] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  // Blocking progress overlay for long ops (reseed / new set / file import): { title, message } | null
  const [progress, setProgress] = useState(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyLayers, setCopyLayers] = useState([]);
  const [moduleId, setModuleId] = useState(DEFAULT_MODULE_ID);
  const moduleCfg = MODULES.find((m) => m.id === moduleId) || MODULES[0];

  // A set belongs to numerology if its category/module says so. Everything else
  // (the AstroHD/HD/Astrology sets) is treated as the AstroHD module's.
  const isNumerologySet = (set) => {
    const cat = set?.metadata_json?.category;
    const mod = set?.metadata_json?.module;
    return cat === 'numerology' || mod === 'luna-numerology'
      || (set?.modules || []).some((m) => m.module_id === 'luna-numerology');
  };
  const moduleSets = useMemo(
    () => sets.filter((st) => (moduleId === 'luna-numerology' ? isNumerologySet(st) : !isNumerologySet(st))),
    [sets, moduleId],
  );

  // Report an import/save result, calling out any addresses the server REFUSED
  // (unknown section/atom/field) so the user knows a typo didn't silently create
  // ghost atoms. Uses the error toast when there were refusals.
  const reportImport = (verb, res) => {
    const refused = res?.skipped_addresses || [];
    const base = `${verb} — ${res?.imported_entries || 0} atoms updated (${res?.skipped || 0} skipped)`;
    if (refused.length) {
      const shown = refused.slice(0, 6).join(' · ');
      flash(`${base}. Refused ${refused.length}: ${shown}${refused.length > 6 ? ` +${refused.length - 6} more` : ''}`, 'error');
    } else {
      flash(base);
    }
  };

  // When the module changes (or sets reload), point setId at one of THIS module's
  // sets — its default, else the first; 0 (empty) if the module has no set yet.
  useEffect(() => {
    const inModule = moduleSets.some((st) => Number(st.id) === Number(setId));
    if (!inModule) {
      const pick = moduleSets.find((st) => Number(st.is_default) === 1) || moduleSets[0];
      setSetId(pick ? Number(pick.id) : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, moduleSets]);
  // Rail drill-down: 'sections' shows the system→section tree; 'atoms' shows the
  // atom headers inside the active section (click to scroll into view).
  const [railMode, setRailMode] = useState('sections');
  const [collapsedSystems, setCollapsedSystems] = useState({});
  const mdRef = React.useRef(null);
  const mdDirty = mdText !== savedMd && mdText.trim() !== '';

  const toggleSystem = (sys) => setCollapsedSystems((p) => ({ ...p, [sys]: !p[sys] }));

  // Scroll a given atom into view in the main panel — works in both views: the
  // grid scrolls to its row; the markdown view scrolls the textarea to the
  // atom's `## heading` and drops the caret there.
  function scrollToAtom(entry) {
    if (view === 'grid') {
      const el = document.getElementById(`def-atom-${entry.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background 0.2s';
        const prev = el.style.background;
        el.style.background = 'color-mix(in srgb, var(--gold) 16%, transparent)';
        window.setTimeout(() => { el.style.background = prev; }, 900);
      }
      return;
    }
    const ta = mdRef.current;
    if (!ta) return;
    const ent = primaryEntity(entry);
    const needle = `## ${entry.title}`;
    let idx = ta.value.indexOf(needle);
    if (idx < 0 && ent) idx = ta.value.indexOf(`(${ent.entity_key})`);
    if (idx < 0) return;
    const before = ta.value.slice(0, idx);
    const line = before.split('\n').length - 1;
    const totalLines = ta.value.split('\n').length || 1;
    ta.focus();
    ta.setSelectionRange(idx, idx + needle.length);
    ta.scrollTop = (line / totalLines) * ta.scrollHeight;
  }

  const flash = (message, kind = 'ok') => {
    setToast({ message, kind });
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    (async () => {
      try {
        const [setList, bp] = await Promise.all([apiFetch(`${API}/sets`), apiFetch(`${API}/blueprints`)]);
        setSets(Array.isArray(setList) ? setList : []);
        setBlueprints(bp?.blueprints || {});
        setStyleGuide(bp?.style_guide || {});
        const def = (setList || []).find((x) => Number(x.is_default) === 1) || (setList || [])[0];
        if (def) setSetId(Number(def.id));
      } catch (e) { flash(e.message || 'Failed to load', 'error'); }
    })();
  }, []);

  const loadEntries = useCallback(async (id) => {
    if (!id) { setEntries([]); return; }
    setLoading(true);
    try {
      const rows = await apiFetch(`${API}/entries?set_id=${id}&is_enabled=1`);
      setEntries(Array.isArray(rows) ? rows : []);
    } catch (e) { flash(e.message || 'Failed to load entries', 'error'); setEntries([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadEntries(setId); }, [setId, loadEntries]);

  const byType = useMemo(() => {
    const map = {};
    for (const entry of entries) {
      const t = primaryEntity(entry)?.entity_type || 'unknown';
      (map[t] = map[t] || []).push(entry);
    }
    return map;
  }, [entries]);

  const rail = useMemo(() => {
    const groups = {};
    for (const type of Object.keys(byType)) {
      const bp = blueprints[type];
      const system = bp?.system || 'Other';
      const label = bp?.label || type;
      (groups[system] = groups[system] || []).push({ type, label, count: byType[type].length });
    }
    return SYSTEM_ORDER.filter((sys) => groups[sys])
      .map((sys) => ({ system: sys, types: groups[sys].sort((a, b) => a.label.localeCompare(b.label)) }));
  }, [byType, blueprints]);

  useEffect(() => { if (!activeType && rail.length) setActiveType(rail[0].types[0].type); }, [rail, activeType]);

  const blueprint = blueprints[activeType] || null;
  const hasSide = Boolean(blueprint?.has_side);
  useEffect(() => { if (!hasSide && overlay !== 'general') setOverlay('general'); }, [hasSide, overlay]);

  const sectionEntries = useMemo(
    () => (byType[activeType] || []).slice().sort((a, b) => (a.title || '').localeCompare(b.title || '')),
    [byType, activeType],
  );

  const standaloneLayers = blueprint?.standalone_layers || ['short_def', 'long_def', 'coaching_key_notes', 'keywords'];
  const fragmentLayers = blueprint?.fragment_layers || [];
  const modifiers = blueprint?.modifiers || [];

  /* Build the section's Markdown worksheet for the current overlay. */
  const buildMarkdown = useCallback((blank = false) => {
    if (!blueprint) return '';
    const lines = [
      `# ${blueprint.label} — worksheet${overlay !== 'general' ? ` (${overlay})` : ''}`,
      `# Section: ${activeType}. Fill bodies below; blank is fine. A "---" line is a fence — use *** for a rule.`,
      '',
    ];
    const layers = [...standaloneLayers, ...fragmentLayers];
    for (const entry of sectionEntries) {
      const ent = primaryEntity(entry);
      if (!ent) continue;
      lines.push(`## ${entry.title}  (${ent.entity_key})`, '');
      for (const layer of layers) {
        const cfg = styleGuide[layer] || {};
        const kind = cfg.kind === 'fragment' ? ' · fragment' : '';
        lines.push('---');
        lines.push(`address: ${ent.entity_type}:${ent.entity_key}.${layer}`);
        if (overlay !== 'general') lines.push(`overlay: ${overlay}`);
        lines.push(`# ${layer}${kind} — ${cfg.target_length || ''}`);
        lines.push('---');
        lines.push(blank ? '' : (slotFor(entry, overlay, layer) || ''));
        lines.push('');
      }
      // Modifier meanings for this section (general side only).
      if (overlay === 'general') {
        for (const mod of modifiers) {
          const values = MODIFIER_VALUES[mod] || [];
          for (const val of values) {
            lines.push('---');
            lines.push(`address: ${ent.entity_type}:${ent.entity_key}.modifier_short`);
            lines.push(`modifier: ${mod}:${val}`);
            lines.push(`# modifier — ${mod} = ${val}`);
            lines.push('---');
            lines.push(blank ? '' : (modifierSlot(entry, mod, val, 'modifier_short') || ''));
            lines.push('');
          }
        }
      }
    }
    return lines.join('\n');
  }, [blueprint, overlay, activeType, sectionEntries, standaloneLayers, fragmentLayers, modifiers, styleGuide]);

  // Regenerate the markdown whenever the section / overlay / data changes.
  useEffect(() => {
    if (view === 'markdown') { const md = buildMarkdown(); setMdText(md); setSavedMd(md); }
  }, [view, buildMarkdown]);

  // Auto-save every 60s while there are unsaved markdown edits.
  useEffect(() => {
    if (view !== 'markdown') return undefined;
    const t = window.setInterval(() => { if (mdText !== savedMd && mdText.trim()) saveMarkdownSilent(); }, 60000);
    return () => window.clearInterval(t);
  }, [view, mdText, savedMd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save the given markdown to the server. Returns true on success.
  async function pushMarkdown(content) {
    const res = await apiFetch(`${API}/markdown/import`, {
      method: 'POST',
      body: JSON.stringify({ set_id: setId, module_id: moduleId, content }),
    });
    return res;
  }

  async function saveMarkdown() {
    setBusy('md');
    try {
      const res = await pushMarkdown(mdText);
      setSavedMd(mdText);
      reportImport('Saved', res);
      await loadEntries(setId);
    } catch (e) { flash(e.message || 'Save failed', 'error'); }
    finally { setBusy(''); }
  }

  // Quiet auto-save (interval / on section switch) — no reload churn.
  async function saveMarkdownSilent() {
    const content = mdText;
    try {
      await pushMarkdown(content);
      setSavedMd(content);
      flash('Auto-saved');
    } catch (e) { flash(e.message || 'Auto-save failed', 'error'); }
  }

  // Switch sections, auto-saving unsaved markdown first so edits are never lost.
  async function changeSection(type) {
    if (view === 'markdown' && mdText !== savedMd && mdText.trim()) {
      try { await pushMarkdown(mdText); setSavedMd(mdText); } catch { /* keep edits; user can retry */ }
    }
    setExpandedRow(null);
    setActiveType(type);
    setRailMode('atoms');
  }

  /* Grid editing */
  function gridVal(entry, layer) {
    const k = `${entry.id}:${overlay}:${layer}`;
    return gridBuf[k] !== undefined ? gridBuf[k] : slotFor(entry, overlay, layer);
  }
  function setGridVal(entry, layer, value) {
    setGridBuf((p) => ({ ...p, [`${entry.id}:${overlay}:${layer}`]: value }));
  }
  async function saveGridRow(entry) {
    setBusy(`row-${entry.id}`);
    try {
      if (overlay === 'general') {
        const kept = (entry.slots || []).filter((sl) => {
          const sc = sl?.metadata_json?.scope || 'base';
          return sc !== 'base' && sc !== '';
        });
        const baseSlots = standaloneLayers.map((layer, i) => ({
          slot_key: layer, slot_value: gridVal(entry, layer), slot_format: 'markdown',
          output_context: '', sort_order: i, metadata_json: { scope: 'base' },
        }));
        await apiFetch(`${API}/entries`, {
          method: 'POST',
          body: JSON.stringify({
            id: entry.id, set_id: setId, module_id: entry.module_id || moduleId,
            entry_key: entry.entry_key, title: entry.title, entry_kind: entry.entry_kind || 'atomic',
            entities: (entry.entities || []).map((e) => ({ entity_id: e.entity_id, role_key: e.role_key })),
            slots: [...baseSlots, ...kept],
          }),
        });
      } else {
        const slots = {};
        standaloneLayers.forEach((layer) => { const v = gridVal(entry, layer); if ((v || '').trim()) slots[layer] = v; });
        await apiFetch(`${API}/variants`, {
          method: 'POST',
          body: JSON.stringify({
            entry_id: entry.id, variant_key: `natal_${overlay}_default`, chart_context: 'natal',
            overlay_key: overlay, tone_key: 'default', status: 'approved', slots,
          }),
        });
      }
      flash(`Saved ${entry.title}`);
      setGridBuf((p) => { const n = { ...p }; standaloneLayers.forEach((l) => delete n[`${entry.id}:${overlay}:${l}`]); return n; });
      await loadEntries(setId);
    } catch (e) { flash(e.message || 'Save failed', 'error'); }
    finally { setBusy(''); }
  }

  async function runSearch(e) {
    e?.preventDefault?.();
    if (!searchQ.trim()) { setSearchRes(null); return; }
    try {
      const res = await apiFetch(`${API}/search?q=${encodeURIComponent(searchQ)}&set_id=${setId}`);
      setSearchRes(res?.results || []);
    } catch (err) { flash(err.message || 'Search failed', 'error'); }
  }
  async function reseed() {
    if (!window.confirm(`Reseed ${moduleCfg.label} atoms (section-correct placeholders) into ${setId ? 'this set' : 'a new set'}? Existing filled-in content is preserved — only missing atoms/slots are added.`)) return;
    setBusy('reseed');
    setProgress({ title: 'Reseeding definitions', message: 'Seeding section-correct atoms & placeholder slots…' });
    try {
      const res = await apiFetch(`${API}/seed/astrohd`, { method: 'POST', body: JSON.stringify({ set_id: setId || 0, module_id: moduleId, category: moduleCfg.category }) });
      if (res?.id) setSetId(Number(res.id));
      setProgress({ title: 'Reseeding definitions', message: 'Loading worksheet…' });
      flash('Reseeded'); await loadEntries(res?.id || setId);
    } catch (e) { flash(e.message || 'Reseed failed', 'error'); }
    finally { setBusy(''); setProgress(null); }
  }
  // One-off cleanup: delete ghost atoms in THIS section whose key isn't in the
  // template (created by an older, un-validated import). Real atoms + content stay.
  async function pruneSection() {
    if (!blueprint || !setId) { flash('Pick a set and section first', 'error'); return; }
    if (!window.confirm(`Remove off-template atoms from "${blueprint.label}"? This deletes ghost atoms whose key isn't in the template (e.g. from a mistyped import). Your real seeded atoms and their content are kept.`)) return;
    setBusy('prune');
    try {
      const res = await apiFetch(`${API}/prune`, { method: 'POST', body: JSON.stringify({ set_id: setId, section_type: activeType }) });
      const removed = res?.removed || 0;
      flash(removed ? `Removed ${removed} off-template atom(s)${(res.removed_atoms || []).length ? `: ${res.removed_atoms.slice(0, 6).join(' · ')}${res.removed_atoms.length > 6 ? ' …' : ''}` : ''}` : 'No off-template atoms found — all clean');
      await loadEntries(setId);
    } catch (e) { flash(e.message || 'Cleanup failed', 'error'); }
    finally { setBusy(''); }
  }
  async function newSet() {
    const label = window.prompt('New set name?'); if (!label) return;
    setBusy('newset');
    setProgress({ title: 'Creating set', message: `Creating “${label}”…` });
    try {
      const res = await apiFetch(`${API}/sets`, { method: 'POST', body: JSON.stringify({ label, slug: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}` }) });
      const newId = Number(res?.id);
      // A new set is useless empty — auto-seed the selected module's atoms into it.
      setProgress({ title: 'Creating set', message: 'Seeding section-correct atoms…' });
      await apiFetch(`${API}/seed/astrohd`, { method: 'POST', body: JSON.stringify({ set_id: newId, module_id: moduleId, category: moduleCfg.category }) });
      setSets(await apiFetch(`${API}/sets`));
      if (newId) setSetId(newId);
      flash('Set created and seeded');
    } catch (e) { flash(e.message || 'Create failed', 'error'); }
    finally { setBusy(''); setProgress(null); }
  }

  async function renameSet() {
    const current = sets.find((x) => Number(x.id) === Number(setId));
    if (!current) return;
    const label = window.prompt('Rename set:', current.label);
    if (!label || label === current.label) return;
    try {
      await apiFetch(`${API}/sets`, { method: 'POST', body: JSON.stringify({ id: setId, label, slug: current.slug }) });
      setSets(await apiFetch(`${API}/sets`));
      flash('Set renamed');
    } catch (e) { flash(e.message || 'Rename failed', 'error'); }
  }

  async function toggleDefault() {
    const current = sets.find((x) => Number(x.id) === Number(setId));
    if (!current) return;
    const next = Number(current.is_default) === 1 ? 0 : 1;
    try {
      await apiFetch(`${API}/sets`, { method: 'POST', body: JSON.stringify({ id: setId, label: current.label, slug: current.slug, is_default: next }) });
      setSets(await apiFetch(`${API}/sets`));
      flash(next ? `"${current.label}" is now the default set` : 'Default cleared — no set is default');
    } catch (e) { flash(e.message || 'Failed to update default', 'error'); }
  }

  async function deleteSet() {
    const current = sets.find((x) => Number(x.id) === Number(setId));
    if (!current) return;
    if (!window.confirm(`Delete set "${current.label}" and all its definitions? This cannot be undone.`)) return;
    try {
      await apiFetch(`${API}/sets/${setId}`, { method: 'DELETE' });
      const list = await apiFetch(`${API}/sets`);
      setSets(list || []);
      setSetId(list && list[0] ? Number(list[0].id) : 0);
      flash('Set deleted');
    } catch (e) { flash(e.message || 'Delete failed', 'error'); }
  }

  async function hardReset() {
    if (!window.confirm('HARD RESET: wipe ALL definition data across every set? This cannot be undone.')) return;
    setBusy('reset');
    try {
      await apiFetch(`${API}/reset`, { method: 'POST', body: JSON.stringify({}) });
      setSets(await apiFetch(`${API}/sets`));
      setSetId(0);
      setEntries([]);
      flash('All definition data reset');
    } catch (e) { flash(e.message || 'Reset failed', 'error'); }
    finally { setBusy(''); }
  }
  // Merge-import a pasted partial section — only the filled fields apply, the rest of
  // the worksheet is preserved.
  async function doImport() {
    if (!importText.trim()) return;
    setBusy('import');
    try {
      const res = await apiFetch(`${API}/markdown/import`, {
        method: 'POST',
        body: JSON.stringify({ set_id: setId, module_id: moduleId, content: importText, merge: true }),
      });
      reportImport('Merged', res);
      setImportOpen(false); setImportText('');
      await loadEntries(setId);
    } catch (e) { flash(e.message || 'Import failed', 'error'); }
    finally { setBusy(''); }
  }

  // Import a full exported .md file (Markdown + YAML frontmatter, one block per slot).
  // Reads the file directly and merges by address — large full-set exports never have to
  // be pasted into the textarea. Existing content for unlisted slots is preserved.
  async function importMdFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (!setId) { flash('Pick or create a set first', 'error'); return; }
    setBusy('import');
    setProgress({ title: 'Importing from file', message: `Reading ${file.name}…` });
    try {
      const content = await file.text();
      setProgress({ title: 'Importing from file', message: `Merging ${(file.size / 1024).toFixed(0)} KB into worksheet… this can take a moment for a full set.` });
      const res = await apiFetch(`${API}/markdown/import`, {
        method: 'POST',
        body: JSON.stringify({ set_id: setId, module_id: moduleId, content, merge: true }),
      });
      reportImport(`Imported ${file.name}`, res);
      setImportOpen(false); setImportText('');
      await loadEntries(setId);
    } catch (err) { flash(err.message || 'File import failed', 'error'); }
    finally { setBusy(''); setProgress(null); }
  }

  // Copy a trimmed worksheet (only the chosen layers, all atoms in the section) to the
  // clipboard — a lean template to hand to AI, which can be pasted back via merge-import.
  async function copyTemplate() {
    const layers = copyLayers.length ? copyLayers : ['short_def'];
    const lines = [`# ${blueprint?.label || activeType} — fill template${overlay !== 'general' ? ` (${overlay})` : ''}`, ''];
    for (const entry of sectionEntries) {
      const ent = primaryEntity(entry);
      if (!ent) continue;
      lines.push(`## ${entry.title}  (${ent.entity_key})`, '');
      for (const layer of layers) {
        lines.push('---');
        lines.push(`address: ${ent.entity_type}:${ent.entity_key}.${layer}`);
        if (overlay !== 'general') lines.push(`overlay: ${overlay}`);
        lines.push('---', slotFor(entry, overlay, layer) || '', '');
      }
    }
    try {
      await copyToClipboard(lines.join('\n'));
      flash(`Copied ${layers.length} field(s) × ${sectionEntries.length} atoms`);
      setCopyOpen(false);
    } catch { flash('Clipboard blocked by browser — try the Export MD button instead', 'error'); }
  }

  async function exportMd() {
    setBusy('export');
    try {
      const res = await apiFetch(`${API}/sets/${setId}/export-markdown?module_id=${moduleId}`);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([res?.markdown || ''], { type: 'text/markdown' }));
      a.download = `definitions-set-${setId}.md`; a.click(); URL.revokeObjectURL(a.href);
      flash('Exported');
    } catch (e) { flash(e.message || 'Export failed', 'error'); }
    finally { setBusy(''); }
  }

  return (
    <div style={s.wrap}>
      <div style={s.toolbar}>
        <Layers3 size={18} color={T.accent} />
        <span style={s.title}>Definitions</span>
        <div style={s.tabs}>
          <span style={s.tab(mode === 'worksheet')} onClick={() => setMode('worksheet')}><FileText size={14} /> Worksheet</span>
          <span style={s.tab(mode === 'templates')} onClick={() => setMode('templates')}><FileCode2 size={14} /> Templates</span>
          <span style={s.tab(mode === 'charts')} onClick={() => setMode('charts')}><LayoutGrid size={14} /> Charts</span>
        </div>
        <select style={{ ...s.select, display: mode === 'charts' ? 'none' : undefined }} value={moduleId} onChange={(e) => setModuleId(e.target.value)} title="Which module's definitions to author">
          {MODULES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <select style={{ ...s.select, display: mode === 'charts' ? 'none' : undefined }} value={setId} onChange={(e) => setSetId(Number(e.target.value))}>
          {moduleSets.length === 0 && <option value={0}>No {moduleCfg.label} sets — New set ↑</option>}
          {moduleSets.map((st) => <option key={st.id} value={st.id}>{st.label}{Number(st.is_default) === 1 ? ' ★' : ''}</option>)}
        </select>
        {mode !== 'charts' && <button style={s.btn} onClick={newSet} disabled={busy === 'newset'} title="Create and auto-seed a new set">
          {busy === 'newset' ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} New set
        </button>}
        {mode !== 'charts' && setId > 0 && (() => {
          const cur = sets.find((x) => Number(x.id) === Number(setId));
          const isDef = Number(cur?.is_default) === 1;
          return <button style={{ ...s.btn, ...(isDef ? { borderColor: T.gold, color: T.gold } : {}) }} onClick={toggleDefault}
            title={isDef ? 'Default set used by charts — click to clear' : 'Make this the default set for charts'}>
            <Star size={14} fill={isDef ? T.gold : 'none'} /> {isDef ? 'Default (click to clear)' : 'Make default'}
          </button>;
        })()}
        {mode !== 'charts' && setId > 0 && <button style={s.btn} onClick={renameSet} title="Rename set"><PencilLine size={14} /> Rename</button>}
        {mode !== 'charts' && setId > 0 && <button style={s.btn} onClick={deleteSet} title="Delete this set and its definitions"><Trash2 size={14} color="var(--hd-design, #c33)" /> Delete</button>}
        {mode === 'worksheet' && (
          <form onSubmit={runSearch} style={s.search}>
            <Search size={14} color={T.dim} />
            <input style={s.searchInput} placeholder="Search all definitions…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
          </form>
        )}
        <div style={{ flex: 1 }} />
        {mode === 'worksheet' && <>
          <button style={s.btn} onClick={() => setImportOpen(true)}><Upload size={14} /> Import (merge)</button>
          <button style={s.btn} onClick={exportMd} disabled={busy === 'export'}><Download size={14} /> Export MD</button>
          <button style={s.btn} onClick={() => loadEntries(setId)}><RefreshCw size={14} /> Refresh</button>
          <button style={{ ...s.btn, ...s.btnP }} onClick={reseed} disabled={busy === 'reseed' || !setId}>
            {busy === 'reseed' ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Reseed
          </button>
          <button style={{ ...s.btn, borderColor: 'var(--hd-design, #c33)', color: 'var(--hd-design, #c33)' }} onClick={hardReset} disabled={busy === 'reset'} title="Wipe ALL definition data">
            {busy === 'reset' ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} Hard reset
          </button>
        </>}
      </div>

      {mode === 'templates' ? (
        <TemplateEditor setId={setId} styleGuide={styleGuide} blueprints={blueprints} flash={flash} />
      ) : mode === 'charts' ? (
        <ChartsAdminView flash={flash} />
      ) : (

      <div style={s.body}>
        <div style={s.rail}>
          {rail.length === 0 && <div style={s.empty}>No atoms yet. Hit <strong>Reseed</strong>.</div>}

          {railMode === 'atoms' && blueprint ? (
            <>
              <div style={s.railBack} onClick={() => setRailMode('sections')}>
                <ChevronLeft size={14} /> Sections
              </div>
              <div style={s.railAtomHead}>{blueprint.label}</div>
              {sectionEntries.length === 0 ? (
                <div style={{ ...s.empty, padding: 24, fontSize: 12 }}>No atoms yet.</div>
              ) : sectionEntries.map((entry) => {
                const ent = primaryEntity(entry);
                return (
                  <div key={entry.id} style={s.railAtom}
                    onClick={() => scrollToAtom(entry)}
                    onMouseEnter={(e) => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderLeftColor = T.accent; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = T.dim; e.currentTarget.style.borderLeftColor = 'transparent'; }}>
                    {entry.title}
                    {ent?.entity_key && <span style={{ color: T.dim, opacity: 0.6, fontSize: 11 }}> · {ent.entity_key}</span>}
                  </div>
                );
              })}
            </>
          ) : (
            rail.map((group) => {
              const collapsed = !!collapsedSystems[group.system];
              return (
                <div key={group.system}>
                  <div style={s.railSys} onClick={() => toggleSystem(group.system)}>
                    {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    {group.system}
                  </div>
                  {!collapsed && group.types.map((t) => (
                    <div key={t.type} style={s.railItem(activeType === t.type)} onClick={() => changeSection(t.type)}>
                      <span>{t.label}</span><span style={s.count}>{t.count}</span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        <div style={s.main}>
          {searchRes && (
            <div style={{ ...s.modNote, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong style={{ color: T.text }}>Search: {searchRes.length} result(s)</strong>
                <button style={s.btn} onClick={() => { setSearchRes(null); setSearchQ(''); }}>Clear</button>
              </div>
              {searchRes.map((r) => (
                <div key={r.entry_id} style={{ padding: '3px 0' }}>
                  <ChevronRight size={12} style={{ display: 'inline' }} /> <strong style={{ color: T.text }}>{r.title}</strong>{' '}
                  <span style={{ color: T.dim }}>{r.entity_type}:{r.entity_key}</span>
                </div>
              ))}
            </div>
          )}

          {!blueprint ? (
            <div style={s.empty}>Pick a section.</div>
          ) : (
            <>
              <div style={s.sectionHead}>
                <h2 style={s.h2}>{blueprint.label}</h2>
                <div style={s.tabs}>
                  <span style={s.tab(view === 'markdown')} onClick={() => setView('markdown')}><FileText size={14} /> Markdown</span>
                  <span style={s.tab(view === 'grid')} onClick={() => setView('grid')}><Grid3x3 size={14} /> Grid</span>
                </div>
                <div style={{ flex: 1 }} />
                <button style={s.btn} onClick={pruneSection} disabled={busy === 'prune'}
                  title="Delete ghost atoms in this section whose key isn't in the template (e.g. from a mistyped import). Real seeded atoms + content are kept.">
                  {busy === 'prune' ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} Clean up
                </button>
                <div style={{ position: 'relative' }}>
                  <button style={s.btn} onClick={() => setCopyOpen((v) => !v)} title="Copy a trimmed fill template for AI">
                    <Copy size={14} /> Copy template
                  </button>
                  {copyOpen && (
                    <div style={s.popover}>
                      <div style={{ fontSize: 11, color: T.dim, marginBottom: 6 }}>Fields to include:</div>
                      <div style={{ maxHeight: 220, overflow: 'auto' }}>
                        {[...standaloneLayers, ...fragmentLayers].map((layer) => (
                          <label key={layer} style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '3px 0', fontSize: 12.5, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={copyLayers.includes(layer)}
                              onChange={(e) => setCopyLayers((prev) => (e.target.checked ? [...prev, layer] : prev.filter((l) => l !== layer)))}
                            />
                            {layer} <span style={s.badge(styleGuide[layer]?.kind || 'standalone')}>{styleGuide[layer]?.kind || 'standalone'}</span>
                          </label>
                        ))}
                      </div>
                      <button style={{ ...s.btn, ...s.btnP, width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={copyTemplate}>
                        <Copy size={13} /> Copy {copyLayers.length || 1} field(s) × {sectionEntries.length} atoms
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {hasSide && (
                <div style={s.overlayBar}>
                  <span style={{ fontSize: 12, color: T.dim }}>Editing side:</span>
                  {OVERLAYS.map((ov) => (
                    <span key={ov.key} style={s.overlayTab(overlay === ov.key, ov.token)} onClick={() => setOverlay(ov.key)}>{ov.label}</span>
                  ))}
                  <span style={{ fontSize: 11.5, color: T.dim, marginLeft: 'auto' }}>
                    Personality/Design only apply to this section. Blank sides fall back to General.
                  </span>
                </div>
              )}

              {loading ? (
                <div style={s.empty}><Loader2 size={20} className="spin" /> Loading…</div>
              ) : sectionEntries.length === 0 ? (
                <div style={s.empty}>No atoms in this section yet — reseed to create them.</div>
              ) : view === 'markdown' ? (
                <>
                  <p style={s.hint}>
                    One <code>---</code> block per slot for every atom in <strong>{blueprint.label}</strong>
                    {overlay !== 'general' ? ` (${overlay} side)` : ''}. Edit the bodies and Save — blank lines are fine.
                  </p>
                  <textarea ref={mdRef} style={s.mdArea} value={mdText} onChange={(e) => setMdText(e.target.value)} spellCheck={false} />
                  {modifiers.some((m) => (MODIFIER_VALUES[m] || []).length) && overlay === 'general' && (
                    <div style={s.modNote}>
                      <strong style={{ color: T.text }}>Modifiers included below each atom:</strong>{' '}
                      {modifiers.filter((m) => (MODIFIER_VALUES[m] || []).length).join(', ')} — edit their <code>modifier</code> blocks inline.
                    </div>
                  )}
                  <div style={s.saveBar}>
                    {mdDirty ? <span style={s.dirtyDot} title="Unsaved changes" /> : <CheckCircle2 size={14} color="var(--indigo)" />}
                    <span style={{ fontSize: 12, color: T.dim }}>{mdDirty ? 'Unsaved changes — auto-saves every minute' : 'All changes saved'}</span>
                    <div style={{ flex: 1 }} />
                    <button style={s.btn} onClick={() => { const md = buildMarkdown(); setMdText(md); setSavedMd(md); }}><RefreshCw size={14} /> Reset from saved</button>
                    <button style={s.btn} title="Replace the editor with a blank template for THIS section. Saving a blank field clears it." onClick={() => { if (window.confirm('Reset this section to a blank template? Your saved content stays until you Save — saving blank fields will clear them.')) setMdText(buildMarkdown(true)); }}><FileText size={14} /> Reset from template</button>
                    <button style={{ ...s.btn, ...s.btnP }} onClick={saveMarkdown} disabled={busy === 'md'}>
                      {busy === 'md' ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Save worksheet
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={{ ...s.th, width: 170 }}>Atom</th>
                        {standaloneLayers.map((l) => (
                          <th key={l} style={s.th}>
                            {l} <span style={s.badge(styleGuide[l]?.kind || 'standalone')}>{styleGuide[l]?.kind || 'standalone'}</span>
                          </th>
                        ))}
                        <th style={{ ...s.th, width: 90 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {sectionEntries.map((entry) => {
                        const ent = primaryEntity(entry);
                        const dirty = standaloneLayers.some((l) => gridBuf[`${entry.id}:${overlay}:${l}`] !== undefined);
                        const open = expandedRow === entry.id;
                        return (
                          <React.Fragment key={entry.id}>
                            <tr id={`def-atom-${entry.id}`}>
                              <td style={s.td}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <button style={s.caretBtn} title="Preview saved meaning" onClick={() => setExpandedRow(open ? null : entry.id)}>
                                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{entry.title}</div>
                                    <div style={{ color: T.dim, fontSize: 11 }}>{ent?.entity_key}</div>
                                  </div>
                                </div>
                              </td>
                              {standaloneLayers.map((layer) => (
                                <td key={layer} style={s.td}>
                                  <textarea style={s.cell} value={gridVal(entry, layer)} onChange={(e) => setGridVal(entry, layer, e.target.value)} />
                                </td>
                              ))}
                              <td style={s.td}>
                                <button style={{ ...s.btn, ...(dirty ? s.btnP : {}) }} onClick={() => saveGridRow(entry)} disabled={busy === `row-${entry.id}`}>
                                  {busy === `row-${entry.id}` ? <Loader2 size={13} className="spin" /> : <Save size={13} />} Save
                                </button>
                              </td>
                            </tr>
                            {open && (
                              <tr>
                                <td style={{ ...s.td, background: T.panel }} colSpan={standaloneLayers.length + 2}>
                                  <div style={{ fontSize: 11, color: T.dim, marginBottom: 6 }}>Saved meaning{overlay !== 'general' ? ` (${overlay})` : ''}:</div>
                                  {standaloneLayers.map((layer) => {
                                    const v = slotFor(entry, overlay, layer);
                                    return (
                                      <div key={layer} style={{ marginBottom: 8 }}>
                                        <strong style={{ fontSize: 11.5 }}>{layer}</strong>
                                        <div style={{ ...s.preview, marginTop: 3 }} dangerouslySetInnerHTML={{ __html: markdownToHtml(v || '_empty_') }} />
                                      </div>
                                    );
                                  })}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  {modifiers.length > 0 && (
                    <div style={s.modNote}><strong style={{ color: T.text }}>Modifiers:</strong> {modifiers.join(', ')} (worksheet authoring next).</div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      )}

      {importOpen && (
        <div style={s.modalBack} onClick={() => setImportOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, fontFamily: T.display }}>Import &amp; merge</h3>
            <p style={s.hint}>
              Paste a partial worksheet (only the fields you have — e.g. AI-filled <code>theme_short</code> +
              <code>short_def</code>), or <strong>load a full exported <code>.md</code> file</strong>. It
              <strong> merges</strong> into the matching atoms by <code>address</code> and
              <strong> keeps every other field</strong> you haven&apos;t filled. Blank bodies are ignored.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <label style={{ ...s.btn, cursor: setId ? 'pointer' : 'not-allowed', opacity: setId ? 1 : 0.5 }}>
                <FileUp size={14} /> Load .md file…
                <input
                  type="file"
                  accept=".md,.markdown,text/markdown,text/plain"
                  style={{ display: 'none' }}
                  disabled={!setId || busy === 'import'}
                  onChange={importMdFile}
                />
              </label>
              <span style={{ ...s.hint, alignSelf: 'center', margin: 0 }}>Imports directly — no need to paste large files below.</span>
            </div>
            <textarea
              style={{ ...s.mdArea, minHeight: 300, fontFamily: 'var(--font-mono, ui-monospace, monospace)' }}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              spellCheck={false}
              placeholder={'---\naddress: hd_authority:emotional.theme_short\n---\nWaiting for emotional clarity over time.'}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
              <button style={s.btn} onClick={() => setImportOpen(false)}>Cancel</button>
              <button style={{ ...s.btn, ...s.btnP }} onClick={doImport} disabled={busy === 'import'}>
                {busy === 'import' ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} Merge into worksheet
              </button>
            </div>
          </div>
        </div>
      )}

      {progress && (
        <div style={{ ...s.modalBack, zIndex: 9999 }}>
          <div style={{ ...s.modal, width: 'min(440px, 92vw)', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <style>{'@keyframes ccIndet{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}'}</style>
            <Loader2 size={26} className="spin" style={{ color: 'var(--indigo)', marginBottom: 10 }} />
            <h3 style={{ margin: '0 0 6px', fontFamily: T.display }}>{progress.title}</h3>
            <p style={{ ...s.hint, marginBottom: 14 }}>{progress.message}</p>
            <div style={{ height: 6, background: T.border, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '40%', background: 'var(--indigo)', borderRadius: 99, animation: 'ccIndet 1.1s ease-in-out infinite' }} />
            </div>
            <p style={{ ...s.hint, marginTop: 12, marginBottom: 0, opacity: 0.6 }}>Please keep this page open…</p>
          </div>
        </div>
      )}

      {toast && (
        <div style={s.toast(toast.kind)}>
          {toast.kind === 'error' ? <AlertCircle size={15} color="var(--hd-design, #c33)" /> : <CheckCircle2 size={15} color="var(--indigo)" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
