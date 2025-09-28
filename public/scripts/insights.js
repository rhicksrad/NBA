import { registerCharts, helpers } from './hub-charts.js';

const DATA_URL = 'data/insights_lab.json';

const STAGE_WEIGHTS = {
  released: 4.6,
  'in progress': 3.4,
  qa: 3.1,
  discovery: 2.4,
  planned: 1.8,
};

const STATUS_COLORS = {
  released: '#1156d6',
  'in progress': '#1f7bff',
  qa: '#f4b53f',
  discovery: '#ef3d5b',
  planned: '#8e9eff',
};

const MONTH_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function stageWeight(status) {
  if (!status) {
    return 1.5;
  }
  const key = status.toLowerCase().trim();
  return STAGE_WEIGHTS[key] ?? 2;
}

function statusColor(status) {
  if (!status) {
    return '#1156d6';
  }
  const key = status.toLowerCase().trim();
  return STATUS_COLORS[key] ?? '#1f7bff';
}

function parseLabDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTimeline(value) {
  if (!value) {
    return null;
  }
  const match = value.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/i);
  if (!match) {
    return null;
  }
  const monthKey = match[1].slice(0, 3).toLowerCase();
  const day = Number.parseInt(match[2], 10);
  if (!Number.isFinite(day)) {
    return null;
  }
  const now = new Date();
  const monthIndex = MONTH_INDEX[monthKey];
  if (!Number.isInteger(monthIndex)) {
    return null;
  }
  const year = now.getMonth() > monthIndex ? now.getFullYear() + 1 : now.getFullYear();
  const parsed = new Date(Date.UTC(year, monthIndex, day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sum(collection, accessor) {
  if (!Array.isArray(collection) || !collection.length) {
    return 0;
  }
  return collection.reduce((total, item, index) => total + (accessor(item, index) || 0), 0);
}

function setMetric(key, value, fallback = '--') {
  const target = document.querySelector(`[data-metric="${key}"]`);
  if (!target) {
    return;
  }
  const output = value === null || value === undefined || value === '' ? fallback : value;
  target.textContent = output;
}

function formatCountdown(nextSync) {
  if (!nextSync) {
    return 'Awaiting sync';
  }
  const now = new Date();
  const diffMs = nextSync.getTime() - now.getTime();
  if (diffMs <= 0) {
    return 'Sync in progress';
  }
  const totalMinutes = Math.round(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes - days * 1440) / 60);
  const minutes = Math.max(0, totalMinutes - days * 1440 - hours * 60);
  const parts = [];
  if (days) {
    parts.push(`${days}d`);
  }
  if (hours) {
    parts.push(`${hours}h`);
  }
  parts.push(`${minutes}m`);
  return parts.slice(0, 3).join(' ');
}

function updateHero(data) {
  const experiments = Array.isArray(data?.experiments) ? data.experiments.filter(Boolean) : [];
  const checklist = Array.isArray(data?.releaseChecklist) ? data.releaseChecklist.filter(Boolean) : [];
  const collaboration = data?.collaboration ?? {};
  const collaborationBadges = Array.isArray(collaboration.badges) ? collaboration.badges.length : 0;
  const collaborationChannels = Array.isArray(collaboration.channels) ? collaboration.channels.length : 0;
  const collaborationContributors = Array.isArray(collaboration.contributors) ? collaboration.contributors.length : 0;
  const totalCollaborationNodes = collaborationBadges + collaborationChannels + collaborationContributors;
  const readinessAverage = checklist.length
    ? sum(checklist, (item) => clamp(item.progress ?? 0, 0, 100)) / checklist.length
    : null;

  setMetric('experiments', `${helpers.formatNumber(experiments.length, 0)} live`);
  setMetric(
    'readiness',
    readinessAverage === null ? 'Calibrating' : `${helpers.formatNumber(readinessAverage, 0)}% ready`
  );
  setMetric('collaboration', `${helpers.formatNumber(totalCollaborationNodes, 0)} links`);

  const nextSync = collaboration.nextSync ? parseLabDate(collaboration.nextSync) : null;
  setMetric('sync', formatCountdown(nextSync));
}

function updateModuleChips(data) {
  const changelog = Array.isArray(data?.changelog) ? data.changelog.filter(Boolean) : [];
  const experiments = Array.isArray(data?.experiments) ? data.experiments.filter(Boolean) : [];
  const checklist = Array.isArray(data?.releaseChecklist) ? data.releaseChecklist.filter(Boolean) : [];
  const collaboration = data?.collaboration ?? {};
  const agendaItems = Array.isArray(collaboration.agenda) ? collaboration.agenda.filter(Boolean) : [];
  const channels = Array.isArray(collaboration.channels) ? collaboration.channels.filter(Boolean) : [];
  const contributors = Array.isArray(collaboration.contributors)
    ? collaboration.contributors.filter(Boolean)
    : [];

  const highlightCounts = changelog.map((entry) =>
    Array.isArray(entry.highlights) ? entry.highlights.filter(Boolean).length : 0
  );
  const velocityAverage = highlightCounts.length
    ? sum(highlightCounts, (count) => count) / highlightCounts.length
    : null;
  setMetric('velocity', velocityAverage === null ? 'No launches yet' : `${helpers.formatNumber(velocityAverage, 1)} avg`);

  const statusTotals = changelog.reduce((acc, entry) => {
    const key = (entry.status || 'Planned').trim();
    const base = acc.get(key) ?? 0;
    const weight = stageWeight(entry.status);
    const highlights = Array.isArray(entry.highlights) ? entry.highlights.length : 0;
    acc.set(key, base + weight + highlights * 0.4);
    return acc;
  }, new Map());
  const dominantStatus = Array.from(statusTotals.entries()).sort((a, b) => b[1] - a[1])[0];
  setMetric('status', dominantStatus ? `${dominantStatus[0]} lead` : 'Awaiting cycles');

  const readinessMax = checklist.slice().sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0];
  setMetric(
    'readiness-max',
    readinessMax ? `${helpers.formatNumber(clamp(readinessMax.progress ?? 0, 0, 100), 0)}% · ${readinessMax.label}` : 'Checklist pending'
  );

  const readinessAverage = checklist.length
    ? sum(checklist, (item) => clamp(item.progress ?? 0, 0, 100)) / checklist.length
    : null;
  setMetric(
    'readiness-avg',
    readinessAverage === null ? '0% avg' : `${helpers.formatNumber(readinessAverage, 0)}% avg`
  );

  const horizonDays = experiments
    .map((experiment) => {
      const timeline = parseTimeline(experiment.timeline);
      if (!timeline) {
        return null;
      }
      const diff = (timeline.getTime() - Date.now()) / 86400000;
      return Number.isFinite(diff) ? diff : null;
    })
    .filter((value) => value !== null);
  const soonestHorizon = horizonDays.length ? Math.min(...horizonDays) : null;
  setMetric(
    'experiment-horizon',
    soonestHorizon === null ? 'No schedule set' : `${helpers.formatNumber(Math.max(0, soonestHorizon), 0)}d window`
  );

  const deepestStage = experiments
    .map((experiment) => experiment.status)
    .sort((a, b) => stageWeight(b) - stageWeight(a))[0];
  setMetric('experiment-progress', deepestStage ? `${deepestStage} tier` : 'Stage TBD');

  const totalObjectives = sum(experiments, (experiment) =>
    Array.isArray(experiment.objectives) ? experiment.objectives.filter(Boolean).length : 0
  );
  setMetric('objective-total', `${helpers.formatNumber(totalObjectives, 0)} objectives`);

  const agendaWeight = sum(agendaItems, (item) => item.length / 6);
  setMetric('agenda-span', agendaItems.length ? `${helpers.formatNumber(agendaWeight, 0)} focus pts` : 'Agenda open');

  setMetric('channel-count', `${helpers.formatNumber(channels.length, 0)} channels`);
  setMetric('contributor-count', `${helpers.formatNumber(contributors.length, 0)} leads`);
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

function fallbackConfig(message) {
  return {
    type: 'doughnut',
    data: {
      labels: [''],
      datasets: [
        {
          data: [1],
          backgroundColor: ['rgba(17, 86, 214, 0.15)'],
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

function buildReleaseVelocityConfig(dataRef, helperRef) {
  const changelog = Array.isArray(dataRef?.changelog) ? dataRef.changelog.filter(Boolean) : [];
  if (!changelog.length) {
    return fallbackConfig('Velocity data pending');
  }
  const timeline = changelog
    .map((entry, index) => {
      const highlights = Array.isArray(entry.highlights) ? entry.highlights.filter(Boolean).length : 0;
      const date = parseLabDate(entry.date);
      const label =
        entry.week ||
        (date
          ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
          : `Sprint ${index + 1}`);
      return {
        label,
        highlights,
        stage: stageWeight(entry.status),
        timestamp: date ? date.getTime() : index,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  const labels = timeline.map((item) => item.label);
  const highlightSeries = timeline.map((item) => item.highlights || 0);
  const stageSeries = timeline.map((item) => item.stage * 10);

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Highlights shipped',
          data: highlightSeries,
          fill: 'start',
          tension: 0.42,
          borderWidth: 2,
          borderColor: '#1156d6',
          backgroundColor: (context) =>
            createGradient(context, ['rgba(17, 86, 214, 0.52)', 'rgba(17, 86, 214, 0.05)']),
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#1156d6',
          pointBorderWidth: 2,
          pointRadius: 4.5,
          pointHoverRadius: 6,
        },
        {
          label: 'Stage momentum',
          data: stageSeries,
          yAxisID: 'momentum',
          borderColor: '#f4b53f',
          borderWidth: 2,
          borderDash: [6, 6],
          tension: 0.35,
          pointRadius: 0,
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
          title: { display: true, text: 'Story highlights' },
          grid: { color: 'rgba(17, 86, 214, 0.08)' },
        },
        momentum: {
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: {
            callback: (value) => `${helperRef.formatNumber(value / 10, 1)}×`,
          },
          title: { display: true, text: 'Stage intensity' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(context) {
              return `Sprint ${context[0]?.label ?? ''}`;
            },
            label(context) {
              if (context.datasetIndex === 0) {
                return `Highlights: ${helperRef.formatNumber(context.parsed.y, 0)}`;
              }
              return `Stage intensity: ${helperRef.formatNumber(context.parsed.y / 10, 1)}×`;
            },
          },
        },
      },
    },
  };
}

function buildStatusOrbitConfig(dataRef) {
  const changelog = Array.isArray(dataRef?.changelog) ? dataRef.changelog.filter(Boolean) : [];
  if (!changelog.length) {
    return fallbackConfig('Statuses incoming');
  }
  const summary = changelog.reduce((acc, entry) => {
    const label = entry.status || 'Planned';
    const base = acc.get(label) ?? 0;
    const highlights = Array.isArray(entry.highlights) ? entry.highlights.length : 0;
    acc.set(label, base + stageWeight(entry.status) + highlights * 0.6);
    return acc;
  }, new Map());

  const labels = Array.from(summary.keys());
  const values = labels.map((label) => summary.get(label));
  const palette = [
    'rgba(17, 86, 214, 0.72)',
    'rgba(31, 123, 255, 0.7)',
    'rgba(239, 61, 91, 0.7)',
    'rgba(244, 181, 63, 0.72)',
    'rgba(11, 37, 69, 0.72)',
  ];

  return {
    type: 'polarArea',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, index) => palette[index % palette.length]),
          borderColor: 'rgba(255, 255, 255, 0.6)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        r: {
          ticks: { display: false },
          grid: { color: 'rgba(17, 86, 214, 0.08)' },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
      },
    },
  };
}

function buildReadinessRadarConfig(dataRef) {
  const checklist = Array.isArray(dataRef?.releaseChecklist)
    ? dataRef.releaseChecklist.filter(Boolean)
    : [];
  if (!checklist.length) {
    return fallbackConfig('Checklist loading');
  }
  const labels = checklist.map((item) => item.label || 'Milestone');
  const progressValues = checklist.map((item) => clamp(item.progress ?? 0, 0, 100));

  return {
    type: 'radar',
    data: {
      labels,
      datasets: [
        {
          label: 'Readiness amplitude',
          data: progressValues,
          backgroundColor: 'rgba(17, 86, 214, 0.25)',
          borderColor: '#1156d6',
          pointBackgroundColor: '#f5f8ff',
          pointBorderColor: '#1156d6',
          pointBorderWidth: 2,
          pointRadius: 4,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        r: {
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: { display: false },
          grid: { color: 'rgba(17, 86, 214, 0.08)' },
          angleLines: { color: 'rgba(17, 86, 214, 0.08)' },
        },
      },
      plugins: { legend: { display: false } },
    },
  };
}

function buildGaugeConfig(dataRef, helperRef) {
  const checklist = Array.isArray(dataRef?.releaseChecklist)
    ? dataRef.releaseChecklist.filter(Boolean)
    : [];
  const readinessAverage = checklist.length
    ? sum(checklist, (item) => clamp(item.progress ?? 0, 0, 100)) / checklist.length
    : 0;
  const dataset = [clamp(readinessAverage, 0, 100), Math.max(0, 100 - readinessAverage)];

  const gaugeLabel = {
    id: 'labGaugeLabel',
    afterDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      const center = meta?.data?.[0];
      if (!center) {
        return;
      }
      ctx.save();
      ctx.fillStyle = '#0b2545';
      ctx.font = '600 1.6rem "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${helperRef.formatNumber(readinessAverage, 0)}%`, center.x, center.y - 6);
      ctx.font = '500 0.75rem "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(11, 37, 69, 0.65)';
      ctx.fillText('ready', center.x, center.y + 14);
      ctx.restore();
    },
  };

  return {
    type: 'doughnut',
    data: {
      labels: ['Ready', 'In motion'],
      datasets: [
        {
          data: dataset,
          backgroundColor: ['#1156d6', 'rgba(17, 86, 214, 0.12)'],
          borderWidth: 0,
          hoverBackgroundColor: ['#0b2545', 'rgba(17, 86, 214, 0.18)'],
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      cutout: '70%',
      rotation: -110,
      circumference: 220,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.label}: ${helperRef.formatNumber(context.parsed, 0)}%`;
            },
          },
        },
      },
    },
    plugins: [gaugeLabel],
  };
}

function buildExperimentSwarmConfig(dataRef) {
  const experiments = Array.isArray(dataRef?.experiments) ? dataRef.experiments.filter(Boolean) : [];
  if (!experiments.length) {
    return fallbackConfig('Experiments warming up');
  }
  const now = Date.now();
  const points = experiments.map((experiment, index) => {
    const objectives = Array.isArray(experiment.objectives) ? experiment.objectives.filter(Boolean).length : 0;
    const stage = stageWeight(experiment.status);
    const timeline = parseTimeline(experiment.timeline);
    const daysUntil = timeline ? (timeline.getTime() - now) / 86400000 : (index + 1) * 6;
    const normalizedDays = clamp(daysUntil, -14, 40);
    return {
      x: stage * 24 + index * 6,
      y: (objectives || 1) * 14 + stage * 3,
      r: clamp(28 - normalizedDays, 12, 32),
      status: experiment.status || 'Planned',
      owner: experiment.owner || 'Unassigned',
      title: experiment.title || `Experiment ${index + 1}`,
      timeline: experiment.timeline || 'Timeline TBD',
      background: statusColor(experiment.status),
    };
  });

  return {
    type: 'bubble',
    data: {
      datasets: [
        {
          label: 'Lab experiments',
          data: points,
          backgroundColor: points.map((point) => point.background),
          borderColor: 'rgba(255, 255, 255, 0.6)',
          borderWidth: 1.4,
          hoverBorderWidth: 2.4,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'Stage momentum' },
          grid: { color: 'rgba(17, 86, 214, 0.08)' },
        },
        y: {
          title: { display: true, text: 'Objective stack' },
          grid: { color: 'rgba(17, 86, 214, 0.08)' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(context) {
              return context[0]?.raw?.title ?? '';
            },
            label(context) {
              const raw = context.raw || {};
              return [
                `Status: ${raw.status}`,
                `Owner: ${raw.owner}`,
                `Timeline: ${raw.timeline}`,
                `Signal radius: ${helpers.formatNumber(raw.r, 0)}`,
              ];
            },
          },
        },
      },
    },
  };
}

function buildExperimentLadderConfig(dataRef, helperRef) {
  const experiments = Array.isArray(dataRef?.experiments) ? dataRef.experiments.filter(Boolean) : [];
  if (!experiments.length) {
    return fallbackConfig('Ladder forming');
  }
  const labels = experiments.map((experiment, index) => experiment.title || `Experiment ${index + 1}`);
  const depths = experiments.map((experiment) => stageWeight(experiment.status) * 25);
  const colors = experiments.map((experiment) => statusColor(experiment.status));

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Stage depth',
          data: depths,
          backgroundColor: colors,
          borderRadius: 14,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      scales: {
        x: {
          display: false,
          grid: { display: false },
        },
        y: {
          ticks: {
            callback: (value, index) => labels[index] ?? value,
          },
          grid: { color: 'rgba(17, 86, 214, 0.05)' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const stage = experiments[context.dataIndex]?.status || 'Stage';
              return `${stage}: ${helperRef.formatNumber(context.parsed.x / 25, 1)} tiers`;
            },
          },
        },
      },
    },
  };
}

function buildObjectiveRibbonConfig(dataRef, helperRef) {
  const experiments = Array.isArray(dataRef?.experiments) ? dataRef.experiments.filter(Boolean) : [];
  if (!experiments.length) {
    return fallbackConfig('Objective ribbon pending');
  }
  const sequence = experiments
    .map((experiment, index) => ({
      experiment,
      index,
      timeline: parseTimeline(experiment.timeline) || index,
    }))
    .sort((a, b) => {
      const aTime = a.timeline instanceof Date ? a.timeline.getTime() : a.timeline;
      const bTime = b.timeline instanceof Date ? b.timeline.getTime() : b.timeline;
      return aTime - bTime;
    });

  let running = 0;
  const labels = [];
  const cumulative = [];
  const stageLift = [];

  sequence.forEach(({ experiment }, order) => {
    const objectives = Array.isArray(experiment.objectives) ? experiment.objectives.filter(Boolean).length : 0;
    running += objectives;
    labels.push(experiment.title || `Experiment ${order + 1}`);
    cumulative.push(running);
    stageLift.push(stageWeight(experiment.status) * 10);
  });

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Cumulative objectives',
          data: cumulative,
          fill: 'start',
          tension: 0.42,
          borderColor: '#ef3d5b',
          backgroundColor: (context) =>
            createGradient(context, ['rgba(239, 61, 91, 0.34)', 'rgba(239, 61, 91, 0.04)']),
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#ef3d5b',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Stage lift',
          data: stageLift,
          yAxisID: 'lift',
          borderColor: '#1f7bff',
          borderDash: [8, 6],
          borderWidth: 2,
          pointRadius: 0,
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
          title: { display: true, text: 'Objectives aggregated' },
          grid: { color: 'rgba(239, 61, 91, 0.1)' },
        },
        lift: {
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: {
            callback: (value) => `${helperRef.formatNumber(value / 10, 1)}×`,
          },
          title: { display: true, text: 'Stage lift' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              if (context.datasetIndex === 0) {
                return `Cumulative objectives: ${helperRef.formatNumber(context.parsed.y, 0)}`;
              }
              return `Stage lift: ${helperRef.formatNumber(context.parsed.y / 10, 1)}×`;
            },
          },
        },
      },
    },
  };
}

function buildAgendaOrbitConfig(dataRef) {
  const agenda = Array.isArray(dataRef?.collaboration?.agenda)
    ? dataRef.collaboration.agenda.filter(Boolean)
    : [];
  if (!agenda.length) {
    return fallbackConfig('Agenda orbit loading');
  }
  const weights = agenda.map((item) => Math.max(2, item.length / 14));

  return {
    type: 'doughnut',
    data: {
      labels: agenda,
      datasets: [
        {
          data: weights,
          backgroundColor: agenda.map((_, index) =>
            `hsl(${(index / agenda.length) * 220 + 200}, 76%, 62%)`
          ),
          borderColor: 'rgba(255, 255, 255, 0.65)',
          borderWidth: 1.2,
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
              return `${context.label}: ${helpers.formatNumber(context.parsed, 1)} weight`;
            },
          },
        },
      },
    },
  };
}

function buildChannelGridConfig(dataRef) {
  const channels = Array.isArray(dataRef?.collaboration?.channels)
    ? dataRef.collaboration.channels.filter(Boolean)
    : [];
  const badges = Array.isArray(dataRef?.collaboration?.badges)
    ? dataRef.collaboration.badges.filter(Boolean)
    : [];
  if (!channels.length || !badges.length) {
    return fallbackConfig('Channel lattice calibrating');
  }
  const labels = channels.map((channel) => channel.label || 'Channel');
  const palette = ['#1156d6', '#1f7bff', '#ef3d5b', '#f4b53f', '#0b2545'];
  const datasets = badges.map((badge, index) => ({
    label: badge,
    data: channels.map((channel) => {
      const base = (channel.value || '').length || 6;
      return Math.round(base / 2 + badge.length);
    }),
    backgroundColor: palette[index % palette.length],
    stack: 'signal-density',
    borderRadius: 18,
    borderSkipped: false,
  }));

  return {
    type: 'bar',
    data: {
      labels,
      datasets,
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { color: 'rgba(17, 86, 214, 0.08)' },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: 'rgba(17, 86, 214, 0.08)' },
          ticks: {
            callback: (value) => helpers.formatNumber(value, 0),
          },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${helpers.formatNumber(context.parsed.y, 0)} signal units`;
            },
          },
        },
      },
    },
  };
}

function buildContributorBloomConfig(dataRef) {
  const contributors = Array.isArray(dataRef?.collaboration?.contributors)
    ? dataRef.collaboration.contributors.filter(Boolean)
    : [];
  if (!contributors.length) {
    return fallbackConfig('Contributor bloom forming');
  }
  const count = contributors.length;
  const baseRadius = 64;
  const points = contributors.map((contributor, index) => {
    const angle = (Math.PI * 2 * index) / count;
    const focusStrength = (contributor.focus || '').length / 2 + 18;
    const radius = baseRadius + focusStrength;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      label: contributor.name || `Contributor ${index + 1}`,
      focus: contributor.focus || 'Focus TBD',
    };
  });
  points.push(points[0]);

  return {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Collaboration halo',
          data: points,
          showLine: true,
          fill: true,
          tension: 0.35,
          backgroundColor: 'rgba(17, 86, 214, 0.18)',
          borderColor: 'rgba(239, 61, 91, 0.65)',
          borderWidth: 2,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#1156d6',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { display: false, min: -160, max: 160 },
        y: { display: false, min: -160, max: 160 },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(context) {
              return context[0]?.raw?.label ?? '';
            },
            label(context) {
              return context.raw?.focus ? [context.raw.focus] : ['Focus TBD'];
            },
          },
        },
      },
    },
  };
}

function registerLabCharts(dataRef) {
  registerCharts([
    {
      element: '#release-velocity',
      createConfig: (_, helperRef) => buildReleaseVelocityConfig(dataRef, helperRef),
    },
    {
      element: '#status-orbit',
      createConfig: () => buildStatusOrbitConfig(dataRef),
    },
    {
      element: '#readiness-radar',
      createConfig: () => buildReadinessRadarConfig(dataRef),
    },
    {
      element: '#readiness-gauge',
      createConfig: (_, helperRef) => buildGaugeConfig(dataRef, helperRef),
    },
    {
      element: '#experiment-swarm',
      createConfig: () => buildExperimentSwarmConfig(dataRef),
    },
    {
      element: '#experiment-ladder',
      createConfig: (_, helperRef) => buildExperimentLadderConfig(dataRef, helperRef),
    },
    {
      element: '#objective-ribbon',
      createConfig: (_, helperRef) => buildObjectiveRibbonConfig(dataRef, helperRef),
    },
    {
      element: '#agenda-orbit',
      createConfig: () => buildAgendaOrbitConfig(dataRef),
    },
    {
      element: '#channel-grid',
      createConfig: () => buildChannelGridConfig(dataRef),
    },
    {
      element: '#contributor-radial',
      createConfig: () => buildContributorBloomConfig(dataRef),
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
    updateModuleChips(data);
    registerLabCharts(data);
  } catch (error) {
    console.error('Failed to hydrate insights lab', error);
  }
}

hydrateLab();
