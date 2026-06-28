/**
 * LunaccoBodygraph
 *
 * Renders the detailed LunaCco bodygraph artwork (assets/main-lunacco-bodygraph.svg)
 * as a live, data-driven chart. The artwork is complete on its own — it already
 * contains the gate numbers, channels, centers and the teardrop/diamond variable
 * arrows — so this component only:
 *   1. colours the gate shapes by activation (data-name="gate-N"),
 *   2. colours the centers by definition (data-name="center-…"),
 *   3. wires click handlers for the editorial sidebar, and
 *   4. (optionally) drops the variable colour/tone numbers into the baked-in
 *      arrows — but only when the artwork exposes anchor points for them
 *      (data-name="var-<key>-color" / "var-<key>-tone"). Until those anchors
 *      exist the arrows simply render as drawn.
 *
 * The abstract (schematic) bodygraph remains in Bodygraph.tsx; this component is
 * selected when `config.bodygraph.style === 'lunacco'` (the default).
 */

import React from 'react';
import { ChartData } from '../services/HumanDesignLogic';
import { Center } from '../services/HumanDesignDefinitions';
import { ConnectionAnalysis } from '../services/ConnectionLogic';
import { analyzeShadowChart, ShadowAnalysis } from '../services/ShadowChartLogic';
import { BodygraphLayers, DEFAULT_BODYGRAPH_LAYERS } from '../services/chartConfig';

import rawBodygraph from '../assets/chart/main-lunacco-bodygraph.svg?raw';
import rawArrowLeft from '../assets/chart/arrow-left.svg?raw';
import rawArrowRight from '../assets/chart/arrow-right.svg?raw';

// lunacco-bodygraph.svg viewBox (fixed).
const BVW = 283.571, BVH = 447.383;

/** Turn a raw SVG string into a data URI usable as an <image href>. */
const svgDataUri = (raw: string) => `data:image/svg+xml;utf8,${encodeURIComponent(raw)}`;
const ARROW_LEFT_URI = svgDataUri(rawArrowLeft);
const ARROW_RIGHT_URI = svgDataUri(rawArrowRight);

// Planets that never activate gates in HD (mirrors Bodygraph.tsx).
const EXCLUDED_PLANETS = ['Chiron', 'Black Moon Lilith', 'Vulcan', 'Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli', 'Vertex'];

// center-<name> data-name -> Center enum, for defined-center fills.
const CENTER_ENUM: Record<string, Center> = {
  'center-root': Center.Root,
  'center-sacral': Center.Sacral,
  'center-emotional-solar-plexus': Center.Emotions,
  'center-spleen': Center.Spleen,
  'center-will': Center.Ego,
  'center-g-center': Center.Self,
  'center-throat': Center.Throat,
  'center-ajna': Center.Mind,
  'center-head': Center.Crown,
};

// Connection-channel gate colors (mirrors Bodygraph.tsx defaults).
const CONNECTION_COLORS = {
  electromagnetic: '#8b5cf6',
  compromise: '#f59e0b',
  companion: '#3b82f6',
  dominance: '#10b981',
  hanging: '#9ca3af',
};
const SHADOW_GATE_COLORS: Record<string, string> = {
  'conditioning-receptor': 'var(--hd-shadow-conditioning, #2f9f6b)',
  'mental-conditioner': 'var(--hd-shadow-mental, #c23b4a)',
  'transpersonal-conditioner': 'var(--hd-shadow-transpersonal, #3f7fc0)',
  'harmonic-influencer': 'var(--hd-shadow-harmonic, #8c5fbf)',
};

const CENTER_LABEL_POSITIONS: Array<[string, number, number]> = [
  ['Head', 140, 43],
  ['Ajna', 140, 103],
  ['Throat', 140, 170],
  ['G-Center', 140, 236],
  ['Ego / Will', 213, 280],
  ['Sacral', 140, 344],
  ['Spleen', 68, 344],
  ['Solar Plexus', 222, 344],
  ['Root', 140, 427],
];

interface LunaccoBodygraphProps {
  data: ChartData | null;
  connectionAnalysis?: ConnectionAnalysis | null;
  mini?: boolean;
  hideVariables?: boolean;
  layers?: Partial<BodygraphLayers>;
  theme?: {
    designColor?: string;
    personalityColor?: string;
    centerColor?: string;
    strokeColor?: string;
    textColor?: string;
    fontFamily?: string;
    activeGateCircleColor?: string;
    bodygraphActiveTextColor?: string;
    bodygraphTextColor?: string;
  };
  onElementClick?: (type: 'gate' | 'center', id: string, label?: string) => void;
  highlightedGate?: number;
  highlightedCenter?: string;
  shadowMode?: boolean;
  shadowAnalysis?: ShadowAnalysis;
}

export const LunaccoBodygraph: React.FC<LunaccoBodygraphProps> = ({
  data,
  connectionAnalysis,
  mini,
  hideVariables = false,
  layers,
  theme,
  onElementClick,
  highlightedGate,
  highlightedCenter,
  shadowMode = false,
  shadowAnalysis,
}) => {
  const L: BodygraphLayers = { ...DEFAULT_BODYGRAPH_LAYERS, ...(layers || {}) };
  const showGates = L.show && L.gates;
  const showCenters = L.show && L.centers;
  const showCenterLabels = L.show && L.centers && L.centerLabels;
  const showGateLabels = L.show && L.gateLabels;
  const variableArrowMode = hideVariables ? 'off' : (L.show ? L.variableArrows : 'off');
  const showVariables = variableArrowMode !== 'off';
  const showVariableLabels = variableArrowMode === 'full';

  const designColor = theme?.designColor || 'var(--hd-design, #a12f2f)';
  const personalityColor = theme?.personalityColor || 'var(--hd-personality, #1b1830)';
  const activeFill = theme?.centerColor || 'var(--hd-active, #fbbf24)';
  const inactiveFill = 'var(--paper, #ffffff)';
  const stroke = theme?.strokeColor || 'var(--ink, #262625)';
  const textColor = theme?.textColor || 'var(--ink, #1b1830)';
  const activeGateCircleColor = theme?.activeGateCircleColor || 'var(--hd-gate-circle, var(--paper, #ffffff))';
  const activeGateTextColor = theme?.bodygraphActiveTextColor || textColor;
  const inactiveGateTextColor = theme?.bodygraphTextColor || 'var(--hd-gate-text-inactive, var(--mute, #666666))';
  const fontFamily = theme?.fontFamily || 'var(--font-ui, sans-serif)';
  const displayFontFamily = 'var(--font-display, Georgia, serif)';

  const hostRef = React.useRef<HTMLDivElement | null>(null);

  const definedCenters = React.useMemo(
    () => (data?.definedCenters instanceof Set ? data.definedCenters : new Set(data?.definedCenters || [])),
    [data]
  );
  const isTransit = (data as any)?.isTransit;
  const resolvedShadow = React.useMemo(
    () => shadowAnalysis || (shadowMode && data ? analyzeShadowChart(data) : null),
    [shadowAnalysis, shadowMode, data]
  );

  // Connection mode: color a gate by the classified channel it belongs to.
  const connectionGateColor = React.useCallback((gateId: number): string => {
    if (!connectionAnalysis || !data) return inactiveFill;
    if (!data.activeGates.has(gateId)) return inactiveFill;
    const inCh = (list: any[]) => list.find((ch) => ch.gates.gate1 === gateId || ch.gates.gate2 === gateId);
    if (inCh(connectionAnalysis.electromagnetic)) return CONNECTION_COLORS.electromagnetic;
    if (inCh(connectionAnalysis.compromise)) return CONNECTION_COLORS.compromise;
    if (inCh(connectionAnalysis.companion)) return CONNECTION_COLORS.companion;
    if (inCh(connectionAnalysis.dominance)) return CONNECTION_COLORS.dominance;
    return CONNECTION_COLORS.hanging;
  }, [connectionAnalysis, data, inactiveFill]);

  const gateFill = React.useCallback((gateId: number): string => {
    if (!data) return inactiveFill;
    if (connectionAnalysis) return connectionGateColor(gateId);
    const pActive = Object.entries(data.birthActivations)
      .filter(([name]) => !EXCLUDED_PLANETS.includes(name))
      .some(([, a]) => (a as any).gate === gateId);
    const dActive = isTransit ? false : Object.entries(data.designActivations)
      .filter(([name]) => !EXCLUDED_PLANETS.includes(name))
      .some(([, a]) => (a as any).gate === gateId);
    if (!isTransit && pActive && dActive) return 'url(#lunacco-split-fill)';
    if (pActive) return personalityColor;
    if (!isTransit && dActive) return designColor;
    // Shadow mode tints inactive gates by their shadow archetype.
    if (shadowMode) {
      const st = resolvedShadow?.gateTypes?.[gateId];
      if (st && SHADOW_GATE_COLORS[st]) return SHADOW_GATE_COLORS[st];
    }
    return inactiveFill;
  }, [data, connectionAnalysis, connectionGateColor, isTransit, personalityColor, designColor, inactiveFill, shadowMode, resolvedShadow]);

  const isGateDefined = React.useCallback((gateId: number): boolean => {
    return gateFill(gateId) !== inactiveFill;
  }, [gateFill, inactiveFill]);

  const shadowCenterFill = 'var(--hd-shadow-center, rgba(91,141,239,0.16))';
  const shadowDefinedFill = 'var(--hd-shadow-defined-center, rgba(120,120,130,0.16))';

  // Paint the inlined artwork: fills, strokes, cursors, click handlers, and the
  // split-fill pattern; then drop variable numbers into any named anchors.
  React.useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const svg = host.querySelector('svg');
    if (!svg) return;
    svg.setAttribute('style', 'width:100%;height:auto;display:block');

    // Ensure a <defs> with the design/personality split-fill pattern exists.
    const NS = 'http://www.w3.org/2000/svg';
    let defs = svg.querySelector('defs');
    if (!defs) { defs = document.createElementNS(NS, 'defs'); svg.insertBefore(defs, svg.firstChild); }
    if (!svg.querySelector('#lunacco-split-fill')) {
      const pat = document.createElementNS(NS, 'pattern');
      pat.setAttribute('id', 'lunacco-split-fill');
      pat.setAttribute('patternUnits', 'userSpaceOnUse');
      pat.setAttribute('width', '4'); pat.setAttribute('height', '4');
      pat.setAttribute('patternTransform', 'rotate(45)');
      const r1 = document.createElementNS(NS, 'rect'); r1.setAttribute('width', '2'); r1.setAttribute('height', '4'); r1.setAttribute('fill', designColor);
      const r2 = document.createElementNS(NS, 'rect'); r2.setAttribute('x', '2'); r2.setAttribute('width', '2'); r2.setAttribute('height', '4'); r2.setAttribute('fill', personalityColor);
      pat.appendChild(r1); pat.appendChild(r2); defs.appendChild(pat);
    }

    svg.querySelectorAll<SVGGraphicsElement>('[data-name]').forEach((el) => {
      const name = el.getAttribute('data-name') || '';

      if (name.startsWith('gate-bubble-')) {
        const gateId = Number(name.slice('gate-bubble-'.length));
        if (!Number.isFinite(gateId)) return;
        const active = showGates && isGateDefined(gateId);
        el.style.display = showGateLabels ? '' : 'none';
        el.setAttribute('fill', active ? activeGateCircleColor : 'transparent');
        el.setAttribute('stroke', highlightedGate === gateId ? 'var(--gold, #d4af37)' : stroke);
        el.setAttribute('stroke-width', highlightedGate === gateId ? '0.9' : '0');
        el.style.cursor = onElementClick ? 'pointer' : 'default';
        (el as any).onclick = onElementClick ? () => onElementClick('gate', String(gateId), `Gate ${gateId}`) : null;
        return;
      }

      if (name.startsWith('gate-label-')) {
        const gateId = Number(name.slice('gate-label-'.length));
        if (!Number.isFinite(gateId)) return;
        const active = showGates && isGateDefined(gateId);
        el.style.display = showGateLabels ? '' : 'none';
        el.querySelectorAll<SVGGraphicsElement>('path, polygon, rect').forEach((child) => {
          if ((child.getAttribute('data-name') || '').startsWith('gate-bubble-')) return;
          child.setAttribute('fill', active ? activeGateTextColor : inactiveGateTextColor);
        });
        el.style.cursor = onElementClick ? 'pointer' : 'default';
        (el as any).onclick = onElementClick ? () => onElementClick('gate', String(gateId), `Gate ${gateId}`) : null;
        return;
      }

      if (name.startsWith('gate-')) {
        const gateId = Number(name.slice(5));
        if (!Number.isFinite(gateId)) return;
        el.setAttribute('fill', showGates ? gateFill(gateId) : inactiveFill);
        el.setAttribute('stroke', highlightedGate === gateId ? 'var(--gold, #d4af37)' : stroke);
        el.setAttribute('stroke-width', highlightedGate === gateId ? '1.4' : '0.25');
        el.style.cursor = onElementClick ? 'pointer' : 'default';
        (el as any).onclick = onElementClick ? () => onElementClick('gate', String(gateId), `Gate ${gateId}`) : null;
        return;
      }

      if (name.startsWith('center-')) {
        const enumKey = CENTER_ENUM[name];
        const defined = enumKey != null && definedCenters.has(enumKey);
        const fill = shadowMode
          ? (defined ? shadowDefinedFill : shadowCenterFill)
          : (showCenters && defined ? activeFill : inactiveFill);
        el.setAttribute('fill', fill);
        const hot = highlightedCenter && name === `center-${highlightedCenter}`;
        el.setAttribute('stroke', hot ? 'var(--gold, #d4af37)' : stroke);
        el.setAttribute('stroke-width', hot ? '2' : '0.25');
        el.style.cursor = onElementClick ? 'pointer' : 'default';
        const key = name.slice('center-'.length);
        (el as any).onclick = onElementClick ? () => onElementClick('center', key, key.replace(/-/g, ' ')) : null;
      }
    });

    // NOTE: intentionally no dependency array — this paints the injected SVG
    // (dangerouslySetInnerHTML) imperatively, so it must re-assert after EVERY
    // commit. With a deps list, a re-render that left the deps unchanged but
    // re-touched the host could leave the artwork unpainted (blank) until the
    // next data change. Re-running each render is cheap (~150 setAttribute calls,
    // no state updates) and keeps the artwork always in sync with current props.
  });

  // ---- variable arrows (drawn over the art with the bespoke assets) --------
  // The bodygraph artwork has NO variable arrows, so we overlay them: one arrow
  // per variable, choosing the left/right asset by the variable's orientation,
  // with the colour number in the teardrop and the tone number in the diamond.
  const ARROW_W = 46;
  const ARROW_H = ARROW_W * (22.762 / 54.089);
  // Teardrop (colour) / diamond (tone) text centers, as x-fractions of the asset.
  const FX = {
    left: { color: 0.32, tone: 0.79 },   // arrow-left: teardrop left, diamond right
    right: { color: 0.68, tone: 0.21 },  // arrow-right: mirrored
  };
  // Four anchor slots (matching the schematic bodygraph layout).
  const topY = 24, gapY = ARROW_H + 7;
  const leftX = 5, rightX = BVW - 5 - ARROW_W;
  const SLOTS: Array<{ key: keyof ChartData['variables']; label: string; x: number; y: number; anchor: 'start' | 'end' }> = [
    { key: 'digestion',   label: 'BRAIN',       x: leftX,  y: topY,        anchor: 'start' },
    { key: 'environment', label: 'ENVIRONMENT', x: leftX,  y: topY + gapY, anchor: 'start' },
    { key: 'motivation',  label: 'MOTIVATION',  x: rightX, y: topY,        anchor: 'end' },
    { key: 'perspective', label: 'PERSPECTIVE', x: rightX, y: topY + gapY, anchor: 'end' },
  ];

  return (
    <div className="lunacco-bodygraph-container"
      style={{ fontFamily, width: '100%', minWidth: mini ? '250px' : '300px', position: 'relative' }}>
      {/* Static art, inlined so its named gate/center shapes can be coloured. */}
      <div ref={hostRef} dangerouslySetInnerHTML={{ __html: rawBodygraph }} />

      {showCenterLabels && (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${BVW} ${BVH}`}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 'auto', pointerEvents: 'none' }}>
          <g fontFamily={displayFontFamily} fontStyle="italic" fontWeight="700" fontSize="8" textAnchor="middle"
            paintOrder="stroke" stroke="var(--paper, #ffffff)" strokeWidth={2}>
            {CENTER_LABEL_POSITIONS.map(([name, x, y]) => (
              <text key={name} x={x} y={y} dominantBaseline="middle" fill="var(--ink, #1b1830)">
                {name}
              </text>
            ))}
          </g>
        </svg>
      )}

      {/* Variable-arrow overlay, sized to the art (height:auto) so it aligns. */}
      {showVariables && data?.variables && (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${BVW} ${BVH}`}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 'auto', pointerEvents: 'none' }}>
          {SLOTS.map((slot) => {
            const v = data.variables[slot.key];
            if (!v) return null;
            const dir: 'left' | 'right' = v.orientation === 'Right' ? 'right' : 'left';
            const uri = dir === 'left' ? ARROW_LEFT_URI : ARROW_RIGHT_URI;
            const midY = slot.y + ARROW_H / 2;
            const colorX = slot.x + ARROW_W * FX[dir].color;
            const toneX = slot.x + ARROW_W * FX[dir].tone;
            return (
              <g key={slot.key}>
                <image href={uri} x={slot.x} y={slot.y} width={ARROW_W} height={ARROW_H} preserveAspectRatio="xMidYMid meet" />
                <text x={colorX} y={midY} fontSize="6.5" fontWeight="700" fontFamily={fontFamily}
                  textAnchor="middle" dominantBaseline="central" fill={textColor}>{v.color}</text>
                <text x={toneX} y={midY} fontSize="5.6" fontWeight="700" fontFamily={fontFamily}
                  textAnchor="middle" dominantBaseline="central" fill={textColor}>{v.tone}</text>
                {showVariableLabels && (
                  <text x={slot.anchor === 'start' ? slot.x : slot.x + ARROW_W} y={slot.y - 2}
                    fontSize="5" fontWeight="700" fontFamily={fontFamily} letterSpacing="0.05em"
                    textAnchor={slot.anchor} fill={textColor} opacity={0.7}>{slot.label}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
};

export default LunaccoBodygraph;
