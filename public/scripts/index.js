import { registerCharts, helpers } from './hub-charts.js';
import { createTeamLogo } from './team-logos.js';

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

const injuryAvailabilityPulse = [
  {
    team: 'Philadelphia 76ers',
    player: 'Joel Embiid',
    role: 'C · MVP 2024',
    statusLabel: 'Ramp-up',
    statusLevel: 'monitor',
    readiness: 68,
    timeline: 'Targeting Oct 23 vs. Bucks',
    impact: '+11.5 net swing on/off',
    note: 'Minute plan keeps Embiid near 28 per night through the first two weeks as his knee load scales.',
  },
  {
    team: 'Los Angeles Clippers',
    player: 'Kawhi Leonard',
    role: 'F · Playoff fulcrum',
    statusLabel: 'Clearance pending',
    statusLevel: 'caution',
    readiness: 54,
    timeline: 'Next evaluation Oct 18',
    impact: '+7.9 lineup net rating when active',
    note: 'Quad tendinopathy monitoring could scratch early back-to-backs; staff wants sub-32 minute nights until Thanksgiving.',
  },
  {
    team: 'Memphis Grizzlies',
    player: 'Ja Morant',
    role: 'G · Lead creator',
    statusLabel: 'Full go',
    statusLevel: 'ready',
    readiness: 82,
    timeline: 'Cleared for Oct 28 opener',
    impact: '+8.4 pace swing when on court',
    note: 'Memphis is leaning into five-out secondary breaks to keep Morant in downhill lanes without added collisions.',
  },
];

const projectedTempoLeaders = [
  {
    team: 'Indiana Pacers',
    tempoScore: 86,
    paceProjection: 102.9,
    tempoDelta: 3.6,
    travelMiles: 36450,
    backToBacks: 13,
    note: 'Opening 9 games in 14 nights with Siakam small-ball groups turbocharging drag screens and hit-ahead threes.',
  },
  {
    team: 'Sacramento Kings',
    tempoScore: 80,
    paceProjection: 101.7,
    tempoDelta: 2.8,
    travelMiles: 35200,
    backToBacks: 11,
    note: 'Rebuilt dribble handoff tree has Monk as co-pilot to goose early-clock triples and Fox rim pressure.',
  },
  {
    team: 'San Antonio Spurs',
    tempoScore: 74,
    paceProjection: 101.2,
    tempoDelta: 2.4,
    travelMiles: 38410,
    backToBacks: 15,
    note: 'Wembanyama-at-5 lineups push the ball off the glass; November road swing stress-tests their young guards.',
  },
];

const spacingExperimentDeck = [
  {
    team: 'Oklahoma City Thunder',
    spacingLift: 4.6,
    fiveOutFrequency: 0.48,
    threePointRate: 0.44,
    cornerThreeRate: 0.12,
    note: 'Holmgren trail threes plus Giddey short-roll reads put five-out spacing on nearly half their trips.',
  },
  {
    team: 'New York Knicks',
    spacingLift: 3.8,
    fiveOutFrequency: 0.37,
    threePointRate: 0.39,
    cornerThreeRate: 0.16,
    note: 'Brunson-Hartenstein delay actions bend defenses to the corners, juicing kickout volume for Donte and Mikal.',
  },
  {
    team: 'Orlando Magic',
    spacingLift: 3.2,
    fiveOutFrequency: 0.33,
    threePointRate: 0.36,
    cornerThreeRate: 0.19,
    note: 'Franz Wagner as a jumbo initiator lifts corner gravity while Suggs hammers relocation triples.',
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

function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(100, Math.max(0, numeric));
}

function formatDateLabel(dateString, options = { month: 'short', day: 'numeric' }) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('en-US', options).format(date);
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

    const teamLabel = entry.team ?? 'Team';

    const marker = document.createElement('span');
    marker.className = 'power-board__marker';
    marker.appendChild(createTeamLogo(teamLabel, 'team-logo team-logo--small'));

    const body = document.createElement('div');
    body.className = 'power-board__content';

    const identity = document.createElement('div');
    identity.className = 'power-board__identity';

    const rank = document.createElement('span');
    rank.className = 'power-board__rank';
    rank.textContent = `#${index + 1}`;

    const name = document.createElement('p');
    name.className = 'power-board__name';
    name.textContent = teamLabel;

    identity.append(rank, name);

    const note = document.createElement('p');
    note.className = 'power-board__note';
    note.textContent = entry.note;

    body.append(identity, note);

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

    body.append(meta);

    item.append(marker, body);
    list.appendChild(item);
  });
}

function formatTourVenue(entry) {
  const location = [entry?.city, entry?.state].filter(Boolean).join(', ');
  if (entry?.arena && location) {
    return `${entry.arena} · ${location}`;
  }
  if (entry?.arena) {
    return entry.arena;
  }
  return location || 'Venue TBA';
}

function renderPreseasonTour(openersData) {
  const list = document.querySelector('[data-tour-list]');
  const footnote = document.querySelector('[data-tour-footnote]');
  if (!list && !footnote) {
    return;
  }

  const games = Array.isArray(openersData?.games) ? openersData.games.slice() : [];
  games.sort((a, b) => {
    const dateA = a?.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
    const dateB = b?.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
    if (Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) {
      return dateA - dateB;
    }
    if (Number.isFinite(dateA) && !Number.isFinite(dateB)) {
      return -1;
    }
    if (!Number.isFinite(dateA) && Number.isFinite(dateB)) {
      return 1;
    }
    return (a?.teamName ?? '').localeCompare(b?.teamName ?? '');
  });

  if (list) {
    list.innerHTML = '';
    if (!games.length) {
      const placeholder = document.createElement('li');
      placeholder.className = 'tour-board__placeholder';
      placeholder.textContent = 'Preseason openers will populate once the league finalizes exhibition dates.';
      list.appendChild(placeholder);
    } else {
      games.forEach((game) => {
        const hasPreview = Boolean(game?.gameId);
        const item = document.createElement('li');
        item.className = 'tour-board__item';

        const card = document.createElement(hasPreview ? 'a' : 'div');
        card.className = 'tour-board__link';
        const teamLabel = game.teamName ?? 'Preseason opener';
        const opponentLabel = game.opponentName ?? 'TBD opponent';
        const homeAway = game.homeAway === 'home' ? 'home' : game.homeAway === 'away' ? 'away' : null;
        const matchupGlyph = homeAway === 'away' ? '@' : 'vs.';

        if (hasPreview) {
          card.href = `previews/preseason-${game.gameId}.html`;
          card.setAttribute('aria-label', `${teamLabel} ${matchupGlyph} ${opponentLabel} preseason opener preview`);
        } else {
          card.setAttribute('aria-label', `${teamLabel} preseason opener details pending`);
          card.setAttribute('role', 'group');
        }

        const date = document.createElement('time');
        date.className = 'tour-board__date';
        if (game.date) {
          date.dateTime = game.date;
          date.textContent = formatDateLabel(game.date, { month: 'short', day: 'numeric' });
        } else {
          date.textContent = 'TBD';
        }

        const marker = document.createElement('div');
        marker.className = 'tour-board__marker';
        marker.appendChild(date);

        const tag = document.createElement('span');
        tag.className = 'tour-board__tag';
        tag.textContent = homeAway === 'home' ? 'Home start' : homeAway === 'away' ? 'Road opener' : 'Tip-off pending';
        marker.appendChild(tag);

        const identity = document.createElement('div');
        identity.className = 'tour-board__identity';

        const team = document.createElement('div');
        team.className = 'tour-board__team';
        team.appendChild(createTeamLogo(teamLabel, 'team-logo team-logo--small'));
        const teamName = document.createElement('h3');
        teamName.className = 'tour-board__team-name';
        teamName.textContent = teamLabel;
        team.appendChild(teamName);
        identity.appendChild(team);

        const matchup = document.createElement('div');
        matchup.className = 'tour-board__matchup';
        if (game.opponentName) {
          const opponent = document.createElement('span');
          opponent.className = 'tour-board__opponent';
          opponent.appendChild(createTeamLogo(game.opponentName, 'team-logo team-logo--tiny'));
          const opponentLabel = document.createElement('span');
          opponentLabel.textContent = `${matchupGlyph} ${game.opponentName}`;
          opponent.appendChild(opponentLabel);
          matchup.appendChild(opponent);
        } else {
          matchup.textContent = 'Opponent TBA';
        }

        identity.appendChild(matchup);

        const body = document.createElement('div');
        body.className = 'tour-board__body';
        body.appendChild(identity);

        const note = document.createElement('p');
        note.className = 'tour-board__note';
        const label = (game?.label ?? '').trim();
        const labelText = label ? label : 'Preseason opener';
        note.textContent = `${labelText} · Preview hub coming soon.`;

        const venue = document.createElement('p');
        venue.className = 'tour-board__meta';
        venue.textContent = formatTourVenue(game);

        body.append(note, venue);

        card.append(marker, body);
        item.appendChild(card);
        list.appendChild(item);
      });
    }
  }

  if (footnote) {
    if (games.length) {
      const total = helpers.formatNumber(games.length, 0);
      const updatedRaw = openersData?.generatedAt ? new Date(openersData.generatedAt) : null;
      const updated = updatedRaw instanceof Date && !Number.isNaN(updatedRaw.getTime())
        ? new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'UTC',
            timeZoneName: 'short',
          }).format(updatedRaw)
        : 'recently';
      footnote.textContent = `${total} preseason openers logged — data refreshed ${updated}. Tap any row to explore its preview capsule.`;
    } else {
      footnote.textContent = 'Preseason openers populate after the league locks each exhibition tip.';
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

    const header = document.createElement('header');
    header.className = 'contender-card__header';
    const rank = document.createElement('span');
    rank.className = 'contender-card__rank';
    rank.textContent = String(index + 1);
    const identity = document.createElement('div');
    identity.className = 'contender-card__identity';
    const teamLabel = team.team ?? team.abbreviation ?? 'Team';
    identity.appendChild(createTeamLogo(teamLabel, 'team-logo team-logo--medium'));
    const name = document.createElement('h4');
    name.className = 'contender-card__team';
    name.textContent = teamLabel;
    identity.appendChild(name);
    header.append(rank, identity);

    const metrics = document.createElement('dl');
    metrics.className = 'contender-card__metrics';
    const addMetric = (label, value) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = label;
      const detail = document.createElement('dd');
      detail.textContent = value;
      row.append(term, detail);
      metrics.appendChild(row);
    };
    addMetric('Win rate', `${helpers.formatNumber((team.winPct ?? 0) * 100, 1)}%`);
    const margin = (team.pointsPerGame ?? 0) - (team.opponentPointsPerGame ?? 0);
    const marginLabel = `${margin >= 0 ? '+' : '–'}${helpers.formatNumber(Math.abs(margin), 1)}`;
    addMetric('Scoring margin', marginLabel);
    addMetric('Assist engine', `${helpers.formatNumber(team.assistsPerGame ?? 0, 1)} apg`);

    const note = document.createElement('p');
    note.className = 'contender-card__note';
    note.textContent = `${helpers.formatNumber(team.pointsPerGame ?? 0, 1)} points per night, ${helpers.formatNumber(
      team.opponentPointsPerGame ?? 0,
      1
    )} allowed.`;

    card.append(header, metrics, note);
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
      const identity = document.createElement('div');
      identity.className = 'rest-list__identity';
      const teamLabel = entry.name ?? entry.abbreviation ?? 'NBA';
      identity.appendChild(createTeamLogo(teamLabel, 'team-logo team-logo--small'));
      const team = document.createElement('p');
      team.className = 'rest-list__team';
      team.textContent = teamLabel;
      identity.appendChild(team);
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
      body.append(identity, meta, notes);
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

function renderInjuryPulse() {
  const container = document.querySelector('[data-injury-report]');
  const footnote = document.querySelector('[data-injury-footnote]');
  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (!injuryAvailabilityPulse.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'injury-grid__placeholder';
    placeholder.textContent = 'Injury board updates once medical reports finalize.';
    container.appendChild(placeholder);
  } else {
    injuryAvailabilityPulse.forEach((entry) => {
      const card = document.createElement('article');
      card.className = 'injury-card';

      const header = document.createElement('header');
      header.className = 'injury-card__header';

      const identity = document.createElement('div');
      identity.className = 'injury-card__identity';
      identity.appendChild(createTeamLogo(entry.team, 'team-logo team-logo--small'));

      const label = document.createElement('div');
      label.className = 'injury-card__label';
      const name = document.createElement('strong');
      name.textContent = entry.player;
      label.appendChild(name);
      if (entry.role) {
        const role = document.createElement('span');
        role.textContent = entry.role;
        label.appendChild(role);
      }
      identity.appendChild(label);
      header.appendChild(identity);

      if (entry.statusLabel) {
        const status = document.createElement('span');
        const level = entry.statusLevel === 'ready' || entry.statusLevel === 'monitor' || entry.statusLevel === 'caution'
          ? entry.statusLevel
          : 'monitor';
        status.className = `injury-card__status injury-card__status--${level}`;
        status.textContent = entry.statusLabel;
        header.appendChild(status);
      }

      card.appendChild(header);

      const metrics = document.createElement('dl');
      metrics.className = 'injury-card__metrics';

      const addMetric = (labelText, valueText) => {
        if (!labelText || !valueText) return;
        const row = document.createElement('div');
        row.className = 'injury-card__metric';
        const term = document.createElement('dt');
        term.textContent = labelText;
        const detail = document.createElement('dd');
        detail.textContent = valueText;
        row.append(term, detail);
        metrics.appendChild(row);
      };

      addMetric('Timeline', entry.timeline);
      addMetric('Impact', entry.impact);

      if (metrics.childElementCount) {
        card.appendChild(metrics);
      }

      const readiness = clampPercent(entry.readiness);
      const readinessBar = document.createElement('div');
      readinessBar.className = 'injury-card__readiness';
      readinessBar.style.setProperty('--fill', `${readiness}%`);
      card.appendChild(readinessBar);

      const readinessLabel = document.createElement('span');
      readinessLabel.className = 'injury-card__readiness-label';
      readinessLabel.textContent = `Readiness index: ${helpers.formatNumber(readiness, 0)} / 100`;
      card.appendChild(readinessLabel);

      if (entry.note) {
        const note = document.createElement('p');
        note.className = 'injury-card__note';
        note.textContent = entry.note;
        card.appendChild(note);
      }

      container.appendChild(card);
    });
  }

  if (footnote) {
    footnote.textContent = 'Readiness index blends ramp-up participation, travel tolerance, and medical reports—100 signals full go.';
  }
}

function renderPaceRadar() {
  const list = document.querySelector('[data-pace-radar]');
  const footnote = document.querySelector('[data-pace-footnote]');
  if (!list) {
    return;
  }

  list.innerHTML = '';

  if (!projectedTempoLeaders.length) {
    const placeholder = document.createElement('li');
    placeholder.className = 'tempo-gauge__placeholder';
    placeholder.textContent = 'Tempo board updates once schedule modeling completes.';
    list.appendChild(placeholder);
  } else {
    projectedTempoLeaders.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = 'tempo-gauge__item';

      const header = document.createElement('header');
      header.className = 'tempo-gauge__header';

      const rank = document.createElement('span');
      rank.className = 'tempo-gauge__rank';
      rank.textContent = String(index + 1);
      header.appendChild(rank);

      const identity = document.createElement('div');
      identity.className = 'tempo-gauge__identity';
      identity.appendChild(createTeamLogo(entry.team, 'team-logo team-logo--small'));
      const team = document.createElement('p');
      team.className = 'tempo-gauge__team';
      team.textContent = entry.team;
      identity.appendChild(team);
      header.appendChild(identity);

      const delta = Number(entry.tempoDelta) || 0;
      const tag = document.createElement('span');
      tag.className = `tempo-gauge__tag ${delta >= 2 ? 'tempo-gauge__tag--surge' : 'tempo-gauge__tag--steady'}`;
      tag.textContent = `${delta >= 0 ? '+' : '−'}${helpers.formatNumber(Math.abs(delta), 1)} possessions`;
      header.appendChild(tag);

      item.appendChild(header);

      const meter = document.createElement('div');
      meter.className = 'tempo-gauge__meter';
      meter.style.setProperty('--fill', `${clampPercent(entry.tempoScore)}%`);
      const meterLabel = document.createElement('span');
      meterLabel.textContent = `${helpers.formatNumber(entry.paceProjection, 1)} pace projection`;
      meter.appendChild(meterLabel);
      item.appendChild(meter);

      const meta = document.createElement('p');
      meta.className = 'tempo-gauge__meta';
      const travel = Number(entry.travelMiles) || 0;
      const miles = helpers.formatNumber(travel / 1000, 1);
      meta.textContent = `Road miles: ${miles}k · Back-to-backs: ${helpers.formatNumber(entry.backToBacks ?? 0, 0)}`;
      item.appendChild(meta);

      if (entry.note) {
        const note = document.createElement('p');
        note.className = 'tempo-gauge__note';
        note.textContent = entry.note;
        item.appendChild(note);
      }

      list.appendChild(item);
    });
  }

  if (footnote) {
    footnote.textContent = 'Tempo pressure score normalizes 95-105 possessions per 48; the meter peaks when projections hit 105.';
  }
}

function renderSpacingLab() {
  const lab = document.querySelector('[data-spacing-lab]');
  if (!lab) {
    return;
  }

  lab.innerHTML = '';

  if (!spacingExperimentDeck.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'spacing-lab__placeholder';
    placeholder.textContent = 'Spacing experiments post once tracking installs new shot-mapping layers.';
    lab.appendChild(placeholder);
    return;
  }

  spacingExperimentDeck.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'spacing-card';

    const header = document.createElement('header');
    header.className = 'spacing-card__header';

    const identity = document.createElement('div');
    identity.className = 'spacing-card__identity';
    identity.appendChild(createTeamLogo(entry.team, 'team-logo team-logo--small'));
    const team = document.createElement('p');
    team.className = 'spacing-card__team';
    team.textContent = entry.team;
    identity.appendChild(team);
    header.appendChild(identity);

    const lift = Number(entry.spacingLift) || 0;
    const tag = document.createElement('span');
    tag.className = 'spacing-card__tag';
    tag.textContent = `${lift >= 0 ? '+' : '−'}${helpers.formatNumber(Math.abs(lift), 1)} pts/100 lift`;
    header.appendChild(tag);

    card.appendChild(header);

    const metrics = document.createElement('dl');
    metrics.className = 'spacing-card__metrics';

    const addMetric = (labelText, percent, formatter) => {
      if (!labelText || !Number.isFinite(percent)) return;
      const row = document.createElement('div');
      row.className = 'spacing-card__metric';
      const term = document.createElement('dt');
      term.textContent = labelText;
      const detail = document.createElement('dd');
      const value = document.createElement('span');
      value.textContent = formatter(percent);
      const bar = document.createElement('span');
      bar.className = 'spacing-card__bar';
      bar.style.setProperty('--fill', `${clampPercent(percent * 100)}%`);
      detail.append(value, bar);
      row.append(term, detail);
      metrics.appendChild(row);
    };

    addMetric('Five-out frequency', Number(entry.fiveOutFrequency ?? 0), (value) => `${helpers.formatNumber(value * 100, 1)}% of trips`);
    addMetric('Projected 3P rate', Number(entry.threePointRate ?? 0), (value) => `${helpers.formatNumber(value * 100, 1)}% of FGA`);
    addMetric('Corner 3 share', Number(entry.cornerThreeRate ?? 0), (value) => `${helpers.formatNumber(value * 100, 1)}% of attempts`);

    card.appendChild(metrics);

    if (entry.note) {
      const note = document.createElement('p');
      note.className = 'spacing-card__note';
      note.textContent = entry.note;
      card.appendChild(note);
    }

    lab.appendChild(card);
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

  const [scheduleData, teamData, storyData, preseasonOpeners] = await Promise.all([
    fetchJsonSafe(scheduleSource),
    fetchJsonSafe('data/team_performance.json'),
    fetchJsonSafe('data/storytelling_walkthroughs.json'),
    fetchJsonSafe('data/preseason_openers.json'),
  ]);

  renderInjuryPulse();
  renderPaceRadar();
  renderSpacingLab();
  hydrateHero(teamData);
  renderSeasonLead(scheduleData);
  renderPreseasonTour(preseasonOpeners);
  renderContenderGrid(teamData);
  renderBackToBack(scheduleData);
  renderStoryCards(storyData);
}

bootstrap();
