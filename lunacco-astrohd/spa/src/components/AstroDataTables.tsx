import React, { useState } from 'react';
import { Glyph } from './Glyph';
import { formatLongitude, DegreeFormat } from '../services/degreeFormat';

/**
 * Editorial ("Broadsheet" .ptable / .asp) astrology data tables.
 *
 * These REPLACE the astrology placements + aspects listings on the astrology
 * views (WheelView, DualWheelView). They stay clickable — each row calls the
 * view's existing open handler so the interpretation drawer still opens — and
 * use the bundled SVG glyphs (no emoji). Human Design tables (PlanetDetailsTable
 * with gate·line columns) are intentionally left untouched.
 */

const PLANET_ORDER = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
  'Uranus', 'Neptune', 'Pluto', 'NorthNode', 'SouthNode', 'Chiron',
  'Black Moon Lilith', 'Vulcan', 'Earth',
  'Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex',
];

// Astrology placement columns: glyph · planet · sign · degree · house.
const PLAC_COLS = '42px 1.2fr 1.2fr 92px 56px';
// With the optional HD gate.line column inserted before House.
const PLAC_COLS_GATES = '42px 1.2fr 1.2fr 92px 64px 56px';

function degStr(longitude: number, format: DegreeFormat = 'compact'): string {
  return formatLongitude(longitude, format);
}

type Row = [string, any];

interface PlacementsProps {
  /** Pre-built [name, data] rows (preferred — supports asteroid rows). */
  rows?: Row[];
  /** Or a raw activations record (ordered by PLANET_ORDER). */
  activations?: Record<string, any>;
  title?: string;
  color?: string;
  /** Name of the active/selected planet for row highlight. */
  activeName?: string;
  onSelect?: (name: string, data: any) => void;
  /** Degree precision: 'compact' = 2°54' (default), 'full' = 2°54'44.241". */
  degreeFormat?: DegreeFormat;
  /** Append the HD gate.line column (off by default on astrology placements). */
  showGates?: boolean;
}

export function AstroPlacementsTable({ rows, activations, title, color = 'var(--ink)', activeName, onSelect, degreeFormat = 'compact', showGates = false }: PlacementsProps) {
  const data: Row[] = rows
    ? rows
    : PLANET_ORDER.filter((n) => activations?.[n]).map((n) => [n, activations![n]] as Row);

  if (!data.length) return null;

  const cols = showGates ? PLAC_COLS_GATES : PLAC_COLS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, background: color, borderRadius: '50%', flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mute)' }}>{title}</span>
        </div>
      )}
      <div className="ptable">
        <div className="ph" style={{ gridTemplateColumns: cols }}>
          <span />
          <span>Planet</span>
          <span>Sign</span>
          <span>Degree</span>
          {showGates && <span style={{ textAlign: 'center' }}>Gate</span>}
          <span>House</span>
        </div>
        {data.map(([name, d]) => {
          const selected = activeName === name;
          return (
            <div
              key={name}
              className="pr"
              onClick={() => onSelect?.(name, d)}
              style={{
                gridTemplateColumns: cols,
                cursor: onSelect ? 'pointer' : 'default',
                background: selected ? 'color-mix(in srgb, var(--gold) 14%, transparent)' : undefined,
              }}
            >
              <span className="g"><Glyph kind="planet" name={name} size={18} /></span>
              <span className="bd" style={{ color: 'var(--ink)' }}>
                {name}
                {d.isRetrograde && <span className="rx" title="Retrograde"> ℞</span>}
              </span>
              <span className="sg" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Glyph kind="sign" name={d.sign} size={15} />
                <span>{d.sign}</span>
              </span>
              <span className="deg">{degStr(d.longitude, degreeFormat)}</span>
              {showGates && (
                <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 11, color: 'var(--ink)', fontWeight: 600, textAlign: 'center' }}>
                  {d.gate ? `${d.gate}.${d.line}` : '—'}
                </span>
              )}
              <span className="house">{d.house ? `H${d.house}` : '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AspectLike {
  p1: { name: string; sign?: string };
  p2: { name: string; sign?: string };
  /** aspect.orb here is the aspect type's MAXIMUM allowable orb (8° major, 6° sextile, 3° quincunx). */
  aspect: { name: string; symbol: string; color?: string; orb?: number };
  /** The actual orb of this specific aspect. */
  orb: number;
}

type Tightness = 'tight' | 'medium' | 'wide';

/**
 * Classify an aspect's tightness RELATIVE to its own allowable orb, so the
 * "strong influence" band differs by aspect type — a 2° quincunx (max 3°) is
 * already wide, while a 2° trine (max 8°) is still tight. Falls back to an 8°
 * scale when the aspect type doesn't carry a max orb.
 */
function tightnessOf(a: AspectLike): Tightness {
  const max = a.aspect.orb && a.aspect.orb > 0 ? a.aspect.orb : 8;
  const ratio = a.orb / max;
  if (ratio <= 1 / 3) return 'tight';
  if (ratio <= 2 / 3) return 'medium';
  return 'wide';
}

const TIGHTNESS_LABEL: Record<Tightness, string> = { tight: 'Tight', medium: 'Medium', wide: 'Wide' };
const TIGHTNESS_DESC: Record<Tightness, string> = {
  tight: 'Within a third of orb — strongest influence',
  medium: 'Moderate orb — clearly active',
  wide: 'Approaching the orb limit — subtler',
};

interface AspectsProps {
  aspects: AspectLike[];
  /** Key of the active/selected aspect for highlight. */
  activeKey?: string;
  aspectKey: (a: AspectLike) => string;
  onSelect?: (a: AspectLike) => void;
}

/** One row inside the .asp grid — sign glyph + planet name on each side. */
function AspectRow({ a, selected, onSelect, aspectKey }: {
  a: AspectLike; selected: boolean; onSelect?: (a: AspectLike) => void; aspectKey: (a: AspectLike) => string;
}) {
  return (
    <div
      key={`${aspectKey(a)}`}
      onClick={() => onSelect?.(a)}
      title={`${a.p1.name} ${a.aspect.name} ${a.p2.name} · ${a.orb.toFixed(2)}°`}
      style={{ cursor: onSelect ? 'pointer' : 'default', background: selected ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : undefined }}
    >
      <span className="pair" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {a.p1.sign && <Glyph kind="sign" name={a.p1.sign} size={16} />}
        {a.p1.name}
        <span className="op" style={{ color: a.aspect.color || 'var(--ink)' }}>{a.aspect.symbol}</span>
        {a.p2.sign && <Glyph kind="sign" name={a.p2.sign} size={16} />}
        {a.p2.name}
      </span>
      <span className="orb">{a.orb.toFixed(1)}°</span>
    </div>
  );
}

export function AstroAspectsTable({ aspects, activeKey, aspectKey, onSelect }: AspectsProps) {
  const [filter, setFilter] = useState<'all' | Tightness>('all');
  if (!aspects.length) return <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--mute)' }}>No aspects in orb.</p>;

  // Bucket by tightness (preserving incoming order, which is orb-sorted).
  const buckets: Record<Tightness, AspectLike[]> = { tight: [], medium: [], wide: [] };
  aspects.forEach(a => buckets[tightnessOf(a)].push(a));

  const sections: Tightness[] = filter === 'all' ? ['tight', 'medium', 'wide'] : [filter];
  const visibleCount = sections.reduce((n, s) => n + buckets[s].length, 0);

  const tab = (key: 'all' | Tightness, label: string, count: number) => (
    <button
      key={key}
      className={filter === key ? 'on' : ''}
      onClick={() => setFilter(key)}
    >
      {label} <span style={{ opacity: 0.6 }}>{count}</span>
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="facet-tabs" style={{ flexWrap: 'wrap' }}>
        {tab('all', 'All', aspects.length)}
        {tab('tight', 'Tight', buckets.tight.length)}
        {tab('medium', 'Medium', buckets.medium.length)}
        {tab('wide', 'Wide', buckets.wide.length)}
      </div>

      {visibleCount === 0 && (
        <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--mute)' }}>No aspects in this band.</p>
      )}

      {sections.map(section => {
        const rows = buckets[section];
        if (!rows.length) return null;
        return (
          <div key={section}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)' }}>
                {TIGHTNESS_LABEL[section]} <span style={{ color: 'var(--mute)' }}>· {rows.length}</span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--mute)', fontStyle: 'italic' }}>{TIGHTNESS_DESC[section]}</span>
            </div>
            <div className="asp">
              {rows.map((a, i) => (
                <AspectRow key={`${aspectKey(a)}-${i}`} a={a} selected={activeKey === aspectKey(a)} onSelect={onSelect} aspectKey={aspectKey} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
