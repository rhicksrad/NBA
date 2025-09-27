import { registerCharts, helpers } from './hub-charts.js';

const palette = {
  royal: '#1156d6',
  red: '#ef3d5b',
  teal: 'rgba(17, 86, 214, 0.2)',
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
            },
          ],
        },
        options: {
          indexAxis: 'y',
          layout: { padding: { top: 6, right: 8, bottom: 6, left: 8 } },
          plugins: {
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
                  const { raw } = context;
                  return `${raw.team}: ${helpers.formatNumber(raw.x, 0)} back-to-back sets • ${helpers.formatNumber(raw.y, 2)} avg rest days`;
                },
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: 'Back-to-back sets' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => `${helpers.formatNumber(value, 0)}`,
              },
            },
            y: {
              title: { display: true, text: 'Average rest days' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => `${helpers.formatNumber(value, 1)}`,
              },
            },
          },
        },
      };
    },
  },
]);
