#!/usr/bin/env bash
# Register one self-hosted web runner for this repo on this PC.
#
# Run as the unprivileged `ghrunner` user (never as your own login), once per PC:
#   TOKEN=<registration token> bash tools/ci/setup_web_runner.sh
#
# Get the token (valid one hour, needs admin on the repo) from a machine with gh:
#   gh api -X POST repos/rhicksrad/NBA/actions/runners/registration-token -q .token
#
# Re-running is safe: an already-configured runner is left alone and only its
# environment, hook and service files are refreshed.
set -euo pipefail

REPO=${REPO:-rhicksrad/NBA}
RUNNER_VERSION=${RUNNER_VERSION:-2.338.2}
HOST=$(hostname | tr 'A-Z' 'a-z')
[ "$HOST" = "presidentscroob" ] && HOST=scroob
SLUG=$(echo "${REPO#*/}" | tr 'A-Z' 'a-z')
NAME=${NAME:-$HOST-$SLUG}
BASE=$HOME/actions-runners
DIR=$BASE/$SLUG
SERVICE=runner-$SLUG

if [ "$(id -un)" != "ghrunner" ] && [ "${ALLOW_ANY_USER:-0}" != "1" ]; then
  echo "Run this as the ghrunner user (sudo -iu ghrunner). This repo is public, so its" >&2
  echo "runner must not be able to read your gh token, SSH keys or clones." >&2
  exit 1
fi

mkdir -p "$DIR" "$BASE/_toolcache" "$BASE/ms-playwright" "$HOME/.config/systemd/user"
install -m 0755 "$(dirname "$0")/refuse_untrusted.sh" "$BASE/refuse_untrusted.sh"

if [ ! -x "$DIR/config.sh" ]; then
  curl -fsSL "https://github.com/actions/runner/releases/download/v$RUNNER_VERSION/actions-runner-linux-x64-$RUNNER_VERSION.tar.gz" | tar xz -C "$DIR"
fi

if [ ! -f "$DIR/.runner" ]; then
  : "${TOKEN:?Set TOKEN to a runner registration token (see the header of this script)}"
  # Labels say what the runner has. web-trusted is the on/off switch workflows target.
  LABELS=web,web-trusted,$HOST
  command -v uv >/dev/null 2>&1 && LABELS=$LABELS,python
  [ "${PLAYWRIGHT:-1}" = "1" ] && LABELS=$LABELS,playwright
  (cd "$DIR" && ./config.sh --unattended --url "https://github.com/$REPO" --token "$TOKEN" --name "$NAME" --labels "$LABELS" --work _work)
fi

cat > "$DIR/.env" <<ENV
PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin
RUNNER_TOOL_CACHE=$BASE/_toolcache
PLAYWRIGHT_BROWSERS_PATH=$BASE/ms-playwright
ACTIONS_RUNNER_HOOK_JOB_STARTED=$BASE/refuse_untrusted.sh
ENV

# One slice caps every web runner on the PC together, so five repos firing at
# once cannot starve it.
cat > "$HOME/.config/systemd/user/web-runners.slice" <<SLICE
[Slice]
CPUQuota=400%
MemoryMax=8G
SLICE

cat > "$HOME/.config/systemd/user/$SERVICE.service" <<UNIT
[Unit]
Description=GitHub Actions runner $NAME ($REPO)
After=network-online.target

[Service]
WorkingDirectory=$DIR
ExecStart=$DIR/run.sh
Restart=always
RestartSec=10
Nice=15
Slice=web-runners.slice

[Install]
WantedBy=default.target
UNIT

# Weekly disk upkeep: prune the shared pnpm store and old runner temp files and logs.
cat > "$HOME/.config/systemd/user/web-runners-cleanup.service" <<UNIT
[Unit]
Description=Weekly cleanup for self-hosted web runners

[Service]
Type=oneshot
ExecStart=/usr/bin/env bash -c 'command -v pnpm >/dev/null && pnpm store prune; find $BASE/*/_work/_temp -mindepth 1 -mtime +14 -delete 2>/dev/null; find $BASE/*/_diag -name "*.log" -mtime +14 -delete 2>/dev/null; true'
UNIT
cat > "$HOME/.config/systemd/user/web-runners-cleanup.timer" <<UNIT
[Unit]
Description=Weekly cleanup for self-hosted web runners

[Timer]
OnCalendar=weekly
Persistent=true

[Install]
WantedBy=timers.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE" web-runners-cleanup.timer
echo "Runner $NAME is registered for $REPO and running as $SERVICE."
echo "Check it: systemctl --user status $SERVICE"
