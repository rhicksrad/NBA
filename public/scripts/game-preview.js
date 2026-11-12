// Game preview: a tale of the tape. Everything here is read from the stored
// league snapshot (power index, standings, injuries, season averages), so the
// page paints offline; ESPN is only asked for a game the snapshot does not hold.
import { fetchSummary, gameFromSummary } from '../assets/js/espn.js';
import { getTeamLogo } from './team-logos.js';

const HOME_EDGE = 2.4;
const $ = (selector) => document.querySelector(selector);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const signed = (value, places = 1) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(places)}`;
const json = (url) => fetch(url).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
const logo = (abbreviation, size) => {
  const img = el('img');
  img.src = getTeamLogo(abbreviation);
  img.alt = '';
  img.width = size;
  img.height = size;
  return img;
};

function fail(message) {
  $('[data-title]').textContent = 'No preview';
  $('[data-when]').textContent = message;
  $('[data-body]').hidden = true;
}

/* ---------- Header board ---------- */

function renderBoard(game, away, home, chance) {
  document.title = `${game.visitor_team.abbreviation} at ${game.home_team.abbreviation} preview | NBA Intelligence Hub`;
  $('[data-title]').textContent = `${game.visitor_team.name} at ${game.home_team.name}`;
  const tip = game.datetime ? new Date(game.datetime) : null;
  const when = tip ? tip.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  $('[data-when]').textContent = [when, game.venue, game.broadcast].filter(Boolean).join(' · ');

  [['away', game.visitor_team, away], ['home', game.home_team, home]].forEach(([side, team, row], index) => {
    const host = $(`[data-side="${side}"]`);
    const p = chance == null ? null : index ? chance : 1 - chance;
    host.replaceChildren(
      logo(team.abbreviation, 72),
      el('span', 'tape-side__abbr', team.abbreviation),
      el('span', 'tape-side__record', row.standing ? `${row.standing.wins}-${row.standing.losses}` : team.record ?? ''),
      el('span', 'tape-side__pct led', p == null ? '' : `${Math.round(p * 100)}%`),
    );
  });
  const bar = $('[data-odds]');
  if (chance == null) bar.hidden = true;
  else {
    bar.style.setProperty('--away', `${(1 - chance) * 100}%`);
    bar.setAttribute('aria-label', `Win chance: ${game.visitor_team.abbreviation} ${Math.round((1 - chance) * 100)} percent, ${game.home_team.abbreviation} ${Math.round(chance * 100)} percent`);
  }
  if (game.state !== 'pre') {
    const link = $('[data-started]');
    link.hidden = false;
    link.href = `game-tracker.html?gameId=${game.id}`;
    link.textContent = game.state === 'post' ? 'This game is final. See the box score' : 'This game is under way. Follow it live';
  }
}

/* ---------- The tape ---------- */

const winPct = (record) => {
  const [w, l] = String(record ?? '').split('-').map(Number);
  return Number.isFinite(w) && Number.isFinite(l) && w + l > 0 ? w / (w + l) : null;
};

function renderTape(game, away, home) {
  // Each row: label, away text, home text, and numbers to compare (higher wins unless `low`).
  const rows = [];
  const add = (label, a, h, { av, hv, low = false, title } = {}) => {
    if (a == null && h == null) return;
    rows.push({ label, a: a ?? '', h: h ?? '', av, hv, low, title });
  };
  const s = (row) => row.standing;
  const p = (row) => row.power;
  if (s(away) && s(home)) {
    add('Record', `${s(away).wins}-${s(away).losses}`, `${s(home).wins}-${s(home).losses}`, { av: s(away).pct, hv: s(home).pct });
    add('Conference seed', `${s(away).seed} ${s(away).conference}`, `${s(home).seed} ${s(home).conference}`);
  }
  if (p(away) && p(home)) {
    add('Power index', `${signed(p(away).rating)} (${p(away).rank})`, `${signed(p(home).rating)} (${p(home).rank})`, { av: p(away).rating, hv: p(home).rating, title: 'Schedule-adjusted points better than an average team, with league rank' });
    add('Scoring margin', signed(p(away).net), signed(p(home).net), { av: p(away).net, hv: p(home).net });
    add('Schedule faced', signed(p(away).sos), signed(p(home).sos), { title: 'Average power rating of opponents so far. Higher is harder.' });
  }
  if (s(away) && s(home)) {
    add('Points scored', s(away).ppg?.toFixed(1), s(home).ppg?.toFixed(1), { av: s(away).ppg, hv: s(home).ppg });
    add('Points allowed', s(away).oppg?.toFixed(1), s(home).oppg?.toFixed(1), { av: s(away).oppg, hv: s(home).oppg, low: true });
    add('Tonight’s setting', `${s(away).road} on the road`, `${s(home).home} at home`, { av: winPct(s(away).road), hv: winPct(s(home).home) });
    add('Last ten', s(away).last10, s(home).last10, { av: winPct(s(away).last10), hv: winPct(s(home).last10) });
    add('Streak', s(away).streak, s(home).streak);
  }
  const body = $('[data-tape]');
  if (!rows.length) {
    $('[data-tape-section]').hidden = true;
    return;
  }
  $('[data-tape-away]').textContent = game.visitor_team.abbreviation;
  $('[data-tape-home]').textContent = game.home_team.abbreviation;
  body.replaceChildren(
    ...rows.map((row) => {
      const tr = el('tr');
      const edge = row.av == null || row.hv == null || row.av === row.hv ? 0 : (row.av > row.hv) !== row.low ? -1 : 1;
      const label = el('th', 'tape__label', row.label);
      label.scope = 'row';
      if (row.title) label.title = row.title;
      tr.append(el('td', `tape__a${edge < 0 ? ' is-edge' : ''}`, row.a), label, el('td', `tape__h${edge > 0 ? ' is-edge' : ''}`, row.h));
      return tr;
    }),
  );
  const awayEdges = body.querySelectorAll('.tape__a.is-edge').length;
  const homeEdges = body.querySelectorAll('.tape__h.is-edge').length;
  $('[data-tape-note]').textContent = awayEdges === homeEdges
    ? 'The marked side has the better number on each line. The lines split evenly.'
    : `The marked side has the better number on each line: ${awayEdges > homeEdges ? game.visitor_team.abbreviation : game.home_team.abbreviation} leads ${Math.max(awayEdges, homeEdges)} to ${Math.min(awayEdges, homeEdges)}.`;
}

/* ---------- Per-team columns ---------- */

function formTable(row) {
  const form = row.power?.form ?? [];
  if (!form.length) return el('p', 'sheet__empty', 'No finals yet this season.');
  const table = el('table', 'sheet form-sheet');
  const body = el('tbody');
  [...form].reverse().forEach((g) => {
    const tr = el('tr');
    const bar = el('td', 'form-sheet__bar');
    const fill = el('i', g.w ? 'w' : 'l');
    fill.style.setProperty('--w', `${Math.min(1, Math.abs(g.m) / 30) * 100}%`);
    bar.append(fill);
    tr.append(
      el('td', 'form-sheet__date', new Date(`${g.date}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })),
      el('td', 'form-sheet__opp', `${g.home ? 'vs' : 'at'} ${g.opp}`),
      el('td', `form-sheet__res ${g.w ? 'w' : 'l'}`, `${g.w ? 'W' : 'L'} ${Math.abs(g.m)}`),
      bar,
    );
    body.append(tr);
  });
  table.append(body);
  return table;
}

function scorersTable(players) {
  if (!players.length) return el('p', 'sheet__empty', 'Season averages are not in the snapshot.');
  const table = el('table', 'sheet');
  table.innerHTML = '<thead><tr><th scope="col">Player</th><th scope="col" class="num">Min</th><th scope="col" class="num">Pts</th><th scope="col" class="num">Reb</th><th scope="col" class="num">Ast</th></tr></thead>';
  const body = el('tbody');
  players.forEach((player) => {
    const tr = el('tr');
    const name = el('td', 'who');
    name.append(el('span', null, player.name), el('span', 'who__pos', player.position ?? ''));
    tr.append(name, el('td', 'num', player.min.toFixed(1)), el('td', 'num pts', player.pts.toFixed(1)), el('td', 'num', player.reb.toFixed(1)), el('td', 'num', player.ast.toFixed(1)));
    body.append(tr);
  });
  table.append(body);
  return table;
}

function injuryList(injuries) {
  if (!injuries.length) return el('p', 'sheet__empty', 'Nobody on the injury report.');
  const list = el('ul', 'hurt');
  injuries.forEach((injury) => {
    const item = el('li', `hurt__item level-${injury.status_level}`);
    item.append(el('strong', null, injury.player), el('span', 'hurt__status', [injury.status, injury.injury].filter(Boolean).join(', ')));
    list.append(item);
  });
  return list;
}

function renderTeam(side, team, row) {
  const host = $(`[data-team="${side}"]`);
  const head = el('h2', 'team-col__name');
  head.append(logo(team.abbreviation, 36), document.createTextNode(team.full_name));
  const block = (title, node) => {
    const wrap = el('div', 'team-col__block');
    wrap.append(el('h3', null, title), node);
    return wrap;
  };
  host.replaceChildren(
    head,
    block('Last ten games', formTable(row)),
    block('Leading scorers', scorersTable(row.scorers)),
    block('Injury report', injuryList(row.injuries)),
  );
}

/* ---------- Boot ---------- */

async function boot() {
  const gameId = Number(new URLSearchParams(location.search).get('gameId'));
  if (!gameId) return fail('Pick a game from the Games page to see its preview.');
  const [league, averages] = await Promise.all([json('data/live/league.json'), json('data/live/season_averages.json')]);

  let game = (league.slate ?? []).find((g) => g.id === gameId);
  if (!game) {
    try {
      game = gameFromSummary(await fetchSummary(gameId), gameId);
    } catch {
      return fail('This game is not in the stored snapshot and the live feed did not answer.');
    }
  }

  const gather = (team) => ({
    standing: (league.standings ?? []).find((s) => s.team === team.abbreviation) ?? null,
    power: (league.power ?? []).find((p) => p.team === team.abbreviation) ?? null,
    injuries: (league.injuries ?? []).filter((i) => i.team_tricode === team.abbreviation),
    scorers: Object.values(averages.players ?? {}).filter((p) => p.team === team.abbreviation && p.games_played > 0).sort((a, b) => b.pts - a.pts).slice(0, 6),
  });
  const away = gather(game.visitor_team);
  const home = gather(game.home_team);
  const chance = away.power && home.power ? 1 / (1 + 10 ** (-(home.power.rating - away.power.rating + HOME_EDGE) / 12)) : null;

  renderBoard(game, away, home, chance);
  renderTape(game, away, home);
  renderTeam('away', game.visitor_team, away);
  renderTeam('home', game.home_team, home);
  if (league.generatedAt) {
    $('[data-stamp]').textContent = `Tables built ${new Date(league.generatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} from ESPN's public feeds. Win chance comes from the hub's power index plus ${HOME_EDGE} points for the home floor.`;
  }
}

boot();
