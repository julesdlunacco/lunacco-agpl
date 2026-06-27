/**
 * TemplateEditor — create & edit synthesis templates (the "quick synth" the charts render).
 *
 * A template is a token body (e.g. "{title}\n\n{theme_short}\n\n{short_def}") stored on a set.
 * The resolver fills each {slot} from the matched entity's authored slot value and drops any
 * token that is empty, so partially-filled entities still render cleanly. This is the UI for
 * the work previously only possible by editing seed PHP.
 *
 * Backend: GET/POST lunacco/v1/definitions/templates, DELETE …/templates/{id}.
 * Tokens come from the slot style-guide (every authorable slot is a valid {token}).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileCode2, Plus, Save, Trash2, Loader2, Sparkles } from 'lucide-react';
import { apiFetch } from '../../utils/api.js';

const API = 'lunacco/v1/definitions';
const MODULE_ID = 'luna-astrohd';

// Which surface this template is the default for. Charts ultimately pick a
// template by key (via the chart preset / Chart Maker), so this is just the
// fallback binding — kept short and friendly.
const OUTPUT_CONTEXTS = [
  ['full_sidebar', 'Chart sidebar'],
  ['full_chart', 'Full chart'],
  ['full_pdf', 'PDF / report'],
];

const T = {
  bg: 'var(--paper)', panel: 'var(--card)', border: 'var(--hair)', text: 'var(--ink)',
  dim: 'var(--mute)', accent: 'var(--indigo)', gold: 'var(--gold)', display: 'var(--font-display, serif)',
};

const slug = (v) => (v || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const blank = () => ({
  id: 0, template_key: '', title: '', output_context: 'full_sidebar',
  is_enabled: 1, template_body: '',
});

function rowToDraft(row) {
  return {
    id: Number(row.id || 0),
    template_key: row.template_key || '',
    title: row.title || '',
    output_context: row.output_context || 'full_sidebar',
    is_enabled: row.is_enabled ? 1 : 0,
    template_body: String(row.metadata_json?.template_body ?? row.template_body ?? ''),
  };
}

export default function TemplateEditor({ setId, styleGuide, blueprints, flash }) {
  const [templates, setTemplates] = useState([]);
  const [draft, setDraft] = useState(blank());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const bodyRef = useRef(null);

  const load = async () => {
    if (!setId) { setTemplates([]); return; }
    setLoading(true);
    try {
      const rows = await apiFetch(`${API}/templates?set_id=${setId}`);
      setTemplates(Array.isArray(rows) ? rows : []);
    } catch (e) { flash?.(e.message || 'Failed to load templates', 'error'); setTemplates([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); setDraft(blank()); /* eslint-disable-next-line */ }, [setId]);

  // Only show tokens for fields that are ACTUALLY authored in the worksheets —
  // the union of every section blueprint's standalone + fragment layers. This
  // excludes old/legacy style-guide keys (area_long, dynamic, style, modifier,
  // full_chart, angel_*, …) that aren't part of the current definition engine.
  const tokenGroups = useMemo(() => {
    const used = new Set();
    Object.values(blueprints || {}).forEach((bp) => {
      (bp?.standalone_layers || []).forEach((l) => used.add(l));
      (bp?.fragment_layers || []).forEach((l) => used.add(l));
    });
    const groups = { special: ['title'], fragment: [], standalone: [] };
    used.forEach((key) => {
      const cfg = styleGuide?.[key];
      (cfg?.kind === 'fragment' ? groups.fragment : groups.standalone).push(key);
    });
    groups.fragment.sort(); groups.standalone.sort();
    return groups;
  }, [blueprints, styleGuide]);

  const insertToken = (key) => {
    const token = `{${key}}`;
    const ta = bodyRef.current;
    setDraft((d) => {
      if (!ta) return { ...d, template_body: d.template_body + token };
      const start = ta.selectionStart ?? d.template_body.length;
      const end = ta.selectionEnd ?? d.template_body.length;
      const next = d.template_body.slice(0, start) + token + d.template_body.slice(end);
      // restore caret after the inserted token on next tick
      requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + token.length; });
      return { ...d, template_body: next };
    });
  };

  const save = async () => {
    const key = slug(draft.template_key || draft.title);
    if (!key) { flash?.('A template key (or title) is required.', 'error'); return; }
    if (!draft.template_body.trim()) { flash?.('The template body is empty.', 'error'); return; }
    setBusy('save');
    try {
      const saved = await apiFetch(`${API}/templates`, {
        method: 'POST',
        body: JSON.stringify({
          id: draft.id || undefined,
          set_id: setId,
          module_id: MODULE_ID,
          template_key: key,
          title: draft.title || key,
          output_context: draft.output_context,
          render_mode: 'token_template',
          is_enabled: draft.is_enabled,
          metadata_json: { template_body: draft.template_body, model: 'astrohd_v2' },
        }),
      });
      flash?.('Template saved ✓');
      await load();
      setDraft(rowToDraft(saved));
    } catch (e) { flash?.(e.message || 'Save failed', 'error'); }
    finally { setBusy(''); }
  };

  const refreshStarters = async () => {
    if (!setId || !window.confirm('Replace the starter chart templates (quick_synth, placement_*, synthesis_summary) and purge old/legacy ones? Your definitions are NOT touched.')) return;
    setBusy('refresh');
    try {
      await apiFetch(`lunacco/v1/definitions/sets/${setId}/refresh-templates`, { method: 'POST', body: JSON.stringify({}) });
      flash?.('Starter templates refreshed ✓');
      await load();
      setDraft(blank());
    } catch (e) { flash?.(e.message || 'Refresh failed', 'error'); }
    finally { setBusy(''); }
  };

  const remove = async (row) => {
    if (!row.id || !window.confirm(`Delete template "${row.title || row.template_key}"?`)) return;
    try {
      await apiFetch(`${API}/templates/${row.id}`, { method: 'DELETE' });
      flash?.('Template deleted.');
      if (draft.id === row.id) setDraft(blank());
      await load();
    } catch (e) { flash?.(e.message || 'Delete failed', 'error'); }
  };

  const st = {
    body: { display: 'flex', flex: 1, minHeight: 0 },
    list: { width: 260, borderRight: `1px solid ${T.border}`, overflowY: 'auto', padding: '8px 0', background: T.panel },
    item: (a) => ({ padding: '9px 14px', cursor: 'pointer', borderLeft: `2px solid ${a ? T.accent : 'transparent'}`, background: a ? 'color-mix(in srgb, var(--indigo) 12%, transparent)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }),
    main: { flex: 1, minWidth: 0, overflow: 'auto', padding: 18, display: 'flex', gap: 18 },
    form: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 },
    label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: T.dim, fontWeight: 600, marginBottom: 4, display: 'block' },
    input: { width: '100%', padding: '8px 10px', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13 },
    area: { width: '100%', minHeight: 320, resize: 'vertical', padding: 12, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 13, lineHeight: 1.6, fontFamily: 'var(--font-mono, ui-monospace, monospace)' },
    palette: { width: 230, flexShrink: 0, borderLeft: `1px solid ${T.border}`, paddingLeft: 14, overflowY: 'auto' },
    chip: { display: 'inline-block', margin: '0 5px 6px 0', padding: '3px 8px', fontSize: 11.5, borderRadius: 7, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)' },
    btn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', color: T.text, cursor: 'pointer', fontSize: 12.5 },
    btnP: { background: T.accent, borderColor: T.accent, color: 'var(--paper)' },
  };

  return (
    <div style={st.body}>
      <div style={st.list}>
        <div style={{ padding: '4px 14px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: T.dim, fontWeight: 600 }}>Templates</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={st.btn} onClick={refreshStarters} disabled={busy === 'refresh' || !setId} title="Re-seed clean starter templates & purge legacy ones (definitions untouched)">
              {busy === 'refresh' ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
            </button>
            <button style={st.btn} onClick={() => setDraft(blank())}><Plus size={13} /> New</button>
          </div>
        </div>
        {loading && <div style={{ padding: 16, color: T.dim }}><Loader2 size={14} className="spin" /> Loading…</div>}
        {!loading && templates.length === 0 && <div style={{ padding: 16, color: T.dim, fontSize: 12.5 }}>No templates yet. Create one — or Reseed to get the starter set.</div>}
        {templates.map((row) => (
          <div key={row.id} style={st.item(draft.id === row.id)} onClick={() => setDraft(rowToDraft(row))}>
            <span style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title || row.template_key}</div>
              <div style={{ fontSize: 11, color: T.dim, fontFamily: 'monospace' }}>{row.template_key} · {row.output_context}{row.is_enabled ? '' : ' · off'}</div>
            </span>
            <Trash2 size={13} color="var(--hd-design, #c33)" onClick={(e) => { e.stopPropagation(); remove(row); }} style={{ cursor: 'pointer', flexShrink: 0 }} />
          </div>
        ))}
      </div>

      <div style={st.main}>
        <div style={st.form}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={st.label}>Title</label>
              <input style={st.input} value={draft.title} placeholder="Quick Synthesis"
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value, template_key: d.id ? d.template_key : slug(e.target.value) }))} />
            </div>
            <div style={{ width: 200 }}>
              <label style={st.label}>Key</label>
              <input style={{ ...st.input, fontFamily: 'monospace' }} value={draft.template_key} disabled={!!draft.id}
                onChange={(e) => setDraft((d) => ({ ...d, template_key: slug(e.target.value) }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={st.label}>Default surface</label>
              <select style={st.input} value={draft.output_context} onChange={(e) => setDraft((d) => ({ ...d, output_context: e.target.value }))}>
                {OUTPUT_CONTEXTS.map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: T.text, paddingBottom: 9 }}>
              <input type="checkbox" checked={!!draft.is_enabled} onChange={(e) => setDraft((d) => ({ ...d, is_enabled: e.target.checked ? 1 : 0 }))} /> Enabled
            </label>
          </div>
          <div>
            <label style={st.label}>Template body</label>
            <textarea ref={bodyRef} style={st.area} value={draft.template_body}
              placeholder={'{title}\n\n{theme_short}\n\n{short_def}'}
              onChange={(e) => setDraft((d) => ({ ...d, template_body: e.target.value }))} />
            <p style={{ fontSize: 11.5, color: T.dim, margin: '6px 0 0' }}>
              Each <code>{'{slot}'}</code> is replaced by the entity's authored value; empty slots are dropped. Click a token at right to insert it.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...st.btn, ...st.btnP }} onClick={save} disabled={busy === 'save' || !setId}>
              {busy === 'save' ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Save template
            </button>
          </div>
        </div>

        <div style={st.palette}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: T.dim, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileCode2 size={13} /> Tokens
          </div>
          {[['special', 'Special'], ['fragment', 'Fragments'], ['standalone', 'Standalone']].map(([grp, lbl]) => (
            tokenGroups[grp]?.length ? (
              <div key={grp} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10.5, color: T.dim, marginBottom: 5 }}>{lbl}</div>
                {tokenGroups[grp].map((k) => (
                  <span key={k} style={st.chip} title="Insert token" onClick={() => insertToken(k)}>{`{${k}}`}</span>
                ))}
              </div>
            ) : null
          ))}
        </div>
      </div>
    </div>
  );
}
