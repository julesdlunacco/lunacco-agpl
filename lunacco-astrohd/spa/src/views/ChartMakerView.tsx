/**
 * ChartMakerView
 *
 * Admin-only modular Chart Maker. Two panes:
 *   left  = config editor (visual layers, sections, wheels/aspects/asteroids, sidebar slots, tone/set, presets)
 *   right = live preview rendering the REAL full chart (NatalView) under the active ChartConfig,
 *           plus the astrology wheel, with a resolver-driven editorial sidebar.
 *
 * Editing any toggle re-renders the preview immediately. Element clicks in the
 * embedded chart dispatch `astrohd:select-element`, which we resolve against the
 * core definition engine for the sidebar. Presets persist to core chart_presets.
 */

import { useEffect, useMemo, useState } from 'react';
import NatalView from './NatalView.tsx';
import DualWheelView from './DualWheelView.tsx';
import { FlatToggle } from '../components/HouseSystemToggle';
import { EphemerisService } from '../services/EphemerisService';
import { InterpretationPanel } from '../components/InterpretationPanel';
import {
  ResolvedEntityGroup,
  fetchSets,
  DefinitionSetSummary,
} from '../services/DefinitionService';
import { resolveCardSelection } from '../services/cardResolver';
import {
  ChartConfig,
  DEFAULT_CHART_CONFIG,
  cloneChartConfig,
  SectionToggles,
  AstroCardToggles,
  AstroDesignTabs,
  ProfileLineTabs,
  ChartScope,
  HouseSystem,
  VariableArrowMode,
  AspectOrbFilter,
  PLANET_CATALOG,
  CARD_CATEGORIES,
  CardComposition,
  DEFAULT_CARD_COMPOSITIONS,
} from '../services/chartConfig';
import CardBoxComposer from '../components/composer/CardBoxComposer';
import { fetchTemplates, TemplateSummary } from '../services/DefinitionService';
import { ASTEROID_CATALOG } from '../services/asteroidCatalog';
import {
  listChartPresets,
  saveChartPreset,
  deleteChartPreset,
  rowToChartConfig,
  ChartPresetRow,
} from '../services/ChartPresetService';
import { SelectionPreset, listSelectionPresets } from '../services/SelectionPresetService';

// A neutral sample birth so the preview always has a full chart to render.
const SAMPLE_BIRTH = {
  date: '1990-06-15',
  time: '12:00',
  lat: '40.7128',
  lng: '-74.0060',
  timezone: 'America/New_York',
};

const SIDEBAR_SLOT_OPTIONS = [
  'short_def', 'long_def', 'gift', 'shadow_recessive', 'shadow_reactive',
  'coaching_key_notes', 'coaching_questions', 'affirmation', 'practice_prompt',
];

const ASPECT_KEYS = ['conjunction', 'opposition', 'square', 'trine', 'sextile', 'quincunx'] as const;
const PROFILE_TAB_KEYS: Array<[keyof ProfileLineTabs, string]> = [
  ['lines', 'Profile Lines'], ['quarters', 'Quarters'], ['circuitry', 'Circuitry'], ['repeats', 'Repeating gates'],
];

// Curated asteroid quick-picks (mirrors AsteroidsView PRESETS).
const ASTEROID_PRESETS: Record<string, string[]> = {
  'Base 5': ['Ceres', 'Pallas', 'Juno', 'Vesta', 'Pholus'],
  'Goddess': ['Ceres', 'Pallas', 'Juno', 'Vesta', 'Iris', 'Psyche', 'Fortuna', 'Hekate', 'Eros', 'Sedna', 'Eris', 'Chariklo'],
};

// HD section toggles (drive NatalView cards).
const SECTION_LABELS: Array<[keyof SectionToggles, string]> = [
  ['summaryBar', 'Type · Authority · Profile · Cross'],
  ['angles', 'Angels overlay (Sun/Earth · cross)'],
  ['gateColumns', 'Gate columns (Design + Personality)'],
  ['asteroidColumns', 'Asteroid columns (gate · sign · house)'],
  ['variables', 'Variables panel'],
  ['destinyPoints', 'Destiny / Purpose map'],
  ['profileLines', 'Lines · Quarters · Circuitry · Repeats'],
  ['activeChannels', 'Active channels grid'],
];

// Astrology card toggles — each maps to a real DualWheelView card.
const ASTRO_CARD_LABELS: Array<[keyof AstroCardToggles, string]> = [
  ['wheels', 'Dual wheel interaction map'],
  ['classifications', 'House / Element / Modality graphs'],
  ['chartShape', 'Chart shape card'],
  ['signature', 'Signature placement card'],
  ['chartRuler', 'Chart ruler card'],
  ['purpose', 'Purpose marker card'],
  ['moonPhase', 'Moon phase card'],
  ['tightAspects', 'Tight aspects (≤2°) card'],
  ['stelliums', 'Stelliums card'],
  ['houseRulers', 'House rulers card'],
  ['aspects', 'Full aspects tab'],
  ['placements', 'Placements tab'],
  ['houseCusps', 'House cusps (Placidus) subsection'],
  ['angels', 'Angel overlay on big-3'],
];

/** kebab-case slug for preset keys, derived from a title. */
function slugify(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ---- small styled helpers --------------------------------------------------

const groupStyle: React.CSSProperties = { borderTop: '1px solid var(--hair)', padding: '16px 0' };
const groupTitleStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase',
  color: 'var(--gold)', margin: '0 0 12px',
};

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink)', cursor: 'pointer', padding: '3px 0' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

// ---- asteroid selector modal ----------------------------------------------

function AsteroidModal({
  selected,
  onClose,
  onApply,
}: {
  selected: string[] | undefined;
  onClose: () => void;
  onApply: (next: string[] | undefined) => void;
}) {
  // `undefined` means "all". Represent as a working Set for editing.
  const [working, setWorking] = useState<Set<string>>(
    () => new Set(selected === undefined ? ASTEROID_CATALOG : selected)
  );
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => ASTEROID_CATALOG.filter((a) => a.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  const toggle = (name: string) => {
    setWorking((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--paper)', border: '1px solid var(--hair)', borderRadius: 0, width: 'min(560px, 92vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hair)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 14, color: 'var(--ink)' }}>Select asteroids ({working.size})</strong>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--mute)' }}>✕</button>
        </div>
        <div style={{ padding: '12px 18px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--hair)' }}>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search asteroids…"
            style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 13 }} />
          <button onClick={() => setWorking(new Set(ASTEROID_CATALOG))} style={{ fontSize: 11, padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, background: 'var(--card)', cursor: 'pointer' }}>All</button>
          <button onClick={() => setWorking(new Set())} style={{ fontSize: 11, padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, background: 'var(--card)', cursor: 'pointer' }}>None</button>
        </div>
        <div style={{ padding: '8px 18px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--hair)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute)' }}>Presets:</span>
          {Object.entries(ASTEROID_PRESETS).map(([name, list]) => (
            <button key={name} onClick={() => setWorking(new Set(list))}
              style={{ fontSize: 11, padding: '4px 10px', border: '1px solid var(--hair)', borderRadius: 0, background: 'var(--card)', cursor: 'pointer' }}>
              {name}
            </button>
          ))}
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 4 }}>
          {filtered.map((name) => (
            <Toggle key={name} label={name} checked={working.has(name)} onChange={() => toggle(name)} />
          ))}
        </div>
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--hair)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', border: '1px solid var(--hair)', borderRadius: 0, background: 'var(--card)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          <button
            onClick={() => {
              // If every asteroid is selected, store `undefined` (= all).
              const arr = Array.from(working);
              onApply(arr.length === ASTEROID_CATALOG.length ? undefined : arr);
            }}
            style={{ padding: '8px 14px', border: 'none', borderRadius: 0, background: 'var(--ink)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- planet selector modal -------------------------------------------------

function PlanetModal({
  side,
  selected,
  onClose,
  onApply,
}: {
  side: 'personality' | 'design';
  selected: string[] | undefined;
  onClose: () => void;
  onApply: (next: string[] | undefined) => void;
}) {
  const [working, setWorking] = useState<Set<string>>(
    () => new Set(selected === undefined ? PLANET_CATALOG : selected)
  );
  const toggle = (name: string) =>
    setWorking((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--paper)', border: '1px solid var(--hair)', borderRadius: 0, width: 'min(480px, 92vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hair)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 14, color: 'var(--ink)' }}>{side === 'design' ? 'Design' : 'Personality'} planets ({working.size})</strong>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--mute)' }}>✕</button>
        </div>
        <div style={{ padding: '10px 18px', display: 'flex', gap: 8, borderBottom: '1px solid var(--hair)' }}>
          <button onClick={() => setWorking(new Set(PLANET_CATALOG))} style={{ fontSize: 11, padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, background: 'var(--card)', cursor: 'pointer' }}>All</button>
          <button onClick={() => setWorking(new Set())} style={{ fontSize: 11, padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, background: 'var(--card)', cursor: 'pointer' }}>None</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 4 }}>
          {PLANET_CATALOG.map((name) => (
            <Toggle key={name} label={name} checked={working.has(name)} onChange={() => toggle(name)} />
          ))}
        </div>
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--hair)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', border: '1px solid var(--hair)', borderRadius: 0, background: 'var(--card)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          <button
            onClick={() => {
              const arr = Array.from(working);
              onApply(arr.length === PLANET_CATALOG.length ? undefined : arr);
            }}
            style={{ padding: '8px 14px', border: 'none', borderRadius: 0, background: 'var(--ink)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- main view -------------------------------------------------------------

export default function ChartMakerView() {
  const [config, setConfig] = useState<ChartConfig>(() => cloneChartConfig(DEFAULT_CHART_CONFIG));
  const [chartData, setChartData] = useState<any>(null);
  const [asteroidData, setAsteroidData] = useState<any[]>([]);

  // Sidebar resolution state
  const [groups, setGroups] = useState<ResolvedEntityGroup[] | null>(null);
  const [synth, setSynth] = useState<string | null>(null);
  const [sidebarTitle, setSidebarTitle] = useState<string>('');
  const [sidebarLoading, setSidebarLoading] = useState(false);

  // Presets + UI
  const [presets, setPresets] = useState<ChartPresetRow[]>([]);
  const [sets, setSets] = useState<DefinitionSetSummary[]>([]);
  const [selectionPresets, setSelectionPresets] = useState<SelectionPreset[]>([]);
  const [saveMsg, setSaveMsg] = useState<string>('');
  const [asteroidModal, setAsteroidModal] = useState(false);
  const [planetModal, setPlanetModal] = useState<null | 'personality' | 'design'>(null);
  const [activeTab, setActiveTab] = useState<'hd' | 'astro'>('hd');
  const [editorTab, setEditorTab] = useState<'chart' | 'sections' | 'sidebar'>('chart');

  // Token templates for the composer's synth/template selectors (per set).
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  // Which card's composer is expanded in the Sidebar tab.
  const [openCard, setOpenCard] = useState<string | null>(null);

  useEffect(() => {
    fetchSets().then(setSets).catch(() => setSets([]));
    listSelectionPresets().then(setSelectionPresets).catch(() => setSelectionPresets([]));
  }, []);

  useEffect(() => {
    fetchTemplates({ set_id: config.set_id }).then(setTemplates).catch(() => setTemplates([]));
  }, [config.set_id]);

  // Apply a saved selection layout (asteroids + per-side planets).
  function applySelectionLayout(key: string) {
    const p = selectionPresets.find((s) => s.key === key);
    if (!p) return;
    const allPlanets = (list: string[]) => (list.length === PLANET_CATALOG.length ? undefined : list);
    setConfig((prev) => ({
      ...prev,
      wheels: { ...prev.wheels, asteroids: p.asteroids.length ? p.asteroids : [] },
      planets: { personality: allPlanets(p.planets_personality), design: allPlanets(p.planets_design) },
    }));
  }

  // (Re)load saved chart presets whenever the selected set changes.
  useEffect(() => {
    listChartPresets(config.set_id).then(setPresets).catch(() => setPresets([]));
  }, [config.set_id]);

  // Fetch the selected asteroids (folded into astrology placements + aspects).
  // Only when a finite set is chosen — "all" (undefined) would be ~105 rows.
  const asteroidSelKey = (config.wheels.asteroids || []).join(',');
  useEffect(() => {
    let cancelled = false;
    const list = config.wheels.asteroids;
    if (!list || !list.length) { setAsteroidData([]); return; }
    (async () => {
      try {
        const svc = EphemerisService.getInstance();
        const data = await svc.getAsteroidsData({ ...SAMPLE_BIRTH, houseSystem: config.houseSystem }, list);
        if (!cancelled) setAsteroidData(data);
      } catch { if (!cancelled) setAsteroidData([]); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asteroidSelKey, config.houseSystem]);

  const patch = (p: Partial<ChartConfig>) => setConfig((prev) => ({ ...prev, ...p }));
  const patchBodygraph = (p: Partial<ChartConfig['bodygraph']>) =>
    setConfig((prev) => ({ ...prev, bodygraph: { ...prev.bodygraph, ...p } }));
  const patchWheels = (p: Partial<ChartConfig['wheels']>) =>
    setConfig((prev) => ({ ...prev, wheels: { ...prev.wheels, ...p } }));
  const patchSidebar = (p: Partial<ChartConfig['sidebar']>) =>
    setConfig((prev) => ({ ...prev, sidebar: { ...prev.sidebar, ...p } }));
  const patchSections = (p: Partial<SectionToggles>) =>
    setConfig((prev) => ({ ...prev, sections: { ...prev.sections, ...p } }));
  const patchAstroCards = (p: Partial<AstroCardToggles>) =>
    setConfig((prev) => ({ ...prev, astroCards: { ...prev.astroCards, ...p } }));
  const patchDesignTabs = (p: Partial<AstroDesignTabs>) =>
    setConfig((prev) => ({ ...prev, wheels: { ...prev.wheels, astroDesignTabs: { ...prev.wheels.astroDesignTabs, ...p } } }));
  const patchPlanets = (side: 'personality' | 'design', list: string[] | undefined) =>
    setConfig((prev) => ({ ...prev, planets: { ...prev.planets, [side]: list } }));
  const patchProfileTabs = (p: Partial<ProfileLineTabs>) =>
    setConfig((prev) => ({ ...prev, profileLineTabs: { ...prev.profileLineTabs, ...p } }));
  const patchCard = (entityType: string, comp: CardComposition) =>
    setConfig((prev) => ({ ...prev, cards: { ...prev.cards, [entityType]: comp } }));
  const cardCompFor = (entityType: string): CardComposition =>
    config.cards?.[entityType] || DEFAULT_CARD_COMPOSITIONS[entityType] || { synth: undefined, boxes: [] };

  const slotOrder = useMemo(() => config.sidebar.slots, [config.sidebar.slots]);

  // Resolve the editorial sidebar through the clicked card's COMPOSITION (synth
  // template + ordered boxes), exactly like the live chart runtime — so the
  // preview reflects what the saved preset will actually render. Falls back to
  // each entity's essence when a card has no composition.
  async function resolveEntities(entities: Array<{ sectionType: string; itemKey: string; title?: string }>, headerLabel: string) {
    if (!entities.length) return;
    setSidebarLoading(true);
    setSidebarTitle(headerLabel);
    try {
      const chartContext = config.scope === 'astro' ? 'astrology_only'
        : config.scope === 'hd' ? 'hd_only'
        : 'combined';
      const { synthText, groups } = await resolveCardSelection(entities, {
        compositionFor: (t) => cardCompFor(t),
        set_id: config.set_id,
        tone_key: config.tone_key,
        chart_context: chartContext,
        chartData,
      });
      setSynth(synthText);
      setGroups(groups);
    } catch {
      setSynth(null);
      setGroups([]);
    } finally {
      setSidebarLoading(false);
    }
  }

  // Listen for selections dispatched by the embedded chart views.
  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail || {};
      if (Array.isArray(detail.items)) {
        const header = detail.items[0]?.title || 'Selection';
        resolveEntities(detail.items, header);
      } else if (detail.sectionType && detail.itemKey != null) {
        resolveEntities([{ sectionType: detail.sectionType, itemKey: String(detail.itemKey), title: detail.title }],
          detail.title || String(detail.itemKey));
      }
    };
    window.addEventListener('astrohd:select-element', handler);
    return () => window.removeEventListener('astrohd:select-element', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.set_id, config.tone_key, config.cards, config.scope, chartData, activeTab]);

  async function onSave() {
    setSaveMsg('Saving…');
    try {
      const presetKey = config.preset_key || slugify(config.title);
      if (!presetKey) { setSaveMsg('Add a title first.'); return; }
      const saved = await saveChartPreset({ ...config, preset_key: presetKey });
      setConfig(saved);
      setPresets(await listChartPresets(saved.set_id));
      setSaveMsg('Saved ✓');
    } catch (e: any) {
      setSaveMsg(e?.message || 'Save failed.');
    }
  }

  function onLoadPreset(row: ChartPresetRow) {
    setConfig(rowToChartConfig(row));
    setSaveMsg(`Loaded "${row.title || row.preset_key}"`);
  }

  async function onDelete(row: ChartPresetRow) {
    if (!row.id) return;
    await deleteChartPreset(row.id);
    setPresets((prev) => prev.filter((p) => p.id !== row.id));
    setSaveMsg('Deleted.');
  }

  const asteroidCount = config.wheels.asteroids === undefined ? ASTEROID_CATALOG.length : config.wheels.asteroids.length;
  // Visibility of each system in the preview, honoring scope + active tab.
  const hdVisible = config.scope === 'hd' || (config.scope === 'both' && activeTab === 'hd');
  const astroVisible = config.scope === 'astro' || (config.scope === 'both' && activeTab === 'astro');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', height: '100%', overflow: 'hidden' }}>
      {/* ===== LEFT: config editor ===== */}
      <div style={{ overflowY: 'auto', borderRight: '1px solid var(--hair)', padding: '20px 18px', background: 'var(--paper)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', margin: 0 }}>Chart Maker</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: 'var(--ink)', margin: '4px 0 16px' }}>
          Compose a <em style={{ color: 'var(--gold)' }}>chart experience</em>
        </h1>

        {/* Preset identity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={config.title} onChange={(e) => patch({ title: e.target.value, preset_key: slugify(e.target.value) })} placeholder="Preset title (e.g. Business Chart)"
            style={{ padding: '8px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 13 }} />
          <div style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'monospace', padding: '2px 2px' }}>
            key: <span style={{ color: 'var(--ink)' }}>{config.preset_key || slugify(config.title) || '—'}</span>
          </div>
          <button onClick={onSave} style={{ padding: '8px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 0, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Save preset</button>
          {saveMsg && <p style={{ fontSize: 11, color: 'var(--mute)', margin: 0 }}>{saveMsg}</p>}
        </div>

        {/* Saved presets */}
        <div style={groupStyle}>
          <p style={groupTitleStyle}>Saved presets</p>
          {presets.length === 0 && <p style={{ fontSize: 11, color: 'var(--mute)', fontStyle: 'italic', margin: 0 }}>None saved for this set yet.</p>}
          {presets.length > 0 && (
            <>
            {presets.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                <button onClick={() => onLoadPreset(p)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink)' }}>{p.title || p.preset_key}</button>
                <button onClick={() => onDelete(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--mute)' }}>✕</button>
              </div>
            ))}
            </>
          )}
        </div>

        {/* Editor sub-tabs to keep the column short */}
        <div style={{ display: 'flex', gap: 4, marginTop: 16, marginBottom: 4, background: 'var(--card-mute, rgba(0,0,0,0.03))', border: '1px solid var(--hair)', borderRadius: 0, padding: 3 }}>
          {([['chart', 'Chart'], ['sections', 'Sections'], ['sidebar', 'Sidebar']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setEditorTab(k)}
              style={{ flex: 1, border: 'none', background: editorTab === k ? 'var(--ink)' : 'transparent', color: editorTab === k ? '#fff' : 'var(--mute)', borderRadius: 0, padding: '6px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {editorTab === 'chart' && (<>
        {/* Definition set + scope + tone */}
        <div style={groupStyle}>
          <p style={groupTitleStyle}>Definitions</p>
          <label style={{ fontSize: 11, color: 'var(--mute)' }}>Definition set</label>
          <select value={config.set_id ?? ''} onChange={(e) => patch({ set_id: e.target.value ? Number(e.target.value) : undefined })}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 12, margin: '4px 0 10px' }}>
            <option value="">Module default set</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>{s.label || s.slug}{s.is_default ? ' (default)' : ''}</option>
            ))}
          </select>
          <label style={{ fontSize: 11, color: 'var(--mute)' }}>Tone</label>
          <input value={config.tone_key || ''} onChange={(e) => patch({ tone_key: e.target.value })} placeholder="default / business / coaching"
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 12, margin: '4px 0' }} />
        </div>

        {/* Visibility & credits — these flags ride in config_json and are governed
            by the core unified Charts admin (Definitions → Charts). */}
        <div style={groupStyle}>
          <p style={groupTitleStyle}>Visibility &amp; credits</p>
          <Toggle label="Enabled (visible to users)" checked={config.enabled !== false} onChange={(v) => patch({ enabled: v })} />
          <Toggle label="Admin only" checked={!!config.admin_only} onChange={(v) => patch({ admin_only: v })} />
          <Toggle label="Premium (consumes credits)" checked={!!config.is_premium} onChange={(v) => patch({ is_premium: v })} />
          {config.is_premium && (
            <div style={{ marginTop: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--mute)' }}>Credit cost</label>
              <input type="number" min={0} value={config.credit_cost ?? 0}
                onChange={(e) => patch({ credit_cost: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 12, marginTop: 4 }} />
            </div>
          )}
        </div>

        {/* Chart scope */}
        <div style={groupStyle}>
          <p style={groupTitleStyle}>Chart scope</p>
          <select value={config.scope} onChange={(e) => patch({ scope: e.target.value as ChartScope })}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 12 }}>
            <option value="hd">Human Design only</option>
            <option value="astro">Astrology only</option>
            <option value="both">Both (tabbed)</option>
          </select>
        </div>

        {/* Sidebar category — where this chart lives in the core Charts nav. */}
        <div style={groupStyle}>
          <p style={groupTitleStyle}>Sidebar category</p>
          <select value={config.category || ''} onChange={(e) => patch({ category: (e.target.value || undefined) as ChartConfig['category'] })}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 12 }}>
            <option value="">Default for chart type</option>
            <option value="astrology">Astrology</option>
            <option value="hd">Human Design</option>
            <option value="astrohd">AstroHD (blended)</option>
          </select>
          <p style={{ fontSize: 10.5, color: 'var(--mute)', margin: '6px 2px 0', lineHeight: 1.4 }}>
            Which group this chart appears under in the Charts sidebar.
          </p>
        </div>

        {/* Difficulty level + popular — drives landing filters & recommendations. */}
        <div style={groupStyle}>
          <p style={groupTitleStyle}>Difficulty & recommendation</p>
          <select value={config.level || ''} onChange={(e) => patch({ level: (e.target.value || undefined) as ChartConfig['level'] })}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 12 }}>
            <option value="">Level: default (beginner)</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!config.popular} onChange={(e) => patch({ popular: e.target.checked })} />
            Mark as popular / recommended
          </label>
        </div>

        </>)}

        {editorTab === 'sections' && (<>
        {/* HD sections */}
        {config.scope !== 'astro' && (
          <div style={groupStyle}>
            <p style={groupTitleStyle}>Human Design cards</p>
            {SECTION_LABELS.map(([key, label]) => (
              <Toggle key={key} label={label} checked={config.sections[key]} onChange={(v) => patchSections({ [key]: v } as Partial<SectionToggles>)} />
            ))}
            {config.sections.profileLines && (
              <>
                <p style={{ ...groupTitleStyle, marginTop: 12, color: 'var(--mute)' }}>Profile-lines tabs</p>
                {PROFILE_TAB_KEYS.map(([key, label]) => (
                  <Toggle key={key} label={label} checked={config.profileLineTabs[key]} onChange={(v) => patchProfileTabs({ [key]: v } as Partial<ProfileLineTabs>)} />
                ))}
              </>
            )}
          </div>
        )}

        {/* Astrology cards */}
        {config.scope !== 'hd' && (
          <div style={groupStyle}>
            <p style={groupTitleStyle}>Astrology cards</p>
            {ASTRO_CARD_LABELS.map(([key, label]) => (
              <Toggle key={key} label={label} checked={config.astroCards[key]} onChange={(v) => patchAstroCards({ [key]: v } as Partial<AstroCardToggles>)} />
            ))}
            {config.astroCards.placements && (
              <Toggle label="Show gate.line column in Placements" checked={!!config.wheels.placementGates} onChange={(v) => patchWheels({ placementGates: v })} />
            )}
          </div>
        )}

        </>)}

        {editorTab === 'chart' && (<>
        {/* Bodygraph layers — HD only. */}
        {config.scope !== 'astro' && (
        <div style={groupStyle}>
          <p style={groupTitleStyle}>Bodygraph</p>
          <label style={{ fontSize: 11, color: 'var(--mute)' }}>Style</label>
          <select value={config.bodygraph.style} onChange={(e) => patchBodygraph({ style: e.target.value as ChartConfig['bodygraph']['style'] })}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 12, margin: '4px 0 10px' }}>
            <option value="lunacco">LunaCco bodygraph (default)</option>
            <option value="abstract">Abstract bodygraph</option>
          </select>
          <Toggle label="Show bodygraph" checked={config.bodygraph.show} onChange={(v) => patchBodygraph({ show: v })} />
          <Toggle label="Centers" checked={config.bodygraph.centers} onChange={(v) => patchBodygraph({ centers: v })} />
          <Toggle label="Center labels" checked={config.bodygraph.centerLabels} onChange={(v) => patchBodygraph({ centerLabels: v })} />
          <Toggle label="Gates" checked={config.bodygraph.gates} onChange={(v) => patchBodygraph({ gates: v })} />
          <Toggle label="Gate labels" checked={config.bodygraph.gateLabels} onChange={(v) => patchBodygraph({ gateLabels: v })} />

          <p style={{ ...groupTitleStyle, marginTop: 14, color: 'var(--mute)' }}>Gate notation</p>
          <p style={{ fontSize: 10.5, color: 'var(--mute)', margin: '0 0 6px', lineHeight: 1.4 }}>
            Extend <code>gate.line</code> with deeper design figures, e.g.{' '}
            <code>31.2{config.bodygraph.gateDetail.color ? '.4' : ''}{config.bodygraph.gateDetail.color && config.bodygraph.gateDetail.tone ? '.4' : ''}{config.bodygraph.gateDetail.color && config.bodygraph.gateDetail.tone && config.bodygraph.gateDetail.base ? '.2' : ''}</code>.
          </p>
          <Toggle label="Color" checked={config.bodygraph.gateDetail.color}
            onChange={(v) => patchBodygraph({ gateDetail: { ...config.bodygraph.gateDetail, color: v, tone: v ? config.bodygraph.gateDetail.tone : false, base: v ? config.bodygraph.gateDetail.base : false } })} />
          <Toggle label="Tone" checked={config.bodygraph.gateDetail.tone}
            onChange={(v) => patchBodygraph({ gateDetail: { ...config.bodygraph.gateDetail, color: v ? true : config.bodygraph.gateDetail.color, tone: v, base: v ? config.bodygraph.gateDetail.base : false } })} />
          <Toggle label="Base" checked={config.bodygraph.gateDetail.base}
            onChange={(v) => patchBodygraph({ gateDetail: { ...config.bodygraph.gateDetail, color: v ? true : config.bodygraph.gateDetail.color, tone: v ? true : config.bodygraph.gateDetail.tone, base: v } })} />
          {config.bodygraph.gateDetail.tone && (
            <Toggle label="Tone direction arrow (◂ / ▸)" checked={config.bodygraph.gateToneArrow}
              onChange={(v) => patchBodygraph({ gateToneArrow: v })} />
          )}
          <Toggle label="Show sign as glyph (not name)" checked={config.bodygraph.signGlyphs}
            onChange={(v) => patchBodygraph({ signGlyphs: v })} />
          <Toggle label="Show House (Hn) label" checked={config.bodygraph.showGateHouse}
            onChange={(v) => patchBodygraph({ showGateHouse: v })} />
          <Toggle label="Show planet text label" checked={config.bodygraph.showGatePlanetLabel}
            onChange={(v) => patchBodygraph({ showGatePlanetLabel: v })} />
          <label style={{ fontSize: 11, color: 'var(--mute)', display: 'block', marginTop: 8 }}>Variable arrows</label>
          <select value={config.bodygraph.variableArrows} onChange={(e) => patchBodygraph({ variableArrows: e.target.value as VariableArrowMode })}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 12, marginTop: 4 }}>
            <option value="full">Full (arrows + labels)</option>
            <option value="limited">Limited (arrows only)</option>
            <option value="off">Off</option>
          </select>
        </div>
        )}

        {/* Wheels — astrology only. */}
        {config.scope !== 'hd' && (
        <div style={groupStyle}>
          <p style={groupTitleStyle}>Astro wheels</p>
          <label style={{ fontSize: 11, color: 'var(--mute)' }}>Style</label>
          <select value={config.wheels.style} onChange={(e) => patchWheels({ style: e.target.value as ChartConfig['wheels']['style'] })}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 12, margin: '4px 0 10px' }}>
            <option value="lunacco">LunaCco wheel (default)</option>
            <option value="classic">Classic wheel</option>
          </select>
          <Toggle label="Combined wheel (overlaid)" checked={config.wheels.combined} onChange={(v) => patchWheels({ combined: v })} />
          <Toggle label="Personality wheel" checked={config.wheels.personality} onChange={(v) => patchWheels({ personality: v })} />
          <Toggle label="Design wheel" checked={config.wheels.design} onChange={(v) => patchWheels({ design: v })} />
          <Toggle label="Houses" checked={config.wheels.houses} onChange={(v) => patchWheels({ houses: v })} />
          <Toggle label="Chart points (ASC/MC…)" checked={config.wheels.chartPoints} onChange={(v) => patchWheels({ chartPoints: v })} />
          <Toggle label="Sabian degree layer" checked={config.wheels.sabian} onChange={(v) => patchWheels({ sabian: v })} />

          <label style={{ fontSize: 11, color: 'var(--mute)', display: 'block', marginTop: 8 }}>Degree precision</label>
          <select value={config.wheels.degreeFormat} onChange={(e) => patchWheels({ degreeFormat: e.target.value as ChartConfig['wheels']['degreeFormat'] })}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 12, marginTop: 4 }}>
            <option value="compact">Compact — 2°54&apos;</option>
            <option value="full">Full — 2°54&apos;44.241&quot;</option>
          </select>
          <p style={{ fontSize: 10.5, color: 'var(--mute)', margin: '6px 2px 0', lineHeight: 1.4 }}>
            Full shows degree, minute and decimal seconds on placements &amp; cusps.
          </p>
          <Toggle label="Asteroids in aspects" checked={config.wheels.aspectsIncludeAsteroids} onChange={(v) => patchWheels({ aspectsIncludeAsteroids: v })} />

          <p style={{ ...groupTitleStyle, marginTop: 14, color: 'var(--mute)' }}>Design in astrology</p>
          <Toggle label="Show Design side" checked={config.wheels.astroShowDesign} onChange={(v) => patchWheels({ astroShowDesign: v })} />
          {config.wheels.astroShowDesign && (
            <div style={{ paddingLeft: 6, borderLeft: '2px solid var(--hair)', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--mute)' }}>Show design in these tabs:</span>
              <Toggle label="Insights" checked={config.wheels.astroDesignTabs.insights} onChange={(v) => patchDesignTabs({ insights: v })} />
              <Toggle label="Aspects" checked={config.wheels.astroDesignTabs.aspects} onChange={(v) => patchDesignTabs({ aspects: v })} />
              <Toggle label="Placements" checked={config.wheels.astroDesignTabs.placements} onChange={(v) => patchDesignTabs({ placements: v })} />
            </div>
          )}

          <p style={{ ...groupTitleStyle, marginTop: 14, color: 'var(--mute)' }}>Aspects</p>
          {ASPECT_KEYS.map((k) => (
            <Toggle key={k} label={k} checked={config.wheels.aspects[k]} onChange={(v) => patchWheels({ aspects: { ...config.wheels.aspects, [k]: v } })} />
          ))}
          <label style={{ fontSize: 11, color: 'var(--mute)', display: 'block', marginTop: 8 }}>Orb filter</label>
          <select value={config.wheels.aspectOrbFilter} onChange={(e) => patchWheels({ aspectOrbFilter: e.target.value as AspectOrbFilter })}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 12, marginTop: 4 }}>
            <option value="all">All orbs</option>
            <option value="exact">Exact (≤1°)</option>
            <option value="tight">Tight (≤3°)</option>
            <option value="medium">Medium (≤6°)</option>
            <option value="wide">Wide (≤10°)</option>
          </select>

        </div>
        )}

        {/* Shared placement controls — house system, saved selection layouts and
            per-side planet selection apply to BOTH the HD bodygraph and the
            astrology wheels/placements, so they show for every scope. */}
        <div style={groupStyle}>
          <p style={groupTitleStyle}>House system</p>
          <select value={config.houseSystem} onChange={(e) => patch({ houseSystem: e.target.value as HouseSystem })}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 12 }}>
            <option value="whole_house">Whole Sign</option>
            <option value="placidus">Placidus</option>
            <option value="koch">Koch</option>
          </select>
          <Toggle label="Show house-system switcher on chart" checked={config.showHouseSystemToggle} onChange={(v) => patch({ showHouseSystemToggle: v })} />

          <p style={{ ...groupTitleStyle, marginTop: 14, color: 'var(--mute)' }}>Selection layouts</p>
          <select value="" onChange={(e) => { if (e.target.value) applySelectionLayout(e.target.value); }}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--hair)', borderRadius: 0, fontSize: 12 }}>
            <option value="">Apply a saved layout…</option>
            {selectionPresets.map((p) => (
              <option key={p.key} value={p.key}>{p.name}</option>
            ))}
          </select>
          {selectionPresets.length === 0 && (
            <p style={{ fontSize: 10, color: 'var(--mute)', fontStyle: 'italic', margin: '4px 0 0' }}>Create layouts in the Selection Presets page.</p>
          )}

          <p style={{ ...groupTitleStyle, marginTop: 14, color: 'var(--mute)' }}>Planets per side</p>
          <button onClick={() => setPlanetModal('personality')}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--hair)', borderRadius: 0, background: 'var(--card)', cursor: 'pointer', fontSize: 12, textAlign: 'left', marginBottom: 4 }}>
            Personality: {config.planets.personality === undefined ? `all (${PLANET_CATALOG.length})` : `${config.planets.personality.length} selected`} — choose…
          </button>
          <button onClick={() => setPlanetModal('design')}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--hair)', borderRadius: 0, background: 'var(--card)', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
            Design: {config.planets.design === undefined ? `all (${PLANET_CATALOG.length})` : `${config.planets.design.length} selected`} — choose…
          </button>
        </div>

        {/* Asteroids — selection drives BOTH the astrology wheels/placements and
            the HD bodygraph asteroid columns, so it shows for every scope. */}
        <div style={groupStyle}>
          <p style={groupTitleStyle}>Asteroids</p>
          <button onClick={() => setAsteroidModal(true)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--hair)', borderRadius: 0, background: 'var(--card)', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
            {config.wheels.asteroids === undefined ? `All asteroids (${ASTEROID_CATALOG.length})` : `${asteroidCount} selected`} — choose…
          </button>
          <p style={{ fontSize: 10.5, color: 'var(--mute)', margin: '6px 2px 0', lineHeight: 1.4 }}>
            Asteroids never activate gates on the bodygraph — they list in the
            data columns only. Toggle the columns under Sections → Asteroid columns.
          </p>
        </div>

        </>)}

        {editorTab === 'sidebar' && (<>
        {/* Per-card box composer — what shows when each card type is clicked. */}
        <div style={groupStyle}>
          <p style={groupTitleStyle}>Card readings</p>
          <p style={{ fontSize: 10.5, color: 'var(--mute)', margin: '0 0 10px', lineHeight: 1.5 }}>
            Each card = one synthesis (weaves all the pieces) + any standalone boxes
            (a slot or template for one piece). Order is display order.
          </p>
          {CARD_CATEGORIES.map((cat) => {
            // Hide cards that don't belong to the chart's scope (astro_* on an
            // HD-only chart and hd_* on an astrology-only chart).
            const cards = cat.cards.filter((card) =>
              config.scope === 'both' ? true
                : config.scope === 'hd' ? !card.entityType.startsWith('astro_')
                : !card.entityType.startsWith('hd_'));
            if (!cards.length) return null;
            return (
            <div key={cat.key} style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mute)', margin: '0 0 6px' }}>{cat.label}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {cards.map((card) => {
                  const comp = cardCompFor(card.entityType);
                  const configured = !!(comp.synth || comp.boxes.length);
                  const open = openCard === card.entityType;
                  return (
                    <div key={card.entityType} style={{ border: '1px solid var(--hair)', borderRadius: 0, background: open ? 'var(--card)' : 'transparent' }}>
                      <button onClick={() => setOpenCard(open ? null : card.entityType)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 10px', fontSize: 12, color: 'var(--ink)' }}>
                        <span style={{ fontWeight: 600 }}>{card.label}</span>
                        <span style={{ fontSize: 9.5, color: configured ? 'var(--gold)' : 'var(--mute)' }}>
                          {configured ? `${comp.synth ? 'synth' : ''}${comp.synth && comp.boxes.length ? ' + ' : ''}${comp.boxes.length ? `${comp.boxes.length} box${comp.boxes.length > 1 ? 'es' : ''}` : ''}` : 'default'}
                          <span style={{ marginLeft: 6 }}>{open ? '▾' : '▸'}</span>
                        </span>
                      </button>
                      {open && (
                        <div style={{ padding: '0 10px 8px' }}>
                          <CardBoxComposer card={card} composition={comp} templates={templates}
                            onChange={(next) => patchCard(card.entityType, next)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>

        {/* Legacy flat slot list — still honored as a fallback by older views. */}
        <div style={groupStyle}>
          <p style={groupTitleStyle}>Legacy sidebar slots</p>
          <Toggle label="Data only (hide prose)" checked={config.sidebar.showDataOnly} onChange={(v) => patchSidebar({ showDataOnly: v })} />
          <p style={{ fontSize: 10, color: 'var(--mute)', margin: '6px 0' }}>
            Used only when a card has no composition above.
          </p>
          {SIDEBAR_SLOT_OPTIONS.map((slot) => (
            <Toggle key={slot} label={slot} checked={config.sidebar.slots.includes(slot)}
              onChange={(v) => patchSidebar({ slots: v ? [...config.sidebar.slots, slot] : config.sidebar.slots.filter((s) => s !== slot) })} />
          ))}
        </div>
        </>)}
      </div>

      {/* ===== RIGHT: live preview ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
        <div style={{ overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--mute)', margin: 0 }}>
              Live preview · sample chart
            </p>
            <div style={{
              display: 'flex',
              gap: config.showHouseSystemToggle && config.scope === 'both' ? 4 : 8,
              // When both toggles show on a dual/combined chart, stack them so they read as separate.
              flexDirection: config.showHouseSystemToggle && config.scope === 'both' ? 'column' : 'row',
              alignItems: 'flex-end',
            }}>
              {/* House system switcher (shown when enabled for end-users) — universal flat toggle. */}
              {config.showHouseSystemToggle && (
                <FlatToggle
                  value={config.houseSystem}
                  options={[['whole_house', 'Whole Sign'], ['placidus', 'Placidus'], ['koch', 'Koch']] as const}
                  onChange={(h) => patch({ houseSystem: h })}
                />
              )}
              {/* HD ↔ Astrology mode switch — only when scope = both — universal flat toggle. */}
              {config.scope === 'both' && (
                <FlatToggle
                  value={activeTab}
                  options={[['hd', 'Human Design'], ['astro', 'Astrology']] as const}
                  onChange={(t) => setActiveTab(t)}
                />
              )}
            </div>
          </div>

          {/* HD chart: always mounted (computes the chart data the wheels need), hidden when not visible. */}
          <div style={{ display: hdVisible ? 'block' : 'none' }}>
            <NatalView
              initialDate={SAMPLE_BIRTH.date}
              initialTime={SAMPLE_BIRTH.time}
              initialLat={SAMPLE_BIRTH.lat}
              initialLng={SAMPLE_BIRTH.lng}
              initialTimezone={SAMPLE_BIRTH.timezone}
              config={config}
              previewMode
              onChartReady={setChartData}
            />
          </div>

          {/* Astrology: the REAL Dual Astrology Map, driven by the config.
              Every card (wheels, graphs, insights, aspects, placements, cusps)
              is toggled via config.astroCards; design side via wheels.astroShowDesign. */}
          {astroVisible && !chartData && (
            <p style={{ color: 'var(--mute)', fontStyle: 'italic', marginTop: 18 }}>Computing chart…</p>
          )}
          {astroVisible && chartData && (
            <DualWheelView chartData={chartData} config={config} previewMode asteroids={asteroidData} />
          )}
        </div>

        {/* Editorial sidebar preview */}
        <InterpretationPanel
          groups={groups}
          synth={synth}
          title={sidebarTitle}
          dataOnly={config.sidebar.showDataOnly}
          isLoading={sidebarLoading}
        />
      </div>

      {asteroidModal && (
        <AsteroidModal
          selected={config.wheels.asteroids}
          onClose={() => setAsteroidModal(false)}
          onApply={(next) => { patchWheels({ asteroids: next }); setAsteroidModal(false); }}
        />
      )}

      {planetModal && (
        <PlanetModal
          side={planetModal}
          selected={planetModal === 'design' ? config.planets.design : config.planets.personality}
          onClose={() => setPlanetModal(null)}
          onApply={(next) => { patchPlanets(planetModal, next); setPlanetModal(null); }}
        />
      )}
    </div>
  );
}
