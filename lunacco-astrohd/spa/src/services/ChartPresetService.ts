/**
 * ChartPresetService
 *
 * Thin REST client over the core Definition Engine chart-presets routes. A
 * Chart Maker preset is a ChartConfig stored in `config_json`; the relational
 * columns (preset_key / title / chart_type / output_context / set_id) mirror
 * the most-queried fields.
 *
 * Routes (registered in lunacco-core/includes/class-rest-api.php):
 *   GET    lunacco/v1/definitions/chart-presets?set_id=
 *   POST   lunacco/v1/definitions/chart-presets        (upsert by set_id + preset_key)
 *   DELETE lunacco/v1/definitions/chart-presets/{id}
 */

import { ChartConfig, normalizeChartConfig } from './chartConfig';
import { getActiveCoreSetId } from './DefinitionService';

const REST_ROOT = (() => {
  const d = (window as any).LunaCcoData || {};
  return (d.root || '/wp-json/').replace(/\/$/, '') + '/';
})();

const NONCE = ((window as any).LunaCcoData || {}).nonce || '';
const MODULE_ID = 'luna-astrohd';

/** A persisted preset row as returned by the core API. */
export interface ChartPresetRow {
  id: number;
  set_id: number;
  module_id: string;
  preset_key: string;
  title: string;
  description?: string;
  chart_type: string;
  output_context: string;
  is_enabled: number;
  sort_order: number;
  config: Partial<ChartConfig>;       // decoded config_json
  config_json: Partial<ChartConfig>;  // same payload, alternate key
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(REST_ROOT + path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': NONCE,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error((body && body.message) || `${res.status} ${res.statusText}`);
  return body as T;
}

/** List all chart presets for a set (defaults to the module-active set). */
export async function listChartPresets(setId?: number): Promise<ChartPresetRow[]> {
  const resolvedSet = setId || (await getActiveCoreSetId(MODULE_ID));
  if (!resolvedSet) return [];
  return api<ChartPresetRow[]>(`lunacco/v1/definitions/chart-presets?set_id=${resolvedSet}`);
}

/** Convert a persisted row into a complete, normalized ChartConfig. */
export function rowToChartConfig(row: ChartPresetRow): ChartConfig {
  const cfg = normalizeChartConfig(row.config || row.config_json);
  // Trust the relational columns for the headline fields.
  cfg.preset_key = row.preset_key || cfg.preset_key;
  cfg.title = row.title || cfg.title;
  if (row.set_id) cfg.set_id = row.set_id;
  if (row.chart_type) cfg.chart_type = row.chart_type as ChartConfig['chart_type'];
  if (row.output_context) cfg.output_context = row.output_context;
  return cfg;
}

/**
 * Save (create or update) a chart preset. Upserts by (set_id, preset_key) so
 * saving the same preset_key overwrites. Returns the persisted ChartConfig.
 */
export async function saveChartPreset(cfg: ChartConfig): Promise<ChartConfig> {
  const setId = cfg.set_id || (await getActiveCoreSetId(MODULE_ID));
  if (!setId) throw new Error('No definition set available to save the preset into.');
  if (!cfg.preset_key) throw new Error('A preset key is required to save.');

  const row = await api<ChartPresetRow>('lunacco/v1/definitions/chart-presets', {
    method: 'POST',
    body: JSON.stringify({
      set_id: setId,
      module_id: MODULE_ID,
      preset_key: cfg.preset_key,
      title: cfg.title,
      chart_type: cfg.chart_type,
      output_context: cfg.output_context || 'full_chart',
      config_json: { ...cfg, set_id: setId },
    }),
  });
  return rowToChartConfig(row);
}

/** Delete a chart preset by id. */
export async function deleteChartPreset(id: number): Promise<boolean> {
  const res = await api<{ success: boolean }>(`lunacco/v1/definitions/chart-presets/${id}`, {
    method: 'DELETE',
  });
  return !!res?.success;
}

/** Load a single preset's ChartConfig by preset_key (within a set). */
export async function loadChartConfig(presetKey: string, setId?: number): Promise<ChartConfig | null> {
  const presets = await listChartPresets(setId);
  const match = presets.find((p) => p.preset_key === presetKey);
  return match ? rowToChartConfig(match) : null;
}
