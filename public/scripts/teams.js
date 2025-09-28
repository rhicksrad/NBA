const MAP_WIDTH = 960;
const MAP_HEIGHT = 600;
const LAT_RANGE = [24, 50];
const LON_RANGE = [-125, -66];
const CONFERENCE_CLASSES = {
  East: 'east',
  West: 'west',
};

const METRIC_CONFIG = [
  {
    key: 'winPct',
    label: 'Win percentage',
    description: 'Share of games won across the tracked 2024-25 sample.',
    format: (value) => `${(value * 100).toFixed(1)}%`,
  },
  {
    key: 'avgPointsFor',
    label: 'Points for',
    description: 'Average points scored per game.',
    format: (value) => value.toFixed(1),
  },
  {
    key: 'avgPointsAgainst',
    label: 'Points allowed',
    description: 'Average points conceded per game.',
    format: (value) => value.toFixed(1),
    inverse: true,
  },
  {
    key: 'netMargin',
    label: 'Net margin',
    description: 'Average scoring differential versus opponents.',
    format: (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`,
  },
  {
    key: 'fieldGoalPct',
    label: 'Field goal accuracy',
    description: 'Overall shooting efficiency from the floor.',
    format: (value) => `${(value * 100).toFixed(1)}%`,
  },
  {
    key: 'threePointPct',
    label: 'Three-point accuracy',
    description: 'Conversion rate on perimeter attempts.',
    format: (value) => `${(value * 100).toFixed(1)}%`,
  },
  {
    key: 'rebounds',
    label: 'Rebounds',
    description: 'Average total rebounds secured per night.',
    format: (value) => value.toFixed(1),
  },
  {
    key: 'assists',
    label: 'Assists',
    description: 'Average assists generated each game.',
    format: (value) => value.toFixed(1),
  },
  {
    key: 'turnovers',
    label: 'Turnovers',
    description: 'Average turnovers committed per outing (lower is stronger).',
    format: (value) => value.toFixed(1),
    inverse: true,
  },
  {
    key: 'pointsInPaint',
    label: 'Points in the paint',
    description: 'Interior scoring output per contest.',
    format: (value) => value.toFixed(1),
  },
  {
    key: 'fastBreakPoints',
    label: 'Fast-break points',
    description: 'Transition scoring per game.',
    format: (value) => value.toFixed(1),
  },
  {
    key: 'benchPoints',
    label: 'Bench points',
    description: 'Second-unit scoring production.',
    format: (value) => value.toFixed(1),
  },
];

const mapCanvas = document.querySelector('[data-map-canvas]');
const detailPanel = document.querySelector('[data-team-panel]');
const detailPlaceholder = document.querySelector('[data-team-placeholder]');
const detailBody = document.querySelector('[data-team-body]');
const detailConference = document.querySelector('[data-team-conference]');
const detailName = document.querySelector('[data-team-name]');
const detailMeta = document.querySelector('[data-team-meta]');
const detailGames = document.querySelector('[data-team-games]');
const detailRecord = document.querySelector('[data-team-record]');
const detailNet = document.querySelector('[data-team-net]');
const detailVisuals = document.querySelector('[data-team-visuals]');

let markerButtons = [];
let activeTeamId = null;
let metricExtents = {};
let teamLookup = new Map();

function projectCoordinates(latitude, longitude) {
  const x = ((longitude - LON_RANGE[0]) / (LON_RANGE[1] - LON_RANGE[0])) * MAP_WIDTH;
  const y = ((LAT_RANGE[1] - latitude) / (LAT_RANGE[1] - LAT_RANGE[0])) * MAP_HEIGHT;
  return { x, y };
}

function normaliseValue(value, { min, max }, inverse = false) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max === min) {
    return 0.5;
  }
  const clamped = (value - min) / (max - min);
  const ratio = Math.min(1, Math.max(0, clamped));
  return inverse ? 1 - ratio : ratio;
}

function clearActiveMarker() {
  markerButtons.forEach((button) => button.classList.remove('team-marker--active'));
}

function activateMarker(abbreviation) {
  clearActiveMarker();
  const activeButton = markerButtons.find((button) => button.dataset.team === abbreviation);
  if (activeButton) {
    activeButton.classList.add('team-marker--active');
    activeButton.focus({ preventScroll: true });
  }
}

function renderDetail(team) {
  if (!team) {
    detailBody?.setAttribute('hidden', '');
    detailPlaceholder?.removeAttribute('hidden');
    detailPanel?.setAttribute('aria-busy', 'false');
    return;
  }

  if (detailPlaceholder) {
    detailPlaceholder.setAttribute('hidden', '');
  }
  if (detailBody) {
    detailBody.removeAttribute('hidden');
  }

  if (detailPanel) {
    detailPanel.setAttribute('aria-busy', 'false');
  }

  const { conference, city, division, name, abbreviation, metrics, gamesSampled, wins, losses } = team;
  if (detailConference) {
    detailConference.textContent = `${conference} Conference`;
    detailConference.className = `team-detail__conference team-detail__conference--${CONFERENCE_CLASSES[conference] ?? 'east'}`;
  }
  if (detailName) {
    detailName.textContent = `${name} (${abbreviation})`;
  }
  if (detailMeta) {
    detailMeta.textContent = `${city} • ${division} Division`;
  }
  if (detailGames) {
    detailGames.textContent = gamesSampled.toLocaleString();
  }
  if (detailRecord) {
    detailRecord.textContent = `${wins}-${losses}`;
  }
  if (detailNet) {
    const net = metrics?.netMargin ?? 0;
    detailNet.textContent = `${net >= 0 ? '+' : ''}${net.toFixed(1)} per game`;
  }

  if (detailVisuals) {
    detailVisuals.innerHTML = '';
    METRIC_CONFIG.forEach((metric) => {
      const value = metrics?.[metric.key];
      if (!Number.isFinite(value)) {
        return;
      }
      const extent = metricExtents[metric.key];
      const progress = normaliseValue(value, extent ?? { min: 0, max: 1 }, Boolean(metric.inverse));
      const card = document.createElement('article');
      card.className = 'team-visual';
      card.innerHTML = `
        <header class="team-visual__header">
          <span class="team-visual__label">${metric.label}</span>
          <strong class="team-visual__value">${metric.format(value)}</strong>
        </header>
        <p class="team-visual__description">${metric.description}</p>
        <div class="team-visual__meter" role="presentation">
          <div class="team-visual__meter-track"></div>
          <div class="team-visual__meter-fill" style="--fill:${(progress * 100).toFixed(1)}%"></div>
        </div>
        <dl class="team-visual__range">
          <div>
            <dt>League low</dt>
            <dd>${metric.format(extent?.min ?? value)}</dd>
          </div>
          <div>
            <dt>League high</dt>
            <dd>${metric.format(extent?.max ?? value)}</dd>
          </div>
        </dl>
      `;
      detailVisuals.append(card);
    });
  }
}

function handleMarkerClick(event) {
  const button = event.currentTarget;
  if (!(button instanceof HTMLElement)) {
    return;
  }
  const abbreviation = button.dataset.team;
  if (!abbreviation || activeTeamId === abbreviation) {
    return;
  }
  const team = teamLookup.get(abbreviation);
  if (!team) {
    return;
  }
  activeTeamId = abbreviation;
  activateMarker(abbreviation);
  renderDetail(team);
}

function buildMarkers(teams) {
  if (!mapCanvas) return;

  const markerLayer = document.createElement('div');
  markerLayer.className = 'team-map__markers';
  mapCanvas.append(markerLayer);

  markerButtons = teams.map((team) => {
    const { latitude, longitude, abbreviation, conference, name } = team;
    const { x, y } = projectCoordinates(latitude, longitude);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `team-marker team-marker--${CONFERENCE_CLASSES[conference] ?? 'east'}`;
    button.style.setProperty('--marker-x', `${(x / MAP_WIDTH) * 100}%`);
    button.style.setProperty('--marker-y', `${(y / MAP_HEIGHT) * 100}%`);
    button.dataset.team = abbreviation;
    button.setAttribute('aria-label', `${name} (${conference} Conference)`);
    button.innerHTML = `
      <span class="team-marker__dot" aria-hidden="true"></span>
      <span class="team-marker__label">${abbreviation}</span>
    `;
    button.addEventListener('click', handleMarkerClick);
    markerLayer.append(button);
    return button;
  });
}

function computeExtents(teams) {
  metricExtents = METRIC_CONFIG.reduce((acc, metric) => {
    const values = teams
      .map((team) => team.metrics?.[metric.key])
      .filter((value) => Number.isFinite(value));
    if (!values.length) {
      acc[metric.key] = { min: 0, max: 1 };
      return acc;
    }
    acc[metric.key] = {
      min: Math.min(...values),
      max: Math.max(...values),
    };
    return acc;
  }, {});
}

function injectMap(svgMarkup) {
  if (!mapCanvas) return;
  const sanitized = svgMarkup.replace(/ns0:/g, '');
  mapCanvas.innerHTML = `<div class="team-map__stage">${sanitized}</div>`;
  const svg = mapCanvas.querySelector('svg');
  if (svg) {
    svg.classList.add('team-map__svg');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
  }
}

async function initialise() {
  if (!mapCanvas) return;
  try {
    if (detailPanel) {
      detailPanel.setAttribute('aria-busy', 'true');
    }
    const [svgResponse, teamsResponse] = await Promise.all([
      fetch('vendor/us-states.svg'),
      fetch('data/team_profiles.json'),
    ]);
    if (!svgResponse.ok || !teamsResponse.ok) {
      throw new Error('Network response was not ok');
    }
    const [svgMarkup, profileData] = await Promise.all([
      svgResponse.text(),
      teamsResponse.json(),
    ]);
    const teams = Array.isArray(profileData?.teams) ? profileData.teams : [];
    if (!teams.length) {
      throw new Error('No team data found');
    }

    teams.forEach((team) => {
      teamLookup.set(team.abbreviation, team);
    });

    computeExtents(teams);
    injectMap(svgMarkup);
    buildMarkers(teams);

    if (detailPanel) {
      detailPanel.setAttribute('aria-busy', 'false');
    }
  } catch (error) {
    if (mapCanvas) {
      mapCanvas.innerHTML = '<p class="team-map__error">Unable to load the map experience right now. Please refresh to try again.</p>';
    }
    if (detailPanel) {
      detailPanel.setAttribute('aria-busy', 'false');
    }
    console.error('Failed to initialise team explorer', error);
  }
}

initialise();
