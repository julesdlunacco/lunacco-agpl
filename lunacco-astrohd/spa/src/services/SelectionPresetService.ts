/**
 * SelectionPresetService
 *
 * Admin-defined "selection layouts" — a named set of included asteroids and
 * planets (per side) for quick application in the Chart Maker, e.g. "Base 5",
 * "Goddess", "Big 3 only". Persisted site-wide via the module REST API.
 */

const REST_ROOT = (() => {
  const d = (window as any).LunaCcoData || {};
  return (d.root || '/wp-json/').replace(/\/$/, '') + '/';
})();
const NONCE = (() => ((window as any).LunaCcoData || {}).nonce || '')();

async function fetchJSON(path: string, init: RequestInit = {}) {
  const res = await fetch(REST_ROOT + path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': NONCE,
      ...((init as any).headers || {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error((body && body.message) || `${res.status}`);
  return body;
}

export interface SelectionPreset {
  key: string;
  name: string;
  asteroids: string[];
  /** Planet allow-list for the personality side. [] = none, omitted/[] handled by caller. */
  planets_personality: string[];
  /** Planet allow-list for the design side. */
  planets_design: string[];
}

export async function listSelectionPresets(): Promise<SelectionPreset[]> {
  const rows = await fetchJSON('luna-astrohd/v1/selection-presets');
  return Array.isArray(rows) ? rows : [];
}

export async function saveSelectionPreset(p: SelectionPreset): Promise<SelectionPreset[]> {
  const body = await fetchJSON('luna-astrohd/v1/selection-presets', {
    method: 'POST',
    body: JSON.stringify(p),
  });
  return body?.presets || [];
}

export async function deleteSelectionPreset(key: string): Promise<SelectionPreset[]> {
  const body = await fetchJSON(`luna-astrohd/v1/selection-presets/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
  return body?.presets || [];
}
