import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { gameFromEvent, statLinesFromSummary } from "../../public/assets/js/espn.js";
import { buildLeaders, finalsForPower, parseAthleteStats, parseInjuries, parseRoster, parseStandings } from "./parse.mjs";

// Trimmed copies of real ESPN responses captured 2026-11-12.
const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../testdata/espn/${name}.json`, import.meta.url), "utf8"));

describe("ESPN translators", () => {
  it("normalises scoreboard events to the hub game shape", () => {
    const [game] = fixture("scoreboard").events.map(gameFromEvent);
    expect(game).toMatchObject({
      id: 401909976,
      date: "2026-11-12",
      season: 2026,
      season_type: "Regular Season",
      state: "pre",
      home_team: { id: 23, abbreviation: "PHI", full_name: "Philadelphia 76ers", record: "9-3" },
      visitor_team: { id: 28, abbreviation: "TOR" },
    });
    // A scheduled game carries its tip time as the status, as the old API did.
    expect(game.status).toBe(game.datetime);
  });

  it("reads standings rows with seed, record and splits", () => {
    const rows = parseStandings(fixture("standings"));
    expect(rows).toHaveLength(6);
    expect(rows.find((r) => r.team === "BOS")).toMatchObject({ conference: "East", seed: 1, wins: 10, losses: 2, home: "5-0", last10: "9-1", streak: "W5" });
    expect(rows.filter((r) => r.conference === "West")).toHaveLength(3);
  });

  it("reads rosters in the legacy rosters.json shape", () => {
    const roster = parseRoster(fixture("roster"));
    expect(roster).toHaveLength(3);
    expect(roster.find((p) => p.id === 4433188)).toMatchObject({ first_name: "Devin", last_name: "Carter", position: "G", height: "6-2", weight: "188" });
  });

  it("reads injuries, recovering the athlete id and game-time decisions", () => {
    const [first] = parseInjuries(fixture("injuries"));
    expect(first).toMatchObject({ player: "LeBron James", player_id: 1966, team_tricode: "PHI", injury: "Back" });
    expect(first.report_label).toMatch(/^Nov \d+$/);
  });

  it("reads season averages and ranks leaders", () => {
    const averages = parseAthleteStats(fixture("athlete_stats"));
    const rows = Object.values(averages);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.pts).toBeGreaterThan(10);
      expect(row.games_played).toBeGreaterThan(0);
      expect(row.team).toMatch(/^[A-Z]{3}$/);
    }
    const leaders = buildLeaders(averages, { top: 2 });
    expect(leaders.pts.rows).toHaveLength(2);
    expect(leaders.pts.rows[0].value).toBeGreaterThanOrEqual(leaders.pts.rows[1].value);
  });

  it("only feeds regular-season finals to the power index", () => {
    const games = fixture("scoreboard").events.map(gameFromEvent);
    expect(finalsForPower(games)).toEqual([]);
    const final = { ...games[0], state: "post", home_team_score: 110, visitor_team_score: 101 };
    expect(finalsForPower([final])).toEqual([
      { id: 401909976, date: "2026-11-12", home: "PHI", away: "TOR", homeScore: 110, awayScore: 101 },
    ]);
  });

  it("flattens a box score into one stat line per player", () => {
    const summary = {
      boxscore: {
        players: [
          {
            team: { id: "20", abbreviation: "PHI" },
            statistics: [
              {
                labels: ["MIN", "PTS", "FG", "3PT", "FT", "REB", "AST", "TO", "STL", "BLK", "OREB", "DREB", "PF", "+/-"],
                athletes: [
                  { athlete: { id: "1", displayName: "Test Guard", jersey: "0", position: { abbreviation: "G" } }, starter: true, stats: ["34", "27", "10-19", "3-8", "4-4", "5", "9", "2", "1", "0", "1", "4", "2", "+12"] },
                  { athlete: { id: "2", displayName: "Did Not Play" }, didNotPlay: true, stats: [] },
                ],
              },
            ],
          },
        ],
      },
    };
    const lines = statLinesFromSummary(summary, 99);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ min: "34:00", pts: 27, fgm: 10, fga: 19, fg3m: 3, fg3a: 8, ftm: 4, fta: 4, reb: 5, ast: 9, turnover: 2, plus_minus: 12, starter: true });
    expect(lines[0].player).toMatchObject({ id: 1, first_name: "Test", last_name: "Guard" });
    expect(lines[0].team.abbreviation).toBe("PHI");
  });
});
