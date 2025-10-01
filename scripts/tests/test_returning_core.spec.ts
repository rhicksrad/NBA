import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PlayerRecord,
  PlayerScoringAverage,
  PlayerScoringDataset,
  TeamRecord,
} from "../lib/types.js";

interface PlayerScoringIndex {
  byId: Map<string, PlayerScoringAverage>;
  byName: Map<string, PlayerScoringAverage>;
}

interface PreviewDatasetEntry {
  tricode: string;
  returningCore?: string[];
}

interface PreviewDataset {
  previews?: PreviewDatasetEntry[];
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PREVIEW_PATH = path.join(ROOT, "public/data/preseason_team_previews.json");
const TEAMS_PATH = path.join(ROOT, "data/2025-26/canonical/teams.json");
const SCORING_PATH = path.join(ROOT, "data/2025-26/canonical/player_scoring_averages.json");

function normalizeName(value?: string | null): string {
  if (!value) {
    return "";
  }
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function buildScoringIndex(dataset: PlayerScoringDataset): PlayerScoringIndex {
  const byId = new Map<string, PlayerScoringAverage>();
  const byName = new Map<string, PlayerScoringAverage>();
  const players = Array.isArray(dataset?.players) ? dataset.players : [];
  for (const entry of players) {
    const rawId = typeof entry?.playerId === "string" ? entry.playerId : "";
    const playerId = rawId.trim();
    if (!playerId) {
      continue;
    }
    const record: PlayerScoringAverage = {
      playerId,
      pointsPerGame:
        typeof entry.pointsPerGame === "number" && Number.isFinite(entry.pointsPerGame) ? entry.pointsPerGame : 0,
      gamesPlayed:
        typeof entry.gamesPlayed === "number" && Number.isFinite(entry.gamesPlayed)
          ? Math.max(0, Math.round(entry.gamesPlayed))
          : 0,
      name: entry.name ?? null,
      firstName: entry.firstName ?? null,
      lastName: entry.lastName ?? null,
    };
    byId.set(playerId, record);
    const nameKeys = new Set<string>();
    const combined = record.name ?? `${record.firstName ?? ""} ${record.lastName ?? ""}`;
    nameKeys.add(normalizeName(combined));
    nameKeys.add(normalizeName(`${record.lastName ?? ""} ${record.firstName ?? ""}`));
    for (const key of nameKeys) {
      if (!key) {
        continue;
      }
      const existing = byName.get(key);
      if (!existing || record.pointsPerGame > existing.pointsPerGame) {
        byName.set(key, record);
      }
    }
  }
  return { byId, byName };
}

function normalizedRoster(team: TeamRecord): PlayerRecord[] {
  const roster = team.roster ?? [];
  if (roster.length === 0) {
    return roster;
  }
  const filtered = roster.filter((player) => {
    if (!player.teamTricode) {
      return true;
    }
    return player.teamTricode === team.tricode;
  });
  return filtered.length > 0 ? filtered : roster;
}

function scoringRecordForPlayer(
  player: PlayerRecord,
  index: PlayerScoringIndex,
): PlayerScoringAverage | undefined {
  const rawId = typeof player.playerId === "string" ? player.playerId : String(player.playerId ?? "");
  const playerId = rawId.trim();
  if (playerId && index.byId.has(playerId)) {
    return index.byId.get(playerId);
  }
  const candidateKeys = new Set<string>();
  candidateKeys.add(normalizeName(player.name));
  candidateKeys.add(normalizeName(`${player.firstName ?? ""} ${player.lastName ?? ""}`));
  candidateKeys.add(normalizeName(`${player.lastName ?? ""} ${player.firstName ?? ""}`));
  for (const key of candidateKeys) {
    if (!key) {
      continue;
    }
    const record = index.byName.get(key);
    if (record) {
      return record;
    }
  }
  return undefined;
}

function computeTopScorers(team: TeamRecord, index: PlayerScoringIndex): string[] {
  const roster = normalizedRoster(team);
  if (!roster.length) {
    return [];
  }
  const enriched = roster.map((player, rosterIndex) => {
    const record = scoringRecordForPlayer(player, index);
    const points = record?.pointsPerGame ?? 0;
    const games = record?.gamesPlayed ?? 0;
    return { player, points, games, rosterIndex };
  });
  const sorted = enriched.slice().sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (b.games !== a.games) {
      return b.games - a.games;
    }
    return a.rosterIndex - b.rosterIndex;
  });
  const withStats = sorted.filter((entry) => entry.points > 0 || entry.games > 0);
  const queue = [...withStats];
  for (const entry of sorted) {
    if (!withStats.includes(entry)) {
      queue.push(entry);
    }
  }
  const targetCount = Math.min(3, roster.length);
  const seen = new Set<string>();
  const names: string[] = [];
  for (const entry of queue) {
    if (names.length >= targetCount) {
      break;
    }
    const name = entry.player.name?.trim();
    if (!name) {
      continue;
    }
    const key = (entry.player.playerId ? String(entry.player.playerId) : name).trim();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    names.push(name);
  }
  return names;
}

describe("preseason returning core", () => {
  it("matches the top scoring averages on each roster", async () => {
    const [previewRaw, teamsRaw, scoringRaw] = await Promise.all([
      readFile(PREVIEW_PATH, "utf8"),
      readFile(TEAMS_PATH, "utf8"),
      readFile(SCORING_PATH, "utf8"),
    ]);

    const previewData = JSON.parse(previewRaw) as PreviewDataset;
    const previews = Array.isArray(previewData?.previews) ? previewData.previews : [];
    const previewLookup = new Map<string, PreviewDatasetEntry>();
    previews.forEach((entry) => {
      if (entry?.tricode) {
        previewLookup.set(entry.tricode, entry);
      }
    });

    const teams = JSON.parse(teamsRaw) as TeamRecord[];
    const scoringDataset = JSON.parse(scoringRaw) as PlayerScoringDataset;
    const scoringIndex = buildScoringIndex(scoringDataset);

    for (const team of teams) {
      const preview = previewLookup.get(team.tricode);
      expect(preview, `Missing preseason preview for ${team.tricode}`).toBeDefined();
      if (!preview) {
        continue;
      }
      const expectedCore = computeTopScorers(team, scoringIndex);
      const actualCore = Array.isArray(preview.returningCore) ? preview.returningCore : [];
      expect(actualCore).toEqual(expectedCore);
    }
  });
});
