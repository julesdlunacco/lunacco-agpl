import { DateTime } from 'luxon';

export interface AstroPlanetLike {
  name: string;
  longitude: number;
  sign?: string;
  house?: number;
}

export interface ComputedAspect {
  p1: AstroPlanetLike;
  p2: AstroPlanetLike;
  aspect: { name: string; angle: number; orb: number; symbol: string; color: string };
  orb: number;
}

export interface BirthEclipseInsight {
  isEclipse: boolean;
  type?: 'solar' | 'lunar';
  orbToSyzygy: number;
  nodeDistance: number;
  summary: string;
}

export interface AstroInsights {
  stelliums: Array<{ sign: string; planets: AstroPlanetLike[] }>;
  tightAspects: ComputedAspect[];
  allAspects: ComputedAspect[];
  patternAlerts: string[];
  chartShape: string;
  eclipse: BirthEclipseInsight;
}

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const CORE_PLANETS = new Set([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  'Chiron', 'Vulcan',
]);

const ASPECT_TYPES = [
  { name: 'Conjunction', angle: 0, orb: 8, symbol: '☌', color: '#facc15' },
  { name: 'Opposition', angle: 180, orb: 8, symbol: '☍', color: '#f97316' },
  { name: 'Square', angle: 90, orb: 8, symbol: '□', color: '#ef4444' },
  { name: 'Trine', angle: 120, orb: 8, symbol: '△', color: '#22c55e' },
  { name: 'Sextile', angle: 60, orb: 6, symbol: '⚹', color: '#38bdf8' },
  { name: 'Quincunx', angle: 150, orb: 3, symbol: '⚻', color: '#a78bfa' },
];

function normLon(lon: number): number {
  return ((lon % 360) + 360) % 360;
}

function angDiff(a: number, b: number): number {
  const d = Math.abs(normLon(a) - normLon(b));
  return d > 180 ? 360 - d : d;
}

function signOf(lon: number): string {
  return SIGNS[Math.floor(normLon(lon) / 30)];
}

function combinations<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, acc: T[]) => {
    if (acc.length === size) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      acc.push(arr[i]);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

function aspectNameBetween(a: AstroPlanetLike, b: AstroPlanetLike, aspects: ComputedAspect[]): string | null {
  const found = aspects.find(x =>
    (x.p1.name === a.name && x.p2.name === b.name) ||
    (x.p1.name === b.name && x.p2.name === a.name)
  );
  return found?.aspect.name ?? null;
}

export function calculateAspects(planets: AstroPlanetLike[]): ComputedAspect[] {
  const pts = planets.filter(p => !['Black Moon Lilith', 'Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex', 'Earth'].includes(p.name));
  const out: ComputedAspect[] = [];

  const isNodePair = (a: AstroPlanetLike, b: AstroPlanetLike): boolean => {
    const n1 = a.name.replace(/\s+/g, '').toLowerCase();
    const n2 = b.name.replace(/\s+/g, '').toLowerCase();
    return (n1 === 'northnode' && n2 === 'southnode') || (n1 === 'southnode' && n2 === 'northnode');
  };

  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (isNodePair(pts[i], pts[j])) {
        continue;
      }
      const diff = angDiff(pts[i].longitude, pts[j].longitude);
      for (const a of ASPECT_TYPES) {
        const orb = Math.abs(diff - a.angle);
        if (orb <= a.orb) {
          out.push({ p1: pts[i], p2: pts[j], aspect: a, orb });
        }
      }
    }
  }
  return out.sort((a, b) => a.orb - b.orb);
}

export function detectStelliums(planets: AstroPlanetLike[], minCount = 3): Array<{ sign: string; planets: AstroPlanetLike[] }> {
  const bySign: Record<string, AstroPlanetLike[]> = {};
  planets
    .filter(p => CORE_PLANETS.has(p.name))
    .forEach(p => {
      const s = p.sign || signOf(p.longitude);
      if (!bySign[s]) bySign[s] = [];
      bySign[s].push(p);
    });
  return Object.entries(bySign)
    .filter(([, ps]) => ps.length >= minCount)
    .map(([sign, ps]) => ({ sign, planets: ps }));
}

export function detectBirthEclipse(planets: AstroPlanetLike[]): BirthEclipseInsight {
  const sun = planets.find(p => p.name === 'Sun');
  const moon = planets.find(p => p.name === 'Moon');
  const northNode = planets.find(p => p.name === 'North Node' || p.name === 'NorthNode');
  if (!sun || !moon || !northNode) {
    return { isEclipse: false, orbToSyzygy: 99, nodeDistance: 99, summary: 'Insufficient data for eclipse check.' };
  }

  const phase = angDiff(sun.longitude, moon.longitude);
  const syzygyOrb = Math.min(Math.abs(phase - 0), Math.abs(phase - 180));
  const solarLike = Math.abs(phase - 0) <= 14;
  const lunarLike = Math.abs(phase - 180) <= 14;

  const nodeAxisOpp = normLon(northNode.longitude + 180);
  const distToNodeAxis = Math.min(angDiff(sun.longitude, northNode.longitude), angDiff(sun.longitude, nodeAxisOpp));

  const isEclipse = (solarLike || lunarLike) && distToNodeAxis <= 18;
  const type = solarLike ? 'solar' : (lunarLike ? 'lunar' : undefined);

  if (!isEclipse || !type) {
    return {
      isEclipse: false,
      orbToSyzygy: Number(syzygyOrb.toFixed(2)),
      nodeDistance: Number(distToNodeAxis.toFixed(2)),
      summary: `No eclipse signature (phase orb ${syzygyOrb.toFixed(1)}°, node distance ${distToNodeAxis.toFixed(1)}°).`,
    };
  }

  return {
    isEclipse: true,
    type,
    orbToSyzygy: Number(syzygyOrb.toFixed(2)),
    nodeDistance: Number(distToNodeAxis.toFixed(2)),
    summary: `${type === 'solar' ? 'Solar' : 'Lunar'} eclipse signature (phase orb ${syzygyOrb.toFixed(1)}°, node distance ${distToNodeAxis.toFixed(1)}°).`,
  };
}

export function detectChartShape(planets: AstroPlanetLike[]): string {
  const core = planets.filter(p => CORE_PLANETS.has(p.name));
  if (core.length < 7) return 'Unclassified';

  const lons = core.map(p => normLon(p.longitude)).sort((a, b) => a - b);
  const gaps: number[] = [];
  let maxGap = 0;

  for (let i = 0; i < lons.length; i++) {
    const next = i === lons.length - 1 ? lons[0] + 360 : lons[i + 1];
    const g = next - lons[i];
    gaps.push(g);
    maxGap = Math.max(maxGap, g);
  }

  const occupiedArc = 360 - maxGap;

  const buildGroups = (breakGap: number): number[][] => {
    const groups: number[][] = [];
    let current: number[] = [lons[0]];
    for (let i = 0; i < lons.length; i++) {
      const nextIndex = (i + 1) % lons.length;
      const nextLon = i === lons.length - 1 ? lons[0] + 360 : lons[nextIndex];
      const gap = nextLon - lons[i];
      if (gap >= breakGap) {
        groups.push(current);
        current = [];
      }
      if (nextIndex !== 0) {
        current.push(lons[nextIndex]);
      }
    }
    if (current.length) {
      groups.push(current);
    }
    return groups;
  };

  const isBucket = (): boolean => {
    const othersArc = (arr: number[]): number => {
      let localMaxGap = 0;
      for (let i = 0; i < arr.length; i++) {
        const next = i === arr.length - 1 ? arr[0] + 360 : arr[i + 1];
        localMaxGap = Math.max(localMaxGap, next - arr[i]);
      }
      return 360 - localMaxGap;
    };

    // one-planet handle
    for (let i = 0; i < lons.length; i++) {
      const prevGap = i === 0 ? gaps[gaps.length - 1] : gaps[i - 1];
      const nextGap = gaps[i];
      if (prevGap < 28 || nextGap < 28) {
        continue;
      }
      const rem = lons.filter((_, idx) => idx !== i);
      const arc = othersArc(rem);
      if (arc > 120 && arc <= 180) {
        return true;
      }
    }

    // two-planet handle
    for (let i = 0; i < lons.length; i++) {
      const j = (i + 1) % lons.length;
      const leftGap = i === 0 ? gaps[gaps.length - 1] : gaps[i - 1];
      const internalGap = gaps[i];
      const rightGap = gaps[j];

      if (internalGap >= 24 || leftGap < 28 || rightGap < 28) {
        continue;
      }

      const rem = lons.filter((_, idx) => idx !== i && idx !== j);
      const arc = othersArc(rem);
      if (arc > 120 && arc <= 180) {
        return true;
      }
    }

    return false;
  };

  const meanGap = 360 / gaps.length;
  const variance = gaps.reduce((acc, g) => acc + (g - meanGap) ** 2, 0) / gaps.length;
  const std = Math.sqrt(variance);
  const minGap = Math.min(...gaps);

  const groupsWide = buildGroups(30);
  const groupsTight = buildGroups(24);

  if (occupiedArc <= 120) return 'Bundle';
  if (isBucket()) return 'Bucket';
  if (occupiedArc > 120 && occupiedArc <= 180) return 'Bowl';
  if (occupiedArc > 180 && occupiedArc <= 240) return 'Locomotive';

  if (groupsWide.length === 2 && groupsWide[0].length >= 2 && groupsWide[1].length >= 2) {
    return 'Seesaw';
  }

  if (occupiedArc > 240 && std <= 10 && minGap >= 12) {
    return 'Splash';
  }

  if (groupsTight.length >= 3 || std > 10) {
    return 'Splay';
  }

  return 'Mixed';
}

export function detectPatterns(planets: AstroPlanetLike[], aspects: ComputedAspect[]): string[] {
  const alerts: string[] = [];

  const sun = planets.find(p => p.name === 'Sun');
  const mercury = planets.find(p => p.name === 'Mercury');
  if (sun && mercury) {
    const d = angDiff(sun.longitude, mercury.longitude);
    if (d <= 0.3) alerts.push(`Cazimi: Mercury in the heart of the Sun (${d.toFixed(2)}°).`);
  }

  const core = planets.filter(p => CORE_PLANETS.has(p.name));

  const triples = combinations(core, 3);
  const grandTrines = triples.filter(([a, b, c]) =>
    aspectNameBetween(a, b, aspects) === 'Trine' &&
    aspectNameBetween(a, c, aspects) === 'Trine' &&
    aspectNameBetween(b, c, aspects) === 'Trine'
  );
  if (grandTrines.length) alerts.push(`Grand Trine pattern detected (${grandTrines[0].map(p => p.name).join(' / ')}).`);

  const yods = triples.filter(([a, b, c]) => {
    const pairs = [
      [a, b, aspectNameBetween(a, b, aspects)],
      [a, c, aspectNameBetween(a, c, aspects)],
      [b, c, aspectNameBetween(b, c, aspects)],
    ] as Array<[AstroPlanetLike, AstroPlanetLike, string | null]>;
    const quinc = pairs.filter(([, , n]) => n === 'Quincunx').length;
    const sext = pairs.filter(([, , n]) => n === 'Sextile').length;
    return quinc === 2 && sext === 1;
  });
  if (yods.length) alerts.push(`Yod pattern detected (${yods[0].map(p => p.name).join(' / ')}).`);

  const quads = combinations(core, 4);
  const grandCross = quads.find(group => {
    const names: string[] = [];
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const n = aspectNameBetween(group[i], group[j], aspects);
        if (n) names.push(n);
      }
    }
    const opp = names.filter(n => n === 'Opposition').length;
    const sq = names.filter(n => n === 'Square').length;
    return opp >= 2 && sq >= 4;
  });
  if (grandCross) alerts.push(`Grand Cross signature detected (${grandCross.map(p => p.name).join(' / ')}).`);

  return alerts;
}

export function analyzeAstroInsights(planets: AstroPlanetLike[]): AstroInsights {
  const aspects = calculateAspects(planets);
  return {
    stelliums: detectStelliums(planets),
    tightAspects: aspects.filter(a => a.orb <= 2),
    allAspects: aspects,
    patternAlerts: detectPatterns(planets, aspects),
    chartShape: detectChartShape(planets),
    eclipse: detectBirthEclipse(planets),
  };
}
