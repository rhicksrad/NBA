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
  PlayerScoringDataset,
  PlayerScoringIndex,
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
const PUBLIC_DATA_DIR = path.join(PUBLIC_DIR, "data");
const HUB_STYLE_SOURCE = path.join(PUBLIC_DIR, "styles/hub.css");
const HUB_STYLE_TARGET = path.join(STYLES_DIR, "hub.css");
const PRESEASON_DATA_PATH = path.join(PUBLIC_DATA_DIR, "preseason_team_previews.json");

const SITE_BASE_URL = "https://rhicksrad.github.io/NBA";
const SITE_NAME = "NBA Intelligence Hub";
const DEFAULT_SOCIAL_IMAGE = `${SITE_BASE_URL}/public/nba-logo-vector-01.png`;
const HUB_CANONICAL_PATH = "public/index.html";

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

function normalizeCanonicalPath(pathname: string): string {
  if (!pathname) {
    return "/";
  }
  const trimmed = pathname.trim();
  if (!trimmed) {
    return "/";
  }
  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/+/, "/");
}

function resolveCanonicalUrl(pathname: string): string {
  const normalized = normalizeCanonicalPath(pathname);
  return `${SITE_BASE_URL}${normalized}`;
}

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

function normalizeName(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

async function loadJson<T>(fileName: string): Promise<T> {
  const filePath = path.join(CANONICAL_DIR, fileName);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function loadPlayerScoring(): Promise<PlayerScoringIndex> {
  const lookup: PlayerScoringIndex = { byId: {}, byName: {} };
  try {
    const filePath = path.join(CANONICAL_DIR, "player_scoring_averages.json");
    const raw = await readFile(filePath, "utf8");
    const payload = JSON.parse(raw) as PlayerScoringDataset;
    const players = Array.isArray(payload?.players) ? payload.players : [];
    for (const entry of players) {
      const playerId = typeof entry?.playerId === "string" ? entry.playerId.trim() : "";
      if (!playerId) {
        continue;
      }
      const points = typeof entry.pointsPerGame === "number" && Number.isFinite(entry.pointsPerGame) ? entry.pointsPerGame : 0;
      const games = typeof entry.gamesPlayed === "number" && Number.isFinite(entry.gamesPlayed) ? entry.gamesPlayed : 0;
      const record = {
        playerId,
        pointsPerGame: points,
        gamesPlayed: Math.max(0, Math.round(games)),
        name: typeof entry.name === "string" ? entry.name : null,
        firstName: typeof entry.firstName === "string" ? entry.firstName : null,
        lastName: typeof entry.lastName === "string" ? entry.lastName : null,
      };
      lookup.byId[playerId] = record;
      const nameKeys = new Set<string>();
      const combinedName = record.name ?? `${record.firstName ?? ""} ${record.lastName ?? ""}`;
      nameKeys.add(normalizeName(combinedName));
      nameKeys.add(normalizeName(`${record.lastName ?? ""} ${record.firstName ?? ""}`));
      for (const key of nameKeys) {
        if (!key) {
          continue;
        }
        const existing = lookup.byName[key];
        if (!existing || record.pointsPerGame > existing.pointsPerGame) {
          lookup.byName[key] = record;
        }
      }
    }
    // Loaded dataset successfully
  } catch (error) {
    console.warn("Unable to load player scoring averages for preseason previews.", error);
  }
  return lookup;
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
  canonicalPath: string;
  ogType?: string;
  ogImage?: string | null;
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
  keywords?: string;
}

interface TeamPreviewDatasetEntry extends TeamPreviewContent {
  tricode: string;
  market: string;
  name: string;
  ranking: {
    score: number;
    rank: number;
    statusLine: string;
  } | null;
}

interface TeamPreviewDataset {
  season: string;
  generatedAt: string;
  previews: TeamPreviewDatasetEntry[];
}

function renderShell({
  title,
  description,
  activeNav,
  navPaths,
  body,
  canonicalPath,
  ogType,
  ogImage,
  structuredData,
  keywords,
}: RenderShellOptions): string {
  const canonicalUrl = resolveCanonicalUrl(canonicalPath);
  const descriptionMeta = description
    ? `    <meta name="description" content="${escapeHtml(description)}" />\n`
    : "";
  const keywordsMeta = keywords ? `    <meta name="keywords" content="${escapeHtml(keywords)}" />\n` : "";
  const robotsMeta =
    "    <meta name=\"robots\" content=\"index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1\" />\n";
  const canonicalLink = `    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />\n`;
  const ogTitle = escapeHtml(title);
  const ogDescription = description ? escapeHtml(description) : "";
  const ogImageUrl = ogImage === undefined ? DEFAULT_SOCIAL_IMAGE : ogImage;
  const ogTypeValue = ogType ?? "website";
  const ogImageMeta = ogImageUrl
    ?
        `    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />\n    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />\n`
    : "";
  const twitterCardValue = ogImageUrl ? "summary_large_image" : "summary";
  const structuredDataScript = structuredData
    ? `    <script type="application/ld+json">${JSON.stringify(structuredData, null, 2)}</script>\n`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
${robotsMeta}${descriptionMeta}${keywordsMeta}    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:type" content="${escapeHtml(ogTypeValue)}" />
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
${ogDescription ? `    <meta property="og:description" content="${ogDescription}" />\n` : ""}${ogImageMeta}    <meta name="twitter:card" content="${twitterCardValue}" />
    <meta name="twitter:title" content="${ogTitle}" />
${ogDescription ? `    <meta name="twitter:description" content="${ogDescription}" />\n` : ""}${canonicalLink}    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="${navPaths.styles.hub}" />
    <link rel="stylesheet" href="${navPaths.styles.previews}" />
${structuredDataScript}  </head>
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
  const canonicalPath = "site/index.html";
  const canonicalUrl = resolveCanonicalUrl(canonicalPath);
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

  const listItems = rankings.map((entry) => {
    const team = teams.find((t) => t.tricode === entry.tricode);
    const label = team ? `${team.market} ${team.name}` : entry.tricode;
    const previewPath = `site/previews/${entry.tricode}.html`;
    const previewUrl = resolveCanonicalUrl(previewPath);
    return {
      "@type": "ListItem",
      position: entry.rank,
      name: label,
      url: previewUrl,
      item: {
        "@type": "Article",
        name: `${label} preseason outlook · ${SEASON}`,
        url: previewUrl,
        description: entry.statusLine,
      },
    };
  });

  const itemListId = `${canonicalUrl}#previews`;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `NBA Preseason Previews ${SEASON}`,
      description: `Explore every team's ${SEASON} training camp storyline, grounded in the 2024-25 season baseline.`,
      url: canonicalUrl,
      inLanguage: "en-US",
      isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: resolveCanonicalUrl(HUB_CANONICAL_PATH),
      },
      mainEntity: { "@id": itemListId },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": itemListId,
      name: `${SEASON} preseason team previews`,
      description: "Conviction ladder built on the 2024-25 baseline and current availability intel.",
      itemListOrder: "Descending",
      numberOfItems: rankings.length,
      url: canonicalUrl,
      itemListElement: listItems,
    },
  ];

  return renderShell({
    title: `NBA Preseason Previews ${SEASON}`,
    description: `Explore every team's ${SEASON} training camp storyline, grounded in the 2024-25 season baseline.`,
    activeNav: "previews",
    navPaths,
    canonicalPath,
    structuredData,
    keywords: `NBA preseason previews, training camp radar, ${SEASON}`,
    body,
  });
}

function renderConvictionBoard(rankings: RankedTeam[], teams: TeamRecord[]): string {
  const navPaths = NAV_PREVIEW_PATHS;
  const canonicalPath = "site/previews/conviction-board.html";
  const canonicalUrl = resolveCanonicalUrl(canonicalPath);
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

  const listItems = rankings.map((entry) => {
    const team = teams.find((t) => t.tricode === entry.tricode);
    const label = team ? `${team.market} ${team.name}` : entry.tricode;
    const previewPath = `site/previews/${entry.tricode}.html`;
    return {
      "@type": "ListItem",
      position: entry.rank,
      name: label,
      url: resolveCanonicalUrl(previewPath),
      item: {
        "@type": "Article",
        name: `${label} preseason outlook · ${SEASON}`,
        url: resolveCanonicalUrl(previewPath),
        description: entry.statusLine,
      },
    };
  });

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${SEASON} preseason conviction board`,
    description: "Power index translating conviction scores into a ranked ladder.",
    itemListOrder: "Descending",
    numberOfItems: rankings.length,
    url: canonicalUrl,
    itemListElement: listItems,
  };

  return renderShell({
    title: `${SEASON} Conviction Board`,
    description: `${SEASON} preseason conviction board derived from the 2024-25 baseline.`,
    activeNav: "board",
    navPaths,
    canonicalPath,
    structuredData,
    keywords: `NBA preseason conviction board, power index, ${SEASON}`,
    body,
  });
}

function renderTeamPage(
  team: TeamRecord,
  content: TeamPreviewContent,
  generatedAt: string,
  ranking: RankedTeam | null,
): string {
  const navPaths = NAV_PREVIEW_PATHS;
  const canonicalPath = `site/previews/${team.tricode}.html`;
  const canonicalUrl = resolveCanonicalUrl(canonicalPath);
  const paragraphs = content.introParagraphs
    .map((paragraph) => `            <p>${escapeHtml(paragraph)}</p>`)
    .join("\n");

  const descriptionText = `${content.heading} storyline snapshot for the ${SEASON} preseason built off the 2024-25 finish.`;
  const keywords = [
    `${team.market} ${team.name}`,
    `${SEASON} preseason`,
    "NBA training camp outlook",
    `${team.market} basketball`,
  ].join(", ");

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

  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${content.heading} preseason outlook · ${SEASON}`,
    description: descriptionText,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    dateCreated: generatedAt,
    dateModified: generatedAt,
    inLanguage: "en-US",
    isPartOf: {
      "@type": "CollectionPage",
      name: `NBA Preseason Previews ${SEASON}`,
      url: resolveCanonicalUrl("site/index.html"),
    },
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: resolveCanonicalUrl(HUB_CANONICAL_PATH),
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: resolveCanonicalUrl(HUB_CANONICAL_PATH),
    },
    about: {
      "@type": "SportsTeam",
      name: `${team.market} ${team.name}`,
      alternateName: team.tricode,
      sport: "Basketball",
      memberOf: {
        "@type": "SportsOrganization",
        name: "National Basketball Association",
      },
    },
    keywords,
    image: DEFAULT_SOCIAL_IMAGE,
  };

  if (ranking) {
    structuredData.position = ranking.rank;
    structuredData.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: ranking.score.toFixed(3),
      bestRating: "1",
      worstRating: "0",
      ratingExplanation: ranking.statusLine,
    };
  }

  return renderShell({
    title: `${content.heading} preseason outlook · ${SEASON}`,
    description: descriptionText,
    activeNav: "previews",
    navPaths,
    canonicalPath,
    ogType: "article",
    structuredData,
    keywords,
    body,
  });
}

export async function generatePreviews(): Promise<void> {
  await ensureSiteDirs();
  await copySharedAssets();
  await mkdir(PUBLIC_DATA_DIR, { recursive: true });

  const teams = await loadJson<TeamRecord[]>("teams.json");
  const players = await loadJson<PlayerRecord[]>("players.json");
  const injuries = await loadJson<InjuryRecord[]>("injuries.json");
  const playerScoring = await loadPlayerScoring();
  const rankings = rankTeams({ teams, players, injuries });

  const context: LeagueContext = {
    season: SEASON,
    teams,
    players,
    injuries,
    rankings,
    playerScoring,
  };

  const rankingLookup = new Map(rankings.map((entry) => [entry.tricode, entry]));
  const generatedAt = new Date().toISOString();
  const previewEntries: TeamPreviewDatasetEntry[] = [];

  for (const team of teams) {
    const markdown = renderTeamPreview(team, context);
    const previewContent = buildTeamPreviewContent(team, context);
    const markdownPath = path.join(PREVIEW_DIR, `${team.tricode}.md`);
    const htmlPath = path.join(PREVIEW_DIR, `${team.tricode}.html`);
    await writeFile(markdownPath, `${markdown}\n`, "utf8");
    const ranking = rankingLookup.get(team.tricode) ?? null;
    const html = renderTeamPage(team, previewContent, generatedAt, ranking);
    await writeFile(htmlPath, `${html}\n`, "utf8");
    previewEntries.push({
      tricode: team.tricode,
      market: team.market,
      name: team.name,
      ...previewContent,
      ranking: ranking
        ? {
            score: ranking.score,
            rank: ranking.rank,
            statusLine: ranking.statusLine,
          }
        : null,
    });
  }

  const boardHtml = renderConvictionBoard(rankings, teams);
  await writeFile(path.join(PREVIEW_DIR, "conviction-board.html"), `${boardHtml}\n`, "utf8");

  const indexHtml = renderIndex(rankings, teams);
  await writeFile(path.join(SITE_DIR, "index.html"), `${indexHtml}\n`, "utf8");

  const previewDataset: TeamPreviewDataset = {
    season: SEASON,
    generatedAt,
    previews: previewEntries,
  };
  await writeFile(PRESEASON_DATA_PATH, `${JSON.stringify(previewDataset, null, 2)}\n`, "utf8");
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
