import { z } from "zod";

import { request } from "./http.js";
import { DEFAULT_TTL_MS, withCache } from "./cache.js";

const API_BASE = "https://api.balldontlie.io";

const metaSchema = z
  .object({
    next_page: z.number().int().nullable().optional(),
    next_cursor: z.union([z.string(), z.number(), z.null()]).optional(),
    per_page: z.number().int().optional(),
    total_pages: z.number().int().optional(),
    current_page: z.number().int().optional(),
  })
  .partial();

const teamSchema = z
  .object({
    id: z.number().int(),
    abbreviation: z.string().min(1),
    full_name: z.string().min(1),
    city: z.string().optional(),
    division: z.string().optional(),
    conference: z.string().optional(),
  })
  .strip();

const nestedTeamSchema = teamSchema.pick({ id: true, abbreviation: true, full_name: true }).extend({
  city: z.string().optional(),
});

const playerSchema = z
  .object({
    id: z.number().int(),
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    position: z.string().nullable().optional(),
    jersey_number: z.string().nullable().optional(),
    height: z.string().nullable().optional(),
    weight: z.string().nullable().optional(),
    team: nestedTeamSchema,
  })
  .strip();

const gameSchema = z
  .object({
    id: z.number().int(),
    date: z.string().min(1),
    season: z.number().int(),
    status: z.string().min(1),
    season_type: z.string().optional(),
    postseason: z.boolean().optional(),
    home_team_score: z.number().int(),
    visitor_team_score: z.number().int(),
    home_team: nestedTeamSchema,
    visitor_team: nestedTeamSchema,
  })
  .strip();

const pageSchema = z
  .object({
    data: z.array(z.unknown()),
    meta: metaSchema.optional(),
  })
  .strip();

export type BdlTeam = z.infer<typeof teamSchema>;
export type BdlPlayer = z.infer<typeof playerSchema>;
export type BdlGame = z.infer<typeof gameSchema>;

export interface TeamMap {
  byAbbr: Record<string, BdlTeam>;
  byName: Record<string, BdlTeam>;
}

function buildUrl(pathname: string, params: URLSearchParams): string {
  const base = new URL(pathname, API_BASE);
  base.search = params.toString();
  return base.toString();
}

type QueryValue = string | number | boolean | undefined;

export async function paginate<T>(
  basePath: string,
  params: Record<string, QueryValue>,
  pageSize = 100,
  pageLimit?: number,
  parser?: z.ZodType<T>,
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  let cursor: string | number | undefined;
  let attempts = 0;

  while (true) {
    attempts += 1;
    if (pageLimit && attempts > pageLimit) {
      break;
    }

    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      search.append(key, String(value));
    }
    if (cursor !== undefined) {
      search.set("cursor", String(cursor));
    } else {
      search.set("page", String(page));
    }
    if (!search.has("per_page")) {
      search.set("per_page", String(pageSize));
    }

    const url = buildUrl(basePath, search);
    const raw = await request<unknown>(url);
    const parsedPage = pageSchema.parse(raw);
    const dataArray = Array.isArray(parsedPage.data) ? parsedPage.data : [];
    const items = parser ? dataArray.map((entry) => parser.parse(entry)) : (dataArray as T[]);
    results.push(...items);

    const meta = parsedPage.meta;
    if (meta?.next_cursor !== undefined && meta.next_cursor !== null) {
      cursor = meta.next_cursor;
      continue;
    }
    if (meta?.next_page && meta.next_page !== null) {
      page = meta.next_page;
      continue;
    }
    if (dataArray.length < pageSize) {
      break;
    }
    page += 1;
  }

  return results;
}

export async function getTeams(): Promise<BdlTeam[]> {
  return withCache("teams", DEFAULT_TTL_MS, async () => {
    const url = buildUrl("/v1/teams", new URLSearchParams());
    const raw = await request<unknown>(url);
    const parsed = pageSchema.parse(raw);
    const teams = parsed.data.map((team) => teamSchema.parse(team));
    return teams;
  });
}

export function normalizeTeamName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export function createTeamMap(teams: BdlTeam[]): TeamMap {
  const byAbbr: Record<string, BdlTeam> = {};
  const byName: Record<string, BdlTeam> = {};
  for (const team of teams) {
    byAbbr[team.abbreviation.toUpperCase()] = team;
    byName[normalizeTeamName(team.full_name)] = team;
  }
  return { byAbbr, byName };
}

export async function buildTeamMap(): Promise<TeamMap> {
  const teams = await getTeams();
  return createTeamMap(teams);
}

export async function getActivePlayersByTeam(teamId: number): Promise<BdlPlayer[]> {
  return withCache(`players-active-${teamId}`, DEFAULT_TTL_MS, async () => {
    const players = await paginate<BdlPlayer>(
      "/v1/players/active",
      { "team_ids[]": teamId },
      100,
      undefined,
      playerSchema,
    );
    return players;
  });
}

export async function getRosterMapByTeamIds(teamIds: number[]): Promise<Record<number, BdlPlayer[]>> {
  const entries = await Promise.all(
    teamIds.map(async (teamId) => {
      const roster = await getActivePlayersByTeam(teamId);
      return [teamId, roster] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function getPreseasonSchedule(season: number): Promise<BdlGame[]> {
  return withCache(`games-preseason-${season}`, DEFAULT_TTL_MS, async () => {
    const games = await paginate<BdlGame>(
      "/v1/games",
      { "seasons[]": season, season_type: "Pre Season" },
      100,
      undefined,
      gameSchema,
    );
    return games.filter((game) => {
      const type = game.season_type?.toLowerCase();
      return type === "pre season" || type === "preseason";
    });
  });
}
