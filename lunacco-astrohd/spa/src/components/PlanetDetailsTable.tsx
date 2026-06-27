import React from 'react';
import { FixingState } from '../services/fixationData';
import { formatLongitude, formatGateCode, DegreeFormat, GateDetail } from '../services/degreeFormat';


const PLANET_ORDER = [
  'Sun', 'Earth', 'NorthNode', 'SouthNode', 'Moon',
  'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
  'Uranus', 'Neptune', 'Pluto', 'Chiron', 'Black Moon Lilith', 'Vulcan',
  'Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex'
];

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: '☉', Earth: '⊕', NorthNode: '☊', SouthNode: '☋', Moon: '☽',
  Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄',
  Uranus: '♅', Neptune: '♆', Pluto: '♇', Chiron: '⚷', 'Black Moon Lilith': '⚸', Vulcan: 'Vu',
  Ascendant: 'AC', Descendant: 'DC', Midheaven: 'MC', 'Imum Coeli': 'IC', Vertex: 'VX'
};

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

const PLANET_ICON_MAP: Record<string, string> = {
  Sun:'Sun', Earth:'Earth', Moon:'Moon', Mercury:'Mercury', Venus:'Venus', Mars:'Mars',
  Jupiter:'Jupiter', Saturn:'Saturn', Uranus:'Uranus', Neptune:'Neptune',
  Pluto:'Pluto', Chiron:'Chiron', NorthNode:'NorthNode', SouthNode:'SouthNode',
  'Black Moon Lilith':'BlackMoonLilith', Vulcan: 'Vulcan',
  'Ascendant':'Ascendant', 'Descendant':'Descendant', 'Midheaven':'Midheaven', 'Imum Coeli': 'Imuncoeli', 'Vertex':'Vertex',
};

function getIconBase(): string {
  const modules = ( window as any ).LunaCcoData?.modules || {};
  const astro = modules['luna-astrohd'] || {};
  return astro.assets?.zodiacPath || ( ( window as any ).ahdSettings?.pluginUrl ? ( window as any ).ahdSettings.pluginUrl + 'assets/zodiac/' : '' );
}

interface Props {
  activations: Record<string, any>;
  title?: string;
  color?: string;
  onSelect?: (type: any, id: string, label?: string) => void;
  selectedPlanet?: string;
  /** Degree precision: 'compact' = 2°54' (default), 'full' = 2°54'44.241". */
  degreeFormat?: DegreeFormat;
  /** Append color/tone/base figures to gate.line (e.g. 31.2.4.4.2). */
  gateDetail?: GateDetail;
}

export function PlanetDetailsTable({ activations, title, color = 'var(--ink)', onSelect, selectedPlanet, degreeFormat = 'compact', gateDetail }: Props) {
  const planets = PLANET_ORDER
    .filter(name => activations[name])
    .map(name => {
      const act = activations[name];
      const symbol = PLANET_SYMBOLS[name] || name[0];

      return {
        name,
        symbol,
        gateCode: formatGateCode(act, gateDetail),
        sign: act.sign,
        house: act.house,
        isRetrograde: act.isRetrograde,
        degreeStr: formatLongitude(act.longitude, degreeFormat),
        fixation: act.fixation
      };

    });

  if (!planets.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, background: color, borderRadius: '50%', flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mute)' }}>{title}</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{
          display: 'grid', 
          gridTemplateColumns: '28px 1fr 60px 45px 34px', 
          alignItems: 'center',
          padding: '4px 8px',
          fontSize: 8,
          fontWeight: 800,
          color: 'var(--mute)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          borderBottom: '1px solid var(--hair)',
          opacity: 0.6
        }}>
          <span></span>
          <span>Planet</span>
          <span style={{ textAlign: 'center' }}>Position</span>
          <span style={{ textAlign: 'center' }}>Gate</span>
          <span style={{ textAlign: 'center' }}>House</span>
        </div>
        {planets.map((p, i) => (
          <div 
            key={i} 
            onClick={() => onSelect?.('planet', p.name, p.name)}
            style={{
            display: 'grid', 
            gridTemplateColumns: '28px 1fr 60px auto 34px',
            alignItems: 'center',
            padding: '6px 8px', 
            border: '1px solid var(--hair)', 
            background: selectedPlanet === p.name ? 'var(--gold-soft, rgba(212,175,55,0.1))' : 'var(--card)',
            borderColor: selectedPlanet === p.name ? 'var(--gold)' : 'var(--hair)',
            gap: 4, 
            fontSize: 11,
            cursor: onSelect ? 'pointer' : 'default',
            transition: 'all 0.2s'
          }}>
            <span style={{
              fontStyle: 'italic',
              color,
              fontFamily: 'var(--font-display)',
              fontSize: p.symbol.length > 1 ? 9 : 14,
              fontWeight: p.symbol.length > 1 ? 800 : 400,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              position: 'relative'
            }} title={p.name}>
              { ( () => {
                const iconBase = getIconBase();
                const iconFile = PLANET_ICON_MAP[p.name];
                if ( iconBase && iconFile ) {
                  return (
                    <img 
                      src={`${iconBase}${iconFile}.svg`} 
                      style={{ width: 20, height: 20, filter: 'brightness(0) saturate(100%) invert(43%) sepia(85%) saturate(347%) hue-rotate(357deg) brightness(91%) contrast(85%)' }} 
                      alt={p.name}
                    />
                  );
                }
                return p.symbol;
              } )() }
              {p.isRetrograde && (
                <span title="Retrograde" style={{ position: 'absolute', top: -4, right: -6, fontSize: 9, fontStyle: 'normal', fontWeight: 900, color: 'var(--hd-active, var(--gold))' }}>ℛ</span>
              )}
            </span>
            
            <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 11, whiteSpace: 'nowrap' }}>
              {p.name}
            </span>

            <div style={{ textAlign: 'center', lineHeight: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--ink)', fontWeight: 600 }}>{p.degreeStr}</div>
              <div style={{ fontSize: 8, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{p.sign}</div>
            </div>

            <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10.5, color: 'var(--ink)', fontWeight: 600, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {p.gateCode.split('.').map((part, idx) => (
                <span key={idx}>{idx > 0 && <span style={{ opacity: 0.4 }}>.</span>}{part}</span>
              ))}
              {p.fixation === FixingState.Exalted && <span title="Exalted" style={{ fontSize: 12, color: 'var(--hd-fixation, var(--gold))', lineHeight: 1 }}>▲</span>}
              {p.fixation === FixingState.Detriment && <span title="Detriment" style={{ fontSize: 12, color: 'var(--hd-fixation, var(--gold))', lineHeight: 1 }}>▼</span>}
              {p.fixation === FixingState.Juxtaposed && <span title="Juxtaposed" style={{ fontSize: 14, color: 'var(--hd-fixation, var(--gold))', lineHeight: 1, marginTop: -2 }}>✶</span>}
            </span>


            <span style={{ fontSize: 10.5, color: 'var(--gold)', fontWeight: 800, textAlign: 'center', background: 'rgba(212,175,55,0.1)', borderRadius: 2, padding: '1px 0' }}>
              {p.house ? `H${p.house}` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
