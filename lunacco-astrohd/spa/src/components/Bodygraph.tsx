import React from 'react';
import { ChartData, Activation } from '../services/HumanDesignLogic';
import { FixingState } from '../services/fixationData';
import { Center } from '../services/HumanDesignDefinitions';

import { GATE_POSITIONS } from './gatePositions';
import { ConnectionAnalysis } from '../services/ConnectionLogic';
import { analyzeShadowChart, ShadowAnalysis } from '../services/ShadowChartLogic';
import { BodygraphLayers, DEFAULT_BODYGRAPH_LAYERS } from '../services/chartConfig';
import { LunaccoBodygraph } from './LunaccoBodygraph';

interface BodygraphProps {
    data: ChartData | null;
    connectionAnalysis?: ConnectionAnalysis | null;
    mini?: boolean;
    hideVariables?: boolean;
    /** Modular layer toggles. Omitted => all layers shown (legacy behavior). */
    layers?: Partial<BodygraphLayers>;
    theme?: {
        centerColor?: string;
        strokeColor?: string;
        designColor?: string;
        personalityColor?: string;
        textColor?: string;
        arrowColor?: string;
        fontFamily?: string;
        activeGateCircleColor?: string;
        bodygraphTextColor?: string;
        bodygraphActiveTextColor?: string;
        connectionElectromagneticColor?: string;
        connectionCompromiseColor?: string;
        connectionCompanionColor?: string;
        connectionDominanceColor?: string;
        shadowUndefinedCenterColor?: string;
        shadowDefinedCenterColor?: string;
        shadowConditioningColor?: string;
        shadowMentalColor?: string;
        shadowTranspersonalColor?: string;
        shadowHarmonicColor?: string;
    };
    onElementClick?: (type: 'gate' | 'center', id: string, label?: string) => void;
    highlightedGate?: number;
    highlightedCenter?: string;
    shadowMode?: boolean;
    shadowAnalysis?: ShadowAnalysis;
}

// Planets to exclude from gate activation (they don't activate gates in HD)
const EXCLUDED_PLANETS = ['Chiron', 'Black Moon Lilith', 'Vulcan', 'Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex'];

export const Bodygraph: React.FC<BodygraphProps> = ({ 
    data, 
    connectionAnalysis, 
    mini: _mini,
    hideVariables = false,
    layers,
    theme,
    onElementClick,
    highlightedGate,
    highlightedCenter,
    shadowMode = false,
    shadowAnalysis
}) => {
    // Resolve layer toggles, defaulting to the full legacy rendering.
    const L: BodygraphLayers = { ...DEFAULT_BODYGRAPH_LAYERS, ...(layers || {}) };

    // The LunaCco artwork is the default style across every chart (natal,
    // connection, shadow, transit); it carries connection/shadow coloring too.
    if (L.style === 'lunacco') {
        return (
            <LunaccoBodygraph
                data={data}
                connectionAnalysis={connectionAnalysis}
                mini={_mini}
                hideVariables={hideVariables}
                layers={layers}
                theme={theme}
                onElementClick={onElementClick}
                highlightedGate={highlightedGate}
                highlightedCenter={highlightedCenter}
                shadowMode={shadowMode}
                shadowAnalysis={shadowAnalysis}
            />
        );
    }
    const showGates = L.show && L.gates;
    const showCenters = L.show && L.centers;
    const showCenterLabels = L.show && L.centers && L.centerLabels;
    const showGateLabels = L.show && L.gateLabels;
    // `hideVariables` (legacy prop) still wins as an explicit override.
    const variableArrowMode = hideVariables ? 'off' : (L.show ? L.variableArrows : 'off');
    const showVariables = variableArrowMode !== 'off';
    const showVariableLabels = variableArrowMode === 'full';
    const designColor = theme?.designColor || 'var(--hd-design, #ff0000)'; 
    const personalityColor = theme?.personalityColor || 'var(--hd-personality, #000000)'; 
    const activeFill = theme?.centerColor || 'var(--hd-active, #fbbf24)'; 
    const inactiveFill = '#FFFFFF';
    const stroke = theme?.strokeColor || 'var(--ink, #000000)';
    const arrowColor = theme?.arrowColor || 'var(--hd-variable-arrow, var(--ink, #000000))';
    const fontFamily = theme?.fontFamily || 'var(--font-ui, sans-serif)';
    const activeGateCircleColor = theme?.activeGateCircleColor || 'var(--hd-gate-circle, var(--paper, #ffffff))';
    // Centers must be opaque so channels never show through them (fallbacks are
    // solid, and the theme tokens are emitted opaque too).
    const shadowCenterFill = theme?.shadowUndefinedCenterColor || 'var(--hd-shadow-center, #dbe2f4)';
    const shadowDefinedCenterFill = theme?.shadowDefinedCenterColor || 'var(--hd-shadow-defined-center, #e6e6ea)';
    const shadowColors = {
        'conditioning-receptor': theme?.shadowConditioningColor || 'var(--hd-shadow-conditioning, #2f9f6b)',
        'mental-conditioner': theme?.shadowMentalColor || 'var(--hd-shadow-mental, #c23b4a)',
        'transpersonal-conditioner': theme?.shadowTranspersonalColor || 'var(--hd-shadow-transpersonal, #3f7fc0)',
        'harmonic-influencer': theme?.shadowHarmonicColor || 'var(--hd-shadow-harmonic, #8c5fbf)',
    };
    const baseTextColor = 'var(--hd-gate-text-inactive, var(--mute, #666666))';
    const activeTextColor = 'var(--hd-gate-text-active, var(--ink, #000000))';
    const isTransit = (data as any)?.isTransit;
    const isMini = !!_mini;
    const definedCenters = React.useMemo(
        () => data?.definedCenters instanceof Set ? data.definedCenters : new Set(data?.definedCenters || []),
        [data]
    );
    const resolvedShadowAnalysis = React.useMemo(
        () => shadowAnalysis || (shadowMode && data ? analyzeShadowChart(data) : null),
        [shadowAnalysis, shadowMode, data]
    );

    // Connection mode: use analysis results to color channels/gates
    const getConnectionGateColor = (gateId: number): string => {
        if (!connectionAnalysis || !data) return 'none';

        // First check if this gate is active in the composite at all
        const isActiveInComposite = data.activeGates.has(gateId);
        if (!isActiveInComposite) return 'none';

        // Check if this gate is part of a classified channel (has special color)
        const electro = connectionAnalysis.electromagnetic.find(ch =>
            ch.gates.gate1 === gateId || ch.gates.gate2 === gateId
        );
        if (electro) return theme?.connectionElectromagneticColor || '#8b5cf6';

        const compromise = connectionAnalysis.compromise.find(ch =>
            ch.gates.gate1 === gateId || ch.gates.gate2 === gateId
        );
        if (compromise) return theme?.connectionCompromiseColor || '#f59e0b';

        const companion = connectionAnalysis.companion.find(ch =>
            ch.gates.gate1 === gateId || ch.gates.gate2 === gateId
        );
        if (companion) return theme?.connectionCompanionColor || '#3b82f6';

        const dominance = connectionAnalysis.dominance.find(ch =>
            ch.gates.gate1 === gateId || ch.gates.gate2 === gateId
        );
        if (dominance) return theme?.connectionDominanceColor || '#10b981';

        // Gate is active but not part of a complete channel (hanging gate)
        // Use a neutral gray color to show it's present but not connected
        return '#9ca3af'; // Gray for hanging gates
    };

    const getGateColor = (gateId: number): string => {
        if (!data) return 'none';

        // If in connection mode, use connection colors
        if (connectionAnalysis) {
            return getConnectionGateColor(gateId);
        }
        
        // Check activations, excluding Chiron and Lilith
        const pActive = Object.entries(data.birthActivations)
            .filter(([name]) => !EXCLUDED_PLANETS.includes(name))
            .some(([, a]) => a.gate === gateId);
        const dActive = isTransit
            ? false
            : Object.entries(data.designActivations)
                .filter(([name]) => !EXCLUDED_PLANETS.includes(name))
                .some(([, a]) => a.gate === gateId);

        if (!isTransit && pActive && dActive) return 'url(#split-fill)';
        if (pActive) return personalityColor;
        if (!isTransit && dActive) return designColor;
        return 'none';
    };

    const isGateActive = (gateId: number): boolean => {
        if (shadowMode) {
            return getGateColor(gateId) !== 'none' || !!resolvedShadowAnalysis?.gateTypes?.[gateId];
        }
        return getGateColor(gateId) !== 'none';
    };

    const getGateInfo = (gateId: number): string => {
        if (!data) return '';
        const personality = Object.entries(data.birthActivations)
            .filter(([name, a]) => a.gate === gateId && !EXCLUDED_PLANETS.includes(name))
            .map(([name, a]) => `P: ${name} (${a.sign} H${a.house})`);
        const design = Object.entries(data.designActivations)
            .filter(([name, a]) => a.gate === gateId && !EXCLUDED_PLANETS.includes(name))
            .map(([name, a]) => `D: ${name} (${a.sign} H${a.house})`);
        
        return [...personality, ...design].join('\n');
    };

    const getGateFixations = (gateId: number): FixingState => {
        if (!data) return FixingState.None;
        let combined = FixingState.None;

        const pActivations = Object.entries(data.birthActivations)
            .filter(([name]) => !EXCLUDED_PLANETS.includes(name))
            .map(([, a]) => a);
        const dActivations = isTransit ? [] : Object.entries(data.designActivations)
            .filter(([name]) => !EXCLUDED_PLANETS.includes(name))
            .map(([, a]) => a);

        for (const a of [...pActivations, ...dActivations]) {
            if (a.gate === gateId && a.fixation) {
                combined |= (a.fixation as number);
            }
        }
        return combined as FixingState;
    };



    const getCenterFill = (centerName: string): string => {
        if (!data) return inactiveFill;
        
        let enumKey: Center | null = null;
        switch(centerName) {
            case 'center-root': enumKey = Center.Root; break;
            case 'center-sacral': enumKey = Center.Sacral; break;
            case 'center-emotional-solar-plexus': enumKey = Center.Emotions; break;
            case 'center-spleen': enumKey = Center.Spleen; break;
            case 'center-will': enumKey = Center.Ego; break; 
            case 'center-g-center': enumKey = Center.Self; break; 
            case 'center-throat': enumKey = Center.Throat; break;
            case 'center-ajna': enumKey = Center.Mind; break;
            case 'center-head': enumKey = Center.Crown; break;
        }

        if (shadowMode) {
            return enumKey && definedCenters.has(enumKey) ? shadowDefinedCenterFill : shadowCenterFill;
        }

        if (enumKey && definedCenters.has(enumKey)) {
            return activeFill; 
        }
        return inactiveFill;
    };

    // Render variable arrow with color in circle and tone in triangle
    const renderVariableArrow = (
        x: number, 
        y: number, 
        orientation: 'Left' | 'Right', 
        colorNum: number, 
        toneNum: number, 
        isRightSide: boolean
    ) => {
        // Arrow pointing direction
        const arrowSize = 8;
        const arrowX = isRightSide ? x + 45 : x;
        const arrowPoints = orientation === 'Left' 
            ? `${arrowX + arrowSize},${y} ${arrowX},${y + arrowSize / 2} ${arrowX + arrowSize},${y + arrowSize}` 
            : `${arrowX},${y} ${arrowX + arrowSize},${y + arrowSize / 2} ${arrowX},${y + arrowSize}`;
        
        // Position circle and triangle based on side
        const circleX = isRightSide ? x + 30 : x + 18;
        const triangleX = isRightSide ? x + 12 : x + 36;
        const shapeY = y + 4;
        
        return (
            <g>
                {/* Arrow */}
                <polygon points={arrowPoints} fill={arrowColor} />
                
                {/* Circle with color number */}
                <circle cx={circleX} cy={shapeY} r="7" fill="none" stroke={arrowColor} strokeWidth="1.5" />
                <text 
                    x={circleX} 
                    y={shapeY + 3} 
                    fontSize="8" 
                    fontWeight="600"
                    fontFamily={fontFamily}
                    textAnchor="middle"
                    fill={arrowColor}
                >
                    {colorNum}
                </text>
                
                {/* Triangle with tone number - larger for readability */}
                <polygon 
                    points={`${triangleX},${shapeY - 8} ${triangleX - 8},${shapeY + 7} ${triangleX + 8},${shapeY + 7}`} 
                    fill="none" 
                    stroke={arrowColor} 
                    strokeWidth="1.5" 
                />
                <text 
                    x={triangleX} 
                    y={shapeY + 4} 
                    fontSize="8" 
                    fontWeight="600"
                    fontFamily={fontFamily}
                    textAnchor="middle"
                    fill={arrowColor}
                >
                    {toneNum}
                </text>
            </g>
        );
    };

    const handleSvgClick = (event: React.MouseEvent<SVGSVGElement>) => {
        if (!onElementClick) return;
        const target = event.target as HTMLElement | null;
        const node = target?.closest?.('[id]') as HTMLElement | null;
        const id = node?.id ?? '';
        if (!id) return;

        if (id.startsWith('gate-')) {
            const gateId = id.replace('gate-', '');
            onElementClick('gate', gateId, `Gate ${gateId}`);
            return;
        }

        if (id.startsWith('center-')) {
            const centerId = id.replace('center-', '');
            onElementClick('center', centerId, centerId.replace(/-/g, ' '));
        }
    };

    return (
        <div className="bodygraph-container" style={{ fontFamily, width: '100%', minWidth: isMini ? '250px' : '300px' }}>
            <svg id="bodygraph-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 275.338 421.458" style={{ width: '100%', height: 'auto', display: 'block' }} onClick={handleSvgClick}>
                <defs>
                    {/* Striped pattern for gates active in both Design and Personality */}
                    <pattern id="split-fill" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                        <rect width="2" height="4" fill={designColor} />
                        <rect x="2" width="2" height="4" fill={personalityColor} />
                    </pattern>

                    {/* Glow filter for highlighting elements */}
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>
                
                {showVariables && data && data.variables && (
                    <g id="variables">
                        {showVariableLabels && <text x="8" y="27" fontSize="5.5" fontWeight="700" fontFamily={fontFamily}
                            fill={arrowColor} letterSpacing="0.08em" textAnchor="start" opacity="0.7">BRAIN</text>}
                        {renderVariableArrow(8, 30, data.variables.digestion.orientation, data.variables.digestion.color, data.variables.digestion.tone, false)}
                        {showVariableLabels && <text x="8" y="47" fontSize="5.5" fontWeight="700" fontFamily={fontFamily}
                            fill={arrowColor} letterSpacing="0.08em" textAnchor="start" opacity="0.7">ENVIRONMENT</text>}
                        {renderVariableArrow(8, 50, data.variables.environment.orientation, data.variables.environment.color, data.variables.environment.tone, false)}

                        {showVariableLabels && <text x="267" y="27" fontSize="5.5" fontWeight="700" fontFamily={fontFamily}
                            fill={arrowColor} letterSpacing="0.08em" textAnchor="end" opacity="0.7">MOTIVATION</text>}
                        {renderVariableArrow(212, 30, data.variables.motivation.orientation, data.variables.motivation.color, data.variables.motivation.tone, true)}
                        {showVariableLabels && <text x="267" y="47" fontSize="5.5" fontWeight="700" fontFamily={fontFamily}
                            fill={arrowColor} letterSpacing="0.08em" textAnchor="end" opacity="0.7">PERSPECTIVE</text>}
                        {renderVariableArrow(212, 50, data.variables.perspective.orientation, data.variables.perspective.color, data.variables.perspective.tone, true)}
                    </g>
                )}

                <g id="Bodygraph">
                    {showGates && (<>{/* Gates */}
                    <path id="gate-18" d="M52.269,384.953c-26.98-22.419-35.341-47.956-35.684-49.032l5.716-1.824c.08.248,8.243,25.003,33.803,46.241l-3.835,4.615Z" fill={getGateColor(18)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 18 ? 'url(#glow)' : undefined} />
                    <path id="gate-48" d="M16.787,289.086l-5.94-.847c.067-.472,7.032-47.716,33.82-91.682l5.124,3.122c-26.123,42.875-32.938,88.945-33.004,89.406Z" fill={getGateColor(48)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 48 ? 'url(#glow)' : undefined} />
                    <path id="gate-57" d="M46.382,248.966l-2.813-1.043h0s0,0,0,0l-2.813-1.043c-11.145,30.055-14.299,53.815-14.428,54.812l2.975.385h0s0,0,0,0l2.975.385c.031-.237,3.194-24.076,14.104-53.496Z" fill={getGateColor(57)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 57 ? 'url(#glow)' : undefined} />
                    <path id="gate-28" d="M65.657,375.172c-29.698-23.149-32.107-39.102-32.195-39.77l5.943-.819c.022.143,2.543,14.5,29.94,35.856l-3.688,4.732Z" fill={getGateColor(28)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 28 ? 'url(#glow)' : undefined} />
                    <path id="gate-32" d="M76.389,363.518c-29.271-22.539-30.517-32.022-30.47-33.694l5.998.17s.016-.083-.007-.253c.011.082,1.39,8.426,28.139,29.023l-3.66,4.754Z" fill={getGateColor(32)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 32 ? 'url(#glow)' : undefined} />
                    <path id="gate-50" d="M85.501,331.192c-19.059-.684-29.398-5.707-29.829-5.921l2.657-5.379c.095.047,9.744,4.671,27.386,5.304l-.215,5.996Z" fill={getGateColor(50)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 50 ? 'url(#glow)' : undefined} />
                    <path id="gate-44" d="M44.755,308.164l-3.641-4.77c21.304-16.265,44.008-27.66,67.482-33.872l1.535,5.801c-22.707,6.008-44.703,17.058-65.376,32.841Z" fill={getGateColor(44)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 44 ? 'url(#glow)' : undefined} />
                    <path id="gate-26" d="M110.131,275.323l-1.535-5.801c42.541-11.257,72.593-1.748,73.851-1.338l-1.856,5.706s-.002,0-.003,0h0c-.46-.147-29.853-9.313-70.457,1.434Z" fill={getGateColor(26)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 26 ? 'url(#glow)' : undefined} />
                    <path id="gate-21" d="M210.989,250.532c-1.908.963-3.295-19.873-22.118-45.215l4.977-3.352c16.664,24.748,23.087,49.529,23.087,49.529,0,0-5.943-.968-5.945-.963Z" fill={getGateColor(21)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 21 ? 'url(#glow)' : undefined} />
                    <path id="gate-51" d="M196.728,258.697c-.038-.053-3.877-5.388-17.359-18.13l4.121-4.361c14.071,13.3,17.987,18.812,18.146,19.041l-4.908,3.45Z" fill={getGateColor(51)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 51 ? 'url(#glow)' : undefined} />
                    <path id="gate-40" d="M225.626,290.455c-2.777-6.363-1.728-3.517-9.345-15.788l5.996-2.16c5.284,7.8,3.585,4.937,8.722,15.278l-5.373,2.67Z" fill={getGateColor(40)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 40 ? 'url(#glow)' : undefined} />
                    <path id="gate-36" d="M258.632,292.945c-.063-.483-6.668-48.838-33.119-93.156l5.152-3.075c27.107,45.419,33.851,94.955,33.916,95.45l-5.949.781Z" fill={getGateColor(36)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 36 ? 'url(#glow)' : undefined} />
                    <path id="gate-22" d="M244.785,298.172c-.055-.436-5.788-44.054-30.862-87.185l5.188-3.016c25.713,44.229,31.571,89.004,31.628,89.451l-5.953.749Z" fill={getGateColor(22)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 22 ? 'url(#glow)' : undefined} />
                    <path id="gate-37" d="M231.802,304.665c-.042-.38-.534-2.85-6.176-14.211l5.373-2.668c2.924,5.885,4.918,10.294,5.929,13.103,0,0-5.176,3.321-5.126,3.776Z" fill={getGateColor(37)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 37 ? 'url(#glow)' : undefined} />
                    <path id="gate-6" d="M190.976,330.985c-1.787,0-3.522-.064-5.227-.15l.301-5.992c7.91.395,15.899.32,26.6-4.894l2.629,5.395c-9.538,4.646-17.305,5.642-24.303,5.642Z" fill={getGateColor(6)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 6 ? 'url(#glow)' : undefined} />
                    <path id="gate-30" d="M221.416,382.751l-3.949-4.518c23.844-20.843,32.643-44.035,32.729-44.267l5.625,2.088c-.373,1.005-9.427,24.861-34.404,46.696Z" fill={getGateColor(30)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 30 ? 'url(#glow)' : undefined} />
                    <path id="gate-55" d="M206.886,374.032l-3.752-4.682c26.543-21.277,30.122-36.546,30.154-36.697l5.877,1.208c-.14.696-3.766,17.314-32.279,40.171Z" fill={getGateColor(55)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 55 ? 'url(#glow)' : undefined} />
                    <path id="gate-49" d="M195.717,362.736l-3.705-4.719c25.354-19.906,25.474-27.604,25.472-27.679,0,0,.004.136.073.381l5.775-1.623c.646,2.298.564,11.516-27.615,33.64Z" fill={getGateColor(49)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 49 ? 'url(#glow)' : undefined} />
                    <path id="gate-41" d="M159.842,413.525l-1.303-5.857c22.481-5.001,42.308-14.904,58.928-29.434l3.949,4.518c-17.385,15.197-38.101,25.551-61.574,30.773Z" fill={getGateColor(41)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 41 ? 'url(#glow)' : undefined} />
                    <path id="gate-39" d="M158.003,398.511l-1.303-5.857c22.868-5.087,32.543-12.169,46.434-23.303l3.752,4.682c-14.617,11.716-25.201,19.21-48.883,24.479Z" fill={getGateColor(39)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 39 ? 'url(#glow)' : undefined} />
                    <path id="gate-19" d="M159.165,380.506l-1.706-5.752c.213-.063,21.437-6.438,34.553-16.736l3.705,4.719c-14.028,11.016-35.639,17.499-36.552,17.77Z" fill={getGateColor(19)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 19 ? 'url(#glow)' : undefined} />
                    <path id="gate-58" d="M111.26,413.525c-22.297-4.961-42.145-14.573-58.991-28.571l3.835-4.615c16.106,13.383,35.102,22.578,56.459,27.329l-1.303,5.857Z" fill={getGateColor(58)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 58 ? 'url(#glow)' : undefined} />
                    <path id="gate-38" d="M115.52,399.021c-22.666-5.043-35.011-12.272-49.863-23.849l3.688-4.732c14.161,11.038,25.921,17.928,47.477,22.724l-1.303,5.857Z" fill={getGateColor(38)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 38 ? 'url(#glow)' : undefined} />
                    <path id="gate-54" d="M116.927,382.045c-23.173-5.156-26.82-7.964-40.389-18.412l-.149-.115,3.66-4.754.15.115c13.375,10.3,16.159,12.442,38.031,17.309l-1.303,5.857Z" fill={getGateColor(54)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 54 ? 'url(#glow)' : undefined} />
                    <rect id="gate-53" x="118.855" y="350.849" width="6" height="16.593" fill={getGateColor(53)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 53 ? 'url(#glow)' : undefined} />
                    <rect id="gate-60" x="134.74" y="350.849" width="6" height="16.113" fill={getGateColor(60)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 60 ? 'url(#glow)' : undefined} />
                    <rect id="gate-52" x="150.624" y="350.849" width="6" height="16.113" fill={getGateColor(52)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 52 ? 'url(#glow)' : undefined} />
                    <rect id="gate-3" x="134.74" y="333.568" width="6" height="17.28" fill={getGateColor(3)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 3 ? 'url(#glow)' : undefined} />
                    <rect id="gate-9" x="150.624" y="335.011" width="6" height="15.838" fill={getGateColor(9)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 9 ? 'url(#glow)' : undefined} />
                    <rect id="gate-42" x="118.855" y="333.568" width="6" height="17.28" fill={getGateColor(42)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 42 ? 'url(#glow)' : undefined} />
                    <path id="gate-27" d="M87.61,331.231c-.704,0-1.406-.013-2.109-.038l.214-5.996c9.217.331,18.499-1.753,27.603-6.188l2.628,5.395c-9.309,4.534-18.831,6.828-28.335,6.828Z" fill={getGateColor(27)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 27 ? 'url(#glow)' : undefined} />
                    <path id="gate-34" d="M108.945,301.588c-28.557-.181-45.667-14.441-54.99-26.373-10.046-12.856-13.334-25.547-13.469-26.081l5.816-1.475c.031.12,3.182,12.168,12.52,24.038,12.367,15.721,29.244,23.759,50.162,23.891l-.038,6Z" fill={getGateColor(34)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 34 ? 'url(#glow)' : undefined} />
                    <path id="gate-59" d="M185.75,330.835c-18.64-.932-28.45-6.105-28.858-6.325l2.842-5.283-1.421,2.642,1.413-2.646c.09.048,9.17,4.763,26.323,5.621l-.299,5.992Z" fill={getGateColor(59)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 59 ? 'url(#glow)' : undefined} />
                    <rect id="gate-5" x="118.855" y="269.632" width="6" height="21.456" fill={getGateColor(5)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 5 ? 'url(#glow)' : undefined} />
                    <rect id="gate-14" x="134.74" y="268.528" width="6" height="22.56" fill={getGateColor(14)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 14 ? 'url(#glow)' : undefined} />
                    <rect id="gate-29" x="150.624" y="267.076" width="6" height="25.479" fill={getGateColor(29)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 29 ? 'url(#glow)' : undefined} />
                    <rect id="gate-2" x="134.74" y="243.391" width="6" height="25.138" fill={getGateColor(2)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 2 ? 'url(#glow)' : undefined} />
                    <rect id="gate-46" x="150.624" y="244.528" width="6" height="22.548" fill={getGateColor(46)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 46 ? 'url(#glow)' : undefined} />
                    <rect id="gate-15" x="118.855" y="245.968" width="6" height="23.664" fill={getGateColor(15)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 15 ? 'url(#glow)' : undefined} />
                    <path id="gate-10" d="M45.975,249.716l-4.812-3.586c18.057-24.23,37.958-30.669,51.475-31.804,14.745-1.239,25.119,3.33,25.553,3.524l-2.451,5.477c-.095-.041-9.625-4.186-22.898-2.996-17.753,1.589-33.521,11.476-46.867,29.385Z" fill={getGateColor(10)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 10 ? 'url(#glow)' : undefined} />
                    <path id="gate-25" d="M179.368,240.567c-8.252-7.8-16.36-12.061-19.482-12.596l1.014-5.914c5.479.939,14.77,6.757,22.59,14.148l-4.121,4.361Z" fill={getGateColor(25)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 25 ? 'url(#glow)' : undefined} />
                    <rect id="gate-7" x="118.855" y="193.588" width="6" height="21.9" fill={getGateColor(7)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 7 ? 'url(#glow)' : undefined} />
                    <rect id="gate-1" x="134.74" y="193.588" width="6" height="21.9" fill={getGateColor(1)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 1 ? 'url(#glow)' : undefined} />
                    <rect id="gate-13" x="150.624" y="193.588" width="6" height="20.583" fill={getGateColor(13)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 13 ? 'url(#glow)' : undefined} />
                    <path id="gate-20" d="M46.382,248.966l-5.626-2.086c.641-1.727,1.275-3.449,1.907-5.166,13.958-37.891,27.141-73.681,79.684-92.602l2.033,5.646c-49.912,17.973-62.042,50.901-76.086,89.03-.634,1.721-1.27,3.447-1.912,5.178Z" fill={getGateColor(20)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 20 ? 'url(#glow)' : undefined} />
                    <path id="gate-45" d="M188.871,205.317c-6.146-9.127-13.172-16.835-22.897-27.504-2.507-2.75-5.182-5.685-8.053-8.876l4.461-4.013c2.861,3.18,5.527,6.105,8.026,8.847,9.897,10.857,17.048,18.702,23.439,28.195l-4.977,3.351Z" fill={getGateColor(45)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 45 ? 'url(#glow)' : undefined} />
                    <path id="gate-12" d="M213.923,210.987c-13.57-23.343-32.247-43.096-55.511-58.708l3.344-4.982c23.688,15.897,43.521,36.878,57.354,60.675l-5.188,3.016Z" fill={getGateColor(12)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 12 ? 'url(#glow)' : undefined} />
                    <path id="gate-35" d="M225.513,199.79c-18.514-31.021-42.995-51.674-74.845-63.139l2.031-5.646c33.209,11.955,58.712,33.448,77.966,65.709l-5.152,3.075Z" fill={getGateColor(35)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 35 ? 'url(#glow)' : undefined} />
                    <rect id="gate-31" x="118.855" y="175.169" width="6" height="18.419" fill={getGateColor(31)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 31 ? 'url(#glow)' : undefined} />
                    <rect id="gate-8" x="134.74" y="175.169" width="6" height="18.419" fill={getGateColor(8)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 8 ? 'url(#glow)' : undefined} />
                    <rect id="gate-33" x="150.624" y="175.169" width="6" height="18.419" fill={getGateColor(33)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 33 ? 'url(#glow)' : undefined} />
                    <path id="gate-16" d="M49.791,199.68l-5.124-3.122c19.471-31.956,45.234-53.359,78.76-65.432l2.033,5.646c-32.188,11.59-56.939,32.168-75.669,62.909Z" fill={getGateColor(16)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 16 ? 'url(#glow)' : undefined} />
                    <rect id="gate-56" x="150.624" y="112.288" width="6" height="16.32" fill={getGateColor(56)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 56 ? 'url(#glow)' : undefined} />
                    <rect id="gate-11" x="150.624" y="92.848" width="6" height="19.44" fill={getGateColor(11)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 11 ? 'url(#glow)' : undefined} />
                    <rect id="gate-23" x="134.74" y="113.488" width="6" height="15.12" fill={getGateColor(23)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 23 ? 'url(#glow)' : undefined} />
                    <rect id="gate-43" x="134.74" y="98.609" width="6" height="14.88" fill={getGateColor(43)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 43 ? 'url(#glow)' : undefined} />
                    <rect id="gate-62" x="118.855" y="111.302" width="6" height="17.306" fill={getGateColor(62)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 62 ? 'url(#glow)' : undefined} />
                    <rect id="gate-17" x="118.855" y="94.288" width="6" height="17.014" fill={getGateColor(17)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 17 ? 'url(#glow)' : undefined} />
                    <rect id="gate-61" x="134.74" y="32.68" width="6" height="21.288" fill={getGateColor(61)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 61 ? 'url(#glow)' : undefined} />
                    <rect id="gate-63" x="150.624" y="32.68" width="6" height="22.968" fill={getGateColor(63)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 63 ? 'url(#glow)' : undefined} />
                    <rect id="gate-4" x="150.624" y="55.649" width="6" height="16.8" fill={getGateColor(4)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 4 ? 'url(#glow)' : undefined} />
                    <rect id="gate-24" x="134.74" y="53.968" width="6" height="17.04" fill={getGateColor(24)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 24 ? 'url(#glow)' : undefined} />
                    <rect id="gate-47" x="118.855" y="52.768" width="6" height="18.24" fill={getGateColor(47)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 47 ? 'url(#glow)' : undefined} />
                    <rect id="gate-64" x="118.855" y="36.062" width="6" height="16.882" fill={getGateColor(64)} stroke={stroke} strokeWidth={0.5} filter={highlightedGate === 64 ? 'url(#glow)' : undefined} />
                    </>)}

                    {showCenters && (<>{/* Centers */}
                    <rect id="center-sacral" x="106.425" y="281.169" width="62.629" height="62.629" rx="12" ry="12" fill={getCenterFill('center-sacral')} stroke={highlightedCenter === 'sacral' ? 'var(--gold)' : stroke} strokeWidth={highlightedCenter === 'sacral' ? 2 : 1} filter={highlightedCenter === 'sacral' ? 'url(#glow)' : undefined} />
                    <rect id="center-root" x="106.425" y="358.329" width="62.629" height="62.629" rx="12" ry="12" fill={getCenterFill('center-root')} stroke={highlightedCenter === 'root' ? 'var(--gold)' : stroke} strokeWidth={highlightedCenter === 'root' ? 2 : 1} filter={highlightedCenter === 'root' ? 'url(#glow)' : undefined} />
                    <rect id="center-throat" x="109.526" y="117.519" width="56.427" height="68.831" rx="12" ry="12" fill={getCenterFill('center-throat')} stroke={highlightedCenter === 'throat' ? 'var(--gold)' : stroke} strokeWidth={highlightedCenter === 'throat' ? 2 : 1} filter={highlightedCenter === 'throat' ? 'url(#glow)' : undefined} />
                    <path id="center-spleen" d="M70.594,322.936c1.379-17.072-53.444-46.05-66.289-31.583-7.307,8.23,4.522,37.024,12.114,48.05,24.703,16.373,53.215-4.579,54.175-16.467Z" fill={getCenterFill('center-spleen')} stroke={highlightedCenter === 'spleen' ? 'var(--gold)' : stroke} strokeWidth={highlightedCenter === 'spleen' ? 2 : 1} filter={highlightedCenter === 'spleen' ? 'url(#glow)' : undefined} />
                    <path id="center-emotional-solar-plexus" d="M204.743,322.936c-1.379-17.072,53.444-46.05,66.289-31.583-7.307,8.23-4.522,37.024-12.114,48.05-24.703,16.373-53.215-4.579-54.175-16.467Z" fill={getCenterFill('center-emotional-solar-plexus')} stroke={highlightedCenter === 'emotional-solar-plexus' ? 'var(--gold)' : stroke} strokeWidth={highlightedCenter === 'emotional-solar-plexus' ? 2 : 1} filter={highlightedCenter === 'emotional-solar-plexus' ? 'url(#glow)' : undefined} />
                    <path id="center-will" d="M216.323,242.408c-4.306-1.272-8.164.058-11.581,1.287-14.986,5.389-29.92,21.805-26.38,31.527,4.602,12.64,41.72,17.511,50.83,2.574,6.489-10.641-.916-31.857-12.868-35.388Z" fill={getCenterFill('center-will')} stroke={highlightedCenter === 'will' ? 'var(--gold)' : stroke} strokeWidth={highlightedCenter === 'will' ? 2 : 1} filter={highlightedCenter === 'will' ? 'url(#glow)' : undefined} />
                    <path id="center-head" d="M167.535,43.869c4.493-12.257-31.513-49.184-48.521-42.587-11.625,4.509-15.917,29.95-5.679,40.805,4.287,4.545,10.066,5.413,18.557,6.689,2.503.376,32.077,4.821,35.642-4.907Z" fill={getCenterFill('center-head')} stroke={highlightedCenter === 'head' ? 'var(--gold)' : stroke} strokeWidth={highlightedCenter === 'head' ? 2 : 1} filter={highlightedCenter === 'head' ? 'url(#glow)' : undefined} />
                    <path id="center-g-center" d="M101.194,216.751c7.938-19.671,53.242-24.16,65.528-1.8,5.616,10.221,3.904,25.273-2.831,34.656-11.961,16.662-39.298,14.807-53.393-.9-6.547-7.296-13.594-21.323-9.303-31.956Z" fill={getCenterFill('center-g-center')} stroke={highlightedCenter === 'g-center' ? 'var(--gold)' : stroke} strokeWidth={highlightedCenter === 'g-center' ? 2 : 1} filter={highlightedCenter === 'g-center' ? 'url(#glow)' : undefined} />
                    <path id="center-ajna" d="M101.82,72.208c7.938-16.418,53.242-20.164,65.528-1.503,5.616,8.531,3.904,21.093-2.831,28.925-11.961,13.906-39.298,12.359-53.393-.751-6.547-6.089-13.594-17.796-9.303-26.671Z" fill={getCenterFill('center-ajna')} stroke={highlightedCenter === 'ajna' ? 'var(--gold)' : stroke} strokeWidth={highlightedCenter === 'ajna' ? 2 : 1} filter={highlightedCenter === 'ajna' ? 'url(#glow)' : undefined} />
                    </>)}

                    {showCenterLabels && (
                    /* Center name labels — useful for centers-only charts. */
                    <g fontFamily={fontFamily} fontWeight="700" fontSize="8" textAnchor="middle"
                       style={{ pointerEvents: 'none' }} paintOrder="stroke"
                       stroke="var(--paper, #ffffff)" strokeWidth={2}>
                        {([
                            ['Head', 137.7, 28],
                            ['Ajna', 137.0, 88],
                            ['Throat', 137.7, 154],
                            ['G-Center', 133.5, 235],
                            ['Ego / Will', 207, 264],
                            ['Sacral', 137.7, 314],
                            ['Spleen', 38, 316],
                            ['Solar Plexus', 237, 316],
                            ['Root', 137.7, 391],
                        ] as Array<[string, number, number]>).map(([name, x, y]) => (
                            <text key={name} x={x} y={y} dominantBaseline="middle" fill="var(--ink, #1b1830)">{name}</text>
                        ))}
                    </g>
                    )}

                    {showGateLabels && (
                    /* Gate Number Labels with optional active circles */
                    <g fontSize="7" fontFamily={fontFamily} fontWeight="normal">
                        {GATE_POSITIONS.map(([gate, x, y]) => {
                            const active = isGateActive(gate);
                            const shadowType = resolvedShadowAnalysis?.gateTypes?.[gate];
                            const textColor = active ? activeTextColor : baseTextColor;
                            const circleRadius = 6;
                            // Slightly raise circle center so it sits behind the digit nicely
                            const cy = y - 3;
                            return (
                                <g key={gate}>
                                    {(active || highlightedGate === gate) && (
                                        <circle
                                            cx={x}
                                            cy={cy}
                                            r={circleRadius}
                                            fill={highlightedGate === gate ? 'var(--gold-soft, rgba(212,175,55,0.4))' : (shadowType ? shadowColors[shadowType] : activeGateCircleColor)}
                                            opacity={shadowType ? 0.9 : 1}
                                            filter={highlightedGate === gate ? 'url(#glow)' : undefined}
                                            stroke={highlightedGate === gate ? 'var(--gold)' : 'none'}
                                            strokeWidth={1}
                                        />
                                    )}
                                    <text x={x} y={y} textAnchor="middle" fill={textColor}>
                                        <title>{ `Gate ${gate}${ getGateInfo(gate) ? '\n' + getGateInfo(gate) : '' }` }</title>
                                        {gate}
                                    </text>
                                </g>

                            );
                        })}
                    </g>
                    )}

                </g>
            </svg>
        </div>
    );
};
