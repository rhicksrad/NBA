# NBA Pulse project site

NBA Pulse is a lightweight GitHub Pages experience that highlights league momentum with static JSON snapshots and accessible SVG charts.

## Local development

1. Ensure Node.js 20+ is installed and Corepack is enabled (`corepack enable`).
2. Install dependencies with PNPM:
   ```bash
   pnpm install
   ```
3. Build the TypeScript modules and hashed browser bundle:
   ```bash
   pnpm run build
   ```
4. Serve the repository root with any static file server (for example `pnpm dlx serve .`) and open `http://localhost:3000/index.html`.

## Data snapshots

All runtime data lives in `data/` as versioned JSON files. Each file includes ISO timestamps and source metadata validated through `schemas/*.json`.

To revalidate data locally:
```bash
pnpm run validate:data
```

## Continuous integration

GitHub Actions validates every push to the default branch:
- `pnpm run validate:data` ensures JSON snapshots comply with their schemas.
- `linkinator` checks for broken links.
- Lighthouse CI enforces performance, accessibility, best practices, and SEO budgets before deploying to GitHub Pages.

## Deployment

The `github-pages` workflow builds the hashed JavaScript bundle, uploads the static artifact, and publishes to the `gh-pages` branch that backs `https://rhicksrad.github.io/NBA/`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and PR expectations.
