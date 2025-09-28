import { registerCharts, helpers } from './hub-charts.js';

const DATA_URL = 'data/insights_lab.json';

function setMetric(key, value, fallback = '--') {
  const target = document.querySelector(`[data-metric="${key}"]`);
  if (!target) {
    return;
  }
  target.textContent = value ?? fallback;
}

function fallbackConfig(message) {
  return {
    type: 'bar',
    data: {
      labels: [''],
      datasets: [
        {
          label: 'Pending data',
          data: [1],
          backgroundColor: ['rgba(17, 86, 214, 0.12)'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        title: { display: true, text: message },
      },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    },
  };
}

function updateHero(data) {
  const seasonalSwing = data?.seasonalScoring?.swing;
  const seasonalText = Number.isFinite(seasonalSwing)
    ? `${helpers.formatNumber(seasonalSwing, 1)} pts`
    : null;
  setMetric('seasonal-swing', seasonalText);
  setMetric('seasonal-swing-detail', seasonalText);

  const restSwing = data?.restImpact?.swing;
  const restText = Number.isFinite(restSwing)
    ? `${helpers.formatNumber(restSwing * 100, 1)} win% gap`
    : null;
  setMetric('rest-gap', restText);
  setMetric('rest-gap-detail', restText);

  const closeShare = data?.closeMargins?.closeShare;
  const closeText = Number.isFinite(closeShare)
    ? `${helpers.formatNumber(closeShare * 100, 1)}% of games ≤5 pts`
    : null;
  setMetric('close-share', closeText);
  setMetric('close-share-detail', closeText);

  const catsWins = data?.mascotShowdown?.summary?.catsWins;
  const catsLosses = data?.mascotShowdown?.summary?.catsLosses;
  const catsWinPct = data?.mascotShowdown?.summary?.catsWinPct;
  const dogsWins = data?.mascotShowdown?.summary?.dogsWins;
  let ledgerText = null;
  if (Number.isFinite(catsWins) && Number.isFinite(catsLosses) && Number.isFinite(catsWinPct)) {
    const base = `Cats ${helpers.formatNumber(catsWins, 0)}-${helpers.formatNumber(catsLosses, 0)} (${helpers.formatNumber(
      catsWinPct * 100,
      1,
    )}% win)`;
    if (Number.isFinite(dogsWins)) {
      const margin = dogsWins - catsWins;
      const leader = margin === 0
        ? 'Ledger tied'
        : margin > 0
          ? `Dogs +${helpers.formatNumber(Math.abs(margin), 0)} wins`
          : `Cats +${helpers.formatNumber(Math.abs(margin), 0)} wins`;
      ledgerText = `${base} · ${leader}`;
    } else {
      ledgerText = base;
    }
  }
  setMetric('mascot-ledger', ledgerText);

  const catTeams = Array.isArray(data?.mascotShowdown?.catBreakdown) ? data.mascotShowdown.catBreakdown : [];
  const dogTeams = Array.isArray(data?.mascotShowdown?.dogBreakdown) ? data.mascotShowdown.dogBreakdown : [];
  const bestCat = [...catTeams]
    .filter((entry) => Number.isFinite(entry?.winPct) && Number.isFinite(entry?.wins) && Number.isFinite(entry?.losses))
    .sort((a, b) => (b.winPct ?? 0) - (a.winPct ?? 0))[0];
  const bestDog = [...dogTeams]
    .filter((entry) => Number.isFinite(entry?.winPct) && Number.isFinite(entry?.wins) && Number.isFinite(entry?.losses))
    .sort((a, b) => (b.winPct ?? 0) - (a.winPct ?? 0))[0];
  const leaderText = bestCat && bestDog
    ? `Top cat: ${bestCat.team} (${helpers.formatNumber(bestCat.winPct * 100, 1)}% vs dogs) · Top dog: ${bestDog.team} (${helpers.formatNumber(
        bestDog.winPct * 100,
        1,
      )}% vs cats)`
    : null;
  setMetric('mascot-leaders', leaderText);

  const sampleSize = data?.sampleSize;
  setMetric('sample-size', Number.isFinite(sampleSize) ? `${helpers.formatNumber(sampleSize, 0)} games` : null);

  const overtimeCategories = Array.isArray(data?.overtime?.categories)
    ? data.overtime.categories.filter((entry) => Number.isFinite(entry?.roadWinPct))
    : [];
  const regulation = overtimeCategories.find((entry) => entry.label === 'Regulation');
  const bestOvertime = [...overtimeCategories]
    .filter((entry) => entry.label !== 'Regulation')
    .sort((a, b) => (b.roadWinPct ?? 0) - (a.roadWinPct ?? 0))[0];
  const overtimeText = regulation && bestOvertime
    ? `${helpers.formatNumber((bestOvertime.roadWinPct - regulation.roadWinPct) * 100, 1)} win% lift`
    : null;
  setMetric('overtime-road-boost', overtimeText);

  const seasons = Array.isArray(data?.threePointTrend?.seasons) ? data.threePointTrend.seasons : [];
  const recent = [...seasons]
    .filter((entry) => Number.isFinite(entry?.threePointRate))
    .sort((a, b) => (b.season ?? 0) - (a.season ?? 0))[0];
  const threeText = recent
    ? `${recent.season}: ${helpers.formatNumber((recent.threePointRate ?? 0) * 100, 1)}% 3PA share`
    : null;
  setMetric('three-rate-current', threeText);
}

function buildSeasonalChart(dataRef) {
  const months = Array.isArray(dataRef?.seasonalScoring?.months) ? dataRef.seasonalScoring.months : [];
  if (!months.length) {
    return fallbackConfig('Monthly scoring data unavailable');
  }

  const labels = months.map((entry) => entry.month ?? 'Month');
  const overall = months.map((entry) => entry.averagePoints ?? null);
  const regular = months.map((entry) => entry.regularSeasonAverage ?? null);
  const playoff = months.map((entry) => entry.playoffAverage ?? null);

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'All games',
          data: overall,
          borderColor: '#1156d6',
          backgroundColor: 'rgba(17, 86, 214, 0.16)',
          borderWidth: 2,
          tension: 0.3,
          spanGaps: true,
          fill: 'origin',
        },
        {
          label: 'Regular season',
          data: regular,
          borderColor: '#0b2545',
          backgroundColor: 'rgba(11, 37, 69, 0.12)',
          borderWidth: 1.5,
          tension: 0.3,
          spanGaps: true,
          fill: false,
        },
        {
          label: 'Playoffs',
          data: playoff,
          borderColor: '#ef3d5b',
          backgroundColor: 'rgba(239, 61, 91, 0.12)',
          borderWidth: 1.5,
          tension: 0.3,
          spanGaps: true,
          fill: false,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          title: { display: true, text: 'Average combined points' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        x: {
          grid: { color: 'rgba(17, 86, 214, 0.05)' },
        },
      },
    },
  };
}

function buildRestImpactChart(dataRef) {
  const buckets = Array.isArray(dataRef?.restImpact?.buckets) ? dataRef.restImpact.buckets : [];
  if (!buckets.length) {
    return fallbackConfig('Rest advantage data unavailable');
  }

  const labels = buckets.map((entry) => entry.label ?? 'Bucket');
  const winPct = buckets.map((entry) => (Number.isFinite(entry.winPct) ? entry.winPct * 100 : null));
  const margin = buckets.map((entry) => Number.isFinite(entry.pointMargin) ? entry.pointMargin : null);

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Road win %',
          data: winPct,
          backgroundColor: '#ef3d5b',
          borderRadius: 18,
          maxBarThickness: 52,
        },
        {
          type: 'line',
          label: 'Avg point margin',
          data: margin,
          yAxisID: 'margin',
          borderColor: '#0b2545',
          borderWidth: 2,
          tension: 0.32,
          pointRadius: 4,
          fill: false,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Road win percentage' },
          ticks: { callback: (value) => `${helpers.formatNumber(value, 0)}%` },
          grid: { color: 'rgba(239, 61, 91, 0.12)' },
        },
        margin: {
          position: 'right',
          title: { display: true, text: 'Average point margin' },
          grid: { drawOnChartArea: false },
        },
        x: {
          grid: { color: 'rgba(239, 61, 91, 0.05)' },
        },
      },
    },
  };
}

function buildCloseMarginsChart(dataRef) {
  const distribution = Array.isArray(dataRef?.closeMargins?.distribution)
    ? dataRef.closeMargins.distribution
    : [];
  if (!distribution.length) {
    return fallbackConfig('Close game distribution unavailable');
  }

  const labels = distribution.map((entry) => entry.label ?? 'Bucket');
  const shares = distribution.map((entry) => (Number.isFinite(entry.share) ? entry.share * 100 : null));
  const margins = distribution.map((entry) => Number.isFinite(entry.averageMargin) ? entry.averageMargin : null);

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Share of games',
          data: shares,
          backgroundColor: '#1156d6',
          borderRadius: 18,
          maxBarThickness: 48,
        },
        {
          type: 'line',
          label: 'Average margin',
          data: margins,
          yAxisID: 'margin',
          borderColor: '#f4b53f',
          borderWidth: 2,
          tension: 0.32,
          pointRadius: 4,
          fill: false,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (value) => `${helpers.formatNumber(value, 0)}%` },
          title: { display: true, text: 'Share of total games' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        margin: {
          position: 'right',
          title: { display: true, text: 'Average point margin' },
          grid: { drawOnChartArea: false },
        },
        x: {
          grid: { color: 'rgba(17, 86, 214, 0.05)' },
        },
      },
    },
  };
}

function buildOvertimeChart(dataRef) {
  const categories = Array.isArray(dataRef?.overtime?.categories) ? dataRef.overtime.categories : [];
  if (!categories.length) {
    return fallbackConfig('Overtime sample unavailable');
  }

  const labels = categories.map((entry) => entry.label ?? 'Bucket');
  const shares = categories.map((entry) => (Number.isFinite(entry.share) ? entry.share * 100 : null));
  const winPct = categories.map((entry) => (Number.isFinite(entry.roadWinPct) ? entry.roadWinPct * 100 : null));

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Share of games',
          data: shares,
          backgroundColor: '#0b2545',
          borderRadius: 16,
          maxBarThickness: 48,
        },
        {
          type: 'line',
          label: 'Road win %',
          data: winPct,
          yAxisID: 'win',
          borderColor: '#ef3d5b',
          borderWidth: 2,
          tension: 0.32,
          pointRadius: 4,
          fill: false,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (value) => `${helpers.formatNumber(value, 0)}%` },
          title: { display: true, text: 'Share of total games' },
          grid: { color: 'rgba(11, 37, 69, 0.12)' },
        },
        win: {
          position: 'right',
          title: { display: true, text: 'Road win percentage' },
          grid: { drawOnChartArea: false },
        },
        x: {
          grid: { color: 'rgba(11, 37, 69, 0.05)' },
        },
      },
    },
  };
}

function buildMascotShowdownChart(dataRef) {
  const trends = Array.isArray(dataRef?.mascotShowdown?.seasonTrends) ? dataRef.mascotShowdown.seasonTrends : [];
  if (!trends.length) {
    return fallbackConfig('Mascot showdown history unavailable');
  }

  const labels = trends.map((entry) => {
    if (!Number.isFinite(entry?.season)) {
      return 'Season';
    }
    const next = ((entry.season ?? 0) + 1).toString().slice(-2).padStart(2, '0');
    return `${entry.season}-${next}`;
  });
  const catPct = trends.map((entry) => (Number.isFinite(entry?.catWinPct) ? entry.catWinPct * 100 : null));
  const dogPct = trends.map((entry) => (Number.isFinite(entry?.dogWinPct) ? entry.dogWinPct * 100 : null));
  const games = trends.map((entry) => (Number.isFinite(entry?.games) ? entry.games : null));

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Games played',
          data: games,
          backgroundColor: 'rgba(17, 86, 214, 0.18)',
          borderRadius: 18,
          maxBarThickness: 28,
          yAxisID: 'games',
        },
        {
          type: 'line',
          label: 'Cat win %',
          data: catPct,
          borderColor: '#ef3d5b',
          backgroundColor: 'rgba(239, 61, 91, 0.18)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.25,
          fill: 'origin',
          yAxisID: 'pct',
        },
        {
          type: 'line',
          label: 'Dog win %',
          data: dogPct,
          borderColor: '#0b2545',
          backgroundColor: 'rgba(11, 37, 69, 0.16)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.25,
          fill: false,
          yAxisID: 'pct',
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        pct: {
          beginAtZero: true,
          suggestedMax: 100,
          title: { display: true, text: 'Win percentage' },
          ticks: { callback: (value) => `${helpers.formatNumber(value, 0)}%` },
          grid: { color: 'rgba(11, 37, 69, 0.12)' },
        },
        games: {
          position: 'right',
          title: { display: true, text: 'Matchups per season' },
          grid: { drawOnChartArea: false },
        },
        x: {
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
          grid: { color: 'rgba(17, 86, 214, 0.05)' },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title(context) {
              const item = context?.[0];
              const label = item?.label ?? '';
              const season = trends?.[item?.dataIndex ?? -1]?.season;
              if (!Number.isFinite(season)) {
                return label;
              }
              const endYear = season + 1;
              return `${season}-${endYear}`;
            },
            label(context) {
              if (context.dataset.type === 'bar') {
                return `Games: ${helpers.formatNumber(context.parsed.y, 0)}`;
              }
              return `${context.dataset.label}: ${helpers.formatNumber(context.parsed.y, 1)}%`;
            },
          },
        },
      },
    },
  };
}

function buildThreePointTrendChart(dataRef) {
  const seasons = Array.isArray(dataRef?.threePointTrend?.seasons) ? dataRef.threePointTrend.seasons : [];
  if (!seasons.length) {
    return fallbackConfig('Three-point trend unavailable');
  }

  const sampled = helpers.evenSample(seasons, 120);
  const labels = sampled.map((entry) => entry.season ?? 'Season');
  const rate = sampled.map((entry) => (Number.isFinite(entry.threePointRate) ? entry.threePointRate * 100 : null));
  const winPct = sampled.map((entry) => (Number.isFinite(entry.teamWinPct) ? entry.teamWinPct * 100 : null));

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '3PA rate',
          data: rate,
          borderColor: '#1156d6',
          backgroundColor: 'rgba(17, 86, 214, 0.16)',
          borderWidth: 2,
          tension: 0.25,
          spanGaps: true,
          fill: 'origin',
        },
        {
          label: 'Team win %',
          data: winPct,
          borderColor: '#f4b53f',
          backgroundColor: 'rgba(244, 181, 63, 0.16)',
          borderWidth: 2,
          tension: 0.25,
          spanGaps: true,
          fill: false,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Percentage' },
          ticks: { callback: (value) => `${helpers.formatNumber(value, 0)}%` },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        x: {
          ticks: { maxRotation: 0 },
          grid: { color: 'rgba(17, 86, 214, 0.05)' },
        },
      },
    },
  };
}

async function bootstrap() {
  let data;
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`Failed to load insights lab data: ${response.status}`);
    }
    data = await response.json();
  } catch (error) {
    console.error('Unable to load insights lab data', error);
    return;
  }

  updateHero(data);

  registerCharts([
    { element: '#seasonal-scoring', source: DATA_URL, createConfig: () => buildSeasonalChart(data) },
    { element: '#rest-impact', source: DATA_URL, createConfig: () => buildRestImpactChart(data) },
    { element: '#close-margins', source: DATA_URL, createConfig: () => buildCloseMarginsChart(data) },
    { element: '#overtime-breakdown', source: DATA_URL, createConfig: () => buildOvertimeChart(data) },
    { element: '#mascot-showdown', source: DATA_URL, createConfig: () => buildMascotShowdownChart(data) },
    { element: '#three-point-trend', source: DATA_URL, createConfig: () => buildThreePointTrendChart(data) },
  ]);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
