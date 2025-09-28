import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { SEASON } from "../lib/season.js";
import { TeamRecord } from "../lib/types.js";

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
}

interface PreseasonSchedule {
  season: string;
  generatedAt: string;
  games: PreseasonGame[];
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

interface SummaryCardContent {
  title: string;
  body?: string[];
  bullets?: string[];
}

interface SummaryOverride {
  tagline?: string;
  description?: string[];
  cards?: SummaryCardContent[];
}

interface HeaderOverride {
  subLabel?: string;
  venueLine?: string;
}

interface StorySectionOverride {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

interface StoryOverride {
  introParagraphs?: string[];
  sections?: StorySectionOverride[];
  questionsHeading?: string;
  questions?: string[];
}

interface PreviewOverride {
  header?: HeaderOverride;
  summary?: SummaryOverride;
  story?: StoryOverride;
}

interface PreviewOverridesPayload {
  overrides?: Record<string, PreviewOverride>;
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

async function loadPreviewOverrides(): Promise<Record<string, PreviewOverride>> {
  try {
    const payload = await loadJson<PreviewOverridesPayload>("preseason_preview_overrides.json");
    if (!payload || typeof payload !== "object") {
      return {};
    }
    const overrides = payload.overrides;
    if (!overrides || typeof overrides !== "object") {
      return {};
    }
    return Object.entries(overrides).reduce<Record<string, PreviewOverride>>((acc, [key, value]) => {
      if (value && typeof value === "object") {
        acc[key] = value;
      }
      return acc;
    }, {});
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Unable to load preseason preview overrides.", error);
    }
    return {};
  }
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

function describeTeam(
  participant: ScheduleParticipant,
  lookup: Map<string, TeamRecord>,
  metricsLookup: Map<string, TeamMetrics>
): TeamContext {
  if (participant.tricode) {
    const record = lookup.get(participant.tricode.toUpperCase());
    if (record) {
      const metrics = metricsLookup.get(record.tricode.toUpperCase());
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
      };
    }
  }
  const fallbackName = participant.name ?? (participant.tricode ?? "Guest Team");
  return {
    displayName: fallbackName,
    noun: fallbackName,
    descriptor: fallbackName,
    abbreviation: participant.abbreviation,
    tricode: participant.tricode,
    leagueTag: participant.league,
    isGuest: true,
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

function buildDefaultSummaryCards(
  game: PreseasonGame,
  away: TeamContext,
  home: TeamContext
): SummaryCardContent[] {
  const lines = [`${away.displayName} vs. ${home.displayName}`];
  const competition = game.subLabel ? `${game.label} · ${game.subLabel}` : game.label;
  if (competition) {
    lines.push(competition);
  }
  return [
    {
      title: "Matchup snapshot",
      body: lines,
    },
  ];
}

function renderSummaryCards(cards: SummaryCardContent[]): string {
  return cards
    .map((card) => {
      const body = Array.isArray(card.body)
        ? card.body
            .map((line) => `<p>${line}</p>`)
            .join("\n            ")
        : "";
      const bullets = Array.isArray(card.bullets) && card.bullets.length
        ? `<ul class="preview-summary__list">
              ${card.bullets.map((item) => `<li>${item}</li>`).join("\n              ")}
            </ul>`
        : "";
      return `
          <section class="preview-summary__card">
            <h2>${card.title}</h2>
            ${body}
            ${bullets}
          </section>
        `;
    })
    .join("\n        ");
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

function renderStoryIntroParagraphs(paragraphs: string[] = []): string {
  if (!paragraphs.length) {
    return "";
  }
  return paragraphs
    .map((paragraph, index) => {
      const className = index === 0 ? "preview-story__lead" : "preview-story__paragraph";
      return `<p class="${className}">${paragraph}</p>`;
    })
    .join("\n        ");
}

function renderStorySections(sections: StorySectionOverride[] = []): string {
  if (!sections.length) {
    return "";
  }
  const items = sections
    .map((section) => {
      const paragraphs = Array.isArray(section.paragraphs)
        ? section.paragraphs
            .map((paragraph) => `<p>${paragraph}</p>`)
            .join("\n            ")
        : "";
      const bullets = Array.isArray(section.bullets) && section.bullets.length
        ? `<ul>
              ${section.bullets.map((bullet) => `<li>${bullet}</li>`).join("\n              ")}
            </ul>`
        : "";
      return `<li class="preview-story__entry">
            <h3 class="preview-story__entry-title">${section.heading}</h3>
            <div class="preview-story__entry-body">
              ${paragraphs}
              ${bullets}
            </div>
          </li>`;
    })
    .join("\n          ");
  return `<ol class="preview-story__entries">
          ${items}
        </ol>`;
}

function renderStoryQuestions(
  heading: string | undefined,
  questions: string[] | undefined
): string {
  if (!questions || !questions.length) {
    return "";
  }
  const title = heading ? `<h3 class="preview-story__subheading">${heading}</h3>` : "";
  const list = `<ul class="preview-story__list">
            ${questions.map((question) => `<li>${question}</li>`).join("\n            ")}
          </ul>`;
  return `${title}
          ${list}`;
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
  override?: PreviewOverride
): string {
  const headerOverride = override?.header;
  const summaryOverride = override?.summary;
  const storyOverride = override?.story;

  const venueLine = headerOverride?.venueLine ?? formatVenueLine(game.venue);
  const etString = formatDateTime(game.tipoff, "America/New_York");
  const utcString = formatDateTime(game.tipoff, "UTC");
  const neutralNote = headerOverride?.venueLine ? undefined : neutralSuffix(game.venue, game.notes);
  const subLabel = headerOverride?.subLabel ?? game.subLabel;
  const leadLine = subLabel ? `<p class="lead">${subLabel}</p>` : "";

  const summaryTagline = summaryOverride?.tagline ?? "Key context before rotations start moving.";
  const summaryDescription = summaryOverride?.description ?? [];
  const summaryDescriptionHtml = summaryDescription
    .map((paragraph) => `<p class="preview-summary__description">${paragraph}</p>`)
    .join("\n          ");
  const summaryCards =
    summaryOverride?.cards && summaryOverride.cards.length
      ? summaryOverride.cards
      : buildDefaultSummaryCards(game, away, home);

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

  let storyContent = "";
  let storyQuestionsHtml = "";

  if (storyOverride) {
    const intro = renderStoryIntroParagraphs(storyOverride.introParagraphs ?? []);
    const sections = renderStorySections(storyOverride.sections ?? []);
    storyContent = [intro, sections].filter(Boolean).join("\n        ");
    storyQuestionsHtml = renderStoryQuestions(storyOverride.questionsHeading, storyOverride.questions);
  } else {
    const story = buildStoryParagraphs(game, away, home, venueLine);
    const bullets = buildStoryBullets(game, away, home);
    storyContent = story
      .map((paragraph, index) => {
        const className = index === 0 ? "preview-story__lead" : "preview-story__paragraph";
        return `<p class="${className}">${paragraph}</p>`;
      })
      .join("\n        ");
    storyQuestionsHtml = `<ul class="preview-story__list">
            ${bullets.map((bullet) => `<li>${bullet}</li>`).join("\n            ")}
          </ul>`;
  }

  const summaryCardsHtml = renderSummaryCards(summaryCards);

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
        padding: clamp(1.5rem, 4vw, 3rem);
        display: flex;
        justify-content: center;
        background:
          linear-gradient(155deg, rgba(17, 86, 214, 0.12), rgba(239, 61, 91, 0.08)),
          color-mix(in srgb, var(--surface) 88%, rgba(14, 34, 68, 0.08) 12%);
      }

      .preview-shell {
        width: min(1150px, 100%);
        display: grid;
        gap: clamp(1.5rem, 3vw, 2.75rem);
        background: color-mix(in srgb, rgba(255, 255, 255, 0.94) 72%, rgba(242, 246, 255, 0.92) 28%);
        border-radius: var(--radius-xl);
        border: 1px solid color-mix(in srgb, var(--royal) 16%, transparent);
        padding: clamp(1.85rem, 3.4vw, 2.9rem);
        box-shadow: var(--shadow-soft);
        position: relative;
        overflow: hidden;
      }

      .preview-shell::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(
          160deg,
          rgba(17, 86, 214, 0.14),
          rgba(244, 181, 63, 0.12) 55%,
          rgba(239, 61, 91, 0.1)
        );
        opacity: 0.55;
        pointer-events: none;
      }

      .preview-shell > * {
        position: relative;
      }

      .preview-header {
        display: grid;
        gap: 0.65rem;
      }

      .preview-header time {
        font-weight: 600;
        color: color-mix(in srgb, var(--navy) 78%, rgba(14, 34, 68, 0.42) 22%);
      }

      .preview-header p {
        margin: 0;
        color: var(--text-subtle);
      }

      .preview-header h1 {
        margin: 0;
        font-size: clamp(2rem, 4.8vw, 2.65rem);
        color: var(--navy);
      }

      .preview-summary {
        display: grid;
        gap: clamp(1rem, 2.6vw, 1.6rem);
      }

      .preview-summary__header {
        display: grid;
        gap: 0.35rem;
      }

      .preview-summary__title {
        margin: 0;
        font-size: 0.82rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--navy) 70%, rgba(14, 34, 68, 0.4) 30%);
      }

      .preview-summary__tagline {
        margin: 0;
        font-size: 0.95rem;
        color: var(--text-subtle);
        max-width: 56ch;
      }

      .preview-summary__description {
        margin: 0;
        font-size: 0.95rem;
        color: var(--text-subtle);
        max-width: 66ch;
      }

      .preview-summary__grid {
        display: grid;
        gap: clamp(1rem, 3vw, 1.6rem);
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      }

      .preview-summary__card {
        display: grid;
        gap: 0.6rem;
        padding: clamp(1rem, 2.6vw, 1.4rem);
        border-radius: var(--radius-lg);
        border: 1px solid color-mix(in srgb, var(--royal) 14%, transparent);
        background: color-mix(in srgb, rgba(255, 255, 255, 0.92) 68%, rgba(242, 246, 255, 0.88) 32%);
        box-shadow: var(--shadow-soft);
      }

      .preview-summary__card h2 {
        margin: 0;
        font-size: 1rem;
        color: var(--navy);
      }

      .preview-summary__card p {
        margin: 0;
        font-size: 0.95rem;
        color: var(--text-subtle);
      }

      .preview-summary__list {
        margin: 0;
        padding-left: 1.1rem;
        display: grid;
        gap: 0.45rem;
        font-size: 0.95rem;
        color: var(--text-subtle);
      }

      .preview-summary__list li {
        margin: 0;
      }

      .preview-body {
        display: grid;
        gap: clamp(1.2rem, 3vw, 1.9rem);
      }

      @media (min-width: 960px) {
        .preview-body {
          grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
          align-items: start;
        }
      }

      .preview-card {
        display: grid;
        gap: clamp(0.85rem, 2.4vw, 1.4rem);
        padding: clamp(1.2rem, 2.8vw, 1.85rem);
        border-radius: var(--radius-lg);
        border: 1px solid color-mix(in srgb, var(--royal) 16%, transparent);
        background: color-mix(in srgb, rgba(255, 255, 255, 0.94) 70%, rgba(242, 246, 255, 0.9) 30%);
        box-shadow: var(--shadow-soft);
      }

      .preview-card--story {
        background:
          linear-gradient(155deg, rgba(17, 86, 214, 0.12), rgba(244, 181, 63, 0.08)),
          color-mix(in srgb, rgba(255, 255, 255, 0.93) 68%, rgba(242, 246, 255, 0.9) 32%);
      }

      .preview-card--visuals {
        background:
          linear-gradient(150deg, rgba(17, 86, 214, 0.09), rgba(239, 61, 91, 0.07)),
          color-mix(in srgb, rgba(255, 255, 255, 0.93) 66%, rgba(242, 246, 255, 0.92) 34%);
      }

      .preview-story h2 {
        margin: 0;
        font-size: 1.35rem;
        color: var(--navy);
      }

      .preview-story__lead {
        margin: 0;
        font-size: 1.05rem;
        color: var(--text-strong);
      }

      .preview-story__paragraph {
        margin: 0;
        color: var(--text-subtle);
      }

      .preview-story__entries {
        margin: 0;
        padding-left: 1.2rem;
        display: grid;
        gap: 1rem;
      }

      .preview-story__entry {
        margin: 0;
        color: var(--text-subtle);
      }

      .preview-story__entry-title {
        margin: 0;
        font-size: 1.05rem;
        color: var(--text-strong);
      }

      .preview-story__entry-body {
        display: grid;
        gap: 0.55rem;
        margin-top: 0.35rem;
      }

      .preview-story__entry-body p {
        margin: 0;
        color: var(--text-subtle);
      }

      .preview-story__entry-body ul {
        margin: 0;
        padding-left: 1.1rem;
        display: grid;
        gap: 0.4rem;
      }

      .preview-story__subheading {
        margin: 0;
        font-size: 1rem;
        color: var(--text-strong);
      }

      .preview-story__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.65rem;
      }

      .preview-story__list li {
        margin: 0;
        position: relative;
        padding-left: 1.6rem;
        font-weight: 600;
        color: var(--text-strong);
      }

      .preview-story__list li::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0.35rem;
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(17, 86, 214, 0.9), rgba(244, 181, 63, 0.85));
        box-shadow: 0 0 0 4px color-mix(in srgb, rgba(17, 86, 214, 0.12) 60%, rgba(255, 255, 255, 0.9) 40%);
      }

      .preview-visuals {
        display: grid;
        gap: clamp(1rem, 2.8vw, 1.6rem);
      }

      .preview-visuals__header {
        display: grid;
        gap: 0.5rem;
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
        ${leadLine}
      </header>

      <section class="preview-summary">
        <header class="preview-summary__header">
          <h2 class="preview-summary__title">Game essentials</h2>
          <p class="preview-summary__tagline">${summaryTagline}</p>
          ${summaryDescriptionHtml}
        </header>
        <div class="preview-summary__grid">
          ${summaryCardsHtml}
          ${coverageSection}
          ${notesSection}
        </div>
      </section>

      <div class="preview-body">
        <article class="preview-story preview-card preview-card--story">
          <h2>Camp storylines to monitor</h2>
          ${storyContent}
          ${storyQuestionsHtml}
        </article>

        ${visualsSection}
      </div>

      <footer>
        <span>Season context: ${SEASON} preseason schedule.</span>
        <a href="./index.html">← Back to preseason schedule</a>
      </footer>
    </main>
  </body>
</html>`;
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
  const [schedule, teams, teamMetrics, overrides] = await Promise.all([
    loadJson<PreseasonSchedule>("preseason_schedule.json"),
    loadJson<TeamRecord[]>("teams.json"),
    loadTeamMetrics(),
    loadPreviewOverrides(),
  ]);

  await ensureOutputDirs();
  await cleanExistingPreviews();

  const lookup = buildTeamLookup(teams);
  const metricsLookup = teamMetrics.lookup;
  const metricExtents = teamMetrics.extents;
  const contextIndex = new Map<string, TeamContext>();
  const awayIndex = new Map<string, TeamContext>();
  const homeIndex = new Map<string, TeamContext>();

  for (const game of schedule.games) {
    const away = describeTeam(game.away, lookup, metricsLookup);
    const home = describeTeam(game.home, lookup, metricsLookup);
    contextIndex.set(`${game.id}-away`, away);
    contextIndex.set(`${game.id}-home`, home);
    awayIndex.set(game.id, away);
    homeIndex.set(game.id, home);

    const slug = slugify(game.id);
    const filePath = path.join(PREVIEWS_DIR, `preseason-${slug}.html`);
    const html = renderGamePage(game, away, home, metricExtents, overrides[game.id]);
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
