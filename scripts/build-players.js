// scripts/build-players.js
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { build } from "esbuild";

const SRC = path.join("assets", "js", "players.ts");
const OUTDIR = path.join("public", "assets", "js");
const HTML = path.join("public", "players.html");

async function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

async function ensureDir(d) {
  await fs.mkdir(d, { recursive: true });
}

async function bundle() {
  await ensureDir(OUTDIR);
  const result = await build({
    entryPoints: [SRC],
    bundle: true,
    format: "esm",
    target: "es2019",
    minify: true,
    write: false,
  });
  const code = result.outputFiles[0].contents;
  const hash = await sha256(code);
  const file = `players.${hash}.js`;
  await fs.writeFile(path.join(OUTDIR, file), code);
  return file;
}

async function patchHtml(file) {
  let html = await fs.readFile(HTML, "utf8");
  const tagRe = /<script\s+[^>]*id=["']players-bundle["'][^>]*><\/script>/i;
  const newTag = `<script id="players-bundle" type="module" src="/assets/js/${file}"></script>`;

  if (tagRe.test(html)) {
    html = html.replace(tagRe, newTag);
  } else {
    // fallback: inject before </body>
    const bodyClose = /<\/body>\s*<\/html>\s*$/i;
    if (!bodyClose.test(html)) {
      throw new Error("Unable to find </body> in public/players.html for injection");
    }
    // remove any old BUILD:PLAYERS block if it exists
    html = html.replace(/<!--\s*BUILD:PLAYERS\s*-->[\s\S]*?<!--\s*\/BUILD:PLAYERS\s*-->/i, "");
    html = html.replace(
      bodyClose,
      `\n<!-- BUILD:PLAYERS -->\n${newTag}\n<!-- /BUILD:PLAYERS -->\n</body>\n</html>`
    );
  }
  await fs.writeFile(HTML, html);
}

async function main() {
  const file = await bundle();
  await patchHtml(file);
  console.log(`Built roster client → ${file} and wired into players.html`);
}

main().catch((e) => {
  console.error(`Failed to build roster client: ${e.message}`);
  process.exit(1);
});
