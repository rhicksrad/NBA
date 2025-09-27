import { registerCharts, helpers } from './hub-charts.js';

const palette = {
  royal: '#1156d6',
  sky: 'rgba(31, 123, 255, 0.75)',
  gold: '#f4b53f',
  navy: '#0b2545',
};

async function loadGoatData() {
  const response = await fetch('data/goat_index.json');
  if (!response.ok) {
    throw new Error(`Unable to load GOAT index: ${response.status}`);
  }
  return response.json();
}

function formatDelta(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${helpers.formatNumber(value, 1)}`;
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

    const description = document.createElement('p');
    description.className = 'goat-weight-copy';
    description.textContent = weight.description;

    card.append(header, description);
    container.appendChild(card);
  });
}

function buildLeaderboard(players, weights) {
  const table = document.querySelector('[data-goat-table] tbody');
  if (!table) return;

  table.innerHTML = '';

  players
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .forEach((player, index) => {
      const row = document.createElement('tr');
      row.dataset.player = player.name;
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-pressed', 'false');

      const rank = document.createElement('td');
      rank.textContent = player.rank;
      rank.setAttribute('data-label', 'Rank');

      const nameCell = document.createElement('td');
      const name = document.createElement('span');
      name.className = 'goat-player-name';
      name.textContent = player.name;
      nameCell.appendChild(name);

      const badges = document.createElement('div');
      badges.className = 'badge-list badge-list--compact';

      if (player.tier) {
        const tierBadge = document.createElement('span');
        tierBadge.className = 'badge';
        tierBadge.textContent = player.tier;
        badges.appendChild(tierBadge);
      }

      if (player.franchises?.length) {
        const franchiseBadge = document.createElement('span');
        franchiseBadge.className = 'badge badge--muted';
        franchiseBadge.textContent = player.franchises.join(' • ');
        badges.appendChild(franchiseBadge);
      }

      if (badges.children.length) {
        nameCell.appendChild(badges);
      }

      const score = document.createElement('td');
      score.className = 'goat-score';
      score.textContent = helpers.formatNumber(player.goatScore, 1);
      score.setAttribute('data-label', 'GOAT score');

      const delta = document.createElement('td');
      delta.className = 'goat-delta';
      delta.textContent = formatDelta(player.delta);
      delta.setAttribute('data-label', '12 month delta');
      if (typeof player.delta === 'number') {
        delta.dataset.trend = player.delta > 0 ? 'up' : player.delta < 0 ? 'down' : 'flat';
      }

      const status = document.createElement('td');
      status.className = 'goat-status';
      status.textContent = player.status ?? '—';

      row.append(rank, nameCell, score, delta, status);
      table.appendChild(row);

      if (index === 0) {
        selectPlayer(player, weights);
        row.setAttribute('aria-pressed', 'true');
        row.classList.add('is-selected');
      }
    });
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
    footer.textContent = `Current tier: ${player.tier ?? '—'} · GOAT ${helpers.formatNumber(player.goatScore, 1)} (${player.status ?? 'Unknown'})`;
  }

  renderComponents(player, weights);
}

function wireInteractions(players, weights) {
  const rows = document.querySelectorAll('[data-goat-table] tbody tr');
  rows.forEach((row) => {
    row.addEventListener('click', () => {
      rows.forEach((peer) => {
        peer.classList.remove('is-selected');
        peer.setAttribute('aria-pressed', 'false');
      });
      row.classList.add('is-selected');
      row.setAttribute('aria-pressed', 'true');
      const player = players.find((item) => item.name === row.dataset.player);
      if (player) {
        selectPlayer(player, weights);
      }
    });
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        row.click();
      }
    });
  });
}

function buildRisers(risers) {
  const container = document.querySelector('[data-goat-risers]');
  if (!container) return;

  container.innerHTML = '';

  risers.forEach((riser) => {
    const card = document.createElement('article');
    card.className = 'goat-riser-card';

    const title = document.createElement('h3');
    title.textContent = riser.name;

    const subtitle = document.createElement('p');
    subtitle.className = 'goat-riser-meta';
    const rankPart = typeof riser.currentRank === 'number' ? `Rank #${riser.currentRank}` : 'Not yet ranked';
    subtitle.textContent = `${rankPart} · Δ ${formatDelta(riser.delta)} (${riser.trajectory ?? '—'})`;

    const signal = document.createElement('p');
    signal.textContent = riser.signal;

    card.append(title, subtitle, signal);
    container.appendChild(card);
  });
}

async function init() {
  try {
    const data = await loadGoatData();
    const weights = Array.isArray(data?.weights) ? data.weights : [];
    const players = Array.isArray(data?.players) ? data.players : [];
    const risers = Array.isArray(data?.rising) ? data.rising : [];

    if (weights.length) {
      buildWeightCards(weights);
    }
    if (players.length) {
      buildLeaderboard(players, weights);
      wireInteractions(players, weights);
    }
    if (risers.length) {
      buildRisers(risers);
    }

    registerCharts([
      {
        element: document.querySelector('[data-chart="goat-top-bar"]'),
        source: 'data/goat_index.json',
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
    ]);
  } catch (error) {
    console.error(error);
  }
}

init();
