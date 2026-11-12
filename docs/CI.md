# CI

Every pull request runs the gate in `.github/workflows/ci.yml`. A PR merges only when it is green.

| Job | What it proves | Runner labels when local |
| --- | --- | --- |
| Gate (tests + integrity) | vitest passes; no broken local references, invalid JSON snapshots or pages over their weight budget | `self-hosted, web-trusted` |
| Python (ruff + pytest) | the data pipelines lint clean and their tests pass | `self-hosted, web-trusted, python` |
| Browser smoke | every page loads in real Chromium at phone and desktop width with all outside hosts blocked: no script errors, no sideways scroll, fonts loaded, home page painted from its snapshot, and a recorded ESPN scoreboard turns into game tiles | `self-hosted, web-trusted, playwright` |

The deploy (`deploy.yml`, see `docs/HOSTING.md`) stays on GitHub-hosted runners on purpose: it keeps the Cloudflare token off the PCs, and the site must deploy when every PC is off. It uses `concurrency: deploy` without cancelling, so a deployment in progress always finishes.

## Where jobs run

This follows the runner plan in `rhicksrad/Pharaoh` → `docs/CI_RUNNERS.md`, Part 2.

- **Repo variable `CI_RUNNER`** is the switch. Set it to `local` and same-repo PRs run on the self-hosted web runners. Delete it and everything runs on `ubuntu-latest`. Use the fallback when the PCs are off: a job whose labels match no online runner queues silently for up to 24 hours instead of failing.
- **Fork PRs never run on the PCs.** This repo is public, so the routing expression sends any PR whose head is another repository to a hosted runner. Because a fork can edit that expression, two more layers back it up:
  1. Settings → Actions → General → *Fork pull request workflows from outside collaborators* → **Require approval for all outside collaborators**.
  2. `tools/ci/refuse_untrusted.sh`, installed as each runner's job-started hook, fails any fork PR or `pull_request_target` job before a step runs, and refuses work when the disk has under 10 GB free.
- Workflows default to `permissions: contents: read`. Only the deploy job reads secrets (the Cloudflare token), and it runs on `main`, never on a PR. No workflow uses `pull_request_target`.

## Caching and cleanup

- Hosted jobs use GitHub's cache (`setup-node` for pnpm, `setup-python` for pip). Self-hosted jobs skip it: the PCs keep one shared pnpm store, one Node tool cache (`RUNNER_TOOL_CACHE`) and one Playwright browser folder on disk, which is faster and free.
- Python on the PCs goes through `uv`, because `setup-python` ships Ubuntu builds and can refuse other distros.
- Each self-hosted job ends with `git clean -ffdx`, and checkout cleans again at the start of the next run. A weekly user timer prunes the pnpm store and deletes runner temp files and logs older than 14 days.
- A new push to a PR cancels the run in progress (`concurrency` keyed on workflow and ref).

## Registering a runner (once per PC, by a person)

On a personal account a runner belongs to exactly one repository, so each PC that should serve this repo needs its own small runner for it. PresidentScroob and MajorAsshole take web jobs; DarkHelmet does not (it is the perf-timing box).

One time per PC:

```bash
sudo adduser --disabled-password --gecos '' ghrunner
sudo loginctl enable-linger ghrunner
sudo npx playwright install-deps chromium   # system libraries for Chromium
```

Then get a registration token (valid one hour, needs admin on the repo):

```bash
gh api -X POST repos/rhicksrad/NBA/actions/runners/registration-token -q .token
```

and, as `ghrunner`, from a clone of this repo:

```bash
TOKEN=<token> bash tools/ci/setup_web_runner.sh
```

The script downloads the runner, registers it as `<host>-nba` with the labels `web, web-trusted, <host>` (plus `python` when `uv` is installed, and `playwright`), installs the job-started hook, and runs it as a user systemd service inside a shared `web-runners.slice` capped at four cores and 8 GB.

Finally, in the repository: require approval for outside collaborators' fork PRs, then set the variable `CI_RUNNER=local`. Open a same-repo PR and confirm the job names a local runner.

Check the runners any time:

```bash
gh api repos/rhicksrad/NBA/actions/runners --jq '.runners[] | "\(.name) \(.status) \([.labels[].name]|join(","))"'
```

Remove one with `./config.sh remove --token <removal token>` in its folder, then disable its service.
