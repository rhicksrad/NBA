# Hosting

The site is served by Cloudflare as Workers static assets. There is no Worker script: `wrangler.jsonc` points Cloudflare at `public/` and that is the whole deployment.

## How a deploy happens

`.github/workflows/deploy.yml` runs on every merge to `main` and once an hour:

1. `pnpm refresh:live` rebuilds the snapshots under `public/data/live/` (plus rosters and injuries) from ESPN's keyless JSON. Finished game days are cached between runs. A feed that fails keeps its committed snapshot.
2. `pnpm check:site` proves nothing is broken.
3. `wrangler deploy` uploads `public/`. Cloudflare only stores files that changed.

The hourly run is why standings, leaders, injuries and the power index stay current without commits. Scores themselves never wait for a deploy: the browser reads ESPN directly.

## One-time setup (needs a person)

The workflow needs two repository secrets. Until they exist it runs, warns, and deploys nothing.

1. Cloudflare dashboard → My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers**. Scope it to the one account.
2. GitHub → repo Settings → Secrets and variables → Actions → add `CLOUDFLARE_API_TOKEN` (the token; `CLOUDFLARE_API_KEY` is accepted too) and `CLOUDFLARE_ACCOUNT_ID` (shown on the Workers overview page).
3. Run the **Deploy** workflow once from the Actions tab. The Worker is named `nba` and appears at `nba.<your-subdomain>.workers.dev`. Attach a custom domain under the Worker's Settings → Domains & Routes if wanted.

To deploy by hand from a machine where `wrangler login` has been run: `pnpm deploy`.

## Details

- `public/_headers` sets cache lifetimes: fonts for a year, art for a month, live snapshots for five minutes.
- `public/404.html` is served for unknown paths.
- Pages link to each other with relative URLs and no `<base>` tag, so the site works at a domain root, on `workers.dev`, or under any path.
- GitHub Pages was the previous host. Its workflow is gone; turn Pages off in repo Settings → Pages once the Cloudflare URL is confirmed.
