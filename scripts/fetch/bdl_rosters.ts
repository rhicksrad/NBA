import {
  createTeamMap,
  getRosterMapByTeamIds,
  getTeams,
  normalizeTeamName,
} from "./bdl.js";
import type { BdlPlayer, BdlTeam } from "./bdl.js";
import { TEAM_METADATA } from "../lib/teams.js";
import type { TeamMetadata } from "../lib/teams.js";
import type { LeagueDataSource, SourcePlayerRecord, SourceTeamRecord } from "../lib/types.js";

export interface BallDontLieRosters extends LeagueDataSource {
  teamAbbrs: string[];
}

export const MAX_TEAM_ACTIVE = 30;

function toSourcePlayer(player: BdlPlayer, teamId: string, tricode: string): SourcePlayerRecord {
  const fullName = `${player.first_name} ${player.last_name}`.trim();
  return {
    playerId: String(player.id),
    name: fullName,
    position: player.position ?? undefined,
    teamId,
    teamTricode: tricode,
  };
}

function candidateTeamNameKeys(team: TeamMetadata): string[] {
  const names = new Set<string>();
  const market = team.market ?? "";
  const name = team.name ?? "";
  names.add(normalizeTeamName(`${market} ${name}`));
  if (market) {
    names.add(normalizeTeamName(market));
  }
  if (name) {
    names.add(normalizeTeamName(name));
  }
  return Array.from(names).filter(Boolean);
}

export async function fetchBallDontLieRosters(): Promise<BallDontLieRosters> {
  const bdlTeams = await getTeams();
  if (!bdlTeams.length) {
    throw new Error("Ball Don't Lie returned no teams");
  }

  const teamMap = createTeamMap(bdlTeams);
  const nbaTeams: Array<{ meta: TeamMetadata; bdl: BdlTeam }> = [];

  for (const teamMeta of TEAM_METADATA) {
    const abbrKey = teamMeta.tricode.toUpperCase();
    let bdlTeam = teamMap.byAbbr[abbrKey];
    if (!bdlTeam) {
      for (const key of candidateTeamNameKeys(teamMeta)) {
        const mapped = teamMap.byName[key];
        if (mapped) {
          bdlTeam = mapped;
          break;
        }
      }
    }
    if (!bdlTeam) {
      throw new Error(
        `Missing Ball Don't Lie mapping for ${teamMeta.tricode} (${teamMeta.teamId})`
      );
    }
    nbaTeams.push({ meta: teamMeta, bdl: bdlTeam });
  }

  // Pull active rosters using shared bdl.js helper
  const rosterMap = await getRosterMapByTeamIds(nbaTeams.map((entry) => entry.bdl.id));

  const teams: Record<string, SourceTeamRecord> = {};
  const players: Record<string, SourcePlayerRecord> = {};
  const teamAbbrs: string[] = [];
  const uniquePlayerKeys = new Set<string>();

  let totalPlayers = 0;

  for (const entry of nbaTeams) {
    const { meta, bdl } = entry;
    const rawRoster = rosterMap[bdl.id] ?? [];
    if (rawRoster.length === 0) {
      throw new Error(
        `Ball Don't Lie returned 0 active players for ${meta.tricode} (NBA ${meta.teamId}) mapped to BDL team ${bdl.id}`
      );
    }
    if (rawRoster.length > MAX_TEAM_ACTIVE) {
      console.warn(
        `Team ${meta.tricode} mapped to BDL ${bdl.id} returned ${rawRoster.length} players; trimming to ${MAX_TEAM_ACTIVE}.`
      );
    }
    const roster = rawRoster
      .slice(0, MAX_TEAM_ACTIVE)
      .map((player) => toSourcePlayer(player, meta.teamId, meta.tricode));

    totalPlayers += roster.length;

    teams[meta.tricode] = {
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

    teamAbbrs.push(meta.tricode);
  }

  if (totalPlayers < 360) {
    throw new Error(`Ball Don't Lie returned too few active players (${totalPlayers})`);
  }

  return {
    teamAbbrs: teamAbbrs.sort(),
    teams,
    players,
    transactions: [],
    coaches: {},
    injuries: [],
  };
}
