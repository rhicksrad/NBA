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

async function run(): Promise<void> {
  await verify();
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export { verify };
