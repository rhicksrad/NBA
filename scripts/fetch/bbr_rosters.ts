import { load } from "cheerio";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { brefTeam, fetchBref } from "../data/helpers/bref.js";
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
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BREF_MISSING_PATH = path.join(ROOT, "data/2025-26/manual/bref_missing.json");

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

export async function fetchBbrRosters(season: string): Promise<LeagueDataSource> {
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
    try {
      const response = await fetchBref(url);
      if (response.status === 404) {
        console.warn(`BRef 404 for ${tricode} at ${url}`);
        missingTeams.push(tricode);
        throw new Error("Basketball-Reference 404");
      }
      if (!response.ok) {
        throw new Error(`Unexpected status ${response.status}`);
      }
      const html = await response.text();
      const $ = load(html);
      const roster: SourcePlayerRecord[] = [];
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
        roster.push(player);
        const key = player.playerId ?? player.name;
        players[key] = player;
      });

      totalPlayers += roster.length;

      const coachText = $("table#coach-staff tbody tr:first-child td[data-stat='coach_name']").text().trim();
      if (coachText) {
        const coach: CoachRecord = { name: coachText };
        coaches[tricode] = coach;
      }

      teams[tricode] = {
        teamId: meta.teamId,
        tricode,
        market: meta.market,
        name: meta.name,
        roster,
        coach: coaches[tricode],
        lastSeasonWins: meta.lastSeasonWins,
        lastSeasonSRS: meta.lastSeasonSRS,
      };
    } catch (error) {
      console.warn(`Failed to fetch Basketball-Reference roster for ${tricode}: ${(error as Error).message}`);
      const fallbackTeam = canonicalFallback?.teams[tricode];
      if (fallbackTeam) {
        const roster = (fallbackTeam.roster ?? []).map((player) => ({ ...player }));
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
          players[key] = { ...player };
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
        totalPlayers += 0;
      }
    }
  }

  if (totalPlayers < 360 || totalPlayers > 600) {
    throw new Error(`Basketball-Reference roster size ${totalPlayers} outside expected range`);
  }

  if (missingTeams.length) {
    await mkdir(path.dirname(BREF_MISSING_PATH), { recursive: true });
    await writeFile(
      BREF_MISSING_PATH,
      JSON.stringify({ season, missingTeams, at: new Date().toISOString() }, null, 2),
      "utf8",
    );
    console.warn("Basketball-Reference missing teams:", missingTeams.join(", "));
  } else {
    await rm(BREF_MISSING_PATH, { force: true });
  }

  return { teams, players, transactions, coaches, injuries };
}
