/**
 * Service for astrology widgets - retrogrades, moon phases, eclipses, etc.
 */

import { DateTime } from 'luxon';
import { HumanDesignLogic } from './HumanDesignLogic';

import SwissEph from 'swisseph-wasm';

export interface CalendarEvent {
    date: DateTime;
    endDate?: DateTime;
    type:
        | 'moon-phase'
        | 'moon-ingress'
        | 'moon-voc'
        | 'planet-ingress'
        | 'planet-gate-ingress'
        | 'retrograde-start'
        | 'retrograde-end'
        | 'retrograde-sign-change'
        | 'tight-aspect'
        | 'critical-degree'
        | 'sign-concentration'
        | 'element-concentration'
        | 'modality-concentration'
        | 'aspect-enter'
        | 'aspect-exact'
        | 'aspect-exit';
    planet: string;
    planetSymbol: string;
    description: string;
    fromSign?: string;
    fromSignSymbol?: string;
    toSign?: string;
    toSignSymbol?: string;
    fromGate?: number;
    toGate?: number;
    phase?: string; // For moon phases
    phaseEmoji?: string;
    house?: number; // Based on user's ascendant
    designHouse?: number; // Based on design ascendant
    isRetrograde?: boolean; // For retrograde events
    severity?: 'info' | 'important' | 'major';
    tags?: string[];
}

export interface MoonPhaseData {
    phase: string;
    phaseName: string;
    phaseEmoji: string;
    illumination: number;
    moonLongitude: number;
    sunLongitude: number;
    moonSign: string;
    moonSignSymbol: string;
    moonDegree: string;
    moonHouse?: number;
    daysUntilNew: number;
    daysUntilFull: number;
    nextNewMoon: DateTime;
    nextFullMoon: DateTime;
    isWaxing: boolean;
    upcoming?: Array<{ label: string; date: DateTime; sign: string; signSymbol: string; longitude: number }>;
}

export interface PlanetStatus {
    name: string;
    symbol: string;
    longitude: number;
    speed: number;
    isRetrograde: boolean;
    sign: string;
    signSymbol: string;
    degree: string;
}

export interface RetrogradeInfo {
    planet: string;
    symbol: string;
    isRetrograde: boolean;
    stationDate?: DateTime;
    stationType?: 'retrograde' | 'direct';
    startDate?: DateTime;
    endDate?: DateTime;
    sign: string;
    signSymbol: string;
}

export interface RetrogradePeriod {
    planet: string;
    symbol: string;
    startDate: DateTime;
    endDate: DateTime;
    startSign: string;
    endSign: string;
    durationDays: number;
}

const ZODIAC_SIGNS = [
    { name: 'Aries', symbol: '♈' },
    { name: 'Taurus', symbol: '♉' },
    { name: 'Gemini', symbol: '♊' },
    { name: 'Cancer', symbol: '♋' },
    { name: 'Leo', symbol: '♌' },
    { name: 'Virgo', symbol: '♍' },
    { name: 'Libra', symbol: '♎' },
    { name: 'Scorpio', symbol: '♏' },
    { name: 'Sagittarius', symbol: '♐' },
    { name: 'Capricorn', symbol: '♑' },
    { name: 'Aquarius', symbol: '♒' },
    { name: 'Pisces', symbol: '♓' }
];

const PLANET_SYMBOLS: Record<string, string> = {
    'Mercury': '☿',
    'Venus': '♀',
    'Mars': '♂',
    'Jupiter': '♃',
    'Saturn': '♄',
    'Uranus': '♅',
    'Neptune': '♆',
    'Pluto': '♇',
    'Chiron': '⚷'
};

// Planet names for retrograde tracking
const RETROGRADE_PLANET_NAMES = [
    'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron'
];

// All planets for calendar tracking (signs + gates)
const CALENDAR_PLANETS = [
    { name: 'Sun', symbol: '☉', trackGates: true },
    { name: 'Moon', symbol: '☽', trackGates: false }, // Moon signs only, no gates
    { name: 'Mercury', symbol: '☿', trackGates: true },
    { name: 'Venus', symbol: '♀', trackGates: true },
    { name: 'Mars', symbol: '♂', trackGates: true },
    { name: 'Jupiter', symbol: '♃', trackGates: true },
    { name: 'Saturn', symbol: '♄', trackGates: true },
    { name: 'Uranus', symbol: '♅', trackGates: true },
    { name: 'Neptune', symbol: '♆', trackGates: true },
    { name: 'Pluto', symbol: '♇', trackGates: true },
    { name: 'Chiron', symbol: '⚷', trackGates: true },
    { name: 'North Node', symbol: '☊', trackGates: true },
    { name: 'South Node', symbol: '☋', trackGates: true },
    { name: 'Lilith', symbol: '⚸', trackGates: true },
];

// Map planet names to Swiss Ephemeris constant names
const PLANET_SE_IDS: Record<string, string> = {
    'Sun': 'SE_SUN',
    'Moon': 'SE_MOON',
    'Mercury': 'SE_MERCURY',
    'Venus': 'SE_VENUS',
    'Mars': 'SE_MARS',
    'Jupiter': 'SE_JUPITER',
    'Saturn': 'SE_SATURN',
    'Uranus': 'SE_URANUS',
    'Neptune': 'SE_NEPTUNE',
    'Pluto': 'SE_PLUTO',
    'Chiron': 'SE_CHIRON',
    'North Node': 'SE_TRUE_NODE',
    'Lilith': 'SE_MEAN_APOG'
};



export interface CalendarEventOptions {
    includeVoc?: boolean;
    includeTightAspects?: boolean;
    tightAspectOrb?: number;
    includeCriticalDegrees?: boolean;
    includeConcentration?: boolean;
    signConcentrationThreshold?: number;
    elementConcentrationThreshold?: number;
    modalityConcentrationThreshold?: number;
}

export interface ICSOptions {
    mode?: 'daily-digest' | 'detailed';
    timezone?: string;
}

export class AstrologyWidgetsService {
    private swe: any = null;

    async initialize() {
        if (this.swe) return;

        try {
            const sweInstance = new SwissEph();
            await sweInstance.initSwissEph();
            this.swe = sweInstance;
        } catch (error) {
            console.error("Failed to initialize Swiss Ephemeris:", error);
            throw error;
        }
    }

    private getZodiacSign(longitude: number): { name: string; symbol: string } {
        let index = Math.floor(longitude / 30);
        if (index < 0 || index > 11) {
            index = ((index % 12) + 12) % 12;
        }
        return ZODIAC_SIGNS[index];
    }

    private formatDegree(longitude: number): string {
        const inSign = longitude % 30;
        const degrees = Math.floor(inSign);
        const minutes = Math.floor((inSign - degrees) * 60);
        return `${degrees}°${minutes.toString().padStart(2, '0')}'`;
    }

    private dateTimeToJd(dt: DateTime): number {
        const utc = dt.toUTC();
        return this.swe.julday(
            utc.year,
            utc.month,
            utc.day,
            utc.hour + utc.minute / 60 + (utc.second || 0) / 3600
        );
    }

    // Convert Julian day back to DateTime (used in findNextStation)
    public jdToDateTime(jd: number): DateTime {
        const result = this.swe.revjul(jd);
        const hour = Math.floor(result.hour);
        const minute = Math.floor((result.hour - hour) * 60);
        return DateTime.utc(result.year, result.month, result.day, hour, minute);
    }

    private calculatePlanetWithSpeed(jd: number, planetId: number): { longitude: number; speed: number } | null {
        const flag = this.swe.SEFLG_SWIEPH | this.swe.SEFLG_SPEED;

        try {
            const result = this.swe.calc_ut(jd, planetId, flag);
            console.log(`[Retrograde] calc_ut raw result for planetId ${planetId}:`, result, typeof result);
            
            // Handle different result formats
            if (result && Array.isArray(result) && result.length >= 4) {
                return {
                    longitude: result[0],
                    speed: result[3] // Speed in longitude (deg/day)
                };
            }
            // Some versions return an object with longitude property
            if (result && typeof result === 'object' && 'longitude' in result) {
                return {
                    longitude: result.longitude,
                    speed: result.longitudeSpeed || result.speed || 0
                };
            }
            // Check if result[0] exists (might be sparse array or object-like)
            if (result && result[0] !== undefined) {
                return {
                    longitude: result[0],
                    speed: result[3] || 0
                };
            }
        } catch (error) {
            console.error('[Retrograde] SWIEPH calc_ut error:', error);
            // Try fallback
            const mosephFlag = this.swe.SEFLG_MOSEPH | this.swe.SEFLG_SPEED;
            try {
                const result = this.swe.calc_ut(jd, planetId, mosephFlag);
                console.log(`[Retrograde] MOSEPH fallback result:`, result);
                if (result && Array.isArray(result) && result.length >= 4) {
                    return {
                        longitude: result[0],
                        speed: result[3]
                    };
                }
            } catch (err2) {
                console.error('[Retrograde] MOSEPH fallback error:', err2);
            }
        }
        return null;
    }

    /**
     * Get current retrograde status for all planets
     */
    async getCurrentRetrogrades(date?: DateTime): Promise<PlanetStatus[]> {
        await this.initialize();

        const targetDate = date || DateTime.now();
        const jd = this.dateTimeToJd(targetDate);
        const results: PlanetStatus[] = [];

        console.log('[Retrograde] Calculating for JD:', jd, 'Date:', targetDate.toISO());
        console.log('[Retrograde] SWE instance:', this.swe);
        console.log('[Retrograde] Available SE constants:', {
            SE_MERCURY: this.swe.SE_MERCURY,
            SE_VENUS: this.swe.SE_VENUS,
            SE_MARS: this.swe.SE_MARS,
            SE_JUPITER: this.swe.SE_JUPITER,
            SE_SATURN: this.swe.SE_SATURN,
        });

        for (const planetName of RETROGRADE_PLANET_NAMES) {
            const seId = PLANET_SE_IDS[planetName];
            const planetId = this.swe[seId];
            console.log(`[Retrograde] ${planetName}: seId=${seId}, planetId=${planetId}`);
            const data = this.calculatePlanetWithSpeed(jd, planetId);
            console.log(`[Retrograde] ${planetName} result:`, data);

            if (data) {
                const sign = this.getZodiacSign(data.longitude);
                results.push({
                    name: planetName,
                    symbol: PLANET_SYMBOLS[planetName],
                    longitude: data.longitude,
                    speed: data.speed,
                    isRetrograde: data.speed < 0,
                    sign: sign.name,
                    signSymbol: sign.symbol,
                    degree: this.formatDegree(data.longitude)
                });
            }
        }

        return results;
    }

    /**
     * Get current status for all tracked bodies (positions, signs, gates)
     */
    async getSkyNow(date?: DateTime): Promise<PlanetStatus[]> {
        await this.initialize();

        const targetDate = date || DateTime.now();
        const jd = this.dateTimeToJd(targetDate);
        const results: PlanetStatus[] = [];

        for (const p of CALENDAR_PLANETS) {
            let data: { longitude: number; speed: number } | null = null;
            
            if (p.name === 'South Node') {
                // Calculate from North Node
                const nnId = this.swe[PLANET_SE_IDS['North Node']];
                const nnData = this.calculatePlanetWithSpeed(jd, nnId);
                if (nnData) {
                    data = {
                        longitude: (nnData.longitude + 180) % 360,
                        speed: -nnData.speed
                    };
                }
            } else {
                const seId = PLANET_SE_IDS[p.name];
                const planetId = this.swe[seId];
                data = this.calculatePlanetWithSpeed(jd, planetId);
            }

            if (data) {
                const sign = this.getZodiacSign(data.longitude);
                results.push({
                    name: p.name,
                    symbol: p.symbol,
                    longitude: data.longitude,
                    speed: data.speed,
                    isRetrograde: data.speed < 0,
                    sign: sign.name,
                    signSymbol: sign.symbol,
                    degree: this.formatDegree(data.longitude)
                });
            }
        }

        return results;
    }

    /**
     * Find retrograde periods within a date range
     */
    async findRetrogradePeriods(
        startDate: DateTime,
        endDate: DateTime,
        planetNames?: string[]
    ): Promise<RetrogradePeriod[]> {
        await this.initialize();

        const periods: RetrogradePeriod[] = [];
        const planetsToCheck = planetNames
            ? RETROGRADE_PLANET_NAMES.filter(name => planetNames.includes(name))
            : RETROGRADE_PLANET_NAMES;

        // Check each day in the range
        const dayStep = 1; // Check every day
        let currentDate = startDate;

        for (const planetName of planetsToCheck) {
            const seId = PLANET_SE_IDS[planetName];
            const planetId = this.swe[seId];
            let inRetrograde = false;
            let retroStart: DateTime | null = null;
            let retroStartSign = '';

            currentDate = startDate;

            while (currentDate <= endDate) {
                const jd = this.dateTimeToJd(currentDate);
                const data = this.calculatePlanetWithSpeed(jd, planetId);

                if (data) {
                    const isRetro = data.speed < 0;
                    const sign = this.getZodiacSign(data.longitude);

                    if (isRetro && !inRetrograde) {
                        // Starting retrograde
                        inRetrograde = true;
                        retroStart = currentDate;
                        retroStartSign = sign.name;
                    } else if (!isRetro && inRetrograde && retroStart) {
                        // Ending retrograde
                        periods.push({
                            planet: planetName,
                            symbol: PLANET_SYMBOLS[planetName],
                            startDate: retroStart,
                            endDate: currentDate,
                            startSign: retroStartSign,
                            endSign: sign.name,
                            durationDays: Math.round(currentDate.diff(retroStart, 'days').days)
                        });
                        inRetrograde = false;
                        retroStart = null;
                    }
                }

                currentDate = currentDate.plus({ days: dayStep });
            }

            // Handle retrograde that extends beyond end date - find when it actually ends
            if (inRetrograde && retroStart) {
                // Search up to 6 months beyond to find the actual end
                let searchDate = endDate.plus({ days: 1 });
                const maxSearchDate = endDate.plus({ months: 6 });
                let actualEndDate = endDate;
                let actualEndSign = retroStartSign;

                while (searchDate <= maxSearchDate) {
                    const jd = this.dateTimeToJd(searchDate);
                    const data = this.calculatePlanetWithSpeed(jd, planetId);

                    if (data) {
                        const isRetro = data.speed < 0;
                        if (!isRetro) {
                            // Found the actual end of retrograde
                            actualEndDate = searchDate;
                            actualEndSign = this.getZodiacSign(data.longitude).name;
                            break;
                        }
                    }
                    searchDate = searchDate.plus({ days: 1 });
                }

                // Only add if we don't already have this period
                const alreadyExists = periods.some(p => 
                    p.planet === planetName && 
                    Math.abs(p.startDate.diff(retroStart, 'days').days) < 2
                );

                if (!alreadyExists) {
                    periods.push({
                        planet: planetName,
                        symbol: PLANET_SYMBOLS[planetName],
                        startDate: retroStart,
                        endDate: actualEndDate,
                        startSign: retroStartSign,
                        endSign: actualEndSign,
                        durationDays: Math.round(actualEndDate.diff(retroStart, 'days').days)
                    });
                }
            }

            // Also check if there's a retrograde that STARTED before the search range but is active during it
            // Check the day before start date
            const preStartJd = this.dateTimeToJd(startDate.minus({ days: 1 }));
            const preStartData = this.calculatePlanetWithSpeed(preStartJd, planetId);
            if (preStartData && preStartData.speed < 0) {
                // There's a retrograde that started before our range
                // Find when it started (search back up to 6 months)
                let searchBackDate = startDate.minus({ days: 2 });
                const minSearchDate = startDate.minus({ months: 6 });
                let actualStartDate = startDate;
                let actualStartSign = '';

                while (searchBackDate >= minSearchDate) {
                    const jd = this.dateTimeToJd(searchBackDate);
                    const data = this.calculatePlanetWithSpeed(jd, planetId);

                    if (data) {
                        const isRetro = data.speed < 0;
                        if (!isRetro) {
                            // Found the day before retrograde started
                            actualStartDate = searchBackDate.plus({ days: 1 });
                            const startJd = this.dateTimeToJd(actualStartDate);
                            const startData = this.calculatePlanetWithSpeed(startJd, planetId);
                            actualStartSign = startData ? this.getZodiacSign(startData.longitude).name : '';
                            break;
                        }
                    }
                    searchBackDate = searchBackDate.minus({ days: 1 });
                }

                // Find when it ends
                let searchDate = startDate;
                const maxSearchDate = startDate.plus({ months: 6 });
                let actualEndDate = startDate;
                let actualEndSign = '';

                while (searchDate <= maxSearchDate) {
                    const jd = this.dateTimeToJd(searchDate);
                    const data = this.calculatePlanetWithSpeed(jd, planetId);

                    if (data) {
                        const isRetro = data.speed < 0;
                        if (!isRetro) {
                            actualEndDate = searchDate;
                            actualEndSign = this.getZodiacSign(data.longitude).name;
                            break;
                        }
                    }
                    searchDate = searchDate.plus({ days: 1 });
                }

                // Only add if we don't already have this period (check by start date AND end date)
                const alreadyExists = periods.some(p => 
                    p.planet === planetName && 
                    (Math.abs(p.startDate.diff(actualStartDate, 'days').days) < 2 ||
                     Math.abs(p.endDate.diff(actualEndDate, 'days').days) < 2)
                );

                if (!alreadyExists && actualStartSign) {
                    periods.push({
                        planet: planetName,
                        symbol: PLANET_SYMBOLS[planetName],
                        startDate: actualStartDate,
                        endDate: actualEndDate,
                        startSign: actualStartSign,
                        endSign: actualEndSign,
                        durationDays: Math.round(actualEndDate.diff(actualStartDate, 'days').days)
                    });
                }
            }
        }

        // Sort by start date
        periods.sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());

        return periods;
    }

    /**
     * Find the next station (retrograde or direct) for a planet
     */
    async findNextStation(
        planetName: string,
        fromDate?: DateTime,
        maxDaysToSearch: number = 365
    ): Promise<{ date: DateTime; type: 'retrograde' | 'direct'; sign: string } | null> {
        await this.initialize();

        const seId = PLANET_SE_IDS[planetName];
        if (!seId) return null;

        const planetId = this.swe[seId];
        const startDate = fromDate || DateTime.now();
        let currentDate = startDate;
        const endDate = startDate.plus({ days: maxDaysToSearch });

        // Get initial state
        let jd = this.dateTimeToJd(currentDate);
        let prevData = this.calculatePlanetWithSpeed(jd, planetId);
        if (!prevData) return null;

        let prevRetro = prevData.speed < 0;

        // Search for station
        while (currentDate < endDate) {
            currentDate = currentDate.plus({ days: 1 });
            jd = this.dateTimeToJd(currentDate);
            const data = this.calculatePlanetWithSpeed(jd, planetId);

            if (data) {
                const isRetro = data.speed < 0;

                if (isRetro !== prevRetro) {
                    // Found a station! Refine to find exact day
                    const sign = this.getZodiacSign(data.longitude);
                    return {
                        date: currentDate,
                        type: isRetro ? 'retrograde' : 'direct',
                        sign: sign.name
                    };
                }

                prevRetro = isRetro;
            }
        }

        return null;
    }

    /**
     * Get current moon phase data
     */
    async getMoonPhase(date?: DateTime, ascendantLongitude?: number): Promise<MoonPhaseData> {
        await this.initialize();

        const targetDate = date || DateTime.now();
        const jd = this.dateTimeToJd(targetDate);

        // Get Sun and Moon positions
        const sunData = this.calculatePlanetWithSpeed(jd, this.swe.SE_SUN);
        const moonData = this.calculatePlanetWithSpeed(jd, this.swe.SE_MOON);

        if (!sunData || !moonData) {
            throw new Error('Failed to calculate Sun/Moon positions');
        }

        const sunLong = sunData.longitude;
        const moonLong = moonData.longitude;

        // Calculate the phase angle (elongation)
        let phaseAngle = moonLong - sunLong;
        if (phaseAngle < 0) phaseAngle += 360;

        // Determine phase name and emoji
        let { phaseName, phaseEmoji, phase } = this.getPhaseInfo(phaseAngle);

        // Calculate illumination (approximate)
        const illumination = (1 - Math.cos(phaseAngle * Math.PI / 180)) / 2 * 100;

        // Is moon waxing or waning?
        const isWaxing = phaseAngle < 180;

        // Get moon sign
        const moonSign = this.getZodiacSign(moonLong);

        // Calculate house if ascendant provided
        let moonHouse: number | undefined;
        if (ascendantLongitude !== undefined) {
            moonHouse = this.calculateHouse(moonLong, ascendantLongitude);
        }

        // Find next/previous lunation anchors
        const nextNewMoon = await this.findNextPhase(targetDate, 0); // 0 = new moon
        const nextFullMoon = await this.findNextPhase(targetDate, 180); // 180 = full moon
        const previousFullMoon = await this.findPreviousPhase(targetDate, 180); // 180 = full moon

        // Blue Moon: second full moon in same calendar month
        if (
            phase === 'full' &&
            previousFullMoon.year === targetDate.year &&
            previousFullMoon.month === targetDate.month &&
            targetDate.diff(previousFullMoon, 'days').days > 1
        ) {
            phase = 'blue-moon';
            phaseName = 'Blue Moon';
            phaseEmoji = '🔵🌕';
        }

        const daysUntilNew = Math.round(nextNewMoon.diff(targetDate, 'days').days);
        const daysUntilFull = Math.round(nextFullMoon.diff(targetDate, 'days').days);

        return {
            phase,
            phaseName,
            phaseEmoji,
            illumination: Math.round(illumination),
            moonLongitude: moonLong,
            sunLongitude: sunLong,
            moonSign: moonSign.name,
            moonSignSymbol: moonSign.symbol,
            moonDegree: this.formatDegree(moonLong),
            moonHouse,
            daysUntilNew,
            daysUntilFull,
            nextNewMoon,
            nextFullMoon,
            isWaxing,
            upcoming: await this.getUpcomingMoonPhases(targetDate)
        };
    }

    /**
     * Get the next four major moon phases (New, 1st Qtr, Full, 3rd Qtr)
     */
    async getUpcomingMoonPhases(fromDate: DateTime): Promise<Array<{ label: string; date: DateTime; sign: string; signSymbol: string; longitude: number }>> {
        const phases = [
            { label: 'New Moon', angle: 0 },
            { label: '1st Quarter', angle: 90 },
            { label: 'Full Moon', angle: 180 },
            { label: '3rd Quarter', angle: 270 }
        ];

        const results: Array<{ label: string; date: DateTime; sign: string; signSymbol: string; longitude: number }> = [];

        for (const p of phases) {
            const date = await this.findNextPhaseExact(fromDate, p.angle);
            const jd = this.dateTimeToJd(date);
            const moonData = this.calculatePlanetWithSpeed(jd, this.swe.SE_MOON);
            const sign = moonData ? this.getZodiacSign(moonData.longitude) : { name: '—', symbol: '' };
            
            results.push({
                label: p.label,
                date,
                sign: sign.name,
                signSymbol: sign.symbol,
                longitude: moonData?.longitude ?? 0
            });
        }

        // Sort by date so they appear in chronological order
        return results.sort((a, b) => a.date.toMillis() - b.date.toMillis());
    }

    /**
     * More exact search for the next moon phase with a specific elongation angle
     */
    private async findNextPhaseExact(fromDate: DateTime, targetAngle: number): Promise<DateTime> {
        let currentDate = fromDate;
        
        // Initial coarse search (daily)
        const maxDays = 32;
        let foundDate = fromDate;
        let bestDiff = 360;

        for (let i = 0; i < maxDays; i++) {
            const jd = this.dateTimeToJd(currentDate);
            const sunData = this.calculatePlanetWithSpeed(jd, this.swe.SE_SUN);
            const moonData = this.calculatePlanetWithSpeed(jd, this.swe.SE_MOON);

            if (sunData && moonData) {
                let angle = moonData.longitude - sunData.longitude;
                if (angle < 0) angle += 360;

                const diff = Math.abs(angle - targetAngle);
                const normDiff = Math.min(diff, 360 - diff);

                // We want to find the point where the moon crosses the target angle moving forward
                // So we check if we just passed it or are very close.
                // Moon moves ~13 deg/day, Sun ~1 deg/day, net ~12 deg/day.
                if (normDiff < 13) {
                    foundDate = currentDate;
                    bestDiff = normDiff;
                    // Refine hourly for 24 hours around this date
                    let hourlyDate = currentDate.minus({ hours: 12 });
                    for (let h = 0; h < 48; h++) {
                        const hjd = this.dateTimeToJd(hourlyDate);
                        const hsun = this.calculatePlanetWithSpeed(hjd, this.swe.SE_SUN);
                        const hmoon = this.calculatePlanetWithSpeed(hjd, this.swe.SE_MOON);
                        if (hsun && hmoon) {
                            let hangle = hmoon.longitude - hsun.longitude;
                            if (hangle < 0) hangle += 360;
                            const hdiff = Math.abs(hangle - targetAngle);
                            const hnorm = Math.min(hdiff, 360 - hdiff);
                            if (hnorm < bestDiff) {
                                bestDiff = hnorm;
                                foundDate = hourlyDate;
                            }
                        }
                        hourlyDate = hourlyDate.plus({ hours: 1 });
                    }
                    
                    // If this foundDate is in the past compared to fromDate (within 1 day error), 
                    // and it's for the 'New Moon' or similar, we might have caught the CURRENT phase.
                    // We want the NEXT one.
                    if (foundDate.toMillis() <= fromDate.toMillis() + 3600000) {
                        // Skip this one and keep looking
                    } else {
                        return foundDate;
                    }
                }
            }
            currentDate = currentDate.plus({ days: 1 });
        }

        return fromDate.plus({ days: 29.5 }); // Fallback
    }

    private getPhaseInfo(phaseAngle: number): { phaseName: string; phaseEmoji: string; phase: string } {
        // Extended phase labels for chart interpretation
        if (phaseAngle < 22.5) {
            return { phase: 'new', phaseName: 'New Moon', phaseEmoji: '🌑' };
        } else if (phaseAngle < 67.5) {
            return { phase: 'waxing-crescent', phaseName: 'Waxing Crescent', phaseEmoji: '🌒' };
        } else if (phaseAngle < 112.5) {
            return { phase: 'first-quarter', phaseName: 'First Quarter', phaseEmoji: '🌓' };
        } else if (phaseAngle < 157.5) {
            return { phase: 'waxing-gibbous', phaseName: 'Waxing Gibbous', phaseEmoji: '🌔' };
        } else if (phaseAngle < 202.5) {
            return { phase: 'full', phaseName: 'Full Moon', phaseEmoji: '🌕' };
        } else if (phaseAngle < 247.5) {
            return { phase: 'waning-gibbous', phaseName: 'Waning Gibbous', phaseEmoji: '🌖' };
        } else if (phaseAngle < 292.5) {
            return { phase: 'last-quarter', phaseName: 'Last Quarter', phaseEmoji: '🌗' };
        } else if (phaseAngle < 330) {
            return { phase: 'balsamic', phaseName: 'Balsamic', phaseEmoji: '🌘' };
        } else if (phaseAngle < 352) {
            return { phase: 'dark-moon', phaseName: 'Dark Moon', phaseEmoji: '🌑' };
        } else {
            return { phase: 'new', phaseName: 'New Moon', phaseEmoji: '🌑' };
        }
    }

    public calculateHouse(planetLong: number, ascLong: number): number {
        // Whole sign house calculation
        const ascSign = Math.floor(ascLong / 30);
        const planetSign = Math.floor(planetLong / 30);
        return ((planetSign - ascSign + 12) % 12) + 1;
    }

    private async findNextPhase(fromDate: DateTime, targetAngle: number): Promise<DateTime> {
        let currentDate = fromDate;
        const maxDays = 35;

        for (let i = 0; i < maxDays; i++) {
            const jd = this.dateTimeToJd(currentDate);
            const sunData = this.calculatePlanetWithSpeed(jd, this.swe.SE_SUN);
            const moonData = this.calculatePlanetWithSpeed(jd, this.swe.SE_MOON);

            if (sunData && moonData) {
                let angle = moonData.longitude - sunData.longitude;
                if (angle < 0) angle += 360;

                const diff = Math.abs(angle - targetAngle);
                const normalizedDiff = Math.min(diff, 360 - diff);

                if (normalizedDiff < 6 && i > 0) {
                    return currentDate;
                }
            }

            currentDate = currentDate.plus({ days: 1 });
        }

        return fromDate.plus({ days: 29 });
    }

    private async findPreviousPhase(fromDate: DateTime, targetAngle: number): Promise<DateTime> {
        let currentDate = fromDate;
        const maxDays = 35;

        for (let i = 0; i < maxDays; i++) {
            const jd = this.dateTimeToJd(currentDate);
            const sunData = this.calculatePlanetWithSpeed(jd, this.swe.SE_SUN);
            const moonData = this.calculatePlanetWithSpeed(jd, this.swe.SE_MOON);

            if (sunData && moonData) {
                let angle = moonData.longitude - sunData.longitude;
                if (angle < 0) angle += 360;

                const diff = Math.abs(angle - targetAngle);
                const normalizedDiff = Math.min(diff, 360 - diff);

                if (normalizedDiff < 6 && i > 0) {
                    return currentDate;
                }
            }

            currentDate = currentDate.minus({ days: 1 });
        }

        return fromDate.minus({ days: 29 });
    }

    /**
     * Get gate number from longitude
     */
    public getGateFromLongitude(longitude: number): number { return HumanDesignLogic.calculateActivation(longitude).gate; }
    public getLineFromLongitude(longitude: number): number { return HumanDesignLogic.calculateActivation(longitude).line; }

    async getCalendarEvents(
        startDate: DateTime,
        endDate: DateTime,
        ascendantLongitude?: number,
        designAscendantLongitude?: number,
        options?: CalendarEventOptions
    ): Promise<CalendarEvent[]> {
        await this.initialize();

        const resolvedOptions = {
            includeVoc: options?.includeVoc ?? true,
            includeTightAspects: options?.includeTightAspects ?? true,
            tightAspectOrb: options?.tightAspectOrb ?? 2,
            includeCriticalDegrees: options?.includeCriticalDegrees ?? true,
            includeConcentration: options?.includeConcentration ?? true,
            signConcentrationThreshold: options?.signConcentrationThreshold ?? 4,
            elementConcentrationThreshold: options?.elementConcentrationThreshold ?? 5,
            modalityConcentrationThreshold: options?.modalityConcentrationThreshold ?? 5,
        };

        const events: CalendarEvent[] = [];
        const stepMinutes = 10;
        const scanStart = startDate.minus({ days: 3 });
        const prevPositions: Record<string, { sign: number; gate: number; longitude: number; isRetrograde: boolean }> = {};
        const RETROGRADE_CAPABLE = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron'];
        const ASPECT_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron'];
        const CONCENTRATION_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
        const POINT_LIKE_BODIES = ['Chiron', 'North Node', 'Lilith'];
        const aspectDefinitions = [
            { name: 'Conjunction', angle: 0, symbol: '☌' },
            { name: 'Sextile', angle: 60, symbol: '⚹' },
            { name: 'Square', angle: 90, symbol: '□' },
            { name: 'Trine', angle: 120, symbol: '△' },
            { name: 'Opposition', angle: 180, symbol: '☍' },
        ];
        const criticalState = new Map<string, boolean>();
        const emittedConcentration = new Set<string>();

        type PositionSnapshot = {
            name: string;
            symbol: string;
            longitude: number;
            signIndex: number;
            sign: { name: string; symbol: string };
            degreeInSign: number;
            speed: number;
            isRetrograde: boolean;
            gate: number;
        };

        type AspectDefinition = { name: string; angle: number; symbol: string };

        type ActiveAspectWindow = {
            aspect: AspectDefinition;
            p1Name: string;
            p1Symbol: string;
            p2Name: string;
            p2Symbol: string;
            bestTime: DateTime;
            bestOrb: number;
            exactEmitted: boolean;
        };

        const activeAspectWindows = new Map<string, ActiveAspectWindow>();

        let moonSignEntryDate = scanStart;
        let lastMoonAspectExactInSign: DateTime | null = null;

        const normalizeAngle = (value: number) => {
            let result = value % 360;
            if (result < 0) {
                result += 360;
            }
            return result;
        };

        const getElement = (signIndex: number) => ['Fire', 'Earth', 'Air', 'Water'][signIndex % 4];
        const getModality = (signIndex: number) => ['Cardinal', 'Fixed', 'Mutable'][signIndex % 3];

        const toPositionMap = (positions: PositionSnapshot[]) => new Map(positions.map((position) => [position.name, position]));

        const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

        const interpolateDate = (from: DateTime, to: DateTime, fraction: number) => {
            const millis = to.toMillis() - from.toMillis();
            return from.plus({ milliseconds: Math.round(millis * clamp01(fraction)) });
        };

        const isInRequestedRange = (date: DateTime, end?: DateTime) => {
            if (end) {
                return end >= startDate && date <= endDate;
            }
            return date >= startDate && date <= endDate;
        };

        const pushEvent = (event: CalendarEvent) => {
            if (isInRequestedRange(event.date, event.endDate)) {
                events.push(event);
            }
        };

        const buildPositionSnapshot = (date: DateTime): PositionSnapshot[] => {
            const jd = this.dateTimeToJd(date);
            return CALENDAR_PLANETS.map((planet) => {
                const seId = PLANET_SE_IDS[planet.name];
                if (!seId) return null;
                const planetId = this.swe[seId];
                const data = this.calculatePlanetWithSpeed(jd, planetId);
                if (!data) return null;
                const signIndex = Math.floor(data.longitude / 30);
                const sign = this.getZodiacSign(data.longitude);
                return {
                    name: planet.name,
                    symbol: planet.symbol,
                    longitude: data.longitude,
                    signIndex,
                    sign,
                    degreeInSign: normalizeAngle(data.longitude) % 30,
                    speed: data.speed,
                    isRetrograde: data.speed < 0,
                    gate: this.getGateFromLongitude(data.longitude),
                };
            }).filter(Boolean) as PositionSnapshot[];
        };

        const getAspectOrbForAngle = (left: PositionSnapshot, right: PositionSnapshot, angle: number) => {
            const diff = Math.abs(left.longitude - right.longitude);
            const normalized = diff > 180 ? 360 - diff : diff;
            return Math.abs(normalized - angle);
        };

        const getBestAspectMatch = (left: PositionSnapshot, right: PositionSnapshot): { aspect: AspectDefinition; orb: number } | null => {
            let bestMatch: AspectDefinition | null = null;
            let bestOrb = Number.POSITIVE_INFINITY;
            for (const aspect of aspectDefinitions) {
                const orb = getAspectOrbForAngle(left, right, aspect.angle);
                if (orb <= resolvedOptions.tightAspectOrb && orb < bestOrb) {
                    bestMatch = aspect;
                    bestOrb = orb;
                }
            }
            return bestMatch ? { aspect: bestMatch, orb: bestOrb } : null;
        };

        const emitAspectEvent = (
            type: 'aspect-enter' | 'aspect-exact' | 'aspect-exit',
            date: DateTime,
            left: { name: string; symbol: string },
            right: { name: string; symbol: string },
            aspect: AspectDefinition,
            orb: number,
        ) => {
            const description = type === 'aspect-enter'
                ? `${left.symbol} ${left.name} enters ${aspect.name.toLowerCase()} with ${right.symbol} ${right.name} (${orb.toFixed(2)}° orb)`
                : type === 'aspect-exact'
                    ? `${left.symbol} ${left.name} ${aspect.name.toLowerCase()} ${right.symbol} ${right.name} exact (${orb.toFixed(2)}° orb)`
                    : `${left.symbol} ${left.name} leaves ${aspect.name.toLowerCase()} with ${right.symbol} ${right.name} (${orb.toFixed(2)}° orb)`;
            pushEvent({
                date,
                type,
                planet: `${left.name}/${right.name}`,
                planetSymbol: `${left.symbol}${aspect.symbol}${right.symbol}`,
                description,
                severity: type === 'aspect-exact' ? (orb <= 0.2 ? 'major' : 'important') : 'info',
                tags: [aspect.name.toLowerCase()],
            });
        };

        const emitAspectExactIfNeeded = (window: ActiveAspectWindow) => {
            if (window.exactEmitted) {
                return;
            }
            emitAspectEvent(
                'aspect-exact',
                window.bestTime,
                { name: window.p1Name, symbol: window.p1Symbol },
                { name: window.p2Name, symbol: window.p2Symbol },
                window.aspect,
                window.bestOrb,
            );
            if (window.p1Name === 'Moon' || window.p2Name === 'Moon') {
                lastMoonAspectExactInSign = window.bestTime;
            }
            window.exactEmitted = true;
        };

        const appendCriticalDegreeEvents = (date: DateTime, positions: PositionSnapshot[]) => {
            if (!resolvedOptions.includeCriticalDegrees) {
                return;
            }
            positions.forEach((position) => {
                const isCritical = position.degreeInSign < 1 || position.degreeInSign >= 29;
                const key = position.name;
                const wasCritical = criticalState.get(key) || false;
                if (isCritical && !wasCritical) {
                    pushEvent({
                        date,
                        type: 'critical-degree',
                        planet: position.name,
                        planetSymbol: position.symbol,
                        description: `${position.symbol} ${position.name} reaches a critical degree in ${position.sign.symbol} ${position.sign.name}`,
                        toSign: position.sign.name,
                        toSignSymbol: position.sign.symbol,
                        severity: 'important',
                    });
                }
                criticalState.set(key, isCritical);
            });
        };

        const appendConcentrationEvents = (date: DateTime, positions: PositionSnapshot[]) => {
            if (!resolvedOptions.includeConcentration) {
                return;
            }
            const keyDate = date.toISODate();
            if (!keyDate || emittedConcentration.has(`day|${keyDate}`)) {
                return;
            }
            emittedConcentration.add(`day|${keyDate}`);

            const countedPositions = positions.filter((position) => CONCENTRATION_PLANETS.includes(position.name));
            const pointPositions = positions.filter((position) => POINT_LIKE_BODIES.includes(position.name));
            const pointNamesBySign = new Map<string, string[]>();

            pointPositions.forEach((position) => {
                const current = pointNamesBySign.get(position.sign.name) || [];
                current.push(`${position.symbol} ${position.name}`);
                pointNamesBySign.set(position.sign.name, current);
            });

            const signBodies = new Map<string, { symbol: string; members: string[] }>();
            const elementBodies = new Map<string, string[]>();
            const modalityBodies = new Map<string, string[]>();

            countedPositions.forEach((position) => {
                const signValue = signBodies.get(position.sign.name) || { symbol: position.sign.symbol, members: [] };
                signValue.members.push(`${position.symbol} ${position.name}`);
                signBodies.set(position.sign.name, signValue);

                const element = getElement(position.signIndex);
                const modality = getModality(position.signIndex);
                elementBodies.set(element, [...(elementBodies.get(element) || []), `${position.symbol} ${position.name}`]);
                modalityBodies.set(modality, [...(modalityBodies.get(modality) || []), `${position.symbol} ${position.name}`]);
            });

            signBodies.forEach((value, sign) => {
                if (value.members.length >= resolvedOptions.signConcentrationThreshold) {
                    const extraPoints = pointNamesBySign.get(sign);
                    const suffix = extraPoints?.length ? ` Points/nodes present but not counted: ${extraPoints.join(', ')}.` : '';
                    pushEvent({
                        date,
                        type: 'sign-concentration',
                        planet: sign,
                        planetSymbol: value.symbol,
                        description: `${value.symbol} ${sign} concentration: ${value.members.length} planets/luminaries counted — ${value.members.join(', ')}.${suffix}`,
                        severity: value.members.length > resolvedOptions.signConcentrationThreshold ? 'major' : 'important',
                    });
                }
            });

            elementBodies.forEach((members, element) => {
                if (members.length >= resolvedOptions.elementConcentrationThreshold) {
                    pushEvent({
                        date,
                        type: 'element-concentration',
                        planet: element,
                        planetSymbol: element,
                        description: `${element} concentration: ${members.length} planets/luminaries counted — ${members.join(', ')}.`,
                        severity: members.length > resolvedOptions.elementConcentrationThreshold ? 'major' : 'important',
                    });
                }
            });

            modalityBodies.forEach((members, modality) => {
                if (members.length >= resolvedOptions.modalityConcentrationThreshold) {
                    pushEvent({
                        date,
                        type: 'modality-concentration',
                        planet: modality,
                        planetSymbol: modality,
                        description: `${modality} concentration: ${members.length} planets/luminaries counted — ${members.join(', ')}.`,
                        severity: members.length > resolvedOptions.modalityConcentrationThreshold ? 'major' : 'important',
                    });
                }
            });
        };

        let previousDate = scanStart;
        let previousSnapshot = buildPositionSnapshot(scanStart);
        let previousMap = toPositionMap(previousSnapshot);

        previousSnapshot.forEach((position) => {
            prevPositions[position.name] = {
                sign: position.signIndex,
                gate: position.gate,
                longitude: position.longitude,
                isRetrograde: position.isRetrograde,
            };
        });

        const initialMoon = previousMap.get('Moon');
        if (initialMoon) {
            moonSignEntryDate = scanStart;
        }

        for (let i = 0; i < ASPECT_PLANETS.length; i += 1) {
            for (let j = i + 1; j < ASPECT_PLANETS.length; j += 1) {
                const left = previousMap.get(ASPECT_PLANETS[i]);
                const right = previousMap.get(ASPECT_PLANETS[j]);
                if (!left || !right) {
                    continue;
                }
                const initialMatch = getBestAspectMatch(left, right);
                if (initialMatch) {
                    activeAspectWindows.set(`${left.name}|${right.name}`, {
                        aspect: initialMatch.aspect,
                        p1Name: left.name,
                        p1Symbol: left.symbol,
                        p2Name: right.name,
                        p2Symbol: right.symbol,
                        bestTime: scanStart,
                        bestOrb: initialMatch.orb,
                        exactEmitted: false,
                    });
                }
            }
        }

        let prevPhaseAngle = 0;
        const initialSun = previousMap.get('Sun');
        if (initialSun && initialMoon) {
            prevPhaseAngle = (initialMoon.longitude - initialSun.longitude + 360) % 360;
        }

        for (let currentDate = scanStart.plus({ minutes: stepMinutes }); currentDate <= endDate; currentDate = currentDate.plus({ minutes: stepMinutes })) {
            const currentSnapshot = buildPositionSnapshot(currentDate);
            const currentMap = toPositionMap(currentSnapshot);

            if (resolvedOptions.includeTightAspects) {
                for (let i = 0; i < ASPECT_PLANETS.length; i += 1) {
                    for (let j = i + 1; j < ASPECT_PLANETS.length; j += 1) {
                        const leftPrev = previousMap.get(ASPECT_PLANETS[i]);
                        const rightPrev = previousMap.get(ASPECT_PLANETS[j]);
                        const leftCurr = currentMap.get(ASPECT_PLANETS[i]);
                        const rightCurr = currentMap.get(ASPECT_PLANETS[j]);
                        if (!leftPrev || !rightPrev || !leftCurr || !rightCurr) {
                            continue;
                        }

                        const key = `${leftCurr.name}|${rightCurr.name}`;
                        const prevMatch = getBestAspectMatch(leftPrev, rightPrev);
                        const currMatch = getBestAspectMatch(leftCurr, rightCurr);
                        const activeWindow = activeAspectWindows.get(key);

                        if (activeWindow && (!currMatch || currMatch.aspect.name !== activeWindow.aspect.name)) {
                            emitAspectExactIfNeeded(activeWindow);
                            const prevOrb = getAspectOrbForAngle(leftPrev, rightPrev, activeWindow.aspect.angle);
                            const currOrb = getAspectOrbForAngle(leftCurr, rightCurr, activeWindow.aspect.angle);
                            const exitFraction = currOrb === prevOrb
                                ? 1
                                : (resolvedOptions.tightAspectOrb - prevOrb) / (currOrb - prevOrb);
                            const exitTime = interpolateDate(previousDate, currentDate, exitFraction);
                            emitAspectEvent(
                                'aspect-exit',
                                exitTime,
                                { name: activeWindow.p1Name, symbol: activeWindow.p1Symbol },
                                { name: activeWindow.p2Name, symbol: activeWindow.p2Symbol },
                                activeWindow.aspect,
                                resolvedOptions.tightAspectOrb,
                            );
                            activeAspectWindows.delete(key);
                        }

                        const nextWindow = activeAspectWindows.get(key);
                        if (currMatch) {
                            if (nextWindow && nextWindow.aspect.name === currMatch.aspect.name) {
                                if (currMatch.orb < nextWindow.bestOrb) {
                                    nextWindow.bestOrb = currMatch.orb;
                                    nextWindow.bestTime = currentDate;
                                } else if (!nextWindow.exactEmitted && currMatch.orb > nextWindow.bestOrb + 0.02) {
                                    emitAspectExactIfNeeded(nextWindow);
                                }
                            } else {
                                const prevOrbForCurrentAspect = getAspectOrbForAngle(leftPrev, rightPrev, currMatch.aspect.angle);
                                const enterFraction = prevOrbForCurrentAspect === currMatch.orb
                                    ? 1
                                    : (prevOrbForCurrentAspect - resolvedOptions.tightAspectOrb) / (prevOrbForCurrentAspect - currMatch.orb);
                                const enterTime = prevOrbForCurrentAspect > resolvedOptions.tightAspectOrb
                                    ? interpolateDate(previousDate, currentDate, enterFraction)
                                    : currentDate;
                                emitAspectEvent(
                                    'aspect-enter',
                                    enterTime,
                                    { name: leftCurr.name, symbol: leftCurr.symbol },
                                    { name: rightCurr.name, symbol: rightCurr.symbol },
                                    currMatch.aspect,
                                    resolvedOptions.tightAspectOrb,
                                );
                                activeAspectWindows.set(key, {
                                    aspect: currMatch.aspect,
                                    p1Name: leftCurr.name,
                                    p1Symbol: leftCurr.symbol,
                                    p2Name: rightCurr.name,
                                    p2Symbol: rightCurr.symbol,
                                    bestTime: currentDate,
                                    bestOrb: currMatch.orb,
                                    exactEmitted: false,
                                });
                            }
                        } else if (!currMatch && prevMatch && prevMatch.orb <= resolvedOptions.tightAspectOrb) {
                            activeAspectWindows.delete(key);
                        }
                    }
                }
            }

            appendCriticalDegreeEvents(currentDate, currentSnapshot);
            appendConcentrationEvents(currentDate.startOf('day'), currentSnapshot);

            const sunData = currentMap.get('Sun');
            const moonData = currentMap.get('Moon');
            if (sunData && moonData) {
                const phaseAngle = (moonData.longitude - sunData.longitude + 360) % 360;
                const phases = [
                    { angle: 0, name: 'New Moon', emoji: '🌑' },
                    { angle: 90, name: 'First Quarter', emoji: '🌓' },
                    { angle: 180, name: 'Full Moon', emoji: '🌕' },
                    { angle: 270, name: 'Last Quarter', emoji: '🌗' },
                ];

                for (const phase of phases) {
                    const prevDiff = (prevPhaseAngle - phase.angle + 360) % 360;
                    const currDiff = (phaseAngle - phase.angle + 360) % 360;

                    if ((prevDiff > 180 && currDiff <= 180) || (prevDiff > 350 && currDiff < 10)) {
                        pushEvent({
                            date: currentDate,
                            type: 'moon-phase',
                            planet: 'Moon',
                            planetSymbol: '☽',
                            description: `${phase.emoji} ${phase.name} in ${moonData.sign.symbol} ${moonData.sign.name}`,
                            phase: phase.name,
                            phaseEmoji: phase.emoji,
                            toSign: moonData.sign.name,
                            toSignSymbol: moonData.sign.symbol,
                            house: ascendantLongitude !== undefined ? this.calculateHouse(moonData.longitude, ascendantLongitude) : undefined,
                            designHouse: designAscendantLongitude !== undefined ? this.calculateHouse(moonData.longitude, designAscendantLongitude) : undefined,
                        });
                    }
                }
                prevPhaseAngle = phaseAngle;
            }

            for (const planet of CALENDAR_PLANETS) {
                const currentPosition = currentMap.get(planet.name);
                const prev = prevPositions[planet.name];
                if (!currentPosition || !prev) {
                    continue;
                }

                const currentSign = currentPosition.signIndex;
                const currentGate = currentPosition.gate;
                const currentIsRetrograde = currentPosition.isRetrograde;

                if (currentSign !== prev.sign) {
                    const fromSign = this.getZodiacSign(prev.longitude);
                    const toSign = currentPosition.sign;

                    if (planet.name === 'Moon' && resolvedOptions.includeVoc) {
                        const vocStart = lastMoonAspectExactInSign || moonSignEntryDate;
                        if (vocStart < currentDate) {
                            pushEvent({
                                date: vocStart,
                                endDate: currentDate,
                                type: 'moon-voc',
                                planet: 'Moon',
                                planetSymbol: '☽',
                                description: `☽ Moon void of course in ${fromSign.symbol} ${fromSign.name} from the last major exact aspect until ingress into ${toSign.symbol} ${toSign.name}`,
                                fromSign: fromSign.name,
                                fromSignSymbol: fromSign.symbol,
                                toSign: toSign.name,
                                toSignSymbol: toSign.symbol,
                                severity: 'important',
                            });
                        }
                        moonSignEntryDate = currentDate;
                        lastMoonAspectExactInSign = null;
                    }

                    pushEvent({
                        date: currentDate,
                        type: planet.name === 'Moon' ? 'moon-ingress' : 'planet-ingress',
                        planet: planet.name,
                        planetSymbol: planet.symbol,
                        description: `${planet.symbol} ${planet.name} enters ${toSign.symbol} ${toSign.name}`,
                        fromSign: fromSign.name,
                        fromSignSymbol: fromSign.symbol,
                        toSign: toSign.name,
                        toSignSymbol: toSign.symbol,
                        house: ascendantLongitude !== undefined ? this.calculateHouse(currentPosition.longitude, ascendantLongitude) : undefined,
                        designHouse: designAscendantLongitude !== undefined ? this.calculateHouse(currentPosition.longitude, designAscendantLongitude) : undefined,
                    });
                }

                if (planet.trackGates && currentGate !== prev.gate) {
                    pushEvent({
                        date: currentDate,
                        type: 'planet-gate-ingress',
                        planet: planet.name,
                        planetSymbol: planet.symbol,
                        description: `${planet.symbol} ${planet.name} enters Gate ${currentGate}`,
                        fromGate: prev.gate,
                        toGate: currentGate,
                        house: ascendantLongitude !== undefined ? this.calculateHouse(currentPosition.longitude, ascendantLongitude) : undefined,
                        designHouse: designAscendantLongitude !== undefined ? this.calculateHouse(currentPosition.longitude, designAscendantLongitude) : undefined,
                        isRetrograde: currentIsRetrograde,
                    });
                }

                if (RETROGRADE_CAPABLE.includes(planet.name) && currentIsRetrograde !== prev.isRetrograde) {
                    if (currentIsRetrograde) {
                        pushEvent({
                            date: currentDate,
                            type: 'retrograde-start',
                            planet: planet.name,
                            planetSymbol: planet.symbol,
                            description: `℞ ${planet.symbol} ${planet.name} stations Retrograde in ${currentPosition.sign.symbol} ${currentPosition.sign.name}`,
                            toSign: currentPosition.sign.name,
                            toSignSymbol: currentPosition.sign.symbol,
                            house: ascendantLongitude !== undefined ? this.calculateHouse(currentPosition.longitude, ascendantLongitude) : undefined,
                            designHouse: designAscendantLongitude !== undefined ? this.calculateHouse(currentPosition.longitude, designAscendantLongitude) : undefined,
                            isRetrograde: true,
                        });
                    } else {
                        pushEvent({
                            date: currentDate,
                            type: 'retrograde-end',
                            planet: planet.name,
                            planetSymbol: planet.symbol,
                            description: `${planet.symbol} ${planet.name} stations Direct in ${currentPosition.sign.symbol} ${currentPosition.sign.name}`,
                            toSign: currentPosition.sign.name,
                            toSignSymbol: currentPosition.sign.symbol,
                            house: ascendantLongitude !== undefined ? this.calculateHouse(currentPosition.longitude, ascendantLongitude) : undefined,
                            designHouse: designAscendantLongitude !== undefined ? this.calculateHouse(currentPosition.longitude, designAscendantLongitude) : undefined,
                            isRetrograde: false,
                        });
                    }
                }

                if (RETROGRADE_CAPABLE.includes(planet.name) && currentIsRetrograde && currentSign !== prev.sign) {
                    const fromSign = this.getZodiacSign(prev.longitude);
                    pushEvent({
                        date: currentDate,
                        type: 'retrograde-sign-change',
                        planet: planet.name,
                        planetSymbol: planet.symbol,
                        description: `℞ ${planet.symbol} ${planet.name} retrogrades into ${currentPosition.sign.symbol} ${currentPosition.sign.name}`,
                        fromSign: fromSign.name,
                        fromSignSymbol: fromSign.symbol,
                        toSign: currentPosition.sign.name,
                        toSignSymbol: currentPosition.sign.symbol,
                        house: ascendantLongitude !== undefined ? this.calculateHouse(currentPosition.longitude, ascendantLongitude) : undefined,
                        designHouse: designAscendantLongitude !== undefined ? this.calculateHouse(currentPosition.longitude, designAscendantLongitude) : undefined,
                        isRetrograde: true,
                    });
                }

                prevPositions[planet.name] = {
                    sign: currentSign,
                    gate: currentGate,
                    longitude: currentPosition.longitude,
                    isRetrograde: currentIsRetrograde,
                };
            }

            previousDate = currentDate;
            previousSnapshot = currentSnapshot;
            previousMap = currentMap;
        }

        activeAspectWindows.forEach((window) => {
            emitAspectExactIfNeeded(window);
        });

        if (resolvedOptions.includeVoc) {
            const finalMoon = prevPositions['Moon'];
            if (finalMoon) {
                const finalMoonSign = this.getZodiacSign(finalMoon.longitude);
                const vocStart = lastMoonAspectExactInSign || moonSignEntryDate;
                if (vocStart < endDate) {
                    pushEvent({
                        date: vocStart,
                        endDate,
                        type: 'moon-voc',
                        planet: 'Moon',
                        planetSymbol: '☽',
                        description: `☽ Moon void of course in ${finalMoonSign.symbol} ${finalMoonSign.name} from the last major exact aspect through the end of the requested range`,
                        toSign: finalMoonSign.name,
                        toSignSymbol: finalMoonSign.symbol,
                        severity: 'important',
                    });
                }
            }
        }

        events.sort((a, b) => a.date.toMillis() - b.date.toMillis());

        return events;
    }

    /**
     * Generate ICS calendar file content
     */
    generateICS(events: CalendarEvent[], calendarName: string = 'Astro Calendar', options?: ICSOptions): string {
        void options;

        const lines: string[] = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//AHD Charts//Astro Calendar//EN',
            `X-WR-CALNAME:${calendarName}`,
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
        ];

        const eventsByDay: Record<string, CalendarEvent[]> = {};
        for (const event of events) {
            const dayKey = event.date.toFormat('yyyy-MM-dd');
            if (!eventsByDay[dayKey]) {
                eventsByDay[dayKey] = [];
            }
            eventsByDay[dayKey].push(event);
        }

        for (const [dayKey, dayEvents] of Object.entries(eventsByDay)) {
            const date = DateTime.fromISO(dayKey);
            const dateStr = date.toFormat('yyyyMMdd');
            const summaryParts = dayEvents.slice(0, 3).map((event) => {
                if (event.type === 'moon-phase') return `${event.phaseEmoji} ${event.phase}`;
                if (event.type === 'moon-ingress') return `☽→${event.toSignSymbol}`;
                if (event.type === 'planet-ingress') return `${event.planetSymbol}→${event.toSignSymbol}`;
                if (event.type === 'planet-gate-ingress') return `${event.planetSymbol}→G${event.toGate}`;
                if (event.type === 'retrograde-start') return `℞${event.planetSymbol}`;
                if (event.type === 'retrograde-end') return `${event.planetSymbol}D`;
                if (event.type === 'retrograde-sign-change') return `℞${event.planetSymbol}→${event.toSignSymbol}`;
                if (event.type === 'tight-aspect') return event.planetSymbol;
                if (event.type === 'aspect-enter') return `${event.planetSymbol} in`;
                if (event.type === 'aspect-exact') return `${event.planetSymbol} exact`;
                if (event.type === 'aspect-exit') return `${event.planetSymbol} out`;
                if (event.type === 'moon-voc') return '☽ VOC';
                return event.planet;
            }).filter(Boolean);
            const summary = summaryParts.join(' | ') + (dayEvents.length > 3 ? ` +${dayEvents.length - 3} more` : '');
            const description = dayEvents.map((event) => {
                let line = `${event.date.toFormat('h:mm a')}: ${event.description}`;
                if (event.house) line += ` (House ${event.house})`;
                if (event.designHouse) line += ` (Design House ${event.designHouse})`;
                return line;
            }).join('\\n');
            const uid = `${dateStr}-${dayEvents.length}@ahdcharts`;

            lines.push('BEGIN:VEVENT');
            lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
            lines.push(`DTEND;VALUE=DATE:${date.plus({ days: 1 }).toFormat('yyyyMMdd')}`);
            lines.push(`UID:${uid}`);
            lines.push(`SUMMARY:${summary}`);
            lines.push(`DESCRIPTION:${description}`);
            lines.push('END:VEVENT');
        }

        lines.push('END:VCALENDAR');
        return lines.join('\\r\\n');
    }
}



