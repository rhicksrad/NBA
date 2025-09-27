import { helpers } from './hub-charts.js';

const DATA_URL = 'data/storytelling_walkthroughs.json';
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

initStorytelling();
