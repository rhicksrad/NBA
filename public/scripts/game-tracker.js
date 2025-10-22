import { bdl } from '../assets/js/bdl.js';
import { registerCharts, destroyCharts, helpers } from './hub-charts.js';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const TREND_GAME_COUNT = 8;

const palette = {
  royal: '#1156d6',
  sky: '#1f7bff',
  gold: '#f4b53f',
  coral: '#ef3d5b',
  teal: '#11b5c6',
  violet: '#6c4fe0',
  lime: '#8fd43d',
  navy: '#0b2545',
};

const roleColors = {
  visitor: {
    fill: 'rgba(17, 86, 214, 0.18)',
    line: palette.sky,
    solid: palette.sky,
  },
  home: {
    fill: 'rgba(244, 181, 63, 0.22)',
    line: palette.gold,
    solid: palette.gold,
  },
};

let latestVisualization = null;
let trendCacheKey = null;
let cachedTrend = null;

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

function toIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function formatShortDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch (error) {
    return date.toISOString().slice(5, 10);
  }
}

function extractPeriodPoints(raw, prefix, fallback) {
  const quarters = [1, 2, 3, 4];
  const overtime = [1, 2, 3];
  const labels = [];
  const values = [];

  quarters.forEach((index) => {
    const key = `${prefix}_q${index}`;
    const label = `${index}Q`;
    const value = Number(raw?.[key]);
    if (Number.isFinite(value)) {
      labels.push(label);
      values.push(value);
    } else {
      labels.push(label);
      values.push(null);
    }
  });

  overtime.forEach((index) => {
    const key = `${prefix}_ot${index}`;
    if (raw?.[key] == null) {
      return;
    }
    const value = Number(raw[key]);
    labels.push(`OT${index}`);
    values.push(Number.isFinite(value) ? value : null);
  });

  const meaningful = values.some((value) => Number.isFinite(value) && value > 0);
  if (!meaningful) {
    return {
      labels: ['Game total'],
      values: [Number.isFinite(fallback) ? Number(fallback) : 0],
    };
  }

  return { labels, values };
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
  const dateIso = typeof raw?.date === 'string' ? raw.date : toIsoDate(tipoff);
  const stage = computeStage(status, period);
  const homeBreakdown = extractPeriodPoints(raw, 'home', raw?.home_team_score);
  const visitorBreakdown = extractPeriodPoints(raw, 'visitor', raw?.visitor_team_score);
  const combinedLabels = new Set([...homeBreakdown.labels, ...visitorBreakdown.labels]);
  const canonicalOrder = ['1Q', '2Q', '3Q', '4Q', 'OT1', 'OT2', 'OT3'];
  let labels = canonicalOrder.filter((label) => combinedLabels.has(label));
  if (!labels.length) {
    labels = homeBreakdown.labels.length ? homeBreakdown.labels : visitorBreakdown.labels;
  }
  const homePeriodPoints = labels.map((label) => {
    const index = homeBreakdown.labels.indexOf(label);
    const value = index >= 0 ? homeBreakdown.values[index] : null;
    return Number.isFinite(value) ? value : 0;
  });
  const visitorPeriodPoints = labels.map((label) => {
    const index = visitorBreakdown.labels.indexOf(label);
    const value = index >= 0 ? visitorBreakdown.values[index] : null;
    return Number.isFinite(value) ? value : 0;
  });
  return {
    id: Number.isFinite(raw.id) ? raw.id : null,
    season: Number.isFinite(raw.season) ? raw.season : null,
    seasonType: typeof raw.season_type === 'string' ? raw.season_type : '',
    status,
    stage,
    period,
    time,
    tipoff,
    dateIso,
    postseason: Boolean(raw.postseason),
    home: normalizeTeam(raw.home_team, raw.home_team_score),
    visitor: normalizeTeam(raw.visitor_team, raw.visitor_team_score),
    scoringBreakdown: {
      labels,
      home: homePeriodPoints,
      visitor: visitorPeriodPoints,
    },
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
    teamId: Number.isFinite(row?.team?.id) ? row.team.id : null,
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

function aggregateStatsByGame(rows) {
  const games = new Map();
  rows.forEach((row) => {
    const gameId = Number(row?.game?.id);
    const teamId = Number(row?.team?.id);
    if (!Number.isFinite(gameId) || !Number.isFinite(teamId)) {
      return;
    }
    if (!games.has(gameId)) {
      games.set(gameId, new Map());
    }
    const teams = games.get(gameId);
    if (!teams.has(teamId)) {
      teams.set(teamId, {
        gameId,
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
      });
    }
    const bucket = teams.get(teamId);
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
  });
  return games;
}

async function fetchStatsForGames(gameIds) {
  if (!gameIds || !gameIds.size) {
    return new Map();
  }
  const baseParams = new URLSearchParams();
  baseParams.set('per_page', '500');
  Array.from(gameIds)
    .filter((id) => Number.isFinite(id))
    .forEach((id) => {
      baseParams.append('game_ids[]', String(id));
    });
  const allRows = [];
  let cursor = null;
  do {
    const params = new URLSearchParams(baseParams);
    if (cursor) {
      params.set('cursor', cursor);
    }
    const payload = await bdl(`/v1/stats?${params.toString()}`);
    if (Array.isArray(payload?.data)) {
      allRows.push(...payload.data);
    }
    cursor = payload?.meta?.next_cursor ?? null;
  } while (cursor);
  return aggregateStatsByGame(allRows);
}

async function loadTeamRecentGames(teamId, { season, postseason, beforeDateIso }) {
  const params = new URLSearchParams({
    'team_ids[]': String(teamId),
    per_page: '60',
  });
  if (Number.isFinite(season)) {
    params.append('seasons[]', String(season));
  }
  if (typeof postseason === 'boolean') {
    params.append('postseason', postseason ? 'true' : 'false');
  }
  const payload = await bdl(`/v1/games?${params.toString()}`);
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const filtered = rows
    .filter((row) => typeof row?.status === 'string' && row.status.toLowerCase().includes('final'))
    .filter((row) => {
      if (!beforeDateIso || typeof row?.date !== 'string') {
        return true;
      }
      return row.date <= beforeDateIso;
    });
  filtered.sort((a, b) => {
    const dateA = parseDateOnly(a?.date) || parseDateTime(a?.datetime) || new Date(0);
    const dateB = parseDateOnly(b?.date) || parseDateTime(b?.datetime) || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });
  const limited = filtered.slice(0, TREND_GAME_COUNT);
  limited.sort((a, b) => {
    const dateA = parseDateOnly(a?.date) || parseDateTime(a?.datetime) || new Date(0);
    const dateB = parseDateOnly(b?.date) || parseDateTime(b?.datetime) || new Date(0);
    return dateA.getTime() - dateB.getTime();
  });
  return limited;
}

async function loadTrendData(game, aggregated) {
  if (!game?.visitor?.id || !game?.home?.id) {
    return { visitor: [], home: [] };
  }

  const stage = game.stage;
  const singleGameMode = stage === 'live' || stage === 'final';

  if (singleGameMode) {
    trendCacheKey = null;
    cachedTrend = null;

    const totalsMap = aggregated instanceof Map ? aggregated : null;
    const gameId = Number.isFinite(game?.id) ? Number(game.id) : null;
    const tipoffDate =
      game.tipoff instanceof Date && !Number.isNaN(game.tipoff.getTime())
        ? game.tipoff
        : parseDateOnly(game.dateIso);
    const hasTipoffDate = tipoffDate instanceof Date && !Number.isNaN(tipoffDate.getTime());

    const buildSingleGameEntry = (role) => {
      const team = game[role];
      if (!team?.id) {
        return null;
      }
      const opponentRole = role === 'home' ? 'visitor' : 'home';
      const opponent = game[opponentRole] || {};
      const totals = totalsMap ? totalsMap.get(team.id) || null : null;
      const opponentTotals = totalsMap && opponent?.id ? totalsMap.get(opponent.id) || null : null;

      const possessionsValue = computePossessions(totals);
      const opponentPossessionsValue = computePossessions(opponentTotals);
      let paceValue = null;
      if (Number.isFinite(possessionsValue) && Number.isFinite(opponentPossessionsValue)) {
        paceValue = (possessionsValue + opponentPossessionsValue) / 2;
      } else if (Number.isFinite(possessionsValue)) {
        paceValue = possessionsValue;
      }

      const totalsPoints = Number.isFinite(totals?.pts) ? totals.pts : null;
      const totalsOpponentPoints = Number.isFinite(opponentTotals?.pts) ? opponentTotals.pts : null;

      const scoreboardPointsRaw = Number(team?.score);
      const scoreboardPoints = Number.isFinite(scoreboardPointsRaw) ? scoreboardPointsRaw : null;
      const scoreboardOpponentPointsRaw = Number(opponent?.score);
      const scoreboardOpponentPoints = Number.isFinite(scoreboardOpponentPointsRaw)
        ? scoreboardOpponentPointsRaw
        : null;

      const displayedPoints = totalsPoints ?? scoreboardPoints;
      const displayedOpponentPoints = totalsOpponentPoints ?? scoreboardOpponentPoints;

      const pointsValue = Number.isFinite(displayedPoints) ? displayedPoints : null;
      const opponentPointsValue = Number.isFinite(displayedOpponentPoints) ? displayedOpponentPoints : null;

      const resultPoints = scoreboardPoints ?? totalsPoints;
      const resultOpponentPoints = scoreboardOpponentPoints ?? totalsOpponentPoints;
      let result = '';
      if (Number.isFinite(resultPoints) && Number.isFinite(resultOpponentPoints)) {
        if (resultPoints > resultOpponentPoints) {
          result = 'W';
        } else if (resultPoints < resultOpponentPoints) {
          result = 'L';
        } else {
          result = 'T';
        }
      }

      const offRatingValue =
        Number.isFinite(totalsPoints) && Number.isFinite(possessionsValue) && possessionsValue > 0
          ? (totalsPoints / possessionsValue) * 100
          : null;

      const label = hasTipoffDate ? formatShortDate(tipoffDate) : 'This game';

      return {
        id: gameId,
        role,
        date: hasTipoffDate ? tipoffDate : null,
        label,
        opponent: opponent?.name || 'Opponent',
        opponentAbbr:
          typeof opponent?.abbreviation === 'string' && opponent.abbreviation
            ? opponent.abbreviation.toUpperCase()
            : '',
        location: role === 'home' ? 'vs' : '@',
        points: pointsValue,
        opponentPoints: opponentPointsValue,
        offRating: Number.isFinite(offRatingValue) ? offRatingValue : null,
        pace: Number.isFinite(paceValue) ? paceValue : null,
        possessions: Number.isFinite(possessionsValue) ? possessionsValue : null,
        result,
      };
    };

    const visitorEntry = buildSingleGameEntry('visitor');
    const homeEntry = buildSingleGameEntry('home');

    return {
      visitor: visitorEntry ? [visitorEntry] : [],
      home: homeEntry ? [homeEntry] : [],
    };
  }

  const season = Number.isFinite(game.season) ? game.season : null;
  const beforeDateIso = game.dateIso || toIsoDate(game.tipoff) || null;
  const cacheKey = [game.visitor.id, game.home.id, season ?? 'na', game.postseason ? 'P' : 'R', beforeDateIso ?? ''];
  const key = cacheKey.join(':');
  if (trendCacheKey === key && cachedTrend) {
    return cachedTrend;
  }

  const [visitorGamesRaw, homeGamesRaw] = await Promise.all([
    loadTeamRecentGames(game.visitor.id, { season, postseason: game.postseason, beforeDateIso }),
    loadTeamRecentGames(game.home.id, { season, postseason: game.postseason, beforeDateIso }),
  ]);

  const uniqueIds = new Set();
  visitorGamesRaw.forEach((row) => {
    if (Number.isFinite(row?.id)) {
      uniqueIds.add(Number(row.id));
    }
  });
  homeGamesRaw.forEach((row) => {
    if (Number.isFinite(row?.id)) {
      uniqueIds.add(Number(row.id));
    }
  });

  if (game.stage === 'final' && Number.isFinite(game.id)) {
    uniqueIds.add(Number(game.id));
  }

  const statsByGame = await fetchStatsForGames(uniqueIds);

  const mapGames = (rawGames, teamId, role) =>
    rawGames.map((row) => {
      const gameId = Number(row?.id);
      const isHome = Number(row?.home_team?.id) === teamId;
      const opponent = isHome ? row?.visitor_team : row?.home_team;
      const opponentId = Number(opponent?.id) || null;
      const scoreboardPoints = isHome ? Number(row?.home_team_score ?? 0) : Number(row?.visitor_team_score ?? 0);
      const opponentPoints = isHome ? Number(row?.visitor_team_score ?? 0) : Number(row?.home_team_score ?? 0);
      const date = parseDateTime(row?.datetime) || parseDateOnly(row?.date);
      const totalsByTeam = statsByGame.get(gameId) || new Map();
      const teamTotals = totalsByTeam.get(teamId) || null;
      const opponentTotals = opponentId ? totalsByTeam.get(opponentId) || null : null;
      const possessions = computePossessions(teamTotals);
      const opponentPossessions = computePossessions(opponentTotals);
      let pace = null;
      if (Number.isFinite(possessions) && Number.isFinite(opponentPossessions)) {
        pace = (possessions + opponentPossessions) / 2;
      } else if (Number.isFinite(possessions)) {
        pace = possessions;
      }
      const offRating = Number.isFinite(possessions) && possessions > 0 ? (teamTotals.pts / possessions) * 100 : null;
      return {
        id: gameId,
        role,
        date,
        label: formatShortDate(date),
        opponent:
          typeof opponent?.full_name === 'string' && opponent.full_name
            ? opponent.full_name
            : typeof opponent?.name === 'string'
            ? opponent.name
            : 'Opponent',
        opponentAbbr:
          typeof opponent?.abbreviation === 'string' && opponent.abbreviation
            ? opponent.abbreviation.toUpperCase()
            : '',
        location: isHome ? 'vs' : '@',
        points: Number.isFinite(teamTotals?.pts) && teamTotals.pts > 0 ? teamTotals.pts : scoreboardPoints,
        opponentPoints,
        offRating: Number.isFinite(offRating) ? offRating : null,
        pace: Number.isFinite(pace) ? pace : null,
        possessions: Number.isFinite(possessions) ? possessions : null,
        result: scoreboardPoints > opponentPoints ? 'W' : scoreboardPoints < opponentPoints ? 'L' : 'T',
      };
    });

  cachedTrend = {
    visitor: mapGames(visitorGamesRaw, game.visitor.id, 'visitor'),
    home: mapGames(homeGamesRaw, game.home.id, 'home'),
  };
  trendCacheKey = key;
  return cachedTrend;
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

async function buildVisualizationData(game, aggregated) {
  if (!game) {
    return null;
  }
  const visitorTotals = aggregated?.get?.(game.visitor.id) || null;
  const homeTotals = aggregated?.get?.(game.home.id) || null;
  const trend = await loadTrendData(game, aggregated);
  const scoringBreakdown = game.scoringBreakdown || { labels: [], visitor: [], home: [] };
  return {
    game,
    trend,
    scoringBreakdown,
    totals: {
      visitor: visitorTotals,
      home: homeTotals,
    },
    players: {
      visitor: Array.isArray(visitorTotals?.players) ? visitorTotals.players : [],
      home: Array.isArray(homeTotals?.players) ? homeTotals.players : [],
    },
    possessions: {
      visitor: computePossessions(visitorTotals),
      home: computePossessions(homeTotals),
    },
    scores: {
      visitor: Number.isFinite(game?.visitor?.score) ? Number(game.visitor.score) : null,
      home: Number.isFinite(game?.home?.score) ? Number(game.home.score) : null,
    },
  };
}

function teamName(visualization, role) {
  const fallback = role === 'visitor' ? 'Visitor' : 'Home';
  return visualization?.game?.[role]?.name || fallback;
}

function teamAbbreviation(visualization, role) {
  const abbr = visualization?.game?.[role]?.abbreviation;
  if (typeof abbr === 'string' && abbr) {
    return abbr.toUpperCase();
  }
  return teamName(visualization, role);
}

function alignTrendSeries(games, length, metricKey) {
  const series = [];
  const offset = Math.max(length - games.length, 0);
  for (let index = 0; index < length; index += 1) {
    if (index < offset) {
      series.push(null);
      continue;
    }
    const game = games[index - offset];
    const rawValue = Number(game?.[metricKey]);
    const value = Number.isFinite(rawValue) ? rawValue : null;
    if (value === null) {
      series.push(null);
    } else {
      const opponentLabel = `${game?.location ?? ''} ${game?.opponentAbbr || game?.opponent || ''}`.trim();
      series.push({
        x: index + 1,
        y: value,
        meta: {
          label: game?.label || `Game ${index + 1}`,
          opponent: opponentLabel,
          result: game?.result || '',
        },
      });
    }
  }
  return series;
}

function buildTrendLineConfig(visualization, metricKey, { decimals = 1, suffix = '' } = {}) {
  const visitorGames = Array.isArray(visualization?.trend?.visitor) ? visualization.trend.visitor : [];
  const homeGames = Array.isArray(visualization?.trend?.home) ? visualization.trend.home : [];
  const maxLength = Math.max(visitorGames.length, homeGames.length);
  const labels = maxLength
    ? Array.from({ length: maxLength }, (_, index) => `Game ${index + 1}`)
    : ['No data'];
  const visitorData = maxLength ? alignTrendSeries(visitorGames, maxLength, metricKey) : [null];
  const homeData = maxLength ? alignTrendSeries(homeGames, maxLength, metricKey) : [null];

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: teamName(visualization, 'visitor'),
          data: visitorData,
          borderColor: roleColors.visitor.line,
          backgroundColor: roleColors.visitor.fill,
          spanGaps: true,
          tension: 0.35,
          pointRadius: maxLength ? 3.5 : 0,
          pointHoverRadius: maxLength ? 5.5 : 0,
        },
        {
          label: teamName(visualization, 'home'),
          data: homeData,
          borderColor: roleColors.home.line,
          backgroundColor: roleColors.home.fill,
          spanGaps: true,
          tension: 0.35,
          pointRadius: maxLength ? 3.5 : 0,
          pointHoverRadius: maxLength ? 5.5 : 0,
        },
      ],
    },
    options: {
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: {
          ticks: {
            callback(value, index) {
              return labels[index] || value;
            },
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback(value) {
              return `${helpers.formatNumber(value, decimals)}${suffix}`;
            },
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title(context) {
              const raw = context?.[0]?.raw?.meta;
              if (raw?.label) {
                return raw.label;
              }
              return context?.[0]?.label || '';
            },
            label(context) {
              const datasetLabel = context?.dataset?.label || '';
              const value = context.parsed?.y;
              const lines = [];
              if (Number.isFinite(value)) {
                lines.push(`${datasetLabel}: ${helpers.formatNumber(value, decimals)}${suffix}`);
              } else {
                lines.push(`${datasetLabel}: N/A`);
              }
              const meta = context.raw?.meta;
              if (meta) {
                const opponentLine = `${meta.result ?? ''} ${meta.opponent ?? ''}`.trim();
                if (opponentLine) {
                  lines.push(opponentLine);
                }
              }
              return lines;
            },
          },
        },
      },
    },
  };
}

function buildPeriodScoringConfig(visualization) {
  const breakdown = visualization?.scoringBreakdown || { labels: [], visitor: [], home: [] };
  let labels = Array.isArray(breakdown.labels) ? [...breakdown.labels] : [];
  let visitorValues = Array.isArray(breakdown.visitor) ? [...breakdown.visitor] : [];
  let homeValues = Array.isArray(breakdown.home) ? [...breakdown.home] : [];

  if (!labels.length) {
    labels = ['Game total'];
    const visitorScore = Number.isFinite(visualization?.scores?.visitor) ? visualization.scores.visitor : 0;
    const homeScore = Number.isFinite(visualization?.scores?.home) ? visualization.scores.home : 0;
    visitorValues = [visitorScore];
    homeValues = [homeScore];
  }

  const visitorData = labels.map((_, index) => {
    const value = Number(visitorValues?.[index]);
    return Number.isFinite(value) ? value : 0;
  });
  const homeData = labels.map((_, index) => {
    const value = Number(homeValues?.[index]);
    return Number.isFinite(value) ? value : 0;
  });

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: teamName(visualization, 'visitor'),
          data: visitorData,
          backgroundColor: roleColors.visitor.fill,
          borderColor: roleColors.visitor.solid,
          borderWidth: 1.5,
        },
        {
          label: teamName(visualization, 'home'),
          data: homeData,
          backgroundColor: roleColors.home.fill,
          borderColor: roleColors.home.solid,
          borderWidth: 1.5,
        },
      ],
    },
    options: {
      scales: {
        x: { stacked: false },
        y: {
          beginAtZero: true,
          ticks: {
            callback(value) {
              return `${helpers.formatNumber(value, 0)} pts`;
            },
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed?.y ?? 0;
              return `${context.dataset.label}: ${helpers.formatNumber(value, 0)} points`;
            },
          },
        },
      },
    },
  };
}

function computeShotPointMix(totals) {
  if (!totals) {
    return { two: 0, three: 0, ft: 0 };
  }
  const fg3m = Number(totals?.fg3m ?? 0);
  const fgm = Number(totals?.fgm ?? 0);
  const ftm = Number(totals?.ftm ?? 0);
  const twoMakes = Math.max(fgm - fg3m, 0);
  return {
    two: twoMakes * 2,
    three: fg3m * 3,
    ft: ftm,
  };
}

function buildShotValueConfig(visualization) {
  const visitorMix = computeShotPointMix(visualization?.totals?.visitor);
  const homeMix = computeShotPointMix(visualization?.totals?.home);
  return {
    type: 'bar',
    data: {
      labels: [teamName(visualization, 'visitor'), teamName(visualization, 'home')],
      datasets: [
        {
          label: 'Two-point',
          data: [visitorMix.two, homeMix.two],
          backgroundColor: palette.royal,
          stack: 'points',
        },
        {
          label: 'Three-point',
          data: [visitorMix.three, homeMix.three],
          backgroundColor: palette.coral,
          stack: 'points',
        },
        {
          label: 'Free throw',
          data: [visitorMix.ft, homeMix.ft],
          backgroundColor: palette.teal,
          stack: 'points',
        },
      ],
    },
    options: {
      scales: {
        x: { stacked: true },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            callback(value) {
              return `${helpers.formatNumber(value, 0)} pts`;
            },
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed?.y ?? 0;
              return `${context.dataset.label}: ${helpers.formatNumber(value, 0)} points`;
            },
          },
        },
      },
    },
  };
}

function buildShootingAccuracyConfig(visualization) {
  const visitorTotals = visualization?.totals?.visitor;
  const homeTotals = visualization?.totals?.home;
  const labels = ['FG%', '3P%', 'FT%'];
  const visitorData = [
    percentage(visitorTotals?.fgm, visitorTotals?.fga) ?? 0,
    percentage(visitorTotals?.fg3m, visitorTotals?.fg3a) ?? 0,
    percentage(visitorTotals?.ftm, visitorTotals?.fta) ?? 0,
  ];
  const homeData = [
    percentage(homeTotals?.fgm, homeTotals?.fga) ?? 0,
    percentage(homeTotals?.fg3m, homeTotals?.fg3a) ?? 0,
    percentage(homeTotals?.ftm, homeTotals?.fta) ?? 0,
  ];
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: teamAbbreviation(visualization, 'visitor'),
          data: visitorData,
          backgroundColor: roleColors.visitor.fill,
          borderColor: roleColors.visitor.solid,
          borderWidth: 1.5,
        },
        {
          label: teamAbbreviation(visualization, 'home'),
          data: homeData,
          backgroundColor: roleColors.home.fill,
          borderColor: roleColors.home.solid,
          borderWidth: 1.5,
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback(value) {
              return `${helpers.formatNumber(value, 0)}%`;
            },
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed?.y ?? 0;
              return `${context.dataset.label}: ${helpers.formatNumber(value, 1)}%`;
            },
          },
        },
      },
    },
  };
}

function buildReboundControlConfig(visualization) {
  const visitorTotals = visualization?.totals?.visitor;
  const homeTotals = visualization?.totals?.home;
  const visitorOreb = Number(visitorTotals?.oreb ?? 0);
  const visitorDreb = Math.max(Number(visitorTotals?.reb ?? 0) - visitorOreb, 0);
  const homeOreb = Number(homeTotals?.oreb ?? 0);
  const homeDreb = Math.max(Number(homeTotals?.reb ?? 0) - homeOreb, 0);
  return {
    type: 'bar',
    data: {
      labels: [teamAbbreviation(visualization, 'visitor'), teamAbbreviation(visualization, 'home')],
      datasets: [
        {
          label: 'Offensive',
          data: [visitorOreb, homeOreb],
          backgroundColor: palette.coral,
          stack: 'rebounds',
        },
        {
          label: 'Defensive',
          data: [visitorDreb, homeDreb],
          backgroundColor: palette.sky,
          stack: 'rebounds',
        },
      ],
    },
    options: {
      scales: {
        x: { stacked: true },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            callback(value) {
              return helpers.formatNumber(value, 0);
            },
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed?.y ?? 0;
              return `${context.dataset.label}: ${helpers.formatNumber(value, 0)} boards`;
            },
          },
        },
      },
    },
  };
}

function buildPlaymakingBalanceConfig(visualization) {
  const visitorTotals = visualization?.totals?.visitor;
  const homeTotals = visualization?.totals?.home;
  const visitorAst = Number(visitorTotals?.ast ?? 0);
  const visitorTo = Number(visitorTotals?.turnover ?? 0);
  const homeAst = Number(homeTotals?.ast ?? 0);
  const homeTo = Number(homeTotals?.turnover ?? 0);
  return {
    type: 'bar',
    data: {
      labels: ['Assists', 'Turnovers'],
      datasets: [
        {
          label: teamAbbreviation(visualization, 'visitor'),
          data: [visitorAst, visitorTo],
          backgroundColor: roleColors.visitor.fill,
          borderColor: roleColors.visitor.solid,
          borderWidth: 1.5,
        },
        {
          label: teamAbbreviation(visualization, 'home'),
          data: [homeAst, homeTo],
          backgroundColor: roleColors.home.fill,
          borderColor: roleColors.home.solid,
          borderWidth: 1.5,
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback(value) {
              return helpers.formatNumber(value, 0);
            },
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed?.y ?? 0;
              const label = context.label.toLowerCase();
              return `${context.dataset.label}: ${helpers.formatNumber(value, 0)} ${label}`;
            },
          },
        },
      },
    },
  };
}

function computePossessionShares(totals) {
  const possessions = computePossessions(totals);
  if (!Number.isFinite(possessions) || possessions <= 0) {
    return { shots: 0, ft: 0, turnovers: 0 };
  }
  const fga = Number(totals?.fga ?? 0);
  const oreb = Number(totals?.oreb ?? 0);
  const fta = Number(totals?.fta ?? 0);
  const turnovers = Number(totals?.turnover ?? 0);
  const shotTrips = Math.max(fga - oreb, 0);
  const ftTrips = 0.44 * fta;
  return {
    shots: (shotTrips / possessions) * 100,
    ft: (ftTrips / possessions) * 100,
    turnovers: (turnovers / possessions) * 100,
  };
}

function buildPossessionProfileConfig(visualization) {
  const visitorShares = computePossessionShares(visualization?.totals?.visitor);
  const homeShares = computePossessionShares(visualization?.totals?.home);
  return {
    type: 'radar',
    data: {
      labels: ['Shot attempts', 'Free throw trips', 'Turnovers'],
      datasets: [
        {
          label: teamAbbreviation(visualization, 'visitor'),
          data: [visitorShares.shots, visitorShares.ft, visitorShares.turnovers],
          backgroundColor: 'rgba(31, 123, 255, 0.18)',
          borderColor: roleColors.visitor.solid,
          pointBackgroundColor: roleColors.visitor.solid,
          pointRadius: 3,
        },
        {
          label: teamAbbreviation(visualization, 'home'),
          data: [homeShares.shots, homeShares.ft, homeShares.turnovers],
          backgroundColor: 'rgba(244, 181, 63, 0.22)',
          borderColor: roleColors.home.solid,
          pointBackgroundColor: roleColors.home.solid,
          pointRadius: 3,
        },
      ],
    },
    options: {
      scales: {
        r: {
          beginAtZero: true,
          suggestedMax: 60,
          ticks: {
            backdropColor: 'transparent',
            callback(value) {
              return `${helpers.formatNumber(value, 0)}%`;
            },
          },
          pointLabels: {
            font: { weight: 600 },
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed?.r ?? 0;
              return `${context.dataset.label}: ${helpers.formatNumber(value, 1)}%`;
            },
          },
        },
      },
    },
  };
}

function periodDurationFromLabel(label) {
  if (typeof label !== 'string') {
    return 0;
  }
  if (/^OT\d+/i.test(label) || /^OT$/i.test(label)) {
    return 5 * 60;
  }
  if (/^\dQ$/i.test(label)) {
    return 12 * 60;
  }
  return 0;
}

function describePeriodEndpoint(label) {
  if (typeof label !== 'string') {
    return 'Period';
  }
  if (label === '1Q') return 'End 1Q';
  if (label === '2Q') return 'Halftime';
  if (label === '3Q') return 'End 3Q';
  if (label === '4Q') return 'End 4Q';
  if (/^OT(\d+)/i.test(label)) {
    const match = label.match(/^OT(\d+)/i);
    if (match) {
      return `End OT${match[1]}`;
    }
  }
  if (/^OT$/i.test(label)) {
    return 'End OT';
  }
  return label;
}

function formatRemainingClock(seconds) {
  if (!Number.isFinite(seconds)) {
    return '';
  }
  const clamped = Math.max(0, seconds);
  const wholeSeconds = Math.round(clamped);
  const mins = Math.floor(wholeSeconds / 60);
  const secs = wholeSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function computeLiveElapsedSeconds(game) {
  if (!game || !Number.isFinite(game?.period) || game.period <= 0) {
    return null;
  }
  let elapsed = 0;
  for (let index = 1; index < game.period; index += 1) {
    const duration = getPeriodDurationSeconds(index) || 0;
    elapsed += duration;
  }
  const parsed = parseElapsedClockValue(game.time);
  const periodDuration = getPeriodDurationSeconds(game.period) || 0;
  if (parsed && periodDuration) {
    const fractional = parsed.fractional ? parsed.fractional / (parsed.precision || 1) : 0;
    const elapsedInPeriod = parsed.minutes * 60 + parsed.seconds + fractional;
    const bounded = Math.min(Math.max(elapsedInPeriod, 0), periodDuration);
    elapsed += bounded;
  }
  return elapsed;
}

function computeTotalGameSeconds(game, labels, scoreboardElapsed = 0) {
  const baseRegulation = 4 * 12 * 60;
  const overtimeCount = Array.isArray(labels)
    ? labels.filter((label) => /^OT\d+/i.test(label)).length
    : 0;
  const regulationTotal = baseRegulation + overtimeCount * 5 * 60;
  if (game?.stage === 'final') {
    return Math.max(regulationTotal, scoreboardElapsed, baseRegulation);
  }
  const period = Number(game?.period);
  if (Number.isFinite(period) && period > 0) {
    let total = 0;
    for (let index = 1; index <= period; index += 1) {
      total += getPeriodDurationSeconds(index) || 0;
    }
    return Math.max(total, regulationTotal, scoreboardElapsed, baseRegulation);
  }
  return Math.max(regulationTotal, baseRegulation, scoreboardElapsed);
}

function describeScoreboardPoint(game) {
  if (!game) {
    return 'Scoreboard';
  }
  if (game.stage === 'final') {
    return 'Final';
  }
  if (game.stage === 'live') {
    const periodLabel = formatPeriodLabel(game);
    const clock = formatGameClock(game);
    if (periodLabel && clock) {
      return `Live • ${periodLabel} ${clock}`;
    }
    if (periodLabel) {
      return `Live • ${periodLabel}`;
    }
    return 'Live update';
  }
  return formatGameStatus(game) || 'Scoreboard';
}

function formatLeadLabel(visualization, lead) {
  if (!Number.isFinite(lead) || lead === 0) {
    return 'Tied score';
  }
  const leaderRole = lead > 0 ? 'home' : 'visitor';
  const prefix = teamAbbreviation(visualization, leaderRole);
  return `${prefix} +${helpers.formatNumber(Math.abs(lead), 0)}`;
}

function estimateHomeWinProbability(lead, timeRemaining, totalSeconds) {
  if (!Number.isFinite(lead) || !Number.isFinite(timeRemaining) || !Number.isFinite(totalSeconds)) {
    return 0.5;
  }
  if (totalSeconds <= 0) {
    if (lead > 0) return 1;
    if (lead < 0) return 0;
    return 0.5;
  }
  if (timeRemaining <= 0) {
    if (lead > 0) return 1;
    if (lead < 0) return 0;
    return 0.5;
  }
  const remainingFraction = Math.max(0, Math.min(1, timeRemaining / totalSeconds));
  const scale = 8 * remainingFraction + 1.6;
  const logisticInput = lead / scale;
  const probability = 1 / (1 + Math.exp(-logisticInput));
  return Math.max(0, Math.min(1, probability));
}

function buildWinProbabilitySeries(visualization) {
  const game = visualization?.game;
  if (!game) {
    return { points: [], totalSeconds: 0 };
  }

  const breakdown = game.scoringBreakdown || { labels: [], visitor: [], home: [] };
  const labels = Array.isArray(breakdown.labels) ? breakdown.labels : [];
  const homeSegments = Array.isArray(breakdown.home) ? breakdown.home : [];
  const visitorSegments = Array.isArray(breakdown.visitor) ? breakdown.visitor : [];

  const points = [
    {
      rawLabel: 'tip',
      label: 'Tipoff',
      elapsedSeconds: 0,
      homeScore: 0,
      visitorScore: 0,
      stage: 'upcoming',
    },
  ];

  let elapsedSeconds = 0;
  let cumulativeHome = 0;
  let cumulativeVisitor = 0;

  labels.forEach((rawLabel, index) => {
    const duration = periodDurationFromLabel(rawLabel);
    if (duration <= 0) {
      return;
    }
    const homeDelta = Number(homeSegments[index]) || 0;
    const visitorDelta = Number(visitorSegments[index]) || 0;
    cumulativeHome += homeDelta;
    cumulativeVisitor += visitorDelta;
    elapsedSeconds += duration;
    points.push({
      rawLabel,
      label: describePeriodEndpoint(rawLabel),
      elapsedSeconds,
      homeScore: cumulativeHome,
      visitorScore: cumulativeVisitor,
      stage: 'period-end',
    });
  });

  const scoreboardHome = Number(visualization?.scores?.home);
  const scoreboardVisitor = Number(visualization?.scores?.visitor);
  if (Number.isFinite(scoreboardHome) && Number.isFinite(scoreboardVisitor)) {
    const liveElapsed = computeLiveElapsedSeconds(game);
    const scoreboardElapsed = Number.isFinite(liveElapsed) ? liveElapsed : elapsedSeconds;
    const totalSeconds = computeTotalGameSeconds(game, labels, scoreboardElapsed);
    const clampedElapsed = Math.min(Math.max(scoreboardElapsed, 0), totalSeconds);
    const scoreboardPoint = {
      rawLabel: game.stage,
      label: describeScoreboardPoint(game),
      elapsedSeconds: clampedElapsed,
      homeScore: scoreboardHome,
      visitorScore: scoreboardVisitor,
      stage: game.stage,
      isLive: game.stage === 'live',
      isFinal: game.stage === 'final',
    };
    const last = points[points.length - 1];
    const duplicate =
      last &&
      Math.abs(last.homeScore - scoreboardHome) < 0.01 &&
      Math.abs(last.visitorScore - scoreboardVisitor) < 0.01 &&
      Math.abs(last.elapsedSeconds - clampedElapsed) < 1;
    if (duplicate) {
      points[points.length - 1] = { ...last, ...scoreboardPoint };
    } else {
      points.push(scoreboardPoint);
    }
    return {
      points,
      totalSeconds: Math.max(totalSeconds, elapsedSeconds),
    };
  }

  const fallbackTotal = computeTotalGameSeconds(game, labels, elapsedSeconds);
  return {
    points,
    totalSeconds: Math.max(fallbackTotal, elapsedSeconds),
  };
}

function buildWinProbabilityConfig(visualization) {
  const { points, totalSeconds } = buildWinProbabilitySeries(visualization);
  if (!points.length) {
    return null;
  }

  const enriched = points
    .map((point) => {
      const clampedElapsed = Math.min(Math.max(point.elapsedSeconds, 0), totalSeconds || 0);
      const timeRemaining = Math.max((totalSeconds || 0) - clampedElapsed, 0);
      const lead = Number(point.homeScore) - Number(point.visitorScore);
      let probability = estimateHomeWinProbability(lead, timeRemaining, totalSeconds || 0);
      if (point.isFinal) {
        if (lead > 0) probability = 1;
        else if (lead < 0) probability = 0;
        else probability = 0.5;
      }
      const probabilityPercent = Math.max(0, Math.min(100, probability * 100));
      return {
        ...point,
        elapsedSeconds: clampedElapsed,
        timeRemaining,
        homeWinProbability: probabilityPercent,
        lead,
        leadLabel: formatLeadLabel(visualization, lead),
        timeRemainingLabel: timeRemaining > 0 ? formatRemainingClock(timeRemaining) : '',
      };
    })
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);

  if (enriched.length < 2) {
    const placeholderLabel = enriched[0]?.label || 'Awaiting tip';
    return {
      type: 'line',
      data: {
        labels: [placeholderLabel],
        datasets: [
          {
            label: `${teamName(visualization, 'home')} win %`,
            data: [{ y: 50, meta: enriched[0] }],
            borderColor: roleColors.home.line,
            fill: false,
          },
          {
            label: `${teamName(visualization, 'visitor')} win %`,
            data: [{ y: 50, meta: enriched[0] }],
            borderColor: roleColors.visitor.line,
            borderDash: [4, 4],
            fill: false,
          },
        ],
      },
      options: {
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label() {
                return 'Win probability will activate once the game begins.';
              },
            },
          },
        },
        scales: {
          x: { display: false },
          y: {
            min: 0,
            max: 100,
            ticks: {
              callback(value) {
                return `${helpers.formatNumber(value, 0)}%`;
              },
            },
          },
        },
      },
    };
  }

  const visitorAbbr = teamAbbreviation(visualization, 'visitor');
  const homeAbbr = teamAbbreviation(visualization, 'home');
  const labels = enriched.map((point) => point.label);
  const homeData = enriched.map((point) => ({ y: point.homeWinProbability, meta: point }));
  const visitorData = enriched.map((point) => ({ y: 100 - point.homeWinProbability, meta: point }));

  const backgroundGradient = (context) => {
    const { chart } = context;
    const { ctx, chartArea } = chart;
    if (!chartArea) {
      return 'rgba(244, 181, 63, 0.2)';
    }
    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradient.addColorStop(0, 'rgba(17, 86, 214, 0.18)');
    gradient.addColorStop(0.48, 'rgba(17, 86, 214, 0.06)');
    gradient.addColorStop(0.52, 'rgba(244, 181, 63, 0.08)');
    gradient.addColorStop(1, 'rgba(244, 181, 63, 0.3)');
    return gradient;
  };

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: `${teamName(visualization, 'home')} win %`,
          data: homeData,
          borderColor: roleColors.home.line,
          backgroundColor: backgroundGradient,
          fill: true,
          tension: 0.32,
          pointRadius(context) {
            const meta = context.raw?.meta;
            if (meta?.isFinal) {
              return 6;
            }
            if (meta?.isLive) {
              return 5;
            }
            return 3.5;
          },
          pointHoverRadius(context) {
            const meta = context.raw?.meta;
            if (meta?.isFinal) {
              return 7.5;
            }
            if (meta?.isLive) {
              return 6.5;
            }
            return 5;
          },
          pointBackgroundColor(context) {
            const meta = context.raw?.meta;
            if (meta?.isLive) {
              return '#ffffff';
            }
            if (meta?.isFinal) {
              return roleColors.home.solid;
            }
            return 'rgba(244, 181, 63, 0.95)';
          },
          pointBorderColor(context) {
            const meta = context.raw?.meta;
            if (meta?.isLive) {
              return roleColors.home.solid;
            }
            return '#ffffff';
          },
          borderWidth: 2,
        },
        {
          label: `${teamName(visualization, 'visitor')} win %`,
          data: visitorData,
          borderColor: roleColors.visitor.line,
          borderDash: [6, 4],
          fill: false,
          tension: 0.32,
          pointRadius: 0,
          pointHoverRadius: 0,
        },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            callback(value, index) {
              return labels[index] || value;
            },
          },
        },
        y: {
          min: 0,
          max: 100,
          grid: {
            color(context) {
              if (context.tick.value === 50) {
                return 'rgba(11, 37, 69, 0.35)';
              }
              return 'rgba(11, 37, 69, 0.12)';
            },
            lineWidth(context) {
              return context.tick.value === 50 ? 1.4 : 0.8;
            },
          },
          ticks: {
            callback(value) {
              return `${helpers.formatNumber(value, 0)}%`;
            },
          },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          displayColors: false,
          callbacks: {
            title(context) {
              return context?.[0]?.raw?.meta?.label || context?.[0]?.label || '';
            },
            label(context) {
              const datasetLabel = context.dataset?.label || '';
              const value = context.parsed?.y ?? 0;
              return `${datasetLabel}: ${helpers.formatNumber(value, 1)}%`;
            },
            afterBody(contexts) {
              const meta = contexts?.[0]?.raw?.meta;
              if (!meta) {
                return [];
              }
              const lines = [];
              const visitorScore = helpers.formatNumber(meta.visitorScore ?? 0, 0);
              const homeScore = helpers.formatNumber(meta.homeScore ?? 0, 0);
              lines.push(`${visitorAbbr} ${visitorScore} — ${homeAbbr} ${homeScore}`);
              if (meta.timeRemainingLabel) {
                lines.push(`${meta.timeRemainingLabel} remaining`);
              }
              if (meta.leadLabel) {
                lines.push(`Lead: ${meta.leadLabel}`);
              }
              return lines;
            },
          },
        },
      },
    },
  };
}

function collectTopScorers(visualization, limit = 6) {
  const combined = [];
  ['visitor', 'home'].forEach((role) => {
    const players = Array.isArray(visualization?.players?.[role]) ? visualization.players[role] : [];
    const teamAbbr = teamAbbreviation(visualization, role);
    players.forEach((player) => {
      const points = Number(player?.pts ?? 0);
      if (!Number.isFinite(points)) {
        return;
      }
      combined.push({
        name: player.name,
        points,
        role,
        teamAbbr,
        minutes: parseMinutesToSeconds(player?.min ?? '0:00'),
      });
    });
  });
  combined.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (b.minutes !== a.minutes) {
      return b.minutes - a.minutes;
    }
    return a.name.localeCompare(b.name);
  });
  return combined.slice(0, limit);
}

function buildScoringHierarchyConfig(visualization) {
  const leaders = collectTopScorers(visualization);
  if (!leaders.length) {
    return {
      type: 'bar',
      data: {
        labels: ['No box score yet'],
        datasets: [
          {
            data: [0],
            backgroundColor: 'rgba(11, 37, 69, 0.16)',
            borderColor: 'rgba(11, 37, 69, 0.38)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: { beginAtZero: true },
        },
        plugins: { legend: { display: false } },
      },
    };
  }
  const labels = leaders.map((player) => `${player.name} (${player.teamAbbr})`);
  const data = leaders.map((player) => player.points);
  const backgroundColor = leaders.map((player) => roleColors[player.role]?.fill || palette.sky);
  const borderColor = leaders.map((player) => roleColors[player.role]?.solid || palette.sky);
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Points',
          data,
          backgroundColor,
          borderColor,
          borderWidth: 1.4,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback(value) {
              return helpers.formatNumber(value, 0);
            },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed?.x ?? 0;
              return `${context.label}: ${helpers.formatNumber(value, 0)} points`;
            },
          },
        },
      },
    },
  };
}

function computeRotationMinutes(players) {
  const sorted = [...players].sort(
    (a, b) => parseMinutesToSeconds(b?.min ?? '0:00') - parseMinutesToSeconds(a?.min ?? '0:00')
  );
  const top = sorted.slice(0, 6);
  const totalSeconds = top.reduce((sum, player) => sum + parseMinutesToSeconds(player?.min ?? '0:00'), 0);
  return {
    totalMinutes: totalSeconds / 60,
    breakdown: top.map((player) => ({
      name: player.name,
      minutes: parseMinutesToSeconds(player?.min ?? '0:00') / 60,
    })),
  };
}

function buildRotationWorkloadConfig(visualization) {
  const visitorRotation = computeRotationMinutes(Array.isArray(visualization?.players?.visitor) ? visualization.players.visitor : []);
  const homeRotation = computeRotationMinutes(Array.isArray(visualization?.players?.home) ? visualization.players.home : []);
  const labels = [teamAbbreviation(visualization, 'visitor'), teamAbbreviation(visualization, 'home')];
  const totals = [visitorRotation.totalMinutes, homeRotation.totalMinutes];
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Minutes (top six)',
          data: totals,
          backgroundColor: [roleColors.visitor.fill, roleColors.home.fill],
          borderColor: [roleColors.visitor.solid, roleColors.home.solid],
          borderWidth: 1.5,
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback(value) {
              return `${helpers.formatNumber(value, 0)} min`;
            },
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed?.y ?? 0;
              return `${context.dataset.label}: ${helpers.formatNumber(value, 1)} minutes`;
            },
            afterLabel(context) {
              const rotation = context.dataIndex === 0 ? visitorRotation : homeRotation;
              if (!rotation.breakdown.length) {
                return '';
              }
              return rotation.breakdown
                .map((player) => `• ${player.name}: ${helpers.formatNumber(player.minutes, 1)} min`)
                .join('\n');
            },
          },
        },
      },
    },
  };
}

function renderVisualizations(visualization) {
  if (!visualization) {
    destroyCharts();
    return;
  }
  destroyCharts();
  registerCharts([
    {
      element: '#points-trend',
      async createConfig() {
        return buildTrendLineConfig(visualization, 'points', { decimals: 0, suffix: ' pts' });
      },
    },
    {
      element: '#off-rating-trend',
      async createConfig() {
        return buildTrendLineConfig(visualization, 'offRating', { decimals: 1 });
      },
    },
    {
      element: '#pace-trend',
      async createConfig() {
        return buildTrendLineConfig(visualization, 'pace', { decimals: 1, suffix: ' poss' });
      },
    },
    {
      element: '#period-scoring',
      async createConfig() {
        return buildPeriodScoringConfig(visualization);
      },
    },
    {
      element: '#scoring-sources',
      async createConfig() {
        return buildShotValueConfig(visualization);
      },
    },
    {
      element: '#shooting-accuracy',
      async createConfig() {
        return buildShootingAccuracyConfig(visualization);
      },
    },
    {
      element: '#rebound-control',
      async createConfig() {
        return buildReboundControlConfig(visualization);
      },
    },
    {
      element: '#playmaking-balance',
      async createConfig() {
        return buildPlaymakingBalanceConfig(visualization);
      },
    },
    {
      element: '#possession-profile',
      async createConfig() {
        return buildPossessionProfileConfig(visualization);
      },
    },
    {
      element: '#win-probability',
      async createConfig() {
        return buildWinProbabilityConfig(visualization);
      },
    },
    {
      element: '#scoring-leaders',
      async createConfig() {
        return buildScoringHierarchyConfig(visualization);
      },
    },
    {
      element: '#rotation-minutes',
      async createConfig() {
        return buildRotationWorkloadConfig(visualization);
      },
    },
  ]);
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
    const visualizationData = await buildVisualizationData(game, aggregated);
    latestVisualization = visualizationData;

    ['visitor', 'home'].forEach((role) => {
      const team = game[role];
      const totals = aggregated.get(team.id);
      renderTeamTotals(role, totals);
      renderTeamLeaders(role, totals);
    });

    renderVisualizations(visualizationData);

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
