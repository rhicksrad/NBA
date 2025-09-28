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
}

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

function describeTeam(participant: ScheduleParticipant, lookup: Map<string, TeamRecord>): TeamContext {
  if (participant.tricode) {
    const record = lookup.get(participant.tricode.toUpperCase());
    if (record) {
      return {
        record,
        displayName: `${record.market} ${record.name}`,
        noun: record.name,
        descriptor: record.market,
        abbreviation: record.tricode,
        tricode: record.tricode,
        leagueTag: "NBA",
        isGuest: false,
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderGamePage(game: PreseasonGame, away: TeamContext, home: TeamContext): string {
  const venueLine = formatVenueLine(game.venue);
  const etString = formatDateTime(game.tipoff, "America/New_York");
  const utcString = formatDateTime(game.tipoff, "UTC");
  const neutralNote = neutralSuffix(game.venue, game.notes);
  const story = buildStoryParagraphs(game, away, home, venueLine);
  const bullets = buildStoryBullets(game, away, home);
  const notes = game.notes.filter((note) => !note.toLowerCase().includes("neutral"));
  const hasCoverage = Boolean(game.coverage?.tv?.length || game.coverage?.radio?.length);

  const coverageSection = hasCoverage
    ? `
          <section class="preview-meta__section">
            <h2>Coverage</h2>
            ${game.coverage?.tv?.length ? `<p><strong>TV:</strong> ${game.coverage.tv.join(", ")}</p>` : ""}
            ${game.coverage?.radio?.length ? `<p><strong>Radio:</strong> ${game.coverage.radio.join(", ")}</p>` : ""}
          </section>
        `
    : "";

  const notesSection = notes.length
    ? `
          <section class="preview-meta__section">
            <h2>Notes</h2>
            <ul>
              ${notes.map((note) => `<li>${note}</li>`).join("\n              ")}
            </ul>
          </section>
        `
    : "";

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
        background: color-mix(in srgb, var(--surface) 92%, rgba(14, 34, 68, 0.06) 8%);
      }

      .preview-shell {
        width: min(1100px, 100%);
        display: grid;
        gap: clamp(1.5rem, 3vw, 2.5rem);
        background: color-mix(in srgb, var(--surface) 80%, rgba(14, 34, 68, 0.05) 20%);
        border-radius: var(--radius-xl);
        border: 1px solid color-mix(in srgb, var(--royal) 18%, transparent);
        padding: clamp(1.75rem, 3vw, 2.5rem);
        box-shadow: var(--shadow-soft);
      }

      .preview-header {
        display: grid;
        gap: 0.75rem;
      }

      .preview-header time {
        font-weight: 600;
        color: color-mix(in srgb, var(--navy) 80%, rgba(14, 34, 68, 0.4) 20%);
      }

      .chip {
        display: inline-block;
        padding: 0.25rem 0.6rem;
        border-radius: 999px;
        background: rgba(14, 34, 68, 0.08);
        color: rgba(14, 34, 68, 0.88);
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 600;
      }

      .preview-meta {
        display: grid;
        gap: 1.5rem;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .preview-meta__section {
        display: grid;
        gap: 0.4rem;
      }

      .preview-meta__section h2 {
        margin: 0;
        font-size: 0.95rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(14, 34, 68, 0.72);
      }

      .preview-meta__section p,
      .preview-meta__section ul {
        margin: 0;
        font-size: 0.95rem;
        color: var(--text-subtle);
        padding-left: 1rem;
      }

      .preview-story {
        display: grid;
        gap: 1.25rem;
      }

      .preview-story h2 {
        margin: 0;
      }

      .preview-story ul {
        margin: 0;
        padding-left: 1.1rem;
      }

      .preview-story li {
        margin-bottom: 0.5rem;
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

      <section class="preview-meta">
        <section class="preview-meta__section">
          <h2>Matchup snapshot</h2>
          <p>${away.displayName} vs. ${home.displayName}</p>
          <p>${labelLine(game)}</p>
        </section>
        ${coverageSection}
        ${notesSection}
      </section>

      <article class="preview-story">
        <h2>Camp storylines to monitor</h2>
        ${story.map((paragraph) => `<p>${paragraph}</p>`).join("\n        ")}
        <ul>
          ${bullets.map((bullet) => `<li>${bullet}</li>`).join("\n          ")}
        </ul>
      </article>

      <footer>
        <span>Season context: ${SEASON} preseason schedule.</span>
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
  const [schedule, teams] = await Promise.all([
    loadJson<PreseasonSchedule>("preseason_schedule.json"),
    loadJson<TeamRecord[]>("teams.json"),
  ]);

  await ensureOutputDirs();
  await cleanExistingPreviews();

  const lookup = buildTeamLookup(teams);
  const contextIndex = new Map<string, TeamContext>();
  const awayIndex = new Map<string, TeamContext>();
  const homeIndex = new Map<string, TeamContext>();

  for (const game of schedule.games) {
    const away = describeTeam(game.away, lookup);
    const home = describeTeam(game.home, lookup);
    contextIndex.set(`${game.id}-away`, away);
    contextIndex.set(`${game.id}-home`, home);
    awayIndex.set(game.id, away);
    homeIndex.set(game.id, home);

    const slug = slugify(game.id);
    const filePath = path.join(PREVIEWS_DIR, `preseason-${slug}.html`);
    const html = renderGamePage(game, away, home);
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
