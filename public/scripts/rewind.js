import { registerCharts, helpers } from './hub-charts.js';

const palette = {
  royal: '#1156d6',
  sky: 'rgba(31, 123, 255, 0.78)',
  gold: 'rgba(244, 181, 63, 0.85)',
  coral: 'rgba(239, 61, 91, 0.82)',
  teal: 'rgba(47, 180, 200, 0.78)',
  navy: '#0b2545',
};

const finalsZoneColors = ['#1156d6', '#1f7bf0', '#2fb4c8', '#f4b53f', '#ef3d5b'];

const FINALS_CHAMPION_KEY = 'champion';
const FINALS_OPPONENT_KEY = 'opponent';

const scheduleLabelColors = [
  '#1156d6',
  '#1f6bd4',
  '#2f8ded',
  '#40a5ff',
  '#2fb4c8',
  '#3fcebd',
  '#f4b53f',
  '#f78c3f',
  '#ef3d5b',
  '#c13d6a',
  '#8457d8',
  '#3f4d88',
];

const scheduleDataPromise = fetch('data/season_24_25_schedule.json').then((response) => {
  if (!response.ok) {
    throw new Error(`Failed to load schedule data: ${response.status}`);
  }
  return response.json();
});

const highlightDataPromise = fetch('data/season_24_25_rewind.json').then((response) => {
  if (!response.ok) {
    throw new Error(`Failed to load rewind highlight data: ${response.status}`);
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
    element: document.querySelector('[data-chart="finals-net-rating"]'),
    async createConfig() {
      const data = await highlightDataPromise;
      const finals = data?.finals ?? {};
      const netRatings = Array.isArray(finals.netRatings) ? finals.netRatings : [];
      if (!netRatings.length) return null;

      const labels = netRatings.map((entry) => entry.game ?? '');
      const championValues = netRatings.map((entry) => entry[FINALS_CHAMPION_KEY] ?? 0);
      const opponentValues = netRatings.map((entry) => entry[FINALS_OPPONENT_KEY] ?? 0);
      const { championLabel, opponentLabel } = getFinalsTeamLabels(finals);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: `${championLabel} net rating`,
              data: championValues,
              borderColor: palette.royal,
              backgroundColor: 'rgba(17, 86, 214, 0.18)',
              pointRadius: 4,
              pointHoverRadius: 5,
              tension: 0.35,
              fill: false,
            },
            {
              label: `${opponentLabel} net rating`,
              data: opponentValues,
              borderColor: palette.coral,
              backgroundColor: 'rgba(239, 61, 91, 0.16)',
              pointRadius: 4,
              pointHoverRadius: 5,
              tension: 0.35,
              fill: false,
            },
          ],
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = context.parsed.y;
                  return `${context.dataset.label}: ${formatSigned(value, 1)} net rating`;
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => formatSigned(value, 0),
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="finals-quarter-differentials"]'),
    async createConfig() {
      const data = await highlightDataPromise;
      const finals = data?.finals ?? {};
      const quarters = Array.isArray(finals.quarterDifferentials)
        ? finals.quarterDifferentials
        : [];
      if (!quarters.length) return null;

      const labels = quarters.map((entry) => entry.quarter ?? '');
      const championValues = quarters.map((entry) => entry[FINALS_CHAMPION_KEY] ?? 0);
      const opponentValues = quarters.map((entry) => entry[FINALS_OPPONENT_KEY] ?? 0);
      const { championLabel, opponentLabel } = getFinalsTeamLabels(finals);

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: championLabel,
              data: championValues,
              backgroundColor: palette.royal,
              borderRadius: 10,
              maxBarThickness: 34,
            },
            {
              label: opponentLabel,
              data: opponentValues,
              backgroundColor: palette.coral,
              borderRadius: 10,
              maxBarThickness: 34,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          layout: { padding: { top: 4, right: 12, bottom: 4, left: 8 } },
          scales: {
            y: { grid: { display: false } },
            x: {
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { callback: (value) => formatSigned(value, 0) },
            },
          },
          plugins: {
            legend: { display: true, position: 'bottom' },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.dataset.label}: ${formatSigned(context.parsed.x, 1)} avg margin`;
                },
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="finals-shot-profile"]'),
    async createConfig() {
      const data = await highlightDataPromise;
      const finals = data?.finals ?? {};
      const profile = finals?.shotProfile ?? {};
      const zones = Array.isArray(profile.zones) ? profile.zones : [];
      const championShots = Array.isArray(profile[FINALS_CHAMPION_KEY]) ? profile[FINALS_CHAMPION_KEY] : [];
      const opponentShots = Array.isArray(profile[FINALS_OPPONENT_KEY]) ? profile[FINALS_OPPONENT_KEY] : [];
      if (!zones.length || !championShots.length || !opponentShots.length) return null;

      const sharedColors = zones.map((_, index) => finalsZoneColors[index % finalsZoneColors.length]);
      const { championLabel, opponentLabel } = getFinalsTeamLabels(finals);

      return {
        type: 'doughnut',
        data: {
          labels: zones,
          datasets: [
            {
              label: championLabel,
              data: championShots,
              backgroundColor: sharedColors,
              hoverOffset: 4,
            },
            {
              label: opponentLabel,
              data: opponentShots,
              backgroundColor: sharedColors.map((color) => `${color}CC`),
              hoverOffset: 4,
              spacing: 2,
            },
          ],
        },
        options: {
          layout: { padding: { top: 6, right: 12, bottom: 4, left: 12 } },
          cutout: '58%',
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = context.parsed;
                  return `${context.dataset.label}: ${helpers.formatNumber(value, 0)}% from ${context.label}`;
                },
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="thunder-wins"]'),
    async createConfig() {
      const data = await highlightDataPromise;
      const wins = Array.isArray(data?.thunder?.monthlyWins) ? data.thunder.monthlyWins : [];
      if (!wins.length) return null;

      const labels = wins.map((entry) => entry.month ?? '');
      const totals = wins.map((entry) => entry.wins ?? 0);
      let highlightIndex = 0;
      totals.forEach((value, index) => {
        if (value > (totals[highlightIndex] ?? -Infinity)) {
          highlightIndex = index;
        }
      });

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Monthly wins',
              data: totals,
              backgroundColor: totals.map((_, index) => (index === highlightIndex ? palette.coral : palette.royal)),
              borderRadius: 10,
              maxBarThickness: 38,
            },
          ],
        },
        options: {
          layout: { padding: { top: 6, right: 12, bottom: 4, left: 8 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed.y, 0)} wins`;
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { callback: (value) => helpers.formatNumber(value, 0) },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="league-pace"]'),
    async createConfig() {
      const data = await highlightDataPromise;
      const series = Array.isArray(data?.leaguePaceMonthly) ? data.leaguePaceMonthly : [];
      if (!series.length) return null;

      const labels = series.map((entry) => entry.month ?? '');
      const values = series.map((entry) => entry.pace ?? 0);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Possessions per 48 minutes',
              data: values,
              borderColor: palette.royal,
              backgroundColor: 'rgba(17, 86, 214, 0.16)',
              fill: 'start',
              tension: 0.35,
              pointRadius: 4,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          layout: { padding: { top: 6, right: 12, bottom: 4, left: 8 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed.y, 1)} possessions`;
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: false,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => helpers.formatNumber(value, 1),
              },
            },
          },
        },
      };
    },
  },
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
              borderRadius: 6,
              maxBarThickness: 32,
            },
            {
              label: 'Cup & postseason',
              data: auxiliary,
              backgroundColor: palette.gold,
              borderRadius: 6,
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
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
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
              borderColor: '#ffffff',
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
              backgroundColor: [palette.coral, 'rgba(17, 86, 214, 0.18)'],
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

      const total = breakdown.reduce((sum, entry) => sum + (entry.games ?? 0), 0);
      return {
        type: 'doughnut',
        data: {
          labels: breakdown.map((entry) => entry.label ?? ''),
          datasets: [
            {
              data: breakdown.map((entry) => entry.games ?? 0),
              backgroundColor: breakdown.map((_, index) => scheduleLabelColors[index % scheduleLabelColors.length]),
              borderWidth: 0,
            },
          ],
        },
        options: {
          cutout: '48%',
          plugins: {
            legend: { position: 'right', labels: { usePointStyle: true } },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = context.parsed;
                  const share = total ? (value / total) * 100 : 0;
                  return `${context.label}: ${helpers.formatNumber(value, 0)} games (${helpers.formatNumber(share, 1)}%)`;
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
              borderRadius: 8,
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
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
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
              borderColor: 'rgba(11, 37, 69, 0.18)',
            },
          ],
        },
        options: {
          parsing: false,
          layout: { padding: { top: 8, right: 12, bottom: 8, left: 8 } },
          scales: {
            x: {
              title: { display: true, text: 'Average rest days' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { callback: (value) => helpers.formatNumber(value, 1) },
            },
            y: {
              title: { display: true, text: 'Back-to-back sets' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
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
          backgroundColor: 'rgba(31, 123, 255, 0.26)',
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Cup action',
          data: orderedBuckets.map((bucket) => bucket.cup ?? 0),
          borderColor: palette.gold,
          backgroundColor: 'rgba(244, 181, 63, 0.24)',
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Finale spotlight',
          data: orderedBuckets.map((bucket) => bucket.marquee ?? 0),
          borderColor: palette.coral,
          backgroundColor: 'rgba(239, 61, 91, 0.18)',
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
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { callback: (value) => helpers.formatNumber(value, 0) },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="clutch-index"]'),
    async createConfig() {
      const data = await highlightDataPromise;
      const composite = Array.isArray(data?.clutchComposite) ? data.clutchComposite : [];
      if (!composite.length) return null;

      const ranked = [...composite].sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
      const labels = ranked.map((entry) =>
        [entry.player, entry.team].filter(Boolean).join(' · ')
      );
      const values = ranked.map((entry) => entry.index ?? 0);

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Composite index',
              data: values,
              backgroundColor: values.map((_, index) => (index === 0 ? palette.coral : palette.sky)),
              borderRadius: 8,
              maxBarThickness: 30,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          layout: { padding: { top: 6, right: 18, bottom: 4, left: 8 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const player = ranked[context.dataIndex];
                  const segments = [`Index ${helpers.formatNumber(context.parsed.x, 0)}`];
                  if (typeof player?.trueShooting === 'number') {
                    segments.push(`TS ${helpers.formatNumber(player.trueShooting * 100, 1)}%`);
                  }
                  return segments.join(' · ');
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { callback: (value) => helpers.formatNumber(value, 0) },
            },
            y: { grid: { display: false } },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="clutch-accuracy"]'),
    async createConfig() {
      const data = await highlightDataPromise;
      const composite = Array.isArray(data?.clutchComposite) ? data.clutchComposite : [];
      if (!composite.length) return null;

      const points = composite.map((entry) => ({
        x: entry.index ?? 0,
        y: typeof entry.trueShooting === 'number' ? entry.trueShooting * 100 : null,
        label: [entry.player, entry.team].filter(Boolean).join(' · '),
      }));

      const filtered = points.filter((point) => point.y !== null);
      if (!filtered.length) return null;

      const leader = filtered.reduce((best, point) => (point.x > (best?.x ?? -Infinity) ? point : best), null);

      return {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Clutch performers',
              data: filtered,
              pointBackgroundColor: filtered.map((point) => (point === leader ? palette.coral : palette.teal)),
              pointRadius: 6,
              pointHoverRadius: 8,
            },
          ],
        },
        options: {
          layout: { padding: { top: 6, right: 16, bottom: 8, left: 8 } },
          scales: {
            x: {
              title: { display: true, text: 'Composite index' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { callback: (value) => helpers.formatNumber(value, 0) },
            },
            y: {
              title: { display: true, text: 'True shooting %' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { callback: (value) => `${helpers.formatNumber(value, 0)}%` },
              suggestedMin: 45,
              suggestedMax: 80,
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const point = context.raw;
                  return `${point.label}: index ${helpers.formatNumber(point.x, 0)} · TS ${helpers.formatNumber(point.y, 1)}%`;
                },
              },
            },
          },
        },
      };
    },
  },
]);

function populateHighlightPanels(data) {
  const finals = data?.finals ?? {};
  const netRatings = Array.isArray(finals.netRatings) ? finals.netRatings : [];
  const games = netRatings.length;

  if (games) {
    const aggregate = netRatings.reduce((sum, entry) => sum + (entry[FINALS_CHAMPION_KEY] ?? 0), 0);
    const combinedNet = aggregate / games;
    setStat('stat-finals-net', combinedNet, (value) => formatSigned(value, 1));
    setStat('stat-finals-games', games, (value) => helpers.formatNumber(value, 0));

    const closerWindow = netRatings.slice(-2);
    if (closerWindow.length) {
      const closerNet =
        closerWindow.reduce((sum, entry) => sum + (entry[FINALS_CHAMPION_KEY] ?? 0), 0) / closerWindow.length;
      setStat('stat-finals-closer', closerNet, (value) => formatSigned(value, 1));
      setStat('stat-finals-closer-games', closerWindow.length, (value) => helpers.formatNumber(value, 0));
    }

    const peak = netRatings.reduce((best, entry) =>
      (entry[FINALS_CHAMPION_KEY] ?? -Infinity) > (best?.[FINALS_CHAMPION_KEY] ?? -Infinity) ? entry : best,
      null
    );
    setStat('stat-finals-peak-game', peak?.game, (value) => value);
    setStat('stat-finals-peak-margin', peak?.[FINALS_CHAMPION_KEY], (value) => formatSigned(value, 1));
  } else {
    setStat('stat-finals-net', null);
    setStat('stat-finals-games', null);
    setStat('stat-finals-closer', null);
    setStat('stat-finals-closer-games', null);
    setStat('stat-finals-peak-game', null);
    setStat('stat-finals-peak-margin', null);
  }

  const thunder = data?.thunder ?? {};
  const thunderWins = Array.isArray(thunder.monthlyWins) ? thunder.monthlyWins : [];
  setStat('stat-thunder-net-rating', thunder.netRating, (value) => formatSigned(value, 1));
  if (thunderWins.length) {
    const peak = thunderWins.reduce(
      (best, entry) => ((entry.wins ?? -Infinity) > (best?.wins ?? -Infinity) ? entry : best),
      null
    );
    const lull = thunderWins.reduce(
      (worst, entry) => ((entry.wins ?? Infinity) < (worst?.wins ?? Infinity) ? entry : worst),
      null
    );
    const delta = peak && lull ? (peak.wins ?? 0) - (lull.wins ?? 0) : null;
    setStat('stat-thunder-win-delta', delta, (value) => formatSigned(value, 0, ' wins'));
  } else {
    setStat('stat-thunder-win-delta', null);
  }
  setStat('stat-thunder-clutch', thunder.clutchWins, (value) => `${helpers.formatNumber(value, 0)} clutch wins`);

  const paceSeries = Array.isArray(data?.leaguePaceMonthly) ? data.leaguePaceMonthly : [];
  if (paceSeries.length) {
    const totalPace = paceSeries.reduce((sum, entry) => sum + (entry.pace ?? 0), 0);
    const averagePace = totalPace / paceSeries.length;
    setStat('stat-pace-current', averagePace, (value) => helpers.formatNumber(value, 1));

    const first = paceSeries[0];
    const last = paceSeries[paceSeries.length - 1];
    const shift = first && last ? (last.pace ?? 0) - (first.pace ?? 0) : null;
    setStat('stat-pace-shift', shift, (value) => formatSigned(value, 1));

    const peak = paceSeries.reduce(
      (best, entry) => ((entry.pace ?? -Infinity) > (best?.pace ?? -Infinity) ? entry : best),
      null
    );
    const low = paceSeries.reduce(
      (worst, entry) => ((entry.pace ?? Infinity) < (worst?.pace ?? Infinity) ? entry : worst),
      null
    );
    const drop = peak && low ? (peak.pace ?? 0) - (low.pace ?? 0) : null;
    setStat('stat-pace-drop', drop, (value) => `${helpers.formatNumber(value, 1)} possessions`);
    setStat('stat-pace-low-season', low?.month, (value) => value);
  } else {
    setStat('stat-pace-current', null);
    setStat('stat-pace-shift', null);
    setStat('stat-pace-drop', null);
    setStat('stat-pace-low-season', null);
  }
}

function removeImpactLab() {
  const impactSection = document.querySelector('.impact-lab');
  if (impactSection) {
    impactSection.remove();
  }
}

function populateClutchInsights(data) {
  const composite = Array.isArray(data?.clutchComposite) ? data.clutchComposite : [];
  if (!composite.length) {
    removeImpactLab();
    return;
  }

  const leader = composite.reduce(
    (best, entry) => ((entry.index ?? -Infinity) > (best?.index ?? -Infinity) ? entry : best),
    null
  );
  setStat('stat-clutch-leader', leader?.player, (value) => value);
  setStat('stat-clutch-leader-index', leader?.index, (value) => helpers.formatNumber(value, 0));
  setStat('stat-clutch-leader-ts', leader?.trueShooting, (value) => `${helpers.formatNumber(value * 100, 1)}%`);
}

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

highlightDataPromise
  .then((data) => {
    setTimestamp('stat-highlight-updated', data?.generatedAt);
    populateHighlightPanels(data);
    populateClutchInsights(data);
  })
  .catch((error) => {
    console.error('Unable to hydrate rewind highlight data', error);
    setTimestamp('stat-highlight-updated', null);
    populateHighlightPanels({});
    removeImpactLab();
  });
