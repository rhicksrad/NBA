#!/usr/bin/env node
// Rebuilds the live snapshots under public/data from free, keyless endpoints.
// Run by the scheduled Pages deploy. Each feed is independent: if one fails,
// the previous snapshot of that feed is kept and the others still update.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TEAMS, fetchGames, getJson, leagueDate } from '../../public/assets/js/espn.js';
import { buildLeaders, finalsForPower, parseAthleteStats, parseInjuries, parseRoster, parseStandings } from './parse.mjs';
import { powerIndex } from './power.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, '../../public/data');
const CACHE = resolve(HERE, '.cache');
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const SITE_V2 = 'https://site.api.espn.com/apis/v2/sports/basketball/nba';
const WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba';

const now = new Date();
const today = leagueDate(now);
// A season starts in October: Nov 2026 is season 2026 (2026-27), Mar 2027 still is.
const seasonStart = Number(today.slice(5, 7)) >= 10 ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1;
const seasonLabel = `${seasonStart}-${String(seasonStart + 1).slice(-2)}`;
const shift = (iso, days) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const report = {};
async function feed(name, task) {
  try {
    const value = await task();
    report[name] = 'ok';
    return value;
  } catch (error) {
    report[name] = `failed: ${error.message}`;
    console.warn(`[refresh] ${name} failed, keeping previous snapshot: ${error.message}`);
    return null;
  }
}
const readJson = (path) => readFile(resolve(DATA, path), 'utf8').then(JSON.parse, () => null);
async function writeJson(path, value) {
  const target = resolve(DATA, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value)}\n`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function seasonGames() {
  // ESPN rejects multi-day ranges, so the season is read one day at a time.
  // Days that are over never change, so they are kept in a cache between runs.
  const cachePath = resolve(CACHE, `games-${seasonStart}.json`);
  const cache = await readFile(cachePath, 'utf8').then(JSON.parse, () => ({}));
  const days = [];
  for (let day = `${seasonStart}-10-01`; day <= shift(today, 3); day = shift(day, 1)) days.push(day);
  const stale = days.filter((day) => !cache[day] || day >= shift(today, -2));
  for (let i = 0; i < stale.length; i += 6) {
    const batch = stale.slice(i, i + 6);
    const results = await Promise.all(batch.map((day) => fetchGames(day)));
    batch.forEach((day, index) => { cache[day] = results[index]; });
    await sleep(200);
  }
  await mkdir(CACHE, { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache));
  console.log(`[refresh] scoreboard: ${stale.length} day(s) fetched, ${days.length - stale.length} from cache`);
  return days.flatMap((day) => cache[day] ?? []);
}

async function allAthleteStats() {
  const merged = {};
  for (let page = 1; page <= 12; page += 1) {
    const params = new URLSearchParams({
      region: 'us', lang: 'en', contentorigin: 'espn', isqualified: 'false', limit: '200', page: String(page),
      sort: 'offensive.avgPoints:desc', season: String(seasonStart + 1), seasontype: '2',
    });
    const payload = await getJson(`${WEB}/statistics/byathlete?${params}`);
    Object.assign(merged, parseAthleteStats(payload));
    if (page >= (payload?.pagination?.pages ?? 1)) break;
    await sleep(150);
  }
  if (!Object.keys(merged).length) throw new Error('no athlete rows');
  return merged;
}

async function allRosters() {
  const directory = await getJson(`${SITE}/teams?limit=40`);
  const espnTeams = directory?.sports?.[0]?.leagues?.[0]?.teams?.map((t) => t.team) ?? [];
  const byAbbreviation = new Map(espnTeams.map((t) => [t.abbreviation, t.id]));
  const alias = { GSW: 'GS', NOP: 'NO', NYK: 'NY', SAS: 'SA', UTA: 'UTAH', WAS: 'WSH' };
  const teams = [];
  for (const team of TEAMS) {
    const espnId = byAbbreviation.get(team.abbreviation) ?? byAbbreviation.get(alias[team.abbreviation]);
    if (!espnId) throw new Error(`no ESPN id for ${team.abbreviation}`);
    const roster = parseRoster(await getJson(`${SITE}/teams/${espnId}/roster`));
    if (roster.length < 8) throw new Error(`${team.abbreviation} roster has only ${roster.length} players`);
    teams.push({ id: team.id, abbreviation: team.abbreviation, full_name: team.full_name, roster });
    await sleep(120);
  }
  return teams;
}

const games = await feed('scoreboard', seasonGames);
const standings = await feed('standings', async () => {
  const rows = parseStandings(await getJson(`${SITE_V2}/standings?season=${seasonStart + 1}`));
  if (rows.length < 30) throw new Error(`only ${rows.length} standings rows`);
  return rows;
});
const averages = await feed('season_averages', allAthleteStats);
const injuries = await feed('injuries', async () => parseInjuries(await getJson(`${SITE}/injuries`)));
const rosters = await feed('rosters', allRosters);

const previous = (await readJson('live/league.json')) ?? {};
const league = { ...previous, generatedAt: now.toISOString(), season: seasonStart, seasonLabel, source: 'ESPN public JSON (no key)', feeds: report };

if (games) {
  const finals = finalsForPower(games);
  const current = powerIndex(finals);
  const weekAgo = new Map(powerIndex(finals, { asOf: shift(today, -7) }).map((t) => [t.team, t.rank]));
  league.power = current.map((t) => ({ ...t, previousRank: weekAgo.get(t.team) ?? null }));
  league.gamesPlayed = finals.length;
  // The slate the home page paints before live data arrives: yesterday through two days out.
  league.slate = games.filter((g) => g.date >= shift(today, -1) && g.date <= shift(today, 2)).sort((a, b) => String(a.datetime).localeCompare(String(b.datetime)));
  league.slateDate = today;
}
if (standings) league.standings = standings;
if (averages) league.leaders = buildLeaders(averages);
if (injuries) league.injuries = injuries.slice(0, 60);

await writeJson('live/league.json', league);
if (averages) {
  await writeJson('live/season_averages.json', { generatedAt: now.toISOString(), season: seasonStart, seasonLabel, players: averages });
}
if (injuries) {
  await writeJson('player_injuries.json', { fetched_at: now.toISOString(), source: 'ESPN', items: injuries, note: 'Source: ESPN public injury report.' });
}
if (rosters) {
  await writeJson('rosters.json', {
    fetched_at: now.toISOString(), ttl_hours: 6, source: 'espn', season: seasonLabel, season_start_year: seasonStart, teams: rosters,
  });
}

console.log('[refresh]', JSON.stringify(report));
// Fail only when nothing at all could be refreshed; partial data still ships.
if (Object.values(report).every((status) => status !== 'ok')) process.exit(1);
