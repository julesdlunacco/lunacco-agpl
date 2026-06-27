# LunaCco AGPL Suite — Core + AstroHD

This repository contains the **AGPL-3.0-licensed** components of the LunaCco
platform:

| Plugin | License | Role |
|---|---|---|
| [`lunacco-core`](lunacco-core/) | AGPL-3.0-or-later | SPA shell, authentication, credit system, profiles, module/chart registries, definition engine, AI config, admin pages |
| [`lunacco-astrohd`](lunacco-astrohd/) | AGPL-3.0-or-later | Astrology + Human Design charts, bodygraph, dashboard widgets, daily snapshots, definition library. Built on the Swiss Ephemeris. |

**The two plugins are a pair.** `lunacco-astrohd` is a module that plugs into the
`lunacco-core` SPA shell and will not function without it. `lunacco-core` provides
the shell, auth, and credit ledger that AstroHD relies on. Install **core first**,
then AstroHD.

> This repository is the published Corresponding Source for the deployed LunaCco
> AGPL components, provided to satisfy the network-use requirement of the GNU
> Affero General Public License (AGPL-3.0) §13. Other LunaCco modules (tarot,
> numerology, eastern, document-builder) are separate, independently-licensed
> programs that communicate with these plugins only through WordPress hooks,
> filters, and REST endpoints; they are not part of this AGPL work.

---

## Requirements

- **WordPress** 6.x or newer (developed against WP 7.0)
- **PHP** 8.2+
- **Node.js** 18+ and **npm** (only needed to build the SPA front-ends from source)
- A modern browser with WebAssembly support (ephemeris calculations run client-side)

---

## Building from source

Each plugin ships a Vite/React single-page app under `spa/`. The built assets are
emitted to `spa/dist/`, which WordPress enqueues. To build from source:

```bash
# 1. Core SPA
cd lunacco-core/spa
npm install
npm run build        # outputs to lunacco-core/spa/dist/

# 2. AstroHD SPA
cd ../../lunacco-astrohd/spa
npm install
npm run build        # runs Vite + postbuild.cjs -> lunacco-astrohd/spa/dist/
```

> **Always use `npm run build`, never `vite build` directly.** AstroHD has a
> `postbuild.cjs` step that runs after Vite and is required for a correct build.

There is no dev proxy — rebuild to see changes on a live WordPress site.

---

## Installing on WordPress

1. Copy both plugin folders into `wp-content/plugins/`:
   ```
   wp-content/plugins/lunacco-core/
   wp-content/plugins/lunacco-astrohd/
   ```
   (If you cloned this repo, copy the two folders out of it, or symlink them.)
2. In **wp-admin → Plugins**, activate **LunaCco Core first**, then
   **Luna AstroHD Module**.
3. Create a page to host the app and add the LunaCco shortcode [lunacco_app]].
4. Configure credits / AI settings under the LunaCco admin menu as needed. (Need Fluent cart setup and installed to use credit system and get payments etc.)

### Location data import (required for birth-detail lookups)

AstroHD needs a geographic location database to resolve birth places into
coordinates and time zones. This data is **not bundled** — you supply it:

1. Download a cities dataset from **GeoNames** (<https://www.geonames.org/>),
   e.g. `cities500`, `cities5000`, or `allCountries`.
2. (Optional but recommended) Trim it to only the countries you need to keep the
   file small, then **gzip** it as `combined_locations.csv.gz`.
3. In **wp-admin**, open the LunaCco **Locations** admin page and upload /
   import the `.gz`. The importer decompresses it into `wp-uploads/lunacco-locations/`
   and loads it into a custom table in chunks.

Until this import is done, location lookups return "no location data." A
`worldcities.csv` ships in `lunacco-astrohd/assets/` as a reference dataset but
is not wired into the importer.

---

## License & attributions

### This software

Both `lunacco-core` and `lunacco-astrohd` are licensed under the
**GNU Affero General Public License, version 3 or later (AGPL-3.0-or-later)**.
See [`LICENSE`](LICENSE). If you run a modified version of these plugins and make
it available to users over a network, you must offer those users the complete
corresponding source of your modified version under the same license.

### Swiss Ephemeris

Astronomical calculations in `lunacco-astrohd` are powered by the
**Swiss Ephemeris**, © Astrodienst AG, Zurich — <https://www.astro.com/swisseph/>.

- Version in use: **Swiss Ephemeris 2.10.03**.
- Since version 2.10.01 (May 2021), the open-source edition of the Swiss
  Ephemeris is distributed under **AGPL-3.0**. Version 2.10.03 is therefore
  **AGPL-3.0**.
- A browser-compiled build ships as `lunacco-astrohd/assets/swisseph.wasm`, with
  ephemeris data files (`.se1`) under `lunacco-astrohd/assets/ephe/`.
- The WASM port is derived from the `swisseph-wasm` npm package
  (<https://github.com/prolaxu/swisseph-wasm>). Note: that package's manifest
  labels itself GPL-3.0, but the underlying Swiss Ephemeris code it bundles
  remains AGPL-3.0 — the packager cannot relicense Astrodienst's code, and the
  AGPL terms govern the ephemeris portions here.

Commercial use of the Swiss Ephemeris *without* AGPL obligations requires a
separate commercial license from Astrodienst AG. You can purchase the professional license here: https://www.astro.com/swisseph/swephprice_e.htm.

**Credits:** Swiss Ephemeris — Dieter Koch & Alois Treindl, Astrodienst AG.

### GeoNames location data

The location lookup feature is designed to consume geographic data sourced from
**GeoNames** (<https://www.geonames.org/>), which is licensed under the
**Creative Commons Attribution 4.0 License (CC BY 4.0)**. The original database
is modified, filtered, and optimized for lookup performance. GeoNames data is
not redistributed in this repository; it is downloaded and imported by the site
operator (see above). Attribution to GeoNames is surfaced in the in-app import UI.
