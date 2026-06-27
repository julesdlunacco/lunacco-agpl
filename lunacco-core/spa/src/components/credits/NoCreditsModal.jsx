/**
 * NoCreditsModal — shown when user lacks credits or hits the free daily limit.
 *
 * Receives props from the module that triggers it (e.g. tarot module).
 * open, onClose, noCreditsType ('premium' | 'limit'), onSignIn
 */
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppConfig } from '../../contexts/AppConfigContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useCredits } from '../../hooks/useCredits.js';

export default function NoCreditsModal( { open, onClose, noCreditsType = 'premium', onSignIn } ) {
  const { buyCreditsUrl, becomeMemberUrl, authButtonLabel } = useAppConfig();
  const { isLoggedIn } = useAuth();
  const { isSubscriber } = useCredits();

  const handleSignIn = () => {
    if ( onSignIn ) {
      onSignIn();
    }
    if ( onClose ) onClose();
  };

  return (
    <AnimatePresence>
      { open && (
        <motion.div
          initial={ { opacity: 0 } }
          animate={ { opacity: 1 } }
          exit={ { opacity: 0 } }
          className="fixed inset-0 z-[1000] flex items-start justify-center p-6 bg-slate-950/85 backdrop-blur-md pt-20 overflow-y-auto"
          onClick={ onClose }
          role="dialog"
          aria-modal="true"
          aria-label="Credits needed"
        >
          <motion.div
            initial={ { scale: 0.9, opacity: 0 } }
            animate={ { scale: 1, opacity: 1 } }
            exit={ { scale: 0.9, opacity: 0 } }
            onClick={ ( e ) => e.stopPropagation() }
            className="w-full max-w-md bg-black/70 border border-amber-400/20 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600" />
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(251,191,36,0.2)]">
                ✨
              </div>
              <h3 className="text-2xl font-bold mb-2">
                { noCreditsType === 'limit' ? 'Daily Limit Reached' : 'Credits Needed' }
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                { noCreditsType === 'limit'
                  ? "You've reached your free daily limit. Come back tomorrow for another free reading, or get credits/membership to continue."
                  : 'Sign in and get credits or membership to continue.'
                }
              </p>
              <div className="flex flex-col gap-3">
                { !isLoggedIn && (
                  <button
                    onClick={ handleSignIn }
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold transition shadow-lg shadow-indigo-500/20"
                  >
                    { authButtonLabel }
                  </button>
                ) }
                { !isSubscriber && (
                  <button
                    className="w-full py-3 bg-amber-600 hover:bg-amber-500 rounded-xl text-white font-bold transition shadow-lg shadow-amber-500/20"
                    onClick={ () => { if ( buyCreditsUrl ) window.open( buyCreditsUrl, '_blank', 'noopener,noreferrer' ); } }
                  >
                    { buyCreditsUrl ? 'Get Credits' : 'Get Credits — Coming Soon' }
                  </button>
                ) }
                { !isSubscriber && (
                  <button
                    className="w-full py-3 bg-indigo-700/70 hover:bg-indigo-600 rounded-xl text-white font-bold transition shadow-lg shadow-indigo-500/20"
                    onClick={ () => { if ( becomeMemberUrl ) window.open( becomeMemberUrl, '_blank', 'noopener,noreferrer' ); } }
                  >
                    { becomeMemberUrl ? 'Become a Member' : 'Membership Link — Not Set' }
                  </button>
                ) }
                <button
                  onClick={ onClose }
                  className="w-full py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 text-sm transition"
                >
                  Return to Reading
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) }
    </AnimatePresence>
  );
}
