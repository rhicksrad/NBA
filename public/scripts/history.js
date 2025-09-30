import { enablePanZoom, enhanceUsaInsets } from './map-utils.js';

const API_BASE = 'https://api.balldontlie.io/v1';
const LATEST_COMPLETED_SEASON = 2024;
const EARLIEST_SEASON = 1979;
const PLAYERS_MIN_URL = 'data/history/players.index.min.json';
const PLAYERS_FULL_URL = 'data/history/players.index.json';
const BIRTHPLACES_URL = 'data/history/player_birthplaces.json';
const GOAT_URL = 'data/goat_system.json';
const WORLD_LEGENDS_URL = 'data/world_birth_legends.json';

const numberFormatter = new Intl.NumberFormat('en-US');
const decimalFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

const stateNames = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DC: 'District of Columbia',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  IA: 'Iowa',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  MA: 'Massachusetts',
  MD: 'Maryland',
  ME: 'Maine',
  MI: 'Michigan',
  MN: 'Minnesota',
  MO: 'Missouri',
  MS: 'Mississippi',
  MT: 'Montana',
  NC: 'North Carolina',
  ND: 'North Dakota',
  NE: 'Nebraska',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NV: 'Nevada',
  NY: 'New York',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VA: 'Virginia',
  VT: 'Vermont',
  WA: 'Washington',
  WI: 'Wisconsin',
  WV: 'West Virginia',
  WY: 'Wyoming',
  PR: 'Puerto Rico',
};

const selectors = {
  searchInput: document.querySelector('[data-history="player-search"]'),
  searchResults: document.querySelector('[data-history="player-results"]'),
  playerCard: document.querySelector('[data-history="player-card"]'),
  visualsGrid: document.querySelector('[data-history="visuals-grid"]'),
  visualsSection: document.querySelector('[data-history="player-visuals"]'),
  mapRoot: document.querySelector('[data-state-map-tiles]'),
  atlasTitle: document.querySelector('[data-atlas-title]'),
  atlasCaption: document.querySelector('[data-atlas-caption]'),
  atlasToggle: document.querySelector('[data-atlas-toggle]'),
  atlasSpotlight: document.querySelector('[data-state-spotlight]'),
  spotlightHeading: document.querySelector('[data-spotlight-heading]'),
};

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\p{M}]+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

async function loadJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.json();
}

function getApiKey() {
  const meta = document.querySelector('meta[name="bdl-api-key"]');
  const metaKey = meta?.getAttribute('content')?.trim();
  if (metaKey) {
    return metaKey;
  }
  if (typeof window !== 'undefined') {
    const globalKey = window.BDL_API_KEY || window.BALLDONTLIE_API_KEY || window.BALL_DONT_LIE_API_KEY;
    if (globalKey && String(globalKey).trim()) {
      return String(globalKey).trim();
    }
  }
  return null;
}

function formatInches(value) {
  if (!value) return null;
  if (!value.includes('-')) return value;
  const [feet, inches] = value.split('-');
  return `${Number(feet)}'${inches}"`;
}

function formatWeight(value) {
  if (!value) return null;
  return `${value} lbs`;
}

function joinParts(parts, fallback = '--') {
  const filtered = parts.filter((part) => part && String(part).trim().length);
  return filtered.length ? filtered.join(' • ') : fallback;
}

function parseMinutes(value) {
  if (!value) return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const [minutes, seconds] = trimmed.split(':').map((part) => Number(part));
  if (!Number.isFinite(minutes)) return 0;
  const secs = Number.isFinite(seconds) ? seconds : 0;
  return minutes * 60 + secs;
}

function sumStat(target, key, value) {
  target[key] = (target[key] ?? 0) + value;
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = Math.abs(total % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function computePerGame(total, games) {
  if (!games) return 0;
  return total / games;
}

function safePercent(value) {
  if (!Number.isFinite(value)) return null;
  return percentFormatter.format(Math.max(0, Math.min(value, 1)));
}

function computePercentile(value, sortedValues, { higherIsBetter = true } = {}) {
  if (!Number.isFinite(value) || !Array.isArray(sortedValues) || sortedValues.length === 0) {
    return null;
  }
  const count = sortedValues.length;
  let index;
  if (higherIsBetter) {
    index = sortedValues.findIndex((entry) => value <= entry);
    if (index === -1) index = count - 1;
    return ((index + 1) / count) * 100;
  }
  index = sortedValues.findIndex((entry) => value >= entry);
  if (index === -1) index = count - 1;
  return ((count - index) / count) * 100;
}

function buildTierScore(tier) {
  const order = [
    'Inner Circle',
    'Legend',
    'Icon',
    'All-Star',
    'Starter',
    'Rotation',
    'Reserve',
    'Prospect',
    'Development',
  ];
  if (!tier) return 0;
  const index = order.indexOf(tier);
  if (index === -1) return 0;
  return order.length - index;
}

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) {
    el.textContent = text;
  }
  return el;
}

function buildAuthHeaders(apiKey) {
  if (!apiKey) return {};
  const trimmed = String(apiKey).trim();
  const headers = { Accept: 'application/json' };
  headers.Authorization = /^Bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
  return headers;
}

function resolveSeasonRange(player) {
  const draftYear = Number.parseInt(player?.draft_year ?? '', 10);
  const start = Number.isFinite(draftYear)
    ? Math.max(EARLIEST_SEASON, draftYear - 1)
    : EARLIEST_SEASON;
  return { start, end: LATEST_COMPLETED_SEASON };
}

function multiplyStat(value, games) {
  const numericValue = Number(value);
  const numericGames = Number(games);
  if (!Number.isFinite(numericValue) || !Number.isFinite(numericGames)) return 0;
  return Math.round(numericValue * numericGames);
}

async function fetchSeasonAggregate(player, apiKey, postseason) {
  const playerId = player?.id;
  if (!Number.isFinite(playerId)) {
    throw new Error('Invalid player identifier for season aggregate request.');
  }
  const totals = {
    games: 0,
    minutes: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    fgm: 0,
    fga: 0,
    fg3m: 0,
    fg3a: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
  };
  const seasons = new Set();
  const headers = buildAuthHeaders(apiKey);
  const { start, end } = resolveSeasonRange(player);
  let emptyStreak = 0;

  for (let season = start; season <= end; season += 1) {
    const url = new URL(`${API_BASE}/season_averages`);
    url.searchParams.set('season', String(season));
    url.searchParams.set('player_id', String(playerId));
    if (postseason) {
      url.searchParams.set('postseason', 'true');
    }
    const response = await fetch(url, { headers, cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Season averages request failed with ${response.status}`);
    }
    const payload = await response.json();
    const record = Array.isArray(payload.data) ? payload.data[0] ?? null : null;
    if (!record) {
      if (totals.games > 0) {
        emptyStreak += 1;
        if (emptyStreak >= 3) {
          break;
        }
      }
      continue;
    }

    emptyStreak = 0;
    const games = Number(record.games_played ?? record.games ?? 0);
    if (!Number.isFinite(games) || games <= 0) {
      continue;
    }

    totals.games += games;
    totals.minutes += multiplyStat(parseMinutes(record.min), games);
    sumStat(totals, 'points', multiplyStat(record.pts ?? record.points ?? 0, games));
    sumStat(totals, 'rebounds', multiplyStat(record.reb ?? record.rebounds ?? 0, games));
    sumStat(totals, 'assists', multiplyStat(record.ast ?? record.assists ?? 0, games));
    sumStat(totals, 'steals', multiplyStat(record.stl ?? record.steals ?? 0, games));
    sumStat(totals, 'blocks', multiplyStat(record.blk ?? record.blocks ?? 0, games));
    sumStat(totals, 'turnovers', multiplyStat(record.turnover ?? record.turnovers ?? 0, games));
    sumStat(totals, 'fouls', multiplyStat(record.pf ?? record.fouls ?? 0, games));
    sumStat(totals, 'fgm', multiplyStat(record.fgm ?? 0, games));
    sumStat(totals, 'fga', multiplyStat(record.fga ?? 0, games));
    sumStat(totals, 'fg3m', multiplyStat(record.fg3m ?? 0, games));
    sumStat(totals, 'fg3a', multiplyStat(record.fg3a ?? 0, games));
    sumStat(totals, 'ftm', multiplyStat(record.ftm ?? 0, games));
    sumStat(totals, 'fta', multiplyStat(record.fta ?? 0, games));
    sumStat(totals, 'oreb', multiplyStat(record.oreb ?? 0, games));
    sumStat(totals, 'dreb', multiplyStat(record.dreb ?? 0, games));
    const seasonValue = Number(record.season ?? season);
    if (Number.isFinite(seasonValue)) {
      seasons.add(seasonValue);
    }
  }

  const seasonList = Array.from(seasons).sort((a, b) => a - b);
  return { totals, seasons: seasonList };
}

async function fetchCareerStats(player, apiKey) {
  const playerId = player?.id;
  if (!Number.isFinite(playerId)) {
    throw new Error('Cannot fetch career stats without a valid player id.');
  }
  const [regular, postseason] = await Promise.all([
    fetchSeasonAggregate(player, apiKey, false),
    fetchSeasonAggregate(player, apiKey, true),
  ]);
  return {
    regular,
    postseason,
  };
}

function renderTotalsTable(title, data) {
  const { totals, seasons } = data;
  if (!totals.games) {
    const wrapper = createElement('div', 'history-player__totals');
    wrapper.append(createElement('h4', 'history-player__totals-heading', title));
    wrapper.append(
      createElement('p', 'history-player__totals-empty', 'No games recorded in the archive yet.'),
    );
    return wrapper;
  }
  const wrapper = createElement('div', 'history-player__totals');
  wrapper.append(createElement('h4', 'history-player__totals-heading', title));
  const subhead = createElement(
    'p',
    'history-player__totals-meta',
    `${totals.games} games • ${seasons.length} seasons (${seasons[0]}–${seasons[seasons.length - 1]})`,
  );
  wrapper.append(subhead);
  const table = createElement('table', 'history-player__totals-table');
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th scope="col">Stat</th>
      <th scope="col">Total</th>
      <th scope="col">Per game</th>
    </tr>
  `;
  table.append(thead);
  const tbody = document.createElement('tbody');
  const rows = [
    ['Minutes', formatDuration(totals.minutes), formatDuration(computePerGame(totals.minutes, totals.games))],
    ['Points', numberFormatter.format(totals.points), decimalFormatter.format(computePerGame(totals.points, totals.games))],
    ['Rebounds', numberFormatter.format(totals.rebounds), decimalFormatter.format(computePerGame(totals.rebounds, totals.games))],
    ['Assists', numberFormatter.format(totals.assists), decimalFormatter.format(computePerGame(totals.assists, totals.games))],
    ['Steals', numberFormatter.format(totals.steals), decimalFormatter.format(computePerGame(totals.steals, totals.games))],
    ['Blocks', numberFormatter.format(totals.blocks), decimalFormatter.format(computePerGame(totals.blocks, totals.games))],
    ['Turnovers', numberFormatter.format(totals.turnovers), decimalFormatter.format(computePerGame(totals.turnovers, totals.games))],
    ['Personal fouls', numberFormatter.format(totals.fouls), decimalFormatter.format(computePerGame(totals.fouls, totals.games))],
    ['Field goals', `${numberFormatter.format(totals.fgm)}/${numberFormatter.format(totals.fga)}`, safePercent(totals.fga ? totals.fgm / totals.fga : null) ?? '—'],
    ['Three-pointers', `${numberFormatter.format(totals.fg3m)}/${numberFormatter.format(totals.fg3a)}`, safePercent(totals.fg3a ? totals.fg3m / totals.fg3a : null) ?? '—'],
    ['Free throws', `${numberFormatter.format(totals.ftm)}/${numberFormatter.format(totals.fta)}`, safePercent(totals.fta ? totals.ftm / totals.fta : null) ?? '—'],
  ];
  for (const [label, total, perGame] of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <th scope="row">${label}</th>
      <td>${total}</td>
      <td>${perGame}</td>
    `;
    tbody.append(tr);
  }
  table.append(tbody);
  wrapper.append(table);
  return wrapper;
}

function renderPlayerMetadata(player, birthplace) {
  const fragments = [];
  const name = `${player.first_name} ${player.last_name}`.trim();
  fragments.push(createElement('h3', 'history-player__name', name));

  const infoLine = joinParts([
    player.position,
    formatInches(player.height),
    formatWeight(player.weight),
  ]);
  fragments.push(createElement('p', 'history-player__bio', infoLine));

  const secondary = [];
  if (player.team?.full_name) {
    secondary.push(player.team.full_name);
  }
  if (player.college) {
    secondary.push(player.college);
  }
  if (player.draft_year) {
    const draftBits = joinParts([
      `Draft ${player.draft_year}`,
      player.draft_round ? `Rd ${player.draft_round}` : null,
      player.draft_number ? `Pick ${player.draft_number}` : null,
    ]);
    secondary.push(draftBits);
  }
  if (birthplace) {
    const locationParts = [];
    if (birthplace.city) locationParts.push(birthplace.city);
    if (birthplace.stateName) locationParts.push(birthplace.stateName);
    if (birthplace.country && birthplace.country !== 'USA') locationParts.push(birthplace.country);
    if (locationParts.length) secondary.push(`Born in ${locationParts.join(', ')}`);
  }
  if (secondary.length) {
    fragments.push(createElement('p', 'history-player__meta', secondary.join(' • ')));
  }
  return fragments;
}

function renderPlayerCard(player, birthplace) {
  if (!selectors.playerCard) return;
  selectors.playerCard.innerHTML = '';
  const header = createElement('header', 'history-player__header');
  for (const fragment of renderPlayerMetadata(player, birthplace)) {
    header.append(fragment);
  }
  selectors.playerCard.append(header);
  const totalsContainer = createElement('div', 'history-player__totals-wrapper');
  selectors.playerCard.append(totalsContainer);
  return totalsContainer;
}

function renderVisuals(goatEntry, references) {
  if (!selectors.visualsGrid || !selectors.visualsSection) return;
  selectors.visualsGrid.innerHTML = '';
  if (!goatEntry) {
    selectors.visualsSection.classList.add('history-visuals--empty');
    selectors.visualsGrid.append(
      createElement(
        'p',
        'history-visuals__empty',
        'No GOAT analytics available for this player yet. We update tiers once new tracking data lands.',
      ),
    );
    return;
  }
  selectors.visualsSection.classList.remove('history-visuals--empty');
  const careerLength = (() => {
    if (!goatEntry.careerSpan) return null;
    const parts = goatEntry.careerSpan.split('-').map((part) => Number(part));
    if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return null;
    return parts[1] - parts[0] + 1;
  })();
  const primeLength = (() => {
    if (!goatEntry.primeWindow) return null;
    const parts = goatEntry.primeWindow.split('-').map((part) => Number(part));
    if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return null;
    return parts[1] - parts[0] + 1;
  })();
  const franchiseCount = Array.isArray(goatEntry.franchises) ? goatEntry.franchises.length : null;
  const visuals = [
    {
      label: 'GOAT score',
      value: goatEntry.goatScore,
      display: decimalFormatter.format(goatEntry.goatScore ?? 0),
      percentile: computePercentile(goatEntry.goatScore ?? null, references.goatScore),
    },
    {
      label: 'GOAT rank',
      value: goatEntry.rank,
      display: goatEntry.rank ? `#${numberFormatter.format(goatEntry.rank)}` : '—',
      percentile: computePercentile(goatEntry.rank ?? null, references.goatRank, { higherIsBetter: false }),
    },
    {
      label: 'Impact',
      value: goatEntry.goatComponents?.impact,
      display: decimalFormatter.format(goatEntry.goatComponents?.impact ?? 0),
      percentile: computePercentile(goatEntry.goatComponents?.impact ?? null, references.impact),
    },
    {
      label: 'Stage',
      value: goatEntry.goatComponents?.stage,
      display: decimalFormatter.format(goatEntry.goatComponents?.stage ?? 0),
      percentile: computePercentile(goatEntry.goatComponents?.stage ?? null, references.stage),
    },
    {
      label: 'Longevity',
      value: goatEntry.goatComponents?.longevity,
      display: decimalFormatter.format(goatEntry.goatComponents?.longevity ?? 0),
      percentile: computePercentile(goatEntry.goatComponents?.longevity ?? null, references.longevity),
    },
    {
      label: 'Versatility',
      value: goatEntry.goatComponents?.versatility,
      display: decimalFormatter.format(goatEntry.goatComponents?.versatility ?? 0),
      percentile: computePercentile(goatEntry.goatComponents?.versatility ?? null, references.versatility),
    },
    {
      label: 'Career win %',
      value: goatEntry.winPct,
      display: goatEntry.winPct != null ? percentFormatter.format(goatEntry.winPct) : '—',
      percentile: computePercentile(goatEntry.winPct ?? null, references.winPct),
    },
    {
      label: 'Playoff win %',
      value: goatEntry.playoffWinPct,
      display: goatEntry.playoffWinPct != null ? percentFormatter.format(goatEntry.playoffWinPct) : '—',
      percentile: computePercentile(goatEntry.playoffWinPct ?? null, references.playoffWinPct),
    },
    {
      label: 'Career length',
      value: careerLength,
      display: careerLength ? `${careerLength} years` : '—',
      percentile: computePercentile(careerLength ?? null, references.careerLength),
    },
    {
      label: 'Prime window',
      value: primeLength,
      display: primeLength ? `${primeLength} years` : '—',
      percentile: computePercentile(primeLength ?? null, references.primeLength),
    },
    {
      label: 'Franchise footprint',
      value: franchiseCount,
      display: franchiseCount != null ? `${franchiseCount} teams` : '—',
      percentile: computePercentile(franchiseCount ?? null, references.franchiseCount),
    },
  ];
  for (const metric of visuals) {
    const card = createElement('article', 'history-visual');
    card.append(createElement('h4', 'history-visual__label', metric.label));
    card.append(createElement('p', 'history-visual__value', metric.display));
    const meter = createElement('div', 'history-visual__meter');
    const fill = createElement('div', 'history-visual__meter-fill');
    const percentile = metric.percentile != null ? Math.max(0, Math.min(metric.percentile, 100)) : null;
    if (percentile != null) {
      fill.style.width = `${percentile}%`;
      fill.setAttribute('aria-valuenow', percentile.toFixed(1));
    } else {
      fill.style.width = '0%';
      fill.classList.add('history-visual__meter-fill--empty');
    }
    meter.append(fill);
    card.append(meter);
    if (percentile != null) {
      card.append(createElement('p', 'history-visual__percentile', `${percentile.toFixed(1)} percentile`));
    } else {
      card.append(createElement('p', 'history-visual__percentile history-visual__percentile--empty', 'Pending data'));
    }
    selectors.visualsGrid.append(card);
  }
}

function renderSearchResults(players, term) {
  if (!selectors.searchResults) return;
  selectors.searchResults.innerHTML = '';
  if (!term || !term.trim()) {
    selectors.searchResults.append(
      createElement('li', 'history-search__hint', 'Enter a player name to start searching the archive.'),
    );
    return;
  }
  const normalizedTerm = term.trim().toLowerCase();
  const matches = players
    .filter((player) => `${player.first} ${player.last}`.toLowerCase().includes(normalizedTerm))
    .slice(0, 15);
  if (!matches.length) {
    selectors.searchResults.append(createElement('li', 'history-search__hint', 'No players matched that search.'));
    return;
  }
  for (const match of matches) {
    const item = createElement('li', 'history-search__result');
    const button = createElement('button', 'history-search__button', `${match.first} ${match.last}`.trim());
    button.type = 'button';
    button.dataset.playerId = String(match.id);
    if (match.position) {
      button.append(createElement('span', 'history-search__position', match.position));
    }
    item.append(button);
    selectors.searchResults.append(item);
  }
}

function resolveBirthplace(nameKey, lookup) {
  const entries = lookup[nameKey];
  if (!Array.isArray(entries) || !entries.length) return null;
  return entries[0];
}

function buildGoatReferences(goatPlayers) {
  const refs = {
    goatScore: [],
    goatRank: [],
    impact: [],
    stage: [],
    longevity: [],
    versatility: [],
    winPct: [],
    playoffWinPct: [],
    careerLength: [],
    primeLength: [],
    franchiseCount: [],
  };
  for (const player of goatPlayers) {
    if (Number.isFinite(player.goatScore)) refs.goatScore.push(player.goatScore);
    if (Number.isFinite(player.rank)) refs.goatRank.push(player.rank);
    if (Number.isFinite(player.goatComponents?.impact)) refs.impact.push(player.goatComponents.impact);
    if (Number.isFinite(player.goatComponents?.stage)) refs.stage.push(player.goatComponents.stage);
    if (Number.isFinite(player.goatComponents?.longevity)) refs.longevity.push(player.goatComponents.longevity);
    if (Number.isFinite(player.goatComponents?.versatility)) refs.versatility.push(player.goatComponents.versatility);
    if (Number.isFinite(player.winPct)) refs.winPct.push(player.winPct);
    if (Number.isFinite(player.playoffWinPct)) refs.playoffWinPct.push(player.playoffWinPct);
    if (player.careerSpan) {
      const parts = player.careerSpan.split('-').map((part) => Number(part));
      if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) {
        refs.careerLength.push(parts[1] - parts[0] + 1);
      }
    }
    if (player.primeWindow) {
      const parts = player.primeWindow.split('-').map((part) => Number(part));
      if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) {
        refs.primeLength.push(parts[1] - parts[0] + 1);
      }
    }
    if (Array.isArray(player.franchises)) {
      refs.franchiseCount.push(player.franchises.length);
    }
  }
  for (const key of Object.keys(refs)) {
    refs[key].sort((a, b) => a - b);
  }
  return refs;
}

function buildCountryCodeMap(worldLegends) {
  const map = new Map();
  if (!worldLegends || !Array.isArray(worldLegends.countries)) {
    return map;
  }
  for (const entry of worldLegends.countries) {
    if (entry.country && entry.countryName) {
      map.set(entry.countryName.toLowerCase(), entry.country);
    }
  }
  return map;
}

function selectGoatEntry(player, goatIndex) {
  const nameKey = normalizeName(`${player.first_name} ${player.last_name}`);
  const matches = goatIndex.get(nameKey);
  if (!matches || !matches.length) return null;
  if (matches.length === 1) return matches[0];
  const draftYear = Number(player.draft_year);
  if (Number.isFinite(draftYear)) {
    const filtered = matches.filter((entry) => {
      if (!entry.careerSpan) return false;
      const [start] = entry.careerSpan.split('-').map((part) => Number(part));
      if (!Number.isFinite(start)) return false;
      return Math.abs(start - draftYear) <= 2;
    });
    if (filtered.length === 1) return filtered[0];
    if (filtered.length > 1) return filtered[0];
  }
  return matches[0];
}

function buildAtlas(players, birthplaces, goatIndex, countryCodes) {
  const domestic = new Map();
  const international = new Map();
  for (const player of players) {
    const nameKey = normalizeName(`${player.first_name} ${player.last_name}`);
    const birthplace = resolveBirthplace(nameKey, birthplaces);
    const goatEntry = selectGoatEntry(player, goatIndex);
    const baseInfo = {
      id: player.id,
      name: `${player.first_name} ${player.last_name}`.trim(),
      goatScore: goatEntry?.goatScore ?? null,
      goatRank: goatEntry?.rank ?? null,
      goatTier: goatEntry?.tier ?? null,
      resume: goatEntry?.resume ?? null,
      franchises: goatEntry?.franchises ?? null,
      birthCity: birthplace?.city ?? null,
      birthState: birthplace?.state ?? null,
      birthCountry: birthplace?.country ?? player.country ?? null,
    };
    if (birthplace?.state) {
      const bucket = domestic.get(birthplace.state) ?? [];
      bucket.push(baseInfo);
      domestic.set(birthplace.state, bucket);
    }
    const rawCountry = (birthplace?.country && birthplace.country !== 'USA') ? birthplace.country : player.country;
    if (rawCountry && rawCountry !== 'USA') {
      const code = countryCodes.get(rawCountry.toLowerCase()) ?? null;
      const bucket = international.get(code ?? rawCountry) ?? [];
      bucket.push({ ...baseInfo, countryName: rawCountry, countryCode: code ?? null });
      international.set(code ?? rawCountry, bucket);
    }
  }

  const domesticEntries = [];
  for (const [code, list] of domestic.entries()) {
    const playersSorted = list
      .slice()
      .sort((a, b) => {
        const aScore = Number.isFinite(a.goatScore) ? a.goatScore : -Infinity;
        const bScore = Number.isFinite(b.goatScore) ? b.goatScore : -Infinity;
        if (bScore !== aScore) return bScore - aScore;
        return a.name.localeCompare(b.name);
      })
      .map((entry, index) => ({ ...entry, groupRank: index + 1 }));
    const top = playersSorted[0];
    domesticEntries.push({
      state: code,
      stateName: stateNames[code] ?? code,
      player: top?.name ?? null,
      birthCity: top?.birthCity ?? null,
      headline: top?.resume ?? null,
      notableTeams: Array.isArray(top?.franchises) ? top.franchises : [],
      topPlayers: playersSorted,
    });
  }
  domesticEntries.sort((a, b) => a.state.localeCompare(b.state));

  const internationalEntries = [];
  for (const [code, list] of international.entries()) {
    const playersSorted = list
      .slice()
      .sort((a, b) => {
        const aScore = Number.isFinite(a.goatScore) ? a.goatScore : -Infinity;
        const bScore = Number.isFinite(b.goatScore) ? b.goatScore : -Infinity;
        if (bScore !== aScore) return bScore - aScore;
        return a.name.localeCompare(b.name);
      })
      .map((entry, index) => ({ ...entry, groupRank: index + 1 }));
    const top = playersSorted[0];
    const codeString = typeof code === 'string' ? code : null;
    internationalEntries.push({
      country: codeString ?? null,
      countryName: top?.countryName ?? (typeof code === 'string' ? code : 'Unknown'),
      player: top?.name ?? null,
      birthCity: top?.birthCity ?? null,
      headline: top?.resume ?? null,
      notableTeams: Array.isArray(top?.franchises) ? top.franchises : [],
      topPlayers: playersSorted,
    });
  }
  internationalEntries.sort((a, b) => a.countryName.localeCompare(b.countryName));

  return {
    domestic: { generatedAt: new Date().toISOString(), states: domesticEntries },
    international: { generatedAt: new Date().toISOString(), countries: internationalEntries },
  };
}

async function renderAtlas(mode, atlasData, svgCache) {
  if (!selectors.mapRoot) return;
  const config = mode === 'international'
    ? {
        id: 'international',
        mapAsset: 'vendor/world-countries.svg',
        datasetKey: 'countries',
        entryId: 'country',
        entryName: 'countryName',
        shapeAttribute: 'data-country',
        title: 'Best NBA star born in each country',
        caption: 'Select a country outline to spotlight the standout NBA player born there.',
        spotlightHeading: 'Country spotlight',
      }
    : {
        id: 'domestic',
        mapAsset: 'vendor/us-states.svg',
        datasetKey: 'states',
        entryId: 'state',
        entryName: 'stateName',
        shapeAttribute: 'data-state',
        title: 'Best NBA star born in each state',
        caption: 'Select a tile to spotlight the most decorated NBA player born in that state.',
        spotlightHeading: 'State spotlight',
      };

  const entries = atlasData[config.datasetKey] ?? [];
  const entryById = new Map(entries.map((entry) => [entry[config.entryId], entry]));

  let svg = svgCache.get(config.mapAsset) ?? null;
  if (!svg) {
    const response = await fetch(config.mapAsset);
    if (!response.ok) {
      throw new Error(`Failed to load ${config.mapAsset}`);
    }
    const markup = await response.text();
    const template = document.createElement('template');
    template.innerHTML = markup.trim().replace(/ns0:/g, '');
    const root = template.content.firstElementChild;
    if (root) {
      root.classList.add('state-map__svg');
      svg = root;
      svgCache.set(config.mapAsset, svg);
    }
  }
  if (!svg) return;
  selectors.mapRoot.innerHTML = '';
  const svgClone = svg.cloneNode(true);
  selectors.mapRoot.append(svgClone);
  selectors.mapRoot.dataset.atlasMode = config.id;
  if (config.id === 'domestic') {
    enhanceUsaInsets(svgClone);
  }
  enablePanZoom(selectors.mapRoot, svgClone, {
    maxScale: config.id === 'domestic' ? 6 : 5,
    minScale: 1,
    zoomStep: 0.35,
  });

  const shapes = svgClone.querySelectorAll(`[${config.shapeAttribute}]`);
  let defaultEntry = null;
  for (const shape of shapes) {
    const code = shape.getAttribute(config.shapeAttribute);
    const entry = entryById.get(code) ?? null;
    shape.classList.remove('state-shape--selected', 'state-shape--available', 'state-shape--empty');
    shape.removeAttribute('tabindex');
    shape.removeAttribute('role');
    shape.removeAttribute('aria-pressed');
    if (entry && entry.player) {
      shape.classList.add('state-shape--available');
      shape.setAttribute('role', 'button');
      shape.setAttribute('tabindex', '0');
      shape.setAttribute('aria-pressed', 'false');
      shape.setAttribute('title', entry.player);
      shape.setAttribute('aria-label', `${entry[config.entryName]}: ${entry.player}`);
      shape.addEventListener('click', () => selectAtlasEntry(shape, entry, config));
      shape.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectAtlasEntry(shape, entry, config);
        }
      });
      if (!defaultEntry) {
        defaultEntry = { shape, entry };
      }
    } else {
      shape.classList.add('state-shape--empty');
      shape.setAttribute('title', entry ? entry[config.entryName] ?? code : code ?? 'Unavailable');
      shape.addEventListener('click', () => selectAtlasEntry(shape, entry, config));
    }
  }
  updateAtlasCopy(config);
  if (defaultEntry) {
    selectAtlasEntry(defaultEntry.shape, defaultEntry.entry, config);
  } else {
    renderAtlasSpotlight(null, config);
  }
}

let activeShape = null;
let activeConfig = null;

function selectAtlasEntry(shape, entry, config) {
  if (activeShape && activeShape !== shape) {
    activeShape.classList.remove('state-shape--selected');
    activeShape.setAttribute('aria-pressed', 'false');
  }
  activeShape = shape;
  activeConfig = config;
  if (shape) {
    shape.classList.add('state-shape--selected');
    shape.setAttribute('aria-pressed', 'true');
  }
  renderAtlasSpotlight(entry, config);
}

function updateAtlasCopy(config) {
  if (selectors.atlasTitle) selectors.atlasTitle.textContent = config.title;
  if (selectors.atlasCaption) selectors.atlasCaption.textContent = config.caption;
  if (selectors.spotlightHeading) selectors.spotlightHeading.textContent = config.spotlightHeading;
  if (selectors.atlasToggle) {
    selectors.atlasToggle.textContent =
      config.id === 'domestic' ? 'Explore international mode' : 'Return to United States map';
  }
}

function renderAtlasSpotlight(entry, config) {
  if (!selectors.atlasSpotlight) return;
  selectors.atlasSpotlight.innerHTML = '';
  if (!entry) {
    selectors.atlasSpotlight.append(
      createElement('p', 'state-spotlight__placeholder', 'Select a tile to meet its headline legend.'),
    );
    return;
  }
  const heading = createElement('span', 'state-spotlight__state', entry[config.entryName] ?? entry[config.entryId] ?? '');
  selectors.atlasSpotlight.append(heading);
  if (entry.player) {
    selectors.atlasSpotlight.append(createElement('p', 'state-spotlight__player', entry.player));
  }
  if (entry.birthCity) {
    selectors.atlasSpotlight.append(createElement('p', 'state-spotlight__meta', `Born in ${entry.birthCity}`));
  }
  if (entry.headline) {
    selectors.atlasSpotlight.append(createElement('p', 'state-spotlight__headline', entry.headline));
  }
  if (Array.isArray(entry.notableTeams) && entry.notableTeams.length) {
    const list = createElement('ul', 'state-spotlight__teams');
    entry.notableTeams.slice(0, 4).forEach((team) => list.append(createElement('li', 'state-spotlight__team', team)));
    selectors.atlasSpotlight.append(list);
  }
  if (Array.isArray(entry.topPlayers) && entry.topPlayers.length) {
    const ranking = createElement('ol', 'state-spotlight__ranking');
    entry.topPlayers.slice(0, 10).forEach((player) => {
      const item = createElement('li', 'state-spotlight__ranking-item');
      item.append(createElement('span', 'state-spotlight__ranking-ordinal', `#${player.groupRank}`));
      const body = createElement('div', 'state-spotlight__ranking-body');
      body.append(createElement('p', 'state-spotlight__ranking-name', player.name ?? 'Unknown')); 
      const detailParts = [];
      if (Number.isFinite(player.goatScore)) {
        detailParts.push(`${decimalFormatter.format(player.goatScore)} GOAT`);
      }
      if (Number.isFinite(player.goatRank)) {
        detailParts.push(`Global rank #${numberFormatter.format(player.goatRank)}`);
      }
      if (Array.isArray(player.franchises) && player.franchises.length) {
        detailParts.push(player.franchises.join(', '));
      }
      if (detailParts.length) {
        body.append(createElement('p', 'state-spotlight__ranking-meta', detailParts.join(' • ')));
      }
      item.append(body);
      ranking.append(item);
    });
    selectors.atlasSpotlight.append(ranking);
  }
}

async function bootstrap() {
  try {
    const [playersMin, playersFullDocument, birthplacesDocument, goatDocument, worldLegends] = await Promise.all([
      loadJson(PLAYERS_MIN_URL),
      loadJson(PLAYERS_FULL_URL),
      loadJson(BIRTHPLACES_URL),
      loadJson(GOAT_URL),
      loadJson(WORLD_LEGENDS_URL).catch(() => null),
    ]);

    const playersFull = Array.isArray(playersFullDocument?.players) ? playersFullDocument.players : [];
    const playersMinList = Array.isArray(playersMin) ? playersMin : [];
    const birthplaces = birthplacesDocument?.players ?? {};
    const goatPlayers = Array.isArray(goatDocument?.players) ? goatDocument.players : [];
    const goatIndex = new Map();
    for (const entry of goatPlayers) {
      const nameKey = normalizeName(entry.name);
      if (!nameKey) continue;
      const list = goatIndex.get(nameKey) ?? [];
      list.push(entry);
      goatIndex.set(nameKey, list);
    }
    const goatReferences = buildGoatReferences(goatPlayers);
    const countryCodes = buildCountryCodeMap(worldLegends);
    const playersById = new Map(playersFull.map((player) => [player.id, player]));

    if (selectors.searchInput) {
      selectors.searchInput.addEventListener('input', (event) => {
        const term = event.target.value;
        renderSearchResults(playersMinList, term);
      });
      renderSearchResults(playersMinList, '');
    }

    if (selectors.searchResults) {
      selectors.searchResults.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-player-id]');
        if (!button) return;
        const playerId = Number(button.dataset.playerId);
        if (!Number.isFinite(playerId)) return;
        const player = playersById.get(playerId);
        if (!player) return;
        const nameKey = normalizeName(`${player.first_name} ${player.last_name}`);
        const birthplace = resolveBirthplace(nameKey, birthplaces);
        const totalsContainer = renderPlayerCard(player, birthplace);
        const goatEntry = selectGoatEntry(player, goatIndex);
        renderVisuals(goatEntry, goatReferences);
        if (!totalsContainer) return;
        totalsContainer.innerHTML = '';
        const apiKey = getApiKey();
        if (!apiKey) {
          totalsContainer.append(
            createElement(
              'p',
              'history-player__error',
              "Ball Don't Lie API credentials are not configured for this site. Reach out to the data team to restore access.",
            ),
          );
          return;
        }
        totalsContainer.append(
          createElement('p', 'history-player__hint', 'Fetching the career log with site credentials…'),
        );
        try {
          const career = await fetchCareerStats(player, apiKey);
          totalsContainer.innerHTML = '';
          totalsContainer.append(renderTotalsTable('Regular season', career.regular));
          totalsContainer.append(renderTotalsTable('Postseason', career.postseason));
        } catch (error) {
          console.error(error);
          totalsContainer.innerHTML = '';
          totalsContainer.append(
            createElement(
              'p',
              'history-player__error',
              'We hit a snag pulling the career stats. Try again in a moment.',
            ),
          );
        }
      });
    }

    const atlas = buildAtlas(playersFull, birthplaces, goatIndex, countryCodes);
    const svgCache = new Map();
    await renderAtlas('domestic', atlas.domestic, svgCache);
    if (selectors.atlasToggle) {
      selectors.atlasToggle.addEventListener('click', async () => {
        const nextMode = selectors.mapRoot?.dataset.atlasMode === 'domestic' ? 'international' : 'domestic';
        selectors.atlasToggle.disabled = true;
        try {
          await renderAtlas(nextMode, nextMode === 'domestic' ? atlas.domestic : atlas.international, svgCache);
        } catch (error) {
          console.error(error);
        } finally {
          selectors.atlasToggle.disabled = false;
        }
      });
    }
  } catch (error) {
    console.error('Failed to initialise history page', error);
  }
}

bootstrap();
