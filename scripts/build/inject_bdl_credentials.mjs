#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ARG_DIR_PREFIX = "--dir=";
const PLACEHOLDER = "__VITE_BDL_KEY__";
const SENTINEL = "__VITE" + "_BDL_KEY__";

function resolveArgs() {
  const args = process.argv.slice(2);
  let dir = "public";
  let restore = false;

  for (const arg of args) {
    if (arg === "--restore") {
      restore = true;
    } else if (arg.startsWith(ARG_DIR_PREFIX)) {
      dir = arg.slice(ARG_DIR_PREFIX.length) || dir;
    }
  }

  return { dir, restore };
}

function resolveKey() {
  const candidates = [
    process.env.VITE_BDL_KEY,
    process.env.BALLDONTLIE_API_KEY,
    process.env.BDL_API_KEY,
    process.env.BALL_DONT_LIE_API_KEY,
  ];

  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed.replace(/^Bearer\s+/i, "").trim();
    }
  }

  return null;
}

function embedLiteral(contents, nextLiteral) {
  const pattern = /const EMBEDDED_KEY = "([^"]*)";/;
  const match = contents.match(pattern);
  if (!match) {
    throw new Error("Unable to locate EMBEDDED_KEY definition in credentials script.");
  }
  if (match[1] === nextLiteral) {
    return contents;
  }
  return contents.replace(pattern, `const EMBEDDED_KEY = "${nextLiteral}";`);
}

async function injectKey(targetPath, key) {
  const contents = await readFile(targetPath, "utf8");
  if (!contents.includes(PLACEHOLDER)) {
    console.warn(`Skipping ${targetPath} — placeholder not found.`);
    return;
  }
  const next = embedLiteral(contents, key);
  await writeFile(targetPath, next, "utf8");
  console.log(`Embedded Ball Don't Lie API key into ${path.relative(process.cwd(), targetPath)}.`);
}

async function restorePlaceholder(targetPath) {
  const contents = await readFile(targetPath, "utf8");
  if (contents.includes(PLACEHOLDER)) {
    console.log(`Placeholder already present in ${path.relative(process.cwd(), targetPath)}.`);
    return;
  }
  const next = embedLiteral(contents, PLACEHOLDER);
  await writeFile(targetPath, next, "utf8");
  console.log(`Restored placeholder for ${path.relative(process.cwd(), targetPath)}.`);
}

async function main() {
  const { dir, restore } = resolveArgs();
  const targetPath = path.join(process.cwd(), dir, "assets", "bdl-credentials.js");

  if (restore) {
    await restorePlaceholder(targetPath);
    return;
  }

  const key = resolveKey();
  if (!key) {
    throw new Error(
      "Missing Ball Don't Lie API key — set VITE_BDL_KEY or BALLDONTLIE_API_KEY before running inject_bdl_credentials.",
    );
  }

  if (key === PLACEHOLDER || key === SENTINEL) {
    throw new Error("Refusing to embed placeholder key value.");
  }

  await injectKey(targetPath, key);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
