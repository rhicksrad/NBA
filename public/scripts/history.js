import { registerCharts, helpers } from './hub-charts.js';

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
};

const tileCoordinates = {
  AL: { col: 6, row: 5 },
  AK: { col: 1, row: 6 },
  AZ: { col: 1, row: 4 },
  AR: { col: 5, row: 4 },
  CA: { col: 1, row: 3 },
  CO: { col: 3, row: 4 },
  CT: { col: 11, row: 2 },
  DC: { col: 10, row: 4 },
  DE: { col: 10, row: 3 },
  FL: { col: 8, row: 5 },
  GA: { col: 9, row: 4 },
  HI: { col: 9, row: 6 },
  IA: { col: 4, row: 2 },
  ID: { col: 2, row: 2 },
  IL: { col: 5, row: 2 },
  IN: { col: 6, row: 2 },
  KS: { col: 4, row: 4 },
  KY: { col: 6, row: 3 },
  LA: { col: 4, row: 5 },
  MA: { col: 11, row: 3 },
  MD: { col: 9, row: 3 },
  ME: { col: 10, row: 1 },
  MI: { col: 6, row: 1 },
  MN: { col: 4, row: 1 },
  MO: { col: 5, row: 3 },
  MS: { col: 5, row: 5 },
  MT: { col: 2, row: 1 },
  NC: { col: 7, row: 4 },
  ND: { col: 3, row: 1 },
  NE: { col: 4, row: 3 },
  NH: { col: 9, row: 1 },
  NJ: { col: 10, row: 2 },
  NM: { col: 1, row: 5 },
  NV: { col: 2, row: 3 },
  NY: { col: 9, row: 2 },
  OH: { col: 7, row: 2 },
  OK: { col: 2, row: 5 },
  OR: { col: 1, row: 2 },
  PA: { col: 8, row: 2 },
  RI: { col: 12, row: 2 },
  SC: { col: 8, row: 4 },
  SD: { col: 3, row: 2 },
  TN: { col: 6, row: 4 },
  TX: { col: 3, row: 5 },
  UT: { col: 2, row: 4 },
  VA: { col: 8, row: 3 },
  VT: { col: 8, row: 1 },
  WA: { col: 1, row: 1 },
  WI: { col: 5, row: 1 },
  WV: { col: 7, row: 3 },
  WY: { col: 3, row: 3 },
};

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

function renderStateSpotlight(entry) {
  if (!atlasEls.spotlight) return;
  atlasEls.spotlight.innerHTML = '';

  if (!entry) {
    const placeholder = document.createElement('p');
    placeholder.className = 'state-spotlight__placeholder';
    placeholder.textContent = 'Select a state tile to meet its headline legend.';
    atlasEls.spotlight.append(placeholder);
    return;
  }

  const heading = document.createElement('span');
  heading.className = 'state-spotlight__state';
  heading.textContent = `${entry.stateName ?? entry.state ?? ''}`;

  const playerLine = document.createElement('p');
  if (entry.player) {
    playerLine.className = 'state-spotlight__player';
    playerLine.textContent = entry.player;
  } else {
    playerLine.className = 'state-spotlight__empty';
    playerLine.textContent = entry.headline || 'No NBA alumni recorded yet.';
  }

  atlasEls.spotlight.append(heading, playerLine);

  if (entry.birthCity) {
    const locale = document.createElement('p');
    locale.className = 'state-spotlight__meta';
    locale.textContent = `Born in ${entry.birthCity}`;
    atlasEls.spotlight.append(locale);
  }

  if (entry.headline && entry.player) {
    const headline = document.createElement('p');
    headline.className = 'state-spotlight__headline';
    headline.textContent = entry.headline;
    atlasEls.spotlight.append(headline);
  }

  if (Array.isArray(entry.notableTeams) && entry.notableTeams.length) {
    const list = document.createElement('ul');
    list.className = 'state-spotlight__teams';
    entry.notableTeams.forEach((team) => {
      const item = document.createElement('li');
      item.className = 'state-spotlight__team';
      item.textContent = team;
      list.append(item);
    });
    atlasEls.spotlight.append(list);
  }
}

function renderStateAtlas(atlas) {
  if (!atlasEls.map) return;
  const entries = Array.isArray(atlas?.states) ? atlas.states : [];
  atlasEls.map.innerHTML = '';

  let activeTile = null;
  let defaultSelection = null;

  entries.forEach((entry) => {
    const coords = tileCoordinates[entry.state];
    if (!coords) return;
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'state-tile';
    if (entry.player) {
      tile.setAttribute('aria-pressed', 'false');
    } else {
      tile.classList.add('state-tile--empty');
    }
    tile.textContent = entry.state;
    tile.style.gridColumn = coords.col;
    tile.style.gridRow = coords.row;
    tile.title = entry.player
      ? `${entry.player} — ${entry.headline ?? ''}`.trim()
      : `${entry.stateName ?? entry.state}: ${entry.headline ?? 'No NBA alumni yet'}`;

    if (entry.player) {
      tile.addEventListener('click', () => {
        if (activeTile === tile) return;
        if (activeTile) {
          activeTile.classList.remove('state-tile--selected');
          activeTile.setAttribute('aria-pressed', 'false');
        }
        activeTile = tile;
        tile.classList.add('state-tile--selected');
        tile.setAttribute('aria-pressed', 'true');
        renderStateSpotlight(entry);
      });
      if (!defaultSelection) {
        defaultSelection = { entry, tile };
      }
    } else {
      tile.addEventListener('click', () => {
        renderStateSpotlight(entry);
      });
    }

    atlasEls.map.append(tile);
  });

  if (defaultSelection) {
    defaultSelection.tile.classList.add('state-tile--selected');
    defaultSelection.tile.setAttribute('aria-pressed', 'true');
    renderStateSpotlight(defaultSelection.entry);
  } else if (atlasEls.spotlight) {
    renderStateSpotlight(null);
  }
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
      renderStateAtlas(atlas);
    } else if (atlasEls.spotlight) {
      renderStateSpotlight(null);
    }
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

renderStateSpotlight(null);
bootstrap();
