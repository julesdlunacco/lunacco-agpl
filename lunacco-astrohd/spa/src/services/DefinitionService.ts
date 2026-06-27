/**
 * DefinitionService
 * 
 * Logic to fetch and cache astrological and human design definitions 
 * from the WordPress REST API.
 */

export interface Definition {
    id: number;
    section_type: string;
    item_key: string;
    title: string;
    short_text: string;
    long_text: string;
    keywords: string;
    extra_meta: Record<string, any> | null;
    image_url: string;
}

export interface CoreResolvedSlot {
    slot_key: string;
    title: string;
    entry_key: string;
    value: string;
}

export interface CoreDefinitionResolution {
    mode: string;
    rendered_text: string;
    visible_slots?: CoreResolvedSlot[];
    display_boxes?: CoreResolvedSlot[];
    matched_entries?: any[];
    matched_variants?: string[];
    matched_modifiers?: string[];
    chart_preset?: any;
}

const REST_ROOT = (() => {
    const d = (window as any).LunaCcoData || {};
    return (d.root || '/wp-json/').replace(/\/$/, '') + '/';
})();

const NONCE = ((window as any).LunaCcoData || {}).nonce || '';

// In-memory cache for definitions to avoid redundant network calls
const cache: Record<string, Definition[]> = {};
const activeSetCache: Record<string, number> = {};
const resolutionCache: Record<string, any> = {};
const cardGroupsCache: Record<string, any> = {};

export async function getActiveCoreSetId(moduleId: string = 'luna-astrohd'): Promise<number> {
    if (activeSetCache[moduleId]) return activeSetCache[moduleId];

    const activeRes = await fetch(`${REST_ROOT}lunacco/v1/definitions/module-active-set?module_id=${encodeURIComponent(moduleId)}`, {
        headers: {
            'X-WP-Nonce': NONCE,
            'Content-Type': 'application/json'
        }
    });

    if (!activeRes.ok) return 0;

    const activeSet = await activeRes.json();
    const setId = Number(activeSet?.id || 0);
    if (setId > 0) activeSetCache[moduleId] = setId;
    return setId;
}

export async function fetchDefinitions(
    setId: number = 0,
    options: { source?: 'legacy' | 'core'; coreSetId?: number; moduleId?: string } = {}
): Promise<Definition[]> {
    const source = options.source || 'legacy';
    let coreSetId = Number(options.coreSetId || 0);
    const moduleId = options.moduleId || 'luna-astrohd';
    if (source === 'core' && coreSetId <= 0) {
        coreSetId = await getActiveCoreSetId(moduleId);
    }
    const cacheKey = source === 'core' ? `core-set-${coreSetId}` : `set-${setId}`;
    if (cache[cacheKey]) return cache[cacheKey];

    const url = source === 'core'
        ? `${REST_ROOT}luna-astrohd/v1/definitions?engine=core&core_set_id=${coreSetId}`
        : (setId > 0 
            ? `${REST_ROOT}luna-astrohd/v1/definitions?set_id=${setId}`
            : `${REST_ROOT}luna-astrohd/v1/definitions`);

    const res = await fetch(url, {
        headers: {
            'X-WP-Nonce': NONCE,
            'Content-Type': 'application/json'
        }
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch definitions: ${res.statusText}`);
    }

    const data = await res.json();
    // console.log(`[DefinitionService] Fetched ${data.length} definitions for ${source} set ${source === 'core' ? coreSetId : setId}`);
    cache[cacheKey] = data;
    return data;
}

export async function resolveCoreDefinition(payload: {
    set_id?: number;
    module_id?: string;
    output_context?: string;
    template_key?: string;
    chart_preset_id?: number;
    chart_preset_key?: string;
    active_entities?: Array<string | { module_id: string; entity_type: string; entity_key: string; role_key?: string }>;
    chart_context?: string;
    variants?: string[];
    modifiers?: Record<string, string | string[]> | string[];
}): Promise<CoreDefinitionResolution | null> {
    const moduleId = payload.module_id || 'luna-astrohd';
    const setId = Number(payload.set_id || await getActiveCoreSetId(moduleId));
    if (setId <= 0) return null;

    const cacheKey = 'core_def_v3_' + JSON.stringify({ ...payload, set_id: setId, module_id: moduleId });
    if (resolutionCache[cacheKey]) {
        return resolutionCache[cacheKey];
    }
    try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            resolutionCache[cacheKey] = parsed;
            return parsed;
        }
    } catch (e) {}

    const res = await fetch(`${REST_ROOT}lunacco/v1/definitions/resolve`, {
        method: 'POST',
        headers: {
            'X-WP-Nonce': NONCE,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ...payload,
            set_id: setId,
            module_id: moduleId,
        })
    });

    if (!res.ok) {
        // console.warn(`[DefinitionService] Core resolver failed: ${res.statusText}`);
        return null;
    }

    const data = await res.json();
    resolutionCache[cacheKey] = data;
    try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (e) {}
    return data;
}

/**
 * Resolve a definition for a specific item.
 * 
 * @param definitions List of all definitions (usually from a set)
 * @param sectionType e.g. 'hd_gates', 'astro_planets'
 * @param itemKey e.g. '1', 'sun'
 */
export function resolveDefinition(
    definitions: Definition[], 
    sectionType: string, 
    itemKey: string
): Definition | null {
    if (!itemKey) return null;

    const normalizedKey = itemKey.toLowerCase();
    
    // Mapping for common human design terms to scaffold keys
    const keyMap: Record<string, string> = {
        'manifesting generator': 'mg',
        'generator': 'generator',
        'manifestor': 'manifestor',
        'projector': 'projector',
        'reflector': 'reflector',
        'single definition': 'single',
        'split definition': 'split',
        'triple split definition': 'triple-split',
        'quad split definition': 'quad-split',
        'no definition': 'no-definition',
        'single': 'single',
        'split': 'split',
        'triple split': 'triple-split',
        'quad split': 'quad-split',
        'triple': 'triple-split',
        'quad': 'quad-split',
        'northnode': 'north-node',
        'southnode': 'south-node',
        'north node': 'north-node',
        'south node': 'south-node',
        'ascendant': 'asc',
        'descendant': 'dsc',
        'midheaven': 'mc',
        'imum coeli': 'ic',
        'black moon lilith': 'lilith'
    };

    const targetKey = keyMap[normalizedKey] || normalizedKey;
    // Replace spaces and slashes with dashes, then remove non-alphanumeric (except dashes)
    const slugKey = targetKey.toLowerCase().replace(/[\s\/]+/g, '-').replace(/[^a-z0-9-]/g, '');
    const normalized = targetKey.toLowerCase().replace(/[\/\s]+/g, '-');

    // console.log(`[DefinitionService] Resolving: ${sectionType} -> ${itemKey} (Target: ${targetKey}, Normalized: ${normalized})`);
    
    // 1. Try exact match (normalized)
    let match = definitions.find(d => 
        d.section_type === sectionType && 
        d.item_key.toLowerCase().replace(/[\/\s]+/g, '-') === normalized
    );
    // if (match) console.log(`[DefinitionService] Found exact match: ${match.item_key}`);

    // 2. Try slugified match
    if (!match) {
        match = definitions.find(d => 
            d.section_type === sectionType && 
            d.item_key.toLowerCase().replace(/[\/\s]+/g, '-') === slugKey
        );
        // if (match) console.log(`[DefinitionService] Found slug match: ${match.item_key}`);
    }

    // 3. Special case for Profiles: try matching by starting with the profile (e.g. "1/3" matches "1/3-Fixed")
    if (!match && sectionType === 'hd_profiles') {
        // If split modality, try individual ones
        if (normalized.split('-').length > 3) {
            const parts = normalized.split('-'); // [1, 4, cardinal, fixed]
            const base = `${parts[0]}-${parts[1]}`;
            for (let i = 2; i < parts.length; i++) {
                const variant = `${base}-${parts[i]}`;
                // console.log(`[DefinitionService] Trying profile variant: ${variant}`);
                match = definitions.find(d => d.item_key.toLowerCase().replace(/[\/\s]+/g, '-') === variant);
                if (match) break;
            }
        }
        
        // If still no match, try matching just the numeric part (e.g. "1-3")
        if (!match) {
            const parts = normalized.split('-');
            if (parts.length >= 2) {
                const numericKey = `${parts[0]}-${parts[1]}`;
                // console.log(`[DefinitionService] Trying numeric-only profile: ${numericKey}`);
                match = definitions.find(d => {
                    const dKey = d.item_key.toLowerCase().replace(/[\/\s]+/g, '-');
                    // Stricter check: must be exactly "1-4" or "1-4-something"
                    return dKey === numericKey || dKey.startsWith(numericKey + '-');
                });
            }
        }
        // if (match) console.log(`[DefinitionService] Found profile fallback match: ${match.item_key}`);
    }

    if (match) {
        return match;
    }

    // Fallback for Human Design planets which might be split by Personality/Design
    if (sectionType === 'hd_planets' || sectionType === 'hd_angles_points') {
        const personalityKey = `personality-${itemKey.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
        const designKey = `design-${itemKey.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
        
        const altMatch = definitions.find(d => 
            d.section_type === sectionType && 
            (d.item_key.toLowerCase() === personalityKey || d.item_key.toLowerCase() === designKey)
        );
        if (altMatch) {
            // console.log(`[DefinitionService] Resolved (Alt): ${sectionType} -> ${itemKey}`);
            return altMatch;
        }
    }

    // console.warn(`[DefinitionService] Failed to resolve: ${sectionType} -> ${itemKey} (Target: ${targetKey}, Slug: ${slugKey})`);
    
    // const available = definitions
    //     .filter(d => d.section_type === sectionType)
    //     .map(d => d.item_key);
    // console.log(`[DefinitionService] Available keys in ${sectionType}:`, available);

    return null;
}

/**
 * Resolve multiple definitions at once.
 */
export function resolveDefinitions(
    definitions: Definition[],
    items: { sectionType: string, itemKey: string }[]
): Definition[] {
    return items
        .map(item => resolveDefinition(definitions, item.sectionType, item.itemKey))
        .filter((d): d is Definition => d !== null);
}

export const SECTION_TO_ENTITY_TYPE: Record<string, string> = {
    hd_gates: 'hd_gate',
    hd_channels: 'hd_channel',
    hd_centers: 'hd_center',
    hd_types: 'hd_type',
    hd_authorities: 'hd_authority',
    hd_profiles: 'hd_profile',
    hd_lines: 'hd_line',
    hd_definition_types: 'hd_definition_type',
    hd_planets: 'hd_planet',
    hd_angles_points: 'hd_angle_point',
    hd_variables: 'hd_variable',
    hd_variable_colors: 'hd_variable_color',
    hd_variable_tones: 'hd_variable_tone',
    hd_circuitry: 'hd_circuitry',
    hd_incarnation_crosses: 'hd_incarnation_cross',
    astro_planets: 'astro_planet',
    astro_signs: 'astro_sign',
    astro_houses: 'astro_house',
    astro_aspects: 'astro_aspect',
    astro_angles_points: 'astro_angle_point',
    astro_elements: 'astro_element',
    astro_modalities: 'astro_modality',
    astro_dignities: 'astro_dignity',
    astro_planetary_conditions: 'astro_planetary_condition',
    astro_chart_patterns: 'astro_chart_pattern',
    astro_moon_phases: 'astro_moon_phase',
    astro_stelliums: 'astro_stellium',
    hd_destiny_points: 'hd_destiny_point',
    angel_shem: 'angel_shem',
};

/**
 * Normalize an astrohd entity key to match how the core engine stores it
 * (mirrors LunaCco_Definition_Engine::normalize_astrohd_entity_key). Without
 * this, houses/centers won't resolve (e.g. "1" vs "house_1", "g-center" vs "g_center").
 */
function normalizeAstrohdEntityKey(entityType: string, key: string): string {
    // personality-/design- prefixes recurse on the remainder
    const sideMatch = key.match(/^(personality|design)-(.+)$/);
    if (sideMatch) return `${sideMatch[1]}-${normalizeAstrohdEntityKey(entityType, sideMatch[2])}`;
    if (entityType === 'astro_house' && /^[0-9]+$/.test(key)) return `house_${key}`;
    if (entityType === 'hd_center') {
        const map: Record<string, string> = { 'g-center': 'g_center', 'solar-plexus': 'solar_plexus', 'ego': 'heart' };
        return map[key] || key;
    }
    if (entityType === 'astro_planet' || entityType === 'hd_planet') {
        // Nodes / Lilith come through as collapsed names; map to the seeded keys.
        const map: Record<string, string> = {
            northnode: 'north-node', 'north-node': 'north-node',
            southnode: 'south-node', 'south-node': 'south-node',
            'black-moon-lilith': 'lilith', blackmoonlilith: 'lilith',
        };
        return map[key] || key;
    }
    return key;
}

/**
 * Display-name → authored-slug maps for the HD "identity" entity types. The chart
 * provides human labels ("Manifesting Generator", "Single Definition"); the seeded
 * entities use compact slugs (mg, single). Without this, Type/Definition cards
 * resolve nothing.
 */
const HD_IDENTITY_KEYMAP: Record<string, Record<string, string>> = {
    hd_type: {
        'manifesting generator': 'mg', 'manifesting-generator': 'mg', 'mani gen': 'mg', 'mg': 'mg',
        'generator': 'generator', 'manifestor': 'manifestor', 'projector': 'projector', 'reflector': 'reflector',
    },
    hd_definition_type: {
        'single': 'single', 'single definition': 'single',
        'split': 'split', 'split definition': 'split',
        'triple split': 'triple-split', 'triple-split': 'triple-split', 'triple split definition': 'triple-split',
        'quad split': 'quad-split', 'quad-split': 'quad-split', 'quad split definition': 'quad-split',
        'no definition': 'no-definition', 'none': 'no-definition', 'no-definition': 'no-definition',
    },
};

export function sectionItemToEntityRef(sectionType: string, itemKey: string): string | null {
    const entityType = SECTION_TO_ENTITY_TYPE[sectionType];
    if (!entityType || !itemKey) return null;
    const raw = String(itemKey).toLowerCase().trim();

    // Identity types: map the display label to its seeded slug.
    const idMap = HD_IDENTITY_KEYMAP[entityType];
    if (idMap && idMap[raw]) {
        return `luna-astrohd:${entityType}:${idMap[raw]}`;
    }

    // Incarnation crosses are keyed by the bare name with all separators stripped
    // ("Right Angle Cross of The Unexpected 4" → "rightanglecrossoftheunexpected4").
    if (entityType === 'hd_incarnation_cross') {
        return `luna-astrohd:${entityType}:${raw.replace(/[^a-z0-9]/g, '')}`;
    }

    // Profiles seed as "1/4-Fixed" → stored "14-fixed" (two line digits JOINED, then the
    // modality). The chart may hand us "1/4-Fixed" or "1-4-Fixed"; either way pull the two
    // digits + modality so the modality is always carried through.
    if (entityType === 'hd_profile') {
        // Extract the two line digits and the modality independently (the chart sends
        // "1 / 4-Fixed"); join digits, append modality → "14-fixed".
        const digits = raw.match(/(\d)\D*?(\d)/);
        const modm = raw.match(/(fixed|mutable|cardinal)/);
        if (digits) {
            const mod = modm ? `-${modm[1]}` : '';
            return `luna-astrohd:${entityType}:${digits[1]}${digits[2]}${mod}`;
        }
        const pk = raw.replace(/[\/\s-]+/g, '').replace(/[^a-z0-9]/g, '');
        return `luna-astrohd:${entityType}:${pk}`;
    }

    const key = raw
        .replace(/[\s\/]+/g, '-')
        .replace(/[^a-z0-9_-]/g, '');
    return `luna-astrohd:${entityType}:${normalizeAstrohdEntityKey(entityType, key)}`;
}

/** A resolved slot box for the editorial sidebar (resolve-slots based). */
export interface ResolvedSlotBox {
    slot_key: string;
    title: string;
    entry_key: string;
    value: string;
}

/**
 * Batch-resolve specific slots for a set of entity refs using the core
 * `resolve-slots` endpoint. This honors the directly-chosen slot list (and
 * tone) rather than the legacy preset display_boxes path.
 *
 * @param refs   entity refs like "luna-astrohd:hd_gate:1"
 * @param slots  ordered slot keys, e.g. ['short_def','gift']
 */
export async function resolveSlotsForRefs(
    refs: string[],
    slots: string[],
    opts: { set_id?: number; module_id?: string; tone_key?: string } = {}
): Promise<ResolvedSlotBox[]> {
    const moduleId = opts.module_id || 'luna-astrohd';
    const setId = Number(opts.set_id || await getActiveCoreSetId(moduleId));
    if (setId <= 0 || !refs.length || !slots.length) return [];

    // Build one request per (entity, slot). Track the slot_key per request index.
    const requests: any[] = [];
    const slotKeys: string[] = [];
    for (const ref of refs) {
        const parts = ref.split(':');
        if (parts.length !== 3) continue;
        const [, entity_type, entity_key] = parts;
        for (const slot of slots) {
            requests.push({ entity_type, entity_key, layer: slot });
            slotKeys.push(slot);
        }
    }
    if (!requests.length) return [];

    const shared: any = { set_id: setId, module_id: moduleId };
    if (opts.tone_key && opts.tone_key !== 'default') shared.tone_key = opts.tone_key;

    const res = await fetch(`${REST_ROOT}lunacco/v1/definitions/resolve-slots`, {
        method: 'POST',
        headers: { 'X-WP-Nonce': NONCE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests, shared }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results: any[] = data?.results || [];
    return results
        .map((r, i) => ({
            slot_key: slotKeys[i],
            title: '',
            entry_key: String(r?.entry_key || ''),
            value: String(r?.value || ''),
        }))
        .filter((b) => b.value && b.value.trim());
}

/** Resolved slots grouped under a single clicked entity (for a labeled sidebar). */
export interface ResolvedEntityGroup {
    label: string;        // friendly title, e.g. "Gate 5" or "Personality Sun"
    sectionType: string;  // e.g. "hd_gate", "astro_sign"
    boxes: ResolvedSlotBox[];
}

/**
 * Resolve the chosen slots for several labeled entities, keeping the results
 * grouped per entity so the sidebar can show a header for each (sign vs gate vs
 * planet, etc.). One batch round-trip; split back out by entity afterwards.
 */
export async function resolveEntityGroups(
    entities: Array<{ ref: string; label: string; sectionType: string }>,
    slots: string[],
    opts: { set_id?: number; module_id?: string; tone_key?: string } = {}
): Promise<ResolvedEntityGroup[]> {
    const moduleId = opts.module_id || 'luna-astrohd';
    const setId = Number(opts.set_id || await getActiveCoreSetId(moduleId));
    const valid = entities.filter((e) => e.ref && e.ref.split(':').length === 3);
    if (setId <= 0 || !valid.length || !slots.length) return [];

    const requests: any[] = [];
    const map: Array<{ groupIdx: number; slot: string }> = [];
    valid.forEach((e, gi) => {
        const [, entity_type, entity_key] = e.ref.split(':');
        slots.forEach((slot) => {
            requests.push({ entity_type, entity_key, layer: slot });
            map.push({ groupIdx: gi, slot });
        });
    });

    const shared: any = { set_id: setId, module_id: moduleId };
    if (opts.tone_key && opts.tone_key !== 'default') shared.tone_key = opts.tone_key;

    const res = await fetch(`${REST_ROOT}lunacco/v1/definitions/resolve-slots`, {
        method: 'POST',
        headers: { 'X-WP-Nonce': NONCE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests, shared }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results: any[] = data?.results || [];

    const groups: ResolvedEntityGroup[] = valid.map((e) => ({
        label: e.label,
        sectionType: e.sectionType,
        boxes: [],
    }));
    results.forEach((r, i) => {
        const value = String(r?.value || '');
        if (!value.trim()) return;
        const { groupIdx, slot } = map[i];
        groups[groupIdx].boxes.push({ slot_key: slot, title: '', entry_key: String(r?.entry_key || ''), value });
    });
    return groups.filter((g) => g.boxes.length);
}

/**
 * Like resolveEntityGroups, but each entity carries its OWN ordered slot list.
 * This is what powers per-card-type templates: a gate resolves short_def+long_def,
 * an aspect resolves aspect_short+aspect_long, etc. — all in one batch round-trip,
 * split back out per entity afterwards.
 */
export async function resolveCardGroups(
    entities: Array<{ ref: string; label: string; sectionType: string; slots: string[] }>,
    opts: { set_id?: number; module_id?: string; tone_key?: string } = {}
): Promise<ResolvedEntityGroup[]> {
    const moduleId = opts.module_id || 'luna-astrohd';
    const setId = Number(opts.set_id || await getActiveCoreSetId(moduleId));
    const valid = entities.filter((e) => e.ref && e.ref.split(':').length === 3 && Array.isArray(e.slots) && e.slots.length);
    if (setId <= 0 || !valid.length) return [];

    const cacheKey = 'card_groups_v3_' + JSON.stringify({ valid, opts, set_id: setId, module_id: moduleId });
    if (cardGroupsCache[cacheKey]) {
        return cardGroupsCache[cacheKey];
    }
    try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            cardGroupsCache[cacheKey] = parsed;
            return parsed;
        }
    } catch (e) {}

    const requests: any[] = [];
    const map: Array<{ groupIdx: number; slot: string }> = [];
    valid.forEach((e, gi) => {
        const [, entity_type, entity_key] = e.ref.split(':');
        e.slots.forEach((slot) => {
            requests.push({ entity_type, entity_key, layer: slot });
            map.push({ groupIdx: gi, slot });
        });
    });
    if (!requests.length) return [];

    const shared: any = { set_id: setId, module_id: moduleId };
    if (opts.tone_key && opts.tone_key !== 'default') shared.tone_key = opts.tone_key;

    const res = await fetch(`${REST_ROOT}lunacco/v1/definitions/resolve-slots`, {
        method: 'POST',
        headers: { 'X-WP-Nonce': NONCE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests, shared }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results: any[] = data?.results || [];

    const groups: ResolvedEntityGroup[] = valid.map((e) => ({ label: e.label, sectionType: e.sectionType, boxes: [] }));
    results.forEach((r, i) => {
        const value = String(r?.value || '');
        if (!value.trim()) return;
        const { groupIdx, slot } = map[i];
        groups[groupIdx].boxes.push({ slot_key: slot, title: '', entry_key: String(r?.entry_key || ''), value });
    });

    cardGroupsCache[cacheKey] = groups;
    try {
        sessionStorage.setItem(cacheKey, JSON.stringify(groups));
    } catch (e) {}
    return groups;
}

/** A synthesis template summary for the composer's template selectors. */
export interface TemplateSummary {
    id: number;
    template_key: string;
    title?: string;
    output_context?: string;
    render_mode?: string;
}

/**
 * List the token templates available in a set (for the synth-box and
 * template-box selectors in the card composer).
 */
export async function fetchTemplates(opts: { set_id?: number; module_id?: string } = {}): Promise<TemplateSummary[]> {
    const moduleId = opts.module_id || 'luna-astrohd';
    const setId = Number(opts.set_id || await getActiveCoreSetId(moduleId));
    if (setId <= 0) return [];
    const res = await fetch(`${REST_ROOT}lunacco/v1/definitions/templates?set_id=${setId}&module_id=${encodeURIComponent(moduleId)}`, {
        headers: { 'X-WP-Nonce': NONCE, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows: any[] = Array.isArray(data) ? data : (data?.templates || []);
    return rows
        .map((r) => ({
            id: Number(r?.id || 0),
            template_key: String(r?.template_key || ''),
            title: r?.title ? String(r.title) : undefined,
            output_context: r?.output_context ? String(r.output_context) : undefined,
            render_mode: r?.render_mode ? String(r.render_mode) : undefined,
        }))
        .filter((t) => t.template_key);
}

/** Definition set summary for the set picker. */
export interface DefinitionSetSummary {
    id: number;
    slug: string;
    label: string;
    is_default?: number | boolean;
}

/**
 * List the core definition sets associated with this module (for the Chart
 * Maker set selector). Uses the astrohd wrapper around
 * list_sets_for_module('luna-astrohd'), matching what DefinitionsView shows,
 * and falls back to the global core sets endpoint.
 */
export async function fetchSets(): Promise<DefinitionSetSummary[]> {
    const tryUrl = async (url: string): Promise<DefinitionSetSummary[]> => {
        const res = await fetch(`${REST_ROOT}${url}`, {
            headers: { 'X-WP-Nonce': NONCE, 'Content-Type': 'application/json' },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : (data?.sets || []);
    };
    const moduleSets = await tryUrl('luna-astrohd/v1/core-definition-sets').catch(() => []);
    if (moduleSets.length) return moduleSets;
    return tryUrl('lunacco/v1/definitions/sets').catch(() => []);
}

/**
 * Parse structured markdown content from a definition's long_text.
 * Sections are defined by ### headers.
 */
export function parseDefinitionMarkdown(markdown: string): { sections: { title: string, content: string }[] } {
    const sections: { title: string, content: string }[] = [];
    if (!markdown) return { sections };

    // If no ### headers, treat everything as "Description"
    if (!markdown.includes('###')) {
        sections.push({ title: 'Description', content: markdown.trim() });
        return { sections };
    }

    const parts = markdown.split(/^###\s+/m);
    parts.forEach(part => {
        if (!part.trim()) return;
        const lines = part.split('\n');
        const header = lines[0].trim();
        const content = lines.slice(1).join('\n').trim();
        if (header) {
            sections.push({ title: header, content });
        }
    });

    return { sections };
}

export function getCoreDefinitionCache(payload: {
    set_id?: number;
    module_id?: string;
    output_context?: string;
    template_key?: string;
    chart_preset_id?: number;
    chart_preset_key?: string;
    active_entities?: Array<string | { module_id: string; entity_type: string; entity_key: string; role_key?: string }>;
    chart_context?: string;
    variants?: string[];
    modifiers?: Record<string, string | string[]> | string[];
}): CoreDefinitionResolution | null {
    const moduleId = payload.module_id || 'luna-astrohd';
    const setId = payload.set_id || 0;
    if (setId <= 0) return null;
    const cacheKey = 'core_def_v3_' + JSON.stringify({ ...payload, set_id: setId, module_id: moduleId });
    if (resolutionCache[cacheKey]) return resolutionCache[cacheKey];
    try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            resolutionCache[cacheKey] = parsed;
            return parsed;
        }
    } catch (e) {}
    return null;
}

export function getCardGroupsCache(
    entities: Array<{ ref: string; label: string; sectionType: string; slots: string[] }>,
    opts: { set_id?: number; module_id?: string; tone_key?: string } = {}
): ResolvedEntityGroup[] | null {
    const moduleId = opts.module_id || 'luna-astrohd';
    const setId = opts.set_id || 0;
    if (setId <= 0) return null;
    const valid = entities.filter((e) => e.ref && e.ref.split(':').length === 3 && Array.isArray(e.slots) && e.slots.length);
    const cacheKey = 'card_groups_v3_' + JSON.stringify({ valid, opts, set_id: setId, module_id: moduleId });
    if (cardGroupsCache[cacheKey]) return cardGroupsCache[cacheKey];
    try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            cardGroupsCache[cacheKey] = parsed;
            return parsed;
        }
    } catch (e) {}
    return null;
}
