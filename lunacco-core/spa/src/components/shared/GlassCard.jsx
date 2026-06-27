/**
 * GlassCard — shared editorial card wrapper.
 * Now uses theme tokens for background, border, and radius.
 */
import React from 'react';

export default function GlassCard( { children, className = '', ...props } ) {
  return (
    <div 
      className={ `bg-[var(--card)] border border-[var(--hair)] transition-all duration-200 ${ className }` } 
      style={{ borderRadius: 'var(--radius-card, 0px)' }}
      { ...props }
    >
      { children }
    </div>
  );
}
