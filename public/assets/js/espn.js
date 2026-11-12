// Free, keyless data layer. ESPN's public JSON endpoints answer cross-origin GETs
// without credentials, so the browser talks to them directly: no proxy, no key.
// Everything here is read-only and degrades to the committed snapshots in data/.

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const TIMEOUT_MS = 9000;

// Canonical team table. `id` is the stable 1–30 index the rest of the hub keys on.
export const TEAMS = [
  ['ATL', 'Atlanta', 'Hawks', 'East'], ['BOS', 'Boston', 'Celtics', 'East'], ['BKN', 'Brooklyn', 'Nets', 'East'],
  ['CHA', 'Charlotte', 'Hornets', 'East'], ['CHI', 'Chicago', 'Bulls', 'East'], ['CLE', 'Cleveland', 'Cavaliers', 'East'],
  ['DAL', 'Dallas', 'Mavericks', 'West'], ['DEN', 'Denver', 'Nuggets', 'West'], ['DET', 'Detroit', 'Pistons', 'East'],
  ['GSW', 'Golden State', 'Warriors', 'West'], ['HOU', 'Houston', 'Rockets', 'West'], ['IND', 'Indiana', 'Pacers', 'East'],
  ['LAC', 'LA', 'Clippers', 'West'], ['LAL', 'Los Angeles', 'Lakers', 'West'], ['MEM', 'Memphis', 'Grizzlies', 'West'],
  ['MIA', 'Miami', 'Heat', 'East'], ['MIL', 'Milwaukee', 'Bucks', 'East'], ['MIN', 'Minnesota', 'Timberwolves', 'West'],
  ['NOP', 'New Orleans', 'Pelicans', 'West'], ['NYK', 'New York', 'Knicks', 'East'], ['OKC', 'Oklahoma City', 'Thunder', 'West'],
  ['ORL', 'Orlando', 'Magic', 'East'], ['PHI', 'Philadelphia', '76ers', 'East'], ['PHX', 'Phoenix', 'Suns', 'West'],
  ['POR', 'Portland', 'Trail Blazers', 'West'], ['SAC', 'Sacramento', 'Kings', 'West'], ['SAS', 'San Antonio', 'Spurs', 'West'],
  ['TOR', 'Toronto', 'Raptors', 'East'], ['UTA', 'Utah', 'Jazz', 'West'], ['WAS', 'Washington', 'Wizards', 'East'],
].map(([abbreviation, city, name, conference], index) => ({
  id: index + 1,
  abbreviation,
  city,
  name,
  full_name: `${city} ${name}`,
  conference,
}));

const ABBREVIATION_ALIASES = { GS: 'GSW', NO: 'NOP', NY: 'NYK', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS', PHO: 'PHX', BRK: 'BKN', CHO: 'CHA' };
const TEAM_BY_ABBREVIATION = new Map(TEAMS.map((team) => [team.abbreviation, team]));

export function canonicalAbbreviation(value) {
  const upper = String(value ?? '').trim().toUpperCase();
  return ABBREVIATION_ALIASES[upper] ?? upper;
}

export function teamFromEspn(raw) {
  const abbreviation = canonicalAbbreviation(raw?.abbreviation);
  const known = TEAM_BY_ABBREVIATION.get(abbreviation);
  if (known) return { ...known, espnId: raw?.id != null ? String(raw.id) : null };
  // All-Star sides, international exhibition opponents and the like.
  const name = raw?.name ?? raw?.shortDisplayName ?? raw?.displayName ?? 'Team';
  return {
    id: null,
    espnId: raw?.id != null ? String(raw.id) : null,
    abbreviation: abbreviation || String(name).slice(0, 3).toUpperCase(),
    city: raw?.location ?? '',
    name,
    full_name: raw?.displayName ?? name,
    conference: null,
  };
}

export async function getJson(url, { signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`ESPN ${response.status} for ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export const compactDate = (iso) => String(iso).slice(0, 10).replaceAll('-', '');

/** The US Eastern calendar date for an instant: the date the league schedules by. */
export function leagueDate(instant = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
  return parts; // YYYY-MM-DD
}

const ORDINALS = ['', '1st', '2nd', '3rd', '4th'];
function periodLabel(period) {
  if (period <= 4) return `${ORDINALS[period] ?? `${period}th`} Qtr`;
  return period === 5 ? 'OT' : `${period - 4}OT`;
}

/** Normalise one scoreboard event (or summary header) to the hub's game shape. */
export function gameFromEvent(event) {
  const competition = event?.competitions?.[0] ?? event;
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === 'home') ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === 'away') ?? competitors[1];
  const status = competition?.status ?? event?.status ?? {};
  const state = status?.type?.state ?? 'pre';
  const period = Number(status?.period ?? 0) || 0;
  const clock = status?.displayClock ?? '';
  const datetime = competition?.date ?? event?.date ?? null;
  const seasonType = Number(event?.season?.type ?? event?.seasonType ?? competition?.season?.type ?? 2);
  const startYear = Number(event?.season?.year ?? competition?.season?.year ?? NaN);

  let statusText;
  let time = '';
  if (state === 'post') {
    statusText = 'Final';
    time = period > 4 ? `Final/${period === 5 ? 'OT' : `${period - 4}OT`}` : 'Final';
  } else if (state === 'in') {
    const half = /half/i.test(status?.type?.description ?? status?.type?.name ?? '');
    statusText = half ? 'Halftime' : periodLabel(period);
    time = half ? 'Halftime' : `${period > 4 ? periodLabel(period) : `Q${period}`} ${clock}`.trim();
  } else {
    statusText = /postponed|canceled|cancelled/i.test(status?.type?.description ?? '') ? status.type.description : datetime ?? 'Scheduled';
  }

  const side = (c) => ({
    ...teamFromEspn(c?.team),
    record: c?.records?.find((r) => r.type === 'total' || r.name === 'overall')?.summary ?? c?.record?.[0]?.summary ?? null,
    linescores: (c?.linescores ?? []).map((l) => Number(l.value ?? l.displayValue ?? 0)),
    winner: c?.winner === true,
  });

  return {
    id: Number(event?.id ?? competition?.id),
    date: datetime ? leagueDate(new Date(datetime)) : null,
    datetime,
    // ESPN labels a season by the year it ends; the hub uses the year it starts.
    season: Number.isFinite(startYear) ? startYear - 1 : null,
    season_type: seasonType === 1 ? 'Preseason' : seasonType === 3 || seasonType === 5 ? 'Playoffs' : 'Regular Season',
    postseason: seasonType === 3 || seasonType === 5,
    status: statusText,
    state,
    period,
    time,
    clock,
    detail: status?.type?.shortDetail ?? status?.type?.detail ?? '',
    home_team: side(home),
    visitor_team: side(away),
    home_team_score: Number(home?.score ?? 0) || 0,
    visitor_team_score: Number(away?.score ?? 0) || 0,
    venue: competition?.venue?.fullName ?? null,
    broadcast: competition?.broadcasts?.flatMap((b) => b.names ?? []).join(', ') || competition?.broadcast || null,
    headline: competition?.notes?.[0]?.headline ?? competition?.series?.summary ?? null,
  };
}

const MAX_RANGE_DAYS = 21;

function daysBetween(startIso, endIso) {
  const days = [];
  const end = Date.parse(`${endIso}T00:00:00Z`);
  for (let t = Date.parse(`${startIso}T00:00:00Z`); t <= end && days.length < MAX_RANGE_DAYS; t += 86400000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

/**
 * Games between two ISO dates, inclusive. ESPN answers a date range with
 * HTTP 400, so a range is one request per day, capped at three weeks.
 */
export async function fetchGames(startIso, endIso = startIso, options = {}) {
  const perDay = await Promise.all(
    daysBetween(startIso, endIso).map(async (day) => {
      const params = new URLSearchParams({ dates: compactDate(day), limit: '100' });
      if (options.seasonType) params.set('seasontype', String(options.seasonType));
      const payload = await getJson(`${SITE}/scoreboard?${params}`, options);
      return (payload?.events ?? []).map(gameFromEvent).filter((game) => Number.isFinite(game.id));
    }),
  );
  const seen = new Set();
  return perDay.flat().filter((game) => !seen.has(game.id) && seen.add(game.id));
}

export async function fetchSummary(gameId, options = {}) {
  return getJson(`${SITE}/summary?event=${encodeURIComponent(gameId)}`, options);
}

export function gameFromSummary(summary, gameId) {
  const header = summary?.header ?? {};
  const game = gameFromEvent({ ...header, id: header.id ?? gameId, competitions: header.competitions });
  game.venue = summary?.gameInfo?.venue?.fullName ?? game.venue;
  return game;
}

const made = (value) => {
  const [m, a] = String(value ?? '').split('-').map((n) => Number(n));
  return [Number.isFinite(m) ? m : 0, Number.isFinite(a) ? a : 0];
};
const pct = (m, a) => (a > 0 ? m / a : 0);

/** Flatten a summary's box score into one stat line per player. */
export function statLinesFromSummary(summary, gameId) {
  const lines = [];
  for (const group of summary?.boxscore?.players ?? []) {
    const team = teamFromEspn(group?.team);
    for (const table of group?.statistics ?? []) {
      const labels = (table?.labels ?? table?.names ?? []).map((label) => String(label).toUpperCase());
      const at = (label) => labels.indexOf(label);
      for (const entry of table?.athletes ?? []) {
        const stats = entry?.stats ?? [];
        if (!stats.length || entry?.didNotPlay) continue;
        const read = (label) => (at(label) >= 0 ? stats[at(label)] : undefined);
        const [fgm, fga] = made(read('FG'));
        const [fg3m, fg3a] = made(read('3PT'));
        const [ftm, fta] = made(read('FT'));
        const athlete = entry?.athlete ?? {};
        const [first, ...rest] = String(athlete.displayName ?? '').split(' ');
        const minutes = String(read('MIN') ?? '0');
        lines.push({
          id: Number(`${gameId}${athlete.id ?? lines.length}`) || null,
          min: minutes.includes(':') ? minutes : `${minutes}:00`,
          fgm, fga, fg_pct: pct(fgm, fga),
          fg3m, fg3a, fg3_pct: pct(fg3m, fg3a),
          ftm, fta, ft_pct: pct(ftm, fta),
          oreb: Number(read('OREB') ?? 0) || 0,
          dreb: Number(read('DREB') ?? 0) || 0,
          reb: Number(read('REB') ?? 0) || 0,
          ast: Number(read('AST') ?? 0) || 0,
          stl: Number(read('STL') ?? 0) || 0,
          blk: Number(read('BLK') ?? 0) || 0,
          turnover: Number(read('TO') ?? 0) || 0,
          pf: Number(read('PF') ?? 0) || 0,
          pts: Number(read('PTS') ?? 0) || 0,
          plus_minus: Number(read('+/-') ?? 0) || 0,
          starter: entry?.starter === true,
          player: {
            id: Number(athlete.id) || null,
            first_name: first ?? '',
            last_name: rest.join(' '),
            display_name: athlete.displayName ?? '',
            position: athlete.position?.abbreviation ?? '',
            jersey_number: athlete.jersey ?? '',
            headshot: athlete.headshot?.href ?? null,
          },
          team,
          game: { id: Number(gameId) },
        });
      }
    }
  }
  return lines;
}
