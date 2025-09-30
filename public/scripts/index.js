import { registerCharts, helpers } from './hub-charts.js';
import { enablePanZoom, enhanceUsaInsets } from './map-utils.js';
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
    team: 'Oklahoma City Thunder',
    tier: 'Title inner circle',
    note: 'Returning champs, core intact, minimal regression risk. Their young pieces (Holmgren, Jalen Williams) should still ascend. Biggest threat: health and complacency.',
  },
  {
    team: 'Cleveland Cavaliers',
    tier: 'Title inner circle',
    note: 'Deep, well-coached, with high expectations in the East. If defense tightens and fewer lapses, they’re a real contender.',
  },
  {
    team: 'Houston Rockets',
    tier: 'Title inner circle',
    note: 'The Kevin Durant trade is a statement. If the young core (Amen Thompson, Alperen Şengün, etc.) meshes with KD, this team could leap from sleeper to serious. Risk: chemistry, injuries, usage conflicts.',
  },
  {
    team: 'Denver Nuggets',
    tier: 'Title inner circle',
    note: 'Coaching change is a red flag, but the talent base is solid. They’ll likely still be in the upper tier unless the transition is rocky.',
  },
  {
    team: 'New York Knicks',
    tier: 'Title inner circle',
    note: 'Smart offseason additions, and a new coach in Mike Brown will try to raise consistency. They need to avoid dips vs. more shakeouts in rotation.',
  },
  {
    team: 'Minnesota Timberwolves',
    tier: 'Contender lane',
    note: 'On paper, they have a ceiling that scares teams. If Jarrett Culver / their supporting cast rise and they keep health, they threaten.',
  },
  {
    team: 'Orlando Magic',
    tier: 'Contender lane',
    note: 'Young, improving, and with upside. They might not have the star power to dominate yet, but can surprise mid-tier teams.',
  },
  {
    team: 'Los Angeles Lakers',
    tier: 'Contender lane',
    note: 'LeBron + Dončić is tantalizing, but building depth and managing roles is critical. If those things click, this is a dangerous team.',
  },
  {
    team: 'LA Clippers',
    tier: 'Contender lane',
    note: 'Veteran-laden, win-now mentality. If health holds (especially on wings, bigs), they compete. Risk: lack of spacing, aging roster.',
  },
  {
    team: 'Detroit Pistons',
    tier: 'Contender lane',
    note: 'They surprised last season. I expect them to keep pushing upward, maybe a play-in lock. Key: stability, role clarity, avoiding regression.',
  },
  {
    team: 'Golden State Warriors',
    tier: 'Playoff battleground',
    note: 'Aging core, but with creative lineups they still have dangerous weapons. They’ll need to leverage shooting, basketball IQ, and avoid injury.',
  },
  {
    team: 'Atlanta Hawks',
    tier: 'Playoff battleground',
    note: 'Re-tooling around Trae Young; defensively they must improve. If they shore that up, they move upward; if not, they’ll hover.',
  },
  {
    team: 'San Antonio Spurs',
    tier: 'Playoff battleground',
    note: 'Wembanyama is the long-term beacon; in 2025-26, they have some upside but inconsistencies. They’ll be volatile.',
  },
  {
    team: 'Milwaukee Bucks',
    tier: 'Playoff battleground',
    note: 'Still dangerous. They have to balance veteran retention and transitions. Could overperform if role players deliver.',
  },
  {
    team: 'Memphis Grizzlies',
    tier: 'Playoff battleground',
    note: 'Talent is there, but injuries and consistency always loom. Expect them to be around the fringe of contention.',
  },
  {
    team: 'Miami Heat',
    tier: 'Wild card tier',
    note: 'Strong culture, good coaching. They’re not likely to dominate, but they’ll be scrappy — could be a dark horse for surprises.',
  },
  {
    team: 'Dallas Mavericks',
    tier: 'Wild card tier',
    note: 'They have star power, but questions on spacing, backup plan, and defensive cohesiveness. If key players step up, they swing mid-tier.',
  },
  {
    team: 'Boston Celtics',
    tier: 'Wild card tier',
    note: 'After injuries and roster turnover, they may tread water or dip slightly. They still have enough to be dangerous in spurts.',
  },
  {
    team: 'Indiana Pacers',
    tier: 'Wild card tier',
    note: 'The Haliburton injury looms large. If he recovers well and the supporting cast fills gaps, they can be in a fight. But there’s downside.',
  },
  {
    team: 'Chicago Bulls',
    tier: 'Wild card tier',
    note: 'Too many variables. Talent exists, but consistency and top-tier two-way play must emerge or they’ll stagnate.',
  },
  {
    team: 'Sacramento Kings',
    tier: 'Development stretch',
    note: 'Some intriguing pieces and scoring ability, but defense, depth, and consistency are big questions. They’ll live or die by variance.',
  },
  {
    team: 'Phoenix Suns',
    tier: 'Development stretch',
    note: 'After trading away key names, this is a retooling season. Young players must step up; they may compete for a play-in spot if things go well.',
  },
  {
    team: 'Toronto Raptors',
    tier: 'Development stretch',
    note: 'They’re likely between phases. Solid organization, but lacking a breakout edge. Could surprise occasionally.',
  },
  {
    team: 'Philadelphia 76ers',
    tier: 'Development stretch',
    note: 'Injuries, aging stars, and fit problems make this a risky season. If pockets of uptime are strong, they’ll push, but I lean down.',
  },
  {
    team: 'Portland Trail Blazers',
    tier: 'Development stretch',
    note: 'Emphasis on defense is encouraging, but their roster still has weak spots, especially offensively. Likely in lottery/desperation mode.',
  },
  {
    team: 'New Orleans Pelicans',
    tier: 'Rebuild runway',
    note: 'Health, direction, and roster coherence are big doubts. They might win spurts but expect regression if key parts don’t stay consistent.',
  },
  {
    team: 'Charlotte Hornets',
    tier: 'Rebuild runway',
    note: 'Young team, under construction. Upside through growth, but likely overwhelmed by more experienced squads.',
  },
  {
    team: 'Utah Jazz',
    tier: 'Rebuild runway',
    note: 'They’ve shed veterans; big question: can youth and new acquisitions keep them competitive? I expect losses more than surprises.',
  },
  {
    team: 'Brooklyn Nets',
    tier: 'Rebuild runway',
    note: 'In full rebuild mode with many draft picks. They might show flashes, but overall they’ll struggle consistency & defense.',
  },
  {
    team: 'Washington Wizards',
    tier: 'Rebuild runway',
    note: 'Some young core pieces exist, but the rest of the roster lacks depth and star impact. They’ll likely be at or near bottom unless things break favorably.',
  },
];
let pacePressureDeck = [];
let pacePressureMeta = null;

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

async function fetchTextSafe(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.warn('Unable to fetch text asset', url, error);
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

const MAP_WIDTH = 960;
const MAP_HEIGHT = 600;
const LAT_RANGE = [24, 50];
const LON_RANGE = [-125, -66];
const CONFERENCE_CLASSES = { East: 'east', West: 'west' };
const CONFERENCE_LABELS = { East: 'Eastern Conference', West: 'Western Conference' };

const preseasonMapCanvas = document.querySelector('[data-preseason-map]');
const preseasonPanel = document.querySelector('[data-preseason-panel]');
const preseasonPlaceholder = document.querySelector('[data-preseason-placeholder]');
const preseasonCard = document.querySelector('[data-preseason-card]');
const preseasonHeading = document.querySelector('[data-preseason-heading]');
const preseasonConference = document.querySelector('[data-preseason-conference]');
const preseasonStatus = document.querySelector('[data-preseason-status]');
const preseasonScoreline = document.querySelector('[data-preseason-scoreline]');
const preseasonIntro = document.querySelector('[data-preseason-intro]');
const preseasonCore = document.querySelector('[data-preseason-core]');
const preseasonRisk = document.querySelector('[data-preseason-risk]');
const preseasonSwing = document.querySelector('[data-preseason-swing]');
const preseasonSeason = document.querySelector('[data-preseason-season]');
const preseasonLink = document.querySelector('[data-preseason-link]');

let preseasonMapViewport = null;
let preseasonMarkers = [];
let preseasonTeamLookup = new Map();
let preseasonPreviewLookup = new Map();

function projectPreseasonCoordinates(latitude, longitude) {
  const x = ((longitude - LON_RANGE[0]) / (LON_RANGE[1] - LON_RANGE[0])) * MAP_WIDTH;
  const y = ((LAT_RANGE[1] - latitude) / (LAT_RANGE[1] - LAT_RANGE[0])) * MAP_HEIGHT;
  return { x, y };
}

function clearElement(element) {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function formatConferenceLabel(value) {
  return CONFERENCE_LABELS[value] ?? '';
}

function setPreseasonPanelState(selected) {
  if (!preseasonPanel) return;
  if (selected) {
    preseasonPanel.setAttribute('data-state', 'active');
    if (preseasonPlaceholder) {
      preseasonPlaceholder.hidden = true;
    }
    if (preseasonCard) {
      preseasonCard.hidden = false;
    }
  } else {
    preseasonPanel.setAttribute('data-state', 'idle');
    if (preseasonPlaceholder) {
      preseasonPlaceholder.hidden = false;
    }
    if (preseasonCard) {
      preseasonCard.hidden = true;
    }
  }
}

function activatePreseasonMarker(tricode) {
  preseasonMarkers.forEach((marker) => {
    if (marker.dataset.team === tricode) {
      marker.classList.add('team-marker--active');
    } else {
      marker.classList.remove('team-marker--active');
    }
  });
}

function renderPreseasonDetail(team, preview) {
  if (!team || !preview) {
    setPreseasonPanelState(false);
    return;
  }

  setPreseasonPanelState(true);

  if (preseasonHeading) {
    preseasonHeading.textContent = preview.heading ?? team.name ?? 'Team';
  }

  if (preseasonConference) {
    const conferenceLabel = formatConferenceLabel(team.conference);
    preseasonConference.textContent = conferenceLabel;
    preseasonConference.hidden = !conferenceLabel;
  }

  if (preseasonStatus) {
    const status = preview.ranking?.statusLine ?? '';
    preseasonStatus.textContent = status;
    preseasonStatus.hidden = !status;
  }

  if (preseasonScoreline) {
    const hasRanking =
      preview.ranking &&
      Number.isFinite(preview.ranking.rank) &&
      Number.isFinite(preview.ranking.score);
    if (hasRanking) {
      const formattedScore = preview.ranking.score.toFixed(3);
      preseasonScoreline.textContent = `#${preview.ranking.rank} · Conviction score ${formattedScore}`;
      preseasonScoreline.hidden = false;
    } else {
      preseasonScoreline.textContent = '';
      preseasonScoreline.hidden = true;
    }
  }

  if (preseasonIntro) {
    clearElement(preseasonIntro);
    const paragraphs = Array.isArray(preview.introParagraphs) ? preview.introParagraphs : [];
    paragraphs.forEach((paragraph) => {
      const p = document.createElement('p');
      p.textContent = paragraph;
      preseasonIntro.appendChild(p);
    });
  }

  if (preseasonCore) {
    preseasonCore.textContent = preview.coreStrength ?? '';
  }

  if (preseasonRisk) {
    preseasonRisk.textContent = preview.primaryRisk ?? '';
  }

  if (preseasonSwing) {
    preseasonSwing.textContent = preview.swingFactor ?? '';
  }

  if (preseasonSeason) {
    const label = preview.seasonLabel ? `${preview.seasonLabel} preseason outlook` : 'Preseason outlook';
    preseasonSeason.textContent = `${label} layered on the 2024-25 baseline.`;
  }

  if (preseasonLink) {
    const target = preview.tricode ?? team.abbreviation;
    preseasonLink.href = target ? `../site/previews/${target}.html` : '#';
    preseasonLink.setAttribute('aria-label', `Open full preseason outlook for ${preview.heading ?? team.name ?? 'team'}`);
  }
}

function handlePreseasonMarkerClick(event) {
  const button = event.currentTarget;
  if (!(button instanceof HTMLElement)) {
    return;
  }
  const tricode = button.dataset.team;
  if (!tricode) {
    return;
  }
  const team = preseasonTeamLookup.get(tricode);
  const preview = preseasonPreviewLookup.get(tricode);
  activatePreseasonMarker(tricode);
  renderPreseasonDetail(team, preview);
}

function buildPreseasonMarkers(teams) {
  if (!preseasonMapCanvas || !preseasonMapViewport) {
    return;
  }

  const existingLayers = preseasonMapViewport.querySelectorAll('.team-map__markers');
  existingLayers.forEach((layer) => layer.remove());

  const markerLayer = document.createElement('div');
  markerLayer.className = 'team-map__markers';
  preseasonMapViewport.append(markerLayer);

  preseasonMarkers = teams
    .filter((team) => preseasonPreviewLookup.has(team.abbreviation))
    .map((team) => {
      const { latitude, longitude, abbreviation, conference, name } = team;
      const { x, y } = projectPreseasonCoordinates(latitude, longitude);
      const button = document.createElement('button');
      button.type = 'button';
      const markerTheme = CONFERENCE_CLASSES[conference] ?? 'east';
      button.className = `team-marker team-marker--${markerTheme}`;
      button.style.setProperty('--marker-x', `${(x / MAP_WIDTH) * 100}%`);
      button.style.setProperty('--marker-y', `${(y / MAP_HEIGHT) * 100}%`);
      button.dataset.team = abbreviation;
      const ariaLabel = [name, formatConferenceLabel(conference)].filter(Boolean).join(', ');
      if (ariaLabel) {
        button.setAttribute('aria-label', ariaLabel);
      }
      button.innerHTML = `
        <span class="team-marker__dot" aria-hidden="true"></span>
        <span class="team-marker__label">${abbreviation}</span>
      `;
      button.addEventListener('click', handlePreseasonMarkerClick);
      markerLayer.append(button);
      return button;
    });
}

function injectPreseasonMap(svgMarkup) {
  if (!preseasonMapCanvas) {
    return;
  }

  const sanitized = svgMarkup.replace(/ns0:/g, '');
  preseasonMapCanvas.innerHTML = `<div class="team-map__viewport"><div class="team-map__stage">${sanitized}</div></div>`;
  preseasonMapViewport = preseasonMapCanvas.querySelector('.team-map__viewport');
  const svg = preseasonMapCanvas.querySelector('svg');
  if (svg) {
    svg.classList.add('team-map__svg');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    enhanceUsaInsets(svg);
  }
  if (preseasonMapViewport) {
    enablePanZoom(preseasonMapCanvas, preseasonMapViewport, { maxScale: 5.5, zoomStep: 0.35 });
  }
}

async function renderPreseasonMap() {
  if (!preseasonMapCanvas) {
    return;
  }

  if (preseasonPanel) {
    preseasonPanel.setAttribute('aria-busy', 'true');
  }

  try {
    const [svgMarkup, teamProfiles, previewData] = await Promise.all([
      fetchTextSafe('vendor/us-states.svg'),
      fetchJsonSafe('data/team_profiles.json'),
      fetchJsonSafe('data/preseason_team_previews.json'),
    ]);

    if (!svgMarkup || !teamProfiles || !previewData) {
      throw new Error('Missing preseason map assets');
    }

    const teams = Array.isArray(teamProfiles?.teams) ? teamProfiles.teams : [];
    const previews = Array.isArray(previewData?.previews) ? previewData.previews : [];

    if (!teams.length || !previews.length) {
      throw new Error('Incomplete preseason datasets');
    }

    preseasonTeamLookup = new Map(teams.map((team) => [team.abbreviation, team]));
    preseasonPreviewLookup = new Map(previews.map((entry) => [entry.tricode, entry]));

    injectPreseasonMap(svgMarkup);
    buildPreseasonMarkers(teams);
    setPreseasonPanelState(false);
  } catch (error) {
    console.error('Unable to render preseason map', error);
    if (preseasonMapCanvas) {
      preseasonMapCanvas.innerHTML =
        '<p class="team-map__error">Unable to load the preseason map right now. Please refresh to try again.</p>';
    }
    if (preseasonPlaceholder) {
      preseasonPlaceholder.innerHTML =
        '<p class="preseason-map__error">We couldn\'t load the preseason capsules. Try refreshing the page.</p>';
    }
  } finally {
    if (preseasonPanel) {
      preseasonPanel.setAttribute('aria-busy', 'false');
    }
  }
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

  const rawGames = Array.isArray(openersData?.games) ? openersData.games.slice() : [];
  const games = groupPreseasonGames(rawGames);
  games.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
    const dateB = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
    if (Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) {
      return dateA - dateB;
    }
    if (Number.isFinite(dateA) && !Number.isFinite(dateB)) {
      return -1;
    }
    if (!Number.isFinite(dateA) && Number.isFinite(dateB)) {
      return 1;
    }
    const [aHome] = getDisplayParticipants(a);
    const [bHome] = getDisplayParticipants(b);
    return (aHome?.name ?? '').localeCompare(bHome?.name ?? '');
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
        const hasPreview = Boolean(game.gameId);
        const item = document.createElement('li');
        item.className = 'tour-board__item';

        const card = document.createElement(hasPreview ? 'a' : 'div');
        card.className = 'tour-board__link';

        const participants = Array.isArray(game.participants) ? game.participants : [];
        const homeParticipant = participants.find((participant) => participant.homeAway === 'home') || null;
        const roadParticipant = participants.find((participant) => participant.homeAway === 'away') || null;
        const [displayHome, displayRoad] = getDisplayParticipants(game);
        const matchupLabel = [displayHome?.name, displayRoad?.name].filter(Boolean).join(' vs. ');

        if (hasPreview) {
          const previewId = String(game.gameId || '').toLowerCase();
          card.href = `previews/preseason-${previewId}.html`;
          card.setAttribute(
            'aria-label',
            `${matchupLabel || 'Preseason opener'} preseason opener preview`,
          );
        } else {
          card.setAttribute('aria-label', `${matchupLabel || 'Preseason opener'} details pending`);
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
        if (homeParticipant?.name) {
          const hostLabel = homeParticipant.abbreviation || homeParticipant.name;
          tag.textContent = `Home: ${hostLabel}`;
        } else if (roadParticipant?.name) {
          const visitorLabel = roadParticipant.abbreviation || roadParticipant.name;
          tag.textContent = `Road: ${visitorLabel}`;
        } else {
          tag.textContent = 'Matchup pending';
        }
        marker.appendChild(tag);

        const identity = document.createElement('div');
        identity.className = 'tour-board__identity';

        const matchup = document.createElement('div');
        matchup.className = 'tour-board__matchup';

        const homeNode = createTourTeamNode(displayHome, 'Preseason opener');
        matchup.appendChild(homeNode);

        const divider = document.createElement('span');
        divider.className = 'tour-board__matchup-divider';
        divider.textContent = 'vs.';
        matchup.appendChild(divider);

        const roadNode = createTourTeamNode(displayRoad, 'Opponent TBA');
        matchup.appendChild(roadNode);

        identity.appendChild(matchup);

        const body = document.createElement('div');
        body.className = 'tour-board__body';
        body.appendChild(identity);

        const note = document.createElement('p');
        note.className = 'tour-board__note';
        const label = (game.label ?? '').trim();
        const labelText = label ? label : 'Preseason opener';
        note.textContent = labelText;

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

function createTourTeamNode(team, fallbackText) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tour-board__team';

  const name = team?.name ?? fallbackText;
  if (team?.name) {
    wrapper.appendChild(createTeamLogo(team.name, 'team-logo team-logo--small'));
  }

  const label = document.createElement('h3');
  label.className = 'tour-board__team-name';
  label.textContent = name ?? 'TBD';
  wrapper.appendChild(label);

  return wrapper;
}

function getDisplayParticipants(game) {
  const participants = Array.isArray(game?.participants) ? game.participants : [];
  const home = participants.find((participant) => participant.homeAway === 'home') || null;
  const road = participants.find((participant) => participant.homeAway === 'away' && participant !== home) || null;
  if (home && road) {
    return [home, road];
  }
  const fallbacks = participants.filter((participant) => participant !== home && participant !== road);
  const first = home || fallbacks[0] || road || null;
  const second = road || fallbacks.find((participant) => participant !== first) || null;
  return [first, second];
}

function groupPreseasonGames(games) {
  const map = new Map();

  games.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }

    const participants = [
      entry.teamId || entry.teamName || '',
      entry.opponentId || entry.opponentName || '',
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join('|');

    const key = [entry.gameId, entry.date, participants, entry.arena, entry.city, entry.state]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
      .join('::');

    const fallbackKey = key || `${entry.teamName ?? ''}::${entry.opponentName ?? ''}::${entry.date ?? ''}`;
    const bucketKey = fallbackKey.toLowerCase();
    let bucket = map.get(bucketKey);
    if (!bucket) {
      bucket = {
        gameId: entry.gameId ?? null,
        date: entry.date ?? null,
        arena: entry.arena ?? '',
        city: entry.city ?? '',
        state: entry.state ?? '',
        label: entry.label ?? '',
        participantsMap: new Map(),
      };
      map.set(bucketKey, bucket);
    } else {
      if (!bucket.gameId && entry.gameId) {
        bucket.gameId = entry.gameId;
      }
      if (!bucket.date && entry.date) {
        bucket.date = entry.date;
      }
      if (!bucket.arena && entry.arena) {
        bucket.arena = entry.arena;
      }
      if (!bucket.city && entry.city) {
        bucket.city = entry.city;
      }
      if (!bucket.state && entry.state) {
        bucket.state = entry.state;
      }
      if (!bucket.label && entry.label) {
        bucket.label = entry.label;
      }
    }

    addParticipantToBucket(bucket, {
      id: entry.teamId ?? null,
      name: entry.teamName ?? null,
      abbreviation: entry.teamAbbreviation ?? null,
    }, entry.homeAway === 'home' ? 'home' : entry.homeAway === 'away' ? 'away' : null);

    const opponentRole = entry.homeAway === 'home' ? 'away' : entry.homeAway === 'away' ? 'home' : null;
    addParticipantToBucket(
      bucket,
      {
        id: entry.opponentId ?? null,
        name: entry.opponentName ?? null,
        abbreviation: entry.opponentAbbreviation ?? null,
      },
      opponentRole,
    );
  });

  return Array.from(map.values()).map((bucket) => {
    const participants = Array.from(bucket.participantsMap.values());
    return {
      gameId: bucket.gameId,
      date: bucket.date,
      arena: bucket.arena,
      city: bucket.city,
      state: bucket.state,
      label: bucket.label,
      participants,
    };
  });
}

function addParticipantToBucket(bucket, participant, role) {
  if (!participant?.name) {
    return;
  }

  const key = (participant.id ?? participant.name ?? '').toString().toLowerCase();
  const existing = bucket.participantsMap.get(key) ?? {
    id: participant.id ?? null,
    name: participant.name ?? null,
    abbreviation: participant.abbreviation ?? null,
    homeAway: null,
  };

  if (!existing.abbreviation && participant.abbreviation) {
    existing.abbreviation = participant.abbreviation;
  }

  if (role) {
    if (!existing.homeAway) {
      existing.homeAway = role;
    } else if (existing.homeAway !== role) {
      existing.homeAway = 'neutral';
    }
  }

  bucket.participantsMap.set(key, existing);
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

async function renderInjuryPulse() {
  const container = document.querySelector('[data-injury-report]');
  const footnote = document.querySelector('[data-injury-footnote]');
  if (!container) {
    return;
  }

  container.innerHTML = '';
  if (footnote) {
    footnote.textContent = '';
  }

  const loading = document.createElement('p');
  loading.className = 'injury-grid__placeholder';
  loading.textContent = 'Syncing the live injury feed...';
  container.appendChild(loading);

  const payload = await fetchJsonSafe('data/player_injuries.json');
  container.innerHTML = '';

  if (!payload || !Array.isArray(payload.items)) {
    const errorMessage = document.createElement('p');
    errorMessage.className = 'injury-grid__placeholder';
    errorMessage.textContent = 'Unable to load the live injury feed right now.';
    container.appendChild(errorMessage);
    if (footnote) {
      footnote.textContent = 'Injury feed temporarily unavailable.';
    }
    return;
  }

  const entries = payload.items.slice(0, 10);
  if (!entries.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'injury-grid__placeholder';
    placeholder.textContent = 'No current injury reports available.';
    container.appendChild(placeholder);
  } else {
    const allowedStatuses = new Set(['season', 'caution', 'monitor', 'ready']);

    entries.forEach((entry) => {
      const card = document.createElement('article');
      card.className = 'injury-card';

      const header = document.createElement('header');
      header.className = 'injury-card__header';

      const identity = document.createElement('div');
      identity.className = 'injury-card__identity';
      const teamIdentifier = entry.team_tricode || entry.team_name || '';
      identity.appendChild(createTeamLogo(teamIdentifier || 'NBA', 'team-logo team-logo--small'));

      const label = document.createElement('div');
      label.className = 'injury-card__label';
      const name = document.createElement('strong');
      name.textContent = entry.player || 'Unnamed player';
      label.appendChild(name);
      const teamText = entry.team_name || entry.team_tricode;
      if (teamText) {
        const team = document.createElement('span');
        team.textContent = teamText;
        label.appendChild(team);
      }
      identity.appendChild(label);
      header.appendChild(identity);

      const status = document.createElement('span');
      const level = typeof entry.status_level === 'string' ? entry.status_level.toLowerCase() : 'monitor';
      const safeLevel = allowedStatuses.has(level) ? level : 'monitor';
      status.className = `injury-card__status injury-card__status--${safeLevel}`;
      status.textContent = entry.status || 'Status unavailable';
      header.appendChild(status);

      card.appendChild(header);

      const metrics = document.createElement('dl');
      metrics.className = 'injury-card__metrics';

      const addMetric = (labelText, valueText) => {
        if (!labelText || !valueText) {
          return;
        }
        const row = document.createElement('div');
        row.className = 'injury-card__metric';
        const term = document.createElement('dt');
        term.textContent = labelText;
        const detail = document.createElement('dd');
        detail.textContent = valueText;
        row.append(term, detail);
        metrics.appendChild(row);
      };

      const reportLabel = (() => {
        if (typeof entry.report_label === 'string' && entry.report_label.trim()) {
          return entry.report_label.trim();
        }
        if (typeof entry.last_updated === 'string') {
          const formatted = formatDateLabel(entry.last_updated, { month: 'short', day: 'numeric' });
          if (formatted) {
            return formatted;
          }
        }
        return '';
      })();

      if (reportLabel) {
        addMetric('Report', reportLabel);
      }

      if (typeof entry.return_date === 'string' && entry.return_date.trim()) {
        addMetric('Return', entry.return_date.trim());
      }

      if (metrics.childElementCount) {
        card.appendChild(metrics);
      }

      if (typeof entry.description === 'string' && entry.description.trim()) {
        const note = document.createElement('p');
        note.className = 'injury-card__note';
        note.textContent = entry.description.trim();
        card.appendChild(note);
      }

      container.appendChild(card);
    });
  }

  const source = typeof payload.source === 'string' && payload.source.trim() ? payload.source.trim() : 'Live league data feed';
  const fetchedAt = typeof payload.fetched_at === 'string' ? payload.fetched_at : '';
  const sanitizedNote = (() => {
    if (typeof payload.note === 'string' && payload.note.trim()) {
      return payload.note.replace(/Ball Don't Lie/gi, 'live league injury feed').trim();
    }
    return '';
  })();
  let footnoteText = sanitizedNote || `Source: ${source} injury feed.`;
  if (fetchedAt) {
    const fetchedDate = new Date(fetchedAt);
    if (!Number.isNaN(fetchedDate.getTime())) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
      });
      footnoteText = `${footnoteText} Updated ${formatter.format(fetchedDate)} UTC.`;
    }
  }
  if (footnote) {
    footnote.textContent = footnoteText;
  }
}

async function loadPacePressure() {
  try {
    const response = await fetch('data/pace_pressure.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load pace pressure deck: ${response.status}`);
    }
    const payload = await response.json();
    const parseFinite = (value) => {
      if (value === null || value === undefined) {
        return null;
      }
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };

    const teams = Array.isArray(payload?.teams) ? payload.teams : [];
    pacePressureDeck = teams
      .map((team) => {
        const paceProjection = parseFinite(team?.paceProjection);
        const tempoScore = parseFinite(team?.tempoScore);
        if (paceProjection === null || tempoScore === null) {
          return null;
        }
        const tempoDelta = parseFinite(team?.tempoDelta) ?? 0;
        const backToBacks = parseFinite(team?.backToBacks);
        const averageRestDays = parseFinite(team?.averageRestDays);
        const roadGames = parseFinite(team?.roadGames);
        const teamName =
          typeof team?.team === 'string' && team.team.trim()
            ? team.team.trim()
            : null;
        const tricodeCandidate =
          typeof team?.tricode === 'string' && team.tricode.trim()
            ? team.tricode.trim()
            : typeof team?.abbreviation === 'string' && team.abbreviation.trim()
            ? team.abbreviation.trim()
            : null;
        return {
          team: teamName ?? tricodeCandidate ?? 'Team',
          tricode: tricodeCandidate,
          paceProjection,
          tempoScore,
          tempoDelta,
          backToBacks,
          averageRestDays,
          roadGames,
          note: typeof team?.note === 'string' && team.note.trim() ? team.note.trim() : null,
        };
      })
      .filter((entry) => entry !== null);

    pacePressureMeta = {
      generatedAt: typeof payload?.generatedAt === 'string' ? payload.generatedAt : null,
      source:
        typeof payload?.source === 'string' && payload.source.trim()
          ? payload.source.trim()
          : "Ball Don't Lie",
      season:
        typeof payload?.season === 'string' && payload.season.trim()
          ? payload.season.trim()
          : '2024-25',
      sampleStartDate:
        typeof payload?.sampleStartDate === 'string' && payload.sampleStartDate.trim()
          ? payload.sampleStartDate.trim()
          : null,
      leagueAveragePace: parseFinite(payload?.leagueAveragePace),
    };
  } catch (error) {
    console.error('Failed to load pace pressure data', error);
    pacePressureDeck = [];
    pacePressureMeta = null;
  }
  renderPaceRadar();
}

function renderPaceRadar() {
  const list = document.querySelector('[data-pace-radar]');
  const footnote = document.querySelector('[data-pace-footnote]');
  if (!list) {
    return;
  }

  list.innerHTML = '';

  const deck = Array.isArray(pacePressureDeck) ? pacePressureDeck : [];

  if (!deck.length) {
    const placeholder = document.createElement('li');
    placeholder.className = 'tempo-gauge__placeholder';
    placeholder.textContent = 'Tempo telemetry syncing…';
    list.appendChild(placeholder);
  } else {
    deck.forEach((entry, index) => {
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
      identity.appendChild(createTeamLogo(entry.tricode ?? entry.team, 'team-logo team-logo--small'));
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
      const metaParts = [];
      if (Number.isFinite(entry.roadGames)) {
        metaParts.push(`Road games: ${helpers.formatNumber(entry.roadGames, 0)}`);
      }
      if (Number.isFinite(entry.backToBacks)) {
        metaParts.push(`Back-to-backs: ${helpers.formatNumber(entry.backToBacks, 0)}`);
      }
      if (Number.isFinite(entry.averageRestDays)) {
        metaParts.push(`Avg rest: ${helpers.formatNumber(entry.averageRestDays, 2)} days`);
      }
      meta.textContent = metaParts.join(' · ') || 'Schedule inputs syncing…';
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
    if (pacePressureMeta) {
      const { source, season, sampleStartDate, leagueAveragePace, generatedAt } = pacePressureMeta;
      const descriptorParts = [];
      if (sampleStartDate) {
        descriptorParts.push(`sample from ${sampleStartDate}`);
      }
      if (Number.isFinite(leagueAveragePace)) {
        descriptorParts.push(`league pace ${helpers.formatNumber(leagueAveragePace, 1)}`);
      }
      const baseLabel = `Source: ${source} ${season} tempo sample`;
      let footnoteText = descriptorParts.length
        ? `${baseLabel} — ${descriptorParts.join(' · ')}.`
        : `${baseLabel}.`;
      if (generatedAt) {
        const generatedDate = new Date(generatedAt);
        if (!Number.isNaN(generatedDate.getTime())) {
          const formatter = new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'UTC',
          });
          footnoteText = `${footnoteText} Updated ${formatter.format(generatedDate)} UTC.`;
        }
      }
      footnote.textContent = footnoteText;
    } else {
      footnote.textContent = 'Tempo pressure score normalizes 95-105 possessions per 48; the meter peaks when projections hit 105.';
    }
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
  renderPaceRadar();
  const [scheduleSource] = await Promise.all([resolveScheduleSource(), loadPacePressure()]);

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

  renderPreseasonMap();

  const [scheduleData, teamData, storyData, preseasonOpeners] = await Promise.all([
    fetchJsonSafe(scheduleSource),
    fetchJsonSafe('data/team_performance.json'),
    fetchJsonSafe('data/storytelling_walkthroughs.json'),
    fetchJsonSafe('data/preseason_openers.json'),
  ]);

  await renderInjuryPulse();
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
