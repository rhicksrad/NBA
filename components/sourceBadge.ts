export interface SourceDetails {
  name: string;
  url: string;
  updateCadence: string;
}

export function createSourceBadge(details: SourceDetails): HTMLElement {
  const link = document.createElement('a');
  link.className = 'source-badge';
  link.href = details.url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.setAttribute('aria-label', `${details.name} — ${details.updateCadence}`);
  link.textContent = `Source: ${details.name}`;

  const cadence = document.createElement('span');
  cadence.textContent = details.updateCadence;
  link.appendChild(cadence);

  return link;
}
