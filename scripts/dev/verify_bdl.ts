import { pathToFileURL } from "url";

import {
  PRESEASON_DEFAULT_MAX,
  REGULAR_SEASON_MAX,
  REGULAR_SEASON_MIN,
  fetchActiveRosters,
  getLastActiveRosterFetchMeta,
} from "../fetch/bdl_active_rosters.js";
import { requireBallDontLieKey } from "../fetch/http.js";
import { TEAM_METADATA } from "../lib/teams.js";

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function allowPreseason(): boolean {
  const raw = process.env.ALLOW_PRESEASON_SIZES;
  if (raw === undefined) {
    return true;
  }
  return parseBoolean(raw);
}

function preseasonMax(): number {
  const raw = Number(process.env.PRESEASON_ROSTER_MAX);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : PRESEASON_DEFAULT_MAX;
}

function useCache(): boolean {
  return parseBoolean(process.env.USE_BDL_CACHE);
}

function inCi(): boolean {
  return parseBoolean(process.env.CI);
}

async function verify(): Promise<void> {
  requireBallDontLieKey();
  const rosters = await fetchActiveRosters();

  const missing = TEAM_METADATA.filter((team) => !Array.isArray(rosters[team.tricode]));
  if (missing.length > 0) {
    const missingCodes = missing.map((team) => team.tricode).join(", ");
    throw new Error(
      `BDL verify failed: missing active roster entries for ${missing.length} team(s) (${missingCodes})`,
    );
  }

  const preseason = allowPreseason();
  const minAllowed = REGULAR_SEASON_MIN;
  const maxAllowed = preseason ? preseasonMax() : REGULAR_SEASON_MAX;

  if (preseason) {
    console.log(`BDL verify: preseason roster bounds (min=${minAllowed}, max=${maxAllowed}).`);
  } else {
    console.log(`BDL verify: regular-season roster bounds (min=${minAllowed}, max=${maxAllowed}).`);
  }

  const outOfRange = TEAM_METADATA.reduce<Array<{ tricode: string; size: number }>>((acc, team) => {
    const tricode = team.tricode;
    const roster = rosters[tricode] ?? [];
    const size = roster.length;
    if (!Array.isArray(roster) || size === 0) {
      throw new Error(`BDL verify failed: empty roster for ${tricode}`);
    }
    if (size < minAllowed || size > maxAllowed) {
      acc.push({ tricode, size });
    }
    return acc;
  }, []);

  if (outOfRange.length > 0) {
    const summary = outOfRange.map(({ tricode, size }) => `${tricode}:${size}`).join(", ");
    if (preseason) {
      console.warn(
        `BDL verify: preseason roster bounds exceeded (min=${minAllowed}, max=${maxAllowed}) — ${summary}`,
      );
    } else {
      throw new Error(
        `BDL verify failed: roster size out of bounds (min=${minAllowed}, max=${maxAllowed}) — ${summary}`,
      );
    }
  }

  const meta = getLastActiveRosterFetchMeta();
  if (meta) {
    const multiPage = meta.totalPlayers > meta.maxPageSize;
    if (multiPage && !meta.usedNextCursor) {
      throw new Error(
        `BDL verify failed: pagination incomplete — total_players=${meta.totalPlayers}, max_page_size=${meta.maxPageSize}, cursor_used=${meta.usedNextCursor}`,
      );
    }
    console.log(
      `BDL verify: pagination summary pages=${meta.pages}, per_page=${meta.perPage}, total_players=${meta.totalPlayers}, used_cursor=${meta.usedNextCursor}`,
    );
  }

  console.log("BDL OK — all active rosters populated within expected bounds");
}

async function run(): Promise<void> {
  try {
    await verify();
  } catch (error) {
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
