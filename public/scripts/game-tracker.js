// Game tracker: the score on the board, the four factors as a tape, and a full
// box score for each side. One ESPN summary request feeds the whole page and is
// re-read every 20 seconds while the game is live. Offline, the board still
// paints from the stored slate when it holds the game.
import { fetchSummary, gameFromSummary, statLinesFromSummary } from '../assets/js/espn.js';
import { getTeamLogo } from './team-logos.js';

const LIVE_POLL_MS = 20_000;
const $ = (selector) => document.querySelector(selector);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const logo = (abbreviation, size) => {
  const img = el('img');
  img.src = getTeamLogo(abbreviation);
  img.alt = '';
  img.width = size;
  img.height = size;
  return img;
};
const pct = (made, tried) => (tried > 0 ? `${((made / tried) * 100).toFixed(1)}%` : '');
const periodHead = (index) => (index < 4 ? String(index + 1) : index === 4 ? 'OT' : `${index - 3}OT`);

// John Hollinger's Game Score: one number for a box score line.
const gameScore = (s) =>
  s.pts + 0.4 * s.fgm - 0.7 * s.fga - 0.4 * (s.fta - s.ftm) + 0.7 * s.oreb + 0.3 * s.dreb + s.stl + 0.7 * s.ast + 0.7 * s.blk - 0.4 * s.pf - s.turnover;

let timer = null;

/* ---------- Board ---------- */

function renderBoard(game) {
  document.title = `${game.visitor_team.abbreviation} ${game.state === 'pre' ? 'at' : game.visitor_team_score} ${game.home_team.abbreviation}${game.state === 'pre' ? '' : ` ${game.home_team_score}`} | NBA Intelligence Hub`;
  $('[data-title]').textContent = `${game.visitor_team.name} at ${game.home_team.name}`;
  const status = game.state === 'in' ? game.time : game.state === 'post' ? game.time || 'Final' : game.datetime ? new Date(game.datetime).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : game.status;
  const day = game.date ? new Date(`${game.date}T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
  $('[data-when]').textContent = [status, day, game.venue].filter(Boolean).join(' · ');
  $('[data-when]').classList.toggle('is-live', game.state === 'in');

  const decided = game.state === 'post';
  [['away', game.visitor_team, game.visitor_team_score, game.home_team_score], ['home', game.home_team, game.home_team_score, game.visitor_team_score]].forEach(([side, team, score, other]) => {
    const host = $(`[data-side="${side}"]`);
    host.classList.toggle('is-lost', decided && score < other);
    host.replaceChildren(
      logo(team.abbreviation, 72),
      el('span', 'tape-side__abbr', team.abbreviation),
      el('span', 'tape-side__record', team.record ?? ''),
      el('span', 'tape-side__pct led', game.state === 'pre' ? '' : String(score)),
    );
  });

  const line = $('[data-linescore]');
  const periods = Math.max(4, game.home_team.linescores.length, game.visitor_team.linescores.length);
  if (game.state === 'pre' || !(game.home_team.linescores.length + game.visitor_team.linescores.length)) {
    line.hidden = true;
  } else {
    line.hidden = false;
    line.innerHTML = `<thead><tr><th scope="col"><span class="visually-hidden">Team</span></th>${Array.from({ length: periods }, (_, i) => `<th scope="col">${periodHead(i)}</th>`).join('')}<th scope="col">T</th></tr></thead>`;
    const body = el('tbody');
    [[game.visitor_team, game.visitor_team_score, game.home_team], [game.home_team, game.home_team_score, game.visitor_team]].forEach(([team, score, opponent]) => {
      const row = el('tr');
      const head = el('th', null, team.abbreviation);
      head.scope = 'row';
      row.append(head);
      for (let i = 0; i < periods; i += 1) {
        const value = team.linescores[i];
        row.append(el('td', value != null && value > (opponent.linescores[i] ?? -1) ? 'is-won' : '', value == null ? '' : String(value)));
      }
      row.append(el('td', 'is-total', String(score)));
      body.append(row);
    });
    line.append(body);
  }

  const preview = $('[data-preview]');
  preview.hidden = game.state !== 'pre';
  preview.href = `game-preview.html?gameId=${game.id}`;
}

/* ---------- Team math ---------- */

const SUM_KEYS = ['pts', 'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'oreb', 'dreb', 'reb', 'ast', 'stl', 'blk', 'turnover', 'pf'];
function totals(lines) {
  const sum = Object.fromEntries(SUM_KEYS.map((key) => [key, 0]));
  lines.forEach((line) => SUM_KEYS.forEach((key) => { sum[key] += line[key]; }));
  // The standard estimate: a possession ends in a shot, a turnover or free throws.
  sum.poss = sum.fga + 0.44 * sum.fta - sum.oreb + sum.turnover;
  return sum;
}

function renderFactors(game, away, home) {
  const section = $('[data-factors-section]');
  if (!away.fga || !home.fga) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  $('[data-factors-away]').textContent = game.visitor_team.abbreviation;
  $('[data-factors-home]').textContent = game.home_team.abbreviation;
  const one = (n) => n.toFixed(1);
  const share = (n) => `${(n * 100).toFixed(1)}%`;
  const rows = [
    ['Points per 100 possessions', (t) => (t.pts / t.poss) * 100, one, false, 'Offensive rating: points scored for every 100 possessions used'],
    ['Shooting (effective FG%)', (t) => (t.fgm + 0.5 * t.fg3m) / t.fga, share, false, 'Field goal percentage with a three counted as one and a half makes'],
    ['Turnovers per 100 possessions', (t) => (t.turnover / t.poss) * 100, one, true, null],
    ['Offensive rebounds won', (t, o) => t.oreb / (t.oreb + o.dreb || 1), share, false, 'Share of its own misses a team rebounded'],
    ['Free throw attempts per shot', (t) => t.fta / t.fga, (n) => n.toFixed(2), false, null],
    ['Assists on made shots', (t) => (t.fgm ? t.ast / t.fgm : 0), share, false, null],
    ['Possessions (estimated)', (t) => t.poss, one, null, 'Shots plus turnovers plus 0.44 of free throws, less offensive rebounds'],
  ];
  $('[data-factors]').replaceChildren(
    ...rows.map(([label, read, show, low, title]) => {
      const a = read(away, home);
      const h = read(home, away);
      const edge = low == null || a === h ? 0 : (a > h) !== low ? -1 : 1;
      const tr = el('tr');
      const head = el('th', 'tape__label', label);
      head.scope = 'row';
      if (title) head.title = title;
      tr.append(el('td', `tape__a${edge < 0 ? ' is-edge' : ''}`, show(a)), head, el('td', `tape__h${edge > 0 ? ' is-edge' : ''}`, show(h)));
      return tr;
    }),
  );
}

/* ---------- Box score ---------- */

function boxTable(team, lines, sum, best) {
  const wrap = el('section', 'box');
  const head = el('h2', 'team-col__name');
  head.append(logo(team.abbreviation, 36), document.createTextNode(team.full_name));
  const table = el('table', 'sheet box__sheet');
  table.innerHTML = '<thead><tr><th scope="col">Player</th><th scope="col" class="num">Min</th><th scope="col" class="num">Pts</th><th scope="col" class="num">Reb</th><th scope="col" class="num">Ast</th><th scope="col" class="num hide-s">Stl</th><th scope="col" class="num hide-s">Blk</th><th scope="col" class="num hide-s">TO</th><th scope="col" class="num hide-s">PF</th><th scope="col" class="num">FG</th><th scope="col" class="num">3PT</th><th scope="col" class="num">FT</th><th scope="col" class="num">+/−</th><th scope="col" class="num" title="Game Score: one number for the whole line">GmSc</th></tr></thead>';
  const body = el('tbody');
  const group = (label, rows) => {
    if (!rows.length) return;
    const divider = el('tr', 'box__group');
    const cell = el('th', null, label);
    cell.colSpan = 14;
    cell.scope = 'rowgroup';
    divider.append(cell);
    body.append(divider);
    rows.forEach((line) => {
      const tr = el('tr', line === best ? 'is-best' : '');
      const who = el('td', 'who');
      who.append(el('span', null, line.player.display_name), el('span', 'who__pos', line.player.position));
      const pm = line.plus_minus;
      tr.append(
        who, el('td', 'num', line.min.split(':')[0]), el('td', 'num pts', String(line.pts)), el('td', 'num', String(line.reb)), el('td', 'num', String(line.ast)),
        el('td', 'num hide-s', String(line.stl)), el('td', 'num hide-s', String(line.blk)), el('td', 'num hide-s', String(line.turnover)), el('td', 'num hide-s', String(line.pf)),
        el('td', 'num', `${line.fgm}-${line.fga}`), el('td', 'num', `${line.fg3m}-${line.fg3a}`), el('td', 'num', `${line.ftm}-${line.fta}`),
        el('td', `num ${pm > 0 ? 'is-up' : pm < 0 ? 'is-down' : ''}`, `${pm > 0 ? '+' : pm < 0 ? '−' : ''}${Math.abs(pm)}`),
        el('td', 'num gmsc', gameScore(line).toFixed(1)),
      );
      body.append(tr);
    });
  };
  const played = lines.filter((line) => line.min !== '0:00' || line.pts || line.fga);
  group('Starters', played.filter((line) => line.starter));
  group('Bench', played.filter((line) => !line.starter).sort((a, b) => parseInt(b.min, 10) - parseInt(a.min, 10)));
  const foot = el('tfoot');
  const tr = el('tr');
  const label = el('th', null, 'Team');
  label.scope = 'row';
  tr.append(
    label, el('td', 'num', ''), el('td', 'num pts', String(sum.pts)), el('td', 'num', String(sum.reb)), el('td', 'num', String(sum.ast)),
    el('td', 'num hide-s', String(sum.stl)), el('td', 'num hide-s', String(sum.blk)), el('td', 'num hide-s', String(sum.turnover)), el('td', 'num hide-s', String(sum.pf)),
    el('td', 'num', `${sum.fgm}-${sum.fga}`), el('td', 'num', `${sum.fg3m}-${sum.fg3a}`), el('td', 'num', `${sum.ftm}-${sum.fta}`), el('td', 'num', ''), el('td', 'num', ''),
  );
  const shooting = el('tr', 'box__pct');
  const blank = el('th', null, 'Shooting');
  blank.scope = 'row';
  shooting.append(blank, ...Array.from({ length: 8 }, (_, i) => el('td', i > 3 ? 'hide-s' : '')), el('td', 'num', pct(sum.fgm, sum.fga)), el('td', 'num', pct(sum.fg3m, sum.fg3a)), el('td', 'num', pct(sum.ftm, sum.fta)), el('td'), el('td'));
  foot.append(tr, shooting);
  table.append(body, foot);
  const scroll = el('div', 'sheet-scroll');
  scroll.append(table);
  wrap.append(head, scroll);
  return wrap;
}

function renderBox(game, lines) {
  const host = $('[data-box]');
  const note = $('[data-note]');
  if (!lines.length) {
    host.replaceChildren();
    $('[data-factors-section]').hidden = true;
    note.textContent = game.state === 'pre' ? 'The box score opens at tip-off.' : 'ESPN has not published a box score for this game.';
    return;
  }
  const byTeam = (team) => lines.filter((line) => line.team.abbreviation === team.abbreviation);
  const awayLines = byTeam(game.visitor_team);
  const homeLines = byTeam(game.home_team);
  const away = totals(awayLines);
  const home = totals(homeLines);
  const best = [...lines].sort((a, b) => gameScore(b) - gameScore(a))[0];
  renderFactors(game, away, home);
  host.replaceChildren(boxTable(game.visitor_team, awayLines, away, best), boxTable(game.home_team, homeLines, home, best));
  note.textContent = `Best line of the game: ${best.player.display_name}, ${best.pts} points, ${best.reb} rebounds, ${best.ast} assists, Game Score ${gameScore(best).toFixed(1)}.`;
}

/* ---------- Refresh ---------- */

async function refresh(gameId, stored) {
  clearTimeout(timer);
  const sync = $('[data-sync]');
  try {
    const summary = await fetchSummary(gameId);
    const game = gameFromSummary(summary, gameId);
    renderBoard(game);
    renderBox(game, statLinesFromSummary(summary, gameId));
    sync.textContent = game.state === 'in' ? 'Live. Updating every 20 seconds.' : `Read from ESPN at ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`;
    if (game.state === 'in' && !document.hidden) timer = setTimeout(() => refresh(gameId, stored), LIVE_POLL_MS);
  } catch {
    if (stored) {
      sync.textContent = 'Stored snapshot. The box score needs the live feed, which did not answer.';
    } else {
      $('[data-title]').textContent = 'Game not found';
      sync.textContent = 'This game is not in the stored snapshot and the live feed did not answer.';
    }
  }
}

async function boot() {
  const gameId = Number(new URLSearchParams(location.search).get('gameId'));
  if (!gameId) {
    $('[data-title]').textContent = 'No game chosen';
    $('[data-sync]').textContent = 'Pick a game from the Games page to open its box score.';
    return;
  }
  const league = await fetch('data/live/league.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const stored = (league.slate ?? []).find((g) => g.id === gameId) ?? null;
  if (stored) renderBoard(stored);
  refresh(gameId, stored);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh(gameId, stored);
  });
}

boot();
