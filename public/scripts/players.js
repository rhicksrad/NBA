import { registerCharts, helpers } from './hub-charts.js';

const palette = {
  royal: '#1156d6',
  sky: 'rgba(31, 123, 255, 0.75)',
  gold: '#f4b53f',
};

registerCharts([
  {
    element: document.querySelector('[data-chart="player-heights"]'),
    source: 'data/players_overview.json',
    async createConfig(data) {
      const buckets = Array.isArray(data?.heightBuckets) ? data.heightBuckets : [];
      if (!buckets.length) return null;
      const labels = buckets.map((bucket) => bucket.label);
      const totals = buckets.map((bucket) => bucket.players);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Players',
              data: totals,
              fill: true,
              borderColor: palette.royal,
              backgroundColor: 'rgba(17, 86, 214, 0.18)',
              tension: 0.32,
              pointRadius: 0,
              pointHoverRadius: 4,
            },
          ],
        },
        options: {
          layout: { padding: { left: 4, right: 4, top: 8, bottom: 8 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed.y, 0)} players`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => `${helpers.formatNumber(value, 0)}`,
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="draft-timeline"]'),
    source: 'data/players_overview.json',
    async createConfig(data) {
      const decadeCounts = Array.isArray(data?.draftSummary?.decadeCounts)
        ? data.draftSummary.decadeCounts.filter((entry) => /\d{4}s/.test(entry.decade))
        : [];
      if (!decadeCounts.length) return null;
      const trimmed = helpers.evenSample(decadeCounts, 10);
      const labels = trimmed.map((entry) => entry.decade);
      const drafted = trimmed.map((entry) => entry.players);

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Drafted players',
              data: drafted,
              backgroundColor: palette.gold,
              borderColor: 'rgba(244, 181, 63, 0.8)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          layout: { padding: { top: 4, right: 8, bottom: 4, left: 8 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed.y, 0)} draft picks`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.1)' },
              ticks: {
                callback: (value) => `${helpers.formatNumber(value, 0)}`,
              },
            },
          },
        },
      };
    },
  },
]);
