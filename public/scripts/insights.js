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

  const seasonSwing = data?.seasonAverages?.swing;
  const seasonSwingText = Number.isFinite(seasonSwing)
    ? `${helpers.formatNumber(seasonSwing, 1)} pts swing`
    : null;
  setMetric('season-trend-swing', seasonSwingText);

  const seasonRangeStart = data?.seasonRange?.start;
  const seasonRangeEnd = data?.seasonRange?.end;
  const rangeText = Number.isFinite(seasonRangeStart) && Number.isFinite(seasonRangeEnd)
    ? `${seasonRangeStart}-${seasonRangeEnd}`
    : null;
  setMetric('season-range', rangeText);

  const latestGap = data?.homeRoadSplits?.latestGap;
  const gapText = Number.isFinite(latestGap)
    ? `${helpers.formatNumber(latestGap * 100, 1)}% home edge`
    : null;
  setMetric('home-road-gap', gapText);

  const homeRoadSeasons = Array.isArray(data?.homeRoadSplits?.seasons) ? data.homeRoadSplits.seasons : [];
  const latestSplit = [...homeRoadSeasons]
    .filter((entry) => Number.isFinite(entry?.homeWinPct) && Number.isFinite(entry?.roadWinPct))
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0))
    .at(-1);
  const splitText = latestSplit
    ? `Latest season: Home ${helpers.formatNumber((latestSplit.homeWinPct ?? 0) * 100, 1)}% · Road ${helpers.formatNumber(
        (latestSplit.roadWinPct ?? 0) * 100,
        1,
      )}%`
    : null;
  setMetric('home-road-note', splitText);
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

function formatSeasonLabel(season) {
  if (!Number.isFinite(season)) {
    return 'Season';
  }
  const endYear = (season + 1).toString().slice(-2).padStart(2, '0');
  return `${season}-${endYear}`;
}

function buildSeasonAveragesChart(dataRef) {
  const seasons = Array.isArray(dataRef?.seasonAverages?.seasons) ? dataRef.seasonAverages.seasons : [];
  if (!seasons.length) {
    return fallbackConfig('Season scoring trend unavailable');
  }

  const labels = seasons.map((entry) => formatSeasonLabel(entry?.season));
  const overall = seasons.map((entry) => entry?.averagePoints ?? null);
  const regular = seasons.map((entry) => entry?.regularSeasonAverage ?? null);
  const playoff = seasons.map((entry) => entry?.playoffAverage ?? null);

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'All games',
          data: overall,
          borderColor: '#1156d6',
          backgroundColor: 'rgba(17, 86, 214, 0.18)',
          borderWidth: 2,
          tension: 0.28,
          spanGaps: true,
          fill: 'origin',
        },
        {
          label: 'Regular season',
          data: regular,
          borderColor: '#0b2545',
          backgroundColor: 'rgba(11, 37, 69, 0.16)',
          borderWidth: 1.5,
          tension: 0.28,
          spanGaps: true,
          fill: false,
        },
        {
          label: 'Playoffs',
          data: playoff,
          borderColor: '#ef3d5b',
          backgroundColor: 'rgba(239, 61, 91, 0.16)',
          borderWidth: 1.5,
          tension: 0.28,
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
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
          grid: { color: 'rgba(17, 86, 214, 0.05)' },
        },
      },
    },
  };
}

function buildHomeRoadChart(dataRef) {
  const seasons = Array.isArray(dataRef?.homeRoadSplits?.seasons) ? dataRef.homeRoadSplits.seasons : [];
  if (!seasons.length) {
    return fallbackConfig('Home-road sample unavailable');
  }

  const labels = seasons.map((entry) => formatSeasonLabel(entry?.season));
  const homePct = seasons.map((entry) => (Number.isFinite(entry?.homeWinPct) ? entry.homeWinPct * 100 : null));
  const roadPct = seasons.map((entry) => (Number.isFinite(entry?.roadWinPct) ? entry.roadWinPct * 100 : null));
  const gap = seasons.map((entry) => (Number.isFinite(entry?.gap) ? entry.gap * 100 : null));

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Home win %',
          data: homePct,
          borderColor: '#1156d6',
          backgroundColor: 'rgba(17, 86, 214, 0.18)',
          borderWidth: 2,
          tension: 0.28,
          spanGaps: true,
          fill: 'origin',
        },
        {
          label: 'Road win %',
          data: roadPct,
          borderColor: '#ef3d5b',
          backgroundColor: 'rgba(239, 61, 91, 0.18)',
          borderWidth: 2,
          tension: 0.28,
          spanGaps: true,
          fill: false,
        },
        {
          type: 'bar',
          label: 'Home edge (pp)',
          data: gap,
          backgroundColor: 'rgba(244, 181, 63, 0.28)',
          borderRadius: 16,
          yAxisID: 'gap',
          maxBarThickness: 32,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 80,
          title: { display: true, text: 'Win percentage' },
          ticks: { callback: (value) => `${helpers.formatNumber(value, 0)}%` },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        gap: {
          position: 'right',
          title: { display: true, text: 'Home edge (percentage points)' },
          grid: { drawOnChartArea: false },
        },
        x: {
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
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
    { element: '#season-averages', source: DATA_URL, createConfig: () => buildSeasonAveragesChart(data) },
    { element: '#home-road-splits', source: DATA_URL, createConfig: () => buildHomeRoadChart(data) },
  ]);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
