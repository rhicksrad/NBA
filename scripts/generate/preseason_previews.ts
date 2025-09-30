import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { SEASON } from "../lib/season.js";
import { PlayerRecord, TeamRecord } from "../lib/types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const CANONICAL_DIR = path.join(ROOT, "data/2025-26/canonical");
const PUBLIC_DIR = path.join(ROOT, "public");
const PREVIEWS_DIR = path.join(PUBLIC_DIR, "previews");
const DATA_DIR = path.join(PUBLIC_DIR, "data");

interface ScheduleParticipant {
  tricode?: string;
  name?: string;
  abbreviation?: string;
  league?: string;
}

interface ScheduleVenue {
  name: string;
  city?: string;
  state?: string;
  country?: string;
  neutral?: boolean;
}

interface ScheduleCoverage {
  tv?: string[];
  radio?: string[];
}

interface PreseasonGame {
  id: string;
  tipoff: string;
  label: string;
  subLabel?: string;
  notes: string[];
  venue: ScheduleVenue;
  away: ScheduleParticipant;
  home: ScheduleParticipant;
  coverage?: ScheduleCoverage;
  preview?: PreseasonPreviewOverride;
}

interface PreseasonSchedule {
  season: string;
  generatedAt: string;
  games: PreseasonGame[];
}

interface StorylineItemOverride {
  title?: string;
  paragraphs?: string[];
  bullets?: string[];
}

interface StorylinesOverride {
  heading?: string;
  introParagraphs?: string[];
  items?: StorylineItemOverride[];
}

interface PreseasonPreviewOverride {
  summaryTagline?: string;
  matchupSnapshotItems?: string[];
  storylines?: StorylinesOverride;
  narrativeHeading?: string;
  narrativeQuestions?: string[];
  closingNote?: string;
}

interface TeamContext {
  record?: TeamRecord;
  displayName: string;
  noun: string;
  descriptor: string;
  abbreviation?: string;
  tricode?: string;
  leagueTag?: string;
  isGuest: boolean;
  metrics?: TeamMetrics;
  roster?: TeamRosterBreakdown;
  injuries?: TeamInjurySummary;
}

interface RosterPlayerEntry {
  id?: number;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
}

interface RosterTeamEntry {
  id?: number;
  abbreviation?: string | null;
  roster?: RosterPlayerEntry[];
}

interface RosterPayload {
  fetched_at?: string | null;
  source?: string | null;
  teams?: RosterTeamEntry[];
}

interface InjuryItemEntry {
  player?: string | null;
  status?: string | null;
  description?: string | null;
  return_date?: string | null;
  team_tricode?: string | null;
  report_label?: string | null;
}

interface InjuryPayload {
  fetched_at?: string | null;
  source?: string | null;
  items?: InjuryItemEntry[];
}

interface TeamInjuryDetail {
  name: string;
  status?: string;
  description?: string;
  returnDate?: string;
  reportLabel?: string;
}

interface TeamInjurySummary {
  players: TeamInjuryDetail[];
}

interface TeamRosterBreakdown {
  rosterCount: number;
  guards: string[];
  wings: string[];
  bigs: string[];
  others: string[];
  allPlayers: string[];
  rotationCore: string[];
  depthCandidates: string[];
}

interface GeneratedPreviewData {
  summaryTagline: string;
  matchupSnapshotItems: string[];
  storylines: StorylinesOverride;
  narrativeQuestions: string[];
  narrativeHeading: string;
  closingNote: string;
}

interface DataAttributionMeta {
  rosterFetchedAt?: string;
  rosterSource?: string;
  injuryFetchedAt?: string;
  injurySource?: string;
}

type TeamMetricKey =
  | "winPct"
  | "avgPointsFor"
  | "avgPointsAgainst"
  | "netMargin"
  | "fieldGoalPct"
  | "threePointPct"
  | "rebounds"
  | "assists"
  | "turnovers"
  | "pointsInPaint"
  | "fastBreakPoints"
  | "benchPoints";

type TeamMetrics = Partial<Record<TeamMetricKey, number>>;

interface MetricConfig {
  key: TeamMetricKey;
  label: string;
  description: string;
  format: (value: number) => string;
  inverse?: boolean;
}

interface MetricExtent {
  min: number;
  max: number;
  values: number[];
}

interface TeamProfileEntry {
  abbreviation?: string;
  metrics?: Record<string, unknown>;
}

interface TeamProfilesPayload {
  teams?: TeamProfileEntry[];
}

const PRIOR_SEASON = "2024-25";

const SIGNATURE_VISUALS: MetricConfig[] = [
  {
    key: "winPct",
    label: "Win percentage",
    description: "Share of games won across the tracked 2024-25 sample.",
    format: (value) => `${(value * 100).toFixed(1)}%`,
  },
  {
    key: "avgPointsFor",
    label: "Points for",
    description: "Average points scored per game.",
    format: (value) => value.toFixed(1),
  },
  {
    key: "avgPointsAgainst",
    label: "Points allowed",
    description: "Average points conceded per game.",
    format: (value) => value.toFixed(1),
    inverse: true,
  },
  {
    key: "netMargin",
    label: "Net margin",
    description: "Average scoring differential versus opponents.",
    format: (value) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}`,
  },
  {
    key: "fieldGoalPct",
    label: "Field goal accuracy",
    description: "Overall shooting efficiency from the floor.",
    format: (value) => `${(value * 100).toFixed(1)}%`,
  },
  {
    key: "threePointPct",
    label: "Three-point accuracy",
    description: "Conversion rate on perimeter attempts.",
    format: (value) => `${(value * 100).toFixed(1)}%`,
  },
  {
    key: "rebounds",
    label: "Rebounds",
    description: "Average total rebounds secured per night.",
    format: (value) => value.toFixed(1),
  },
  {
    key: "assists",
    label: "Assists",
    description: "Average assists generated each game.",
    format: (value) => value.toFixed(1),
  },
  {
    key: "turnovers",
    label: "Turnovers",
    description: "Average turnovers committed per outing (lower is stronger).",
    format: (value) => value.toFixed(1),
    inverse: true,
  },
  {
    key: "pointsInPaint",
    label: "Points in the paint",
    description: "Interior scoring output per contest.",
    format: (value) => value.toFixed(1),
  },
  {
    key: "fastBreakPoints",
    label: "Fast-break points",
    description: "Transition scoring per game.",
    format: (value) => value.toFixed(1),
  },
  {
    key: "benchPoints",
    label: "Bench points",
    description: "Second-unit scoring production.",
    format: (value) => value.toFixed(1),
  },
];

interface OpenersEntry {
  teamId: string;
  teamName: string;
  teamAbbreviation: string;
  opponentId?: string | null;
  opponentName: string;
  opponentAbbreviation?: string | null;
  gameId: string;
  date: string;
  arena: string;
  city?: string;
  state?: string;
  country?: string;
  homeAway: "home" | "away" | "neutral";
  label?: string;
}

interface OpenersIndexEntry {
  entry: OpenersEntry;
  tipoff: number;
}

async function loadJson<T>(fileName: string): Promise<T> {
  const filePath = path.join(CANONICAL_DIR, fileName);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function ensureOutputDirs(): Promise<void> {
  await mkdir(PREVIEWS_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });
}

async function cleanExistingPreviews(): Promise<void> {
  try {
    const entries = await readdir(PREVIEWS_DIR, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.startsWith("preseason-"))
        .map((entry) => rm(path.join(PREVIEWS_DIR, entry.name)))
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
}

function buildTeamLookup(teams: TeamRecord[]): Map<string, TeamRecord> {
  return new Map(teams.map((team) => [team.tricode.toUpperCase(), team]));
}

function formatRangeValue(value: number | undefined, config: MetricConfig): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return config.format(value);
}

function normaliseValue(value: number, extent: MetricExtent | undefined, inverse = false): number {
  if (!extent || !Number.isFinite(extent.min) || !Number.isFinite(extent.max) || extent.max === extent.min) {
    return 0.5;
  }
  const ratio = (value - extent.min) / (extent.max - extent.min);
  const clamped = Math.min(1, Math.max(0, ratio));
  return inverse ? 1 - clamped : clamped;
}

function upperBound(values: number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] <= target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function lowerBound(values: number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function computePercentile(value: number, extent: MetricExtent | undefined, inverse = false): number | null {
  if (!Number.isFinite(value) || !extent || !extent.values.length) {
    return null;
  }
  const values = extent.values;
  const size = values.length;
  if (!size) {
    return null;
  }
  if (inverse) {
    const index = lowerBound(values, value);
    const count = size - index;
    return Math.min(1, Math.max(0, count / size));
  }
  const rank = upperBound(values, value);
  return Math.min(1, Math.max(0, rank / size));
}

function formatOrdinal(value: number): string {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${value}th`;
  }
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function formatPercentileRank(percentile: number | null): string {
  if (percentile === null) {
    return "";
  }
  const percentage = Math.round(Math.min(100, Math.max(0, percentile * 100)));
  return `${formatOrdinal(percentage)} percentile`;
}

async function loadTeamMetrics(): Promise<{
  lookup: Map<string, TeamMetrics>;
  extents: Map<TeamMetricKey, MetricExtent>;
}> {
  const metricsLookup = new Map<string, TeamMetrics>();
  const extentValues = new Map<TeamMetricKey, number[]>(
    SIGNATURE_VISUALS.map((config) => [config.key, []])
  );

  try {
    const filePath = path.join(PUBLIC_DIR, "data/team_profiles.json");
    const raw = await readFile(filePath, "utf8");
    const payload = JSON.parse(raw) as TeamProfilesPayload;
    const teams = Array.isArray(payload?.teams) ? payload.teams : [];

    for (const entry of teams) {
      const abbreviation = typeof entry?.abbreviation === "string" ? entry.abbreviation.toUpperCase() : "";
      if (!abbreviation) {
        continue;
      }

      const sourceMetrics = entry.metrics ?? {};
      const metrics: TeamMetrics = {};
      let hasValue = false;
      for (const config of SIGNATURE_VISUALS) {
        const rawValue = sourceMetrics[config.key];
        if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
          metrics[config.key] = rawValue;
          const bucket = extentValues.get(config.key);
          if (bucket) {
            bucket.push(rawValue);
          }
          hasValue = true;
        }
      }

      if (hasValue) {
        metricsLookup.set(abbreviation, metrics);
      }
    }
  } catch (error) {
    console.warn("Unable to load team profile metrics for preseason previews.", error);
  }

  const extents = new Map<TeamMetricKey, MetricExtent>();
  for (const config of SIGNATURE_VISUALS) {
    const values = extentValues.get(config.key) ?? [];
    if (!values.length) {
      continue;
    }
    const sorted = [...values].sort((a, b) => a - b);
    extents.set(config.key, {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      values: sorted,
    });
  }

  return { lookup: metricsLookup, extents };
}

function parsePlayerName(entry: RosterPlayerEntry): string | null {
  const first = entry.first_name?.trim() ?? "";
  const last = entry.last_name?.trim() ?? "";
  const combined = `${first} ${last}`.trim();
  if (combined.length) {
    return combined;
  }
  return null;
}

function splitName(name: string | undefined): { first?: string; last?: string } {
  if (!name) {
    return {};
  }
  const trimmed = name.trim();
  if (!trimmed.length) {
    return {};
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0] };
  }
  return {
    first: parts.slice(0, -1).join(" "),
    last: parts[parts.length - 1],
  };
}

function toRosterEntryFromPlayerRecord(player: PlayerRecord): RosterPlayerEntry {
  const parsedId = (() => {
    const raw = player.playerId?.trim();
    if (!raw) {
      return undefined;
    }
    const numeric = Number.parseInt(raw, 10);
    return Number.isFinite(numeric) ? numeric : undefined;
  })();

  const directFirst = player.firstName?.trim();
  const directLast = player.lastName?.trim();
  const fullNameParts = splitName(player.name);

  return {
    id: parsedId,
    first_name: directFirst ?? fullNameParts.first ?? null,
    last_name: directLast ?? fullNameParts.last ?? null,
    position: player.position ?? null,
  };
}

function parsePositionTokens(position: string | null | undefined): string[] {
  if (!position) {
    return [];
  }
  return position
    .toUpperCase()
    .split(/[^A-Z]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function buildTeamRosterBreakdownFromPlayers(players: RosterPlayerEntry[]): TeamRosterBreakdown {
  const guardSet = new Set<string>();
  const wingSet = new Set<string>();
  const bigSet = new Set<string>();
  const otherSet = new Set<string>();
  const allSet = new Set<string>();

  for (const entry of players) {
    const name = parsePlayerName(entry);
    if (!name) {
      continue;
    }
    allSet.add(name);
    const tokens = parsePositionTokens(entry.position);
    const hasGuard = tokens.some((token) => token.includes("G"));
    const hasForward = tokens.some((token) => token.includes("F"));
    const hasCenter = tokens.some((token) => token.includes("C"));

    if (hasGuard) {
      guardSet.add(name);
    }
    if (hasForward) {
      wingSet.add(name);
    }
    if (hasCenter) {
      bigSet.add(name);
    }
    if (!hasGuard && !hasForward && !hasCenter) {
      otherSet.add(name);
    }
  }

  const guards = Array.from(guardSet).sort((a, b) => a.localeCompare(b));
  const wings = Array.from(wingSet).sort((a, b) => a.localeCompare(b));
  const bigs = Array.from(bigSet).sort((a, b) => a.localeCompare(b));
  const allPlayers = Array.from(allSet).sort((a, b) => a.localeCompare(b));
  const others = Array.from(otherSet).sort((a, b) => a.localeCompare(b));

  const coreOrder: string[] = [];
  const pushCore = (names: string[], limit: number) => {
    for (const name of names) {
      if (coreOrder.length >= limit) {
        break;
      }
      if (!coreOrder.includes(name)) {
        coreOrder.push(name);
      }
    }
  };

  pushCore(guards, 6);
  pushCore(wings, 6);
  pushCore(bigs, 6);
  if (coreOrder.length < 6) {
    pushCore(allPlayers, 6);
  }

  const rotationCore = [...coreOrder];
  const depthCandidates = allPlayers.filter((name) => !rotationCore.includes(name));

  return {
    rosterCount: allPlayers.length,
    guards,
    wings,
    bigs,
    others,
    allPlayers,
    rotationCore,
    depthCandidates,
  };
}

async function loadRosterMetadata(): Promise<{ fetchedAt?: string; source?: string }> {
  try {
    const filePath = path.join(PUBLIC_DIR, "data/rosters.json");
    const raw = await readFile(filePath, "utf8");
    const payload = JSON.parse(raw) as RosterPayload;
    return {
      fetchedAt: typeof payload?.fetched_at === "string" ? payload.fetched_at : undefined,
      source: typeof payload?.source === "string" ? payload.source : undefined,
    };
  } catch (error) {
    console.warn("Unable to load roster metadata from public/data/rosters.json.", error);
    return {};
  }
}

async function loadTeamRosters(): Promise<{
  lookup: Map<string, TeamRosterBreakdown>;
  fetchedAt?: string;
  source?: string;
}> {
  const rosterLookup = new Map<string, TeamRosterBreakdown>();
  let fetchedAt: string | undefined;
  let source: string | undefined;

  const meta = await loadRosterMetadata();
  fetchedAt = meta.fetchedAt;
  source = meta.source;

  try {
    const teams = await loadJson<TeamRecord[]>("teams.json");
    for (const team of teams) {
      const roster = Array.isArray(team?.roster) ? team.roster : [];
      if (!roster.length) {
        continue;
      }
      const normalized = roster.map(toRosterEntryFromPlayerRecord);
      rosterLookup.set(team.tricode.toUpperCase(), buildTeamRosterBreakdownFromPlayers(normalized));
    }
  } catch (error) {
    console.warn("Unable to load canonical roster snapshot for preseason previews.", error);
  }

  return { lookup: rosterLookup, fetchedAt, source };
}

function buildTeamInjurySummary(items: InjuryItemEntry[]): TeamInjurySummary {
  const players: TeamInjuryDetail[] = [];
  for (const entry of items) {
    const name = entry?.player?.trim();
    if (!name) {
      continue;
    }
    players.push({
      name,
      status: entry?.status?.trim() || undefined,
      description: entry?.description?.trim() || undefined,
      returnDate: entry?.return_date?.trim() || undefined,
      reportLabel: entry?.report_label?.trim() || undefined,
    });
  }
  return { players };
}

async function loadTeamInjuries(): Promise<{
  lookup: Map<string, TeamInjurySummary>;
  fetchedAt?: string;
  source?: string;
}> {
  const injuryLookup = new Map<string, TeamInjurySummary>();
  try {
    const filePath = path.join(PUBLIC_DIR, "data/player_injuries.json");
    const raw = await readFile(filePath, "utf8");
    const payload = JSON.parse(raw) as InjuryPayload;
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const grouped = new Map<string, InjuryItemEntry[]>();
    for (const item of items) {
      const tricode = item?.team_tricode?.trim();
      if (!tricode) {
        continue;
      }
      const bucket = grouped.get(tricode.toUpperCase());
      if (bucket) {
        bucket.push(item);
      } else {
        grouped.set(tricode.toUpperCase(), [item]);
      }
    }
    for (const [tricode, entries] of grouped.entries()) {
      injuryLookup.set(tricode, buildTeamInjurySummary(entries));
    }
    return {
      lookup: injuryLookup,
      fetchedAt: typeof payload?.fetched_at === "string" ? payload.fetched_at : undefined,
      source: typeof payload?.source === "string" ? payload.source : undefined,
    };
  } catch (error) {
    console.warn("Unable to load Ball Don't Lie injury snapshot for preseason previews.", error);
    return { lookup: injuryLookup };
  }
}

function formatList(values: string[], limit?: number): string {
  const entries = limit ? values.slice(0, limit) : values.slice();
  if (!entries.length) {
    return "";
  }
  if (entries.length === 1) {
    return entries[0];
  }
  if (entries.length === 2) {
    return `${entries[0]} and ${entries[1]}`;
  }
  return `${entries.slice(0, -1).join(", ")}, and ${entries[entries.length - 1]}`;
}

function pluralize(word: string, count: number): string {
  if (count === 1) {
    return word;
  }
  const lower = word.toLowerCase();
  if (lower === "big") {
    return "bigs";
  }
  if (lower.endsWith("y")) {
    return `${word.slice(0, -1)}ies`;
  }
  if (lower === "player") {
    return "players";
  }
  return `${word}s`;
}

type RoleType = "guard" | "wing" | "big" | "player";

function getNamesForRole(breakdown: TeamRosterBreakdown | undefined, role: RoleType): string[] {
  if (!breakdown) {
    return [];
  }
  switch (role) {
    case "guard":
      return breakdown.guards;
    case "wing":
      return breakdown.wings;
    case "big":
      return breakdown.bigs;
    case "player":
    default:
      return breakdown.allPlayers;
  }
}

function chooseFocus(breakdown: TeamRosterBreakdown | undefined, allowSingles = true): {
  role: RoleType;
  names: string[];
} {
  if (!breakdown) {
    return { role: "player", names: [] };
  }
  const preferredOrder: RoleType[] = ["guard", "wing", "big"];
  for (const role of preferredOrder) {
    const names = getNamesForRole(breakdown, role);
    if (names.length >= 2) {
      return { role, names };
    }
  }
  if (allowSingles) {
    for (const role of preferredOrder) {
      const names = getNamesForRole(breakdown, role);
      if (names.length >= 1) {
        return { role, names };
      }
    }
  }
  return { role: "player", names: breakdown.allPlayers };
}

function chooseFrontcourtFocus(breakdown: TeamRosterBreakdown | undefined): {
  role: RoleType;
  names: string[];
} {
  if (!breakdown) {
    return { role: "player", names: [] };
  }
  const frontcourtOrder: RoleType[] = ["big", "wing"];
  for (const role of frontcourtOrder) {
    const names = getNamesForRole(breakdown, role);
    if (names.length >= 2) {
      return { role, names };
    }
  }
  for (const role of frontcourtOrder) {
    const names = getNamesForRole(breakdown, role);
    if (names.length >= 1) {
      return { role, names };
    }
  }
  return { role: "player", names: breakdown.allPlayers };
}

function formatFocus(focus: { role: RoleType; names: string[] }, limit = 3): string {
  const names = focus.names.slice(0, limit);
  if (!names.length) {
    return "";
  }
  const roleLabel = pluralize(focus.role, names.length);
  return `${roleLabel} ${formatList(names)}`;
}

function formatRoleGroup(role: RoleType, names: string[], limit = 3): string {
  if (!names.length) {
    return "";
  }
  const trimmed = names.slice(0, limit);
  const label = pluralize(role, trimmed.length);
  return `${label} ${formatList(trimmed)}`;
}

function describeTeamFocus(team: TeamContext): string {
  const roster = team.roster;
  if (!roster || !roster.allPlayers.length) {
    return `${team.displayName} continue preseason evaluations across their roster.`;
  }
  const groups: string[] = [];
  if (roster.guards.length) {
    groups.push(`their ${formatRoleGroup("guard", roster.guards)}`);
  }
  if (roster.wings.length) {
    groups.push(`their ${formatRoleGroup("wing", roster.wings)}`);
  }
  if (roster.bigs.length) {
    groups.push(`their ${formatRoleGroup("big", roster.bigs, 2)}`);
  }
  if (!groups.length) {
    const headliners = formatList(roster.allPlayers, 3);
    if (headliners) {
      groups.push(`their ${roster.rosterCount}-player group headlined by ${headliners}`);
    } else {
      groups.push("their roster");
    }
  }
  const joined = groups.length === 1 ? groups[0] : `${groups.slice(0, -1).join(", ")}, and ${groups[groups.length - 1]}`;
  return `${team.displayName} bring ${joined} into camp.`;
}

function formatInjuryLine(team: TeamContext): string {
  const injuries = team.injuries?.players ?? [];
  if (!injuries.length) {
    return "";
  }
  const details = injuries.slice(0, 2).map((entry) => {
    const status = entry.status ? entry.status.toLowerCase() : "status unknown";
    const returnDate = entry.returnDate ? `, target ${entry.returnDate}` : "";
    return `${entry.name} (${status}${returnDate})`;
  });
  return `${team.displayName} monitor ${formatList(details)}`;
}

function formatInjuryBullet(teamName: string, injuries: TeamInjuryDetail[]): string {
  if (!injuries.length) {
    return "";
  }
  const snippets = injuries.slice(0, 3).map((entry) => {
    const status = entry.status ? entry.status.toLowerCase() : "status unknown";
    const returnDate = entry.returnDate ? `, target ${entry.returnDate}` : "";
    return `${entry.name} (${status}${returnDate})`;
  });
  return `${teamName}: ${snippets.join("; ")}`;
}

function buildSummaryTagline(away: TeamContext, home: TeamContext): string {
  const awayFocus = formatFocus(chooseFocus(away.roster));
  const homeFocus = formatFocus(chooseFocus(home.roster));
  const segments: string[] = [];
  if (awayFocus) {
    segments.push(`${away.displayName} test ${awayFocus} as camp reps ramp up.`);
  } else {
    segments.push(`${away.displayName} use the preseason to evaluate their rotation.`);
  }
  if (homeFocus) {
    segments.push(`${home.displayName} spotlight ${homeFocus} while tracking chemistry.`);
  } else {
    segments.push(`${home.displayName} emphasize conditioning and evaluation.`);
  }
  const awayInjury = formatInjuryLine(away);
  const homeInjury = formatInjuryLine(home);
  if (awayInjury && homeInjury) {
    segments.push(`Availability watch: ${awayInjury}; ${homeInjury}.`);
  } else if (awayInjury || homeInjury) {
    segments.push(`Availability watch: ${awayInjury || homeInjury}.`);
  }
  return segments.join(" ");
}

function buildBackcourtLine(away: TeamContext, home: TeamContext): string | null {
  const awayFocus = formatFocus({ role: "guard", names: getNamesForRole(away.roster, "guard") });
  const homeFocus = formatFocus({ role: "guard", names: getNamesForRole(home.roster, "guard") });
  if (!awayFocus && !homeFocus) {
    return null;
  }
  const awayPart = awayFocus || "rotation evaluation";
  const homePart = homeFocus || "rotation evaluation";
  return `Backcourt spotlight: ${awayPart} vs. ${homePart}.`;
}

function buildFrontcourtLine(away: TeamContext, home: TeamContext): string | null {
  const awayFocus = formatFocus(chooseFrontcourtFocus(away.roster));
  const homeFocus = formatFocus(chooseFrontcourtFocus(home.roster));
  if (!awayFocus && !homeFocus) {
    return null;
  }
  const awayPart = awayFocus || "depth pieces";
  const homePart = homeFocus || "depth pieces";
  return `Frontcourt reps: ${awayPart} vs. ${homePart}.`;
}

function buildAvailabilityLine(away: TeamContext, home: TeamContext): string | null {
  const awayInjury = formatInjuryLine(away);
  const homeInjury = formatInjuryLine(home);
  if (!awayInjury && !homeInjury) {
    return null;
  }
  if (awayInjury && homeInjury) {
    return `Availability notes: ${awayInjury}; ${homeInjury}.`;
  }
  return `Availability notes: ${awayInjury || homeInjury}.`;
}

function buildRosterCountLine(away: TeamContext, home: TeamContext): string {
  const awayCount = away.roster?.rosterCount;
  const homeCount = home.roster?.rosterCount;
  if (awayCount && homeCount) {
    return `${away.displayName} list ${awayCount} players while ${home.displayName} bring ${homeCount}.`;
  }
  if (awayCount) {
    return `${away.displayName} list ${awayCount} players on the camp roster.`;
  }
  if (homeCount) {
    return `${home.displayName} list ${homeCount} players on the camp roster.`;
  }
  return "Camp rosters remain fluid as teams finalize invites.";
}

function buildMatchupSnapshotItems(
  game: PreseasonGame,
  away: TeamContext,
  home: TeamContext
): string[] {
  const items: string[] = [`${away.displayName} vs. ${home.displayName}`];
  const candidates = [buildBackcourtLine(away, home), buildFrontcourtLine(away, home), buildAvailabilityLine(away, home)];
  for (const line of candidates) {
    if (line && items.length < 3) {
      items.push(line);
    }
  }
  if (items.length < 3) {
    items.push(buildRosterCountLine(away, home));
  }
  if (items.length < 3) {
    items.push(labelLine(game));
  }
  return items.slice(0, 3);
}

function buildGuardStoryline(away: TeamContext, home: TeamContext): StorylineItemOverride | null {
  const awayGuards = getNamesForRole(away.roster, "guard");
  const homeGuards = getNamesForRole(home.roster, "guard");
  if (!awayGuards.length && !homeGuards.length) {
    return null;
  }
  const paragraphs: string[] = [];
  if (awayGuards.length) {
    paragraphs.push(`${away.displayName} will test ${formatRoleGroup("guard", awayGuards)} to sort ball-handling combinations.`);
  }
  if (homeGuards.length) {
    paragraphs.push(`${home.displayName} counter with ${formatRoleGroup("guard", homeGuards)} to steady tempo.`);
  }
  return { title: "Backcourt auditions", paragraphs };
}

function buildFrontcourtStoryline(away: TeamContext, home: TeamContext): StorylineItemOverride | null {
  const awayFocus = chooseFrontcourtFocus(away.roster);
  const homeFocus = chooseFrontcourtFocus(home.roster);
  if (!awayFocus.names.length && !homeFocus.names.length) {
    return null;
  }
  const paragraphs: string[] = [];
  if (awayFocus.names.length) {
    paragraphs.push(`${away.displayName} lean on ${formatFocus(awayFocus)} to control the interior rhythms.`);
  }
  if (homeFocus.names.length) {
    paragraphs.push(`${home.displayName} expect ${formatFocus(homeFocus)} to anchor their paint touches.`);
  }
  return { title: "Frontcourt combinations", paragraphs };
}

function buildDepthStoryline(away: TeamContext, home: TeamContext): StorylineItemOverride | null {
  const awayDepth = away.roster?.depthCandidates ?? [];
  const homeDepth = home.roster?.depthCandidates ?? [];
  const paragraphs: string[] = [];
  const bullets: string[] = [];
  if (awayDepth.length) {
    paragraphs.push(`${away.displayName} track reserve pushes from ${formatList(awayDepth, 3)} as camp competition heats up.`);
    bullets.push(`Key reserves — ${away.displayName}: ${formatList(awayDepth, 3)}`);
  }
  if (homeDepth.length) {
    paragraphs.push(`${home.displayName} gauge whether ${formatList(homeDepth, 3)} can carve out rotation trust.`);
    bullets.push(`Key reserves — ${home.displayName}: ${formatList(homeDepth, 3)}`);
  }
  if (!paragraphs.length) {
    return null;
  }
  return { title: "Depth auditions", paragraphs, bullets };
}

function buildInjuryStoryline(away: TeamContext, home: TeamContext): StorylineItemOverride | null {
  const awayInjuries = away.injuries?.players ?? [];
  const homeInjuries = home.injuries?.players ?? [];
  if (!awayInjuries.length && !homeInjuries.length) {
    return null;
  }
  const paragraphs = [
    "Health timelines remain part of the preseason conversation as staffs pace workloads.",
  ];
  const bullets: string[] = [];
  if (awayInjuries.length) {
    bullets.push(formatInjuryBullet(away.displayName, awayInjuries));
  }
  if (homeInjuries.length) {
    bullets.push(formatInjuryBullet(home.displayName, homeInjuries));
  }
  return { title: "Availability watch", paragraphs, bullets };
}

function buildStorylinesFromData(away: TeamContext, home: TeamContext): StorylinesOverride {
  const introParagraphs = [describeTeamFocus(away), describeTeamFocus(home)];
  const items: StorylineItemOverride[] = [];
  const guardItem = buildGuardStoryline(away, home);
  if (guardItem) {
    items.push(guardItem);
  }
  const frontcourtItem = buildFrontcourtStoryline(away, home);
  if (frontcourtItem) {
    items.push(frontcourtItem);
  }
  const depthItem = buildDepthStoryline(away, home);
  if (depthItem) {
    items.push(depthItem);
  }
  const injuryItem = buildInjuryStoryline(away, home);
  if (injuryItem) {
    items.push(injuryItem);
  }
  return {
    heading: "Camp storylines to monitor",
    introParagraphs,
    items,
  };
}

function pickFirstInjury(away: TeamContext, home: TeamContext): { name: string; team: string; returnDate?: string } | null {
  const combined = [
    ...(away.injuries?.players ?? []).map((player) => ({ name: player.name, team: away.displayName, returnDate: player.returnDate })),
    ...(home.injuries?.players ?? []).map((player) => ({ name: player.name, team: home.displayName, returnDate: player.returnDate })),
  ];
  if (!combined.length) {
    return null;
  }
  return combined[0];
}

function buildNarrativeQuestionsFromData(away: TeamContext, home: TeamContext): string[] {
  const questions: string[] = [];
  const awayFocus = chooseFocus(away.roster);
  if (awayFocus.names.length) {
    const names = formatList(awayFocus.names, 2);
    const label = pluralize(awayFocus.role, Math.min(awayFocus.names.length, 2));
    questions.push(`Can ${names} lock down ${label} roles for ${away.displayName}?`);
  }
  const homeFront = chooseFrontcourtFocus(home.roster);
  if (homeFront.names.length) {
    const names = formatList(homeFront.names, 2);
    questions.push(`How do ${names} shape ${home.displayName}'s frontcourt identity?`);
  } else {
    const homeFocus = chooseFocus(home.roster);
    if (homeFocus.names.length) {
      const names = formatList(homeFocus.names, 2);
      questions.push(`How quickly do ${names} sync within ${home.displayName}'s scheme?`);
    }
  }
  const depthNames = Array.from(
    new Set([
      ...(away.roster?.depthCandidates.slice(0, 2) ?? []),
      ...(home.roster?.depthCandidates.slice(0, 2) ?? []),
    ]),
  );
  if (depthNames.length) {
    questions.push(`Which reserve makes the loudest preseason statement among ${formatList(depthNames)}?`);
  }
  const injury = pickFirstInjury(away, home);
  if (injury && questions.length < 3) {
    const target = injury.returnDate ? injury.returnDate : "opening night";
    questions.push(`Does ${injury.name} move closer to availability for ${injury.team} by ${target}?`);
  }
  while (questions.length < 3) {
    questions.push(`Which coaching tweak sticks when the ${SEASON} regular season begins?`);
  }
  return questions.slice(0, 3);
}

function formatDataTimestamp(value?: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function normalizeSourceLabel(source?: string): string {
  if (!source) {
    return "Ball Don't Lie";
  }
  const trimmed = source.trim();
  if (!trimmed) {
    return "Ball Don't Lie";
  }
  if (/ball.?don'?t.?lie/i.test(trimmed)) {
    return "Ball Don't Lie";
  }
  return trimmed;
}

function buildClosingNote(meta: DataAttributionMeta): string {
  const source = normalizeSourceLabel(meta.rosterSource ?? meta.injurySource);
  const rosterDate = formatDataTimestamp(meta.rosterFetchedAt);
  const injuryDate = formatDataTimestamp(meta.injuryFetchedAt);
  if (rosterDate && injuryDate) {
    if (rosterDate === injuryDate) {
      return `Player availability reflects ${source} data captured ${rosterDate}.`;
    }
    return `Player availability reflects ${source} rosters (${rosterDate}) and injuries (${injuryDate}).`;
  }
  if (rosterDate) {
    return `Player availability reflects ${source} roster data captured ${rosterDate}.`;
  }
  if (injuryDate) {
    return `Player availability reflects ${source} injury data captured ${injuryDate}.`;
  }
  return `Player availability reflects ${source} roster and injury feeds.`;
}

function buildDataAttribution(meta: DataAttributionMeta): string {
  const source = normalizeSourceLabel(meta.rosterSource ?? meta.injurySource);
  const rosterDate = formatDataTimestamp(meta.rosterFetchedAt);
  const injuryDate = formatDataTimestamp(meta.injuryFetchedAt);
  if (rosterDate && injuryDate) {
    if (rosterDate === injuryDate) {
      return `${source} snapshots: ${rosterDate}.`;
    }
    return `${source} snapshots: rosters ${rosterDate} · injuries ${injuryDate}.`;
  }
  if (rosterDate) {
    return `${source} rosters snapshot: ${rosterDate}.`;
  }
  if (injuryDate) {
    return `${source} injuries snapshot: ${injuryDate}.`;
  }
  return `${source} data snapshots.`;
}

function buildGeneratedPreview(
  game: PreseasonGame,
  away: TeamContext,
  home: TeamContext,
  _venueLine: string,
  meta: DataAttributionMeta
): GeneratedPreviewData {
  return {
    summaryTagline: buildSummaryTagline(away, home),
    matchupSnapshotItems: buildMatchupSnapshotItems(game, away, home),
    storylines: buildStorylinesFromData(away, home),
    narrativeQuestions: buildNarrativeQuestionsFromData(away, home),
    narrativeHeading: "Narrative questions to watch",
    closingNote: buildClosingNote(meta),
  };
}

function mergeStorylines(
  generated: StorylinesOverride | undefined,
  manual: StorylinesOverride | undefined
): StorylinesOverride | undefined {
  if (!manual) {
    return generated;
  }
  if (!generated) {
    return manual;
  }
  return {
    heading: manual.heading ?? generated.heading,
    introParagraphs: manual.introParagraphs ?? generated.introParagraphs,
    items: manual.items ?? generated.items,
  };
}

function describeTeam(
  participant: ScheduleParticipant,
  lookup: Map<string, TeamRecord>,
  metricsLookup: Map<string, TeamMetrics>,
  rosterLookup: Map<string, TeamRosterBreakdown>,
  injuryLookup: Map<string, TeamInjurySummary>
): TeamContext {
  if (participant.tricode) {
    const record = lookup.get(participant.tricode.toUpperCase());
    if (record) {
      const metrics = metricsLookup.get(record.tricode.toUpperCase());
      const roster = rosterLookup.get(record.tricode.toUpperCase());
      const injuries = injuryLookup.get(record.tricode.toUpperCase());
      return {
        record,
        displayName: `${record.market} ${record.name}`,
        noun: record.name,
        descriptor: record.market,
        abbreviation: record.tricode,
        tricode: record.tricode,
        leagueTag: "NBA",
        isGuest: false,
        metrics,
        roster,
        injuries,
      };
    }
  }
  const fallbackName = participant.name ?? (participant.tricode ?? "Guest Team");
  const fallbackTricode = participant.tricode?.toUpperCase();
  const roster = fallbackTricode ? rosterLookup.get(fallbackTricode) : undefined;
  const injuries = fallbackTricode ? injuryLookup.get(fallbackTricode) : undefined;
  return {
    displayName: fallbackName,
    noun: fallbackName,
    descriptor: fallbackName,
    abbreviation: participant.abbreviation,
    tricode: participant.tricode,
    leagueTag: participant.league,
    isGuest: true,
    roster,
    injuries,
  };
}

function formatDateTime(dateIso: string, timeZone: string): string {
  const date = new Date(dateIso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}

function formatVenueLine(venue: ScheduleVenue): string {
  const parts = [venue.name];
  if (venue.city) {
    const locationPieces = [venue.city];
    if (venue.state) {
      locationPieces.push(venue.state);
    } else if (venue.country) {
      locationPieces.push(venue.country);
    }
    parts.push(locationPieces.join(", "));
  } else if (venue.country) {
    parts.push(venue.country);
  }
  return parts.join(" · ");
}

function neutralSuffix(venue: ScheduleVenue, notes: string[]): string | undefined {
  if (venue.neutral) {
    return "Neutral Site";
  }
  const neutralNote = notes.find((note) => note.toLowerCase().includes("neutral"));
  return neutralNote;
}

function articleFor(team: TeamContext): string {
  if (team.isGuest) {
    return team.displayName;
  }
  return `the ${team.noun}`;
}

function describeShowcase(game: PreseasonGame): string {
  if (game.subLabel) {
    return `the ${game.subLabel} showcase`;
  }
  const base = game.label.trim();
  if (base.toLowerCase() === "preseason") {
    return "this preseason matchup";
  }
  return `this ${base.toLowerCase()} matchup`;
}

function buildStoryParagraphs(game: PreseasonGame, away: TeamContext, home: TeamContext, venueLine: string): string[] {
  const neutralNote = neutralSuffix(game.venue, game.notes);
  const crowdDescriptor = neutralNote ? "neutral crowd" : `${home.descriptor} crowd`;
  const showcase = describeShowcase(game);
  const firstParagraph = `${away.displayName} face ${articleFor(home)} at ${venueLine}, opening the ${SEASON} preseason with ${showcase} designed to stress-test training camp priorities.`;

  const secondParagraph = `${away.descriptor}’s staff expects to spotlight rotation hopefuls and sharpen conditioning, while ${
    home.descriptor
  } focuses on lineup chemistry in front of a ${crowdDescriptor}. Both clubs are using this window to evaluate how younger pieces complement their established cores.`;

  return [firstParagraph, secondParagraph];
}

function buildStoryBullets(game: PreseasonGame, away: TeamContext, home: TeamContext): string[] {
  const showcase = describeShowcase(game);
  return [
    `Which emerging contributor helps ${away.displayName} turn preseason reps into regular-season trust?`,
    `How do ${home.displayName} balance veteran rhythm with developmental minutes during ${showcase}?`,
    "Which camp emphasis becomes a lasting talking point for both benches?",
  ];
}

function renderNarrativeQuestions(questions: string[], heading?: string): string {
  if (!questions.length) {
    return "";
  }
  const listMarkup = `
          <ul class="preview-story__list">
            ${questions.map((question) => `<li>${question}</li>`).join("\n            ")}
          </ul>`;
  if (!heading) {
    return listMarkup;
  }
  return `
          <div class="preview-story__narratives">
            <h3>${heading}</h3>
${listMarkup}
          </div>`;
}

function renderStorylineItem(item: StorylineItemOverride, isFirst: boolean): string {
  const blocks: string[] = [];
  if (item.title) {
    blocks.push(`<h3 class="preview-story__item-title">${item.title}</h3>`);
  }
  const paragraphs = item.paragraphs ?? [];
  paragraphs.forEach((paragraph, index) => {
    const className = isFirst && index === 0 ? "preview-story__lead" : "preview-story__paragraph";
    blocks.push(`<p class="${className}">${paragraph}</p>`);
  });
  if (item.bullets?.length) {
    blocks.push(`
            <ul class="preview-story__item-bullets">
              ${item.bullets.map((bullet) => `<li>${bullet}</li>`).join("\n              ")}
            </ul>`);
  }
  if (!blocks.length) {
    return "";
  }
  return `
            <li>
${blocks.join("\n            ")}
            </li>`;
}

function renderStorySection(
  game: PreseasonGame,
  away: TeamContext,
  home: TeamContext,
  venueLine: string,
  override: StorylinesOverride | undefined,
  providedNarratives: string[],
  providedHeading?: string,
  providedClosingNote?: string,
): string {
  const narrativeQuestions = providedNarratives.length
    ? providedNarratives
    : buildStoryBullets(game, away, home);
  const closingNote = providedClosingNote;
  const heading = providedHeading ?? override?.heading ?? "Camp storylines to monitor";

  if (override && (override.introParagraphs?.length || override.items?.length)) {
    const introParagraphs = override.introParagraphs ?? [];
    const introMarkup = introParagraphs
      .map((paragraph, index) => {
        const className = index === 0 ? "preview-story__lead" : "preview-story__paragraph";
        return `<p class="${className}">${paragraph}</p>`;
      })
      .join("\n          ");
    const items = override.items ?? [];
    const renderedItems = items
      .map((item, index) => renderStorylineItem(item, index === 0 && introParagraphs.length === 0))
      .filter((markup) => markup.length > 0);
    const itemsMarkup = renderedItems.length
      ? `
          <ol class="preview-story__list preview-story__list--numbered">
${renderedItems.join("\n")}
          </ol>`
      : "";
    const narrativeHeading = providedHeading ?? override.heading ?? "Narrative questions to watch";
    const narrativesMarkup = narrativeQuestions.length
      ? renderNarrativeQuestions(narrativeQuestions, narrativeHeading)
      : "";
    const noteMarkup = closingNote ? `\n          <p class="preview-story__note">${closingNote}</p>` : "";
    const segments = [introMarkup, itemsMarkup, narrativesMarkup].filter(
      (segment) => segment && segment.trim().length > 0
    );
    return `
        <article class="preview-story preview-card preview-card--story">
          <h2>${heading}</h2>
${segments.join("\n")}${noteMarkup}
        </article>`;
  }

  const storyParagraphs = buildStoryParagraphs(game, away, home, venueLine)
    .map((paragraph, index) => {
      const className = index === 0 ? "preview-story__lead" : "preview-story__paragraph";
      return `<p class="${className}">${paragraph}</p>`;
    })
    .join("\n          ");
  const narrativesMarkup = narrativeQuestions.length
    ? renderNarrativeQuestions(
        narrativeQuestions,
        providedHeading ?? override?.heading ?? "Narrative questions to watch",
      )
    : "";
  const noteMarkup = closingNote ? `\n          <p class="preview-story__note">${closingNote}</p>` : "";
  const segments = [storyParagraphs, narrativesMarkup].filter(
    (segment) => segment && segment.trim().length > 0
  );
  return `
        <article class="preview-story preview-card preview-card--story">
          <h2>${heading}</h2>
${segments.join("\n")}${noteMarkup}
        </article>`;
}

function hasVisualMetrics(team: TeamContext): boolean {
  return SIGNATURE_VISUALS.some((config) => {
    const value = team.metrics?.[config.key];
    return typeof value === "number" && Number.isFinite(value);
  });
}

function renderTeamVisualColumn(
  team: TeamContext,
  metricExtents: Map<TeamMetricKey, MetricExtent>
): string {
  const leagueLabel = team.isGuest ? team.leagueTag ?? "Guest opponent" : team.leagueTag ?? "NBA";
  const chipHtml = leagueLabel ? `<span class="chip preview-visuals__chip">${leagueLabel}</span>` : "";
  const cards: string[] = [];

  for (const config of SIGNATURE_VISUALS) {
    const rawValue = team.metrics?.[config.key];
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      continue;
    }
    const extent = metricExtents.get(config.key);
    const progress = normaliseValue(rawValue, extent, Boolean(config.inverse));
    const percentile = formatPercentileRank(computePercentile(rawValue, extent, Boolean(config.inverse)));
    const minLabel = extent ? formatRangeValue(extent.min, config) : formatRangeValue(rawValue, config);
    const maxLabel = extent ? formatRangeValue(extent.max, config) : formatRangeValue(rawValue, config);
    cards.push(`
            <article class="team-visual">
              <header class="team-visual__header">
                <div class="team-visual__heading">
                  <span class="team-visual__label">${config.label}</span>
                  ${percentile ? `<span class="team-visual__percentile" title="Percentile rank across the league">${percentile}</span>` : ""}
                </div>
                <strong class="team-visual__value">${config.format(rawValue)}</strong>
              </header>
              <p class="team-visual__description">${config.description}</p>
              <div class="team-visual__meter" role="presentation">
                <div class="team-visual__meter-track"></div>
                <div class="team-visual__meter-fill" style="--fill:${(progress * 100).toFixed(1)}%"></div>
              </div>
              <dl class="team-visual__range">
                <div>
                  <dt>League low</dt>
                  <dd>${minLabel}</dd>
                </div>
                <div>
                  <dt>League high</dt>
                  <dd>${maxLabel}</dd>
                </div>
              </dl>
            </article>
          `);
  }

  if (!cards.length) {
    return `
          <article class="preview-visuals__team">
            <header class="preview-visuals__team-header">
              <h3>${team.displayName}</h3>
              ${chipHtml}
            </header>
            <p class="preview-visuals__empty">We don't have ${PRIOR_SEASON} archive visuals for this opponent.</p>
          </article>
        `;
  }

  return `
        <article class="preview-visuals__team">
          <header class="preview-visuals__team-header">
            <h3>${team.displayName}</h3>
            ${chipHtml}
          </header>
          <div class="team-detail__visuals">
            ${cards.join("\n            ")}
          </div>
        </article>
      `;
}

function renderVisualsSection(
  away: TeamContext,
  home: TeamContext,
  metricExtents: Map<TeamMetricKey, MetricExtent>
): string {
  const awayColumn = renderTeamVisualColumn(away, metricExtents);
  const homeColumn = renderTeamVisualColumn(home, metricExtents);
  const showSection = hasVisualMetrics(away) || hasVisualMetrics(home);
  if (!showSection && !awayColumn && !homeColumn) {
    return "";
  }
  return `
        <section class="preview-visuals preview-card preview-card--visuals">
          <div class="preview-visuals__header">
            <h2>Signature visual read</h2>
            <p>
              Twelve precanned visuals benchmark each rotation using the completed ${PRIOR_SEASON} campaign so
              coaches can steer the ${SEASON} preseason focus.
            </p>
          </div>
          <div class="preview-visuals__grid">
            ${awayColumn}
            ${homeColumn}
          </div>
        </section>
      `;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderGamePage(
  game: PreseasonGame,
  away: TeamContext,
  home: TeamContext,
  metricExtents: Map<TeamMetricKey, MetricExtent>,
  options: {
    summaryTagline: string;
    matchupSnapshotItems?: string[];
    storylines?: StorylinesOverride;
    narrativeQuestions: string[];
    narrativeHeading?: string;
    closingNote?: string;
    dataAttribution?: string;
  }
): string {
  const venueLine = formatVenueLine(game.venue);
  const etString = formatDateTime(game.tipoff, "America/New_York");
  const utcString = formatDateTime(game.tipoff, "UTC");
  const neutralNote = neutralSuffix(game.venue, game.notes);
  const summaryTagline = options.summaryTagline || "Key context before rotations start moving.";
  const matchupSnapshotItems = options.matchupSnapshotItems;
  const storySection = renderStorySection(
    game,
    away,
    home,
    venueLine,
    options.storylines,
    options.narrativeQuestions,
    options.narrativeHeading,
    options.closingNote,
  );
  const notes = game.notes.filter((note) => !note.toLowerCase().includes("neutral"));
  const hasCoverage = Boolean(game.coverage?.tv?.length || game.coverage?.radio?.length);
  const visualsSection = renderVisualsSection(away, home, metricExtents);

  const coverageSection = hasCoverage
    ? `
          <section class="preview-summary__card">
            <h2>Coverage</h2>
            ${game.coverage?.tv?.length ? `<p><strong>TV:</strong> ${game.coverage.tv.join(", ")}</p>` : ""}
            ${game.coverage?.radio?.length ? `<p><strong>Radio:</strong> ${game.coverage.radio.join(", ")}</p>` : ""}
          </section>
        `
    : "";

  const notesSection = notes.length
    ? `
          <section class="preview-summary__card">
            <h2>Notes</h2>
            <ul class="preview-summary__list">
              ${notes.map((note) => `<li>${note}</li>`).join("\n              ")}
            </ul>
          </section>
        `
    : "";

  const matchupSnapshot = matchupSnapshotItems?.length
    ? `
            <ul class="preview-summary__list">
              ${matchupSnapshotItems.map((item) => `<li>${item}</li>`).join("\n              ")}
            </ul>`
    : `
            <p>${away.displayName} vs. ${home.displayName}</p>
            <p>${labelLine(game)}</p>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preseason Preview: ${away.displayName} at ${home.displayName}</title>
    <link rel="stylesheet" href="../styles/hub.css" />
    <style>
      body {
        margin: 0;
        padding: clamp(1rem, 2.5vw, 2.4rem);
        display: flex;
        justify-content: center;
        background: color-mix(in srgb, var(--surface-alt) 78%, rgba(14, 34, 68, 0.08) 22%);
      }

      .preview-shell {
        width: min(1040px, 100%);
        display: grid;
        gap: clamp(1.1rem, 2.6vw, 2.15rem);
        background: color-mix(in srgb, rgba(255, 255, 255, 0.95) 74%, rgba(242, 246, 255, 0.92) 26%);
        border-radius: var(--radius-lg);
        border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
        padding: clamp(1.4rem, 2.8vw, 2.35rem);
        box-shadow: 0 28px 42px rgba(11, 37, 69, 0.08);
        position: relative;
        overflow: hidden;
      }

      .preview-shell::before {
        content: "";
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 12% 18%, rgba(17, 86, 214, 0.12), transparent 45%),
          radial-gradient(circle at 88% 12%, rgba(239, 61, 91, 0.1), transparent 50%),
          linear-gradient(160deg, rgba(17, 86, 214, 0.08), rgba(244, 181, 63, 0.06));
        opacity: 0.45;
        pointer-events: none;
      }

      .preview-shell > * {
        position: relative;
      }

      .preview-header {
        display: grid;
        gap: clamp(0.35rem, 1vw, 0.6rem);
        padding: clamp(1.1rem, 2.2vw, 1.6rem);
        border-radius: var(--radius-lg);
        border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
        background: color-mix(in srgb, var(--surface) 82%, rgba(17, 86, 214, 0.06) 18%);
        align-content: start;
      }

      @media (min-width: 720px) {
        .preview-header {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: clamp(0.45rem, 1vw, 0.75rem);
        }

        .preview-header .chip,
        .preview-header h1,
        .preview-header .lead {
          grid-column: 1 / -1;
        }
      }

      .preview-header .chip {
        font-size: 0.7rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .preview-header time,
      .preview-header p:not(.lead) {
        margin: 0;
        font-size: 0.92rem;
        color: color-mix(in srgb, var(--navy) 72%, rgba(14, 34, 68, 0.38) 28%);
      }

      .preview-header h1 {
        margin: 0;
        font-size: clamp(1.65rem, 3.6vw, 2.15rem);
        line-height: 1.08;
        letter-spacing: -0.01em;
        color: var(--navy);
      }

      .preview-header .lead {
        font-size: 0.98rem;
        color: var(--text-subtle);
      }

      .preview-summary {
        display: grid;
        gap: clamp(0.85rem, 2.2vw, 1.4rem);
        padding: clamp(1.05rem, 2.4vw, 1.6rem);
        border-radius: var(--radius-lg);
        border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
        background: color-mix(in srgb, var(--surface) 86%, rgba(17, 86, 214, 0.04) 14%);
      }

      .preview-summary__header {
        display: grid;
        gap: 0.3rem;
      }

      .preview-summary__title {
        margin: 0;
        font-size: 0.78rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--navy) 68%, rgba(14, 34, 68, 0.4) 32%);
      }

      .preview-summary__tagline {
        margin: 0;
        font-size: 0.93rem;
        color: var(--text-subtle);
        max-width: 60ch;
      }

      .preview-summary__grid {
        display: grid;
        gap: clamp(0.85rem, 2.4vw, 1.4rem);
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .preview-summary__card {
        display: grid;
        gap: 0.55rem;
        padding: clamp(0.9rem, 2.2vw, 1.3rem);
        border-radius: var(--radius-lg);
        border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
        background: color-mix(in srgb, rgba(255, 255, 255, 0.95) 72%, rgba(242, 246, 255, 0.92) 28%);
        box-shadow: 0 18px 28px rgba(11, 37, 69, 0.06);
      }

      .preview-summary__card h2 {
        margin: 0;
        font-size: 0.98rem;
        color: var(--navy);
      }

      .preview-summary__card p {
        margin: 0;
        font-size: 0.93rem;
        color: var(--text-subtle);
      }

      .preview-summary__list {
        margin: 0.3rem 0 0 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 0.4rem;
        font-size: 0.93rem;
        color: var(--text-subtle);
      }

      .preview-summary__list li {
        margin: 0;
        padding-left: 1rem;
        position: relative;
      }

      .preview-summary__list li::before {
        content: "•";
        position: absolute;
        left: 0;
        color: var(--royal);
        font-weight: 700;
      }

      .preview-body {
        display: grid;
        gap: clamp(1rem, 2.6vw, 1.7rem);
      }

      @media (min-width: 960px) {
        .preview-body {
          grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
          align-items: start;
        }
      }

      .preview-card {
        display: grid;
        gap: clamp(0.7rem, 2vw, 1.2rem);
        padding: clamp(1rem, 2.4vw, 1.6rem);
        border-radius: var(--radius-lg);
        border: 1px solid color-mix(in srgb, var(--border) 68%, transparent);
        background: color-mix(in srgb, var(--surface) 90%, rgba(17, 86, 214, 0.04) 10%);
        box-shadow: 0 22px 32px rgba(11, 37, 69, 0.07);
      }

      .preview-card--story {
        background: color-mix(in srgb, var(--surface) 88%, rgba(239, 61, 91, 0.05) 12%);
      }

      .preview-card--visuals {
        background: color-mix(in srgb, var(--surface) 88%, rgba(17, 86, 214, 0.06) 12%);
      }

      .preview-story h2 {
        margin: 0;
        font-size: 1.18rem;
        color: var(--navy);
      }

      .preview-story__lead {
        margin: 0;
        font-size: 1rem;
        color: var(--text-strong);
      }

      .preview-story__paragraph {
        margin: 0;
        color: var(--text-subtle);
        font-size: 0.95rem;
      }

      .preview-story__lead + .preview-story__paragraph,
      .preview-story__paragraph + .preview-story__paragraph {
        margin-top: 0.6rem;
      }

      .preview-story__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.6rem;
      }

      .preview-story__list li {
        margin: 0;
        position: relative;
        padding-left: 1.5rem;
        font-weight: 600;
        color: var(--text-strong);
      }

      .preview-story__list li::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0.4rem;
        width: 0.55rem;
        height: 0.55rem;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(17, 86, 214, 0.85), rgba(244, 181, 63, 0.75));
        box-shadow: 0 0 0 3px color-mix(in srgb, rgba(17, 86, 214, 0.1) 60%, rgba(255, 255, 255, 0.92) 40%);
      }

      .preview-story__list--numbered {
        counter-reset: storyline;
        gap: 1rem;
      }

      .preview-story__list--numbered li {
        padding-left: 2.35rem;
        font-weight: 400;
      }

      .preview-story__list--numbered li::before {
        counter-increment: storyline;
        content: counter(storyline);
        display: grid;
        place-items: center;
        width: 1.4rem;
        height: 1.4rem;
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(17, 86, 214, 0.92), rgba(239, 61, 91, 0.85));
        color: #fff;
        font-weight: 700;
        top: 0;
        box-shadow: 0 0 0 3px color-mix(in srgb, rgba(17, 86, 214, 0.1) 60%, rgba(255, 255, 255, 0.92) 40%);
      }

      .preview-story__item-title {
        margin: 0;
        font-size: 1.05rem;
        color: var(--navy);
      }

      .preview-story__item-title + .preview-story__lead,
      .preview-story__item-title + .preview-story__paragraph {
        margin-top: 0.45rem;
      }

      .preview-story__item-bullets {
        margin: 0.75rem 0 0 0;
        padding-left: 1.2rem;
        display: grid;
        gap: 0.35rem;
        color: var(--text-subtle);
        list-style: disc;
      }

      .preview-story__item-bullets li {
        margin: 0;
        padding: 0;
        position: static;
        font-weight: 500;
        color: var(--text-subtle);
        font-size: 0.93rem;
      }

      .preview-story__item-bullets li::before {
        content: none;
      }

      .preview-story__narratives {
        margin-top: 1.2rem;
        display: grid;
        gap: 0.65rem;
      }

      .preview-story__narratives h3 {
        margin: 0;
        font-size: 0.88rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--navy) 68%, rgba(14, 34, 68, 0.4) 32%);
      }

      .preview-story__note {
        margin: 1.1rem 0 0 0;
        color: var(--text-subtle);
        font-style: italic;
        font-size: 0.9rem;
      }

      .preview-visuals {
        display: grid;
        gap: clamp(0.9rem, 2.4vw, 1.4rem);
      }

      .preview-visuals__header {
        display: grid;
        gap: 0.45rem;
      }

      .preview-visuals__header h2 {
        margin: 0;
      }

      .preview-visuals__header p {
        margin: 0;
        color: var(--text-subtle);
        font-size: 0.95rem;
      }

      .preview-visuals__grid {
        display: grid;
        gap: clamp(1rem, 3vw, 1.6rem);
      }

      @media (min-width: 900px) {
        .preview-visuals__grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      .preview-visuals__team {
        display: grid;
        gap: 0.9rem;
      }

      .preview-visuals__team-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .preview-visuals__team-header h3 {
        margin: 0;
        font-size: 1.15rem;
        color: var(--navy);
      }

      .preview-visuals__chip {
        font-size: 0.7rem;
        letter-spacing: 0.08em;
      }

      .preview-visuals__empty {
        margin: 0;
        font-size: 0.95rem;
        color: var(--text-subtle);
      }

      footer {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
        font-size: 0.85rem;
        color: var(--text-subtle);
      }

      footer a {
        color: var(--royal);
        text-decoration: none;
        font-weight: 600;
      }

      footer a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <main class="preview-shell">
      <header class="preview-header">
        <span class="chip">Preseason Preview</span>
        <time datetime="${game.tipoff}">${etString}</time>
        <p>${utcString} (UTC)</p>
        <h1>${away.displayName} at ${home.displayName}</h1>
        <p><strong>${venueLine}</strong>${neutralNote ? ` · ${neutralNote}` : ""}</p>
        ${game.subLabel ? `<p class="lead">${game.subLabel}</p>` : ""}
      </header>

      <section class="preview-summary">
        <header class="preview-summary__header">
          <h2 class="preview-summary__title">Game essentials</h2>
          <p class="preview-summary__tagline">${summaryTagline}</p>
        </header>
        <div class="preview-summary__grid">
          <section class="preview-summary__card">
            <h2>Matchup snapshot</h2>
${matchupSnapshot}
          </section>
          ${coverageSection}
          ${notesSection}
        </div>
      </section>

      <div class="preview-body">
${storySection}

        ${visualsSection}
      </div>

      <footer>
        <span>Season context: ${SEASON} preseason schedule.</span>
        ${options.dataAttribution ? `<span>${options.dataAttribution}</span>` : ""}
        <a href="./index.html">← Back to preseason schedule</a>
      </footer>
    </main>
  </body>
</html>`;
}

function labelLine(game: PreseasonGame): string {
  if (game.subLabel) {
    return `${game.label} · ${game.subLabel}`;
  }
  return game.label;
}

function renderIndex(schedule: PreseasonSchedule, awayContexts: Map<string, TeamContext>, homeContexts: Map<string, TeamContext>): string {
  const rows = schedule.games
    .map((game) => {
      const away = awayContexts.get(game.id);
      const home = homeContexts.get(game.id);
      const etString = formatDateTime(game.tipoff, "America/New_York");
      const slug = slugify(game.id);
      const matchup = `${away?.displayName ?? "Away"} at ${home?.displayName ?? "Home"}`;
      return `<li><a href="preseason-${slug}.html">${matchup}</a> — ${etString}</li>`;
    })
    .join("\n        ");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${SEASON} Preseason Previews</title>
    <link rel="stylesheet" href="../styles/hub.css" />
    <style>
      body {
        margin: 0;
        padding: clamp(1.5rem, 4vw, 3rem);
        font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        background: color-mix(in srgb, var(--surface) 94%, rgba(14, 34, 68, 0.04) 6%);
      }

      main {
        max-width: 900px;
        margin: 0 auto;
        background: color-mix(in srgb, var(--surface) 90%, rgba(14, 34, 68, 0.05) 10%);
        border-radius: var(--radius-xl);
        border: 1px solid color-mix(in srgb, var(--royal) 16%, transparent);
        padding: clamp(1.75rem, 3vw, 2.5rem);
        box-shadow: var(--shadow-soft);
      }

      h1 {
        margin-top: 0;
      }

      ul {
        padding-left: 1.25rem;
      }

      li {
        margin-bottom: 0.75rem;
      }

      a {
        color: var(--royal);
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${SEASON} preseason previews</h1>
      <p>The opening week of exhibition action features international showcases and early tests for every rotation hopeful. Explore each matchup preview below.</p>
      <ul>
        ${rows}
      </ul>
    </main>
  </body>
</html>`;
}

function determineHomeAway(game: PreseasonGame, role: "home" | "away"): "home" | "away" | "neutral" {
  if (game.venue.neutral) {
    return "neutral";
  }
  return role;
}

function buildOpeners(schedule: PreseasonSchedule, contexts: Map<string, TeamContext>): OpenersEntry[] {
  const seen = new Map<string, OpenersIndexEntry>();

  for (const game of schedule.games) {
    const tipoff = new Date(game.tipoff).getTime();
    const homeContext = contexts.get(`${game.id}-home`);
    const awayContext = contexts.get(`${game.id}-away`);

    if (homeContext?.record) {
      const opponent = awayContext;
      const homeEntry: OpenersEntry = {
        teamId: homeContext.record.teamId,
        teamName: homeContext.displayName,
        teamAbbreviation: homeContext.record.tricode,
        opponentId: opponent?.record?.teamId ?? null,
        opponentName: opponent?.displayName ?? "Guest opponent",
        opponentAbbreviation: opponent?.record?.tricode ?? opponent?.abbreviation ?? null,
        gameId: game.id,
        date: game.tipoff,
        arena: game.venue.name,
        city: game.venue.city,
        state: game.venue.state,
        country: game.venue.country,
        homeAway: determineHomeAway(game, "home"),
        label: game.subLabel ?? game.label,
      };
      const existing = seen.get(homeEntry.teamId);
      if (!existing || tipoff < existing.tipoff) {
        seen.set(homeEntry.teamId, { entry: homeEntry, tipoff });
      }
    }

    if (awayContext?.record) {
      const opponent = homeContext;
      const awayEntry: OpenersEntry = {
        teamId: awayContext.record.teamId,
        teamName: awayContext.displayName,
        teamAbbreviation: awayContext.record.tricode,
        opponentId: opponent?.record?.teamId ?? null,
        opponentName: opponent?.displayName ?? "Guest opponent",
        opponentAbbreviation: opponent?.record?.tricode ?? opponent?.abbreviation ?? null,
        gameId: game.id,
        date: game.tipoff,
        arena: game.venue.name,
        city: game.venue.city,
        state: game.venue.state,
        country: game.venue.country,
        homeAway: determineHomeAway(game, "away"),
        label: game.subLabel ?? game.label,
      };
      const existing = seen.get(awayEntry.teamId);
      if (!existing || tipoff < existing.tipoff) {
        seen.set(awayEntry.teamId, { entry: awayEntry, tipoff });
      }
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => a.tipoff - b.tipoff)
    .map((item) => item.entry);
}

async function writeOpeners(entries: OpenersEntry[], season: string): Promise<void> {
  const payload = {
    generatedAt: new Date().toISOString(),
    season,
    games: entries,
  };
  const filePath = path.join(DATA_DIR, "preseason_openers.json");
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function generatePreseasonPreviews(): Promise<void> {
  const [schedule, teams, teamMetrics, rosterData, injuryData] = await Promise.all([
    loadJson<PreseasonSchedule>("preseason_schedule.json"),
    loadJson<TeamRecord[]>("teams.json"),
    loadTeamMetrics(),
    loadTeamRosters(),
    loadTeamInjuries(),
  ]);

  await ensureOutputDirs();
  await cleanExistingPreviews();

  const lookup = buildTeamLookup(teams);
  const metricsLookup = teamMetrics.lookup;
  const metricExtents = teamMetrics.extents;
  const rosterLookup = rosterData.lookup;
  const injuryLookup = injuryData.lookup;
  const dataMeta: DataAttributionMeta = {
    rosterFetchedAt: rosterData.fetchedAt,
    rosterSource: rosterData.source,
    injuryFetchedAt: injuryData.fetchedAt,
    injurySource: injuryData.source,
  };
  const dataAttribution = buildDataAttribution(dataMeta);
  const contextIndex = new Map<string, TeamContext>();
  const awayIndex = new Map<string, TeamContext>();
  const homeIndex = new Map<string, TeamContext>();

  for (const game of schedule.games) {
    const away = describeTeam(game.away, lookup, metricsLookup, rosterLookup, injuryLookup);
    const home = describeTeam(game.home, lookup, metricsLookup, rosterLookup, injuryLookup);
    contextIndex.set(`${game.id}-away`, away);
    contextIndex.set(`${game.id}-home`, home);
    awayIndex.set(game.id, away);
    homeIndex.set(game.id, home);

    const generatedPreview = buildGeneratedPreview(game, away, home, formatVenueLine(game.venue), dataMeta);
    const manualPreview = game.preview;
    const summaryTagline = manualPreview?.summaryTagline ?? generatedPreview.summaryTagline;
    const matchupSnapshotItems = manualPreview?.matchupSnapshotItems ?? generatedPreview.matchupSnapshotItems;
    const storylines = mergeStorylines(generatedPreview.storylines, manualPreview?.storylines);
    const narrativeHeading = manualPreview?.narrativeHeading ?? generatedPreview.narrativeHeading;
    const narrativeQuestions = manualPreview?.narrativeQuestions ?? generatedPreview.narrativeQuestions;
    const closingNote = manualPreview?.closingNote ?? generatedPreview.closingNote;

    const slug = slugify(game.id);
    const filePath = path.join(PREVIEWS_DIR, `preseason-${slug}.html`);
    const html = renderGamePage(game, away, home, metricExtents, {
      summaryTagline,
      matchupSnapshotItems,
      storylines,
      narrativeQuestions,
      narrativeHeading,
      closingNote,
      dataAttribution,
    });
    await writeFile(filePath, `${html}\n`, "utf8");
  }

  const indexHtml = renderIndex(schedule, awayIndex, homeIndex);
  await writeFile(path.join(PREVIEWS_DIR, "index.html"), `${indexHtml}\n`, "utf8");

  const openers = buildOpeners(schedule, contextIndex);
  await writeOpeners(openers, schedule.season ?? SEASON);
}

async function run(): Promise<void> {
  await generatePreseasonPreviews();
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { generatePreseasonPreviews };
