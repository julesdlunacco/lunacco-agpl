/**
 * Luna AstroHD - dashboard daily data computation.
 *
 * Runs browser-side WASM ephemeris calcs once per session (sessionStorage
 * cached, 12h TTL) and publishes the result to:
 *   - window.LunaCcoAstroHDDaily
 *   - CustomEvent 'lunacco:astrohd-daily'
 *
 * Widgets in CoreDashboardView.jsx read from these.
 *
 * Heavy work (WASM init + ephemeris reads) is deferred one idle tick so
 * it never blocks first paint.
 */

import { DateTime } from 'luxon';
import { AstrologyWidgetsService } from './services/AstrologyWidgetsService';
import { detectStelliums } from './services/AstroInsightsService';

type DailyPayload = {
  moon: { phase: string; sign: string; note: string; moonLongitude: number; nextPhases?: Array<{ label: string; date: string; sign: string; longitude: number }> } | null;
  ingresses: Array<{ label: string; detail?: string; iso?: string; longitude: number; ingressType: 'astrology' | 'hd-gate' }>;
  retrogrades: {
    current: Array<{ label: string; detail?: string; longitude: number; endIso?: string }>;
    upcoming: Array<{ label: string; detail?: string; longitude: number; startIso?: string; endIso?: string }>;
  };
  stelliums: Array<{ label: string; detail?: string; longitude: number }>;
  skyNow: Array<{ name: string; symbol: string; longitude: number; sign: string; signSymbol: string; gate: number; line: number; isRetrograde: boolean }>;
  computedAt: string;
};

const CACHE_KEY = 'lunacco:astrohd:daily:v10';
const CACHE_TTL_MS = 10 * 60 * 1000;

function readCache(): DailyPayload | null {
  try {
    const raw = sessionStorage.getItem( CACHE_KEY );
    if ( ! raw ) return null;
    const parsed = JSON.parse( raw );
    if ( ! parsed?.computedAt ) return null;
    const age = Date.now() - new Date( parsed.computedAt ).getTime();
    if ( age > CACHE_TTL_MS ) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache( p: DailyPayload ): void {
  try {
    sessionStorage.setItem( CACHE_KEY, JSON.stringify( p ) );
  } catch {
    // Quota or privacy-mode; silently drop.
  }
}

function publish( p: DailyPayload ): void {
  ( window as any ).LunaCcoAstroHDDaily = p;
  window.dispatchEvent( new CustomEvent( 'lunacco:astrohd-daily', { detail: p } ) );
}

export async function computeAndPublishDaily(): Promise<void> {
  const cached = readCache();
  if ( cached ) {
    publish( cached );
    return;
  }

  publish( {
    moon: null,
    ingresses: [],
    retrogrades: { current: [], upcoming: [] },
    stelliums: [],
    skyNow: [],
    computedAt: new Date( 0 ).toISOString(),
  } );

  const svc = new AstrologyWidgetsService();
  const now = DateTime.now().toUTC();

  try {
    const retroSearchEnd = now.plus( { months: 3 } );
    const [ moon, retros, skyNowRaw, retroPeriods ] = await Promise.all( [
      svc.getMoonPhase( now ),
      svc.getCurrentRetrogrades( now ),
      svc.getSkyNow( now ),
      svc.findRetrogradePeriods( now.startOf( 'day' ), retroSearchEnd ),
    ] );

    const planetsForStellium = skyNowRaw.map( p => ( {
      name: p.name,
      longitude: p.longitude,
      sign: p.sign,
    } ) );
    const stelliumList = detectStelliums( planetsForStellium );

    // Include astrology sign ingresses and HD gate changes.
    // Only exclude the Moon from the HD gate side so the list does not get too noisy.
    const start = now;
    const end = now.endOf( 'month' );
    const events = await svc.getCalendarEvents( start, end, undefined, undefined, {
      includeVoc: false,
      includeTightAspects: false,
      includeCriticalDegrees: false,
      includeConcentration: false,
    } );

    const ingressEvents = events
      .filter( e =>
        e.type === 'moon-ingress' ||
        e.type === 'planet-ingress' ||
        ( e.type === 'planet-gate-ingress' && e.planet !== 'Moon' )
      )
      .sort( ( a, b ) => a.date.toMillis() - b.date.toMillis() )
      .slice( 0, 12 )
      .map( ( e: any ) => {
        const dt = e.date;
        const iso = dt?.isValid ? dt.toISO() ?? '' : '';
        const when = dt?.isValid ? dt.toFormat( 'LLL d, HH:mm' ) : '';
        const label = e.type === 'planet-gate-ingress'
          ? `${ e.planetSymbol || '' } ${ e.planet } -> G${ e.toGate || '' }`.trim()
          : `${ e.planetSymbol || '' } ${ e.planet } -> ${ e.toSignSymbol || '' } ${ e.toSign || '' }`.trim();

        const signs = [ 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces' ];
        const sIdx = signs.indexOf( e.toSign );
        const longitude = sIdx !== -1
          ? sIdx * 30
          : skyNowRaw.find( p => p.name === e.planet )?.longitude ?? 0;

        const detail = e.type === 'planet-gate-ingress'
          ? `${ e.fromGate ? `G${ e.fromGate } -> ` : '' }G${ e.toGate }${ when ? ` · ${ when }` : '' }`
          : when;

        return {
          label,
          detail,
          iso,
          longitude,
          ingressType: e.type === 'planet-gate-ingress' ? 'hd-gate' : 'astrology',
        };
      } );

    const retroActive = retros
      .filter( r => r.isRetrograde )
      .map( r => ( {
        label: `${ r.symbol } ${ r.name } rx`,
        detail: `${ r.signSymbol } ${ r.sign } ${ r.degree }`,
        longitude: r.longitude,
        endIso: retroPeriods.find( period =>
          period.planet === r.name &&
          period.startDate <= now &&
          period.endDate >= now
        )?.endDate.toISO() || '',
      } ) );

    const upcomingRetrogrades = retroPeriods
      .filter( period => period.startDate > now )
      .map( period => ( {
        label: `${ period.symbol } ${ period.planet } rx`,
        detail: `${ period.startSign } to ${ period.endSign }`,
        longitude: skyNowRaw.find( p => p.name === period.planet )?.longitude ?? 0,
        startIso: period.startDate.toISO() || '',
        endIso: period.endDate.toISO() || '',
      } ) );

    const stelliums = stelliumList.map( s => ( {
      label: `${ s.planets.length } in ${ s.sign }`,
      detail: s.planets.map( p => p.name ).join( ', ' ),
      longitude: s.planets[ 0 ]?.longitude ?? 0,
    } ) );

    const payload: DailyPayload = {
      moon: {
        phase: `${ moon.phaseEmoji } ${ moon.phaseName }`,
        sign: `${ moon.moonSignSymbol } ${ moon.moonSign }`,
        note: `${ moon.illumination }% illuminated · ${ moon.isWaxing ? 'waxing' : 'waning' }`,
        moonLongitude: moon.moonLongitude,
        nextPhases: ( moon.upcoming || [] ).map( p => ( {
          label: p.label,
          date: p.date.toISO() || '',
          sign: `${ p.signSymbol } ${ p.sign }`,
          longitude: p.longitude,
        } ) ),
      },
      ingresses: ingressEvents,
      retrogrades: {
        current: retroActive,
        upcoming: upcomingRetrogrades,
      },
      stelliums,
      skyNow: skyNowRaw.map( r => ( {
        name: r.name,
        symbol: r.symbol,
        longitude: r.longitude,
        sign: r.sign,
        signSymbol: r.signSymbol,
        degree: r.degree,
        gate: svc.getGateFromLongitude( r.longitude ),
        line: svc.getLineFromLongitude( r.longitude ),
        isRetrograde: r.isRetrograde,
      } ) ),
      computedAt: new Date().toISOString(),
    };

    writeCache( payload );
    publish( payload );
  } catch ( err ) {
    console.error( '[luna-astrohd] daily calc failed:', err );
    publish( {
      moon: null,
      ingresses: [],
      retrogrades: { current: [], upcoming: [] },
      stelliums: [],
      skyNow: [],
      computedAt: new Date().toISOString(),
    } );
  }
}
