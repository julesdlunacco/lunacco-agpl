# Luna AstroHD Module

Astrology + Human Design module for the LunaCco platform. Provides:

- **Natal bodygraph** — Human Design chart with type / authority / profile / definition / channels / centers / incarnation cross
- **Astrology insights** — aspects, stelliums, chart shapes, pattern alerts, eclipse signature
- **Dashboard widgets** — planetary ingresses, retrogrades + shadow windows, moon phase / sign, active stelliums
- **Daily snapshot** — quick / standard / deep / moon modes over a date range
- **Chart builder** — customize bodygraph colors (design / personality / center / connection swatches)
- **Definition library** — gate / channel / center / planet / sign / house / aspect meanings, per-user alternative sets

## Licensing & attribution

This plugin is licensed under **AGPL-3.0-or-later** (see `LICENSE`).

Astronomical calculations are powered by the **Swiss Ephemeris**, © Astrodienst AG, Zurich — <https://www.astro.com/swisseph/>. Swiss Ephemeris is itself distributed under AGPL-3.0. A browser-compiled version is bundled as `assets/swisseph.wasm`; ephemeris data files (`.se1`) ship under `assets/ephe/`.

Per AGPL obligations, modifications to this plugin that are served to users over a network must make the corresponding source code available. Public source repository: <https://github.com/julesdlunacco/lunacco-agpl>.

The Swiss Ephemeris build in use is **version 2.10.03**, which (since 2.10.01, May 2021) is distributed under **AGPL-3.0**. The upstream `swisseph-wasm` npm package labels itself GPL-3.0, but the bundled Astrodienst code remains AGPL-3.0 and those terms govern here.

**Credits:**
- Swiss Ephemeris — Dieter Koch & Alois Treindl, Astrodienst AG
- Upstream WASM port — `swisseph-wasm` (npm)

## Architecture

Calculations run **browser-side** via the bundled WASM. The plugin's PHP layer handles:
- Credit gating (pre-calc token issued after `lunacco_core()->credits()->consume_credits()`)
- Chart caching and persistence
- Definition set storage and admin UI
- Dashboard widget data pre-compute (1h server cache)
- Document-builder contributor registration (for reports)

## Status

v1: natal, astrology insights, dashboard widgets, snapshot.
Deferred: 72/36 angels system + degree→gate bridge, cross-module composite reports.
