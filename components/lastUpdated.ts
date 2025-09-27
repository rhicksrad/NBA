export function formatLastUpdated(isoString: string | undefined | null): string {
  if (!isoString) {
    return 'Last updated: Not available';
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return 'Last updated: Invalid date';
  }
  const pad = (value: number) => value.toString().padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  return `Last updated: ${year}-${month}-${day} ${hours}:${minutes} UTC`;
}
