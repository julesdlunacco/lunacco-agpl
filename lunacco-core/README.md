# LunaCco Core

Host plugin for the LunaCco platform. Provides:

- The **SPA shell** (React provider tree, header/nav/footer, hash-based router)
- **Authentication** — magic login links, sessions, IP-based brute-force protection
- **Credit system & ledger** — all credit operations flow through `class-credit-system.php`
- **Module & chart registries** — how feature modules (e.g. AstroHD) plug into the shell
- **Definition engine** — interpretive content templates
- **AI configuration**, profiles, settings, and admin pages

Modules communicate with core **only** through WordPress hooks, filters, and REST
endpoints — never direct file includes. This boundary keeps separately-licensed
modules independent.

## License

Licensed under **AGPL-3.0-or-later** — see [`LICENSE`](LICENSE).

## Build & install

This plugin is published together with `lunacco-astrohd`. See the monorepo root
README for full build and WordPress installation instructions:
<https://github.com/julesdlunacco/lunacco-agpl>.

Quick build of the SPA:

```bash
cd spa
npm install
npm run build   # outputs to spa/dist/
```

Activate **LunaCco Core before** any LunaCco module.
