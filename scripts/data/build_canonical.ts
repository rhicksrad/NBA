import { readFile, writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { parse as parseYaml } from "yaml";
import {
  fetchBallDontLieRosters,
  BallDontLieRosters,
  MAX_TEAM_ACTIVE,
} from "../fetch/bdl_rosters.js";
import { fetchBbrRosters, BbrRosterResult } from "../fetch/bbr_rosters.js";
import { fetchNbaStatsRosters } from "../fetch/nba_stats_rosters.js";
import { SEASON } from "../lib/season.js";
import { TEAM_METADATA, ensureTeamMetadata } from "../lib/teams.js";
import {
  CanonicalData,
  CoachOverride,
  CoachRecord,
  CoachRecordEntry,
  InjuryOverride,
  InjuryRecord,
  LeagueDataSource,
  OverridesConfig,
  PlayerOverride,
  PlayerRecord,
  SourcePlayerRecord,
  SourceTeamRecord,
  TeamOverride,
  TeamRecord,
  TransactionRecord,
} from "../lib/types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const CANONICAL_DIR = path.join(ROOT, "data/2025-26/canonical");
const OVERRIDES_PATH = path.join(ROOT, "data/2025-26/manual/overrides.yaml");
const ROSTER_REFERENCE_PATH = path.join(ROOT, "data/2025-26/manual/roster_reference.json");
const BREF_MISSING_PATH = path.join(ROOT, "data/2025-26/manual/bref_missing.json");
const MIN_TEAM_ACTIVE = 10;

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

export interface BuildOptions {
  ballDontLie?: BallDontLieRosters;
  nbaStats?: LeagueDataSource;
  bbr?: BbrRosterResult;
  overrides?: OverridesConfig;
  fallbackPlayers?: SourcePlayerRecord[];
}

interface InternalPlayer extends PlayerRecord {
  key: string;
}

interface ChangeLog {
  additions: Set<string>;
  losses: Set<string>;
}

export async function buildCanonicalData(options: Partial<BuildOptions> = {}): Promise<CanonicalData> {
  const [overrides, fallbackPlayers] = await Promise.all([
    options.overrides ?? loadOverrides(),
    options.fallbackPlayers ?? loadFallbackPlayers(),
  ]);

  let ballDontLie = options.ballDontLie;
  if (!ballDontLie) {
    try {
      ballDontLie = await fetchBallDontLieRosters();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `Falling back to manual roster reference data after Ball Don't Lie fetch failure: ${message}`,
      );
      ballDontLie = buildFallbackLeagueSourceFromManualRoster(fallbackPlayers);
    }
  }

  if (!ballDontLie) {
    throw new Error("Unable to resolve Ball Don't Lie roster data or fallback rosters");
  }

  for (const metadata of TEAM_METADATA) {
    const team = ballDontLie.teams[metadata.tricode];
    const rosterSize = team?.roster?.length ?? 0;
    if (rosterSize < MIN_TEAM_ACTIVE) {
      console.warn(
        `Thin preseason roster for ${metadata.tricode} (${metadata.teamId}): ${rosterSize}`
      );
    }
    if (rosterSize > MAX_TEAM_ACTIVE) {
      console.warn(
        `Roster unusually large for team ${metadata.teamId ?? metadata.tricode}: ${rosterSize} (capped at ${MAX_TEAM_ACTIVE})`
      );
    }
  }

  const seasonEndYear = resolveEndYear(SEASON);
  const useBref = process.env.USE_BREF !== "0";

  let bbrResult: BbrRosterResult = options.bbr ?? {
    rosters: createEmptyLeagueSource(),
    missing: [],
  };

  if (!options.bbr) {
    if (useBref) {
      try {
        bbrResult = await fetchBbrRosters(ballDontLie.teamAbbrs, seasonEndYear);
      } catch (error) {
        console.warn(`Basketball-Reference enrichment disabled due to error: ${String(error)}`);
        bbrResult = {
          rosters: createEmptyLeagueSource(),
          missing: [...ballDontLie.teamAbbrs],
        };
      }
    } else {
      console.warn("Skipping BRef enrichment (USE_BREF=0).");
    }
  }

  let nbaStats: LeagueDataSource = createEmptyLeagueSource();
  if (process.env.USE_NBA_STATS === "1") {
    try {
      nbaStats = options.nbaStats ?? (await fetchNbaStatsRosters(SEASON));
    } catch (error) {
      console.warn(`NBA Stats enrichment disabled due to error: ${String(error)}`);
      nbaStats = createEmptyLeagueSource();
    }
  } else if (options.nbaStats) {
    nbaStats = options.nbaStats;
  }

  const brefWasUsed = options.bbr !== undefined || useBref;
  const bbrMissing = bbrResult?.missing ?? [];
  if (brefWasUsed && bbrMissing.length) {
    console.warn("BRef missing teams:", bbrMissing.join(", "));
  }

  if (brefWasUsed) {
    await handleBrefMissing(bbrMissing, seasonEndYear);
  } else {
    await handleBrefMissing([], seasonEndYear);
  }

  const merged = mergeSources({
    primary: ballDontLie,
    nbaStats,
    bbr: bbrResult?.rosters ?? createEmptyLeagueSource(),
    overrides,
    fallbackPlayers,
  });

  return merged;
}

interface MergeOptions {
  primary: LeagueDataSource;
  nbaStats?: LeagueDataSource;
  bbr?: LeagueDataSource;
  overrides: OverridesConfig;
  fallbackPlayers: SourcePlayerRecord[];
}

function createEmptyLeagueSource(): LeagueDataSource {
  return { teams: {}, players: {}, transactions: [], coaches: {}, injuries: [] };
}

async function handleBrefMissing(missing: string[], endYear: number): Promise<void> {
  if (missing.length) {
    await mkdir(path.dirname(BREF_MISSING_PATH), { recursive: true });
    await writeFile(
      BREF_MISSING_PATH,
      JSON.stringify(
        {
          endYear,
          teams: missing,
          at: new Date().toISOString(),
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
  } else {
    await rm(BREF_MISSING_PATH, { force: true });
  }
}

function createEmptyTeamRecord(tricode: string): TeamRecord {
  const metadata = ensureTeamMetadata(tricode);
  return {
    teamId: metadata.teamId,
    tricode,
    market: metadata.market,
    name: metadata.name,
    roster: [],
    keyAdditions: [],
    keyLosses: [],
    notes: [],
    lastSeasonWins: metadata.lastSeasonWins,
    lastSeasonSRS: metadata.lastSeasonSRS,
  };
}

function playerKey(player: SourcePlayerRecord | PlayerRecord): string {
  if (player.playerId) {
    return player.playerId;
  }
  return player.name;
}

function normalizeName(name: string): { firstName?: string; lastName?: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) {
    return {};
  }
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function ensureOverridesConfig(raw: unknown): OverridesConfig {
  const overrides: OverridesConfig = {
    teams: {},
    players: {},
    injuries: [],
    coaches: [],
  };
  if (!raw || typeof raw !== "object") {
    return overrides;
  }
  const data = raw as Record<string, unknown>;
  const inner = (data["overrides"] ?? data) as Record<string, unknown>;
  overrides.teams = normalizeTeamOverrides(inner["teams"]);
  overrides.players = normalizePlayerOverrides(inner["players"]);
  overrides.injuries = normalizeInjuryOverrides(inner["injuries"]);
  overrides.coaches = normalizeCoachOverrides(inner["coaches"]);
  return overrides;
}

function normalizeTeamOverrides(raw: unknown): Record<string, TeamOverride> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const output: Record<string, TeamOverride> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") {
      output[key] = {};
      continue;
    }
    const source = value as Record<string, unknown>;
    const rosterAdd = Array.isArray(source["roster_add"]) ? source["roster_add"] : [];
    const rosterDrop = Array.isArray(source["roster_drop"]) ? (source["roster_drop"] as string[]) : [];
    const notes = Array.isArray(source["notes"]) ? (source["notes"] as string[]) : [];
    const coach = source["coach"] && typeof source["coach"] === "object" ? (source["coach"] as CoachOverride) : undefined;
    output[key] = {
      roster_add: rosterAdd as Array<string | PlayerOverride>,
      roster_drop: rosterDrop,
      notes,
      coach,
    };
  }
  return output;
}

function normalizePlayerOverrides(raw: unknown): Record<string, PlayerOverride> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const output: Record<string, PlayerOverride> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const playerOverride: PlayerOverride = { ...((value as Record<string, unknown>) as PlayerOverride) };
    if (!playerOverride.name) {
      playerOverride.name = key;
    }
    output[key] = playerOverride;
  }
  return output;
}

function normalizeInjuryOverrides(raw: unknown): InjuryOverride[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is InjuryOverride => !!entry && typeof entry === "object") as InjuryOverride[];
}

function normalizeCoachOverrides(raw: unknown): CoachOverride[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is CoachOverride => !!entry && typeof entry === "object") as CoachOverride[];
}

async function loadOverrides(): Promise<OverridesConfig> {
  try {
    const contents = await readFile(OVERRIDES_PATH, "utf8");
    const parsed = parseYaml(contents);
    return ensureOverridesConfig(parsed);
  } catch (error) {
    console.warn(`Failed to load overrides: ${(error as Error).message}`);
    return ensureOverridesConfig({});
  }
}

async function loadFallbackPlayers(): Promise<SourcePlayerRecord[]> {
  try {
    const contents = await readFile(ROSTER_REFERENCE_PATH, "utf8");
    const data = JSON.parse(contents) as Array<Record<string, unknown>>;

    const fallback = data
      .map((entry) => {
        const rawFirst = typeof entry["firstName"] === "string" ? (entry["firstName"] as string).trim() : "";
        const rawLast = typeof entry["lastName"] === "string" ? (entry["lastName"] as string).trim() : "";
        const name = `${rawFirst} ${rawLast}`.trim();
        if (!name) {
          return undefined;
        }

        const rawPlayerId = entry["playerId"];
        const playerId = rawPlayerId === null || rawPlayerId === undefined ? undefined : String(rawPlayerId).trim();
        const rawTeamId = entry["teamId"];
        const teamId = rawTeamId === null || rawTeamId === undefined ? undefined : String(rawTeamId).trim();
        const rawTricode = entry["teamTricode"];
        const teamTricode = rawTricode === null || rawTricode === undefined ? undefined : String(rawTricode).trim();
        const rawPosition = entry["position"];
        const position = rawPosition === null || rawPosition === undefined ? undefined : String(rawPosition).trim() || undefined;

        const resolvedTricode = teamTricode ?? (teamId ? TEAM_ID_MAP.get(teamId) : undefined);
        if (!resolvedTricode) {
          return undefined;
        }

        return {
          name,
          playerId: playerId && playerId.length > 0 ? playerId : undefined,
          position,
          teamId,
          teamTricode: resolvedTricode,
        } satisfies SourcePlayerRecord;
      })
      .filter((player): player is SourcePlayerRecord => !!player);

    return fallback;
  } catch (error) {
    console.warn(`Failed to load fallback players: ${(error as Error).message}`);
    return [];
  }
}

function buildFallbackLeagueSourceFromManualRoster(
  fallbackPlayers: SourcePlayerRecord[],
): BallDontLieRosters {
  const teams: Record<string, SourceTeamRecord> = {};
  const players: Record<string, SourcePlayerRecord> = {};

  for (const meta of TEAM_METADATA) {
    teams[meta.tricode] = {
      teamId: meta.teamId,
      tricode: meta.tricode,
      market: meta.market,
      name: meta.name,
      roster: [],
      lastSeasonWins: meta.lastSeasonWins,
      lastSeasonSRS: meta.lastSeasonSRS,
    } as SourceTeamRecord;
  }

  for (const entry of fallbackPlayers) {
    const tricode = entry.teamTricode;
    if (!tricode) continue;
    const team = teams[tricode];
    if (!team) continue;

    const normalized: SourcePlayerRecord = {
      ...entry,
      teamId: team.teamId,
      teamTricode: team.tricode,
    };

    if (!team.roster) {
      team.roster = [];
    }

    if (team.roster.length < MAX_TEAM_ACTIVE) {
      team.roster.push(normalized);
    }

    const key = normalized.playerId ?? normalized.name;
    if (key) {
      players[key] = normalized;
    }
  }

  for (const team of Object.values(teams)) {
    if (team.roster) {
      team.roster = team.roster
        .slice()
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
        .slice(0, MAX_TEAM_ACTIVE);
    }
  }

  const teamAbbrs = Object.keys(teams).sort();

  return {
    teamAbbrs,
    teams,
    players,
    transactions: [],
    coaches: {},
    injuries: [],
  };
}

const TEAM_ID_MAP = new Map(TEAM_METADATA.map((team) => [team.teamId, team.tricode]));

function addPlayerToTeam(
  team: TeamRecord,
  player: InternalPlayer,
  changeLog: Map<string, ChangeLog>,
  markAddition: boolean
) {
  const exists = team.roster.some((existing) => {
    if (existing.playerId && player.playerId) {
      return existing.playerId === player.playerId;
    }
    return existing.name === player.name;
  });
  if (!exists) {
    team.roster.push(player);
    if (markAddition) {
      getChangeLog(changeLog, team.tricode).additions.add(player.name);
      player.isNewAddition = true;
    }
  }
  player.teamTricode = team.tricode;
  player.teamId = team.teamId;
}

function removePlayerFromTeam(team: TeamRecord, player: InternalPlayer, changeLog: Map<string, ChangeLog>) {
  const index = team.roster.findIndex((existing) => {
    if (existing.playerId && player.playerId) {
      return existing.playerId === player.playerId;
    }
    return existing.name === player.name;
  });
  if (index >= 0) {
    team.roster.splice(index, 1);
    getChangeLog(changeLog, team.tricode).losses.add(player.name);
  }
}

function getChangeLog(changeLog: Map<string, ChangeLog>, tricode: string): ChangeLog {
  if (!changeLog.has(tricode)) {
    changeLog.set(tricode, { additions: new Set(), losses: new Set() });
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return changeLog.get(tricode)!;
}

function mergeSources(options: MergeOptions): CanonicalData {
  const { primary, nbaStats, bbr, overrides, fallbackPlayers } = options;
  const teamMap = new Map<string, TeamRecord>();
  const playerMap = new Map<string, InternalPlayer>();
  const changeLog = new Map<string, ChangeLog>();

  for (const meta of TEAM_METADATA) {
    teamMap.set(meta.tricode, createEmptyTeamRecord(meta.tricode));
  }

  const applySourceRoster = (
    sourceTeams: Record<string, Partial<SourceTeamRecord>>,
    sourceTag: string
  ) => {
    for (const [tricode, data] of Object.entries(sourceTeams)) {
      const team = teamMap.get(tricode) ?? createEmptyTeamRecord(tricode);
      teamMap.set(tricode, team);
      if (data.coach && (!team.coach || sourceTag === "nba_stats")) {
        team.coach = { ...data.coach };
      }
      if (typeof data.lastSeasonWins === "number") {
        team.lastSeasonWins = data.lastSeasonWins;
      }
      if (typeof data.lastSeasonSRS === "number") {
        team.lastSeasonSRS = data.lastSeasonSRS;
      }
      if (!data.roster) continue;
      for (const sourcePlayer of data.roster) {
        const key = playerKey(sourcePlayer);
        if (!key) continue;
        const existing = playerMap.get(key);
        const { firstName, lastName } = normalizeName(sourcePlayer.name);
        if (!existing) {
          const player: InternalPlayer = {
            key,
            name: sourcePlayer.name,
            playerId: sourcePlayer.playerId,
            position: sourcePlayer.position,
            firstName,
            lastName,
            teamId: sourcePlayer.teamId ?? team.teamId,
            teamTricode: sourcePlayer.teamTricode ?? tricode,
            source: sourceTag,
          };
          playerMap.set(key, player);
          addPlayerToTeam(team, player, changeLog, false);
        } else {
          if (sourcePlayer.position && !existing.position) {
            existing.position = sourcePlayer.position;
          }
          addPlayerToTeam(team, existing, changeLog, false);
        }
      }
    }
  };

  if (primary?.teams) {
    applySourceRoster(primary.teams as Record<string, Partial<SourceTeamRecord>>, "ball_dont_lie");
  }
  if (nbaStats?.teams) {
    applySourceRoster(nbaStats.teams as Record<string, Partial<SourceTeamRecord>>, "nba_stats");
  }
  if (bbr?.teams) {
    applySourceRoster(bbr.teams as Record<string, Partial<SourceTeamRecord>>, "bbr");
  }

  for (const fallback of fallbackPlayers) {
    const key = playerKey(fallback);
    if (!key) continue;
    if (playerMap.has(key)) {
      continue;
    }
    const teamTricode = fallback.teamTricode ?? (fallback.teamId ? TEAM_ID_MAP.get(fallback.teamId) : undefined);
    if (!teamTricode) {
      continue;
    }
    const team = teamMap.get(teamTricode) ?? createEmptyTeamRecord(teamTricode);
    teamMap.set(teamTricode, team);
    const { firstName, lastName } = normalizeName(fallback.name);
    const player: InternalPlayer = {
      key,
      name: fallback.name,
      playerId: fallback.playerId,
      position: fallback.position,
      firstName,
      lastName,
      teamId: fallback.teamId,
      teamTricode,
      source: "fallback",
    } as InternalPlayer;
    playerMap.set(key, player);
    addPlayerToTeam(team, player, changeLog, false);
  }

  applyOverrides({ overrides, teamMap, playerMap, changeLog });

  const teams = Array.from(teamMap.values()).map((team) => {
    const change = changeLog.get(team.tricode);
    const keyAdditions = Array.from(change?.additions ?? []).sort();
    const keyLosses = Array.from(change?.losses ?? []).sort();
    const roster = team.roster.slice().sort((a, b) => a.name.localeCompare(b.name));
    return {
      ...team,
      roster,
      keyAdditions,
      keyLosses,
    };
  });

  teams.sort((a, b) => a.tricode.localeCompare(b.tricode));

  const players = Array.from(playerMap.values())
    .map((player) => {
      const { key: _key, ...rest } = player;
      return rest;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const injuries: InjuryRecord[] = [
    ...(primary?.injuries ?? []),
    ...(nbaStats?.injuries ?? []),
    ...(bbr?.injuries ?? []),
    ...overrides.injuries,
  ].map((injury) => ({ ...injury }));

  const coachEntries: CoachRecordEntry[] = teams
    .filter((team) => team.coach)
    .map((team) => ({
      teamTricode: team.tricode,
      name: team.coach?.name ?? "",
      role: team.coach?.role,
      isNew: team.coach?.isNew,
    }));

  const transactions: TransactionRecord[] = [
    ...(primary?.transactions ?? []),
    ...(nbaStats?.transactions ?? []),
    ...(bbr?.transactions ?? []),
  ].map((transaction) => ({ ...transaction }));

  return {
    teams,
    players,
    transactions,
    coaches: coachEntries,
    injuries,
  };
}

interface ApplyOverridesContext {
  overrides: OverridesConfig;
  teamMap: Map<string, TeamRecord>;
  playerMap: Map<string, InternalPlayer>;
  changeLog: Map<string, ChangeLog>;
}

function applyOverrides(context: ApplyOverridesContext) {
  const { overrides, teamMap, playerMap, changeLog } = context;

  for (const [tricode, teamOverride] of Object.entries(overrides.teams)) {
    const team = teamMap.get(tricode) ?? createEmptyTeamRecord(tricode);
    teamMap.set(tricode, team);
    if (teamOverride.notes) {
      for (const note of teamOverride.notes) {
        if (!team.notes.includes(note)) {
          team.notes.push(note);
        }
      }
    }
    if (teamOverride.coach) {
      team.coach = {
        name: teamOverride.coach.name,
        role: teamOverride.coach.role,
        isNew: teamOverride.coach.isNew ?? true,
      };
    }
    if (Array.isArray(teamOverride.roster_drop)) {
      for (const name of teamOverride.roster_drop) {
        const player = findPlayer(playerMap, name);
        if (player) {
          removePlayerFromTeam(team, player, changeLog);
          player.teamTricode = undefined;
          player.teamId = undefined;
        }
      }
    }
    if (Array.isArray(teamOverride.roster_add)) {
      for (const entry of teamOverride.roster_add) {
        if (typeof entry === "string") {
          const key = entry;
          const { firstName, lastName } = normalizeName(entry);
          const player: InternalPlayer = {
            key,
            name: entry,
            firstName,
            lastName,
            teamId: team.teamId,
            teamTricode: team.tricode,
            source: "override",
            position: undefined,
          } as InternalPlayer;
          playerMap.set(key, player);
          addPlayerToTeam(team, player, changeLog, true);
        } else if (entry && typeof entry === "object") {
          const overridePlayer = entry as PlayerOverride;
          const key = overridePlayer.name ?? `${team.tricode}-${team.roster.length + 1}`;
          const { firstName, lastName } = normalizeName(overridePlayer.name ?? "");
          const player: InternalPlayer = {
            key,
            name: overridePlayer.name ?? key,
            firstName,
            lastName,
            position: overridePlayer.position,
            teamId: team.teamId,
            teamTricode: team.tricode,
            source: "override",
          } as InternalPlayer;
          playerMap.set(key, player);
          addPlayerToTeam(team, player, changeLog, true);
        }
      }
    }
  }

  for (const playerOverride of Object.values(overrides.players)) {
    const targetName = playerOverride.name ?? "";
    const player = findPlayer(playerMap, targetName) ?? createOrRegisterPlayer(playerMap, targetName);
    if (playerOverride.position) {
      player.position = playerOverride.position;
    }
    if (playerOverride.status) {
      player.status = playerOverride.status;
    }
    if (playerOverride.team) {
      const targetTeam = teamMap.get(playerOverride.team) ?? createEmptyTeamRecord(playerOverride.team);
      teamMap.set(playerOverride.team, targetTeam);
      const currentTeam = player.teamTricode ? teamMap.get(player.teamTricode) : undefined;
      if (currentTeam && currentTeam.tricode !== targetTeam.tricode) {
        removePlayerFromTeam(currentTeam, player, changeLog);
      }
      addPlayerToTeam(targetTeam, player, changeLog, true);
    }
    if (playerOverride.teamId) {
      player.teamId = playerOverride.teamId;
    }
  }

  for (const coachOverride of overrides.coaches) {
    if (!coachOverride.team) continue;
    const team = teamMap.get(coachOverride.team) ?? createEmptyTeamRecord(coachOverride.team);
    teamMap.set(coachOverride.team, team);
    team.coach = {
      name: coachOverride.name,
      role: coachOverride.role,
      isNew: coachOverride.isNew ?? true,
    };
  }
}

function findPlayer(map: Map<string, InternalPlayer>, name: string): InternalPlayer | undefined {
  for (const player of map.values()) {
    if (player.name === name) {
      return player;
    }
  }
  return undefined;
}

function createOrRegisterPlayer(map: Map<string, InternalPlayer>, name: string): InternalPlayer {
  const key = name;
  let player = map.get(key);
  if (!player) {
    const { firstName, lastName } = normalizeName(name);
    player = {
      key,
      name,
      firstName,
      lastName,
      source: "override",
    } as InternalPlayer;
    map.set(key, player);
  }
  return player;
}

async function writeCanonicalOutputs(data: CanonicalData) {
  await mkdir(CANONICAL_DIR, { recursive: true });
  const teamsPath = path.join(CANONICAL_DIR, "teams.json");
  const playersPath = path.join(CANONICAL_DIR, "players.json");
  const transactionsPath = path.join(CANONICAL_DIR, "transactions.json");
  const coachesPath = path.join(CANONICAL_DIR, "coaches.json");
  const injuriesPath = path.join(CANONICAL_DIR, "injuries.json");

  await Promise.all([
    writeFile(teamsPath, JSON.stringify(data.teams, null, 2) + "\n", "utf8"),
    writeFile(playersPath, JSON.stringify(data.players, null, 2) + "\n", "utf8"),
    writeFile(transactionsPath, JSON.stringify(data.transactions, null, 2) + "\n", "utf8"),
    writeFile(coachesPath, JSON.stringify(data.coaches, null, 2) + "\n", "utf8"),
    writeFile(injuriesPath, JSON.stringify(data.injuries, null, 2) + "\n", "utf8"),
  ]);
}

async function run() {
  const data = await buildCanonicalData();
  await writeCanonicalOutputs(data);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { mergeSources };
