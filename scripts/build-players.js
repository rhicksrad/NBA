import fs from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const ENTRY = path.join(process.cwd(), "assets", "js", "players.ts");
const OUT_FILE = path.join(process.cwd(), "public", "assets", "js", "players.js");

async function main() {
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await build({
    entryPoints: [ENTRY],
    outfile: OUT_FILE,
    bundle: true,
    format: "esm",
    target: "es2019",
    minify: true,
    sourcemap: false,
    logLevel: "error",
  });
  console.log(`Built ${OUT_FILE}`);
}

main().catch((error) => {
  console.error("Failed to build roster client:", error);
  process.exit(1);
});
