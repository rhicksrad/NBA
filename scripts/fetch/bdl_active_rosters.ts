import { promises as fs } from "node:fs";
import { pathToFileURL } from "node:url";
import type { SourcePlayerRecord } from "../lib/types.js";

const API = "https://api.balldontlie.io/v1";

function requireKey(): string {
  const key = process.env.BALLDONTLIE_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing BALLDONTLIE_API_KEY");
  }
  return key;
}

type BLTeam = { id: number; abbreviation: string; full_name: string };
type BLPlayer = {
  id: number;
  first_name: string;
  last_name: string;
  position?: string | null;
  height?: string | null;
  weight?: string | null;
  jersey_number?: string | null;
  team: BLTeam | null;
};
type Page = { data: BLPlayer[]; meta?: { next_cursor?: number | null } };

async function http(path: string, q: Record<string, unknown> = {}): Promise<Page> {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(q)) {
    if (Array.isArray(v)) v.forEach(val => url.searchParams.append(`${k}[]`, String(val)));
    else if (v != null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { Authorization: requireKey() } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json() as Promise<Page>;
}

// Minimal, static map of NBA team IDs in Ball Don’t Lie -> abbr your site uses.
// If you already have this elsewhere, import it and remove this.
const TEAMS: { bdlId: number; abbr: string }[] = [
  { bdlId: 1, abbr: "ATL" }, { bdlId: 2, abbr: "BOS" }, { bdlId: 3, abbr: "BKN" },
  { bdlId: 4, abbr: "CHA" }, { bdlId: 5, abbr: "CHI" }, { bdlId: 6, abbr: "CLE" },
  { bdlId: 7, abbr: "DAL" }, { bdlId: 8, abbr: "DEN" }, { bdlId: 9, abbr: "DET" },
  { bdlId: 10, abbr: "GSW" }, { bdlId: 11, abbr: "HOU" }, { bdlId: 12, abbr: "IND" },
  { bdlId: 13, abbr: "LAC" }, { bdlId: 14, abbr: "LAL" }, { bdlId: 15, abbr: "MEM" },
  { bdlId: 16, abbr: "MIA" }, { bdlId: 17, abbr: "MIL" }, { bdlId: 18, abbr: "MIN" },
  { bdlId: 19, abbr: "NOP" }, { bdlId: 20, abbr: "NYK" }, { bdlId: 21, abbr: "OKC" },
  { bdlId: 22, abbr: "ORL" }, { bdlId: 23, abbr: "PHI" }, { bdlId: 24, abbr: "PHX" },
  { bdlId: 25, abbr: "POR" }, { bdlId: 26, abbr: "SAC" }, { bdlId: 27, abbr: "SAS" },
  { bdlId: 28, abbr: "TOR" }, { bdlId: 29, abbr: "UTA" }, { bdlId: 30, abbr: "WAS" }
];

async function fetchActivePlayersForTeam(teamId: number): Promise<BLPlayer[]> {
  const seen = new Set<number>();
  const out: BLPlayer[] = [];
  let cursor: number | undefined;
  do {
    const page = await http("/players/active", { team_ids: [teamId], per_page: 100, cursor });
    for (const p of page.data) {
      if (!p.team || p.team.id !== teamId) continue; // belt-and-suspenders
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
    cursor = page.meta?.next_cursor ?? undefined;
  } while (cursor);
  return out;
}

function guardRoster(teamAbbr: string, players: BLPlayer[]) {
  if (players.length < 13 || players.length > 21) {
    throw new Error(`Roster size out of bounds for ${teamAbbr}: ${players.length}`);
  }
  if (players.some(p => p.first_name === "Blake" && p.last_name === "Griffin")) {
    throw new Error(`Historical leak: Blake Griffin surfaced in active endpoint for ${teamAbbr}`);
  }
}

export type ActiveRosters = Record<string, SourcePlayerRecord[]>;

export async function fetchActiveRosters(): Promise<ActiveRosters> {
  const rosters: ActiveRosters = {};

  // Also prevent cross-team leaks (e.g., “Bogdan” duplicated). One player ID must not span teams.
  const globalSeen = new Map<number, string>();

  for (const t of TEAMS) {
    const raw = await fetchActivePlayersForTeam(t.bdlId);
    guardRoster(t.abbr, raw);

    const mapped = raw.map(p => {
      const home = t.abbr;
      const prev = globalSeen.get(p.id);
      if (prev && prev !== home) {
        throw new Error(`Cross-team leak of player ${p.id} (${p.first_name} ${p.last_name}) on ${prev} and ${home}`);
      }
      globalSeen.set(p.id, home);
      const fullName = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || String(p.id);
      const record: SourcePlayerRecord = {
        id: p.id,
        playerId: String(p.id),
        first_name: p.first_name ?? "",
        last_name: p.last_name ?? "",
        name: fullName,
        position: p.position ?? "",
        height: p.height ?? "",
        weight: p.weight ?? "",
        jersey_number: p.jersey_number ?? "",
        team_abbr: home,
        team_bdl_id: t.bdlId,
        teamTricode: home,
      };
      return record;
    });

    rosters[t.abbr] = mapped;
  }

  return rosters;
}

async function main() {
  const rosters = await fetchActiveRosters();
  await fs.mkdir("public/data", { recursive: true });
  await fs.writeFile(
    "public/data/rosters.json",
    `${JSON.stringify({ season: "2025-26", source: "balldontlie/players/active", rosters }, null, 2)}\n`
  );
  console.log("Wrote public/data/rosters.json");
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (entryUrl && import.meta.url === entryUrl) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
