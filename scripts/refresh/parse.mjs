// Pure translators from ESPN's public JSON to the hub's snapshot shapes.
// Kept free of I/O so they can be tested against saved payloads.
import { canonicalAbbreviation, teamFromEspn } from '../../public/assets/js/espn.js';

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** standings payload → flat rows, one per team. */
export function parseStandings(payload) {
  const rows = [];
  const visit = (node, conference) => {
    const label = /east/i.test(node?.name ?? '') ? 'East' : /west/i.test(node?.name ?? '') ? 'West' : conference;
    for (const entry of node?.standings?.entries ?? []) {
      const stat = (name) => entry.stats?.find((s) => s.name === name || s.type === name);
      const team = teamFromEspn(entry.team);
      rows.push({
        team: team.abbreviation,
        name: team.full_name,
        conference: team.conference ?? label ?? null,
        seed: num(stat('playoffSeed')?.value),
        wins: num(stat('wins')?.value) ?? 0,
        losses: num(stat('losses')?.value) ?? 0,
        pct: num(stat('winPercent')?.value),
        gb: stat('gamesBehind')?.displayValue ?? null,
        streak: stat('streak')?.displayValue ?? null,
        home: stat('Home')?.displayValue ?? stat('home')?.displayValue ?? null,
        road: stat('Road')?.displayValue ?? stat('road')?.displayValue ?? null,
        last10: stat('Last Ten Games')?.displayValue ?? stat('lasttengames')?.displayValue ?? null,
        ppg: num(stat('avgPointsFor')?.value),
        oppg: num(stat('avgPointsAgainst')?.value),
        diff: num(stat('differential')?.value),
        clinch: stat('clincher')?.displayValue ?? null,
      });
    }
    for (const child of node?.children ?? []) visit(child, label);
  };
  visit(payload, null);
  return rows.sort((a, b) => (a.conference ?? '').localeCompare(b.conference ?? '') || (a.seed ?? 99) - (b.seed ?? 99) || b.wins - a.wins);
}

const feetInches = (display) => {
  const m = String(display ?? '').match(/(\d+)'\s*(\d+)?/);
  return m ? `${m[1]}-${m[2] ?? 0}` : null;
};

/** team roster payload → roster rows in the shape rosters.json has always used. */
export function parseRoster(payload) {
  const flat = (payload?.athletes ?? []).flatMap((a) => (Array.isArray(a?.items) ? a.items : [a]));
  return flat
    .filter((a) => a?.id && (a.displayName || a.fullName))
    .map((a) => ({
      id: Number(a.id),
      first_name: a.firstName ?? String(a.displayName ?? a.fullName).split(' ')[0],
      last_name: a.lastName ?? String(a.displayName ?? a.fullName).split(' ').slice(1).join(' '),
      position: a.position?.abbreviation ?? null,
      jersey_number: a.jersey ?? null,
      height: feetInches(a.displayHeight),
      weight: a.displayWeight ? String(a.displayWeight).replace(/\s*lbs?/i, '') : null,
      age: num(a.age),
      experience: num(a.experience?.years),
      college: a.college?.name ?? null,
      headshot: a.headshot?.href ?? null,
    }))
    .sort((a, b) => a.last_name.localeCompare(b.last_name));
}

const shortDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
};

/** league injuries payload → rows in the shape player_injuries.json has always used. */
export function parseInjuries(payload) {
  const items = [];
  for (const group of payload?.injuries ?? []) {
    for (const injury of group?.injuries ?? []) {
      const team = teamFromEspn(injury?.athlete?.team ?? { abbreviation: group?.abbreviation, displayName: group?.displayName });
      const detail = injury?.details ?? {};
      // ESPN files game-time decisions under "Out"; the fantasy flag tells them apart.
      const gameTime = detail.fantasyStatus?.abbreviation === 'GTD';
      const status = gameTime ? 'Day-to-day' : injury?.status ?? injury?.type?.description ?? 'Out';
      const athleteLink = injury?.athlete?.links?.find((link) => /\/id\/\d+/.test(link?.href ?? ''))?.href ?? '';
      items.push({
        player: injury?.athlete?.displayName ?? 'Unknown',
        player_id: num(injury?.athlete?.id) ?? num(athleteLink.match(/\/id\/(\d+)/)?.[1]),
        status,
        status_level: /out for (the )?season|season-ending/i.test(`${injury?.longComment ?? ''} ${status}`) ? 'season' : gameTime || /day/i.test(status) ? 'caution' : 'out',
        team_tricode: team.abbreviation && team.id ? team.abbreviation : canonicalAbbreviation(group?.abbreviation) || null,
        team_name: team.id ? team.full_name : group?.displayName ?? null,
        injury: [detail.side, detail.type, detail.detail].filter((part) => part && part !== 'Not Specified').join(' ') || null,
        return_date: detail.returnDate ? shortDate(detail.returnDate) : null,
        description: injury?.shortComment ?? injury?.longComment ?? '',
        report_label: injury?.date ? shortDate(injury.date) : null,
        reported_at: injury?.date ?? null,
      });
    }
  }
  return items.sort((a, b) => String(b.reported_at ?? '').localeCompare(String(a.reported_at ?? '')));
}

/**
 * statistics/byathlete payload → per-player season averages keyed by athlete id,
 * using the field names the player pages already read (pts, reb, ast, …).
 */
export function parseAthleteStats(payload) {
  const categories = payload?.categories ?? [];
  const out = {};
  for (const row of payload?.athletes ?? []) {
    const values = {};
    for (const cat of row?.categories ?? []) {
      const names = cat.names ?? categories.find((c) => c.name === cat.name)?.names ?? [];
      const source = cat.values ?? cat.totals ?? [];
      names.forEach((name, i) => { values[`${cat.name}.${name}`] = num(source[i]); });
    }
    const pick = (...keys) => {
      for (const key of keys) if (values[key] != null) return values[key];
      return null;
    };
    const athlete = row?.athlete ?? {};
    if (!athlete.id) continue;
    out[athlete.id] = {
      player_id: Number(athlete.id),
      name: athlete.displayName ?? null,
      team: canonicalAbbreviation(athlete.teamShortName ?? athlete.teams?.[0]?.abbreviation ?? ''),
      position: athlete.position?.abbreviation ?? null,
      headshot: athlete.headshot?.href ?? null,
      games_played: pick('general.gamesPlayed'),
      min: pick('general.avgMinutes'),
      pts: pick('offensive.avgPoints'),
      reb: pick('general.avgRebounds'),
      ast: pick('offensive.avgAssists'),
      stl: pick('defensive.avgSteals'),
      blk: pick('defensive.avgBlocks'),
      turnover: pick('offensive.avgTurnovers'),
      fg_pct: pick('offensive.fieldGoalPct'),
      fg3_pct: pick('offensive.threePointFieldGoalPct', 'offensive.threePointPct'),
      ft_pct: pick('offensive.freeThrowPct'),
      fg3m: pick('offensive.avgThreePointFieldGoalsMade'),
    };
  }
  return out;
}

const LEADER_BOARDS = [
  ['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['stl', 'Steals'], ['blk', 'Blocks'], ['fg3m', 'Threes made'],
];

/** Top-N per category from the season averages, with a games-played floor. */
export function buildLeaders(averages, { top = 5, minGamesShare = 0.58 } = {}) {
  const players = Object.values(averages);
  const maxGames = Math.max(0, ...players.map((p) => p.games_played ?? 0));
  const floor = Math.max(1, Math.floor(maxGames * minGamesShare));
  const eligible = players.filter((p) => (p.games_played ?? 0) >= floor);
  return Object.fromEntries(
    LEADER_BOARDS.map(([key, label]) => [
      key,
      {
        label,
        rows: eligible
          .filter((p) => p[key] != null)
          .sort((a, b) => b[key] - a[key])
          .slice(0, top)
          .map((p) => ({ player_id: p.player_id, name: p.name, team: p.team, value: p[key], games: p.games_played })),
      },
    ]),
  );
}

/** Scoreboard games (hub shape) → the minimal final-score rows the power index reads. */
export function finalsForPower(games) {
  return games
    .filter((g) => g.state === 'post' && g.season_type === 'Regular Season' && g.home_team.id && g.visitor_team.id)
    .map((g) => ({ id: g.id, date: g.date, home: g.home_team.abbreviation, away: g.visitor_team.abbreviation, homeScore: g.home_team_score, awayScore: g.visitor_team_score }));
}
