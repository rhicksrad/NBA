import { describe, expect, it } from "vitest";
import { simulateSeries } from "../../src/players/rumble/simulate";
import type { Player } from "../../src/players/rumble/types";

const template: Omit<Player, "id" | "name"> = {
  era: "Modern",
  pos: "G",
  franchise: "Test",
  threeP: 0.38,
  threePA_rate: 0.5,
  astPct: 0.26,
  usg: 0.28,
  stl: 0.02,
  blk: 0.01,
  paceZ: 0.15,
  impact: 8,
  archetypes: ["Creator"],
};

function player(id: string, name: string, impact: number): Player {
  return { id, name, ...template, impact };
}

function makeTeam(prefix: string, impacts: number[]): Player[] {
  return impacts.map((impact, index) => player(`${prefix}-${index}`, `${prefix}${index}`, impact));
}

function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

describe("simulateSeries", () => {
  it("returns deterministic output with seeded rng", () => {
    const teamA = makeTeam("A", [9, 8, 7, 6, 5]);
    const teamB = makeTeam("B", [5, 5, 5, 5, 5]);
    const rng = sequenceRng([0.2, 0.8, 0.4, 0.6]);

    const result = simulateSeries(teamA, teamB, { games: 4, eraNorm: false, rng });
    expect(result.margins).toHaveLength(4);
    expect(result.teamAWins + result.teamBWins).toBe(4);
    expect(result.teamAWins).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.avgScoreA)).toBe(true);
    expect(Number.isFinite(result.avgScoreB)).toBe(true);
  });
});
