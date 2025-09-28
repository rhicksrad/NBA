import { readFile, readdir } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { PlayerRecord, TeamRecord } from "../lib/types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const CANONICAL_DIR = path.join(ROOT, "data/2025-26/canonical");
const PREVIEWS_DIR = path.join(ROOT, "site/previews");

interface PlayerIndexEntry {
  teamTricode?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function collectStaleNames(
  text: string,
  teamTricode: string,
  playersByName: Map<string, PlayerIndexEntry>
): string[] {
  const stale: string[] = [];
  for (const [name, entry] of playersByName.entries()) {
    if (!entry.teamTricode) continue;
    if (!new RegExp(`\\b${escapeRegExp(name)}\\b`).test(text)) continue;
    if (entry.teamTricode !== teamTricode) {
      stale.push(name);
    }
  }
  return stale;
}

async function loadJson<T>(fileName: string): Promise<T> {
  const filePath = path.join(CANONICAL_DIR, fileName);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function buildPlayerIndex(): Promise<Map<string, PlayerIndexEntry>> {
  const players = await loadJson<PlayerRecord[]>("players.json");
  const index = new Map<string, PlayerIndexEntry>();
  for (const player of players) {
    if (!player.name) continue;
    index.set(player.name, { teamTricode: player.teamTricode });
  }
  return index;
}

async function validatePreviews() {
  const teams = await loadJson<TeamRecord[]>("teams.json");
  const playersByName = await buildPlayerIndex();
  const teamMap = new Map(teams.map((team) => [team.tricode, team]));
  const entries = await readdir(PREVIEWS_DIR);
  const errors: string[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const tricode = path.basename(entry, ".md");
    if (tricode.toLowerCase() === "conviction-board") continue;
    const team = teamMap.get(tricode);
    if (!team) continue;
    const filePath = path.join(PREVIEWS_DIR, entry);
    const text = await readFile(filePath, "utf8");
    const stale = collectStaleNames(text, tricode, playersByName);
    if (stale.length > 0) {
      errors.push(`${entry}: references players not on ${tricode} roster -> ${stale.join(", ")}`);
    }
    if (tricode === "LAL" && /Anthony Davis/.test(text)) {
      errors.push(`${entry}: forbidden reference to Anthony Davis remains after trade.`);
    }
    if (tricode === "DAL" && /Luka Doncic/.test(text)) {
      errors.push(`${entry}: forbidden reference to Luka Doncic remains after trade.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Preview staleness validation failed:\n${errors.join("\n")}`);
  }
}

async function run() {
  await validatePreviews();
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { validatePreviews };
