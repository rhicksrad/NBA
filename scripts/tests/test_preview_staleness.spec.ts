import { describe, expect, it } from "vitest";
import { collectStaleNames } from "../validate/previews_staleness.js";

describe("collectStaleNames", () => {
  it("flags names not belonging to the preview team", () => {
    const players = new Map([
      ["LeBron James", { teamTricode: "LAL" }],
      ["Anthony Davis", { teamTricode: "DAL" }],
    ]);
    const preview = "LeBron James controls the pace while Anthony Davis is no longer in purple and gold.";
    const stale = collectStaleNames(preview, "LAL", players);
    expect(stale).toContain("Anthony Davis");
    expect(stale).not.toContain("LeBron James");
  });
});
