import { pathToFileURL } from "url";

import {
  fetchActiveRosters,
  MAX_ACTIVE_ROSTER,
  MIN_ACTIVE_ROSTER,
} from "../fetch/bdl_active_rosters.js";
import { TEAM_METADATA } from "../lib/teams.js";

function allowPreseason(): boolean {
  const v = process.env.ALLOW_PRESEASON_SIZES ?? "";
  const n = v.trim().toLowerCase();
  return n === "1" || n === "true" || n === "yes";
}

function preseasonMax(): number {
  const raw = Number(process.env.PRESEASON_ROSTER_MAX);
  // default 25 if not set or invalid
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 25;
}

async function verify(): Promise<void> {
  const rosters = await fetchActiveRosters();
  const empties = TEAM_METADATA.filter((team) => {
    const record = rosters[team.tricode];
    return !Array.isArray(record) || record.length === 0;
  });

  if (empties.length > 0) {
    const missingAbbrs = empties.map((team) => team.tricode).join(", ");
    throw new Error(
      `BDL verify failed: missing active rosters for ${empties.length} team(s) (${missingAbbrs})`,
    );
  }

  // Respect preseason bounds when enabled
  const maxAllowed = allowPreseason() ? preseasonMax() : MAX_ACTIVE_ROSTER;
  const minAllowed = MIN_ACTIVE_ROSTER;

  const outOfRange = TEAM_METADATA.filter((team) => {
    const record = rosters[team.tricode] ?? [];
    const len = record.length;
    return len < minAllowed || len > maxAllowed;
  });

  if (outOfRange.length > 0) {
    const sample = outOfRange.map((team) => `${team.tricode}:${rosters[team.tricode]?.length ?? 0}`);
    throw new Error(
      `BDL verify failed: roster size out of bounds (min=${minAllowed}, max=${maxAllowed}) — ${sample.join(", ")}`,
    );
  }

  console.log("BDL OK — all active rosters populated within expected bounds");
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
