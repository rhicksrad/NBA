// Home page. Paints from the committed snapshot first (instant, works offline),
// then swaps in live scores straight from ESPN and keeps polling while games run.
import { fetchGames, leagueDate } from '../assets/js/espn.js';
import { getTeamLogo } from './team-logos.js';

const LIVE_POLL_MS = 20_000;
const IDLE_POLL_MS = 5 * 60_000;
const HOME_EDGE = 2.4;

const $ = (selector) => document.querySelector(selector);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const state = { league: null, ratings: new Map(), dayOffset: 0, games: new Map(), timer: null };

const shiftIso = (iso, days) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const tipTime = (datetime) => new Date(datetime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const signed = (value, places = 1) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(places)}`;

function homeWinChance(game) {
  const home = state.ratings.get(game.home_team.abbreviation);
  const away = state.ratings.get(game.visitor_team.abbreviation);
  if (home == null || away == null) return null;
  return 1 / (1 + 10 ** (-(home - away + HOME_EDGE) / 12));
}

/* ---------- Scoreboard ---------- */

function teamRow(team, score, { showScore, lost, favoured }) {
  const row = el('div', `tile__team${lost ? ' is-lost' : ''}`);
  const logo = el('img', 'tile__logo');
  logo.src = getTeamLogo(team.abbreviation);
  logo.alt = '';
  logo.width = 28;
  logo.height = 28;
  logo.loading = 'lazy';
  const name = el('span', 'tile__abbr', team.abbreviation);
  name.title = team.full_name;
  const record = el('span', 'tile__record', team.record ?? '');
  const points = el('span', 'tile__score led', showScore ? String(score) : favoured ?? '');
  if (!showScore) points.classList.add('tile__score--pre');
  row.append(logo, name, record, points);
  return row;
}

function gameTile(game) {
  const item = el('li', `tile tile--${game.state}`);
  const link = el('a', 'tile__link');
  link.href = `${game.state === 'pre' ? 'game-preview' : 'game-tracker'}.html?gameId=${game.id}`;

  const status = el('p', 'tile__status');
  if (game.state === 'in') {
    status.append(el('span', 'tile__live', 'Live'), document.createTextNode(` ${game.time}`));
  } else if (game.state === 'post') {
    status.textContent = game.time || 'Final';
  } else {
    status.textContent = /^\d{4}-/.test(game.status) ? tipTime(game.datetime) : game.status;
  }

  const showScore = game.state !== 'pre';
  const chance = showScore ? null : homeWinChance(game);
  const pct = (p) => `${Math.round(p * 100)}%`;
  const decided = game.state === 'post';
  link.append(
    status,
    teamRow(game.visitor_team, game.visitor_team_score, {
      showScore, lost: decided && game.visitor_team_score < game.home_team_score, favoured: chance == null ? null : pct(1 - chance),
    }),
    teamRow(game.home_team, game.home_team_score, {
      showScore, lost: decided && game.home_team_score < game.visitor_team_score, favoured: chance == null ? null : pct(chance),
    }),
  );

  if (chance != null) {
    const bar = el('div', 'tile__odds');
    bar.style.setProperty('--away', `${(1 - chance) * 100}%`);
    bar.title = `Power index win chance: ${game.visitor_team.abbreviation} ${pct(1 - chance)}, ${game.home_team.abbreviation} ${pct(chance)}`;
    link.append(bar);
  } else if (game.headline || game.broadcast) {
    link.append(el('p', 'tile__note', game.headline ?? game.broadcast));
  }
  item.append(link);
  return item;
}

function renderBoard(iso, games, { live }) {
  const list = $('[data-board-games]');
  $('[data-board-title]').textContent = longDate(iso);
  list.replaceChildren();
  if (!games.length) {
    list.append(el('li', 'board__empty', 'No games on this date.'));
  } else {
    const order = { in: 0, pre: 1, post: 2 };
    [...games]
      .sort((a, b) => order[a.state] - order[b.state] || String(a.datetime).localeCompare(String(b.datetime)))
      .forEach((game) => list.append(gameTile(game)));
  }
  const inProgress = games.filter((g) => g.state === 'in').length;
  const sync = $('[data-board-sync]');
  if (live) {
    sync.textContent = inProgress ? `${inProgress} in progress. Updating every 20 seconds.` : `Updated ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`;
  } else if (state.league?.generatedAt) {
    sync.textContent = `Snapshot from ${new Date(state.league.generatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. Live feed unreachable.`;
  } else {
    sync.textContent = '';
  }
  return inProgress;
}

async function refreshBoard() {
  clearTimeout(state.timer);
  const iso = shiftIso(leagueDate(), state.dayOffset);
  const snapshot = (state.league?.slate ?? []).filter((g) => g.date === iso);
  if (!state.games.has(iso) && snapshot.length) renderBoard(iso, snapshot, { live: false });

  let inProgress = 0;
  try {
    const games = await fetchGames(iso);
    state.games.set(iso, games);
    if (iso === shiftIso(leagueDate(), state.dayOffset)) inProgress = renderBoard(iso, games, { live: true });
  } catch {
    renderBoard(iso, state.games.get(iso) ?? snapshot, { live: false });
  }
  if (!document.hidden) state.timer = setTimeout(refreshBoard, inProgress ? LIVE_POLL_MS : IDLE_POLL_MS);
}

/* ---------- Power index ---------- */

function formDots(form) {
  const wrap = el('span', 'form');
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', `Last ${form.length}: ${form.filter((f) => f.w).length} wins`);
  form.forEach((f) => {
    const dot = el('i', f.w ? 'w' : 'l');
    // Bar height carries the margin, so a blowout and a squeaker read differently.
    dot.style.setProperty('--h', `${Math.min(1, Math.abs(f.m) / 25) * 100}%`);
    dot.title = `${f.w ? 'W' : 'L'} ${f.home ? 'vs' : 'at'} ${f.opp} by ${Math.abs(f.m)}`;
    wrap.append(dot);
  });
  return wrap;
}

function renderPower(power) {
  const body = $('[data-power-body]');
  if (!power?.length) {
    body.replaceChildren(Object.assign(el('tr'), { innerHTML: '<td colspan="8" class="sheet__empty">Ratings appear once the season has finals to read.</td>' }));
    return;
  }
  const max = Math.max(...power.map((t) => Math.abs(t.rating)), 1);
  body.replaceChildren(
    ...power.map((t) => {
      const row = el('tr');
      const move = t.previousRank == null ? 0 : t.previousRank - t.rank;
      const moveCell = el('td', `move ${move > 0 ? 'up' : move < 0 ? 'down' : ''}`, move === 0 ? '' : `${move > 0 ? '▲' : '▼'}${Math.abs(move)}`);
      if (move) moveCell.title = `${move > 0 ? 'Up' : 'Down'} ${Math.abs(move)} from a week ago`;

      const team = el('td', 'team');
      const logo = el('img');
      logo.src = getTeamLogo(t.team);
      logo.alt = '';
      logo.width = 24;
      logo.height = 24;
      logo.loading = 'lazy';
      team.append(logo, el('span', null, t.team));

      const rating = el('td', 'num rating');
      const bar = el('span', `rating__bar ${t.rating >= 0 ? 'pos' : 'neg'}`);
      bar.style.setProperty('--w', `${(Math.abs(t.rating) / max) * 100}%`);
      rating.append(bar, el('span', 'rating__value', signed(t.rating)));

      const form = el('td', 'form-cell');
      form.append(formDots(t.form ?? []));

      row.append(
        el('td', 'num rank', String(t.rank)), moveCell, team,
        el('td', 'num', `${t.wins}–${t.losses}`), rating,
        el('td', 'num hide-s', signed(t.net)), el('td', 'num hide-s', signed(t.sos)), form,
      );
      return row;
    }),
  );
}

/* ---------- Leaders, injuries, standings ---------- */

function renderLeaders(leaders) {
  const host = $('[data-leaders]');
  const boards = Object.values(leaders ?? {}).filter((board) => board.rows?.length);
  if (!boards.length) {
    host.replaceChildren(el('p', 'sheet__empty', 'Leaders appear once players have enough games.'));
    return;
  }
  host.replaceChildren(
    ...boards.map((board) => {
      const box = el('div', 'leaders__board');
      box.append(el('h3', null, board.label));
      const list = el('ol');
      board.rows.forEach((row, index) => {
        const item = el('li', index === 0 ? 'is-first' : '');
        item.append(el('span', 'leaders__name', row.name), el('span', 'leaders__team', row.team), el('span', 'leaders__value', row.value.toFixed(1)));
        list.append(item);
      });
      box.append(list);
      return box;
    }),
  );
}

function renderInjuries(injuries) {
  const host = $('[data-injuries]');
  if (!injuries?.length) {
    host.replaceChildren(el('li', 'sheet__empty', 'No injury reports in the latest snapshot.'));
    return;
  }
  host.replaceChildren(
    ...injuries.slice(0, 12).map((injury) => {
      const item = el('li', `injuries__item level-${injury.status_level}`);
      const head = el('p', 'injuries__head');
      head.append(el('strong', null, injury.player), el('span', 'injuries__team', injury.team_tricode ?? ''), el('span', 'injuries__status', injury.status));
      item.append(head);
      if (injury.description) item.append(el('p', 'injuries__note', injury.description));
      return item;
    }),
  );
}

function renderStandings(standings) {
  const host = $('[data-standings]');
  if (!standings?.length) {
    host.replaceChildren(el('p', 'sheet__empty', 'Standings are not in the latest snapshot.'));
    return;
  }
  host.replaceChildren(
    ...['East', 'West'].map((conference) => {
      const rows = standings.filter((r) => r.conference === conference);
      const table = el('table', 'sheet standings__table');
      table.innerHTML = `<caption>${conference}</caption><thead><tr><th scope="col" class="num">#</th><th scope="col">Team</th><th scope="col" class="num">W</th><th scope="col" class="num">L</th><th scope="col" class="num">Pct</th><th scope="col" class="num">GB</th><th scope="col" class="num hide-s">Home</th><th scope="col" class="num hide-s">Road</th><th scope="col" class="num hide-s">L10</th><th scope="col" class="num">Strk</th></tr></thead>`;
      const body = el('tbody');
      rows.forEach((r, index) => {
        const seed = r.seed ?? index + 1;
        const row = el('tr', seed === 6 ? 'cut cut--in' : seed === 10 ? 'cut cut--playin' : '');
        const team = el('td', 'team');
        const logo = el('img');
        logo.src = getTeamLogo(r.team);
        logo.alt = '';
        logo.width = 22;
        logo.height = 22;
        logo.loading = 'lazy';
        team.append(logo, el('span', 'team__full', r.name), el('span', 'team__abbr', r.team));
        row.append(
          el('td', 'num rank', String(seed)), team, el('td', 'num', String(r.wins)), el('td', 'num', String(r.losses)),
          el('td', 'num', r.pct != null ? r.pct.toFixed(3).replace(/^0/, '') : ''), el('td', 'num', r.gb ?? ''),
          el('td', 'num hide-s', r.home ?? ''), el('td', 'num hide-s', r.road ?? ''), el('td', 'num hide-s', r.last10 ?? ''),
          el('td', `num ${/^W/.test(r.streak ?? '') ? 'streak-w' : 'streak-l'}`, r.streak ?? ''),
        );
        body.append(row);
      });
      table.append(body);
      const wrap = el('div', 'sheet-scroll');
      wrap.append(table);
      return wrap;
    }),
  );
}

/* ---------- Boot ---------- */

function renderLeague(league) {
  state.league = league;
  state.ratings = new Map((league.power ?? []).map((t) => [t.team, t.rating]));
  renderPower(league.power);
  renderLeaders(league.leaders);
  renderInjuries(league.injuries);
  renderStandings(league.standings);
  if (league.seasonLabel) {
    $('[data-leaders-note]').textContent = `Per game, ${league.seasonLabel}.`;
    if (league.gamesPlayed) $('[data-power-note]').textContent = `Points better than an average team on a neutral floor, adjusted for schedule and weighted toward recent games. Built from ${league.gamesPlayed.toLocaleString()} finals in ${league.seasonLabel}.`;
  }
  if (league.generatedAt) {
    $('[data-footer-stamp]').textContent = `Scores, standings and injuries from ESPN's public feeds. Tables rebuilt ${new Date(league.generatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`;
  }
}

document.querySelectorAll('[data-day]').forEach((button) => {
  button.addEventListener('click', () => {
    state.dayOffset = Number(button.dataset.day);
    document.querySelectorAll('[data-day]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    refreshBoard();
  });
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshBoard();
});

fetch('data/live/league.json')
  .then((response) => (response.ok ? response.json() : {}))
  .catch(() => ({}))
  .then((league) => {
    renderLeague(league);
    refreshBoard();
  });
