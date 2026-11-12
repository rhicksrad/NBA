// Power index: a schedule-adjusted rating built only from final scores.
//
// Each team's rating is the points it would beat an average team by on a neutral
// floor. Solved iteratively: rating = mean(capped margin − home edge + opponent
// rating), with recent games weighted more and a small pull toward zero so a
// 3–0 start does not top the table. No inputs beyond who played, where, and the score.

export const HOME_EDGE = 2.4; // points; long-run NBA home margin
const MARGIN_CAP = 22; // garbage time says little about team strength
const HALF_LIFE_DAYS = 45; // a game this old counts half as much
const PRIOR_GAMES = 4; // phantom average-opponent games per team
const ITERATIONS = 60;

const DAY_MS = 86_400_000;
const capped = (margin) => Math.max(-MARGIN_CAP, Math.min(MARGIN_CAP, margin));

/**
 * @param {Array<{date:string, home:string, away:string, homeScore:number, awayScore:number}>} games finals only
 * @param {{asOf?: string}} [options] ISO date; games after it are ignored
 */
export function powerIndex(games, { asOf } = {}) {
  const cutoff = asOf ? Date.parse(`${asOf}T23:59:59Z`) : Infinity;
  const played = games
    .filter((g) => Number.isFinite(g.homeScore) && Number.isFinite(g.awayScore) && g.homeScore !== g.awayScore)
    .filter((g) => Date.parse(`${g.date}T12:00:00Z`) <= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!played.length) return [];

  const latest = Date.parse(`${played[played.length - 1].date}T12:00:00Z`);
  const teams = new Map();
  const entry = (abbr) => {
    if (!teams.has(abbr)) teams.set(abbr, { team: abbr, wins: 0, losses: 0, pf: 0, pa: 0, log: [], rating: 0 });
    return teams.get(abbr);
  };

  for (const g of played) {
    const age = (latest - Date.parse(`${g.date}T12:00:00Z`)) / DAY_MS;
    const weight = 0.5 ** (age / HALF_LIFE_DAYS);
    const margin = g.homeScore - g.awayScore;
    const home = entry(g.home);
    const away = entry(g.away);
    home.pf += g.homeScore; home.pa += g.awayScore;
    away.pf += g.awayScore; away.pa += g.homeScore;
    if (margin > 0) { home.wins += 1; away.losses += 1; } else { away.wins += 1; home.losses += 1; }
    home.log.push({ date: g.date, opp: g.away, home: true, margin, adj: capped(margin) - HOME_EDGE, weight });
    away.log.push({ date: g.date, opp: g.home, home: false, margin: -margin, adj: capped(-margin) + HOME_EDGE, weight });
  }

  for (let i = 0; i < ITERATIONS; i += 1) {
    const next = new Map();
    for (const t of teams.values()) {
      let sum = 0;
      let weightSum = PRIOR_GAMES;
      for (const g of t.log) {
        sum += g.weight * (g.adj + teams.get(g.opp).rating);
        weightSum += g.weight;
      }
      next.set(t.team, sum / weightSum);
    }
    // Re-centre so the league average stays at exactly zero.
    const mean = [...next.values()].reduce((a, b) => a + b, 0) / next.size;
    for (const t of teams.values()) t.rating = next.get(t.team) - mean;
  }

  return [...teams.values()]
    .map((t) => {
      const games = t.wins + t.losses;
      const sos = t.log.reduce((a, g) => a + teams.get(g.opp).rating, 0) / (t.log.length || 1);
      return {
        team: t.team,
        rating: round(t.rating, 2),
        wins: t.wins,
        losses: t.losses,
        net: round((t.pf - t.pa) / games, 1),
        sos: round(sos, 2),
        form: t.log.slice(-10).map((g) => ({ w: g.margin > 0, m: g.margin, opp: g.opp, home: g.home, date: g.date })),
      };
    })
    .sort((a, b) => b.rating - a.rating || b.wins - a.wins)
    .map((t, index) => ({ rank: index + 1, ...t }));
}

/** Chance the home side wins, from the rating gap (logistic, ~12-point scale). */
export function winProbability(homeRating, awayRating, { neutral = false } = {}) {
  const gap = homeRating - awayRating + (neutral ? 0 : HOME_EDGE);
  return 1 / (1 + 10 ** (-gap / 12));
}

function round(value, places) {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
