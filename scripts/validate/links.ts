import { access, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { load } from "cheerio";
import { TeamRecord } from "../lib/types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const SITE_DIR = path.join(ROOT, "site");
const CANONICAL_TEAMS = path.join(ROOT, "data/2025-26/canonical/teams.json");

async function loadTeams(): Promise<TeamRecord[]> {
  const raw = await readFile(CANONICAL_TEAMS, "utf8");
  return JSON.parse(raw) as TeamRecord[];
}

async function ensureFile(relativePath: string) {
  const target = path.join(ROOT, relativePath);
  await access(target);
}

async function validateLinks() {
  const indexPath = path.join(SITE_DIR, "index.html");
  const html = await readFile(indexPath, "utf8");
  const $ = load(html);
  const links = new Set<string>();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    if (href.startsWith("http")) return;
    links.add(href);
  });

  if (!links.has("previews/conviction-board.html")) {
    throw new Error("Index page must link to previews/conviction-board.html");
  }

  const teams = await loadTeams();
  for (const team of teams) {
    const expected = `previews/${team.tricode}.md`;
    if (!links.has(expected)) {
      throw new Error(`Missing link for ${team.tricode} in index.html`);
    }
    await ensureFile(`site/${expected}`);
  }

  await ensureFile("site/previews/conviction-board.html");
}

async function run() {
  await validateLinks();
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { validateLinks };
