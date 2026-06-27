/**
 * AuthContext — authentication state and actions.
 *
 * Provides:
 *   isLoggedIn, isAdmin
 *   showLoginModal, isRegisterMode
 *   openLoginModal(), closeLoginModal(), toggleRegisterMode()
 *   performLogin(e), performRegister(e), performLogout()
 *   loginError, loginLoading
 *   username, setUsername, password, setPassword
 *   registerEmail, setRegisterEmail, registerDisplayName, setRegisterDisplayName
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { useAppConfig } from './AppConfigContext.jsx';

function normalizeAuthErrorMessage( message ) {
  if ( typeof message !== 'string' || message.trim() === '' ) {
    return 'Login failed. Please check your credentials.';
  }

  const plainMessage = message
    .replace( /<[^>]*>/g, ' ' )
    .replace( /Lost your password\?/gi, ' ' )
    .replace( /\s+/g, ' ' )
    .trim();

  if ( /incorrect/i.test( plainMessage ) ) {
    return 'Incorrect username, email, or password.';
  }

  return plainMessage;
}

export const AuthContext = createContext( null );

export function useAuth() {
  const ctx = useContext( AuthContext );
  if ( !ctx ) throw new Error( 'useAuth must be used within AuthProvider' );
  return ctx;
}

export function AuthProvider( { children } ) {
  const { isLoggedIn: initialIsLoggedIn, isAdmin: initialIsAdmin, root, nonce, authModalDisabled, authPageUrl } = useAppConfig();

  const [ isLoggedIn, setIsLoggedIn ] = useState( initialIsLoggedIn );
  const [ showLoginModal, setShowLoginModal ] = useState( false );
  const [ isRegisterMode, setIsRegisterMode ] = useState( false );

  const [ username, setUsername ] = useState( '' );
  const [ password, setPassword ] = useState( '' );
  const [ registerEmail, setRegisterEmail ] = useState( '' );
  const [ registerDisplayName, setRegisterDisplayName ] = useState( '' );
  const [ loginLoading, setLoginLoading ] = useState( false );
  const [ loginError, setLoginError ] = useState( '' );

  const openLoginModal = useCallback( () => {
    // If auth modal is disabled and an auth page URL is set, redirect instead of showing modal.
    if ( authModalDisabled && authPageUrl ) {
      window.location.href = authPageUrl;
      return;
    }
    setShowLoginModal( true );
  }, [ authModalDisabled, authPageUrl ] );

  const closeLoginModal = useCallback( () => {
    setShowLoginModal( false );
    setLoginError( '' );
  }, [] );

  const toggleRegisterMode = useCallback( () => {
    setIsRegisterMode( ( prev ) => !prev );
    setLoginError( '' );
  }, [] );

  const performLogin = useCallback( async ( e ) => {
    e.preventDefault();
    setLoginLoading( true );
    setLoginError( '' );
    try {
      const res = await fetch( root + 'lunacco/v1/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( { username, password } ),
      } );
      if ( res.ok ) {
        // Reload so WP generates a fresh nonce for the authenticated session.
        window.location.reload();
        return;
      }
      if ( res.status === 429 ) {
        setLoginError( 'Too many failed attempts. Your IP has been temporarily blocked. Please try again later.' );
      } else {
        const data = await res.json().catch( () => ( {} ) );
        setLoginError( normalizeAuthErrorMessage( data.message ) );
      }
    } catch ( _err ) {
      setLoginError( 'Connection error. Please try again.' );
    }
    setLoginLoading( false );
  }, [ root, username, password ] );

  const performRegister = useCallback( async ( e ) => {
    e.preventDefault();
    setLoginLoading( true );
    setLoginError( '' );
    try {
      const res = await fetch( root + 'lunacco/v1/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( { username, password, email: registerEmail, display_name: registerDisplayName } ),
      } );
      if ( res.ok ) {
        window.location.reload();
        return;
      }
      const data = await res.json().catch( () => ( {} ) );
      setLoginError( data.message || 'Registration failed. Please try again.' );
    } catch ( _err ) {
      setLoginError( 'Connection error. Please try again.' );
    }
    setLoginLoading( false );
  }, [ root, username, password, registerEmail, registerDisplayName ] );

  const performLogout = useCallback( async () => {
    try {
      await fetch( root + 'lunacco/v1/user/logout', {
        method: 'POST',
        headers: { 'X-WP-Nonce': nonce },
      } );
    } catch ( _err ) {}
    // Reload to clear WP session cookies cleanly.
    window.location.reload();
  }, [ root, nonce ] );

  const value = {
    isLoggedIn,
    isAdmin: initialIsAdmin,
    showLoginModal,
    isRegisterMode,
    openLoginModal,
    closeLoginModal,
    toggleRegisterMode,
    performLogin,
    performRegister,
    performLogout,
    loginLoading,
    loginError,
    username,
    setUsername,
    password,
    setPassword,
    registerEmail,
    setRegisterEmail,
    registerDisplayName,
    setRegisterDisplayName,
  };

  return (
    <AuthContext.Provider value={ value }>
      { children }
    </AuthContext.Provider>
  );
}
