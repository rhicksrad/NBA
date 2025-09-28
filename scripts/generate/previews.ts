import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { renderTeamPreview } from "../../content/templates/teamPreview.md.ts";
import { SEASON } from "../lib/season.js";
import { LeagueContext, RankedTeam, TeamRecord, PlayerRecord, InjuryRecord } from "../lib/types.js";
import { rankTeams } from "./rank.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const CANONICAL_DIR = path.join(ROOT, "data/2025-26/canonical");
const SITE_DIR = path.join(ROOT, "site");
const PREVIEW_DIR = path.join(SITE_DIR, "previews");

async function loadJson<T>(fileName: string): Promise<T> {
  const filePath = path.join(CANONICAL_DIR, fileName);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function ensureSiteDirs() {
  await mkdir(PREVIEW_DIR, { recursive: true });
}

function renderConvictionBoard(rankings: RankedTeam[], teams: TeamRecord[]): string {
  const rows = rankings
    .map((entry) => {
      const team = teams.find((t) => t.tricode === entry.tricode);
      const label = team ? `${team.market} ${team.name}` : entry.tricode;
      return `<tr><td>${entry.rank}</td><td>${label}</td><td>${entry.score.toFixed(3)}</td><td>${entry.statusLine}</td></tr>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>2025-26 Conviction Board</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 2rem; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
      th { background: #f5f5f5; }
      caption { font-size: 1.5rem; margin-bottom: 1rem; font-weight: bold; }
    </style>
  </head>
  <body>
    <table>
      <caption>2025-26 League Conviction Board</caption>
      <thead>
        <tr><th>Rank</th><th>Team</th><th>Score</th><th>Status</th></tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </body>
</html>`;
}

function renderIndex(rankings: RankedTeam[], teams: TeamRecord[]): string {
  const links = rankings
    .map((entry) => {
      const team = teams.find((t) => t.tricode === entry.tricode);
      const label = team ? `${team.market} ${team.name}` : entry.tricode;
      return `<li><a href="previews/${entry.tricode}.md">${label}</a></li>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>NBA Preseason Previews ${SEASON}</title>
  </head>
  <body>
    <h1>NBA Preseason Previews ${SEASON}</h1>
    <p><a href="previews/conviction-board.html">View the conviction board</a></p>
    <ol>
${links}
    </ol>
  </body>
</html>`;
}

export async function generatePreviews() {
  await ensureSiteDirs();
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
    const filePath = path.join(PREVIEW_DIR, `${team.tricode}.md`);
    await writeFile(filePath, markdown + "\n", "utf8");
  }

  const boardHtml = renderConvictionBoard(rankings, teams);
  await writeFile(path.join(PREVIEW_DIR, "conviction-board.html"), boardHtml + "\n", "utf8");

  const indexHtml = renderIndex(rankings, teams);
  await writeFile(path.join(SITE_DIR, "index.html"), indexHtml + "\n", "utf8");
}

async function run() {
  await generatePreviews();
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
