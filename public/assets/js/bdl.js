// Compatibility layer. The hub was written against the Ball Don't Lie REST shapes;
// that API is paid now, so the same calls are answered from free sources instead:
// live games and box scores from ESPN's public JSON, season averages from the
// snapshot the refresh job writes to data/live/. Callers did not have to change.
import { fetchGames, fetchSummary, gameFromSummary, statLinesFromSummary } from './espn.js';

const memo = new Map();
let averagesPromise = null;

function loadAverages() {
  averagesPromise ??= fetch('data/live/season_averages.json')
    .then((response) => (response.ok ? response.json() : { players: {} }))
    .catch(() => ({ players: {} }));
  return averagesPromise;
}

function summary(gameId, fresh) {
  const key = `summary:${gameId}`;
  if (fresh || !memo.has(key)) {
    const task = fetchSummary(gameId).catch((error) => {
      memo.delete(key);
      throw error;
    });
    memo.set(key, task);
  }
  return memo.get(key);
}

// Postseason windows by season start year, for the Rewind page's finals lookups.

async function route(pathname, params, init) {
  const fresh = init?.cache === 'no-store';
  const gameMatch = pathname.match(/^\/v1\/games\/(\d+)$/);
  if (gameMatch) {
    return { data: gameFromSummary(await summary(gameMatch[1], fresh), gameMatch[1]) };
  }

  if (pathname === '/v1/games') {
    const dates = params.getAll('dates[]').sort();
    if (dates.length) {
      return { data: await fetchGames(dates[0], dates[dates.length - 1], init), meta: { next_cursor: null } };
    }
    return { data: [], meta: { next_cursor: null } };
  }

  if (pathname === '/v1/stats') {
    const gameIds = params.getAll('game_ids[]');
    const lines = [];
    for (const gameId of gameIds) {
      // eslint-disable-next-line no-await-in-loop
      lines.push(...statLinesFromSummary(await summary(gameId, fresh), gameId));
    }
    return { data: lines, meta: { next_cursor: null } };
  }

  if (pathname === '/v1/season_averages') {
    const { players, seasonLabel } = await loadAverages();
    const row = players?.[params.get('player_id')];
    return { data: row ? [row] : [], seasonLabel: seasonLabel ?? null };
  }

  // Endpoints with no free equivalent answer empty rather than failing the page.
  return { data: [], meta: { next_cursor: null } };
}

export async function bdl(path, init = {}) {
  const url = new URL(String(path).replace(/^\/?(bdl\/)?/, '/'), 'https://hub.invalid');
  return route(url.pathname, url.searchParams, init);
}

export async function fetchSeasonAggregate({ season, playerId, signal } = {}) {
  const params = new URLSearchParams({ season: String(season), player_id: String(playerId) });
  return bdl(`/v1/season_averages?${params}`, { signal });
}
