import { copyFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import {
  buildTeamPreviewContent,
  renderTeamPreview,
  TeamPreviewContent,
} from "../../content/templates/teamPreview.md.ts";
import { SEASON } from "../lib/season.js";
import {
  InjuryRecord,
  LeagueContext,
  PlayerRecord,
  RankedTeam,
  TeamRecord,
} from "../lib/types.js";
import { rankTeams } from "./rank.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const CANONICAL_DIR = path.join(ROOT, "data/2025-26/canonical");
const SITE_DIR = path.join(ROOT, "site");
const PREVIEW_DIR = path.join(SITE_DIR, "previews");
const STYLES_DIR = path.join(SITE_DIR, "styles");
const PUBLIC_DIR = path.join(ROOT, "public");
const HUB_STYLE_SOURCE = path.join(PUBLIC_DIR, "styles/hub.css");
const HUB_STYLE_TARGET = path.join(STYLES_DIR, "hub.css");

interface NavigationPaths {
  hub: string;
  previewsIndex: string;
  convictionBoard: string;
  styles: {
    hub: string;
    previews: string;
  };
}

type ActiveNav = "previews" | "board";

const NAV_INDEX_PATHS: NavigationPaths = {
  hub: "../public/index.html",
  previewsIndex: "index.html",
  convictionBoard: "previews/conviction-board.html",
  styles: {
    hub: "styles/hub.css",
    previews: "styles/previews.css",
  },
};

const NAV_PREVIEW_PATHS: NavigationPaths = {
  hub: "../../public/index.html",
  previewsIndex: "../index.html",
  convictionBoard: "conviction-board.html",
  styles: {
    hub: "../styles/hub.css",
    previews: "../styles/previews.css",
  },
};

const BRAND_LOGO_MARKUP = `<span class="brand__logo" aria-hidden="true">
  <svg class="brand__logo-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" focusable="false">
    <defs>
      <linearGradient id="brandLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1552F0" />
        <stop offset="50%" stop-color="#2161FF" />
        <stop offset="100%" stop-color="#E03143" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="11" fill="url(#brandLogoGradient)" />
    <path fill="#FFFFFF" d="M16 48V16h6.4c4.2 0 6.6 2.1 6.6 5.8 0 2.7-1.4 4.6-3.4 5.5 2.7.8 4.5 3.1 4.5 6.6 0 4.6-3 7.5-7.7 7.5H16Zm6.1-19c2.1 0 3.3-1.2 3.3-3.2 0-2-1.2-3-3.4-3H19V29h3.1Zm.4 12.4c2.4 0 3.8-1.3 3.8-3.7 0-2.4-1.5-3.7-3.9-3.7H19v7.4h3.5ZM34 48V16h6.5l5.2 20.5L50.9 16H57v32h-4.7V25.4L48.3 48h-4.4l-4-22.6V48H34Z" />
  </svg>
</span>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadJson<T>(fileName: string): Promise<T> {
  const filePath = path.join(CANONICAL_DIR, fileName);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function ensureSiteDirs(): Promise<void> {
  await mkdir(SITE_DIR, { recursive: true });
  await mkdir(PREVIEW_DIR, { recursive: true });
  await mkdir(STYLES_DIR, { recursive: true });
}

async function copySharedAssets(): Promise<void> {
  await copyFile(HUB_STYLE_SOURCE, HUB_STYLE_TARGET);
}

function renderNav(active: ActiveNav, paths: NavigationPaths): string {
  const previewsClass = active === "previews" ? " class=\"active\"" : "";
  const boardClass = active === "board" ? " class=\"active\"" : "";
  return `
      <header class="site-header">
        <div class="hub-nav">
          <a class="brand" href="${paths.hub}">
            ${BRAND_LOGO_MARKUP}
            <span class="brand__wordmark"><span class="brand__wordmark-accent">NBA</span> Intelligence Hub</span>
          </a>
          <nav class="nav-links">
            <a${previewsClass} href="${paths.previewsIndex}">Team previews</a>
            <a${boardClass} href="${paths.convictionBoard}">Conviction board</a>
            <a href="${paths.hub}">Back to hub</a>
          </nav>
        </div>
      </header>`;
}

interface RenderShellOptions {
  title: string;
  description?: string;
  activeNav: ActiveNav;
  navPaths: NavigationPaths;
  body: string;
}

function renderShell({ title, description, activeNav, navPaths, body }: RenderShellOptions): string {
  const descriptionMeta = description
    ? `    <meta name="description" content="${escapeHtml(description)}" />\n`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
${descriptionMeta}    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="${navPaths.styles.hub}" />
    <link rel="stylesheet" href="${navPaths.styles.previews}" />
  </head>
  <body>
    <div class="site-frame">
${renderNav(activeNav, navPaths)}
${body}
    </div>
  </body>
</html>`;
}

function renderIndex(rankings: RankedTeam[], teams: TeamRecord[]): string {
  const navPaths = NAV_INDEX_PATHS;
  const cards = rankings
    .map((entry) => {
      const team = teams.find((t) => t.tricode === entry.tricode);
      const label = team ? `${team.market} ${team.name}` : entry.tricode;
      return `          <article class="preview-card">
            <header class="preview-card__header">
              <span class="preview-card__rank">#${entry.rank}</span>
              <h2>${escapeHtml(label)}</h2>
            </header>
            <p class="preview-card__score">Conviction score: <strong>${entry.score.toFixed(3)}</strong></p>
            <p class="preview-card__status">${escapeHtml(entry.statusLine)}</p>
            <a class="button-link button-link--ghost preview-card__link" href="previews/${entry.tricode}.html">Read preview</a>
          </article>`;
    })
    .join("\n");

  const body = `      <main class="preview-page">
        <section class="preview-hero">
          <span class="chip chip--accent">2025-26 preseason</span>
          <h1>${escapeHtml(SEASON)} team previews</h1>
          <p class="lead">A ${escapeHtml(
            SEASON,
          )} training camp radar built on the 2024-25 finish—scan the outlook for every franchise before tipoff.</p>
        </section>
        <section class="preview-actions">
          <a class="button-link preview-cta" href="${navPaths.convictionBoard}">View the preseason conviction board</a>
        </section>
        <section class="preview-grid">
${cards}
        </section>
      </main>`;

  return renderShell({
    title: `NBA Preseason Previews ${SEASON}`,
    description: `Explore every team's ${SEASON} training camp storyline, grounded in the 2024-25 season baseline.`,
    activeNav: "previews",
    navPaths,
    body,
  });
}

function renderConvictionBoard(rankings: RankedTeam[], teams: TeamRecord[]): string {
  const navPaths = NAV_PREVIEW_PATHS;
  const rows = rankings
    .map((entry) => {
      const team = teams.find((t) => t.tricode === entry.tricode);
      const label = team ? `${team.market} ${team.name}` : entry.tricode;
      return `              <tr>
                <td class="preview-table__rank">#${entry.rank}</td>
                <td>${escapeHtml(label)}</td>
                <td>${entry.score.toFixed(3)}</td>
                <td>${escapeHtml(entry.statusLine)}</td>
              </tr>`;
    })
    .join("\n");

  const body = `      <main class="preview-page">
        <section class="preview-hero preview-hero--board">
          <span class="chip chip--accent">Power index</span>
          <h1>${escapeHtml(SEASON)} conviction board</h1>
          <p class="lead">Our ${escapeHtml(
            SEASON,
          )} preseason ladder blends the 2024-25 production baseline with current health intel.</p>
        </section>
        <section class="preview-table-card">
          <table class="preview-table">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Team</th>
                <th scope="col">Score</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
${rows}
            </tbody>
          </table>
          <p class="preview-table__footnote">Scores normalize to a 0–1 scale anchored to last season's results and current availability grades.</p>
          <div class="preview-table__cta">
            <a class="button-link" href="${navPaths.previewsIndex}">← Back to team previews</a>
          </div>
        </section>
      </main>`;

  return renderShell({
    title: `${SEASON} Conviction Board`,
    description: `${SEASON} preseason conviction board derived from the 2024-25 baseline.`,
    activeNav: "board",
    navPaths,
    body,
  });
}

function renderTeamPage(team: TeamRecord, content: TeamPreviewContent): string {
  const navPaths = NAV_PREVIEW_PATHS;
  const paragraphs = content.introParagraphs
    .map((paragraph) => `            <p>${escapeHtml(paragraph)}</p>`)
    .join("\n");

  const body = `      <main class="preview-page">
        <article class="team-preview" data-team="${escapeHtml(team.tricode)}">
          <header class="team-preview__header">
            <span class="chip chip--accent">Training camp outlook</span>
            <h1>${escapeHtml(content.heading)}</h1>
${paragraphs}
          </header>
          <section class="team-preview__highlights">
            <article class="summary-card">
              <h2>Core strength</h2>
              <p>${escapeHtml(content.coreStrength)}</p>
            </article>
            <article class="summary-card">
              <h2>Primary risk</h2>
              <p>${escapeHtml(content.primaryRisk)}</p>
            </article>
            <article class="summary-card">
              <h2>Swing factor</h2>
              <p>${escapeHtml(content.swingFactor)}</p>
            </article>
          </section>
          <footer class="team-preview__footer">
            <p class="team-preview__season">Season focus: ${escapeHtml(
              content.seasonLabel,
            )} training camp outlook layered on the 2024-25 benchmark.</p>
            <div class="team-preview__links">
              <a class="button-link" href="${navPaths.previewsIndex}">← Back to team previews</a>
              <a class="button-link button-link--ghost" href="${navPaths.convictionBoard}">View conviction board</a>
            </div>
          </footer>
        </article>
      </main>`;

  return renderShell({
    title: `${content.heading} preseason outlook · ${SEASON}`,
    description: `${content.heading} storyline snapshot for the ${SEASON} preseason built off the 2024-25 finish.`,
    activeNav: "previews",
    navPaths,
    body,
  });
}

export async function generatePreviews(): Promise<void> {
  await ensureSiteDirs();
  await copySharedAssets();

  const teams = await loadJson<TeamRecord[]>("teams.json");
  const players = await loadJson<PlayerRecord[]>("players.json");
  const injuries = await loadJson<InjuryRecord[]>("injuries.json");
  const rankings = rankTeams({ teams, players, injuries });

  const context: LeagueContext = {
    season: SEASON,
    teams,
    players,
    injuries,
    rankings,
  };

  for (const team of teams) {
    const markdown = renderTeamPreview(team, context);
    const previewContent = buildTeamPreviewContent(team, context);
    const markdownPath = path.join(PREVIEW_DIR, `${team.tricode}.md`);
    const htmlPath = path.join(PREVIEW_DIR, `${team.tricode}.html`);
    await writeFile(markdownPath, `${markdown}\n`, "utf8");
    const html = renderTeamPage(team, previewContent);
    await writeFile(htmlPath, `${html}\n`, "utf8");
  }

  const boardHtml = renderConvictionBoard(rankings, teams);
  await writeFile(path.join(PREVIEW_DIR, "conviction-board.html"), `${boardHtml}\n`, "utf8");

  const indexHtml = renderIndex(rankings, teams);
  await writeFile(path.join(SITE_DIR, "index.html"), `${indexHtml}\n`, "utf8");
}

async function run(): Promise<void> {
  await generatePreviews();
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
