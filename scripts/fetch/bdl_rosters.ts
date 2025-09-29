import { setTimeout as sleep } from "node:timers/promises";
import type { BLPlayer, BLTeam } from "../../types/ball.js";
import { ensureTeamMetadata, TEAM_METADATA } from "../lib/teams.js";
import type { LeagueDataSource, SourcePlayerRecord, SourceTeamRecord } from "../lib/types.js";

const API = "https://api.balldontlie.io/v1";
const DEFAULT_API_KEY = "849684d4-054c-43bf-8fe1-e87c4ff8d67c";
const KEY = process.env.BALLDONTLIE_API_KEY?.trim() || DEFAULT_API_KEY;
const MAX_ATTEMPTS = 4;
export const MAX_TEAM_ACTIVE = 30;
const WARN_LEAGUE_ACTIVE = 800;
const PER_PAGE = 100;

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
  const seen = new Set<number>();
  let cursor: number | undefined;
  const baseUrl = `${API}/players/active?team_ids[]=${teamId}&per_page=${PER_PAGE}`;

  while (true) {
    const url = cursor != null ? `${baseUrl}&cursor=${cursor}` : baseUrl;
    const json = await http<PaginatedPlayers>(url);
    if (Array.isArray(json.data)) {
      for (const player of json.data) {
        if (seen.has(player.id)) {
          continue;
        }
        seen.add(player.id);
        players.push(player);
      }
    }
    const nextCursor = json.meta?.next_cursor ?? null;
    if (!nextCursor) {
      break;
    }
    cursor = nextCursor;
    await sleep(125);
  }

  if (players.length > MAX_TEAM_ACTIVE) {
    console.warn(
      `Team ${teamId} returned ${players.length} active players; trimming to latest ${MAX_TEAM_ACTIVE}.`
    );
    return players.slice(0, MAX_TEAM_ACTIVE);
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
  const uniquePlayerKeys = new Set<string>();

  for (const team of teamsResponse) {
    const abbr = team.abbreviation.toUpperCase();
    if (!validAbbrs.has(abbr)) {
      continue;
    }
    const meta = ensureTeamMetadata(abbr);
    const rawPlayers = await getActivePlayersByTeam(team.id);
    const roster = rawPlayers.map((player) => toSourcePlayer(player, meta.teamId, meta.tricode));

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
      const key = player.playerId ?? player.name;
      players[key] = player;
      uniquePlayerKeys.add(key);
    }

    teamAbbrs.push(abbr);
    await sleep(100);
  }

  const totalUniquePlayers = uniquePlayerKeys.size;
  if (totalUniquePlayers > WARN_LEAGUE_ACTIVE) {
    console.warn(
      `League active count ${totalUniquePlayers} looks high; check pagination/filtering.`
    );
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
