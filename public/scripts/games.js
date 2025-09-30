import { registerCharts, destroyCharts, helpers } from './hub-charts.js';

const API_BASE = 'https://api.balldontlie.io/v1';
const PAGE_SIZE = 100;
const REFRESH_INTERVAL_MS = 150000;
const NEXT_SEASON_TIPOFF_DATE = '2025-10-04';
const LAST_COMPLETED_SEASON_FINALE = '2024-06-22';
const EARLIEST_ARCHIVE_DATE = '2012-10-30';

const stageRank = { live: 0, upcoming: 1, final: 2 };
const ERROR_CODES = { missingApiKey: 'missing-api-key' };

const scoreboardContainer = document.querySelector('[data-scoreboard]');
const dateInput = document.querySelector('[data-game-date]');
const refreshButton = document.querySelector('[data-manual-refresh]');

const metricTargets = {
  gamesTotal: document.querySelector('[data-metric="games-total"]'),
  liveCount: document.querySelector('[data-metric="live-count"]'),
  finalCount: document.querySelector('[data-metric="final-count"]'),
  avgMargin: document.querySelector('[data-metric="avg-margin"]'),
  avgDetail: document.querySelector('[data-metric="avg-detail"]'),
  topTotal: document.querySelector('[data-metric="top-total"]'),
  topDetail: document.querySelector('[data-metric="top-detail"]'),
  scoreboardSummary: document.querySelector('[data-metric="scoreboard-summary"]'),
  marginAnnotation: document.querySelector('[data-metric="margin-annotation"]'),
  dateLabel: document.querySelector('[data-selected-date]'),
  refreshLabel: document.querySelector('[data-refresh]'),
  fetchState: document.querySelector('[data-fetch-state]'),
};

function determineMaxSelectableDate() {
  const today = getTodayIso();
  if (today >= NEXT_SEASON_TIPOFF_DATE) {
    return today;
  }
  return LAST_COMPLETED_SEASON_FINALE;
}

function determineInitialDate() {
  const today = getTodayIso();
  if (today >= NEXT_SEASON_TIPOFF_DATE) {
    return today;
  }
  return determineMaxSelectableDate();
}

let activeDate = determineInitialDate();
let latestGames = [];
let lastUpdated = null;
let refreshTimer = null;
let loading = false;

function getTodayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isValidIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDateLabel(value) {
  if (!isValidIsoDate(value)) {
    return value ?? '—';
  }
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatTimeLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function getApiKey() {
  const meta = document.querySelector('meta[name="bdl-api-key"]');
  const metaKey = meta?.getAttribute('content')?.trim();
  if (metaKey) {
    return metaKey;
  }
  if (typeof window !== 'undefined' && window.BDL_API_KEY) {
    return String(window.BDL_API_KEY);
  }
  return null;
}

function createMissingApiKeyError() {
  const error = new Error("Ball Don't Lie API key not configured");
  error.code = ERROR_CODES.missingApiKey;
  return error;
}

function buildSearchParams(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (Array.isArray(value)) {
      const paramKey = key.endsWith('[]') ? key : `${key}[]`;
      value.forEach((entry) => {
        if (entry === undefined || entry === null) {
          return;
        }
        search.append(paramKey, String(entry));
      });
    } else {
      search.set(key, String(value));
    }
  });
  return search;
}

async function request(endpoint, params = {}) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  const search = buildSearchParams(params);
  if ([...search.keys()].length) {
    url.search = search.toString();
  }
  const headers = { Accept: 'application/json' };
  const apiKey = getApiKey();
  if (!apiKey) {
    throw createMissingApiKeyError();
  }
  headers.Authorization = apiKey;
  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

async function fetchGamesForDate(date) {
  const games = [];
  let cursor;
  do {
    const payload = await request('games', {
      dates: [date],
      per_page: PAGE_SIZE,
      cursor,
    });
    const data = Array.isArray(payload?.data) ? payload.data : [];
    data.forEach((raw) => {
      games.push(normalizeGame(raw));
    });
    cursor = payload?.meta?.next_cursor ?? null;
  } while (cursor);
  return games;
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

function computeStage(status, period) {
  const normalized = (status ?? '').toString().toLowerCase();
  if (normalized.includes('final')) {
    return 'final';
  }
  if (period === 0) {
    return 'upcoming';
  }
  return 'live';
}

function normalizeTeam(team, score) {
  const abbreviation = team?.abbreviation ?? team?.name?.slice(0, 3) ?? '';
  return {
    id: team?.id ?? null,
    name: team?.full_name ?? team?.name ?? 'Team',
    abbreviation: abbreviation ? abbreviation.toUpperCase() : '',
    score: Number.isFinite(Number(score)) ? Number(score) : 0,
  };
}

function normalizeGame(raw) {
  const status = typeof raw?.status === 'string' ? raw.status.trim() : '';
  const period = Number.isFinite(Number(raw?.period)) ? Number(raw.period) : 0;
  const time = typeof raw?.time === 'string' ? raw.time.trim() : '';
  const tipoff = parseDateTime(raw?.datetime) ?? parseDateOnly(raw?.date);
  const home = normalizeTeam(raw?.home_team, raw?.home_team_score);
  const visitor = normalizeTeam(raw?.visitor_team, raw?.visitor_team_score);
  const margin = home.score - visitor.score;
  const totalPoints = home.score + visitor.score;

  return {
    id: raw?.id,
    isoDate: typeof raw?.date === 'string' ? raw.date : activeDate,
    status,
    period,
    time,
    stage: computeStage(status, period),
    postseason: Boolean(raw?.postseason),
    tipoff,
    home,
    visitor,
    margin,
    totalPoints,
  };
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
  if (game.stage === 'upcoming') {
    return game.status || formatTimeLabel(game.tipoff) || 'Scheduled';
  }
  if (game.stage === 'live') {
    const periodLabel = formatPeriodLabel(game) || 'Live';
    const clock = game.time ? game.time.replace(/\s+/g, '') : '';
    return clock ? `${periodLabel} • ${clock}` : periodLabel;
  }
  return 'Final';
}

function formatMarginString(game) {
  if (!Number.isFinite(game?.margin)) {
    return null;
  }
  if (game.margin === 0) {
    return 'Level game';
  }
  const leader = game.margin > 0 ? game.home : game.visitor;
  const prefix = game.margin > 0 ? '+' : '−';
  return `${leader.abbreviation || leader.name}: ${prefix}${helpers.formatNumber(Math.abs(game.margin), 0)} pts`;
}

function formatTotalString(game) {
  if (!Number.isFinite(game?.totalPoints) || game.totalPoints <= 0) {
    return null;
  }
  return `${helpers.formatNumber(game.totalPoints, 0)} pts total`;
}

function formatGameMeta(game) {
  if (game.stage === 'upcoming') {
    const tip = formatTimeLabel(game.tipoff);
    return tip ? `Local tip ${tip}` : '';
  }
  const total = formatTotalString(game);
  if (game.postseason) {
    return total ? `${total} • Postseason` : 'Postseason';
  }
  return total ?? '';
}

function formatPeriodDetail(game) {
  if (game.stage === 'final') {
    if (game.period > 4) {
      const overtime = game.period - 4;
      return overtime === 1 ? 'Finished in OT' : `Finished in ${overtime}OT`;
    }
    return 'Finished in regulation';
  }
  const periodLabel = formatPeriodLabel(game);
  return periodLabel ? `Period: ${periodLabel}` : null;
}

function formatSignedMargin(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const magnitude = helpers.formatNumber(Math.abs(value), 0);
  if (value > 0) return `+${magnitude}`;
  if (value < 0) return `−${magnitude}`;
  return '0';
}

function clearScoreboard() {
  if (scoreboardContainer) {
    scoreboardContainer.innerHTML = '';
  }
}

function renderScoreboardState(message) {
  if (!scoreboardContainer) {
    return;
  }
  clearScoreboard();
  const state = document.createElement('p');
  state.className = 'scoreboard-state';
  state.textContent = message;
  scoreboardContainer.appendChild(state);
}

function createTeamRow(team, game, role) {
  const row = document.createElement('div');
  row.className = 'scoreboard-card__row';

  const teamWrapper = document.createElement('div');
  teamWrapper.className = 'scoreboard-card__team';

  const tricode = document.createElement('span');
  tricode.className = 'scoreboard-card__tricode';
  tricode.textContent = team.abbreviation || team.name.slice(0, 3).toUpperCase();

  const name = document.createElement('span');
  name.className = 'scoreboard-card__name';
  name.textContent = team.name;

  teamWrapper.append(tricode, name);

  const score = document.createElement('span');
  score.className = 'scoreboard-card__score';
  const scoreValue = Number.isFinite(team.score) ? team.score : 0;
  score.textContent = helpers.formatNumber(scoreValue, 0);
  if (formatSignedMargin(game.margin) !== null) {
    const isLeader = (game.margin > 0 && role === 'home') || (game.margin < 0 && role === 'visitor');
    if (isLeader && game.margin !== 0) {
      score.classList.add('scoreboard-card__score--lead');
    }
  }

  row.append(teamWrapper, score);
  return row;
}

function createScoreboardCard(game) {
  const card = document.createElement('article');
  card.className = `scoreboard-card scoreboard-card--${game.stage}`;
  card.setAttribute('data-game-id', String(game.id ?? ''));

  const header = document.createElement('header');
  header.className = 'scoreboard-card__header';

  const statusSpan = document.createElement('span');
  statusSpan.className = 'scoreboard-card__status';
  statusSpan.textContent = formatGameStatus(game);
  header.appendChild(statusSpan);

  const metaText = formatGameMeta(game);
  if (metaText) {
    const metaSpan = document.createElement('span');
    metaSpan.className = 'scoreboard-card__meta';
    metaSpan.textContent = metaText;
    header.appendChild(metaSpan);
  }

  const rows = document.createElement('div');
  rows.className = 'scoreboard-card__rows';
  rows.appendChild(createTeamRow(game.visitor, game, 'visitor'));
  rows.appendChild(createTeamRow(game.home, game, 'home'));

  const footer = document.createElement('div');
  footer.className = 'scoreboard-card__footer';
  const margin = game.stage === 'upcoming' ? null : formatMarginString(game);
  if (margin) {
    const marginSpan = document.createElement('span');
    marginSpan.textContent = margin;
    footer.appendChild(marginSpan);
  }
  const periodDetail = formatPeriodDetail(game);
  if (periodDetail) {
    const periodSpan = document.createElement('span');
    periodSpan.textContent = periodDetail;
    footer.appendChild(periodSpan);
  }
  const total = formatTotalString(game);
  if (total) {
    const totalSpan = document.createElement('span');
    totalSpan.textContent = total;
    footer.appendChild(totalSpan);
  }
  if (game.postseason) {
    const postseasonSpan = document.createElement('span');
    postseasonSpan.textContent = 'Postseason matchup';
    footer.appendChild(postseasonSpan);
  }

  card.append(header, rows);
  if (footer.childNodes.length) {
    card.appendChild(footer);
  }
  return card;
}

function renderScoreboard(games) {
  if (!scoreboardContainer) {
    return;
  }
  clearScoreboard();
  if (!games.length) {
    renderScoreboardState(`No games found for ${formatDateLabel(activeDate)}.`);
    return;
  }
  const sorted = [...games].sort((a, b) => {
    const stageDelta = (stageRank[a.stage] ?? 3) - (stageRank[b.stage] ?? 3);
    if (stageDelta !== 0) {
      return stageDelta;
    }
    const timeA = a.tipoff instanceof Date ? a.tipoff.getTime() : 0;
    const timeB = b.tipoff instanceof Date ? b.tipoff.getTime() : 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return (a.id ?? 0) - (b.id ?? 0);
  });
  sorted.forEach((game) => {
    scoreboardContainer.appendChild(createScoreboardCard(game));
  });
}

function setMetric(key, value, fallback = '—') {
  const target = metricTargets[key];
  if (!target) {
    return;
  }
  const output = value === null || value === undefined || value === '' ? fallback : value;
  target.textContent = output;
}

function updateMetrics(games) {
  const totalGames = games.length;
  setMetric('gamesTotal', totalGames ? helpers.formatNumber(totalGames, 0) : '0');
  setMetric('dateLabel', formatDateLabel(activeDate));

  const liveCount = games.filter((game) => game.stage === 'live').length;
  setMetric('liveCount', helpers.formatNumber(liveCount, 0));

  const finals = games.filter((game) => game.stage === 'final');
  setMetric('finalCount', helpers.formatNumber(finals.length, 0));

  if (finals.length) {
    const avgMargin =
      finals.reduce((total, game) => total + Math.abs(Number.isFinite(game.margin) ? game.margin : 0), 0) / finals.length;
    setMetric('avgMargin', `${helpers.formatNumber(avgMargin, 1)} pts`);
    setMetric('avgDetail', finals.length === 1 ? 'Across 1 final' : `Across ${finals.length} finals`);
  } else {
    setMetric('avgMargin', '—');
    setMetric('avgDetail', games.length ? 'Awaiting finals' : 'Awaiting results');
  }

  const scoringTeams = [];
  games.forEach((game) => {
    if (game.home.score > 0) {
      scoringTeams.push({
        label: game.home.abbreviation || game.home.name,
        points: game.home.score,
        opponent: game.visitor,
        opponentPoints: game.visitor.score,
        location: 'home',
      });
    }
    if (game.visitor.score > 0) {
      scoringTeams.push({
        label: game.visitor.abbreviation || game.visitor.name,
        points: game.visitor.score,
        opponent: game.home,
        opponentPoints: game.home.score,
        location: 'away',
      });
    }
  });
  const topTeam = scoringTeams.sort((a, b) => b.points - a.points)[0];
  if (topTeam) {
    setMetric('topTotal', `${helpers.formatNumber(topTeam.points, 0)} pts`);
    const opponentLabel = topTeam.opponent.abbreviation || topTeam.opponent.name;
    const opponentPoints = helpers.formatNumber(topTeam.opponentPoints ?? 0, 0);
    const matchupPrefix = topTeam.location === 'away' ? '@' : 'vs';
    setMetric('topDetail', `${matchupPrefix} ${opponentLabel} · ${helpers.formatNumber(topTeam.points, 0)}-${opponentPoints}`);
  } else {
    setMetric('topTotal', '—');
    setMetric('topDetail', games.length ? 'Scores building' : 'No scores yet');
  }

  if (totalGames) {
    const summaryParts = [];
    summaryParts.push(`${helpers.formatNumber(liveCount, 0)} live`);
    summaryParts.push(`${helpers.formatNumber(finals.length, 0)} final${finals.length === 1 ? '' : 's'}`);
    setMetric('scoreboardSummary', summaryParts.join(' · '));
  } else {
    setMetric('scoreboardSummary', 'No games');
  }

  if (finals.length) {
    const closest = finals.reduce((min, game) => {
      const distance = Math.abs(Number.isFinite(game.margin) ? game.margin : Number.POSITIVE_INFINITY);
      return Math.min(min, distance);
    }, Number.POSITIVE_INFINITY);
    if (Number.isFinite(closest) && closest !== Number.POSITIVE_INFINITY) {
      setMetric('marginAnnotation', `Closest final: ${helpers.formatNumber(closest, 0)} pts`);
    } else {
      setMetric('marginAnnotation', 'Final margins logged');
    }
  } else if (liveCount) {
    setMetric('marginAnnotation', 'Live margins updating');
  } else {
    setMetric('marginAnnotation', 'No finals yet');
  }
}

function setRefreshTimestamp(date) {
  if (!metricTargets.refreshLabel) {
    return;
  }
  const label = date instanceof Date && !Number.isNaN(date.getTime()) ? formatTimeLabel(date) : null;
  metricTargets.refreshLabel.textContent = label ?? '—';
}

function setFetchMessage(message = '', type = 'idle') {
  const target = metricTargets.fetchState;
  if (!target) {
    return;
  }
  target.textContent = message;
  target.classList.remove('is-error', 'is-success');
  if (type === 'error') {
    target.classList.add('is-error');
  } else if (type === 'success') {
    target.classList.add('is-success');
  }
}

function fallbackChart(message) {
  return {
    type: 'doughnut',
    data: {
      labels: [''],
      datasets: [
        {
          data: [1],
          backgroundColor: ['rgba(17, 86, 214, 0.12)'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        title: { display: true, text: message },
      },
    },
  };
}

function buildStatusChart(games) {
  const counts = { upcoming: 0, live: 0, final: 0 };
  games.forEach((game) => {
    if (counts[game.stage] !== undefined) {
      counts[game.stage] += 1;
    }
  });
  const total = counts.upcoming + counts.live + counts.final;
  if (!total) {
    return fallbackChart('No games scheduled');
  }
  return {
    type: 'doughnut',
    data: {
      labels: ['Upcoming', 'Live', 'Final'],
      datasets: [
        {
          data: [counts.upcoming, counts.live, counts.final],
          backgroundColor: ['rgba(17, 86, 214, 0.78)', 'rgba(239, 61, 91, 0.82)', 'rgba(11, 37, 69, 0.85)'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
      },
    },
  };
}

function buildTipoffChart(games) {
  const buckets = new Map();
  games.forEach((game) => {
    if (!(game.tipoff instanceof Date) || Number.isNaN(game.tipoff.getTime())) {
      return;
    }
    const hour = game.tipoff.getHours();
    const label = game.tipoff.toLocaleTimeString(undefined, { hour: 'numeric' });
    const key = `${hour}-${label}`;
    const entry = buckets.get(key) ?? { hour, label, count: 0 };
    entry.count += 1;
    buckets.set(key, entry);
  });
  const slots = Array.from(buckets.values()).sort((a, b) => a.hour - b.hour);
  if (!slots.length) {
    return fallbackChart('Tipoff data pending');
  }
  return {
    type: 'line',
    data: {
      labels: slots.map((slot) => slot.label),
      datasets: [
        {
          label: 'Games',
          data: slots.map((slot) => slot.count),
          borderColor: '#1156d6',
          backgroundColor: 'rgba(17, 86, 214, 0.22)',
          tension: 0.35,
          fill: true,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#1156d6',
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: { display: true, text: 'Games' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  };
}

function buildMarginChart(games) {
  const relevant = games.filter((game) => game.stage !== 'upcoming');
  const buckets = [
    { label: '0-5', min: 0, max: 5 },
    { label: '6-10', min: 5, max: 10 },
    { label: '11-15', min: 10, max: 15 },
    { label: '16-20', min: 15, max: 20 },
    { label: '21+', min: 20, max: Number.POSITIVE_INFINITY },
  ];
  const counts = buckets.map(() => 0);
  relevant.forEach((game) => {
    const margin = Math.abs(Number.isFinite(game.margin) ? game.margin : 0);
    const index = buckets.findIndex((bucket, bucketIndex) => {
      if (bucketIndex === buckets.length - 1) {
        return margin >= bucket.min;
      }
      return margin >= bucket.min && margin < bucket.max;
    });
    if (index >= 0) {
      counts[index] += 1;
    }
  });
  if (!counts.some((count) => count > 0)) {
    return fallbackChart('Margins not available yet');
  }
  return {
    type: 'bar',
    data: {
      labels: buckets.map((bucket) => bucket.label),
      datasets: [
        {
          label: 'Games',
          data: counts,
          backgroundColor: 'rgba(17, 86, 214, 0.78)',
          borderRadius: 12,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: { display: true, text: 'Game count' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  };
}

function buildScoringChart(games) {
  const teams = [];
  games.forEach((game) => {
    if (game.home.score > 0) {
      teams.push({
        label: game.home.abbreviation || game.home.name,
        name: game.home.name,
        points: game.home.score,
        opponent: game.visitor,
      });
    }
    if (game.visitor.score > 0) {
      teams.push({
        label: game.visitor.abbreviation || game.visitor.name,
        name: game.visitor.name,
        points: game.visitor.score,
        opponent: game.home,
      });
    }
  });
  const top = teams.sort((a, b) => b.points - a.points).slice(0, 6);
  if (!top.length) {
    return fallbackChart('Scoring data building');
  }
  const colors = ['#1156d6', '#ef3d5b', '#1f7bff', '#f4b53f', '#6c4fe0', '#11b5c6'];
  return {
    type: 'bar',
    data: {
      labels: top.map((team) => team.label),
      datasets: [
        {
          label: 'Points',
          data: top.map((team) => team.points),
          backgroundColor: top.map((_, index) => colors[index % colors.length]),
        },
      ],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const team = top[context.dataIndex];
              const opponent = team.opponent.abbreviation || team.opponent.name;
              return `${context.formattedValue} vs ${opponent}`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: 'Points' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        y: {
          grid: { display: false },
        },
      },
    },
  };
}

function buildBalanceChart(games) {
  const relevant = games.filter((game) => game.home.score > 0 || game.visitor.score > 0);
  if (!relevant.length) {
    return fallbackChart('Score data pending');
  }
  const stageColors = {
    live: 'rgba(239, 61, 91, 0.85)',
    final: 'rgba(17, 86, 214, 0.85)',
    upcoming: 'rgba(154, 165, 196, 0.7)',
  };
  const points = relevant.map((game) => ({
    x: Math.max(game.visitor.score, 0),
    y: Math.max(game.home.score, 0),
    label: `${game.visitor.abbreviation || game.visitor.name} @ ${game.home.abbreviation || game.home.name}`,
    stage: game.stage,
    margin: game.margin,
    total: game.totalPoints,
  }));
  const colors = points.map((point) => stageColors[point.stage] ?? 'rgba(17, 86, 214, 0.6)');
  return {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Score pairs',
          data: points,
          parsing: false,
          pointBackgroundColor: colors,
          pointBorderColor: colors,
          pointRadius: 6,
          pointHoverRadius: 7,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const raw = context.raw || {};
              const details = [];
              if (raw.label) {
                details.push(raw.label);
              }
              if (raw.stage) {
                details.push(raw.stage.charAt(0).toUpperCase() + raw.stage.slice(1));
              }
              const margin = formatSignedMargin(raw.margin);
              if (margin) {
                details.push(`Margin ${margin}`);
              }
              if (Number.isFinite(raw.total) && raw.total > 0) {
                details.push(`Total ${helpers.formatNumber(raw.total, 0)}`);
              }
              return details;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: 'Visitor points' },
          grid: { color: 'rgba(17, 86, 214, 0.08)' },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Home points' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
      },
    },
  };
}

function rebuildCharts() {
  destroyCharts();
  registerCharts([
    {
      element: '#status-breakdown',
      async createConfig() {
        return buildStatusChart(latestGames);
      },
    },
    {
      element: '#tipoff-curve',
      async createConfig() {
        return buildTipoffChart(latestGames);
      },
    },
    {
      element: '#margin-spread',
      async createConfig() {
        return buildMarginChart(latestGames);
      },
    },
    {
      element: '#scoring-leaders',
      async createConfig() {
        return buildScoringChart(latestGames);
      },
    },
    {
      element: '#score-balance',
      async createConfig() {
        return buildBalanceChart(latestGames);
      },
    },
  ]);
}

function scheduleAutoRefresh() {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (activeDate === getTodayIso()) {
    refreshTimer = window.setInterval(() => {
      loadGames({ silent: true });
    }, REFRESH_INTERVAL_MS);
  }
}

async function loadGames(options = {}) {
  if (loading) {
    return;
  }
  loading = true;
  const { silent = false } = options;
  const previousGames = latestGames;
  if (refreshButton) {
    refreshButton.disabled = true;
  }
  if (!silent && (!previousGames || !previousGames.length)) {
    renderScoreboardState('Loading games…');
  }
  setFetchMessage('Refreshing…');
  try {
    const games = await fetchGamesForDate(activeDate);
    latestGames = games;
    lastUpdated = new Date();
    updateMetrics(games);
    renderScoreboard(games);
    setRefreshTimestamp(lastUpdated);
    setFetchMessage(`Updated ${formatTimeLabel(lastUpdated)}`, 'success');
    rebuildCharts();
  } catch (error) {
    console.error('Unable to load live games data', error);
    const isMissingApiKey = error?.code === ERROR_CODES.missingApiKey;
    const isUnauthorized = error?.message?.includes('401');
    let message = 'Refresh failed';
    if (isMissingApiKey) {
      message = 'API key required';
    } else if (isUnauthorized) {
      message = 'Authorization failed';
    }
    setFetchMessage(message, 'error');
    if (previousGames && previousGames.length) {
      latestGames = previousGames;
      updateMetrics(previousGames);
      renderScoreboard(previousGames);
    } else {
      const fallbackMessage = isMissingApiKey
        ? "Provide a Ball Don't Lie API key to load live games."
        : 'Unable to load games right now.';
      renderScoreboardState(fallbackMessage);
      updateMetrics([]);
    }
  } finally {
    loading = false;
    if (refreshButton) {
      refreshButton.disabled = false;
    }
  }
}

function initControls() {
  if (dateInput) {
    const maxSelectableDate = determineMaxSelectableDate();
    const minSelectableDate = EARLIEST_ARCHIVE_DATE;
    if (minSelectableDate) {
      dateInput.setAttribute('min', minSelectableDate);
      if (activeDate < minSelectableDate) {
        activeDate = minSelectableDate;
      }
    }
    if (maxSelectableDate) {
      dateInput.setAttribute('max', maxSelectableDate);
      if (activeDate > maxSelectableDate) {
        activeDate = maxSelectableDate;
      }
    }
    dateInput.value = activeDate;
    dateInput.addEventListener('change', (event) => {
      const nextValue = event.target.value;
      if (isValidIsoDate(nextValue)) {
        let nextDate = nextValue;
        if (minSelectableDate && nextDate < minSelectableDate) {
          nextDate = minSelectableDate;
        }
        if (maxSelectableDate && nextDate > maxSelectableDate) {
          nextDate = maxSelectableDate;
        }
        activeDate = nextDate;
        if (dateInput.value !== activeDate) {
          dateInput.value = activeDate;
        }
        setMetric('dateLabel', formatDateLabel(activeDate));
        scheduleAutoRefresh();
        loadGames();
      }
    });
  }
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      loadGames();
    });
  }
}

function init() {
  initControls();
  setMetric('dateLabel', formatDateLabel(activeDate));
  updateMetrics([]);
  renderScoreboardState('Loading games…');
  loadGames();
  scheduleAutoRefresh();
}

init();
