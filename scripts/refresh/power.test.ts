import { describe, expect, it } from "vitest";

import { powerIndex, winProbability } from "./power.mjs";

const game = (date: string, home: string, away: string, homeScore: number, awayScore: number) => ({
  date, home, away, homeScore, awayScore,
});

describe("powerIndex", () => {
  it("returns nothing without finals", () => {
    expect(powerIndex([])).toEqual([]);
  });

  it("ranks by schedule-adjusted margin, centred on zero", () => {
    const table = powerIndex([
      game("2026-10-21", "AAA", "BBB", 110, 100),
      game("2026-10-23", "BBB", "CCC", 112, 100),
      game("2026-10-25", "CCC", "AAA", 95, 108),
      game("2026-10-27", "BBB", "AAA", 101, 104),
    ]);
    expect(table.map((t) => t.team)).toEqual(["AAA", "BBB", "CCC"]);
    expect(table[0]).toMatchObject({ rank: 1, wins: 3, losses: 0 });
    const mean = table.reduce((a, t) => a + t.rating, 0) / table.length;
    expect(Math.abs(mean)).toBeLessThan(0.02);
  });

  it("caps blowouts so one rout cannot outweigh steady wins", () => {
    const steady = powerIndex([game("2026-11-01", "AAA", "BBB", 110, 88)]);
    const rout = powerIndex([game("2026-11-01", "AAA", "BBB", 150, 88)]);
    expect(rout[0].rating).toBeCloseTo(steady[0].rating, 5);
  });

  it("honours the as-of cutoff for week-over-week movement", () => {
    const games = [game("2026-11-01", "AAA", "BBB", 100, 90), game("2026-11-09", "BBB", "AAA", 120, 90)];
    expect(powerIndex(games, { asOf: "2026-11-02" })[0].team).toBe("AAA");
    expect(powerIndex(games)[0].team).toBe("BBB");
  });

  it("keeps the last ten results as form", () => {
    const games = Array.from({ length: 12 }, (_, i) =>
      game(`2026-11-${String(i + 1).padStart(2, "0")}`, "AAA", "BBB", 100 + i, 99),
    );
    const aaa = powerIndex(games).find((t) => t.team === "AAA")!;
    expect(aaa.form).toHaveLength(10);
    expect(aaa.form.every((f) => f.w)).toBe(true);
  });
});

describe("winProbability", () => {
  it("gives the home side the edge between equals and is symmetric on neutral floors", () => {
    expect(winProbability(0, 0)).toBeGreaterThan(0.5);
    expect(winProbability(0, 0, { neutral: true })).toBeCloseTo(0.5, 6);
    expect(winProbability(6, -6, { neutral: true }) + winProbability(-6, 6, { neutral: true })).toBeCloseTo(1, 6);
  });
});
