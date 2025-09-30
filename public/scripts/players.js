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

const atlasMetricBlueprint = {
  'offensive-creation': {
    extract(context) {
      const value = context.components?.impact;
      return Number.isFinite(value) ? value : null;
    },
    describe(context) {
      const value = context.components?.impact;
      if (Number.isFinite(value)) {
        return `Impact pillar graded at ${helpers.formatNumber(value, 1)} GOAT points.`;
      }
      return 'Impact pillar percentile unavailable.';
    },
  },
  'half-court-shotmaking': {
    extract(context) {
      const value = context.components?.stage;
      return Number.isFinite(value) ? value : null;
    },
    describe(context) {
      const value = context.components?.stage;
      if (Number.isFinite(value)) {
        return `Stage pillar captures ${helpers.formatNumber(value, 1)} GOAT points of playoff shotmaking.`;
      }
      return 'Stage pillar percentile unavailable.';
    },
  },
  'passing-vision': {
    extract(context) {
      const value = context.components?.versatility;
      return Number.isFinite(value) ? value : null;
    },
    describe(context) {
      const value = context.components?.versatility;
      if (Number.isFinite(value)) {
        return `Versatility pillar logs ${helpers.formatNumber(value, 1)} GOAT points of creation.`;
      }
      return 'Versatility pillar percentile unavailable.';
    },
  },
  'rim-pressure': {
    extract(context) {
      const impact = context.components?.impact;
      const culture = context.components?.culture;
      if (Number.isFinite(impact) && Number.isFinite(culture)) {
        return impact * 0.75 + culture * 0.25;
      }
      if (Number.isFinite(impact)) {
        return impact;
      }
      if (Number.isFinite(culture)) {
        return culture;
      }
      return null;
    },
    describe(context) {
      const impact = Number.isFinite(context.components?.impact)
        ? helpers.formatNumber(context.components.impact, 1)
        : null;
      const culture = Number.isFinite(context.components?.culture)
        ? helpers.formatNumber(context.components.culture, 1)
        : null;
      if (impact && culture) {
        return `Blend of impact (${impact}) and culture (${culture}) GOAT points fuels rim pressure.`;
      }
      if (impact) {
        return `Impact pillar at ${impact} GOAT points drives rim pressure.`;
      }
      if (culture) {
        return `Culture pillar at ${culture} GOAT points steadies rim pressure.`;
      }
      return 'Rim pressure percentile unavailable.';
    },
  },
  'rebound-dominance': {
    extract(context) {
      const impact = context.components?.impact;
      const longevity = context.components?.longevity;
      if (Number.isFinite(longevity) && Number.isFinite(impact)) {
        return longevity * 0.6 + impact * 0.4;
      }
      if (Number.isFinite(longevity)) {
        return longevity;
      }
      if (Number.isFinite(impact)) {
        return impact;
      }
      return null;
    },
    describe(context) {
      const impact = Number.isFinite(context.components?.impact)
        ? helpers.formatNumber(context.components.impact, 1)
        : null;
      const longevity = Number.isFinite(context.components?.longevity)
        ? helpers.formatNumber(context.components.longevity, 1)
        : null;
      if (longevity && impact) {
        return `Longevity (${longevity}) and impact (${impact}) GOAT scores anchor the glass profile.`;
      }
      if (longevity) {
        return `Longevity pillar at ${longevity} GOAT points highlights sustained board work.`;
      }
      if (impact) {
        return `Impact pillar at ${impact} GOAT points fuels board dominance.`;
      }
      return 'Rebound dominance percentile unavailable.';
    },
  },
  'defensive-playmaking': {
    extract(context) {
      const value = context.components?.culture;
      return Number.isFinite(value) ? value : null;
    },
    describe(context) {
      const value = context.components?.culture;
      if (Number.isFinite(value)) {
        return `Culture pillar contributes ${helpers.formatNumber(value, 1)} GOAT points of defensive playmaking.`;
      }
      return 'Defensive playmaking percentile unavailable.';
    },
  },
  'post-efficiency': {
    extract(context) {
      const value = context.components?.stage;
      return Number.isFinite(value) ? value : null;
    },
    describe(context) {
      const value = context.components?.stage;
      if (Number.isFinite(value)) {
        return `Stage pillar at ${helpers.formatNumber(value, 1)} GOAT points reflects postseason post craft.`;
      }
      return 'Post efficiency percentile unavailable.';
    },
  },
  'stretch-gravity': {
    extract(context) {
      const value = context.components?.versatility;
      return Number.isFinite(value) ? value : null;
    },
    describe(context) {
      const value = context.components?.versatility;
      if (Number.isFinite(value)) {
        return `Versatility pillar logged at ${helpers.formatNumber(value, 1)} GOAT points.`;
      }
      return 'Stretch gravity percentile unavailable.';
    },
  },
  'tempo-control': {
    extract(context) {
      const parts = [];
      if (Number.isFinite(context.components?.versatility)) {
        parts.push(context.components.versatility * 0.45);
      }
      if (Number.isFinite(context.components?.culture)) {
        parts.push(context.components.culture * 0.35);
      }
      if (Number.isFinite(context.winPct)) {
        parts.push(context.winPct * 40);
      }
      if (!parts.length) {
        return null;
      }
      return parts.reduce((sum, value) => sum + value, 0);
    },
    describe(context) {
      const winPct = Number.isFinite(context.winPct) ? helpers.formatNumber(context.winPct * 100, 1) : null;
      const versatility = Number.isFinite(context.components?.versatility)
        ? helpers.formatNumber(context.components.versatility, 1)
        : null;
      if (winPct && versatility) {
        return `Versatility (${versatility}) GOAT points plus a ${winPct}% win rate steer tempo.`;
      }
      if (versatility) {
        return `Versatility pillar at ${versatility} GOAT points anchors pace control.`;
      }
      if (winPct) {
        return `Career win rate of ${winPct}% keeps possessions in command.`;
      }
      return 'Tempo control percentile unavailable.';
    },
  },
  'clutch-index': {
    extract(context) {
      const stage = Number.isFinite(context.components?.stage) ? context.components.stage : null;
      const playoff = Number.isFinite(context.playoffWinPct) ? context.playoffWinPct * 40 : null;
      if (stage !== null && playoff !== null) {
        return stage * 0.55 + playoff;
      }
      if (stage !== null) {
        return stage;
      }
      if (playoff !== null) {
        return playoff;
      }
      return null;
    },
    describe(context) {
      const stage = Number.isFinite(context.components?.stage)
        ? helpers.formatNumber(context.components.stage, 1)
        : null;
      const playoff = Number.isFinite(context.playoffWinPct)
        ? helpers.formatNumber(context.playoffWinPct * 100, 1)
        : null;
      if (stage && playoff) {
        return `Stage pillar (${stage}) and ${playoff}% playoff win clip highlight clutch DNA.`;
      }
      if (stage) {
        return `Stage pillar at ${stage} GOAT points drives late-game shotmaking.`;
      }
      if (playoff) {
        return `Playoff win rate of ${playoff}% underscores clutch pedigree.`;
      }
      return 'Clutch index percentile unavailable.';
    },
  },
  'durability-index': {
    extract(context) {
      const longevity = Number.isFinite(context.components?.longevity) ? context.components.longevity : null;
      const seasons = Number.isFinite(context.careerSeasons) ? context.careerSeasons : null;
      if (longevity !== null && seasons !== null) {
        return longevity * 0.6 + seasons * 0.4;
      }
      if (longevity !== null) {
        return longevity;
      }
      if (seasons !== null) {
        return seasons;
      }
      return null;
    },
    describe(context) {
      const longevity = Number.isFinite(context.components?.longevity)
        ? helpers.formatNumber(context.components.longevity, 1)
        : null;
      const seasons = Number.isFinite(context.careerSeasons)
        ? helpers.formatNumber(context.careerSeasons, 0)
        : null;
      if (longevity && seasons) {
        return `Longevity (${longevity}) GOAT points across ${seasons} seasons underline availability.`;
      }
      if (longevity) {
        return `Longevity pillar at ${longevity} GOAT points tracks the mileage.`;
      }
      if (seasons) {
        return `${seasons} seasons logged keep durability near the top of the class.`;
      }
      return 'Durability percentile unavailable.';
    },
  },
  'processing-speed': {
    extract(context) {
      const versatility = Number.isFinite(context.components?.versatility) ? context.components.versatility : null;
      const impact = Number.isFinite(context.components?.impact) ? context.components.impact : null;
      const delta = Number.isFinite(context.delta) ? context.delta : null;
      if (versatility === null && impact === null && delta === null) {
        return null;
      }
      const base = (versatility ?? 0) * 0.5 + (impact ?? 0) * 0.35;
      const momentum = delta !== null ? (delta + 5) * 2 : 0;
      const total = base + momentum;
      return total || base || momentum || null;
    },
    describe(context) {
      const versatility = Number.isFinite(context.components?.versatility)
        ? helpers.formatNumber(context.components.versatility, 1)
        : null;
      const delta = Number.isFinite(context.delta) ? helpers.formatNumber(context.delta, 1) : null;
      if (versatility && delta) {
        return `Versatility (${versatility}) GOAT points and a ${delta} season delta speed up reads.`;
      }
      if (versatility) {
        return `Versatility pillar at ${versatility} GOAT points captures processing feel.`;
      }
      if (delta) {
        return `Season-over-season delta of ${delta} fuels processing momentum.`;
      }
      return 'Processing speed percentile unavailable.';
    },
  },
};

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

function normalizeName(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function renderRecentLeaderboard(records, listElement, placeholderElement) {
  if (!listElement) {
    return;
  }

  listElement.innerHTML = '';

  if (!Array.isArray(records) || !records.length) {
    listElement.hidden = true;
    if (placeholderElement) {
      placeholderElement.hidden = false;
    }
    return;
  }

  listElement.hidden = false;
  if (placeholderElement) {
    placeholderElement.hidden = true;
  }

  records.forEach((player) => {
    const item = document.createElement('li');
    item.className = 'players-rankings__item';

    const rank = document.createElement('span');
    rank.className = 'players-rankings__rank';
    rank.textContent = Number.isFinite(player?.rank) ? player.rank : '—';

    const body = document.createElement('div');
    body.className = 'players-rankings__body';

    const title = document.createElement('strong');
    const displayName = player?.displayName || player?.name || '—';
    const team = player?.team;
    title.textContent = team ? `${displayName} — ${team}` : displayName;

    const note = document.createElement('span');
    note.textContent = player?.blurb || '';

    body.append(title, note);
    item.append(rank, body);
    listElement.appendChild(item);
  });
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

function extractPersonIdFromProfile(player) {
  if (!player) return null;
  const rawId = typeof player.id === 'string' ? player.id : null;
  if (rawId) {
    const match = rawId.match(/(\d{4,})$/);
    if (match) {
      return match[1];
    }
  }
  if (Array.isArray(player.keywords)) {
    const keywordId = player.keywords.find((keyword) => /^(\d{4,})$/.test(keyword));
    if (keywordId) {
      return keywordId;
    }
  }
  return null;
}

function buildGoatScoreLookup(indexSource, recentSource) {
  const byId = new Map();
  const byName = new Map();
  const entries = new Map();

  if (Array.isArray(indexSource?.players)) {
    indexSource.players.forEach((player) => {
      if (!player?.name) {
        return;
      }
      const nameKey = normalizeName(player.name);
      if (!nameKey) {
        return;
      }
      const entry = entries.get(nameKey) ?? { name: player.name, nameKey };
      if (player?.personId) {
        entry.personId = String(player.personId);
      }
      entry.historical = Number.isFinite(player.goatScore) ? player.goatScore : null;
      entry.historicalRank = Number.isFinite(player.rank) ? player.rank : null;
      entry.resume = player.resume ?? entry.resume;
      entry.tier = player.tier ?? entry.tier;
      entry.delta = Number.isFinite(player.delta) ? player.delta : entry.delta;
      entry.franchises = Array.isArray(player.franchises) ? player.franchises : entry.franchises;
      entries.set(nameKey, entry);
    });
  }

  let leaderboard = [];
  if (Array.isArray(recentSource?.players)) {
    leaderboard = recentSource.players
      .map((player) => {
        if (!player) {
          return null;
        }
        const nameKey = normalizeName(player.name);
        if (!nameKey) {
          return null;
        }
        const entry = entries.get(nameKey) ?? { name: player.name, nameKey };
        entry.personId = player.personId ?? entry.personId;
        entry.recent = Number.isFinite(player.score) ? player.score : null;
        entry.recentRank = Number.isFinite(player.rank) ? player.rank : null;
        entries.set(nameKey, entry);

        return {
          rank: Number.isFinite(player.rank) ? player.rank : null,
          name: player.name,
          displayName: player.displayName ?? player.name,
          team: player.team ?? null,
          franchise: player.franchise ?? null,
          blurb: player.blurb ?? '',
          score: Number.isFinite(player.score) ? player.score : null,
          personId: player.personId ?? null,
        };
      })
      .filter((player) => player && Number.isFinite(player.rank))
      .sort((a, b) => a.rank - b.rank);
  }

  entries.forEach((entry) => {
    if (entry.personId) {
      byId.set(entry.personId, entry);
    }
    if (entry.nameKey) {
      byName.set(entry.nameKey, entry);
    }
  });

  return { byId, byName, recent: leaderboard };
}

function parseSeasonRange(range) {
  if (typeof range !== 'string') {
    return null;
  }
  const match = range.match(/(\d{4})\s*-\s*(\d{4})/);
  if (!match) {
    return null;
  }
  const start = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[2], 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return end - start + 1;
}

function buildAtlasMetrics(catalog, goatSource) {
  const byId = new Map();
  const byName = new Map();

  if (!Array.isArray(catalog) || !catalog.length || !Array.isArray(goatSource?.players)) {
    return { byId, byName };
  }

  const metrics = catalog
    .map((metric) => {
      const config = atlasMetricBlueprint[metric.id];
      if (!config) {
        return null;
      }
      return { id: metric.id, config };
    })
    .filter(Boolean);

  if (!metrics.length) {
    return { byId, byName };
  }

  const toNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const rawBuckets = new Map();
  metrics.forEach((metric) => rawBuckets.set(metric.id, []));

  const playerRecords = [];

  goatSource.players.forEach((player) => {
    if (!player) return;
    const personId = player.personId ? String(player.personId) : null;
    const nameKey = normalizeName(player.name);
    const componentSource = player.goatComponents || {};
    const components = {};
    ['impact', 'stage', 'longevity', 'versatility', 'culture'].forEach((key) => {
      const value = toNumber(componentSource[key]);
      if (value !== null) {
        components[key] = value;
      }
    });
    const context = {
      entry: player,
      components,
      winPct: toNumber(player.winPct),
      playoffWinPct: toNumber(player.playoffWinPct),
      delta: toNumber(player.delta),
      goatScore: toNumber(player.goatScore),
      careerSeasons: parseSeasonRange(player.careerSpan),
      primeSeasons: parseSeasonRange(player.primeWindow),
    };

    const rawMetrics = {};
    let hasMetric = false;
    metrics.forEach((metric) => {
      const raw = metric.config.extract(context);
      if (!Number.isFinite(raw)) {
        return;
      }
      hasMetric = true;
      rawMetrics[metric.id] = raw;
      rawBuckets.get(metric.id).push(raw);
    });

    if (!hasMetric) {
      return;
    }

    playerRecords.push({ personId, nameKey, context, rawMetrics });
  });

  const percentileTables = new Map();
  rawBuckets.forEach((values, metricId) => {
    if (!values.length) {
      percentileTables.set(metricId, new Map());
      return;
    }
    const sorted = values.slice().sort((a, b) => a - b);
    const groups = new Map();
    sorted.forEach((value, index) => {
      if (!groups.has(value)) {
        groups.set(value, []);
      }
      groups.get(value).push(index);
    });
    const mapping = new Map();
    groups.forEach((indexes, value) => {
      const average = indexes.reduce((sum, item) => sum + item, 0) / indexes.length;
      const percentile = sorted.length > 1 ? (average / (sorted.length - 1)) * 100 : 100;
      mapping.set(value, percentile);
    });
    percentileTables.set(metricId, mapping);
  });

  playerRecords.forEach(({ personId, nameKey, context, rawMetrics }) => {
    const metricsPayload = {};
    let hasMetric = false;
    metrics.forEach((metric) => {
      const raw = rawMetrics[metric.id];
      if (!Number.isFinite(raw)) {
        return;
      }
      const percentile = percentileTables.get(metric.id)?.get(raw);
      if (!Number.isFinite(percentile)) {
        return;
      }
      hasMetric = true;
      const note = typeof metric.config.describe === 'function' ? metric.config.describe(context, percentile, raw) : null;
      metricsPayload[metric.id] = { value: percentile, note: note || undefined };
    });
    if (!hasMetric) {
      return;
    }
    if (personId) {
      byId.set(personId, metricsPayload);
    }
    if (nameKey) {
      byName.set(nameKey, metricsPayload);
    }
  });

  return { byId, byName };
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

function formatRelativeTime(iso) {
  if (!iso) {
    return null;
  }
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  const now = Date.now();
  const diffSeconds = Math.round((timestamp - now) / 1000);
  const divisions = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
  ];
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  let duration = diffSeconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return formatter.format(Math.round(duration), 'year');
}

function formatBdlWeight(weight) {
  if (weight === null || weight === undefined) {
    return null;
  }
  const trimmed = String(weight).trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return `${trimmed} lbs`;
  }
  return trimmed;
}

function buildFullName(firstName, lastName) {
  return [firstName, lastName]
    .filter((part) => part && String(part).trim().length)
    .map((part) => String(part).trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function initializeRosterApp({
  container,
  initialDoc = null,
  loadDoc,
  onDocLoaded,
  selectPlayerByBdlId,
  getSelectableBdlIds,
}) {
  if (!container) {
    return {
      highlight() {},
    };
  }

  const params = new URLSearchParams(window.location.search);
  let searchTerm = params.get('search') ?? '';
  let teamFilter = (params.get('team') ?? '').toUpperCase();
  let doc = initialDoc;
  let loading = false;
  let error = null;
  let activeBdlId = null;
  let lastHighlightedId = null;

  const updateUrl = (updates) => {
    const url = new URL(window.location.href);
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value.length) {
        url.searchParams.set(key, value);
      } else {
        url.searchParams.delete(key);
      }
    });
    window.history.replaceState({}, '', url.toString());
  };

  const matchesSearch = (player) => {
    if (!searchTerm) {
      return true;
    }
    const lower = searchTerm.toLowerCase();
    const fullName = buildFullName(player?.first_name, player?.last_name).toLowerCase();
    const jersey = player?.jersey_number ? `#${player.jersey_number}`.toLowerCase() : '';
    return fullName.includes(lower) || jersey.includes(lower);
  };

  const findTeamForBdlId = (bdlId) => {
    if (!doc?.teams) {
      return null;
    }
    const idString = String(bdlId);
    for (const team of doc.teams) {
      if (!Array.isArray(team?.roster)) {
        continue;
      }
      const match = team.roster.find((player) => String(player?.id) === idString);
      if (match) {
        return team;
      }
    }
    return null;
  };

  const syncActiveHighlight = (shouldScroll) => {
    if (!activeBdlId) {
      lastHighlightedId = null;
    }
    const buttons = container.querySelectorAll('[data-bdl-player-id]');
    let scrolled = false;
    buttons.forEach((button) => {
      const id = button.getAttribute('data-bdl-player-id');
      const isActive = Boolean(activeBdlId) && id === activeBdlId;
      button.classList.toggle('is-active', isActive);
      if (isActive && shouldScroll && !scrolled && id !== lastHighlightedId) {
        button.scrollIntoView({ block: 'nearest' });
        scrolled = true;
      }
      if (isActive) {
        const teamSection = button.closest('.roster-team');
        if (teamSection && typeof teamSection.open === 'boolean') {
          teamSection.open = true;
        }
      }
    });
    lastHighlightedId = activeBdlId;
  };

  const highlightRosterPlayer = (bdlId, options = {}) => {
    const { scroll = false } = options;
    activeBdlId = bdlId ? String(bdlId) : null;
    syncActiveHighlight(scroll);
  };

  const handleRefresh = async () => {
    if (loading) {
      return;
    }
    if (typeof loadDoc !== 'function') {
      error = 'Refresh is not available right now.';
      render();
      return;
    }
    loading = true;
    error = null;
    render();
    try {
      const nextDoc = await loadDoc();
      doc = nextDoc ?? null;
      if (typeof onDocLoaded === 'function') {
        onDocLoaded(nextDoc ?? null);
      }
      loading = false;
      error = null;
    } catch (refreshError) {
      console.error(refreshError);
      loading = false;
      error = refreshError?.message || 'Unable to refresh active rosters right now. Please try again later.';
    }
    render();
  };

  const handleRandom = () => {
    if (typeof selectPlayerByBdlId !== 'function') {
      return;
    }
    const selectableIds = typeof getSelectableBdlIds === 'function' ? getSelectableBdlIds() : [];
    if (!Array.isArray(selectableIds) || !selectableIds.length) {
      return;
    }
    const randomId = selectableIds[Math.floor(Math.random() * selectableIds.length)];
    if (!randomId) {
      return;
    }
    const team = findTeamForBdlId(randomId);
    if (team?.abbreviation && team.abbreviation !== teamFilter) {
      teamFilter = team.abbreviation;
    }
    if (searchTerm) {
      searchTerm = '';
    }
    updateUrl({
      team: teamFilter || null,
      search: searchTerm || null,
    });
    selectPlayerByBdlId(randomId);
    highlightRosterPlayer(randomId, { scroll: true });
    render();
  };

  const handleContainerClick = (event) => {
    const button = event.target.closest('[data-bdl-player-id]');
    if (!button || !container.contains(button)) {
      return;
    }
    const bdlId = button.getAttribute('data-bdl-player-id');
    if (!bdlId) {
      return;
    }
    if (typeof selectPlayerByBdlId === 'function') {
      selectPlayerByBdlId(bdlId);
    }
    highlightRosterPlayer(bdlId, { scroll: false });
  };

  container.addEventListener('click', handleContainerClick);

  function attachControls() {
    const searchInput = container.querySelector('#roster-search');
    if (searchInput) {
      searchInput.value = searchTerm;
      searchInput.addEventListener('input', (event) => {
        searchTerm = event.target.value || '';
        updateUrl({ search: searchTerm || null });
        render();
      });
    }

    const teamSelect = container.querySelector('#roster-team');
    if (teamSelect) {
      teamSelect.value = teamFilter;
      teamSelect.addEventListener('change', (event) => {
        const nextValue = (event.target.value || '').toUpperCase();
        teamFilter = nextValue;
        updateUrl({ team: teamFilter || null });
        render();
      });
    }

    const refreshButton = container.querySelector('[data-roster-refresh]');
    if (refreshButton) {
      refreshButton.addEventListener('click', handleRefresh);
    }

    const randomButton = container.querySelector('[data-roster-random]');
    if (randomButton) {
      randomButton.addEventListener('click', handleRandom);
      if (typeof getSelectableBdlIds === 'function') {
        randomButton.disabled = getSelectableBdlIds().length === 0;
      }
    }

    const retryButton = container.querySelector('[data-roster-retry]');
    if (retryButton) {
      retryButton.addEventListener('click', handleRefresh);
    }
  }

  function render() {
    if (loading) {
      container.innerHTML = '<div class="roster-status"><p>Refreshing active rosters…</p></div>';
      return;
    }

    if (error) {
      container.innerHTML = `
        <div class="roster-status roster-status--error">
          <p>${escapeHtml(error)}</p>
          <button type="button" class="roster-button" data-roster-retry>Retry</button>
        </div>
      `;
      attachControls();
      return;
    }

    const teams = Array.isArray(doc?.teams) ? doc.teams.slice() : [];
    const hasTeams = teams.length > 0;
    const visibleTeams = teams.filter((team) => !teamFilter || team?.abbreviation === teamFilter);

    const sections = visibleTeams
      .map((team) => {
        const roster = Array.isArray(team?.roster) ? team.roster.filter(matchesSearch) : [];
        const items = roster
          .map((player) => {
            const fullName = buildFullName(player.first_name, player.last_name) || '—';
            const jersey = player?.jersey_number ? `#${player.jersey_number}` : '';
            const pieces = [player?.position || null, jersey || null].filter(Boolean).join(' · ');
            const vitals = [player?.height || null, formatBdlWeight(player?.weight) || null]
              .filter(Boolean)
              .join(' • ');
            const bdlId = String(player?.id);
            return `
              <li>
                <button type="button" class="roster-player" data-bdl-player-id="${escapeHtml(bdlId)}">
                  <span class="roster-player__name">${escapeHtml(fullName)}</span>
                  ${pieces ? `<span class="roster-player__role">${escapeHtml(pieces)}</span>` : ''}
                  ${vitals ? `<span class="roster-player__meta">${escapeHtml(vitals)}</span>` : ''}
                </button>
              </li>
            `;
          })
          .join('');

        const emptyState = roster.length
          ? ''
          : '<li class="roster-player roster-player--empty">No players match this filter.</li>';

        const subtitleParts = [];
        if (team?.abbreviation) {
          subtitleParts.push(team.abbreviation);
        }
        if (Array.isArray(team?.roster)) {
          subtitleParts.push(`${team.roster.length} players`);
        }
        const subtitle = subtitleParts.join(' • ');

        const sectionTitle = team?.full_name || team?.abbreviation || 'Team';

        return `
          <details class="roster-team" data-team-anchor="${escapeHtml(team?.abbreviation ?? sectionTitle)}">
            <summary class="roster-team__header">
              <h3>${escapeHtml(sectionTitle)}</h3>
              <p>${escapeHtml(subtitle || '')}</p>
            </summary>
            <ul class="roster-list">
              ${items || emptyState}
            </ul>
          </details>
        `;
      })
      .join('');

    let noTeamsMessage = '';
    if (!hasTeams) {
      noTeamsMessage = '<div class="roster-status roster-status--empty"><p>Rosters are not cached yet. Use Refresh to try again.</p></div>';
    } else if (!visibleTeams.length) {
      noTeamsMessage = '<div class="roster-status roster-status--empty"><p>No teams match the current filter.</p></div>';
    }

    const timeTitle = doc?.fetched_at
      ? new Date(doc.fetched_at).toLocaleString()
      : 'No roster snapshot cached yet';
    const relativeTime = doc?.fetched_at ? formatRelativeTime(doc.fetched_at) : null;
    const metaParts = [];
    metaParts.push(relativeTime ? `Last updated ${relativeTime}` : 'Last updated not yet available');
    metaParts.push('Source: BallDontLie');
    if (Number.isFinite(doc?.ttl_hours)) {
      metaParts.push(`TTL ${doc.ttl_hours}h`);
    }
    const metaLine = metaParts.join(' • ');

    const teamOptions = [''].concat(
      teams
        .slice()
        .sort((a, b) => {
          const left = a?.abbreviation || '';
          const right = b?.abbreviation || '';
          return left.localeCompare(right);
        })
        .map((team) => team?.abbreviation || ''),
    );

    const selectableIds = typeof getSelectableBdlIds === 'function' ? getSelectableBdlIds() : [];
    const randomDisabled = !Array.isArray(selectableIds) || selectableIds.length === 0;

    container.innerHTML = `
      <div class="roster-controls">
        <div class="roster-controls__filters">
          <label class="roster-controls__field">
            <span class="roster-controls__label">Search</span>
            <input
              id="roster-search"
              class="roster-input"
              type="search"
              placeholder="Search by name or jersey"
              value="${escapeHtml(searchTerm)}"
              autocomplete="off"
            />
          </label>
          <label class="roster-controls__field">
            <span class="roster-controls__label">Team</span>
            <select id="roster-team" class="roster-select">
              ${teamOptions
                .map((code) => {
                  const selected = code === teamFilter ? ' selected' : '';
                  const label = code || 'All teams';
                  return `<option value="${escapeHtml(code)}"${selected}>${escapeHtml(label)}</option>`;
                })
                .join('')}
            </select>
          </label>
        </div>
        <div class="roster-controls__meta">
          <small title="${escapeHtml(timeTitle)}">${escapeHtml(metaLine)}</small>
          <div class="roster-controls__actions">
            <button type="button" class="roster-button" data-roster-random${randomDisabled ? ' disabled' : ''}>Surprise me</button>
            <button type="button" class="roster-button" data-roster-refresh>Refresh</button>
          </div>
        </div>
      </div>
      <div class="roster-teams">${sections}${noTeamsMessage}</div>
    `;

    attachControls();
    syncActiveHighlight(false);
  }

  render();

  return {
    highlight: (bdlId, options = {}) => {
      highlightRosterPlayer(bdlId, options);
    },
  };
}

function initPlayerAtlas() {
  const atlas = document.querySelector('[data-player-profiles]');
  if (!atlas) {
    return;
  }

  const rosterApp = document.getElementById('players-app');

  const searchInput = atlas.querySelector('[data-player-search]');
  const clearButton = atlas.querySelector('[data-player-clear]');
  const resultsList = atlas.querySelector('[data-player-results]');
  const hint = atlas.querySelector('[data-player-hint]');
  const empty = atlas.querySelector('[data-player-empty]');
  const error = atlas.querySelector('[data-player-error]');
  const profile = atlas.querySelector('[data-player-profile]');
  const nameEl = atlas.querySelector('[data-player-name]');
  const metaEl = atlas.querySelector('[data-player-meta]');
  const teamEl = atlas.querySelector('[data-player-team]');
  const positionEl = atlas.querySelector('[data-player-position]');
  const jerseyEl = atlas.querySelector('[data-player-jersey]');
  const heightEl = atlas.querySelector('[data-player-height]');
  const weightEl = atlas.querySelector('[data-player-weight]');
  const updatedEl = atlas.querySelector('[data-player-updated]');
  const statsContainer = atlas.querySelector('[data-player-stats]');
  const statsMeta = atlas.querySelector('[data-player-stats-meta]');
  const statsSeasonEl = atlas.querySelector('[data-player-stats-season]');
  const statsEmpty = atlas.querySelector('[data-player-stats-empty]');
  const statsError = atlas.querySelector('[data-player-stats-error]');
  const statGamesEl = atlas.querySelector('[data-player-stat-games]');
  const statPointsEl = atlas.querySelector('[data-player-stat-points]');
  const statReboundsEl = atlas.querySelector('[data-player-stat-rebounds]');
  const statAssistsEl = atlas.querySelector('[data-player-stat-assists]');
  const statStealsEl = atlas.querySelector('[data-player-stat-steals]');
  const statBlocksEl = atlas.querySelector('[data-player-stat-blocks]');
  const teamBrowser = atlas.querySelector('[data-player-teams]');
  const teamTree = atlas.querySelector('[data-player-team-tree]');
  const recentLeaderboard = document.querySelector('[data-recent-leaderboard]');
  const recentPlaceholder = document.querySelector('[data-recent-placeholder]');

  if (
    !searchInput ||
    !resultsList ||
    !profile ||
    !nameEl ||
    !metaEl ||
    !teamEl ||
    !positionEl ||
    !jerseyEl ||
    !heightEl ||
    !weightEl ||
    !updatedEl ||
    !statsContainer ||
    !statsMeta ||
    !statsSeasonEl ||
    !statGamesEl ||
    !statPointsEl ||
    !statReboundsEl ||
    !statAssistsEl ||
    !statStealsEl ||
    !statBlocksEl
  ) {
    return;
  }

  const formatSeasonLabel = (startYear) => `${startYear}-${String(startYear + 1).slice(-2)}`;
  const LATEST_COMPLETED_SEASON = 2024;
  const seasonLabel = formatSeasonLabel(LATEST_COMPLETED_SEASON);
  if (statsSeasonEl) {
    statsSeasonEl.textContent = seasonLabel;
  }
  const defaultStatsMeta = `BallDontLie season averages for the ${seasonLabel} season.`;
  if (statsMeta) {
    statsMeta.textContent = defaultStatsMeta;
  }

  const BDL_API_BASE = 'https://api.balldontlie.io/v1';
  const seasonAveragesCache = new Map();
  let statsRequestToken = 0;

  let players = [];
  let allPlayers = [];
  const playersById = new Map();
  const playersByBdlId = new Map();
  let catalog = [];
  let matches = [];
  let activePlayerId = null;
  let teamButtons = [];
  let activeIndex = -1;
  let isLoaded = false;
  let hasError = false;
  let goatLookup = { byId: new Map(), byName: new Map(), recent: [] };
  let atlasMetrics = { byId: new Map(), byName: new Map() };
  let currentRostersDoc = null;
  let rosterController = null;
  const defaultEmptyText = empty?.textContent?.trim() ?? '';
  const normalizePlayerId = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    return String(value);
  };
  const ensurePlayerSearchTokens = (player) => {
    player.searchTokens = buildPlayerTokens(player);
    player.nameToken = simplifyText(player?.name);
  };
  const sortPlayersByName = (list) =>
    (Array.isArray(list) ? list : [])
      .slice()
      .sort((a, b) => {
        const left = a?.name || '';
        const right = b?.name || '';
        return left.localeCompare(right);
      });
  const rebuildPlayerIndexes = () => {
    playersById.clear();
    players.forEach((player) => {
      const key = normalizePlayerId(player?.id);
      if (key) {
        playersById.set(key, player);
      }
    });
  };
  const updateStatsView = (status, payload = null) => {
    statsContainer.setAttribute('data-state', status);
    statsContainer.setAttribute('aria-busy', status === 'loading' ? 'true' : 'false');
    if (statsEmpty) {
      statsEmpty.hidden = status !== 'empty';
    }
    if (statsError) {
      statsError.hidden = status !== 'error';
    }

    const formatValue = (value, digits = 1) =>
      Number.isFinite(value) ? helpers.formatNumber(value, digits) : '—';

    const values = {
      games: '—',
      points: '—',
      rebounds: '—',
      assists: '—',
      steals: '—',
      blocks: '—',
    };

    if (status === 'ready' && payload) {
      values.games = formatValue(payload.games, 0);
      values.points = formatValue(payload.points, 1);
      values.rebounds = formatValue(payload.rebounds, 1);
      values.assists = formatValue(payload.assists, 1);
      values.steals = formatValue(payload.steals, 1);
      values.blocks = formatValue(payload.blocks, 1);
    }

    statGamesEl.textContent = values.games;
    statPointsEl.textContent = values.points;
    statReboundsEl.textContent = values.rebounds;
    statAssistsEl.textContent = values.assists;
    statStealsEl.textContent = values.steals;
    statBlocksEl.textContent = values.blocks;

    if (statsMeta) {
      if (status === 'loading') {
        statsMeta.textContent = `Loading BallDontLie season averages for the ${seasonLabel} season…`;
      } else if (status === 'ready') {
        statsMeta.textContent = defaultStatsMeta;
      } else if (status === 'empty') {
        statsMeta.textContent = `No BallDontLie season averages recorded for the ${seasonLabel} season.`;
      } else if (status === 'error') {
        statsMeta.textContent = `We couldn't load BallDontLie season averages right now.`;
      } else {
        statsMeta.textContent = defaultStatsMeta;
      }
    }
  };

  const parseNumeric = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const loadSeasonAverages = async (player) => {
    const bdlId = player?.bdl?.id;
    statsRequestToken += 1;
    const requestId = statsRequestToken;

    if (!bdlId) {
      updateStatsView('empty');
      return;
    }

    const cacheKey = String(bdlId);
    if (seasonAveragesCache.has(cacheKey)) {
      const cached = seasonAveragesCache.get(cacheKey);
      updateStatsView(cached.status, cached.data ?? null);
      return;
    }

    updateStatsView('loading');

    try {
      const params = new URLSearchParams();
      params.set('season', String(LATEST_COMPLETED_SEASON));
      params.append('player_ids[]', cacheKey);
      const url = `${BDL_API_BASE}/season_averages?${params.toString()}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response?.ok) {
        throw new Error(`Failed to load season averages: ${response?.status}`);
      }
      const payload = await response.json();
      const record = Array.isArray(payload?.data) ? payload.data[0] : null;
      if (!record) {
        const entry = { status: 'empty', data: null };
        seasonAveragesCache.set(cacheKey, entry);
        if (requestId === statsRequestToken) {
          updateStatsView('empty');
        }
        return;
      }

      const stats = {
        games: parseNumeric(record.games_played),
        points: parseNumeric(record.pts),
        rebounds: parseNumeric(record.reb),
        assists: parseNumeric(record.ast),
        steals: parseNumeric(record.stl),
        blocks: parseNumeric(record.blk),
      };
      const entry = { status: 'ready', data: stats };
      seasonAveragesCache.set(cacheKey, entry);
      if (requestId === statsRequestToken) {
        updateStatsView('ready', stats);
      }
    } catch (seasonError) {
      console.warn('Unable to load BallDontLie season averages', seasonError);
      if (requestId === statsRequestToken) {
        updateStatsView('error');
      }
    }
  };

  const updateRosterTimestamp = () => {
    if (!currentRostersDoc) {
      updatedEl.textContent = 'Active roster snapshot not yet available.';
      return;
    }

    const parts = [];
    if (currentRostersDoc.fetched_at) {
      const relative = formatRelativeTime(currentRostersDoc.fetched_at);
      if (relative) {
        parts.push(`Refreshed ${relative}`);
      } else {
        const timestamp = new Date(currentRostersDoc.fetched_at).toLocaleString();
        parts.push(`Refreshed ${timestamp}`);
      }
    } else {
      parts.push('Refresh time unavailable');
    }

    const sourceName = currentRostersDoc.source === 'ball_dont_lie' || !currentRostersDoc.source
      ? 'BallDontLie'
      : String(currentRostersDoc.source);
    parts.push(`Source: ${sourceName}`);

    if (Number.isFinite(currentRostersDoc.ttl_hours)) {
      parts.push(`TTL ${currentRostersDoc.ttl_hours}h`);
    }

    updatedEl.textContent = parts.join(' • ');
  };

  updateRosterTimestamp();

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
  const setActivePlayers = (nextPlayers) => {
    const sorted = sortPlayersByName(nextPlayers);
    players = sorted;
    rebuildPlayerIndexes();
    renderTeamBrowser(players);
    if (activePlayerId) {
      const normalizedActiveId = normalizePlayerId(activePlayerId);
      if (!normalizedActiveId || !playersById.has(normalizedActiveId)) {
        activePlayerId = null;
        if (profile) {
          profile.hidden = true;
          delete profile.dataset.playerId;
        }
      } else {
        activePlayerId = normalizedActiveId;
      }
    }
    highlightTeamPlayer(activePlayerId);
    const pendingQuery = searchInput.value.trim();
    if (pendingQuery) {
      renderResults(pendingQuery);
    } else {
      matches = [];
      activeIndex = -1;
      resultsList.innerHTML = '';
      setResultsVisibility(false);
      setClearVisibility(false);
      resetStatusMessages();
    }
  };

  const renderMeta = (player) => {
    const parts = [];
    const teamName = player?.bdl?.teamName || player?.team;
    const teamAbbr = player?.bdl?.teamAbbr || player?.teamAbbr;
    const position = player?.bdl?.position;
    const jersey = player?.bdl?.jersey;
    if (teamName && teamAbbr) {
      parts.push(`${teamName} (${teamAbbr})`);
    } else if (teamName) {
      parts.push(teamName);
    }
    if (position) {
      parts.push(`Position ${position}`);
    }
    if (jersey) {
      parts.push(`#${jersey}`);
    }
    return parts.join(' • ');
  };

  const highlightTeamPlayer = (playerId) => {
    if (!teamTree) return;
    if (!teamButtons.length) {
      teamButtons = Array.from(teamTree.querySelectorAll('[data-player-id]'));
    }
    const normalizedId = normalizePlayerId(playerId);
    let activeButton = null;
    teamButtons.forEach((button) => {
      const isActive = Boolean(normalizedId) && button.dataset.playerId === normalizedId;
      button.classList.toggle('is-active', isActive);
      if (isActive) {
        activeButton = button;
      }
    });
    if (activeButton) {
      const parentSection = activeButton.closest('details');
      if (parentSection && !parentSection.open) {
        parentSection.open = true;
      }
      activeButton.scrollIntoView({ block: 'nearest' });
    }
  };

  const renderTeamBrowser = (roster) => {
    if (!teamTree) return;
    teamTree.innerHTML = '';
    teamButtons = [];

    if (!Array.isArray(roster) || roster.length === 0) {
      if (teamBrowser) {
        teamBrowser.hidden = true;
      }
      return;
    }

    const fallbackTeam = 'Unaffiliated pool';
    const groups = new Map();

    roster.forEach((player) => {
      const teamName = player?.bdl?.teamName?.trim() || player?.team?.trim() || fallbackTeam;
      if (!groups.has(teamName)) {
        groups.set(teamName, []);
      }
      groups.get(teamName).push(player);
    });

    const sortedTeams = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const fragment = document.createDocumentFragment();

    sortedTeams.forEach(([teamName, members]) => {
      const panel = document.createElement('details');
      panel.className = 'player-atlas__team';
      panel.dataset.team = teamName;

      const summary = document.createElement('summary');
      summary.className = 'player-atlas__team-summary';

      const title = document.createElement('span');
      title.className = 'player-atlas__team-name';
      title.textContent = teamName;

      const count = document.createElement('span');
      count.className = 'player-atlas__team-count';
      count.textContent = `${members.length}`;
      count.setAttribute('aria-label', `${members.length} ${members.length === 1 ? 'player' : 'players'}`);

      summary.append(title, count);
      panel.append(summary);

      const list = document.createElement('ul');
      list.className = 'player-atlas__team-roster';

      members
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((player) => {
          const item = document.createElement('li');
          item.className = 'player-atlas__team-entry';

          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'player-atlas__team-player';
          button.dataset.playerId = normalizePlayerId(player.id);

          const name = document.createElement('span');
          name.className = 'player-atlas__team-player-name';
          name.textContent = player.name;

          button.append(name);

          const positionLabel = player?.bdl?.position || null;
          const jerseyLabel = player?.bdl?.jersey || null;
          const metaBits = [positionLabel, jerseyLabel ? `#${jerseyLabel}` : null].filter(Boolean);
          if (metaBits.length) {
            const meta = document.createElement('span');
            meta.className = 'player-atlas__team-player-meta';
            meta.textContent = metaBits.join(' • ');
            button.append(meta);
          }

          item.append(button);
          list.append(item);
        });

      panel.append(list);
      fragment.append(panel);
    });

    teamTree.append(fragment);
    teamButtons = Array.from(teamTree.querySelectorAll('[data-player-id]'));
    if (teamBrowser) {
      teamBrowser.hidden = false;
    }
    if (activePlayerId) {
      highlightTeamPlayer(activePlayerId);
    }
  };

  const applyBallDontLieDoc = (doc) => {
    currentRostersDoc = doc ?? null;
    updateRosterTimestamp();
    playersByBdlId.clear();
    if (!doc || !Array.isArray(doc.teams)) {
      setActivePlayers([]);
      return;
    }

    const nameBuckets = new Map();
    allPlayers.forEach((player) => {
      const key = normalizeName(player?.name);
      if (!key) {
        return;
      }
      if (!nameBuckets.has(key)) {
        nameBuckets.set(key, []);
      }
      nameBuckets.get(key).push(player);
    });

    const takeFromBucket = (key) => {
      if (!key) {
        return null;
      }
      const bucket = nameBuckets.get(key);
      if (!bucket || !bucket.length) {
        return null;
      }
      return bucket.shift();
    };

    const extras = [];

    const atlasPlayers = [];

    doc.teams.forEach((team) => {
      const roster = Array.isArray(team?.roster) ? team.roster : [];
      roster.forEach((member) => {
        const fullName = buildFullName(member?.first_name, member?.last_name);
        const nameKey = normalizeName(fullName || '');
        const sourceRecord = nameKey ? takeFromBucket(nameKey) : null;
        let playerRecord = sourceRecord ? { ...sourceRecord } : null;
        let isNewRecord = false;

        if (!playerRecord) {
          const rosterId = member?.id ?? `${team?.abbreviation ?? 'FA'}-${atlasPlayers.length + 1}`;
          playerRecord = {
            id: `bdl-${rosterId}`,
            name: fullName || `Player ${rosterId}`,
            team: team?.full_name || team?.abbreviation || '',
            teamAbbr: team?.abbreviation ?? null,
            position: member?.position ?? null,
            jerseyNumber: member?.jersey_number ?? null,
            height: member?.height ?? null,
            weight: formatBdlWeight(member?.weight) ?? null,
            era: null,
            goatScores: null,
            goatScore: null,
            goatRank: null,
            goatTier: null,
            goatResume: null,
            metrics: {},
          };
          isNewRecord = true;
        }

        const teamName = team?.full_name || team?.abbreviation || playerRecord.team || '';
        const formattedWeight = formatBdlWeight(member?.weight);
        const jerseyNumber = member?.jersey_number ?? null;
        const heightValue = member?.height ?? null;
        const positionValue = member?.position ?? null;

        playerRecord.team = teamName || playerRecord.team || '';
        if (team?.abbreviation) {
          playerRecord.teamAbbr = team.abbreviation;
        }
        if (positionValue) {
          playerRecord.position = positionValue;
        }
        if (jerseyNumber) {
          playerRecord.jerseyNumber = jerseyNumber;
        }
        if (heightValue) {
          playerRecord.height = heightValue;
        }
        if (formattedWeight) {
          playerRecord.weight = formattedWeight;
        }

        const previousBdl = playerRecord?.bdl ?? {};
        playerRecord.bdl = {
          ...previousBdl,
          id: member?.id ?? previousBdl.id ?? null,
          teamName,
          teamAbbr: team?.abbreviation ?? previousBdl.teamAbbr ?? null,
          position: positionValue ?? previousBdl.position ?? null,
          jersey: jerseyNumber ?? previousBdl.jersey ?? null,
          height: heightValue ?? previousBdl.height ?? null,
          weight: formattedWeight ?? previousBdl.weight ?? null,
        };

        ensurePlayerSearchTokens(playerRecord);

        if (member?.id !== undefined && member?.id !== null) {
          playersByBdlId.set(String(member.id), playerRecord);
        }

        if (isNewRecord) {
          extras.push(playerRecord);
        }

        atlasPlayers.push(playerRecord);
      });
    });

    if (extras.length) {
      const existingIds = new Set(
        allPlayers
          .map((player) => normalizePlayerId(player?.id))
          .filter((value) => value !== null),
      );
      extras.forEach((player) => {
        const candidateId = normalizePlayerId(player?.id);
        if (candidateId && !existingIds.has(candidateId)) {
          allPlayers.push(player);
          existingIds.add(candidateId);
        }
      });
    }

    setActivePlayers(atlasPlayers);
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
      const normalizedId = normalizePlayerId(player.id);
      if (!normalizedId) {
        return;
      }
      const optionId = `player-atlas-option-${normalizedId}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.id = optionId;
      button.className = 'player-atlas__result';
      button.dataset.playerId = normalizedId;
      button.setAttribute('role', 'option');

      const name = document.createElement('span');
      name.className = 'player-atlas__result-name';
      name.textContent = player.name;

      const meta = document.createElement('span');
      meta.className = 'player-atlas__result-meta';
      const metaText = [
        player?.bdl?.teamName || player?.team || null,
        player?.bdl?.position ? `Pos ${player.bdl.position}` : null,
        player?.bdl?.jersey ? `#${player.bdl.jersey}` : null,
      ]
        .filter(Boolean)
        .join(' • ');
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
    const normalizedId = normalizePlayerId(player?.id);
    profile.dataset.playerId = normalizedId ?? '';
    activePlayerId = normalizedId;
    highlightTeamPlayer(activePlayerId);
    if (rosterController && typeof rosterController.highlight === 'function') {
      const rosterId = player?.bdl?.id !== undefined && player?.bdl?.id !== null ? String(player.bdl.id) : null;
      rosterController.highlight(rosterId, { scroll: true });
    }
    nameEl.textContent = player.name;
    metaEl.textContent = renderMeta(player) || 'Active roster profile';

    const teamName = player?.bdl?.teamName || player?.team || '—';
    const position = player?.bdl?.position || '—';
    const jersey = player?.bdl?.jersey ? `#${player.bdl.jersey}` : '—';
    const height = player?.bdl?.height || player?.height || '—';
    const weight = player?.bdl?.weight || player?.weight || '—';

    teamEl.textContent = teamName || '—';
    positionEl.textContent = position || '—';
    jerseyEl.textContent = jersey || '—';
    heightEl.textContent = height || '—';
    weightEl.textContent = weight || '—';

    updateRosterTimestamp();
    loadSeasonAverages(player);

    profile.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectPlayerByBdlId = (bdlId) => {
    if (bdlId === null || bdlId === undefined) {
      return false;
    }
    const key = String(bdlId);
    const player = playersByBdlId.get(key);
    if (player) {
      selectPlayer(player);
      return true;
    }
    return false;
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
    const player = playersById.get(normalizePlayerId(playerId));
    selectPlayer(player);
  };

  const handleTeamClick = (event) => {
    const button = event.target.closest('[data-player-id]');
    if (!button || !teamTree?.contains(button)) {
      return;
    }
    const playerId = button.dataset.playerId;
    if (!playerId) return;
    const player = playersById.get(normalizePlayerId(playerId));
    if (player) {
      selectPlayer(player);
    }
  };

  const handleClear = () => {
    searchInput.value = '';
    searchInput.focus();
    setClearVisibility(false);
    renderResults('');
  };

  const rostersDataUrl = new URL('./data/rosters.json', document.baseURI).toString();

  const hydrate = async () => {
    try {
      const [
        profilesResponse,
        goatSystemResponse,
        goatIndexResponse,
        goatRecentResponse,
        rostersResponse,
      ] = await Promise.all([
        fetch('data/player_profiles.json'),
        fetch('data/goat_system.json').catch(() => null),
        fetch('data/goat_index.json').catch(() => null),
        fetch('data/goat_recent.json').catch(() => null),
        fetch(rostersDataUrl, { cache: 'no-store' }).catch(() => null),
      ]);
      if (!profilesResponse?.ok) {
        throw new Error(`Failed to load player profiles: ${profilesResponse?.status}`);
      }
      const data = await profilesResponse.json();

      catalog = Array.isArray(data?.metrics) ? data.metrics : [];
      const roster = Array.isArray(data?.players) ? data.players : [];

      let goatSystemData = null;
      if (goatSystemResponse && goatSystemResponse.ok) {
        try {
          goatSystemData = await goatSystemResponse.json();
        } catch (goatSystemError) {
          console.warn('Unable to parse GOAT system data', goatSystemError);
        }
      }

      let goatIndexData = null;
      if (goatIndexResponse && goatIndexResponse.ok) {
        try {
          goatIndexData = await goatIndexResponse.json();
        } catch (goatIndexError) {
          console.warn('Unable to parse GOAT index data', goatIndexError);
        }
      }

      let goatRecentData = null;
      if (goatRecentResponse && goatRecentResponse.ok) {
        try {
          goatRecentData = await goatRecentResponse.json();
        } catch (goatRecentError) {
          console.warn('Unable to parse rolling GOAT data', goatRecentError);
        }
      }

      const goatHistoricalSource = goatSystemData ?? goatIndexData;
      goatLookup = buildGoatScoreLookup(goatHistoricalSource, goatRecentData);
      atlasMetrics = buildAtlasMetrics(catalog, goatSystemData ?? goatHistoricalSource);
      renderRecentLeaderboard(goatLookup.recent, recentLeaderboard, recentPlaceholder);

      const resolveGoatScores = (personId, name) => {
        if (personId && goatLookup.byId.has(personId)) {
          return goatLookup.byId.get(personId);
        }
        const nameKey = normalizeName(name);
        if (nameKey && goatLookup.byName.has(nameKey)) {
          return goatLookup.byName.get(nameKey);
        }
        return null;
      };

      players = roster.map((player) => {
        const personId = extractPersonIdFromProfile(player);
        const nameKey = normalizeName(player?.name);
        const goatScores = resolveGoatScores(personId, player?.name);
        const mergedGoatScores = goatScores ? { ...goatScores } : {};
        if (!Number.isFinite(mergedGoatScores.recent) && Number.isFinite(player?.goatRecentScore)) {
          mergedGoatScores.recent = player.goatRecentScore;
        }
        if (!Number.isFinite(mergedGoatScores.recentRank) && Number.isFinite(player?.goatRecentRank)) {
          mergedGoatScores.recentRank = player.goatRecentRank;
        }
        if (!Number.isFinite(mergedGoatScores.historical) && Number.isFinite(player?.goatScore)) {
          mergedGoatScores.historical = player.goatScore;
        }
        const historicalGoat = Number.isFinite(mergedGoatScores?.historical)
          ? mergedGoatScores.historical
          : player?.goatScore;
        const metricsRecord =
          (personId && atlasMetrics.byId.get(personId)) ||
          (nameKey && atlasMetrics.byName.get(nameKey)) ||
          null;
        const enriched = {
          ...player,
          searchTokens: buildPlayerTokens(player),
          nameToken: simplifyText(player?.name),
          personId,
          goatScores: Object.keys(mergedGoatScores).length ? mergedGoatScores : null,
          goatScore: Number.isFinite(historicalGoat) ? historicalGoat : player?.goatScore,
          metrics: metricsRecord ?? player?.metrics ?? {},
        };
        if (metricsRecord) {
          enriched.metrics = metricsRecord;
        }
        const resumeText = goatScores?.resume || player?.goatResume;
        if (resumeText) {
          enriched.goatResume = resumeText;
        }
        const tierText = goatScores?.tier || player?.goatTier;
        if (tierText) {
          enriched.goatTier = tierText;
        }
        const resolvedRank = Number.isFinite(player?.goatRank)
          ? player.goatRank
          : Number.isFinite(goatScores?.historicalRank)
            ? goatScores.historicalRank
            : null;
        if (Number.isFinite(resolvedRank)) {
          enriched.goatRank = resolvedRank;
        }
        return enriched;
      });

      allPlayers = players.map((player) => ({ ...player }));

      let rostersDoc = null;
      if (rostersResponse && rostersResponse.ok) {
        try {
          rostersDoc = await rostersResponse.json();
        } catch (rostersError) {
          console.warn('Unable to parse roster snapshot', rostersError);
        }
      }

      if (rostersDoc) {
        applyBallDontLieDoc(rostersDoc);
      } else {
        playersByBdlId.clear();
        setActivePlayers([]);
      }

      isLoaded = true;
      hasError = false;
      if (empty) {
        empty.textContent = defaultEmptyText;
      }

      if (rosterApp) {
        const loadLatestRosters = async () => {
          const response = await fetch(rostersDataUrl, { cache: 'no-store' });
          if (!response?.ok) {
            throw new Error(`Failed to refresh rosters: ${response?.status}`);
          }
          return response.json();
        };
        rosterController = initializeRosterApp({
          container: rosterApp,
          initialDoc: rostersDoc,
          loadDoc: loadLatestRosters,
          onDocLoaded: (doc) => {
            if (doc && Array.isArray(doc?.teams)) {
              applyBallDontLieDoc(doc);
            }
          },
          selectPlayerByBdlId,
          getSelectableBdlIds: () => Array.from(playersByBdlId.keys()),
        });
      }

      if (!players.length) {
        if (hint) hint.hidden = true;
        if (empty) {
          empty.hidden = false;
          empty.textContent = 'Active roster profiles are temporarily unavailable.';
        }
        searchInput.disabled = true;
        setClearVisibility(false);
      } else {
        searchInput.disabled = false;
        const pendingQuery = searchInput.value.trim();
        if (pendingQuery) {
          renderResults(pendingQuery);
        } else {
          resetStatusMessages();
        }
      }
    } catch (err) {
      console.error(err);
      hasError = true;
      renderRecentLeaderboard([], recentLeaderboard, recentPlaceholder);
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

  if (teamTree) {
    teamTree.addEventListener('click', handleTeamClick);
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
