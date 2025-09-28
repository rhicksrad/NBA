import { registerCharts, helpers } from './hub-charts.js';

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

const accents = [palette.royal, palette.gold, palette.coral, palette.violet, palette.teal, '#9050d8', palette.sky, '#f48fb1'];

function createVerticalGradient(context, stops) {
  const { chart } = context;
  const { ctx, chartArea } = chart || {};
  if (!ctx || !chartArea) {
    return stops?.[0] ?? palette.sky;
  }
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  const colorStops = Array.isArray(stops) && stops.length ? stops : [palette.sky, 'rgba(31, 123, 255, 0.05)'];
  const step = 1 / Math.max(colorStops.length - 1, 1);
  colorStops.forEach((color, index) => {
    gradient.addColorStop(Math.min(index * step, 1), color);
  });
  return gradient;
}

registerCharts([
  {
    element: document.querySelector('[data-chart="league-heights"]'),
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
              backgroundColor: (context) =>
                createVerticalGradient(context, ['rgba(17, 86, 214, 0.45)', 'rgba(17, 86, 214, 0.05)']),
              tension: 0.32,
              pointRadius: 0,
              pointHoverRadius: 4,
              borderWidth: 2.5,
            },
          ],
        },
        options: {
          layout: { padding: { left: 4, right: 4, top: 8, bottom: 12 } },
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
              ticks: { maxRotation: 0, autoSkipPadding: 10 },
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
    element: document.querySelector('[data-chart="tallest-bubbles"]'),
    source: 'data/players_overview.json',
    async createConfig(data) {
      const players = Array.isArray(data?.tallestPlayers) ? data.tallestPlayers : [];
      if (!players.length) return null;
      const weighted = players.filter((player) => Number.isFinite(player?.weightPounds));
      const fallbackWeight = weighted.length
        ? weighted.reduce((sum, player) => sum + player.weightPounds, 0) / weighted.length
        : 280;

      const dataset = players.map((player, index) => {
        const height = Number.isFinite(player?.heightInches) ? player.heightInches : null;
        if (!height) {
          return null;
        }
        const listedWeight = Number.isFinite(player?.weightPounds) ? player.weightPounds : null;
        const weight = listedWeight ?? fallbackWeight;
        return {
          x: height,
          y: weight,
          r: Math.max(7, Math.sqrt(Math.max(weight - 200, 30)) * 1.4),
          player,
          listedWeight,
          backgroundColor: accents[index % accents.length],
        };
      });

      const points = dataset.filter(Boolean);
      if (!points.length) return null;

      return {
        type: 'bubble',
        data: {
          datasets: [
            {
              label: 'Height vs weight',
              data: points,
              parsing: false,
              backgroundColor: points.map((point) => point.backgroundColor),
              borderColor: 'rgba(11, 37, 69, 0.2)',
              borderWidth: 1,
              hoverBorderWidth: 2,
            },
          ],
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const { player, listedWeight } = context.raw || {};
                  if (!player) return null;
                  const height = helpers.formatNumber(player.heightInches, 0);
                  const weightText = listedWeight
                    ? `${helpers.formatNumber(listedWeight, 0)} lbs`
                    : 'weight not listed';
                  return `${player.name} · ${height}" · ${weightText}`;
                },
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: 'Height (inches)' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              min: 82,
              max: 92,
            },
            y: {
              title: { display: true, text: 'Weight (pounds)' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              suggestedMin: 190,
              suggestedMax: 370,
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
    element: document.querySelector('[data-chart="position-orbits"]'),
    source: 'data/players_overview.json',
    async createConfig(data) {
      const totals = data?.totals;
      const segments = [
        { label: 'Guards', value: totals?.guards ?? 0, color: palette.sky },
        { label: 'Forwards', value: totals?.forwards ?? 0, color: palette.violet },
        { label: 'Centers', value: totals?.centers ?? 0, color: palette.gold },
      ].filter((segment) => segment.value > 0);
      if (!segments.length) return null;
      const totalPlayers = segments.reduce((sum, segment) => sum + segment.value, 0);

      return {
        type: 'doughnut',
        data: {
          labels: segments.map((segment) => segment.label),
          datasets: [
            {
              data: segments.map((segment) => segment.value),
              backgroundColor: segments.map((segment) => segment.color),
              borderColor: '#ffffff',
              borderWidth: 2,
              hoverOffset: 12,
            },
          ],
        },
        options: {
          cutout: '55%',
          layout: { padding: { top: 10, bottom: 10, left: 6, right: 6 } },
          plugins: {
            legend: {
              position: 'right',
              labels: { usePointStyle: true, padding: 16 },
            },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = context.parsed;
                  const share = totalPlayers ? (value / totalPlayers) * 100 : 0;
                  return `${context.label}: ${helpers.formatNumber(value, 0)} players (${helpers.formatNumber(share, 1)}%)`;
                },
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="country-spectrum"]'),
    source: 'data/players_overview.json',
    async createConfig(data) {
      const allCountries = Array.isArray(data?.countries) ? data.countries : [];
      const international = allCountries.filter((entry) => (entry?.country || '').toLowerCase() !== 'usa');
      const countries = helpers.rankAndSlice(international, 7, (item) => item.players);
      if (!countries.length) return null;

      return {
        type: 'polarArea',
        data: {
          labels: countries.map((country) => country.country),
          datasets: [
            {
              data: countries.map((country) => country.players),
              backgroundColor: countries.map((_, index) => accents[index % accents.length]),
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.6)',
            },
          ],
        },
        options: {
          scales: {
            r: {
              ticks: { display: false },
              grid: { color: 'rgba(11, 37, 69, 0.12)' },
            },
          },
          plugins: {
            legend: { position: 'right' },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed, 0)} players`;
                },
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="college-pipeline"]'),
    source: 'data/players_overview.json',
    async createConfig(data) {
      const colleges = helpers.rankAndSlice(Array.isArray(data?.colleges) ? data.colleges : [], 8, (item) => item.players);
      if (!colleges.length) return null;
      const labels = colleges.map((college) => college.program);
      const totals = colleges.map((college) => college.players);

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Players',
              data: totals,
              borderRadius: 12,
              borderSkipped: false,
              backgroundColor: (context) =>
                createVerticalGradient(context, ['rgba(244, 181, 63, 0.75)', 'rgba(239, 61, 91, 0.35)']),
            },
          ],
        },
        options: {
          indexAxis: 'y',
          layout: { padding: { top: 6, bottom: 6, left: 4, right: 4 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed.x, 0)} players`;
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
    element: document.querySelector('[data-chart="draft-timeline"]'),
    source: 'data/players_overview.json',
    async createConfig(data) {
      const decadeCounts = Array.isArray(data?.draftSummary?.decadeCounts)
        ? data.draftSummary.decadeCounts.filter((entry) => /\d{4}s/.test(entry.decade))
        : [];
      if (!decadeCounts.length) return null;
      const trimmed = helpers.evenSample(decadeCounts, 16);
      const labels = trimmed.map((entry) => entry.decade);
      const drafted = trimmed.map((entry) => entry.players);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Drafted players',
              data: drafted,
              fill: true,
              borderColor: palette.teal,
              backgroundColor: (context) =>
                createVerticalGradient(context, ['rgba(17, 181, 198, 0.45)', 'rgba(17, 181, 198, 0.05)']),
              tension: 0.28,
              pointRadius: 3,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          interaction: { mode: 'index', intersect: false },
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
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.1)' },
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
    element: document.querySelector('[data-chart="season-trends"]'),
    source: 'data/player_season_insights.json',
    async createConfig(data) {
      const seasons = Array.isArray(data?.seasonTrends) ? data.seasonTrends : [];
      if (!seasons.length) return null;
      const labels = seasons.map((entry) => entry.season);
      const points = seasons.map((entry) => entry.avgPoints ?? 0);
      const assists = seasons.map((entry) => entry.avgAssists ?? 0);
      const rebounds = seasons.map((entry) => entry.avgRebounds ?? 0);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Points per game',
              data: points,
              borderColor: palette.coral,
              backgroundColor: 'rgba(239, 61, 91, 0.08)',
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 3,
            },
            {
              label: 'Assists per game',
              data: assists,
              borderColor: palette.sky,
              backgroundColor: 'rgba(31, 123, 255, 0.08)',
              tension: 0.3,
              borderDash: [6, 4],
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 3,
            },
            {
              label: 'Rebounds per game',
              data: rebounds,
              borderColor: palette.gold,
              backgroundColor: 'rgba(244, 181, 63, 0.12)',
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 3,
            },
          ],
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: {
            tooltip: {
              callbacks: {
                title(contexts) {
                  if (!contexts?.length) return '';
                  return `Season ${contexts[0].label}`;
                },
                label(context) {
                  return `${context.dataset.label}: ${helpers.formatNumber(context.parsed.y, 2)}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(11, 37, 69, 0.05)' },
              ticks: {
                maxRotation: 0,
                callback(value, index, values) {
                  const label = labels[index];
                  return index % 5 === 0 ? label : '';
                },
              },
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="triple-double-cloud"]'),
    source: 'data/player_season_insights.json',
    async createConfig(data) {
      const leaders = helpers.rankAndSlice(Array.isArray(data?.tripleDoubleLeaders) ? data.tripleDoubleLeaders : [], 12, (item) => item.tripleDoubles ?? 0);
      if (!leaders.length) return null;

      const points = leaders.map((leader, index) => {
        const start = Number.isFinite(leader?.careerSpan?.start) ? leader.careerSpan.start : leader?.bestSeason?.season;
        const end = Number.isFinite(leader?.careerSpan?.end) ? leader.careerSpan.end : leader?.bestSeason?.season;
        const midpoint = Number.isFinite(start) && Number.isFinite(end) ? (start + end) / 2 : start ?? end;
        return {
          x: midpoint,
          y: leader.tripleDoubles ?? 0,
          r: Math.max(9, Math.sqrt(leader.seasonsWithTripleDouble ?? 1) * 4.2),
          leader,
          backgroundColor: accents[index % accents.length],
        };
      });

      return {
        type: 'bubble',
        data: {
          datasets: [
            {
              label: 'Career triple-doubles',
              data: points,
              parsing: false,
              backgroundColor: points.map((point) => point.backgroundColor),
              borderColor: 'rgba(11, 37, 69, 0.2)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const { leader } = context.raw || {};
                  if (!leader) return null;
                  const seasons = leader.seasonsWithTripleDouble ?? 0;
                  const spanStart = leader?.careerSpan?.start;
                  const spanEnd = leader?.careerSpan?.end;
                  const spanText = spanStart && spanEnd ? `${spanStart}–${spanEnd}` : leader?.bestSeason?.season;
                  return `${leader.name}: ${helpers.formatNumber(leader.tripleDoubles ?? 0, 0)} triple-doubles · ${helpers.formatNumber(seasons, 0)} seasons · ${spanText}`;
                },
              },
            },
          },
          scales: {
            x: {
              type: 'linear',
              title: { display: true, text: 'Career span midpoint' },
              grid: { color: 'rgba(11, 37, 69, 0.06)' },
              suggestedMin: 1955,
              suggestedMax: 2030,
            },
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Total triple-doubles' },
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
    element: document.querySelector('[data-chart="scoring-eruptions"]'),
    source: 'data/player_leaders.json',
    async createConfig(data) {
      const games = Array.isArray(data?.singleGameHighs?.points) ? data.singleGameHighs.points.slice(0, 20) : [];
      if (!games.length) return null;
      const points = games.map((game, index) => {
        const rebounds = Number.isFinite(game?.rebounds) ? game.rebounds : 0;
        const assists = Number.isFinite(game?.assists) ? game.assists : 0;
        return {
          x: Number(game?.minutes) || 0,
          y: Number(game?.points) || 0,
          r: Math.max(6, Math.sqrt(rebounds + assists + 1) * 2.4),
          game,
          backgroundColor: accents[index % accents.length],
        };
      });

      return {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Single game highs',
              data: points,
              parsing: false,
              pointBackgroundColor: points.map((point) => point.backgroundColor),
              pointBorderColor: 'rgba(11, 37, 69, 0.2)',
              pointBorderWidth: 1,
              pointHoverBorderWidth: 2,
            },
          ],
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const { game } = context.raw || {};
                  if (!game) return null;
                  const rebounds = helpers.formatNumber(game.rebounds ?? 0, 0);
                  const assists = helpers.formatNumber(game.assists ?? 0, 0);
                  const minutes = helpers.formatNumber(game.minutes ?? 0, 0);
                  const date = game.gameDate ? new Date(game.gameDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown date';
                  return `${game.name} · ${helpers.formatNumber(game.points ?? 0, 0)} pts · ${rebounds} reb · ${assists} ast · ${minutes} min (${date})`;
                },
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: 'Minutes played' },
              grid: { color: 'rgba(11, 37, 69, 0.05)' },
            },
            y: {
              title: { display: true, text: 'Points scored' },
              beginAtZero: false,
              suggestedMin: 40,
              suggestedMax: 110,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="career-constellation"]'),
    source: 'data/player_leaders.json',
    async createConfig(data) {
      const leaders = (Array.isArray(data?.careerLeaders?.points) ? data.careerLeaders.points : []).slice(0, 4);
      if (!leaders.length) return null;
      const metrics = [
        { key: 'pointsPerGame', label: 'Points/G', formatter: (value) => `${helpers.formatNumber(value, 2)} PPG` },
        { key: 'assistsPerGame', label: 'Assists/G', formatter: (value) => `${helpers.formatNumber(value, 2)} APG` },
        { key: 'reboundsPerGame', label: 'Rebounds/G', formatter: (value) => `${helpers.formatNumber(value, 2)} RPG` },
        { key: 'winPct', label: 'Win %', formatter: (value) => `${helpers.formatNumber((value ?? 0) * 100, 1)}% win` },
      ];

      const maxima = metrics.map((metric) =>
        leaders.reduce((max, leader) => Math.max(max, Number(leader?.[metric.key]) || 0), 0)
      );
      if (!maxima.some((value) => value > 0)) return null;

      const datasets = leaders.map((leader, index) => {
        const rawValues = metrics.map((metric) => Number(leader?.[metric.key]) || 0);
        return {
          label: leader.name,
          data: rawValues.map((value, metricIndex) =>
            Number(((value / (maxima[metricIndex] || 1)) * 100).toFixed(2))
          ),
          rawValues,
          borderColor: accents[index % accents.length],
          backgroundColor: `${accents[index % accents.length]}29`,
          borderWidth: 2,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
        };
      });

      return {
        type: 'radar',
        data: {
          labels: metrics.map((metric) => metric.label),
          datasets,
        },
        options: {
          scales: {
            r: {
              angleLines: { color: 'rgba(11, 37, 69, 0.12)' },
              grid: { color: 'rgba(11, 37, 69, 0.12)' },
              suggestedMin: 0,
              suggestedMax: 105,
              ticks: { display: false },
            },
          },
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label(context) {
                  const dataset = context.dataset;
                  const metric = metrics[context.dataIndex];
                  const rawValue = dataset.rawValues?.[context.dataIndex] ?? 0;
                  return `${dataset.label}: ${metric.formatter(rawValue)}`;
                },
              },
            },
          },
        },
      };
    },
  },
]);
