/**
 * Footer pieces for the app shell.
 *
 *  - DisclaimerButton: the fixed bottom-left "i" button with the disclaimer + module
 *    notices on hover. Rendered globally by the Shell (kept as-is from before).
 *  - AppFooter: an IN-FLOW footer block (copyright + legal links + AGPL source link)
 *    rendered at the bottom of a view's content column so it scrolls with the content
 *    and never overlaps the sidebar. Uses a plain <div> (not <footer>) to avoid theme
 *    CSS targeting the semantic element.
 *
 * Config (AppConfigContext / Business Settings): footerDisclaimer, footerLinks,
 * agplSourceUrl, pdfSettings.*, moduleFooterNotices.
 */
import React from 'react';
import { Info } from 'lucide-react';
import { useAppConfig } from '../../contexts/AppConfigContext.jsx';

function useActiveNotices( view ) {
  const { moduleFooterNotices } = useAppConfig();
  return ( moduleFooterNotices || [] ).filter( ( n ) => {
    if ( ! n || ! n.text ) return false;
    if ( ! Array.isArray( n.show_on_views ) || n.show_on_views.length === 0 ) return true;
    return n.show_on_views.includes( view );
  } );
}

// Fixed bottom-left disclaimer button (hover reveals disclaimer + module notices).
export function DisclaimerButton( { view = '' } ) {
  const { footerDisclaimer } = useAppConfig();
  const activeNotices = useActiveNotices( view );
  if ( ! footerDisclaimer && activeNotices.length === 0 ) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[130] flex items-center group">
      <button
        type="button"
        className="w-8 h-8 bg-[var(--card)] border border-[var(--hair)] text-[var(--ink)] hover:border-[var(--ink)] transition flex items-center justify-center"
        aria-label="Disclaimer"
        title="Disclaimer"
      >
        <Info size={ 14 } />
      </button>
      <div className="pointer-events-none absolute bottom-10 left-0 w-[320px] max-w-[85vw] bg-[var(--card)] border border-[var(--hair)] px-3 py-2 text-[11px] leading-relaxed text-[var(--ink-soft)] opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 shadow-2xl z-[140]">
        { footerDisclaimer }
        { activeNotices.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[var(--hair)] space-y-1.5 text-[var(--mute)]">
            { activeNotices.map( ( n ) => (
              <div key={ n.id }>{ n.text }</div>
            ) ) }
          </div>
        ) }
      </div>
    </div>
  );
}

// Subtle in-content footer section (NOT a full-width bar): a small attribution/copyright
// paragraph (dynamic, from Business Settings) with a bold links row below it. Placed at
// the bottom of a view's content. The container/area is fixed in code; the text is
// admin-driven. `variant="tarot"` pulls the tarot-specific copyright text field.
//
// On mobile (no hover disclaimer button) the disclaimer + notices show inline.
export default function AppFooter( { view = '', variant = 'default', showDisclaimerInline = false } ) {
  const {
    footerDisclaimer, pdfSettings, footerLinks, agplSourceUrl,
    footerCopyrightText, footerCopyrightTextTarot,
  } = useAppConfig();
  const { copyrightNoticeCustom, copyrightYear, copyrightCompany } = pdfSettings;
  const activeNotices = useActiveNotices( view );

  const fallbackCopyright = copyrightNoticeCustom || `© ${ copyrightYear } ${ copyrightCompany }. All rights reserved.`;
  const copyrightText = ( variant === 'tarot' ? footerCopyrightTextTarot : footerCopyrightText ) || fallbackCopyright;

  const links = Array.isArray( footerLinks ) ? footerLinks : [];
  const hasLinkRow = links.length > 0 || !! agplSourceUrl;

  return (
    <div className="w-full px-6 pt-8 pb-6 flex flex-col items-center gap-2.5 text-center">
      { showDisclaimerInline && footerDisclaimer && (
        <p className="text-[11px] text-[var(--mute)] leading-relaxed max-w-[560px]">
          { footerDisclaimer }
        </p>
      ) }
      { showDisclaimerInline && activeNotices.map( ( n ) => (
        <p key={ n.id } className="text-[10px] text-[var(--mute)] leading-relaxed max-w-[560px] opacity-90">
          { n.text }
        </p>
      ) ) }

      <p className="text-[10px] text-[var(--mute)] leading-relaxed max-w-[640px] opacity-90">
        { copyrightText }
      </p>

      { hasLinkRow && (
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] pt-2.5 mt-0.5 border-t border-[var(--hair)]" style={{ minWidth: 220 }}>
          { links.map( ( l, i ) => (
            <a
              key={ i }
              href={ l.url }
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[var(--mute)] hover:text-[var(--ink)] transition-colors"
            >
              { l.label }
            </a>
          ) ) }
          { agplSourceUrl && (
            <a
              href={ agplSourceUrl }
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[var(--indigo)] hover:underline"
              title="Public source code (AGPL)"
            >
              Source code (AGPL)
            </a>
          ) }
        </nav>
      ) }
    </div>
  );
}
