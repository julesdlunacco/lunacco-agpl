/**
 * LoginModal — login, register, magic link, and forgot password modal.
 *
 * Modes:
 *   login    — username + password form (default)
 *   register — new account form
 *   magic    — email field → sends a magic sign-in link to inbox
 *   forgot   — username/email field → sends a password reset link to inbox
 *
 * Uses AuthContext for auth state/actions.
 * Magic login and Forgot password are handled with local state.
 */
import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useAppConfig } from '../../contexts/AppConfigContext.jsx';

export default function LoginModal() {
  const {
    showLoginModal, closeLoginModal,
    isRegisterMode, toggleRegisterMode,
    performLogin, performRegister,
    username, setUsername,
    password, setPassword,
    registerEmail, setRegisterEmail,
    registerDisplayName, setRegisterDisplayName,
    loginLoading, loginError,
  } = useAuth();
  const { signupPromoText, becomeMemberUrl, root } = useAppConfig();

  // Magic login local state.
  const [ isMagicMode, setIsMagicMode ]         = useState( false );
  const [ magicEmail, setMagicEmail ]           = useState( '' );
  const [ magicLoading, setMagicLoading ]       = useState( false );
  const [ magicError, setMagicError ]           = useState( '' );
  const [ magicSent, setMagicSent ]             = useState( false );

  // Forgot password local state.
  const [ isForgotMode, setIsForgotMode ]       = useState( false );
  const [ forgotLogin, setForgotLogin ]         = useState( '' );
  const [ forgotLoading, setForgotLoading ]     = useState( false );
  const [ forgotError, setForgotError ]         = useState( '' );
  const [ forgotSent, setForgotSent ]           = useState( false );

  const enterMagicMode = useCallback( () => {
    setIsMagicMode( true );
    setIsForgotMode( false );
    setMagicEmail( '' );
    setMagicError( '' );
    setMagicSent( false );
  }, [] );

  const exitMagicMode = useCallback( () => {
    setIsMagicMode( false );
    setMagicError( '' );
    setMagicSent( false );
  }, [] );

  const enterForgotMode = useCallback( () => {
    setIsForgotMode( true );
    setIsMagicMode( false );
    setForgotLogin( '' );
    setForgotError( '' );
    setForgotSent( false );
  }, [] );

  const exitForgotMode = useCallback( () => {
    setIsForgotMode( false );
    setForgotError( '' );
    setForgotSent( false );
  }, [] );

  const handleClose = useCallback( () => {
    exitMagicMode();
    exitForgotMode();
    closeLoginModal();
  }, [ exitMagicMode, exitForgotMode, closeLoginModal ] );

  const handleToggleRegister = useCallback( () => {
    exitMagicMode();
    exitForgotMode();
    toggleRegisterMode();
  }, [ exitMagicMode, exitForgotMode, toggleRegisterMode ] );

  const performMagicRequest = useCallback( async ( e ) => {
    e.preventDefault();
    setMagicLoading( true );
    setMagicError( '' );

    try {
      const resp = await fetch( `${ root }lunacco/v1/user/magic-login/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( { email: magicEmail } ),
      } );
      const data = await resp.json().catch( () => ( {} ) );

      if ( resp.status === 429 ) {
        setMagicError( 'Too many login attempts. Please wait before trying again.' );
      } else if ( resp.ok ) {
        setMagicSent( true );
      } else {
        setMagicError( data.message || 'Something went wrong. Please try again.' );
      }
    } catch ( _err ) {
      setMagicError( 'Connection error. Please try again.' );
    }
    setMagicLoading( false );
  }, [ root, magicEmail ] );

  const performForgotRequest = useCallback( async ( e ) => {
    e.preventDefault();
    setForgotLoading( true );
    setForgotError( '' );

    try {
      const resp = await fetch( `${ root }lunacco/v1/user/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( { username_or_email: forgotLogin } ),
      } );
      const data = await resp.json().catch( () => ( {} ) );

      if ( resp.status === 429 ) {
        setForgotError( 'Too many requests. Please wait before trying again.' );
      } else if ( resp.ok ) {
        setForgotSent( true );
      } else {
        setForgotError( data.message || 'Something went wrong. Please try again.' );
      }
    } catch ( _err ) {
      setForgotError( 'Connection error. Please try again.' );
    }
    setForgotLoading( false );
  }, [ root, forgotLogin ] );

  const modalTitle = isForgotMode
    ? 'Reset Password'
    : isMagicMode
      ? 'Magic Link'
      : isRegisterMode
        ? 'Create Account'
        : 'Sign In';

  return (
    <AnimatePresence>
      { showLoginModal && (
        <motion.div
          initial={ { opacity: 0 } }
          animate={ { opacity: 1 } }
          exit={ { opacity: 0 } }
          className="modal-wrap"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'color-mix(in srgb, var(--ink) 55%, transparent)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            height: '100dvh',
          }}
          role="dialog"
          aria-modal="true"
          aria-label={ modalTitle }
        >
          <motion.div
            initial={ { scale: 0.95, opacity: 0 } }
            animate={ { scale: 1, opacity: 1 } }
            exit={ { scale: 0.95, opacity: 0 } }
            className="modal"
            style={{ position: 'relative' }}
          >
            {/* Close Button */}
            <button
              onClick={ handleClose }
              className="transition-opacity hover:opacity-100"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--ink)',
                opacity: 0.6,
                padding: '4px',
                zIndex: 10,
              }}
              title="Close"
            >
              <X size={ 18 } />
            </button>

            <div className="modal-logo">Luna<b>Co</b></div>
            <div className="modal-sub" style={{ marginBottom: '20px' }}>Natal intelligence · Your chart awaits</div>

            {/* Tab Navigation */}
            <div className="facet-tabs animate-fade-in" style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '24px' }}>
              <button
                className={ !isMagicMode && !isRegisterMode && !isForgotMode ? 'on' : '' }
                onClick={ () => { setIsMagicMode(false); setIsForgotMode(false); if (isRegisterMode) toggleRegisterMode(); } }
                style={{ cursor: 'pointer' }}
              >
                Sign In
              </button>
              <button
                className={ !isMagicMode && isRegisterMode && !isForgotMode ? 'on' : '' }
                onClick={ () => { setIsMagicMode(false); setIsForgotMode(false); if (!isRegisterMode) toggleRegisterMode(); } }
                style={{ cursor: 'pointer' }}
              >
                Create Account
              </button>
              <button
                className={ isMagicMode && !isForgotMode ? 'on' : '' }
                onClick={ () => { setIsForgotMode(false); enterMagicMode(); } }
                style={{ cursor: 'pointer' }}
              >
                Magic Link
              </button>
            </div>

            { !isMagicMode && !isForgotMode && signupPromoText && (
              <div
                style={{
                  padding: '12px',
                  border: '1px solid var(--gold)',
                  background: 'color-mix(in srgb, var(--gold) 5%, transparent)',
                  color: 'var(--gold)',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                  textAlign: 'center',
                  marginBottom: '20px',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                { signupPromoText }
              </div>
            ) }

            { /* ── Forgot Password Mode ── */ }
            { isForgotMode && (
              <>
                { forgotSent ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <p style={{ color: 'var(--indigo)', fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>Check your email!</p>
                    <p style={{ fontSize: '13px', color: 'color-mix(in srgb, var(--ink) 65%, transparent)', lineHeight: 1.5, marginBottom: '24px' }}>
                      If that account exists, a password reset link has been sent to your email address.
                    </p>
                    <button className="modal-btn" onClick={ exitForgotMode }>
                      ← Back to Sign In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={ performForgotRequest }>
                    <p style={{ fontSize: '12.5px', color: 'color-mix(in srgb, var(--ink) 60%, transparent)', marginBottom: '18px', textAlign: 'center', lineHeight: 1.4 }}>
                      Enter your username or email address and we'll email you a secure link to reset your password.
                    </p>
                    <div className="modal-field">
                      <label>Username or Email</label>
                      <input
                        type="text"
                        placeholder="username or email"
                        value={ forgotLogin }
                        onChange={ ( e ) => setForgotLogin( e.target.value ) }
                        required
                        autoFocus
                      />
                    </div>

                    { forgotError && (
                      <div
                        style={{
                          color: 'var(--coral)',
                          fontSize: '12px',
                          border: '1px solid var(--coral)',
                          background: 'color-mix(in srgb, var(--coral) 5%, transparent)',
                          padding: '10px',
                          marginBottom: '16px',
                          textAlign: 'center',
                        }}
                      >
                        { forgotError }
                      </div>
                    ) }

                    <button disabled={ forgotLoading } className="modal-btn">
                      { forgotLoading ? 'Sending...' : 'Send Reset Link' }
                    </button>
                  </form>
                ) }
              </>
            ) }

            { /* ── Magic Login Mode ── */ }
            { isMagicMode && (
              <>
                { magicSent ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <p style={{ color: 'var(--indigo)', fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>Check your inbox!</p>
                    <p style={{ fontSize: '13px', color: 'color-mix(in srgb, var(--ink) 65%, transparent)', lineHeight: 1.5, marginBottom: '24px' }}>
                      A one-time sign-in link has been sent to <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{ magicEmail }</span>.
                    </p>
                    <button className="modal-btn" onClick={ exitMagicMode }>
                      ← Back to Sign In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={ performMagicRequest }>
                    <div className="modal-field">
                      <label>Email Address</label>
                      <input
                        type="email"
                        placeholder="you@email.com"
                        value={ magicEmail }
                        onChange={ ( e ) => setMagicEmail( e.target.value ) }
                        required
                        autoFocus
                      />
                    </div>

                    { magicError && (
                      <div
                        style={{
                          color: 'var(--coral)',
                          fontSize: '12px',
                          border: '1px solid var(--coral)',
                          background: 'color-mix(in srgb, var(--coral) 5%, transparent)',
                          padding: '10px',
                          marginBottom: '16px',
                          textAlign: 'center',
                        }}
                      >
                        { magicError }
                      </div>
                    ) }

                    <button disabled={ magicLoading } className="modal-btn">
                      { magicLoading ? 'Sending...' : 'Email Me a Sign-In Link' }
                    </button>
                  </form>
                ) }
              </>
            ) }

            { /* ── Login / Register Mode ── */ }
            { !isMagicMode && !isForgotMode && (
              <form onSubmit={ isRegisterMode ? performRegister : performLogin }>
                <div className="modal-field">
                  <label>{ isRegisterMode ? 'Username' : 'Username or Email' }</label>
                  <input
                    type="text"
                    placeholder={ isRegisterMode ? 'username' : 'Username or Email' }
                    value={ username }
                    onChange={ ( e ) => setUsername( e.target.value ) }
                    required
                    autoComplete="username"
                  />
                </div>

                { isRegisterMode && (
                  <>
                    <div className="modal-field">
                      <label>Display Name</label>
                      <input
                        type="text"
                        placeholder="Your name"
                        value={ registerDisplayName }
                        onChange={ ( e ) => setRegisterDisplayName( e.target.value ) }
                        autoComplete="name"
                      />
                    </div>
                    <div className="modal-field">
                      <label>Email Address</label>
                      <input
                        type="email"
                        placeholder="you@email.com"
                        value={ registerEmail }
                        onChange={ ( e ) => setRegisterEmail( e.target.value ) }
                        required
                        autoComplete="email"
                      />
                    </div>
                  </>
                ) }

                <div className="modal-field">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={ password }
                    onChange={ ( e ) => setPassword( e.target.value ) }
                    required
                    autoComplete={ isRegisterMode ? 'new-password' : 'current-password' }
                  />
                  { !isRegisterMode && (
                    <div className="modal-forgot">
                      <a style={{ cursor: 'pointer' }} onClick={ enterForgotMode }>Forgot password?</a>
                    </div>
                  ) }
                </div>

                { loginError && (
                  <div
                    style={{
                      color: 'var(--coral)',
                      fontSize: '12px',
                      border: '1px solid var(--coral)',
                      background: 'color-mix(in srgb, var(--coral) 5%, transparent)',
                      padding: '10px',
                      marginBottom: '16px',
                      textAlign: 'center',
                    }}
                  >
                    { loginError }
                  </div>
                ) }

                <button disabled={ loginLoading } className="modal-btn">
                  { loginLoading
                    ? ( isRegisterMode ? 'Creating Account...' : 'Authenticating...' )
                    : ( isRegisterMode ? 'Create Account' : 'Sign In' )
                  }
                </button>

                { !isRegisterMode && (
                  <button
                    type="button"
                    className="modal-btn"
                    onClick={ enterMagicMode }
                    style={{
                      background: 'none',
                      border: '1px solid var(--hair)',
                      color: 'var(--ink)',
                      marginTop: '12px',
                    }}
                  >
                    Sign In with Magic Link
                  </button>
                ) }
              </form>
            ) }

            <div className="modal-divider"><span>or</span></div>
            <div className="modal-alt">
              { isMagicMode ? (
                <a style={{ cursor: 'pointer' }} onClick={ exitMagicMode }>Sign in with password</a>
              ) : isForgotMode ? (
                <a style={{ cursor: 'pointer' }} onClick={ exitForgotMode }>Sign in with password</a>
              ) : isRegisterMode ? (
                <>Already have an account? <a style={{ cursor: 'pointer' }} onClick={ handleToggleRegister }>Sign in →</a></>
              ) : (
                <>New here? <a style={{ cursor: 'pointer' }} onClick={ handleToggleRegister }>Create an account →</a></>
              ) }
            </div>

            { !!becomeMemberUrl && !isMagicMode && !isForgotMode && (
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <a
                  href={ becomeMemberUrl }
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '11px',
                    color: 'color-mix(in srgb, var(--ink) 45%, transparent)',
                    textDecoration: 'none',
                    borderBottom: '1px dotted color-mix(in srgb, var(--ink) 30%, transparent)',
                  }}
                >
                  Explore Member Plans →
                </a>
              </div>
            ) }
          </motion.div>
        </motion.div>
      ) }
    </AnimatePresence>
  );
}
