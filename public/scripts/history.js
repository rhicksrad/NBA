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
  attendanceRecord: document.querySelector('[data-history="attendance-record"]'),
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
    summaryEls.attendanceRecord.textContent = `${helpers.formatNumber(topAttendance.attendance, 0)} fans watched ${opponent} on ${recordDate}.`;
  }
}

function populateExpansionTimeline(franchises) {
  if (!summaryEls.expansionTimeline) return;
  summaryEls.expansionTimeline.innerHTML = '';
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
      summaryEls.expansionTimeline.append(item);

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
    const [history, franchises, audit] = await Promise.all([
      fetch('data/historic_games.json').then((response) => (response.ok ? response.json() : null)),
      fetch('data/active_franchises.json').then((response) => (response.ok ? response.json() : null)),
      fetch('data/historical_audit.json').then((response) => (response.ok ? response.json() : null)),
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
  } catch (error) {
    console.error('Failed to initialise history page', error);
  }
}

registerCharts([
  {
    element: document.querySelector('[data-chart="games-by-decade"]'),
    source: 'data/historic_games.json',
    async createConfig(data) {
      const series = Array.isArray(data?.gamesByDecade) ? data.gamesByDecade : [];
      if (!series.length) return null;
      const labels = series.map((item) => item.decade);
      const values = series.map((item) => item.games);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Games logged',
              data: values,
              borderColor: palette.royal,
              backgroundColor: palette.teal,
              borderWidth: 2,
              fill: true,
              tension: 0.3,
              pointRadius: 3,
            },
          ],
        },
        options: {
          layout: { padding: 8 },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.parsed.y.toLocaleString()} games`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => numberFormatter.format(value),
              },
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
]);

bootstrap();
