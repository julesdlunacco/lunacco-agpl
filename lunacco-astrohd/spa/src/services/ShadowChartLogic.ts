import { Center, CenterGates, Channels, GateToCenter } from './HumanDesignDefinitions';

export type ShadowConditioningType =
  | 'conditioning-receptor'
  | 'mental-conditioner'
  | 'transpersonal-conditioner'
  | 'harmonic-influencer';

export type ShadowGate = {
  gate: number;
  center: Center;
  channelId?: string;
  oppositeGate?: number;
  type: ShadowConditioningType;
};

export type ShadowCenter = {
  center: Center;
  gates: ShadowGate[];
};

export type ShadowAnalysis = {
  gates: ShadowGate[];
  centers: ShadowCenter[];
  gateTypes: Record<number, ShadowConditioningType>;
  undefinedCenters: Center[];
};

const EXCLUDED_PLANETS = [ 'Chiron', 'Black Moon Lilith', 'Vulcan', 'Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex' ];

function toSet<T>( value: Set<T> | T[] | undefined | null ): Set<T> {
  if ( value instanceof Set ) return value;
  return new Set( Array.isArray( value ) ? value : [] );
}

function getActiveGates( data: any ): Set<number> {
  const existing = toSet<number>( data?.activeGates );
  if ( existing.size ) return existing;

  const active = new Set<number>();
  [ data?.birthActivations, data?.designActivations ].forEach( ( activations ) => {
    Object.entries( activations || {} ).forEach( ( [ name, act ]: [ string, any ] ) => {
      if ( EXCLUDED_PLANETS.includes( name ) || !act?.gate ) return;
      active.add( Number( act.gate ) );
    } );
  } );
  return active;
}

export function analyzeShadowChart( data: any ): ShadowAnalysis {
  const activeGates = getActiveGates( data );
  const definedCenters = toSet<Center>( data?.definedCenters );
  const undefinedCenters = Object.values( Center ).filter( ( center ) => !definedCenters.has( center ) );
  const gateTypes: Record<number, ShadowConditioningType> = {};
  const gateMap = new Map<number, ShadowGate>();
  const adjacency: Record<string, Center[]> = {};
  const priority: Record<ShadowConditioningType, number> = {
    'conditioning-receptor': 4,
    'mental-conditioner': 3,
    'harmonic-influencer': 2,
    'transpersonal-conditioner': 1,
  };

  Channels.forEach( ( channel ) => {
    const [ a, b ] = channel.gates;
    if ( !activeGates.has( a ) || !activeGates.has( b ) ) return;
    const aCenter = GateToCenter[ a ];
    const bCenter = GateToCenter[ b ];
    if ( !aCenter || !bCenter ) return;
    if ( !adjacency[ aCenter ] ) adjacency[ aCenter ] = [];
    if ( !adjacency[ bCenter ] ) adjacency[ bCenter ] = [];
    adjacency[ aCenter ].push( bCenter );
    adjacency[ bCenter ].push( aCenter );
  } );

  const componentByCenter = new Map<Center, number>();
  let componentId = 0;
  definedCenters.forEach( ( start ) => {
    if ( componentByCenter.has( start ) ) return;
    const queue = [ start ];
    componentByCenter.set( start, componentId );
    while ( queue.length ) {
      const current = queue.shift()!;
      ( adjacency[ current ] || [] ).forEach( ( next ) => {
        if ( !definedCenters.has( next ) || componentByCenter.has( next ) ) return;
        componentByCenter.set( next, componentId );
        queue.push( next );
      } );
    }
    componentId += 1;
  } );

  const bridgesSplit = ( channel: typeof Channels[number] ) => {
    const [ a, b ] = channel.gates;
    const aCenter = GateToCenter[ a ];
    const bCenter = GateToCenter[ b ];
    if ( !aCenter || !bCenter || aCenter === bCenter ) return false;
    if ( !definedCenters.has( aCenter ) || !definedCenters.has( bCenter ) ) return false;
    return componentByCenter.get( aCenter ) !== componentByCenter.get( bCenter );
  };

  const gateIsInCompleteChannel = ( gate: number ) => Channels.some( ( channel ) => (
    ( channel.gates[ 0 ] === gate || channel.gates[ 1 ] === gate )
    && activeGates.has( channel.gates[ 0 ] )
    && activeGates.has( channel.gates[ 1 ] )
  ) );

  const addGate = ( gate: number, entry: Omit<ShadowGate, 'gate' | 'center'>, allowDefinedCenter = false ) => {
    const center = GateToCenter[ gate ];
    if ( !center || ( !allowDefinedCenter && definedCenters.has( center ) ) ) return;
    const existing = gateMap.get( gate );
    if ( existing && priority[ existing.type ] >= priority[ entry.type ] ) return;
    const shadowGate = { gate, center, ...entry };
    gateMap.set( gate, shadowGate );
    gateTypes[ gate ] = shadowGate.type;
  };

  activeGates.forEach( ( gate ) => {
    const center = GateToCenter[ gate ];
    if ( center && !definedCenters.has( center ) ) {
      addGate( gate, { type: 'conditioning-receptor' } );
    }
  } );

  Channels.forEach( ( channel ) => {
    const [ a, b ] = channel.gates;
    const aActive = activeGates.has( a );
    const bActive = activeGates.has( b );
    const isSplitBridge = bridgesSplit( channel );
    const aCenter = GateToCenter[ a ];
    const bCenter = GateToCenter[ b ];

    if ( aActive && !bActive ) {
      const bIsUndefinedCenter = !!bCenter && !definedCenters.has( bCenter );
      const bBridgesSplit = isSplitBridge && !!bCenter && definedCenters.has( bCenter );
      if ( bIsUndefinedCenter || bBridgesSplit ) {
        addGate( b, { type: 'mental-conditioner', channelId: channel.id, oppositeGate: a }, bBridgesSplit );
      }
    }

    if ( bActive && !aActive ) {
      const aIsUndefinedCenter = !!aCenter && !definedCenters.has( aCenter );
      const aBridgesSplit = isSplitBridge && !!aCenter && definedCenters.has( aCenter );
      if ( aIsUndefinedCenter || aBridgesSplit ) {
        addGate( a, { type: 'mental-conditioner', channelId: channel.id, oppositeGate: b }, aBridgesSplit );
      }
    }

    if ( !aActive && !bActive && !isSplitBridge ) {
      addGate( a, { type: 'transpersonal-conditioner', channelId: channel.id, oppositeGate: b } );
      addGate( b, { type: 'transpersonal-conditioner', channelId: channel.id, oppositeGate: a } );
    }
  } );

  Array.from( gateMap.values() ).forEach( ( shadowGate ) => {
    if ( shadowGate.type !== 'mental-conditioner' || !shadowGate.oppositeGate ) return;
    if ( definedCenters.has( shadowGate.center ) ) return;
    if ( !activeGates.has( shadowGate.oppositeGate ) ) return;
    if ( gateIsInCompleteChannel( shadowGate.oppositeGate ) ) return;
    if ( gateTypes[ shadowGate.oppositeGate ] === 'conditioning-receptor' ) return;
    addGate( shadowGate.oppositeGate, {
      type: 'harmonic-influencer',
      channelId: shadowGate.channelId,
      oppositeGate: shadowGate.gate,
    }, true );
  } );

  const gates = Array.from( gateMap.values() ).sort( ( left, right ) => left.gate - right.gate );
  const centers = Object.values( Center ).map( ( center ) => ( {
    center,
    gates: CenterGates[ center ].map( ( gate ) => gateMap.get( gate ) ).filter( Boolean ) as ShadowGate[],
  } ) ).filter( ( center ) => center.gates.length > 0 );

  return { gates, centers, gateTypes, undefinedCenters };
}

export const SHADOW_TYPE_LABELS: Record<ShadowConditioningType, string> = {
  'conditioning-receptor': 'Conditioning Receptor',
  'mental-conditioner': 'Mental Conditioner',
  'transpersonal-conditioner': 'Transpersonal Conditioner',
  'harmonic-influencer': 'Harmonic Influencer',
};
