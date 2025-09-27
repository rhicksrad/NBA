import { renderSparkline, SparklinePoint } from './sparkline';
import { renderBarChart } from './barChart';
import { createSourceBadge, SourceDetails } from './sourceBadge';
import { formatLastUpdated } from './lastUpdated';

type StatusState = 'Live' | 'Beta' | 'Planned';

interface StatusItem {
  label: string;
  value: number;
  unit: string;
  status: StatusState;
  change: number;
  description?: string;
}

interface StatusResponse {
  lastUpdated: string;
  source: SourceDetails;
  items: StatusItem[];
}

interface SparklineResponse {
  lastUpdated: string;
  source: SourceDetails;
  team: string;
  metric: string;
  unit: string;
  values: SparklinePoint[];
  summary?: string;
}

interface BarResponse {
  lastUpdated: string;
  source: SourceDetails;
  metric: string;
  unit: string;
  groups: { label: string; value: number; context?: string }[];
  summary?: string;
}

interface MetaResponse {
  lastUpdated: string;
  source: SourceDetails;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function updateSourceBadge(key: string, source: SourceDetails | undefined): void {
  const target = document.querySelector(`[data-source="${key}"]`);
  if (!target) return;
  target.innerHTML = '';
  if (!source) {
    target.textContent = 'Source unavailable';
    return;
  }
  target.appendChild(createSourceBadge(source));
}

function updateTimestamp(key: string, iso: string | undefined | null): void {
  const target = document.querySelector(`[data-last-updated="${key}"]`);
  if (!target) return;
  target.textContent = formatLastUpdated(iso ?? undefined);
}

async function hydrateStatusModule(): Promise<void> {
  const container = document.querySelector<HTMLElement>('[data-module="power-status"]');
  if (!container) return;
  const data = await fetchJson<StatusResponse>('data/power-status.json');
  if (!data) {
    container.textContent = 'Status indicators are temporarily unavailable.';
    return;
  }

  updateTimestamp('power-status', data.lastUpdated);
  updateSourceBadge('power-status', data.source);

  container.innerHTML = '';

  data.items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'status-card';
    card.tabIndex = 0;
    card.setAttribute('aria-label', `${item.label} is ${item.status} at ${item.value} ${item.unit}`);

    const heading = document.createElement('h3');
    heading.textContent = item.label;

    const statusTag = document.createElement('span');
    statusTag.className = `status-tag status-${item.status.toLowerCase()}`;
    statusTag.textContent = item.status;

    const value = document.createElement('div');
    value.className = 'value';
    value.textContent = `${item.value.toFixed(1)} ${item.unit}`;

    const change = document.createElement('p');
    const changePrefix = item.change > 0 ? '+' : '';
    change.textContent = `${changePrefix}${item.change.toFixed(1)} vs last check`;

    const description = document.createElement('p');
    description.textContent = item.description ?? '';

    card.append(heading, statusTag, value, change, description);
    container.appendChild(card);
  });
}

async function hydrateSparkline(): Promise<void> {
  const container = document.querySelector<HTMLElement>('[data-chart="sparkline"]');
  if (!container) return;
  const description = document.getElementById('sparkline-desc');
  const data = await fetchJson<SparklineResponse>('data/team-sparkline.json');
  if (!data) {
    container.textContent = 'Unable to load recent milestones.';
    if (description) description.textContent = '';
    return;
  }

  updateTimestamp('sparkline', data.lastUpdated);
  updateSourceBadge('sparkline', data.source);

  renderSparkline(container, data.values, {
    title: `${data.team} ${data.metric}`,
    description: data.summary ?? `${data.team} ${data.metric}`,
  });
  if (description) {
    description.textContent = data.summary ?? '';
  }
}

async function hydrateBarChart(): Promise<void> {
  const container = document.querySelector<HTMLElement>('[data-chart="bar-chart"]');
  if (!container) return;
  const description = document.getElementById('bar-chart-desc');
  const data = await fetchJson<BarResponse>('data/conference-bar.json');
  if (!data) {
    container.textContent = 'Unable to load checkpoint comparison.';
    if (description) description.textContent = '';
    return;
  }

  updateTimestamp('bar-chart', data.lastUpdated);
  updateSourceBadge('bar-chart', data.source);

  renderBarChart(container, data.groups, {
    title: `${data.metric} (${data.unit})`,
    description: data.summary ?? `${data.metric} comparison`,
  });

  if (description) {
    const contexts = data.groups
      .filter((group) => group.context)
      .map((group) => `${group.label}: ${group.context}`)
      .join(' ');
    description.innerHTML = `<strong>${data.metric}:</strong> ${data.summary ?? contexts}`;
  }
}

async function hydrateGlobalStage(): Promise<void> {
  const data = await fetchJson<MetaResponse>('data/global-stage.json');
  if (!data) return;
  updateTimestamp('global-stage', data.lastUpdated);
  updateSourceBadge('global-stage', data.source);
}

function setupChartObserver(): void {
  const chartElements = document.querySelectorAll<HTMLElement>('[data-chart]');
  if (chartElements.length === 0) return;

  const loaders: Record<string, () => Promise<void>> = {
    'sparkline': hydrateSparkline,
    'bar-chart': hydrateBarChart,
  };

  if (!('IntersectionObserver' in window)) {
    chartElements.forEach((element) => {
      const key = element.dataset.chart ?? '';
      const loader = loaders[key];
      if (loader) loader();
    });
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const target = entry.target as HTMLElement;
      const key = target.dataset.chart ?? '';
      const loader = loaders[key];
      if (loader) {
        loader();
        obs.unobserve(target);
      }
    });
  }, { threshold: 0.2 });

  chartElements.forEach((element) => observer.observe(element));
}

window.addEventListener('DOMContentLoaded', () => {
  hydrateStatusModule();
  hydrateGlobalStage();
  setupChartObserver();
});
