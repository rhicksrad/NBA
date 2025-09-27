import { registerCharts, helpers } from './hub-charts.js';

const palette = {
  royal: '#1156d6',
  sky: 'rgba(31, 123, 255, 0.85)',
  gold: '#f4b53f',
  red: '#ef3d5b',
  navy: '#0b2545',
};

const preseasonPowerIndex = [
  {
    team: 'Boston Celtics',
    tier: 'Title favorite',
    note: 'Two-way spine with Tatum, Brown, and double-big coverages keeps them atop the board.',
  },
  {
    team: 'Denver Nuggets',
    tier: 'Title favorite',
    note: 'Jokić-Murray continuity still pilots the cleanest half-court offense in basketball.',
  },
  {
    team: 'Oklahoma City Thunder',
    tier: 'Title hopeful',
    note: 'Shai-led creation plus length everywhere accelerates their contender timeline.',
  },
  {
    team: 'Minnesota Timberwolves',
    tier: 'Title hopeful',
    note: 'League-best defense and ascendant Anthony Edwards keep the ceiling in championship range.',
  },
  {
    team: 'New York Knicks',
    tier: 'Contender',
    note: 'Brunson engine and bruising depth give the East a new bully on the block.',
  },
  {
    team: 'Milwaukee Bucks',
    tier: 'Contender',
    note: 'Giannis and Dame finally get a full camp to harmonize the downhill spacing map.',
  },
  {
    team: 'Phoenix Suns',
    tier: 'Contender',
    note: 'Booker and Beal drive an elite offense if the refreshed supporting size holds up.',
  },
  {
    team: 'Philadelphia 76ers',
    tier: 'Contender',
    note: 'Healthy Embiid plus rangier wings keeps them in trophy conversations.',
  },
  {
    team: 'Dallas Mavericks',
    tier: 'Contender',
    note: 'Doncic-Irving chemistry with vertical spacing upgrades screams top-five attack.',
  },
  {
    team: 'Cleveland Cavaliers',
    tier: 'High-ceiling playoff',
    note: 'Mitchell, Mobley, and a faster tempo aim for deeper May runs.',
  },
  {
    team: 'Los Angeles Lakers',
    tier: 'High-ceiling playoff',
    note: 'LeBron and AD flanked by more shooting keeps the window cracked wide.',
  },
  {
    team: 'Golden State Warriors',
    tier: 'Playoff lock',
    note: 'Curry still warps defenses while youth infusion protects the engine.',
  },
  {
    team: 'Miami Heat',
    tier: 'Playoff lock',
    note: 'Spoelstra structure and Butler-Bam toughness always scale in spring.',
  },
  {
    team: 'Sacramento Kings',
    tier: 'Playoff lock',
    note: 'Fox-Sabonis pace remains a nightmare once the threes fall.',
  },
  {
    team: 'Memphis Grizzlies',
    tier: 'Playoff lock',
    note: 'Full year of Ja with Smart and Jaren anchors reloads the bite.',
  },
  {
    team: 'New Orleans Pelicans',
    tier: 'Playoff mix',
    note: 'Zion and Ingram healthy makes every matchup a mismatch clinic.',
  },
  {
    team: 'Orlando Magic',
    tier: 'Playoff mix',
    note: 'Banchero-Wagner leap plus elite length threatens a top-five defense.',
  },
  {
    team: 'Indiana Pacers',
    tier: 'Playoff mix',
    note: 'Haliburton pace paired with Siakam keeps the scoreboard glowing.',
  },
  {
    team: 'Los Angeles Clippers',
    tier: 'Playoff mix',
    note: 'If Kawhi and PG stay upright, Harden can orchestrate a balanced attack.',
  },
  {
    team: 'Houston Rockets',
    tier: 'Play-in hunt',
    note: 'Udoka identity plus blossoming Jalen Green makes their first playoff push real.',
  },
  {
    team: 'Atlanta Hawks',
    tier: 'Play-in hunt',
    note: 'Trae and Murray audition for full synergy under Snyder’s modern tweaks.',
  },
  {
    team: 'Chicago Bulls',
    tier: 'Play-in hunt',
    note: 'Spacing upgrades and defensive buy-in try to extend the DeRozan window.',
  },
  {
    team: 'San Antonio Spurs',
    tier: 'Play-in swing',
    note: 'Year-two Wemby experiments stretch the floor and the imagination.',
  },
  {
    team: 'Brooklyn Nets',
    tier: 'Play-in swing',
    note: 'Bridges-led wingspan battalion hunts for enough offense to stick around.',
  },
  {
    team: 'Toronto Raptors',
    tier: 'Rebuild watch',
    note: 'Scottie Barnes takes the controls while Masai plots the next core.',
  },
  {
    team: 'Utah Jazz',
    tier: 'Rebuild watch',
    note: 'Markkanen firepower and young guards keep them pesky amid a reset.',
  },
  {
    team: 'Detroit Pistons',
    tier: 'Rebuild watch',
    note: 'Cade Cunningham finally has vets to translate potential into wins.',
  },
  {
    team: 'Charlotte Hornets',
    tier: 'Rebuild watch',
    note: 'LaMelo, Miller, and revamped support need reps before the leap.',
  },
  {
    team: 'Portland Trail Blazers',
    tier: 'Growth track',
    note: 'Scoot Henderson’s learning curve defines a development-first season.',
  },
  {
    team: 'Washington Wizards',
    tier: 'Growth track',
    note: 'New front office prioritizes reps for Coulibaly, Poole, and the kids.',
  },
];

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

function hydrateHero(teamData) {
  const list = document.querySelector('[data-power-index]');
  if (!list) {
    return;
  }

  list.innerHTML = '';

  const teams = Array.isArray(preseasonPowerIndex) ? preseasonPowerIndex : [];
  if (!teams.length) {
    const placeholder = document.createElement('li');
    placeholder.className = 'power-board__placeholder';
    placeholder.textContent = 'Power index will populate once the editorial board finalizes rankings.';
    list.appendChild(placeholder);
    return;
  }

  const statLookup = new Map();
  (Array.isArray(teamData?.winPctLeaders) ? teamData.winPctLeaders : []).forEach((team) => {
    if (team?.team) {
      statLookup.set(team.team, team);
    }
  });

  teams.forEach((entry, index) => {
    const item = document.createElement('li');
    item.className = 'power-board__item';

    const rank = document.createElement('span');
    rank.className = 'power-board__rank';
    rank.textContent = String(index + 1);

    const body = document.createElement('div');
    body.className = 'power-board__content';
    const name = document.createElement('p');
    name.className = 'power-board__name';
    name.textContent = entry.team;
    const note = document.createElement('p');
    note.className = 'power-board__note';
    note.textContent = entry.note;
    body.append(name, note);

    const meta = document.createElement('div');
    meta.className = 'power-board__meta';
    const tier = document.createElement('span');
    tier.className = 'power-board__tier';
    tier.textContent = entry.tier;
    meta.appendChild(tier);

    const stats = statLookup.get(entry.team);
    if (stats) {
      const margin = (stats.pointsPerGame ?? 0) - (stats.opponentPointsPerGame ?? 0);
      const stat = document.createElement('span');
      stat.className = 'power-board__stat';
      stat.textContent = `${helpers.formatNumber((stats.winPct ?? 0) * 100, 1)}% win pct · ${
        margin >= 0 ? '+' : '–'
      }${helpers.formatNumber(Math.abs(margin), 1)} margin`;
      meta.appendChild(stat);
    }

    item.append(rank, body, meta);
    list.appendChild(item);
  });
}

function deriveItineraryContext(game) {
  const descriptor = `${game?.subLabel ?? ''} ${game?.seriesText ?? ''} ${game?.label ?? ''}`.toLowerCase();
  const subtype = (game?.subtype ?? '').toLowerCase();
  if (subtype.includes('global') || descriptor.includes('global') || descriptor.includes('international')) {
    return {
      tag: 'Global stage',
      focus: "International stop spotlights the league's worldwide push before opening night.",
    };
  }
  if (descriptor.includes('abu dhabi') || descriptor.includes('paris') || descriptor.includes('macao')) {
    return {
      tag: 'Global stage',
      focus: "Neutral-site showcase primes worldwide fanbases for the new season.",
    };
  }
  if (descriptor.includes('classic') || descriptor.includes('rival') || descriptor.includes('derby')) {
    return {
      tag: 'Marquee rivalry',
      focus: 'Legacy opponents turn a tune-up into a statement night.',
    };
  }
  if (descriptor.includes('cup') || descriptor.includes('in-season')) {
    return {
      tag: 'Cup tune-up',
      focus: 'Teams rehearse the pace and coverages that decide December tournament nights.',
    };
  }
  if (descriptor.includes('rookie') || descriptor.includes('prospect') || descriptor.includes('sophomore')) {
    return {
      tag: 'Rookie spotlight',
      focus: 'Young cores get extended runway to fight for rotation minutes.',
    };
  }
  if (descriptor.includes('homecoming') || descriptor.includes('heritage') || descriptor.includes('community')) {
    return {
      tag: 'Community showcase',
      focus: 'Local storytelling anchors the preseason party before standings matter.',
    };
  }
  return {
    tag: 'Camp primer',
    focus: 'Training camp intensity lifts as rotations tighten toward opening night.',
  };
}

function buildItineraryHighlights(game, context) {
  const highlights = [];
  const seen = new Set();
  const addHighlight = (text) => {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    highlights.push(trimmed);
    seen.add(trimmed);
  };

  addHighlight(context.focus);

  const venue = formatLocation(game);
  if (venue) {
    addHighlight(`Venue spotlight: ${venue}`);
  }

  addHighlight(game?.seriesText || game?.subLabel);
  addHighlight('Rotation battles highlight spacing tweaks and new signings.');

  return highlights.slice(0, 3);
}

function renderSpotlightItinerary(scheduleData) {
  const feature = document.querySelector('[data-itinerary-feature]');
  const list = document.querySelector('[data-itinerary-list]');
  const footnote = document.querySelector('[data-itinerary-footnote]');
  if (!feature && !list && !footnote) {
    return;
  }

  const scheduleAvailable = Boolean(scheduleData);
  const teamLookup = scheduleAvailable ? createTeamLookup(scheduleData) : new Map();
  const seasonStartYear = scheduleAvailable && scheduleData?.dateRange?.start
    ? new Date(scheduleData.dateRange.start).getFullYear()
    : null;
  const gamesSource = scheduleAvailable && Array.isArray(scheduleData?.specialGames) ? scheduleData.specialGames : [];
  const preseasonGames = gamesSource
    .filter((game) => `${game?.label ?? ''} ${game?.subLabel ?? ''}`.toLowerCase().includes('preseason'))
    .map((game) => ({ ...game, parsedDate: game?.date ? new Date(game.date) : null }))
    .filter((game) => game.parsedDate instanceof Date && !Number.isNaN(game.parsedDate.getTime()))
    .filter((game) => (seasonStartYear !== null ? game.parsedDate.getFullYear() === seasonStartYear : true))
    .sort((a, b) => a.parsedDate - b.parsedDate);

  if (feature) {
    feature.innerHTML = '';
    if (!preseasonGames.length) {
      const placeholder = document.createElement('p');
      placeholder.className = 'spotlight-itinerary__placeholder';
      placeholder.textContent = 'Feature matchup arrives once the preseason manifest is finalized.';
      feature.appendChild(placeholder);
    } else {
      const headliner = preseasonGames[0];
      const context = deriveItineraryContext(headliner);
      const header = document.createElement('header');
      header.className = 'itinerary-feature__header';

      const tag = document.createElement('span');
      tag.className = 'itinerary-feature__tag';
      tag.textContent = context.tag;

      const date = document.createElement('time');
      date.className = 'itinerary-feature__date';
      if (headliner.date) {
        date.dateTime = headliner.date;
        date.textContent = formatDateLabel(headliner.date, { weekday: 'short', month: 'short', day: 'numeric' });
      } else {
        date.textContent = 'Date to be announced';
      }

      const matchup = document.createElement('h3');
      matchup.className = 'itinerary-feature__matchup';
      matchup.textContent = formatMatchup(headliner, teamLookup) || 'Preseason showcase';

      const subtitle = document.createElement('p');
      subtitle.className = 'itinerary-feature__subtitle';
      subtitle.textContent = headliner?.subLabel || headliner?.seriesText || 'Flagship preseason tilt';

      const location = document.createElement('p');
      location.className = 'itinerary-feature__location';
      location.textContent = formatLocation(headliner) || 'Neutral site';

      header.append(tag, date, matchup, subtitle, location);

      const highlightList = document.createElement('ul');
      highlightList.className = 'itinerary-feature__highlights';
      buildItineraryHighlights(headliner, context).forEach((highlight) => {
        const item = document.createElement('li');
        item.textContent = highlight;
        highlightList.appendChild(item);
      });

      feature.append(header, highlightList);
    }
  }

  if (list) {
    list.innerHTML = '';
    if (!preseasonGames.length) {
      const placeholder = document.createElement('li');
      placeholder.className = 'itinerary-list__placeholder';
      placeholder.textContent = 'Preseason manifest pending league release.';
      list.appendChild(placeholder);
    } else {
      preseasonGames.slice(0, 8).forEach((game) => {
        const context = deriveItineraryContext(game);
        const item = document.createElement('li');
        item.className = 'itinerary-list__item';

        const date = document.createElement('time');
        date.className = 'itinerary-list__date';
        if (game.date) {
          date.dateTime = game.date;
          date.textContent = formatDateLabel(game.date, { month: 'short', day: 'numeric' });
        } else {
          date.textContent = 'TBD';
        }

        const body = document.createElement('div');
        body.className = 'itinerary-list__body';

        const tag = document.createElement('span');
        tag.className = 'itinerary-list__tag';
        tag.textContent = context.tag;

        const matchup = document.createElement('p');
        matchup.className = 'itinerary-list__matchup';
        matchup.textContent = formatMatchup(game, teamLookup) || 'Preseason showcase';

        const detail = document.createElement('p');
        detail.className = 'itinerary-list__detail';
        detail.textContent = game?.subLabel || game?.seriesText || 'Rotation checkup';

        const location = document.createElement('p');
        location.className = 'itinerary-list__location';
        location.textContent = formatLocation(game) || 'Neutral site';

        body.append(tag, matchup, detail, location);
        item.append(date, body);
        list.appendChild(item);
      });
    }
  }

  if (footnote) {
    if (preseasonGames.length) {
      const total = scheduleAvailable ? scheduleData?.totals?.preseason ?? preseasonGames.length : preseasonGames.length;
      footnote.textContent = `Total preseason exhibitions logged: ${helpers.formatNumber(total, 0)} leaguewide — itinerary updates as slates finalize.`;
    } else {
      footnote.textContent = 'League preseason slate is still syncing — check back once the manifest locks.';
    }
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

  const [scheduleData, teamData, storyData] = await Promise.all([
    fetchJsonSafe(scheduleSource),
    fetchJsonSafe('data/team_performance.json'),
    fetchJsonSafe('data/storytelling_walkthroughs.json'),
  ]);

  hydrateHero(teamData);
  renderSeasonLead(scheduleData);
  renderSpotlightItinerary(scheduleData);
  renderContenderGrid(teamData);
  renderBackToBack(scheduleData);
  renderStoryCards(storyData);
}

bootstrap();
