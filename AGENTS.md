This codebase is yours; what it's for and how it's built are your call, and you'll keep building on it.

# NBA Intelligence Hub

A static, multi-page NBA site served from `public/` by Cloudflare (Workers static assets). It exists to show off: it has to look great, run fast, and be clever.

## Ground rules

- No paid APIs and no API keys, anywhere. Data comes from committed snapshots in `public/data/` or from ESPN's free, keyless JSON.
- The site must work with every third-party host down. Pages paint from a snapshot first; live data is layered on top, never required. The browser smoke test enforces this.
- Never invent data. Compute it from a real feed, or label it as a snapshot with its date. A panel whose numbers cannot be traced to a source gets deleted, not restyled.
- ESPN's scoreboard rejects multi-day date ranges with HTTP 400. Ask for one day at a time.
- Every PR runs CI (`.github/workflows/ci.yml`) and merges only when it is green. Never skip or disable a test to get there. `docs/CI.md` explains the self-hosted runners and why fork PRs never touch them.

## Design: "Court"

The look is taken from the game's own objects: scorebook paper, navy ink, key-paint vermilion, maple hardwood, a bulb scoreboard. Tokens, fonts and shared components live in `public/styles/court.css`, loaded after any legacy stylesheet.

- Type: Big Shoulders for display, Archivo for text, Doto only for scoreboard digits. All self-hosted in `public/assets/fonts/`.
- Square corners (`--r: 3px`), flat fills, hairline rules. No gradients, glass, glows, pill buttons or drop shadows.
- Numbers go in tables (`.sheet`), not in grids of cards. Uppercase eyebrow labels are rare.
- Art in `public/assets/art/` was generated with Codex CLI image generation on Ryan's PC and converted to WebP. Add new art the same way and keep each file small.
- Pages use relative URLs and no `<base>` tag.

## Layout

- `public/` is the deployed site: one HTML file per page, page scripts in `public/scripts/`, styles in `public/styles/`, snapshots in `public/data/`.
- `public/assets/js/espn.js` is the live data layer. `public/assets/js/bdl.js` keeps the old paid-API call shape for legacy page scripts and answers from ESPN and snapshots.
- `scripts/refresh/` builds the live snapshots (`live.mjs`), with the parsers and the power index unit-tested against recorded ESPN responses in `scripts/testdata/espn/`.
- `scripts/ci/` holds the checks CI runs. Other folders under `scripts/` are older one-off pipelines; some still expect the retired paid API and are not run by anything.
- `src/` and `tests/` hold unit-tested logic (rankings, tiers, Roster Rumble).

## Commands

- `pnpm dev` serves `public/` at http://127.0.0.1:4173/
- `pnpm test` runs vitest; `pnpm check:site` verifies links, JSON and weight budgets; `pnpm check:smoke` runs the browser smoke test
- `pnpm refresh:live` rebuilds the live snapshots (needs network access to ESPN)
- `ruff check . && pytest` covers the Python pipelines
- Hosting and deploys: `docs/HOSTING.md`
