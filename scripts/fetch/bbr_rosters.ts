import { load } from "cheerio";
import { brefTeam, fetchBref } from "./bref.js";
import { TEAM_METADATA } from "../lib/teams.js";
import {
  CoachRecord,
  InjuryRecord,
  LeagueDataSource,
  SourcePlayerRecord,
  SourceTeamRecord,
  TransactionRecord,
} from "../lib/types.js";
import { loadCanonicalLeagueSource } from "./canonical_cache.js";

const BBR_BASE = "https://www.basketball-reference.com";

function resolveEndYear(season: string): number {
  const [start, endFragment] = season.split("-");
  const base = Number.parseInt(start, 10);
  if (Number.isNaN(base)) {
    throw new Error(`Invalid season string: ${season}`);
  }
  if (!endFragment) {
    return base + 1;
  }
  const prefix = start.slice(0, start.length - endFragment.length);
  const year = Number.parseInt(`${prefix}${endFragment}`, 10);
  return Number.isNaN(year) ? base + 1 : year;
}

export interface BbrRosterResult {
  rosters: LeagueDataSource;
  missing: string[];
}

export async function fetchBbrRosters(season: string): Promise<BbrRosterResult> {
  const endYear = resolveEndYear(season);
  const canonicalFallback = await loadCanonicalLeagueSource();
  const teams: Record<string, Partial<SourceTeamRecord>> = {};
  const players: Record<string, SourcePlayerRecord> = {};
  const missingTeams: string[] = [];
  const transactions: TransactionRecord[] = canonicalFallback
    ? canonicalFallback.transactions.map((transaction) => ({ ...transaction }))
    : [];
  const coaches: Record<string, CoachRecord> = canonicalFallback
    ? Object.fromEntries(
        Object.entries(canonicalFallback.coaches).map(([team, record]) => [
          team,
          { ...record },
        ])
      )
    : {};
  const injuries: InjuryRecord[] = canonicalFallback
    ? canonicalFallback.injuries.map((injury) => ({ ...injury }))
    : [];

  let totalPlayers = 0;

  for (const meta of TEAM_METADATA) {
    const tricode = meta.tricode;
    const code = brefTeam(tricode);
    const url = `${BBR_BASE}/teams/${code}/${endYear}.html`;
    const fallbackTeam = canonicalFallback?.teams[tricode];

    const markMissing = () => {
      if (!missingTeams.includes(tricode)) {
        missingTeams.push(tricode);
      }
    };

    try {
      const html = await fetchBref(url);
      const $ = load(html);
      const parsedRoster: SourcePlayerRecord[] = [];
      $("table#roster tbody tr").each((_, element) => {
        const name = $(element).find("th[data-stat='player'] a").text().trim();
        if (!name) {
          return;
        }
        const pos = $(element).find("td[data-stat='pos']").text().trim();
        const player: SourcePlayerRecord = {
          name,
          position: pos || undefined,
          teamId: meta.teamId,
          teamTricode: tricode,
        };
        parsedRoster.push(player);
      });

      let roster = parsedRoster;
      if (roster.length === 0) {
        console.warn(`BRef: 0 parsed players for ${tricode}; marking missing and continuing.`);
        markMissing();
        roster = fallbackTeam?.roster ? fallbackTeam.roster.map((player) => ({ ...player })) : [];
      }

      const coachText = $("table#coach-staff tbody tr:first-child td[data-stat='coach_name']").text().trim();
      if (coachText) {
        const coach: CoachRecord = { name: coachText };
        coaches[tricode] = coach;
      } else if (fallbackTeam?.coach) {
        coaches[tricode] = { ...fallbackTeam.coach };
      }

      const rosterWithMeta = roster.map((player) => ({
        ...player,
        teamId: player.teamId ?? meta.teamId,
        teamTricode: player.teamTricode ?? tricode,
      }));

      for (const player of rosterWithMeta) {
        const key = player.playerId ?? player.name;
        if (key) {
          players[key] = { ...player };
        }
      }

      totalPlayers += rosterWithMeta.length;

      teams[tricode] = {
        teamId: meta.teamId,
        tricode,
        market: meta.market,
        name: meta.name,
        roster: rosterWithMeta,
        coach: coaches[tricode],
        lastSeasonWins: meta.lastSeasonWins,
        lastSeasonSRS: meta.lastSeasonSRS,
      };
    } catch (error) {
      console.warn(`Failed to fetch Basketball-Reference roster for ${tricode}: ${(error as Error).message}`);
      markMissing();
      if (fallbackTeam) {
        const roster = (fallbackTeam.roster ?? []).map((player) => ({
          ...player,
          teamId: player.teamId ?? meta.teamId,
          teamTricode: player.teamTricode ?? tricode,
        }));
        const fallbackCoach = coaches[tricode] ?? (fallbackTeam.coach ? { ...fallbackTeam.coach } : undefined);
        if (fallbackCoach) {
          coaches[tricode] = { ...fallbackCoach };
        }
        teams[tricode] = {
          teamId: fallbackTeam.teamId ?? meta.teamId,
          tricode: fallbackTeam.tricode ?? tricode,
          market: fallbackTeam.market ?? meta.market,
          name: fallbackTeam.name ?? meta.name,
          roster,
          coach: fallbackCoach ? { ...fallbackCoach } : undefined,
          lastSeasonWins: fallbackTeam.lastSeasonWins ?? meta.lastSeasonWins,
          lastSeasonSRS: fallbackTeam.lastSeasonSRS ?? meta.lastSeasonSRS,
        };
        for (const player of roster) {
          const key = player.playerId ?? player.name;
          if (key) {
            players[key] = { ...player };
          }
        }
        totalPlayers += roster.length;
      } else {
        teams[tricode] = {
          teamId: meta.teamId,
          tricode,
          market: meta.market,
          name: meta.name,
          roster: [],
          lastSeasonWins: meta.lastSeasonWins,
          lastSeasonSRS: meta.lastSeasonSRS,
        };
      }
    }
  }

  if (totalPlayers === 0) {
    console.warn("BRef: parsed 0 players across all teams; treating as enrichment-only and continuing.");
  }

  return {
    rosters: { teams, players, transactions, coaches, injuries },
    missing: missingTeams,
  };
}
