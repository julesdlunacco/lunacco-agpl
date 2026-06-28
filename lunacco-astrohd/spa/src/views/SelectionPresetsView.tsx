/**
 * SelectionPresetsView
 *
 * Admin-only editor for "selection layouts" — named sets of included asteroids
 * and planets (per side) that can be quickly applied in the Chart Maker, the
 * same way the built-in "Base 5" / "Goddess" asteroid quick-picks work, but
 * user-defined and persisted site-wide.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { PLANET_CATALOG } from '../services/chartConfig';
import { ASTEROID_CATALOG } from '../services/asteroidCatalog';
import {
  SelectionPreset,
  listSelectionPresets,
  saveSelectionPreset,
  deleteSelectionPreset,
} from '../services/SelectionPresetService';

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const emptyDraft = (): SelectionPreset => ({
  key: '', name: '', asteroids: [], planets_personality: [...PLANET_CATALOG], planets_design: [...PLANET_CATALOG],
});

function CheckGrid({ options, selected, onToggle, columns = 'repeat(auto-fill, minmax(140px, 1fr))' }: {
  options: string[]; selected: string[]; onToggle: (name: string) => void; columns?: string;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns, gap: 2 }}>
      {options.map((name) => (
        <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink)', cursor: 'pointer', padding: '2px 0' }}>
          <input type="checkbox" checked={selected.includes(name)} onChange={() => onToggle(name)} />
          {name}
        </label>
      ))}
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--gold)', margin: '0 0 8px',
};
const rowBtns: React.CSSProperties = { display: 'flex', gap: 6, marginBottom: 8 };
const smallBtn: React.CSSProperties = { fontSize: 11, padding: '4px 10px', border: '1px solid var(--hair)', borderRadius: 8, background: 'var(--card)', cursor: 'pointer' };

export default function SelectionPresetsView() {
  const [presets, setPresets] = useState<SelectionPreset[]>([]);
  const [draft, setDraft] = useState<SelectionPreset>(emptyDraft());
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);

  function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function onExportAll() {
    if (!presets.length) { setMsg('No layouts to export.'); return; }
    downloadJson('selection-presets.json', { type: 'lunacco-selection-preset-collection', version: 1, presets });
    setMsg(`Exported ${presets.length} layout${presets.length === 1 ? '' : 's'}.`);
  }

  function normalizePreset(c: any): SelectionPreset | null {
    if (!c || typeof c !== 'object') return null;
    const name = String(c.name || '').trim();
    const key = String(c.key || slugify(name)).trim();
    if (!key) return null;
    return {
      key, name: name || key,
      asteroids: Array.isArray(c.asteroids) ? c.asteroids.map(String) : [],
      planets_personality: Array.isArray(c.planets_personality) ? c.planets_personality.map(String) : [...PLANET_CATALOG],
      planets_design: Array.isArray(c.planets_design) ? c.planets_design.map(String) : [...PLANET_CATALOG],
    };
  }

  async function onImportFile(file: File) {
    setMsg('Importing…');
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data?.presets) ? data.presets : Array.isArray(data) ? data : [data];
      const incoming = list.map(normalizePreset).filter(Boolean) as SelectionPreset[];
      if (!incoming.length) { setMsg('No layouts found in that file.'); return; }
      let next = presets;
      for (const p of incoming) next = await saveSelectionPreset(p);
      setPresets(next);
      setMsg(`Imported ${incoming.length} layout${incoming.length === 1 ? '' : 's'}.`);
    } catch (e: any) {
      setMsg(e?.message || 'Import failed — invalid file.');
    }
  }

  useEffect(() => {
    listSelectionPresets().then((p) => { setPresets(p); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const isEditing = useMemo(() => presets.some((p) => p.key === draft.key && draft.key), [presets, draft.key]);

  const toggle = (field: 'asteroids' | 'planets_personality' | 'planets_design', name: string) =>
    setDraft((d) => {
      const list = d[field];
      return { ...d, [field]: list.includes(name) ? list.filter((n) => n !== name) : [...list, name] };
    });

  const setAll = (field: 'asteroids' | 'planets_personality' | 'planets_design', all: string[]) =>
    setDraft((d) => ({ ...d, [field]: all }));

  async function onSave() {
    const name = draft.name.trim();
    if (!name) { setMsg('Give the layout a name first.'); return; }
    const key = draft.key || slugify(name);
    setMsg('Saving…');
    try {
      const next = await saveSelectionPreset({ ...draft, key, name });
      setPresets(next);
      setDraft((d) => ({ ...d, key }));
      setMsg('Saved ✓');
    } catch (e: any) {
      setMsg(e?.message || 'Save failed.');
    }
  }

  async function onDelete(key: string) {
    try {
      const next = await deleteSelectionPreset(key);
      setPresets(next);
      if (draft.key === key) setDraft(emptyDraft());
      setMsg('Deleted.');
    } catch (e: any) {
      setMsg(e?.message || 'Delete failed.');
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', height: '100%', overflow: 'hidden' }}>
      {/* Saved layouts */}
      <div style={{ overflowY: 'auto', borderRight: '1px solid var(--hair)', padding: '20px 18px', background: 'var(--paper)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', margin: 0 }}>Selection Presets</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)', margin: '4px 0 16px' }}>
          Saved <em style={{ color: 'var(--gold)' }}>layouts</em>
        </h1>
        <button onClick={() => { setDraft(emptyDraft()); setMsg(''); }}
          style={{ width: '100%', padding: '8px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>
          + New layout
        </button>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button onClick={() => importInputRef.current?.click()} style={{ ...smallBtn, flex: 1 }}>Import</button>
          <button onClick={onExportAll} style={{ ...smallBtn, flex: 1 }}>Export all</button>
          <input ref={importInputRef} type="file" accept="application/json,.json" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ''; }} />
        </div>
        {loading && <p style={{ fontSize: 12, color: 'var(--mute)' }}>Loading…</p>}
        {!loading && presets.length === 0 && <p style={{ fontSize: 12, color: 'var(--mute)', fontStyle: 'italic' }}>None yet — create one.</p>}
        {presets.map((p) => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--hair)' }}>
            <button onClick={() => { setDraft({ ...emptyDraft(), ...p }); setMsg(''); }}
              style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: draft.key === p.key ? 'var(--gold)' : 'var(--ink)' }}>
              {p.name}
              <span style={{ display: 'block', fontSize: 10, color: 'var(--mute)' }}>
                {p.asteroids.length} asteroids · {p.planets_personality.length}/{p.planets_design.length} planets
              </span>
            </button>
            <button onClick={() => onDelete(p.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--mute)' }}>✕</button>
          </div>
        ))}
      </div>

      {/* Editor */}
      <div style={{ overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Layout name (e.g. Goddess + Big 3)"
            style={{ flex: 1, minWidth: 240, padding: '9px 12px', border: '1px solid var(--hair)', borderRadius: 8, fontSize: 14 }} />
          <button onClick={onSave} style={{ padding: '9px 18px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {isEditing ? 'Update' : 'Save'} layout
          </button>
          {msg && <span style={{ fontSize: 12, color: 'var(--mute)' }}>{msg}</span>}
        </div>
        <p style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'monospace', marginTop: -8, marginBottom: 20 }}>
          key: {draft.key || slugify(draft.name) || '—'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 28 }}>
          {/* Planets — personality */}
          <div>
            <p style={sectionTitle}>Personality planets</p>
            <div style={rowBtns}>
              <button style={smallBtn} onClick={() => setAll('planets_personality', [...PLANET_CATALOG])}>All</button>
              <button style={smallBtn} onClick={() => setAll('planets_personality', [])}>None</button>
            </div>
            <CheckGrid options={PLANET_CATALOG} selected={draft.planets_personality} onToggle={(n) => toggle('planets_personality', n)} />
          </div>

          {/* Planets — design */}
          <div>
            <p style={sectionTitle}>Design planets</p>
            <div style={rowBtns}>
              <button style={smallBtn} onClick={() => setAll('planets_design', [...PLANET_CATALOG])}>All</button>
              <button style={smallBtn} onClick={() => setAll('planets_design', [])}>None</button>
            </div>
            <CheckGrid options={PLANET_CATALOG} selected={draft.planets_design} onToggle={(n) => toggle('planets_design', n)} />
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <p style={sectionTitle}>Asteroids ({draft.asteroids.length})</p>
          <div style={rowBtns}>
            <button style={smallBtn} onClick={() => setAll('asteroids', [...ASTEROID_CATALOG])}>All</button>
            <button style={smallBtn} onClick={() => setAll('asteroids', [])}>None</button>
            <button style={smallBtn} onClick={() => setAll('asteroids', ['Ceres', 'Pallas', 'Juno', 'Vesta', 'Pholus'])}>Base 5</button>
            <button style={smallBtn} onClick={() => setAll('asteroids', ['Ceres', 'Pallas', 'Juno', 'Vesta', 'Iris', 'Psyche', 'Fortuna', 'Hekate', 'Eros', 'Sedna', 'Eris', 'Chariklo'])}>Goddess</button>
          </div>
          <CheckGrid options={ASTEROID_CATALOG} selected={draft.asteroids} onToggle={(n) => toggle('asteroids', n)} />
        </div>
      </div>
    </div>
  );
}
