import { getRosterMapByTeamIds, getTeams } from "./bdl.js";
import type { BdlPlayer, BdlTeam } from "./bdl.js";
import { TEAM_METADATA } from "../lib/teams.js";
import type { TeamMetadata } from "../lib/teams.js";
import type { LeagueDataSource, SourcePlayerRecord, SourceTeamRecord } from "../lib/types.js";

export interface BallDontLieRosters extends LeagueDataSource {
  teamAbbrs: string[];
}

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

function mapTeamsByAbbr(teams: BdlTeam[]): Map<string, BdlTeam> {
  const map = new Map<string, BdlTeam>();
  for (const team of teams) {
    map.set(team.abbreviation.toUpperCase(), team);
  }
  return map;
}

export async function fetchBallDontLieRosters(): Promise<BallDontLieRosters> {
  const bdlTeams = await getTeams();
  if (!bdlTeams.length) {
    throw new Error("Ball Don't Lie returned no teams");
  }

  const teamsByAbbr = mapTeamsByAbbr(bdlTeams);
  const nbaTeams: Array<{ meta: TeamMetadata; bdl: BdlTeam }> = [];

  for (const teamMeta of TEAM_METADATA) {
    const bdlTeam = teamsByAbbr.get(teamMeta.tricode);
    if (!bdlTeam) {
      throw new Error(`Missing Ball Don't Lie mapping for ${teamMeta.tricode}`);
    }
    nbaTeams.push({ meta: teamMeta, bdl: bdlTeam });
  }

  const rosterMap = await getRosterMapByTeamIds(nbaTeams.map((entry) => entry.bdl.id));
  const teams: Record<string, SourceTeamRecord> = {};
  const players: Record<string, SourcePlayerRecord> = {};
  const teamAbbrs: string[] = [];
  let totalPlayers = 0;

  for (const entry of nbaTeams) {
    const { meta, bdl } = entry;
    const roster = (rosterMap[bdl.id] ?? []).map((player) => toSourcePlayer(player, meta.teamId, meta.tricode));
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
      players[player.playerId ?? player.name] = player;
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
