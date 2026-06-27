import React from 'react';

export default function PlaceholderView( { title = 'AstroHD', subtitle = 'Coming soon.' } ) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'var(--font-display, serif)', color: 'var(--ink, #1a1a1a)' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{title}</h1>
      <p style={{ color: 'var(--mute, #666)' }}>{subtitle}</p>
    </div>
  );
}
