/**
 * EditorialBoxes — shared editorial primitives for definition rendering.
 *
 * One source of truth for how a "box" looks: the sidebar (AstroHDShell), the
 * Chart Maker live preview, and (later) the center-view sections all render
 * through these. Everything is themed via CSS variables only (theme-maker
 * driven) so light/dark and client palette swaps need no code changes.
 *
 * Accent variables (with conservative fallbacks):
 *   --shadow-accent, --gift-accent, --indigo, --gold, --ink, --mute,
 *   --paper, --card, --hair, --font-display
 */

import React from 'react';
import type { BoxStyle } from '../../services/chartConfig';
import { Glyph } from '../Glyph';

// ─── Slot labels ───────────────────────────────────────────────────────────────

const SLOT_LABELS: Record<string, string> = {
  short_def: 'Essence', long_def: 'In Depth',
  aspect_short: 'The Aspect', aspect_long: 'In Depth',
  gift: 'The Gift', gift_short: 'The Gift', gift_long: 'The Gift',
  shadow_short: 'The Shadow', shadow_long: 'The Shadow',
  shadow_recessive: 'Shadow · Recessive', shadow_reactive: 'Shadow · Reactive',
  coaching_notes: 'Coaching', coaching_key_notes: 'Coaching Notes', coaching_questions: 'Coaching Questions',
  affirmation: 'Affirmation', journal_prompt: 'Journal Prompt', practice_prompt: 'Practice',
  eft_script: 'EFT Script', theme_short: 'Theme', theme_long: 'Theme · In Depth',
};
export const slotLabel = (k: string): string => SLOT_LABELS[k] || k.replace(/_/g, ' ');

// ─── Accent families ───────────────────────────────────────────────────────────

export interface BoxTone { accent: string; tint: string }

const TONES: Record<Exclude<BoxStyle, 'auto' | 'plain'>, BoxTone> = {
  shadow:   { accent: 'var(--shadow-accent, #b45c5c)', tint: 'color-mix(in srgb, var(--shadow-accent, #b45c5c) 6%, transparent)' },
  gift:     { accent: 'var(--gift-accent, #c79a3e)',   tint: 'color-mix(in srgb, var(--gift-accent, #c79a3e) 7%, transparent)' },
  coaching: { accent: 'var(--indigo)',                 tint: 'color-mix(in srgb, var(--indigo) 5%, transparent)' },
};

/** Accent derived from the slot key — used when a box's style is 'auto'. */
export function autoTone(slotKey: string): BoxTone | null {
  if (slotKey.startsWith('shadow')) return TONES.shadow;
  if (slotKey.startsWith('gift')) return TONES.gift;
  if (slotKey.startsWith('coaching') || ['journal_prompt', 'practice_prompt', 'affirmation', 'eft_script'].includes(slotKey)) return TONES.coaching;
  return null;
}

/** Resolve the tone for a box given its configured style. */
export function boxTone(style: BoxStyle | undefined, slotKey: string): BoxTone | null {
  if (!style || style === 'auto') return autoTone(slotKey);
  if (style === 'plain') return null;
  return TONES[style] || null;
}

// ─── Primitives ────────────────────────────────────────────────────────────────

const eyebrow: React.CSSProperties = {
  fontSize: 8.5, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase',
};
const prose: React.CSSProperties = {
  fontSize: 12.5, lineHeight: 1.6, color: 'var(--ink)', opacity: 0.92, whiteSpace: 'pre-wrap',
};

/**
 * The editorial frame around one card's reading: kicker (section type), display
 * title, and the boxes inside. The premium "component box" treatment.
 */
export function CardFrame({ kicker, title, children }: { kicker?: string; title?: string; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid var(--hair)', borderRadius: 10, overflow: 'hidden', background: 'var(--paper)' }}>
      {(kicker || title) && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '9px 14px', borderBottom: '1px solid var(--hair)', background: 'color-mix(in srgb, var(--gold) 7%, transparent)' }}>
          {kicker && <span style={{ ...eyebrow, color: 'var(--gold)' }}>{kicker}</span>}
          {title && <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink)' }}>{title}</span>}
        </div>
      )}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

/**
 * Map a box's configured style + slot key to a Broadsheet `.icard` variant.
 * shadow → gold top-border + hatch · gift → indigo top-border ·
 * affirmation → inverted ink card with pull quote · else plain card.
 */
function slotVariant(style: BoxStyle | undefined, slotKey: string): '' | 'shadow' | 'gift' | 'affirm' {
  if (slotKey === 'affirmation') return 'affirm';
  const explicit = style && style !== 'auto' && style !== 'plain' ? style : null;
  const fam = explicit || (slotKey.startsWith('shadow') ? 'shadow' : slotKey.startsWith('gift') ? 'gift' : null);
  if (fam === 'shadow') return 'shadow';
  if (fam === 'gift') return 'gift';
  return '';
}

/** The woven synthesis box — the card's headline reading (.icard synthesis). */
export function SynthBox({ text, label = 'Synthesis', term }: { text: string; label?: string; term?: string }) {
  return (
    <div className="icard synthesis">
      <div className="ih">{label}</div>
      {term && <div className="iterm">{term}</div>}
      <ProseHtml html={text} />
    </div>
  );
}

/** One standalone box: a slot or template reading rendered as its .icard variant. */
export function SlotBox({ slotKey, value, label, style }: {
  slotKey: string; value: string; label?: string; style?: BoxStyle;
}) {
  const variant = slotVariant(style, slotKey);
  const heading = label || slotLabel(slotKey);
  if (variant === 'affirm') {
    return (
      <div className="icard affirm">
        <div className="ih">{heading}</div>
        <div className="quote">{value}</div>
      </div>
    );
  }
  return (
    <div className={`icard ${variant}`.trim()}>
      <div className="ih">{heading}</div>
      <ProseHtml html={value} />
    </div>
  );
}

/** Loading skeleton matching the box shapes (avoids the "not found" flash). */
export function BoxSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse" style={{ border: '1px solid var(--hair)', borderRadius: 10, padding: 12, background: 'var(--paper)' }}>
          <div style={{ height: 9, width: '38%', background: 'var(--hair)', borderRadius: 4, marginBottom: 10 }} />
          <div style={{ height: 8, width: '92%', background: 'var(--hair)', borderRadius: 4, marginBottom: 6 }} />
          <div style={{ height: 8, width: '80%', background: 'var(--hair)', borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Placement switcher ───────────────────────────────────────────────────────

export interface PlacementOption {
  key: string;        // e.g. 'personality-sun'
  side: 'Personality' | 'Design';
  planet: string;     // e.g. 'Sun'
}

/**
 * Segmented control shown when a clicked gate is activated by more than one
 * placement (e.g. personality Sun + design Mars). One synth per placement;
 * shared standalone boxes render below the active one.
 */
export function PlacementSwitcher({ options, activeKey, onSelect }: {
  options: PlacementOption[]; activeKey: string; onSelect: (key: string) => void;
}) {
  if (options.length < 2) return null;
  return (
    <div className="facet-tabs" style={{ flexWrap: 'wrap' }}>
      {options.map((o) => (
        <button key={o.key} className={o.key === activeKey ? 'on' : ''} onClick={() => onSelect(o.key)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Glyph kind="planet" name={o.planet} size={14} /> {o.side} · {o.planet}
        </button>
      ))}
    </div>
  );
}

// ─── HTML-aware prose (definitions may carry simple markup) ───────────────────

export function ProseHtml({ html }: { html: string }) {
  return <div style={prose} dangerouslySetInnerHTML={{ __html: html.replace(/\n/g, '<br/>') }} />;
}
