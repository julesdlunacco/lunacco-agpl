import angelTableRaw from './angels with degrees.tsv?raw';
import { HumanDesignLogic } from './HumanDesignLogic';

export type AngelOverlay = {
  index: number;
  name: string;
  startDegree: number;
  endDegree: number;
  sign: string;
  degreeInSign: number;
  minuteInSign: number;
  longitude: number;
  gate: number;
  line: number;
};

const SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

type AngelRow = {
  index: number;
  name: string;
  startDegree: number;
  endDegree: number;
  sign: string;
};

function normalize360( value: number ): number {
  return ( ( value % 360 ) + 360 ) % 360;
}

function parseAngelRows(): AngelRow[] {
  return angelTableRaw
    .split( /\r?\n/ )
    .map( ( line ) => line.trim() )
    .filter( Boolean )
    .slice( 1 )
    .map( ( line ) => {
      const [ indexRaw, nameRaw, degreesRaw ] = line.split( '\t' );
      const match = ( degreesRaw || '' ).match( /(\d+)\s*-\s*(\d+)/ );
      const signMatch = ( degreesRaw || '' ).match( /(Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)/i );
      return {
        index: Number( indexRaw ),
        name: nameRaw || '',
        startDegree: match ? Number( match[ 1 ] ) : 0,
        endDegree: match ? Number( match[ 2 ] ) : 0,
        sign: signMatch ? signMatch[ 1 ] : '',
      };
    } )
    .filter( ( row ) => row.index && row.name );
}

const ANGELS = parseAngelRows();

export function getAngelOverlay( longitude: number | undefined | null ): AngelOverlay | null {
  if ( typeof longitude !== 'number' || !Number.isFinite( longitude ) ) return null;

  const normalized = normalize360( longitude );
  const wholeDegree = Math.floor( normalized );
  const row = ANGELS.find( ( angel ) => wholeDegree >= angel.startDegree && wholeDegree <= angel.endDegree );
  if ( !row ) return null;

  const signIndex = Math.floor( normalized / 30 ) % 12;
  const inSign = normalized - signIndex * 30;
  const degreeInSign = Math.floor( inSign );
  const minuteInSign = Math.floor( ( inSign - degreeInSign ) * 60 );
  const activation = HumanDesignLogic.calculateActivation( normalized );

  return {
    ...row,
    sign: SIGNS[ signIndex ],
    degreeInSign,
    minuteInSign,
    longitude: normalized,
    gate: activation.gate,
    line: activation.line,
  };
}

export function formatAngelDegree( angel: AngelOverlay | null ): string {
  if ( !angel ) return '';
  return `${ angel.degreeInSign }°${ String( angel.minuteInSign ).padStart( 2, '0' ) }' ${ angel.sign }`;
}

