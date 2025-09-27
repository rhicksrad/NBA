import { helpers } from './hub-charts.js';

const DATA_URL = 'data/storytelling_walkthroughs.json';
const LAB_DATA_URL = 'data/insights_lab.json';
const PANEL_ID = 'story-panel';

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

function formatMetric(entry) {
  if (!entry) return null;
  const { value, unit } = entry;
  if (typeof value === 'number') {
    const digits = Number.isInteger(value) ? 0 : 1;
    const formatted = helpers.formatNumber(value, digits);
    return unit ? `${formatted} ${unit}` : formatted;
  }
  if (typeof value === 'string') {
    return unit ? `${value} ${unit}` : value;
  }
  return unit || '';
}

function clearChildren(node) {
  if (!node) return;
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function createElement(tag, className, textContent) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (typeof textContent === 'string') {
    element.textContent = textContent;
  }
  return element;
}

function createStatusBadge(label) {
  const badge = createElement('span', 'status-badge', label || 'Planned');
  const status = (label || 'planned').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  badge.dataset.status = status;
  return badge;
}

function renderChangelog(container, entries) {
  if (!container) return;
  clearChildren(container);

  const items = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (!items.length) {
    container.appendChild(
      createElement(
        'p',
        'changelog__placeholder',
        'Changelog updates will appear once the next release ships.'
      )
    );
    return;
  }

  const list = createElement('ul', 'changelog__list');
  items
    .slice()
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : Number.NEGATIVE_INFINITY;
      const dateB = b.date ? new Date(b.date).getTime() : Number.NEGATIVE_INFINITY;
      return dateB - dateA;
    })
    .forEach((entry) => {
      const item = createElement('li', 'changelog__item');

      const header = createElement('div', 'changelog__header');
      if (entry.week) {
        header.appendChild(createElement('span', 'changelog__week', entry.week));
      }
      if (entry.date) {
        const dateLabel = createElement('time', 'changelog__date', formatDate(entry.date));
        dateLabel.dateTime = entry.date;
        header.appendChild(dateLabel);
      }
      if (entry.status) {
        header.appendChild(createStatusBadge(entry.status));
      }
      item.appendChild(header);

      if (entry.summary) {
        item.appendChild(createElement('p', 'changelog__summary', entry.summary));
      }

      const highlights = Array.isArray(entry.highlights) ? entry.highlights.filter(Boolean) : [];
      if (highlights.length) {
        const highlightList = createElement('ul', 'changelog__highlights');
        highlights.forEach((highlight) => {
          highlightList.appendChild(createElement('li', 'changelog__highlight', highlight));
        });
        item.appendChild(highlightList);
      }

      if (entry.owner) {
        const owner = createElement('p', 'changelog__owner');
        owner.appendChild(createElement('span', 'changelog__owner-label', 'Owner'));
        owner.appendChild(document.createTextNode(` · ${entry.owner}`));
        item.appendChild(owner);
      }

      list.appendChild(item);
    });

  container.appendChild(list);
}

function renderExperiments(container, experiments) {
  if (!container) return;
  clearChildren(container);

  const items = Array.isArray(experiments) ? experiments.filter(Boolean) : [];
  if (!items.length) {
    container.appendChild(
      createElement('article', 'card card--placeholder', 'New experiment briefs will be posted soon.')
    );
    return;
  }

  items.forEach((experiment) => {
    const card = createElement('article', 'card experiment-card');

    const topRow = createElement('div', 'experiment-card__meta');
    topRow.appendChild(createStatusBadge(experiment.status || 'Planned'));
    if (experiment.owner) {
      topRow.appendChild(createElement('span', 'experiment-card__owner', experiment.owner));
    }
    if (experiment.timeline) {
      topRow.appendChild(createElement('span', 'experiment-card__timeline', experiment.timeline));
    }
    card.appendChild(topRow);

    card.appendChild(
      createElement('h3', 'experiment-card__title', experiment.title || 'Untitled experiment')
    );

    if (experiment.summary) {
      card.appendChild(createElement('p', 'experiment-card__summary', experiment.summary));
    }

    const objectives = Array.isArray(experiment.objectives)
      ? experiment.objectives.filter(Boolean)
      : [];
    if (objectives.length) {
      const objectivesList = createElement('ul', 'experiment-card__objectives');
      objectives.forEach((objective) => {
        objectivesList.appendChild(createElement('li', null, objective));
      });
      card.appendChild(objectivesList);
    }

    const tags = Array.isArray(experiment.tags) ? experiment.tags.filter(Boolean) : [];
    if (tags.length) {
      const tagList = createElement('div', 'badge-list badge-list--compact');
      tags.forEach((tag) => {
        tagList.appendChild(createElement('span', 'badge', tag));
      });
      card.appendChild(tagList);
    }

    container.appendChild(card);
  });
}

function renderCollaborationTags(container, badges) {
  if (!container) return;
  clearChildren(container);

  const items = Array.isArray(badges) ? badges.filter(Boolean) : [];
  if (!items.length) {
    container.appendChild(createElement('span', 'badge badge--muted', 'Feedback welcome'));
    return;
  }

  items.forEach((badge) => {
    container.appendChild(createElement('span', 'badge', badge));
  });
}

function renderCollaboration(container, details) {
  if (!container) return;
  clearChildren(container);

  if (!details) {
    container.appendChild(
      createElement(
        'p',
        'collaboration-details__placeholder',
        'Collaboration schedule will post once the next sprint is confirmed.'
      )
    );
    return;
  }

  if (details.nextSync) {
    const next = createElement('p', 'collaboration-details__next');
    const label = createElement('strong', null, 'Next sync');
    next.appendChild(label);
    const nextText = formatDateTime(details.nextSync);
    const location = details.location ? ` · ${details.location}` : '';
    next.appendChild(document.createTextNode(` · ${nextText}${location}`));
    container.appendChild(next);
  }

  const agenda = Array.isArray(details.agenda) ? details.agenda.filter(Boolean) : [];
  if (agenda.length) {
    container.appendChild(createElement('p', 'collaboration-details__label', 'Agenda focus'));
    const agendaList = createElement('ul', 'collaboration-details__agenda');
    agenda.forEach((item) => {
      agendaList.appendChild(createElement('li', null, item));
    });
    container.appendChild(agendaList);
  }

  const channels = Array.isArray(details.channels) ? details.channels.filter(Boolean) : [];
  if (channels.length) {
    container.appendChild(createElement('p', 'collaboration-details__label', 'Active channels'));
    const channelList = createElement('dl', 'collaboration-details__channels');
    channels.forEach((channel) => {
      channelList.appendChild(createElement('dt', null, channel.label || 'Channel'));
      channelList.appendChild(createElement('dd', null, channel.value || ''));
    });
    container.appendChild(channelList);
  }

  const contributors = Array.isArray(details.contributors) ? details.contributors.filter(Boolean) : [];
  if (contributors.length) {
    container.appendChild(createElement('p', 'collaboration-details__label', 'Contributor leads'));
    const contributorList = createElement('ul', 'collaboration-details__contributors');
    contributors.forEach((contributor) => {
      const text = contributor.name
        ? `${contributor.name}${contributor.focus ? ` — ${contributor.focus}` : ''}`
        : contributor.focus || '';
      contributorList.appendChild(createElement('li', null, text));
    });
    container.appendChild(contributorList);
  }
}

function renderReleaseChecklist(container, items) {
  if (!container) return;
  clearChildren(container);

  const checklist = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!checklist.length) {
    container.appendChild(
      createElement(
        'p',
        'release-tracker__placeholder',
        'Add launch criteria to track readiness for the storytelling release.'
      )
    );
    return;
  }

  container.appendChild(createElement('p', 'release-tracker__title', 'Launch readiness'));

  const list = createElement('ul', 'release-checklist');
  checklist.forEach((item) => {
    const value = typeof item.progress === 'number' ? Math.min(Math.max(item.progress, 0), 100) : 0;
    const listItem = createElement('li', 'release-checklist__item');
    listItem.appendChild(
      createElement('span', 'release-checklist__label', item.label || 'Checklist item')
    );

    const progressWrapper = createElement('div', 'release-checklist__progress');
    const progressBar = createElement('div', 'release-checklist__progress-bar');
    progressBar.style.setProperty('--progress', `${value}%`);
    progressBar.setAttribute('role', 'progressbar');
    progressBar.setAttribute('aria-valuemin', '0');
    progressBar.setAttribute('aria-valuemax', '100');
    progressBar.setAttribute('aria-valuenow', String(value));
    progressBar.setAttribute(
      'aria-label',
      `${item.label || 'Checklist item'} — ${helpers.formatNumber(value, 0)}%`
    );
    progressWrapper.appendChild(progressBar);
    listItem.appendChild(progressWrapper);
    listItem.appendChild(
      createElement('span', 'release-checklist__progress-value', `${helpers.formatNumber(value, 0)}%`)
    );
    list.appendChild(listItem);
  });

  container.appendChild(list);
}

function renderMeta(target, release) {
  if (!target) return;
  clearChildren(target);

  if (!release) {
    target.appendChild(createElement('p', 'story-meta__placeholder', 'Release details unavailable.'));
    return;
  }

  const badgeLabel = release.version || release.phase || 'Release';
  const badge = createElement('span', 'story-meta__badge', badgeLabel);

  const phase = release.phase ? createElement('p', 'story-meta__phase', release.phase) : null;
  const updated = formatDate(release.updated);
  const metaList = createElement('div', 'story-meta__details');

  if (phase) {
    metaList.appendChild(phase);
  }
  if (updated) {
    metaList.appendChild(createElement('p', 'story-meta__updated', `Updated ${updated}`));
  }
  if (release.summary) {
    metaList.appendChild(createElement('p', 'story-meta__summary', release.summary));
  }

  target.appendChild(badge);
  target.appendChild(metaList);
}

function renderStoryPanel(container, story, index) {
  if (!container || !story) return;
  clearChildren(container);

  container.id = PANEL_ID;
  container.setAttribute('role', 'tabpanel');
  container.setAttribute('tabindex', '0');

  const header = createElement('header', 'story-step__header');
  header.appendChild(createElement('p', 'story-step__lede', story.lede || ''));
  header.appendChild(createElement('h3', 'story-step__title', story.title || `Story ${index + 1}`));

  const metricSection = createElement('section', 'story-step__metrics');
  const primaryMetric = createElement('div', 'story-metric story-metric--primary');
  primaryMetric.appendChild(createElement('span', 'story-metric__label', story.metric?.label || 'Headline metric'));
  primaryMetric.appendChild(createElement('strong', 'story-metric__value', formatMetric(story.metric) || ''));
  if (story.metric?.context) {
    primaryMetric.appendChild(createElement('span', 'story-metric__context', story.metric.context));
  }
  metricSection.appendChild(primaryMetric);

  const spotlights = Array.isArray(story.spotlights) ? story.spotlights : [];
  if (spotlights.length) {
    const list = createElement('ul', 'story-spotlights');
    spotlights.forEach((spotlight) => {
      const item = createElement('li', 'story-spotlight');
      item.appendChild(createElement('span', 'story-spotlight__label', spotlight.label || ''));
      item.appendChild(createElement('span', 'story-spotlight__value', formatMetric(spotlight) || ''));
      if (spotlight.context) {
        item.appendChild(createElement('span', 'story-spotlight__context', spotlight.context));
      }
      list.appendChild(item);
    });
    metricSection.appendChild(list);
  }

  const editorial = Array.isArray(story.editorial) ? story.editorial : [];
  const copy = createElement('div', 'story-step__body');
  if (editorial.length) {
    editorial.forEach((paragraph) => {
      copy.appendChild(createElement('p', null, paragraph));
    });
  }

  if (Array.isArray(story.sources) && story.sources.length) {
    const sources = createElement('div', 'story-sources');
    sources.appendChild(createElement('span', 'story-sources__label', 'Data sources:'));
    story.sources.forEach((source) => {
      sources.appendChild(createElement('code', 'story-sources__tag', source));
    });
    copy.appendChild(sources);
  }

  container.appendChild(header);
  container.appendChild(metricSection);
  container.appendChild(copy);
}

function setupStorytelling(board, data) {
  const nav = board.querySelector('[data-story-nav]');
  const content = board.querySelector('[data-story-content]');
  const meta = board.querySelector('[data-story-meta]');
  renderMeta(meta, data?.release);

  const stories = Array.isArray(data?.stories) ? data.stories.filter(Boolean) : [];
  if (!stories.length) {
    clearChildren(content);
    content.appendChild(createElement('p', 'story-panel__placeholder', 'Narrative walkthroughs are on the way.'));
    return;
  }

  const buttons = [];
  clearChildren(nav);
  stories.forEach((story, index) => {
    const button = createElement('button', 'story-step__trigger');
    button.type = 'button';
    const tabId = `story-tab-${story.id || index}`;
    const panelId = PANEL_ID;
    button.id = tabId;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panelId);
    button.setAttribute('tabindex', index === 0 ? '0' : '-1');
    button.innerHTML = `
      <span class="story-step__index">${String(index + 1).padStart(2, '0')}</span>
      <span class="story-step__summary">
        <strong>${story.title || `Story ${index + 1}`}</strong>
        <span>${story.metric?.label || story.lede || ''}</span>
      </span>
    `;
    button.addEventListener('click', () => activate(index));
    nav.appendChild(button);
    buttons.push(button);
  });

  nav.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const current = buttons.findIndex((button) => button.classList.contains('is-active'));
    const startingIndex = current === -1 ? 0 : current;
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (startingIndex + direction + stories.length) % stories.length;
    buttons[nextIndex].focus();
    activate(nextIndex);
  });

  function activate(index) {
    const story = stories[index];
    if (!story) {
      return;
    }
    buttons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === index;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    renderStoryPanel(content, story, index);
    const activeButton = buttons[index];
    if (activeButton) {
      content.setAttribute('aria-labelledby', activeButton.id);
    }
  }

  activate(0);
}

async function initStorytelling() {
  const board = document.querySelector('[data-storyboard]');
  if (!board) {
    return;
  }
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch storytelling data: ${response.status}`);
    }
    const data = await response.json();
    setupStorytelling(board, data);
  } catch (error) {
    console.error('Storytelling release failed to load', error);
    const meta = board.querySelector('[data-story-meta]');
    const content = board.querySelector('[data-story-content]');
    renderMeta(meta, null);
    if (content) {
      clearChildren(content);
      content.appendChild(
        createElement(
          'p',
          'story-panel__placeholder',
          'We could not load the narrative walkthroughs. Refresh to try again.'
        )
      );
    }
  }
}

async function initLabData() {
  const changelog = document.querySelector('[data-changelog]');
  const experiments = document.querySelector('[data-experiments]');
  const collaboration = document.querySelector('[data-collaboration]');
  const collaborationTags = document.querySelector('[data-collaboration-tags]');
  const releaseTracker = document.querySelector('[data-release-tracker]');

  if (!changelog && !experiments && !collaboration && !collaborationTags && !releaseTracker) {
    return;
  }

  try {
    const response = await fetch(LAB_DATA_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch insights lab data: ${response.status}`);
    }
    const data = await response.json();
    renderChangelog(changelog, data?.changelog);
    renderExperiments(experiments, data?.experiments);
    renderCollaboration(collaboration, data?.collaboration);
    renderCollaborationTags(collaborationTags, data?.collaboration?.badges);
    renderReleaseChecklist(releaseTracker, data?.releaseChecklist);
  } catch (error) {
    console.error('Insights Lab data failed to load', error);
    renderChangelog(changelog, null);
    renderExperiments(experiments, null);
    renderCollaboration(collaboration, null);
    renderCollaborationTags(collaborationTags, null);
    renderReleaseChecklist(releaseTracker, null);
  }
}

initStorytelling();
initLabData();
