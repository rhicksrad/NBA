import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import { TEAM_METADATA } from "../lib/teams.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const TEAMS_PATH = path.join(ROOT, "data/2025-26/canonical/teams.json");

type TeamEntry = {
  teamId: string;
  roster?: unknown;
};

function isNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

async function validateRosters(): Promise<void> {
  const raw = await readFile(TEAMS_PATH, "utf8");
  const parsed = JSON.parse(raw) as TeamEntry[];
  const rosterByTeamId = new Map(parsed.map((team) => [team.teamId, team.roster]));
  const missing: string[] = [];

  for (const team of TEAM_METADATA) {
    const roster = rosterByTeamId.get(team.teamId);
    if (!isNonEmptyArray(roster)) {
      missing.push(`${team.teamId} (${team.tricode})`);
    }
  }

  if (missing.length) {
    console.error("Empty rosters detected:");
    for (const entry of missing) {
      console.error(` - ${entry}`);
    }
    throw new Error("Canonical rosters must be populated for every NBA team");
  }

  console.log("Roster validation passed: all teams have active players.");
}

async function run(): Promise<void> {
  await validateRosters();
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export { validateRosters };
