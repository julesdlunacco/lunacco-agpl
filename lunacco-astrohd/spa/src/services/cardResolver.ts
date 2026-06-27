/**
 * cardResolver.ts
 *
 * Shared, composition-driven sidebar resolver.
 *
 * A clicked card resolves its editorial reading from a **composition**: an
 * optional synth template (woven over the whole entity bundle) plus an ordered
 * list of standalone boxes (slot boxes target one piece/role or the whole
 * bundle; template boxes weave their own template over the targeted pieces).
 *
 * This mirrors the runtime logic in AstroHDShell so the Chart Maker preview
 * resolves definitions exactly the way the real chart will — the previous
 * preview ignored `config.cards` and resolved a flat slot list, which is why
 * composed charts "didn't resolve".
 */

import type { CardComposition } from './chartConfig';
import {
  resolveCoreDefinition,
  resolveCardGroups,
  sectionItemToEntityRef,
  SECTION_TO_ENTITY_TYPE,
  ResolvedEntityGroup,
} from './DefinitionService';
import { getAngelOverlay } from './AngelOverlayService';

/** Bundle role for an entity type (what a box `target` matches against). */
const ROLE_OF_ENTITY_TYPE: Record<string, string> = {
  hd_gate: 'gate', astro_planet: 'planet', hd_planet: 'planet', hd_line: 'line',
  astro_sign: 'sign', astro_house: 'house', astro_angle_point: 'planet',
  hd_channel: 'channel', hd_center: 'center', astro_aspect: 'aspect',
  hd_profile: 'profile', hd_incarnation_cross: 'cross',
  hd_variable: 'variable', hd_variable_color: 'variable', hd_variable_tone: 'variable',
  angel_shem: 'angel',
};

export interface CardResolverItem {
  sectionType: string;
  itemKey: string;
  title?: string;
}

export interface CardResolverOpts {
  /** Composition lookup by entity_type (preset cards → built-in default). */
  compositionFor: (entityType: string) => CardComposition | null;
  set_id?: number;
  tone_key?: string;
  module_id?: string;
  /** 'hd_only' | 'astrology_only' | 'combined' — passed to the core resolver. */
  chart_context?: string;
  /** Fallback synth template when a card has no composition synth. */
  sidebarTemplate?: string;
  /** Chart activations, used to expand a bare bodygraph gate click into its bundle. */
  chartData?: any;
}

export interface CardResolution {
  /** Woven synth reading (rendered_text) for the whole bundle, when a template is set. */
  synthText: string | null;
  /** Grouped standalone boxes, one group per resolved entity (composition order). */
  groups: ResolvedEntityGroup[];
}

const LINK_EXCLUDED = ['Chiron', 'Lilith'];

/**
 * Resolve a clicked selection into a synth reading + grouped boxes via the
 * card's composition. Single batch round-trips for slot boxes; template boxes
 * resolve in parallel.
 */
export async function resolveCardSelection(
  items: CardResolverItem[],
  opts: CardResolverOpts,
): Promise<CardResolution> {
  if (!items.length) return { synthText: null, groups: [] };

  // 1) Build the entity bundle. Planet-row clicks already arrive whole; a bare
  //    bodygraph gate click is expanded from the chart activations (first
  //    placement) so its line/sign/house/angel join the reading.
  const bundle: CardResolverItem[] = [...items];
  const seen = new Set(items.map((i) => `${i.sectionType}:${String(i.itemKey).toLowerCase()}`));
  const addItem = (sectionType: string, itemKey: any, title?: string) => {
    if (itemKey === undefined || itemKey === null || itemKey === '') return;
    const dedupe = `${sectionType}:${String(itemKey).toLowerCase()}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    bundle.push({ sectionType, itemKey: String(itemKey), title });
  };

  if (opts.chartData) {
    items.forEach((item) => {
      if (item.sectionType !== 'hd_gates') return;
      const gid = parseInt(item.itemKey, 10);
      let act: any = null;
      let side = '';
      let planet = '';
      for (const [s, acts] of [['Personality', opts.chartData?.birthActivations], ['Design', opts.chartData?.designActivations]] as const) {
        for (const [name, a] of Object.entries((acts || {}) as Record<string, any>)) {
          if (a && Number(a.gate) === gid && !LINK_EXCLUDED.includes(name)) { act = a; side = s; planet = name; break; }
        }
        if (act) break;
      }
      if (!act) return;
      addItem('astro_planets', planet, `${side} ${planet}`);
      if (act.line) addItem('hd_lines', String(act.line), `Line ${act.line}`);
      if (act.sign) addItem('astro_signs', String(act.sign).toLowerCase(), act.sign);
      if (act.house) addItem('astro_houses', String(act.house), `House ${act.house}`);
      const angel = getAngelOverlay(act.longitude);
      if (angel) addItem('angel_shem', `shem_${String(angel.index).padStart(2, '0')}`, angel.name);
    });
  }

  const bundleEntities = bundle
    .map((item) => {
      const ref = sectionItemToEntityRef(item.sectionType, item.itemKey);
      if (!ref) return null;
      const entityType = ref.split(':')[1];
      return { ref, entityType, role: ROLE_OF_ENTITY_TYPE[entityType] || entityType, label: item.title || item.itemKey };
    })
    .filter(Boolean) as Array<{ ref: string; entityType: string; role: string; label: string }>;

  if (!bundleEntities.length) return { synthText: null, groups: [] };

  // Pick the composition from the first clicked item whose entity_type actually
  // has one. A gate-column row dispatches [hd_planets, hd_gates, …]; hd_planet
  // has no card composition (it's legacy), so we must skip past it to hd_gate so
  // its synth resolves — exactly like a bodygraph gate click. Astrology rows lead
  // with astro_planets, which keeps its own composition. This is what lets a
  // combined chart drive HD and astrology placements from separate card setups.
  const hasComp = (t: string): boolean => {
    const c = t ? opts.compositionFor(t) : null;
    return !!(c && (c.synth || (c.boxes && c.boxes.length)));
  };
  let primaryType = '';
  for (const it of items) {
    const t = SECTION_TO_ENTITY_TYPE[it.sectionType] || '';
    if (hasComp(t)) { primaryType = t; break; }
  }
  if (!primaryType) primaryType = SECTION_TO_ENTITY_TYPE[items[0]?.sectionType] || '';
  const composition = opts.compositionFor(primaryType);
  const synthTemplate = composition?.synth || opts.sidebarTemplate || undefined;
  const activeEntities = bundleEntities.map((e) => e.ref);
  const shared = { set_id: opts.set_id, tone_key: opts.tone_key };

  // 2) Synth weave over the whole bundle.
  const synthPromise = synthTemplate
    ? resolveCoreDefinition({
        set_id: opts.set_id,
        module_id: opts.module_id || 'luna-astrohd',
        output_context: 'full_sidebar',
        template_key: synthTemplate,
        active_entities: activeEntities,
        chart_context: opts.chart_context,
      }).catch(() => null)
    : Promise.resolve(null);

  // 3) Standalone boxes from the composition.
  const allBoxes = composition?.boxes || [];
  const slotBoxes = allBoxes.filter((b) => b.kind === 'slot');
  const templateBoxes = allBoxes.filter((b) => b.kind === 'template');

  // A box's effective target list: explicit `targets` (checkbox selection) wins,
  // else the single legacy `target`.
  const boxTargets = (b: { target: string; targets?: string[] }): string[] =>
    (b.targets && b.targets.length ? b.targets : [b.target]);
  const matchesTarget = (b: { target: string; targets?: string[] }, role: string) =>
    boxTargets(b).some((t) => t === 'bundle' || t === role);

  // Per-entity slot lists (composition order), honoring each box's target role(s).
  const perEntity = bundleEntities
    .map((e) => ({
      ref: e.ref,
      label: e.label,
      sectionType: e.entityType,
      slots: slotBoxes.filter((b) => matchesTarget(b, e.role)).map((b) => b.key),
    }))
    .filter((e) => e.slots.length);

  // Fallback: a card with neither synth nor boxes still shows the essence so the
  // sidebar is never blank.
  let slotGroupsPromise: Promise<ResolvedEntityGroup[]>;
  if (!perEntity.length && !synthTemplate && !templateBoxes.length) {
    const fallback = bundleEntities.map((e) => ({ ref: e.ref, label: e.label, sectionType: e.entityType, slots: ['short_def'] }));
    slotGroupsPromise = resolveCardGroups(fallback, shared).catch(() => []);
  } else {
    slotGroupsPromise = perEntity.length ? resolveCardGroups(perEntity, shared).catch(() => []) : Promise.resolve([]);
  }

  const tmplPromises = templateBoxes.map((b) => {
    const targets = bundleEntities.filter((e) => matchesTarget(b, e.role));
    if (!targets.length) return Promise.resolve(null);
    return resolveCoreDefinition({
      set_id: opts.set_id,
      module_id: opts.module_id || 'luna-astrohd',
      output_context: 'full_sidebar',
      template_key: b.key,
      active_entities: targets.map((e) => e.ref),
      chart_context: opts.chart_context,
    })
      .then((r) => (r?.rendered_text ? { box: b, targets, text: r.rendered_text } : null))
      .catch(() => null);
  });

  const [synth, slotGroups, tmplResults] = await Promise.all([
    synthPromise,
    slotGroupsPromise,
    Promise.all(tmplPromises),
  ]);

  const groups: ResolvedEntityGroup[] = (slotGroups || []).filter((g) => g.boxes.length);
  tmplResults.forEach((r) => {
    if (!r) return;
    groups.push({
      label: r.box.label || r.targets[0]?.label || 'Reading',
      sectionType: r.targets[0]?.entityType || primaryType,
      boxes: [{ slot_key: r.box.key, title: r.box.label || '', entry_key: '', value: r.text }],
    });
  });

  const synthText = synth?.rendered_text?.trim() ? synth.rendered_text : null;

  // Nothing resolved (e.g. the composition's synth template is missing from this
  // set) — fall back to each entity's essence so the sidebar is never blank.
  if (!synthText && !groups.length) {
    const fallback = bundleEntities.map((e) => ({ ref: e.ref, label: e.label, sectionType: e.entityType, slots: ['short_def'] }));
    const fb = await resolveCardGroups(fallback, shared).catch(() => []);
    return { synthText: null, groups: fb.filter((g) => g.boxes.length) };
  }

  return { synthText, groups };
}
