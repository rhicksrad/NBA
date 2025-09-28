import { registerCharts, helpers } from './hub-charts.js';
import { enablePanZoom, enhanceUsaInsets } from './map-utils.js';

const palette = {
  navy: '#0b2545',
  royal: '#1156d6',
  sky: '#1f7bff',
  gold: '#f4b53f',
  crimson: '#ef3d5b',
  teal: 'rgba(17, 86, 214, 0.16)',
};

const numberFormatter = new Intl.NumberFormat('en-US');
const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const scoreFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const summaryEls = {
  totalGames: document.querySelector('[data-history="total-games"]'),
  firstGame: document.querySelectorAll('[data-history="first-game"]'),
  latestGame: document.querySelectorAll('[data-history="latest-game"]'),
  playoffGames: document.querySelector('[data-history="playoff-games"]'),
  playoffShare: document.querySelector('[data-history="playoff-share"]'),
  attendanceRecord: document.querySelectorAll('[data-history="attendance-record"]'),
  franchiseCount: document.querySelector('[data-history="franchise-count"]'),
  peakExpansionDecade: document.querySelector('[data-history="peak-expansion-decade"]'),
  peakExpansionTotal: document.querySelector('[data-history="peak-expansion-total"]'),
  expansionTimeline: document.querySelector('[data-history="expansion-timeline"]'),
  recordGames: document.querySelector('[data-history="record-games"]'),
  attendanceBody: document.querySelector('[data-history="attendance-body"]'),
  archiveUpdated: document.querySelector('[data-history="archive-updated"]'),
  seasonRange: document.querySelector('[data-history="season-range"]'),
  seasonCount: document.querySelector('[data-history="season-count"]'),
};

const atlasEls = {
  map: document.querySelector('[data-state-map-tiles]'),
  spotlight: document.querySelector('[data-state-spotlight]'),
  title: document.querySelector('[data-atlas-title]'),
  caption: document.querySelector('[data-atlas-caption]'),
  modeToggle: document.querySelector('[data-atlas-toggle]'),
};

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

const mapMarkupCache = new Map();
let activeAtlasShape = null;
let activeAtlasConfig = null;
let currentAtlasMode = 'domestic';
const atlasData = { domestic: null, international: null };

const atlasModes = {
  domestic: {
    id: 'domestic',
    mapAsset: 'vendor/us-states.svg',
    sanitizeMarkup(markup) {
      return markup.replace(/ns0:/g, '');
    },
    svgClasses: ['state-map__svg--usa'],
    title: 'Best NBA star born in each state',
    caption: 'Select a tile to spotlight the most decorated NBA player born in that state.',
    placeholder: 'Select a state tile to meet its headline legend.',
    emptyHeadline: 'No NBA alumni recorded yet.',
    datasetKey: 'states',
    entryId: 'state',
    entryName: 'stateName',
    shapeAttribute: 'data-state',
    source: 'data/state_birth_legends.json',
    switchLabel: 'Explore international mode',
    switchAriaLabel: 'Switch to international legends view',
    getName(id) {
      return stateNames[id] || id;
    },
  },
  international: {
    id: 'international',
    mapAsset: 'vendor/world-countries.svg',
    svgClasses: ['state-map__svg--world'],
    title: 'Best NBA star born in each country',
    caption: 'Select a country outline to spotlight the standout NBA player born there.',
    placeholder: 'Choose a country to spotlight its standout NBA star.',
    emptyHeadline: 'No NBA alumni recorded yet.',
    datasetKey: 'countries',
    entryId: 'country',
    entryName: 'countryName',
    shapeAttribute: 'data-country',
    source: 'data/world_birth_legends.json',
    switchLabel: 'Return to United States map',
    switchAriaLabel: 'Return to the United States legends map',
    getName(id, _entry, shape) {
      return (shape?.dataset?.name ?? '').trim() || id;
    },
  },
};

function getAtlasConfig(mode) {
  return atlasModes[mode] ?? atlasModes.domestic;
}

async function loadAtlasSvg(config) {
  const cacheKey = config.mapAsset;
  if (!mapMarkupCache.has(cacheKey)) {
    const response = await fetch(config.mapAsset);
    if (!response.ok) {
      throw new Error(`Failed to load ${config.id} atlas map`);
    }
    let markup = await response.text();
    if (typeof config.sanitizeMarkup === 'function') {
      markup = config.sanitizeMarkup(markup);
    }
    mapMarkupCache.set(cacheKey, markup);
  }
  const template = document.createElement('template');
  template.innerHTML = mapMarkupCache.get(cacheKey).trim();
  const svg = template.content.firstElementChild;
  if (svg) {
    svg.classList.add('state-map__svg');
    if (Array.isArray(config.svgClasses)) {
      config.svgClasses.forEach((className) => svg.classList.add(className));
    }
    svg.setAttribute('focusable', 'false');
  }
  return svg;
}

function selectAtlasShape(shape, entry, config = activeAtlasConfig) {
  if (activeAtlasShape && activeAtlasShape !== shape) {
    activeAtlasShape.classList.remove('state-shape--selected');
    activeAtlasShape.setAttribute('aria-pressed', 'false');
  }
  activeAtlasShape = shape || null;
  if (shape) {
    shape.classList.add('state-shape--selected');
    shape.setAttribute('aria-pressed', 'true');
  }
  renderAtlasSpotlight(entry || null, config);
}

function parseDate(value) {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(`${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return '—';
  return dateFormatter.format(date);
}

function setText(target, text) {
  if (!target) return;
  if (NodeList.prototype.isPrototypeOf(target) || Array.isArray(target)) {
    target.forEach((node) => {
      if (node) {
        node.textContent = text;
      }
    });
    return;
  }
  target.textContent = text;
}

function renderAtlasSpotlight(entry, config = activeAtlasConfig) {
  if (!atlasEls.spotlight) return;
  const modeConfig = config || getAtlasConfig(currentAtlasMode);
  atlasEls.spotlight.innerHTML = '';

  if (!entry) {
    const placeholder = document.createElement('p');
    placeholder.className = 'state-spotlight__placeholder';
    placeholder.textContent = modeConfig.placeholder;
    atlasEls.spotlight.append(placeholder);
    return;
  }

  const heading = document.createElement('span');
  heading.className = 'state-spotlight__state';
  heading.textContent = `${entry[modeConfig.entryName] ?? entry[modeConfig.entryId] ?? ''}`;

  const topPlayers = Array.isArray(entry.topPlayers) ? entry.topPlayers.filter((player) => player && player.name) : [];
  const spotlightPlayer = topPlayers[0];

  const playerLine = document.createElement('p');
  if (spotlightPlayer?.name || entry.player) {
    playerLine.className = 'state-spotlight__player';
    playerLine.textContent = spotlightPlayer?.name || entry.player;
  } else {
    playerLine.className = 'state-spotlight__empty';
    playerLine.textContent = entry.headline || modeConfig.emptyHeadline;
  }

  atlasEls.spotlight.append(heading, playerLine);

  const formatLocation = (player) => {
    if (!player) return '';
    const city = player.birthCity || '';
    const state = player.birthState || '';
    const country = player.birthCountry || '';
    if (modeConfig.id === 'domestic') {
      if (city && state) return `${city}, ${state}`;
      if (city) return city;
      if (state) return state;
      return '';
    }
    if (city && country) return `${city}, ${country}`;
    return country || city;
  };

  const spotlightLocation = formatLocation(spotlightPlayer) || entry.birthCity;
  if (spotlightLocation) {
    const locale = document.createElement('p');
    locale.className = 'state-spotlight__meta';
    locale.textContent = `Born in ${spotlightLocation}`;
    atlasEls.spotlight.append(locale);
  }

  const spotlightHeadline = spotlightPlayer?.resume || entry.headline;
  if (spotlightHeadline && (spotlightPlayer?.name || entry.player)) {
    const headline = document.createElement('p');
    headline.className = 'state-spotlight__headline';
    headline.textContent = spotlightHeadline;
    atlasEls.spotlight.append(headline);
  }

  const spotlightTeams = spotlightPlayer?.franchises || entry.notableTeams;
  if (Array.isArray(spotlightTeams) && spotlightTeams.length) {
    const list = document.createElement('ul');
    list.className = 'state-spotlight__teams';
    spotlightTeams.forEach((team) => {
      if (!team) return;
      const item = document.createElement('li');
      item.className = 'state-spotlight__team';
      item.textContent = team;
      list.append(item);
    });
    if (list.children.length) {
      atlasEls.spotlight.append(list);
    }
  }

  if (topPlayers.length) {
    const ranking = document.createElement('ol');
    ranking.className = 'state-spotlight__ranking';
    topPlayers.slice(0, 10).forEach((player, index) => {
      const item = document.createElement('li');
      item.className = 'state-spotlight__ranking-item';

      const ordinal = document.createElement('span');
      ordinal.className = 'state-spotlight__ranking-ordinal';
      ordinal.textContent = `#${index + 1}`;

      const body = document.createElement('div');
      body.className = 'state-spotlight__ranking-body';

      const nameLine = document.createElement('p');
      nameLine.className = 'state-spotlight__ranking-name';
      nameLine.textContent = player.name || 'Unnamed legend';
      body.append(nameLine);

      const detailParts = [];
      if (typeof player.groupRank === 'number') {
        const scopeLabel = modeConfig.id === 'domestic' ? 'State' : 'Country';
        detailParts.push(`${scopeLabel} rank #${player.groupRank}`);
      }
      if (typeof player.rank === 'number') {
        detailParts.push(`Global GOAT No. ${player.rank}`);
      }
      if (typeof player.goatScore === 'number') {
        detailParts.push(`${scoreFormatter.format(player.goatScore)} GOAT points`);
      }
      const birthplace = formatLocation(player);
      if (birthplace) {
        detailParts.push(`Born in ${birthplace}`);
      }
      if (detailParts.length) {
        const detailLine = document.createElement('p');
        detailLine.className = 'state-spotlight__ranking-meta';
        detailLine.textContent = detailParts.join(' • ');
        body.append(detailLine);
      }

      if (Array.isArray(player.franchises) && player.franchises.length) {
        const teamList = document.createElement('ul');
        teamList.className = 'state-spotlight__teams state-spotlight__teams--compact';
        player.franchises.slice(0, 4).forEach((team) => {
          if (!team) return;
          const teamItem = document.createElement('li');
          teamItem.className = 'state-spotlight__team';
          teamItem.textContent = team;
          teamList.append(teamItem);
        });
        if (teamList.children.length) {
          body.append(teamList);
        }
      }

      if (player.resume && index < 3) {
        const resume = document.createElement('p');
        resume.className = 'state-spotlight__ranking-resume';
        resume.textContent = player.resume;
        body.append(resume);
      }

      item.append(ordinal, body);
      ranking.append(item);
    });
    atlasEls.spotlight.append(ranking);
  }
}

function setAtlasCopy(config) {
  if (atlasEls.title) {
    atlasEls.title.textContent = config.title;
  }
  if (atlasEls.caption) {
    atlasEls.caption.textContent = config.caption;
  }
  if (atlasEls.modeToggle) {
    atlasEls.modeToggle.textContent = config.switchLabel;
    atlasEls.modeToggle.setAttribute('aria-label', config.switchAriaLabel || config.switchLabel);
  }
}

async function renderAtlas(mode, atlas) {
  if (!atlasEls.map) return;
  const config = getAtlasConfig(mode);
  const entries = Array.isArray(atlas?.[config.datasetKey]) ? atlas[config.datasetKey] : [];
  const entryById = new Map(entries.map((entry) => [entry[config.entryId], entry]));

  let svg;
  try {
    svg = await loadAtlasSvg(config);
  } catch (error) {
    console.error(error);
    atlasEls.map.innerHTML = '';
    activeAtlasConfig = config;
    renderAtlasSpotlight(null, config);
    return;
  }

  if (!svg) {
    atlasEls.map.innerHTML = '';
    activeAtlasConfig = config;
    renderAtlasSpotlight(null, config);
    return;
  }

  atlasEls.map.innerHTML = '';
  atlasEls.map.append(svg);
  atlasEls.map.dataset.atlasMode = mode;

  if (mode === 'domestic') {
    enhanceUsaInsets(svg);
  }

  enablePanZoom(atlasEls.map, svg, {
    maxScale: mode === 'domestic' ? 6 : 5,
    minScale: 1,
    zoomStep: 0.35,
  });

  activeAtlasShape = null;
  activeAtlasConfig = config;
  let defaultSelection = null;

  const shapes = svg.querySelectorAll(`[${config.shapeAttribute}]`);
  shapes.forEach((shape) => {
    const code = shape.getAttribute(config.shapeAttribute);
    if (!code) return;
    const entry = entryById.get(code) || null;
    const locationLabel = entry?.[config.entryName] || config.getName(code, entry, shape) || code;

    shape.removeAttribute('tabindex');
    shape.removeAttribute('role');
    shape.removeAttribute('aria-pressed');
    shape.classList.remove('state-shape--available', 'state-shape--selected', 'state-shape--empty');

    const fallbackHeadline = entry?.headline || config.emptyHeadline;

    if (entry && entry.player) {
      shape.classList.add('state-shape--available');
      shape.setAttribute('role', 'button');
      shape.setAttribute('tabindex', '0');
      shape.setAttribute('aria-pressed', 'false');
      const detail = entry.headline ? ` — ${entry.headline}` : '';
      shape.setAttribute('aria-label', `${locationLabel}: ${entry.player}${detail}`);
      shape.setAttribute('title', `${entry.player}${detail}`);

      const activate = () => {
        if (activeAtlasShape === shape) return;
        selectAtlasShape(shape, entry, config);
      };

      shape.addEventListener('click', activate);
      shape.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });

      if (!defaultSelection) {
        defaultSelection = { entry, shape };
      }
    } else {
      shape.classList.add('state-shape--empty');
      shape.setAttribute('role', 'button');
      shape.setAttribute('tabindex', '0');
      shape.setAttribute('aria-pressed', 'false');
      shape.setAttribute('aria-label', `${locationLabel}: ${fallbackHeadline}`);
      if (entry?.headline) {
        shape.setAttribute('title', entry.headline);
      } else if (entry) {
        shape.setAttribute('title', locationLabel);
      } else {
        shape.removeAttribute('title');
      }
      shape.addEventListener('click', () => {
        selectAtlasShape(shape, entry, config);
      });
      shape.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectAtlasShape(shape, entry, config);
        }
      });
    }
  });

  setAtlasCopy(config);

  if (defaultSelection) {
    selectAtlasShape(defaultSelection.shape, defaultSelection.entry, config);
  } else {
    selectAtlasShape(null, null, config);
  }
}

async function ensureAtlasData(mode) {
  const config = getAtlasConfig(mode);
  const cacheKey = config.id;
  if (atlasData[cacheKey]) {
    return atlasData[cacheKey];
  }
  if (!config.source && !config.datasetKey) {
    return null;
  }
  if (!config.source) {
    // fall back to already provided data (e.g., bootstrap payload)
    return null;
  }
  const response = await fetch(config.source);
  if (!response.ok) {
    throw new Error(`Failed to load ${config.id} legends dataset`);
  }
  const payload = await response.json();
  atlasData[cacheKey] = payload;
  return payload;
}

async function activateAtlas(mode) {
  currentAtlasMode = getAtlasConfig(mode).id;
  let dataset = atlasData[currentAtlasMode] || null;
  if (!dataset) {
    try {
      dataset = await ensureAtlasData(currentAtlasMode);
    } catch (error) {
      console.error(error);
    }
  }
  await renderAtlas(currentAtlasMode, dataset);
}

function setupAtlasToggle() {
  if (!atlasEls.modeToggle) return;
  atlasEls.modeToggle.addEventListener('click', async () => {
    const nextMode = currentAtlasMode === 'domestic' ? 'international' : 'domestic';
    atlasEls.modeToggle.disabled = true;
    try {
      await activateAtlas(nextMode);
    } finally {
      atlasEls.modeToggle.disabled = false;
    }
  });
}

function formatTeamName(team) {
  if (!team) return '';
  const parts = [team.city, team.name].filter(Boolean);
  return parts.join(' ');
}

function formatMatchup(game) {
  if (!game) return '';
  const away = formatTeamName(game.away);
  const home = formatTeamName(game.home);
  return `${away} at ${home}`;
}

function updateEraSummary(history) {
  if (!history?.totals) return;
  const { totals } = history;
  const totalGames = totals.games ?? 0;
  setText(summaryEls.totalGames, helpers.formatNumber(totalGames, 0));
  const first = formatDate(totals.firstGame);
  const latest = formatDate(totals.latestGame);
  setText(summaryEls.firstGame, first);
  setText(summaryEls.latestGame, latest);

  const playoffEntry = Array.isArray(totals.byType)
    ? totals.byType.find((item) => item.gameType === 'Playoffs')
    : null;
  const playoffGames = playoffEntry?.games ?? 0;
  setText(summaryEls.playoffGames, helpers.formatNumber(playoffGames, 0));
  const share = totalGames ? playoffGames / totalGames : 0;
  setText(summaryEls.playoffShare, percentFormatter.format(share));

  const topAttendance = Array.isArray(history.attendanceLeaders)
    ? [...history.attendanceLeaders].sort((a, b) => b.attendance - a.attendance)[0]
    : null;
  if (topAttendance && summaryEls.attendanceRecord) {
    const opponent = formatMatchup(topAttendance);
    const recordDate = formatDate(topAttendance.date);
    setText(
      summaryEls.attendanceRecord,
      `${helpers.formatNumber(topAttendance.attendance, 0)} fans watched ${opponent} on ${recordDate}.`,
    );
  }
}

function populateExpansionTimeline(franchises) {
  const timelineRoot = summaryEls.expansionTimeline;
  if (timelineRoot) {
    timelineRoot.innerHTML = '';
  }
  const decadeEntries = Array.isArray(franchises?.decades) ? franchises.decades : [];
  const teams = Array.isArray(franchises?.activeFranchises) ? franchises.activeFranchises : [];

  const activeTeams = teams.filter((team) => team && team.isActive && String(team.teamId).length === 10);
  if (summaryEls.franchiseCount) {
    setText(summaryEls.franchiseCount, helpers.formatNumber(activeTeams.length, 0));
  }

  let peakDecade = null;
  let peakTotal = 0;

  decadeEntries
    .slice()
    .sort((a, b) => a.decade - b.decade)
    .forEach((entry) => {
      const additions = activeTeams
        .filter((team) => Math.floor(team.seasonFounded / 10) * 10 === entry.decade)
        .sort((a, b) => a.seasonFounded - b.seasonFounded);
      const sampleNames = additions.slice(0, 3).map((team) => team.name);
      if (timelineRoot) {
        const item = document.createElement('li');
        item.className = 'timeline__item';

        const header = document.createElement('div');
        header.className = 'timeline__header';
        const year = document.createElement('span');
        year.className = 'timeline__year';
        year.textContent = `${entry.decade}s`;
        const count = document.createElement('span');
        count.className = 'timeline__count';
        count.textContent = `${entry.total} additions`;
        header.append(year, count);

        const detail = document.createElement('p');
        detail.className = 'timeline__detail';
        detail.textContent = sampleNames.length
          ? `Key arrivals: ${sampleNames.join(', ')}${additions.length > sampleNames.length ? '…' : ''}`
          : 'Active rosters stabilized this decade.';

        item.append(header, detail);
        timelineRoot.append(item);
      }

      if (entry.total > peakTotal) {
        peakTotal = entry.total;
        peakDecade = `${entry.decade}s`;
      }
    });

  if (peakDecade && summaryEls.peakExpansionDecade) {
    setText(summaryEls.peakExpansionDecade, peakDecade);
  }
  if (summaryEls.peakExpansionTotal) {
    setText(summaryEls.peakExpansionTotal, helpers.formatNumber(peakTotal, 0));
  }
}

function populateRecordGames(history) {
  if (!summaryEls.recordGames) return;
  summaryEls.recordGames.innerHTML = '';
  const records = Array.isArray(history?.highestScoringGames) ? history.highestScoringGames : [];
  records
    .slice()
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 4)
    .forEach((game) => {
      const item = document.createElement('li');
      item.className = 'record-item';
      const title = document.createElement('strong');
      title.className = 'record-item__title';
      const awayName = formatTeamName(game.away);
      const homeName = formatTeamName(game.home);
      title.textContent = `${awayName} ${game.away?.score ?? ''} @ ${homeName} ${game.home?.score ?? ''}`.trim();
      const meta = document.createElement('span');
      meta.className = 'record-item__meta';
      meta.textContent = `${game.gameType} • ${formatDate(game.date)} • ${helpers.formatNumber(game.totalPoints, 0)} total points`;
      item.append(title, meta);
      summaryEls.recordGames.append(item);
    });
}

function populateAttendanceTable(history) {
  if (!summaryEls.attendanceBody) return;
  summaryEls.attendanceBody.innerHTML = '';
  const rows = Array.isArray(history?.attendanceLeaders) ? history.attendanceLeaders : [];
  rows
    .slice()
    .sort((a, b) => b.attendance - a.attendance)
    .slice(0, 5)
    .forEach((game) => {
      const tr = document.createElement('tr');
      const dateCell = document.createElement('td');
      dateCell.textContent = formatDate(game.date);
      const matchupCell = document.createElement('td');
      matchupCell.textContent = formatMatchup(game);
      const attendanceCell = document.createElement('td');
      attendanceCell.className = 'history-table__numeric';
      attendanceCell.textContent = numberFormatter.format(game.attendance);
      tr.append(dateCell, matchupCell, attendanceCell);
      summaryEls.attendanceBody.append(tr);
    });
}

function updateArchiveFacts(history, audit) {
  if (summaryEls.archiveUpdated) {
    setText(summaryEls.archiveUpdated, formatDate(history?.generatedAt));
  }
  const seasons = Array.isArray(audit?.games?.seasonBreakdown) ? audit.games.seasonBreakdown : [];
  if (seasons.length && summaryEls.seasonRange) {
    const firstSeason = seasons[0][0];
    const lastSeason = seasons[seasons.length - 1][0];
    setText(summaryEls.seasonRange, `${firstSeason} – ${lastSeason}`);
    if (summaryEls.seasonCount) {
      setText(summaryEls.seasonCount, helpers.formatNumber(seasons.length, 0));
    }
  }
}

async function bootstrap() {
  try {
    const [history, franchises, audit, atlas] = await Promise.all([
      fetch('data/historic_games.json').then((response) => (response.ok ? response.json() : null)),
      fetch('data/active_franchises.json').then((response) => (response.ok ? response.json() : null)),
      fetch('data/historical_audit.json').then((response) => (response.ok ? response.json() : null)),
      fetch('data/state_birth_legends.json').then((response) => (response.ok ? response.json() : null)),
    ]);

    if (history) {
      updateEraSummary(history);
      populateRecordGames(history);
      populateAttendanceTable(history);
    }

    if (franchises) {
      populateExpansionTimeline(franchises);
    }

    if (history && audit) {
      updateArchiveFacts(history, audit);
    }

    if (atlas) {
      atlasData.domestic = atlas;
    }

    await renderAtlas('domestic', atlasData.domestic);
  } catch (error) {
    console.error('Failed to initialise history page', error);
  }
}

registerCharts([
  {
    element: document.querySelector('[data-chart="scoring-averages"]'),
    source: 'data/history_scoring_trends.json',
    async createConfig(data, helpers) {
      const seasons = Array.isArray(data?.seasons) ? data.seasons : [];
      if (!seasons.length) return null;
      const labels = seasons.map((season) => `${season.season}-${String(season.season + 1).slice(-2)}`);
      const regular = seasons.map((season) => season.regularSeasonAverage ?? null);
      const playoffs = seasons.map((season) => season.playoffAverage ?? null);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Regular season',
              data: regular,
              borderColor: palette.royal,
              backgroundColor: palette.teal,
              borderWidth: 2,
              fill: true,
              pointRadius: 0,
              tension: 0.25,
            },
            {
              label: 'Playoffs',
              data: playoffs,
              borderColor: palette.gold,
              backgroundColor: 'rgba(244, 181, 63, 0.18)',
              borderWidth: 2,
              fill: false,
              pointRadius: 0,
              tension: 0.25,
            },
          ],
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          layout: { padding: 8 },
          plugins: {
            legend: { position: 'top', align: 'start' },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.dataset.label}: ${helpers.formatNumber(context.parsed.y, 1)} points`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(11, 37, 69, 0.06)' },
              ticks: { maxTicksLimit: 10 },
            },
            y: {
              beginAtZero: false,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => `${helpers.formatNumber(value, 0)} pts`,
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="scoring-leaders"]'),
    source: 'data/history_scoring_trends.json',
    async createConfig(data, helpers) {
      const seasons = Array.isArray(data?.seasons) ? data.seasons : [];
      if (!seasons.length) return null;
      const ranked = seasons
        .filter((season) => typeof season.averagePoints === 'number')
        .sort((a, b) => b.averagePoints - a.averagePoints)
        .slice(0, 8);
      if (!ranked.length) return null;

      const labels = ranked.map((season) => `${season.season}-${String(season.season + 1).slice(-2)}`);
      const totals = ranked.map((season) => season.averagePoints);

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Avg combined points per game',
              data: totals,
              backgroundColor: palette.sky,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          layout: { padding: { top: 8, right: 12, bottom: 8, left: 12 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${helpers.formatNumber(context.parsed.x, 2)} points per game`;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => `${helpers.formatNumber(value, 0)} pts`,
              },
            },
            y: {
              grid: { display: false },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="game-type-share"]'),
    source: 'data/historic_games.json',
    async createConfig(data) {
      const breakdown = Array.isArray(data?.totals?.byType) ? data.totals.byType.filter((entry) => entry.games > 0) : [];
      if (!breakdown.length) return null;
      const labels = breakdown.map((item) => item.gameType);
      const values = breakdown.map((item) => item.games);
      const colors = [palette.royal, palette.crimson, palette.gold, palette.sky, '#6f8bc5', '#4fb9c4'];
      const total = values.reduce((acc, value) => acc + value, 0);

      return {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: colors.slice(0, values.length),
              borderWidth: 0,
            },
          ],
        },
        options: {
          layout: { padding: 8 },
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = context.parsed;
                  const share = total ? value / total : 0;
                  return `${context.label}: ${numberFormatter.format(value)} games (${percentFormatter.format(share)})`;
                },
              },
            },
          },
          cutout: '60%',
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="largest-margins"]'),
    source: 'data/historic_games.json',
    async createConfig(data) {
      const rows = Array.isArray(data?.largestMargins) ? data.largestMargins : [];
      if (!rows.length) return null;
      const topRows = helpers.rankAndSlice(rows, 6, (item) => item.margin).sort((a, b) => b.margin - a.margin);
      const labels = topRows.map((game) => {
        const date = formatDate(game.date);
        return `${formatTeamName(game.home)} vs ${formatTeamName(game.away)} (${date.split(', ')[1] ?? date})`;
      });
      const margins = topRows.map((game) => game.margin);

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Margin of victory',
              data: margins,
              backgroundColor: palette.crimson,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          layout: { padding: { top: 8, right: 12, bottom: 8, left: 12 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const game = topRows[context.dataIndex];
                  const totalPoints = helpers.formatNumber(game.totalPoints, 0);
                  return `${context.parsed.x} point win • ${totalPoints} total points`;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              suggestedMax: Math.max(...margins) + 5,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => `${value} pts`,
              },
            },
            y: {
              grid: { display: false },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="scoring-bursts"]'),
    source: 'data/historic_games.json',
    async createConfig(data, helpers) {
      const games = Array.isArray(data?.highestScoringGames) ? data.highestScoringGames : [];
      if (!games.length) return null;
      const ranked = helpers
        .rankAndSlice(games, 10, (game) => game.totalPoints)
        .sort((a, b) => {
          const da = parseDate(a.date)?.getTime() ?? 0;
          const db = parseDate(b.date)?.getTime() ?? 0;
          return da - db;
        });

      const dataset = ranked.map((game) => {
        const date = parseDate(game.date);
        const yearValue = date ? date.getUTCFullYear() + date.getUTCMonth() / 12 : 0;
        const attendance = Number(game.attendance) || 0;
        return {
          x: yearValue,
          y: game.totalPoints,
          r: Math.max(8, Math.sqrt(attendance) / 35),
          meta: game,
        };
      });

      return {
        type: 'bubble',
        data: {
          datasets: [
            {
              label: 'Scoring eruptions',
              data: dataset,
              backgroundColor: 'rgba(239, 61, 91, 0.4)',
              borderColor: palette.crimson,
              borderWidth: 1.5,
            },
          ],
        },
        options: {
          layout: { padding: { top: 8, right: 16, bottom: 8, left: 12 } },
          scales: {
            x: {
              type: 'linear',
              beginAtZero: false,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => Math.round(value),
              },
              title: {
                display: true,
                text: 'Year',
              },
            },
            y: {
              beginAtZero: false,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              title: {
                display: true,
                text: 'Total points',
              },
              ticks: {
                callback: (value) => helpers.formatNumber(value, 0),
              },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                title(context) {
                  const meta = context[0]?.raw?.meta;
                  return meta ? formatDate(meta.date) : '';
                },
                label(context) {
                  const meta = context.raw?.meta;
                  if (!meta) return '';
                  const matchup = formatMatchup(meta);
                  const attendance = meta.attendance ? ` • ${helpers.formatNumber(meta.attendance, 0)} fans` : '';
                  return `${matchup}: ${helpers.formatNumber(meta.totalPoints, 0)} points${attendance}`;
                },
              },
            },
            legend: { display: false },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="margin-vs-total"]'),
    source: 'data/historic_games.json',
    async createConfig(data, helpers) {
      const games = Array.isArray(data?.largestMargins) ? data.largestMargins : [];
      if (!games.length) return null;
      const ranked = helpers.rankAndSlice(games, 10, (game) => game.margin);
      const dataset = ranked.map((game) => {
        const attendance = Number(game.attendance) || 0;
        return {
          x: game.margin,
          y: game.totalPoints,
          r: Math.max(7, Math.sqrt(attendance) / 40),
          meta: game,
        };
      });

      return {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Margin & scoring blend',
              data: dataset,
              backgroundColor: 'rgba(17, 86, 214, 0.3)',
              borderColor: palette.royal,
              borderWidth: 1.2,
            },
          ],
        },
        options: {
          layout: { padding: { top: 8, right: 14, bottom: 8, left: 12 } },
          scales: {
            x: {
              title: { display: true, text: 'Margin of victory' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => `${value} pts`,
              },
            },
            y: {
              title: { display: true, text: 'Total points' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => helpers.formatNumber(value, 0),
              },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const meta = context.raw?.meta;
                  if (!meta) return '';
                  const matchup = formatMatchup(meta);
                  const date = formatDate(meta.date);
                  return `${matchup} • ${helpers.formatNumber(meta.margin, 0)}-point margin • ${helpers.formatNumber(meta.totalPoints, 0)} total points (${date})`;
                },
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="attendance-orbit"]'),
    source: 'data/historic_games.json',
    async createConfig(data, helpers) {
      const rows = Array.isArray(data?.attendanceLeaders) ? data.attendanceLeaders : [];
      if (!rows.length) return null;
      const ranked = helpers.rankAndSlice(rows, 7, (game) => game.attendance).sort((a, b) => b.attendance - a.attendance);
      const labels = ranked.map((game) => `${formatDate(game.date)} • ${formatMatchup(game)}`);
      const values = ranked.map((game) => game.attendance ?? 0);
      const colors = values.map((_, index) => {
        if (index === 0) {
          return palette.gold;
        }
        const alpha = Math.max(0.32, 0.7 - index * 0.07);
        return `rgba(17, 86, 214, ${alpha})`;
      });

      return {
        type: 'polarArea',
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: colors,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.6)',
            },
          ],
        },
        options: {
          layout: { padding: 8 },
          scales: {
            r: {
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => helpers.formatNumber(value, 0),
              },
            },
          },
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed, 0)} fans`;
                },
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="record-sparkline"]'),
    source: 'data/historic_games.json',
    async createConfig(data, helpers) {
      const games = Array.isArray(data?.highestScoringGames) ? data.highestScoringGames : [];
      if (!games.length) return null;
      const ranked = helpers.rankAndSlice(games, 8, (game) => game.totalPoints).sort((a, b) => b.totalPoints - a.totalPoints);
      const labels = ranked.map((game) => formatDate(game.date));
      const values = ranked.map((game) => game.totalPoints);
      const metadata = ranked.map((game) => ({
        matchup: formatMatchup(game),
        total: game.totalPoints,
        margin: game.margin,
      }));

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Combined points',
              data: values,
              backgroundColor(context) {
                const index = context.dataIndex;
                const base = 0.85 - index * 0.06;
                return `rgba(239, 61, 91, ${Math.max(base, 0.35)})`;
              },
              meta: metadata,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          layout: { padding: { top: 8, right: 16, bottom: 8, left: 12 } },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => helpers.formatNumber(value, 0),
              },
            },
            y: {
              grid: { display: false },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const meta = context.dataset.meta?.[context.dataIndex];
                  if (!meta) return '';
                  const margin = meta.margin ? ` • decided by ${helpers.formatNumber(meta.margin, 0)} points` : '';
                  return `${meta.matchup}: ${helpers.formatNumber(meta.total, 0)} total points${margin}`;
                },
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="archive-coverage"]'),
    source: 'data/historical_audit.json',
    async createConfig(data, helpers) {
      const seasons = Array.isArray(data?.games?.seasonBreakdown) ? data.games.seasonBreakdown : [];
      if (!seasons.length) return null;
      const parseSeason = (season) => {
        const year = Number.parseInt(String(season).split('-')[0], 10);
        return Number.isFinite(year) ? year : null;
      };
      const firstSeasonYear = parseSeason(seasons[0][0]);
      const lastSeasonYear = parseSeason(seasons[seasons.length - 1][0]);
      const coverageSpan =
        Number.isFinite(firstSeasonYear) && Number.isFinite(lastSeasonYear)
          ? lastSeasonYear - firstSeasonYear + 1
          : seasons.length;
      const seasonsTracked = seasons.length;
      const coverageGap = Math.max(coverageSpan - seasonsTracked, 0);
      const totalRows = Number(data?.games?.rowCount) || 0;
      const invalidRows = Number(data?.games?.invalidDateCount) || 0;
      const validRows = Math.max(totalRows - invalidRows, 0);

      const coverageLabels = ['Tracked seasons', 'Estimated gap'];
      const validityLabels = ['Validated rows', 'Flagged rows'];

      return {
        type: 'doughnut',
        data: {
          labels: coverageLabels,
          datasets: [
            {
              label: 'Season coverage',
              data: [seasonsTracked, coverageGap],
              backgroundColor: [palette.royal, 'rgba(11, 37, 69, 0.12)'],
              borderWidth: 0,
              weight: 0.8,
            },
            {
              label: 'Row validity',
              data: [validRows, invalidRows],
              backgroundColor: ['rgba(244, 181, 63, 0.8)', 'rgba(239, 61, 91, 0.65)'],
              borderWidth: 0,
              weight: 0.5,
            },
          ],
        },
        options: {
          layout: { padding: 8 },
          cutout: '58%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                usePointStyle: true,
              },
            },
            tooltip: {
              callbacks: {
                label(context) {
                  const datasetLabel = context.dataset.label;
                  const labels = datasetLabel === 'Season coverage' ? coverageLabels : validityLabels;
                  const label = labels[context.dataIndex] ?? datasetLabel;
                  return `${label}: ${helpers.formatNumber(context.parsed, 0)}`;
                },
              },
            },
          },
        },
      };
    },
  },
]);

setupAtlasToggle();
bootstrap();
