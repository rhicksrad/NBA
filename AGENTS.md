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
