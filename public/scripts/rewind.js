import { registerCharts, helpers } from './hub-charts.js';

const palette = {
  royal: '#1b4bbd',
  sky: 'rgba(27, 75, 189, 0.78)',
  gold: 'rgba(227, 164, 28, 0.85)',
  coral: 'rgba(212, 61, 36, 0.82)',
  teal: 'rgba(21, 122, 134, 0.78)',
  navy: '#0f1a2e',
};



const scheduleLabelColors = [
  '#1b4bbd',
  '#1b4bbd',
  '#1b4bbd',
  '#1b4bbd',
  '#157a86',
  '#157a86',
  '#e3a41c',
  '#e3a41c',
  '#d43d24',
  '#d43d24',
  '#6b3f8f',
  '#1b4bbd',
];

const scheduleDataPromise = fetch('data/season_24_25_schedule.json').then((response) => {
  if (!response.ok) {
    throw new Error(`Failed to load schedule data: ${response.status}`);
  }
  return response.json();
});

function formatSigned(value, digits = 1, suffix = '') {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  const magnitude = helpers.formatNumber(Math.abs(value), digits);
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${magnitude}${suffix}`;
}

function formatTimestamp(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(date);
}

function setTimestamp(attribute, value) {
  const nodes = document.querySelectorAll(`[data-${attribute}]`);
  const date = value ? new Date(value) : null;
  const valid = date && !Number.isNaN(date.getTime());
  nodes.forEach((node) => {
    if (valid) {
      const formatted = formatTimestamp(date);
      node.textContent = formatted;
      if (node.tagName === 'TIME') {
        node.dateTime = date.toISOString();
      }
    } else {
      node.textContent = '—';
      if (node.tagName === 'TIME') {
        node.removeAttribute('datetime');
      }
    }
  });
}

function setStat(attribute, value, formatter = (v) => v, fallback = '—') {
  const nodes = document.querySelectorAll(`[data-${attribute}]`);
  const hasValue = value !== undefined && value !== null && !(typeof value === 'number' && Number.isNaN(value));
  nodes.forEach((node) => {
    node.textContent = hasValue ? formatter(value) : fallback;
  });
}

function getFinalsTeamLabels(finals) {
  const champion = finals?.champion ?? {};
  const opponent = finals?.opponent ?? {};
  const championLabel =
    champion.shortName ?? champion.name ?? champion.abbreviation ?? champion.label ?? 'Champion';
  const opponentLabel =
    opponent.shortName ?? opponent.name ?? opponent.abbreviation ?? opponent.label ?? 'Opponent';
  return { championLabel, opponentLabel };
}

registerCharts([
  {
    element: document.querySelector('[data-chart="monthly-games"]'),
    async createConfig() {
      const data = await scheduleDataPromise;
      const monthlyCounts = Array.isArray(data?.monthlyCounts) ? data.monthlyCounts : [];
      if (!monthlyCounts.length) return null;

      const labels = monthlyCounts.map((entry) => entry.label ?? '');
      const regularSeason = monthlyCounts.map((entry) => entry.regularSeason ?? 0);
      const auxiliary = monthlyCounts.map((entry) => {
        const games = entry.games ?? 0;
        const primary = entry.regularSeason ?? 0;
        return Math.max(0, games - primary);
      });

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Regular season',
              data: regularSeason,
              backgroundColor: palette.royal,
              borderRadius: 0,
              maxBarThickness: 32,
            },
            {
              label: 'Cup & postseason',
              data: auxiliary,
              backgroundColor: palette.gold,
              borderRadius: 0,
              maxBarThickness: 32,
            },
          ],
        },
        options: {
          layout: { padding: { top: 4, right: 12, bottom: 8, left: 8 } },
          plugins: {
            legend: { position: 'top', labels: { usePointStyle: true } },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = helpers.formatNumber(context.parsed.y, 0);
                  return `${context.dataset.label}: ${value} games`;
                },
              },
            },
          },
          scales: {
            x: {
              stacked: true,
              grid: { display: false },
            },
            y: {
              stacked: true,
              beginAtZero: true,
              grid: { color: 'rgba(15, 26, 46, 0.08)' },
              ticks: {
                callback: (value) => helpers.formatNumber(value, 0),
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="rest-distribution"]'),
    async createConfig() {
      const data = await scheduleDataPromise;
      const restBuckets = Array.isArray(data?.restBuckets) ? data.restBuckets : [];
      if (!restBuckets.length) return null;
      const totalIntervals = restBuckets.reduce((sum, bucket) => sum + (bucket.intervals ?? 0), 0);

      return {
        type: 'doughnut',
        data: {
          labels: restBuckets.map((bucket) => bucket.label ?? ''),
          datasets: [
            {
              data: restBuckets.map((bucket) => bucket.intervals ?? 0),
              backgroundColor: [palette.coral, palette.gold, palette.sky, palette.teal],
              borderColor: '#fcfdfa',
              borderWidth: 2,
            },
          ],
        },
        options: {
          layout: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true } },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = context.parsed;
                  const share = totalIntervals ? (value / totalIntervals) * 100 : 0;
                  return `${context.label}: ${helpers.formatNumber(value, 0)} intervals (${helpers.formatNumber(share, 1)}%)`;
                },
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="rest-zero-share"]'),
    async createConfig() {
      const data = await scheduleDataPromise;
      const restBuckets = Array.isArray(data?.restBuckets) ? data.restBuckets : [];
      if (!restBuckets.length) return null;
      const total = restBuckets.reduce((sum, bucket) => sum + (bucket.intervals ?? 0), 0);
      if (!total) return null;

      const zero = restBuckets.find((bucket) => bucket.label === '0 days')?.intervals ?? 0;
      const remaining = Math.max(0, total - zero);

      return {
        type: 'doughnut',
        data: {
          labels: ['Zero rest', '1+ days rest'],
          datasets: [
            {
              data: [zero, remaining],
              backgroundColor: [palette.coral, 'rgba(27, 75, 189, 0.18)'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = context.parsed;
                  const share = total ? (value / total) * 100 : 0;
                  return `${context.label}: ${helpers.formatNumber(value, 0)} intervals (${helpers.formatNumber(share, 1)}%)`;
                },
              },
            },
            subtitle: {
              display: true,
              text: `${helpers.formatNumber((zero / total) * 100, 1)}% zero rest`,
              color: palette.navy,
              font: { size: 14, weight: 'bold' },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="schedule-label-mix"]'),
    async createConfig() {
      const data = await scheduleDataPromise;
      const breakdown = Array.isArray(data?.labelBreakdown) ? data.labelBreakdown : [];
      if (!breakdown.length) return null;

      // One kind of game dwarfs the rest, so a pie shows a single wedge. Ranked
      // bars on a log scale keep the small categories readable, with the count
      // printed beside each name.
      const total = breakdown.reduce((sum, entry) => sum + (entry.games ?? 0), 0);
      const ranked = [...breakdown].filter((entry) => (entry.games ?? 0) > 0).sort((x, y) => (y.games ?? 0) - (x.games ?? 0));
      return {
        type: 'bar',
        data: {
          labels: ranked.map((entry) => `${entry.label ?? ''}  ${helpers.formatNumber(entry.games ?? 0, 0)}`),
          datasets: [
            {
              data: ranked.map((entry) => entry.games ?? 0),
              backgroundColor: ranked.map((_, index) => (index === 0 ? '#1b4bbd' : '#d43d24')),
              borderWidth: 0,
              barThickness: 10,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          scales: {
            x: { type: 'logarithmic', min: 1, grid: { display: false }, ticks: { display: false }, border: { display: false } },
            y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 } } },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = context.parsed.x;
                  const share = total ? (value / total) * 100 : 0;
                  return `${helpers.formatNumber(value, 0)} games (${helpers.formatNumber(share, 1)}%)`;
                },
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="back-to-back-loads"]'),
    async createConfig() {
      const data = await scheduleDataPromise;
      const leaders = Array.isArray(data?.backToBackLeaders) ? data.backToBackLeaders : [];
      const ranked = helpers.rankAndSlice(leaders, 8, (entry) => entry.backToBacks ?? 0);
      if (!ranked.length) return null;

      return {
        type: 'bar',
        data: {
          labels: ranked.map((entry) => entry.abbreviation ?? entry.name ?? ''),
          datasets: [
            {
              label: 'Back-to-backs',
              data: ranked.map((entry) => entry.backToBacks ?? 0),
              backgroundColor: palette.royal,
              borderRadius: 0,
              maxBarThickness: 26,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          layout: { padding: { top: 8, right: 16, bottom: 8, left: 8 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const team = ranked[context.dataIndex];
                  const rest = team?.averageRestDays;
                  const segments = [`${helpers.formatNumber(context.parsed.x, 0)} back-to-backs`];
                  if (typeof rest === 'number') {
                    segments.push(`avg rest ${helpers.formatNumber(rest, 1)} days`);
                  }
                  return segments.join(' · ');
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(15, 26, 46, 0.08)' },
              ticks: {
                callback: (value) => helpers.formatNumber(value, 0),
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
    element: document.querySelector('[data-chart="travel-extremes"]'),
    async createConfig() {
      const data = await scheduleDataPromise;
      const teams = Array.isArray(data?.teams) ? data.teams : [];
      if (!teams.length) return null;

      const ranked = helpers.rankAndSlice(teams, 18, (team) => team.totalGames ?? 0);
      if (!ranked.length) return null;

      const points = ranked.map((team, index) => ({
        x: typeof team.averageRestDays === 'number' ? team.averageRestDays : 0,
        y: typeof team.backToBacks === 'number' ? team.backToBacks : 0,
        r: Math.max(6, Math.min(24, (team.totalGames ?? 0) * 0.18)),
        team,
        backgroundColor: index === 0 ? palette.coral : palette.sky,
      }));

      return {
        type: 'bubble',
        data: {
          datasets: [
            {
              label: 'Team workload',
              data: points,
              backgroundColor: points.map((point) => point.backgroundColor),
              borderColor: 'rgba(15, 26, 46, 0.18)',
            },
          ],
        },
        options: {
          parsing: false,
          layout: { padding: { top: 8, right: 12, bottom: 8, left: 8 } },
          scales: {
            x: {
              title: { display: true, text: 'Average rest days' },
              grid: { color: 'rgba(15, 26, 46, 0.08)' },
              ticks: { callback: (value) => helpers.formatNumber(value, 1) },
            },
            y: {
              title: { display: true, text: 'Back-to-back sets' },
              grid: { color: 'rgba(15, 26, 46, 0.08)' },
              ticks: { callback: (value) => helpers.formatNumber(value, 0) },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const point = context.raw;
                  const team = point.team ?? {};
                  const segments = [team.name ?? team.abbreviation ?? 'Team'];
                  segments.push(`avg rest ${helpers.formatNumber(point.x, 1)} days`);
                  segments.push(`${helpers.formatNumber(point.y, 0)} back-to-backs`);
                  if (typeof team.totalGames === 'number') {
                    segments.push(`${helpers.formatNumber(team.totalGames, 0)} total games`);
                  }
                  return segments.join(' · ');
                },
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="global-showcase-timeline"]'),
    async createConfig() {
      const data = await scheduleDataPromise;
      const specialGames = Array.isArray(data?.specialGames) ? data.specialGames : [];
      if (!specialGames.length) return null;

      const monthBuckets = new Map();
      specialGames.forEach((game) => {
        const date = new Date(game.date);
        if (Number.isNaN(date.getTime())) return;
        const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
        if (!monthBuckets.has(key)) {
          monthBuckets.set(key, { global: 0, cup: 0, marquee: 0 });
        }
        const bucket = monthBuckets.get(key);
        if (game.label === 'Emirates NBA Cup') {
          bucket.cup += 1;
        } else if (
          game.subtype === 'Global Games' ||
          game.label?.includes('Paris') ||
          game.label?.includes('Mexico City') ||
          game.label?.includes('Abu Dhabi')
        ) {
          bucket.global += 1;
        } else if (game.label === 'NBA Finals') {
          bucket.marquee += 1;
        } else {
          bucket.marquee += 1;
        }
      });

      if (!monthBuckets.size) return null;

      const sortedKeys = Array.from(monthBuckets.keys()).sort((a, b) => {
        const [yearA, monthA] = a.split('-').map(Number);
        const [yearB, monthB] = b.split('-').map(Number);
        return yearA !== yearB ? yearA - yearB : monthA - monthB;
      });

      const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
      const labels = sortedKeys.map((key) => {
        const [year, month] = key.split('-').map(Number);
        return monthFormatter.format(new Date(year, month, 1));
      });

      const orderedBuckets = sortedKeys.map((key) => monthBuckets.get(key));

      const datasets = [
        {
          label: 'Global showcases',
          data: orderedBuckets.map((bucket) => bucket.global ?? 0),
          borderColor: palette.sky,
          backgroundColor: 'rgba(27, 75, 189, 0.26)',
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Cup games',
          data: orderedBuckets.map((bucket) => bucket.cup ?? 0),
          borderColor: palette.gold,
          backgroundColor: 'rgba(227, 164, 28, 0.24)',
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Finals',
          data: orderedBuckets.map((bucket) => bucket.marquee ?? 0),
          borderColor: palette.coral,
          backgroundColor: 'rgba(212, 61, 36, 0.18)',
          tension: 0.3,
          fill: true,
        },
      ];

      return {
        type: 'line',
        data: { labels, datasets },
        options: {
          stacked: false,
          layout: { padding: { top: 6, right: 16, bottom: 8, left: 8 } },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', labels: { usePointStyle: true } },
            tooltip: {
              callbacks: {
                title(context) {
                  return context[0]?.label ?? '';
                },
                label(context) {
                  return `${context.dataset.label}: ${helpers.formatNumber(context.parsed.y, 0)} events`;
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(15, 26, 46, 0.08)' },
              ticks: { callback: (value) => helpers.formatNumber(value, 0) },
            },
          },
        },
      };
    },
  },
]);

function populateCallouts(data) {
  const totals = data?.totals ?? {};
  const restSummary = data?.restSummary ?? {};
  const restBuckets = Array.isArray(data?.restBuckets) ? data.restBuckets : [];
  const zeroIntervals = restBuckets.find((bucket) => bucket.label === '0 days')?.intervals ?? 0;
  const totalIntervals = restSummary.totalIntervals ?? restBuckets.reduce((sum, bucket) => sum + (bucket.intervals ?? 0), 0);
  const zeroShare = totalIntervals ? (zeroIntervals / totalIntervals) * 100 : null;

  setStat('stat-total-games', totals.games, (value) => helpers.formatNumber(value, 0));
  setStat('stat-avg-rest', restSummary.averageRestDays, (value) => `${helpers.formatNumber(value, 1)} days`);
  setStat('stat-back-to-backs', restSummary.backToBackIntervals, (value) => helpers.formatNumber(value, 0));
  setStat('stat-alt-games', totals.other, (value) => helpers.formatNumber(value, 0));
  setStat('stat-alt-share', totals.games ? (totals.other / totals.games) * 100 : null, (value) => helpers.formatNumber(value, 1));
  setStat('stat-zero-share', zeroShare, (value) => helpers.formatNumber(value, 1));

  const monthlyCounts = Array.isArray(data?.monthlyCounts) ? data.monthlyCounts : [];
  const peakMonth = monthlyCounts
    .filter((entry) => typeof entry.regularSeason === 'number' && entry.regularSeason > 0)
    .reduce((peak, entry) => (entry.regularSeason > (peak?.regularSeason ?? -Infinity) ? entry : peak), null);
  setStat('monthly-peak-month', peakMonth?.label, (value) => value);
  setStat('monthly-peak-games', peakMonth?.regularSeason, (value) => helpers.formatNumber(value, 0));
}

scheduleDataPromise
  .then((data) => {
    setTimestamp('stat-schedule-updated', data?.generatedAt);
    populateCallouts(data);
  })
  .catch((error) => {
    console.error('Unable to hydrate season rewind view', error);
    setTimestamp('stat-schedule-updated', null);
  });
