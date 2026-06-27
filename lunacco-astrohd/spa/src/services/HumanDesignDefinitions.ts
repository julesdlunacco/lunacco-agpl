
export enum Center {
    Root = 'Root',
    Sacral = 'Sacral',
    Emotions = 'Emotions',
    Spleen = 'Spleen',
    Ego = 'Ego', // Formerly Heart
    Self = 'G-Center/Heart', // Also known as G-Center
    Throat = 'Throat',
    Mind = 'Mind', // Also known as Ajna
    Crown = 'Crown' // Also known as Head
}

export enum Type {
    Manifestor = 'Manifestor',
    Generator = 'Generator',
    ManifestingGenerator = 'Manifesting Generator',
    Projector = 'Projector',
    Reflector = 'Reflector'
}

export enum Strategy {
    Emotional = 'Emotional',
    Sacral = 'Sacral',
    Spleen = 'Spleenic', // Or 'Listen to Instinct'
    Ego = 'Ego', // Formerly Heart
    Self = 'Self Projected',
    Outer = 'Outer (None/Lunar)', // For Reflector / Mental Projector
    Mental = 'Mental' // Sometimes 'Outer' is used for Environmental/Mental
}

// Re-mapping C# "Strategy" to "Authority" as that's what "Emotional", "Sacral" etc refer to in HD context.
// The User Request shows "Strategy: Emotional", so they are conflating Authority with Strategy or using a specific naming convention.
// I will calculate both: Type-based Strategy and Authority.

export enum Profile {
    P1_3 = '1 / 3',
    P1_4 = '1 / 4',
    P2_4 = '2 / 4',
    P2_5 = '2 / 5',
    P3_5 = '3 / 5',
    P3_6 = '3 / 6',
    P4_6 = '4 / 6',
    P4_1 = '4 / 1',
    P5_1 = '5 / 1',
    P5_2 = '5 / 2',
    P6_2 = '6 / 2',
    P6_3 = '6 / 3'
}

export const CenterGates: Record<Center, number[]> = {
    [Center.Root]: [58, 38, 54, 53, 60, 52, 19, 39, 41],
    [Center.Sacral]: [27, 34, 5, 14, 29, 59, 9, 3, 42],
    [Center.Spleen]: [18, 28, 32, 50, 44, 57, 48],
    [Center.Emotions]: [6, 37, 22, 36, 30, 55, 49],
    [Center.Ego]: [21, 40, 26, 51],
    [Center.Self]: [1, 13, 25, 46, 2, 15, 10, 7],
    [Center.Throat]: [20, 16, 62, 23, 56, 35, 12, 45, 33, 8, 31],
    [Center.Mind]: [43, 17, 47, 24, 4, 11],
    [Center.Crown]: [64, 61, 63]
};

// Map of Gate Numbers to their Center (Reverse lookup)
export const GateToCenter: Record<number, Center> = {};
Object.entries(CenterGates).forEach(([center, gates]) => {
    gates.forEach(gate => {
        GateToCenter[gate] = center as Center;
    });
});

export interface Channel {
    id: string;
    gates: [number, number];
    name: string;
    circuitry?: Circuitry;
}

export enum Circuitry {
    Integration = 'Integration',
    Individual = 'Individual',
    Collective = 'Collective',
    Tribal = 'Tribal'
}

export enum Circuit {
    Integration = 'Integration',
    Knowing = 'Knowing',
    Centering = 'Centering',
    Understanding = 'Understanding',
    Sensing = 'Sensing',
    Ego = 'Ego',
    Defense = 'Defense'
}

export const Channels: Channel[] = [
    { id: '1-8', gates: [1, 8], name: 'Inspiration', circuitry: Circuitry.Individual },
    { id: '2-14', gates: [2, 14], name: 'The Beat', circuitry: Circuitry.Individual },
    { id: '3-60', gates: [3, 60], name: 'Mutation', circuitry: Circuitry.Individual },
    { id: '4-63', gates: [4, 63], name: 'Logic', circuitry: Circuitry.Collective },
    { id: '5-15', gates: [5, 15], name: 'Rhythm', circuitry: Circuitry.Collective },
    { id: '6-59', gates: [6, 59], name: 'Mating', circuitry: Circuitry.Tribal },
    { id: '7-31', gates: [7, 31], name: 'The Alpha', circuitry: Circuitry.Collective },
    { id: '9-52', gates: [9, 52], name: 'Concentration', circuitry: Circuitry.Collective },
    { id: '10-20', gates: [10, 20], name: 'Awakening', circuitry: Circuitry.Integration },
    { id: '10-34', gates: [10, 34], name: 'Exploration', circuitry: Circuitry.Integration },
    { id: '10-57', gates: [10, 57], name: 'Perfected Form', circuitry: Circuitry.Integration },
    { id: '11-56', gates: [11, 56], name: 'Curiosity', circuitry: Circuitry.Collective },
    { id: '12-22', gates: [12, 22], name: 'Openness', circuitry: Circuitry.Individual },
    { id: '13-33', gates: [13, 33], name: 'The Prodigal', circuitry: Circuitry.Collective },
    { id: '16-48', gates: [16, 48], name: 'The Wavelength', circuitry: Circuitry.Collective },
    { id: '17-62', gates: [17, 62], name: 'Acceptance', circuitry: Circuitry.Collective },
    { id: '18-58', gates: [18, 58], name: 'Judgment', circuitry: Circuitry.Collective },
    { id: '19-49', gates: [19, 49], name: 'Synthesis', circuitry: Circuitry.Tribal },
    { id: '20-34', gates: [20, 34], name: 'Charisma', circuitry: Circuitry.Integration },
    { id: '20-57', gates: [20, 57], name: 'The Brain Wave', circuitry: Circuitry.Integration },
    { id: '21-45', gates: [21, 45], name: 'The Money Line', circuitry: Circuitry.Tribal },
    { id: '23-43', gates: [23, 43], name: 'Structuring', circuitry: Circuitry.Individual },
    { id: '24-61', gates: [24, 61], name: 'Awareness', circuitry: Circuitry.Individual },
    { id: '25-51', gates: [25, 51], name: 'Initiation', circuitry: Circuitry.Individual },
    { id: '26-44', gates: [26, 44], name: 'Surrender', circuitry: Circuitry.Tribal },
    { id: '27-50', gates: [27, 50], name: 'Preservation', circuitry: Circuitry.Tribal },
    { id: '28-38', gates: [28, 38], name: 'Struggle', circuitry: Circuitry.Individual },
    { id: '29-46', gates: [29, 46], name: 'Discovery', circuitry: Circuitry.Collective },
    { id: '30-41', gates: [30, 41], name: 'Recognition', circuitry: Circuitry.Collective },
    { id: '32-54', gates: [32, 54], name: 'Transformation', circuitry: Circuitry.Tribal },
    { id: '34-57', gates: [34, 57], name: 'Power', circuitry: Circuitry.Integration },
    { id: '35-36', gates: [35, 36], name: 'Transitoriness', circuitry: Circuitry.Collective },
    { id: '37-40', gates: [37, 40], name: 'Community', circuitry: Circuitry.Tribal },
    { id: '39-55', gates: [39, 55], name: 'Emoting', circuitry: Circuitry.Individual },
    { id: '42-53', gates: [42, 53], name: 'Maturation', circuitry: Circuitry.Collective },
    { id: '47-64', gates: [47, 64], name: 'Abstraction', circuitry: Circuitry.Collective }
];
