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

function buildClutchChart(dataRef) {
  const teams = Array.isArray(dataRef?.clutchVolatility?.teams)
    ? dataRef.clutchVolatility.teams.filter(Boolean)
    : [];
  if (!teams.length) {
    return fallbackConfig('Clutch telemetry syncing');
  }

  const sorted = [...teams].sort((a, b) => (Number(b.clutchMargin) || 0) - (Number(a.clutchMargin) || 0));
  const labels = sorted.map((team) => team.team || team.abbreviation || 'Team');
  const margins = sorted.map((team) => Number(team.clutchMargin) || 0);
  const winRates = sorted.map((team) => (Number(team.clutchWinPct) || 0) * 100);
  const possessions = sorted.map((team) => Number(team.possessions) || 0);
  const overtimeMarks = sorted.map((team) => team.overtimeRecord || '—');

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Clutch margin',
          data: margins,
          backgroundColor: 'rgba(239, 61, 91, 0.68)',
          borderRadius: 12,
          maxBarThickness: 46,
        },
        {
          type: 'line',
          label: 'Clutch win rate',
          data: winRates,
          yAxisID: 'y1',
          borderColor: '#1156d6',
          backgroundColor: 'rgba(17, 86, 214, 0.2)',
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#1156d6',
          pointBorderWidth: 1.5,
          tension: 0.28,
          fill: true,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          title: { display: true, text: 'Average clutch margin' },
          grid: { color: 'rgba(11, 37, 69, 0.08)' },
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'Win rate' },
          min: 0,
          max: 100,
          ticks: { callback: (value) => `${value}%` },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              const index = context.dataIndex ?? 0;
              if (context.dataset.type === 'line') {
                const rate = Number(winRates[index]) / 100;
                const possessionText = possessions[index]
                  ? `${helpers.formatNumber(possessions[index], 0)} clutch possessions`
                  : 'possession sample unavailable';
                const overtimeText = overtimeMarks[index];
                return `Win rate: ${formatPercent(rate, 1)} · ${possessionText} · OT ${overtimeText}`;
              }
              const signedMargin = formatSigned(margins[index], 1);
              return `Margin: ${signedMargin ?? helpers.formatNumber(margins[index], 1)} pts`;
            },
          },
        },
      },
    },
  };
}

function buildPaceChaosChart(dataRef) {
  const clusters = Array.isArray(dataRef?.paceChaos?.clusters) ? dataRef.paceChaos.clusters.filter(Boolean) : [];
  if (!clusters.length) {
    return fallbackConfig('Chaos map warming up');
  }

  const points = clusters.map((cluster) => ({
    x: Number(cluster.pace) || 0,
    y: Number(cluster.leadChanges) || 0,
    r: Math.max(8, (Number(cluster.runIndex) || 0) * 2.2),
    label: cluster.label || 'Game archetype',
    runIndex: Number(cluster.runIndex) || 0,
  }));

  return {
    type: 'bubble',
    data: {
      datasets: [
        {
          label: 'Game archetypes',
          data: points,
          parsing: false,
          backgroundColor: 'rgba(17, 181, 198, 0.45)',
          borderColor: '#11b5c6',
          borderWidth: 1.5,
          hoverBorderWidth: 2,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'Pace (possessions per 48)' },
          grid: { color: 'rgba(11, 37, 69, 0.08)' },
        },
        y: {
          title: { display: true, text: 'Lead changes' },
          grid: { color: 'rgba(11, 37, 69, 0.12)' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const point = context.raw || {};
              const pace = helpers.formatNumber(point.x, 1);
              const leads = helpers.formatNumber(point.y, 0);
              const runs = helpers.formatNumber(point.runIndex, 0);
              return `${point.label}: ${pace} pace · ${leads} lead changes · run index ${runs}`;
            },
          },
        },
      },
    },
  };
}

function buildLeadDensityChart(dataRef) {
  const distribution = Array.isArray(dataRef?.leadDensity?.distribution)
    ? dataRef.leadDensity.distribution.filter(Boolean)
    : [];
  if (!distribution.length) {
    return fallbackConfig('Lead density compiling');
  }

  const labels = distribution.map((bucket) => bucket.interval || 'Range');
  const totals = distribution.map((bucket) => Number(bucket.games) || 0);
  const margins = distribution.map((bucket) => Number(bucket.averageMargin) || 0);

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Games',
          data: totals,
          backgroundColor: 'rgba(17, 86, 214, 0.72)',
          borderRadius: 10,
        },
        {
          type: 'line',
          label: 'Average margin',
          data: margins,
          yAxisID: 'y1',
          borderColor: '#ef3d5b',
          backgroundColor: 'rgba(239, 61, 91, 0.18)',
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#ef3d5b',
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          title: { display: true, text: 'Games' },
          grid: { color: 'rgba(11, 37, 69, 0.08)' },
          ticks: { callback: (value) => helpers.formatNumber(value, 0) },
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'Average scoring margin' },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              if (context.dataset.type === 'line') {
                return `Average margin: ${helpers.formatNumber(context.parsed.y, 1)} pts`;
              }
              return `Games: ${helpers.formatNumber(context.parsed.y, 0)}`;
            },
          },
        },
      },
    },
  };
}

function buildRestChart(dataRef) {
  const scenarios = Array.isArray(dataRef?.restOutcomes?.scenarios)
    ? dataRef.restOutcomes.scenarios.filter(Boolean)
    : [];
  if (!scenarios.length) {
    return fallbackConfig('Rest delta syncing');
  }

  const labels = scenarios.map((scenario) => scenario.label || 'Scenario');
  const winRates = scenarios.map((scenario) => (Number(scenario.winPct) || 0) * 100);
  const margins = scenarios.map((scenario) => Number(scenario.pointMargin) || 0);
  const samples = scenarios.map((scenario) => Number(scenario.games) || 0);

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Win rate',
          data: winRates,
          backgroundColor: 'rgba(31, 123, 255, 0.65)',
          borderRadius: 10,
        },
        {
          type: 'line',
          label: 'Average margin',
          data: margins,
          yAxisID: 'y1',
          borderColor: '#f4b53f',
          backgroundColor: 'rgba(244, 181, 63, 0.2)',
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#f4b53f',
          tension: 0.28,
          fill: true,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          title: { display: true, text: 'Win rate' },
          min: 0,
          max: 100,
          ticks: { callback: (value) => `${value}%` },
          grid: { color: 'rgba(11, 37, 69, 0.08)' },
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'Average scoring margin' },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              const index = context.dataIndex ?? 0;
              if (context.dataset.type === 'line') {
                return `Average margin: ${helpers.formatNumber(context.parsed.y, 1)} pts`;
              }
              const rate = Number(winRates[index]) / 100;
              const sample = samples[index] ? `${helpers.formatNumber(samples[index], 0)} games` : 'sample pending';
              return `Win rate: ${formatPercent(rate, 1)} · ${sample}`;
            },
          },
        },
      },
    },
  };
}

function buildOvertimeChart(dataRef) {
  const segments = Array.isArray(dataRef?.overtimeHeartbeat?.segments)
    ? dataRef.overtimeHeartbeat.segments.filter(Boolean)
    : [];
  if (!segments.length) {
    return fallbackConfig('Overtime pulse scanning');
  }

  const labels = segments.map((segment) => segment.label || 'OT');
  const totals = segments.map((segment) => Number(segment.games) || 0);
  const winRates = segments.map((segment) => Number(segment.winPct) || 0);
  const totalGames = totals.reduce((sum, value) => sum + value, 0) || 1;

  return {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: totals,
          backgroundColor: ['#1156d6', '#6c4fe0', '#ef3d5b', '#0b2545'],
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 10,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              const index = context.dataIndex ?? 0;
              const sliceGames = totals[index];
              const share = sliceGames / totalGames;
              const rate = winRates[index];
              const summary = `${context.label}: ${helpers.formatNumber(sliceGames, 0)} games`;
              const shareText = `${formatPercent(share, 1)} share`;
              const winText = `win ${formatPercent(rate, 1)}`;
              return `${summary} · ${shareText} · ${winText}`;
            },
          },
        },
      },
    },
  };
}

function buildShotProfileChart(dataRef) {
  const states = Array.isArray(dataRef?.shotProfileTides?.states)
    ? dataRef.shotProfileTides.states.filter(Boolean)
    : [];
  if (!states.length) {
    return fallbackConfig('Shot mix indexing');
  }

  const labels = states.map((state) => state.state || 'State');
  const rim = states.map((state) => (Number(state.rim) || 0) * 100);
  const mid = states.map((state) => (Number(state.mid) || 0) * 100);
  const three = states.map((state) => (Number(state.three) || 0) * 100);

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'At rim',
          data: rim,
          backgroundColor: 'rgba(17, 181, 198, 0.85)',
          stack: 'shots',
        },
        {
          label: 'Mid-range',
          data: mid,
          backgroundColor: 'rgba(244, 181, 63, 0.85)',
          stack: 'shots',
        },
        {
          label: 'Three-point',
          data: three,
          backgroundColor: 'rgba(17, 86, 214, 0.8)',
          stack: 'shots',
        },
      ],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          max: 100,
          ticks: { callback: (value) => `${value}%` },
          grid: { color: 'rgba(11, 37, 69, 0.08)' },
        },
        y: { stacked: true, grid: { display: false } },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              const value = Number(context.parsed.x ?? context.parsed.y) || 0;
              return `${context.dataset.label}: ${helpers.formatNumber(value, 1)}%`;
            },
          },
        },
      },
    },
  };
}

function buildWhistleChart(dataRef) {
  const quarters = Array.isArray(dataRef?.whistleCadence?.quarters)
    ? dataRef.whistleCadence.quarters.filter(Boolean)
    : [];
  if (!quarters.length) {
    return fallbackConfig('Whistle cadence syncing');
  }

  const labels = quarters.map((frame) => frame.quarter || 'Frame');
  const fouls = quarters.map((frame) => Number(frame.fouls) || 0);
  const freeThrows = quarters.map((frame) => Number(frame.freeThrows) || 0);

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Team fouls',
          data: fouls,
          backgroundColor: 'rgba(239, 61, 91, 0.72)',
          borderRadius: 8,
        },
        {
          type: 'line',
          label: 'Free throws attempted',
          data: freeThrows,
          yAxisID: 'y1',
          borderColor: '#6c4fe0',
          backgroundColor: 'rgba(108, 79, 224, 0.2)',
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#6c4fe0',
          tension: 0.28,
          fill: true,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          title: { display: true, text: 'Average fouls' },
          beginAtZero: true,
          grid: { color: 'rgba(11, 37, 69, 0.08)' },
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'Free throws' },
          beginAtZero: true,
          grid: { display: false },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              if (context.dataset.type === 'line') {
                return `Free throws: ${helpers.formatNumber(context.parsed.y, 1)} attempts`;
              }
              return `Fouls: ${helpers.formatNumber(context.parsed.y, 1)}`;
            },
          },
        },
      },
    },
  };
}

function buildBroadcastChart(dataRef) {
  const windows = Array.isArray(dataRef?.broadcastEnergy?.windows)
    ? dataRef.broadcastEnergy.windows.filter(Boolean)
    : [];
  if (!windows.length) {
    return fallbackConfig('Broadcast telemetry syncing');
  }

  const labels = windows.map((window) => window.window || 'Window');
  const viewers = windows.map((window) => Number(window.viewers) || 0);
  const runRates = windows.map((window) => Number(window.runRate) || 0);

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Average viewers (millions)',
          data: viewers,
          backgroundColor: 'rgba(17, 86, 214, 0.75)',
          borderRadius: 9,
        },
        {
          type: 'line',
          label: 'Sustained run frequency',
          data: runRates,
          yAxisID: 'y1',
          borderColor: '#ef3d5b',
          backgroundColor: 'rgba(239, 61, 91, 0.2)',
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#ef3d5b',
          tension: 0.32,
          fill: true,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          title: { display: true, text: 'Viewers (millions)' },
          beginAtZero: true,
          grid: { color: 'rgba(11, 37, 69, 0.08)' },
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'Average scoring runs (8+ points)' },
          beginAtZero: true,
          grid: { display: false },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              if (context.dataset.type === 'line') {
                return `Run bursts: ${helpers.formatNumber(context.parsed.y, 1)} per game`;
              }
              return `Viewers: ${helpers.formatNumber(context.parsed.y, 1)}M`;
            },
          },
        },
      },
    },
  };
}

function buildAltitudeChart(dataRef) {
  const arenas = Array.isArray(dataRef?.altitudeAcclimation?.arenas)
    ? dataRef.altitudeAcclimation.arenas.filter(Boolean)
    : [];
  if (!arenas.length) {
    return fallbackConfig('Altitude telemetry warming up');
  }

  const points = arenas.map((arena) => ({
    x: Number(arena.elevation) || 0,
    y: Number(arena.netSwing) || 0,
    r: Math.max(8, (Number(arena.recoveryHours) || 0) / 2),
    arena: arena.arena || 'Arena',
    team: arena.team || null,
    recoveryHours: Number(arena.recoveryHours) || 0,
  }));

  return {
    type: 'bubble',
    data: {
      datasets: [
        {
          label: 'Elevation advantage',
          data: points,
          parsing: false,
          backgroundColor: 'rgba(11, 37, 69, 0.72)',
          borderColor: '#0b2545',
          borderWidth: 1.5,
          hoverBorderWidth: 2,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'Arena elevation (feet)' },
          grid: { color: 'rgba(11, 37, 69, 0.08)' },
        },
        y: {
          title: { display: true, text: 'Net rating swing' },
          grid: { color: 'rgba(11, 37, 69, 0.12)' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const point = context.raw || {};
              const swingText = formatSigned(point.y, 1) ?? helpers.formatNumber(point.y, 1);
              const recovery = point.recoveryHours
                ? `${helpers.formatNumber(point.recoveryHours, 0)} hours prep`
                : 'recovery data unavailable';
              const arenaName = point.arena || 'Arena';
              const teamSuffix = point.team ? ` (${point.team})` : '';
              const elevation = helpers.formatNumber(point.x, 0);
              return `${arenaName}${teamSuffix}: ${elevation} ft · ${swingText} net swing · ${recovery}`;
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
    {
      element: '#clutch-volatility',
      async createConfig() {
        if (!gamesDataset) return fallbackConfig('Clutch telemetry unavailable');
        return buildClutchChart(gamesDataset);
      },
    },
    {
      element: '#pace-chaos',
      async createConfig() {
        if (!gamesDataset) return fallbackConfig('Chaos map unavailable');
        return buildPaceChaosChart(gamesDataset);
      },
    },
    {
      element: '#lead-density',
      async createConfig() {
        if (!gamesDataset) return fallbackConfig('Lead density unavailable');
        return buildLeadDensityChart(gamesDataset);
      },
    },
    {
      element: '#rest-outcomes',
      async createConfig() {
        if (!gamesDataset) return fallbackConfig('Rest telemetry unavailable');
        return buildRestChart(gamesDataset);
      },
    },
    {
      element: '#overtime-heartbeat',
      async createConfig() {
        if (!gamesDataset) return fallbackConfig('Overtime telemetry unavailable');
        return buildOvertimeChart(gamesDataset);
      },
    },
    {
      element: '#shot-profile',
      async createConfig() {
        if (!gamesDataset) return fallbackConfig('Shot mix unavailable');
        return buildShotProfileChart(gamesDataset);
      },
    },
    {
      element: '#whistle-cadence',
      async createConfig() {
        if (!gamesDataset) return fallbackConfig('Whistle telemetry unavailable');
        return buildWhistleChart(gamesDataset);
      },
    },
    {
      element: '#broadcast-energy',
      async createConfig() {
        if (!gamesDataset) return fallbackConfig('Broadcast telemetry unavailable');
        return buildBroadcastChart(gamesDataset);
      },
    },
    {
      element: '#altitude-acclimation',
      async createConfig() {
        if (!gamesDataset) return fallbackConfig('Altitude telemetry unavailable');
        return buildAltitudeChart(gamesDataset);
      },
    },
  ]);
}

init();
