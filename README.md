# NBA Intelligence Hub

A fan-made NBA site: tonight's scoreboard with win chances, a schedule-adjusted power index, standings, leaders and the injury wire, plus deeper pages on players, teams, the GOAT Index, league history and the 2024-25 calendar.

It runs with no paid feeds and no API keys. Every page paints from a snapshot stored with the site, then asks ESPN's public JSON for anything newer.

## Run it

Node 20 and pnpm 9.

```bash
pnpm install
pnpm dev            # http://127.0.0.1:4173/
```

## Check it

```bash
pnpm test           # unit tests (parsers, power index, rankings)
pnpm check:site     # broken references, invalid JSON, page weight budgets
pnpm check:smoke    # every page in real Chromium, offline, phone + desktop
ruff check . && pytest
```

CI runs all of these on every pull request. See [docs/CI.md](docs/CI.md).

## How the data works

| What | Where it comes from | Refreshed |
| --- | --- | --- |
| Scores, clocks, box scores | ESPN public scoreboard, read by the browser | every 20 seconds during games |
| Standings, leaders, injuries, rosters | ESPN public JSON, via `pnpm refresh:live` | hourly, at deploy |
| Power index, win chances | computed in `scripts/refresh/power.mjs` from every final this season | hourly, at deploy |
| History, GOAT Index, Rewind, Insights | archived snapshots in `public/data/` | fixed |

## Hosting

Cloudflare Workers static assets, deployed by GitHub Actions on every merge and once an hour. See [docs/HOSTING.md](docs/HOSTING.md).

## Working on it

[AGENTS.md](AGENTS.md) has the ground rules, the design system and the repository layout.

NBA team names and logos belong to the NBA and its teams. This is an independent fan project with no affiliation.
