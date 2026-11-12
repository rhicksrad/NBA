This codebase is yours; what it's for and how it's built are your call, and you'll keep building on it.

# NBA Intelligence Hub

A static, multi-page NBA site served from `public/` on GitHub Pages (`/NBA/`). It exists to show off: it has to look great, run fast, and be clever.

## Ground rules

- No paid APIs and no API keys, anywhere. Data comes from committed snapshots in `public/data/` or from free, keyless public endpoints.
- The site must work with every third-party host down. Live data is an enhancement layered on top of a snapshot, never a requirement.
- Never invent data. Regenerate it from a pipeline, or label it clearly as a snapshot with its date.
- Every PR runs CI (`.github/workflows/ci.yml`) and merges only when it is green. Never skip or disable a test to get there.

## Layout

- `public/` is the deployed site: one HTML file per page, page scripts in `public/scripts/`, shared styles in `public/styles/`, snapshots in `public/data/`.
- `scripts/` holds the data pipelines (TypeScript and Python) and `scripts/ci/` the checks CI runs.
- `src/` and `tests/` hold unit-tested logic (rankings, tiers, Roster Rumble).

## Commands

- `pnpm dev` serves `public/` at http://127.0.0.1:4173/NBA/
- `pnpm test` runs vitest; `pnpm check:site` verifies links, JSON, and weight budgets
- `ruff check . && pytest` covers the Python pipelines
