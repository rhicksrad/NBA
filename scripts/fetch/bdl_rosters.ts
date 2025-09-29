import { setTimeout as sleep } from "node:timers/promises";
import type { BLPlayer, BLTeam } from "../../types/ball.js";
import { ensureTeamMetadata, TEAM_METADATA } from "../lib/teams.js";
import type { LeagueDataSource, SourcePlayerRecord, SourceTeamRecord } from "../lib/types.js";

const API = "https://api.balldontlie.io/v1";
const KEY = process.env.BALLDONTLIE_API_KEY ?? "";
const MAX_ATTEMPTS = 4;

interface PaginatedPlayers {
  data: BLPlayer[];
  meta?: { next_cursor?: number | null };
}

function authHeaders(): Record<string, string> {
  return KEY ? { Authorization: KEY } : {};
}

async function http<T>(url: string, attempt = 1): Promise<T> {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 429 && attempt < MAX_ATTEMPTS) {
      await sleep(500 * Math.pow(2, attempt - 1));
      return http<T>(url, attempt + 1);
    }
    if (!res.ok) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(500 * Math.pow(2, attempt - 1));
        return http<T>(url, attempt + 1);
      }
      throw new Error(`${res.status} ${res.statusText} for ${url}`);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (attempt < MAX_ATTEMPTS) {
      await sleep(500 * Math.pow(2, attempt - 1));
      return http<T>(url, attempt + 1);
    }
    throw error;
  }
}

async function getTeams(): Promise<BLTeam[]> {
  const json = await http<{ data: BLTeam[] }>(`${API}/teams`);
  return json.data ?? [];
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

function toSourcePlayer(
  player: BLPlayer,
  teamId: string,
  tricode: string
): SourcePlayerRecord {
  const fullName = `${player.first_name} ${player.last_name}`.trim();
  return {
    playerId: String(player.id),
    name: fullName,
    position: player.position ?? undefined,
    teamId,
    teamTricode: tricode,
  };
}

export interface BallDontLieRosters extends LeagueDataSource {
  teamAbbrs: string[];
}

export async function fetchBallDontLieRosters(): Promise<BallDontLieRosters> {
  const teamsResponse = await getTeams();
  if (!teamsResponse.length) {
    throw new Error("BallDontLie returned no teams");
  }

  const validAbbrs = new Set(TEAM_METADATA.map((team) => team.tricode));
  const teams: Record<string, Partial<SourceTeamRecord>> = {};
  const players: Record<string, SourcePlayerRecord> = {};
  const teamAbbrs: string[] = [];
  let totalPlayers = 0;

  for (const team of teamsResponse) {
    const abbr = team.abbreviation.toUpperCase();
    if (!validAbbrs.has(abbr)) {
      continue;
    }
    const meta = ensureTeamMetadata(abbr);
    const rawPlayers = await getActivePlayersByTeam(team.id);
    const roster = rawPlayers.map((player) => toSourcePlayer(player, meta.teamId, meta.tricode));
    totalPlayers += roster.length;

    teams[abbr] = {
      teamId: meta.teamId,
      tricode: meta.tricode,
      market: meta.market,
      name: meta.name,
      roster,
      lastSeasonWins: meta.lastSeasonWins,
      lastSeasonSRS: meta.lastSeasonSRS,
    };

    for (const player of roster) {
      players[player.playerId ?? player.name] = player;
    }

    teamAbbrs.push(abbr);
    await sleep(100);
  }

  if (totalPlayers < 360 || totalPlayers > 600) {
    throw new Error(`BallDontLie returned suspicious league size ${totalPlayers}`);
  }

  teamAbbrs.sort();

  return {
    teamAbbrs,
    teams,
    players,
    transactions: [],
    coaches: {},
    injuries: [],
  };
}
