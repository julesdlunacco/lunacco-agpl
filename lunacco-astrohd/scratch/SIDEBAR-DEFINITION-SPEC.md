# AstroHD Sidebar Definition Resolution — Spec (agreed 2026-06-09)

Source of truth for the per-card-type definition system rebuild. Read this before
touching resolution/admin code.

## Mental model (confirmed with Jules)

- A **card** (gate, planet, sign, destiny point, channel, center, type, etc.) maps to a
  **bundle of entities** = the "pieces" available to the resolver (`active_entities`).
- The per-card **box settings** decide what actually renders:
  - one optional **synth box** → a `token_template` (`resolve()`) that weaves the whole bundle
    via `{role.slot}` tokens (e.g. `hd_placement_synth`).
  - an ordered list of **standalone boxes**, each either an **individual slot** OR **another
    template**, targeting a specific **piece/role** (or the whole bundle), each with its own
    style/label. Standalone boxes may apply across all placements (e.g. shadow on every one).

## Engine facts (already built)

- `resolve()` (REST `definitions/resolve`): takes `active_entities` + `template_key`; for a
  `token_template` it returns `rendered_text` (the woven synth) + `display_boxes`/`visible_slots`.
  Roles derived from entity_type via `entity_type_to_role` (planet/gate/line/sign/house/
  aspect/channel/center/type/authority/profile/moon_phase/sabian; angles→planet role).
- `resolve-slots` (REST `definitions/resolve-slots`): resolves a specific `(entity_type,
  entity_key, layer)` — used for **per-piece standalone boxes**.
- **Scope**: slots resolve `variant` (personality/design) → falls back to `base` (= general).
  Only **general** is authored, which is the base fallback. Do NOT demand personality/design.
- Token templates live as `metadata_json.template_body` with `render_mode='token_template'`.
  Seed examples: `astro_placement_synth`, `hd_placement_synth` (see class-definition-engine.php).

## Bundle ingredients per card (confirmed)

| Card | active_entities bundle |
|---|---|
| Gate (bodygraph click) | gate + activating planet(s) + line + sign + house + angel |
| Planet row (NatalView already does this) | planet + gate + line + sign + house (+ angel) |
| Destiny point | the point (soul/life) ITSELF + gate + house + line + sign + angel |
| Incarnation Cross — per-piece cards | each cross gate + planets + line + angels |
| Incarnation Cross — by-name card | single `hd_incarnation_crosses` definition (no bundle) |
| Variables | variable direction + color + tone |
| Type | single |
| Authority | single |
| Profile | profile + modality |
| Definition | single |
| Channels | mostly single; optionally + planet + sign + line + house |
| Centers | the defined/undefined variant (center-defined / center-undefined) |

## Key implementation facts

- The chart VIEWS already assemble bundles for planet-row clicks: NatalView `GateColumn`
  dispatches a multi-entity `astrohd:select-element` with `items: [...]`. AstroHDShell sets
  `selectedItems = items` → that IS the bundle.
- Activation entries (`birthActivations[name]`, `designActivations[name]`) carry:
  `{ gate, line, sign, house, color, tone, base, isRetrograde, fixation }`. `gate` may be a
  string — coerce with `Number()`.
- Bodygraph GATE clicks send only the gate → must rebuild the bundle from chart data
  (scan BOTH birthActivations and designActivations; a gate can be activated on each side).

## Entity-key normalization (2026-06-16 — identity cards)

The chart hands DISPLAY labels; entities are seeded as SLUGS. `sectionItemToEntityRef`
(DefinitionService.ts) must map them or single-entity cards resolve nothing:
- `hd_type`: "Manifesting Generator" → `mg`, etc. (`HD_IDENTITY_KEYMAP`).
- `hd_definition_type`: "Split Definition" → `split`, etc.
- `hd_profile`: chart sends `profile:"1 / 4"` + `modality:"Fixed"`; seeded key is `14-fixed`
  (two line digits JOINED, slash dropped, dash before modality). Extract digits + modality
  independently — a greedy `\D*` will swallow the modality.
- `hd_authority`: lowercase+dash already matches (`Emotional`→`emotional`).

Resolver composition precedence (AstroHDShell): Chart-Maker preset → core Charts-admin
`card_types` (template→synth, slots→boxes on the card's own role) → `DEFAULT_CARD_COMPOSITIONS`.
Synth box renders ONLY when a template is explicitly set; boxes-only cards skip the synth
(otherwise the placement template renders a broken weave over a single entity).

Admin credit bypass: `Luna_AstroHD_Credit_Gate::issue()` zeroes cost for `manage_options`.

## What I got wrong (do not repeat)

- Replaced the `resolve()` synth path with `resolve-slots` per-slot pulling → broke the hd
  synth setting (cards rendered pieces individually). RESTORE `resolve()` for synth boxes.
- Treated `hd_planets` as live; it is LEGACY. Planet content = `astro_planets` + angles.
  Drop hd_planet from the card catalog.
- Demanded slots that aren't authored / tokens not tied to reality → audit `{keys}` vs
  authored slots before shipping templates.
- Centers "work" via a leftover legacy `resolveDefinitions` path — converge it.

## Step 2 — IMPLEMENTED (2026-06-10): per-card box composer

Schema lives in `spa/src/services/chartConfig.ts`:
- `ChartConfig.cards: Record<entityType, CardComposition>` — persists in
  `chart_presets.config_json.cards` (normalize/clone/save all handle it).
- `CardComposition = { synth?: template_key, boxes: CardBox[] }`
- `CardBox = { id, kind: 'slot'|'template', key, target: BoxTarget, label?, style? }`
  - `target`: `'bundle'` or a role (`gate|planet|line|sign|house|angel|channel|center|aspect|profile|cross|variable`)
  - `style`: `'auto'` (derive from slot key) `|plain|shadow|gift|coaching`
- `CARD_CATEGORIES` — the five-category card taxonomy (Identity / Activations /
  Purpose / Astrology / Refinement) that drives the config pane AND (later) the
  center-view sections + sidebar grouping. `CARD_CATALOG` is the flat lookup.
- `DEFAULT_CARD_COMPOSITIONS` — hd_gate → hd_placement_synth, astro_planet →
  astro_placement_synth (so unconfigured charts still synth).

UI: `spa/src/components/composer/CardBoxComposer.tsx` (per-card editor) wired
into ChartMakerView's Sidebar tab, grouped by category. Templates listed via
`fetchTemplates()` (GET `lunacco/v1/definitions/templates`). Legacy
`sidebar.slots` kept as a labeled fallback section.

Shared editorial primitives: `spa/src/components/composer/EditorialBoxes.tsx`
(CardFrame / SynthBox / SlotBox / BoxSkeleton / PlacementSwitcher, slotLabel /
boxTone). ALL theming via CSS variables (theme-maker driven) — never hardcode
colors/fonts in new chart UI.

Resolution (AstroHDShell.jsx):
- Loads the active chart's preset config (`listChartPresets` + `rowToChartConfig`);
  default charts use a preset with key **`default`** if one exists.
- `compositionFor(entityType)`: preset cards → DEFAULT_CARD_COMPOSITIONS → null.
- Synth = `resolve()` with `composition.synth`; standalone slot boxes batch via
  `resolveCardGroups` (resolve-slots), template boxes via their own `resolve()`
  over the targeted entities. Boxes render in composition order.
- **Multi-placement gates**: a bodygraph gate active in >1 placement renders a
  PlacementSwitcher (segmented: ☉ Personality · Sun / ☽ Design · Mars …); only
  the ACTIVE placement's pieces fold into the bundle → one synth per placement.
  Planet pieces use `astro_planets` (NOT legacy `hd_planets`).

Known gaps after Step 2:
- Chart Maker live-preview sidebar (InterpretationPanel) still renders the
  legacy `sidebar.slots` path — point it at the composition next.
- Center-view section reorg by CARD_CATEGORIES not started (next phase).
- Angel-by-degree bundle assembly still Step 3.

## Build order

1. Restore `resolve()` synth path in AstroHDShell, driven by per-card synth template_key,
   passing the bundle (selectedItems + gate-click expansion). Render synth box.
2. Per-card **box composer** admin (synth template + ordered boxes: slot|template, piece,
   style) for default + Chart Maker charts.
3. Per-piece standalone boxes via `resolve-slots` (+ angel-by-degree assembly).
4. Variables / destiny point / incarnation-cross / channel / center bundle assembly.
5. Write templates per card + fix `{keys}` against authored slots.
