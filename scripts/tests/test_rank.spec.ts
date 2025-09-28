import { describe, expect, it } from "vitest";
import { rankTeams } from "../generate/rank.js";
import { RankedTeam, TeamRecord, PlayerRecord, InjuryRecord } from "../lib/types.js";

describe("rankTeams", () => {
  it("produces a deterministic ranking snapshot", () => {
    const teams: TeamRecord[] = [
      {
        teamId: "1",
        tricode: "AAA",
        market: "Alpha",
        name: "Anchors",
        coach: { name: "Casey" },
        lastSeasonWins: 50,
        lastSeasonSRS: 4.2,
        roster: [
          { name: "Alex Prime", position: "G", teamId: "1", teamTricode: "AAA" },
          { name: "Brian Bolt", position: "F", teamId: "1", teamTricode: "AAA" },
        ],
        keyAdditions: ["Alex Prime"],
        keyLosses: [],
        notes: [],
      },
      {
        teamId: "2",
        tricode: "BBB",
        market: "Bravo",
        name: "Blazers",
        coach: { name: "Dana", isNew: true },
        lastSeasonWins: 38,
        lastSeasonSRS: -0.5,
        roster: [
          { name: "Chris Craft", position: "G", teamId: "2", teamTricode: "BBB" },
          { name: "Devon Dash", position: "F", teamId: "2", teamTricode: "BBB" },
        ],
        keyAdditions: ["Chris Craft"],
        keyLosses: ["Jamie Jump"],
        notes: [],
      },
      {
        teamId: "3",
        tricode: "CCC",
        market: "Charlie",
        name: "Chargers",
        coach: { name: "Evan" },
        lastSeasonWins: 28,
        lastSeasonSRS: -3.1,
        roster: [
          { name: "Frank Flash", position: "G", teamId: "3", teamTricode: "CCC" },
        ],
        keyAdditions: [],
        keyLosses: ["Kelly Kinetics"],
        notes: [],
      },
    ];

    const players: PlayerRecord[] = teams.flatMap((team) => team.roster);
    const injuries: InjuryRecord[] = [
      { playerName: "Chris Craft", status: "Day-to-day", severity: "medium" },
    ];

    const rankings: RankedTeam[] = rankTeams({ teams, players, injuries });

    expect(rankings).toMatchSnapshot();
  });
});
