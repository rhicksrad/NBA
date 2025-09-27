let sparklineId = 0;

export interface SparklinePoint {
  date: string;
  value: number;
}

export interface SparklineOptions {
  width?: number;
  height?: number;
  title: string;
  description: string;
}

export function renderSparkline(container: HTMLElement, points: SparklinePoint[], options: SparklineOptions): void {
  container.innerHTML = '';
  if (!points || points.length === 0) {
    const fallback = document.createElement('p');
    fallback.textContent = 'Trend data will appear once the next game is complete.';
    container.appendChild(fallback);
    return;
  }

  const width = options.width ?? 320;
  const height = options.height ?? 120;
  const padding = 12;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const toX = (index: number) => padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
  const toY = (value: number) => padding + (1 - (value - min) / range) * (height - padding * 2);

  const areaPath: string[] = [];
  const linePath: string[] = [];

  points.forEach((point, index) => {
    const x = toX(index);
    const y = toY(point.value);
    linePath.push(`${index === 0 ? 'M' : 'L'}${x},${y}`);
    if (index === 0) {
      areaPath.push(`M${x},${height - padding}`);
      areaPath.push(`L${x},${y}`);
    } else {
      areaPath.push(`L${x},${y}`);
    }
    if (index === points.length - 1) {
      areaPath.push(`L${x},${height - padding}`);
      areaPath.push('Z');
    }
  });

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const id = ++sparklineId;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', `sparkline-title-${id} sparkline-desc-${id}`);

  const title = document.createElementNS(svg.namespaceURI, 'title');
  title.setAttribute('id', `sparkline-title-${id}`);
  title.textContent = options.title;
  const desc = document.createElementNS(svg.namespaceURI, 'desc');
  desc.setAttribute('id', `sparkline-desc-${id}`);
  desc.textContent = options.description;

  const area = document.createElementNS(svg.namespaceURI, 'path');
  area.setAttribute('d', areaPath.join(' '));
  area.setAttribute('class', 'sparkline-fill');

  const line = document.createElementNS(svg.namespaceURI, 'path');
  line.setAttribute('d', linePath.join(' '));
  line.setAttribute('class', 'sparkline-path');

  const lastPoint = points[points.length - 1];
  const marker = document.createElementNS(svg.namespaceURI, 'circle');
  marker.setAttribute('cx', String(toX(points.length - 1)));
  marker.setAttribute('cy', String(toY(lastPoint.value)));
  marker.setAttribute('r', '4');
  marker.setAttribute('class', 'sparkline-point');

  svg.append(title, desc, area, line, marker);
  container.appendChild(svg);
}
