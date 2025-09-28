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

function setNote(key, value) {
  const target = document.querySelector(`[data-note="${key}"]`);
  if (!target) {
    return;
  }
  if (!value) {
    target.hidden = true;
    return;
  }
  target.hidden = false;
  target.textContent = value;
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

  const sampleSize = data?.sampleSize ?? weather.sampleSize;
  setMetric('sample-size', Number.isFinite(sampleSize) ? `${helpers.formatNumber(sampleSize, 0)} games` : 'Collecting');
}

function updateModuleMetrics(data) {
  const astrology = data?.astrologyAlignment ?? {};
  const clusters = Array.isArray(astrology.clusters) ? astrology.clusters.filter(Boolean) : [];
  if (clusters.length) {
    const topCluster = [...clusters].sort((a, b) => (b.vibeScore ?? 0) - (a.vibeScore ?? 0))[0];
    const label = (topCluster.label || '').split(' (')[0] || topCluster.label || 'Star cluster';
    const vibeScore = Number.isFinite(topCluster.vibeScore) ? helpers.formatNumber(topCluster.vibeScore, 0) : null;
    const paceBoost = Number.isFinite(topCluster.paceBoost)
      ? `${topCluster.paceBoost >= 0 ? '+' : ''}${helpers.formatNumber(topCluster.paceBoost, 1)} pace`
      : null;
    const text = [label, vibeScore ? `${vibeScore} vibe` : null, paceBoost].filter(Boolean).join(' · ');
    setMetric('astrology-highlight', text || 'Charting stars');
  } else {
    setMetric('astrology-highlight', 'Charting stars');
  }

  const coffee = data?.coffeeConsumption ?? {};
  const levels = Array.isArray(coffee.levels) ? coffee.levels.filter(Boolean) : [];
  if (levels.length) {
    const topLevel = [...levels].sort((a, b) => (b.winPct ?? 0) - (a.winPct ?? 0))[0];
    const label = (topLevel.label || '').split(' (')[0] || topLevel.label || 'Brew crew';
    const winPct = Number.isFinite(topLevel.winPct) ? helpers.formatNumber(topLevel.winPct * 100, 1) : null;
    const sleep = Number.isFinite(topLevel.avgSleepHours)
      ? `${helpers.formatNumber(topLevel.avgSleepHours, 1)} hrs sleep`
      : null;
    const text = [label, winPct ? `${winPct}% win` : null, sleep].filter(Boolean).join(' · ');
    setMetric('coffee-highlight', text || 'Brewing data');
  } else {
    setMetric('coffee-highlight', 'Brewing data');
  }

  const playlist = data?.playlistMood ?? {};
  const moods = Array.isArray(playlist.moods) ? playlist.moods.filter(Boolean) : [];
  if (moods.length) {
    const topMood = [...moods].sort((a, b) => (b.pointDiff ?? 0) - (a.pointDiff ?? 0))[0];
    const label = topMood.label || 'Hot track';
    const diff = Number.isFinite(topMood.pointDiff)
      ? `${topMood.pointDiff >= 0 ? '+' : ''}${helpers.formatNumber(topMood.pointDiff, 1)} diff`
      : null;
    setMetric('playlist-highlight', diff ? `${label} · ${diff}` : `${label} playlist`);
  } else {
    setMetric('playlist-highlight', 'Queuing tracks');
  }

  const airport = data?.airportDelayIndex ?? {};
  const rankings = Array.isArray(airport.ranking) ? airport.ranking.filter(Boolean) : [];
  if (rankings.length >= 2) {
    const sorted = [...rankings].sort((a, b) => (b.winPct ?? 0) - (a.winPct ?? 0));
    const leader = sorted[0];
    const trailer = sorted[sorted.length - 1];
    const leaderLabel = (leader.label || '').split(' (')[0] || leader.label || 'Leader';
    const swing = Number.isFinite(leader.winPct) && Number.isFinite(trailer.winPct)
      ? helpers.formatNumber((leader.winPct - trailer.winPct) * 100, 1)
      : null;
    const text = swing ? `${leaderLabel} lead by ${swing} pts` : `${leaderLabel} leading`;
    setMetric('airport-highlight', text);
  } else {
    setMetric('airport-highlight', 'Tracking departures');
  }
  setNote('airport-delay-note', airport.note);

  const transit = data?.cityTransitEffect ?? {};
  const transitTiers = Array.isArray(transit.tiers) ? transit.tiers.filter(Boolean) : [];
  if (transitTiers.length >= 2) {
    const turnovers = transitTiers.map((tier) => tier.avgTurnovers ?? 0);
    const swing = Math.max(...turnovers) - Math.min(...turnovers);
    const text = `Turnover swing ${swing >= 0 ? '+' : ''}${helpers.formatNumber(swing, 1)}`;
    setMetric('transit-highlight', text);
  } else {
    setMetric('transit-highlight', 'Mapping commutes');
  }

  const lunar = data?.lunarPhaseEnergy ?? {};
  const phases = Array.isArray(lunar.phases) ? lunar.phases.filter(Boolean) : [];
  if (phases.length) {
    const bestPhase = [...phases].sort((a, b) => (b.fgPct ?? 0) - (a.fgPct ?? 0))[0];
    const label = bestPhase.label || 'Top phase';
    const fgPct = Number.isFinite(bestPhase.fgPct) ? helpers.formatNumber(bestPhase.fgPct * 100, 1) : null;
    setMetric('lunar-highlight', fgPct ? `${label} · ${fgPct}% FG` : label);
  } else {
    setMetric('lunar-highlight', 'Lunar syncing');
  }
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

function buildAstrologyChart(dataRef) {
  const astrology = dataRef?.astrologyAlignment ?? {};
  const clusters = Array.isArray(astrology.clusters) ? astrology.clusters.filter(Boolean) : [];
  if (!clusters.length) {
    return fallbackConfig('Star charts syncing');
  }

  const points = clusters.map((cluster) => ({
    x: cluster.paceBoost ?? 0,
    y: cluster.vibeScore ?? 0,
    r: Math.max(8, Math.min(22, (cluster.teams ?? 0) * 1.6)),
    label: cluster.label || 'Cluster',
    teams: cluster.teams ?? null,
  }));

  return {
    type: 'bubble',
    data: {
      datasets: [
        {
          label: 'Alignment clusters',
          data: points,
          backgroundColor: 'rgba(17, 86, 214, 0.55)',
          borderColor: '#1156d6',
          borderWidth: 1.5,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'Pace boost (possessions per 48)' },
          grid: { color: 'rgba(17, 86, 214, 0.08)' },
          ticks: {
            callback(value) {
              return `${value >= 0 ? '+' : ''}${helpers.formatNumber(value, 1)}`;
            },
          },
        },
        y: {
          title: { display: true, text: 'Vibe score' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
          suggestedMin: 50,
          suggestedMax: 80,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items) {
              return items[0]?.raw?.label || '';
            },
            label(context) {
              const { raw } = context;
              const pace = `${raw.x >= 0 ? '+' : ''}${helpers.formatNumber(raw.x, 1)} pace`;
              const vibe = `${helpers.formatNumber(raw.y, 0)} vibe`;
              const teamCount = Number.isFinite(raw.teams) ? `${raw.teams} teams` : null;
              return [pace, vibe, teamCount].filter(Boolean);
            },
          },
        },
      },
    },
  };
}

function buildCoffeeChart(dataRef) {
  const coffee = dataRef?.coffeeConsumption ?? {};
  const levels = Array.isArray(coffee.levels) ? coffee.levels.filter(Boolean) : [];
  if (!levels.length) {
    return fallbackConfig('Brewing samples');
  }

  const labels = levels.map((level) => level.label || 'Level');
  const winRates = levels.map((level) => (level.winPct ?? 0) * 100);
  const sleepHours = levels.map((level) => level.avgSleepHours ?? null);

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Win %',
          data: winRates,
          backgroundColor: '#1156d6',
          maxBarThickness: 46,
        },
        {
          type: 'line',
          label: 'Avg sleep (hrs)',
          data: sleepHours,
          yAxisID: 'sleep',
          borderColor: '#f4b53f',
          borderWidth: 2,
          tension: 0.35,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#f4b53f',
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
          title: { display: true, text: 'Win percentage' },
          ticks: {
            callback: (value) => `${helpers.formatNumber(value, 0)}%`,
          },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        sleep: {
          position: 'right',
          beginAtZero: false,
          suggestedMin: 5.5,
          suggestedMax: 8.5,
          title: { display: true, text: 'Avg sleep (hours)' },
          grid: { drawOnChartArea: false },
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
              if (context.dataset.label === 'Win %') {
                return `Win %: ${helpers.formatNumber(context.parsed.y, 1)}%`;
              }
              return `Avg sleep: ${helpers.formatNumber(context.parsed.y, 1)} hrs`;
            },
          },
        },
      },
    },
  };
}

function buildPlaylistChart(dataRef) {
  const playlist = dataRef?.playlistMood ?? {};
  const moods = Array.isArray(playlist.moods) ? playlist.moods.filter(Boolean) : [];
  if (!moods.length) {
    return fallbackConfig('Playlist cues buffering');
  }

  const labels = moods.map((mood) => mood.label || 'Playlist');
  const pointDiffs = moods.map((mood) => mood.pointDiff ?? 0);
  const games = moods.map((mood) => mood.games ?? null);

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Point differential',
          data: pointDiffs,
          borderColor: '#ef3d5b',
          borderWidth: 2,
          backgroundColor: (context) => createGradient(context, ['rgba(239, 61, 91, 0.28)', 'rgba(239, 61, 91, 0.06)']),
          fill: 'origin',
          tension: 0.4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#ef3d5b',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: {
          title: { display: true, text: 'Point differential' },
          grid: { color: 'rgba(239, 61, 91, 0.12)' },
          ticks: {
            callback: (value) => `${value >= 0 ? '+' : ''}${helpers.formatNumber(value, 1)}`,
          },
        },
        x: {
          grid: { color: 'rgba(239, 61, 91, 0.05)' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed.y;
              const prefix = value >= 0 ? '+' : '';
              const gamesCount = games[context.dataIndex];
              const gamesNote = Number.isFinite(gamesCount) ? ` · ${helpers.formatNumber(gamesCount, 0)} games` : '';
              return `Point diff: ${prefix}${helpers.formatNumber(value, 1)}${gamesNote}`;
            },
          },
        },
      },
    },
  };
}

function buildAirportChart(dataRef) {
  const airport = dataRef?.airportDelayIndex ?? {};
  const rankings = Array.isArray(airport.ranking) ? airport.ranking.filter(Boolean) : [];
  if (!rankings.length) {
    return fallbackConfig('Delay index syncing');
  }

  const labels = rankings.map((entry) => entry.label || 'Tier');
  const delays = rankings.map((entry) => entry.delayMinutes ?? 0);
  const winRates = rankings.map((entry) => (entry.winPct ?? 0) * 100);

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Avg delay (minutes)',
          data: delays,
          backgroundColor: '#0b2545',
          maxBarThickness: 48,
        },
        {
          type: 'line',
          label: 'Win %',
          data: winRates,
          yAxisID: 'win',
          borderColor: '#ef3d5b',
          borderWidth: 2,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#ef3d5b',
          pointBorderWidth: 2,
          tension: 0.35,
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
          title: { display: true, text: 'Avg delay (minutes)' },
          grid: { color: 'rgba(11, 37, 69, 0.12)' },
        },
        win: {
          position: 'right',
          beginAtZero: true,
          suggestedMax: 60,
          title: { display: true, text: 'Win percentage' },
          ticks: {
            callback: (value) => `${helpers.formatNumber(value, 0)}%`,
          },
          grid: { drawOnChartArea: false },
        },
        x: {
          grid: { color: 'rgba(11, 37, 69, 0.08)' },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              if (context.dataset.label === 'Avg delay (minutes)') {
                return `Delay: ${helpers.formatNumber(context.parsed.y, 1)} min`;
              }
              return `Win %: ${helpers.formatNumber(context.parsed.y, 1)}%`;
            },
          },
        },
      },
    },
  };
}

function buildTransitChart(dataRef) {
  const transit = dataRef?.cityTransitEffect ?? {};
  const tiers = Array.isArray(transit.tiers) ? transit.tiers.filter(Boolean) : [];
  if (!tiers.length) {
    return fallbackConfig('Transit metrics boarding');
  }

  const labels = tiers.map((tier) => tier.label || 'Tier');
  const turnovers = tiers.map((tier) => tier.avgTurnovers ?? 0);
  const samples = tiers.map((tier) => tier.sampleSize ?? null);

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Avg turnovers',
          data: turnovers,
          backgroundColor: '#1f7bff',
          maxBarThickness: 48,
        },
        {
          type: 'line',
          label: 'Games sampled',
          data: samples,
          yAxisID: 'sample',
          borderColor: '#0b2545',
          borderWidth: 2,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#0b2545',
          pointBorderWidth: 2,
          pointRadius: 4,
          tension: 0.3,
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
          title: { display: true, text: 'Avg turnovers' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        sample: {
          position: 'right',
          beginAtZero: true,
          title: { display: true, text: 'Games sampled' },
          grid: { drawOnChartArea: false },
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
              if (context.dataset.label === 'Avg turnovers') {
                return `Avg turnovers: ${helpers.formatNumber(context.parsed.y, 1)}`;
              }
              return `Games sampled: ${helpers.formatNumber(context.parsed.y, 0)}`;
            },
          },
        },
      },
    },
  };
}

function buildLunarChart(dataRef) {
  const lunar = dataRef?.lunarPhaseEnergy ?? {};
  const phases = Array.isArray(lunar.phases) ? lunar.phases.filter(Boolean) : [];
  if (!phases.length) {
    return fallbackConfig('Moon data recalibrating');
  }

  const labels = phases.map((phase) => phase.label || 'Phase');
  const fgPct = phases.map((phase) => (phase.fgPct ?? 0) * 100);
  const games = phases.map((phase) => phase.games ?? null);

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Field goal %',
          data: fgPct,
          borderColor: '#1156d6',
          borderWidth: 2,
          backgroundColor: (context) => createGradient(context, ['rgba(17, 86, 214, 0.32)', 'rgba(17, 86, 214, 0.08)']),
          fill: 'origin',
          tension: 0.35,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#1156d6',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
          suggestedMin: 45,
          suggestedMax: 50,
          title: { display: true, text: 'Field goal percentage' },
          ticks: {
            callback: (value) => `${helpers.formatNumber(value, 1)}%`,
          },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        x: {
          grid: { color: 'rgba(17, 86, 214, 0.05)' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed.y;
              const gamesCount = games[context.dataIndex];
              const gamesNote = Number.isFinite(gamesCount) ? ` · ${helpers.formatNumber(gamesCount, 0)} games` : '';
              return `FG%: ${helpers.formatNumber(value, 1)}%${gamesNote}`;
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
    {
      element: '#astrology-alignment',
      createConfig: () => buildAstrologyChart(dataRef),
    },
    {
      element: '#coffee-consumption',
      createConfig: () => buildCoffeeChart(dataRef),
    },
    {
      element: '#playlist-mood',
      createConfig: () => buildPlaylistChart(dataRef),
    },
    {
      element: '#airport-delay',
      createConfig: () => buildAirportChart(dataRef),
    },
    {
      element: '#transit-effect',
      createConfig: () => buildTransitChart(dataRef),
    },
    {
      element: '#lunar-phase',
      createConfig: () => buildLunarChart(dataRef),
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
    updateModuleMetrics(data);
    registerLabCharts(data);
  } catch (error) {
    console.error('Failed to hydrate insights lab', error);
  }
}

hydrateLab();
