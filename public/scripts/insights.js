import { registerCharts, helpers } from './hub-charts.js';

const DATA_URL = 'data/insights_lab.json';

function setMetric(key, value, fallback = '--') {
  const target = document.querySelector(`[data-metric="${key}"]`);
  if (!target) {
    return;
  }
  const output = value === null || value === undefined || value === '' ? fallback : value;
  target.textContent = output;
}

function formatPercent(value, digits = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return `${helpers.formatNumber(value * 100, digits)}%`;
}

function fallbackConfig(message) {
  return {
    type: 'doughnut',
    data: {
      labels: [''],
      datasets: [
        {
          data: [1],
          backgroundColor: ['rgba(17, 86, 214, 0.12)'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        title: { display: true, text: message },
      },
    },
  };
}

function createGradient(context, stops) {
  const { chart } = context;
  const { ctx, chartArea } = chart || {};
  if (!ctx || !chartArea) {
    return stops[0];
  }
  const gradient = ctx.createLinearGradient(chartArea.left, chartArea.bottom, chartArea.left, chartArea.top);
  gradient.addColorStop(0, stops[0]);
  gradient.addColorStop(1, stops[1] ?? stops[0]);
  return gradient;
}

function updateHero(data) {
  const weather = data?.weatherImpact ?? {};
  const nightlife = data?.nightlifeEffect ?? {};
  const mascot = data?.mascotStrength ?? {};

  const correlation = typeof weather.correlation === 'number' ? formatPercent(weather.correlation, 1) : null;
  const weatherText = correlation ? `${correlation} corr` : 'Calibrating';
  setMetric('temp-impact-hero', weatherText);
  setMetric('temp-impact-detail', weatherText);

  const tiers = Array.isArray(nightlife.tiers) ? nightlife.tiers.filter(Boolean) : [];
  if (tiers.length >= 2) {
    const first = tiers[0];
    const last = tiers[tiers.length - 1];
    const swing = (first.winPct ?? 0) - (last.winPct ?? 0);
    const formattedSwing = formatPercent(Math.abs(swing), 1);
    const nightlifeText = formattedSwing ? `${swing >= 0 ? '-' : '+'}${formattedSwing} swing` : 'Scouting';
    setMetric('nightlife-gap-hero', nightlifeText);
    setMetric('nightlife-gap-detail', nightlifeText);
  } else {
    setMetric('nightlife-gap-hero', 'Scouting');
    setMetric('nightlife-gap-detail', 'Scouting');
  }

  const categories = Array.isArray(mascot.categories) ? mascot.categories.filter(Boolean) : [];
  const dog = categories.find((entry) => (entry.kind || entry.label || '').toLowerCase().includes('dog'));
  const cat = categories.find((entry) => (entry.kind || entry.label || '').toLowerCase().includes('cat'));
  if (dog && cat) {
    const edge = (dog.winPct ?? 0) - (cat.winPct ?? 0);
    const formattedEdge = formatPercent(Math.abs(edge), 1);
    const mascotText = formattedEdge ? `${edge >= 0 ? '+' : '-'}${formattedEdge}` : 'Neck and neck';
    setMetric('mascot-edge-hero', mascotText);
    setMetric('mascot-edge-detail', mascotText);
  } else {
    setMetric('mascot-edge-hero', 'Neck and neck');
    setMetric('mascot-edge-detail', 'Neck and neck');
  }

  const sampleSize = weather.sampleSize ?? data?.sampleSize;
  setMetric('sample-size', Number.isFinite(sampleSize) ? `${helpers.formatNumber(sampleSize, 0)} games` : 'Collecting');
}

function buildWeatherChart(dataRef) {
  const weather = dataRef?.weatherImpact ?? {};
  const buckets = Array.isArray(weather.buckets) ? weather.buckets.filter(Boolean) : [];
  if (!buckets.length) {
    return fallbackConfig('Weather samples loading');
  }

  const labels = buckets.map((bucket) => bucket.label || 'Bucket');
  const points = buckets.map((bucket) => bucket.avgPoints ?? 0);
  const baseline = typeof weather.baseline === 'number' ? weather.baseline : null;

  const datasets = [
    {
      type: 'line',
      label: 'Avg team points',
      data: points,
      tension: 0.42,
      fill: 'start',
      borderWidth: 2,
      borderColor: '#1156d6',
      backgroundColor: (context) => createGradient(context, ['rgba(17, 86, 214, 0.38)', 'rgba(17, 86, 214, 0.05)']),
      pointBackgroundColor: '#ffffff',
      pointBorderColor: '#1156d6',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
    },
  ];

  if (baseline !== null) {
    datasets.push({
      type: 'line',
      label: 'League baseline',
      data: buckets.map(() => baseline),
      borderColor: 'rgba(11, 37, 69, 0.6)',
      borderWidth: 1.5,
      borderDash: [6, 6],
      pointRadius: 0,
      fill: false,
    });
  }

  return {
    type: 'line',
    data: {
      labels,
      datasets,
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          beginAtZero: false,
          title: { display: true, text: 'Average points per game' },
          grid: { color: 'rgba(17, 86, 214, 0.1)' },
        },
        x: {
          grid: { color: 'rgba(17, 86, 214, 0.05)' },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              if (context.dataset.label === 'Avg team points') {
                const bucket = buckets[context.dataIndex];
                const games = bucket?.games;
                const suffix = Number.isFinite(games) ? ` (${helpers.formatNumber(games, 0)} games)` : '';
                return `Avg points: ${helpers.formatNumber(context.parsed.y, 1)}${suffix}`;
              }
              return `${context.dataset.label}: ${helpers.formatNumber(context.parsed.y, 1)}`;
            },
          },
        },
      },
    },
  };
}

function buildNightlifeChart(dataRef) {
  const nightlife = dataRef?.nightlifeEffect ?? {};
  const tiers = Array.isArray(nightlife.tiers) ? nightlife.tiers.filter(Boolean) : [];
  if (!tiers.length) {
    return fallbackConfig('Nightlife scouting pending');
  }

  const labels = tiers.map((tier) => tier.label || 'Tier');
  const winRates = tiers.map((tier) => (tier.winPct ?? 0) * 100);
  const pointDiffs = tiers.map((tier) => tier.pointDiff ?? 0);

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Road win %',
          data: winRates,
          backgroundColor: '#ef3d5b',
          borderRadius: 18,
          maxBarThickness: 48,
        },
        {
          type: 'line',
          label: 'Avg point differential',
          data: pointDiffs,
          yAxisID: 'diff',
          borderColor: '#0b2545',
          borderWidth: 2,
          tension: 0.35,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#0b2545',
          pointBorderWidth: 2,
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
          suggestedMax: 60,
          ticks: {
            callback: (value) => `${helpers.formatNumber(value, 0)}%`,
          },
          title: { display: true, text: 'Road win percentage' },
          grid: { color: 'rgba(239, 61, 91, 0.12)' },
        },
        diff: {
          position: 'right',
          beginAtZero: true,
          suggestedMax: 4,
          suggestedMin: -5,
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Point differential' },
        },
        x: {
          grid: { color: 'rgba(239, 61, 91, 0.05)' },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              if (context.dataset.label === 'Road win %') {
                return `Road win %: ${helpers.formatNumber(context.parsed.y, 1)}%`;
              }
              return `Point diff: ${context.parsed.y >= 0 ? '+' : ''}${helpers.formatNumber(context.parsed.y, 1)}`;
            },
          },
        },
      },
    },
  };
}

function buildMascotChart(dataRef) {
  const mascot = dataRef?.mascotStrength ?? {};
  const categories = Array.isArray(mascot.categories) ? mascot.categories.filter(Boolean) : [];
  if (categories.length < 2) {
    return fallbackConfig('Mascot rivalry forming');
  }

  const labels = categories.map((entry) => entry.label || entry.kind || 'Mascot');
  const wins = categories.map((entry) => (entry.winPct ?? 0) * 100);
  const teams = categories.map((entry) => entry.teams ?? null);
  const titles = categories.map((entry) => entry.titles ?? null);

  const centerLabel = {
    id: 'mascotCenterLabel',
    afterDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      const center = meta?.data?.[0];
      if (!center) {
        return;
      }
      ctx.save();
      ctx.fillStyle = '#0b2545';
      ctx.font = '600 1.4rem "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Dogs vs Cats', center.x, center.y - 6);
      ctx.font = '500 0.75rem "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(11, 37, 69, 0.65)';
      ctx.fillText('win share %', center.x, center.y + 12);
      ctx.restore();
    },
  };

  return {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: wins,
          backgroundColor: ['#1156d6', '#f4b53f'],
          borderWidth: 0,
          hoverBackgroundColor: ['#0b2545', '#d99216'],
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              const index = context.dataIndex;
              const winPct = helpers.formatNumber(context.parsed, 1);
              const teamNote = teams[index] ? `${teams[index]} teams` : null;
              const titleNote = titles[index] ? `${titles[index]} titles` : null;
              const extras = [teamNote, titleNote].filter(Boolean).join(' · ');
              return extras ? `${context.label}: ${winPct}% (${extras})` : `${context.label}: ${winPct}%`;
            },
          },
        },
      },
    },
    plugins: [centerLabel],
  };
}

function registerLabCharts(dataRef) {
  registerCharts([
    {
      element: '#weather-scoring',
      createConfig: () => buildWeatherChart(dataRef),
    },
    {
      element: '#nightlife-road',
      createConfig: () => buildNightlifeChart(dataRef),
    },
    {
      element: '#mascot-strength',
      createConfig: () => buildMascotChart(dataRef),
    },
  ]);
}

async function hydrateLab() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch lab data: ${response.status}`);
    }
    const data = await response.json();
    updateHero(data);
    registerLabCharts(data);
  } catch (error) {
    console.error('Failed to hydrate insights lab', error);
  }
}

hydrateLab();
