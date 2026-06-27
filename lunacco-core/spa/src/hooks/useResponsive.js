/**
 * useResponsive — tracks whether the viewport is in mobile mode.
 *
 * The mobile layout is a distinct native-app-like design (bottom nav,
 * compact header, overlay-based navigation) — not just a CSS breakpoint.
 *
 * Provides:
 *   isMobile — boolean, true when viewport width ≤ MOBILE_BREAKPOINT
 */
import { useState, useEffect } from 'react';

export const MOBILE_BREAKPOINT = 1024; // px — matches luna-tarot's MOBILE_VIEW_MAX_WIDTH

export function useResponsive() {
  const [ isMobile, setIsMobile ] = useState(
    () => window.innerWidth <= MOBILE_BREAKPOINT
  );

  useEffect( () => {
    const mq = window.matchMedia( `(max-width: ${ MOBILE_BREAKPOINT }px)` );
    const handler = ( e ) => setIsMobile( e.matches );
    mq.addEventListener( 'change', handler );
    return () => mq.removeEventListener( 'change', handler );
  }, [] );

  return { isMobile };
}
