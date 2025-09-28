import { registerCharts, helpers } from './hub-charts.js';

const palette = {
  royal: '#1156d6',
  red: '#ef3d5b',
  teal: 'rgba(17, 86, 214, 0.2)',
  gold: '#f4b53f',
  midnight: '#0b2545',
  sand: '#f5e6c8',
};

registerCharts([
  {
    element: document.querySelector('[data-chart="win-leaders"]'),
    source: 'data/team_performance.json',
    async createConfig(data) {
      const leaders = helpers.rankAndSlice(Array.isArray(data?.winPctLeaders) ? data.winPctLeaders : [], 10, (team) => team.winPct);
      if (!leaders.length) return null;
      leaders.sort((a, b) => b.winPct - a.winPct);
      const labels = leaders.map((team) => team.team);
      const pct = leaders.map((team) => Number((team.winPct * 100).toFixed(1)));

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'All-time win %',
              data: pct,
              backgroundColor: palette.royal,
              borderRadius: 10,
              maxBarThickness: 44,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          layout: { padding: { top: 6, right: 8, bottom: 6, left: 8 } },
          plugins: {
            title: {
              display: true,
              text: 'Franchise win pace',
              align: 'start',
              color: '#0b2545',
              font: { weight: 700, size: 14 },
              padding: { bottom: 8 },
            },
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed.x, 1)}% win rate`;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              suggestedMax: 70,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => `${helpers.formatNumber(value, 0)}%`,
                color: '#42526c',
                font: { size: 12 },
              },
            },
            y: {
              grid: { display: false },
              ticks: {
                color: '#0b2545',
                font: { weight: 600 },
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="schedule-strain"]'),
    source: 'data/season_24_25_schedule.json',
    async createConfig(data) {
      const teams = helpers
        .rankAndSlice(Array.isArray(data?.teams) ? data.teams : [], 12, (team) => team.backToBacks)
        .map((team) => ({
          x: team.backToBacks,
          y: Number(team.averageRestDays?.toFixed(2) ?? 0),
          team: team.name,
          abbreviation: team.abbreviation,
          totalGames: team.totalGames,
        }));
      if (!teams.length) return null;

      return {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Teams',
              data: teams,
              pointBackgroundColor: palette.red,
              pointBorderColor: palette.teal,
              pointBorderWidth: 1.5,
              pointRadius: (ctx) => 4 + Math.min(8, ctx.raw.totalGames / 24),
              pointHoverRadius: (ctx) => 6 + Math.min(8, ctx.raw.totalGames / 24),
              pointHoverBorderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: 8 },
          plugins: {
            title: {
              display: true,
              text: 'Back-to-back pressure vs rest windows',
              align: 'start',
              color: '#0b2545',
              font: { weight: 700, size: 14 },
              padding: { bottom: 8 },
            },
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const { raw } = context;
                  return `${raw.team}: ${helpers.formatNumber(raw.x, 0)} back-to-back sets • ${helpers.formatNumber(raw.y, 2)} avg rest days`;
                },
              },
            },
          },
          interaction: { mode: 'nearest', axis: 'xy', intersect: false },
          scales: {
            x: {
              title: { display: true, text: 'Back-to-back sets' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => `${helpers.formatNumber(value, 0)}`,
                color: '#42526c',
                font: { size: 12 },
              },
            },
            y: {
              title: { display: true, text: 'Average rest days' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => `${helpers.formatNumber(value, 1)}`,
                color: '#42526c',
                font: { size: 12 },
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="expansion-waves"]'),
    source: 'data/active_franchises.json',
    async createConfig(data) {
      const decades = Array.isArray(data?.decades) ? data.decades : [];
      const timeline = decades
        .filter((entry) => Number.isFinite(entry?.total))
        .sort((a, b) => a.decade - b.decade);
      if (!timeline.length) return null;

      const labels = timeline.map((entry) => `${entry.decade}s`);
      const totals = timeline.map((entry) => entry.total);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Active franchises',
              data: totals,
              fill: 'start',
              tension: 0.35,
              borderColor: palette.royal,
              backgroundColor: 'rgba(17, 86, 214, 0.22)',
              pointBackgroundColor: palette.red,
              pointBorderColor: '#ffffff',
              pointBorderWidth: 1.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 6, right: 10, bottom: 10, left: 6 } },
          plugins: {
            title: {
              display: true,
              text: 'Decade expansion arcs',
              align: 'start',
              color: palette.midnight,
              font: { weight: 700, size: 14 },
              padding: { bottom: 8 },
            },
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed.y, 0)} franchises active`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { color: '#42526c', font: { size: 12 } },
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => helpers.formatNumber(value, 0),
                color: '#42526c',
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="offense-synergy"]'),
    source: 'data/team_performance.json',
    async createConfig(data) {
      const leaders = helpers.rankAndSlice(Array.isArray(data?.winPctLeaders) ? data.winPctLeaders : [], 12, (team) => team.winPct);
      if (!leaders.length) return null;

      const points = leaders.map((team) => ({
        x: Number(team.pointsPerGame?.toFixed(2) ?? 0),
        y: Number(team.opponentPointsPerGame?.toFixed(2) ?? 0),
        r: Math.max(8, Math.min(18, (team.assistsPerGame ?? 0) * 0.6)),
        team: team.team,
        assists: team.assistsPerGame ?? 0,
        winPct: team.winPct ?? 0,
      }));

      return {
        type: 'bubble',
        data: {
          datasets: [
            {
              label: 'Efficiency blend',
              data: points,
              backgroundColor: (ctx) => (ctx?.raw?.winPct ?? 0) >= 0.55 ? 'rgba(17, 86, 214, 0.75)' : 'rgba(239, 61, 91, 0.68)',
              borderColor: 'rgba(17, 86, 214, 0.28)',
              borderWidth: 1.5,
              hoverBorderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: 8 },
          plugins: {
            title: {
              display: true,
              text: 'Points vs opponent points',
              align: 'start',
              color: palette.midnight,
              font: { weight: 700, size: 14 },
              padding: { bottom: 8 },
            },
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const raw = context.raw ?? {};
                  const win = helpers.formatNumber((raw.winPct ?? 0) * 100, 1);
                  return `${raw.team}: ${helpers.formatNumber(raw.x, 2)} PPG • ${helpers.formatNumber(raw.y, 2)} OPPG • ${helpers.formatNumber(raw.assists, 2)} APG • ${win}% win rate`;
                },
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: 'Points per game' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { color: '#42526c', font: { size: 12 } },
            },
            y: {
              title: { display: true, text: 'Opponent points per game' },
              reverse: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { color: '#42526c', font: { size: 12 } },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="assist-fireworks"]'),
    source: 'data/team_performance.json',
    async createConfig(data) {
      const games = helpers
        .rankAndSlice(Array.isArray(data?.singleGameHighs?.assists) ? data.singleGameHighs.assists : [], 12, (game) => game.assists)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (!games.length) return null;

      const labels = games.map((game) => {
        const date = new Date(game.date);
        return `${date.getFullYear()} • ${game.team}`;
      });
      const assists = games.map((game) => game.assists ?? 0);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Single-game assists',
              data: assists,
              tension: 0.35,
              borderColor: 'rgba(239, 61, 91, 0.85)',
              backgroundColor: 'rgba(239, 61, 91, 0.18)',
              fill: 'start',
              pointRadius: 4,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 8, right: 10, bottom: 6, left: 6 } },
          plugins: {
            title: {
              display: true,
              text: 'Assist eruption history',
              align: 'start',
              color: palette.midnight,
              font: { weight: 700, size: 14 },
              padding: { bottom: 8 },
            },
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const game = games[context.dataIndex];
                  const opponent = game.opponent ?? 'Opponent';
                  const venue = game.home ? 'Home floor' : 'Road trip';
                  return `${game.team} vs ${opponent}: ${helpers.formatNumber(context.parsed.y, 0)} assists • ${venue}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(11, 37, 69, 0.06)' },
              ticks: { color: '#42526c', autoSkip: true, maxRotation: 0, minRotation: 0 },
            },
            y: {
              beginAtZero: true,
              suggestedMax: Math.max(...assists) + 5,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { color: '#42526c' },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="margin-surges"]'),
    source: 'data/team_performance.json',
    async createConfig(data) {
      const surges = helpers
        .rankAndSlice(Array.isArray(data?.singleGameHighs?.margins) ? data.singleGameHighs.margins : [], 10, (game) => game.margin)
        .sort((a, b) => a.margin - b.margin);
      if (!surges.length) return null;

      const labels = surges.map((game) => `${game.team} vs ${game.opponent}`);
      const margins = surges.map((game) => game.margin ?? 0);

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Point margin',
              data: margins,
              backgroundColor: 'rgba(17, 86, 214, 0.78)',
              borderRadius: 10,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          layout: { padding: { top: 6, right: 10, bottom: 6, left: 6 } },
          plugins: {
            title: {
              display: true,
              text: 'Largest single-game margins',
              align: 'start',
              color: palette.midnight,
              font: { weight: 700, size: 14 },
              padding: { bottom: 8 },
            },
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: +${helpers.formatNumber(context.parsed.x, 0)} margin`;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { color: '#42526c', callback: (value) => `+${helpers.formatNumber(value, 0)}` },
            },
            y: {
              grid: { display: false },
              ticks: { color: palette.midnight, font: { weight: 600, size: 11 } },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="rest-spectrum"]'),
    source: 'data/season_24_25_schedule.json',
    async createConfig(data) {
      const buckets = Array.isArray(data?.restBuckets) ? data.restBuckets : [];
      if (!buckets.length) return null;

      const labels = buckets.map((bucket) => bucket.label ?? '');
      const values = buckets.map((bucket) => bucket.intervals ?? 0);
      const colors = [
        'rgba(239, 61, 91, 0.78)',
        'rgba(17, 86, 214, 0.75)',
        'rgba(17, 86, 214, 0.5)',
        'rgba(244, 181, 63, 0.78)',
      ];

      return {
        type: 'polarArea',
        data: {
          labels,
          datasets: [
            {
              label: 'Rest intervals',
              data: values,
              backgroundColor: colors,
              borderColor: 'rgba(255, 255, 255, 0.7)',
              borderWidth: 1.2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: 10 },
          plugins: {
            title: {
              display: true,
              text: 'Rest day distribution',
              align: 'start',
              color: palette.midnight,
              font: { weight: 700, size: 14 },
              padding: { bottom: 8 },
            },
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label(context) {
                  const parsed = context.parsed;
                  const value =
                    typeof parsed === 'number'
                      ? parsed
                      : typeof parsed?.r === 'number'
                        ? parsed.r
                        : typeof context.raw === 'number'
                          ? context.raw
                          : 0;
                  return `${context.label}: ${helpers.formatNumber(value, 0)} intervals`;
                },
              },
            },
          },
          scales: {},
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="homestand-radar"]'),
    source: 'data/season_24_25_schedule.json',
    async createConfig(data) {
      const teams = helpers
        .rankAndSlice(Array.isArray(data?.teams) ? data.teams : [], 6, (team) => Math.max(team.longestHomeStand ?? 0, team.longestRoadTrip ?? 0));
      if (!teams.length) return null;

      const labels = teams.map((team) => team.abbreviation ?? team.name);
      const home = teams.map((team) => team.longestHomeStand ?? 0);
      const road = teams.map((team) => team.longestRoadTrip ?? 0);

      return {
        type: 'radar',
        data: {
          labels,
          datasets: [
            {
              label: 'Home stand',
              data: home,
              backgroundColor: 'rgba(17, 86, 214, 0.25)',
              borderColor: palette.royal,
              pointBackgroundColor: palette.royal,
            },
            {
              label: 'Road trip',
              data: road,
              backgroundColor: 'rgba(239, 61, 91, 0.2)',
              borderColor: palette.red,
              pointBackgroundColor: palette.red,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: 10 },
          plugins: {
            title: {
              display: true,
              text: 'Longest schedule swings',
              align: 'start',
              color: palette.midnight,
              font: { weight: 700, size: 14 },
              padding: { bottom: 8 },
            },
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.dataset.label}: ${helpers.formatNumber(context.parsed.r, 0)} games`;
                },
              },
            },
          },
          scales: {
            r: {
              beginAtZero: true,
              angleLines: { color: 'rgba(11, 37, 69, 0.08)' },
              grid: { color: 'rgba(11, 37, 69, 0.12)' },
              ticks: { backdropColor: 'transparent', color: '#42526c', stepSize: 1 },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="monthly-volume"]'),
    source: 'data/season_24_25_schedule.json',
    async createConfig(data) {
      const months = Array.isArray(data?.monthlyCounts) ? data.monthlyCounts : [];
      if (!months.length) return null;

      const labels = months.map((month) => month.label ?? month.month ?? '');
      const preseason = months.map((month) => month.preseason ?? 0);
      const regular = months.map((month) => month.regularSeason ?? 0);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Preseason volume',
              data: preseason,
              borderColor: 'rgba(244, 181, 63, 0.88)',
              backgroundColor: 'rgba(244, 181, 63, 0.28)',
              fill: 'origin',
              tension: 0.35,
              pointRadius: 3,
            },
            {
              label: 'Regular season load',
              data: regular,
              borderColor: 'rgba(17, 86, 214, 0.85)',
              backgroundColor: 'rgba(17, 86, 214, 0.22)',
              fill: 'origin',
              tension: 0.35,
              pointRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 6, right: 14, bottom: 8, left: 6 } },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            title: {
              display: true,
              text: 'Monthly game flow',
              align: 'start',
              color: palette.midnight,
              font: { weight: 700, size: 14 },
              padding: { bottom: 8 },
            },
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.dataset.label}: ${helpers.formatNumber(context.parsed.y, 0)} games`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(11, 37, 69, 0.06)' },
              ticks: { color: '#42526c' },
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { color: '#42526c', callback: (value) => helpers.formatNumber(value, 0) },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="back-to-back"]'),
    source: 'data/season_24_25_schedule.json',
    async createConfig(data) {
      const teams = helpers
        .rankAndSlice(Array.isArray(data?.backToBackLeaders) ? data.backToBackLeaders : [], 10, (team) => team.backToBacks)
        .sort((a, b) => b.backToBacks - a.backToBacks);
      if (!teams.length) return null;

      const labels = teams.map((team) => team.abbreviation ?? team.name);
      const totals = teams.map((team) => team.backToBacks ?? 0);
      const rest = teams.map((team) => team.averageRestDays ?? 0);

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Back-to-back sets',
              data: totals,
              backgroundColor: 'rgba(17, 86, 214, 0.8)',
              borderRadius: 10,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 6, right: 8, bottom: 6, left: 8 } },
          plugins: {
            title: {
              display: true,
              text: 'Back-to-back burden',
              align: 'start',
              color: palette.midnight,
              font: { weight: 700, size: 14 },
              padding: { bottom: 8 },
            },
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const averageRest = rest[context.dataIndex] ?? 0;
                  return `${context.label}: ${helpers.formatNumber(context.parsed.y, 0)} sets • ${helpers.formatNumber(averageRest, 2)} avg rest days`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#42526c', font: { weight: 600 } },
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { color: '#42526c', callback: (value) => helpers.formatNumber(value, 0) },
            },
          },
        },
      };
    },
  },
]);
