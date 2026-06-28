/**
 * UserContext — user context data (balance, subscription, profile, display name).
 *
 * Provides:
 *   userContext   — full context object from lunacco/v1/user/context
 *   profileData   — normalized profile (astrology, human_design, numerology)
 *   refreshUser() — re-fetches user context from the server
 *   saveProfile(data) — saves profile via REST and refreshes
 *   profileSaving, profileSavedMsg
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAppConfig } from './AppConfigContext.jsx';
import { useAuth } from './AuthContext.jsx';
import { normalizeProfileData, EMPTY_PROFILE, deriveProfileSummaryFromChart } from '../utils/profile.js';

const DEFAULT_USER_CONTEXT = {
  balance: 0,
  membership_balance: 0,
  purchased_balance: 0,
  is_subscriber: false,
  is_admin: false,
  has_free_daily: false,
  display_name: '',
  username: '',
  email: '',
  avatar_url: '',
  account_url: '',
  auth_modal_disabled: false,
  auth_page_url: '',
  profile: null,
};

export const UserContext = createContext( null );

export function useUser() {
  const ctx = useContext( UserContext );
  if ( !ctx ) throw new Error( 'useUser must be used within UserProvider' );
  return ctx;
}

export function UserProvider( { children } ) {
  const { root, nonce } = useAppConfig();
  const { isLoggedIn } = useAuth();

  const [ userContext, setUserContext ] = useState( DEFAULT_USER_CONTEXT );
  const [ profileData, setProfileData ] = useState( EMPTY_PROFILE );
  // Start as true when logged in so consumers don't flash empty state before first load
  const [ profileLoading, setProfileLoading ] = useState( isLoggedIn );
  const [ profileSaving, setProfileSaving ] = useState( false );
  const [ profileSavedMsg, setProfileSavedMsg ] = useState( '' );

  const [ people, setPeople ] = useState( [] );
  const [ peopleLoading, setPeopleLoading ] = useState( false );
  const [ currentPersonId, setCurrentPersonId ] = useState( null );

  const refreshUser = useCallback( () => {
    setProfileLoading( true );
    fetch( root + 'lunacco/v1/user/context', {
      headers: { 'X-WP-Nonce': nonce },
    } )
      .then( ( res ) => res.json() )
      .then( ( data ) => {
        if ( !data.code ) {
          setUserContext( data );
          setProfileData( normalizeProfileData( data.profile || EMPTY_PROFILE ) );
        }
      } )
      .catch( () => {} )
      .finally( () => setProfileLoading( false ) );
  }, [ root, nonce ] );

  const loadPeople = useCallback( async () => {
    setPeopleLoading( true );
    try {
      const res = await fetch( root + 'lunacco/v1/people', {
        headers: { 'X-WP-Nonce': nonce },
      } );
      if ( res.ok ) {
        const data = await res.json();
        setPeople( data.people || [] );
      }
    } catch ( e ) {
      console.error( 'Failed to load people', e );
    } finally {
      setPeopleLoading( false );
    }
  }, [ root, nonce ] );

  const savePerson = useCallback( async ( payload, id = null ) => {
    try {
      const url = id ? `${root}lunacco/v1/people/${id}` : `${root}lunacco/v1/people`;
      const method = id ? 'PUT' : 'POST';
      const res = await fetch( url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce,
        },
        body: JSON.stringify( payload ),
      } );
      if ( res.ok ) {
        const data = await res.json();
        if ( id ) {
          setPeople( prev => prev.map( p => p.id === id ? { ...p, ...payload } : p ) );
        } else {
          await loadPeople();
          return data.id;
        }
      }
    } catch ( e ) {
      console.error( 'Failed to save person', e );
    }
  }, [ root, nonce, loadPeople ] );

  const deletePerson = useCallback( async ( id ) => {
    try {
      const res = await fetch( `${root}lunacco/v1/people/${id}`, {
        method: 'DELETE',
        headers: { 'X-WP-Nonce': nonce },
      } );
      if ( res.ok ) {
        setPeople( prev => prev.filter( p => p.id !== id ) );
      }
    } catch ( e ) {
      console.error( 'Failed to delete person', e );
    }
  }, [ root, nonce ] );

  // Fetch user context and people on mount (when logged in).
  useEffect( () => {
    if ( isLoggedIn ) {
      refreshUser();
      loadPeople();
    } else {
      setPeople( [] );
      setCurrentPersonId( null );
    }
  }, [ isLoggedIn, refreshUser, loadPeople ] );

  const saveProfile = useCallback( async ( data, { includeChartCache = true } = {} ) => {
    setProfileSaving( true );
    setProfileSavedMsg( '' );
    // Lightweight saves (profile form) can skip the bulky chart_cache; the server
    // preserves the stored cache when it's omitted. Local state keeps the full
    // object so cached charts stay available without a refetch.
    let payload = data;
    if ( ! includeChartCache && data && typeof data === 'object' ) {
      const { chart_cache, ...rest } = data;
      payload = rest;
    }
    try {
      const res = await fetch( root + 'lunacco/v1/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce,
        },
        body: JSON.stringify( { profile: payload } ),
      } );
      if ( res.ok ) {
        setProfileData( normalizeProfileData( data ) );
        setProfileSavedMsg( 'Profile saved!' );
        setTimeout( () => setProfileSavedMsg( '' ), 3000 );
      } else {
        setProfileSavedMsg( 'Save failed. Please try again.' );
      }
    } catch ( _err ) {
      setProfileSavedMsg( 'Connection error.' );
    }
    setProfileSaving( false );
  }, [ root, nonce ] );

  const saveChartCache = useCallback( async ( personId, cacheKey, data ) => {
    const isAstroHD = cacheKey.startsWith( 'natal_' ) || cacheKey === 'shadow' || cacheKey.startsWith( 'asteroids_' ) || cacheKey === 'asteroids';
    if ( isAstroHD ) {
      let chartType = 'natal';
      if ( cacheKey === 'shadow' ) {
        chartType = 'shadow';
      } else if ( cacheKey.startsWith( 'asteroids_' ) || cacheKey === 'asteroids' ) {
        chartType = 'asteroids';
      }
      
      const person = personId === null ? null : ( people || [] ).find( p => p.id === personId );
      const title = person ? ( person.full_name || person.display_name ) : ( userContext?.display_name || 'Myself' );

      fetch( root + 'luna-astrohd/v1/charts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce,
        },
        body: JSON.stringify( {
          chart_type: chartType,
          token: data?.token,
          title,
          input_data: data?.input,
          chart_data: data?.data,
          is_profile_chart: personId === null ? 1 : 0,
          person_id: personId,
        } ),
      } ).catch( ( err ) => console.error( 'Failed to save chart to database', err ) );
    }

    if ( personId === null ) {
      const updatedProfile = {
        ...profileData,
        chart_cache: {
          ...( profileData?.chart_cache || {} ),
          [cacheKey]: data,
        },
      };

      // Auto-fill the profile's Astrology / Human Design summary from the user's
      // own natal chart (any natal pull — default or chart maker). Text fields
      // only fill when empty so manual edits are preserved; ascendant_longitude
      // (drives dashboard houses, not user-editable) always refreshes.
      if ( cacheKey.startsWith( 'natal_' ) ) {
        const summary = deriveProfileSummaryFromChart( data?.data );
        const astro = { ...( updatedProfile.astrology || {} ) };
        const hd    = { ...( updatedProfile.human_design || {} ) };
        [ 'sun_sign', 'moon_sign', 'rising_sign' ].forEach( ( k ) => {
          if ( summary.astrology[ k ] && ! `${ astro[ k ] || '' }`.trim() ) astro[ k ] = summary.astrology[ k ];
        } );
        if ( summary.astrology.ascendant_longitude ) astro.ascendant_longitude = summary.astrology.ascendant_longitude;
        [ 'type', 'profile', 'incarnation_cross' ].forEach( ( k ) => {
          if ( summary.human_design[ k ] && ! `${ hd[ k ] || '' }`.trim() ) hd[ k ] = summary.human_design[ k ];
        } );
        updatedProfile.astrology = astro;
        updatedProfile.human_design = hd;
      }

      setProfileData( updatedProfile );
      await saveProfile( updatedProfile );
    } else {
      const person = ( people || [] ).find( p => p.id === personId );
      if ( person ) {
        const updatedCache = {
          ...( person.chart_cache || {} ),
          [cacheKey]: data,
        };
        const updatedPerson = {
          ...person,
          chart_cache: updatedCache,
        };
        setPeople( prev => prev.map( p => p.id === personId ? updatedPerson : p ) );
        await savePerson( updatedPerson, personId );
      }
    }
  }, [ profileData, saveProfile, people, savePerson, root, nonce, userContext ] );

  const value = {
    userContext,
    profileData,
    profileLoading,
    setProfileData,
    refreshUser,
    saveProfile,
    profileSaving,
    profileSavedMsg,
    people,
    peopleLoading,
    loadPeople,
    savePerson,
    deletePerson,
    currentPersonId,
    setCurrentPersonId,
    saveChartCache,
  };

  return (
    <UserContext.Provider value={ value }>
      { children }
    </UserContext.Provider>
  );
}
