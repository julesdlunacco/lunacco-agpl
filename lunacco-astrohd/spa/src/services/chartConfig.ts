/**
 * chartConfig.ts
 *
 * Single source of truth for the modular Chart Maker configuration.
 *
 * A `ChartConfig` is exactly the shape stored in the core Definition Engine
 * `chart_presets.config_json` column. It describes BOTH the visual layers of a
 * chart (which centers / gates / arrows / wheels / asteroids / aspects / graphs
 * show) and the editorial sidebar composition (which definition slots, which
 * tone, what level of detail). The same object drives the live admin preview,
 * the existing chart views, and — later — cross-module "super charts".
 *
 * IMPORTANT: every field has a sensible default in DEFAULT_CHART_CONFIG so that
 * any consumer can render a "full" chart without an explicit preset, preserving
 * the pre-existing behavior of the views.
 */

import type { DegreeFormat } from './degreeFormat';
export type { DegreeFormat };

export type ChartType =
  | 'natal'
  | 'transit'
  | 'connection'
  | 'shadow'
  | 'dual'
  | 'super';

/** How variable arrows are rendered on the bodygraph. */
export type VariableArrowMode = 'full' | 'limited' | 'off';

/**
 * Which bodygraph artwork to render.
 *  - 'lunacco'  = the detailed LunaCco bodygraph (new default), with teardrop/diamond arrows.
 *  - 'abstract' = the original schematic bodygraph (geometric centers + arrow/circle/triangle arrows).
 */
export type BodygraphStyle = 'lunacco' | 'abstract';

/**
 * Which astrology wheel artwork to render.
 *  - 'lunacco' = the new LunaCco wheel frame (solonewastro.svg) with teardrop house/cusp wells (new default).
 *  - 'classic' = the original procedurally-drawn zodiac wheel.
 */
export type WheelStyle = 'lunacco' | 'classic';

/** Baseline prose length for sidebar boxes. */
export type SidebarLevel = 'short' | 'long';

/**
 * Which deeper HD figures to append to the `gate.line` notation in the gate
 * columns, e.g. 31.2 → 31.2.4 (color) → 31.2.4.4 (tone) → 31.2.4.4.2 (base).
 * Each is gated independently; a deeper figure only shows when the shallower
 * ones above it are also on.
 */
export interface GateDetailToggles {
  color: boolean;
  tone: boolean;
  base: boolean;
}

export interface BodygraphLayers {
  show: boolean;
  /** Which bodygraph artwork to render. Defaults to 'lunacco'. */
  style: BodygraphStyle;
  /** Extend gate.line with color/tone/base figures in the gate columns. */
  gateDetail: GateDetailToggles;
  /** Show the zodiac sign as a glyph instead of its name in the gate columns. */
  signGlyphs: boolean;
  /** When tone is shown, draw a small left/right caret for its variable direction. */
  gateToneArrow: boolean;
  /** Show the House (Hn) label column in the gate rows. Off saves room on advanced charts. */
  showGateHouse: boolean;
  /** Show the text planet label (abbrev) column in the gate rows — redundant when the glyph reads clearly. */
  showGatePlanetLabel: boolean;
  centers: boolean;
  /** Draw the name of each center (Head, Ajna, Throat, …) — nice for centers-only charts. */
  centerLabels: boolean;
  gates: boolean;
  channels: boolean;
  gateLabels: boolean;
  /** 'full' = arrows + detail text, 'limited' = arrows only, 'off' = hidden. */
  variableArrows: VariableArrowMode;
  angles: boolean;
}

/** Cumulative orb buckets: exact ≤1°, tight ≤3°, medium ≤6°, wide ≤10°, all = no limit. */
export type AspectOrbFilter = 'all' | 'exact' | 'tight' | 'medium' | 'wide';

export const ASPECT_ORB_MAX: Record<AspectOrbFilter, number> = {
  all: Infinity, exact: 1, tight: 3, medium: 6, wide: 10,
};

export interface AspectToggles {
  conjunction: boolean;
  opposition: boolean;
  square: boolean;
  trine: boolean;
  sextile: boolean;
  quincunx: boolean;
}

export interface WheelLayers {
  /** Which wheel artwork to render. Defaults to 'lunacco'. */
  style: WheelStyle;
  /** Show the personality (birth) wheel. */
  personality: boolean;
  /** Show the design wheel. Both true => dual side-by-side wheels. */
  design: boolean;
  /** Render a single combined wheel (personality + design overlaid) instead of separate wheels. */
  combined: boolean;
  houses: boolean;
  chartPoints: boolean;
  degreeTicks: boolean;
  /**
   * Zodiac degree precision for astrology placements / cusps:
   *  - 'compact' = 2°54'        (default)
   *  - 'full'    = 2°54'44.241" (degree, minute, decimal seconds)
   */
  degreeFormat: DegreeFormat;
  aspects: AspectToggles;
  /** Orb tier for which aspects to show: cumulative max-orb buckets. */
  aspectOrbFilter: AspectOrbFilter;
  /**
   * Allow-list of asteroid keys to draw.
   * `undefined` = show all asteroids; `[]` = show none.
   */
  asteroids?: string[];
  /** Whether the selected asteroids participate in aspect computation. */
  aspectsIncludeAsteroids: boolean;
  /**
   * Append the HD gate.line column to the astrology Placements table.
   * Off by default — astrology placements stay sign/degree/house only unless
   * the reader opts in (e.g. for blended AstroHD charts).
   */
  placementGates: boolean;
  /** Sabian degree layer (see services/sabian.ts). */
  sabian: boolean;
  /** Include the Design side in the astrology tabs. */
  astroShowDesign: boolean;
  /**
   * @deprecated Use `astroDesignTabs`. Retained so old presets still load.
   */
  astroDesignScope?: 'placements' | 'all';
  /** Per-tab control of where the Design side appears (when astroShowDesign). */
  astroDesignTabs: AstroDesignTabs;
}

/** Which astrology tabs include the Design side (gated by astroShowDesign). */
export interface AstroDesignTabs {
  insights: boolean;
  aspects: boolean;
  placements: boolean;
}

/**
 * Per-card visibility for the astrology experience. These mirror EXACTLY the
 * cards rendered by DualWheelView (the real "Dual Astrology Map"), so the Chart
 * Maker can switch each one on/off the same way the HD cards are toggled. All
 * default true so the dual chart is unchanged when no preset hides pieces.
 */
export interface AstroCardToggles {
  /** The dual wheel interaction map (personality + design wheels). */
  wheels: boolean;
  /** House / Element / Modality distribution tally graph (P vs D), subtabbed. */
  classifications: boolean;
  /** Moon phase card (within Insights). */
  moonPhase: boolean;
  /** Purpose marker (destiny placement) card. */
  purpose: boolean;
  /** Signature placement (dominant Sun/Moon/Rising) card. */
  signature: boolean;
  /** Chart ruler card. */
  chartRuler: boolean;
  /** Chart shape card. */
  chartShape: boolean;
  /** Tight aspects (≤2°) card. */
  tightAspects: boolean;
  /** Stelliums card. */
  stelliums: boolean;
  /** House rulers card. */
  houseRulers: boolean;
  /** Full aspects tab. */
  aspects: boolean;
  /** Placements tab. */
  placements: boolean;
  /** House-cusps subsection (shows when Placidus cusps are present). */
  houseCusps: boolean;
  /** Angel overlay on the big-3 (Sun/Moon/Ascendant) placements. */
  angels: boolean;
}

/**
 * Per-card visibility for the full chart bodies. All default true so a chart
 * shows everything unless a preset hides pieces. Mirrors the cards rendered by
 * NatalView (HD) and the astrology views.
 */
export interface SectionToggles {
  // Human Design (NatalView)
  summaryBar: boolean;       // Type · Authority · Profile · Definition · Incarnation Cross
  angles: boolean;           // Conscious/Unconscious Sun & Earth angel cross
  gateColumns: boolean;      // Design + Personality planet/gate columns
  asteroidColumns: boolean;  // Selected-asteroid sub-columns beneath the gate columns
  variables: boolean;        // Variables panel above the bodygraph
  destinyPoints: boolean;    // Destiny / Soul & Life Purpose map
  profileLines: boolean;     // Lines / Quarters / Circuitry / Repeats graphs
  activeChannels: boolean;   // Active channels grid
  // Astrology — these double as the inner astro tabs that show.
  astroInsights: boolean;    // Insights tab (chart shape, tight aspects, moon phase, stelliums, patterns)
  astroPlacements: boolean;  // Placements tab (planet tables, destiny points, angels)
  astroAspects: boolean;     // Aspects tab (full aspect grid)
  houseRulers: boolean;      // Rulers tab (house & chart rulers)
  moonPhase: boolean;        // Moon phase card (within Insights)
  signsModalities: boolean;  // Modalities tab (element / modality distribution)
}

export interface GraphLayers {
  lines: boolean;
  circuitry: boolean;
}

/** Which chart systems the experience includes. */
export type ChartScope = 'hd' | 'astro' | 'both';

export type HouseSystem = 'whole_house' | 'placidus' | 'koch';

/**
 * Canonical planet/point keys used across HD gate columns and astrology
 * placements/wheels. Names match the activation keys returned by EphemerisService.
 */
export const PLANET_CATALOG: string[] = [
  'Sun', 'Earth', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
  'Uranus', 'Neptune', 'Pluto', 'Chiron', 'NorthNode', 'SouthNode',
  'Black Moon Lilith', 'Vulcan', 'Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex',
];

/**
 * Per-side allow-list of planets/points to display. `undefined` = show all.
 * Applies to the HD gate columns and the astrology placements + wheels.
 */
export interface PlanetSelection {
  personality?: string[];
  design?: string[];
}

/** Which sub-tabs of the Profile Lines analytics block to show. */
export interface ProfileLineTabs {
  lines: boolean;
  quarters: boolean;
  circuitry: boolean;
  repeats: boolean;
}

// ─── Per-card box composition ─────────────────────────────────────────────────
// The heart of "absolute control": each card type (hd_gate, astro_planet, …)
// composes its sidebar reading from one optional SYNTH box (a token_template
// woven through resolve() with the card's whole entity bundle) plus an ordered
// list of STANDALONE boxes, each an individual slot OR another template,
// targeting a specific piece of the bundle (or the whole bundle), with its own
// label and accent style. Stored in chart_presets.config_json → `cards`.

/** Accent family for a standalone box. 'auto' derives from the slot key. */
export type BoxStyle = 'auto' | 'plain' | 'shadow' | 'gift' | 'coaching';

/** Bundle roles a standalone box can target ('bundle' = every piece). */
export type BoxTarget =
  | 'bundle'
  | 'gate' | 'planet' | 'line' | 'sign' | 'house' | 'angel'
  | 'channel' | 'center' | 'aspect' | 'profile' | 'cross' | 'variable';

export interface CardBox {
  /** Stable id for ordering/editing in the composer. */
  id: string;
  /** 'slot' resolves one content layer via resolve-slots; 'template' weaves via resolve(). */
  kind: 'slot' | 'template';
  /** Slot key (e.g. 'shadow_recessive') or template_key (e.g. 'hd_placement_synth'). */
  key: string;
  /**
   * Which piece of the bundle this box reads from. Retained for back-compat and
   * as the primary target; `targets` (when present) is the authoritative list.
   */
  target: BoxTarget;
  /**
   * Explicit list of pieces this box applies to (checkbox selection in the
   * composer). When present it supersedes `target`; 'bundle' means every piece.
   * Absent ⇒ fall back to the single `target`.
   */
  targets?: BoxTarget[];
  /** Optional custom display label; falls back to the slot/template label. */
  label?: string;
  style?: BoxStyle;
}

export interface CardComposition {
  /** token_template key for the synth box; '' / undefined = no synth. */
  synth?: string;
  /** Ordered standalone boxes rendered after the synth. */
  boxes: CardBox[];
}

/** Per-card-type compositions, keyed by resolver entity_type (hd_gate, astro_sign…). */
export type CardCompositions = Record<string, CardComposition>;

/** One composable card in the catalog. */
export interface CardCatalogEntry {
  /** Resolver entity_type — the composition key. */
  entityType: string;
  label: string;
  /** Roles available as standalone-box targets for this card's bundle. */
  targets: BoxTarget[];
}

/**
 * The card catalog grouped into the five experience categories. This taxonomy
 * drives the Chart Maker config pane, the center-view sections, and the sidebar
 * grouping — one structure, three surfaces. (`hd_planet` is legacy and
 * deliberately absent: planet content lives in astro_planet + angles.)
 */
export const CARD_CATEGORIES: Array<{ key: string; label: string; cards: CardCatalogEntry[] }> = [
  {
    key: 'identity', label: 'Identity',
    cards: [
      { entityType: 'hd_type', label: 'Type', targets: ['bundle'] },
      { entityType: 'hd_authority', label: 'Authority', targets: ['bundle'] },
      { entityType: 'hd_profile', label: 'Profile', targets: ['bundle', 'profile'] },
      { entityType: 'hd_definition_type', label: 'Definition', targets: ['bundle'] },
    ],
  },
  {
    key: 'activations', label: 'Activations',
    cards: [
      { entityType: 'hd_gate', label: 'Gates', targets: ['bundle', 'gate', 'planet', 'line', 'sign', 'house', 'angel'] },
      { entityType: 'astro_planet', label: 'Planets', targets: ['bundle', 'planet', 'gate', 'line', 'sign', 'house', 'angel'] },
      { entityType: 'hd_channel', label: 'Channels', targets: ['bundle', 'channel', 'planet', 'sign', 'line', 'house'] },
      { entityType: 'hd_center', label: 'Centers', targets: ['bundle', 'center'] },
    ],
  },
  {
    key: 'purpose', label: 'Purpose',
    cards: [
      { entityType: 'hd_incarnation_cross', label: 'Incarnation Cross', targets: ['bundle', 'cross', 'gate', 'planet', 'line', 'angel'] },
      { entityType: 'astro_angle_point', label: 'Destiny / Angles', targets: ['bundle', 'gate', 'house', 'line', 'sign', 'angel'] },
      { entityType: 'hd_destiny_point', label: 'Destiny Points', targets: ['bundle', 'destiny_point', 'gate', 'house', 'line', 'sign', 'angel'] },
    ],
  },
  {
    key: 'astrology', label: 'Astrology',
    cards: [
      { entityType: 'astro_sign', label: 'Signs', targets: ['bundle', 'sign'] },
      { entityType: 'astro_house', label: 'Houses', targets: ['bundle', 'house'] },
      { entityType: 'astro_aspect', label: 'Aspects', targets: ['bundle', 'aspect', 'planet'] },
      { entityType: 'astro_chart_pattern', label: 'Chart Patterns', targets: ['bundle'] },
      { entityType: 'astro_moon_phase', label: 'Moon Phase', targets: ['bundle'] },
      { entityType: 'astro_stellium', label: 'Stelliums', targets: ['bundle', 'stellium', 'sign', 'house', 'planet'] },
    ],
  },
  {
    key: 'refinement', label: 'Refinement',
    cards: [
      { entityType: 'hd_variable', label: 'Variables', targets: ['bundle', 'variable'] },
      { entityType: 'hd_line', label: 'Lines', targets: ['bundle', 'line'] },
      { entityType: 'hd_circuitry', label: 'Circuitry', targets: ['bundle'] },
    ],
  },
];

/** Flat catalog lookup by entity type. */
export const CARD_CATALOG: Record<string, CardCatalogEntry> = Object.fromEntries(
  CARD_CATEGORIES.flatMap((c) => c.cards.map((card) => [card.entityType, card]))
);

let boxIdCounter = 0;
export function newBoxId(): string {
  return `box-${Date.now().toString(36)}-${(boxIdCounter++).toString(36)}`;
}

/** Sensible default compositions so unconfigured charts still read well. */
export const DEFAULT_CARD_COMPOSITIONS: CardCompositions = {
  hd_gate: { synth: 'hd_placement_synth', boxes: [] },
  astro_planet: { synth: 'astro_placement_synth', boxes: [] },
  astro_aspect: { synth: 'astro_aspect_synth', boxes: [] },
  astro_moon_phase: { synth: 'astro_moon_phase_synth', boxes: [] },
  astro_stellium: { synth: 'astro_stellium_synth', boxes: [] },
  astro_chart_pattern: { synth: 'astro_chart_pattern_synth', boxes: [] },
  hd_destiny_point: { synth: 'hd_destiny_point_synth', boxes: [] },
};

function normalizeCardBox(raw: any): CardBox | null {
  if (!raw || typeof raw !== 'object' || !raw.key) return null;
  const targets = Array.isArray(raw.targets)
    ? (raw.targets.filter((t: any) => typeof t === 'string') as BoxTarget[])
    : undefined;
  return {
    id: String(raw.id || newBoxId()),
    kind: raw.kind === 'template' ? 'template' : 'slot',
    key: String(raw.key),
    target: (raw.target || (targets && targets[0]) || 'bundle') as BoxTarget,
    targets: targets && targets.length ? targets : undefined,
    label: raw.label ? String(raw.label) : undefined,
    style: (raw.style || 'auto') as BoxStyle,
  };
}

export function normalizeCardCompositions(raw: any): CardCompositions {
  const out: CardCompositions = {};
  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([entityType, comp]: [string, any]) => {
      if (!comp || typeof comp !== 'object') return;
      out[entityType] = {
        synth: comp.synth ? String(comp.synth) : undefined,
        boxes: Array.isArray(comp.boxes) ? comp.boxes.map(normalizeCardBox).filter(Boolean) as CardBox[] : [],
      };
    });
  }
  return out;
}

export interface SidebarConfig {
  /** short_def vs long_def baseline. */
  level: SidebarLevel;
  /**
   * Ordered allow-list of slot keys to render, e.g.
   * ['short_def', 'gift', 'shadow_recessive', 'affirmation', 'eft_script'].
   * Empty array => let the resolver decide (output_context default).
   */
  slots: string[];
  /** Include coaching_* slots. */
  coaching: boolean;
  /** Show raw chart data only, suppress prose. */
  showDataOnly: boolean;
}

/** Phase 3 — cross-module inclusion for super charts. */
export interface ModuleInclusion {
  module_id: string;            // e.g. 'luna-numerology', 'lunacco-eastern'
  kind: string;                 // e.g. 'life_path', 'nine_star_ki', 'bazi', 'iching'
  restCalculate?: string;       // REST path to compute the module's data
  entities?: string[];          // explicit entity refs to resolve
  level: SidebarLevel;
}

export interface ChartConfig {
  preset_key: string;
  title: string;
  chart_type: ChartType;
  /** Definition set id; when omitted the module-active-set is used. */
  set_id?: number;
  /** Variant tone within the set (NOT a separate set). */
  tone_key?: string;
  /**
   * @deprecated Legacy slot-tier hint from the old definition system. No longer
   * surfaced or used for resolution (slots are driven by `sidebar.slots`). Kept
   * only to satisfy the chart_presets DB column on save.
   */
  output_context?: string;

  /** Governance flags (read by the core unified Charts admin via config_json). */
  enabled?: boolean;
  admin_only?: boolean;
  is_premium?: boolean;
  credit_cost?: number;

  /** HD only, astrology only, or both (tabbed in the maker). */
  scope: ChartScope;
  /**
   * Sidebar category placement in the core Charts nav: 'astrology', 'hd', or
   * 'astrohd' (blended). When omitted, the base chart type's default category is
   * used. Lets founders reclassify a preset without code changes.
   */
  category?: 'astrology' | 'hd' | 'astrohd';
  /** Difficulty level for filtering/recommendations (charts landing). */
  level?: 'beginner' | 'intermediate' | 'advanced';
  /** Flag this chart as "popular" (featured/recommended). */
  popular?: boolean;
  bodygraph: BodygraphLayers;
  wheels: WheelLayers;
  graphs: GraphLayers;
  sections: SectionToggles;
  /** Per-card visibility for the astrology (dual) experience. */
  astroCards: AstroCardToggles;
  /** Per-side planet/point allow-lists (undefined per side = show all). */
  planets: PlanetSelection;
  /** Default house system the chart computes with. */
  houseSystem: HouseSystem;
  /** Whether end-users see the Whole Sign / Placidus switcher on the chart. */
  showHouseSystemToggle: boolean;
  /** Which Profile-Lines analytics sub-tabs to expose. */
  profileLineTabs: ProfileLineTabs;
  sidebar: SidebarConfig;
  /**
   * Per-card box compositions (synth template + ordered standalone boxes),
   * keyed by entity_type. Missing card ⇒ DEFAULT_CARD_COMPOSITIONS fallback.
   */
  cards: CardCompositions;

  /** Cross-module segments for super charts; [] in Phase 1. */
  modules: ModuleInclusion[];

  /** Passthrough theme overrides for Bodygraph / AstroWheel. */
  theme?: Record<string, string>;
}

export const DEFAULT_BODYGRAPH_LAYERS: BodygraphLayers = {
  show: true,
  style: 'lunacco',
  gateDetail: { color: false, tone: false, base: false },
  signGlyphs: false,
  gateToneArrow: false,
  showGateHouse: true,
  showGatePlanetLabel: true,
  centers: true,
  centerLabels: false,
  gates: true,
  channels: true,
  gateLabels: true,
  variableArrows: 'full',
  angles: true,
};

export const DEFAULT_ASPECT_TOGGLES: AspectToggles = {
  conjunction: true,
  opposition: true,
  square: true,
  trine: true,
  sextile: true,
  quincunx: true,
};

export const DEFAULT_WHEEL_LAYERS: WheelLayers = {
  style: 'lunacco',
  personality: true,
  design: false,
  combined: false,
  houses: true,
  chartPoints: true,
  degreeTicks: true,
  degreeFormat: 'compact',
  aspects: { ...DEFAULT_ASPECT_TOGGLES },
  aspectOrbFilter: 'all',
  asteroids: undefined,
  aspectsIncludeAsteroids: true,
  placementGates: false,
  sabian: false,
  astroShowDesign: false,
  astroDesignTabs: { insights: false, aspects: false, placements: true },
};

export const DEFAULT_SECTION_TOGGLES: SectionToggles = {
  summaryBar: true,
  angles: true,
  gateColumns: true,
  asteroidColumns: true,
  variables: true,
  destinyPoints: true,
  profileLines: true,
  activeChannels: true,
  astroInsights: true,
  astroPlacements: true,
  astroAspects: true,
  houseRulers: true,
  moonPhase: true,
  signsModalities: true,
};

export const DEFAULT_ASTRO_CARD_TOGGLES: AstroCardToggles = {
  wheels: true,
  classifications: true,
  moonPhase: true,
  purpose: true,
  signature: true,
  chartRuler: true,
  chartShape: true,
  tightAspects: true,
  stelliums: true,
  houseRulers: true,
  aspects: true,
  placements: true,
  houseCusps: true,
  angels: true,
};

export const DEFAULT_GRAPH_LAYERS: GraphLayers = {
  lines: true,
  circuitry: true,
};

export const DEFAULT_SIDEBAR_CONFIG: SidebarConfig = {
  level: 'long',
  slots: [],
  coaching: false,
  showDataOnly: false,
};

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  preset_key: '',
  title: 'Full Chart',
  chart_type: 'natal',
  tone_key: 'default',
  enabled: true,
  admin_only: false,
  is_premium: false,
  credit_cost: 0,
  scope: 'both',
  bodygraph: { ...DEFAULT_BODYGRAPH_LAYERS },
  wheels: { ...DEFAULT_WHEEL_LAYERS, aspects: { ...DEFAULT_ASPECT_TOGGLES } },
  graphs: { ...DEFAULT_GRAPH_LAYERS },
  sections: { ...DEFAULT_SECTION_TOGGLES },
  astroCards: { ...DEFAULT_ASTRO_CARD_TOGGLES },
  planets: {},
  houseSystem: 'whole_house',
  showHouseSystemToggle: true,
  profileLineTabs: { lines: true, quarters: true, circuitry: true, repeats: true },
  sidebar: { ...DEFAULT_SIDEBAR_CONFIG, slots: [] },
  cards: normalizeCardCompositions(DEFAULT_CARD_COMPOSITIONS),
  modules: [],
};

/** Deep-ish clone so callers can mutate a working copy safely. */
export function cloneChartConfig(cfg: ChartConfig): ChartConfig {
  return {
    ...cfg,
    bodygraph: { ...cfg.bodygraph, gateDetail: { ...(cfg.bodygraph.gateDetail || DEFAULT_BODYGRAPH_LAYERS.gateDetail) } },
    wheels: {
      ...cfg.wheels,
      aspects: { ...cfg.wheels.aspects },
      asteroids: cfg.wheels.asteroids ? [...cfg.wheels.asteroids] : undefined,
      astroDesignTabs: { ...(cfg.wheels.astroDesignTabs || DEFAULT_WHEEL_LAYERS.astroDesignTabs) },
    },
    graphs: { ...cfg.graphs },
    sections: { ...cfg.sections },
    astroCards: { ...DEFAULT_ASTRO_CARD_TOGGLES, ...cfg.astroCards },
    planets: {
      personality: cfg.planets?.personality ? [...cfg.planets.personality] : undefined,
      design: cfg.planets?.design ? [...cfg.planets.design] : undefined,
    },
    profileLineTabs: { ...cfg.profileLineTabs },
    sidebar: { ...cfg.sidebar, slots: [...cfg.sidebar.slots] },
    cards: Object.fromEntries(Object.entries(cfg.cards || {}).map(([k, v]) => [k, { synth: v.synth, boxes: v.boxes.map((b) => ({ ...b })) }])),
    modules: cfg.modules.map((m) => ({ ...m })),
    theme: cfg.theme ? { ...cfg.theme } : undefined,
  };
}

/**
 * Normalize an arbitrary config_json blob (from the REST API) into a complete
 * ChartConfig, filling any missing fields with defaults. Defensive against
 * older/partial presets.
 */
export function normalizeChartConfig(raw: Partial<ChartConfig> | null | undefined): ChartConfig {
  const base = cloneChartConfig(DEFAULT_CHART_CONFIG);
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    bodygraph: {
      ...base.bodygraph,
      ...(raw.bodygraph || {}),
      gateDetail: { ...base.bodygraph.gateDetail, ...((raw.bodygraph && raw.bodygraph.gateDetail) || {}) },
    },
    wheels: {
      ...base.wheels,
      ...(raw.wheels || {}),
      aspects: { ...base.wheels.aspects, ...((raw.wheels && raw.wheels.aspects) || {}) },
      astroDesignTabs: {
        ...base.wheels.astroDesignTabs,
        // Migrate legacy astroDesignScope: 'all' => every tab, 'placements' => placements only.
        ...(raw.wheels && raw.wheels.astroDesignScope
          ? (raw.wheels.astroDesignScope === 'all'
            ? { insights: true, aspects: true, placements: true }
            : { insights: false, aspects: false, placements: true })
          : {}),
        ...((raw.wheels && raw.wheels.astroDesignTabs) || {}),
      },
    },
    graphs: { ...base.graphs, ...(raw.graphs || {}) },
    sections: { ...base.sections, ...(raw.sections || {}) },
    astroCards: { ...base.astroCards, ...(raw.astroCards || {}) },
    planets: {
      personality: (raw.planets && raw.planets.personality) || undefined,
      design: (raw.planets && raw.planets.design) || undefined,
    },
    houseSystem: raw.houseSystem || base.houseSystem,
    showHouseSystemToggle: raw.showHouseSystemToggle ?? base.showHouseSystemToggle,
    profileLineTabs: { ...base.profileLineTabs, ...(raw.profileLineTabs || {}) },
    sidebar: { ...base.sidebar, ...(raw.sidebar || {}), slots: (raw.sidebar && raw.sidebar.slots) || base.sidebar.slots },
    cards: raw.cards ? normalizeCardCompositions(raw.cards) : base.cards,
    modules: Array.isArray(raw.modules) ? raw.modules.map((m) => ({ ...m })) : [],
  };
}
