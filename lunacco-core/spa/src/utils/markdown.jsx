/**
 * markdown.jsx — React markdown renderer with custom components.
 * Migrated from luna-tarot's spa/src/utils/markdown.jsx.
 */
import React from 'react';

export const markdownComponents = {
  h1: ( { node, ...props } ) => <h1 className="text-xl font-bold text-white mb-2 mt-4 first:mt-0" { ...props } />,
  h2: ( { node, ...props } ) => <h2 className="text-lg font-bold text-white mb-2 mt-4 first:mt-0" { ...props } />,
  h3: ( { node, ...props } ) => <h3 className="text-base font-semibold text-white mb-2 mt-3 first:mt-0" { ...props } />,
  p: ( { node, ...props } ) => <p className="mb-2 last:mb-0 whitespace-pre-wrap" { ...props } />,
  strong: ( { node, ...props } ) => <strong className="font-bold text-white" { ...props } />,
  em: ( { node, ...props } ) => <em className="italic" { ...props } />,
  ul: ( { node, ...props } ) => <ul className="list-disc pl-5 mb-2" { ...props } />,
  ol: ( { node, ...props } ) => <ol className="list-decimal pl-5 mb-2" { ...props } />,
  li: ( { node, ...props } ) => <li className="mb-1" { ...props } />,
};

export function escapeHtml( value ) {
  return `${ value || '' }`
    .replace( /&/g, '&amp;' )
    .replace( /</g, '&lt;' )
    .replace( />/g, '&gt;' )
    .replace( /"/g, '&quot;' )
    .replace( /'/g, '&#39;' );
}

export function markdownToHtml( source ) {
  const text = `${ source || '' }`.replace( /\r\n?/g, '\n' ).trim();
  if ( !text ) return '';

  const lines = text.split( '\n' );
  let listType = null;
  let paragraphBuffer = [];
  const out = [];

  const inline = ( line ) => escapeHtml( line )
    .replace( /\*\*(.+?)\*\*/g, '<strong>$1</strong>' )
    .replace( /__(.+?)__/g, '<strong>$1</strong>' )
    .replace( /\*(.+?)\*/g, '<em>$1</em>' )
    .replace( /_(.+?)_/g, '<em>$1</em>' )
    .replace( /`(.+?)`/g, '<code>$1</code>' );

  const flushParagraph = () => {
    if ( !paragraphBuffer.length ) return;
    const merged = paragraphBuffer.join( '\n' );
    out.push( `<p style="margin:0 0 8px;line-height:1.65;">${ inline( merged ).replace( /\n/g, '<br />' ) }</p>` );
    paragraphBuffer = [];
  };

  const closeList = () => {
    if ( !listType ) return;
    out.push( listType === 'ol' ? '</ol>' : '</ul>' );
    listType = null;
  };

  lines.forEach( ( raw ) => {
    const line = raw.trimEnd();
    const compact = line.trim();

    if ( !compact ) { flushParagraph(); closeList(); return; }

    const headingMatch = compact.match( /^(#{1,6})\s+(.+)$/ );
    if ( headingMatch ) {
      flushParagraph(); closeList();
      const level = headingMatch[ 1 ].length;
      const fontSize = level === 1 ? 22 : level === 2 ? 18 : level === 3 ? 16 : 14;
      out.push( `<h${ level } style="margin:10px 0 6px;font-size:${ fontSize }px;line-height:1.35;">${ inline( headingMatch[ 2 ] ) }</h${ level }>` );
      return;
    }

    const listMatch = compact.match( /^[-*]\s+(.+)$/ );
    const orderedMatch = compact.match( /^(\d+)\.\s+(.+)$/ );
    if ( listMatch ) {
      flushParagraph();
      if ( listType !== 'ul' ) { closeList(); out.push( '<ul style="margin:8px 0 10px 18px;padding:0;">' ); listType = 'ul'; }
      out.push( `<li style="margin:3px 0;">${ inline( listMatch[ 1 ] ) }</li>` );
      return;
    }
    if ( orderedMatch ) {
      flushParagraph();
      if ( listType !== 'ol' ) { closeList(); out.push( '<ol style="margin:8px 0 10px 20px;padding:0;">' ); listType = 'ol'; }
      out.push( `<li style="margin:3px 0;">${ inline( orderedMatch[ 2 ] ) }</li>` );
      return;
    }

    closeList();
    paragraphBuffer.push( compact );
  } );

  flushParagraph();
  closeList();
  return out.join( '' );
}
