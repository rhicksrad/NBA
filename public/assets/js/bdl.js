export const API = 'https://bdlproxy.hicksrch.workers.dev/bdl';

function makeLimiter({ maxConcurrent = 1, minIntervalMs = 300 } = {}) {
  let active = 0;
  const queue = [];
  let lastStart = 0;

  const scheduleNext = () => {
    if (!queue.length || active >= maxConcurrent) return;
    const task = queue.shift();
    if (!task) return;
    run(task.fn, task.resolve, task.reject);
  };

  const run = (fn, resolve, reject) => {
    const now = Date.now();
    const wait = Math.max(0, minIntervalMs - (now - lastStart));
    lastStart = now + wait;
    setTimeout(async () => {
      active += 1;
      try {
        const value = await fn();
        resolve(value);
      } catch (error) {
        reject(error);
      } finally {
        active -= 1;
        scheduleNext();
      }
    }, wait);
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      if (active < maxConcurrent) {
        run(fn, resolve, reject);
      } else {
        queue.push({ fn, resolve, reject });
      }
    });
}

const limit = makeLimiter({ maxConcurrent: 1, minIntervalMs: 300 });
const memo = new Map();

function shouldMemoize(init = {}) {
  const method = typeof init.method === 'string' ? init.method.toUpperCase() : 'GET';
  if (method !== 'GET') return false;
  if (init.cache && init.cache.toLowerCase() === 'no-store') return false;
  return true;
}

function parseRetryAfter(value) {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.max(0, numeric * 1000);
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return Math.max(0, parsed - Date.now());
  }
  return null;
}

async function fetchJsonWithRetry(url, init = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  if (init.headers instanceof Headers) {
    init.headers.forEach((value, key) => headers.set(key, value));
  } else if (init.headers && typeof init.headers === 'object') {
    for (const [key, value] of Object.entries(init.headers)) {
      if (value != null) headers.set(key, value);
    }
  }

  const baseInit = {
    ...init,
    headers,
    method: init.method ?? 'GET'
  };

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(url, baseInit);
    if (response.status === 429) {
      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
      const backoff = retryAfter != null ? retryAfter : Math.min(3000 * attempt, 15000);
      const jitter = Math.floor(Math.random() * 400);
      await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
      continue;
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const path = (() => {
        try {
          return new URL(url).pathname;
        } catch {
          return url;
        }
      })();
      throw new Error(`BDL ${response.status} for ${path}${text ? `: ${text.slice(0, 120)}` : ''}`);
    }
    return response.json();
  }
  throw new Error('BDL proxy retried too many times after 429 responses.');
}

export async function bdl(path, init = {}) {
  const url = `${API}${path}`;
  const memoKey = shouldMemoize(init) ? url : null;
  if (memoKey && memo.has(memoKey)) {
    return memo.get(memoKey);
  }

  const task = limit(() => fetchJsonWithRetry(url, init));
  if (!memoKey) {
    return task;
  }

  memo.set(memoKey, task);
  try {
    const result = await task;
    memo.set(memoKey, result);
    return result;
  } catch (error) {
    memo.delete(memoKey);
    throw error;
  }
}

export async function fetchSeasonAggregate({ season, playerId, postseason = false, signal } = {}) {
  const params = new URLSearchParams({
    season: String(season),
    player_id: String(playerId)
  });
  if (postseason) params.set('postseason', 'true');
  return bdl(`/v1/season_averages?${params.toString()}`, { signal });
}
