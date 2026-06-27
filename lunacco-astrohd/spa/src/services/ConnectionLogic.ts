import { ChartData } from './HumanDesignLogic';
import { Center, Channels, GateToCenter } from './HumanDesignDefinitions';

export type ConnectionChannelType = 'electromagnetic' | 'compromise' | 'companion' | 'dominance';

export interface ConnectionChannel {
    id: string; // channel id, e.g. "10-20"
    type: ConnectionChannelType;
    fromPerson: 'A' | 'B' | 'both' | 'composite';
    description?: string;
    gates: {
        gate1: number;
        gate2: number;
        ownerA: 'both' | 'gate1' | 'gate2' | 'none';
        ownerB: 'both' | 'gate1' | 'gate2' | 'none';
    };
}

export interface CompositeCentersSummary {
    definedCenters: Set<Center>;
    openCenters: Set<Center>;
    definedByAOnly: Set<Center>;
    definedByBOnly: Set<Center>;
    definedByBoth: Set<Center>;
    definedByComposite: Set<Center>; // Centers defined only because of composite channels
    code: string; // e.g. "9-0", "7-2"
}

export interface ConnectionAnalysis {
    compositeCenters: CompositeCentersSummary;
    compositeGates: Set<number>;       // All gates from both people
    compositeChannels: string[];       // All channels complete in composite
    electromagnetic: ConnectionChannel[];
    compromise: ConnectionChannel[];
    companion: ConnectionChannel[];
    dominance: ConnectionChannel[];
}

export class ConnectionLogic {
    /**
     * Build composite analysis: merge all gates, find complete channels, determine defined centers.
     */
    static classifyChannels(a: ChartData, b: ChartData): ConnectionAnalysis {
        const aGates = a.activeGates;
        const bGates = b.activeGates;
        const aChannels = new Set(a.activeChannels);
        const bChannels = new Set(b.activeChannels);

        // 1. Merge all gates from both charts
        const compositeGates = new Set<number>([...aGates, ...bGates]);

        // 2. Find all channels that are complete in the composite
        const compositeChannels: string[] = [];
        const electromagnetic: ConnectionChannel[] = [];
        const compromise: ConnectionChannel[] = [];
        const companion: ConnectionChannel[] = [];
        const dominance: ConnectionChannel[] = [];

        const makeOwnerTag = (has1: boolean, has2: boolean): 'none' | 'gate1' | 'gate2' | 'both' => {
            if (has1 && has2) return 'both';
            if (has1) return 'gate1';
            if (has2) return 'gate2';
            return 'none';
        };

        Channels.forEach(ch => {
            const [g1, g2] = ch.gates;

            const aHasGate1 = aGates.has(g1);
            const aHasGate2 = aGates.has(g2);
            const bHasGate1 = bGates.has(g1);
            const bHasGate2 = bGates.has(g2);

            // Check if composite has both gates (channel is complete)
            const compositeHasGate1 = aHasGate1 || bHasGate1;
            const compositeHasGate2 = aHasGate2 || bHasGate2;
            const compositeHasChannel = compositeHasGate1 && compositeHasGate2;

            if (!compositeHasChannel) {
                // Channel not complete in composite, skip classification
                return;
            }

            // Channel is complete in composite
            compositeChannels.push(ch.id);

            const aHasChannel = aChannels.has(ch.id);
            const bHasChannel = bChannels.has(ch.id);

            const ownersA = makeOwnerTag(aHasGate1, aHasGate2);
            const ownersB = makeOwnerTag(bHasGate1, bHasGate2);

            const base: Omit<ConnectionChannel, 'type'> = {
                id: ch.id,
                fromPerson: 'composite',
                description: undefined,
                gates: {
                    gate1: g1,
                    gate2: g2,
                    ownerA: ownersA,
                    ownerB: ownersB,
                },
            };

            // Companion: both have the full channel individually
            if (aHasChannel && bHasChannel) {
                companion.push({ ...base, type: 'companion' });
                return;
            }

            // Electromagnetic: each contributes complementary gates, neither has full channel alone
            // A has one gate, B has the other gate (completing the channel together)
            const aContributesG1Only = aHasGate1 && !aHasGate2;
            const aContributesG2Only = !aHasGate1 && aHasGate2;
            const bContributesG1Only = bHasGate1 && !bHasGate2;
            const bContributesG2Only = !bHasGate1 && bHasGate2;

            const isElectromagnetic = !aHasChannel && !bHasChannel && (
                (aContributesG1Only && bContributesG2Only) ||
                (aContributesG2Only && bContributesG1Only)
            );

            if (isElectromagnetic) {
                electromagnetic.push({ ...base, type: 'electromagnetic' });
                return;
            }

            // Compromise: one has full channel, other has at least one gate (doubling up)
            const aHasOneGate = (aHasGate1 || aHasGate2) && !aHasChannel;
            const bHasOneGate = (bHasGate1 || bHasGate2) && !bHasChannel;

            if (aHasChannel && bHasOneGate) {
                compromise.push({
                    ...base,
                    type: 'compromise',
                    fromPerson: 'A',
                    description: 'Person A holds full channel, Person B doubles a gate.',
                });
                return;
            }

            if (bHasChannel && aHasOneGate) {
                compromise.push({
                    ...base,
                    type: 'compromise',
                    fromPerson: 'B',
                    description: 'Person B holds full channel, Person A doubles a gate.',
                });
                return;
            }

            // Dominance: one has full channel, the other has neither gate
            const bHasNoGates = !bHasGate1 && !bHasGate2;
            const aHasNoGates = !aHasGate1 && !aHasGate2;

            if (aHasChannel && bHasNoGates) {
                dominance.push({
                    ...base,
                    type: 'dominance',
                    fromPerson: 'A',
                    description: 'Only Person A has this channel.',
                });
                return;
            }

            if (bHasChannel && aHasNoGates) {
                dominance.push({
                    ...base,
                    type: 'dominance',
                    fromPerson: 'B',
                    description: 'Only Person B has this channel.',
                });
                return;
            }

            // Edge case: both contribute gates but in overlapping ways (e.g., both have gate1, one has gate2)
            // This is still electromagnetic-like but with overlap
            electromagnetic.push({ ...base, type: 'electromagnetic' });
        });

        // 3. Determine defined centers based on composite channels
        const compositeCenters = this.buildCompositeCenters(a, b, compositeChannels);

        return {
            compositeCenters,
            compositeGates,
            compositeChannels,
            electromagnetic,
            compromise,
            companion,
            dominance,
        };
    }

    /**
     * Build composite centers summary based on composite channels.
     */
    static buildCompositeCenters(a: ChartData, b: ChartData, compositeChannels: string[]): CompositeCentersSummary {
        const allCenters = Object.values(Center);
        
        // Find which centers are defined by composite channels
        const centersDefinedByChannels = new Set<Center>();
        compositeChannels.forEach(chId => {
            const channel = Channels.find(c => c.id === chId);
            if (channel) {
                const [g1, g2] = channel.gates;
                const center1 = GateToCenter[g1];
                const center2 = GateToCenter[g2];
                if (center1) centersDefinedByChannels.add(center1);
                if (center2) centersDefinedByChannels.add(center2);
            }
        });

        const definedCenters = new Set<Center>();
        const openCenters = new Set<Center>();
        const definedByAOnly = new Set<Center>();
        const definedByBOnly = new Set<Center>();
        const definedByBoth = new Set<Center>();
        const definedByComposite = new Set<Center>();

        allCenters.forEach(c => {
            const center = c as Center;
            const aDef = a.definedCenters.has(center);
            const bDef = b.definedCenters.has(center);
            const compositeDef = centersDefinedByChannels.has(center);

            if (compositeDef) {
                definedCenters.add(center);
                
                if (aDef && bDef) {
                    definedByBoth.add(center);
                } else if (aDef && !bDef) {
                    definedByAOnly.add(center);
                } else if (!aDef && bDef) {
                    definedByBOnly.add(center);
                } else {
                    // Neither had it defined individually, but composite does
                    definedByComposite.add(center);
                }
            } else {
                openCenters.add(center);
            }
        });

        const nDefined = definedCenters.size;
        const nOpen = openCenters.size;
        const code = `${nDefined}-${nOpen}`;

        return {
            definedCenters,
            openCenters,
            definedByAOnly,
            definedByBOnly,
            definedByBoth,
            definedByComposite,
            code,
        };
    }
}
