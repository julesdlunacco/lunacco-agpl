import React from 'react';

/**
 * In-content attribution footer for AstroHD chart views.
 *
 * The TEXT is dynamic — pulled from Business Settings (lt_footer_copyright_text) via
 * window.LunaCcoData.footerCopyrightText — so the copyright / Swiss Ephemeris / AGPL
 * attribution is editable in admin instead of hardcoded. Legal links + the AGPL source
 * link render bold on a line below. A built-in fallback keeps AGPL attribution present
 * if the admin hasn't filled the text in yet.
 *
 * Reads only the global window.LunaCcoData (no cross-plugin import), preserving the
 * module boundary.
 */
const FALLBACK =
  'Ephemeris calculations © Astrodienst AG · Swiss Ephemeris · used under the AGPL v2 license. ' +
  'Source code is made available in a public repository in compliance with the AGPL.';

export default function ChartAttributionFooter() {
  const d: any = ( window as any ).LunaCcoData || {};
  const text: string = d.footerCopyrightText || FALLBACK;
  const links: Array<{ label: string; url: string }> = Array.isArray( d.footerLinks ) ? d.footerLinks : [];
  const agpl: string = d.agplSourceUrl || '';
  const hasLinks = links.length > 0 || !! agpl;

  return (
    <div style={{ marginTop: 32, paddingTop: 12, paddingBottom: 24, textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'var(--mute)', lineHeight: 1.6, letterSpacing: '0.04em', maxWidth: 640, margin: '0 auto' }}>
        { text }
      </p>
      { hasLinks && (
        <p
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--hair)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px 16px',
            justifyContent: 'center',
            fontSize: 11,
            maxWidth: 420,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          { links.map( ( l, i ) => (
            <a key={ i } href={ l.url } target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mute)', fontWeight: 700, textDecoration: 'none' }}>
              { l.label }
            </a>
          ) ) }
          { agpl && (
            <a href={ agpl } target="_blank" rel="noopener noreferrer" style={{ color: 'var(--indigo)', fontWeight: 700, textDecoration: 'none' }}>
              Source code (AGPL)
            </a>
          ) }
        </p>
      ) }
    </div>
  );
}
