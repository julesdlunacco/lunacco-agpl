/**
 * CardBoxComposer — per-card box composition editor for the Chart Maker.
 *
 * For one card type (hd_gate, astro_planet, …) it edits a CardComposition:
 *   - the SYNTH template (token_template woven through resolve() with the
 *     card's whole entity bundle), and
 *   - an ordered list of STANDALONE boxes — each an individual slot or another
 *     template, targeting one piece of the bundle (or the whole bundle), with
 *     its own label and accent style.
 *
 * Purely controlled: parent owns the CardCompositions map (lives in
 * ChartConfig.cards and persists with the preset).
 */

import { useMemo, useState } from 'react';
import {
  CardCatalogEntry,
  CardComposition,
  CardBox,
  BoxStyle,
  BoxTarget,
  newBoxId,
} from '../../services/chartConfig';
import { TemplateSummary } from '../../services/DefinitionService';
import { slotLabel, boxTone } from './EditorialBoxes';

/**
 * Standalone content slots a box can pull. These are the slots that exist in the
 * core style guide AND render on their own (kind: 'standalone'). Fragments
 * (theme_short/long, *_token short/long) are intentionally NOT here — they're
 * woven into synthesis templates, not placed as boxes. Legacy aliases
 * (sidebar_short, chart_snippet, report_snippet, pdf_long) and never-real slots
 * (eft_script, aspect_short/long) were removed — they could never resolve.
 */
export const SLOT_CATALOG = [
  // Definitions
  'short_def', 'long_def',
  // Polarity families (full + short/long)
  'gift', 'gift_short', 'gift_long',
  'shadow_recessive', 'shadow_reactive', 'shadow_short', 'shadow_long',
  'growth_short', 'growth_long',
  // Coaching & practice
  'coaching_key_notes', 'coaching_questions', 'coaching_notes',
  'affirmation', 'journal_prompt', 'practice_prompt', 'reader_keynotes',
  // Complete output blocks
  'full_sidebar', 'full_chart', 'full_report', 'full_pdf', 'full_reader',
  // Angel overlay (standalone)
  'angel_gift_short', 'angel_gift_long',
  'angel_shadow_short', 'angel_shadow_long',
  'angel_guidance_short', 'angel_guidance_long',
];

const STYLE_OPTIONS: Array<[BoxStyle, string]> = [
  ['auto', 'Auto (from slot)'], ['plain', 'Plain'], ['shadow', 'Shadow accent'],
  ['gift', 'Gift accent'], ['coaching', 'Coaching accent'],
];

const TARGET_LABELS: Record<string, string> = {
  bundle: 'Whole bundle', gate: 'The gate', planet: 'The planet', line: 'The line',
  sign: 'The sign', house: 'The house', angel: 'The angel', channel: 'The channel',
  center: 'The center', aspect: 'The aspect', profile: 'The profile',
  cross: 'The cross', variable: 'The variable',
};

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '5px 8px', border: '1px solid var(--hair)', borderRadius: 6,
  fontSize: 11, background: 'var(--paper)', color: 'var(--ink)',
};
const tinyLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--mute)', display: 'block', marginBottom: 2,
};
const iconBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--hair)', borderRadius: 6, cursor: 'pointer',
  fontSize: 11, color: 'var(--mute)', padding: '2px 7px', lineHeight: 1.4,
};

function BoxRow({ box, card, templates, onChange, onRemove, onMove, isFirst, isLast }: {
  box: CardBox;
  card: CardCatalogEntry;
  templates: TemplateSummary[];
  onChange: (next: CardBox) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tone = boxTone(box.style, box.key);
  const displayName = box.label || (box.kind === 'slot' ? slotLabel(box.key) : box.key.replace(/_/g, ' '));

  // Effective target list (checkbox selection wins over the legacy single target).
  const targets: BoxTarget[] = (box.targets && box.targets.length ? box.targets : [box.target]);
  const targetSummary = targets.map((t) => TARGET_LABELS[t] || t).join(', ');
  const toggleTarget = (t: BoxTarget) => {
    const has = targets.includes(t);
    let next = has ? targets.filter((x) => x !== t) : [...targets, t];
    if (!next.length) next = ['bundle'];
    onChange({ ...box, targets: next, target: next[0] });
  };

  return (
    <div style={{ border: '1px solid var(--hair)', borderRadius: 8, background: 'var(--paper)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px' }}>
        <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: tone ? tone.accent : 'var(--hair)' }} />
        <button onClick={() => setOpen((v) => !v)}
          style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, color: 'var(--ink)', padding: 0 }}>
          <strong>{displayName}</strong>
          <span style={{ color: 'var(--mute)', marginLeft: 6, fontSize: 10 }}>
            {box.kind === 'slot' ? 'slot' : 'template'} · {targetSummary}
          </span>
        </button>
        <button title="Move up" disabled={isFirst} onClick={() => onMove(-1)} style={{ ...iconBtn, opacity: isFirst ? 0.3 : 1 }}>↑</button>
        <button title="Move down" disabled={isLast} onClick={() => onMove(1)} style={{ ...iconBtn, opacity: isLast ? 0.3 : 1 }}>↓</button>
        <button title="Remove box" onClick={onRemove} style={iconBtn}>✕</button>
      </div>

      {open && (
        <div style={{ padding: '8px 10px 10px', borderTop: '1px solid var(--hair)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={tinyLabel}>Content</label>
            <select value={box.kind} onChange={(e) => {
              const kind = e.target.value as CardBox['kind'];
              onChange({ ...box, kind, key: kind === 'slot' ? SLOT_CATALOG[0] : (templates[0]?.template_key || '') });
            }} style={fieldStyle}>
              <option value="slot">Individual slot</option>
              <option value="template">Template</option>
            </select>
          </div>
          <div>
            <label style={tinyLabel}>{box.kind === 'slot' ? 'Slot' : 'Template'}</label>
            {box.kind === 'slot' ? (
              <select value={box.key} onChange={(e) => onChange({ ...box, key: e.target.value })} style={fieldStyle}>
                {SLOT_CATALOG.map((s) => <option key={s} value={s}>{slotLabel(s)} ({s})</option>)}
              </select>
            ) : (
              <select value={box.key} onChange={(e) => onChange({ ...box, key: e.target.value })} style={fieldStyle}>
                {templates.map((t) => <option key={t.template_key} value={t.template_key}>{t.title || t.template_key}</option>)}
              </select>
            )}
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={tinyLabel}>Reads from (tick each piece this box applies to)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', padding: '2px 0' }}>
              {card.targets.map((t) => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={targets.includes(t)} onChange={() => toggleTarget(t)} />
                  {TARGET_LABELS[t] || t}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={tinyLabel}>Style</label>
            <select value={box.style || 'auto'} onChange={(e) => onChange({ ...box, style: e.target.value as BoxStyle })} style={fieldStyle}>
              {STYLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={tinyLabel}>Custom label (optional)</label>
            <input value={box.label || ''} placeholder={box.kind === 'slot' ? slotLabel(box.key) : box.key}
              onChange={(e) => onChange({ ...box, label: e.target.value || undefined })} style={fieldStyle} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function CardBoxComposer({ card, composition, templates, onChange }: {
  card: CardCatalogEntry;
  composition: CardComposition;
  templates: TemplateSummary[];
  onChange: (next: CardComposition) => void;
}) {
  // Synth selector lists only token templates; standalone template boxes can use any.
  const synthTemplates = useMemo(
    () => templates.filter((t) => !t.render_mode || t.render_mode === 'token_template'),
    [templates]
  );

  const patchBox = (idx: number, next: CardBox) => {
    const boxes = composition.boxes.slice();
    boxes[idx] = next;
    onChange({ ...composition, boxes });
  };
  const removeBox = (idx: number) => {
    onChange({ ...composition, boxes: composition.boxes.filter((_, i) => i !== idx) });
  };
  const moveBox = (idx: number, dir: -1 | 1) => {
    const boxes = composition.boxes.slice();
    const j = idx + dir;
    if (j < 0 || j >= boxes.length) return;
    [boxes[idx], boxes[j]] = [boxes[j], boxes[idx]];
    onChange({ ...composition, boxes });
  };
  const addBox = () => {
    onChange({
      ...composition,
      boxes: [...composition.boxes, {
        id: newBoxId(), kind: 'slot', key: 'short_def',
        target: card.targets[0] || 'bundle', targets: [card.targets[0] || 'bundle'], style: 'auto',
      }],
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0 4px' }}>
      <div>
        <label style={tinyLabel}>Synthesis template (weaves the whole bundle)</label>
        <select value={composition.synth || ''} onChange={(e) => onChange({ ...composition, synth: e.target.value || undefined })} style={fieldStyle}>
          <option value="">— No synthesis box —</option>
          {synthTemplates.map((t) => (
            <option key={t.template_key} value={t.template_key}>{t.title || t.template_key}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={tinyLabel}>Standalone boxes (order = display order)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {composition.boxes.map((box, i) => (
            <BoxRow key={box.id} box={box} card={card} templates={templates}
              onChange={(next) => patchBox(i, next)}
              onRemove={() => removeBox(i)}
              onMove={(dir) => moveBox(i, dir)}
              isFirst={i === 0} isLast={i === composition.boxes.length - 1} />
          ))}
          {composition.boxes.length === 0 && (
            <p style={{ fontSize: 10.5, color: 'var(--mute)', fontStyle: 'italic', margin: '2px 0' }}>
              No standalone boxes — only the synthesis will show.
            </p>
          )}
        </div>
        <button onClick={addBox}
          style={{ marginTop: 6, width: '100%', padding: '6px', border: '1px dashed var(--hair)', borderRadius: 8, background: 'transparent', color: 'var(--mute)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
          + Add box
        </button>
      </div>
    </div>
  );
}
