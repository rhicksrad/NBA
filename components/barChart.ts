let barChartId = 0;

export interface BarDatum {
  label: string;
  value: number;
  context?: string;
}

export interface BarChartOptions {
  width?: number;
  height?: number;
  title: string;
  description: string;
  secondaryLabel?: string;
}

export function renderBarChart(container: HTMLElement, data: BarDatum[], options: BarChartOptions): void {
  container.innerHTML = '';
  if (!data || data.length === 0) {
    const fallback = document.createElement('p');
    fallback.textContent = 'Comparison data not yet available.';
    container.appendChild(fallback);
    return;
  }

  const width = options.width ?? 360;
  const height = options.height ?? 160;
  const padding = { top: 16, right: 24, bottom: 24, left: 140 };
  const max = Math.max(...data.map((datum) => datum.value), 1);
  const barHeight = (height - padding.top - padding.bottom) / data.length - 12;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const id = ++barChartId;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', `bar-title-${id} bar-desc-${id}`);

  const title = document.createElementNS(svg.namespaceURI, 'title');
  title.setAttribute('id', `bar-title-${id}`);
  title.textContent = options.title;

  const desc = document.createElementNS(svg.namespaceURI, 'desc');
  desc.setAttribute('id', `bar-desc-${id}`);
  desc.textContent = options.description;

  svg.append(title, desc);

  data.forEach((datum, index) => {
    const group = document.createElementNS(svg.namespaceURI, 'g');
    const y = padding.top + index * (barHeight + 12);

    const label = document.createElementNS(svg.namespaceURI, 'text');
    label.setAttribute('x', String(padding.left - 12));
    label.setAttribute('y', String(y + barHeight / 2 + 6));
    label.setAttribute('class', 'bar-label');
    label.setAttribute('text-anchor', 'end');
    label.textContent = datum.label;

    const bar = document.createElementNS(svg.namespaceURI, 'rect');
    bar.setAttribute('x', String(padding.left));
    bar.setAttribute('y', String(y));
    bar.setAttribute('width', String(((width - padding.left - padding.right) * datum.value) / max));
    bar.setAttribute('height', String(Math.max(barHeight, 8)));
    bar.setAttribute('rx', '6');
    bar.setAttribute('class', index === 0 ? 'bar-rect' : 'bar-rect-secondary');

    const value = document.createElementNS(svg.namespaceURI, 'text');
    value.setAttribute('x', String(padding.left + ((width - padding.left - padding.right) * datum.value) / max + 8));
    value.setAttribute('y', String(y + barHeight / 2 + 6));
    value.setAttribute('class', 'bar-value');
    value.textContent = `${datum.value}`;

    group.append(bar, label, value);
    svg.appendChild(group);
  });

  container.appendChild(svg);
}
