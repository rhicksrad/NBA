import { registerCharts, helpers } from './hub-charts.js';

const palette = {
  royal: '#1156d6',
  sky: 'rgba(31, 123, 255, 0.75)',
  gold: '#f4b53f',
  navy: '#0b2545',
  coral: '#ef3d5b',
  teal: '#12b886',
  lilac: '#8f6efc',
};

const componentPalette = ['#1156d6', '#1f7bff', '#12b886', '#ef3d5b', '#f4b53f'];

const heroStats = {
  averageGoat: 0,
  activeShare: 0,
  multiFranchiseShare: 0,
  multiFranchiseCount: 0,
};

const TIER_PRIORITY = new Map([
  ['Inner Circle', 0],
  ['Pantheon', 1],
  ['All-Time Great', 2],
  ['Hall of Fame', 3],
  ['All-Star', 4],
  ['Starter', 5],
  ['Reserve', 6],
  ['Rotation', 7],
  ['Prospect', 8],
]);

const TIER_LABEL_OVERRIDES = new Map([
  ['Hall of Fame', 'All-NBA'],
]);

const gaugeLabelPlugin = {
  id: 'gaugeLabel',
  beforeDraw(chart, _args, opts) {
    if (!opts || !opts.valueText) {
      return;
    }
    const meta = chart.getDatasetMeta(0);
    if (!meta?.data?.length) {
      return;
    }
    const { x, y } = meta.data[0].tooltipPosition();
    const ctx = chart.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = opts.valueColor ?? palette.navy;
    ctx.font = `700 ${opts.valueSize ?? 16}px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillText(opts.valueText, x, y - 6);
    if (opts.labelText) {
      ctx.font = `600 ${opts.labelSize ?? 11}px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = opts.labelColor ?? 'rgba(11, 37, 69, 0.68)';
      ctx.fillText(opts.labelText, x, y + 12);
    }
    ctx.restore();
  },
};

const GAUGE_ROTATION = (-135 / 180) * Math.PI;
const GAUGE_CIRCUMFERENCE = (270 / 180) * Math.PI;

const GOAT_DATA_SOURCES = [
  { url: 'data/goat_system.json', label: 'GOAT system' },
  { url: 'data/goat_index.json', label: 'GOAT index' },
];

async function loadGoatData() {
  let lastError = null;
  for (const source of GOAT_DATA_SOURCES) {
    try {
      const response = await fetch(source.url);
      if (!response?.ok) {
        if (response) {
          console.warn(`GOAT data source unavailable (${source.label}):`, response.status);
        }
        continue;
      }
      const payload = await response.json();
      return { payload, source: source.url };
    } catch (error) {
      console.warn(`Unable to load ${source.label} data`, error);
      lastError = error;
    }
  }
  throw lastError ?? new Error('Unable to load GOAT data from configured sources');
}

function formatDelta(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${helpers.formatNumber(value, 1)}`;
}

function tierSortValue(tier) {
  const normalized = typeof tier === 'string' && tier.trim().length ? tier : 'Uncategorized';
  const priority = TIER_PRIORITY.get(normalized);
  return typeof priority === 'number' ? priority : 100;
}

function groupPlayersByTier(players) {
  const tierMap = new Map();

  players.forEach((player) => {
    const tier = typeof player.tier === 'string' && player.tier.trim().length ? player.tier : 'Uncategorized';
    if (!tierMap.has(tier)) {
      tierMap.set(tier, []);
    }
    tierMap.get(tier).push(player);
  });

  return Array.from(tierMap.entries())
    .map(([tier, tierPlayers]) => ({
      tier,
      players: tierPlayers.slice().sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)),
    }))
    .sort((a, b) => {
      const tierDifference = tierSortValue(a.tier) - tierSortValue(b.tier);
      if (tierDifference !== 0) {
        return tierDifference;
      }
      return a.tier.localeCompare(b.tier);
    });
}

function buildWeightCards(weights) {
  const container = document.querySelector('[data-weight-list]');
  if (!container) return;

  container.innerHTML = '';

  weights.forEach((weight) => {
    const card = document.createElement('article');
    card.className = 'goat-weight-card';

    const header = document.createElement('header');

    const label = document.createElement('span');
    label.className = 'goat-weight-label';
    label.textContent = weight.label;

    const chip = document.createElement('span');
    chip.className = 'goat-weight-chip';
    chip.textContent = `${Math.round(weight.weight * 100)}%`;

    header.append(label, chip);

    const meter = document.createElement('div');
    meter.className = 'goat-weight-meter';
    const meterFill = document.createElement('span');
    meterFill.style.width = `${Math.min(100, Math.max(0, weight.weight * 100))}%`;
    meter.appendChild(meterFill);

    const description = document.createElement('p');
    description.className = 'goat-weight-copy';
    description.textContent = weight.description;

    card.append(header, meter, description);
    container.appendChild(card);
  });
}

function buildLeaderboard(players) {
  const container = document.querySelector('[data-goat-tree]');
  if (!container) return null;

  container.innerHTML = '';

  if (!players.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'goat-tree__placeholder';
    placeholder.textContent = 'Pantheon order will populate soon.';
    container.appendChild(placeholder);
    return null;
  }

  const grouped = groupPlayersByTier(players);
  let initialPlayerName = null;

  grouped.forEach((group, index) => {
    const details = document.createElement('details');
    details.className = 'goat-tier';
    details.dataset.tier = group.tier;
    if (index === 0) {
      details.open = true;
    }

    const summary = document.createElement('summary');
    summary.className = 'goat-tier__summary';

    const label = document.createElement('span');
    label.className = 'goat-tier__summary-label';
    label.textContent = TIER_LABEL_OVERRIDES.get(group.tier) ?? group.tier;

    const count = group.players.length;
    const playerWord = count === 1 ? 'player' : 'players';
    const numericScores = group.players
      .map((player) => (Number.isFinite(player.goatScore) ? player.goatScore : null))
      .filter((value) => value !== null);

    const summaryMeta = document.createElement('span');
    summaryMeta.className = 'goat-tier__summary-count';
    if (numericScores.length) {
      const topScore = Math.max(...numericScores);
      summaryMeta.textContent = `${count} ${playerWord} · top ${helpers.formatNumber(topScore, 1)}`;
    } else {
      summaryMeta.textContent = `${count} ${playerWord}`;
    }

    summary.append(label, summaryMeta);
    details.appendChild(summary);

    const list = document.createElement('ul');
    list.className = 'goat-tier__list';
    list.setAttribute('role', 'list');

    group.players.forEach((player) => {
      const item = document.createElement('li');
      item.className = 'goat-tier__item';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'goat-tier__player';
      button.setAttribute('data-goat-player', '');
      button.dataset.player = player.name;
      button.setAttribute('aria-pressed', 'false');
      button.title = `View GOAT profile for ${player.name}`;

      const rank = document.createElement('span');
      rank.className = 'goat-tier__player-rank';
      rank.textContent = Number.isFinite(player.rank) ? player.rank : '—';

      const nameBlock = document.createElement('div');
      nameBlock.className = 'goat-tier__player-name';

      const name = document.createElement('span');
      name.className = 'goat-player-name';
      name.textContent = player.name;
      nameBlock.appendChild(name);

      if (Array.isArray(player.franchises) && player.franchises.length) {
        const badges = document.createElement('div');
        badges.className = 'badge-list badge-list--compact';

        const franchiseBadge = document.createElement('span');
        franchiseBadge.className = 'badge badge--muted';
        franchiseBadge.textContent = player.franchises.join(' • ');
        badges.appendChild(franchiseBadge);

        nameBlock.appendChild(badges);
      }

      if (player.status) {
        const status = document.createElement('span');
        status.className = 'goat-status goat-status--inline';
        status.textContent = player.status;
        nameBlock.appendChild(status);
      }

      const score = document.createElement('span');
      score.className = 'goat-tier__player-score goat-score';
      score.textContent = Number.isFinite(player.goatScore) ? helpers.formatNumber(player.goatScore, 1) : '—';

      const delta = document.createElement('span');
      delta.className = 'goat-tier__player-delta goat-delta';
      delta.textContent = formatDelta(player.delta);
      if (typeof player.delta === 'number') {
        delta.dataset.trend = player.delta > 0 ? 'up' : player.delta < 0 ? 'down' : 'flat';
      }

      button.append(rank, nameBlock, score, delta);
      item.appendChild(button);
      list.appendChild(item);

      if (!initialPlayerName) {
        initialPlayerName = player.name;
      }
    });

    details.appendChild(list);
    container.appendChild(details);
  });

  return initialPlayerName;
}

function renderComponents(player, weights) {
  const list = document.querySelector('[data-goat-components]');
  if (!list) return;

  list.innerHTML = '';
  const componentEntries = Object.entries(player.goatComponents ?? {});
  const orderedComponents = weights
    .map((weight) => componentEntries.find(([key]) => key === weight.key))
    .filter(Boolean);

  if (!orderedComponents.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'goat-detail__placeholder';
    placeholder.textContent = 'Component breakdown coming soon.';
    list.appendChild(placeholder);
    return;
  }

  orderedComponents.forEach(([key, value]) => {
    const weightMeta = weights.find((item) => item.key === key);
    const dt = document.createElement('dt');
    dt.textContent = weightMeta?.label ?? key;

    const dd = document.createElement('dd');
    const bar = document.createElement('div');
    bar.className = 'goat-component-bar';

    const fill = document.createElement('div');
    fill.className = 'goat-component-fill';
    const valueLabel = document.createElement('span');
    valueLabel.className = 'goat-component-value';
    valueLabel.textContent = helpers.formatNumber(value, 1);

    fill.style.width = `${Math.min(100, Math.max(0, value))}%`;

    bar.append(fill, valueLabel);
    dd.append(bar);

    list.append(dt, dd);
  });
}

function selectPlayer(player, weights = []) {
  const name = document.querySelector('[data-goat-name]');
  const meta = document.querySelector('[data-goat-meta]');
  const resume = document.querySelector('[data-goat-resume]');
  const footer = document.querySelector('[data-goat-footer]');

  if (name) {
    name.textContent = player.name;
  }
  if (meta) {
    const details = [];
    if (player.careerSpan) {
      details.push(player.careerSpan);
    }
    if (player.primeWindow) {
      details.push(`Prime: ${player.primeWindow}`);
    }
    meta.textContent = details.join(' · ');
  }
  if (resume) {
    resume.textContent = player.resume ?? '';
  }
  if (footer) {
    footer.textContent = `Current tier: ${player.tier ?? '—'} · GOAT ${helpers.formatNumber(
      player.goatScore,
      1,
    )} (${player.status ?? 'Unknown'})`;
  }

  renderComponents(player, weights);
}

function wireInteractions(players, weights, initialPlayerName) {
  const buttons = Array.from(document.querySelectorAll('[data-goat-player]'));
  if (!buttons.length) {
    return;
  }

  const applySelection = (button, player) => {
    buttons.forEach((peer) => {
      peer.classList.remove('is-selected');
      peer.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('is-selected');
    button.setAttribute('aria-pressed', 'true');
    const tierSection = button.closest('details');
    if (tierSection) {
      tierSection.open = true;
    }
    selectPlayer(player, weights);
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const player = players.find((item) => item.name === button.dataset.player);
      if (player) {
        applySelection(button, player);
      }
    });
  });

  const defaultButton =
    (typeof initialPlayerName === 'string'
      ? buttons.find((button) => button.dataset.player === initialPlayerName)
      : null) ?? buttons[0];
  if (defaultButton) {
    const defaultPlayer = players.find((item) => item.name === defaultButton.dataset.player);
    if (defaultPlayer) {
      applySelection(defaultButton, defaultPlayer);
    }
  }
}

function updateHeroMetrics(players) {
  if (!players.length) {
    return;
  }
  const totalScore = players.reduce((sum, player) => sum + (Number.isFinite(player.goatScore) ? player.goatScore : 0), 0);
  const average = totalScore / players.length;
  const activeCount = players.filter((player) => (player.status ?? '').toLowerCase() === 'active').length;
  const multiFranchise = players.filter((player) => Array.isArray(player.franchises) && player.franchises.length >= 3);

  heroStats.averageGoat = average;
  heroStats.activeShare = players.length ? activeCount / players.length : 0;
  heroStats.multiFranchiseShare = players.length ? multiFranchise.length / players.length : 0;
  heroStats.multiFranchiseCount = multiFranchise.length;

  const saturationValue = document.querySelector('[data-hero-saturation-value]');
  if (saturationValue) {
    saturationValue.textContent = helpers.formatNumber(heroStats.averageGoat, 1);
  }
  const activeValue = document.querySelector('[data-hero-active-value]');
  if (activeValue) {
    activeValue.textContent = `${helpers.formatNumber(heroStats.activeShare * 100, 0)}%`;
  }
  const orbitValue = document.querySelector('[data-hero-orbit-value]');
  if (orbitValue) {
    orbitValue.textContent = `${helpers.formatNumber(heroStats.multiFranchiseShare * 100, 0)}%`;
  }
}

function getStartYear(player) {
  const match = /^\s*(\d{4})/.exec(player.careerSpan ?? '');
  if (!match) {
    return null;
  }
  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

async function init() {
  try {
    const { payload: data, source: goatDataSource } = await loadGoatData();
    const weights = Array.isArray(data?.weights) ? data.weights : [];
    const players = Array.isArray(data?.players) ? data.players : [];

    if (weights.length) {
      buildWeightCards(weights);
    }
    if (players.length) {
      const initialPlayerName = buildLeaderboard(players);
      wireInteractions(players, weights, initialPlayerName);
      updateHeroMetrics(players);
    }

    const gaugeDefinitions = [
      {
        element: document.querySelector('[data-chart="goat-saturation-gauge"]'),
        source: goatDataSource,
        async createConfig(source) {
          const playersSource = Array.isArray(source?.players) ? source.players : [];
          if (!playersSource.length) return null;
          const average = playersSource.reduce(
            (sum, player) => sum + (Number.isFinite(player.goatScore) ? player.goatScore : 0),
            0,
          ) / playersSource.length;
          const safeAverage = Math.max(0, Math.min(100, average));
          return {
            type: 'doughnut',
            data: {
              labels: ['Average GOAT', 'Headroom'],
              datasets: [
                {
                  data: [safeAverage, Math.max(0, 100 - safeAverage)],
                  backgroundColor: [palette.royal, 'rgba(17, 86, 214, 0.12)'],
                  borderWidth: 0,
                  hoverOffset: 0,
                },
              ],
            },
            options: {
              cutout: '68%',
              rotation: GAUGE_ROTATION,
              circumference: GAUGE_CIRCUMFERENCE,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label(context) {
                      return `${context.label}: ${helpers.formatNumber(context.parsed, 1)} GOAT`;
                    },
                  },
                },
                gaugeLabel: {
                  valueText: helpers.formatNumber(safeAverage, 1),
                  labelText: 'Avg GOAT',
                },
              },
            },
            plugins: [gaugeLabelPlugin],
          };
        },
      },
      {
        element: document.querySelector('[data-chart="goat-active-gauge"]'),
        source: goatDataSource,
        async createConfig(source) {
          const playersSource = Array.isArray(source?.players) ? source.players : [];
          if (!playersSource.length) return null;
          const activeCount = playersSource.filter(
            (player) => (player.status ?? '').toLowerCase() === 'active',
          ).length;
          const share = playersSource.length ? activeCount / playersSource.length : 0;
          const percent = Math.max(0, Math.min(100, share * 100));
          return {
            type: 'doughnut',
            data: {
              labels: ['Active pantheon', 'Legends'],
              datasets: [
                {
                  data: [percent, Math.max(0, 100 - percent)],
                  backgroundColor: ['rgba(18, 184, 134, 0.9)', 'rgba(18, 184, 134, 0.12)'],
                  borderWidth: 0,
                  hoverOffset: 0,
                },
              ],
            },
            options: {
              cutout: '68%',
              rotation: GAUGE_ROTATION,
              circumference: GAUGE_CIRCUMFERENCE,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label(context) {
                      return `${context.label}: ${helpers.formatNumber(context.parsed, 0)}%`;
                    },
                  },
                },
                gaugeLabel: {
                  valueText: `${helpers.formatNumber(percent, 0)}%`,
                  labelText: 'Active share',
                },
              },
            },
            plugins: [gaugeLabelPlugin],
          };
        },
      },
      {
        element: document.querySelector('[data-chart="goat-multi-franchise-gauge"]'),
        source: goatDataSource,
        async createConfig(source) {
          const playersSource = Array.isArray(source?.players) ? source.players : [];
          if (!playersSource.length) return null;
          const orbitPlayers = playersSource.filter(
            (player) => Array.isArray(player.franchises) && player.franchises.length >= 3,
          );
          const share = playersSource.length ? orbitPlayers.length / playersSource.length : 0;
          const percent = Math.max(0, Math.min(100, share * 100));
          return {
            type: 'doughnut',
            data: {
              labels: ['3+ franchises', 'Single orbit'],
              datasets: [
                {
                  data: [percent, Math.max(0, 100 - percent)],
                  backgroundColor: ['rgba(239, 61, 91, 0.9)', 'rgba(239, 61, 91, 0.12)'],
                  borderWidth: 0,
                  hoverOffset: 0,
                },
              ],
            },
            options: {
              cutout: '68%',
              rotation: GAUGE_ROTATION,
              circumference: GAUGE_CIRCUMFERENCE,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label(context) {
                      return `${context.label}: ${helpers.formatNumber(context.parsed, 0)}%`;
                    },
                  },
                },
                gaugeLabel: {
                  valueText: helpers.formatNumber(orbitPlayers.length, 0),
                  labelText: 'Orbit icons',
                },
              },
            },
            plugins: [gaugeLabelPlugin],
          };
        },
      },
    ];

    const chartDefinitions = [
      ...gaugeDefinitions,
      {
        element: document.querySelector('[data-chart="goat-weight-donut"]'),
        source: goatDataSource,
        async createConfig(source) {
          const weightsSource = Array.isArray(source?.weights) ? source.weights : [];
          if (!weightsSource.length) return null;
          return {
            type: 'doughnut',
            data: {
              labels: weightsSource.map((weight) => weight.label),
              datasets: [
                {
                  data: weightsSource.map((weight) => weight.weight * 100),
                  backgroundColor: componentPalette,
                  borderWidth: 0,
                },
              ],
            },
            options: {
              cutout: '55%',
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12 } },
                tooltip: {
                  callbacks: {
                    label(context) {
                      return `${context.label}: ${helpers.formatNumber(context.parsed, 0)}%`;
                    },
                  },
                },
              },
            },
          };
        },
      },
      {
        element: document.querySelector('[data-chart="goat-top-bar"]'),
        source: goatDataSource,
        async createConfig(source) {
          const series = Array.isArray(source?.players)
            ? source.players.slice().sort((a, b) => a.rank - b.rank).slice(0, 10)
            : [];
          if (!series.length) return null;
          return {
            type: 'bar',
            data: {
              labels: series.map((player) => player.name),
              datasets: [
                {
                  label: 'GOAT score',
                  data: series.map((player) => player.goatScore),
                  backgroundColor: palette.sky,
                  borderColor: palette.royal,
                  borderWidth: 1,
                },
              ],
            },
            options: {
              layout: { padding: { top: 8, right: 12, bottom: 8, left: 12 } },
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label(context) {
                      return `${context.label}: ${helpers.formatNumber(context.parsed.y, 1)} GOAT`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  ticks: { maxRotation: 0, minRotation: 0 },
                  grid: { display: false },
                },
                y: {
                  beginAtZero: true,
                  suggestedMax: 100,
                  grid: { color: 'rgba(11, 37, 69, 0.08)' },
                },
              },
            },
          };
        },
      },
      {
        element: document.querySelector('[data-chart="goat-component-radar"]'),
        source: goatDataSource,
        async createConfig(source) {
          const weightsSource = Array.isArray(source?.weights) ? source.weights : [];
          const playersSource = Array.isArray(source?.players)
            ? source.players.slice().sort((a, b) => a.rank - b.rank).slice(0, 3)
            : [];
          if (!playersSource.length || !weightsSource.length) return null;
          const labels = weightsSource.map((weight) => weight.label ?? weight.key);
          const datasets = playersSource.map((player, index) => {
            const color = [palette.royal, palette.coral, palette.teal][index % 3];
            return {
              label: player.name,
              data: weightsSource.map((weight) => player.goatComponents?.[weight.key] ?? 0),
              borderColor: color,
              backgroundColor: `${color}29`,
              pointBackgroundColor: color,
              pointRadius: 3,
            };
          });
          return {
            type: 'radar',
            data: { labels, datasets },
            options: {
              plugins: { legend: { position: 'top' } },
              scales: {
                r: {
                  suggestedMin: 0,
                  suggestedMax: 40,
                  angleLines: { color: 'rgba(11, 37, 69, 0.08)' },
                  grid: { color: 'rgba(11, 37, 69, 0.1)' },
                  ticks: { display: false },
                },
              },
            },
          };
        },
      },
      {
        element: document.querySelector('[data-chart="goat-impact-longevity"]'),
        source: goatDataSource,
        async createConfig(source) {
          const playersSource = Array.isArray(source?.players) ? source.players : [];
          if (!playersSource.length) return null;
          const dataset = playersSource
            .filter((player) => player.goatComponents)
            .map((player) => ({
              x: player.goatComponents.impact ?? 0,
              y: player.goatComponents.longevity ?? 0,
              goatScore: player.goatScore ?? 0,
              name: player.name,
              tier: player.tier ?? 'Unknown',
            }));
          return {
            type: 'scatter',
            data: {
              datasets: [
                {
                  label: 'Players',
                  data: dataset,
                  backgroundColor: 'rgba(17, 86, 214, 0.35)',
                  borderColor: palette.royal,
                  borderWidth: 1,
                  pointRadius(context) {
                    const value = context?.raw?.goatScore ?? 0;
                    return Math.max(4, value / 6);
                  },
                },
              ],
            },
            options: {
              parsing: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label(context) {
                      const raw = context.raw;
                      return `${raw.name}: Impact ${helpers.formatNumber(raw.x, 1)}, Longevity ${helpers.formatNumber(
                        raw.y,
                        1,
                      )}`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  title: { display: true, text: 'Prime impact' },
                  grid: { color: 'rgba(11, 37, 69, 0.08)' },
                },
                y: {
                  title: { display: true, text: 'Longevity credit' },
                  grid: { color: 'rgba(11, 37, 69, 0.08)' },
                },
              },
            },
          };
        },
      },
      {
        element: document.querySelector('[data-chart="goat-stage-versatility"]'),
        source: goatDataSource,
        async createConfig(source) {
          const playersSource = Array.isArray(source?.players) ? source.players : [];
          if (!playersSource.length) return null;
          const dataset = playersSource
            .filter((player) => player.goatComponents)
            .map((player) => ({
              x: player.goatComponents.stage ?? 0,
              y: player.goatComponents.versatility ?? 0,
              r: Math.max(6, (player.goatScore ?? 0) * 0.25),
              name: player.name,
              status: player.status ?? 'Unknown',
            }));
          return {
            type: 'bubble',
            data: {
              datasets: [
                {
                  label: 'Stage vs versatility',
                  data: dataset,
                  backgroundColor: 'rgba(239, 61, 91, 0.32)',
                  borderColor: palette.coral,
                  borderWidth: 1,
                },
              ],
            },
            options: {
              parsing: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label(context) {
                      const raw = context.raw;
                      return `${raw.name}: Stage ${helpers.formatNumber(raw.x, 1)}, Versatility ${helpers.formatNumber(
                        raw.y,
                        1,
                      )}`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  title: { display: true, text: 'Stage dominance' },
                  grid: { color: 'rgba(11, 37, 69, 0.08)' },
                },
                y: {
                  title: { display: true, text: 'Versatility credit' },
                  grid: { color: 'rgba(11, 37, 69, 0.08)' },
                },
              },
            },
          };
        },
      },
      {
        element: document.querySelector('[data-chart="goat-delta-bars"]'),
        source: goatDataSource,
        async createConfig(source) {
          const playersSource = Array.isArray(source?.players) ? source.players : [];
          const deltaSeries = playersSource
            .filter((player) => typeof player.delta === 'number')
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
            .slice(0, 10);
          if (!deltaSeries.length) return null;
          const colors = deltaSeries.map((player) =>
            player.delta > 0 ? 'rgba(18, 184, 134, 0.85)' : player.delta < 0 ? 'rgba(239, 61, 91, 0.85)' : palette.gold,
          );
          return {
            type: 'bar',
            data: {
              labels: deltaSeries.map((player) => player.name),
              datasets: [
                {
                  label: 'Δ 12 mo.',
                  data: deltaSeries.map((player) => player.delta ?? 0),
                  backgroundColor: colors,
                },
              ],
            },
            options: {
              indexAxis: 'y',
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label(context) {
                      return `${context.label}: ${formatDelta(context.parsed.x)} GOAT`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  grid: { color: 'rgba(11, 37, 69, 0.08)' },
                  title: { display: true, text: '12-month delta' },
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
        element: document.querySelector('[data-chart="goat-decade-curve"]'),
        source: goatDataSource,
        async createConfig(source) {
          const playersSource = Array.isArray(source?.players) ? source.players : [];
          const decadeMap = new Map();
          playersSource.forEach((player) => {
            const year = getStartYear(player);
            if (!year) return;
            const decade = Math.floor(year / 10) * 10;
            decadeMap.set(decade, (decadeMap.get(decade) ?? 0) + 1);
          });
          const entries = Array.from(decadeMap.entries()).sort((a, b) => a[0] - b[0]);
          if (!entries.length) return null;
          return {
            type: 'line',
            data: {
              labels: entries.map(([decade]) => `${decade}s`),
              datasets: [
                {
                  label: 'Debut cohort',
                  data: entries.map(([, count]) => count),
                  tension: 0.35,
                  fill: 'origin',
                  backgroundColor: 'rgba(17, 86, 214, 0.18)',
                  borderColor: palette.royal,
                  pointRadius: 3,
                },
              ],
            },
            options: {
              plugins: { legend: { display: false } },
              scales: {
                x: { grid: { display: false } },
                y: {
                  beginAtZero: true,
                  grid: { color: 'rgba(11, 37, 69, 0.08)' },
                  ticks: { precision: 0 },
                },
              },
            },
          };
        },
      },
      {
        element: document.querySelector('[data-chart="goat-franchise-polar"]'),
        source: goatDataSource,
        async createConfig(source) {
          const playersSource = Array.isArray(source?.players) ? source.players : [];
          const franchiseCounts = new Map();
          playersSource.forEach((player) => {
            (player.franchises ?? []).forEach((franchise) => {
              franchiseCounts.set(franchise, (franchiseCounts.get(franchise) ?? 0) + 1);
            });
          });
          const entries = Array.from(franchiseCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
          if (!entries.length) return null;
          return {
            type: 'polarArea',
            data: {
              labels: entries.map(([team]) => team),
              datasets: [
                {
                  data: entries.map(([, count]) => count),
                  backgroundColor: entries.map((_, index) => componentPalette[index % componentPalette.length]),
                  borderWidth: 0,
                },
              ],
            },
            options: {
              plugins: {
                legend: { position: 'right' },
                tooltip: {
                  callbacks: {
                    label(context) {
                      const parsedValue =
                        typeof context.parsed === 'number' ? context.parsed : context.parsed?.r;
                      if (typeof parsedValue === 'number' && !Number.isNaN(parsedValue)) {
                        return `${context.label}: ${parsedValue}`;
                      }
                      return context.label ?? '';
                    },
                  },
                },
              },
            },
          };
        },
      },
      {
        element: document.querySelector('[data-chart="goat-versatility-stream"]'),
        source: goatDataSource,
        async createConfig(source) {
          const playersSource = Array.isArray(source?.players) ? source.players : [];
          const values = playersSource
            .map((player) => player.goatComponents?.versatility)
            .filter((value) => typeof value === 'number' && !Number.isNaN(value))
            .sort((a, b) => b - a);
          if (!values.length) return null;
          const labels = values.map((_, index) => `#${index + 1}`);
          return {
            type: 'line',
            data: {
              labels,
              datasets: [
                {
                  label: 'Versatility score',
                  data: values,
                  fill: 'origin',
                  tension: 0.38,
                  backgroundColor: 'rgba(143, 110, 252, 0.18)',
                  borderColor: palette.lilac,
                  pointRadius: 0,
                },
              ],
            },
            options: {
              plugins: { legend: { display: false } },
              scales: {
                x: { display: false },
                y: {
                  grid: { color: 'rgba(11, 37, 69, 0.08)' },
                  suggestedMin: Math.max(0, Math.min(...values) - 2),
                },
              },
            },
          };
        },
      },
      {
        element: document.querySelector('[data-chart="goat-tier-wheel"]'),
        source: goatDataSource,
        async createConfig(source) {
          const playersSource = Array.isArray(source?.players) ? source.players : [];
          if (!playersSource.length) return null;
          const tierCounts = playersSource.reduce((map, player) => {
            const tier = player.tier ?? 'Unlisted';
            map.set(tier, (map.get(tier) ?? 0) + 1);
            return map;
          }, new Map());
          const entries = Array.from(tierCounts.entries()).sort((a, b) => b[1] - a[1]);
          return {
            type: 'doughnut',
            data: {
              labels: entries.map(([tier]) => tier),
              datasets: [
                {
                  data: entries.map(([, count]) => count),
                  backgroundColor: entries.map((_, index) => componentPalette[index % componentPalette.length]),
                  borderWidth: 0,
                },
              ],
            },
            options: {
              cutout: '50%',
              plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                  callbacks: {
                    label(context) {
                      return `${context.label}: ${context.parsed}`;
                    },
                  },
                },
              },
            },
          };
        },
      },
      {
        element: document.querySelector('[data-chart="goat-era-delta"]'),
        source: goatDataSource,
        async createConfig(source) {
          const playersSource = Array.isArray(source?.players) ? source.players : [];
          const dataset = playersSource
            .map((player) => ({
              x: getStartYear(player),
              y: typeof player.delta === 'number' ? player.delta : null,
              name: player.name,
              tier: player.tier ?? 'Unknown',
            }))
            .filter((item) => Number.isFinite(item.x) && typeof item.y === 'number');
          if (!dataset.length) return null;
          return {
            type: 'scatter',
            data: {
              datasets: [
                {
                  label: 'Era deltas',
                  data: dataset,
                  backgroundColor: 'rgba(244, 181, 63, 0.32)',
                  borderColor: palette.gold,
                  borderWidth: 1,
                  pointRadius: 5,
                },
              ],
            },
            options: {
              parsing: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label(context) {
                      const raw = context.raw;
                      return `${raw.name}: ${raw.x} debut, Δ ${formatDelta(raw.y)}`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  type: 'linear',
                  title: { display: true, text: 'Debut year' },
                  grid: { color: 'rgba(11, 37, 69, 0.08)' },
                  ticks: { stepSize: 5 },
                },
                y: {
                  title: { display: true, text: '12-month GOAT delta' },
                  grid: { color: 'rgba(11, 37, 69, 0.08)' },
                },
              },
            },
          };
        },
      },
    ];

    registerCharts(chartDefinitions);
  } catch (error) {
    console.error(error);
  }
}

init();
