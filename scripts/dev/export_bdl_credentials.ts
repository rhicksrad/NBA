import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadSecret } from "../lib/secrets.js";

const OUTPUT_PATH = path.join(process.cwd(), "public", "data", "credentials", "bdl.json");

interface WriteOptions {
  /** Suppress console output when true. */
  silent?: boolean;
}

interface CredentialPayload {
  authorization: string;
  generatedAt: string;
  source: "env" | "secret";
}

function resolveRawKey(): { key: string | null; source: "env" | "secret" | null } {
  const envCandidates = [
    process.env.BDL_API_KEY,
    process.env.BALLDONTLIE_API_KEY,
    process.env.BALL_DONT_LIE_API_KEY,
  ];

  for (const candidate of envCandidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return { key: trimmed, source: "env" };
    }
  }

  const secret = loadSecret("bdl_api_key", {
    aliases: ["balldontlie_api_key", "ball_dont_lie_api_key", "ball-dont-lie"],
  });
  const trimmedSecret = secret?.trim();
  if (trimmedSecret) {
    return { key: trimmedSecret, source: "secret" };
  }

  return { key: null, source: null };
}

function ensureBearerPrefix(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return trimmed;
  if (/^Bearer\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Bearer ${trimmed}`;
}

async function removeExistingFile(): Promise<void> {
  try {
    await fs.unlink(OUTPUT_PATH);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function writeFrontendCredentials(options: WriteOptions = {}): Promise<CredentialPayload | null> {
  const { key, source } = resolveRawKey();
  if (!key || !source) {
    if (!options.silent) {
      console.warn("BDL frontend credentials missing — no BDL_API_KEY available in env or secrets.");
    }
    await removeExistingFile();
    return null;
  }

  const authorization = ensureBearerPrefix(key);
  const payload: CredentialPayload = {
    authorization,
    generatedAt: new Date().toISOString(),
    source,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");

  if (!options.silent) {
    const redacted = authorization.length > 16 ? `${authorization.slice(0, 8)}…${authorization.slice(-4)}` : authorization;
    console.log(`Wrote BDL frontend credentials (${source}) → ${OUTPUT_PATH} [${redacted}]`);
  }

  return payload;
}

async function main(): Promise<void> {
  await writeFrontendCredentials();
}

const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentFile = fileURLToPath(import.meta.url);

if (entryFile && entryFile === currentFile) {
  main().catch((error) => {
    console.error("Failed to export BDL frontend credentials:", error);
    process.exitCode = 1;
  });
}
