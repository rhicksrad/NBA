import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { parse as parseYaml } from "yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const MANUAL_PATH = path.join(ROOT, "data/2025-26/manual/preseason_preview_overrides.yaml");
const CANONICAL_PATH = path.join(ROOT, "data/2025-26/canonical/preseason_preview_overrides.json");

interface RawSummaryCard {
  title?: unknown;
  body?: unknown;
  bullets?: unknown;
}

interface RawSummaryOverride {
  tagline?: unknown;
  description?: unknown;
  cards?: unknown;
}

interface RawHeaderOverride {
  subLabel?: unknown;
  venueLine?: unknown;
}

interface RawStorySection {
  heading?: unknown;
  paragraphs?: unknown;
  bullets?: unknown;
}

interface RawStoryOverride {
  introParagraphs?: unknown;
  sections?: unknown;
  questionsHeading?: unknown;
  questions?: unknown;
}

interface RawPreviewOverride {
  header?: unknown;
  summary?: unknown;
  story?: unknown;
}

interface RawOverridesPayload {
  season?: unknown;
  overrides?: unknown;
}

interface SummaryCard {
  title: string;
  body?: string[];
  bullets?: string[];
}

interface SummaryOverride {
  tagline?: string;
  description?: string[];
  cards?: SummaryCard[];
}

interface HeaderOverride {
  subLabel?: string;
  venueLine?: string;
}

interface StorySection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

interface StoryOverride {
  introParagraphs?: string[];
  sections?: StorySection[];
  questionsHeading?: string;
  questions?: string[];
}

interface PreviewOverride {
  header?: HeaderOverride;
  summary?: SummaryOverride;
  story?: StoryOverride;
}

interface OverridesPayload {
  season?: string;
  overrides: Record<string, PreviewOverride>;
}

function ensureString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
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
  return cleaned.length ? cleaned : undefined;
}

function normalizeSummaryCard(raw: unknown): SummaryCard | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const source = raw as RawSummaryCard;
  const title = ensureString(source.title);
  if (!title) {
    return undefined;
  }
  const body = ensureStringArray(source.body);
  const bullets = ensureStringArray(source.bullets);
  const card: SummaryCard = { title };
  if (body) {
    card.body = body;
  }
  if (bullets) {
    card.bullets = bullets;
  }
  return card;
}

function normalizeSummaryOverride(raw: unknown): SummaryOverride | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const source = raw as RawSummaryOverride;
  const override: SummaryOverride = {};
  const tagline = ensureString(source.tagline);
  if (tagline) {
    override.tagline = tagline;
  }
  const description = ensureStringArray(source.description);
  if (description) {
    override.description = description;
  }
  if (Array.isArray(source.cards)) {
    const cards = source.cards
      .map((entry) => normalizeSummaryCard(entry))
      .filter((entry): entry is SummaryCard => Boolean(entry));
    if (cards.length) {
      override.cards = cards;
    }
  }
  return Object.keys(override).length ? override : undefined;
}

function normalizeHeaderOverride(raw: unknown): HeaderOverride | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const source = raw as RawHeaderOverride;
  const header: HeaderOverride = {};
  const subLabel = ensureString(source.subLabel);
  if (subLabel) {
    header.subLabel = subLabel;
  }
  const venueLine = ensureString(source.venueLine);
  if (venueLine) {
    header.venueLine = venueLine;
  }
  return Object.keys(header).length ? header : undefined;
}

function normalizeStorySection(raw: unknown): StorySection | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const source = raw as RawStorySection;
  const heading = ensureString(source.heading);
  if (!heading) {
    return undefined;
  }
  const paragraphs = ensureStringArray(source.paragraphs);
  const bullets = ensureStringArray(source.bullets);
  const section: StorySection = { heading };
  if (paragraphs) {
    section.paragraphs = paragraphs;
  }
  if (bullets) {
    section.bullets = bullets;
  }
  return section;
}

function normalizeStoryOverride(raw: unknown): StoryOverride | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const source = raw as RawStoryOverride;
  const override: StoryOverride = {};
  const intro = ensureStringArray(source.introParagraphs);
  if (intro) {
    override.introParagraphs = intro;
  }
  if (Array.isArray(source.sections)) {
    const sections = source.sections
      .map((entry) => normalizeStorySection(entry))
      .filter((entry): entry is StorySection => Boolean(entry));
    if (sections.length) {
      override.sections = sections;
    }
  }
  const questionsHeading = ensureString(source.questionsHeading);
  if (questionsHeading) {
    override.questionsHeading = questionsHeading;
  }
  const questions = ensureStringArray(source.questions);
  if (questions) {
    override.questions = questions;
  }
  return Object.keys(override).length ? override : undefined;
}

function normalizePreviewOverride(raw: unknown): PreviewOverride | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const source = raw as RawPreviewOverride;
  const header = normalizeHeaderOverride(source.header);
  const summary = normalizeSummaryOverride(source.summary);
  const story = normalizeStoryOverride(source.story);
  const override: PreviewOverride = {};
  if (header) {
    override.header = header;
  }
  if (summary) {
    override.summary = summary;
  }
  if (story) {
    override.story = story;
  }
  return Object.keys(override).length ? override : undefined;
}

function normalizeOverridesPayload(raw: unknown): OverridesPayload {
  if (!raw || typeof raw !== "object") {
    return { overrides: {} };
  }
  const source = raw as RawOverridesPayload;
  const season = ensureString(source.season);
  const overrides: Record<string, PreviewOverride> = {};
  if (source.overrides && typeof source.overrides === "object") {
    for (const [key, value] of Object.entries(source.overrides as Record<string, unknown>)) {
      const override = normalizePreviewOverride(value);
      if (override) {
        overrides[key] = override;
      }
    }
  }
  return { season: season ?? undefined, overrides };
}

async function buildPreseasonPreviewOverrides(): Promise<OverridesPayload> {
  try {
    const raw = await readFile(MANUAL_PATH, "utf8");
    const parsed = parseYaml(raw);
    return normalizeOverridesPayload(parsed);
  } catch (error) {
    console.warn(`Failed to read preseason preview overrides: ${(error as Error).message}`);
    return { overrides: {} };
  }
}

async function run(): Promise<void> {
  const payload = await buildPreseasonPreviewOverrides();
  const output = {
    generatedAt: new Date().toISOString(),
    season: payload.season,
    overrides: payload.overrides,
  };
  await writeFile(CANONICAL_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { buildPreseasonPreviewOverrides };
