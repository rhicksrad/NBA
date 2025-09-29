import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const ENTRY = path.join(process.cwd(), "assets", "js", "players.ts");
const OUT_DIR = path.join(process.cwd(), "public", "assets", "js");
const HTML_PATH = path.join(process.cwd(), "public", "players.html");

async function removeOldBundles() {
  try {
    const files = await fs.readdir(OUT_DIR);
    await Promise.all(
      files
        .filter((file) => /^players\.[a-f0-9]+\.js$/u.test(file))
        .map((file) => fs.unlink(path.join(OUT_DIR, file))),
    );
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

async function main() {
  const result = await build({
    entryPoints: [ENTRY],
    bundle: true,
    format: "esm",
    target: "es2019",
    minify: true,
    sourcemap: false,
    logLevel: "error",
    write: false,
  });

  const output = result.outputFiles?.[0];
  if (!output) {
    throw new Error("esbuild returned no output for players bundle");
  }

  const hash = createHash("sha256").update(output.contents).digest("hex");
  const fileName = `players.${hash.slice(0, 8)}.js`;

  await fs.mkdir(OUT_DIR, { recursive: true });
  await removeOldBundles();
  await fs.writeFile(path.join(OUT_DIR, fileName), output.contents);

  const html = await fs.readFile(HTML_PATH, "utf8");
  const nextScriptTag = `<script type="module" src="/assets/js/${fileName}"></script>`;
  let updated = false;
  const replaced = html.replace(
    /<script type="module" src="\/assets\/js\/players[^"']*"><\/script>/u,
    () => {
      updated = true;
      return nextScriptTag;
    },
  );

  if (!updated) {
    throw new Error(
      "Unable to locate players asset tag in public/players.html for replacement",
    );
  }

  await fs.writeFile(HTML_PATH, replaced);
  console.log(`Built players bundle ${fileName}`);
}

main().catch((error) => {
  console.error("Failed to build roster client:", error);
  process.exit(1);
});
