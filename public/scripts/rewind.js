import { registerCharts, helpers } from './hub-charts.js';
import { createTeamLogo } from './team-logos.js';

const palette = {
  royal: '#1156d6',
  sky: 'rgba(31, 123, 255, 0.78)',
  gold: 'rgba(244, 181, 63, 0.85)',
  coral: 'rgba(239, 61, 91, 0.82)',
  teal: 'rgba(47, 180, 200, 0.78)',
  navy: '#0b2545',
};

const scheduleDataPromise = fetch('data/season_24_25_schedule.json').then((response) => {
  if (!response.ok) {
    throw new Error(`Failed to load schedule data: ${response.status}`);
  }
  return response.json();
});

const highlightDataPromise = fetch('data/season_24_25_rewind.json').then((response) => {
  if (!response.ok) {
    throw new Error(`Failed to load rewind highlight data: ${response.status}`);
  }
  return response.json();
});

function formatSigned(value, digits = 1, suffix = '') {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  const magnitude = helpers.formatNumber(Math.abs(value), digits);
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${magnitude}${suffix}`;
}

function setStat(attribute, value, formatter = (v) => v, fallback = '—') {
  const nodes = document.querySelectorAll(`[data-${attribute}]`);
  const hasValue = value !== undefined && value !== null && !(typeof value === 'number' && Number.isNaN(value));
  nodes.forEach((node) => {
    node.textContent = hasValue ? formatter(value) : fallback;
  });
}

registerCharts([
  {
    element: document.querySelector('[data-chart="finals-net-rating"]'),
    async createConfig() {
      const data = await highlightDataPromise;
      const netRatings = Array.isArray(data?.finals?.netRatings) ? data.finals.netRatings : [];
      if (!netRatings.length) return null;

      const labels = netRatings.map((entry) => entry.game ?? '');
      const celtics = netRatings.map((entry) => entry.celtics ?? 0);
      const nuggets = netRatings.map((entry) => entry.nuggets ?? 0);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Boston net rating',
              data: celtics,
              borderColor: palette.royal,
              backgroundColor: 'rgba(17, 86, 214, 0.18)',
              pointRadius: 4,
              pointHoverRadius: 5,
              tension: 0.35,
              fill: false,
            },
            {
              label: 'Denver net rating',
              data: nuggets,
              borderColor: palette.coral,
              backgroundColor: 'rgba(239, 61, 91, 0.16)',
              pointRadius: 4,
              pointHoverRadius: 5,
              tension: 0.35,
              fill: false,
            },
          ],
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = context.parsed.y;
                  return `${context.dataset.label}: ${formatSigned(value, 1)} net rating`;
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => formatSigned(value, 0),
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="thunder-wins"]'),
    async createConfig() {
      const data = await highlightDataPromise;
      const wins = Array.isArray(data?.thunder?.wins) ? data.thunder.wins : [];
      if (!wins.length) return null;

      const labels = wins.map((entry) => entry.season ?? '');
      const totals = wins.map((entry) => entry.wins ?? 0);
      const highlightIndex = totals.length - 1;

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Wins',
              data: totals,
              backgroundColor: totals.map((_, index) => (index === highlightIndex ? palette.coral : palette.royal)),
              borderRadius: 10,
              maxBarThickness: 38,
            },
          ],
        },
        options: {
          layout: { padding: { top: 6, right: 12, bottom: 4, left: 8 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed.y, 0)} wins`;
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { callback: (value) => helpers.formatNumber(value, 0) },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="league-pace"]'),
    async createConfig() {
      const data = await highlightDataPromise;
      const series = Array.isArray(data?.leaguePace) ? data.leaguePace : [];
      if (!series.length) return null;

      const labels = series.map((entry) => entry.season ?? '');
      const values = series.map((entry) => entry.pace ?? 0);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Possessions per 48 minutes',
              data: values,
              borderColor: palette.royal,
              backgroundColor: 'rgba(17, 86, 214, 0.16)',
              fill: 'start',
              tension: 0.35,
              pointRadius: 4,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          layout: { padding: { top: 6, right: 12, bottom: 4, left: 8 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed.y, 1)} possessions`;
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: false,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => helpers.formatNumber(value, 1),
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="monthly-games"]'),
    async createConfig() {
      const data = await scheduleDataPromise;
      const monthlyCounts = Array.isArray(data?.monthlyCounts) ? data.monthlyCounts : [];
      if (!monthlyCounts.length) return null;

      const labels = monthlyCounts.map((entry) => entry.label ?? '');
      const regularSeason = monthlyCounts.map((entry) => entry.regularSeason ?? 0);
      const auxiliary = monthlyCounts.map((entry) => {
        const games = entry.games ?? 0;
        const primary = entry.regularSeason ?? 0;
        return Math.max(0, games - primary);
      });

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Regular season',
              data: regularSeason,
              backgroundColor: palette.royal,
              borderRadius: 6,
              maxBarThickness: 32,
            },
            {
              label: 'Cup & postseason',
              data: auxiliary,
              backgroundColor: palette.gold,
              borderRadius: 6,
              maxBarThickness: 32,
            },
          ],
        },
        options: {
          layout: { padding: { top: 4, right: 12, bottom: 8, left: 8 } },
          plugins: {
            legend: { position: 'top', labels: { usePointStyle: true } },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = helpers.formatNumber(context.parsed.y, 0);
                  return `${context.dataset.label}: ${value} games`;
                },
              },
            },
          },
          scales: {
            x: {
              stacked: true,
              grid: { display: false },
            },
            y: {
              stacked: true,
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => helpers.formatNumber(value, 0),
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="rest-distribution"]'),
    async createConfig() {
      const data = await scheduleDataPromise;
      const restBuckets = Array.isArray(data?.restBuckets) ? data.restBuckets : [];
      if (!restBuckets.length) return null;
      const totalIntervals = restBuckets.reduce((sum, bucket) => sum + (bucket.intervals ?? 0), 0);

      return {
        type: 'doughnut',
        data: {
          labels: restBuckets.map((bucket) => bucket.label ?? ''),
          datasets: [
            {
              data: restBuckets.map((bucket) => bucket.intervals ?? 0),
              backgroundColor: [palette.coral, palette.gold, palette.sky, palette.teal],
              borderColor: '#ffffff',
              borderWidth: 2,
            },
          ],
        },
        options: {
          layout: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true } },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = context.parsed;
                  const share = totalIntervals ? (value / totalIntervals) * 100 : 0;
                  return `${context.label}: ${helpers.formatNumber(value, 0)} intervals (${helpers.formatNumber(share, 1)}%)`;
                },
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="back-to-back-loads"]'),
    async createConfig() {
      const data = await scheduleDataPromise;
      const leaders = Array.isArray(data?.backToBackLeaders) ? data.backToBackLeaders : [];
      const ranked = helpers.rankAndSlice(leaders, 8, (entry) => entry.backToBacks ?? 0);
      if (!ranked.length) return null;

      return {
        type: 'bar',
        data: {
          labels: ranked.map((entry) => entry.abbreviation ?? entry.name ?? ''),
          datasets: [
            {
              label: 'Back-to-backs',
              data: ranked.map((entry) => entry.backToBacks ?? 0),
              backgroundColor: palette.royal,
              borderRadius: 8,
              maxBarThickness: 26,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          layout: { padding: { top: 8, right: 16, bottom: 8, left: 8 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const team = ranked[context.dataIndex];
                  const rest = team?.averageRestDays;
                  const segments = [`${helpers.formatNumber(context.parsed.x, 0)} back-to-backs`];
                  if (typeof rest === 'number') {
                    segments.push(`avg rest ${helpers.formatNumber(rest, 1)} days`);
                  }
                  return segments.join(' · ');
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => helpers.formatNumber(value, 0),
              },
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
    element: document.querySelector('[data-chart="clutch-index"]'),
    async createConfig() {
      const data = await highlightDataPromise;
      const composite = Array.isArray(data?.clutchComposite) ? data.clutchComposite : [];
      if (!composite.length) return null;

      const ranked = [...composite].sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
      const labels = ranked.map((entry) =>
        [entry.player, entry.team].filter(Boolean).join(' · ')
      );
      const values = ranked.map((entry) => entry.index ?? 0);

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Composite index',
              data: values,
              backgroundColor: values.map((_, index) => (index === 0 ? palette.coral : palette.sky)),
              borderRadius: 8,
              maxBarThickness: 30,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          layout: { padding: { top: 6, right: 18, bottom: 4, left: 8 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const player = ranked[context.dataIndex];
                  const segments = [`Index ${helpers.formatNumber(context.parsed.x, 0)}`];
                  if (typeof player?.trueShooting === 'number') {
                    segments.push(`TS ${helpers.formatNumber(player.trueShooting * 100, 1)}%`);
                  }
                  return segments.join(' · ');
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: { callback: (value) => helpers.formatNumber(value, 0) },
            },
            y: { grid: { display: false } },
          },
        },
      };
    },
  },
]);

function populateHighlightPanels(data) {
  const finals = data?.finals ?? {};
  const netRatings = Array.isArray(finals.netRatings) ? finals.netRatings : [];
  const games = netRatings.length;

  if (games) {
    const aggregate = netRatings.reduce((sum, entry) => sum + (entry.celtics ?? 0), 0);
    const combinedNet = aggregate / games;
    setStat('stat-finals-net', combinedNet, (value) => formatSigned(value, 1));
    setStat('stat-finals-games', games, (value) => helpers.formatNumber(value, 0));

    const closerWindow = netRatings.slice(-2);
    if (closerWindow.length) {
      const closerNet = closerWindow.reduce((sum, entry) => sum + (entry.celtics ?? 0), 0) / closerWindow.length;
      setStat('stat-finals-closer', closerNet, (value) => formatSigned(value, 1));
      setStat('stat-finals-closer-games', closerWindow.length, (value) => helpers.formatNumber(value, 0));
    }

    const peak = netRatings.reduce((best, entry) =>
      (entry.celtics ?? -Infinity) > (best?.celtics ?? -Infinity) ? entry : best,
      null
    );
    setStat('stat-finals-peak-game', peak?.game, (value) => value);
    setStat('stat-finals-peak-margin', peak?.celtics, (value) => formatSigned(value, 1));
  } else {
    setStat('stat-finals-net', null);
    setStat('stat-finals-games', null);
    setStat('stat-finals-closer', null);
    setStat('stat-finals-closer-games', null);
    setStat('stat-finals-peak-game', null);
    setStat('stat-finals-peak-margin', null);
  }

  const thunder = data?.thunder ?? {};
  const thunderWins = Array.isArray(thunder.wins) ? thunder.wins : [];
  const latest = thunderWins[thunderWins.length - 1];
  const previous = thunderWins[thunderWins.length - 2];
  setStat('stat-thunder-net-rating', thunder.netRating, (value) => formatSigned(value, 1));
  const delta = latest && previous ? (latest.wins ?? 0) - (previous.wins ?? 0) : null;
  setStat('stat-thunder-win-delta', delta, (value) => formatSigned(value, 0, ' wins'));
  setStat('stat-thunder-clutch', thunder.clutchWins, (value) => `${helpers.formatNumber(value, 0)} clutch wins`);

  const paceSeries = Array.isArray(data?.leaguePace) ? data.leaguePace : [];
  const current = paceSeries[paceSeries.length - 1];
  const baseline = paceSeries[0];
  const high = paceSeries.reduce(
    (best, entry) => ((entry.pace ?? -Infinity) > (best?.pace ?? -Infinity) ? entry : best),
    null
  );
  const low = paceSeries.reduce(
    (best, entry) => ((entry.pace ?? Infinity) < (best?.pace ?? Infinity) ? entry : best),
    null
  );
  setStat('stat-pace-current', current?.pace, (value) => helpers.formatNumber(value, 1));
  const shift = current && baseline ? ((current.pace - baseline.pace) / baseline.pace) * 100 : null;
  setStat('stat-pace-shift', shift, (value) => formatSigned(value, 1, '%'));
  const drop = current && high ? high.pace - current.pace : null;
  setStat('stat-pace-drop', drop, (value) => `${helpers.formatNumber(value, 1)} possessions`);
  setStat('stat-pace-low-season', low?.season, (value) => value);
}

function populateClutchInsights(data) {
  const composite = Array.isArray(data?.clutchComposite) ? data.clutchComposite : [];
  if (!composite.length) {
    setStat('stat-clutch-leader', null);
    setStat('stat-clutch-leader-index', null);
    setStat('stat-clutch-leader-ts', null);
    return;
  }

  const leader = composite.reduce(
    (best, entry) => ((entry.index ?? -Infinity) > (best?.index ?? -Infinity) ? entry : best),
    null
  );
  setStat('stat-clutch-leader', leader?.player, (value) => value);
  setStat('stat-clutch-leader-index', leader?.index, (value) => helpers.formatNumber(value, 0));
  setStat('stat-clutch-leader-ts', leader?.trueShooting, (value) => `${helpers.formatNumber(value * 100, 1)}%`);
}

function formatMatchup(event, teamMap) {
  const home = teamMap.get(event.hometeamId);
  const away = teamMap.get(event.awayteamId);
  if (home && away) {
    const homeLabel = home.abbreviation ?? home.name;
    const awayLabel = away.abbreviation ?? away.name;
    return `${awayLabel} at ${homeLabel}`;
  }
  return '';
}

function formatLocation(event) {
  const parts = [];
  if (event.arena) parts.push(event.arena);
  const city = [event.city, event.state].filter(Boolean).join(', ');
  if (city) parts.push(city);
  return parts.join(' · ');
}

function buildEventCopy(event, teamMap) {
  const matchup = formatMatchup(event, teamMap);
  const location = formatLocation(event);
  if (event.subLabel === 'NBA Abu Dhabi Game') {
    return {
      headline: 'Global preseason lift-off',
      detail: [matchup, location].filter(Boolean).join(' · ') || location,
    };
  }
  if (event.label === 'NBA Mexico City Game') {
    return {
      headline: 'Mexico City global showcase',
      detail: [matchup, location].filter(Boolean).join(' · ') || location,
    };
  }
  if (event.label === 'Emirates NBA Cup' && event.subLabel === 'Championship') {
    return {
      headline: 'Cup championship night in Las Vegas',
      detail: location || 'Neutral-site finale crowns the field.',
    };
  }
  if (event.label === 'Emirates NBA Cup') {
    const detailParts = [];
    if (matchup) detailParts.push(matchup);
    if (event.subLabel) detailParts.push(event.subLabel);
    return {
      headline: 'Cup group play tips off',
      detail: detailParts.join(' · ') || location,
    };
  }
  if (event.label === 'NBA Paris Game') {
    return {
      headline: 'Paris matinee shifts the spotlight',
      detail: [matchup, location].filter(Boolean).join(' · ') || location,
    };
  }
  if (event.label === 'NBA Finals') {
    const detailParts = [];
    if (matchup) detailParts.push(matchup);
    if (event.subLabel) detailParts.push(event.subLabel);
    if (event.seriesText) detailParts.push(event.seriesText);
    return {
      headline: 'Finals stage set',
      detail: detailParts.join(' · ') || location,
    };
  }
  const fallbackDetail = [matchup, location].filter(Boolean).join(' · ');
  return {
    headline: event.subLabel ? `${event.label} · ${event.subLabel}` : event.label,
    detail: fallbackDetail,
  };
}

function renderBackToBackList(data) {
  const list = document.querySelector('[data-back-to-back-list]');
  if (!list) return;
  list.innerHTML = '';
  const teams = Array.isArray(data?.backToBackLeaders) ? data.backToBackLeaders : [];
  const leaders = helpers.rankAndSlice(teams, 5, (entry) => entry.backToBacks ?? 0);
  if (!leaders.length) {
    const placeholder = document.createElement('li');
    placeholder.className = 'rest-list__placeholder';
    placeholder.textContent = 'Back-to-back insights unavailable.';
    list.appendChild(placeholder);
    return;
  }

  leaders.forEach((team, index) => {
    const item = document.createElement('li');
    item.className = 'rest-list__item';

    const rank = document.createElement('span');
    rank.className = 'rest-list__rank';
    rank.textContent = String(index + 1);

    const content = document.createElement('div');
    content.className = 'rest-list__content';

    const teamLabel = team.name ?? team.abbreviation ?? 'NBA';
    const name = document.createElement('p');
    name.className = 'rest-list__team';
    name.textContent = teamLabel;
    const identity = document.createElement('div');
    identity.className = 'rest-list__identity';
    identity.appendChild(createTeamLogo(teamLabel, 'team-logo team-logo--small'));
    identity.appendChild(name);

    const meta = document.createElement('p');
    meta.className = 'rest-list__meta';
    const rest = typeof team.averageRestDays === 'number' ? helpers.formatNumber(team.averageRestDays, 1) : null;
    meta.textContent = rest
      ? `${helpers.formatNumber(team.backToBacks ?? 0, 0)} back-to-backs · avg rest ${rest} days`
      : `${helpers.formatNumber(team.backToBacks ?? 0, 0)} back-to-backs`;

    const notes = document.createElement('p');
    notes.className = 'rest-list__notes';
    const longestRoad =
      typeof team.longestRoadTrip === 'number'
        ? `${helpers.formatNumber(team.longestRoadTrip ?? 0, 0)}-game road swing`
        : null;
    const longestHome =
      typeof team.longestHomeStand === 'number'
        ? `${helpers.formatNumber(team.longestHomeStand ?? 0, 0)}-game home stand`
        : null;
    const noteParts = [];
    if (longestRoad) noteParts.push(`Longest road: ${longestRoad}`);
    if (longestHome) noteParts.push(`Longest home: ${longestHome}`);
    notes.textContent = noteParts.join(' · ');

    content.append(identity, meta);
    if (noteParts.length) {
      content.append(notes);
    }

    item.append(rank, content);
    list.append(item);
  });
}

function renderTimeline(data) {
  const list = document.querySelector('[data-special-games]');
  if (!list) return;
  list.innerHTML = '';

  const specialGames = Array.isArray(data?.specialGames) ? data.specialGames : [];
  if (!specialGames.length) {
    const placeholder = document.createElement('li');
    placeholder.className = 'timeline__placeholder';
    placeholder.textContent = 'Special event timeline unavailable.';
    list.appendChild(placeholder);
    return;
  }

  const sorted = [...specialGames].sort((a, b) => new Date(a.date) - new Date(b.date));
  const selectors = [
    (games) => games.find((game) => game.subLabel === 'NBA Abu Dhabi Game'),
    (games) => games.find((game) => game.label === 'NBA Mexico City Game'),
    (games) => games.find((game) => game.label === 'Emirates NBA Cup' && game.subtype === 'in-season'),
    (games) => games.find((game) => game.label === 'Emirates NBA Cup' && game.subLabel === 'Championship'),
    (games) => games.find((game) => game.label === 'NBA Paris Game'),
    (games) => {
      const finals = games.filter((game) => game.label === 'NBA Finals');
      finals.sort((a, b) => new Date(a.date) - new Date(b.date));
      return finals[0];
    },
  ];

  const highlights = [];
  const usedKeys = new Set();
  selectors.forEach((select) => {
    const event = select(sorted);
    if (event) {
      const key = `${event.label}-${event.subLabel ?? ''}-${event.date}`;
      if (!usedKeys.has(key)) {
        usedKeys.add(key);
        highlights.push(event);
      }
    }
  });

  if (!highlights.length) {
    const placeholder = document.createElement('li');
    placeholder.className = 'timeline__placeholder';
    placeholder.textContent = 'Special event timeline unavailable.';
    list.appendChild(placeholder);
    return;
  }

  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const teamMap = new Map((Array.isArray(data?.teams) ? data.teams : []).map((team) => [team.teamId, team]));

  highlights
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((event) => {
      const item = document.createElement('li');
      item.className = 'timeline__item';

      const dateEl = document.createElement('time');
      dateEl.className = 'timeline__date';
      dateEl.dateTime = event.date ?? '';
      try {
        dateEl.textContent = formatter.format(new Date(event.date));
      } catch (error) {
        dateEl.textContent = event.date ?? '';
      }

      const { headline, detail } = buildEventCopy(event, teamMap);

      const headlineEl = document.createElement('p');
      headlineEl.className = 'timeline__headline';
      headlineEl.textContent = headline;

      item.append(dateEl, headlineEl);

      if (detail) {
        const detailEl = document.createElement('p');
        detailEl.className = 'timeline__detail';
        detailEl.textContent = detail;
        item.append(detailEl);
      }

      list.append(item);
    });
}

function populateCallouts(data) {
  const totals = data?.totals ?? {};
  const restSummary = data?.restSummary ?? {};
  const restBuckets = Array.isArray(data?.restBuckets) ? data.restBuckets : [];
  const zeroIntervals = restBuckets.find((bucket) => bucket.label === '0 days')?.intervals ?? 0;
  const totalIntervals = restSummary.totalIntervals ?? restBuckets.reduce((sum, bucket) => sum + (bucket.intervals ?? 0), 0);
  const zeroShare = totalIntervals ? (zeroIntervals / totalIntervals) * 100 : null;

  setStat('stat-total-games', totals.games, (value) => helpers.formatNumber(value, 0));
  setStat('stat-avg-rest', restSummary.averageRestDays, (value) => `${helpers.formatNumber(value, 1)} days`);
  setStat('stat-back-to-backs', restSummary.backToBackIntervals, (value) => helpers.formatNumber(value, 0));
  setStat('stat-alt-games', totals.other, (value) => helpers.formatNumber(value, 0));
  setStat('stat-alt-share', totals.games ? (totals.other / totals.games) * 100 : null, (value) => helpers.formatNumber(value, 1));
  setStat('stat-zero-share', zeroShare, (value) => helpers.formatNumber(value, 1));

  const monthlyCounts = Array.isArray(data?.monthlyCounts) ? data.monthlyCounts : [];
  const peakMonth = monthlyCounts
    .filter((entry) => typeof entry.regularSeason === 'number' && entry.regularSeason > 0)
    .reduce((peak, entry) => (entry.regularSeason > (peak?.regularSeason ?? -Infinity) ? entry : peak), null);
  setStat('monthly-peak-month', peakMonth?.label, (value) => value);
  setStat('monthly-peak-games', peakMonth?.regularSeason, (value) => helpers.formatNumber(value, 0));
}

function populateLoadHighlights(data) {
  const teams = Array.isArray(data?.teams) ? data.teams : [];
  if (!teams.length) {
    setStat('stat-marathon-teams', null);
    setStat('stat-max-games-team', null);
    setStat('stat-max-games', null);
    setStat('stat-b2b-leader-count', null);
    setStat('stat-b2b-leader-team', null);
    setStat('stat-longest-road', null);
    setStat('stat-longest-home', null);
    return;
  }

  const marathonTeams = teams.filter((team) => (team.totalGames ?? 0) >= 95);
  const maxGamesTeam = teams.reduce((best, team) => (team.totalGames > (best?.totalGames ?? -Infinity) ? team : best), null);
  const longestRoad = teams.reduce(
    (best, team) => (team.longestRoadTrip > (best?.longestRoadTrip ?? -Infinity) ? team : best),
    null
  );
  const longestHome = teams.reduce(
    (best, team) => (team.longestHomeStand > (best?.longestHomeStand ?? -Infinity) ? team : best),
    null
  );

  const b2bLeaders = Array.isArray(data?.backToBackLeaders) ? data.backToBackLeaders : [];
  const topBackToBack = helpers.rankAndSlice(b2bLeaders, 1, (entry) => entry.backToBacks ?? 0)[0];

  setStat('stat-marathon-teams', marathonTeams.length, (value) => helpers.formatNumber(value, 0));
  setStat('stat-max-games-team', maxGamesTeam?.name, (value) => value);
  setStat('stat-max-games', maxGamesTeam?.totalGames, (value) => `${helpers.formatNumber(value, 0)} games`);
  setStat('stat-b2b-leader-count', topBackToBack?.backToBacks, (value) => helpers.formatNumber(value, 0));
  setStat('stat-b2b-leader-team', topBackToBack?.name ?? topBackToBack?.abbreviation, (value) => value);

  const longestRoadLabel = longestRoad
    ? `${helpers.formatNumber(longestRoad.longestRoadTrip ?? 0, 0)} (${longestRoad.abbreviation ?? longestRoad.name})`
    : null;
  const longestHomeLabel = longestHome
    ? `${helpers.formatNumber(longestHome.longestHomeStand ?? 0, 0)} (${longestHome.abbreviation ?? longestHome.name})`
    : null;

  setStat('stat-longest-road', longestRoadLabel, (value) => value);
  setStat('stat-longest-home', longestHomeLabel, (value) => value);
}

function populateRestFooter(data) {
  const footer = document.querySelector('[data-rest-footer]');
  if (!footer) return;
  const restSummary = data?.restSummary ?? {};
  const restBuckets = Array.isArray(data?.restBuckets) ? data.restBuckets : [];
  const totalIntervals = restSummary.totalIntervals ?? restBuckets.reduce((sum, bucket) => sum + (bucket.intervals ?? 0), 0);
  const zeroIntervals = restBuckets.find((bucket) => bucket.label === '0 days')?.intervals ?? 0;
  if (!totalIntervals) {
    footer.textContent = 'Rest distribution data unavailable.';
    return;
  }
  const share = (zeroIntervals / totalIntervals) * 100;
  footer.textContent = `Zero-rest swings accounted for ${helpers.formatNumber(share, 1)}% of ${helpers.formatNumber(
    totalIntervals,
    0
  )} tracked intervals.`;
}

scheduleDataPromise
  .then((data) => {
    populateCallouts(data);
    renderBackToBackList(data);
    renderTimeline(data);
    populateLoadHighlights(data);
    populateRestFooter(data);
  })
  .catch((error) => {
    console.error('Unable to hydrate season rewind view', error);
    const backToBackList = document.querySelector('[data-back-to-back-list]');
    if (backToBackList) {
      backToBackList.innerHTML = '';
      const placeholder = document.createElement('li');
      placeholder.className = 'rest-list__placeholder';
      placeholder.textContent = 'Season rewind data unavailable.';
      backToBackList.appendChild(placeholder);
    }
    const timeline = document.querySelector('[data-special-games]');
    if (timeline) {
      timeline.innerHTML = '';
      const placeholder = document.createElement('li');
      placeholder.className = 'timeline__placeholder';
      placeholder.textContent = 'Special event timeline unavailable.';
      timeline.appendChild(placeholder);
    }
    const footer = document.querySelector('[data-rest-footer]');
    if (footer) {
      footer.textContent = 'Rest distribution data unavailable.';
    }
  });

highlightDataPromise
  .then((data) => {
    populateHighlightPanels(data);
    populateClutchInsights(data);
  })
  .catch((error) => {
    console.error('Unable to hydrate rewind highlight data', error);
    populateHighlightPanels({});
    populateClutchInsights({});
    const clutchWrapper = document
      .querySelector('[data-chart="clutch-index"]')
      ?.closest('[data-chart-wrapper]');
    if (clutchWrapper && !clutchWrapper.querySelector('.viz-error__message')) {
      clutchWrapper.classList.add('viz-error');
      const message = document.createElement('p');
      message.className = 'viz-error__message';
      message.textContent = 'Clutch composite data unavailable.';
      clutchWrapper.appendChild(message);
    }
  });
