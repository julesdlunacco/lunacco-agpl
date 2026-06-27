/**
 * Asteroids View — Advanced display of asteroid signatures for Personality and Design.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EphemerisService } from '../services/EphemerisService';
import { GateToCenter } from '../services/HumanDesignDefinitions';
import { AstroWheel } from '../components/AstroWheel';
import { HouseSystemToggle } from '../components/HouseSystemToggle';
import ChartAttributionFooter from '../components/ChartAttributionFooter';

const REST_ROOT = ( () => {
  const d = ( window as any ).LunaCcoData || {};
  return ( d.root || '/wp-json/' ).replace( /\/$/, '' ) + '/';
} )();
const NONCE = ( () => ( ( window as any ).LunaCcoData || {} ).nonce || '' )();

async function fetchJSON( path: string, init: RequestInit = {} ) {
  const res = await fetch( REST_ROOT + path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce':   NONCE,
      ...( init.headers || {} ),
    },
  } );
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse( text ) : null; } catch { body = text; }
  if ( ! res.ok ) throw new Error( ( body && body.message ) || `${ res.status }` );
  return body;
}

function serializeChart( data: any ): any {
  return JSON.parse( JSON.stringify( data, ( _k, v ) => {
    if ( v instanceof Set ) return Array.from( v );
    if ( v instanceof Map ) return Object.fromEntries( v );
    return v;
  } ) );
}

const AVAILABLE_ASTEROIDS = [
  { name: 'Ceres', description: 'Nurturing, abundance, self-care' },
  { name: 'Pallas', description: 'Wisdom, strategy, intellect' },
  { name: 'Juno', description: 'Commitment, marriage, partnership' },
  { name: 'Vesta', description: 'Devotion, focus, inner flame' },
  { name: 'Pholus', description: 'Catalyst, turning points' },
  { name: 'Iris', description: 'Communication, messenger, hope' },
  { name: 'Hygiea', description: 'Physical and mental health' },
  { name: 'Psyche', description: 'Soul path, growth, trials' },
  { name: 'Melpomene', description: 'Tragedies, song, and poetry' },
  { name: 'Fortuna', description: 'Fate, luck, and wheel of fortune' },
  { name: 'Themis', description: 'Divine order, natural law, fairness' },
  { name: 'Urania', description: 'Astrology, cosmic wisdom' },
  { name: 'Pomona', description: 'Abundance, fruitfulness' },
  { name: 'Circe', description: 'Sorcery, magic, transformation' },
  { name: 'Fides', description: 'Trust, faith, and loyalty' },
  { name: 'Daphne', description: 'Boundary setting, protection' },
  { name: 'Isis', description: 'Devotion, magic, and rebirth' },
  { name: 'Echo', description: 'Validation, reflection, voice' },
  { name: 'Niobe', description: 'Grief, pride, trials' },
  { name: 'Feronia', description: 'Freedom, wildlife, wilderness' },
  { name: 'Freia', description: 'Love, beauty, and abundance' },
  { name: 'Klio', description: 'History, writing, fame' },
  { name: 'Aurora', description: 'Dawn, new beginnings' },
  { name: 'Hekate', description: 'Crossroads, magic, choices' },
  { name: 'Artemis', description: 'Independence, wild nature, hunt' },
  { name: 'Felicitas', description: 'Good luck, prosperity' },
  { name: 'Kassandra', description: 'Prophecies, intuition, truth' },
  { name: 'Lachesis', description: 'Destiny, choices, lifespan' },
  { name: 'Liberatrix', description: 'Liberation and freedom' },
  { name: 'Nemesis', description: 'Justice, retribution, self-sabotage' },
  { name: 'Elektra', description: 'Family dynamics, truth' },
  { name: 'Abundantia', description: 'Wealth, success, prosperity' },
  { name: 'Bertha', description: 'Bright, glorious energy' },
  { name: 'Sibylla', description: 'Prophecy, oracle, divination' },
  { name: 'Eucharis', description: 'Grace, charm, and kindness' },
  { name: 'Medea', description: 'Healer, magic, passion' },
  { name: 'Sophia', description: 'Cosmic wisdom, philosophy' },
  { name: 'Tyche', description: 'Fortune, chance, destiny' },
  { name: 'Magdalena', description: 'Devotion, sacred alignment' },
  { name: 'Gabriella', description: 'Strength, protection' },
  { name: 'Bona', description: 'Good fortune, benevolence' },
  { name: 'Hades', description: 'Underworld, unseen depths' },
  { name: 'Fama', description: 'Reputation, legacy' },
  { name: 'Hybris', description: 'Pride, arrogance, boundary testing' },
  { name: 'Pythia', description: 'Channeling, prediction' },
  { name: 'Eros', description: 'Desire, passion, life force' },
  { name: 'Photographica', description: 'Visual art, perception' },
  { name: 'Damocles', description: 'Vulnerability, impending change' },
  { name: 'Achilles', description: 'Vulnerability, strength' },
  { name: 'Charis', description: 'Grace, charm, and kindness' },
  { name: 'Moira', description: 'Fate, destiny, life thread' },
  { name: 'Pax', description: 'Peace, harmony, reconciliation' },
  { name: 'Raphaela', description: 'Divine healing, protection' },
  { name: 'Sphinx', description: 'Riddles, mystery, hidden knowledge' },
  { name: 'Sirene', description: 'Seduction, illusion, temptation' },
  { name: 'Aesculapia', description: 'Healing, wellness' },
  { name: 'Copia', description: 'Abundance, plenty' },
  { name: 'Demeter', description: 'Motherhood, harvest' },
  { name: 'Pecunia', description: 'Money, finances, material wealth' },
  { name: 'Atlantis', description: 'Lost wisdom, hubris' },
  { name: 'Hypnos', description: 'Sleep, dreams, unconscious mind' },
  { name: 'Aura', description: 'Energy field, presence' },
  { name: 'Apollo', description: 'Truth, clarity, music' },
  { name: 'Sisyphus', description: 'Endurance, repetitive effort' },
  { name: 'Anubis', description: 'Transition, guidance' },
  { name: 'Horus', description: 'Vision, power, protection' },
  { name: 'Lucifer', description: 'Light-bringer, self-realization' },
  { name: 'Midas', description: 'Value, golden touch, greed' },
  { name: 'Bacchus', description: 'Ecstasy, liberation, indulgence' },
  { name: 'Tantalus', description: 'Temptation, frustration, desire' },
  { name: 'Ganesa', description: 'Obstacles, wisdom, beginnings' },
  { name: 'Merlin', description: 'Magic, alchemy, wisdom' },
  { name: 'Magion', description: 'Spiritual focus, magic' },
  { name: 'Parvati', description: 'Devotion, strength, marriage' },
  { name: 'Panacea', description: 'Universal cure, healing' },
  { name: 'Makhaon', description: 'Surgical healing, medical skill' },
  { name: 'Bounty', description: 'Generosity, gifts' },
  { name: 'Glo', description: 'Radiance, light, glow' },
  { name: 'Wisdom', description: 'Deep insight, intellect' },
  { name: 'Kafka', description: 'Bureaucracy, existential trials' },
  { name: 'Opportunity', description: 'Timing, favorable moments' },
  { name: 'Angst', description: 'Existential dread, learning' },
  { name: 'Kaali', description: 'Time, destruction, transformation' },
  { name: 'Spacewatch', description: 'Observer, cosmic lookout' },
  { name: 'Child', description: 'Inner child, purity' },
  { name: 'Sybil', description: 'Prophetic insight, channeling' },
  { name: 'Gold', description: 'Value, radiance, royalty' },
  { name: 'Reiki', description: 'Universal energy, healing' },
  { name: 'Telephus', description: 'Wounds and recovery' },
  { name: 'Silver', description: 'Intuition, lunar energy' },
  { name: 'Akashi', description: 'Akashic records, soul history' },
  { name: 'Destinn', description: 'Destiny and fate paths' },
  { name: 'Mony', description: 'Material focus, prosperity' },
  { name: 'Chariklo', description: 'Compassion, holding space' },
  { name: 'Angel', description: 'Guidance, peace, protection' },
  { name: 'Fast', description: 'Speed, agility' },
  { name: 'Talent', description: 'Innate gifts, mastery' },
  { name: 'Spirit', description: 'Core essence, divine spark' },
  { name: 'Hawaii/Lemuria', description: 'Ancient roots, heart opening' },
  { name: 'DNA', description: 'Ancestral memory, coding' },
  { name: 'Logos/Persuasia', description: 'Reason, word, communication' },
  { name: 'Hermes', description: 'Communication, speed' },
  { name: 'Sedna', description: 'Ocean wisdom, trust' },
  { name: 'Bless', description: 'Gratitude, blessings' },
  { name: 'Maia', description: 'Growth, nurturing' },
  { name: 'Eris', description: 'Discord, rebel spirit, truth' },
  { name: 'Makemake', description: 'Creation, fertility, power' },
  { name: 'Jobse', description: 'Perseverance, endurance' }
];

const PRESETS = {
  base5: ['Ceres', 'Pallas', 'Juno', 'Vesta', 'Pholus'],
  goddess: ['Ceres', 'Pallas', 'Juno', 'Vesta', 'Iris', 'Psyche', 'Fortuna', 'Hekate', 'Eros', 'Sedna', 'Eris', 'Chariklo'],
  all: AVAILABLE_ASTEROIDS.map(a => a.name)
};

type Props = {
  initialDate?:     string;
  initialTime?:     string;
  initialLat?:      string;
  initialLng?:      string;
  initialTimezone?: string;
  triggerCalc?:     number;
  onChartReady?:    ( data: any ) => void;
  profileIdentity?: any;
  isMyself?:        boolean;
};

export default function AsteroidsView( {
  initialDate     = '',
  initialTime     = '',
  initialLat      = '',
  initialLng      = '',
  initialTimezone = '',
  triggerCalc     = 0,
  onChartReady,
  profileIdentity,
  isMyself,
  gateChartType = 'asteroids',
  gatePresetKey = null,
}: Props ) {
  const [ busy,      setBusy      ] = useState( false );
  const [ error,     setError     ] = useState<string | null>( null );
  const [ asteroids, setAsteroids ] = useState<any[]>( [] );
  const [ coreData,  setCoreData  ] = useState<any>( null );
  const [ viewMode,  setViewMode  ] = useState<'natal' | 'transit'>( 'natal' );

  // Asteroid Selection & Display States
  const [ selectedAsteroids, setSelectedAsteroids ] = useState<string[]>(PRESETS.goddess);
  const [ displayStyle,      setDisplayStyle      ] = useState<'table' | 'wheel'>('wheel');
  const [ includeNatal,      setIncludeNatal      ] = useState<boolean>(true);
  const [ houseSystem,       setHouseSystem       ] = useState<'whole_house' | 'placidus' | 'koch'>('whole_house');
  const [ hasCalculated,     setHasCalculated     ] = useState(false);
  const [ searchQuery,       setSearchQuery       ] = useState('');

  // Pull the user context hook ONCE during render (hooks cannot be called inside the
  // async calculate() callback — that triggers React error #321 / invalid hook call).
  const userCtx: any = ( window as any ).LunaCcoHooks?.useUser?.() || {};
  const saveChartCache = userCtx.saveChartCache;

  const form = {
    date:      initialDate,
    time:      initialTime  || '12:00',
    latitude:  initialLat,
    longitude: initialLng,
    timezone:  initialTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };

  async function calculate() {
    if ( viewMode === 'natal' && ( ! form.date || ! form.latitude || ! form.longitude ) ) {
      setError( 'Birth date and location are required.' );
      return;
    }
    setError( null );
    setBusy( true );
    try {
      const svc = EphemerisService.getInstance();
      
      if ( viewMode === 'natal' ) {
        // 1. Get or calculate core data
        let core: any = null;
        const cache = profileIdentity?.chart_cache || {};
        const natalCacheKey = `natal_${houseSystem}`;
        if ( cache[natalCacheKey] ) {
          const cachedNatal = cache[natalCacheKey];
          const cachedDate = cachedNatal.input?.date?.substring( 0, 16 );
          const formDate = form.date?.substring( 0, 16 );
          if ( cachedDate === formDate ) {
            core = deserializeChart( cachedNatal.data );
          }
        }
        if ( ! core ) {
          const personId = profileIdentity?.id !== undefined ? profileIdentity.id : null;
          const tokenRes = await fetchJSON('luna-astrohd/v1/calc-token', {
            method: 'POST',
            body: JSON.stringify({ chart_type: gateChartType || 'asteroids', preset_key: gatePresetKey || undefined, person_id: personId })
          }).catch(() => null);
          core = await svc.getChartData( { ...form, houseSystem } );
          if ( typeof saveChartCache === 'function' ) {
            await saveChartCache( personId, natalCacheKey, {
              input: { ...form, houseSystem },
              data: serializeChart( core ),
              token: tokenRes?.token,
            } );
          }
        }
        setCoreData( core );

        // 2. Get or calculate asteroid data
        let asteroidData: any[] = [];
        let needsAsteroidCalc = true;
        const asteroidCacheKey = `asteroids_${houseSystem}`;
        if ( cache[asteroidCacheKey] ) {
          const cachedAsteroids = cache[asteroidCacheKey];
          const cachedDate = cachedAsteroids.input?.date?.substring( 0, 16 );
          const formDate = form.date?.substring( 0, 16 );
          if ( cachedDate === formDate && Array.isArray( cachedAsteroids.data?.asteroids ) ) {
            const cachedNames = new Set( cachedAsteroids.data.asteroids.map( (a: any) => a.name ) );
            const allSelectedAreCached = selectedAsteroids.every( name => cachedNames.has( name ) );
            if ( allSelectedAreCached ) {
              asteroidData = cachedAsteroids.data.asteroids.filter( (a: any) => selectedAsteroids.includes( a.name ) );
              needsAsteroidCalc = false;
            }
          }
        }

        if ( needsAsteroidCalc ) {
          const personId = profileIdentity?.id !== undefined ? profileIdentity.id : null;
          const tokenRes = await fetchJSON('luna-astrohd/v1/calc-token', {
            method: 'POST',
            body: JSON.stringify({ chart_type: gateChartType || 'asteroids', preset_key: gatePresetKey || undefined, person_id: personId })
          }).catch(() => null);
          asteroidData = await svc.getAsteroidsData( { ...form, houseSystem }, selectedAsteroids );

          // Merge with previously cached asteroids to avoid losing them if we selected a subset
          let mergedAsteroids = [ ...asteroidData ];
          if ( cache[asteroidCacheKey] && Array.isArray( cache[asteroidCacheKey].data?.asteroids ) ) {
            const existing = cache[asteroidCacheKey].data.asteroids;
            const newNames = new Set( asteroidData.map( a => a.name ) );
            const unmodified = existing.filter( (a: any) => ! newNames.has( a.name ) );
            mergedAsteroids = [ ...mergedAsteroids, ...unmodified ];
          }

          if ( typeof saveChartCache === 'function' ) {
            await saveChartCache( personId, asteroidCacheKey, {
              input: { ...form, houseSystem },
              data: serializeChart( { asteroids: mergedAsteroids } ),
              token: tokenRes?.token,
            } );
          }
        }

        setAsteroids( asteroidData );
        onChartReady?.( { asteroids: asteroidData, core, isTransit: false } );
        setHasCalculated( true );
      } else {
        // Transit Mode
        let transitAsteroids: any[] = [];
        let transitCore: any = null;
        let needsTransitCalc = true;

        const nowMs = Date.now();
        const cachedTransitStr = localStorage.getItem('lunacco_transit_asteroids_cache_v2');
        if ( cachedTransitStr ) {
          try {
            const parsed = JSON.parse( cachedTransitStr );
            const age = nowMs - parsed.timestamp;
            if ( age < 60 * 60 * 1000 ) { // 1 hour TTL
              const cachedNames = new Set( (parsed.data?.asteroids || []).map( (a: any) => a.name ) );
              const allSelectedAreCached = selectedAsteroids.every( name => cachedNames.has( name ) );
              if ( allSelectedAreCached ) {
                transitAsteroids = (parsed.data?.asteroids || []).filter( (a: any) => selectedAsteroids.includes( a.name ) );
                transitCore = deserializeChart( parsed.data?.core );
                needsTransitCalc = false;
              }
            }
          } catch ( e ) {
            console.warn( 'Transit asteroids cache parse failed', e );
          }
        }

        if ( needsTransitCalc ) {
          [ transitAsteroids, transitCore ] = await Promise.all([
            svc.getTransitAsteroidsData( selectedAsteroids ),
            svc.getTransitChartData()
          ]);

          let mergedAsteroids = [ ...transitAsteroids ];
          if ( cachedTransitStr ) {
            try {
              const parsed = JSON.parse( cachedTransitStr );
              if ( Array.isArray( parsed.data?.asteroids ) ) {
                const existing = parsed.data.asteroids;
                const newNames = new Set( transitAsteroids.map( a => a.name ) );
                const unmodified = existing.filter( (a: any) => ! newNames.has( a.name ) );
                mergedAsteroids = [ ...mergedAsteroids, ...unmodified ];
              }
            } catch {}
          }

          localStorage.setItem('lunacco_transit_asteroids_cache_v2', JSON.stringify({
            timestamp: nowMs,
            data: {
              asteroids: mergedAsteroids,
              core: serializeChart( transitCore )
            }
          }));
        }

        setAsteroids( transitAsteroids );
        setCoreData( transitCore );
        onChartReady?.( { asteroids: transitAsteroids, core: transitCore, isTransit: true } );
        setHasCalculated( true );
      }
    } catch ( e: any ) {
      console.error('Asteroid calc error:', e);
      setError( e?.message || 'Asteroid calculation failed.' );
    } finally {
      setBusy( false );
    }
  }

  // Handle Preset Clicks
  const applyPreset = (presetKey: 'base5' | 'goddess' | 'all' | 'none') => {
    if (presetKey === 'none') {
      setSelectedAsteroids([]);
    } else {
      setSelectedAsteroids(PRESETS[presetKey]);
    }
  };

  const handleToggleAsteroid = (name: string) => {
    setSelectedAsteroids(prev => 
      prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
    );
  };

  // Filtered Available list based on Search
  const filteredAsteroids = useMemo(() => {
    if (!searchQuery) return AVAILABLE_ASTEROIDS;
    const lower = searchQuery.toLowerCase();
    return AVAILABLE_ASTEROIDS.filter(a => 
      a.name.toLowerCase().includes(lower) || a.description.toLowerCase().includes(lower)
    );
  }, [searchQuery]);

  // Core planetary activations for matching
  const coreActivations = useMemo( () => {
    const map = new Map<number, any[]>();
    if ( ! coreData ) return map;

    const process = ( acts: any, side: 'Personality' | 'Design' ) => {
      if ( ! acts ) return;
      Object.entries( acts ).forEach( ( [ name, a ]: [string, any] ) => {
        if ( a.gate ) {
          const list = map.get( a.gate ) || [];
          list.push( { name, side, line: a.line } );
          map.set( a.gate, list );
        }
      } );
    };

    process( coreData.birthActivations, 'Personality' );
    process( coreData.designActivations, 'Design' );
    return map;
  }, [ coreData ] );

  const getMatches = ( gate: number, line: number ) => {
    const matches = coreActivations.get( gate );
    if ( ! matches ) return [];
    return matches.map( m => ({
      ...m,
      isExact: m.line === line
    }));
  };

  // Personality Asteroids Wheel Activations
  const personalityWheelActs = useMemo(() => {
    const acts: Record<string, any> = {};
    if (includeNatal && coreData?.birthActivations) {
      Object.entries(coreData.birthActivations).forEach(([name, data]: [string, any]) => {
        acts[name] = data;
      });
    }
    asteroids.forEach(ast => {
      if (ast.personality) {
        acts[ast.name] = {
          longitude: ast.personality.longitude,
          sign: ast.personality.sign,
          house: ast.personality.house,
          isRetrograde: ast.personality.isRetrograde,
        };
      }
    });
    return acts;
  }, [asteroids, coreData, includeNatal]);

  // Design Asteroids Wheel Activations
  const designWheelActs = useMemo(() => {
    const acts: Record<string, any> = {};
    if (includeNatal && coreData?.designActivations) {
      Object.entries(coreData.designActivations).forEach(([name, data]: [string, any]) => {
        acts[name] = data;
      });
    }
    asteroids.forEach(ast => {
      if (ast.design) {
        acts[ast.name] = {
          longitude: ast.design.longitude,
          sign: ast.design.sign,
          house: ast.design.house,
          isRetrograde: ast.design.isRetrograde,
        };
      }
    });
    return acts;
  }, [asteroids, coreData, includeNatal]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--paper)' }}>
      <AnimatePresence>
        { busy && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ padding: '12px 24px', background: 'var(--indigo)', color: 'white', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10 }}>
            Scanning { selectedAsteroids.length } Selected Celestial Signatures…
          </motion.div>
        ) }
      </AnimatePresence>
      
      { error && (
        <div style={{ padding: '10px 24px', background: '#fef2f2', color: '#b91c1c', fontSize: 12, flexShrink: 0, borderBottom: '1px solid #fee2e2' }}>
          { error }
        </div>
      ) }

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        
        {/* STARTING SETUP WINDOW */}
        {!hasCalculated ? (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ maxWidth: '900px', margin: '0 auto', background: 'var(--card)', border: '1px solid var(--hair)', borderRadius: 16, padding: 32, boxShadow: '0 10px 40px rgba(0,0,0,0.04)' }}
          >
            <header style={{ marginBottom: 28, borderBottom: '1px solid var(--hair)', paddingBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontStyle: 'italic', color: 'var(--ink)', marginBottom: 8, fontWeight: 300 }}>
                Asteroid Collective <span style={{ color: 'var(--indigo)' }}>Setup</span>
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--mute)', lineHeight: '1.6' }}>
                Select the cosmic archetypes you want to pull into your calculation, then choose your visualization overlays and house parameters below.
              </p>
            </header>

            {/* Presets Row */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink)', marginBottom: 10 }}>
                1. Choose Selection Presets
              </label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button 
                  onClick={() => applyPreset('base5')}
                  style={PRESET_BTN}
                >Base 5 Asteroids</button>
                <button 
                  onClick={() => applyPreset('goddess')}
                  style={PRESET_BTN}
                >Common Goddess Preset</button>
                <button 
                  onClick={() => applyPreset('all')}
                  style={PRESET_BTN}
                >Select All 100+</button>
                <button 
                  onClick={() => applyPreset('none')}
                  style={{ ...PRESET_BTN, color: '#ef4444' }}
                >Clear All</button>
              </div>
            </div>

            {/* Selection Grid Filter */}
            <div style={{ marginBottom: 16 }}>
              <input 
                type="text" 
                placeholder="Search asteroids by name or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--hair)',
                  background: 'rgba(0,0,0,0.02)',
                  color: 'var(--ink)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            {/* Asteroids Checkboxes Grid */}
            <div style={{ 
              maxHeight: '320px', 
              overflowY: 'auto', 
              border: '1px solid var(--hair)', 
              borderRadius: 8, 
              padding: 16, 
              background: 'rgba(0,0,0,0.01)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
              marginBottom: 28
            }}>
              {filteredAsteroids.map((ast) => {
                const isSelected = selectedAsteroids.includes(ast.name);
                return (
                  <label 
                    key={ast.name}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: 10,
                      borderRadius: 6,
                      background: isSelected ? 'rgba(79, 70, 229, 0.05)' : 'white',
                      border: `1.5px solid ${isSelected ? 'var(--indigo)' : 'var(--hair)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleAsteroid(ast.name)}
                      style={{ marginTop: 3, accentColor: 'var(--indigo)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: isSelected ? 'var(--indigo)' : 'var(--ink)' }}>{ast.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2, lineHeight: '1.3' }}>{ast.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Options Panel Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, marginBottom: 32, background: 'rgba(0,0,0,0.02)', padding: 20, borderRadius: 8 }}>
              {/* View options */}
              <div>
                <label style={OPTION_LABEL}>2. Display Format</label>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
                  <button 
                    onClick={() => setDisplayStyle('table')}
                    style={{ ...TOGGLE_BTN, background: displayStyle === 'table' ? 'white' : 'transparent', color: displayStyle === 'table' ? 'var(--ink)' : 'var(--mute)' }}
                  >Table Only</button>
                  <button 
                    onClick={() => setDisplayStyle('wheel')}
                    style={{ ...TOGGLE_BTN, background: displayStyle === 'wheel' ? 'white' : 'transparent', color: displayStyle === 'wheel' ? 'var(--ink)' : 'var(--mute)' }}
                  >Astrowheel + Table</button>
                </div>
              </div>

              {/* Natal Switch */}
              {displayStyle === 'wheel' && (
                <div>
                  <label style={OPTION_LABEL}>3. Core Overlays</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', height: 32 }}>
                    <input 
                      type="checkbox"
                      checked={includeNatal}
                      onChange={(e) => setIncludeNatal(e.target.checked)}
                      style={{ accentColor: 'var(--indigo)' }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>Include Core Natal Placements</span>
                  </label>
                </div>
              )}

              {/* House System */}
              <div>
                <label style={OPTION_LABEL}>{displayStyle === 'wheel' ? '4. House System' : '3. House System'}</label>
                <HouseSystemToggle value={houseSystem} onChange={setHouseSystem} />
              </div>
            </div>

            <button 
              onClick={calculate}
              disabled={selectedAsteroids.length === 0}
              style={{
                width: '100%',
                padding: '16px 20px',
                borderRadius: 8,
                background: selectedAsteroids.length === 0 ? 'var(--mute)' : 'var(--indigo)',
                color: 'white',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                border: 'none',
                cursor: selectedAsteroids.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 15px rgba(79, 70, 229, 0.25)',
                transition: 'all 0.2s',
              }}
            >
              Map Celestial Alignment
            </button>
          </motion.div>
        ) : (
          
          /* RESULTS MODE */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--hair)', paddingBottom: 16 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontStyle: 'italic', color: 'var(--ink)' }}>
                  Asteroid Alignment
                </h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 11, background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: 4, color: 'var(--mute)', fontWeight: 600 }}>
                    {selectedAsteroids.length} Bodies
                  </span>
                  <span style={{ fontSize: 11, background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: 4, color: 'var(--mute)', fontWeight: 600 }}>
                    {houseSystem === 'placidus' ? 'Placidus' : houseSystem === 'koch' ? 'Koch' : 'Whole Sign'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setHasCalculated(false)}
                style={{
                  background: 'none',
                  border: '1.5px solid var(--hair)',
                  borderRadius: 20,
                  padding: '8px 18px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  cursor: 'pointer',
                  transition: '0.2s',
                }}
              >
                Modify Selection
              </button>
            </header>

            {/* DUAL ASTROWHEELS */}
            {displayStyle === 'wheel' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center', width: '100%' }}>
                
                {/* Design Asteroids Wheel Card (Only in Natal mode, left-aligned) */}
                {viewMode === 'natal' && (
                  <div style={{ flex: '1 1 420px', maxWidth: '480px', background: 'var(--card)', border: '1px solid var(--hair)', borderRadius: 12, padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--hd-design, #a12f2f)', marginBottom: 4 }}>
                        Unconscious Stream
                      </div>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: 'var(--ink)', margin: 0 }}>
                        Design Asteroid Wheel
                      </h3>
                    </div>
                    <div style={{ background: 'radial-gradient(circle at 50% 40%, rgba(161,47,47,0.06) 0%, rgba(0,0,0,0) 50%)', borderRadius: 20, padding: 12, display: 'flex', justifyContent: 'center' }}>
                      <AstroWheel 
                        activations={designWheelActs}
                        cusps={coreData?.designHouseCusps}
                        size={400}
                        centerTitle="DESIGN"
                        centerSubtitle="Asteroids"
                      />
                    </div>
                  </div>
                )}

                {/* Personality / Transit Asteroids Wheel Card (right-aligned) */}
                <div style={{ flex: '1 1 420px', maxWidth: '480px', background: 'var(--card)', border: '1px solid var(--hair)', borderRadius: 12, padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>
                      {viewMode === 'natal' ? 'Conscious Stream' : 'Transit Stream'}
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: 'var(--ink)', margin: 0 }}>
                      {viewMode === 'natal' ? 'Personality Asteroid Wheel' : 'Transit Asteroid Wheel'}
                    </h3>
                  </div>
                  <div style={{ background: 'radial-gradient(circle at 50% 40%, rgba(212,175,55,0.06) 0%, rgba(0,0,0,0) 50%)', borderRadius: 20, padding: 12, display: 'flex', justifyContent: 'center' }}>
                    <AstroWheel 
                      activations={personalityWheelActs}
                      cusps={coreData?.houseCusps}
                      size={400}
                      centerTitle={viewMode === 'natal' ? 'PERSONALITY' : 'TRANSIT'}
                      centerSubtitle="Asteroids"
                    />
                  </div>
                </div>

              </div>
            )}

            {/* TABLE FULL-WIDTH BLOCK */}
            <div style={{ width: '100%' }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--ink)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={TH_STYLE}>Asteroid Archetype</th>
                      <th style={TH_STYLE}>Personality (Natal)</th>
                      { viewMode === 'natal' && <th style={TH_STYLE}>Design (Pre-natal)</th> }
                    </tr>
                  </thead>
                  <tbody>
                    { asteroids.map( ( ast, i ) => (
                      <tr 
                        key={ i } 
                        style={{ borderBottom: i < asteroids.length - 1 ? '1px solid var(--hair)' : 'none', transition: 'background 0.2s' }}
                      >
                        <td style={TD_STYLE}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '30px', height: '30px', border: '1px solid var(--hair)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--indigo)' }}>
                              { ast.symbol }
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '13px' }}>{ ast.name }</div>
                            </div>
                          </div>
                        </td>

                        {/* PERSONALITY COLUMN */}
                        <td style={TD_STYLE}>
                          { ast.personality ? (
                            <ActivationCell act={ast.personality} matches={getMatches(ast.personality.gate, ast.personality.line)} side="Personality" />
                          ) : <span style={{ opacity: 0.2 }}>—</span> }
                        </td>

                        {/* DESIGN COLUMN */}
                        { viewMode === 'natal' && (
                          <td style={TD_STYLE}>
                            { ast.design ? (
                              <ActivationCell act={ast.design} matches={getMatches(ast.design.gate, ast.design.line)} side="Design" />
                            ) : <span style={{ opacity: 0.2 }}>—</span> }
                          </td>
                        ) }
                      </tr>
                    ) ) }
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '32px', padding: '24px', background: 'var(--paper)', border: '1px solid var(--hair)', borderRadius: '12px', opacity: 0.7 }}>
                <h4 style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--gold)', marginBottom: '16px' }}>
                  Terminology
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--mute)', lineHeight: '1.6' }}>
                     <strong style={{ color: 'var(--indigo)' }}>Core Resonance:</strong> Highlighted gates indicate the asteroid shares a gate with one of your core natal/design planets.
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--mute)', lineHeight: '1.6' }}>
                     <strong style={{ color: 'var(--gold)' }}>Exact Match:</strong> Denoted by (Exact!) when the asteroid shares both the Gate AND the Line with a core planet.
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
        <ChartAttributionFooter />
      </div>
    </div>
  );
}

function ActivationCell({ act, matches, side }: { act: any, matches: any[], side: string }) {
  const hasMatch = matches.length > 0;
  const isExact = matches.some(m => m.isExact);
  const color = side === 'Personality' ? 'var(--indigo)' : '#b91c1c';
  
  const center = GateToCenter[act.gate] || 'Unknown';
  
  // Custom Zodiac sign degree and minutes formatting
  const formatDeg = (longitude: number) => {
    const signs = ['Ari', 'Tau', 'Gem', 'Can', 'Leo', 'Vir', 'Lib', 'Sco', 'Sag', 'Cap', 'Aqu', 'Pis'];
    const signIdx = Math.floor(longitude / 30);
    const inSign = longitude % 30;
    const deg = Math.floor(inSign);
    const min = Math.floor((inSign - deg) * 60);
    return `${deg}° ${signs[signIdx]} ${String(min).padStart(2, '0')}'`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ 
          fontFamily: 'var(--mono, monospace)', 
          fontWeight: 700, 
          fontSize: '14px', 
          color: color,
          background: hasMatch ? (side === 'Personality' ? 'rgba(79, 70, 229, 0.1)' : 'rgba(185, 28, 28, 0.1)') : 'transparent',
          padding: '2px 6px',
          borderRadius: '4px',
          border: isExact ? `1.5px solid ${color}` : (hasMatch ? `1px solid ${color}33` : 'none')
        }}>
          { act.gate }.{ act.line }
        </span>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '10px', color: 'var(--mute)', fontWeight: 500 }}>
            { formatDeg(act.longitude) } { act.house && `· H${ act.house }` }
          </span>
          <span style={{ fontSize: '9px', color: 'var(--gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '1px' }}>
            { center }
          </span>
        </div>
        { isExact && <span style={{ fontSize: '9px', fontWeight: 900, color: color, textTransform: 'uppercase' }}>Exact</span> }
      </div>
      { act.isRetrograde && <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.05em' }}>ℛ</span> }
    </div>
  );
}

// Styling Constants
const PRESET_BTN = {
  background: 'rgba(0,0,0,0.04)',
  border: 'none',
  borderRadius: 4,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--ink)',
  cursor: 'pointer',
  transition: 'background 0.2s',
};

const OPTION_LABEL = {
  display: 'block',
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
  color: 'var(--ink)',
  marginBottom: 8,
};

const TOGGLE_BTN = {
  border: 'none',
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  transition: '0.2s',
  boxShadow: 'none',
};

const TH_STYLE = {
  textAlign: 'left' as const,
  padding: '10px 20px',
  fontSize: '9px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.14em',
  color: 'var(--paper)',
  background: 'var(--ink)',
};

const TD_STYLE = {
  padding: '12px 20px',
  color: 'var(--ink)',
};

function deserializeChart( data: any ): any {
  if ( ! data ) return null;
  return {
    ...data,
    activeGates:    new Set( data.activeGates || [] ),
    definedCenters: new Set( data.definedCenters || [] ),
    designActiveGates: new Set( data.designActiveGates || [] ),
    designDefinedCenters: new Set( data.designDefinedCenters || [] ),
  };
}
