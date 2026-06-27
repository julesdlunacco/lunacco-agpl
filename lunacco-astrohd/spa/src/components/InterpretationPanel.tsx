import React, { useMemo } from 'react';
import { Definition, parseDefinitionMarkdown, CoreResolvedSlot, ResolvedEntityGroup } from '../services/DefinitionService';
import { Info, Sparkles, BookOpen, Quote, Target, Heart, Wand2, MessageCircle } from 'lucide-react';
import { CardFrame, SlotBox } from './composer/EditorialBoxes';

interface InterpretationPanelProps {
    /** Legacy single-Definition rendering (existing views). */
    definition?: Definition | null;
    /**
     * Resolver-driven editorial boxes (Chart Maker / preset-aware sidebar).
     * When provided, these take precedence over `definition`.
     */
    boxes?: CoreResolvedSlot[] | null;
    /** Title shown for the resolver-driven path. */
    title?: string;
    /** Small caption under the title (e.g. "astro planet · sun"). */
    subtitle?: string;
    /** Ordered allow-list of slot_keys; boxes are sorted/filtered to match. */
    slotOrder?: string[];
    /** Suppress prose, show data only. */
    dataOnly?: boolean;
    /** Resolver-driven results grouped per entity (preferred — gives labeled sections). */
    groups?: ResolvedEntityGroup[] | null;
    /** Woven synth reading (rendered HTML/markdown text) shown above the grouped boxes. */
    synth?: string | null;
    isLoading?: boolean;
}

/** Friendly label for an entity section type chip. */
function sectionTypeLabel(sectionType: string): string {
    const map: Record<string, string> = {
        hd_gate: 'Gate', hd_center: 'Center', hd_channel: 'Channel', hd_planet: 'HD Planet',
        astro_planet: 'Planet', astro_sign: 'Sign', astro_house: 'House', astro_aspect: 'Aspect',
        hd_type: 'Type', hd_authority: 'Authority', hd_profile: 'Profile',
        hd_definition_type: 'Definition', hd_incarnation_cross: 'Incarnation Cross',
        hd_variable: 'Variable', hd_destiny_point: 'Destiny Point',
    };
    return map[sectionType] || sectionType.replace(/_/g, ' ');
}

/** Per-slot presentation metadata: a friendly label + an icon. */
const SLOT_META: Record<string, { label: string; icon: any }> = {
    short_def:        { label: 'Essence',           icon: Info },
    long_def:         { label: 'In Depth',          icon: BookOpen },
    gift:             { label: 'The Gift',          icon: Heart },
    gift_short:       { label: 'The Gift',          icon: Heart },
    gift_long:        { label: 'The Gift',          icon: Heart },
    shadow_recessive: { label: 'Shadow · Recessive', icon: Target },
    shadow_reactive:  { label: 'Shadow · Reactive',  icon: Target },
    shadow_short:     { label: 'The Shadow',        icon: Target },
    shadow_long:      { label: 'The Shadow',        icon: Target },
    coaching_key_notes: { label: 'Coaching Notes',  icon: MessageCircle },
    coaching_questions: { label: 'Coaching Questions', icon: Quote },
    coaching_notes:   { label: 'Coaching',          icon: MessageCircle },
    affirmation:      { label: 'Affirmation',       icon: Sparkles },
    eft_script:       { label: 'EFT Script',        icon: Wand2 },
    practice_prompt:  { label: 'Practice',          icon: Wand2 },
    journal_prompt:   { label: 'Journal Prompt',    icon: Quote },
};

function slotMeta(slotKey: string, fallbackTitle: string) {
    const meta = SLOT_META[slotKey];
    return {
        label: meta?.label || fallbackTitle || slotKey.replace(/_/g, ' '),
        Icon: meta?.icon || Info,
    };
}

/** Order + filter resolved boxes against a slotOrder allow-list. */
function orderBoxes(boxes: CoreResolvedSlot[], slotOrder?: string[]): CoreResolvedSlot[] {
    const present = boxes.filter((b) => b.value && b.value.trim());
    if (!slotOrder || slotOrder.length === 0) return present;
    const rank = new Map(slotOrder.map((k, i) => [k, i]));
    return present
        .filter((b) => rank.has(b.slot_key))
        .sort((a, b) => (rank.get(a.slot_key)! - rank.get(b.slot_key)!));
}

export const InterpretationPanel: React.FC<InterpretationPanelProps> = ({
    definition,
    boxes,
    title,
    subtitle,
    slotOrder,
    dataOnly,
    groups,
    synth,
    isLoading,
}) => {
    const orderedBoxes = useMemo(
        () => (boxes ? orderBoxes(boxes, slotOrder) : []),
        [boxes, slotOrder]
    );

    const sections = useMemo(() => {
        if (boxes) return {} as any;
        if (!definition?.long_text) return {} as any;
        return parseDefinitionMarkdown(definition.long_text);
    }, [definition, boxes]);

    if (isLoading) {
        return (
            <div className="interpretation-panel-loading p-12 flex flex-col items-center justify-center text-[var(--mute)] animate-pulse">
                <Sparkles size={32} className="mb-4 opacity-20" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Resolving Interpretation...</span>
            </div>
        );
    }

    // ---- Grouped, labeled rendering (Chart Maker) ----------------------------
    if (groups || synth) {
        const ordered = (g: ResolvedEntityGroup) => orderBoxes(g.boxes, slotOrder);
        const hasSynth = !!(synth && synth.trim());
        const hasContent = hasSynth || (groups || []).some((g) => g.boxes.length);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--card)', borderLeft: '1px solid var(--hair)' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hair)', background: 'var(--paper)', flexShrink: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--gold)' }}>Interpretation</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink)', marginTop: 2 }}>
                        {title || 'Selection'}
                    </div>
                </div>

                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {!hasContent && (
                        <div style={{ textAlign: 'center', padding: '32px 8px', color: 'var(--mute)' }}>
                            <Info size={26} style={{ opacity: 0.25, marginBottom: 10 }} />
                            <p style={{ fontSize: 12, fontStyle: 'italic', margin: 0 }}>Click a gate, center, planet, sign, or house to see its meaning.</p>
                        </div>
                    )}
                    {dataOnly && hasContent && (
                        <p style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--mute)' }}>Data-only view — prose hidden by this chart preset.</p>
                    )}
                    {!dataOnly && hasSynth && (
                        <CardFrame kicker="Synthesis" title={title || 'Reading'}>
                            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink)', opacity: 0.92 }}
                                dangerouslySetInnerHTML={{ __html: String(synth).replace(/\n/g, '<br/>') }} />
                        </CardFrame>
                    )}
                    {!dataOnly && (groups || []).map((g, gi) => {
                        const gboxes = ordered(g);
                        if (!gboxes.length) return null;
                        return (
                            <CardFrame key={`${g.sectionType}-${g.label}-${gi}`}
                                kicker={sectionTypeLabel(g.sectionType)} title={g.label}>
                                {gboxes.map((box) => (
                                    <SlotBox key={box.slot_key} slotKey={box.slot_key} value={box.value}
                                        label={`${slotMeta(box.slot_key, box.title).label} of ${sectionTypeLabel(g.sectionType)}`} />
                                ))}
                            </CardFrame>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ---- Resolver-driven (preset-aware) rendering ----------------------------
    if (boxes) {
        if (!title && orderedBoxes.length === 0) {
            return (
                <div className="interpretation-panel-empty p-12 flex flex-col items-center justify-center text-[var(--mute)] text-center">
                    <Info size={32} className="mb-4 opacity-20" />
                    <h3 className="text-sm font-bold uppercase tracking-[0.1em] mb-2">Select an Activation</h3>
                    <p className="text-xs italic max-w-[200px]">Click on a gate, center, or planet to explore its meaning.</p>
                </div>
            );
        }
        return (
            <div className="interpretation-panel flex flex-col h-full bg-[var(--card)] border-l border-[var(--hair)]">
                <div className="p-6 border-b border-[var(--hair)] bg-[var(--paper)]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--indigo)]/5 flex items-center justify-center text-[var(--indigo)]">
                            <BookOpen size={16} />
                        </div>
                        <div>
                            <h2 className="text-xl font-normal italic text-[var(--ink)] leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                                {title || 'Interpretation'}
                            </h2>
                            {subtitle && (
                                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] opacity-60">
                                    {subtitle}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                    {dataOnly ? (
                        <p className="text-xs italic text-[var(--mute)]">Data-only view — prose hidden by this chart preset.</p>
                    ) : orderedBoxes.length > 0 ? (
                        orderedBoxes.map((box) => (
                            <SlotBox key={box.slot_key} slotKey={box.slot_key} value={box.value}
                                label={slotMeta(box.slot_key, box.title).label} />
                        ))
                    ) : (
                        <div className="py-12 text-center">
                            <p className="text-xs italic text-[var(--mute)]">No definition content for the selected slots in this set/tone.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ---- Legacy single-Definition rendering ---------------------------------
    if (!definition) {
        return (
            <div className="interpretation-panel-empty p-12 flex flex-col items-center justify-center text-[var(--mute)] text-center">
                <Info size={32} className="mb-4 opacity-20" />
                <h3 className="text-sm font-bold uppercase tracking-[0.1em] mb-2">Select an Activation</h3>
                <p className="text-xs italic max-w-[200px]">Click on a gate, center, or planet to explore its deeper meaning and purpose.</p>
            </div>
        );
    }

    const sectionIcons: Record<string, any> = {
        'long': BookOpen,
        'what it is': Info,
        'the gift': Heart,
        'the shadow': Target,
        'how to work with it': Sparkles,
        'coaching questions': Quote,
        'affirmations': Heart,
    };

    const displaySections = Object.entries(sections).filter(([key]) => key !== 'short' && key !== 'keywords');

    return (
        <div className="interpretation-panel flex flex-col h-full bg-[var(--card)] border-l border-[var(--hair)]">
            {/* Header */}
            <div className="p-6 border-b border-[var(--hair)] bg-[var(--paper)]">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-[var(--indigo)]/5 flex items-center justify-center text-[var(--indigo)]">
                        <BookOpen size={16} />
                    </div>
                    <div>
                        <h2 className="text-xl font-normal italic text-[var(--ink)] leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                            {definition.title}
                        </h2>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mute)] opacity-60">
                            {definition.section_type.replace(/_/g, ' ')} · {definition.item_key}
                        </div>
                    </div>
                </div>
                {(sections as any)['short'] && (
                    <p className="text-sm text-[var(--ink)] leading-relaxed italic opacity-80 border-l-2 border-[var(--gold)] pl-4 py-1">
                        {(sections as any)['short']}
                    </p>
                )}
            </div>

            {/* Content Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                {displaySections.length > 0 ? (
                    displaySections.map(([title, content]) => {
                        const Icon = sectionIcons[title] || Info;
                        return (
                            <section key={title} className="space-y-3">
                                <div className="flex items-center gap-2 text-[var(--gold)]">
                                    <Icon size={14} />
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.25em]">{title}</h4>
                                </div>
                                <div
                                    className="prose prose-sm prose-invert max-w-none text-[var(--ink)] leading-relaxed opacity-90"
                                    dangerouslySetInnerHTML={{ __html: String(content).replace(/\n/g, '<br/>') }}
                                />
                            </section>
                        );
                    })
                ) : (
                    <div className="py-12 text-center">
                        <p className="text-xs italic text-[var(--mute)]">No detailed interpretation available for this set.</p>
                        <button className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[var(--indigo)] hover:underline">
                            Edit in Definitions
                        </button>
                    </div>
                )}
            </div>

            {/* Footer / Meta */}
            {definition.keywords && (
                <div className="p-4 bg-[var(--paper)] border-t border-[var(--hair)]">
                    <div className="flex flex-wrap gap-2">
                        {definition.keywords.split(',').map(kw => (
                            <span key={kw} className="px-2 py-1 bg-[var(--card)] border border-[var(--hair)] text-[9px] font-bold uppercase tracking-wider text-[var(--mute)]">
                                {kw.trim()}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
