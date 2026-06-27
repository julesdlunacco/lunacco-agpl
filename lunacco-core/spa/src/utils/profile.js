/**
 * profile.js — user profile data normalization utilities.
 * Migrated from luna-tarot's spa/src/utils/profile.js.
 */

export const EMPTY_PROFILE = {
  identity: {
    full_name: '', nickname: '', birthdate: '',
    city: '', region: '', country: '',
    birth_time: '', birth_location: '', birth_lat: '', birth_lng: '', birth_timezone: '', luck_cycle_polarity: '',
    current_timezone: '',
  },
  preferred_tone: '',
  astrology: { sun_sign: '', moon_sign: '', rising_sign: '', ascendant_longitude: '', stellium_sign_house: '' },
  human_design: { type: '', profile: '', incarnation_cross: '' },
  numerology: { 
    life_path_number: '', 
    expression_number: '', 
    personality_number: '',
    motivation_number: '',
    destiny_number: ''
  },
  settings: { theme_id: 'lavender', font_display: '', font_ui: '', font_mono: '' },
  chart_cache: {},
};

export const PROFILE_SOURCE_REQUIRED_FIELDS = {
  astrology: ['sun_sign', 'moon_sign', 'rising_sign'],
  human_design: ['type', 'profile', 'incarnation_cross'],
  numerology: ['life_path_number', 'expression_number', 'personality_number'],
};

export function normalizeProfileData( raw ) {
  const profile = raw || {};
  return {
    identity: {
      full_name:        ( profile?.identity?.full_name        || '' ).toString(),
      nickname:         ( profile?.identity?.nickname         || '' ).toString(),
      birthdate:        ( profile?.identity?.birthdate        || '' ).toString(),
      city:             ( profile?.identity?.city             || '' ).toString(),
      region:           ( profile?.identity?.region           || '' ).toString(),
      country:          ( profile?.identity?.country          || '' ).toString(),
      birth_time:       ( profile?.identity?.birth_time       || '' ).toString(),
      birth_location:   ( profile?.identity?.birth_location   || '' ).toString(),
      birth_lat:        ( profile?.identity?.birth_lat        || '' ).toString(),
      birth_lng:        ( profile?.identity?.birth_lng        || '' ).toString(),
      birth_timezone:   ( profile?.identity?.birth_timezone   || '' ).toString(),
      luck_cycle_polarity: ( profile?.identity?.luck_cycle_polarity || '' ).toString(),
      current_timezone: ( profile?.identity?.current_timezone || '' ).toString(),
    },
    preferred_tone: ( profile.preferred_tone || '' ).toString(),
    astrology: {
      sun_sign: ( profile?.astrology?.sun_sign || '' ).toString(),
      moon_sign: ( profile?.astrology?.moon_sign || '' ).toString(),
      rising_sign: ( profile?.astrology?.rising_sign || '' ).toString(),
      ascendant_longitude: ( profile?.astrology?.ascendant_longitude || '' ).toString(),
      stellium_sign_house: ( profile?.astrology?.stellium_sign_house || '' ).toString(),
    },
    human_design: {
      type: ( profile?.human_design?.type || '' ).toString(),
      profile: ( profile?.human_design?.profile || '' ).toString(),
      incarnation_cross: ( profile?.human_design?.incarnation_cross || '' ).toString(),
    },
    numerology: {
      life_path_number: ( profile?.numerology?.life_path_number || '' ).toString(),
      expression_number: ( profile?.numerology?.expression_number || '' ).toString(),
      personality_number: ( profile?.numerology?.personality_number || '' ).toString(),
      motivation_number: ( profile?.numerology?.motivation_number || '' ).toString(),
      destiny_number: ( profile?.numerology?.destiny_number || '' ).toString(),
    },
    settings: {
      theme_id: ( profile?.settings?.theme_id || 'lavender' ).toString(),
      font_display: ( profile?.settings?.font_display || '' ).toString(),
      font_ui: ( profile?.settings?.font_ui || '' ).toString(),
      font_mono: ( profile?.settings?.font_mono || '' ).toString(),
    },
    chart_cache: profile?.chart_cache || {},
  };
}

export function getProfileSourceForLens( lensKey, personaCatalog = null ) {
  const lensEntries = Array.isArray( personaCatalog?.lens ) ? personaCatalog.lens : [];
  const selected = lensEntries.find( ( l ) => `${ l?.key || '' }` === `${ lensKey || '' }` );
  const explicit = `${ selected?.profile_source || '' }`.trim();
  if ( explicit ) return explicit;
  if ( lensKey === 'human-design' ) return 'human_design';
  return `${ lensKey || '' }`.trim();
}

function getLensProfileSlice( profile, lensKey, personaCatalog = null ) {
  const source = getProfileSourceForLens( lensKey, personaCatalog );
  if ( source === 'astrology' ) return profile?.astrology || {};
  if ( source === 'human_design' ) return profile?.human_design || {};
  if ( source === 'numerology' ) return profile?.numerology || {};
  return {};
}

export function mergeLensContext( lensKey, profile = EMPTY_PROFILE, lensInput = {}, personaCatalog = null ) {
  const fromProfile = getLensProfileSlice( profile, lensKey, personaCatalog );
  return { ...fromProfile, ...( lensInput || {} ) };
}

export function getMissingLensFields( lensKey, lensContext = {}, personaCatalog = null ) {
  const source = getProfileSourceForLens( lensKey, personaCatalog );
  const required = PROFILE_SOURCE_REQUIRED_FIELDS[ source ] || [];
  return required.filter( ( field ) => !`${ lensContext?.[ field ] || '' }`.trim() );
}
