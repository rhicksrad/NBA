import { registerCharts, helpers } from './hub-charts.js';

const DATA_SOURCE = 'data/players_overview.json';

const palette = {
  royal: '#1156d6',
  sky: 'rgba(31, 123, 255, 0.75)',
  gold: '#f4b53f',
};

registerCharts([
  {
    element: document.querySelector('[data-chart="player-heights"]'),
    source: DATA_SOURCE,
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
    source: DATA_SOURCE,
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

function formatHeight(inches, { maximumFractionDigits = 0 } = {}) {
  if (!Number.isFinite(inches)) return '—';
  const feet = Math.floor(inches / 12);
  const remaining = inches - feet * 12;
  const inchString = remaining.toFixed(Math.max(0, maximumFractionDigits));
  const trimmed = maximumFractionDigits === 0 ? inchString.replace(/\.0+$/, '') : inchString;
  return `${feet}'${trimmed}\"`;
}

function formatWeight(pounds) {
  if (!Number.isFinite(pounds)) return '—';
  return `${helpers.formatNumber(pounds, 0)} lbs`;
}

function renderSummary(data) {
  const totalPlayers = document.querySelector('[data-stat="total-players"]');
  const avgHeight = document.querySelector('[data-stat="average-height"]');
  const avgWeight = document.querySelector('[data-stat="average-weight"]');
  const roleBreakdown = document.querySelector('[data-stat="role-breakdown"]');
  const countries = document.querySelector('[data-stat="countries"]');

  if (!data?.totals) return;

  const { players, averageHeightInches, averageWeightPounds, guards, forwards, centers, countriesRepresented } =
    data.totals;

  if (totalPlayers) {
    totalPlayers.textContent = helpers.formatNumber(players, 0);
  }

  if (avgHeight) {
    avgHeight.textContent = formatHeight(averageHeightInches, { maximumFractionDigits: 1 });
  }

  if (avgWeight) {
    avgWeight.textContent = formatWeight(averageWeightPounds);
  }

  if (roleBreakdown) {
    const totalRolePlayers = guards + forwards + centers || players || 0;
    if (totalRolePlayers) {
      const segments = [
        ['G', guards],
        ['F', forwards],
        ['C', centers],
      ].map(([label, value]) => {
        const percent = (value / totalRolePlayers) * 100;
        return `${label} ${helpers.formatNumber(percent, 0)}%`;
      });
      roleBreakdown.textContent = segments.join(' • ');
    }
  }

  if (countries) {
    countries.textContent = helpers.formatNumber(countriesRepresented, 0);
  }
}

function renderRankedList(root, list, labelKey, valueKey) {
  if (!root || !Array.isArray(list) || !list.length) return;
  const fragment = document.createDocumentFragment();
  list.forEach((entry) => {
    const item = document.createElement('li');
    item.textContent = entry?.[labelKey] ?? 'Unknown';
    const detail = document.createElement('span');
    const value = entry?.[valueKey];
    detail.textContent = Number.isFinite(value)
      ? `${helpers.formatNumber(value, 0)} players`
      : '—';
    item.appendChild(detail);
    fragment.appendChild(item);
  });
  root.innerHTML = '';
  root.appendChild(fragment);
}

function renderTallestTable(root, tallest) {
  if (!root || !Array.isArray(tallest) || !tallest.length) return;
  const tbody = root.querySelector('tbody');
  if (!tbody) return;

  const rows = tallest.slice(0, 10).map((player) => {
    const row = document.createElement('tr');

    const nameCell = document.createElement('th');
    nameCell.scope = 'row';
    nameCell.textContent = player?.name ?? 'Unknown';
    row.appendChild(nameCell);

    const heightCell = document.createElement('td');
    heightCell.textContent = formatHeight(player?.heightInches, { maximumFractionDigits: 0 });
    row.appendChild(heightCell);

    const weightCell = document.createElement('td');
    weightCell.textContent = formatWeight(player?.weightPounds);
    row.appendChild(weightCell);

    const countryCell = document.createElement('td');
    countryCell.textContent = player?.country ?? '—';
    row.appendChild(countryCell);

    const positionCell = document.createElement('td');
    positionCell.textContent = Array.isArray(player?.positions) && player.positions.length
      ? player.positions.join(' / ')
      : '—';
    row.appendChild(positionCell);

    return row;
  });

  tbody.innerHTML = '';
  rows.forEach((row) => tbody.appendChild(row));
}

async function hydratePlayersPage() {
  try {
    const response = await fetch(DATA_SOURCE);
    if (!response.ok) {
      throw new Error(`Failed to load player overview: ${response.status}`);
    }
    const data = await response.json();

    renderSummary(data);
    renderRankedList(document.querySelector('[data-list="countries"]'), data?.countries?.slice(0, 6), 'country', 'players');
    renderRankedList(document.querySelector('[data-list="colleges"]'), data?.colleges?.slice(0, 6), 'program', 'players');
    renderTallestTable(document.querySelector('[data-table="tallest"]'), data?.tallestPlayers);
  } catch (error) {
    console.error(error);
  }
}

hydratePlayersPage();
