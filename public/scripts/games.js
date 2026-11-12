// Games: one league day as a scorebook. Line scores come straight from ESPN's
// scoreboard; the "best lines" table reads each box score and ranks every player
// by Game Score. Offline, the days held in the committed snapshot still paint.
import { fetchGames, fetchSummary, statLinesFromSummary, leagueDate } from '../assets/js/espn.js';
import { getTeamLogo } from './team-logos.js';

const LIVE_POLL_MS = 20_000;
const HOME_EDGE = 2.4;
const TOP_LINES = 15;

const $ = (selector) => document.querySelector(selector);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const noon = (iso) => new Date(`${iso}T12:00:00Z`);
const shiftIso = (iso, days) => new Date(noon(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const fmt = (iso, options) => noon(iso).toLocaleDateString(undefined, { timeZone: 'UTC', ...options });
const tipTime = (datetime) => new Date(datetime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const isIso = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && !Number.isNaN(noon(value).getTime());

const today = leagueDate();
const state = {
  date: isIso(new URLSearchParams(location.search).get('date')) ? new URLSearchParams(location.search).get('date') : today,
  snapshot: [],
  ratings: new Map(),
  days: new Map(), // iso -> games from the live feed
  boxes: new Map(), // game id -> stat lines (finals are cached for good)
  timer: null,
  ticket: 0,
};

/* ---------- Week rail ---------- */

function renderRail() {
  const rail = $('[data-rail]');
  rail.replaceChildren(
    ...[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
      const iso = shiftIso(state.date, offset);
      const button = el('button', iso === today ? 'is-today' : '');
      button.type = 'button';
      button.dataset.date = iso;
      button.setAttribute('aria-pressed', String(offset === 0));
      button.setAttribute('aria-label', fmt(iso, { weekday: 'long', month: 'long', day: 'numeric' }));
      button.append(el('span', 'rail__dow', fmt(iso, { weekday: 'short' })), el('span', 'rail__day', fmt(iso, { day: 'numeric' })), el('span', 'rail__mon', fmt(iso, { month: 'short' })));
      return button;
    }),
  );
  $('[data-date-input]').value = state.date;
}

function go(iso, { push = true } = {}) {
  if (!isIso(iso)) return;
  state.date = iso;
  if (push) history.pushState(null, '', iso === today ? location.pathname : `?date=${iso}`);
  renderRail();
  refresh();
}

/* ---------- One game ---------- */

function winChance(game) {
  const home = state.ratings.get(game.home_team.abbreviation);
  const away = state.ratings.get(game.visitor_team.abbreviation);
  if (home == null || away == null) return null;
  return 1 / (1 + 10 ** (-(home - away + HOME_EDGE) / 12));
}

const periodHead = (index) => (index < 4 ? String(index + 1) : index === 4 ? 'OT' : `${index - 3}OT`);

function teamCells(team, { lost }) {
  const cell = el('th', `entry__team${lost ? ' is-lost' : ''}`);
  cell.scope = 'row';
  const logo = el('img');
  logo.src = getTeamLogo(team.abbreviation);
  logo.alt = '';
  logo.width = 26;
  logo.height = 26;
  logo.loading = 'lazy';
  cell.append(logo, el('span', 'entry__abbr', team.abbreviation), el('span', 'entry__name', team.name ?? ''), el('span', 'entry__record', team.record ?? ''));
  return cell;
}

function gameEntry(game) {
  const item = el('li', `entry entry--${game.state}`);
  const pre = game.state === 'pre';
  const decided = game.state === 'post';
  const head = el('p', 'entry__head');
  const status = el('span', 'entry__status');
  if (game.state === 'in') status.append(el('b', 'entry__live', 'Live'), document.createTextNode(` ${game.time}`));
  else if (decided) status.textContent = game.time || 'Final';
  else status.textContent = /^\d{4}-/.test(game.status) ? tipTime(game.datetime) : game.status;
  head.append(status, el('span', 'entry__where', [game.venue, pre ? game.broadcast : null].filter(Boolean).join(' · ')));

  const table = el('table', 'sheet entry__sheet');
  const sides = [
    [game.visitor_team, game.visitor_team_score, game.home_team_score],
    [game.home_team, game.home_team_score, game.visitor_team_score],
  ];
  if (pre) {
    const chance = winChance(game);
    table.innerHTML = `<thead><tr><th scope="col">Team</th><th scope="col" class="num">${chance == null ? '' : 'Win chance'}</th></tr></thead>`;
    const body = el('tbody');
    sides.forEach(([team], index) => {
      const row = el('tr');
      const p = chance == null ? null : index ? chance : 1 - chance;
      const odds = el('td', 'num entry__odds');
      if (p != null) {
        const bar = el('span', `entry__bar${p >= 0.5 ? ' is-fav' : ''}`);
        bar.style.setProperty('--w', `${p * 100}%`);
        odds.append(bar, el('span', 'entry__pct', `${Math.round(p * 100)}%`));
      }
      row.append(teamCells(team, { lost: false }), odds);
      body.append(row);
    });
    table.append(body);
  } else {
    const periods = Math.max(4, game.home_team.linescores.length, game.visitor_team.linescores.length);
    const cols = Array.from({ length: periods }, (_, i) => `<th scope="col" class="num">${periodHead(i)}</th>`).join('');
    table.innerHTML = `<thead><tr><th scope="col">Team</th>${cols}<th scope="col" class="num">T</th></tr></thead>`;
    const body = el('tbody');
    sides.forEach(([team, score, other]) => {
      const lost = decided && score < other;
      const row = el('tr');
      row.append(teamCells(team, { lost }));
      for (let i = 0; i < periods; i += 1) {
        const value = team.linescores[i];
        const best = value != null && value > (team === game.home_team ? game.visitor_team : game.home_team).linescores[i];
        row.append(el('td', `num entry__q${best ? ' is-won' : ''}`, value == null ? '' : String(value)));
      }
      row.append(el('td', `num entry__total${lost ? ' is-lost' : ''}`, String(score)));
      body.append(row);
    });
    table.append(body);
  }

  const link = el('a', 'entry__link', pre ? 'Preview' : 'Box score');
  link.href = `${pre ? 'game-preview' : 'game-tracker'}.html?gameId=${game.id}`;
  link.setAttribute('aria-label', `${pre ? 'Preview' : 'Box score'}: ${game.visitor_team.full_name} at ${game.home_team.full_name}`);
  const foot = el('p', 'entry__foot');
  if (game.headline) foot.append(el('span', null, game.headline));
  foot.append(link);
  item.append(head, table, foot);
  return item;
}

/* ---------- The day ---------- */

function dayNote(games) {
  if (!games.length) return '';
  const finals = games.filter((g) => g.state === 'post');
  const live = games.filter((g) => g.state === 'in').length;
  const parts = [`${games.length} ${games.length === 1 ? 'game' : 'games'}`];
  if (live) parts.push(`${live} in progress`);
  if (finals.length > 1) {
    const margin = (g) => Math.abs(g.home_team_score - g.visitor_team_score);
    const line = (g) => {
      const homeWon = g.home_team_score > g.visitor_team_score;
      const [w, l] = homeWon ? [g.home_team, g.visitor_team] : [g.visitor_team, g.home_team];
      return `${w.abbreviation} over ${l.abbreviation} by ${margin(g)}`;
    };
    const sorted = [...finals].sort((a, b) => margin(a) - margin(b));
    const average = finals.reduce((sum, g) => sum + margin(g), 0) / finals.length;
    parts.push(`closest was ${line(sorted[0])}`, `widest was ${line(sorted[sorted.length - 1])}`, `average margin ${average.toFixed(1)}`);
  }
  return `${parts.join(', ')}.`;
}

function renderDay(games, { live, failed }) {
  $('[data-day-title]').textContent = fmt(state.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const order = { in: 0, pre: 1, post: 2 };
  const sorted = [...games].sort((a, b) => order[a.state] - order[b.state] || String(a.datetime).localeCompare(String(b.datetime)));
  const book = $('[data-book]');
  if (sorted.length) {
    book.replaceChildren(...sorted.map(gameEntry));
  } else {
    const empty = el('li', 'book__empty');
    const art = el('img');
    art.src = 'assets/art/icon-net.webp';
    art.alt = '';
    art.width = 96;
    art.height = 96;
    empty.append(art, el('p', null, failed ? 'The live feed did not answer, and this date is not in the stored snapshot.' : 'No games on this date. The gym is dark.'));
    book.replaceChildren(empty);
  }
  $('[data-day-note]').textContent = dayNote(sorted);
  const sync = $('[data-sync]');
  if (live) sync.textContent = sorted.some((g) => g.state === 'in') ? 'Live. Updating every 20 seconds.' : `Read from ESPN at ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`;
  else sync.textContent = sorted.length ? 'Stored snapshot. The live feed did not answer.' : '';
}

/* ---------- Best lines ---------- */

// John Hollinger's Game Score: one number for a box score line.
export const gameScore = (s) =>
  s.pts + 0.4 * s.fgm - 0.7 * s.fga - 0.4 * (s.fta - s.ftm) + 0.7 * s.oreb + 0.3 * s.dreb + s.stl + 0.7 * s.ast + 0.7 * s.blk - 0.4 * s.pf - s.turnover;

async function renderLines(games, ticket) {
  const section = $('[data-lines]');
  const played = games.filter((g) => g.state !== 'pre');
  if (!played.length) {
    section.hidden = true;
    return;
  }
  const boxes = await Promise.all(
    played.map(async (game) => {
      if (state.boxes.has(game.id)) return state.boxes.get(game.id);
      try {
        const lines = statLinesFromSummary(await fetchSummary(game.id), game.id);
        if (game.state === 'post') state.boxes.set(game.id, lines);
        return lines;
      } catch {
        return [];
      }
    }),
  );
  if (ticket !== state.ticket) return;
  const rows = boxes
    .flat()
    .map((line) => ({ line, score: gameScore(line) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_LINES);
  if (!rows.length) {
    section.hidden = true;
    return;
  }
  const opponent = new Map();
  played.forEach((g) => {
    opponent.set(`${g.id}:${g.home_team.abbreviation}`, { opp: g.visitor_team.abbreviation, home: true });
    opponent.set(`${g.id}:${g.visitor_team.abbreviation}`, { opp: g.home_team.abbreviation, home: false });
  });
  const top = rows[0].score;
  $('[data-lines-body]').replaceChildren(
    ...rows.map(({ line, score }, index) => {
      const row = el('tr');
      const who = el('td', 'lines__player');
      const link = el('a', null, line.player.display_name);
      link.href = `game-tracker.html?gameId=${line.game.id}`;
      const versus = opponent.get(`${line.game.id}:${line.team.abbreviation}`);
      who.append(link, el('span', 'lines__team', `${line.team.abbreviation}${versus ? ` ${versus.home ? 'vs' : 'at'} ${versus.opp}` : ''}`));
      const gs = el('td', 'num lines__gs');
      const bar = el('span', 'lines__bar');
      bar.style.setProperty('--w', `${Math.max(0, score / top) * 100}%`);
      gs.append(bar, el('span', null, score.toFixed(1)));
      const pm = line.plus_minus;
      row.append(
        el('td', 'num rank', String(index + 1)), who, gs,
        el('td', 'num hide-s', line.min.split(':')[0]), el('td', 'num lines__pts', String(line.pts)),
        el('td', 'num', String(line.reb)), el('td', 'num', String(line.ast)),
        el('td', 'num hide-s', String(line.stl)), el('td', 'num hide-s', String(line.blk)),
        el('td', 'num hide-s', `${line.fgm}-${line.fga}`), el('td', 'num hide-s', `${line.fg3m}-${line.fg3a}`), el('td', 'num hide-s', `${line.ftm}-${line.fta}`),
        el('td', `num hide-s ${pm > 0 ? 'is-up' : pm < 0 ? 'is-down' : ''}`, `${pm > 0 ? '+' : pm < 0 ? '−' : ''}${Math.abs(pm)}`),
      );
      return row;
    }),
  );
  section.hidden = false;
}

/* ---------- Refresh loop ---------- */

async function refresh() {
  clearTimeout(state.timer);
  const ticket = (state.ticket += 1);
  const iso = state.date;
  const stored = state.snapshot.filter((g) => g.date === iso);
  const cached = state.days.get(iso);
  if (cached) renderDay(cached, { live: true });
  else {
    renderDay(stored, { live: false });
    $('[data-sync]').textContent = 'Reading the scoreboard…';
    $('[data-lines]').hidden = true;
  }

  let games;
  try {
    games = await fetchGames(iso);
    state.days.set(iso, games);
  } catch {
    if (ticket === state.ticket) renderDay(cached ?? stored, { live: false, failed: true });
    return;
  }
  if (ticket !== state.ticket) return;
  renderDay(games, { live: true });
  renderLines(games, ticket);
  if (!document.hidden && games.some((g) => g.state === 'in')) state.timer = setTimeout(refresh, LIVE_POLL_MS);
}

/* ---------- Boot ---------- */

$('[data-rail]').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-date]');
  if (button) go(button.dataset.date);
});
document.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => go(shiftIso(state.date, Number(button.dataset.step)))));
$('[data-date-input]').addEventListener('change', (event) => go(event.target.value));
$('[data-today]').addEventListener('click', () => go(today));
addEventListener('popstate', () => {
  const requested = new URLSearchParams(location.search).get('date');
  go(isIso(requested) ? requested : today, { push: false });
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh();
});
document.addEventListener('keydown', (event) => {
  if (event.target.closest('input, select, textarea') || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'ArrowLeft') go(shiftIso(state.date, -1));
  if (event.key === 'ArrowRight') go(shiftIso(state.date, 1));
});

renderRail();
fetch('data/live/league.json')
  .then((response) => (response.ok ? response.json() : {}))
  .catch(() => ({}))
  .then((league) => {
    state.snapshot = league.slate ?? [];
    state.ratings = new Map((league.power ?? []).map((t) => [t.team, t.rating]));
    refresh();
  });
