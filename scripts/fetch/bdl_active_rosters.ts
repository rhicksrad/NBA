import { promises as fs } from "node:fs";

import { getTeams, normalizeTeamName } from "./bdl.js";
import { TEAM_METADATA } from "../lib/teams.js";
import type { SourcePlayerRecord } from "../lib/types.js";

const API = "https://api.balldontlie.io/v1";
const KEY =
  process.env.BALLDONTLIE_API_KEY?.trim() ??
  process.env.BDL_API_KEY?.trim() ??
  process.env.BALL_DONT_LIE_API_KEY?.trim();

if (!KEY) {
  throw new Error("Missing BALLDONTLIE_API_KEY");
}

interface BLTeam {
  id: number;
  abbreviation: string;
  full_name: string;
}

interface BLPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string | null;
  height?: string | null;
  weight?: string | null;
  jersey_number?: string | null;
  team: BLTeam | null;
}

interface Page {
  data: BLPlayer[];
  meta?: { next_cursor?: number | null };
}

export interface ActiveRosterPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  height: string;
  weight: string;
  jersey_number: string;
  team_abbr: string;
  team_bdl_id: number;
}

export type ActiveRosterMap = Record<string, ActiveRosterPlayer[]>;

function buildUrl(path: string, params: Record<string, unknown> = {}): URL {
  const url = new URL(API + path);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        url.searchParams.append(`${key}[]`, String(entry));
      }
    } else if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function http(path: string, params: Record<string, unknown> = {}): Promise<Page> {
  const url = buildUrl(path, params);
  const response = await fetch(url, {
    headers: { Authorization: KEY },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return (await response.json()) as Page;
}

async function fetchActivePlayersByTeam(bdlTeamId: number): Promise<BLPlayer[]> {
  const players: BLPlayer[] = [];
  const seen = new Set<number>();
  let cursor: number | undefined;

  while (true) {
    const page = await http("/players/active", {
      team_ids: [bdlTeamId],
      per_page: 100,
      cursor,
    });

    const nullTeam = page.data.filter((player) => player.team === null);
    if (nullTeam.length) {
      const sample = nullTeam
        .slice(0, 3)
        .map((player) => `${player.first_name} ${player.last_name}`.trim())
        .join(", ");
      throw new Error(
        `Active endpoint returned players without teams for BDL ${bdlTeamId}: ${sample}${
          nullTeam.length > 3 ? " …" : ""
        }`,
      );
    }

    for (const player of page.data) {
      if (player.team?.id !== bdlTeamId) {
        continue;
      }
      if (seen.has(player.id)) {
        continue;
      }
      seen.add(player.id);
      players.push(player);
    }

    const nextCursor = page.meta?.next_cursor ?? undefined;
    if (!nextCursor) {
      break;
    }
    cursor = nextCursor;
  }

  return players;
}

function formatFullName(first: string, last: string): string {
  return [first, last].filter(Boolean).join(" ").trim();
}

export async function fetchActiveRosters(): Promise<Record<string, SourcePlayerRecord[]>> {
  const bdlTeams = await getTeams();
  if (!bdlTeams.length) {
    throw new Error("Ball Don't Lie returned no teams");
  }

  const byAbbr = new Map<string, BLTeam>();
  for (const team of bdlTeams) {
    byAbbr.set(team.abbreviation.toUpperCase(), team);
  }

  const rosters: Record<string, SourcePlayerRecord[]> = {};
  const blakeHits: string[] = [];
  const assignments = new Map<number, string>();

  for (const meta of TEAM_METADATA) {
    const abbr = meta.tricode.toUpperCase();
    const bdlTeam = byAbbr.get(abbr);
    if (!bdlTeam) {
      throw new Error(`Missing Ball Don't Lie team mapping for ${meta.tricode}`);
    }

    const expectedName = normalizeTeamName(`${meta.market} ${meta.name}`);
    const actualName = normalizeTeamName(bdlTeam.full_name);
    if (expectedName !== actualName) {
      throw new Error(
        `Team name mismatch for ${meta.tricode}: expected ${meta.market} ${meta.name}, got ${bdlTeam.full_name}`,
      );
    }

    const players = await fetchActivePlayersByTeam(bdlTeam.id);

    const mapped = players.map<SourcePlayerRecord>((player) => {
      const fullName = formatFullName(player.first_name, player.last_name);
      if (player.first_name === "Blake" && player.last_name === "Griffin") {
        blakeHits.push(`${fullName} (${meta.tricode})`);
      }
      const previousTeam = assignments.get(player.id);
      if (previousTeam && previousTeam !== meta.tricode) {
        throw new Error(
          `Player ${fullName} (ID ${player.id}) appears on multiple teams: ${previousTeam}, ${meta.tricode}`,
        );
      }
      assignments.set(player.id, meta.tricode);
      return {
        playerId: String(player.id),
        name: fullName,
        position: player.position ?? undefined,
        teamId: meta.teamId,
        teamTricode: meta.tricode,
        id: player.id,
        first_name: player.first_name,
        last_name: player.last_name,
        jersey_number: player.jersey_number ?? "",
        height: player.height ?? "",
        weight: player.weight ?? "",
        team_abbr: meta.tricode,
        team_bdl_id: bdlTeam.id,
      };
    });

    if (mapped.length < 13 || mapped.length > 21) {
      throw new Error(`Roster size out of bounds for ${meta.tricode}: ${mapped.length}`);
    }

    rosters[meta.tricode] = mapped;
  }

  if (blakeHits.length) {
    throw new Error(`Historical leak detected: ${blakeHits.join(", ")}`);
  }

  const serializable: ActiveRosterMap = Object.fromEntries(
    Object.entries(rosters).map(([abbr, players]) => [
      abbr,
      players.map((player) => ({
        id: player.id!,
        first_name: player.first_name ?? "",
        last_name: player.last_name ?? "",
        position: player.position ?? "",
        height: player.height ?? "",
        weight: player.weight ?? "",
        jersey_number: player.jersey_number ?? "",
        team_abbr: player.team_abbr ?? abbr,
        team_bdl_id: player.team_bdl_id!,
      })),
    ]),
  );

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(
    "data/bdl_active_rosters.json",
    JSON.stringify({ rosters: serializable }, null, 2) + "\n",
    "utf8",
  );

  return rosters;
}

if (process.argv[1]?.endsWith("bdl_active_rosters.ts")) {
  fetchActiveRosters()
    .then(() => {
      console.log("Wrote data/bdl_active_rosters.json");
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
