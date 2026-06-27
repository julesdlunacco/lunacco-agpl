/**
 * persona.js — AI persona catalog parsing utilities.
 * Migrated from luna-tarot's spa/src/utils/persona.js.
 */

export const DEFAULT_PERSONA_CATALOG = {
  tone: [
    { key: 'gentle', label: 'Gentle', prompt: 'Use a soothing, supportive, compassionate tone.' },
    { key: 'playful', label: 'Playful', prompt: 'Use warm humor, approachable language, and a light but insightful voice.' },
  ],
  focus: [
    { key: 'romance', label: 'Romance', prompt: 'Speak to emotional connection, intimacy, communication, and relational growth.' },
    { key: 'business', label: 'Business', prompt: 'Focus on strategy, leadership, risk, timing, and practical execution.' },
  ],
  lens: [
    { key: 'astrology', label: 'Astrology Lens', prompt: 'Integrate astrology context where relevant, and connect themes to natal patterns if provided.', cost: 1, profile_source: 'astrology' },
    { key: 'human-design', label: 'Human Design Lens', prompt: 'Frame guidance through Human Design strategy, authority, and energetic alignment if provided.', cost: 1, profile_source: 'human_design' },
    { key: 'numerology', label: 'Numerology Lens', prompt: 'Use numerology symbolism and personal number patterns where relevant if provided.', cost: 1, profile_source: 'numerology' },
  ],
};

export function parsePersonaCatalog( val ) {
  if ( !val ) return DEFAULT_PERSONA_CATALOG;
  try {
    const p = typeof val === 'string' ? JSON.parse( val ) : val;
    const normalized = { tone: [], focus: [], lens: [] };

    [ 'tone', 'focus', 'lens' ].forEach( ( cat ) => {
      const items = Array.isArray( p[ cat ] ) ? p[ cat ] : DEFAULT_PERSONA_CATALOG[ cat ];
      normalized[ cat ] = items
        .map( ( item ) => {
          const key = ( item?.key || item?.id || '' ).toString().trim();
          if ( !key ) return null;
          const prompt = ( item?.prompt || '' ).toString().trim();
          if ( !prompt ) return null;
          return {
            key,
            label: ( item?.label || key ).toString().trim(),
            prompt,
            cost: cat === 'lens' ? Math.max( 0, parseInt( item?.cost || 0, 10 ) || 0 ) : 0,
            profile_source: cat === 'lens' ? ( item?.profile_source || '' ).toString().trim() : '',
          };
        } )
        .filter( Boolean );

      if ( !normalized[ cat ].length ) {
        normalized[ cat ] = DEFAULT_PERSONA_CATALOG[ cat ];
      }
    } );

    return normalized;
  } catch ( _e ) {
    return DEFAULT_PERSONA_CATALOG;
  }
}

export function parseFavoriteModelIds( rawValue ) {
  if ( Array.isArray( rawValue ) ) {
    return [ ...new Set( rawValue.map( ( v ) => `${ v || '' }`.trim() ).filter( Boolean ) ) ];
  }

  const asString = `${ rawValue || '' }`.trim();
  if ( !asString ) return [];

  try {
    if ( asString.startsWith( '[' ) ) {
      const parsed = JSON.parse( asString );
      if ( Array.isArray( parsed ) ) {
        return [ ...new Set( parsed.map( ( v ) => `${ v || '' }`.trim() ).filter( Boolean ) ) ];
      }
    }
  } catch ( _err ) {}

  return [ ...new Set(
    asString.split( /[\n,]+/ ).map( ( v ) => v.trim().replace( /^['"]|['"]$/g, '' ) ).filter( Boolean ),
  ) ];
}
