/**
 * ReportConfirmModal — confirmation dialog before an AI report is generated.
 *
 * Shows the credit cost and asks the user to confirm.
 * Props: open, onConfirm, onClose, cost, loading, promptPreview
 */
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, Sparkles, X } from 'lucide-react';

export default function ReportConfirmModal( { open, onConfirm, onClose, cost = 1, loading = false, promptPreview = null } ) {
  return (
    <AnimatePresence>
      { open && (
        <motion.div
          initial={ { opacity: 0 } }
          animate={ { opacity: 1 } }
          exit={ { opacity: 0 } }
          className="fixed inset-0 z-[1000] flex items-start justify-center p-6 bg-slate-950/80 backdrop-blur-md pt-20 overflow-y-auto"
          onClick={ onClose }
          role="dialog"
          aria-modal="true"
          aria-label="Confirm report generation"
        >
          <motion.div
            initial={ { scale: 0.9, opacity: 0 } }
            animate={ { scale: 1, opacity: 1 } }
            exit={ { scale: 0.9, opacity: 0 } }
            onClick={ ( e ) => e.stopPropagation() }
            className="w-full max-w-lg bg-black/70 border border-white/15 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500" />
            <div className="p-8">
              <button onClick={ onClose } className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition">
                <X size={ 18 } />
              </button>
              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Sparkles size={ 28 } />
                </div>
              </div>
              <h3 className="text-xl font-bold text-center mb-2">Generate AI Report</h3>
              <p className="text-sm text-gray-400 text-center mb-6">
                This will use <span className="font-bold text-white">{ cost } credit{ cost === 1 ? '' : 's' }</span> from your balance.
              </p>

              { promptPreview && (
                <div className="mb-6 rounded-xl bg-black/40 border border-white/10 p-4 max-h-48 overflow-y-auto">
                  <p className="text-[11px] uppercase tracking-widest text-indigo-300 mb-2">Prompt Preview</p>
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{ promptPreview }</pre>
                </div>
              ) }

              <div className="flex gap-3">
                <button
                  onClick={ onClose }
                  className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-sm transition"
                >
                  Cancel
                </button>
                <button
                  onClick={ onConfirm }
                  disabled={ loading }
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-white font-bold text-sm transition flex items-center justify-center gap-2"
                >
                  { loading ? <RefreshCw className="animate-spin" size={ 16 } /> : <Sparkles size={ 16 } /> }
                  { loading ? 'Generating...' : 'Confirm & Generate' }
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) }
    </AnimatePresence>
  );
}
