Agent Operating Guide 

## 1) Non-negotiables

* Treat Ball Don’t Lie (BDL) as the source of truth for NBA data. Do not “fix” their data. Only fix my code and my mapping.
* Never invent rosters, teams, or schedules. If an endpoint does not provide what you need, change the endpoint or parameters.
* Keep the site static and GitHub Pages friendly. No servers, no binary artifacts, no headless Chrome, no Docker.
* Prefer small, composable scripts over one large script. Everything must run with `pnpm` tasks.

## 2) API usage rules for BDL

* Authentication

  * All BDL requests must include `Authorization: <API_KEY>` header.
  * Assume the key is injected at build time. Do not fetch `/data/bdl-key.json` from the client. That pattern fails on Pages.
  * Read the key from `import.meta.env.VITE_BDL_KEY` in browser code, or `process.env.BALLDONTLIE_API_KEY` in Node scripts.
* Endpoints to use

  * Teams: `GET /v1/teams`
  * Active players: `GET /v1/players/active` with pagination
  * Players search: `GET /v1/players?search=<q>` with pagination
  * Games by date range: `GET /v1/games?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` with pagination
  * Player season stats: `GET /v1/season_averages?season=<year>&player_ids[]=...`
  * Use `per_page=100` and follow cursor pagination via `meta.next_cursor` until it is null.
* Pagination and retries

  * Implement a shared `fetchAll` with cursor support. Stop only when `next_cursor` is null.
  * On 429 or 5xx, exponential backoff with jitter. Max 4 attempts per page.
* Roster construction

  * Use `/players/active` as the canonical list, then group by `team.id`.
  * Enforce `MAX_TEAM_ACTIVE = 30` when rendering, but never truncate the data in storage.
  * Never fall back to historical endpoints to “pad” active rosters.
* Historical player search

  * Build a static index by crawling paginated `/players?per_page=100` across the full ID space.
  * Cache a flat `players_all.json` with `id`, `first_name`, `last_name`, `team` last seen, height, weight, and known years.
  * Client search runs against that static file, not live queries.

## 3) Secrets and build-time injection

* Do not try to load `data/bdl-key.json` at runtime. That led to 404s and is the wrong pattern for Pages.
* Inject the key at build:

  * Browser code uses `Vite define` or a small replace step to bake `VITE_BDL_KEY`.
  * Node scripts read `BALLDONTLIE_API_KEY`.
* Never print the key in logs or HTML. Never commit the key or any generated file that contains it.

### Minimal replacement step for a non-Vite stack

* Add a tiny replacer to `scripts/build/define_env.mjs` that replaces `__VITE_BDL_KEY__` in `dist/*.js` with the secret during CI.
* Reference `const BDL_KEY = import.meta.env?.VITE_BDL_KEY ?? "__VITE_BDL_KEY__";` in browser code.

## 4) GitHub Actions that always work

* Install pnpm before using it. Do not assume the runner has pnpm.

```yaml
name: Previews pipeline

on:
  push:
    branches: [main]
  schedule:
    - cron: "27 7 * * *"

jobs:
  build-previews:
    runs-on: ubuntu-latest
    env:
      BALLDONTLIE_API_KEY: ${{ secrets.BALLDONTLIE_API_KEY }}
      VITE_BDL_KEY: ${{ secrets.BALLDONTLIE_API_KEY }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.12.1
          run_install: false

      - name: Install
        run: pnpm i --frozen-lockfile

      - name: Build data
        run: pnpm build:data

      - name: Generate previews
        run: pnpm gen:previews

      - name: Validate previews
        run: pnpm validate:previews

      - name: Build site
        run: pnpm build

      - name: Upload pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist
```

Notes

* Put any one-off text replacement for `__VITE_BDL_KEY__` right before “Build site”.
* Do not curl secrets to files inside `dist`. Secrets inside `dist` become public.

## 5) Data freshness and staleness

* Preview generators must log the exact source and timestamp for each dataset they emit.
* If a preview references a traded player or old team mapping, treat it as a data refresh bug, not a content bug. Regenerate from BDL with current endpoints.
* Validations must check “did we use the right source and parameters” rather than “does the data look plausible”.

## 6) Mapping discipline

* Maintain a single `TEAM_METADATA` map keyed by BDL team IDs. No hardcoded abbreviations that drift from the API.
* All roster and schedule grouping must key off `team.id` from BDL responses.
* When merging multiple sources, BDL wins. External nicknames or legacy IDs are advisory only.

## 7) Frontend rules

* Use the shared header and `hub-nav` styles on every page, including previews.
* Ship one hashed JS bundle `main.<hash>.js` and update references automatically after build.
* No inline secrets in HTML. Access the key via the env constant only.
* Avoid long runtime chains on page load. Precompute heavy data to JSON during CI and fetch that JSON from the site.

## 8) Error handling that helps debugging

* Wrap every network call with a named `request()` that throws typed errors, for example `ApiKeyMissingError`, `RateLimitError`, `HttpError`.
* In the UI, show a terse banner with the error class and action taken. Log the full detail to `console.debug`.
* Never swallow 401 or 404. Surface them with endpoint and params.

## 9) Commands the agent can run locally

* `pnpm verify:bdl` must only validate that we hit the right endpoints with the right params and that pagination is complete.
* `pnpm build:data` fetches from BDL and writes canonical JSON under `data/`.
* `pnpm gen:previews` renders static previews from canonical JSON.
* `pnpm validate:previews` ensures no pages refer to missing players, teams, or mismatched seasons.
* `pnpm build` emits production assets to `dist/`.

## 10) Conflict hygiene

* When resolving merge conflicts in shared CSS or HTML, prefer the version that contains `hub-nav`, dark header gradients, and link color mixes. That is the current site style.
* Remove all conflict markers and reformat files with the project formatter before committing.

## 11) Games and schedules

* To show past games, call `GET /v1/games` with a bounded `start_date` and `end_date`. Paginate fully.
* Do not try to infer “yesterday” on the server. Compute ranges in scripts with explicit dates, checked into previews.

## 12) Historical players page

* Build once during CI by crawling all players. Save `players_all.json` with a compact schema.
* Client page `history.html`:

  * Text search over `players_all.json`
  * On select, fetch season averages for target seasons to render GOAT score and percentile cards
  * Do not compute percentiles against live data at runtime. Use precomputed distributions from `data/percentiles.json`.

## 13) Style for code that touches BDL

Use this exact scaffold when writing new fetchers:

```ts
const API = "https://api.balldontlie.io/v1";
const KEY = import.meta.env?.VITE_BDL_KEY ?? process.env.BALLDONTLIE_API_KEY ?? "";
if (!KEY) throw new Error("Ball Don't Lie API key missing");

type Meta = { next_cursor?: number | null };
type Page<T> = { data: T[]; meta?: Meta };

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: KEY },
  });
  if (res.status === 401) throw new Error(`401 Unauthorized ${url}`);
  if (res.status === 429) throw new Error(`429 Rate limited ${url}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} ${url}`);
  return res.json() as Promise<T>;
}

async function fetchAll<T>(path: string, qs: Record<string, string | number> = {}): Promise<T[]> {
  const out: T[] = [];
  let cursor: number | null | undefined = undefined;
  do {
    const params = new URLSearchParams({ per_page: "100", ...Object.fromEntries(Object.entries(qs).map(([k,v]) => [k, String(v)])) });
    if (cursor != null) params.set("cursor", String(cursor));
    const page = await request<Page<T>>(`${API}${path}?${params.toString()}`);
    out.push(...page.data);
    cursor = page.meta?.next_cursor ?? null;
  } while (cursor);
  return out;
}
```

## 14) What not to do

* Do not call undocumented endpoints.
* Do not synthesize rosters from news or scrapes.
* Do not put secrets in static JSON files or commit history.
* Do not re-validate BDL content semantics. Validate that we used the correct API and pagination.

---

Paste this into `agents.md` and keep it at the top. It tells the agent exactly how to fetch, how to build, how to inject secrets correctly, and how to stop “fixing” the data when the real bug is our code or pipeline.

Canonical workflow rules

Never write or edit previews directly. Always call the scripts:

pnpm previews

Data input: read only from canonical JSON sources under data/.

Fixing mappings: if you need to fix a player/team mapping, edit data/2025-26/manual/overrides.yaml and re-run.

If validator fails, fix the data then regenerate. Do not bypass.

Season framing

Treat the 2025–2026 NBA season as the current active season.

Treat the 2024–2025 campaign as the most recently completed season.

All data summaries, visualizations, and narratives must explicitly call out this distinction.

Repository guidelines

Prefer Python 3.11 when running local tooling.

Run ruff check . and pytest before submitting changes that touch Python code.

Keep helper scripts importable (no top-level work at import time) so they remain testable.

Use UTF-8 encoding for text files, with trailing newlines.

Never add or commit binary files to the repository.

Data integrity and reproducibility

Data is authoritative. No agent is permitted to “invent” values, narratives, or statistics.

All rosters, stats, and schedules must come from the designated fetcher scripts (e.g. BallDontLie API wrappers) and stored JSON under public/data/.

If an upstream fetch fails:

Use the last-good JSON.

Record failure details in a *.failed.json alongside.

Do not generate previews or pages from incomplete data.

Each generated artifact must be reproducible from script + data only.

Previews and outputs

Previews are regenerated solely from JSON + overrides + templates.

Narrative text must be drawn from templates or structured input data.

Agents must never append “free text” commentary.

If additional context is required (injuries, trades, etc.), it must be encoded in data/ and cited by the generator.

Frontend and site rules

All HTML pages should import assets from /assets/js/ modules and /public/data/ JSON.

No hardcoded season rosters in the HTML.

Include timestamp + source attribution when displaying fetched data.

GitHub / CI rules

Use pnpm with corepack; do not mix installer methods.

GitHub Actions should:

Fetch data via scripts before build.

Validate data (counts, schema) before deploy.

Refuse to deploy if validation fails.
