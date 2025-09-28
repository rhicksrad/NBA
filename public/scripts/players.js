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

function formatPercentile(value) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const rounded = Math.max(0, Math.min(100, Math.round(value)));
  const teens = rounded % 100;
  if (teens >= 11 && teens <= 13) {
    return `${rounded}th`;
  }
  const last = rounded % 10;
  if (last === 1) return `${rounded}st`;
  if (last === 2) return `${rounded}nd`;
  if (last === 3) return `${rounded}rd`;
  return `${rounded}th`;
}

function simplifyText(value) {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function buildPlayerTokens(player) {
  const tokens = new Set();
  const push = (text) => {
    const simplified = simplifyText(text);
    if (!simplified) return;
    tokens.add(simplified);
    simplified
      .split(/\s+/)
      .filter(Boolean)
      .forEach((part) => tokens.add(part));
  };
  push(player?.name);
  push(player?.team);
  push(player?.position);
  push(player?.era);
  push(player?.origin);
  push(player?.archetype);
  if (Array.isArray(player?.keywords)) {
    player.keywords.forEach(push);
  }
  return Array.from(tokens);
}

function initPlayerAtlas() {
  const atlas = document.querySelector('[data-player-profiles]');
  if (!atlas) {
    return;
  }

  const searchInput = atlas.querySelector('[data-player-search]');
  const clearButton = atlas.querySelector('[data-player-clear]');
  const resultsList = atlas.querySelector('[data-player-results]');
  const hint = atlas.querySelector('[data-player-hint]');
  const empty = atlas.querySelector('[data-player-empty]');
  const error = atlas.querySelector('[data-player-error]');
  const profile = atlas.querySelector('[data-player-profile]');
  const nameEl = atlas.querySelector('[data-player-name]');
  const metaEl = atlas.querySelector('[data-player-meta]');
  const goatEl = atlas.querySelector('[data-player-goat]');
  const bioEl = atlas.querySelector('[data-player-bio]');
  const archetypeEl = atlas.querySelector('[data-player-archetype]');
  const vitalsEl = atlas.querySelector('[data-player-vitals]');
  const originEl = atlas.querySelector('[data-player-origin]');
  const draftEl = atlas.querySelector('[data-player-draft]');
  const metricsContainer = atlas.querySelector('[data-player-metrics]');
  const metricsEmpty = atlas.querySelector('[data-player-metrics-empty]');

  if (!searchInput || !resultsList || !profile || !nameEl || !metaEl || !goatEl || !bioEl || !archetypeEl) {
    return;
  }

  let catalog = [];
  let players = [];
  let matches = [];
  let activeIndex = -1;
  let isLoaded = false;
  let hasError = false;
  const defaultEmptyText = empty?.textContent?.trim() ?? '';

  const setClearVisibility = (value) => {
    if (!clearButton) return;
    clearButton.hidden = !value;
  };

  const setResultsVisibility = (isVisible) => {
    resultsList.hidden = !isVisible;
    searchInput.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
    if (!isVisible) {
      searchInput.removeAttribute('aria-activedescendant');
    }
  };

  const resetStatusMessages = () => {
    if (hint) hint.hidden = false;
    if (empty) empty.hidden = true;
    if (error) error.hidden = true;
  };

  const renderMeta = (player) => {
    const parts = [];
    if (player?.position) parts.push(player.position);
    if (player?.team) parts.push(player.team);
    if (player?.era) parts.push(`${player.era} era`);
    return parts.join(' · ');
  };

  const renderVitals = (player) => {
    const vitals = [];
    if (player?.height) vitals.push(player.height);
    if (player?.weight) vitals.push(player.weight);
    return vitals.join(' • ');
  };

  const updateActiveOption = () => {
    const buttons = resultsList.querySelectorAll('[data-player-id]');
    buttons.forEach((button, index) => {
      const isActive = index === activeIndex;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) {
        searchInput.setAttribute('aria-activedescendant', button.id);
        button.scrollIntoView({ block: 'nearest' });
      }
    });
    if (!buttons.length || activeIndex < 0) {
      searchInput.removeAttribute('aria-activedescendant');
    }
  };

  const renderResults = (query) => {
    const trimmed = query.trim();
    setClearVisibility(trimmed.length > 0);
    if (!trimmed) {
      matches = [];
      activeIndex = -1;
      resultsList.innerHTML = '';
      setResultsVisibility(false);
      resetStatusMessages();
      searchInput.removeAttribute('aria-activedescendant');
      return;
    }

    if (!isLoaded && !hasError) {
      matches = [];
      activeIndex = -1;
      setResultsVisibility(false);
      if (hint) hint.hidden = true;
      if (empty) {
        empty.hidden = false;
        empty.textContent = 'Loading player atlas…';
      }
      return;
    }

    const normalized = simplifyText(trimmed);
    const terms = normalized.split(/\s+/).filter(Boolean);

    const found = players
      .map((player) => {
        let score = 0;
        if (player.nameToken?.startsWith(normalized)) {
          score += 6;
        }
        if (player.nameToken === normalized) {
          score += 12;
        }
        terms.forEach((term) => {
          player.searchTokens.forEach((token) => {
            if (token === term) {
              score += 5;
            } else if (token.startsWith(term)) {
              score += 3;
            } else if (token.includes(term)) {
              score += 1;
            }
          });
        });
        return { player, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.player.name.localeCompare(b.player.name);
      })
      .slice(0, 8)
      .map((entry) => entry.player);

    matches = found;
    resultsList.innerHTML = '';

    if (!matches.length) {
      activeIndex = -1;
      setResultsVisibility(false);
      if (hint) hint.hidden = true;
      if (empty) {
        empty.hidden = false;
        empty.textContent = defaultEmptyText;
      }
      searchInput.removeAttribute('aria-activedescendant');
      return;
    }

    if (hint) hint.hidden = true;
    if (empty) empty.hidden = true;
    activeIndex = 0;

    matches.forEach((player) => {
      const item = document.createElement('li');
      const optionId = `player-atlas-option-${player.id}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.id = optionId;
      button.className = 'player-atlas__result';
      button.dataset.playerId = player.id;
      button.setAttribute('role', 'option');

      const name = document.createElement('span');
      name.className = 'player-atlas__result-name';
      name.textContent = player.name;

      const meta = document.createElement('span');
      meta.className = 'player-atlas__result-meta';
      const metaText = [player.team, player.era ? `${player.era} era` : null].filter(Boolean).join(' • ');
      if (metaText) {
        meta.textContent = metaText;
      }

      button.append(name);
      if (metaText) {
        button.append(meta);
      }
      item.append(button);
      resultsList.append(item);
    });

    setResultsVisibility(true);
    updateActiveOption();
  };

  const renderMetrics = (player) => {
    if (!metricsContainer) return;
    metricsContainer.innerHTML = '';
    let hasMetric = false;

    catalog.forEach((metric) => {
      const wrapper = document.createElement('figure');
      wrapper.className = 'player-metric';

      const header = document.createElement('header');
      header.className = 'player-metric__header';

      const label = document.createElement('span');
      label.className = 'player-metric__label';
      label.textContent = metric.label;

      const valueEl = document.createElement('span');
      valueEl.className = 'player-metric__value';

      const percentile = Number(player?.metrics?.[metric.id]?.value);
      const hasValue = Number.isFinite(percentile);
      if (hasValue) {
        const formatted = formatPercentile(percentile);
        const suffix = document.createElement('span');
        suffix.textContent = 'percentile';
        valueEl.append(formatted, suffix);
        hasMetric = true;
      } else {
        valueEl.textContent = '—';
      }

      header.append(label, valueEl);

      const meter = document.createElement('div');
      meter.className = 'player-metric__meter';
      if (hasValue) {
        const fill = document.createElement('span');
        fill.style.setProperty('--fill', `${Math.max(0, Math.min(100, Math.round(percentile)))}%`);
        meter.appendChild(fill);
        meter.setAttribute('role', 'img');
        meter.setAttribute('aria-label', `${metric.label}: ${formatPercentile(percentile)} percentile`);
      } else {
        meter.classList.add('player-metric__meter--empty');
        meter.setAttribute('role', 'img');
        meter.setAttribute('aria-label', `${metric.label}: percentile unavailable`);
      }

      const description = document.createElement('p');
      description.className = 'player-metric__description';
      const note = player?.metrics?.[metric.id]?.note;
      description.textContent = note || metric.description;

      wrapper.append(header, meter, description);
      metricsContainer.appendChild(wrapper);
    });

    if (metricsEmpty) {
      metricsEmpty.hidden = hasMetric;
    }
  };

  const selectPlayer = (player) => {
    if (!player) return;
    searchInput.value = player.name;
    setClearVisibility(true);
    matches = [];
    activeIndex = -1;
    resultsList.innerHTML = '';
    setResultsVisibility(false);
    if (hint) hint.hidden = true;
    if (empty) empty.hidden = true;

    profile.hidden = false;
    profile.dataset.playerId = player.id;
    nameEl.textContent = player.name;
    metaEl.textContent = renderMeta(player);
    goatEl.textContent = Number.isFinite(player?.goatScore)
      ? helpers.formatNumber(player.goatScore, 1)
      : '—';
    bioEl.textContent = player?.bio || '';
    archetypeEl.textContent = player?.archetype || '—';
    if (vitalsEl) {
      const vitals = renderVitals(player);
      vitalsEl.textContent = vitals || '—';
    }
    if (originEl) {
      originEl.textContent = player?.origin || player?.born || '—';
    }
    if (draftEl) {
      draftEl.textContent = player?.draft || '—';
    }

    renderMetrics(player);
    if (metricsContainer && metricsContainer.children.length) {
      metricsContainer.scrollTop = 0;
    }
    profile.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleInput = (event) => {
    renderResults(event.target.value || '');
  };

  const handleKeydown = (event) => {
    if (!matches.length) {
      if (event.key === 'Escape' && searchInput.value) {
        searchInput.value = '';
        renderResults('');
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % matches.length;
      updateActiveOption();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + matches.length) % matches.length;
      updateActiveOption();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && matches[activeIndex]) {
        selectPlayer(matches[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setResultsVisibility(false);
      matches = [];
      activeIndex = -1;
      resultsList.innerHTML = '';
      searchInput.removeAttribute('aria-activedescendant');
    }
  };

  const handleResultsClick = (event) => {
    const button = event.target.closest('[data-player-id]');
    if (!button) return;
    const playerId = button.dataset.playerId;
    const player = players.find((item) => item.id === playerId);
    selectPlayer(player);
  };

  const handleClear = () => {
    searchInput.value = '';
    searchInput.focus();
    setClearVisibility(false);
    renderResults('');
  };

  const hydrate = async () => {
    try {
      const response = await fetch('data/player_profiles.json');
      if (!response.ok) {
        throw new Error(`Failed to load player profiles: ${response.status}`);
      }
      const data = await response.json();
      catalog = Array.isArray(data?.metrics) ? data.metrics : [];
      const roster = Array.isArray(data?.players) ? data.players : [];
      players = roster.map((player) => ({
        ...player,
        searchTokens: buildPlayerTokens(player),
        nameToken: simplifyText(player?.name),
      }));
      isLoaded = true;
      hasError = false;
      if (empty) {
        empty.textContent = defaultEmptyText;
      }
      if (!players.length) {
        if (hint) hint.hidden = true;
        if (empty) {
          empty.hidden = false;
          empty.textContent = 'Player profiles are temporarily unavailable.';
        }
        searchInput.disabled = true;
        setClearVisibility(false);
      }
    } catch (err) {
      console.error(err);
      hasError = true;
      if (error) {
        error.hidden = false;
        error.textContent = 'Unable to load the scouting atlas right now. Please refresh the page to try again.';
      }
      if (hint) hint.hidden = true;
      searchInput.disabled = true;
      setClearVisibility(false);
    }
  };

  hydrate();

  searchInput.addEventListener('input', handleInput);
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) {
      renderResults(searchInput.value);
    }
  });
  searchInput.addEventListener('keydown', handleKeydown);

  if (resultsList) {
    resultsList.addEventListener('mousedown', (event) => {
      // Prevent the input from losing focus before click handlers run.
      event.preventDefault();
    });
    resultsList.addEventListener('click', handleResultsClick);
  }

  if (clearButton) {
    clearButton.addEventListener('click', handleClear);
  }

  document.addEventListener('click', (event) => {
    if (!atlas.contains(event.target)) {
      setResultsVisibility(false);
    }
  });
}

initPlayerAtlas();
