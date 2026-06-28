import { Activation } from '../services/HumanDesignLogic';
import { FixingState } from '../services/fixationData';
import { Glyph } from './Glyph';

const ZODIAC_SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

const PLANET_ORDER = [
  'Sun','Earth','Moon','NorthNode','SouthNode',
  'Mercury','Venus','Mars','Jupiter','Saturn',
  'Uranus','Neptune','Pluto','Chiron','Black Moon Lilith','Vulcan',
];

function signOf( lon: number ) {
  return ZODIAC_SIGNS[ Math.floor( ( ( ( lon % 360 ) + 360 ) % 360 ) / 30 ) ];
}

interface Props {
  activationsA: Record<string, Activation>;
  activationsB: Record<string, Activation>;
  side: 'design' | 'personality';
  colorA: string;
  colorB: string;
}

export function ConnectionPlanetPanel( { activationsA, activationsB, side, colorA, colorB }: Props ) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 10 }}>
      <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--mute)', marginBottom: 2, textAlign: 'center' }}>
        { side === 'design' ? 'Design' : 'Personality' }
      </div>
      { PLANET_ORDER.map( name => {
        const aAct = activationsA[ name ];
        const bAct = activationsB[ name ];
        if ( !aAct && !bAct ) return null;
        const aSign = aAct ? signOf( aAct.longitude ) : '';
        const bSign = bAct ? signOf( bAct.longitude ) : '';

        return (
          <div key={ name } style={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 15, justifyContent: 'center' }}>
            <span style={{ fontSize: 7, color: 'var(--mute)', width: 12, textAlign: 'center', flexShrink: 0 }}>{ aAct?.house || '' }</span>
            <span style={{ width: 11, height: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              { aSign && <Glyph kind="sign" name={ aSign } size={ 9 } /> }
            </span>
            <span style={{ fontWeight: 600, fontSize: 9, minWidth: 30, textAlign: 'center', padding: '1px 2px', borderRadius: 2, background: aAct ? colorA : 'transparent', color: aAct ? 'var(--btn-fg, white)' : 'transparent', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              { aAct ? `${ aAct.gate }.${ aAct.line }` : '' }
              {aAct?.fixation === FixingState.Exalted && <span title="Exalted" style={{ fontSize: 8 }}>▲</span>}
              {aAct?.fixation === FixingState.Detriment && <span title="Detriment" style={{ fontSize: 8 }}>▼</span>}
              {aAct?.fixation === FixingState.Juxtaposed && <span title="Juxtaposed" style={{ fontSize: 9 }}>✶</span>}
            </span>
            <span style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, margin: '0 2px' }}>
              <Glyph kind="planet" name={ name } size={ 12 } />
            </span>
            <span style={{ fontWeight: 600, fontSize: 9, minWidth: 30, textAlign: 'center', padding: '1px 2px', borderRadius: 2, background: bAct ? colorB : 'transparent', color: bAct ? 'var(--btn-fg, white)' : 'transparent', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              { bAct ? `${ bAct.gate }.${ bAct.line }` : '' }
              {bAct?.fixation === FixingState.Exalted && <span title="Exalted" style={{ fontSize: 8 }}>▲</span>}
              {bAct?.fixation === FixingState.Detriment && <span title="Detriment" style={{ fontSize: 8 }}>▼</span>}
              {bAct?.fixation === FixingState.Juxtaposed && <span title="Juxtaposed" style={{ fontSize: 9 }}>✶</span>}
            </span>
            <span style={{ width: 11, height: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              { bSign && <Glyph kind="sign" name={ bSign } size={ 9 } /> }
            </span>
            <span style={{ fontSize: 7, color: 'var(--mute)', width: 12, textAlign: 'center', flexShrink: 0 }}>{ bAct?.house || '' }</span>
          </div>
        );
      } ) }
    </div>
  );
}
