/**
 * ChartsAdminView — unified, module-agnostic chart governance.
 *
 * Lists every chart the platform can show — built-in module charts (natal, wheel,
 * combined…) AND Chart-Maker presets — with the same four controls: enabled,
 * admin-only, premium, and credit cost. Built-in settings persist to the core
 * option via /charts/settings; preset flags merge into the preset's config_json
 * via /charts/preset-flags. As numerology / eastern modules register their chart
 * types, they appear here automatically with no extra wiring.
 *
 * Backend: GET lunacco/v1/charts, POST …/charts/settings, POST …/charts/preset-flags.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Save, Loader2, Sparkles, RefreshCw, ChevronRight, ChevronDown, Layers, BookOpen } from 'lucide-react';
import { apiFetch } from '../../utils/api.js';

const API = 'lunacco/v1/charts';

const T = {
  bg: 'var(--paper)', panel: 'var(--card)', border: 'var(--hair)', text: 'var(--ink)',
  dim: 'var(--mute)', accent: 'var(--indigo)', gold: 'var(--gold)', display: 'var(--font-display, serif)',
};

export default function ChartsAdminView({ flash }) {
  const [rows, setRows] = useState([]); // normalized chart rows (builtins + presets)
  const [templates, setTemplates] = useState([]); // available sidebar templates
  const [stdSlots, setStdSlots] = useState([]); // non-fragment (standalone) slots, selectable per card
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(API);
      const builtins = (data?.builtins || []).map((r) => ({ ...r }));
      const presets = (data?.presets || []).map((r) => ({ ...r }));
      setRows([...builtins, ...presets]);
      setTemplates(data?.templates || []);
      setDirty(false);
    } catch (e) { flash?.(e.message || 'Failed to load charts', 'error'); setRows([]); }
    finally { setLoading(false); }
  };

  // Non-fragment slots = style-guide entries with kind 'standalone' (they render on
  // their own). Fragments (theme_*, keywords) are template-only and excluded here.
  const loadSlots = async () => {
    try {
      const guide = await apiFetch('lunacco/v1/definitions/style-guide');
      const list = Object.entries(guide || {})
        .filter(([, v]) => v && v.kind === 'standalone')
        .map(([key, v]) => ({ key, group: v.group || 'other', purpose: v.purpose || '' }));
      setStdSlots(list);
    } catch { setStdSlots([]); }
  };
  useEffect(() => { load(); loadSlots(); /* eslint-disable-next-line */ }, []);

  // Toggle a single slot in a card type's slot list.
  const toggleCardSlot = (idx, ctKey, slot) => {
    setRows((prev) => prev.map((r, i) => (i === idx
      ? { ...r, card_types: (r.card_types || []).map((c) => {
          if (c.key !== ctKey) return c;
          const has = (c.slots || []).includes(slot);
          return { ...c, slots: has ? c.slots.filter((s) => s !== slot) : [...(c.slots || []), slot] };
        }) }
      : r)));
    setDirty(true);
  };

  const groups = useMemo(() => {
    const g = {};
    rows.forEach((r, i) => { (g[r.group || r.module_id || 'Other'] = g[r.group || r.module_id || 'Other'] || []).push(i); });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const patch = (idx, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
    setDirty(true);
  };

  const patchLayer = (idx, layerKey, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx
      ? { ...r, layers: (r.layers || []).map((l) => (l.key === layerKey ? { ...l, [field]: value } : l)) }
      : r)));
    setDirty(true);
  };

  const patchCardType = (idx, ctKey, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx
      ? { ...r, card_types: (r.card_types || []).map((c) => (c.key === ctKey ? { ...c, [field]: value } : c)) }
      : r)));
    setDirty(true);
  };

  // Slot keys a bound template renders (for showing what a card type will pull).
  const templateSlots = useMemo(() => {
    const m = {};
    templates.forEach((t) => { m[t.key] = Array.isArray(t.slots) ? t.slots : []; });
    return m;
  }, [templates]);

  const save = async () => {
    setBusy('save');
    try {
      const settings = {};
      rows.filter((r) => r.source === 'builtin').forEach((r) => {
        const layers = {};
        (r.layers || []).forEach((l) => {
          layers[l.key] = { enabled: !!l.enabled, template: l.template || '', limit: Math.max(0, parseInt(l.limit, 10) || 0) };
        });
        const card_types = {};
        (r.card_types || []).forEach((c) => {
          card_types[c.key] = { enabled: !!c.enabled, template: c.template || '', slots: Array.isArray(c.slots) ? c.slots : [] };
        });
        settings[r.id] = { enabled: !!r.enabled, admin_only: !!r.admin_only, is_premium: !!r.is_premium, credit_cost: Math.max(0, parseInt(r.credit_cost, 10) || 0), sidebar_template: r.sidebar_template || '', layers, card_types };
      });
      const presetSaves = rows.filter((r) => r.source === 'preset').map((r) =>
        apiFetch(`${API}/preset-flags`, {
          method: 'POST',
          body: JSON.stringify({ id: r.id, flags: { enabled: !!r.enabled, admin_only: !!r.admin_only, is_premium: !!r.is_premium, credit_cost: Math.max(0, parseInt(r.credit_cost, 10) || 0) } }),
        })
      );
      await Promise.all([
        apiFetch(`${API}/settings`, { method: 'POST', body: JSON.stringify({ settings }) }),
        ...presetSaves,
      ]);
      flash?.('Chart settings saved ✓');
      setDirty(false);
    } catch (e) { flash?.(e.message || 'Save failed', 'error'); }
    finally { setBusy(''); }
  };

  const st = {
    wrap: { flex: 1, overflow: 'auto', padding: 18 },
    head: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
    h2: { fontFamily: T.display, fontSize: 24, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 },
    hint: { color: T.dim, fontSize: 12.5, margin: '0 0 16px', maxWidth: 720, lineHeight: 1.5 },
    groupTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7, color: T.gold, fontWeight: 700, margin: '20px 0 6px' },
    table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, maxWidth: 860 },
    th: { textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${T.border}`, color: T.dim, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' },
    thc: { textAlign: 'center', width: 86 },
    td: { padding: '8px 10px', borderBottom: `1px solid ${T.border}`, verticalAlign: 'middle' },
    tdc: { textAlign: 'center' },
    num: { width: 64, padding: '5px 7px', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 12.5, textAlign: 'center' },
    src: (s) => ({ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.5, padding: '1px 6px', borderRadius: 6, marginLeft: 8, color: s === 'preset' ? 'var(--paper)' : T.dim, background: s === 'preset' ? T.accent : 'transparent', border: s === 'preset' ? 'none' : `1px solid ${T.border}` }),
    btn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', color: T.text, cursor: 'pointer', fontSize: 12.5 },
    btnP: { background: T.accent, borderColor: T.accent, color: 'var(--paper)' },
    saveBar: { position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '10px 12px', background: 'color-mix(in srgb, var(--paper) 88%, transparent)', backdropFilter: 'blur(6px)', borderTop: `1px solid ${T.border}`, borderRadius: 10 },
  };

  const Check = ({ idx, field }) => (
    <input type="checkbox" checked={!!rows[idx][field]} onChange={(e) => patch(idx, field, e.target.checked)} />
  );

  return (
    <div style={st.wrap}>
      <div style={st.head}>
        <h2 style={st.h2}><LayoutGrid size={20} color={T.accent} /> Charts</h2>
        <div style={{ flex: 1 }} />
        <button style={st.btn} onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>
      <p style={st.hint}>
        Govern every chart from one place. <strong>Built-in</strong> charts are the fixed views each module ships;
        <strong> Chart Maker</strong> rows are presets you composed. Toggle visibility, restrict to admins, mark premium,
        and set a credit cost. Premium charts consume credits before the chart computes.
      </p>

      {loading && <div style={{ color: T.dim }}><Loader2 size={15} className="spin" /> Loading…</div>}

      {!loading && rows.length === 0 && (
        <div style={{ color: T.dim, padding: 30, textAlign: 'center' }}>
          No charts registered yet. Built-ins appear when a module is active; presets appear once you save them in the Chart Maker.
        </div>
      )}

      {!loading && groups.map(([group, idxs]) => (
        <div key={group}>
          <div style={st.groupTitle}>{group}</div>
          <table style={st.table}>
            <thead>
              <tr>
                <th style={st.th}>Chart</th>
                <th style={{ ...st.th, ...st.thc }}>Enabled</th>
                <th style={{ ...st.th, ...st.thc }}>Admin only</th>
                <th style={{ ...st.th, ...st.thc }}>Premium</th>
                <th style={{ ...st.th, ...st.thc }}>Credits</th>
                <th style={st.th}>Sidebar reading</th>
              </tr>
            </thead>
            <tbody>
              {idxs.map((idx) => {
                const r = rows[idx];
                const hasLayers = r.source === 'builtin' && Array.isArray(r.layers) && r.layers.length > 0;
                const hasCardTypes = r.source === 'builtin' && Array.isArray(r.card_types) && r.card_types.length > 0;
                const hasDetail = hasLayers || hasCardTypes;
                const open = !!expanded[idx];
                const onCount = hasLayers ? r.layers.filter((l) => l.enabled).length : 0;
                const ctOnCount = hasCardTypes ? r.card_types.filter((c) => c.enabled).length : 0;
                return (
                <React.Fragment key={`${r.source}-${r.id}`}>
                  <tr>
                    <td style={st.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {hasDetail && (
                          <button style={{ ...st.btn, padding: 2, border: 'none' }} title="Card types & sidebar layers"
                            onClick={() => setExpanded((p) => ({ ...p, [idx]: !p[idx] }))}>
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                        <div>
                          <strong style={{ fontSize: 13 }}>{r.label}</strong>
                          <span style={st.src(r.source)}>{r.source === 'preset' ? 'Chart Maker' : 'built-in'}</span>
                          <div style={{ fontSize: 11, color: T.dim, fontFamily: 'monospace' }}>
                            {r.key}
                            {hasCardTypes ? <span style={{ marginLeft: 8 }}><BookOpen size={10} style={{ verticalAlign: 'middle' }} /> {ctOnCount}/{r.card_types.length} cards</span> : null}
                            {hasLayers ? <span style={{ marginLeft: 8 }}><Layers size={10} style={{ verticalAlign: 'middle' }} /> {onCount}/{r.layers.length} layers</span> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...st.td, ...st.tdc }}><Check idx={idx} field="enabled" /></td>
                    <td style={{ ...st.td, ...st.tdc }}><Check idx={idx} field="admin_only" /></td>
                    <td style={{ ...st.td, ...st.tdc }}><Check idx={idx} field="is_premium" /></td>
                    <td style={{ ...st.td, ...st.tdc }}>
                      <input style={st.num} type="number" min={0} value={r.credit_cost ?? 0}
                        disabled={!r.is_premium}
                        onChange={(e) => patch(idx, 'credit_cost', e.target.value)} />
                    </td>
                    <td style={st.td}>
                      {r.source === 'builtin' ? (
                        <select style={{ ...st.num, width: 200, textAlign: 'left' }} value={r.sidebar_template || ''}
                          onChange={(e) => patch(idx, 'sidebar_template', e.target.value)}>
                          <option value="">Default (quick_synth)</option>
                          {templates.map((t) => <option key={t.key} value={t.key}>{t.title}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 11, color: T.dim }}>preset-defined</span>
                      )}
                    </td>
                  </tr>
                  {hasDetail && open && (
                    <tr>
                      <td style={{ ...st.td, background: 'color-mix(in srgb, var(--indigo) 5%, transparent)' }} colSpan={6}>
                        {hasCardTypes && (
                          <>
                            <div style={{ fontSize: 11, color: T.dim, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <BookOpen size={12} /> <strong style={{ color: T.text }}>Card readings</strong> — bind a definition template to each clickable card type. Each card resolves its own template/slots in the sidebar.
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8, marginBottom: 16 }}>
                              {r.card_types.map((c) => {
                                const selected = c.slots || [];
                                return (
                                  <div key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 8, background: T.panel, opacity: c.enabled ? 1 : 0.55 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <input type="checkbox" checked={!!c.enabled} onChange={(e) => patchCardType(idx, c.key, 'enabled', e.target.checked)} />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600 }}>{c.label}</div>
                                        <div style={{ fontSize: 10, color: T.dim, fontFamily: 'monospace' }}>{c.key}</div>
                                      </div>
                                    </div>
                                    <label style={{ fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Synth template</label>
                                    <select style={{ ...st.num, width: '100%', textAlign: 'left' }} value={c.template || ''}
                                      disabled={!c.enabled}
                                      onChange={(e) => patchCardType(idx, c.key, 'template', e.target.value)}>
                                      <option value="">None (boxes only)</option>
                                      {templates.map((t) => <option key={t.key} value={t.key}>{t.title}</option>)}
                                    </select>
                                    <label style={{ fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Boxes (individual slots)</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                      {stdSlots.map((s) => {
                                        const on = selected.includes(s.key);
                                        return (
                                          <button key={s.key} type="button" disabled={!c.enabled} title={s.purpose}
                                            onClick={() => toggleCardSlot(idx, c.key, s.key)}
                                            style={{ fontSize: 9, fontFamily: 'monospace', cursor: c.enabled ? 'pointer' : 'default',
                                              color: on ? 'var(--paper)' : T.dim,
                                              background: on ? T.accent : 'color-mix(in srgb, var(--indigo) 8%, transparent)',
                                              border: `1px solid ${on ? T.accent : T.border}`, borderRadius: 5, padding: '2px 6px' }}>
                                            {s.key}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                        {hasLayers && (<>
                        <div style={{ fontSize: 11, color: T.dim, marginBottom: 8 }}>
                          Sidebar layers — which derived areas appear for this chart. Off layers stay available but hidden until toggled.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                          {r.layers.map((l) => (
                            <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: `1px solid ${T.border}`, borderRadius: 8, background: T.panel }}>
                              <input type="checkbox" checked={!!l.enabled} onChange={(e) => patchLayer(idx, l.key, 'enabled', e.target.checked)} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12.5, color: T.text }}>{l.label}</div>
                                <div style={{ fontSize: 10, color: T.dim, fontFamily: 'monospace' }}>{l.key}</div>
                              </div>
                              {Object.prototype.hasOwnProperty.call(l, 'limit') && l.limit > 0 && (
                                <input style={{ ...st.num, width: 48 }} type="number" min={0} title="Max items" value={l.limit ?? 0}
                                  onChange={(e) => patchLayer(idx, l.key, 'limit', e.target.value)} />
                              )}
                            </div>
                          ))}
                        </div>
                        </>)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {!loading && rows.length > 0 && (
        <div style={st.saveBar}>
          {dirty ? <span style={{ width: 8, height: 8, borderRadius: 8, background: T.gold }} /> : <Sparkles size={14} color={T.dim} />}
          <span style={{ fontSize: 12.5, color: T.dim }}>{dirty ? 'Unsaved changes' : 'All saved'}</span>
          <div style={{ flex: 1 }} />
          <button style={{ ...st.btn, ...st.btnP }} onClick={save} disabled={busy === 'save' || !dirty}>
            {busy === 'save' ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Save chart settings
          </button>
        </div>
      )}
    </div>
  );
}
