import { pathToFileURL } from "url";

import { request } from "../fetch/http.js";

interface VerifyResponse {
  data?: unknown[];
}

async function verify(): Promise<void> {
  const url = "https://api.balldontlie.io/v1/players/active?team_ids[]=1&per_page=1";
  const response = await request<VerifyResponse>(url);
  const count = Array.isArray(response.data) ? response.data.length : 0;
  console.log(`BDL OK — ${count} player(s) returned`);
}

function useCache(): boolean {
  const value = process.env.USE_BDL_CACHE;
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function inCi(): boolean {
  const value = process.env.CI;
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

async function run(): Promise<void> {
  try {
    await verify();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Missing BDL_API_KEY") && useCache()) {
      console.log("BDL check skipped — using cached data (USE_BDL_CACHE)");
      return;
    }
    if (message.includes("Missing BDL_API_KEY") && inCi()) {
      console.log("BDL check skipped — missing BDL_API_KEY in CI environment");
      return;
    }
    throw error;
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export { verify };
