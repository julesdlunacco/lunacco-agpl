/**
 * AstroHDShell — chart type registry + interpretation panel + center pane renderer
 * for the AstroHD module. Exposed via window.LunaCcoAstroHDCharts so the core
 * shell (CoreChartsView) can embed these without importing from this bundle.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchDefinitions, resolveDefinitions, parseDefinitionMarkdown, resolveCoreDefinition, resolveCardGroups, sectionItemToEntityRef, SECTION_TO_ENTITY_TYPE, getCoreDefinitionCache, getCardGroupsCache } from '../services/DefinitionService';
import { analyzeAstroInsights } from '../services/AstroInsights';
import { DEFAULT_CARD_COMPOSITIONS, normalizeCardCompositions, normalizeChartConfig } from '../services/chartConfig';
import { listChartPresets, rowToChartConfig, loadChartConfig } from '../services/ChartPresetService';
import { SynthBox, SlotBox, BoxSkeleton, PlacementSwitcher } from './composer/EditorialBoxes';
import { getAngelOverlay } from '../services/AngelOverlayService';
import { downloadActiveChartPng } from '../services/chartExport';

/**
 * Floating "Download PNG" button shown over the active chart pane. It exports the
 * largest SVG inside [data-astrohd-chart-pane] (the bodygraph or wheel) to a PNG.
 */
function ChartDownloadButton( { filename = 'chart' } ) {
  const [ busy, setBusy ] = useState( false );
  const handleClick = async () => {
    setBusy( true );
    try {
      await downloadActiveChartPng( filename );
    } catch ( e ) {
      console.error( '[AstroHD] PNG export failed', e );
      alert( ( e && e.message ) || 'Could not export the chart image.' );
    } finally {
      setBusy( false );
    }
  };
  return (
    <button
      type="button"
      onClick={ handleClick }
      disabled={ busy }
      title="Download this chart as a PNG image"
      data-html2canvas-ignore="true"
      style={{
        position: 'absolute', top: 10, right: 14, zIndex: 6,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        border: '1px solid var(--hair)', background: 'var(--card)', color: 'var(--ink)',
        borderRadius: 6, padding: '6px 11px', fontSize: 10.5, fontWeight: 800,
        letterSpacing: '0.12em', textTransform: 'uppercase', cursor: busy ? 'wait' : 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}
    >
      { busy ? 'Saving…' : '↓ PNG' }
    </button>
  );
}

// Resolver entity_type → bundle role, for targeting standalone boxes at one
// piece of the bundle ("shadow for just the gate", "coaching for the line").
const ROLE_OF_ENTITY_TYPE = {
  hd_gate: 'gate', astro_planet: 'planet', hd_planet: 'planet', hd_line: 'line',
  astro_sign: 'sign', astro_house: 'house', astro_angle_point: 'planet',
  hd_channel: 'channel', hd_center: 'center', astro_aspect: 'aspect',
  hd_profile: 'profile', hd_incarnation_cross: 'cross',
  hd_variable: 'variable', hd_variable_color: 'variable', hd_variable_tone: 'variable',
  angel_shem: 'angel', astro_moon_phase: 'moon_phase',
  astro_stellium: 'stellium', hd_destiny_point: 'destiny_point',
  astro_chart_pattern: 'chart_pattern',
};

const { CircleDot, Orbit, Users, GitMerge, Layers, Aperture } = window.LucideReact || {};

// ─── Chart type definitions ────────────────────────────────────────────────────

// `category` places each chart in the sidebar: 'astrology' (Western only),
// 'hd' (Human Design only), or 'astrohd' (blended — uses both systems). These are
// the defaults; a Chart Maker preset can override via preset.category (see
// getAstroHDChartTypes), so founders can reclassify charts without code changes.
export const ASTROHD_CHART_TYPES = [
  { id: 'ahd_natal',         system: 'astrohd', category: 'hd',        level: 'beginner',     popular: true,  label: 'Bodygraph',       shortLabel: 'Bodygraph',   icon: CircleDot, desc: 'Human Design birth chart — centers, channels & gates',   viewKey: 'NatalView' },
  { id: 'ahd_shadow',        system: 'astrohd', category: 'hd',        level: 'intermediate', popular: false, label: 'Shadow Chart',    shortLabel: 'Shadow',      icon: Aperture || CircleDot, desc: 'Open centers and conditioning gates in an editorial bodygraph', viewKey: 'ShadowView' },
  { id: 'ahd_wheel',         system: 'astrohd', category: 'astrology', level: 'beginner',     popular: true,  label: 'Astrology',       shortLabel: 'Astrology',   icon: Orbit,     desc: 'Traditional zodiac wheel with natal planetary positions', viewKey: 'WheelView' },
  { id: 'ahd_dual_wheel',    system: 'astrohd', category: 'astrohd',   level: 'intermediate', popular: false, label: 'Dual Astrology',  shortLabel: 'Dual Astro',  icon: Orbit,     desc: 'Side-by-side conscious and unconscious astrology wheels and data', viewKey: 'DualWheelView' },
  { id: 'ahd_combined',      system: 'astrohd', category: 'astrohd',   level: 'intermediate', popular: true,  label: 'Combined Chart',  shortLabel: 'Combined',    icon: Layers,    desc: 'Bodygraph + astrology wheel in one editorial view',       viewKey: 'CombinedView' },
  { id: 'ahd_transit',       system: 'astrohd', category: 'astrohd',   level: 'beginner',     popular: false, label: 'Transits',        shortLabel: 'Transits',    icon: Orbit,     desc: 'Current planetary transits bodygraph',                    viewKey: 'TransitView' },
  { id: 'ahd_transit_birth', system: 'astrohd', category: 'hd',        level: 'advanced',     popular: false, label: 'Transit + Birth', shortLabel: 'Trans+Birth', icon: GitMerge,  desc: 'Current transits overlaid on your natal chart',           viewKey: 'TransitBirthView' },
  { id: 'ahd_connection',    system: 'astrohd', category: 'hd',        level: 'advanced',     popular: false, label: 'Connections',     shortLabel: 'Connections', icon: Users,     desc: 'Synastry and relationship dynamics',                      viewKey: 'ConnectionView' },
  { id: 'ahd_asteroids',     system: 'astrohd', category: 'astrohd',   level: 'advanced',     popular: false, label: 'Asteroid Chart',  shortLabel: 'Asteroids',   icon: Layers,    desc: 'Specialized asteroid lookup: Big 4, Pholus, and Mony',    viewKey: 'AsteroidsView' },
];

const PRESET_BASE_TYPES = {
  bodygraph: 'ahd_natal',
  hd: 'ahd_natal',
  human_design: 'ahd_natal',
  natal: 'ahd_natal',
  shadow: 'ahd_shadow',
  shadow_chart: 'ahd_shadow',
  astrology: 'ahd_wheel',
  wheel: 'ahd_wheel',
  dual_wheel: 'ahd_dual_wheel',
  dual_astrology: 'ahd_dual_wheel',
  combined: 'ahd_combined',
  transit: 'ahd_transit',
  transit_birth: 'ahd_transit_birth',
  connection: 'ahd_connection',
  asteroids: 'ahd_asteroids',
};

export function getAstroHDChartTypes() {
  const astroSettings = window.LunaCcoData?.modules?.['luna-astrohd'] || {};
  const presets = Array.isArray( astroSettings.coreChartPresets ) ? astroSettings.coreChartPresets : [];
  const presetTypes = presets
    .filter( ( preset ) => preset?.is_enabled === undefined || Number( preset.is_enabled ) !== 0 )
    .map( ( preset ) => {
      const baseId = PRESET_BASE_TYPES[ preset.chart_type ] || 'ahd_combined';
      const base = ASTROHD_CHART_TYPES.find( ( type ) => type.id === baseId ) || ASTROHD_CHART_TYPES[ 2 ];
      // Category/level/popular: explicit preset override → else inherit the base.
      let presetCategory = preset.category, presetLevel, presetPopular;
      try {
        const cfg = typeof preset.config_json === 'string' ? JSON.parse( preset.config_json ) : preset.config_json;
        presetCategory = presetCategory || cfg?.category;
        presetLevel = cfg?.level;
        presetPopular = cfg?.popular;
      } catch { /* ignore malformed config_json */ }
      return {
        ...base,
        id: `ahd_preset_${ preset.preset_key || preset.id }`,
        label: preset.title || base.label,
        shortLabel: preset.title || base.shortLabel,
        desc: preset.description || base.desc,
        category: presetCategory || base.category,
        level: presetLevel || base.level,
        popular: presetPopular !== undefined ? presetPopular : base.popular,
        chart_type: preset.chart_type,
        coreChartPreset: preset,
        definitionSetId: preset.set_id,
        chartPresetKey: preset.preset_key,
      };
    } );

  return [ ...ASTROHD_CHART_TYPES, ...presetTypes ];
}

// ─── AsteroidPanel (Sidebar interpretation for asteroids) ──────────────────────

function AsteroidPanel({ chartData }) {
  const [activeTab, setActiveTab] = useState('personality');
  const isTransit = !!chartData?.isTransit;

  const core = chartData?.core;
  const asteroids = chartData?.asteroids || [];

  if (!core) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '12px' }}>
        <em>Calculate the asteroid chart to see resonance matches.</em>
      </div>
    );
  }

  const tabs = isTransit ? ['personality'] : ['personality', 'design'];
  const activations = activeTab === 'personality' ? core.birthActivations : core.designActivations;

  const findMatches = (gate, line) => {
    const getCenter = (g) => {
      const GATE_TO_CENTER = {
        58: 'Root', 38: 'Root', 54: 'Root', 53: 'Root', 60: 'Root', 52: 'Root', 19: 'Root', 39: 'Root', 41: 'Root',
        27: 'Sacral', 34: 'Sacral', 5: 'Sacral', 14: 'Sacral', 29: 'Sacral', 59: 'Sacral', 9: 'Sacral', 3: 'Sacral', 42: 'Sacral',
        18: 'Spleen', 28: 'Spleen', 32: 'Spleen', 50: 'Spleen', 44: 'Spleen', 57: 'Spleen', 48: 'Spleen',
        6: 'Emotions', 37: 'Emotions', 22: 'Emotions', 36: 'Emotions', 30: 'Emotions', 55: 'Emotions', 49: 'Emotions',
        21: 'Heart', 40: 'Heart', 26: 'Heart', 51: 'Heart',
        1: 'Self', 13: 'Self', 25: 'Self', 46: 'Self', 2: 'Self', 15: 'Self', 10: 'Self', 7: 'Self',
        20: 'Throat', 16: 'Throat', 62: 'Throat', 23: 'Throat', 56: 'Throat', 35: 'Throat', 12: 'Throat', 45: 'Throat', 33: 'Throat', 8: 'Throat', 31: 'Throat',
        43: 'Mind', 17: 'Mind', 47: 'Mind', 24: 'Mind', 4: 'Mind', 11: 'Mind',
        64: 'Crown', 61: 'Crown', 63: 'Crown'
      };
      return GATE_TO_CENTER[g] || 'Unknown';
    };

    return asteroids.filter(ast => {
      const act = activeTab === 'personality' ? ast.personality : ast.design;
      return act && act.gate === gate;
    }).map(ast => {
      const act = activeTab === 'personality' ? ast.personality : ast.design;
      return {
        name: ast.name,
        gate: act.gate,
        line: act.line,
        center: getCenter(act.gate),
        isExact: act.line === line
      };
    });
  };

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', borderBottom: '1px solid var(--hair)', marginBottom: 12 }}>
        {tabs.map(t => (
          <button 
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: activeTab === t ? 'var(--indigo)' : 'var(--mute)',
              borderBottom: activeTab === t ? '2px solid var(--indigo)' : 'none',
              transition: '0.2s'
            }}>
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {Object.entries(activations || {}).map(([name, a]) => {
          const matches = findMatches(a.gate, a.line);
          if (matches.length === 0) return null; // Only show if matches exist?
          // Actually user said: "List the core planets and placements ... and then a list of any matching asteroids"
          // Maybe only show if matches exist to keep it focused.
          
          return (
            <div key={name} style={{ padding: '12px', background: 'var(--card)', border: '1px solid var(--hair)', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase' }}>{name}</span>
                <span style={{ fontFamily: 'var(--mono, monospace)', fontWeight: 700, color: activeTab === 'personality' ? 'var(--indigo)' : '#b91c1c' }}>
                  {a.gate}.{a.line}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--mute)', marginBottom: 8 }}>
                {a.sign} · House {a.house}
              </div>
              
              <div className="space-y-1">
                {matches.map(m => (
                  <div key={m.name} style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4, paddingBottom: 4, borderBottom: '1px dashed var(--hair)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                      <span style={{ color: 'var(--ink)', fontWeight: m.isExact ? 800 : 500 }}>
                        {m.isExact ? '!' : '→'} {m.name}
                      </span>
                      <span style={{ opacity: 0.5 }}>{m.gate}.{m.line}</span>
                      {m.isExact && <span style={{ fontSize: 8, fontWeight: 900, color: 'var(--indigo)' }}>EXACT</span>}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--gold)', fontWeight: 600, textTransform: 'uppercase' }}>
                      {m.center} Center
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      {Object.values(activations || {}).every(a => findMatches(a.gate, a.line).length === 0) && (
        <div style={{ padding: '40px 20px', textAlign: 'center', opacity: 0.4, fontSize: '11px' }}>
          No asteroid resonances found for {activeTab} activations.
        </div>
      )}
    </div>
  );
}

// ─── AstroHDPanel ─────────────────────────────────────────────────────────────

const HD_PILLS    = [ 'Type', 'Authority', 'Profile', 'Definition', 'Channels', 'Gates' ];

const SIGNS = [ 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces' ];
const MODERN_RULERS = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon', Leo: 'Sun', Virgo: 'Mercury',
  Libra: 'Venus', Scorpio: 'Pluto', Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Uranus', Pisces: 'Neptune',
};
// Optional astro sidebar pills mapped to their layer key (chart_ruler/aspects already
// existed; house_rulers/stelliums/chart_shape are new). Built dynamically from the
// chart's enabled layers; base placements (Sun/Moon/Rising/North Node) always show.
const ASTRO_LAYER_PILLS = [
  { pill: 'Chart Ruler', layer: 'chart_ruler', after: 'Rising' },
  { pill: 'Aspect', layer: 'aspects', after: 'North Node' },
  { pill: 'House Rulers', layer: 'house_rulers', after: null },
  { pill: 'Stelliums', layer: 'stelliums', after: null },
  { pill: 'Chart Shape', layer: 'chart_shape', after: null },
];

// Friendly slot labels for the editorial sidebar boxes (mirrors InterpretationPanel).
const SLOT_LABELS = {
  short_def: 'Essence', long_def: 'In Depth',
  aspect_short: 'The Aspect', aspect_long: 'In Depth',
  gift: 'The Gift', gift_short: 'The Gift', gift_long: 'The Gift',
  shadow_short: 'The Shadow', shadow_long: 'The Shadow',
  shadow_recessive: 'Shadow · Recessive', shadow_reactive: 'Shadow · Reactive',
  coaching_notes: 'Coaching', coaching_key_notes: 'Coaching Notes', coaching_questions: 'Coaching Questions',
  affirmation: 'Affirmation', journal_prompt: 'Journal Prompt', practice_prompt: 'Practice',
};
const slotLabel = (k) => SLOT_LABELS[k] || k.replace(/_/g, ' ');

// Distinct editorial treatment per slot family: shadow / gift / coaching get
// their own accent so the boxes read as a layered reading, not a flat dump.
function slotTone(k) {
  if (k.startsWith('shadow')) return { accent: 'var(--shadow-accent, #b45c5c)', tint: 'color-mix(in srgb, #b45c5c 6%, transparent)' };
  if (k.startsWith('gift'))   return { accent: 'var(--gift-accent, #c79a3e)',   tint: 'color-mix(in srgb, #c79a3e 7%, transparent)' };
  if (k.startsWith('coaching') || k === 'journal_prompt' || k === 'practice_prompt' || k === 'affirmation')
                              return { accent: 'var(--indigo)',                 tint: 'color-mix(in srgb, var(--indigo) 5%, transparent)' };
  return null; // essence / in-depth render plain
}

const SECTION_LABELS = {
  hd_gate: 'Gate', hd_center: 'Center', hd_channel: 'Channel', hd_planet: 'HD Planet',
  astro_planet: 'Planet', astro_sign: 'Sign', astro_house: 'House', astro_aspect: 'Aspect',
  astro_angle_point: 'Angle / Point', astro_moon_phase: 'Moon Phase',
  hd_type: 'Type', hd_authority: 'Authority', hd_profile: 'Profile',
  hd_definition_type: 'Definition', hd_incarnation_cross: 'Incarnation Cross', hd_variable: 'Variable',
  astro_stellium: 'Stellium', hd_destiny_point: 'Destiny Point',
  astro_chart_pattern: 'Chart Pattern',
};
const sectionLabel = (k) => SECTION_LABELS[k] || k.replace(/_/g, ' ');

/** Editorial grouped boxes for the per-card-type resolved definitions. */
function GroupedReading( { groups } ) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      { groups.filter(g => g.boxes && g.boxes.length).map((g, gi) => (
        <section key={`${g.sectionType}-${g.label}-${gi}`} style={{ border: '1px solid var(--hair)', borderRadius: 10, overflow: 'hidden', background: 'var(--paper)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--hair)', background: 'color-mix(in srgb, var(--gold) 7%, transparent)' }}>
            <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold)' }}>{ sectionLabel(g.sectionType) }</span>
            <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink)' }}>{ g.label }</span>
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            { g.boxes.map((box) => {
              const tone = slotTone(box.slot_key);
              return (
                <div key={box.slot_key} style={ tone ? { borderLeft: `2px solid ${tone.accent}`, background: tone.tint, borderRadius: 6, padding: '8px 10px' } : undefined }>
                  <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: tone ? tone.accent : 'var(--gold)', marginBottom: 4 }}>{ slotLabel(box.slot_key) }</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink)', opacity: 0.92 }} dangerouslySetInnerHTML={{ __html: box.value.replace(/\n/g, '<br/>') }} />
                </div>
              );
            }) }
          </div>
        </section>
      )) }
    </div>
  );
}

export function AstroHDPanel( { chartData, activeChart } ) {
  const [definitions,    setDefinitions] = useState([]);
  const [loadingDefs,    setLoadingDefs] = useState(false);
  const [selectedItems,  setSelectedItems] = useState([]); // Array of { sectionType, itemKey, title? }
  const [coreResolution, setCoreResolution] = useState(null); // resolve() synth result (rendered_text + display_boxes)
  const [composedBoxes,  setComposedBoxes]  = useState(null); // [{ box, value }] from the card's composition (resolve-slots / templates)
  const [resolving,      setResolving]      = useState(false);
  // Per-card compositions from the chart's preset (config_json.cards); default
  // charts use the 'default' preset if one exists, else built-in defaults.
  const [presetCards,    setPresetCards]    = useState(null);
  // Multi-placement gate handling: when a clicked gate is active in more than
  // one placement, one synth per placement behind a segmented switcher.
  const [gatePlacements, setGatePlacements] = useState([]);
  const [activePlacementKey, setActivePlacementKey] = useState('');

  const settings = window.LunaCcoData?.modules?.['luna-astrohd'] || {};
  const customerServiceEmail = settings.customerServiceEmail || '';

  useEffect(() => {
    setLoadingDefs(true);
    console.log('[AstroHDShell] Loading definitions from core definition engine');

    fetchDefinitions(0, { source: 'core', moduleId: 'luna-astrohd' }).then(defs => {
      setDefinitions(defs);
      console.log('[AstroHDShell] Definitions loaded:', defs);
      setLoadingDefs(false);
    }).catch(err => {
      console.error('Failed to load definitions:', err);
      setLoadingDefs(false);
    });
  }, []);

  // Load the per-card compositions for the active chart. Preset charts read
  // their own preset; default charts try a preset keyed 'default'.
  useEffect(() => {
    let cancelled = false;
    const key = activeChart?.chartPresetKey || 'default';
    const setId = activeChart?.coreChartPreset?.set_id || undefined;
    (async () => {
      try {
        const presets = await listChartPresets(setId);
        if (cancelled) return;
        const row = presets.find((p) => p.preset_key === key)
          || (key !== 'default' ? presets.find((p) => p.preset_key === 'default') : undefined);
        const cards = row ? rowToChartConfig(row).cards : null;
        setPresetCards(cards && Object.keys(cards).length ? cards : null);
      } catch {
        if (!cancelled) setPresetCards(null);
      }
    })();
    return () => { cancelled = true; };
  }, [activeChart?.chartPresetKey, activeChart?.coreChartPreset?.set_id]);

  // Composition for one card entity_type: preset → built-in default → null.
  const compositionFor = useCallback((entityType) => {
    const fromPreset = presetCards?.[entityType];
    if (fromPreset && (fromPreset.synth || (fromPreset.boxes || []).length)) return fromPreset;
    return normalizeCardCompositions(DEFAULT_CARD_COMPOSITIONS)[entityType] || null;
  }, [presetCards]);

  // Live mirror of the visible HD pills so the (once-registered) select handler can
  // resolve indices against the current layer-gated list.
  const hdPillsRef = useRef(HD_PILLS);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail) {
        const items = e.detail.items ? e.detail.items : [e.detail];
        setSelectedItems(items);

        // Auto-switch pill if it's a known section type. Indices come from the live
        // (layer-gated) HD pill list via a ref, so disabled pills don't misalign.
        const first = items[0];
        const sectionToPill = {
          hd_channels: 'Channels', hd_gates: 'Gates', hd_types: 'Type',
          hd_profiles: 'Profile', hd_authorities: 'Authority', hd_definition_types: 'Definition',
        };
        const pillName = first && sectionToPill[first.sectionType];
        if (pillName) {
          const idx = hdPillsRef.current.indexOf(pillName);
          if (idx >= 0) { setMode('HD'); setActivePill(idx); }
        }
      }
    };
    window.addEventListener('astrohd:select-element', handler);
    return () => window.removeEventListener('astrohd:select-element', handler);
  }, []);

  // Preset charts force the sidebar mode from their configured scope, so an
  // astrology-only preset never shows an HD toggle (and vice versa).
  const presetScope = useMemo( () => {
    if ( ! activeChart?.coreChartPreset ) return null;
    const cfg = presetRowConfig( activeChart.coreChartPreset );
    return cfg?.scope || null;
  }, [ activeChart?.id ] ); // eslint-disable-line react-hooks/exhaustive-deps

  const forceMode  = presetScope === 'hd' ? 'HD'
    : presetScope === 'astro' ? 'Astro'
    : ( activeChart?.id === 'ahd_natal' || activeChart?.id === 'ahd_transit' || activeChart?.id === 'ahd_connection' ) ? 'HD'
    : ( activeChart?.id === 'ahd_wheel' || activeChart?.id === 'ahd_dual_wheel' ) ? 'Astro' : null;
  const showToggle = presetScope
    ? presetScope === 'both'
    : ( !forceMode || [ 'ahd_combined', 'ahd_transit_birth' ].includes( activeChart?.id ) );

  const [ mode,       setMode       ] = useState( forceMode || 'HD' );
  const [ activePill, setActivePill ] = useState( 0 );

  useEffect( () => { if ( forceMode ) setMode( forceMode ); }, [ activeChart?.id ] );

  // Layers enabled for the active chart (from the core Charts admin). Unknown chart ⇒
  // show everything (back-compat). Drives which optional astro pills appear.
  const chartLayers = useMemo(() => {
    const chartKey = String(activeChart?.id || '').replace(/^ahd_/, '');
    return settings.chartDisplaySettings?.[chartKey]?.layers || null;
  }, [activeChart?.id, settings]);

  // Per-card-type template/slot config for the active chart (from the core Charts
  // admin). Keyed by resolver entity_type (hd_gate, astro_sign, astro_aspect…).
  // Unknown chart ⇒ null (resolver falls back to sensible default slots).
  const cardTypesConfig = useMemo(() => {
    const chartKey = String(activeChart?.id || '').replace(/^ahd_/, '');
    return settings.chartDisplaySettings?.[chartKey]?.card_types || null;
  }, [activeChart?.id, settings]);

  // Default slots when a card type has no configured slot list (or no config at all).
  const defaultSlotsFor = useCallback((entityType) => (
    entityType === 'astro_aspect' ? ['aspect_short', 'aspect_long'] : ['short_def', 'long_def']
  ), []);
  const layerOn = useCallback((key) => {
    if (!chartLayers) return true;
    return chartLayers[key] ? !!chartLayers[key].enabled : true;
  }, [chartLayers]);

  const astroPills = useMemo(() => {
    const out = [ 'Sun', 'Moon', 'Rising' ];
    if (layerOn('chart_ruler')) out.push('Chart Ruler');
    out.push('North Node');
    if (layerOn('aspects')) out.push('Aspect');
    if (layerOn('house_rulers')) out.push('House Rulers');
    if (layerOn('stelliums')) out.push('Stelliums');
    if (layerOn('moon_phase')) out.push('Moon Phase');
    if (layerOn('chart_shape')) out.push('Chart Shape');
    return out;
  }, [layerOn]);

  const hdPills = useMemo(() => {
    const out = [];
    if (layerOn('type')) out.push('Type');
    if (layerOn('authority')) out.push('Authority');
    if (layerOn('profile')) out.push('Profile');
    if (layerOn('definition')) out.push('Definition');
    if (layerOn('channels')) out.push('Channels');
    out.push('Gates');
    // Circuitry pill removed for now (per design pass 2026-06-16).
    if (layerOn('variables')) out.push('Variables');
    return out;
  }, [layerOn]);
  hdPillsRef.current = hdPills;

  const pills     = mode === 'HD' ? hdPills : astroPills;
  const isTransit = chartData?.isTransit;
  const astroActs = chartData?.birthActivations || {};
  const astroInsights = useMemo( () => {
    if ( !chartData?.birthActivations ) return null;
    const planets = Object.entries( chartData.birthActivations ).map( ( [ name, data ] ) => ( {
      name,
      longitude: data?.longitude,
      sign: data?.sign,
      house: data?.house,
    } ) ).filter( p => typeof p.longitude === 'number' );
    return planets.length ? analyzeAstroInsights( planets ) : null;
  }, [ chartData ] );

  // HD Variables sidebar items. Expects chartData.variables: an array of
  // { arrow:'brain'|'environment'|'motivation'|'perspective', color:1-6,
  //   direction:'left'|'right', tone:1-6 }. Stacks the arrow snippet + the
  // color/direction meaning + the side's tone (design = left arrows, personality =
  // right arrows), matching the reworked variable atoms. Empty until the chart
  // computation provides variables.
  // The chart computes variables as an object keyed by the four arrow positions
  // (digestion / environment / motivation / perspective), each { orientation, color,
  // tone, base }. The seeded entities use arrow key 'brain' for digestion, and stream
  // (design/personality) for tones. Map both shapes (object preferred, array fallback).
  const getHDVariableItems = () => {
    const vars = chartData?.variables;
    if ( !vars || typeof vars !== 'object' ) return [];
    const ARROW_MAP = {
      digestion:   { arrow: 'brain',       stream: 'design' },
      brain:       { arrow: 'brain',       stream: 'design' },
      environment: { arrow: 'environment', stream: 'design' },
      motivation:  { arrow: 'motivation',  stream: 'personality' },
      perspective: { arrow: 'perspective', stream: 'personality' },
    };
    const entries = Array.isArray( vars )
      ? vars.map( v => [ ( v.arrow || v.key || '' ).toLowerCase(), v ] )
      : Object.entries( vars );
    const out = [];
    entries.forEach( ( [ rawKey, v ] ) => {
      const m = ARROW_MAP[ String( rawKey ).toLowerCase() ];
      if ( !m || !v ) return;
      const color = Number( v.color );
      const tone  = Number( v.tone );
      const dir   = String( v.orientation || v.direction || '' ).toLowerCase();
      out.push( { sectionType: 'hd_variables', itemKey: m.arrow, title: `${ rawKey } arrow` } );
      if ( color && ( dir === 'left' || dir === 'right' ) ) {
        out.push( { sectionType: 'hd_variable_colors', itemKey: `${ m.arrow }-c${ color }-${ dir }`, title: `${ rawKey } · color ${ color } ${ dir }` } );
      }
      if ( tone ) {
        out.push( { sectionType: 'hd_variable_tones', itemKey: `${ m.stream }-t${ tone }`, title: `${ m.stream } tone ${ tone }` } );
      }
    } );
    return out;
  };

  // HD Circuitry sidebar items. Expects chartData.activeCircuits: an array of circuit
  // keys (knowing/centering/understanding/sensing/defense/ego/integration). Empty
  // until the chart computation maps active channels → circuits.
  const getHDCircuitItems = () => {
    const circuits = chartData?.activeCircuits;
    if ( !Array.isArray( circuits ) ) return [];
    return circuits
      .map( c => String( c || '' ).toLowerCase().trim() )
      .filter( Boolean )
      .map( c => ( { sectionType: 'hd_circuitry', itemKey: c, title: c.charAt( 0 ).toUpperCase() + c.slice( 1 ) } ) );
  };

  const getAstroPillItems = ( pill ) => {
    const risingSign = astroActs?.Ascendant?.sign;
    const chartRulerName = risingSign ? ({
      Aries: 'Mars',
      Taurus: 'Venus',
      Gemini: 'Mercury',
      Cancer: 'Moon',
      Leo: 'Sun',
      Virgo: 'Mercury',
      Libra: 'Venus',
      Scorpio: 'Pluto',
      Sagittarius: 'Jupiter',
      Capricorn: 'Saturn',
      Aquarius: 'Uranus',
      Pisces: 'Neptune',
    })[ risingSign ] : null;
    const chartRuler = chartRulerName ? astroActs?.[ chartRulerName ] : null;
    const allAspects = ( astroInsights?.allAspects || [] );
    const tightestAspect = allAspects.length ? [ ...allAspects ].sort( ( a, b ) => a.orb - b.orb )[ 0 ] : null;

    // Build a planet item, carrying chart-derived modifiers (currently motion:retrograde)
    // so the sidebar resolver can append the matching rider. Dignity / stellium plug in
    // here once those are computed client-side.
    const planetItem = ( key, title, act ) => ( {
      sectionType: 'astro_planets', itemKey: key, title,
      ...( act?.isRetrograde ? { modifiers: [ { type: 'motion', key: 'retrograde' } ] } : {} ),
    } );

    switch ( pill ) {
      case 'Sun':
        return astroActs?.Sun ? [
          planetItem( 'Sun', 'Sun', astroActs.Sun ),
          astroActs.Sun.sign ? { sectionType: 'astro_signs', itemKey: astroActs.Sun.sign, title: astroActs.Sun.sign } : null,
          astroActs.Sun.house ? { sectionType: 'astro_houses', itemKey: String( astroActs.Sun.house ), title: `House ${ astroActs.Sun.house }` } : null,
        ].filter(Boolean) : [];
      case 'Moon':
        return astroActs?.Moon ? [
          planetItem( 'Moon', 'Moon', astroActs.Moon ),
          astroActs.Moon.sign ? { sectionType: 'astro_signs', itemKey: astroActs.Moon.sign, title: astroActs.Moon.sign } : null,
          astroActs.Moon.house ? { sectionType: 'astro_houses', itemKey: String( astroActs.Moon.house ), title: `House ${ astroActs.Moon.house }` } : null,
        ].filter(Boolean) : [];
      case 'Rising':
        return astroActs?.Ascendant ? [
          { sectionType: 'astro_angles_points', itemKey: 'ASC', title: 'Ascendant' },
          astroActs.Ascendant.sign ? { sectionType: 'astro_signs', itemKey: astroActs.Ascendant.sign, title: astroActs.Ascendant.sign } : null,
          astroActs.Ascendant.house ? { sectionType: 'astro_houses', itemKey: String( astroActs.Ascendant.house ), title: `House ${ astroActs.Ascendant.house }` } : { sectionType: 'astro_houses', itemKey: '1', title: 'House 1' },
        ].filter(Boolean) : [];
      case 'Chart Ruler':
        return chartRuler ? [
          planetItem( chartRulerName, chartRulerName, chartRuler ),
          chartRuler.sign ? { sectionType: 'astro_signs', itemKey: chartRuler.sign, title: chartRuler.sign } : null,
          chartRuler.house ? { sectionType: 'astro_houses', itemKey: String( chartRuler.house ), title: `House ${ chartRuler.house }` } : null,
        ].filter(Boolean) : [];
      case 'North Node':
        return astroActs?.NorthNode ? [
          planetItem( 'NorthNode', 'North Node', astroActs.NorthNode ),
          astroActs.NorthNode.sign ? { sectionType: 'astro_signs', itemKey: astroActs.NorthNode.sign, title: astroActs.NorthNode.sign } : null,
          astroActs.NorthNode.house ? { sectionType: 'astro_houses', itemKey: String( astroActs.NorthNode.house ), title: `House ${ astroActs.NorthNode.house }` } : null,
        ].filter(Boolean) : [];
      case 'Aspect': {
        // Honor the layer's item limit (default 3) for how many aspects to surface.
        const limit = Math.max( 1, Number( chartLayers?.aspects?.limit ) || 1 );
        const top = [ ...allAspects ].sort( ( a, b ) => a.orb - b.orb ).slice( 0, limit );
        if ( !top.length ) return [];
        // Tag each side with distinct synth roles (planet_a/sign_a/house_a · aspect ·
        // planet_b/sign_b/house_b) so the aspect synth template can weave "planet A in
        // sign A {aspect} planet B in sign B" — and houses for the advanced template.
        return top.flatMap( asp => {
          const a1 = astroActs?.[ asp.p1.name ] || {};
          const a2 = astroActs?.[ asp.p2.name ] || {};
          const out = [
            { sectionType: 'astro_aspects', itemKey: asp.aspect.name, title: `${ asp.p1.name } ${ asp.aspect.symbol } ${ asp.p2.name }`, role: 'aspect' },
            { ...planetItem( asp.p1.name, asp.p1.name, a1 ), role: 'planet_a' },
            { ...planetItem( asp.p2.name, asp.p2.name, a2 ), role: 'planet_b' },
          ];
          if ( a1.sign )  out.push( { sectionType: 'astro_signs',  itemKey: String( a1.sign ).toLowerCase(), title: a1.sign, role: 'sign_a' } );
          if ( a2.sign )  out.push( { sectionType: 'astro_signs',  itemKey: String( a2.sign ).toLowerCase(), title: a2.sign, role: 'sign_b' } );
          if ( a1.house ) out.push( { sectionType: 'astro_houses', itemKey: String( a1.house ), title: `House ${ a1.house }`, role: 'house_a' } );
          if ( a2.house ) out.push( { sectionType: 'astro_houses', itemKey: String( a2.house ), title: `House ${ a2.house }`, role: 'house_b' } );
          return out;
        } );
      }
      case 'House Rulers': {
        const ascLong = astroActs?.Ascendant?.longitude;
        if ( ascLong == null ) return [];
        const ascSignIdx = Math.floor( ascLong / 30 );
        const items = [];
        for ( let h = 1; h <= 12; h++ ) {
          const houseSign = SIGNS[ ( ascSignIdx + h - 1 ) % 12 ];
          const rulerName = MODERN_RULERS[ houseSign ];
          const act = astroActs?.[ rulerName ];
          if ( act ) items.push( planetItem( rulerName, `House ${ h } ruler · ${ rulerName }`, act ) );
        }
        return items;
      }
      case 'Moon Phase': {
        // The phase you were born under (moon_phase) + the Moon's sign + house, woven by
        // astro_moon_phase_synth. The set has 6 phase atoms (no crescents), so per Jules
        // the two crescents fold into the adjacent gibbous atom.
        const sun = astroActs?.Sun, moon = astroActs?.Moon;
        if ( !sun || !moon || sun.longitude == null || moon.longitude == null ) return [];
        const ang = ( ( moon.longitude - sun.longitude ) % 360 + 360 ) % 360;
        const key = ang < 22.5 ? 'new'
          : ang < 67.5  ? 'waxing-gibbous'   // waxing crescent → waxing-gibbous (per Jules)
          : ang < 112.5 ? 'first-quarter'
          : ang < 157.5 ? 'waxing-gibbous'
          : ang < 202.5 ? 'full'
          : ang < 247.5 ? 'waning-gibbous'
          : ang < 292.5 ? 'last-quarter'
          : ang < 337.5 ? 'waning-gibbous'   // waning crescent → waning-gibbous (per Jules)
          : 'new';
        const out = [ { sectionType: 'astro_moon_phases', itemKey: key, title: 'Moon Phase', role: 'moon_phase' } ];
        if ( moon.sign )  out.push( { sectionType: 'astro_signs',  itemKey: String( moon.sign ).toLowerCase(), title: moon.sign, role: 'sign' } );
        if ( moon.house ) out.push( { sectionType: 'astro_houses', itemKey: String( moon.house ), title: `House ${ moon.house }`, role: 'house' } );
        return out;
      }
      case 'Stelliums':
        // The sign the planets cluster in (role sign) + each clustered planet (planet_a..d
        // for the synth weave) + the shared house (role house). Lets the stellium synth
        // say what a stellium is, then weave each planet's theme in that sign + house.
        return ( astroInsights?.stelliums || [] ).flatMap( s => {
          const ROLES = [ 'planet_a', 'planet_b', 'planet_c', 'planet_d' ];
          const out = [
            { sectionType: 'astro_stelliums', itemKey: String( s.sign ).toLowerCase(), title: `${ s.sign } Stellium`, role: 'stellium' },
            { sectionType: 'astro_signs', itemKey: String( s.sign ).toLowerCase(), title: s.sign, role: 'sign' }
          ];
          s.planets.slice( 0, ROLES.length ).forEach( ( p, i ) => {
            out.push( { ...planetItem( p.name, p.name, astroActs?.[ p.name ] ), role: ROLES[ i ] } );
          } );
          const h = astroActs?.[ s.planets[0]?.name ]?.house;
          if ( h ) out.push( { sectionType: 'astro_houses', itemKey: String( h ), title: `House ${ h }`, role: 'house' } );
          return out;
        } );
      case 'Chart Shape': {
        const items = [];
        const shape = astroInsights?.chartShape;
        if ( shape && ![ 'Unclassified', 'Mixed' ].includes( shape ) ) {
          items.push( { sectionType: 'astro_chart_patterns', itemKey: shape, title: `Chart Shape · ${ shape }` } );
        }
        ( astroInsights?.patternAlerts || [] ).forEach( a => {
          const m = a.match( /^(Cazimi|Grand Trine|Yod|Grand Cross)/ );
          if ( m ) items.push( { sectionType: 'astro_chart_patterns', itemKey: m[ 1 ], title: m[ 1 ] } );
        } );
        return items;
      }
      default:
        return [];
    }
  };

  const hdFocus = chartData ? (
    isTransit ? {
      label: 'Current Transits', titleLong: 'Global Alignment', big: 'ℛ',
      lede:  'The following channels and gates are currently active in the global transit field.',
    } : {
      label:     `${ chartData.type || 'Human Design' } · ${ chartData.profile || '' } ${ chartData.modality || '' }`,
      titleLong: chartData.type || 'Type',
      big:       `${ chartData.profile || '—' } ${ chartData.modality || '' }`,
      lede:      chartData.strategy
        ? `Your strategy is to ${ chartData.strategy?.toLowerCase() }. ${ chartData.authority ? `Inner authority: ${ chartData.authority }.` : '' }`
        : 'Calculate a chart to see your Human Design reading.',
    }
  ) : { label: 'Human Design', titleLong: 'Bodygraph', big: '—', lede: 'Select a person and press Calculate to generate the bodygraph interpretation.' };

  const astroFocus = {
    label: 'Astrology', titleLong: isTransit ? 'Current Transits' : 'Birth Chart',
    big:  isTransit ? 'ℛ' : '♒',
    lede: isTransit ? 'Current planetary positions and retrograde status.' : 'Natal chart astrology interpretation will appear here.',
  };

  const focus = mode === 'HD' ? hdFocus : astroFocus;

  const activeDefinitions = useMemo(() => {
    if (loadingDefs || !definitions.length) return [];

    // If we have selected items from an interaction
    if (selectedItems.length > 0) {
        return resolveDefinitions(definitions, selectedItems.map(si => ({ sectionType: si.sectionType, itemKey: si.itemKey })));
    }

    // Otherwise, use the active pill
    const pill = pills[activePill];
    let items = [];

    if (mode === 'HD') {
      switch (pill) {
        case 'Type':        items.push({ sectionType: 'hd_types', itemKey: chartData?.type }); break;
        case 'Authority':   items.push({ sectionType: 'hd_authorities', itemKey: chartData?.authority }); break;
        case 'Profile':     items.push({ sectionType: 'hd_profiles', itemKey: `${chartData?.profile}-${chartData?.modality}` }); break;
        case 'Definition':  items.push({ sectionType: 'hd_definition_types', itemKey: chartData?.definitionType }); break;
        case 'Variables':   items = getHDVariableItems(); break;
        case 'Circuitry':   items = getHDCircuitItems(); break;
      }
    } else {
        items = getAstroPillItems( pill );
    }

    if (items.length > 0) {
        return resolveDefinitions(definitions, items);
    }

    return [];
  }, [definitions, selectedItems, mode, activePill, chartData, loadingDefs]);

  // Reset the placement switcher whenever the selection changes.
  useEffect(() => {
    setGatePlacements([]);
    setActivePlacementKey('');
  }, [selectedItems]);

  useEffect(() => {
    if (loadingDefs) return;

    let items = [];
    if (selectedItems.length > 0) {
      items = selectedItems;
    } else {
      const pill = pills[activePill];
      if (mode === 'HD') {
        switch (pill) {
          case 'Type':
            if (chartData?.type) items.push({ sectionType: 'hd_types', itemKey: chartData.type, title: `Type — ${chartData.type}` });
            break;
          case 'Authority':
            if (chartData?.authority) items.push({ sectionType: 'hd_authorities', itemKey: chartData.authority, title: `Authority — ${chartData.authority}` });
            break;
          case 'Profile':
            if (chartData?.profile) items.push({ sectionType: 'hd_profiles', itemKey: `${chartData.profile}-${chartData.modality}`, title: `Profile ${chartData.profile || ''}${chartData.modality ? ' · ' + chartData.modality : ''}`.trim() });
            break;
          case 'Definition':
            if (chartData?.definitionType) items.push({ sectionType: 'hd_definition_types', itemKey: chartData.definitionType, title: `Definition — ${chartData.definitionType}` });
            break;
          case 'Variables':
            items = getHDVariableItems();
            break;
          case 'Circuitry':
            items = getHDCircuitItems();
            break;
        }
      } else {
        items = getAstroPillItems(pill);
      }
    }

    if (!items.length) {
      setCoreResolution(null);
      setComposedBoxes(null);
      setResolving(false);
      return;
    }

    // Assemble the entity BUNDLE for the synth. Planet-row clicks already arrive as a
    // full bundle (planet + gate + line + sign + house). A bare bodygraph GATE click
    // arrives as just the gate, so rebuild its bundle from the chart activations.
    // When the gate is active in MORE THAN ONE placement (personality + design, or
    // two bodies), each placement gets its own bundle behind a placement switcher —
    // one synth per placement, so the woven reading never mushes placements together.
    const LINK_EXCLUDED = ['Chiron', 'Lilith'];
    const bundle = [...items];
    const seen = new Set(items.map(i => `${i.sectionType}:${i.itemKey}`));
    const addItem = (sectionType, itemKey, title) => {
      if (itemKey === undefined || itemKey === null || itemKey === '') return;
      const dedupe = `${sectionType}:${String(itemKey).toLowerCase()}`;
      if (seen.has(dedupe)) return;
      seen.add(dedupe);
      bundle.push({ sectionType, itemKey: String(itemKey), title });
    };

    let placements = [];
    items.forEach(item => {
      if (item.sectionType === 'hd_gates') {
        const gid = parseInt(item.itemKey, 10);
        [['Personality', chartData?.birthActivations], ['Design', chartData?.designActivations]].forEach(([side, acts]) => {
          Object.entries(acts || {}).forEach(([name, a]) => {
            if (a && Number(a.gate) === gid && !LINK_EXCLUDED.includes(name)) {
              placements.push({
                key: `${side.toLowerCase()}-${String(name).toLowerCase()}`,
                side, planet: name, act: a,
              });
            }
          });
        });
      }
    });

    // Sync the switcher options; pick (or keep) the active placement.
    const activeKey = placements.find(p => p.key === activePlacementKey)?.key || placements[0]?.key || '';
    setGatePlacements(placements.map(({ key, side, planet }) => ({ key, side, planet })));
    if (activeKey !== activePlacementKey) setActivePlacementKey(activeKey);

    // Fold ONLY the active placement's pieces into the bundle.
    const active = placements.find(p => p.key === activeKey);
    if (active) {
      const { side, planet, act } = active;
      addItem('astro_planets', planet, `${side} ${planet}`);
      if (act.line) addItem('hd_lines', String(act.line), `Line ${act.line}`);
      if (act.sign) addItem('astro_signs', String(act.sign).toLowerCase(), act.sign);
      if (act.house) addItem('astro_houses', String(act.house), `House ${act.house}`);
      // Angel-by-degree: the Shem angel governing this placement's longitude.
      const angel = getAngelOverlay(act.longitude);
      if (angel) addItem('angel_shem', `shem_${String(angel.index).padStart(2, '0')}`, angel.name);
    }

    // Refs + roles for the synth template and for targeting standalone boxes.
    const bundleEntities = bundle
      .map(item => {
        const ref = sectionItemToEntityRef(item.sectionType, item.itemKey);
        if (!ref) return null;
        const entityType = ref.split(':')[1];
        // `role` (base, from entity type) drives standalone-box targeting; `explicitRole`
        // (planet_a / sign_b …, set by the dispatch) is the synth-template weave role.
        return { ref, entityType, role: ROLE_OF_ENTITY_TYPE[entityType] || entityType, explicitRole: item.role || null, label: item.title || item.itemKey };
      })
      .filter(Boolean);
    if (!bundleEntities.length) {
      setCoreResolution(null);
      setComposedBoxes(null);
      setResolving(false);
      return;
    }
    // Send pieces carrying an explicit synth role as objects (so the resolver weaves
    // them distinctly, e.g. both planets of an aspect); plain pieces stay compact refs.
    const activeEntities = bundleEntities.map(e => {
      if (!e.explicitRole) return e.ref;
      const [module_id, entity_type, entity_key] = e.ref.split(':');
      return { module_id, entity_type, entity_key, role_key: e.explicitRole };
    });

    // The clicked card's composition decides what renders: synth template +
    // ordered standalone boxes. Legacy fallbacks keep older charts working.
    // Composition precedence for one entity_type: Chart-Maker preset → core
    // Charts-admin card_types (template→synth, selected non-fragment slots→
    // standalone boxes on the card's own piece) → built-in default. `hasOwn`
    // means it carries a real synth/boxes (not the empty fallback).
    const resolveCompFor = (type) => {
      if (!type) return { composition: null, hasOwn: false };
      const presetComp = presetCards?.[type];
      if (presetComp && (presetComp.synth || (presetComp.boxes || []).length)) {
        return { composition: presetComp, hasOwn: true };
      }
      const cardCfg = cardTypesConfig?.[type] || null;
      if (cardCfg && (cardCfg.template || (cardCfg.slots || []).length)) {
        const role = ROLE_OF_ENTITY_TYPE[type] || 'bundle';
        return {
          composition: {
            synth: cardCfg.template || undefined,
            boxes: (cardCfg.slots || []).map((s) => ({ id: `ct-${type}-${s}`, kind: 'slot', key: s, target: role, style: 'auto' })),
          },
          hasOwn: true,
        };
      }
      const fallback = compositionFor(type);
      return { composition: fallback, hasOwn: !!(fallback && (fallback.synth || (fallback.boxes || []).length)) };
    };

    // Composite facets (Stelliums, Aspect, Moon Phase, Chart Shape) map to their OWN
    // card key so they use a dedicated synth/box config instead of collapsing onto the
    // first planet/sign in the bundle. This is keyed off the active astro pill.
    const FACET_CARD_KEY = {
      Aspect: 'astro_aspect', Stelliums: 'astro_stellium',
      'Moon Phase': 'astro_moon_phase', 'Chart Shape': 'astro_chart_pattern',
    };
    let primaryType = '';
    let composition = null;
    const facetCardKey = FACET_CARD_KEY[pills[activePill]];
    if (facetCardKey) {
      const r = resolveCompFor(facetCardKey);
      if (r.hasOwn) { primaryType = facetCardKey; composition = r.composition; }
    }
    // Otherwise pick the composition from the first clicked item whose entity_type
    // actually has one — a gate-column row leads with hd_planets (a legacy type with no
    // card), so we skip past it to hd_gate so its synth resolves, exactly like a
    // bodygraph gate click.
    if (!primaryType) {
      for (const it of items) {
        const t = SECTION_TO_ENTITY_TYPE[it.sectionType] || '';
        const r = resolveCompFor(t);
        if (r.hasOwn) { primaryType = t; composition = r.composition; break; }
      }
    }
    if (!primaryType) {
      primaryType = SECTION_TO_ENTITY_TYPE[items[0]?.sectionType] || '';
      composition = resolveCompFor(primaryType).composition;
    }

    const chartKey = String(activeChart?.id || '').replace(/^ahd_/, '');
    const sidebarTemplate = settings.chartDisplaySettings?.[chartKey]?.sidebar_template || '';
    // Synth box ONLY when a template is explicitly provided: composition.synth, or —
    // when there's no composition at all — the legacy chart sidebar template. A
    // composition with boxes but no synth renders boxes only (no broken placement weave).
    const synthTemplate = composition ? (composition.synth || undefined) : (sidebarTemplate || undefined);
    const wantSynth = !!synthTemplate;

    let cancelled = false;
    const preset = activeChart?.coreChartPreset || null;
    const chartContext = activeChart?.chart_type === 'combined' || activeChart?.id === 'ahd_combined' ? 'combined' : (mode === 'Astro' ? 'astrology_only' : 'hd_only');
    const setId = preset?.set_id || undefined;

    // A box's effective targets: explicit `targets` (checkbox selection) wins,
    // else the single legacy `target`. 'bundle' = every piece.
    const boxes = (composition && composition.boxes) || [];
    const boxTargets = (box) => (box.targets && box.targets.length ? box.targets : [box.target]);
    const entitiesForTarget = (box) => (
      bundleEntities.filter(e => boxTargets(box).some(t => t === 'bundle' || t === e.role))
    );

    const slotJobs = [];   // entities for one resolveCardGroups batch
    const slotMap = [];    // parallel: which box each entity-job belongs to
    const templateJobs = []; // [{ box, payload }]
    boxes.forEach(box => {
      const targets = entitiesForTarget(box);
      if (!targets.length) return;
      if (box.kind === 'slot') {
        targets.forEach(e => {
          slotJobs.push({ ref: e.ref, label: e.label, sectionType: e.entityType, slots: [box.key] });
          slotMap.push(box);
        });
      } else {
        templateJobs.push({
          box,
          payload: {
            set_id: setId,
            module_id: 'luna-astrohd',
            output_context: 'full_sidebar',
            template_key: box.key,
            active_entities: targets.map(e => e.ref),
            chart_context: chartContext,
          }
        });
      }
    });

    const synthPayload = {
      set_id: setId,
      module_id: 'luna-astrohd',
      output_context: 'full_sidebar',
      chart_preset_key: preset?.preset_key || 'astrology_basic_sidebar',
      template_key: synthTemplate,
      active_entities: activeEntities,
      chart_context: chartContext,
    };

    // Check caches synchronously to avoid screen flickers/loaders
    let cachedSynth = null;
    if (wantSynth && setId) {
      cachedSynth = getCoreDefinitionCache(synthPayload);
    }
    let cachedSlotGroups = null;
    if (slotJobs.length && setId) {
      cachedSlotGroups = getCardGroupsCache(slotJobs, { set_id: setId });
    }
    let allCachedTemplatesMatch = true;
    const cachedTemplateResults = [];
    if (setId) {
      for (const job of templateJobs) {
        const cachedTpl = getCoreDefinitionCache(job.payload);
        if (cachedTpl) {
          cachedTemplateResults.push(cachedTpl);
        } else {
          allCachedTemplatesMatch = false;
          break;
        }
      }
    } else {
      allCachedTemplatesMatch = false;
    }

    const isSynthCached = !wantSynth || (wantSynth && cachedSynth);
    const isSlotsCached = !slotJobs.length || (slotJobs.length && cachedSlotGroups);
    const isTemplatesCached = !templateJobs.length || allCachedTemplatesMatch;

    if (isSynthCached && isSlotsCached && isTemplatesCached && setId) {
      // Reassemble in composition order synchronously without flicker!
      const byBox = new Map();
      if (cachedSlotGroups) {
        cachedSlotGroups.forEach((g, i) => {
          const box = slotMap[i];
          if (!box || !g?.boxes?.length) return;
          const list = byBox.get(box.id) || [];
          g.boxes.forEach(b => list.push({ box, value: b.value, pieceLabel: g.label }));
          byBox.set(box.id, list);
        });
      }
      templateJobs.forEach((j, i) => {
        const r = cachedTemplateResults[i];
        if (r?.rendered_text) byBox.set(j.box.id, [{ box: j.box, value: r.rendered_text }]);
      });
      const ordered = boxes.flatMap(b => byBox.get(b.id) || []);
      setCoreResolution(cachedSynth);
      setComposedBoxes(ordered.length ? ordered : ((boxes.length || presetCards !== null) ? [] : null));
      setResolving(false);
      return () => { cancelled = true; };
    }

    // Clear the previous card's result so the skeleton shows during the fetch — gives
    // a loading beat between card clicks instead of stale content lingering.
    setCoreResolution(null);
    setComposedBoxes(null);
    setResolving(true);

    // 1) Synth: weave the whole bundle through the composition's template (when set).
    const synthPromise = wantSynth ? resolveCoreDefinition(synthPayload) : Promise.resolve(null);

    // 2) Standalone template boxes
    const slotsPromise = slotJobs.length
      ? resolveCardGroups(slotJobs, { set_id: setId }).catch(() => [])
      : Promise.resolve([]);

    const templatePromises = templateJobs.map(j => resolveCoreDefinition(j.payload).catch(() => null));

    Promise.all([synthPromise.catch(() => null), slotsPromise, Promise.all(templatePromises)])
      .then(([synthResult, slotGroups, templateResults]) => {
        if (cancelled) return;
        // Reassemble in composition order: slot groups come back index-aligned
        // with slotJobs; template results align with templateJobs.
        const byBox = new Map();
        slotGroups.forEach((g, i) => {
          const box = slotMap[i];
          if (!box || !g?.boxes?.length) return;
          const list = byBox.get(box.id) || [];
          g.boxes.forEach(b => list.push({ box, value: b.value, pieceLabel: g.label }));
          byBox.set(box.id, list);
        });
        templateJobs.forEach((j, i) => {
          const r = templateResults[i];
          if (r?.rendered_text) byBox.set(j.box.id, [{ box: j.box, value: r.rendered_text }]);
        });
        const ordered = boxes.flatMap(b => byBox.get(b.id) || []);
        setCoreResolution(synthResult);
        // A configured composition OWNS the box list — even when its boxes
        // resolve empty, suppress the legacy preset display_boxes ([] not null)
        // so the card shows exactly what was composed, nothing more.
        setComposedBoxes(ordered.length ? ordered : ((boxes.length || presetCards !== null) ? [] : null));
        setResolving(false);
      });

    return () => { cancelled = true; };
  }, [selectedItems, mode, activePill, activeChart?.id, activeChart?.chartPresetKey, loadingDefs, chartData, cardTypesConfig, presetCards, compositionFor, activePlacementKey]);

  const selectPillElement = (pill, currentMode) => {
    // Clear selected items when switching pills so we show the default for that pill
    setSelectedItems([]);
    
    let items = [];
    if (currentMode === 'HD') {
      switch (pill) {
        case 'Type':        items.push({ sectionType: 'hd_types', itemKey: chartData?.type, title: chartData?.type ? `Type — ${chartData.type}` : 'Type' }); break;
        case 'Authority':   items.push({ sectionType: 'hd_authorities', itemKey: chartData?.authority, title: chartData?.authority ? `Authority — ${chartData.authority}` : 'Authority' }); break;
        case 'Profile':     items.push({ sectionType: 'hd_profiles', itemKey: `${chartData?.profile}-${chartData?.modality}`, title: `Profile ${chartData?.profile || ''}${chartData?.modality ? ' · ' + chartData.modality : ''}`.trim() }); break;
        case 'Definition':  items.push({ sectionType: 'hd_definition_types', itemKey: chartData?.definitionType, title: chartData?.definitionType ? `Definition — ${chartData.definitionType}` : 'Definition' }); break;
        case 'Variables':   items = getHDVariableItems(); break;
      }
    } else {
        items = getAstroPillItems( pill );
    }

    if (items.length > 0) {
        setSelectedItems(items);
    }
  };

  const interpretationSections = useMemo(() => {
    if (!activeDefinitions.length) return [];
    
    return activeDefinitions.map(def => {
        const text = def.long_text || def.short_text;
        if (!text) return null;
        return {
            title: def.title,
            ...parseDefinitionMarkdown(text)
        };
    }).filter(s => s !== null);
  }, [activeDefinitions]);

  // Whether the per-card-type resolver produced any labeled boxes to show.
  // Synth (woven template text), composed boxes, and/or legacy display boxes.
  const hasSynth = !!(
    (coreResolution &&
      (coreResolution.rendered_text ||
        coreResolution.visible_slots?.length > 0 ||
        coreResolution.display_boxes?.length > 0)) ||
    (composedBoxes && composedBoxes.length)
  );

  const getRetrogrades = ( acts ) => {
    if ( !acts ) return 'None';
    const list = Object.entries( acts ).filter( ( [ , a ] ) => a?.isRetrograde ).map( ( [ name ] ) => name ).join( ', ' );
    return list || 'None';
  };
  const kvPairs = mode === 'HD' && chartData ? (
    isTransit ? [
      [ 'Active',     'Current Transits' ],
      [ 'Channels',   chartData.activeChannels?.join( ', ' ) || 'None' ],
      [ 'Retrograde', getRetrogrades( chartData.birthActivations ) ],
    ] : [
      [ 'Type',       chartData.type           || '—' ],
      [ 'Strategy',   chartData.strategy       || '—' ],
      [ 'Authority',  chartData.authority      || '—' ],
      [ 'Profile',    `${ chartData.profile || '—' } ${ chartData.modality || '' }` ],
      [ 'Definition', chartData.definitionType || '—' ],
      [ 'Inc. Cross', chartData.incarnationCross?.name || '—' ],
    ]
  ) : [
    [ 'Sun',        chartData?.birthActivations?.Sun?.sign || '—' ],
    [ 'Moon',       chartData?.birthActivations?.Moon?.sign || '—' ],
    [ 'Ascendant',  chartData?.birthActivations?.Ascendant?.sign || '—' ],
    [ 'Retrograde', getRetrogrades( chartData?.birthActivations ) ],
  ];

  if (activeChart?.id === 'ahd_asteroids') {
    return <AsteroidPanel chartData={chartData} />;
  }

  return (
    <div className="space-y-0 pb-20">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          {/* Sidebar header matches the chart's own title; system shown as kicker. */}
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 2 }}>
            { mode === 'HD' ? 'Human Design' : 'Astrology' }
          </div>
          <h3 className="text-[14px] font-semibold text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
            { activeChart?.label || ( mode === 'HD' ? 'Human Design' : 'Astrology' ) }
          </h3>
        </div>
        { showToggle && (
          // Flat editorial toggle (design-kit style): label / label, active underlined — no pills.
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            { [ 'HD', 'Astro' ].map( ( m, idx ) => (
              <span key={ m } style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                { idx > 0 && <span style={{ color: 'var(--hair)', fontSize: 13 }}>/</span> }
                <button onClick={ () => { setMode( m ); setActivePill( 0 ); setSelectedItems([]); } }
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 2px',
                    fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15,
                    color: mode === m ? 'var(--ink)' : 'var(--mute)',
                    borderBottom: mode === m ? '1.5px solid var(--ink)' : '1.5px solid transparent',
                  }}>{ m }</button>
              </span>
            ) ) }
          </div>
        ) }
      </div>

      {/* Editorial underline tabs (design-kit .facet-tabs) in place of square pills. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 16, borderBottom: '1px solid var(--hair)' }}>
        { pills.map( ( p, i ) => (
          <button key={ p } onClick={ () => { setActivePill( i ); selectPillElement(p, mode); } }
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', marginBottom: -1,
              fontFamily: 'var(--font-display)', fontSize: 15.5, whiteSpace: 'nowrap',
              color: activePill === i ? 'var(--ink)' : 'var(--mute)',
              borderBottom: activePill === i ? '2px solid var(--ink)' : '2px solid transparent',
            }}>{ p }</button>
        ) ) }
      </div>

      <div style={{ padding: '14px 16px', background: 'var(--card)', border: '1px solid var(--hair)', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>
                { selectedItems.length > 0 ? selectedItems.map(si => si.title).join(' · ') : focus.label }
            </div>
            {selectedItems.length > 0 && (
                <button 
                    onClick={() => setSelectedItems([])}
                    style={{ background: 'none', border: 'none', color: 'var(--mute)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', padding: 0 }}
                >
                    { (pills[activePill] === 'Channels' || pills[activePill] === 'Gates') ? '← Back to list' : '← Back' }
                </button>
            )}
        </div>
        
        {loadingDefs ? (
            <div style={{ fontSize: 11, color: 'var(--mute)', fontStyle: 'italic' }}>Loading interpretation...</div>
        ) : (pills[activePill] === 'Gates' && selectedItems.length === 0) ? (
            <div style={{ fontSize: 11, color: 'var(--mute)', fontStyle: 'italic', padding: '10px 0' }}>
                Click any gate or planet card in the chart to see its coaching insights here.
            </div>
        ) : (pills[activePill] === 'Channels' && selectedItems.length === 0) ? (
            <div className="space-y-3 mt-4">
                <p style={{ fontSize: 11, color: 'var(--mute)', fontStyle: 'italic' }}>Your active channels:</p>
                {chartData?.activeChannels && chartData.activeChannels.length > 0 ? chartData.activeChannels.map((ch, idx) => (
                    <div key={idx} 
                        onClick={() => window.dispatchEvent(new CustomEvent('astrohd:select-element', { detail: { sectionType: 'hd_channels', itemKey: ch, title: `Channel ${ch}` } }))}
                        style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--hair)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                        Channel {ch}
                    </div>
                )) : <div style={{ fontSize: 11, color: 'var(--mute)' }}>No active channels.</div>}
            </div>
        ) : resolving && !hasSynth ? (
            // Loading skeleton — avoids the "not found" flash while the resolver is in flight.
            <div className="mt-4"><BoxSkeleton count={2} /></div>
        ) : hasSynth ? (
            <div className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Placement switcher — when the clicked gate is active in several placements. */}
                <PlacementSwitcher options={gatePlacements} activeKey={activePlacementKey} onSelect={setActivePlacementKey} />
                {/* Synth box — the woven placement reading from the card's composition template. */}
                {coreResolution?.rendered_text && <SynthBox text={coreResolution.rendered_text} />}
                {/* Composed standalone boxes (the card's configured boxes, in order). */}
                {(composedBoxes || []).map((cb, i) => (
                    <SlotBox key={`${cb.box.id}-${i}`} slotKey={cb.box.key}
                        value={cb.value}
                        label={cb.box.label || (cb.pieceLabel ? `${slotLabel(cb.box.key)} of ${cb.pieceLabel}` : undefined)}
                        style={cb.box.style} />
                ))}
                {/* Legacy preset display boxes — only when the card has no composed boxes. */}
                {!composedBoxes && (coreResolution?.display_boxes || []).map((box, i) => (
                    <SlotBox key={`${box.slot_key}-${box.entry_key}-${i}`} slotKey={box.slot_key} value={box.value} />
                ))}
            </div>
        ) : activeDefinitions.length > 0 ? (
            <div className="space-y-6 mt-4">
                {/* Essence fallback — when the per-card-type resolver produced no boxes
                    (no slots authored for this element in the active set yet). Surface
                    the short_def essence so the panel is never empty. */}
                {activeDefinitions.map((def, idx) => (
                    <div key={idx} style={{ marginBottom: 24, paddingBottom: 20, borderBottom: idx < activeDefinitions.length - 1 ? '1px solid var(--hair)' : 'none' }}>
                        <h3 style={{ margin: '0 0 10px', fontSize: 16, fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--ink)' }}>{def.title}</h3>
                        {def.short_text ? (
                            <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6, fontStyle: 'italic', opacity: 0.85 }}>{def.short_text}</p>
                        ) : (
                            <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--mute)', fontStyle: 'italic', padding: '20px', border: '1px dashed var(--hair)', textAlign: 'center', background: 'rgba(0,0,0,0.01)' }}>
                                { def.section_type === 'hd_incarnation_crosses' ? (
                                    <div className="space-y-3">
                                        <p>Your specific incarnation cross definition hasn't been created yet for this set.</p>
                                        { customerServiceEmail && (
                                            <p><a href={`mailto:${customerServiceEmail}?subject=Incarnation Cross Definition Request: ${def.title}`} style={{ color: 'var(--indigo)', fontWeight: 700, textDecoration: 'none' }}>Email us to have it completed →</a></p>
                                        )}
                                    </div>
                                ) : (
                                    "No synthesis written for this element in the current set yet."
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        ) : (selectedItems.length > 0 && selectedItems[0].sectionType === 'hd_incarnation_crosses') ? (
            <div style={{ padding: '20px', background: 'var(--card)', border: '1px solid var(--hair)', marginBottom: 12 }}>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>Incarnation Cross</div>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--ink)' }}>{selectedItems[0].title || selectedItems[0].itemKey}</h3>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--mute)', fontStyle: 'italic', padding: '20px', border: '1px dashed var(--hair)', textAlign: 'center', background: 'rgba(0,0,0,0.01)' }}>
                    <div className="space-y-3">
                        <p>Your specific incarnation cross definition hasn't been created yet for this set.</p>
                        { customerServiceEmail && (
                            <p><a href={`mailto:${customerServiceEmail}?subject=Incarnation Cross Definition Request: ${selectedItems[0].title || selectedItems[0].itemKey}`} style={{ color: 'var(--indigo)', fontWeight: 700, textDecoration: 'none' }}>Email us to have it completed →</a></p>
                        )}
                    </div>
                </div>
            </div>
        ) : (
            <>
                <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 17, lineHeight: 1.15, color: 'var(--ink)', marginBottom: 8, marginTop: 8 }}>
                    { focus.titleLong }
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 300, lineHeight: 1, color: 'var(--indigo)', marginBottom: 8, letterSpacing: '-0.02em' }}>
                { focus.big }
                </div>
                <div style={{ fontSize: 11, color: 'var(--mute)', lineHeight: 1.6, fontStyle: 'italic' }}>
                { focus.lede }
                </div>
            </>
        )}
      </div>

      <div style={{ padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--hair)', fontSize: 11, color: 'var(--mute)', lineHeight: 1.7, marginBottom: 12 }}>
        <p>Click any gate, center, or cross-point on the bodygraph to focus this panel on that element. Tabs above switch between <em>Human Design</em> and <em>Astrology</em> views.</p>
      </div>

      <div style={{ border: '1px solid var(--hair)', marginBottom: 12 }}>
        { kvPairs.map( ( [ k, v ], i ) => (
          <div key={ k } style={{ display: 'grid', gridTemplateColumns: '90px 1fr', borderTop: i > 0 ? '1px solid var(--hair)' : 'none', fontSize: 11 }}>
            <div style={{ padding: '8px 12px', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', background: 'var(--card)' }}>{ k }</div>
            <div style={{ padding: '8px 12px', color: 'var(--ink)', borderLeft: '1px solid var(--hair)' }}>{ v }</div>
          </div>
        ) ) }
      </div>

    </div>
  );
}

// ─── AstroHDCenterPane ────────────────────────────────────────────────────────

/** Decode a preset row's ChartConfig (config_json may arrive as a JSON string). */
function presetRowConfig( preset ) {
  let raw = preset?.config_json ?? preset?.config ?? null;
  if ( typeof raw === 'string' ) {
    try { raw = JSON.parse( raw ); } catch { raw = null; }
  }
  return raw && typeof raw === 'object' && Object.keys( raw ).length ? normalizeChartConfig( raw ) : null;
}

/**
 * Config-driven renderer for Chart Maker preset charts — mirrors the maker's
 * live preview exactly: NatalView (always mounted, it computes the chart data)
 * honoring sections/layers, DualWheelView for the astrology side, tabs when
 * scope = both. This is what makes a saved preset actually LOOK like what was
 * composed in the maker, instead of falling back to a bare default view.
 */
function PresetChartExperience( { ahd, viewProps } ) {
  const charts = window.LunaCcoAstroHDCharts;
  const [ config, setConfig ] = useState( () => presetRowConfig( ahd.coreChartPreset ) );
  const [ chartData, setChartData ] = useState( null );
  const [ tab, setTab ] = useState( 'hd' );

  // If the injected preset row didn't carry config_json, fetch it.
  useEffect( () => {
    if ( config ) return;
    let cancelled = false;
    loadChartConfig( ahd.chartPresetKey, ahd.coreChartPreset?.set_id )
      .then( ( cfg ) => { if ( ! cancelled && cfg ) setConfig( cfg ); } )
      .catch( () => {} );
    return () => { cancelled = true; };
  }, [ ahd.id ] ); // eslint-disable-line react-hooks/exhaustive-deps

  const NatalViewComp = charts?.NatalView;
  const DualWheelComp = charts?.DualWheelView;
  if ( ! config || ! NatalViewComp || ! DualWheelComp ) {
    return (
      <div className="flex-1 flex items-center justify-center opacity-40">
        <p className="text-sm italic" style={{ fontFamily: 'var(--font-display)' }}>Loading chart preset…</p>
      </div>
    );
  }

  const scope = config.scope || 'both';
  const hdVisible    = scope === 'hd'    || ( scope === 'both' && tab === 'hd' );
  const astroVisible = scope === 'astro' || ( scope === 'both' && tab === 'astro' );

  const handleChartReady = ( data ) => {
    setChartData( data );
    viewProps.onChartReady && viewProps.onChartReady( data );
  };

  return (
    <div data-astrohd-chart-pane className="flex-1 min-h-0 overflow-y-auto" style={{ padding: '0 4px', position: 'relative' }}>
      <ChartDownloadButton filename={ `${ viewProps.profileIdentity?.full_name || viewProps.profileIdentity?.display_name || 'Chart' } - ${ config.title || ahd.label }` } />
      {/* Editorial chart masthead — the preset's own title, matching the sidebar. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, padding: '14px 16px 10px', borderBottom: '1px solid var(--hair)', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--gold)' }}>
            { scope === 'hd' ? 'Human Design' : scope === 'astro' ? 'Astrology' : 'Human Design · Astrology' }
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: 'var(--ink)', margin: '2px 0 0' }}>
            { config.title || ahd.label }
          </h2>
        </div>
        { scope === 'both' && (
          <div style={{ display: 'flex', gap: 4, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid var(--hair)', borderRadius: 20, padding: 3 }}>
            { [ [ 'hd', 'Human Design' ], [ 'astro', 'Astrology' ] ].map( ( [ k, label ] ) => (
              <button key={ k } onClick={ () => setTab( k ) }
                style={{ border: 'none', background: tab === k ? 'var(--ink)' : 'transparent', color: tab === k ? 'var(--btn-fg, white)' : 'var(--mute)', borderRadius: 17, padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                { label }
              </button>
            ) ) }
          </div>
        ) }
      </div>

      {/* HD view: always mounted — it computes the chart data the astro side needs.
          `embedded` disables the view's own inner scroll so this preset experience is
          the single scroll container (no double scrollbars). */}
      <div style={{ display: hdVisible ? 'block' : 'none' }}>
        <NatalViewComp
          key={ viewProps.personKey }
          initialDate={ viewProps.birthdate }
          initialTime={ viewProps.birthTime }
          initialLat={ viewProps.birthLat }
          initialLng={ viewProps.birthLng }
          initialTimezone={ viewProps.birthTimezone }
          triggerCalc={ viewProps.triggerCalc }
          onChartReady={ handleChartReady }
          people={ viewProps.people }
          profileIdentity={ viewProps.profileIdentity }
          isMyself={ viewProps.isMyself }
          gateChartType={ viewProps.gateChartType }
          gatePresetKey={ viewProps.gatePresetKey }
          config={ config }
          embedded
        />
      </div>

      { astroVisible && ! chartData && (
        <p style={{ color: 'var(--mute)', fontStyle: 'italic', padding: '18px 16px' }}>Computing chart…</p>
      ) }
      { astroVisible && chartData && (
        <DualWheelComp chartData={ chartData } config={ config } profileIdentity={ viewProps.profileIdentity } embedded />
      ) }
    </div>
  );
}

export function AstroHDCenterPane( { chartTypeId, birthdate, birthTime, birthLat, birthLng, birthTimezone, personKey, triggerCalc, onChartReady, people, profileIdentity, isMyself } ) {
  const charts = window.LunaCcoAstroHDCharts;
  const ahd    = getAstroHDChartTypes().find( t => t.id === chartTypeId );

  if ( !charts || !ahd ) {
    return (
      <div className="flex-1 flex items-center justify-center opacity-40">
        <p className="text-sm italic" style={{ fontFamily: 'var(--font-display)' }}>Human Design module not loaded.</p>
      </div>
    );
  }

  // Resolve the bare settings key the server credit gate expects for THIS chart,
  // so premium / admin_only is enforced against the selected chart rather than the
  // inner engine view (which historically hardcoded 'natal' for every astro view).
  let gateBaseId = ahd.id;
  if ( ahd.coreChartPreset && ahd.chart_type ) {
    gateBaseId = PRESET_BASE_TYPES[ ahd.chart_type ] || 'ahd_combined';
  }
  const gateChartType = String( gateBaseId ).replace( /^ahd_/, '' );

  // Preset charts (chart-maker charts) are gated/charged by their own preset_key
  // (premium config lives on the definition-engine preset). Built-in charts pass none.
  const gatePresetKey = ahd.chartPresetKey || ahd.coreChartPreset?.preset_key || null;

  const viewProps = { birthdate, birthTime, birthLat, birthLng, birthTimezone, personKey, triggerCalc, onChartReady, people, profileIdentity, isMyself, gateChartType, gatePresetKey };

  // Chart Maker preset charts render the config-driven experience (the same
  // pairing the maker previews). Transit/connection-style presets keep their
  // specialised base view but still receive the config.
  const presetConfig = ahd.coreChartPreset ? presetRowConfig( ahd.coreChartPreset ) : null;
  const specialised = [ 'transit', 'transit_birth', 'connection', 'asteroids' ].includes( ahd.chart_type );
  if ( ahd.coreChartPreset && ! specialised ) {
    // key={ahd.id} forces a fresh mount when switching between preset charts so
    // the held `config` state re-initialises from the newly selected preset
    // (otherwise switching A→B kept A's config until a default chart remounted).
    return <PresetChartExperience key={ ahd.id } ahd={ ahd } viewProps={ viewProps } />;
  }

  const ViewComponent = charts[ ahd.viewKey ];
  if ( !ViewComponent ) return null;

  return (
    <div data-astrohd-chart-pane className="flex-1 min-h-0 overflow-hidden" style={{ position: 'relative' }}>
      <ChartDownloadButton filename={ `${ profileIdentity?.full_name || profileIdentity?.display_name || 'Chart' } - ${ ahd.label }` } />
      <ViewComponent
        key={ personKey }
        initialDate={ birthdate }
        initialTime={ birthTime }
        initialLat={ birthLat }
        initialLng={ birthLng }
        initialTimezone={ birthTimezone }
        triggerCalc={ triggerCalc }
        onChartReady={ onChartReady }
        people={ people }
        profileIdentity={ profileIdentity }
        isMyself={ isMyself }
        gateChartType={ gateChartType }
        gatePresetKey={ gatePresetKey }
        config={ presetConfig || undefined }
      />
    </div>
  );
}
