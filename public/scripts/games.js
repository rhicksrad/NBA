import { registerCharts, helpers } from './hub-charts.js';

const DATA_URL = 'data/games_insights.json';

const metricTargets = {
  trackedGames: document.querySelector('[data-metric="tracked-games"]'),
  largestSwing: document.querySelector('[data-metric="largest-swing"]'),
  milesLogged: document.querySelector('[data-metric="miles-logged"]'),
  crowdSurge: document.querySelector('[data-metric="crowd-surge"]'),
  headlineSwing: document.querySelector('[data-metric="headline-swing"]'),
};

let gamesDataset = null;

function setMetric(target, value, fallback = '—') {
  const el = typeof target === 'string' ? metricTargets[target] : target;
  if (!el) {
    return;
  }
  const output = value === null || value === undefined || value === '' ? fallback : value;
  el.textContent = output;
}

function formatSigned(value, digits = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  const magnitude = helpers.formatNumber(Math.abs(value), digits);
  const prefix = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${prefix}${magnitude}`;
}

function formatPercent(value, digits = 0) {
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

function updateHero(data) {
  const teams = Array.isArray(data?.momentumAtlas?.teams) ? data.momentumAtlas.teams.filter(Boolean) : [];
  const segments = Array.isArray(data?.travelTax?.segments) ? data.travelTax.segments.filter(Boolean) : [];
  const arenas = Array.isArray(data?.crowdPulse?.arenas) ? data.crowdPulse.arenas.filter(Boolean) : [];

  const tracked = data?.sampleSize;
  if (!Number.isFinite(tracked)) {
    const derived = teams.reduce((total, entry) => total + (Number(entry.gamesTracked) || 0), 0);
    setMetric('trackedGames', derived ? `${helpers.formatNumber(derived, 0)} games` : 'Mapping');
  } else {
    setMetric('trackedGames', `${helpers.formatNumber(tracked, 0)} games`);
  }

  if (teams.length) {
    const swingLeader = teams
      .map((team) => ({
        team: team.team || team.abbreviation || 'Team',
        swing: (Number(team.secondHalfMargin) || 0) - (Number(team.firstHalfMargin) || 0),
      }))
      .reduce((prev, curr) => {
        if (!prev || Math.abs(curr.swing) > Math.abs(prev.swing)) {
          return curr;
        }
        return prev;
      }, null);
    if (swingLeader) {
      const formattedSwing = formatSigned(swingLeader.swing, 1);
      setMetric('largestSwing', formattedSwing ? `${swingLeader.team} ${formattedSwing}` : 'Calibrating');
      setMetric('headlineSwing', formattedSwing ? `${formattedSwing} swing` : 'Calibrating');
    }
  } else {
    setMetric('largestSwing', 'Calibrating');
    setMetric('headlineSwing', 'Calibrating');
  }

  if (segments.length) {
    const miles = segments.reduce((total, segment) => total + (Number(segment.miles) || 0), 0);
    setMetric('milesLogged', miles ? `${helpers.formatNumber(miles, 0)} miles` : 'Measuring');
  } else {
    setMetric('milesLogged', 'Measuring');
  }

  if (arenas.length) {
    const loudest = arenas.reduce((prev, curr) => {
      if (!prev || (Number(curr.decibelSurge) || 0) > (Number(prev.decibelSurge) || 0)) {
        return curr;
      }
      return prev;
    }, null);
    if (loudest) {
      const loudValue = Number(loudest.decibelSurge) || 0;
      setMetric('crowdSurge', `${helpers.formatNumber(loudValue, 1)} dB — ${loudest.arena}`);
    }
  } else {
    setMetric('crowdSurge', 'Listening');
  }
}

function buildMomentumChart(dataRef) {
  const teams = Array.isArray(dataRef?.momentumAtlas?.teams) ? dataRef.momentumAtlas.teams.filter(Boolean) : [];
  if (!teams.length) {
    return fallbackConfig('Momentum data loading');
  }

  const sorted = [...teams].sort((a, b) => {
    const swingA = (Number(a.secondHalfMargin) || 0) - (Number(a.firstHalfMargin) || 0);
    const swingB = (Number(b.secondHalfMargin) || 0) - (Number(b.firstHalfMargin) || 0);
    return Math.abs(swingB) - Math.abs(swingA);
  });

  const labels = sorted.map((team) => team.team || team.abbreviation || 'Team');
  const firstHalf = sorted.map((team) => Number(team.firstHalfMargin) || 0);
  const secondHalf = sorted.map((team) => Number(team.secondHalfMargin) || 0);
  const largestRuns = sorted.map((team) => Number(team.largestRun) || 0);

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'First-half margin',
          data: firstHalf,
          borderColor: '#9aa5c4',
          backgroundColor: 'rgba(154, 165, 196, 0.25)',
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#9aa5c4',
          tension: 0.35,
          fill: false,
        },
        {
          label: 'Second-half margin',
          data: secondHalf,
          borderColor: '#1156d6',
          backgroundColor: 'rgba(17, 86, 214, 0.32)',
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#1156d6',
          pointHoverRadius: 6,
          tension: 0.35,
          fill: true,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          title: { display: true, text: 'Average scoring margin' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        x: {
          grid: { display: false },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            afterBody(contexts) {
              const context = contexts?.[0];
              if (!context) return '';
              const run = largestRuns[context.dataIndex];
              return run ? `Largest unanswered run: ${helpers.formatNumber(run, 0)} points` : '';
            },
          },
        },
      },
    },
  };
}

function buildTravelChart(dataRef) {
  const segments = Array.isArray(dataRef?.travelTax?.segments) ? dataRef.travelTax.segments.filter(Boolean) : [];
  if (!segments.length) {
    return fallbackConfig('Travel telemetry loading');
  }

  const dataPoints = segments.map((segment) => ({
    x: Number(segment.miles) || 0,
    y: Number(segment.netRating) || 0,
    r: Math.max(8, Math.min(20, (Number(segment.games) || 1) * 4)),
    label: segment.label || 'Road segment',
    games: Number(segment.games) || 0,
    days: Number(segment.days) || 0,
  }));

  return {
    type: 'bubble',
    data: {
      datasets: [
        {
          label: 'Road gauntlets',
          data: dataPoints,
          backgroundColor: 'rgba(239, 61, 91, 0.4)',
          borderColor: '#ef3d5b',
          borderWidth: 1.5,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'Miles traveled' },
          ticks: { callback: (value) => helpers.formatNumber(value, 0) },
          grid: { color: 'rgba(17, 86, 214, 0.08)' },
        },
        y: {
          title: { display: true, text: 'Net rating swing' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label(context) {
              const point = context.raw;
              const swing = formatSigned(point.y, 1) ?? point.y;
              const games = point.games ? `${point.games} games` : '—';
              const rest = point.days ? `${point.days} days` : '—';
              return `${point.label}: ${swing} net swing over ${games} / ${rest}`;
            },
          },
        },
        legend: { display: false },
      },
    },
  };
}

function buildCrowdChart(dataRef) {
  const arenas = Array.isArray(dataRef?.crowdPulse?.arenas) ? dataRef.crowdPulse.arenas.filter(Boolean) : [];
  if (!arenas.length) {
    return fallbackConfig('Crowd telemetry syncing');
  }

  const sorted = [...arenas].sort((a, b) => (Number(b.decibelSurge) || 0) - (Number(a.decibelSurge) || 0));
  const labels = sorted.map((arena) => arena.arena || 'Arena');
  const decibels = sorted.map((arena) => Number(arena.decibelSurge) || 0);
  const comebackRate = sorted.map((arena) => (Number(arena.comebackRate) || 0) * 100);
  const winPct = sorted.map((arena) => Number(arena.homeWinPct) || 0);

  return {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Decibel surge (dB)',
          data: decibels,
          backgroundColor: 'rgba(17, 86, 214, 0.75)',
          borderRadius: 10,
          maxBarThickness: 48,
        },
        {
          type: 'line',
          label: 'Comeback close rate',
          data: comebackRate,
          yAxisID: 'y1',
          borderColor: '#ef3d5b',
          backgroundColor: 'rgba(239, 61, 91, 0.15)',
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#ef3d5b',
          pointBorderWidth: 1.5,
          tension: 0.35,
          fill: true,
        },
      ],
    },
    options: {
      type: 'bar',
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
        },
        y: {
          position: 'left',
          title: { display: true, text: 'Decibel surge' },
          beginAtZero: true,
          suggestedMax: Math.max(...decibels, 8) + 1,
          grid: { color: 'rgba(17, 86, 214, 0.1)' },
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'Comeback close rate' },
          min: 0,
          max: 100,
          ticks: {
            callback: (value) => `${value}%`,
          },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              if (context.dataset.type === 'line') {
                const value = context.parsed.y;
                const win = winPct[context.dataIndex] ?? 0;
                return `Comeback closes: ${helpers.formatNumber(value, 1)}% (home win ${formatPercent(win, 0)})`;
              }
              return `Decibel surge: ${helpers.formatNumber(context.parsed.y, 1)} dB`;
            },
          },
        },
      },
    },
  };
}

async function loadData() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to load games dataset: ${response.status}`);
  }
  return response.json();
}

async function init() {
  try {
    gamesDataset = await loadData();
    updateHero(gamesDataset);
  } catch (error) {
    console.error('Unable to load games dataset', error);
    setMetric('trackedGames', 'Mapping');
    setMetric('largestSwing', 'Calibrating');
    setMetric('milesLogged', 'Measuring');
    setMetric('crowdSurge', 'Listening');
  }

  registerCharts([
    {
      element: '#momentum-slope',
      async createConfig() {
        if (!gamesDataset) return fallbackConfig('Momentum data unavailable');
        return buildMomentumChart(gamesDataset);
      },
    },
    {
      element: '#travel-tax',
      async createConfig() {
        if (!gamesDataset) return fallbackConfig('Travel telemetry unavailable');
        return buildTravelChart(gamesDataset);
      },
    },
    {
      element: '#crowd-pulse',
      async createConfig() {
        if (!gamesDataset) return fallbackConfig('Crowd telemetry unavailable');
        return buildCrowdChart(gamesDataset);
      },
    },
  ]);
}

init();
