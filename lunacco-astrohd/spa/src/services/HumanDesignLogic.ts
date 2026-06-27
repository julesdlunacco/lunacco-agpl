
import { Center, Channels, GateToCenter, Profile, Strategy, Type } from './HumanDesignDefinitions';
import { FixingState, FIXATION_STATES, HARMONIC_GATES } from './fixationData';


// Constants for HD Calculations
const HD_OFFSET_TO_ZODIAC = 3.875;
const DEGREE_PER_GATE = 5.625;
const DEGREE_PER_LINE = 0.9375;
const DEGREE_PER_COLOR = 0.15625;
const DEGREE_PER_TONE = DEGREE_PER_COLOR / 6;
const DEGREE_PER_BASE = DEGREE_PER_TONE / 5;

export interface Activation {
    gate: number;
    line: number;
    color: number;
    tone: number;
    base: number;
    longitude: number;
    sign?: string;
    house?: number; // Whole sign house (1-12)
    isRetrograde?: boolean;
    fixation?: FixingState;
}


export interface ChartData {
    birthActivations: Record<string, Activation>;
    designActivations: Record<string, Activation>;
    activeGates: Set<number>;
    activeChannels: string[];
    definedCenters: Set<Center>;
    type: Type;
    strategy: string;
    authority: Strategy; // Using Strategy enum for Authority as per C#
    profile: Profile;
    variables: {
        digestion: VariableInfo;
        environment: VariableInfo;
        motivation: VariableInfo;
        perspective: VariableInfo;
    };
    definition: string;
    definitionType: string;
    incarnationCross: {
        name: string;
    };
    modality: string;
}

interface VariableInfo {
    orientation: 'Left' | 'Right';
    color: number;
    tone: number;
    base: number;
}

export class HumanDesignLogic {

    static calculateActivation(longitude: number): Activation {
        let adjustedDegrees = longitude - HD_OFFSET_TO_ZODIAC;
        if (adjustedDegrees < 0) {
            adjustedDegrees += 360;
        }

        const signs = [
            'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
            'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
        ];
        const signIndex = Math.floor(longitude / 30);
        const sign = signs[signIndex % 12];

        // Wheel Order derived from C# Gates enum mapping
        const wheelOrder = [
            17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 
            20, 16, 35, 45, 12, 15, 52, 39, 53, 62,
            56, 31, 33, 7, 4, 29, 59, 40, 64, 47,
            6, 46, 18, 48, 57, 32, 50, 28, 44, 1,
            43, 14, 34, 9, 5, 26, 11, 10, 58, 38,
            54, 61, 60, 41, 19, 13, 49, 30, 55, 37,
            63, 22, 36, 25
        ];

        const index = Math.floor(adjustedDegrees / DEGREE_PER_GATE);
        const gate = wheelOrder[index] || 1;

        const remainderForLine = adjustedDegrees % DEGREE_PER_GATE;
        const line = Math.floor(remainderForLine / DEGREE_PER_LINE) + 1;

        const remainderForColor = remainderForLine % DEGREE_PER_LINE;
        const color = Math.floor(remainderForColor / DEGREE_PER_COLOR) + 1;

        const remainderForTone = remainderForColor % DEGREE_PER_COLOR;
        const tone = Math.floor(remainderForTone / DEGREE_PER_TONE) + 1;

        const remainderForBase = remainderForTone % DEGREE_PER_TONE;
        const base = Math.floor(remainderForBase / DEGREE_PER_BASE) + 1;

        return { gate, line, color, tone, base, longitude, sign };
    }

    private static getModality(longitude: number): string {
        const index = Math.floor(longitude / 30);
        const modalities = ['Cardinal', 'Fixed', 'Mutable'];
        // Aries (0) -> Cardinal, Taurus (1) -> Fixed, Gemini (2) -> Mutable, etc.
        return modalities[index % 3];
    }

    static determineChartProperties(personalityActivations: Record<string, Activation>, designActivations: Record<string, Activation>): ChartData {
         const activeGates = new Set<number>();

        const shouldContributeToBodygraph = (name: string) => {
            return !['Chiron', 'Black Moon Lilith', 'Vulcan', 'Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex'].includes(name);
        };

        Object.entries(personalityActivations).forEach(([name, a]) => {
            if (!shouldContributeToBodygraph(name)) return;
            activeGates.add(a.gate);
        });
        Object.entries(designActivations).forEach(([name, a]) => {
            if (!shouldContributeToBodygraph(name)) return;
            activeGates.add(a.gate);
        });
 
         const activeChannels: string[] = [];
         const adjacency: Record<string, string[]> = {}; // Center -> Connected Centers

         Channels.forEach(channel => {
             if (activeGates.has(channel.gates[0]) && activeGates.has(channel.gates[1])) {
                 activeChannels.push(channel.id);
                 
                 const c1 = GateToCenter[channel.gates[0]];
                 const c2 = GateToCenter[channel.gates[1]];
                 
                 if (!adjacency[c1]) adjacency[c1] = [];
                 if (!adjacency[c2]) adjacency[c2] = [];
                 adjacency[c1].push(c2);
                 adjacency[c2].push(c1);
             }
         });
         
         const definedCenters = new Set<Center>();
         activeChannels.forEach(cid => {
             const c = Channels.find(x => x.id === cid);
             if(c) {
                const c1 = GateToCenter[c.gates[0]];
                const c2 = GateToCenter[c.gates[1]];
                if (c1) definedCenters.add(c1);
                if (c2) definedCenters.add(c2);
             }
         });

         const isConnected = (start: Center, end: Center): boolean => {
             if (!definedCenters.has(start) || !definedCenters.has(end)) return false;
             if (start === end) return true;
             
             const visited = new Set<string>();
             const queue = [start];
             visited.add(start);
             
             while(queue.length > 0) {
                 const curr = queue.shift()!;
                 if (curr === end) return true;
                 
                 const neighbors = adjacency[curr] || [];
                 for(const n of neighbors) {
                     if(!visited.has(n)) {
                         visited.add(n);
                         // @ts-ignore - Enum/String matching
                         queue.push(n);
                     }
                 }
             }
             return false;
         };

         // Type Logic (based on defined centers and their connectivity)
         let type = Type.Reflector;
         if (definedCenters.size > 0) {
             const sacral = definedCenters.has(Center.Sacral);
             const throat = definedCenters.has(Center.Throat);
             
             const motors = [Center.Sacral, Center.Ego, Center.Emotions, Center.Root];
             let anyMotorToThroat = false;
             
             if (throat) {
                 for (const m of motors) {
                     if (definedCenters.has(m) && isConnected(m, Center.Throat)) {
                         anyMotorToThroat = true;
                         break;
                     }
                 }
             }

             if (sacral) {
                 type = anyMotorToThroat ? Type.ManifestingGenerator : Type.Generator;
             } else {
                 type = anyMotorToThroat ? Type.Manifestor : Type.Projector;
             }
         }
         
         // Authority Logic (based on which centers are defined)
         let authority = Strategy.Outer;
         if (definedCenters.has(Center.Emotions)) authority = Strategy.Emotional;
         else if (definedCenters.has(Center.Sacral)) authority = Strategy.Sacral;
         else if (definedCenters.has(Center.Spleen)) authority = Strategy.Spleen;
         else if (definedCenters.has(Center.Ego)) {
             authority = Strategy.Ego; 
         }
         else if (definedCenters.has(Center.Self)) authority = Strategy.Self;
         else if (definedCenters.has(Center.Mind) || definedCenters.has(Center.Crown)) authority = Strategy.Mental; 
         else authority = Strategy.Outer;

         // Profile
         const pSun = personalityActivations['Sun'];
         const dSun = designActivations['Sun'];
         const profile = (pSun && dSun) 
            ? this.determineProfile(pSun.line, dSun.line)
            : Profile.P1_3; 

         // Variables
        const variables = this.determineVariables(personalityActivations, designActivations);
        
        // Definition (split) based on how many connected components of centers we have
        const definition = this.getDefinitionFromCenters(definedCenters, adjacency);

        // Incarnation Cross
        const angle = this.getAngleFromProfile(profile);
        const incarnationCross = pSun 
           ? this.getIncarnationCrossName(pSun.gate, angle)
           : 'Unclassified Cross';

         // Determine Modality
         const personalityModality = pSun ? this.getModality(pSun.longitude) : 'Cardinal';
         const designModality = dSun ? this.getModality(dSun.longitude) : personalityModality;
         let modality = personalityModality;
         if (personalityModality !== designModality) {
             modality = `${personalityModality}/${designModality}`;
         }

         const strategy = this.getStrategyFromType(type);

          const birthActivationsWithFixations = this.calculateFixations(personalityActivations, [personalityActivations, designActivations]);
          const designActivationsWithFixations = this.calculateFixations(designActivations, [personalityActivations, designActivations]);

          return {
              birthActivations: birthActivationsWithFixations,
              designActivations: designActivationsWithFixations,
              activeGates,
              activeChannels,
              definedCenters,
              type,
              strategy,
              authority,
              profile,
              variables,
              definition,
              definitionType: definition,
              incarnationCross: {
                  name: incarnationCross
              },
              modality
          };
    }

    private static calculateFixations(
        targetActivations: Record<string, Activation>,
        activationSets: Record<string, Activation>[]
    ): Record<string, Activation> {
        const results: Record<string, Activation> = {};

        for (const [planetName, act] of Object.entries(targetActivations)) {
            let state = FixingState.None;

            // In SharpAstrology, HARMONIC_GATES already includes the gate itself (conjunction) 
            // plus the opposite gate (opposition).
            const gatesToCheck = HARMONIC_GATES[act.gate] || [act.gate];

            for (const checkGate of gatesToCheck) {
                for (const set of activationSets) {
                    for (const [otherPlanet, otherAct] of Object.entries(set)) {
                        if (otherAct.gate === checkGate) {
                            // "If this planet (otherPlanet) was in the target gate/line, would it fix it?"
                            const fixStr = FIXATION_STATES[otherPlanet]?.[act.gate]?.[act.line];
                            if (fixStr) {
                                state |= (fixStr === 'Exalted' ? FixingState.Exalted : FixingState.Detriment);
                            }
                        }
                    }
                }
            }

            results[planetName] = { ...act, fixation: state as FixingState };
        }

        return results;
    }


    private static getStrategyFromType(type: Type): string {
        switch (type) {
            case Type.Generator:
            case Type.ManifestingGenerator:
                return 'To Respond';
            case Type.Projector:
                return 'Wait for the Invitation';
            case Type.Manifestor:
                return 'To Inform';
            case Type.Reflector:
                return 'Wait for a Lunar Cycle';
            default:
                return '—';
        }
    }

    private static determineProfile(pLine: number, dLine: number): Profile {
        const tag = `${pLine}/${dLine}`;
        switch (tag) {
            case '1/3': return Profile.P1_3;
            case '1/4': return Profile.P1_4;
            case '2/4': return Profile.P2_4;
            case '2/5': return Profile.P2_5;
            case '3/5': return Profile.P3_5;
            case '3/6': return Profile.P3_6;
            case '4/6': return Profile.P4_6;
            case '4/1': return Profile.P4_1;
            case '5/1': return Profile.P5_1;
            case '5/2': return Profile.P5_2;
            case '6/2': return Profile.P6_2;
            case '6/3': return Profile.P6_3;
            default: return Profile.P1_3; // Fallback
        }
    }

    private static determineVariables(p: Record<string, Activation>, d: Record<string, Activation>) {
        const dSun = d['Sun'];
        const pSun = p['Sun'];
        const dNode = d['NorthNode'] || d['North Node'];
        const pNode = p['NorthNode'] || p['North Node'];
        
        const toOrientation = (tone: number) => tone <= 3 ? 'Left' : 'Right';

        const fallback = { orientation: 'Left' as const, color: 1, tone: 1, base: 1 };

        return {
            digestion: dSun ? {
                orientation: toOrientation(dSun.tone) as 'Left'|'Right',
                color: dSun.color,
                tone: dSun.tone,
                base: dSun.base
            } : fallback,
            environment: dNode ? {
                orientation: toOrientation(dNode.tone) as 'Left'|'Right',
                color: dNode.color,
                tone: dNode.tone,
                base: dNode.base
            } : fallback,
            perspective: pNode ? {
                orientation: toOrientation(pNode.tone) as 'Left'|'Right',
                color: pNode.color,
                tone: pNode.tone,
                base: pNode.base
            } : fallback,
            motivation: pSun ? {
                orientation: toOrientation(pSun.tone) as 'Left'|'Right',
                color: pSun.color,
                tone: pSun.tone,
                base: pSun.base
            } : fallback
        };
    }

    private static getAngleFromProfile(profile: Profile): 'Right' | 'Left' | 'Juxtaposition' {
        switch (profile) {
            case Profile.P4_1:
                return 'Juxtaposition';
            case Profile.P5_1:
            case Profile.P5_2:
            case Profile.P6_2:
            case Profile.P6_3:
                return 'Left';
            default:
                return 'Right';
        }
    }

    private static getDefinitionFromCenters(
        definedCenters: Set<Center>,
        adjacency: Record<string, string[]>
    ): string {
        if (definedCenters.size === 0) return 'No Definition';

        const visited = new Set<Center>();
        let components = 0;

        definedCenters.forEach(start => {
            if (visited.has(start)) return;
            components++;
            const queue: Center[] = [start];
            visited.add(start);

            while (queue.length > 0) {
                const current = queue.shift()!;
                const neighbors = adjacency[current] || [];
                neighbors.forEach(n => {
                    const center = n as Center; // GateToCenter ensures valid centers
                    if (definedCenters.has(center) && !visited.has(center)) {
                        visited.add(center);
                        queue.push(center);
                    }
                });
            }
        });

        switch (components) {
            case 1: return 'Single Definition';
            case 2: return 'Split Definition';
            case 3: return 'Triple Split Definition';
            default: return 'Quadruple Split Definition';
        }
    }

    private static getIncarnationCrossName(gate: number, angle: 'Right' | 'Left' | 'Juxtaposition'): string {
        const key = `${angle}:${gate}`;
        const enumName = INCARNATION_CROSS_ENUM_BY_GATE_ANGLE[key];
        return enumName ? prettifyIncarnationCrossEnum(enumName) : `${angle} Angle Cross of Gate ${gate}`;
    }
}

// ---- Incarnation Cross Mapping (mirrors C# IncarnationCrosses Right/Left mappings) ----

// Map of angle+gate -> IncarnationCrosses enum name (string), copied from C# ToIncarnationCross
const INCARNATION_CROSS_ENUM_BY_GATE_ANGLE: Record<string, string> = {
    // Juxtaposition crosses (Angles.Juxtaposition)
    'Juxtaposition:44': 'JuxtapositionCrossOfAlertness',
    'Juxtaposition:54': 'JuxtapositionCrossOfAmbition',
    'Juxtaposition:12': 'JuxtapositionCrossOfArticulation',
    'Juxtaposition:23': 'JuxtapositionCrossOfAssimilation',
    'Juxtaposition:37': 'JuxtapositionCrossOfBargains',
    'Juxtaposition:53': 'JuxtapositionCrossOfBeginnings',
    'Juxtaposition:10': 'JuxtapositionCrossOfBehavior',
    'Juxtaposition:27': 'JuxtapositionCrossOfCaring',
    'Juxtaposition:29': 'JuxtapositionCrossOfCommitment',
    'Juxtaposition:42': 'JuxtapositionCrossOfCompletion',
    'Juxtaposition:6': 'JuxtapositionCrossOfConflict',
    'Juxtaposition:64': 'JuxtapositionCrossOfConfusion',
    'Juxtaposition:32': 'JuxtapositionCrossOfConservation',
    'Juxtaposition:8': 'JuxtapositionCrossOfContribution',
    'Juxtaposition:21': 'JuxtapositionCrossOfControl',
    'Juxtaposition:18': 'JuxtapositionCrossOfCorrection',
    'Juxtaposition:36': 'JuxtapositionCrossOfCrisis',
    'Juxtaposition:40': 'JuxtapositionCrossOfDenial',
    'Juxtaposition:48': 'JuxtapositionCrossOfDepth',
    'Juxtaposition:62': 'JuxtapositionCrossOfDetail',
    'Juxtaposition:63': 'JuxtapositionCrossOfDoubts',
    'Juxtaposition:14': 'JuxtapositionCrossOfEmpowering',
    'Juxtaposition:35': 'JuxtapositionCrossOfExperience',
    'Juxtaposition:16': 'JuxtapositionCrossOfExperimentation',
    'Juxtaposition:15': 'JuxtapositionCrossOfExtremes',
    'Juxtaposition:41': 'JuxtapositionCrossOfFantasy',
    'Juxtaposition:30': 'JuxtapositionCrossOfFates',
    'Juxtaposition:9': 'JuxtapositionCrossOfFocus',
    'Juxtaposition:4': 'JuxtapositionCrossOfFormulization',
    'Juxtaposition:22': 'JuxtapositionCrossOfGrace',
    'Juxtaposition:5': 'JuxtapositionCrossOfHabits',
    'Juxtaposition:11': 'JuxtapositionCrossOfIdeas',
    'Juxtaposition:31': 'JuxtapositionCrossOfInfluence',
    'Juxtaposition:25': 'JuxtapositionCrossOfInnocence',
    'Juxtaposition:43': 'JuxtapositionCrossOfInsight',
    'Juxtaposition:7': 'JuxtapositionCrossOfInteraction',
    'Juxtaposition:57': 'JuxtapositionCrossOfIntuition',
    'Juxtaposition:60': 'JuxtapositionCrossOfLimitation',
    'Juxtaposition:13': 'JuxtapositionCrossOfListening',
    'Juxtaposition:55': 'JuxtapositionCrossOfMoods',
    'Juxtaposition:3': 'JuxtapositionCrossOfMutation',
    'Juxtaposition:19': 'JuxtapositionCrossOfNeed',
    'Juxtaposition:17': 'JuxtapositionCrossOfOpinions',
    'Juxtaposition:38': 'JuxtapositionCrossOfOpposition',
    'Juxtaposition:47': 'JuxtapositionCrossOfOppression',
    'Juxtaposition:45': 'JuxtapositionCrossOfPossession',
    'Juxtaposition:34': 'JuxtapositionCrossOfPower',
    'Juxtaposition:49': 'JuxtapositionCrossOfPrinciples',
    'Juxtaposition:39': 'JuxtapositionCrossOfProvocation',
    'Juxtaposition:24': 'JuxtapositionCrossOfRationalization',
    'Juxtaposition:33': 'JuxtapositionCrossOfRetreat',
    'Juxtaposition:28': 'JuxtapositionCrossOfRisks',
    'Juxtaposition:1': 'JuxtapositionCrossOfSelfExpression',
    'Juxtaposition:46': 'JuxtapositionCrossOfSerendipity',
    'Juxtaposition:51': 'JuxtapositionCrossOfShock',
    'Juxtaposition:52': 'JuxtapositionCrossOfStillness',
    'Juxtaposition:56': 'JuxtapositionCrossOfStimulation',
    'Juxtaposition:59': 'JuxtapositionCrossOfStrategy',
    'Juxtaposition:61': 'JuxtapositionCrossOfThinking',
    'Juxtaposition:50': 'JuxtapositionCrossOfValues',
    'Juxtaposition:58': 'JuxtapositionCrossOfVitality',
    'Juxtaposition:2': 'JuxtapositionCrossOfTheDriver',
    'Juxtaposition:20': 'JuxtapositionCrossOfTheNow',
    'Juxtaposition:26': 'JuxtapositionCrossOfTheTrickster',

    // Left Angle crosses (Angles.Left)
    'Left:34': 'LeftAngleCrossOfDuality2',
    'Left:39': 'LeftAngleCrossOfIndividualism',
    'Left:38': 'LeftAngleCrossOfIndividualism2',
    'Left:32': 'LeftAngleCrossOfLimitation2',
    'Left:33': 'LeftAngleCrossOfRefinement',
    'Left:36': 'LeftAngleCrossOfThePlane',
    'Left:27': 'LeftAngleCrossOfAlignment',
    'Left:28': 'LeftAngleCrossOfAlignment2',
    'Left:45': 'LeftAngleCrossOfConfrontation',
    'Left:26': 'LeftAngleCrossOfConfrontation2',
    'Left:53': 'LeftAngleCrossOfCycles',
    'Left:54': 'LeftAngleCrossOfCycles2',
    'Left:23': 'LeftAngleCrossOfDedication',
    'Left:43': 'LeftAngleCrossOfDedication2',
    'Left:2': 'LeftAngleCrossOfDefiance',
    'Left:1': 'LeftAngleCrossOfDefiance2',
    'Left:52': 'LeftAngleCrossOfDemands',
    'Left:58': 'LeftAngleCrossOfDemands2',
    'Left:56': 'LeftAngleCrossOfDistraction',
    'Left:60': 'LeftAngleCrossOfDistraction2',
    'Left:63': 'LeftAngleCrossOfDominion',
    'Left:64': 'LeftAngleCrossOfDominion2',
    'Left:20': 'LeftAngleCrossOfDuality',
    'Left:12': 'LeftAngleCrossOfEducation',
    'Left:11': 'LeftAngleCrossOfEducation2',
    'Left:21': 'LeftAngleCrossOfEndeavour',
    'Left:48': 'LeftAngleCrossOfEndeavour2',
    'Left:25': 'LeftAngleCrossOfHealing',
    'Left:46': 'LeftAngleCrossOfHealing2',
    'Left:16': 'LeftAngleCrossOfIdentification',
    'Left:9': 'LeftAngleCrossOfIdentification2',
    'Left:24': 'LeftAngleCrossOfIncarnation',
    'Left:44': 'LeftAngleCrossOfIncarnation2',
    'Left:30': 'LeftAngleCrossOfIndustry',
    'Left:29': 'LeftAngleCrossOfIndustry2',
    'Left:22': 'LeftAngleCrossOfInforming',
    'Left:47': 'LeftAngleCrossOfInforming2',
    'Left:42': 'LeftAngleCrossOfLimitation',
    'Left:13': 'LeftAngleCrossOfMasks',
    'Left:7': 'LeftAngleCrossOfMasks2',
    'Left:37': 'LeftAngleCrossOfMigration',
    'Left:40': 'LeftAngleCrossOfMigration2',
    'Left:62': 'LeftAngleCrossOfObscuration',
    'Left:61': 'LeftAngleCrossOfObscuration2',
    'Left:15': 'LeftAngleCrossOfPrevention',
    'Left:10': 'LeftAngleCrossOfPrevention2',
    'Left:19': 'LeftAngleCrossOfRefinement2',
    'Left:49': 'LeftAngleCrossOfRevolution',
    'Left:4': 'LeftAngleCrossOfRevolution2',
    'Left:35': 'LeftAngleCrossOfSeparation',
    'Left:5': 'LeftAngleCrossOfSeparation2',
    'Left:55': 'LeftAngleCrossOfSpirit',
    'Left:59': 'LeftAngleCrossOfSpirit2',
    'Left:8': 'LeftAngleCrossOfUncertainty',
    'Left:14': 'LeftAngleCrossOfUncertainty2',
    'Left:17': 'LeftAngleCrossOfUpheaval',
    'Left:18': 'LeftAngleCrossOfUpheaval2',
    'Left:3': 'LeftAngleCrossOfWishes',
    'Left:50': 'LeftAngleCrossOfWishes2',
    'Left:31': 'LeftAngleCrossOfTheAlpha',
    'Left:41': 'LeftAngleCrossOfTheAlpha2',
    'Left:51': 'LeftAngleCrossOfTheClarion',
    'Left:57': 'LeftAngleCrossOfTheClarion2',
    'Left:6': 'LeftAngleCrossOfThePlane2',

    // Right Angle crosses (Angles.Right)
    'Right:63': 'RightAngleCrossOfConsciousness',
    'Right:35': 'RightAngleCrossOfConsciousness2',
    'Right:64': 'RightAngleCrossOfConsciousness3',
    'Right:5': 'RightAngleCrossOfConsciousness4',
    'Right:30': 'RightAngleCrossOfContagion',
    'Right:8': 'RightAngleCrossOfContagion2',
    'Right:29': 'RightAngleCrossOfContagion3',
    'Right:14': 'RightAngleCrossOfContagion4',
    'Right:12': 'RightAngleCrossOfEden2',
    'Right:6': 'RightAngleCrossOfEden3',
    'Right:11': 'RightAngleCrossOfEden4',
    'Right:49': 'RightAngleCrossOfExplanation',
    'Right:23': 'RightAngleCrossOfExplanation2',
    'Right:4': 'RightAngleCrossOfExplanation3',
    'Right:43': 'RightAngleCrossOfExplanation4',
    'Right:3': 'RightAngleCrossOfLaws',
    'Right:56': 'RightAngleCrossOfLaws2',
    'Right:50': 'RightAngleCrossOfLaws3',
    'Right:60': 'RightAngleCrossOfLaws4',
    'Right:42': 'RightAngleCrossOfMaya',
    'Right:62': 'RightAngleCrossOfMaya2',
    'Right:32': 'RightAngleCrossOfMaya3',
    'Right:61': 'RightAngleCrossOfMaya4',
    'Right:51': 'RightAngleCrossOfPenetration',
    'Right:53': 'RightAngleCrossOfPenetration2',
    'Right:57': 'RightAngleCrossOfPenetration3',
    'Right:54': 'RightAngleCrossOfPenetration4',
    'Right:37': 'RightAngleCrossOfPlanning',
    'Right:16': 'RightAngleCrossOfPlanning2',
    'Right:40': 'RightAngleCrossOfPlanning3',
    'Right:9': 'RightAngleCrossOfPlanning4',
    'Right:22': 'RightAngleCrossOfRulership',
    'Right:45': 'RightAngleCrossOfRulership2',
    'Right:47': 'RightAngleCrossOfRulership3',
    'Right:26': 'RightAngleCrossOfRulership4',
    'Right:17': 'RightAngleCrossOfService',
    'Right:52': 'RightAngleCrossOfService2',
    'Right:18': 'RightAngleCrossOfService3',
    'Right:58': 'RightAngleCrossOfService4',
    'Right:21': 'RightAngleCrossOfTension',
    'Right:39': 'RightAngleCrossOfTension2',
    'Right:48': 'RightAngleCrossOfTension3',
    'Right:38': 'RightAngleCrossOfTension4',
    'Right:10': 'RightAngleCrossOfVesselOfLove4',
    'Right:36': 'RightAngleCrossOfTheEden',
    'Right:24': 'RightAngleCrossOfTheFourWays',
    'Right:33': 'RightAngleCrossOfTheFourWays2',
    'Right:44': 'RightAngleCrossOfTheFourWays3',
    'Right:19': 'RightAngleCrossOfTheFourWays4',
    'Right:55': 'RightAngleCrossOfTheSleepingPhoenix',
    'Right:20': 'RightAngleCrossOfTheSleepingPhoenix2',
    'Right:59': 'RightAngleCrossOfTheSleepingPhoenix3',
    'Right:34': 'RightAngleCrossOfTheSleepingPhoenix4',
    'Right:13': 'RightAngleCrossOfTheSphinx',
    'Right:2': 'RightAngleCrossOfTheSphinx2',
    'Right:7': 'RightAngleCrossOfTheSphinx3',
    'Right:1': 'RightAngleCrossOfTheSphinx4',
    'Right:27': 'RightAngleCrossOfTheUnexpected',
    'Right:31': 'RightAngleCrossOfTheUnexpected2',
    'Right:28': 'RightAngleCrossOfTheUnexpected3',
    'Right:41': 'RightAngleCrossOfTheUnexpected4',
    'Right:25': 'RightAngleCrossOfTheVesselOfLove',
    'Right:15': 'RightAngleCrossOfTheVesselOfLove2',
    'Right:46': 'RightAngleCrossOfTheVesselOfLove3',
};

function prettifyIncarnationCrossEnum(enumName: string): string {
    // Turn e.g. "RightAngleCrossOfTheUnexpected4" into "Right Angle Cross of The Unexpected 4".
    // 1) Insert spaces before capitals and digits
    const withSpaces = enumName.replace(/([a-z])([A-Z0-9])/g, '$1 $2');

    // 2) Replace prefixes
    let result = withSpaces
        .replace(/^Right Angle Cross Of /, 'Right Angle Cross of ')
        .replace(/^Left Angle Cross Of /, 'Left Angle Cross of ')
        .replace(/^Juxtaposition Cross Of /, 'Juxtaposition Cross of ');

    return result.trim();
}
