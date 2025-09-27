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

function setStat(attribute, value, formatter = (v) => v, fallback = '—') {
  const nodes = document.querySelectorAll(`[data-${attribute}]`);
  const hasValue = value !== undefined && value !== null && !(typeof value === 'number' && Number.isNaN(value));
  nodes.forEach((node) => {
    node.textContent = hasValue ? formatter(value) : fallback;
  });
}

registerCharts([
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
]);

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
