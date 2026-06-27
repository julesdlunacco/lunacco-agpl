
/**
 * Service to handle Swiss Ephemeris calculations via WASM.
 * Uses 'swisseph-wasm' package.
 */

import { DateTime } from 'luxon';
import SwissEph from 'swisseph-wasm';
import { ChartData, HumanDesignLogic, Activation } from './HumanDesignLogic';
import { Center } from './HumanDesignDefinitions';

export interface AstrocartographyLinePoint {
    lon: number;
    lat: number;
}

export interface AstrocartographyLine {
    id: string;
    planet: string;
    angle: 'MC' | 'IC' | 'ASC' | 'DSC';
    coordinates: AstrocartographyLinePoint[];
}

export class EphemerisService {
    private static instance: EphemerisService | null = null;
    private swe: any = null;
    private ephePath: string = '';
    private loadedFiles: Set<string> = new Set();

    constructor(ephePath: string) {
        this.ephePath = ephePath;
    }

    private static normalize360(value: number): number {
        return ((value % 360) + 360) % 360;
    }

    private static normalize180(value: number): number {
        const n = EphemerisService.normalize360(value);
        return n > 180 ? n - 360 : n;
    }

    private static gmstDegrees(jdUt: number): number {
        const t = (jdUt - 2451545.0) / 36525.0;
        const gmst =
            280.46061837 +
            360.98564736629 * (jdUt - 2451545.0) +
            0.000387933 * t * t -
            (t * t * t) / 38710000.0;
        return EphemerisService.normalize360(gmst);
    }

    private getPlanetRaDecl(jd: number, planetId: number): { raDeg: number; declDeg: number } | null {
        const equatorialFlag = this.swe.SEFLG_SWIEPH | this.swe.SEFLG_SPEED | this.swe.SEFLG_EQUATORIAL;
        try {
            const result = this.swe.calc_ut(jd, planetId, equatorialFlag);
            const ra = Array.isArray(result)
                ? result[0]
                : (result?.rightAscension ?? result?.ra ?? (result && typeof result === 'object' ? result[0] : undefined));
            const decl = Array.isArray(result)
                ? result[1]
                : (result?.declination ?? result?.decl ?? (result && typeof result === 'object' ? result[1] : undefined));
            if (!Number.isFinite(ra) || !Number.isFinite(decl)) {
                return null;
            }
            return {
                raDeg: EphemerisService.normalize360(ra),
                declDeg: decl,
            };
        } catch {
            return null;
        }
    }

    async getAstrocartographyLines(birthData: {
        date: string;
        time: string;
        latitude: number;
        longitude: number;
        timezone: string;
    }): Promise<AstrocartographyLine[]> {
        await this.initialize();

        const zone = birthData.timezone?.trim() || 'UTC';
        const localDt = DateTime.fromISO(`${birthData.date}T${birthData.time}`, { zone });
        const utcDt = localDt.toUTC();

        const jd = this.swe.julday(
            utcDt.year,
            utcDt.month,
            utcDt.day,
            utcDt.hour + utcDt.minute / 60 + (utcDt.second || 0) / 3600
        );

        const gmstDeg = EphemerisService.gmstDegrees(jd);

        const PLANETS: Array<{ id: number; name: string }> = [
            { id: this.swe.SE_SUN, name: 'Sun' },
            { id: this.swe.SE_MOON, name: 'Moon' },
            { id: this.swe.SE_MERCURY, name: 'Mercury' },
            { id: this.swe.SE_VENUS, name: 'Venus' },
            { id: this.swe.SE_MARS, name: 'Mars' },
            { id: this.swe.SE_JUPITER, name: 'Jupiter' },
            { id: this.swe.SE_SATURN, name: 'Saturn' },
            { id: this.swe.SE_URANUS, name: 'Uranus' },
            { id: this.swe.SE_NEPTUNE, name: 'Neptune' },
            { id: this.swe.SE_PLUTO, name: 'Pluto' },
            { id: this.swe.SE_CHIRON, name: 'Chiron' },
            { id: this.swe.SE_TRUE_NODE, name: 'North Node' },
        ];

        const lines: AstrocartographyLine[] = [];

        for (const p of PLANETS) {
            const eq = this.getPlanetRaDecl(jd, p.id);
            if (!eq) {
                continue;
            }

            const mcLon = EphemerisService.normalize180(eq.raDeg - gmstDeg);
            const icLon = EphemerisService.normalize180(mcLon + 180);

            lines.push({
                id: `${p.name}-MC`,
                planet: p.name,
                angle: 'MC',
                coordinates: [
                    { lon: mcLon, lat: -85 },
                    { lon: mcLon, lat: 85 },
                ],
            });

            lines.push({
                id: `${p.name}-IC`,
                planet: p.name,
                angle: 'IC',
                coordinates: [
                    { lon: icLon, lat: -85 },
                    { lon: icLon, lat: 85 },
                ],
            });

            const declRad = (eq.declDeg * Math.PI) / 180;
            const tanDecl = Math.tan(declRad);
            if (Math.abs(tanDecl) < 1e-6) {
                continue;
            }

            const ascCoords: AstrocartographyLinePoint[] = [];
            const dscCoords: AstrocartographyLinePoint[] = [];

            for (let lon = -180; lon <= 180; lon += 2) {
                const lst = EphemerisService.normalize360(gmstDeg + lon);
                const hourAngle = EphemerisService.normalize180(lst - eq.raDeg);
                const hourAngleRad = (hourAngle * Math.PI) / 180;
                const latRad = Math.atan(-Math.cos(hourAngleRad) / tanDecl);
                const lat = (latRad * 180) / Math.PI;

                if (!Number.isFinite(lat) || Math.abs(lat) > 89) {
                    continue;
                }

                if (Math.sin(hourAngleRad) < 0) {
                    ascCoords.push({ lon, lat });
                } else {
                    dscCoords.push({ lon, lat });
                }
            }

            if (ascCoords.length >= 2) {
                lines.push({
                    id: `${p.name}-ASC`,
                    planet: p.name,
                    angle: 'ASC',
                    coordinates: ascCoords,
                });
            }

            if (dscCoords.length >= 2) {
                lines.push({
                    id: `${p.name}-DSC`,
                    planet: p.name,
                    angle: 'DSC',
                    coordinates: dscCoords,
                });
            }
        }

        return lines;
    }

    public static getInstance(): EphemerisService {
        if (!EphemerisService.instance) {
            const modules = (window as any).LunaCcoData?.modules || {};
            const astroData = modules['luna-astrohd'] || {};
            const ephePath = astroData.assets?.ephePath || 'assets/ephe/';
            EphemerisService.instance = new EphemerisService(ephePath);
        }
        return EphemerisService.instance;
    }

    async initialize() {
        if (this.swe) {
            return;
        }

        try {
            console.log("Initializing Swiss Ephemeris...");
            const sweInstance = new SwissEph();
            await sweInstance.initSwissEph();
            this.swe = sweInstance;
            
            // Set the search path for ephemeris files to the root of the virtual FS
            if (this.swe.set_ephe_path) {
                // We use both '/' and '.' to ensure maximum compatibility with different WASM builds
                this.swe.set_ephe_path('/:.:sweph/');
                console.log("Swiss Ephemeris path set to '/:.:sweph/'");
            }
            
            console.log("Swiss Ephemeris WASM Initialized");
        } catch (error) {
            // Ensure we don't keep a half-initialized instance around
            this.swe = null;
            console.error("Failed to initialize Swiss Ephemeris:", error);
            throw error;
        }
    }

    /**
     * Fetch and load ephemeris files into the WASM virtual filesystem.
     * @param fileNames List of files to load (e.g. ['seas_18.se1', 'ast7/se07782s.se1'])
     */
    async ensureEphemerisFiles(fileNames: string[]) {
        await this.initialize();
        
        // swisseph-wasm 0.0.4 stores the Emscripten module in SweModule
        const sweModule = this.swe.SweModule || this.swe.module || this.swe.Module || this.swe;
        const FS = sweModule.FS;

        if (!FS) {
            console.warn("SwissEph FS not available on swe instance or SweModule. Available keys:", Object.keys(this.swe), "Module keys:", sweModule ? Object.keys(sweModule) : 'none');
            return;
        }

        for (const fileName of fileNames) {
            if (this.loadedFiles.has(fileName)) continue;

            try {
                const url = `${this.ephePath}${fileName}`;
                console.log(`Fetching ephemeris file: ${url}`);
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${fileName}: ${response.statusText}`);
                }
                const buffer = await response.arrayBuffer();
                const data = new Uint8Array(buffer);

                // Write to root of virtual FS
                const virtualFileName = fileName.includes('/') ? fileName.split('/').pop()! : fileName;
                FS.writeFile('/' + virtualFileName, data);
                this.loadedFiles.add(fileName);
                console.log(`Loaded ${fileName} into WASM FS as /${virtualFileName}`);
            } catch (error) {
                console.error(`Error loading ephemeris file ${fileName}:`, error);
                try {
                    const files = (this.swe as any).FS.readdir('/');
                    console.log("Current virtual FS root contents:", files);
                } catch (e) {}
            }
        }
    }

    async getAsteroidsData(birthData: any, selectedNames?: string[]): Promise<any[]> {
        await this.initialize();

        const zone = birthData.timezone || 'UTC';
        const birthDt = DateTime.fromISO(`${birthData.date}T${birthData.time}`, { zone }).toUTC();
        const birthJd = this.swe.julday(
            birthDt.year, birthDt.month, birthDt.day,
            birthDt.hour + birthDt.minute / 60 + (birthDt.second || 0) / 3600
        );

        // Calculate Design Date (approx 88 days before birth, based on sun position)
        const natalSun = this.calculatePlanet(birthJd, this.swe.SE_SUN);
        if (!natalSun) throw new Error("Could not calculate natal sun for design date.");
        const designInfo = this.calculateDesignDate(birthDt, natalSun.longitude);
        const designJd = designInfo.jd;

        const lat = parseFloat(birthData.lat || birthData.latitude || '0');
        const lng = parseFloat(birthData.lng || birthData.longitude || '0');
        
        // Natal and Design ASMCs for house calculations
        const natalAsmc = this.calculateAsmc(birthJd, lat, lng);
        const natalAsc = natalAsmc ? natalAsmc[0] : null;
        
        const designAsmc = this.calculateAsmc(designJd, lat, lng);
        const designAsc = designAsmc ? designAsmc[0] : null;

        const SE_AST_OFFSET = this.swe.SE_AST_OFFSET || 10000;

        // Base 4 + Pholus (Chiron excluded as it is in main charts)
        const BASE_ASTEROIDS = [
            { id: this.swe.SE_CERES, name: 'Ceres', symbol: '⚳', file: 'seas_18.se1' },
            { id: this.swe.SE_PALLAS, name: 'Pallas', symbol: '⚴', file: 'seas_18.se1' },
            { id: this.swe.SE_JUNO, name: 'Juno', symbol: '⚵', file: 'seas_18.se1' },
            { id: this.swe.SE_VESTA, name: 'Vesta', symbol: '⚶', file: 'seas_18.se1' },
            { id: this.swe.SE_PHOLUS, name: 'Pholus', symbol: 'P', file: 'seas_18.se1' },
        ];

        // Numbered asteroids from CSV
        const CSV_ASTEROIDS = [
            { num: 7, name: "Iris" }, { num: 10, name: "Hygiea" }, { num: 16, name: "Psyche" },
            { num: 18, name: "Melpomene" }, { num: 19, name: "Fortuna" }, { num: 24, name: "Themis" },
            { num: 30, name: "Urania" }, { num: 32, name: "Pomona" }, { num: 34, name: "Circe" },
            { num: 37, name: "Fides" }, { num: 41, name: "Daphne" }, { num: 42, name: "Isis" },
            { num: 60, name: "Echo" }, { num: 71, name: "Niobe" }, { num: 72, name: "Feronia" },
            { num: 76, name: "Freia" }, { num: 84, name: "Klio" }, { num: 94, name: "Aurora" },
            { num: 100, name: "Hekate" }, { num: 105, name: "Artemis" }, { num: 109, name: "Felicitas" },
            { num: 114, name: "Kassandra" }, { num: 120, name: "Lachesis" }, { num: 125, name: "Liberatrix" },
            { num: 128, name: "Nemesis" }, { num: 130, name: "Elektra" }, { num: 151, name: "Abundantia" },
            { num: 154, name: "Bertha" }, { num: 168, name: "Sibylla" }, { num: 181, name: "Eucharis" },
            { num: 212, name: "Medea" }, { num: 251, name: "Sophia" }, { num: 258, name: "Tyche" },
            { num: 318, name: "Magdalena" }, { num: 355, name: "Gabriella" }, { num: 361, name: "Bona" },
            { num: 399, name: "Hades" }, { num: 408, name: "Fama" }, { num: 430, name: "Hybris" },
            { num: 432, name: "Pythia" }, { num: 433, name: "Eros" }, { num: 443, name: "Photographica" },
            { num: 533, name: "Damocles" }, { num: 588, name: "Achilles" }, { num: 627, name: "Charis" },
            { num: 638, name: "Moira" }, { num: 679, name: "Pax" }, { num: 708, name: "Raphaela" },
            { num: 896, name: "Sphinx" }, { num: 1009, name: "Sirene" }, { num: 1027, name: "Aesculapia" },
            { num: 1046, name: "Copia" }, { num: 1108, name: "Demeter" }, { num: 1144, name: "Pecunia" },
            { num: 1198, name: "Atlantis" }, { num: 1482, name: "Hypnos" }, { num: 1488, name: "Aura" },
            { num: 1862, name: "Apollo" }, { num: 1866, name: "Sisyphus" }, { num: 1912, name: "Anubis" },
            { num: 1924, name: "Horus" }, { num: 1930, name: "Lucifer" }, { num: 1981, name: "Midas" },
            { num: 2063, name: "Bacchus" }, { num: 2102, name: "Tantalus" }, { num: 2415, name: "Ganesa" },
            { num: 2598, name: "Merlin" }, { num: 2696, name: "Magion" }, { num: 2847, name: "Parvati" },
            { num: 2878, name: "Panacea" }, { num: 3063, name: "Makhaon" }, { num: 3264, name: "Bounty" },
            { num: 3267, name: "Glo" }, { num: 3402, name: "Wisdom" }, { num: 3412, name: "Kafka" },
            { num: 3938, name: "Opportunity" }, { num: 3941, name: "Angst" }, { num: 4227, name: "Kaali" },
            { num: 4255, name: "Spacewatch" }, { num: 4580, name: "Child" }, { num: 4679, name: "Sybil" },
            { num: 4955, name: "Gold" }, { num: 5239, name: "Reiki" }, { num: 5264, name: "Telephus" },
            { num: 5325, name: "Silver" }, { num: 5881, name: "Akashi" }, { num: 6583, name: "Destinn" },
            { num: 7782, name: "Mony" }, { num: 10199, name: "Chariklo" }, { num: 11911, name: "Angel" },
            { num: 27719, name: "Fast" }, { num: 33154, name: "Talent" }, { num: 37452, name: "Spirit" },
            { num: 39382, name: "Opportunity" }, { num: 48575, name: "Hawaii/Lemuria" }, { num: 55555, name: "DNA" },
            { num: 58534, name: "Logos/Persuasia" }, { num: 69230, name: "Hermes" }, { num: 90377, name: "Sedna" },
            { num: 92891, name: "Bless" }, { num: 127936, name: "Maia" }, { num: 136199, name: "Eris" },
            { num: 136472, name: "Makemake" }, { num: 215463, name: "Jobse" },
        ];

        let ALL_WORK: any[] = [
            ...BASE_ASTEROIDS.map(a => ({ ...a, file: 'seas_18.se1' })),
            ...CSV_ASTEROIDS.map(a => ({
                id: SE_AST_OFFSET + a.num,
                name: a.name,
                symbol: a.name[0],
                file: this.getAsteroidFileName(a.num)
            }))
        ];

        if (selectedNames && selectedNames.length > 0) {
            ALL_WORK = ALL_WORK.filter(a => selectedNames.includes(a.name));
        }

        // Unique files to ensure loaded
        const filesToLoad = Array.from(new Set(ALL_WORK.map(w => w.file)));
        await this.ensureEphemerisFiles(filesToLoad);

        const results = [];
        for (const ast of ALL_WORK) {
            // Personality calculation
            const natalPos = this.calculatePlanet(birthJd, ast.id);
            // Design calculation
            const designPos = this.calculatePlanet(designJd, ast.id);

            if (natalPos || designPos) {
                const natalAct = natalPos ? HumanDesignLogic.calculateActivation(natalPos.longitude) : null;
                const designAct = designPos ? HumanDesignLogic.calculateActivation(designPos.longitude) : null;

                results.push({
                    name: ast.name,
                    symbol: ast.symbol,
                    personality: natalPos ? {
                        longitude: natalPos.longitude,
                        sign: natalAct?.sign,
                        house: this.getWholeSignHouse(natalPos.longitude, natalAsc),
                        gate: natalAct?.gate,
                        line: natalAct?.line,
                        color: natalAct?.color,
                        tone: natalAct?.tone,
                        base: natalAct?.base,
                        isRetrograde: natalPos.speed < 0
                    } : null,
                    design: designPos ? {
                        longitude: designPos.longitude,
                        sign: designAct?.sign,
                        house: this.getWholeSignHouse(designPos.longitude, designAsc),
                        gate: designAct?.gate,
                        line: designAct?.line,
                        color: designAct?.color,
                        tone: designAct?.tone,
                        base: designAct?.base,
                        isRetrograde: designPos.speed < 0
                    } : null
                });
            }
        }

        return results;
    }

    private getAsteroidFileName(num: number): string {
        const thousand = Math.floor(num / 1000);
        if (num >= 100000) {
            return `ast${thousand}/s${num}s.se1`;
        }
        const padded = num.toString().padStart(5, '0');
        return `ast${thousand}/se${padded}s.se1`;
    }

    public getWholeSignHouse(planetLong: number, asc: number | null): number | undefined {
        if (asc === null) return undefined;
        const ascSign = Math.floor(asc / 30);
        const planetSign = Math.floor(planetLong / 30);
        return ((planetSign - ascSign + 12) % 12) + 1;
    }

    async getTransitAsteroidsData(selectedNames?: string[]): Promise<any[]> {
        await this.initialize();
        const now = DateTime.now().toUTC();
        const jd = this.swe.julday(now.year, now.month, now.day, now.hour + now.minute / 60);

        // We only need the list of asteroids here
        const CSV_ASTEROIDS = [
            { num: 7, name: "Iris" }, { num: 10, name: "Hygiea" }, { num: 16, name: "Psyche" },
            { num: 18, name: "Melpomene" }, { num: 19, name: "Fortuna" }, { num: 24, name: "Themis" },
            { num: 30, name: "Urania" }, { num: 32, name: "Pomona" }, { num: 34, name: "Circe" },
            { num: 37, name: "Fides" }, { num: 41, name: "Daphne" }, { num: 42, name: "Isis" },
            { num: 60, name: "Echo" }, { num: 71, name: "Niobe" }, { num: 72, name: "Feronia" },
            { num: 76, name: "Freia" }, { num: 84, name: "Klio" }, { num: 94, name: "Aurora" },
            { num: 100, name: "Hekate" }, { num: 105, name: "Artemis" }, { num: 109, name: "Felicitas" },
            { num: 114, name: "Kassandra" }, { num: 120, name: "Lachesis" }, { num: 125, name: "Liberatrix" },
            { num: 128, name: "Nemesis" }, { num: 130, name: "Elektra" }, { num: 151, name: "Abundantia" },
            { num: 154, name: "Bertha" }, { num: 168, name: "Sibylla" }, { num: 181, name: "Eucharis" },
            { num: 212, name: "Medea" }, { num: 251, name: "Sophia" }, { num: 258, name: "Tyche" },
            { num: 318, name: "Magdalena" }, { num: 355, name: "Gabriella" }, { num: 361, name: "Bona" },
            { num: 399, name: "Hades" }, { num: 408, name: "Fama" }, { num: 430, name: "Hybris" },
            { num: 432, name: "Pythia" }, { num: 433, name: "Eros" }, { num: 443, name: "Photographica" },
            { num: 533, name: "Damocles" }, { num: 588, name: "Achilles" }, { num: 627, name: "Charis" },
            { num: 638, name: "Moira" }, { num: 679, name: "Pax" }, { num: 708, name: "Raphaela" },
            { num: 896, name: "Sphinx" }, { num: 1009, name: "Sirene" }, { num: 1027, name: "Aesculapia" },
            { num: 1046, name: "Copia" }, { num: 1108, name: "Demeter" }, { num: 1144, name: "Pecunia" },
            { num: 1198, name: "Atlantis" }, { num: 1482, name: "Hypnos" }, { num: 1488, name: "Aura" },
            { num: 1862, name: "Apollo" }, { num: 1866, name: "Sisyphus" }, { num: 1912, name: "Anubis" },
            { num: 1924, name: "Horus" }, { num: 1930, name: "Lucifer" }, { num: 1981, name: "Midas" },
            { num: 2063, name: "Bacchus" }, { num: 2102, name: "Tantalus" }, { num: 2415, name: "Ganesa" },
            { num: 2598, name: "Merlin" }, { num: 2696, name: "Magion" }, { num: 2847, name: "Parvati" },
            { num: 2878, name: "Panacea" }, { num: 3063, name: "Makhaon" }, { num: 3264, name: "Bounty" },
            { num: 3267, name: "Glo" }, { num: 3402, name: "Wisdom" }, { num: 3412, name: "Kafka" },
            { num: 3938, name: "Opportunity" }, { num: 3941, name: "Angst" }, { num: 4227, name: "Kaali" },
            { num: 4255, name: "Spacewatch" }, { num: 4580, name: "Child" }, { num: 4679, name: "Sybil" },
            { num: 4955, name: "Gold" }, { num: 5239, name: "Reiki" }, { num: 5264, name: "Telephus" },
            { num: 5325, name: "Silver" }, { num: 5881, name: "Akashi" }, { num: 6583, name: "Destinn" },
            { num: 7782, name: "Mony" }, { num: 10199, name: "Chariklo" }, { num: 11911, name: "Angel" },
            { num: 27719, name: "Fast" }, { num: 33154, name: "Talent" }, { num: 37452, name: "Spirit" },
            { num: 39382, name: "Opportunity" }, { num: 48575, name: "Hawaii/Lemuria" }, { num: 55555, name: "DNA" },
            { num: 58534, name: "Logos/Persuasia" }, { num: 69230, name: "Hermes" }, { num: 90377, name: "Sedna" },
            { num: 92891, name: "Bless" }, { num: 127936, name: "Maia" }, { num: 136199, name: "Eris" },
            { num: 136472, name: "Makemake" }, { num: 215463, name: "Jobse" },
        ];

        const SE_AST_OFFSET = this.swe.SE_AST_OFFSET || 10000;
        // Base 4 + Pholus
        const BASE_ASTEROIDS = [
            { id: this.swe.SE_CERES, name: 'Ceres', symbol: '⚳', file: 'seas_18.se1' },
            { id: this.swe.SE_PALLAS, name: 'Pallas', symbol: '⚴', file: 'seas_18.se1' },
            { id: this.swe.SE_JUNO, name: 'Juno', symbol: '⚵', file: 'seas_18.se1' },
            { id: this.swe.SE_VESTA, name: 'Vesta', symbol: '⚶', file: 'seas_18.se1' },
            { id: this.swe.SE_PHOLUS, name: 'Pholus', symbol: 'P', file: 'seas_18.se1' },
        ];

        let ALL_WORK = [
            ...BASE_ASTEROIDS,
            ...CSV_ASTEROIDS.map(a => ({ id: SE_AST_OFFSET + a.num, name: a.name, symbol: a.name[0], file: this.getAsteroidFileName(a.num) }))
        ];

        if (selectedNames && selectedNames.length > 0) {
            ALL_WORK = ALL_WORK.filter(a => selectedNames.includes(a.name));
        }

        const results = [];
        for (const ast of ALL_WORK) {
            const pos = this.calculatePlanet(jd, ast.id);
            if (pos) {
                const act = HumanDesignLogic.calculateActivation(pos.longitude);
                results.push({
                    name: ast.name,
                    symbol: ast.symbol,
                    personality: {
                        longitude: pos.longitude,
                        sign: act.sign,
                        gate: act.gate,
                        line: act.line,
                        isRetrograde: pos.speed < 0
                    },
                    design: null
                });
            }
        }
        return results;
    }

    private getZodiacSign(longitude: number): string {
        const signs = [
            'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
            'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
        ];
        let index = Math.floor(longitude / 30);
        if (index < 0 || index > 11) {
            index = ((index % 12) + 12) % 12;
        }
        return signs[index];
    }

    formatDegrees(decimalDegrees: number): string {
        const inSignDegrees = decimalDegrees % 30;
        let degrees = Math.floor(inSignDegrees);

        const totalMinutes = (inSignDegrees - degrees) * 60;
        let minutes = Math.floor(totalMinutes);
        let seconds = Math.round((totalMinutes - minutes) * 60);

        if (seconds === 60) {
            seconds = 0;
            minutes++;
        }
        if (minutes === 60) {
            minutes = 0;
            degrees++;
        }

        return `${degrees}°${minutes.toString().padStart(2, '0')}'${seconds.toString().padStart(2, '0')}"`;
    }

    /**
     * Compute Asc / MC / related angles using high-level swe.houses_ex,
     * following the pattern from birth-chart.js / debug_houses.js.
     * Returns ascmc[0..3] (Asc, MC, ARMC, Vertex) or null on failure.
     */
    private calculateAsmc(jd: number, lat: number, lng: number): number[] | null {
        if (!this.swe) return null;

        const hsysCode = 'P'; // Placidus
        const iflag = 0;

        try {
            // In swisseph-wasm 0.0.4+, houses_ex returns an object { cusps, ascmc }
            // instead of modifying arguments and returning a code.
            const result = this.swe.houses_ex(jd, iflag, lat, lng, hsysCode);
            
            if (result && result.ascmc) {
                return [result.ascmc[0], result.ascmc[1], result.ascmc[2], result.ascmc[3]];
            }

            // Fallback for older versions or different wrapper behavior
            const cusps = new Float64Array(13);
            const ascmc = new Float64Array(10);
            const ret = this.swe.houses_ex(jd, iflag, lat, lng, hsysCode, cusps, ascmc);
            if (ret >= 0 || (ascmc[0] !== 0 || ascmc[1] !== 0)) {
                return [ascmc[0], ascmc[1], ascmc[2], ascmc[3]];
            }
            
            return null;
        } catch (e) {
            console.error('Error in calculateAsmc:', e);
            return null;
        }
    }

    private calculatePlanet(jd: number, planetId: number): { longitude: number; speed: number } | null {
        // Try SWIEPH first for high precision (arcsecond accuracy needed for Variables).
        // SEFLG_SPEED calculates speed, which improves position accuracy for fast movers like Moon.
        const swiphFlag = this.swe.SEFLG_SWIEPH | this.swe.SEFLG_SPEED;

        try {
            const result = this.swe.calc_ut(jd, planetId, swiphFlag);
            const lon = result?.[0];
            const speed = (result?.length >= 4) ? result[3] : (result?.longitudeSpeed ?? result?.speed ?? 0);
            if (Number.isFinite(lon)) {
                return { longitude: lon, speed: Number.isFinite(speed) ? speed : 0 };
            }
            // If SWIEPH returns non-finite, fall through to MOSEPH
            console.warn('Swiss Ephemeris SWIEPH returned non-finite, trying MOSEPH fallback', { jd, planetId });
        } catch (error) {
            // SWIEPH failed, try MOSEPH as fallback
            console.warn('Swiss Ephemeris SWIEPH failed, trying MOSEPH fallback', { jd, planetId, error });
        }

        // Fallback to Moshier ephemeris (built-in, no external files needed)
        // Slightly less accurate (~1 arcsecond vs 0.001 for SWIEPH) but reliable
        const mosephFlag = this.swe.SEFLG_MOSEPH | this.swe.SEFLG_SPEED;
        try {
            const result = this.swe.calc_ut(jd, planetId, mosephFlag);
            const lon = result?.[0];
            const speed = (result?.length >= 4) ? result[3] : (result?.longitudeSpeed ?? result?.speed ?? 0);
            if (!Number.isFinite(lon)) {
                console.error('Swiss Ephemeris MOSEPH also returned non-finite longitude', { jd, planetId, result });
                return null;
            }
            return { longitude: lon, speed: Number.isFinite(speed) ? speed : 0 };
        } catch (error) {
            console.error('Swiss Ephemeris calc_ut failed with both SWIEPH and MOSEPH', { jd, planetId, error });
            return null;
        }
    }

    calculateDesignDate(birthUtc: DateTime, birthSunLongitude: number): { date: DateTime, jd: number } {
        let targetSun = birthSunLongitude - 88.0;
        if (targetSun < 0) targetSun += 360;

        let designDate = birthUtc.minus({ days: 88 });
        let jd = 0;

        for (let i = 0; i < 5; i++) {
            jd = this.swe.julday(designDate.year, designDate.month, designDate.day,
                designDate.hour + designDate.minute / 60 + (designDate.second || 0) / 3600);

            const currentSun = this.calculatePlanet(jd, this.swe.SE_SUN);
            if (currentSun === null) {
                console.error('Swiss Ephemeris failed to calculate Sun position for design date', {
                    jd,
                    designDate: designDate.toISO(),
                });
                break;
            }

            let diff = targetSun - currentSun.longitude;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;

            if (Math.abs(diff) < 0.0001) break;

            designDate = designDate.plus({ days: diff });
        }

        return { date: designDate, jd };
    }

    /**
     * Calculate raw astrological birth data: planet positions + ascendant/MC.
     * Used by the AstroWheel component (not HD-specific).
     */
    async getAstroBirthData(birthData: {
        date: string;
        time: string;
        latitude: number;
        longitude: number;
        timezone: string;
    }): Promise<{
        planets: Array<{ name: string; symbol: string; longitude: number; speed: number; isRetrograde: boolean; sign: string; signSymbol: string; degree: string }>;
        ascendant: number | null;
        mc: number | null;
        vertex: number | null;
    }> {
        await this.initialize();

        const ZODIAC = [
            { name: 'Aries', symbol: '♈' }, { name: 'Taurus', symbol: '♉' },
            { name: 'Gemini', symbol: '♊' }, { name: 'Cancer', symbol: '♋' },
            { name: 'Leo', symbol: '♌' }, { name: 'Virgo', symbol: '♍' },
            { name: 'Libra', symbol: '♎' }, { name: 'Scorpio', symbol: '♏' },
            { name: 'Sagittarius', symbol: '♐' }, { name: 'Capricorn', symbol: '♑' },
            { name: 'Aquarius', symbol: '♒' }, { name: 'Pisces', symbol: '♓' },
        ];
        const PLANET_SYMS: Record<string, string> = {
            Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
            Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
            Chiron: '⚷', 'North Node': '☊', 'South Node': '☋', 'Black Moon Lilith': '⚸',
        };

        const zone = birthData.timezone?.trim() || 'UTC';
        const localDt = DateTime.fromISO(`${birthData.date}T${birthData.time}`, { zone });
        const utcDt = localDt.toUTC();

        const jd = this.swe.julday(
            utcDt.year, utcDt.month, utcDt.day,
            utcDt.hour + utcDt.minute / 60 + (utcDt.second || 0) / 3600
        );

        // Ascendant / MC
        const asmc = this.calculateAsmc(jd, birthData.latitude, birthData.longitude);
        const ascendant = asmc ? asmc[0] : null;
        const mc = asmc ? asmc[1] : null;
        const vertex = asmc ? asmc[3] : null;

        const PLANET_IDS = [
            { id: this.swe.SE_SUN, name: 'Sun' },
            { id: this.swe.SE_MOON, name: 'Moon' },
            { id: this.swe.SE_MERCURY, name: 'Mercury' },
            { id: this.swe.SE_VENUS, name: 'Venus' },
            { id: this.swe.SE_MARS, name: 'Mars' },
            { id: this.swe.SE_JUPITER, name: 'Jupiter' },
            { id: this.swe.SE_SATURN, name: 'Saturn' },
            { id: this.swe.SE_URANUS, name: 'Uranus' },
            { id: this.swe.SE_NEPTUNE, name: 'Neptune' },
            { id: this.swe.SE_PLUTO, name: 'Pluto' },
            { id: this.swe.SE_CHIRON, name: 'Chiron' },
            { id: this.swe.SE_TRUE_NODE, name: 'North Node' },
            { id: this.swe.SE_MEAN_APOG, name: 'Black Moon Lilith' },
            { id: this.swe.SE_VULCAN !== undefined ? this.swe.SE_VULCAN : 55, name: 'Vulcan' },
        ];

        const flag = this.swe.SEFLG_SWIEPH | this.swe.SEFLG_SPEED;
        const planets: Array<{ name: string; symbol: string; longitude: number; speed: number; isRetrograde: boolean; sign: string; signSymbol: string; degree: string }> = [];

        // Ensure necessary ephemeris files are loaded
        await this.ensureEphemerisFiles(['seas_18.se1', 'semo_18.se1', 'sepl_18.se1']);

        for (const p of PLANET_IDS) {
            try {
                const res = this.swe.calc_ut(jd, p.id, flag);
                const lon = Array.isArray(res)
                    ? res[0]
                    : (res?.longitude ?? (res && typeof res === 'object' ? res[0] : undefined));
                const spd = Array.isArray(res)
                    ? (res[3] ?? 0)
                    : (res?.longitudeSpeed ?? res?.speed ?? (res && typeof res === 'object' ? (res[3] ?? 0) : 0));
                if (!Number.isFinite(lon)) continue;

                const signIdx = Math.floor(((lon % 360) + 360) % 360 / 30);
                const sign = ZODIAC[signIdx];
                const inSign = ((lon % 30) + 30) % 30;
                const deg = Math.floor(inSign);
                const min = Math.floor((inSign - deg) * 60);

                planets.push({
                    name: p.name,
                    symbol: PLANET_SYMS[p.name] ?? p.name[0],
                    longitude: ((lon % 360) + 360) % 360,
                    speed: spd,
                    isRetrograde: spd < 0,
                    sign: sign.name,
                    signSymbol: sign.symbol,
                    degree: `${deg}°${String(min).padStart(2, '0')}'`,
                });
            } catch {
                // skip failed planets
            }
        }

        const sun = planets.find((p) => p.name === 'Sun');
        if (sun) {
            const earthLon = (sun.longitude + 180) % 360;
            const signIdx = Math.floor(earthLon / 30);
            const sign = ZODIAC[signIdx];
            const inSign = earthLon % 30;
            const deg = Math.floor(inSign);
            const min = Math.floor((inSign - deg) * 60);

            planets.push({
                name: 'Earth',
                symbol: '♁',
                longitude: earthLon,
                speed: sun.speed,
                isRetrograde: sun.isRetrograde,
                sign: sign.name,
                signSymbol: sign.symbol,
                degree: `${deg}°${String(min).padStart(2, '0')}'`,
            });
        }

        const northNode = planets.find((p) => p.name === 'North Node');
        if (northNode) {
            const southNodeLon = (northNode.longitude + 180) % 360;
            const southNodeSignIdx = Math.floor(((southNodeLon % 360) + 360) % 360 / 30);
            const southNodeSign = ZODIAC[southNodeSignIdx];
            const inSign = ((southNodeLon % 30) + 30) % 30;
            const deg = Math.floor(inSign);
            const min = Math.floor((inSign - deg) * 60);

            planets.push({
                name: 'South Node',
                symbol: PLANET_SYMS['South Node'],
                longitude: ((southNodeLon % 360) + 360) % 360,
                speed: -northNode.speed,
                isRetrograde: -northNode.speed < 0,
                sign: southNodeSign.name,
                signSymbol: southNodeSign.symbol,
                degree: `${deg}°${String(min).padStart(2, '0')}'`,
            });
        }

        return { planets, ascendant, mc, vertex };
    }

    private calculateHouses(jd: number, lat: number, lng: number, hsysCode = 'P'): { ascmc: number[] | null, cusps: number[] | null } {
        if (!this.swe) return { ascmc: null, cusps: null };

        const iflag = 0;

        try {
            const result = this.swe.houses_ex(jd, iflag, lat, lng, hsysCode);
            
            if (result && result.ascmc && result.cusps) {
                return {
                    ascmc: [result.ascmc[0], result.ascmc[1], result.ascmc[2], result.ascmc[3]],
                    cusps: Array.from(result.cusps) as number[]
                };
            }

            // Fallback for older versions or different wrapper behavior
            const cusps = new Float64Array(13);
            const ascmc = new Float64Array(10);
            const ret = this.swe.houses_ex(jd, iflag, lat, lng, hsysCode, cusps, ascmc);
            if (ret >= 0 || (ascmc[0] !== 0 || ascmc[1] !== 0)) {
                return {
                    ascmc: [ascmc[0], ascmc[1], ascmc[2], ascmc[3]],
                    cusps: Array.from(cusps)
                };
            }
            
            return { ascmc: null, cusps: null };
        } catch (e) {
            console.error('Error in calculateHouses:', e);
            return { ascmc: null, cusps: null };
        }
    }

    /**
     * Map our house-system keys to Swiss Ephemeris hsys codes. Only quadrant
     * systems that need real cusp calculation are listed; 'whole_house' is
     * handled separately (sign-based, no cusps).
     */
    private hsysCodeFor(houseSystem: string): string {
        switch (houseSystem) {
            case 'koch': return 'K';
            case 'placidus':
            default: return 'P';
        }
    }

    public getPlacidusHouse(planetLong: number, cusps: number[] | null): number | undefined {
        if (!cusps || cusps.length < 13) return undefined;
        const p = ((planetLong % 360) + 360) % 360;
        
        for (let i = 1; i <= 12; i++) {
            const start = ((cusps[i] % 360) + 360) % 360;
            const end = i === 12 
                ? ((cusps[1] % 360) + 360) % 360 
                : ((cusps[i + 1] % 360) + 360) % 360;
            
            if (start <= end) {
                if (p >= start && p < end) {
                    return i;
                }
            } else {
                // Spans across the 360/0 boundary
                if (p >= start || p < end) {
                    return i;
                }
            }
        }
        return 1; // Fallback
    }

    async getChartData(birthData: any): Promise<ChartData & { houseCusps?: number[], designHouseCusps?: number[], houseSystem?: string }> {
        await this.initialize();

        const zone = birthData.timezone && typeof birthData.timezone === 'string' && birthData.timezone.trim() !== ''
            ? birthData.timezone.trim()
            : 'UTC';

        const localDateTime = DateTime.fromISO(`${birthData.date}T${birthData.time}`, { zone });
        if (!localDateTime.isValid) {
            console.error('Invalid local date/time in getChartData', {
                date: birthData.date,
                time: birthData.time,
                timezone: zone,
                reason: localDateTime.invalidReason,
                explanation: localDateTime.invalidExplanation,
            });
            throw new Error('Invalid date, time, or timezone. Unable to calculate chart.');
        }

        const utcDateTime = localDateTime.toUTC();

        // Parse coordinates for house calculation
        const latStr = birthData.lat || birthData.latitude || '0';
        const lngStr = birthData.lng || birthData.longitude || '0';
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            console.error('Invalid latitude/longitude in getChartData', { latStr, lngStr });
            throw new Error('Invalid latitude or longitude. Unable to calculate chart.');
        }

        const houseSystem = birthData.houseSystem || 'whole_house';

        // 1. Birth JD
        const birthJd = this.swe.julday(utcDateTime.year, utcDateTime.month, utcDateTime.day,
            utcDateTime.hour + utcDateTime.minute / 60 + (utcDateTime.second || 0) / 3600);

        // 2. Calculate Ascendant and cusps for house calculation
        let birthCusps: number[] | null = null;
        let birthAsmc = null;
        if (houseSystem !== 'whole_house') {
            const result = this.calculateHouses(birthJd, lat, lng, this.hsysCodeFor(houseSystem));
            birthAsmc = result.ascmc;
            birthCusps = result.cusps;
        } else {
            birthAsmc = this.calculateAsmc(birthJd, lat, lng);
        }
        const ascLong = birthAsmc ? birthAsmc[0] : null;

        // Helper: Whole Sign House Calculation
        const getWholeSignHouse = (planetLong: number, asc: number | null): number | undefined => {
            if (asc === null) return undefined;
            const ascSign = Math.floor(asc / 30);
            const planetSign = Math.floor(planetLong / 30);
            return ((planetSign - ascSign + 12) % 12) + 1;
        };

        const getHouse = (planetLong: number, asc: number | null, cusps: number[] | null): number | undefined => {
            if (houseSystem !== 'whole_house') {
                // Placidus & Koch are both quadrant systems — same cusp lookup.
                return this.getPlacidusHouse(planetLong, cusps);
            } else {
                return getWholeSignHouse(planetLong, asc);
            }
        };

        // 3. Calculate Birth Planets
        const planetIds = [
            { id: this.swe.SE_SUN, name: 'Sun' },
            { id: this.swe.SE_MOON, name: 'Moon' },
            { id: this.swe.SE_TRUE_NODE, name: 'NorthNode' },
            { id: this.swe.SE_MERCURY, name: 'Mercury' },
            { id: this.swe.SE_VENUS, name: 'Venus' },
            { id: this.swe.SE_MARS, name: 'Mars' },
            { id: this.swe.SE_JUPITER, name: 'Jupiter' },
            { id: this.swe.SE_SATURN, name: 'Saturn' },
            { id: this.swe.SE_URANUS, name: 'Uranus' },
            { id: this.swe.SE_NEPTUNE, name: 'Neptune' },
            { id: this.swe.SE_PLUTO, name: 'Pluto' },
            { id: this.swe.SE_CHIRON, name: 'Chiron' },
            { id: this.swe.SE_MEAN_APOG, name: 'Black Moon Lilith' },
            { id: this.swe.SE_VULCAN !== undefined ? this.swe.SE_VULCAN : 55, name: 'Vulcan' },
        ];

        const birthActivations: Record<string, Activation> = {};
        
        // Ensure necessary ephemeris files are loaded (Chiron, Ceres, etc.)
        await this.ensureEphemerisFiles(['seas_18.se1']);

        planetIds.forEach(p => {
            const long = this.calculatePlanet(birthJd, p.id);
            if (long === null) {
                // Skip planets that fail to calculate instead of crashing the whole chart.
                return;
            }
            const activation = HumanDesignLogic.calculateActivation(long.longitude);
            activation.house = getHouse(long.longitude, ascLong, birthCusps);
            activation.isRetrograde = long.speed < 0;
            birthActivations[p.name] = activation;
        });

        const birthSunLong = birthActivations['Sun']?.longitude || 0;
        const birthNnLong = birthActivations['NorthNode']?.longitude || 0;

        // Add Earth (Opposite Sun)
        if (birthActivations['Sun']) {
            const birthSunLongVal = birthActivations['Sun'].longitude;
            const birthEarthLong = (birthSunLongVal + 180) % 360;
            const earthActivation = HumanDesignLogic.calculateActivation(birthEarthLong);
            earthActivation.house = getHouse(birthEarthLong, ascLong, birthCusps);
            earthActivation.isRetrograde = birthActivations['Sun'].isRetrograde;
            birthActivations['Earth'] = earthActivation;
        }

        // Add South Node (Opposite North Node)
        if (birthActivations['NorthNode']) {
            const birthNnLongVal = birthActivations['NorthNode'].longitude;
            const birthSnLong = (birthNnLongVal + 180) % 360;
            const snActivation = HumanDesignLogic.calculateActivation(birthSnLong);
            snActivation.house = getHouse(birthSnLong, ascLong, birthCusps);
            snActivation.isRetrograde = birthActivations['NorthNode'].isRetrograde;
            birthActivations['SouthNode'] = snActivation;
        }

        if (birthAsmc) {
            const asc = birthAsmc[0];
            const mc = birthAsmc[1];
            const vertex = birthAsmc[3];
            const ic = (mc + 180) % 360;
            const desc = (asc + 180) % 360;

            const crossPoints = [
                { name: 'Ascendant', long: asc },
                { name: 'Midheaven', long: mc },
                { name: 'Imum Coeli', long: ic },
                { name: 'Descendant', long: desc },
                { name: 'Vertex', long: vertex }
            ];

            crossPoints.forEach(p => {
                const act = HumanDesignLogic.calculateActivation(p.long);
                act.house = getHouse(p.long, ascLong, birthCusps);
                birthActivations[p.name] = act;
            });
        }

        // 4. Design Date & JD
        const { jd: designJd } = this.calculateDesignDate(utcDateTime, birthSunLong);

        // 5. Calculate Design Ascendant and cusps for design houses
        let designCusps: number[] | null = null;
        let designAsmc = null;
        if (houseSystem !== 'whole_house') {
            const result = this.calculateHouses(designJd, lat, lng, this.hsysCodeFor(houseSystem));
            designAsmc = result.ascmc;
            designCusps = result.cusps;
        } else {
            designAsmc = this.calculateAsmc(designJd, lat, lng);
        }
        const designAscLong = designAsmc ? designAsmc[0] : null;

        // 6. Design Planets
        const designActivations: Record<string, Activation> = {};

        planetIds.forEach(p => {
            const long = this.calculatePlanet(designJd, p.id);
            if (long === null) {
                return;
            }
            const activation = HumanDesignLogic.calculateActivation(long.longitude);
            activation.house = getHouse(long.longitude, designAscLong, designCusps);
            activation.isRetrograde = long.speed < 0;
            designActivations[p.name] = activation;
        });

        // Design Earth
        if (designActivations['Sun']) {
            const designSunLong = designActivations['Sun'].longitude;
            const designEarthLong = (designSunLong + 180) % 360;
            const designEarthActivation = HumanDesignLogic.calculateActivation(designEarthLong);
            designEarthActivation.house = getHouse(designEarthLong, designAscLong, designCusps);
            designEarthActivation.isRetrograde = designActivations['Sun'].isRetrograde;
            designActivations['Earth'] = designEarthActivation;
        }

        // Design South Node
        const designNnLong = designActivations['NorthNode'].longitude;
        const designSnLong = (designNnLong + 180) % 360;
        const designSnActivation = HumanDesignLogic.calculateActivation(designSnLong);
        designSnActivation.house = getHouse(designSnLong, designAscLong, designCusps);
        designSnActivation.isRetrograde = designActivations['NorthNode'].isRetrograde;
        designActivations['SouthNode'] = designSnActivation;

        if (designAsmc) {
            const asc = designAsmc[0];
            const mc = designAsmc[1];
            const vertex = designAsmc[3];
            const ic = (mc + 180) % 360;
            const desc = (asc + 180) % 360;

            const crossPoints = [
                { name: 'Ascendant', long: asc },
                { name: 'Midheaven', long: mc },
                { name: 'Imum Coeli', long: ic },
                { name: 'Descendant', long: desc },
                { name: 'Vertex', long: vertex }
            ];

            crossPoints.forEach(p => {
                const act = HumanDesignLogic.calculateActivation(p.long);
                act.house = getHouse(p.long, designAscLong, designCusps);
                designActivations[p.name] = act;
            });
        }

        // 7. Human Design Properties
        const properties = HumanDesignLogic.determineChartProperties(birthActivations, designActivations);
        return {
            ...properties,
            houseCusps: birthCusps ? Array.from(birthCusps) : undefined,
            designHouseCusps: designCusps ? Array.from(designCusps) : undefined,
            houseSystem
        };
    }

    async getTransitChartData(): Promise<any> {
        await this.initialize();
        const now = DateTime.now().toUTC();
        const jd = this.swe.julday(now.year, now.month, now.day, now.hour + now.minute / 60);
        const planetIds = [
            { id: this.swe.SE_SUN, name: 'Sun' },
            { id: this.swe.SE_MOON, name: 'Moon' },
            { id: this.swe.SE_TRUE_NODE, name: 'NorthNode' },
            { id: this.swe.SE_MERCURY, name: 'Mercury' },
            { id: this.swe.SE_VENUS, name: 'Venus' },
            { id: this.swe.SE_MARS, name: 'Mars' },
            { id: this.swe.SE_JUPITER, name: 'Jupiter' },
            { id: this.swe.SE_SATURN, name: 'Saturn' },
            { id: this.swe.SE_URANUS, name: 'Uranus' },
            { id: this.swe.SE_NEPTUNE, name: 'Neptune' },
            { id: this.swe.SE_PLUTO, name: 'Pluto' },
            { id: this.swe.SE_CHIRON, name: 'Chiron' },
            { id: this.swe.SE_MEAN_APOG, name: 'Black Moon Lilith' },
            { id: this.swe.SE_VULCAN !== undefined ? this.swe.SE_VULCAN : 55, name: 'Vulcan' },
        ];
        const birthActivations: Record<string, any> = {};
        planetIds.forEach(p => {
            const long = this.calculatePlanet(jd, p.id);
            if (long) {
                const act = HumanDesignLogic.calculateActivation(long.longitude);
                act.isRetrograde = long.speed < 0;
                birthActivations[p.name] = act;
            }
        });

        // Earth
        if (birthActivations['Sun']) {
            const earthLong = (birthActivations['Sun'].longitude + 180) % 360;
            const act = HumanDesignLogic.calculateActivation(earthLong);
            act.isRetrograde = birthActivations['Sun'].isRetrograde;
            birthActivations['Earth'] = act;
        }

        return { birthActivations, designActivations: {}, isTransit: true };
    }

    private getModality(longitude: number): string {
        const index = Math.floor(longitude / 30);
        const modalities = ['Cardinal', 'Fixed', 'Mutable'];
        // Aries (0) -> Cardinal, Taurus (1) -> Fixed, Gemini (2) -> Mutable, etc.
        return modalities[index % 3];
    }

    async calculateChart(birthData: any): Promise<string> {
        await this.initialize();

        const zone = birthData.timezone && typeof birthData.timezone === 'string' && birthData.timezone.trim() !== ''
            ? birthData.timezone.trim()
            : 'UTC';

        const localDateTime = DateTime.fromISO(`${birthData.date}T${birthData.time}`, { zone });
        if (!localDateTime.isValid) {
            console.error('Invalid local date/time in calculateChart', {
                date: birthData.date,
                time: birthData.time,
                timezone: zone,
                reason: localDateTime.invalidReason,
                explanation: localDateTime.invalidExplanation,
            });
            throw new Error('Invalid date, time, or timezone. Please check your input.');
        }

        const utcDateTime = localDateTime.toUTC();

        // Parse Coordinates
        // Handle both lat/lng and latitude/longitude property names
        const latStr = birthData.lat || birthData.latitude || '0';
        const lngStr = birthData.lng || birthData.longitude || '0';

        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            console.error('Invalid latitude/longitude in calculateChart', { latStr, lngStr });
            throw new Error('Invalid latitude or longitude. Please check your input.');
        }

        if (lat === 0 && lng === 0 && birthData.location && birthData.location.length > 10) {
            console.warn("Warning: Latitude and Longitude are 0.0. This might indicate a parsing error if the location is not actually Null Island.");
        }

        // 1. Birth JD
        const birthJd = this.swe.julday(utcDateTime.year, utcDateTime.month, utcDateTime.day,
            utcDateTime.hour + utcDateTime.minute / 60 + (utcDateTime.second || 0) / 3600);

        // 2. Calculate Cross Points (Asc, MC, etc.) using Placidus system via swe_houses_ex2
        const birthAsmc = this.calculateAsmc(birthJd, lat, lng);

        // 3. Calculate Birth Planets
        const planetIds = [
            { id: this.swe.SE_SUN, name: 'Sun' },
            { id: this.swe.SE_MOON, name: 'Moon' },
            { id: this.swe.SE_TRUE_NODE, name: 'NorthNode' },
            { id: this.swe.SE_MERCURY, name: 'Mercury' },
            { id: this.swe.SE_VENUS, name: 'Venus' },
            { id: this.swe.SE_MARS, name: 'Mars' },
            { id: this.swe.SE_JUPITER, name: 'Jupiter' },
            { id: this.swe.SE_SATURN, name: 'Saturn' },
            { id: this.swe.SE_URANUS, name: 'Uranus' },
            { id: this.swe.SE_NEPTUNE, name: 'Neptune' },
            { id: this.swe.SE_PLUTO, name: 'Pluto' },
            { id: this.swe.SE_CHIRON, name: 'Chiron' },
            { id: this.swe.SE_MEAN_APOG, name: 'Black Moon Lilith' },
            { id: this.swe.SE_VULCAN !== undefined ? this.swe.SE_VULCAN : 55, name: 'Vulcan' },
        ];

        const calcPlanetWithSpeed = (jd: number, planetId: number): { longitude: number; speed: number } | null => {
            const flag = this.swe.SEFLG_SWIEPH | this.swe.SEFLG_SPEED;
            try {
                const res = this.swe.calc_ut(jd, planetId, flag);
                const lon = res?.[0];
                const speed = (res?.length >= 4) ? res[3] : (res?.longitudeSpeed ?? res?.speed ?? 0);

                if (!Number.isFinite(lon)) {
                    return null;
                }

                return {
                    longitude: ((lon % 360) + 360) % 360,
                    speed: Number.isFinite(speed) ? speed : 0,
                };
            } catch {
                return null;
            }
        };

        const birthActivations: Record<string, Activation> = {};
        const birthRetrogrades = new Set<string>();

        // Ensure necessary ephemeris files are loaded
        await this.ensureEphemerisFiles(['seas_18.se1']);

        let birthSunLong = 0;
        let birthNnLong = 0;

        planetIds.forEach(p => {
            const data = calcPlanetWithSpeed(birthJd, p.id);
            if (!data) {
                return;
            }
            birthActivations[p.name] = HumanDesignLogic.calculateActivation(data.longitude);
            if (data.speed < 0) {
                birthRetrogrades.add(p.name);
            }
        });

        // Add Earth (Opposite Sun)
        if (birthActivations['Sun']) {
            birthSunLong = birthActivations['Sun'].longitude;
            const birthEarthLong = (birthSunLong + 180) % 360;
            birthActivations['Earth'] = HumanDesignLogic.calculateActivation(birthEarthLong);
        }

        // Add South Node (Opposite North Node)
        if (birthActivations['NorthNode']) {
            birthNnLong = birthActivations['NorthNode'].longitude;
            const birthSnLong = (birthNnLong + 180) % 360;
            birthActivations['SouthNode'] = HumanDesignLogic.calculateActivation(birthSnLong);
        }

        // 4. Design Date & JD
        const { date: designDate, jd: designJd } = this.calculateDesignDate(utcDateTime, birthSunLong);

        // 5. Design Cross Points (Asc, MC, etc.)
        const designAsmc = this.calculateAsmc(designJd, lat, lng);

        // 6. Design Planets
        const designActivations: Record<string, Activation> = {};
        const designRetrogrades = new Set<string>();

        planetIds.forEach(p => {
            const data = calcPlanetWithSpeed(designJd, p.id);
            if (!data) {
                return;
            }
            designActivations[p.name] = HumanDesignLogic.calculateActivation(data.longitude);
            if (data.speed < 0) {
                designRetrogrades.add(p.name);
            }
        });

        let designSunLong = 0;
        let designNnLong = 0;

        // Design Earth
        if (designActivations['Sun']) {
            designSunLong = designActivations['Sun'].longitude;
            const designEarthLong = (designSunLong + 180) % 360;
            designActivations['Earth'] = HumanDesignLogic.calculateActivation(designEarthLong);
        }

        // Design South Node
        if (designActivations['NorthNode']) {
            designNnLong = designActivations['NorthNode'].longitude;
            const designSnLong = (designNnLong + 180) % 360;
            designActivations['SouthNode'] = HumanDesignLogic.calculateActivation(designSnLong);
        }

        // 7. Human Design Properties
        const chartData = HumanDesignLogic.determineChartProperties(birthActivations, designActivations);


        // --- GENERATE REPORT ---

        let output = `Human Design Birth Chart Analysis\n-------------------------------\n`;
        output += `Name: ${birthData.name}\n`;
        output += `Birth Date (Local): ${localDateTime.toFormat('M/d/yyyy HH:mm:ss')}\n`;
        output += `Design Date (UTC): ${designDate.toFormat('M/d/yyyy h:mm a')}\n`;
        output += `Location: ${birthData.location || 'Unknown'}\n`;
        output += `Coordinates: ${lat.toFixed(2)}°, ${lng.toFixed(2)}°\n\n`;

        // Helper: Whole Sign House Calculation
        const getWholeSignHouse = (planetLong: number, ascLong: number) => {
            const ascSign = Math.floor(ascLong / 30);
            const planetSign = Math.floor(planetLong / 30);
            // Calculate distance in signs from Ascendant sign
            // (PlanetSign - AscSign + 12) % 12 gives 0-11 index. Add 1 for 1-12 house.
            return ((planetSign - ascSign + 12) % 12) + 1;
        };

        const printPlanets = (activations: Record<string, Activation>, ascLong: number | null, retrogrades: Set<string>) => {
            const order = [
                'Sun', 'Earth', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter',
                'Saturn', 'Uranus', 'Neptune', 'Pluto', 'NorthNode', 'SouthNode',
                'Chiron', 'Black Moon Lilith'
            ];
            let str = '';
            order.forEach(name => {
                const act = activations[name];
                if (!act) {
                    console.warn('Missing activation for planet when printing report', name);
                    return;
                }
                const sign = this.getZodiacSign(act.longitude);
                const retro = retrogrades.has(name) ? ' ℛ' : '';
                let line = `${name}${retro}: ${act.gate}.${act.line}, ${sign} ${this.formatDegrees(act.longitude)}`;

                if (ascLong !== null) {
                    const house = getWholeSignHouse(act.longitude, ascLong);
                    line += `, House ${house}`;
                }
                str += line + '\n';
            });
            return str;
        };

        // Helper: Stellium Calculation
        const getStelliums = (activations: Record<string, Activation>, ascLong: number | null) => {
            const includedPlanets = [
                'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
                'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'
            ];

            const signCounts: Record<string, number> = {};

            includedPlanets.forEach(p => {
                if (!activations[p]) return;
                const sign = this.getZodiacSign(activations[p].longitude);
                signCounts[sign] = (signCounts[sign] || 0) + 1;
            });

            let str = '';
            Object.entries(signCounts).forEach(([sign, count]) => {
                if (count >= 3) {
                    let line = `Stellium in ${sign}`;
                    // Calculate house for the stellium (using the first planet found in that sign as reference, 
                    // since Whole Sign puts them all in the same house)
                    if (ascLong !== null) {
                        // Find any planet in this sign to get the house
                        const samplePlanet = includedPlanets.find(p =>
                            activations[p] && this.getZodiacSign(activations[p].longitude) === sign
                        );
                        if (samplePlanet) {
                            const house = getWholeSignHouse(activations[samplePlanet].longitude, ascLong);
                            line += ` (House ${house})`;
                        }
                    }
                    str += line + '\n';
                }
            });
            return str;
        };

        output += `Birth Chart Planetary Positions:\n\n`;
        // Use Birth Ascendant for Birth Planets
        output += printPlanets(birthActivations, birthAsmc ? birthAsmc[0] : null, birthRetrogrades);
        const birthStelliums = getStelliums(birthActivations, birthAsmc ? birthAsmc[0] : null);
        if (birthStelliums) {
            output += birthStelliums;
        }

        const printCrossPoints = (asmc: number[] | null) => {
            if (!asmc || asmc.length < 4) {
                return 'Cross points unavailable (houses data not available).\n';
            }

            const asc = asmc[0];
            const mc = asmc[1];
            const vertex = asmc[3];
            const ic = (mc + 180) % 360;
            const desc = (asc + 180) % 360;

            const points = [
                { name: 'Ascendant', long: asc },
                { name: 'Midheaven', long: mc }, // MC is cusp of 10th house (Placidus)
                { name: 'Imum Coeli', long: ic }, // IC is cusp of 4th
                { name: 'Descendant', long: desc }, // Desc is cusp of 7th
                { name: 'Vertex', long: vertex }
            ];

            let str = '';
            points.forEach(p => {
                const act = HumanDesignLogic.calculateActivation(p.long);
                const sign = this.getZodiacSign(p.long);
                let line = `${p.name}: ${act.gate}.${act.line}, ${sign} ${this.formatDegrees(p.long)}`;

                // Add House for Cross Points
                const house = getWholeSignHouse(p.long, asc);
                line += `, House ${house}`;

                str += line + '\n';
            });
            return str;
        };

        output += `\nBirth Chart Cross Points:\n`;
        output += printCrossPoints(birthAsmc);

        output += `\nDesign Chart Planetary Positions:\n\n`;
        // Use Design Ascendant for Design Planets (Standalone Design Chart logic)
        output += printPlanets(designActivations, designAsmc ? designAsmc[0] : null, designRetrogrades);
        const designStelliums = getStelliums(designActivations, designAsmc ? designAsmc[0] : null);
        if (designStelliums) {
            output += designStelliums;
        }

        output += `\nDesign Chart Cross Points:\n`;
        output += printCrossPoints(designAsmc);

        // Determine Profile Modality
        let modalityString = '';
        if (birthActivations['Sun'] && designActivations['Sun']) {
            const personalityModality = this.getModality(birthActivations['Sun'].longitude);
            const designModality = this.getModality(designActivations['Sun'].longitude);
            modalityString = personalityModality;
            if (personalityModality !== designModality) {
                modalityString = `${personalityModality}/${designModality}`;
            }
        } else if (birthActivations['Sun']) {
            modalityString = this.getModality(birthActivations['Sun'].longitude);
        } else if (designActivations['Sun']) {
            modalityString = this.getModality(designActivations['Sun'].longitude);
        }

        output += `\nHuman Design Core Information:\n`;
        output += `Type: ${chartData.type}\n`;
        output += `Strategy: ${chartData.authority}\n`;
        output += `Definition: ${chartData.definition}\n`;
        output += `Profile: ${chartData.profile} ${modalityString}\n`;
        output += `Incarnation Cross: ${chartData.incarnationCross}\n`;

        output += `\nDefined/Undefined Centers:\n`;
        const centerOrder = [
            Center.Root, Center.Sacral, Center.Emotions, Center.Spleen,
            Center.Ego, Center.Self, Center.Throat, Center.Mind, Center.Crown
        ];

        const centerNameMap: Record<string, string> = {
            [Center.Root]: 'Root',
            [Center.Sacral]: 'Sacral',
            [Center.Emotions]: 'Emotions',
            [Center.Spleen]: 'Spleen',
            [Center.Ego]: 'Ego/Willpower',
            [Center.Self]: 'G-Center/Heart',
            [Center.Throat]: 'Throat',
            [Center.Mind]: 'Mind',
            [Center.Crown]: 'Crown'
        };

        centerOrder.forEach(c => {
            const status = chartData.definedCenters.has(c) ? 'Defined' : 'Undefined';
            output += `${centerNameMap[c]}: ${status}\n`;
        });

        output += `\nVariables:\n`;
        const vars = chartData.variables;
        output += `Digestion: ${vars.digestion.orientation}, Color ${vars.digestion.color}-Tone ${vars.digestion.tone}\n`;
        output += `Environment: ${vars.environment.orientation}, Color ${vars.environment.color}-Tone ${vars.environment.tone}\n`;
        output += `Awareness: ${vars.awareness.orientation}, Color ${vars.awareness.color}-Tone ${vars.awareness.tone}\n`;
        output += `Perspective: ${vars.perspective.orientation}, Color ${vars.perspective.color}-Tone ${vars.perspective.tone}\n`;

        output += `\nDestiny Map:\n`;

        const hdPlanetOrder = [
            'Sun', 'Earth', 'NorthNode', 'Moon', 'Mercury',
            'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
            'Chiron'
        ];

        const findHighestActivation = (acts: Record<string, Activation>): { name: string; act: Activation } | null => {
            let bestName: string | null = null;
            let bestAct: Activation | null = null;
            hdPlanetOrder.forEach(name => {
                const act = acts[name];
                if (!act) return;
                if (name === 'Chiron' || name === 'Black Moon Lilith') return;

                // Compare degree within sign (0–29.xx), not raw longitude.
                const inSign = ((act.longitude % 30) + 30) % 30;
                const bestInSign = bestAct ? ((bestAct.longitude % 30) + 30) % 30 : null;
                if (!bestAct || inSign > (bestInSign as number)) {
                    bestAct = act;
                    bestName = name;
                }
            });
            return bestName && bestAct ? { name: bestName, act: bestAct } : null;
        };

        const highestPersonality = findHighestActivation(birthActivations);
        const highestDesign = findHighestActivation(designActivations);

        if (highestPersonality) {
            const act = highestPersonality.act;
            const sign = this.getZodiacSign(act.longitude);
            const house = birthAsmc ? getWholeSignHouse(act.longitude, birthAsmc[0]) : null;
            output += `Life Purpose (${highestPersonality.name}): ${act.gate}.${act.line}, ${sign} ${this.formatDegrees(act.longitude)}${house ? `, House ${house}` : ''}\n`;
        }
        if (highestDesign) {
            const act = highestDesign.act;
            const sign = this.getZodiacSign(act.longitude);
            const house = designAsmc ? getWholeSignHouse(act.longitude, designAsmc[0]) : null;
            output += `Soul Purpose (${highestDesign.name}): ${act.gate}.${act.line}, ${sign} ${this.formatDegrees(act.longitude)}${house ? `, House ${house}` : ''}\n`;
        }

        output += `\nActive Channels:\n`;
        if (chartData.activeChannels.length === 0) {
            output += `None\n`;
        } else {
            chartData.activeChannels.forEach(ch => {
                output += `Channel ${ch}\n`;
            });
        }

        return output;
    }
}
