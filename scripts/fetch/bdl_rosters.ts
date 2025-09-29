import { setTimeout as sleep } from "node:timers/promises";
import type { BLPlayer } from "../../types/ball.js";
import { buildTeamMap, request, API_ROOT, teamFullName } from "./bdl.js";
import { ensureTeamMetadata, TEAM_METADATA } from "../lib/teams.js";
import type { LeagueDataSource, SourcePlayerRecord, SourceTeamRecord } from "../lib/types.js";

export const MAX_TEAM_ACTIVE = 30;
const WARN_LEAGUE_ACTIVE = 800;
const PER_PAGE = 100;

interface PaginatedPlayers {
  data: BLPlayer[];
  meta?: { next_cursor?: number | null };
}

async function getActivePlayersByTeam(teamId: number): Promise<BLPlayer[]> {
  const players: BLPlayer[] = [];
  const seen = new Set<number>();
  let cursor: number | undefined;
  const baseUrl = `${API_ROOT}/players/active?team_ids[]=${teamId}&per_page=${PER_PAGE}`;

  while (true) {
    const url = cursor != null ? `${baseUrl}&cursor=${cursor}` : baseUrl;
    const json = await request<PaginatedPlayers>(url);
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
  const teamMap = await buildTeamMap();
  const teams: Record<string, Partial<SourceTeamRecord>> = {};
  const players: Record<string, SourcePlayerRecord> = {};
  const teamAbbrs: string[] = [];
  const uniquePlayerKeys = new Set<string>();

  for (const meta of TEAM_METADATA) {
    const abbr = meta.tricode.toUpperCase();
    const mappedId =
      teamMap.byAbbr[abbr] ?? teamMap.byName[teamFullName(meta.market, meta.name).toLowerCase()];
    if (!mappedId) {
      throw new Error(
        `No BallDontLie team id mapping for ${meta.teamId} (${abbr} / ${teamFullName(meta.market, meta.name)})`
      );
    }

    const rawPlayers = await getActivePlayersByTeam(mappedId);
    if (!rawPlayers.length) {
      throw new Error(
        `BallDontLie returned 0 players for ${abbr} (NBA ${meta.teamId}) mapped to BDL ${mappedId}. Check mapping or season context.`
      );
    }
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
