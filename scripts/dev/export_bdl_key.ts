import { writeFile } from "fs/promises";
import path from "path";

import { loadSecret } from "../lib/secrets.js";

function resolveKey(): string | undefined {
  const envCandidates = [
    process.env.BDL_API_KEY,
    process.env.BALLDONTLIE_API_KEY,
    process.env.BALL_DONT_LIE_API_KEY,
  ];

  for (const value of envCandidates) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return loadSecret("bdl_api_key", {
    aliases: ["ball_dont_lie_api_key", "balldontlie_api_key", "ball-dont-lie"],
  });
}

function normalizeKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("BDL_API_KEY is empty after trimming.");
  }
  if (/^Bearer\s+/i.test(trimmed)) {
    return `Bearer ${trimmed.replace(/^Bearer\s+/i, "").trim()}`;
  }
  return `Bearer ${trimmed}`;
}

async function main(): Promise<void> {
  const raw = resolveKey();
  if (!raw) {
    throw new Error(
      "Missing BDL_API_KEY — provide an environment variable or secrets/bdl_api_key before exporting credentials.",
    );
  }

  const key = normalizeKey(raw);
  const payload = {
    key,
    generated_at: new Date().toISOString(),
    source: "secrets",
  } as const;

  const outPath = path.join(process.cwd(), "public", "bdl-key.json");
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote Ball Don't Lie credential stub to ${path.relative(process.cwd(), outPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
