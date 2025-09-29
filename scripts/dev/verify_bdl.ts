import { pathToFileURL } from "url";

import { fetchBallDontLieRosters } from "../fetch/bdl_rosters.js";
import { SEASON } from "../lib/season.js";
import { TEAM_METADATA } from "../lib/teams.js";

function resolveSeasonStartYear(season: string): number {
  const [start] = season.split("-");
  const parsed = Number.parseInt(start, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid season format: ${season}`);
  }
  return parsed;
}

async function verify(): Promise<void> {
  const targetSeason = resolveSeasonStartYear(SEASON);
  const roster = await fetchBallDontLieRosters(targetSeason);
  const empties = TEAM_METADATA.filter((team) => {
    const record = roster.teams[team.tricode];
    return !record || record.roster.length === 0;
  });

  if (empties.length > 4) {
    const missingAbbrs = empties.map((team) => team.tricode).join(", ");
    throw new Error(
      `BDL verify failed: ${empties.length} teams returned 0 players (${missingAbbrs})`,
    );
  }

  console.log(
    `BDL OK — ${TEAM_METADATA.length - empties.length} teams populated (${empties.length} empty)`,
  );
  if (empties.length > 0) {
    console.warn(`BDL empty rosters: ${empties.map((team) => team.tricode).join(", ")}`);
  }
}

function useCache(): boolean {
  const value = process.env.USE_BDL_CACHE;
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function inCi(): boolean {
  const value = process.env.CI;
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

async function run(): Promise<void> {
  try {
    await verify();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Missing BDL_API_KEY") && useCache()) {
      console.log("BDL check skipped — using cached data (USE_BDL_CACHE)");
      return;
    }
    if (message.includes("Missing BDL_API_KEY") && inCi()) {
      console.log("BDL check skipped — missing BDL_API_KEY in CI environment");
      return;
    }
    throw error;
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export { verify };
