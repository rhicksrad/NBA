import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { RosterTeam, RostersDoc } from "../types/ball";
import { getActivePlayersByTeam, getTeams } from "./fetch/bdl.js";
import type { BdlPlayer } from "./fetch/bdl.js";
import { SEASON, getSeasonStartYear } from "./lib/season.js";

const MANUAL_ROSTER_PATH = path.join(
  process.cwd(),
  "data",
  "2025-26",
  "manual",
  "roster_reference.json",
);
const CANONICAL_TEAMS_PATH = path.join(
  process.cwd(),
  "data",
  "2025-26",
  "canonical",
  "teams.json",
);
const OUT_DIR = path.join(process.cwd(), "public", "data");
const OUT_FILE = path.join(OUT_DIR, "rosters.json");
const FAIL_FILE = path.join(OUT_DIR, "rosters.failed.json");
const HASH_FILE = path.join(OUT_DIR, "rosters.sha256");

function parseTTL(): number {
  const arg = process.argv
    .slice(2)
    .map((token) => token.trim())
    .find((token) => /ttl=/.test(token));

  const fromArgRaw = arg ? Number(arg.replace(/^[^=]*=/, "")) : Number.NaN;
  if (!Number.isNaN(fromArgRaw) && fromArgRaw > 0) {
    return Math.floor(fromArgRaw);
  }

  const fromEnvRaw = Number(process.env.DATA_TTL_HOURS);
  if (!Number.isNaN(fromEnvRaw) && fromEnvRaw > 0) {
    return Math.floor(fromEnvRaw);
  }

  return 6;
}

const TTL_HOURS = parseTTL();
const TARGET_SEASON_START_YEAR = getSeasonStartYear(SEASON);

type JsonValue = Record<string, unknown>;

type ManualRosterEntry = {
  playerId: string;
  firstName: string;
  lastName: string;
  teamId: string;
  teamTricode?: string;
  position?: string | null;
};

type CanonicalTeam = {
  teamId?: string;
  tricode?: string;
  market?: string;
  name?: string;
};

async function readJSON<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    return null;
  }
}

async function writeJSON(p: string, data: unknown): Promise<string> {
  const payload = JSON.stringify(data, null, 2);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, `${payload}\n`);
  return payload;
}

async function writeFailure(reason: JsonValue) {
  await fs.mkdir(path.dirname(FAIL_FILE), { recursive: true });
  const payload = JSON.stringify(
    {
      ...reason,
      at: new Date().toISOString(),
    },
    null,
    2,
  );
  await fs.writeFile(FAIL_FILE, `${payload}\n`);
}

async function clearFailureFile() {
  try {
    await fs.unlink(FAIL_FILE);
  } catch (err) {
    // ignore
  }
}

function normalizePlayer(player: BdlPlayer): RosterTeam["roster"][number] {
  return {
    id: player.id,
    first_name: player.first_name,
    last_name: player.last_name,
    position: player.position ?? null,
    jersey_number: player.jersey_number ?? null,
    height: player.height ?? null,
    weight: player.weight ?? null,
  };
}

function isCacheFresh(doc: RostersDoc | null): boolean {
  if (!doc?.fetched_at || !doc?.ttl_hours) {
    return false;
  }
  const freshUntil = new Date(doc.fetched_at).getTime() + doc.ttl_hours * 3_600_000;
  return Number.isFinite(freshUntil) && Date.now() < freshUntil;
}

function formatFailure(reason: string, details: JsonValue = {}): JsonValue {
  return {
    error: reason,
    ...details,
  };
}

async function writeHash(jsonString: string) {
  const hash = createHash("sha256").update(jsonString).digest("hex");
  await fs.mkdir(path.dirname(HASH_FILE), { recursive: true });
  await fs.writeFile(HASH_FILE, `${hash}\n`);
  return hash;
}

class RosterFetchError extends Error {
  reason: string;
  details: JsonValue;

  constructor(reason: string, message: string, details: JsonValue = {}) {
    super(message);
    this.reason = reason;
    this.details = details;
  }
}

async function buildRosterFromBallDontLie(): Promise<RostersDoc> {
  const teams = await getTeams();
  if (!teams.length) {
    throw new RosterFetchError("no_teams", "No teams returned by API.");
  }

  const rosterTeams: RosterTeam[] = [];
  const failedTeams: Array<{ id: number; code: string; error: unknown }> = [];
  let totalPlayers = 0;

  console.log(
    `Fetching Ball Don't Lie active rosters for ${SEASON} (season start ${TARGET_SEASON_START_YEAR}).`,
  );

  for (const team of teams) {
    try {
      const rawPlayers = await getActivePlayersByTeam(team.id);
      const roster = rawPlayers.map(normalizePlayer).sort((a, b) => {
        const aName = `${a.last_name} ${a.first_name}`.toLowerCase();
        const bName = `${b.last_name} ${b.first_name}`.toLowerCase();
        return aName.localeCompare(bName);
      });
      totalPlayers += roster.length;
      rosterTeams.push({
        id: team.id,
        abbreviation: team.abbreviation,
        full_name: team.full_name,
        roster,
      });
      console.log(`${team.abbreviation}: ${roster.length} active players`);
      if (roster.length < 10 || roster.length > 22) {
        console.warn(`Suspicious roster size for ${team.abbreviation}: ${roster.length}`);
      }
    } catch (error) {
      failedTeams.push({ id: team.id, code: team.abbreviation, error });
      console.error(`Error fetching roster for ${team.abbreviation}:`, error);
    }
  }

  if (failedTeams.length) {
    throw new RosterFetchError("team_fetch_failed", "Failed to fetch one or more team rosters.", {
      failed: failedTeams.map((entry) => entry.code),
    });
  }

  if (totalPlayers < 360 || totalPlayers > 600) {
    throw new RosterFetchError("suspicious_total", "Suspicious league player count detected.", {
      totalPlayers,
    });
  }

  rosterTeams.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));

  return {
    fetched_at: new Date().toISOString(),
    ttl_hours: TTL_HOURS,
    source: "ball_dont_lie",
    season: SEASON,
    season_start_year: TARGET_SEASON_START_YEAR,
    teams: rosterTeams,
  };
}

function normalizeManualPosition(position?: string | null): string | null {
  const trimmed = position?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

async function buildRosterFromManualReference(): Promise<RostersDoc | null> {
  const manualEntries = await readJSON<ManualRosterEntry[]>(MANUAL_ROSTER_PATH);
  if (!Array.isArray(manualEntries) || !manualEntries.length) {
    return null;
  }

  const canonicalTeams = await readJSON<CanonicalTeam[]>(CANONICAL_TEAMS_PATH);
  const teamMetadata = new Map<string, { id: number; abbr: string; name: string }>();
  if (Array.isArray(canonicalTeams)) {
    canonicalTeams.forEach((team) => {
      const teamId = Number.parseInt(team.teamId ?? "", 10);
      const abbr = (team.tricode ?? "").toUpperCase();
      const displayName = [team.market, team.name]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part && part.length))
        .join(" ")
        .trim();

      if (Number.isFinite(teamId)) {
        teamMetadata.set(String(teamId), {
          id: teamId,
          abbr: abbr || String(teamId),
          name: displayName || abbr || `Team ${teamId}`,
        });
      }

      if (abbr) {
        teamMetadata.set(abbr, {
          id: Number.isFinite(teamId) ? teamId : 0,
          abbr,
          name: displayName || abbr,
        });
      }
    });
  }

  const teams = new Map<string, RosterTeam>();

  for (const entry of manualEntries) {
    const playerId = Number.parseInt(entry.playerId, 10);
    if (!Number.isFinite(playerId)) {
      continue;
    }

    const teamId = Number.parseInt(entry.teamId, 10);
    if (!Number.isFinite(teamId)) {
      continue;
    }

    const teamKey = entry.teamTricode?.toUpperCase() ?? String(teamId);
    const metadata =
      teamMetadata.get(entry.teamId) ??
      teamMetadata.get(teamKey) ?? {
        id: teamId,
        abbr: teamKey,
        name: teamKey,
      };

    if (!teams.has(metadata.abbr)) {
      teams.set(metadata.abbr, {
        id: metadata.id,
        abbreviation: metadata.abbr,
        full_name: metadata.name,
        roster: [],
      });
    }

    const rosterTeam = teams.get(metadata.abbr)!;
    rosterTeam.roster.push({
      id: playerId,
      first_name: entry.firstName?.trim() ?? "",
      last_name: entry.lastName?.trim() ?? "",
      position: normalizeManualPosition(entry.position),
      jersey_number: null,
      height: null,
      weight: null,
    });
  }

  if (!teams.size) {
    return null;
  }

  const rosterTeams = Array.from(teams.values()).map((team) => ({
    ...team,
    roster: team.roster.sort((a, b) => {
      const aName = `${a.last_name} ${a.first_name}`.toLowerCase();
      const bName = `${b.last_name} ${b.first_name}`.toLowerCase();
      return aName.localeCompare(bName);
    }),
  }));

  rosterTeams.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));

  return {
    fetched_at: new Date().toISOString(),
    ttl_hours: TTL_HOURS,
    source: "manual_roster_reference",
    season: SEASON,
    season_start_year: TARGET_SEASON_START_YEAR,
    teams: rosterTeams,
  };
}

async function main() {
  const existing = await readJSON<RostersDoc>(OUT_FILE);
  if (isCacheFresh(existing)) {
    console.log("rosters.json cache still fresh; skipping fetch");
    return;
  }

  let doc: RostersDoc | null = null;
  let fetchError: RosterFetchError | null = null;
  try {
    doc = await buildRosterFromBallDontLie();
  } catch (error) {
    if (error instanceof RosterFetchError) {
      fetchError = error;
      console.warn(`Ball Don't Lie roster fetch failed (${error.reason}): ${error.message}`);
    } else {
      const message = error instanceof Error ? error.message : String(error);
      fetchError = new RosterFetchError("exception", message);
      console.warn(`Ball Don't Lie roster fetch raised an exception: ${message}`);
    }
  }

  let usedManualFallback = false;
  if (!doc) {
    doc = await buildRosterFromManualReference();
    if (doc) {
      usedManualFallback = true;
      console.warn(
        "Falling back to manual roster reference at data/2025-26/manual/roster_reference.json.",
      );
    }
  }

  if (!doc) {
    const failurePayload = formatFailure(fetchError?.reason ?? "no_roster_sources", {
      ...(fetchError?.details ?? {}),
      message: fetchError?.message ?? "Unable to build roster snapshot from any source.",
    });
    await writeFailure(failurePayload);
    console.warn("Aborting roster write; no roster data sources succeeded.");
    return;
  }

  const jsonString = await writeJSON(OUT_FILE, doc);
  const hash = await writeHash(jsonString);

  if (usedManualFallback && fetchError) {
    await writeFailure(
      formatFailure(fetchError.reason, {
        ...(fetchError.details ?? {}),
        message: fetchError.message,
        fallback: "manual_roster_reference",
      }),
    );
  } else {
    await clearFailureFile();
  }

  const teamCount = doc.teams.reduce((sum, team) => sum + team.roster.length, 0);
  const sourceLabel = usedManualFallback ? "manual reference" : "Ball Don't Lie";
  console.log(
    `Wrote ${OUT_FILE} with ${teamCount} players (${sourceLabel}; sha256 ${hash.slice(0, 8)}…).`,
  );
}

main().catch(async (error) => {
  console.error("Roster fetch run failed:", error);
  await writeFailure(formatFailure("exception", { message: String(error) }));
});
