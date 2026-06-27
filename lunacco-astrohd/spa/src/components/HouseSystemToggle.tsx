import React from 'react';

/**
 * FlatToggle — the universal, flat editorial design-kit segmented switcher
 * (label / label, active is italic display-font + underlined). No rounded
 * corners, no filled background.
 *
 * This is the single source of truth for every "this or that" switch in the
 * AstroHD charts: Whole Sign ↔ Placidus, Human Design ↔ Astrology, etc. It
 * replaces the older rounded "pill" toggles that lived inline in WheelView,
 * DualWheelView, AsteroidsView, and the Chart Maker preview header.
 */

interface FlatToggleProps<T extends string> {
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (val: T) => void;
}

export function FlatToggle<T extends string>({ value, options, onChange }: FlatToggleProps<T>) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {options.map(([val, lbl], idx) => (
        <span key={val} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {idx > 0 && <span style={{ color: 'var(--hair)', fontSize: 13 }}>/</span>}
          <button
            onClick={() => onChange(val)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 2px',
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15,
              color: value === val ? 'var(--ink)' : 'var(--mute)',
              borderBottom: value === val ? '1.5px solid var(--ink)' : '1.5px solid transparent',
              transition: 'color 0.2s ease',
            }}
          >{lbl}</button>
        </span>
      ))}
    </div>
  );
}

export type HouseSystem = 'whole_house' | 'placidus' | 'koch';

const HOUSE_OPTIONS: ReadonlyArray<readonly [HouseSystem, string]> = [
  ['whole_house', 'Whole Sign'],
  ['placidus', 'Placidus'],
  ['koch', 'Koch'],
];

/** Human-readable label for a house-system key. */
export const HOUSE_SYSTEM_LABELS: Record<HouseSystem, string> = {
  whole_house: 'Whole Sign',
  placidus: 'Placidus',
  koch: 'Koch',
};

/** The house-system switch — a FlatToggle preset with the Whole/Placidus labels. */
export function HouseSystemToggle({ value, onChange }: { value: HouseSystem; onChange: (val: HouseSystem) => void }) {
  return <FlatToggle value={value} options={HOUSE_OPTIONS} onChange={onChange} />;
}

export default HouseSystemToggle;
