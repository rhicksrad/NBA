import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { parse as parseYaml } from "yaml";

import { getPreseasonSchedule } from "../fetch/bdl.js";
import type { BdlGame } from "../fetch/bdl.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const MANUAL_PATH = path.join(ROOT, "data/2025-26/manual/preseason_schedule.yaml");
const CANONICAL_PATH = path.join(ROOT, "data/2025-26/canonical/preseason_schedule.json");

interface RawParticipant {
  tricode?: unknown;
  name?: unknown;
  abbreviation?: unknown;
  league?: unknown;
}

interface RawVenue {
  name?: unknown;
  city?: unknown;
  state?: unknown;
  country?: unknown;
  neutral?: unknown;
}

interface RawCoverage {
  tv?: unknown;
  radio?: unknown;
}

interface RawStorylineItem {
  title?: unknown;
  paragraphs?: unknown;
  bullets?: unknown;
}

interface RawStorylines {
  heading?: unknown;
  introParagraphs?: unknown;
  items?: unknown;
}

interface RawPreview {
  summaryTagline?: unknown;
  matchupSnapshotItems?: unknown;
  storylines?: unknown;
  narrativeHeading?: unknown;
  narrativeQuestions?: unknown;
  closingNote?: unknown;
}

interface RawGame {
  id?: unknown;
  tipoff?: unknown;
  label?: unknown;
  subLabel?: unknown;
  notes?: unknown;
  venue?: unknown;
  away?: unknown;
  home?: unknown;
  coverage?: unknown;
  preview?: unknown;
  useBdl?: unknown;
  bdlId?: unknown;
}

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

function ensureString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function ensureBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

function ensureStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const cleaned = value
    .map((entry) => ensureString(entry))
    .filter((entry): entry is string => typeof entry === "string");
  return cleaned.length > 0 ? cleaned : undefined;
}

function normalizeParticipant(
  raw: unknown,
  role: "home" | "away",
  fallback?: ScheduleParticipant,
): ScheduleParticipant {
  if (!raw || typeof raw !== "object") {
    if (fallback) {
      return fallback;
    }
    throw new Error(`Missing ${role} participant details`);
  }
  const source = raw as RawParticipant;
  const tricode = ensureString(source.tricode)?.toUpperCase() ?? fallback?.tricode;
  const name = ensureString(source.name) ?? fallback?.name;
  const abbreviation = ensureString(source.abbreviation) ?? fallback?.abbreviation;
  const league = ensureString(source.league) ?? fallback?.league;

  if (!tricode && !name) {
    throw new Error(`${role} participant must include a tricode or name`);
  }

  return {
    tricode,
    name,
    abbreviation,
    league,
  };
}

function normalizeVenue(raw: unknown, fallback?: ScheduleVenue): ScheduleVenue {
  if (!raw || typeof raw !== "object") {
    if (fallback) {
      return fallback;
    }
    throw new Error("Missing venue details");
  }
  const source = raw as RawVenue;
  const name = ensureString(source.name) ?? fallback?.name;
  if (!name) {
    throw new Error("Venue name is required");
  }
  const city = ensureString(source.city) ?? fallback?.city;
  const state = ensureString(source.state) ?? fallback?.state;
  const country = ensureString(source.country) ?? fallback?.country;
  const neutral = ensureBoolean(source.neutral) ?? fallback?.neutral ?? false;

  return {
    name,
    city,
    state,
    country,
    neutral,
  };
}

function normalizeCoverage(raw: unknown): ScheduleCoverage | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const source = raw as RawCoverage;
  const tv = ensureStringArray(source.tv);
  const radio = ensureStringArray(source.radio);

  if (!tv && !radio) {
    return undefined;
  }

  return { tv, radio };
}

function normalizeStorylineItem(raw: unknown): StorylineItemOverride | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const source = raw as RawStorylineItem;
  const title = ensureString(source.title);
  const paragraphs = ensureStringArray(source.paragraphs) ?? [];
  const bullets = ensureStringArray(source.bullets) ?? [];

  if (!title && paragraphs.length === 0 && bullets.length === 0) {
    return undefined;
  }

  return {
    title,
    paragraphs: paragraphs.length ? paragraphs : undefined,
    bullets: bullets.length ? bullets : undefined,
  };
}

function normalizeStorylines(raw: unknown): StorylinesOverride | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const source = raw as RawStorylines;
  const heading = ensureString(source.heading);
  const introParagraphs = ensureStringArray(source.introParagraphs);
  const itemsRaw = Array.isArray(source.items) ? source.items : [];
  const items = itemsRaw
    .map((item) => normalizeStorylineItem(item))
    .filter((item): item is StorylineItemOverride => Boolean(item));

  if (!heading && !introParagraphs && items.length === 0) {
    return undefined;
  }

  return {
    heading,
    introParagraphs: introParagraphs && introParagraphs.length > 0 ? introParagraphs : undefined,
    items: items.length > 0 ? items : undefined,
  };
}

function normalizePreview(raw: unknown): PreseasonPreviewOverride | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const source = raw as RawPreview;
  const summaryTagline = ensureString(source.summaryTagline);
  const matchupSnapshotItems = ensureStringArray(source.matchupSnapshotItems);
  const storylines = normalizeStorylines(source.storylines);
  const narrativeHeading = ensureString(source.narrativeHeading);
  const narrativeQuestions = ensureStringArray(source.narrativeQuestions);
  const closingNote = ensureString(source.closingNote);

  if (
    !summaryTagline &&
    !matchupSnapshotItems &&
    !storylines &&
    !narrativeHeading &&
    !narrativeQuestions &&
    !closingNote
  ) {
    return undefined;
  }

  return {
    summaryTagline,
    matchupSnapshotItems,
    storylines,
    narrativeHeading,
    narrativeQuestions,
    closingNote,
  };
}

interface BdlFallbackGame {
  id: string;
  tipoff: string;
  label: string;
  notes: string[];
  venue: ScheduleVenue;
  away: ScheduleParticipant;
  home: ScheduleParticipant;
}

function toBdlParticipant(team: BdlGame["home_team"]): ScheduleParticipant {
  return {
    tricode: team.abbreviation?.toUpperCase(),
    name: team.full_name,
    abbreviation: team.abbreviation?.toUpperCase(),
    league: "NBA",
  };
}

function createBdlFallback(game: BdlGame): BdlFallbackGame {
  const tipoffDate = new Date(game.date);
  if (Number.isNaN(tipoffDate.getTime())) {
    throw new Error(`Ball Don't Lie returned invalid tipoff for game ${game.id}`);
  }
  return {
    id: String(game.id),
    tipoff: tipoffDate.toISOString(),
    label: game.season_type ?? "Preseason",
    notes: [],
    venue: {
      name: "Unknown Venue",
      city: game.home_team.city,
      neutral: false,
    },
    away: toBdlParticipant(game.visitor_team),
    home: toBdlParticipant(game.home_team),
  };
}

function normalizeGame(raw: RawGame, bdlLookup?: Map<string, BdlGame>): PreseasonGame {
  const manualId = ensureString(raw.id);
  const preferBdl = ensureBoolean(raw.useBdl) ?? false;
  const explicitBdlId = ensureString(raw.bdlId);
  const bdlKey = explicitBdlId ?? (preferBdl ? manualId : undefined);
  const bdlGame = bdlLookup && bdlKey ? bdlLookup.get(bdlKey) : undefined;
  if (preferBdl && !bdlGame) {
    throw new Error(`Ball Don't Lie game ${bdlKey ?? manualId ?? "unknown"} not found in cache`);
  }

  const bdlFallback = bdlGame ? createBdlFallback(bdlGame) : undefined;
  const id = manualId ?? bdlFallback?.id;
  if (!id) {
    throw new Error("Each game requires an id");
  }

  const tipoffRaw = ensureString(raw.tipoff) ?? bdlFallback?.tipoff;
  if (!tipoffRaw) {
    throw new Error(`Game ${id} is missing a tipoff timestamp`);
  }
  const tipoffDate = new Date(tipoffRaw);
  if (Number.isNaN(tipoffDate.getTime())) {
    throw new Error(`Game ${id} tipoff is not a valid ISO timestamp`);
  }

  const label = ensureString(raw.label) ?? bdlFallback?.label ?? "Preseason";
  const subLabel = ensureString(raw.subLabel);
  const notes = ensureStringArray(raw.notes) ?? bdlFallback?.notes ?? [];
  const venue = normalizeVenue(raw.venue, bdlFallback?.venue);
  const away = normalizeParticipant(raw.away, "away", bdlFallback?.away);
  const home = normalizeParticipant(raw.home, "home", bdlFallback?.home);
  const coverage = normalizeCoverage(raw.coverage);
  const preview = normalizePreview(raw.preview);

  return {
    id,
    tipoff: tipoffDate.toISOString(),
    label,
    subLabel,
    notes,
    venue,
    away,
    home,
    coverage,
    preview,
  };
}

interface RawSchedule {
  season?: unknown;
  games?: unknown;
}

function normalizeSchedule(raw: unknown, bdlLookup?: Map<string, BdlGame>): { season: string; games: PreseasonGame[] } {
  if (!raw || typeof raw !== "object") {
    throw new Error("Preseason schedule YAML must define a mapping");
  }
  const source = raw as RawSchedule;
  const season = ensureString(source.season) ?? "2025-26";
  if (!Array.isArray(source.games)) {
    throw new Error("Preseason schedule must include a games array");
  }
  const games = (source.games as RawGame[]).map((game) => normalizeGame(game, bdlLookup));
  games.sort((a, b) => (a.tipoff < b.tipoff ? -1 : a.tipoff > b.tipoff ? 1 : 0));
  return { season, games };
}

function shouldUseBdlGame(raw: RawGame): boolean {
  const prefer = ensureBoolean(raw.useBdl) ?? false;
  const explicit = ensureString(raw.bdlId);
  return prefer || Boolean(explicit);
}

function parseSeasonYear(season: string): number {
  const match = season.match(/^(\d{4})/);
  if (!match) {
    throw new Error(`Unable to determine season year from label ${season}`);
  }
  const year = Number.parseInt(match[1], 10);
  if (!Number.isFinite(year)) {
    throw new Error(`Invalid season year extracted from ${season}`);
  }
  return year;
}

async function loadBdlLookup(seasonLabel: string): Promise<Map<string, BdlGame>> {
  const seasonYear = parseSeasonYear(seasonLabel);
  const games = await getPreseasonSchedule(seasonYear);
  const map = new Map<string, BdlGame>();
  for (const game of games) {
    map.set(String(game.id), game);
  }
  return map;
}

async function buildPreseasonSchedule(): Promise<PreseasonSchedule> {
  const raw = await readFile(MANUAL_PATH, "utf8");
  const parsed = parseYaml(raw);
  let bdlLookup: Map<string, BdlGame> | undefined;
  if (parsed && typeof parsed === "object") {
    const schedule = parsed as RawSchedule;
    const seasonLabel = ensureString(schedule.season) ?? "2025-26";
    if (Array.isArray(schedule.games)) {
      const needsBdl = (schedule.games as RawGame[]).some((game) => shouldUseBdlGame(game));
      if (needsBdl) {
        bdlLookup = await loadBdlLookup(seasonLabel);
      }
    }
  }
  const { season, games } = normalizeSchedule(parsed, bdlLookup);
  return {
    season,
    generatedAt: new Date().toISOString(),
    games,
  };
}

async function writePreseasonSchedule(schedule: PreseasonSchedule): Promise<void> {
  const contents = `${JSON.stringify(schedule, null, 2)}\n`;
  await writeFile(CANONICAL_PATH, contents, "utf8");
}

async function run(): Promise<void> {
  const schedule = await buildPreseasonSchedule();
  await writePreseasonSchedule(schedule);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { buildPreseasonSchedule };
