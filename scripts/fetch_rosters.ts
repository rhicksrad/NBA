import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import type { BLPlayer, BLTeam, RosterTeam, RostersDoc } from "../types/ball";

const API = "https://api.balldontlie.io/v1";
const KEY = process.env.BALLDONTLIE_API_KEY ?? "";
const OUT_DIR = path.join(process.cwd(), "public", "data");
const OUT_FILE = path.join(OUT_DIR, "rosters.json");
const FAIL_FILE = path.join(OUT_DIR, "rosters.failed.json");
const HASH_FILE = path.join(OUT_DIR, "rosters.sha256");
const MAX_ATTEMPTS = 4;

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

type JsonValue = Record<string, unknown>;

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

async function http<T = JsonValue>(url: string, attempt = 1): Promise<T> {
  const headers: Record<string, string> = KEY ? { Authorization: KEY } : {};
  try {
    const res = await fetch(url, { headers });
    if (res.status === 429 && attempt < MAX_ATTEMPTS) {
      const delay = 500 * Math.pow(2, attempt - 1);
      await sleep(delay);
      return http<T>(url, attempt + 1);
    }
    if (!res.ok) {
      if (attempt < MAX_ATTEMPTS) {
        const delay = 500 * Math.pow(2, attempt - 1);
        await sleep(delay);
        return http<T>(url, attempt + 1);
      }
      throw new Error(`${res.status} ${res.statusText} for ${url}`);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (attempt < MAX_ATTEMPTS) {
      const delay = 500 * Math.pow(2, attempt - 1);
      await sleep(delay);
      return http<T>(url, attempt + 1);
    }
    throw error;
  }
}

async function getTeams(): Promise<BLTeam[]> {
  const response = await http<{ data: BLTeam[] }>(`${API}/teams`);
  return response.data ?? [];
}

interface PaginatedPlayers {
  data: BLPlayer[];
  meta?: {
    next_cursor?: number | null;
  };
}

async function getActivePlayersByTeam(teamId: number): Promise<BLPlayer[]> {
  const players: BLPlayer[] = [];
  let cursor: number | undefined;
  const baseUrl = `${API}/players/active?team_ids[]=${teamId}&per_page=100`;

  while (true) {
    const url = cursor != null ? `${baseUrl}&cursor=${cursor}` : baseUrl;
    const json = await http<PaginatedPlayers>(url);
    if (Array.isArray(json.data)) {
      players.push(...json.data);
    }
    const nextCursor = json.meta?.next_cursor ?? null;
    if (!nextCursor) {
      break;
    }
    cursor = nextCursor;
    await sleep(125);
  }

  return players;
}

function normalizePlayer(player: BLPlayer): RosterTeam["roster"][number] {
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

async function main() {
  const existing = await readJSON<RostersDoc>(OUT_FILE);
  if (isCacheFresh(existing)) {
    console.log("rosters.json cache still fresh; skipping fetch");
    return;
  }

  const teams = await getTeams();
  if (!teams.length) {
    console.warn("No teams returned by API; keeping existing roster cache.");
    await writeFailure(formatFailure("no_teams"));
    return;
  }

  const rosterTeams: RosterTeam[] = [];
  const failedTeams: Array<{ id: number; code: string; error: unknown }> = [];
  let totalPlayers = 0;

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
      await sleep(100);
    } catch (error) {
      failedTeams.push({ id: team.id, code: team.abbreviation, error });
      console.error(`Error fetching roster for ${team.abbreviation}:`, error);
      await sleep(250);
    }
  }

  if (failedTeams.length) {
    await writeFailure(
      formatFailure("team_fetch_failed", {
        failed: failedTeams.map((entry) => entry.code),
      }),
    );
    console.warn("Aborting roster write due to team fetch failures.");
    return;
  }

  if (totalPlayers < 360 || totalPlayers > 600) {
    await writeFailure(
      formatFailure("suspicious_total", {
        totalPlayers,
      }),
    );
    console.warn(`Aborting write; suspicious league player count = ${totalPlayers}.`);
    return;
  }

  rosterTeams.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));

  const doc: RostersDoc = {
    fetched_at: new Date().toISOString(),
    ttl_hours: TTL_HOURS,
    teams: rosterTeams,
  };

  const jsonString = await writeJSON(OUT_FILE, doc);
  await clearFailureFile();
  const hash = await writeHash(jsonString);
  console.log(`Wrote ${OUT_FILE} with ${totalPlayers} players (sha256 ${hash.slice(0, 8)}…).`);
}

main().catch(async (error) => {
  console.error("Roster fetch run failed:", error);
  await writeFailure(formatFailure("exception", { message: String(error) }));
});
