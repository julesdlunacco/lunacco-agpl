import React from 'react';

/**
 * KitBars — the single source of truth for editorial "data graph" bars.
 *
 * Matches the broadsheet kit (.dist / .dual-tbl in broadsheet.css): a hairline
 * track (var(--hair)), a flat color fill (no gradients), 5px tall, 1px radius.
 * Used everywhere a distribution/tally is shown — profile lines, quarters,
 * circuits, elements, modalities, houses — on both the bodygraph (HD) and
 * astrology views, and (because the Chart Maker preview renders the real
 * views) inside the maker too. Universal = used in every one of those places.
 */

/** A single meter: hairline track + flat color fill. */
export function KitMeter({ value, max, color, height = 5 }: {
  value: number; max: number; color: string; height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div style={{ flex: 1, height, background: 'var(--hair)', borderRadius: 1, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 1, transition: 'width 0.4s ease' }} />
    </div>
  );
}

/**
 * A labeled meter row: optional leading label, the meter, optional trailing
 * value. Layout matches the kit's `.dist` rows.
 */
export function KitMeterRow({ label, value, max, color, suffix }: {
  label?: React.ReactNode; value: number; max: number; color: string; suffix?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {label != null && <span style={{ fontSize: 9, width: 14, fontWeight: 700, color }}>{label}</span>}
      <KitMeter value={value} max={max} color={color} />
      {suffix != null && (
        <span style={{ fontSize: 10.5, fontWeight: 700, color, minWidth: 12, textAlign: 'right' }}>{suffix}</span>
      )}
    </div>
  );
}

export default KitMeter;
