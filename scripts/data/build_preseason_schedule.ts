import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { parse as parseYaml } from "yaml";

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
}

interface PreseasonSchedule {
  season: string;
  generatedAt: string;
  games: PreseasonGame[];
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

function normalizeParticipant(raw: unknown, role: "home" | "away"): ScheduleParticipant {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Missing ${role} participant details`);
  }
  const source = raw as RawParticipant;
  const tricode = ensureString(source.tricode)?.toUpperCase();
  const name = ensureString(source.name);
  const abbreviation = ensureString(source.abbreviation);
  const league = ensureString(source.league);

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

function normalizeVenue(raw: unknown): ScheduleVenue {
  if (!raw || typeof raw !== "object") {
    throw new Error("Missing venue details");
  }
  const source = raw as RawVenue;
  const name = ensureString(source.name);
  if (!name) {
    throw new Error("Venue name is required");
  }
  const city = ensureString(source.city);
  const state = ensureString(source.state);
  const country = ensureString(source.country);
  const neutral = ensureBoolean(source.neutral) ?? false;

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

function normalizeGame(raw: RawGame): PreseasonGame {
  const id = ensureString(raw.id);
  if (!id) {
    throw new Error("Each game requires an id");
  }
  const tipoffRaw = ensureString(raw.tipoff);
  if (!tipoffRaw) {
    throw new Error(`Game ${id} is missing a tipoff timestamp`);
  }
  const tipoffDate = new Date(tipoffRaw);
  if (Number.isNaN(tipoffDate.getTime())) {
    throw new Error(`Game ${id} tipoff is not a valid ISO timestamp`);
  }
  const label = ensureString(raw.label) ?? "Preseason";
  const subLabel = ensureString(raw.subLabel);
  const notes = ensureStringArray(raw.notes) ?? [];
  const venue = normalizeVenue(raw.venue);
  const away = normalizeParticipant(raw.away, "away");
  const home = normalizeParticipant(raw.home, "home");
  const coverage = normalizeCoverage(raw.coverage);

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
  };
}

interface RawSchedule {
  season?: unknown;
  games?: unknown;
}

function normalizeSchedule(raw: unknown): { season: string; games: PreseasonGame[] } {
  if (!raw || typeof raw !== "object") {
    throw new Error("Preseason schedule YAML must define a mapping");
  }
  const source = raw as RawSchedule;
  const season = ensureString(source.season) ?? "2025-26";
  if (!Array.isArray(source.games)) {
    throw new Error("Preseason schedule must include a games array");
  }
  const games = (source.games as RawGame[]).map((game) => normalizeGame(game));
  games.sort((a, b) => (a.tipoff < b.tipoff ? -1 : a.tipoff > b.tipoff ? 1 : 0));
  return { season, games };
}

async function buildPreseasonSchedule(): Promise<PreseasonSchedule> {
  const raw = await readFile(MANUAL_PATH, "utf8");
  const parsed = parseYaml(raw);
  const { season, games } = normalizeSchedule(parsed);
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
