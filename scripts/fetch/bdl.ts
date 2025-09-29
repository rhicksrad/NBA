import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";

export const API_ROOT = "https://api.balldontlie.io/v1";
const DEFAULT_API_KEY = "849684d4-054c-43bf-8fe1-e87c4ff8d67c";
const KEY = process.env.BALLDONTLIE_API_KEY?.trim() || DEFAULT_API_KEY;
const MAX_ATTEMPTS = 4;

export function authHeaders(): Record<string, string> {
  return KEY ? { Authorization: KEY } : {};
}

export async function request<T>(url: string, attempt = 1): Promise<T> {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 429 && attempt < MAX_ATTEMPTS) {
      await sleep(500 * Math.pow(2, attempt - 1));
      return request<T>(url, attempt + 1);
    }
    if (!res.ok) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(500 * Math.pow(2, attempt - 1));
        return request<T>(url, attempt + 1);
      }
      throw new Error(`${res.status} ${res.statusText} for ${url}`);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (attempt < MAX_ATTEMPTS) {
      await sleep(500 * Math.pow(2, attempt - 1));
      return request<T>(url, attempt + 1);
    }
    throw error;
  }
}

const TeamZ = z.object({
  id: z.number(),
  abbreviation: z.string(),
  full_name: z.string(),
});

export type BdlTeam = z.infer<typeof TeamZ>;

export async function getBdlTeams(): Promise<BdlTeam[]> {
  const { data } = await request<{ data: unknown }>(`${API_ROOT}/teams`);
  return z.array(TeamZ).parse(data);
}

export interface TeamMap {
  byAbbr: Record<string, number>;
  byName: Record<string, number>;
}

export async function buildTeamMap(): Promise<TeamMap> {
  const teams = await getBdlTeams();
  const byAbbr: Record<string, number> = {};
  const byName: Record<string, number> = {};

  for (const team of teams) {
    byAbbr[team.abbreviation.toUpperCase()] = team.id;
    byName[team.full_name.toLowerCase()] = team.id;
  }

  return { byAbbr, byName };
}

export function teamFullName(market: string, name: string): string {
  return `${market} ${name}`.trim();
}
