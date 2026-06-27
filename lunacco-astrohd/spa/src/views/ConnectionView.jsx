/**
 * ConnectionView — composite bodygraph for two people.
 * Uses ConnectionLogic.classifyChannels for proper composite analysis.
 * 5-column layout: person A | design panel | composite | personality panel | person B
 */

import { useState, useEffect, useMemo } from 'react';
import { EphemerisService } from '../services/EphemerisService';
import { ConnectionLogic } from '../services/ConnectionLogic';
import { Bodygraph } from '../components/Bodygraph';
import ChartAttributionFooter from '../components/ChartAttributionFooter';
import { ConnectionPlanetPanel } from '../components/ConnectionPlanetPanel';

const REST_ROOT = (() => {
  const d = (window.LunaCcoData || {});
  return (d.root || '/wp-json/').replace(/\/$/, '') + '/';
})();
const NONCE = () => (window.LunaCcoData?.nonce || '');

async function fetchJSON(path, init = {}) {
  const res = await fetch(REST_ROOT + path, {
    credentials: 'same-origin', ...init,
    headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': NONCE(), ...(init.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error((body && body.message) || `${res.status}`);
  return body;
}

const CONNECTION_THEME_DESCRIPTIONS = {
  '9-0': 'Nowhere to Go – Total closure, deeply bonded but can feel stuck.',
  '8-1': 'Innovate Together – Strong synergy with one growth point.',
  '7-2': 'Work To Do – Two themes to resolve, evolutionary pairing.',
  '6-3': 'Growth Is Required – Purposeful but challenging.',
  '5-4': 'The Balancing Act – Balanced, dynamic, adaptable.',
  '4-5': 'Shared Exploration – Flexible, non-traditional.',
  '3-6': 'Amplification – Thrilling or destabilizing, needs boundaries.',
  '2-7': 'Influence Relationship – Unpredictable, spiritually catalytic.',
  '1-8': 'No Shared Definition – Held by choice, not mechanics.',
  '0-9': 'No Shared Definition – Held by choice, not mechanics.',
};

const CHANNEL_TYPES = [
  { key: 'electromagnetic', label: 'Electromagnetic', color: '#8b5cf6' },
  { key: 'compromise', label: 'Compromise', color: '#f59e0b' },
  { key: 'companion', label: 'Companion', color: '#3b82f6' },
  { key: 'dominance', label: 'Dominance', color: '#10b981' },
];

function PersonPicker({ label, people, value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', margin: 0 }}>{label}</p>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value || null)}
        style={{
          width: '100%', padding: '6px 10px', border: '1px solid var(--hair)',
          background: 'var(--card)', color: 'var(--ink)', fontSize: 12, borderRadius: 0,
          fontFamily: 'var(--font-display)', fontStyle: 'italic',
        }}
      >
        <option value="">Select person…</option>
        {people.map(p => (
          <option key={p.id || p.user_id || p.display_name} value={p.id || p.user_id || p.display_name}
            disabled={disabled && (p.id || p.user_id || p.display_name) === disabled}>
            {p.display_name}
          </option>
        ))}
      </select>
    </div>
  );
}

function serializeChart( data ) {
  return JSON.parse( JSON.stringify( data, ( _k, v ) => {
    if ( v instanceof Set ) return Array.from( v );
    if ( v instanceof Map ) return Object.fromEntries( v );
    return v;
  } ) );
}

function rehydrateChart(chart) {
  if (!chart) return null;
  return {
    ...chart,
    definedCenters: chart.definedCenters instanceof Set ? chart.definedCenters : new Set(Array.isArray(chart.definedCenters) ? chart.definedCenters : []),
    activeGates: chart.activeGates instanceof Set ? chart.activeGates : new Set(Array.isArray(chart.activeGates) ? chart.activeGates : []),
  };
}

export default function ConnectionView({ people = [], profileIdentity, gateChartType = 'connection', gatePresetKey = null }) {
  const { saveChartCache } = window.LunaCcoHooks?.useUser?.() || {};

  async function calcChart(person) {
    if (!person) return null;
    const payload = {
      date: person.birth_date || person.birthdate,
      time: person.birth_time || person.birthtime || '12:00',
      latitude: String(person.latitude || person.birth_lat || person.birthlat || 0),
      longitude: String(person.longitude || person.birth_lng || person.birthlng || 0),
      timezone: person.birth_timezone || person.timezone || 'UTC',
    };
    if (!payload.date) return null;
    const personId = person.id === 'myself' ? null : person.id;
    const tokenRes = await fetchJSON('luna-astrohd/v1/calc-token', {
      method: 'POST',
      body: JSON.stringify({ chart_type: gateChartType || 'connection', preset_key: gatePresetKey || undefined, person_id: personId })
    });
    const data = await EphemerisService.getInstance().getChartData(payload);
    if (typeof saveChartCache === 'function') {
      await saveChartCache(personId, 'natal_whole_house', {
        input: { ...payload, houseSystem: 'whole_house' },
        data: serializeChart(data),
        token: tokenRes?.token
      });
    }
    return data;
  }
  const [idA, setIdA] = useState(null);
  const [idB, setIdB] = useState(null);
  const [chartA, setChartA] = useState(null);
  const [chartB, setChartB] = useState(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [error, setError] = useState(null);
  const [compositeData, setCompositeData] = useState(null);
  const [connectionAnalysis, setConnectionAnalysis] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const allPeople = useMemo(() => {
    const list = [...people];
    if (profileIdentity && profileIdentity.birthdate) {
      list.unshift({
        ...profileIdentity,
        id: 'myself',
        display_name: 'Myself',
        birth_date: profileIdentity.birthdate // normalized field name
      });
    }
    return list;
  }, [people, profileIdentity]);

  const findPerson = (id) => {
    if (!id) return null;
    return allPeople.find(p => String(p.id || p.user_id || p.display_name) === String(id));
  };

  useEffect(() => {
    const person = findPerson(idA);
    if (!person) { setChartA(null); return; }
    const saved = person.chartData || person.chart_data;
    if (saved) { setChartA(rehydrateChart(saved)); return; }
    setLoadingA(true);
    calcChart(person).then(d => setChartA(rehydrateChart(d))).catch(() => setChartA(null)).finally(() => setLoadingA(false));
  }, [idA]);

  useEffect(() => {
    const person = findPerson(idB);
    if (!person) { setChartB(null); return; }
    const saved = person.chartData || person.chart_data;
    if (saved) { setChartB(rehydrateChart(saved)); return; }
    setLoadingB(true);
    calcChart(person).then(d => setChartB(rehydrateChart(d))).catch(() => setChartB(null)).finally(() => setLoadingB(false));
  }, [idB]);

  function handleGenerate() {
    if (!chartA || !chartB) return;
    setError(null);
    try {
      const analysis = ConnectionLogic.classifyChannels(chartA, chartB);

      const compBirth = {};
      Object.entries(chartA.birthActivations).forEach(([k, v]) => { compBirth[`A_${k}`] = v; });
      Object.entries(chartB.birthActivations).forEach(([k, v]) => { compBirth[`B_${k}`] = v; });

      const compDesign = {};
      Object.entries(chartA.designActivations).forEach(([k, v]) => { compDesign[`A_${k}`] = v; });
      Object.entries(chartB.designActivations).forEach(([k, v]) => { compDesign[`B_${k}`] = v; });

      const composite = {
        birthActivations: compBirth,
        designActivations: compDesign,
        activeGates: analysis.compositeGates,
        activeChannels: analysis.compositeChannels,
        definedCenters: analysis.compositeCenters.definedCenters,
        type: chartA.type,
        authority: chartA.authority,
        profile: chartA.profile,
        variables: chartA.variables,
        definition: `Composite (${analysis.compositeCenters.code})`,
        incarnationCross: '',
        modality: '',
      };

      setCompositeData(composite);
      setConnectionAnalysis(analysis);
      setShowResults(true);
    } catch (e) {
      setError(e?.message || 'Generation failed.');
    }
  }

  function handleReset() {
    setShowResults(false);
    setCompositeData(null);
    setConnectionAnalysis(null);
  }

  const personAInfo = findPerson(idA);
  const personBInfo = findPerson(idB);
  const themeCode = connectionAnalysis?.compositeCenters.code || '';
  const themeDesc = CONNECTION_THEME_DESCRIPTIONS[themeCode] || '';

  const personalityColor = 'var(--hd-personality, #1b1830)';
  const designColor = 'var(--hd-design, #a12f2f)';

  if (!showResults) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {error && (
          <div style={{ padding: '10px 24px', background: '#fef2f2', color: '#b91c1c', fontSize: 12, flexShrink: 0 }}>{error}</div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }}>
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>
              Connection Chart
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: 'var(--ink)', lineHeight: 1.1, margin: 0 }}>
              Select Two People
            </h1>
          </div>

          {allPeople.length < 2 ? (
            <div style={{ padding: '20px', background: 'var(--card)', border: '1px solid var(--hair)', fontSize: 13, color: 'var(--mute)' }}>
              You need at least 2 saved people to create a connection chart.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <PersonPicker label="Person A" people={allPeople} value={idA} onChange={setIdA} disabled={idB} />
                {loadingA && <p style={{ fontSize: 10, color: 'var(--mute)', margin: '8px 0' }}>Loading…</p>}
                {chartA && !loadingA && (
                  <div style={{ marginTop: 12, border: '1px solid var(--hair)', background: 'var(--card)', padding: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--mute)', marginBottom: 4 }}>{chartA.type} · {chartA.profile} · {chartA.authority}</div>
                    <Bodygraph data={chartA} hideVariables={true} />
                  </div>
                )}
              </div>

              <div>
                <PersonPicker label="Person B" people={allPeople} value={idB} onChange={setIdB} disabled={idA} />
                {loadingB && <p style={{ fontSize: 10, color: 'var(--mute)', margin: '8px 0' }}>Loading…</p>}
                {chartB && !loadingB && (
                  <div style={{ marginTop: 12, border: '1px solid var(--hair)', background: 'var(--card)', padding: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--mute)', marginBottom: 4 }}>{chartB.type} · {chartB.profile} · {chartB.authority}</div>
                    <Bodygraph data={chartB} hideVariables={true} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={handleGenerate}
              disabled={!chartA || !chartB || loadingA || loadingB}
              style={{
                padding: '10px 32px', background: (!chartA || !chartB || loadingA || loadingB) ? 'var(--mute)' : 'var(--indigo)',
                color: 'var(--btn-fg, white)', border: 'none', cursor: (!chartA || !chartB) ? 'not-allowed' : 'pointer',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
              }}
            >
              {(loadingA || loadingB) ? 'Loading…' : 'Generate Connection Chart'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }}>

        { /* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>
              Connection Chart
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: 'var(--ink)', lineHeight: 1.1, margin: 0 }}>
              {personAInfo?.display_name} &amp; {personBInfo?.display_name}
            </h1>
            {themeCode && (
              <p style={{ fontSize: 11, color: 'var(--mute)', margin: '4px 0 0', fontStyle: 'italic' }}>
                Theme {themeCode} — {themeDesc}
              </p>
            )}
          </div>
          <button
            onClick={handleReset}
            style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--hair)', color: 'var(--mute)', fontSize: 10, cursor: 'pointer', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            New
          </button>
        </div>

        { /* 5-column layout */ }
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'minmax(220px, 1fr) 130px 1.2fr 130px minmax(220px, 1fr)', 
          gap: 16, 
          alignItems: 'start',
          width: '100%'
        }}>

          { /* Person A info */}
          <div>
            <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 4, opacity: 0.6 }}>
              {personAInfo?.display_name}
            </p>
            <div style={{ fontSize: 9, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 6, opacity: 0.8 }}>
              <div>{chartA.type}</div>
              <div>{chartA.profile} · {chartA.authority}</div>
            </div>
            <div style={{ 
              border: '1px solid var(--hair)', background: 'var(--card)', padding: 0, 
              width: '100%', height: 320, overflow: 'hidden', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ transform: 'scale(0.5)', width: 400, height: 600, flexShrink: 0 }}>
                <Bodygraph data={ chartA } hideVariables={ true } />
              </div>
            </div>
          </div>

          { /* Design panel */}
          <ConnectionPlanetPanel
            activationsA={chartA.designActivations}
            activationsB={chartB.designActivations}
            side="design"
            colorA={designColor}
            colorB={designColor}
          />

          { /* Composite bodygraph */}
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6, textAlign: 'center' }}>
              Composite
            </p>
            <div style={{ maxWidth: 320, margin: '0 auto', border: '1px solid var(--hair)', background: 'var(--paper-2)', padding: 12 }}>
              <Bodygraph data={compositeData} connectionAnalysis={connectionAnalysis} hideVariables={true} />
            </div>
          </div>

          { /* Personality panel */}
          <ConnectionPlanetPanel
            activationsA={chartA.birthActivations}
            activationsB={chartB.birthActivations}
            side="personality"
            colorA={personalityColor}
            colorB={personalityColor}
          />

          { /* Person B info */}
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 4, opacity: 0.6 }}>
              {personBInfo?.display_name}
            </p>
            <div style={{ fontSize: 9, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 6, opacity: 0.8 }}>
              <div>{chartB.type}</div>
              <div>{chartB.profile} · {chartB.authority}</div>
            </div>
            <div style={{ 
              border: '1px solid var(--hair)', background: 'var(--card)', padding: 0, 
              width: '100%', height: 320, overflow: 'hidden', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ transform: 'scale(0.5)', width: 400, height: 600, flexShrink: 0 }}>
                <Bodygraph data={ chartB } hideVariables={ true } />
              </div>
            </div>
          </div>
        </div>

        { /* Channel classification — Editorial Style */}
        <div style={{ marginTop: 24, padding: '24px 32px', background: 'var(--card)', border: '1px solid var(--hair)', borderBottom: '4px solid var(--gold)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid var(--hair)', pb: 12, marginBottom: 20 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: 'var(--ink)', margin: 0 }}>
                Connection Dynamics
              </h2>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--gold)', marginTop: 4 }}>
                Channel Classification
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 11, color: 'var(--mute)', fontStyle: 'italic' }}>
                Theme <strong style={{ color: 'var(--indigo)', fontStyle: 'normal' }}>{themeCode}</strong>
                {' '}·{' '}{connectionAnalysis.compositeCenters.definedCenters.size} defined centers
              </span>
              {connectionAnalysis.compositeCenters.definedByComposite.size > 0 && (
                <div style={{ fontSize: 9, color: 'var(--indigo)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>
                  {[...connectionAnalysis.compositeCenters.definedByComposite].join(', ')} New in connection
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
            {CHANNEL_TYPES.map(({ key, label, color }) => (
              <div key={key}>
                <div style={{ borderBottom: `2px solid ${color}`, paddingBottom: 6, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color }}>{label}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--mute)' }}>{connectionAnalysis[key].length}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {connectionAnalysis[key].map(ch => (
                    <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: color, opacity: 0.5 }} />
                      <div style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 500, fontFamily: 'monospace' }}>
                        {ch.id}
                      </div>
                      {ch.fromPerson && ch.fromPerson !== 'composite' && (
                        <span style={{ fontSize: 8, fontWeight: 700, background: 'var(--hair)', px: 4, py: 1, color: 'var(--mute)', textTransform: 'uppercase' }}>
                          {ch.fromPerson}
                        </span>
                      )}
                    </div>
                  ))}
                  {connectionAnalysis[key].length === 0 && (
                    <div style={{ fontSize: 10, color: 'var(--mute)', fontStyle: 'italic', opacity: 0.4 }}>No shared themes</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <ChartAttributionFooter />
      </div>
    </div>
  );
}
