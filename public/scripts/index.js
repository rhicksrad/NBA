import { registerCharts, helpers } from './hub-charts.js';

const palette = {
  royal: '#1156d6',
  sky: 'rgba(31, 123, 255, 0.85)',
  gold: '#f4b53f',
  red: '#ef3d5b',
  navy: '#0b2545',
};

async function fetchJsonSafe(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn('Unable to fetch preview data', url, error);
    return null;
  }
}

function safeText(target, value) {
  const node = typeof target === 'string' ? document.querySelector(target) : target;
  if (node && typeof value !== 'undefined' && value !== null) {
    node.textContent = value;
  }
}

function formatDateLabel(dateString, options = { month: 'short', day: 'numeric' }) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

function createTeamLookup(scheduleData) {
  const map = new Map();
  const teams = Array.isArray(scheduleData?.teams) ? scheduleData.teams : [];
  teams.forEach((team) => {
    if (team?.teamId) {
      map.set(String(team.teamId), team);
    }
  });
  return map;
}

function formatLocation(game) {
  if (!game) return '';
  const segments = [game.city, game.state].filter(Boolean);
  return segments.join(', ') || 'Neutral site';
}

function formatMatchup(game, lookup) {
  if (!game) return '';
  const home = lookup.get(String(game.hometeamId))?.name;
  const away = lookup.get(String(game.awayteamId))?.name;
  if (home && away) {
    return `${away} vs. ${home}`;
  }
  if (home || away) {
    return home || away;
  }
  return game.subLabel || game.label || 'Showcase';
}

function hydrateHero(teamData, scheduleData) {
  const leaders = helpers.rankAndSlice(
    Array.isArray(teamData?.winPctLeaders) ? teamData.winPctLeaders : [],
    1,
    (team) => team.winPct
  );
  const topTeam = leaders[0];
  if (topTeam) {
    const margin = (topTeam.pointsPerGame ?? 0) - (topTeam.opponentPointsPerGame ?? 0);
    safeText('[data-top-team-name]', topTeam.team);
    safeText('[data-top-team-record]', `${helpers.formatNumber(topTeam.wins, 0)}-${helpers.formatNumber(topTeam.losses, 0)}`);
    safeText('[data-top-team-margin]', helpers.formatNumber(Math.abs(margin), 1));
    safeText(
      '[data-top-team-strength]',
      `${helpers.formatNumber(topTeam.pointsPerGame ?? 0, 1)} points for vs. ${helpers.formatNumber(
        topTeam.opponentPointsPerGame ?? 0,
        1
      )} allowed`
    );
  }

  if (!scheduleData) {
    return;
  }

  const restSummary = scheduleData?.restSummary ?? {};
  const labelBreakdown = Array.isArray(scheduleData?.labelBreakdown) ? scheduleData.labelBreakdown : [];
  const specialGames = Array.isArray(scheduleData?.specialGames) ? scheduleData.specialGames : [];
  const globalGames = specialGames.filter((game) => game?.subtype === 'Global Games');
  const cupGamesEntry = labelBreakdown.find((entry) => entry?.label === 'Emirates NBA Cup');
  const cupGamesCount = cupGamesEntry?.games ?? 0;

  safeText('[data-metric-backtoback]', helpers.formatNumber(restSummary.backToBackIntervals ?? 0, 0));
  safeText('[data-metric-restwindows]', helpers.formatNumber(restSummary.totalIntervals ?? 0, 0));
  safeText('[data-metric-cupgames]', helpers.formatNumber(cupGamesCount, 0));
  safeText('[data-metric-globalgames]', helpers.formatNumber(globalGames.length || 0, 0));

  const teamLookup = createTeamLookup(scheduleData);

  const cupHighlight = specialGames
    .filter((game) => game?.label === 'Emirates NBA Cup' && /championship|final/i.test(game?.subLabel ?? ''))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  if (cupHighlight) {
    const cupDate = document.querySelector('[data-cup-date]');
    if (cupDate) {
      cupDate.dateTime = cupHighlight.date;
      cupDate.textContent = `${formatDateLabel(cupHighlight.date)} · ${formatLocation(cupHighlight)}`.trim();
    }
    safeText('[data-cup-arena]', cupHighlight.arena || 'Neutral site');
    const cupTotal = cupGamesCount || labelBreakdown.find((entry) => entry?.label === 'Emirates NBA Cup')?.games || 0;
    safeText('[data-cup-story]', `${helpers.formatNumber(cupTotal, 0)} Cup tilts funnel into one desert coronation.`);
  }

  const globalHighlight = globalGames.sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  if (globalHighlight) {
    const globalDate = document.querySelector('[data-global-date]');
    if (globalDate) {
      globalDate.dateTime = globalHighlight.date;
      globalDate.textContent = `${formatDateLabel(globalHighlight.date)} · ${formatLocation(globalHighlight)}`.trim();
    }
    safeText('[data-global-match]', formatMatchup(globalHighlight, teamLookup));
    safeText('[data-global-count]', `${helpers.formatNumber(globalGames.length || 0, 0)} neutral-site showcases`);
  }
}

function renderSeasonLead(scheduleData) {
  const lead = document.querySelector('[data-season-lead]');
  if (!lead || !scheduleData) {
    return;
  }
  const totals = scheduleData?.totals ?? {};
  const restSummary = scheduleData?.restSummary ?? {};
  const cupGamesEntry = Array.isArray(scheduleData?.labelBreakdown)
    ? scheduleData.labelBreakdown.find((entry) => entry?.label === 'Emirates NBA Cup')
    : null;
  const cupGamesCount = cupGamesEntry?.games ?? 0;
  const text = `${helpers.formatNumber(totals.regularSeason ?? totals.games ?? 0, 0)} regular-season games, ${helpers.formatNumber(
    restSummary.backToBackIntervals ?? 0,
    0
  )} zero-day rest intervals, and ${helpers.formatNumber(cupGamesCount, 0)} Cup showdowns—every storyline has a lane.`;
  lead.textContent = text;
}

function renderContenderGrid(teamData) {
  const container = document.querySelector('[data-contender-grid]');
  if (!container) {
    return;
  }
  container.innerHTML = '';
  const teams = helpers
    .rankAndSlice(Array.isArray(teamData?.winPctLeaders) ? teamData.winPctLeaders : [], 6, (team) => team.winPct)
    .sort((a, b) => b.winPct - a.winPct);
  if (!teams.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'contender-grid__placeholder';
    placeholder.textContent = 'Contender data is warming up—check back soon.';
    container.appendChild(placeholder);
    return;
  }

  teams.forEach((team, index) => {
    const card = document.createElement('article');
    card.className = 'contender-card';
    const margin = (team.pointsPerGame ?? 0) - (team.opponentPointsPerGame ?? 0);
    const marginLabel = `${margin >= 0 ? '+' : '–'}${helpers.formatNumber(Math.abs(margin), 1)}`;
    card.innerHTML = `
      <header class="contender-card__header">
        <span class="contender-card__rank">${index + 1}</span>
        <h4 class="contender-card__team">${team.team}</h4>
      </header>
      <dl class="contender-card__metrics">
        <div><dt>Win rate</dt><dd>${helpers.formatNumber((team.winPct ?? 0) * 100, 1)}%</dd></div>
        <div><dt>Scoring margin</dt><dd>${marginLabel}</dd></div>
        <div><dt>Assist engine</dt><dd>${helpers.formatNumber(team.assistsPerGame ?? 0, 1)} apg</dd></div>
      </dl>
      <p class="contender-card__note">${helpers.formatNumber(team.pointsPerGame ?? 0, 1)} points per night, ${helpers.formatNumber(
      team.opponentPointsPerGame ?? 0,
      1
    )} allowed.</p>
    `;
    container.appendChild(card);
  });
}

function renderBackToBack(scheduleData) {
  const list = document.querySelector('[data-back-to-back-list]');
  if (!list) {
    return;
  }
  list.innerHTML = '';
  const leaders = Array.isArray(scheduleData?.backToBackLeaders) ? scheduleData.backToBackLeaders.slice(0, 5) : [];
  if (!leaders.length) {
    const placeholder = document.createElement('li');
    placeholder.className = 'rest-list__placeholder';
    placeholder.textContent = 'Back-to-back intensity data is still syncing.';
    list.appendChild(placeholder);
  } else {
    leaders.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = 'rest-list__item';
      const rank = document.createElement('span');
      rank.className = 'rest-list__rank';
      rank.textContent = String(index + 1);
      const body = document.createElement('div');
      body.className = 'rest-list__content';
      const team = document.createElement('p');
      team.className = 'rest-list__team';
      team.textContent = entry.name;
      const meta = document.createElement('p');
      meta.className = 'rest-list__meta';
      meta.textContent = `${helpers.formatNumber(entry.backToBacks ?? 0, 0)} back-to-backs · ${helpers.formatNumber(
        entry.averageRestDays ?? 0,
        2
      )} avg rest days`;
      const notes = document.createElement('p');
      notes.className = 'rest-list__notes';
      notes.textContent = `Home stand max: ${helpers.formatNumber(entry.longestHomeStand ?? 0, 0)} · Road trip max: ${helpers.formatNumber(
        entry.longestRoadTrip ?? 0,
        0
      )}`;
      body.append(team, meta, notes);
      item.append(rank, body);
      list.appendChild(item);
    });
  }

  const restAverage = document.querySelector('[data-rest-average]');
  if (restAverage) {
    restAverage.textContent = `${helpers.formatNumber(scheduleData?.restSummary?.averageRestDays ?? 0, 2)} days`;
  }
  safeText('[data-rest-intervals]', helpers.formatNumber(scheduleData?.restSummary?.totalIntervals ?? 0, 0));
}

function renderTimeline(scheduleData) {
  const list = document.querySelector('[data-season-timeline]');
  if (!list) {
    return;
  }
  list.innerHTML = '';
  if (!scheduleData) {
    const placeholder = document.createElement('li');
    placeholder.className = 'timeline__placeholder';
    placeholder.textContent = 'Spotlight dates arrive once the schedule manifest loads.';
    list.appendChild(placeholder);
    return;
  }
  const specialGames = Array.isArray(scheduleData?.specialGames) ? scheduleData.specialGames : [];
  const teamLookup = createTeamLookup(scheduleData);
  const events = [];

  const addEvent = (game, headline) => {
    if (!game) return;
    events.push({
      date: game.date,
      headline,
      detail: `${formatMatchup(game, teamLookup)} · ${game.arena || 'Neutral site'}`,
      location: formatLocation(game),
    });
  };

  const sortAsc = (a, b) => new Date(a.date) - new Date(b.date);
  const globalGame = specialGames.filter((game) => game?.subtype === 'Global Games').sort(sortAsc)[0];
  addEvent(globalGame, 'Global tip-off');
  const cupFinal = specialGames
    .filter((game) => game?.label === 'Emirates NBA Cup' && /championship|final/i.test(game?.subLabel ?? ''))
    .sort(sortAsc)[0];
  addEvent(cupFinal, 'Emirates NBA Cup championship');
  const parisGame = specialGames.filter((game) => game?.label === 'NBA Paris Game').sort(sortAsc)[0];
  addEvent(parisGame, 'Paris spotlight');
  const mexicoGame = specialGames.filter((game) => game?.label === 'NBA Mexico City Game').sort(sortAsc)[0];
  addEvent(mexicoGame, 'Mexico City showcase');
  const finalsGame = specialGames
    .filter((game) => game?.label === 'NBA Finals')
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  addEvent(finalsGame, 'Projected Finals climax');

  const uniqueEvents = events.filter((event, index, array) => {
    const key = `${event.headline}-${event.date}`;
    return array.findIndex((candidate) => `${candidate.headline}-${candidate.date}` === key) === index;
  });

  if (!uniqueEvents.length) {
    const placeholder = document.createElement('li');
    placeholder.className = 'timeline__placeholder';
    placeholder.textContent = 'Spotlight dates arrive once the schedule manifest loads.';
    list.appendChild(placeholder);
    return;
  }

  uniqueEvents
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5)
    .forEach((event) => {
      const item = document.createElement('li');
      item.className = 'timeline__item';
      const dateLabel = document.createElement('time');
      dateLabel.className = 'timeline__date';
      dateLabel.dateTime = event.date;
      dateLabel.textContent = formatDateLabel(event.date, { month: 'short', day: 'numeric', year: 'numeric' });
      const headline = document.createElement('p');
      headline.className = 'timeline__headline';
      headline.textContent = event.headline;
      const detail = document.createElement('p');
      detail.className = 'timeline__detail';
      detail.textContent = `${event.detail} — ${event.location}`;
      item.append(dateLabel, headline, detail);
      list.appendChild(item);
    });
}

function renderStoryCards(storyData) {
  const grid = document.querySelector('[data-story-grid]');
  if (!grid) {
    return;
  }
  grid.innerHTML = '';
  const stories = Array.isArray(storyData?.stories) ? storyData.stories.slice(0, 3) : [];
  if (!stories.length) {
    const placeholder = document.createElement('article');
    placeholder.className = 'story-verse__placeholder';
    placeholder.textContent = 'Narrative walkthroughs unlock as soon as the data feed syncs.';
    grid.appendChild(placeholder);
    return;
  }

  stories.forEach((story) => {
    const card = document.createElement('article');
    card.className = 'story-card';
    const header = document.createElement('header');
    header.className = 'story-card__header';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'story-card__eyebrow';
    eyebrow.textContent = story.metric?.label ?? 'Featured metric';
    const title = document.createElement('h3');
    title.textContent = story.title;
    header.append(eyebrow, title);

    const lede = document.createElement('p');
    lede.className = 'story-card__lede';
    lede.textContent = story.lede;

    const metric = document.createElement('div');
    metric.className = 'story-card__metric';
    const metricValue = document.createElement('span');
    metricValue.className = 'story-card__metric-value';
    metricValue.textContent = story.metric?.value ?? '';
    const metricContext = document.createElement('span');
    metricContext.className = 'story-card__metric-context';
    metricContext.textContent = story.metric?.context ?? '';
    metric.append(metricValue, metricContext);

    const points = document.createElement('ul');
    points.className = 'story-card__points';
    (Array.isArray(story.editorial) ? story.editorial.slice(0, 3) : []).forEach((point) => {
      const li = document.createElement('li');
      li.textContent = point;
      points.appendChild(li);
    });

    const spotlights = document.createElement('div');
    spotlights.className = 'story-card__spotlights';
    (Array.isArray(story.spotlights) ? story.spotlights.slice(0, 3) : []).forEach((spotlight) => {
      const highlight = document.createElement('span');
      highlight.className = 'story-card__spotlight';
      const value = document.createElement('strong');
      value.textContent = spotlight.value;
      const label = document.createElement('small');
      label.textContent = spotlight.label;
      const context = document.createElement('em');
      context.textContent = spotlight.context;
      highlight.append(value, label, context);
      spotlights.appendChild(highlight);
    });

    card.append(header, lede, metric, points, spotlights);
    grid.appendChild(card);
  });
}

function renderLegacy(leadersData) {
  const grid = document.querySelector('[data-legacy-grid]');
  if (!grid) {
    return;
  }
  grid.innerHTML = '';
  const categories = [
    { key: 'points', label: 'Scoring vault', valueKey: 'points', perGameKey: 'pointsPerGame', unit: 'pts' },
    { key: 'assists', label: 'Playmaking lineage', valueKey: 'assists', perGameKey: 'assistsPerGame', unit: 'ast' },
    { key: 'rebounds', label: 'Glass dynasty', valueKey: 'rebounds', perGameKey: 'reboundsPerGame', unit: 'reb' },
  ];

  if (!leadersData) {
    const placeholder = document.createElement('article');
    placeholder.className = 'legacy-card legacy-card--placeholder';
    placeholder.textContent = 'Legendary benchmarks will populate once the leader archive loads.';
    grid.appendChild(placeholder);
    return;
  }

  categories.forEach((category) => {
    const list = Array.isArray(leadersData?.careerLeaders?.[category.key])
      ? leadersData.careerLeaders[category.key].slice(0, 3)
      : [];
    const card = document.createElement('article');
    card.className = 'legacy-card';
    const header = document.createElement('div');
    header.className = 'legacy-card__header';
    const tag = document.createElement('span');
    tag.className = 'legacy-card__tag';
    tag.textContent = category.label;
    const title = document.createElement('h3');
    title.textContent = list[0]?.name ?? 'Legacy leaders';
    const summary = document.createElement('p');
    summary.className = 'legacy-card__summary';
    summary.textContent = list[0]
      ? `${helpers.formatNumber(list[0][category.valueKey] ?? 0, 0)} ${category.unit} career • ${helpers.formatNumber(
          list[0][category.perGameKey] ?? 0,
          2
        )} per game`
      : 'Benchmarks updating in real time.';
    header.append(tag, title, summary);

    const ul = document.createElement('ul');
    ul.className = 'legacy-card__list';
    if (!list.length) {
      const placeholder = document.createElement('li');
      placeholder.className = 'legacy-card__list-item';
      placeholder.textContent = 'Data pending for this category.';
      ul.appendChild(placeholder);
    } else {
      list.forEach((player) => {
        const li = document.createElement('li');
        li.className = 'legacy-card__list-item';
        const name = document.createElement('strong');
        name.textContent = player.name;
        const totals = document.createElement('span');
        totals.textContent = `${helpers.formatNumber(player[category.valueKey] ?? 0, 0)} ${category.unit} • ${helpers.formatNumber(
          player[category.perGameKey] ?? 0,
          2
        )} per game`;
        const era = document.createElement('span');
        const seasons = [player.firstSeason, player.lastSeason].filter((season) => typeof season === 'number');
        const window = seasons.length === 2 ? `${seasons[0]}–${seasons[1]}` : '';
        const teams = Array.isArray(player.teams) ? player.teams.slice(0, 3).join(', ') : '';
        era.textContent = [window, teams].filter(Boolean).join(' • ');
        li.append(name, totals, era);
        ul.appendChild(li);
      });
    }

    card.append(header, ul);
    grid.appendChild(card);
  });
}

async function resolveScheduleSource() {
  const fallback = 'data/season_25_26_schedule.json';
  try {
    const response = await fetch('data/schedule_manifest.json');
    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${response.status}`);
    }
    const manifest = await response.json();
    const seasons = Array.isArray(manifest?.seasons) ? manifest.seasons : [];
    const primary = seasons.find((season) => season?.current) ?? seasons[0];
    if (primary?.path && typeof primary.path === 'string') {
      return primary.path;
    }
  } catch (error) {
    console.warn('Falling back to default schedule source', error);
  }
  return fallback;
}

async function bootstrap() {
  const scheduleSource = await resolveScheduleSource();

  registerCharts([
    {
      element: document.querySelector('[data-chart="season-volume"]'),
      source: scheduleSource,
      async createConfig(data) {
        const months = Array.isArray(data?.monthlyCounts) ? data.monthlyCounts : [];
        if (!months.length) return null;
        const labels = months.map((entry) => entry.label);
        const preseason = months.map((entry) => entry.preseason || 0);
        const regularSeason = months.map((entry) => entry.regularSeason || 0);
        const otherPlay = months.map(
          (entry) => Math.max(0, (entry.games || 0) - (entry.preseason || 0) - (entry.regularSeason || 0))
        );

        return {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Regular season',
                data: regularSeason,
                backgroundColor: palette.royal,
              },
              {
                label: 'Preseason',
                data: preseason,
                backgroundColor: palette.gold,
              },
              {
                label: 'Cup & postseason',
                data: otherPlay,
                backgroundColor: palette.red,
              },
            ],
          },
          options: {
            layout: { padding: { top: 8, right: 12, bottom: 0, left: 0 } },
            scales: {
              x: {
                stacked: true,
                grid: { display: false },
              },
              y: {
                stacked: true,
                beginAtZero: true,
                ticks: {
                  callback: (value) => `${helpers.formatNumber(value, 0)}`,
                },
              },
            },
            plugins: {
              legend: {
                position: 'bottom',
              },
              tooltip: {
                callbacks: {
                  label(context) {
                    return `${context.dataset.label}: ${helpers.formatNumber(context.parsed.y, 0)} games`;
                  },
                },
              },
            },
          },
        };
      },
    },
    {
      element: document.querySelector('[data-chart="team-efficiency"]'),
      source: 'data/team_performance.json',
      async createConfig(data) {
        const teams = helpers
          .rankAndSlice(Array.isArray(data?.winPctLeaders) ? data.winPctLeaders : [], 12, (team) => team.winPct)
          .map((team) => ({
            x: Number(team.pointsPerGame.toFixed(2)),
            y: Number(team.opponentPointsPerGame.toFixed(2)),
            winPct: team.winPct,
            team: team.team,
          }))
          .sort((a, b) => b.winPct - a.winPct);
        if (!teams.length) return null;

        return {
          type: 'scatter',
          data: {
            datasets: [
              {
                label: 'Top franchises',
                data: teams,
                pointBackgroundColor: palette.royal,
                pointBorderColor: palette.sky,
                pointBorderWidth: 1.5,
                pointRadius: (ctx) => 5 + ctx.raw.winPct * 6,
                pointHoverRadius: (ctx) => 7 + ctx.raw.winPct * 6,
              },
            ],
          },
          options: {
            layout: { padding: 8 },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label(context) {
                    const { raw } = context;
                    return `${raw.team}: ${helpers.formatNumber(raw.winPct * 100, 1)}% win — ${helpers.formatNumber(raw.x, 2)} pts for, ${helpers.formatNumber(raw.y, 2)} pts allowed`;
                  },
                },
              },
            },
            scales: {
              x: {
                title: { display: true, text: 'Points scored per game' },
                grid: { color: 'rgba(11, 37, 69, 0.08)' },
              },
              y: {
                title: { display: true, text: 'Points allowed per game' },
                grid: { color: 'rgba(11, 37, 69, 0.08)' },
              },
            },
          },
        };
      },
    },
    {
      element: document.querySelector('[data-chart="global-pipeline"]'),
      source: 'data/players_overview.json',
      async createConfig(data) {
        const countries = helpers.rankAndSlice(Array.isArray(data?.countries) ? data.countries : [], 12, (c) => c.players);
        if (!countries.length) return null;
        countries.sort((a, b) => b.players - a.players);
        const labels = countries.map((entry) => entry.country);
        const players = countries.map((entry) => entry.players);

        return {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Players produced',
                data: players,
                backgroundColor: palette.royal,
              },
            ],
          },
          options: {
            indexAxis: 'y',
            layout: { padding: { right: 8, left: 8, top: 4, bottom: 4 } },
            scales: {
              x: {
                beginAtZero: true,
                grid: { color: 'rgba(11, 37, 69, 0.08)' },
                ticks: {
                  callback: (value) => `${helpers.formatNumber(value, 0)}`,
                },
              },
              y: {
                grid: { display: false },
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label(context) {
                    return `${context.label}: ${helpers.formatNumber(context.parsed.x, 0)} players`;
                  },
                },
              },
            },
          },
        };
      },
    },
  ]);

  const [scheduleData, teamData, storyData, leaderData] = await Promise.all([
    fetchJsonSafe(scheduleSource),
    fetchJsonSafe('data/team_performance.json'),
    fetchJsonSafe('data/storytelling_walkthroughs.json'),
    fetchJsonSafe('data/player_leaders.json'),
  ]);

  hydrateHero(teamData, scheduleData);
  renderSeasonLead(scheduleData);
  renderContenderGrid(teamData);
  renderBackToBack(scheduleData);
  renderTimeline(scheduleData);
  renderStoryCards(storyData);
  renderLegacy(leaderData);
}

bootstrap();
