import { bdl } from '../assets/js/bdl.js';
import { helpers } from './hub-charts.js';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const params = new URLSearchParams(window.location.search);
const rawGameId = params.get('gameId') || params.get('id');

const matchupTitle = document.querySelector('[data-matchup]');
const seasonLabel = document.querySelector('[data-season-label]');
const statusChip = document.querySelector('[data-status-label]');
const tipoffLabel = document.querySelector('[data-tipoff]');
const stageLabel = document.querySelector('[data-stage-label]');
const updatedLabel = document.querySelector('[data-updated]');
const trackerMessage = document.querySelector('[data-tracker-message]');
const previewCta = document.querySelector('[data-preview-cta]');
const previewLink = document.querySelector('[data-preview-link]');
const scoreboardStatus = document.querySelector('[data-game-status]');
const manualRefreshButton = document.querySelector('[data-manual-refresh]');

const teamTargets = {
  visitor: {
    name: document.querySelector('[data-team-name="visitor"]'),
    score: document.querySelector('[data-team-score="visitor"]'),
    record: document.querySelector('[data-team-record="visitor"]'),
    totals: document.querySelector('[data-team-totals="visitor"]'),
    state: document.querySelector('[data-team-state="visitor"]'),
    pace: document.querySelector('[data-team-pace="visitor"]'),
    totalsCard: document.querySelector('[data-team-card="visitor"]'),
    totalsTitle: document.querySelector('[data-team-label="visitor"]'),
    leadersBody: document.querySelector('[data-leaders-body="visitor"]'),
    leadersState: document.querySelector('[data-leaders-state="visitor"]'),
    leadersTitle: document.querySelector('[data-leaders-label="visitor"]'),
  },
  home: {
    name: document.querySelector('[data-team-name="home"]'),
    score: document.querySelector('[data-team-score="home"]'),
    record: document.querySelector('[data-team-record="home"]'),
    totals: document.querySelector('[data-team-totals="home"]'),
    state: document.querySelector('[data-team-state="home"]'),
    pace: document.querySelector('[data-team-pace="home"]'),
    totalsCard: document.querySelector('[data-team-card="home"]'),
    totalsTitle: document.querySelector('[data-team-label="home"]'),
    leadersBody: document.querySelector('[data-leaders-body="home"]'),
    leadersState: document.querySelector('[data-leaders-state="home"]'),
    leadersTitle: document.querySelector('[data-leaders-label="home"]'),
  },
};

let refreshTimer = null;
let loading = false;

function setTrackerMessage(message, tone = 'default') {
  if (!trackerMessage) {
    return;
  }
  trackerMessage.textContent = message;
  trackerMessage.dataset.tone = tone;
}

function setManualRefreshDisabled(disabled) {
  if (!manualRefreshButton) {
    return;
  }
  manualRefreshButton.disabled = Boolean(disabled);
}

function parseGameId(value) {
  if (!value) {
    return null;
  }
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

function parseDateTime(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function parseDateOnly(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function formatSeasonLabel(season) {
  if (!Number.isFinite(season)) {
    return 'Season TBD';
  }
  const next = season + 1;
  const suffix = String(next).slice(-2);
  return `${season}-${suffix} season`;
}

function formatDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(date);
  } catch (error) {
    console.warn('Unable to format date', error);
    return date.toISOString();
  }
}

function formatTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch (error) {
    return '';
  }
}

function normalizeTeam(raw, scoreValue) {
  const name =
    typeof raw?.full_name === 'string' && raw.full_name
      ? raw.full_name
      : typeof raw?.name === 'string' && raw.name
      ? raw.name
      : 'Team';
  const abbreviation =
    typeof raw?.abbreviation === 'string' && raw.abbreviation
      ? raw.abbreviation
      : name.slice(0, 3);
  return {
    id: Number.isFinite(raw?.id) ? raw.id : null,
    name,
    abbreviation: abbreviation ? abbreviation.toUpperCase() : '',
    score: Number.isFinite(scoreValue) ? Number(scoreValue) : 0,
  };
}

function computeStage(status, period) {
  const normalized = (status ?? '').toString().toLowerCase();
  if (normalized.includes('final')) {
    return 'final';
  }
  if (Number(period) > 0) {
    return 'live';
  }
  return 'upcoming';
}

function normalizeGame(raw) {
  if (!raw) {
    return null;
  }
  const status = typeof raw.status === 'string' ? raw.status : '';
  const period = Number.isFinite(raw.period) ? raw.period : 0;
  const time = typeof raw.time === 'string' ? raw.time.trim() : '';
  const tipoff = parseDateTime(raw.datetime) || parseDateOnly(raw.date);
  const stage = computeStage(status, period);
  return {
    id: Number.isFinite(raw.id) ? raw.id : null,
    season: Number.isFinite(raw.season) ? raw.season : null,
    seasonType: typeof raw.season_type === 'string' ? raw.season_type : '',
    status,
    stage,
    period,
    time,
    tipoff,
    postseason: Boolean(raw.postseason),
    home: normalizeTeam(raw.home_team, raw.home_team_score),
    visitor: normalizeTeam(raw.visitor_team, raw.visitor_team_score),
  };
}

function normalizeStatusText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeClockValue(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, '') : '';
}

function parseElapsedClockValue(value) {
  const sanitized = sanitizeClockValue(value);
  if (!sanitized) {
    return null;
  }
  const match = sanitized.match(/^(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!match) {
    return null;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  const decimals = match[3] ? Math.min(match[3].length, 3) : 0;
  const precision = decimals ? 10 ** decimals : 1;
  const fractional = match[3] ? Number(match[3].slice(0, decimals)) : 0;
  return {
    sanitized,
    minutes,
    seconds,
    decimals,
    precision,
    fractional,
  };
}

function getPeriodDurationSeconds(period) {
  const normalized = Number(period);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  return normalized > 4 ? 5 * 60 : 12 * 60;
}

function formatGameClock(game) {
  if (!game || game.stage !== 'live') {
    return sanitizeClockValue(game?.time);
  }
  const parsed = parseElapsedClockValue(game.time);
  const periodDuration = getPeriodDurationSeconds(game.period);
  if (!parsed || !periodDuration) {
    return sanitizeClockValue(game.time);
  }
  const elapsedUnits =
    parsed.minutes * 60 * parsed.precision + parsed.seconds * parsed.precision + parsed.fractional;
  const periodUnits = periodDuration * parsed.precision;
  if (!Number.isFinite(elapsedUnits) || elapsedUnits < 0) {
    return sanitizeClockValue(game.time);
  }
  let remainingUnits = periodUnits - elapsedUnits;
  if (remainingUnits < 0) {
    remainingUnits = 0;
  }
  let minutes = Math.floor(remainingUnits / (60 * parsed.precision));
  let remainder = remainingUnits - minutes * 60 * parsed.precision;
  let seconds = Math.floor(remainder / parsed.precision);
  let fractionalUnits = remainder - seconds * parsed.precision;

  if (seconds >= 60) {
    minutes += Math.floor(seconds / 60);
    seconds %= 60;
  }

  if (minutes < 0) {
    minutes = 0;
  }

  let clock = `${minutes}:${String(seconds).padStart(2, '0')}`;
  if (parsed.decimals > 0) {
    const fractionText = String(fractionalUnits)
      .padStart(parsed.decimals, '0')
      .replace(/0+$/, '');
    if (fractionText) {
      clock += `.${fractionText}`;
    }
  }
  return clock;
}

function formatPeriodLabel(game) {
  if (game.stage === 'final') {
    return 'Final';
  }
  const period = Number.isFinite(game?.period) ? Number(game.period) : 0;
  if (period <= 0) {
    return '';
  }
  if (period === 1) return '1st Qtr';
  if (period === 2) return '2nd Qtr';
  if (period === 3) return '3rd Qtr';
  if (period === 4) return '4th Qtr';
  const overtimeIndex = period - 4;
  return overtimeIndex === 1 ? 'OT' : `${overtimeIndex}OT`;
}

function formatGameStatus(game) {
  if (!game) {
    return '';
  }
  const status = normalizeStatusText(game.status);
  const normalized = status.toLowerCase();
  const clock = formatGameClock(game);
  const periodLabel = formatPeriodLabel(game);

  if (game.stage === 'final' || normalized.includes('final')) {
    return 'Final';
  }

  if (normalized.includes('scheduled')) {
    return 'Scheduled';
  }

  if (normalized.includes('progress')) {
    if (periodLabel && clock) {
      return `${status} • ${periodLabel} ${clock}`;
    }
    if (periodLabel) {
      return `${status} • ${periodLabel}`;
    }
    if (clock) {
      return `${status} • ${clock}`;
    }
    return status || 'In Progress';
  }

  if (game.stage === 'live') {
    if (periodLabel && clock) {
      return `${periodLabel} ${clock}`;
    }
    if (periodLabel) {
      return periodLabel;
    }
    if (clock) {
      return clock;
    }
    return status || 'In Progress';
  }

  if (game.stage === 'upcoming') {
    if (status) {
      return status;
    }
    if (game.tipoff instanceof Date) {
      return `Tip ${formatTime(game.tipoff)}`;
    }
    return 'Scheduled';
  }

  return status;
}

function percentage(makes, attempts) {
  if (!Number.isFinite(makes) || !Number.isFinite(attempts) || attempts <= 0) {
    return null;
  }
  return (makes / attempts) * 100;
}

function formatShotLine(makes, attempts) {
  const made = helpers.formatNumber(Number(makes) || 0, 0);
  const taken = helpers.formatNumber(Number(attempts) || 0, 0);
  const pct = percentage(Number(makes) || 0, Number(attempts) || 0);
  if (pct === null) {
    return `${made}-${taken}`;
  }
  return `${made}-${taken} (${helpers.formatNumber(pct, 1)}%)`;
}

function computePossessions(totals) {
  if (!totals) {
    return null;
  }
  const fga = Number(totals.fga ?? 0);
  const fta = Number(totals.fta ?? 0);
  const oreb = Number(totals.oreb ?? 0);
  const turnover = Number(totals.turnover ?? 0);
  return fga + 0.44 * fta - oreb + turnover;
}

function parseMinutesToSeconds(value) {
  if (typeof value !== 'string') {
    return 0;
  }
  const match = value.trim().match(/^(\d+):(\d{2})$/);
  if (!match) {
    return 0;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return 0;
  }
  return minutes * 60 + seconds;
}

function normalizePlayerStat(row) {
  const first = typeof row?.player?.first_name === 'string' ? row.player.first_name.trim() : '';
  const last = typeof row?.player?.last_name === 'string' ? row.player.last_name.trim() : '';
  const name = `${first} ${last}`.trim() || 'Player';
  return {
    id: Number.isFinite(row?.player?.id) ? row.player.id : null,
    name,
    pts: Number(row?.pts ?? 0),
    ast: Number(row?.ast ?? 0),
    reb: Number(row?.reb ?? 0),
    oreb: Number(row?.oreb ?? 0),
    dreb: Number(row?.dreb ?? 0),
    stl: Number(row?.stl ?? 0),
    blk: Number(row?.blk ?? 0),
    turnover: Number(row?.turnover ?? 0),
    pf: Number(row?.pf ?? 0),
    fgm: Number(row?.fgm ?? 0),
    fga: Number(row?.fga ?? 0),
    fg3m: Number(row?.fg3m ?? 0),
    fg3a: Number(row?.fg3a ?? 0),
    ftm: Number(row?.ftm ?? 0),
    fta: Number(row?.fta ?? 0),
    min: typeof row?.min === 'string' ? row.min : '',
  };
}

function aggregateTeamStats(rows) {
  const totals = new Map();
  rows.forEach((row) => {
    const teamId = Number(row?.team?.id);
    if (!Number.isFinite(teamId)) {
      return;
    }
    if (!totals.has(teamId)) {
      totals.set(teamId, {
        teamId,
        pts: 0,
        fgm: 0,
        fga: 0,
        fg3m: 0,
        fg3a: 0,
        ftm: 0,
        fta: 0,
        oreb: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        turnover: 0,
        pf: 0,
        players: [],
      });
    }
    const bucket = totals.get(teamId);
    bucket.pts += Number(row?.pts ?? 0);
    bucket.fgm += Number(row?.fgm ?? 0);
    bucket.fga += Number(row?.fga ?? 0);
    bucket.fg3m += Number(row?.fg3m ?? 0);
    bucket.fg3a += Number(row?.fg3a ?? 0);
    bucket.ftm += Number(row?.ftm ?? 0);
    bucket.fta += Number(row?.fta ?? 0);
    bucket.oreb += Number(row?.oreb ?? 0);
    bucket.reb += Number(row?.reb ?? 0);
    bucket.ast += Number(row?.ast ?? 0);
    bucket.stl += Number(row?.stl ?? 0);
    bucket.blk += Number(row?.blk ?? 0);
    bucket.turnover += Number(row?.turnover ?? 0);
    bucket.pf += Number(row?.pf ?? 0);
    bucket.players.push(normalizePlayerStat(row));
  });
  return totals;
}

function renderSeasonChip(game) {
  if (!seasonLabel) {
    return;
  }
  seasonLabel.textContent = formatSeasonLabel(game.season);
}

function renderStatusChip(stage) {
  if (!statusChip) {
    return;
  }
  if (stage === 'live') {
    statusChip.textContent = 'Live';
    statusChip.dataset.tone = 'accent';
  } else if (stage === 'final') {
    statusChip.textContent = 'Final';
    statusChip.dataset.tone = 'final';
  } else {
    statusChip.textContent = 'Scheduled';
    delete statusChip.dataset.tone;
  }
}

function updateDocumentTitle(game) {
  if (!game) {
    return;
  }
  const matchup = `${game.visitor.abbreviation || game.visitor.name} at ${game.home.abbreviation || game.home.name}`;
  document.title = `${matchup} tracker | NBA Intelligence Hub`;
}

function renderHero(game) {
  if (!game) {
    return;
  }
  const matchup = `${game.visitor.name} at ${game.home.name}`;
  if (matchupTitle) {
    matchupTitle.textContent = matchup;
  }
  renderSeasonChip(game);
  renderStatusChip(game.stage);
  if (tipoffLabel) {
    if (game.stage === 'upcoming' && game.tipoff instanceof Date) {
      tipoffLabel.textContent = `Local tip ${formatDateTime(game.tipoff)}`;
    } else if (game.tipoff instanceof Date) {
      tipoffLabel.textContent = `Tipoff was ${formatDateTime(game.tipoff)}`;
    } else {
      tipoffLabel.textContent = '';
    }
  }
  const status = formatGameStatus(game);
  if (stageLabel) {
    stageLabel.textContent = status;
  }
}

function renderScoreboard(game) {
  if (!game) {
    return;
  }
  const status = formatGameStatus(game);
  if (scoreboardStatus) {
    scoreboardStatus.textContent = status || 'Updating scoreboard…';
  }
  ['visitor', 'home'].forEach((role) => {
    const team = game[role];
    const targets = teamTargets[role];
    if (!targets || !team) {
      return;
    }
    if (targets.name) {
      targets.name.textContent = team.name;
    }
    if (targets.score) {
      targets.score.textContent = helpers.formatNumber(team.score ?? 0, 0);
    }
    if (targets.record) {
      targets.record.textContent = '';
    }
    if (targets.totalsTitle) {
      targets.totalsTitle.textContent = `${team.name} totals`;
    }
    if (targets.leadersTitle) {
      targets.leadersTitle.textContent = `${team.name} leaders`;
    }
  });
}

const TEAM_TOTALS_DEFINITIONS = [
  { key: 'pts', label: 'Points', format: (totals) => helpers.formatNumber(totals.pts ?? 0, 0) },
  { key: 'fg', label: 'Field goals', format: (totals) => formatShotLine(totals.fgm, totals.fga) },
  { key: 'fg3', label: '3-pointers', format: (totals) => formatShotLine(totals.fg3m, totals.fg3a) },
  { key: 'ft', label: 'Free throws', format: (totals) => formatShotLine(totals.ftm, totals.fta) },
  {
    key: 'reb',
    label: 'Rebounds',
    format: (totals) =>
      `${helpers.formatNumber(totals.reb ?? 0, 0)} total (${helpers.formatNumber(totals.oreb ?? 0, 0)} off)`,
  },
  { key: 'ast', label: 'Assists', format: (totals) => helpers.formatNumber(totals.ast ?? 0, 0) },
  { key: 'stl', label: 'Steals', format: (totals) => helpers.formatNumber(totals.stl ?? 0, 0) },
  { key: 'blk', label: 'Blocks', format: (totals) => helpers.formatNumber(totals.blk ?? 0, 0) },
  { key: 'turnover', label: 'Turnovers', format: (totals) => helpers.formatNumber(totals.turnover ?? 0, 0) },
  { key: 'pf', label: 'Fouls', format: (totals) => helpers.formatNumber(totals.pf ?? 0, 0) },
];

function renderTeamTotals(role, totals) {
  const targets = teamTargets[role];
  if (!targets || !targets.totals) {
    return;
  }
  targets.totals.innerHTML = '';
  if (!totals || !Array.isArray(totals.players) || !totals.players.length) {
    const state = document.createElement('div');
    state.className = 'tracker-team-card__state';
    state.textContent = "Ball Don't Lie hasn’t published the box score yet.";
    targets.totals.appendChild(state);
    if (targets.pace) {
      targets.pace.textContent = '';
    }
    return;
  }
  TEAM_TOTALS_DEFINITIONS.forEach((definition) => {
    const wrapper = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = definition.label;
    const dd = document.createElement('dd');
    dd.textContent = definition.format(totals);
    wrapper.append(dt, dd);
    targets.totals.appendChild(wrapper);
  });
  if (targets.pace) {
    const possessions = computePossessions(totals);
    if (possessions && Number.isFinite(possessions) && possessions > 0) {
      const offRating = (totals.pts / possessions) * 100;
      targets.pace.textContent = `Est. possessions ${helpers.formatNumber(possessions, 1)} • Off. rating ${helpers.formatNumber(
        offRating,
        1,
      )}`;
    } else {
      targets.pace.textContent = '';
    }
  }
}

const LEADER_CATEGORIES = [
  { key: 'pts', label: 'Points' },
  { key: 'reb', label: 'Rebounds' },
  { key: 'ast', label: 'Assists' },
];

function sortPlayersByStat(players, key) {
  return [...players].sort((a, b) => {
    const delta = (b?.[key] ?? 0) - (a?.[key] ?? 0);
    if (delta !== 0) {
      return delta;
    }
    const minutesDelta = parseMinutesToSeconds(b?.min) - parseMinutesToSeconds(a?.min);
    if (minutesDelta !== 0) {
      return minutesDelta;
    }
    return (a?.name || '').localeCompare(b?.name || '');
  });
}

function renderTeamLeaders(role, totals) {
  const targets = teamTargets[role];
  if (!targets || !targets.leadersBody) {
    return;
  }
  targets.leadersBody.innerHTML = '';
  if (!totals || !Array.isArray(totals.players) || !totals.players.length) {
    if (targets.leadersState) {
      targets.leadersState.hidden = false;
      targets.leadersState.textContent = "Ball Don't Lie hasn’t posted the player line yet.";
      targets.leadersBody.appendChild(targets.leadersState);
    }
    return;
  }
  if (targets.leadersState) {
    targets.leadersState.hidden = true;
  }
  LEADER_CATEGORIES.forEach((category) => {
    const categoryContainer = document.createElement('div');
    categoryContainer.className = 'tracker-leaders__category';
    const heading = document.createElement('h3');
    heading.textContent = category.label;
    categoryContainer.appendChild(heading);

    const list = document.createElement('ol');
    list.className = 'tracker-leaders__list';
    const ranked = sortPlayersByStat(totals.players, category.key).slice(0, 3);
    ranked.forEach((player) => {
      const li = document.createElement('li');
      li.textContent = player.name;
      const statSpan = document.createElement('span');
      statSpan.textContent = `${helpers.formatNumber(player[category.key] ?? 0, 0)} ${category.label.toLowerCase()}`;
      li.appendChild(statSpan);
      list.appendChild(li);
    });

    if (!ranked.length) {
      const li = document.createElement('li');
      li.textContent = 'No stats logged yet.';
      list.appendChild(li);
    }

    categoryContainer.appendChild(list);
    targets.leadersBody.appendChild(categoryContainer);
  });
}

function scheduleNextRefresh(stage) {
  if (refreshTimer) {
    window.clearTimeout(refreshTimer);
  }
  if (stage === 'final') {
    refreshTimer = null;
    return;
  }
  refreshTimer = window.setTimeout(() => {
    refreshData({ background: true }).catch((error) => {
      console.error('Background refresh failed', error);
    });
  }, REFRESH_INTERVAL_MS);
}

async function loadGame(gameId) {
  const payload = await bdl(`/v1/games/${gameId}`);
  return payload?.data ?? null;
}

async function loadGameStats(gameId) {
  const params = new URLSearchParams({
    'game_ids[]': String(gameId),
    per_page: '100',
  });
  const payload = await bdl(`/v1/stats?${params.toString()}`);
  return Array.isArray(payload?.data) ? payload.data : [];
}

function updatePreviewLink(gameId) {
  if (!previewLink) {
    return;
  }
  const base = document.baseURI || window.location.href;
  const targetUrl = new URL('game-preview.html', base);
  targetUrl.searchParams.set('gameId', String(gameId));
  previewLink.href = targetUrl.toString();
}

function togglePreviewCta(stage) {
  if (!previewCta) {
    return;
  }
  if (stage === 'upcoming') {
    previewCta.hidden = false;
  } else {
    previewCta.hidden = true;
  }
}

function updateUpdatedTimestamp() {
  if (!updatedLabel) {
    return;
  }
  updatedLabel.textContent = formatDateTime(new Date());
}

async function refreshData({ background = false } = {}) {
  if (loading) {
    return;
  }
  loading = true;
  setManualRefreshDisabled(true);
  if (!background) {
    setTrackerMessage('Syncing Ball Don\'t Lie data…');
  }
  try {
    const gameId = parseGameId(rawGameId);
    if (!gameId) {
      setTrackerMessage('Add a valid gameId query parameter to load the live tracker.', 'error');
      return;
    }

    const gameRaw = await loadGame(gameId);
    const game = normalizeGame(gameRaw);
    if (!game) {
      setTrackerMessage('Unable to locate that matchup in the Ball Don\'t Lie dataset.', 'error');
      return;
    }

    updatePreviewLink(gameId);
    renderHero(game);
    renderScoreboard(game);
    updateDocumentTitle(game);

    let statsRows = [];
    if (game.stage !== 'upcoming') {
      try {
        statsRows = await loadGameStats(gameId);
      } catch (statsError) {
        console.warn('Unable to load box score rows', statsError);
      }
    }

    const aggregated = aggregateTeamStats(statsRows);
    ['visitor', 'home'].forEach((role) => {
      const team = game[role];
      const totals = aggregated.get(team.id);
      renderTeamTotals(role, totals);
      renderTeamLeaders(role, totals);
    });

    togglePreviewCta(game.stage);

    if (game.stage === 'upcoming') {
      setTrackerMessage('This matchup has not tipped off yet. We will refresh automatically.');
    } else if (game.stage === 'live') {
      setTrackerMessage('Tracking live stats on a five minute delay from Ball Don\'t Lie.');
    } else {
      setTrackerMessage('Final totals captured from the Ball Don\'t Lie box score.');
    }

    updateUpdatedTimestamp();
    scheduleNextRefresh(game.stage);
  } catch (error) {
    console.error('Failed to refresh game tracker', error);
    setTrackerMessage('Unable to sync the live tracker right now. Please retry shortly.', 'error');
    scheduleNextRefresh('live');
  } finally {
    loading = false;
    setManualRefreshDisabled(false);
  }
}

function initialize() {
  const gameId = parseGameId(rawGameId);
  if (!gameId) {
    setTrackerMessage('Add a valid gameId query parameter to load the live tracker.', 'error');
    setManualRefreshDisabled(true);
    return;
  }
  if (manualRefreshButton) {
    manualRefreshButton.addEventListener('click', () => {
      refreshData().catch((error) => {
        console.error('Manual refresh failed', error);
      });
    });
  }
  refreshData().catch((error) => {
    console.error('Initial refresh failed', error);
  });
}

initialize();
