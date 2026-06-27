import { CalendarEventOptions } from '../../services/AstrologyWidgetsService';

export type SnapshotMode = 'quick' | 'standard' | 'deep' | 'moon';
export type SnapshotTab = 'snapshot' | 'ics-export';

export interface SnapshotProfile extends CalendarEventOptions {
    key: SnapshotMode;
    label: string;
    description: string;
}

export interface ModelOption {
    id: string;
    label: string;
}

export const ZODIAC_SIGNS = [
    { name: 'Aries', symbol: '♈', longitude: 0 },
    { name: 'Taurus', symbol: '♉', longitude: 30 },
    { name: 'Gemini', symbol: '♊', longitude: 60 },
    { name: 'Cancer', symbol: '♋', longitude: 90 },
    { name: 'Leo', symbol: '♌', longitude: 120 },
    { name: 'Virgo', symbol: '♍', longitude: 150 },
    { name: 'Libra', symbol: '♎', longitude: 180 },
    { name: 'Scorpio', symbol: '♏', longitude: 210 },
    { name: 'Sagittarius', symbol: '♐', longitude: 240 },
    { name: 'Capricorn', symbol: '♑', longitude: 270 },
    { name: 'Aquarius', symbol: '♒', longitude: 300 },
    { name: 'Pisces', symbol: '♓', longitude: 330 },
];

export const SNAPSHOT_PROFILES: Record<SnapshotMode, SnapshotProfile> = {
    quick: {
        key: 'quick',
        label: 'Quick',
        description: 'Core movements only',
        includeTightAspects: false,
        includeVoc: true,
        includeCriticalDegrees: true,
        includeConcentration: false,
    },
    standard: {
        key: 'standard',
        label: 'Standard',
        description: 'Balanced daily + weekly intelligence',
        includeTightAspects: true,
        includeVoc: true,
        tightAspectOrb: 2,
        includeCriticalDegrees: true,
        includeConcentration: true,
    },
    deep: {
        key: 'deep',
        label: 'Deep',
        description: 'Full event taxonomy with tighter filters',
        includeTightAspects: true,
        includeVoc: true,
        tightAspectOrb: 1.5,
        includeCriticalDegrees: true,
        includeConcentration: true,
        signConcentrationThreshold: 4,
        elementConcentrationThreshold: 5,
        modalityConcentrationThreshold: 5,
    },
    moon: {
        key: 'moon',
        label: 'Moon',
        description: 'Moon phases and ingress timing',
        includeTightAspects: false,
        includeVoc: true,
        includeCriticalDegrees: false,
        includeConcentration: false,
    },
};

export const TIMEZONE_ALIASES = [
    { label: 'UTC', value: 'UTC' },
    { label: 'EST (New York)', value: 'America/New_York' },
    { label: 'MST (Denver)', value: 'America/Denver' },
    { label: 'PST (Los Angeles)', value: 'America/Los_Angeles' },
    { label: 'GMT (London)', value: 'Europe/London' },
    { label: 'AEST (Sydney)', value: 'Australia/Sydney' },
];

export const RANGE_PRESETS = [1, 7, 14, 30, 60, 90, 180, 365];

export const MODEL_OPTIONS = [
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { id: 'google/gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' },
];

export const FALLBACK_MODELS: ModelOption[] = MODEL_OPTIONS.map((model) => ({
    id: model.id,
    label: model.label,
}));

export const PROMPT_PRESETS: Record<string, string> = {
    snapshot_talking_points: 'Write concise transit talking points for {{range_label}} in {{timezone}}. Emphasize high-severity events first and include practical coaching language.',
    monthly_horoscope: 'Write a weekly long-form horoscope for {{range_label}}. Use the event timeline, concentration alerts, and degree-watch notes to structure the narrative.',
    moon_planning: 'Create a moon-planning script for {{range_label}} in {{timezone}}, with guidance around phases, moon ingresses, and major aspect/weather shifts.',
};
