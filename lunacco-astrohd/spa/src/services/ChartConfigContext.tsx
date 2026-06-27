/**
 * ChartConfigContext
 *
 * Provides the active ChartConfig (plus a setter and a partial-merge helper) to
 * the Chart Maker editor and the chart views it previews. One config object is
 * the single source of truth so a toggle in the editor re-renders the preview
 * immediately.
 *
 * Views that aren't wrapped in a provider can call useChartConfig() and will
 * receive DEFAULT_CHART_CONFIG, preserving the full legacy rendering.
 */

import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { ChartConfig, DEFAULT_CHART_CONFIG, cloneChartConfig } from './chartConfig';

interface ChartConfigContextValue {
  config: ChartConfig;
  setConfig: (cfg: ChartConfig) => void;
  /** Shallow-merge a partial patch into the active config. */
  patchConfig: (patch: Partial<ChartConfig>) => void;
}

const ChartConfigContext = createContext<ChartConfigContextValue>({
  config: DEFAULT_CHART_CONFIG,
  setConfig: () => {},
  patchConfig: () => {},
});

export function ChartConfigProvider({
  initialConfig,
  children,
}: {
  initialConfig?: ChartConfig;
  children: React.ReactNode;
}) {
  const [config, setConfig] = useState<ChartConfig>(
    () => cloneChartConfig(initialConfig || DEFAULT_CHART_CONFIG)
  );

  const patchConfig = useCallback((patch: Partial<ChartConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo<ChartConfigContextValue>(
    () => ({ config, setConfig, patchConfig }),
    [config, patchConfig]
  );

  return <ChartConfigContext.Provider value={value}>{children}</ChartConfigContext.Provider>;
}

export function useChartConfig(): ChartConfigContextValue {
  return useContext(ChartConfigContext);
}
