# Opus Handoff — Definition/Chart Maker wiring fixes (2026-06-10)

> Read `SIDEBAR-DEFINITION-SPEC.md` first. These are the behind-the-scenes items
> Jules wants Opus to execute while Fable handles design/UI. Work in order.
> All theming via CSS variables only — never hardcode colors/fonts.

## 1. Chart Maker LIVE PREVIEW sidebar must use the box compositions
The maker's right-hand preview (`InterpretationPanel` in `ChartMakerView.tsx`)
still resolves via the legacy `config.sidebar.slots` path. The REAL sidebar
(`AstroHDShell.jsx` → AstroHDPanel) already resolves composition-first.

**Do:** extract the shell's composition resolution into a shared hook/service
(e.g. `useCardResolution(items, composition, opts)` or a plain async
`resolveCardComposition()` in `DefinitionService.ts`) covering: bundle assembly,
synth via `resolveCoreDefinition`, slot boxes batched via `resolveCardGroups`,
template boxes via their own resolve, ordering by composition. Then call it from
BOTH AstroHDShell and ChartMakerView's element-click handler (using the
in-editor `config.cards`, not the saved preset). Render preview boxes through
`components/composer/EditorialBoxes.tsx` (SynthBox/SlotBox), not the legacy
InterpretationPanel slot list.

## 2. Moon phase card ignores its composition (and other "single" cards)
Jules composed the `astro_moon_phase` card and instead got the MOON PLANET
reading with all sub boxes. Causes to fix:
- `SECTION_TO_ENTITY_TYPE` in `DefinitionService.ts` has **no
  `astro_moon_phases` mapping** → moon-phase clicks can't resolve to the
  `astro_moon_phase` entity type. Add it (and audit the map against the card
  catalog: `astro_chart_patterns` exists, but verify moon_phase, sabian, etc.).
- Find what the moon-phase card in `DualWheelView.tsx` dispatches on click —
  it likely sends the Moon planet (`astro_planets`/`Moon`) instead of a
  moon-phase entity. It must dispatch
  `{ sectionType: 'astro_moon_phases', itemKey: <phase key> }`.
- Audit every center-view card's `astrohd:select-element` dispatch against the
  composition card catalog (`CARD_CATEGORIES` in `chartConfig.ts`) so EVERY card
  type routes to its own composition: chart shape, signature, chart ruler,
  purpose, stelliums, house rulers, moon phase, classifications.

## 3. Audit: Chart Maker choices not fully honored on real charts
`PresetChartExperience` (AstroHDShell) now passes the preset ChartConfig to
NatalView + DualWheelView. But not every view consumes every field:
- `CombinedView.tsx` accepts NO config at all — it's used for combined-type
  presets via the specialised path. Either teach it `config` (sections,
  astroCards, wheels, planets) or route combined presets through
  PresetChartExperience too.
- Verify per-field consumption in NatalView and DualWheelView: `wheels.*`
  (style, combined, houses, chartPoints, degreeTicks, sabian, aspect toggles,
  orb filter, asteroids list), `astroCards.*` (all 14), `planets.personality/
  design`, `profileLineTabs`, `bodygraph.*`. Fix any toggle that does nothing.
- Asteroid overlays: the maker fetches asteroid data itself and passes
  `asteroids={...}` to DualWheelView; PresetChartExperience passes none. Fetch
  selected asteroids (`config.wheels.asteroids`) via EphemerisService in
  PresetChartExperience and pass them through.

## 4. Astro-only presets still mount NatalView for data
PresetChartExperience keeps NatalView mounted (hidden) because it computes the
chart data. For scope='astro' that means the whole HD view renders behind the
scenes. Replace with a direct EphemerisService computation (same call NatalView
makes) so astro-only charts never mount the bodygraph. Keep `onChartReady`
behavior identical (the sidebar panel needs the data).

## 5. resolve-slots scoping check
When a composition box targets a piece, the shell batches
`(entity_type, entity_key, layer)` requests. Verify the engine resolves variant
→ base correctly for all targeted types and that empty values stay omitted (the
shell now renders EXACTLY the composed boxes; legacy display_boxes are
suppressed whenever a composition has boxes — see `setComposedBoxes` comment).

## 6. Known token bugs (TODO Step 5 — keep on radar)
`hd_placement_synth` renders "line **Line 4**" and "in the **House 5**". Fix
the `{keys}`/template bodies against authored slots. Drop legacy `hd_planets`
card; converge the leftover `resolveDefinitions` centers path.

## Done by Fable (don't redo)
- `ChartConfig.cards` schema + composer UI + category taxonomy (Step 2).
- Placement-switcher for multi-activated gates.
- PresetChartExperience: preset config now drives real charts (scope, tabs).
- Sidebar: scope-aware HD/Astro toggle; chart-title masthead in sidebar +
  center; compact at-a-glance placement/aspect rows in DualWheelView;
  removed per-card "Opens … interpretations" filler text.
