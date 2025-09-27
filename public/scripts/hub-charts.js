const dataCache = new Map();
const chartRegistry = new Map();
const pendingDefinitions = new Map();
let observerRef = null;

function ensureChartDefaults() {
  if (!window.Chart || ensureChartDefaults._set) return;
  ensureChartDefaults._set = true;
  const { Chart } = window;
  Chart.defaults.font.family = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  Chart.defaults.font.weight = 500;
  Chart.defaults.color = '#0b2545';
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxHeight = 8;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.align = 'end';
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(11, 37, 69, 0.88)';
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.titleColor = '#f5f8ff';
  Chart.defaults.plugins.tooltip.bodyColor = '#f5f8ff';
  Chart.defaults.plugins.tooltip.displayColors = true;
  Chart.defaults.elements.bar.borderRadius = 6;
  Chart.defaults.elements.bar.borderSkipped = false;
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
}

async function loadJson(url) {
  if (!dataCache.has(url)) {
    dataCache.set(
      url,
      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.status}`);
          }
          return response.json();
        })
        .then((json) => (typeof structuredClone === 'function' ? structuredClone(json) : JSON.parse(JSON.stringify(json))))
    );
  }
  return dataCache.get(url);
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function evenSample(series, limit) {
  if (!limit || series.length <= limit) {
    return series;
  }
  const step = Math.ceil(series.length / limit);
  const sampled = [];
  for (let i = 0; i < series.length; i += step) {
    sampled.push(series[i]);
  }
  return sampled;
}

function rankAndSlice(series, limit, valueAccessor = (item) => item.value ?? item.players ?? 0) {
  if (!limit || series.length <= limit) {
    return series;
  }
  return [...series]
    .sort((a, b) => valueAccessor(b) - valueAccessor(a))
    .slice(0, limit);
}

const helpers = {
  formatNumber(value, maximumFractionDigits = 1) {
    const options = { maximumFractionDigits };
    if (maximumFractionDigits === 0) {
      options.minimumFractionDigits = 0;
    }
    return new Intl.NumberFormat('en-US', options).format(value);
  },
  evenSample,
  rankAndSlice,
};

function scheduleMount(callback) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: 1200 });
  } else {
    window.setTimeout(callback, 0);
  }
}

function instantiateChart(canvas, definition) {
  if (!canvas || chartRegistry.has(canvas)) {
    return;
  }

  const run = async () => {
    try {
      ensureChartDefaults();
      const sourceData = definition.source ? await loadJson(definition.source) : undefined;
      const config = await definition.createConfig(sourceData, helpers);
      if (!config || !canvas.isConnected) {
        return;
      }
      if (prefersReducedMotion()) {
        config.options = config.options || {};
        config.options.animation = false;
      }
      const chart = new window.Chart(canvas.getContext('2d'), config);
      chartRegistry.set(canvas, chart);
    } catch (error) {
      console.error('Unable to mount chart', error);
      const container = canvas.closest('[data-chart-wrapper]');
      if (container && !container.querySelector('.viz-error__message')) {
        container.classList.add('viz-error');
        const message = document.createElement('p');
        message.className = 'viz-error__message';
        message.textContent = 'Chart failed to load.';
        container.appendChild(message);
      }
    }
  };

  scheduleMount(run);
}

function getObserver() {
  if (!('IntersectionObserver' in window)) {
    return null;
  }
  if (!observerRef) {
    observerRef = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          const definition = pendingDefinitions.get(entry.target);
          if (definition) {
            instantiateChart(entry.target, definition);
            pendingDefinitions.delete(entry.target);
          }
          observerRef.unobserve(entry.target);
        });
      },
      { rootMargin: '120px 0px' }
    );
  }
  return observerRef;
}

export function registerCharts(configs) {
  const observer = getObserver();

  configs.forEach((config) => {
    const canvas =
      typeof config.element === 'string' ? document.querySelector(config.element) : config.element;
    if (!canvas) {
      return;
    }
    pendingDefinitions.set(canvas, config);
    if (observer) {
      observer.observe(canvas);
    } else {
      instantiateChart(canvas, config);
      pendingDefinitions.delete(canvas);
    }
  });
}

export function destroyCharts() {
  chartRegistry.forEach((chart) => chart.destroy());
  chartRegistry.clear();
  pendingDefinitions.clear();
  if (observerRef) {
    observerRef.disconnect();
    observerRef = null;
  }
}

export { helpers };
