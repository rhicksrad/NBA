const MAX_ATTEMPTS = 5;
const POLL_DELAY_MS = 10;
const PLACEHOLDER_SENTINEL = "__VITE" + "_BDL_KEY__";
let readinessPromise = null;

export function extractValidKey(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === PLACEHOLDER_SENTINEL) return null;
  const withoutBearer = trimmed.replace(/^Bearer\s+/i, "").trim();
  if (withoutBearer === PLACEHOLDER_SENTINEL) return null;
  return withoutBearer || null;
}

export function normalizeAuthorization(key) {
  const trimmed = String(key ?? "").trim();
  if (!trimmed) return null;
  return /^Bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

export function resolveBdlKeySync() {
  if (typeof document !== "undefined") {
    const meta = document.querySelector('meta[name="bdl-api-key"]');
    const candidate = extractValidKey(meta?.getAttribute("content"));
    if (candidate) return candidate;
  }
  const inline = extractValidKey(globalThis?.BDL_CREDENTIALS?.key);
  if (inline) return inline;
  return null;
}

export async function ensureBdlKeyReady() {
  if (!readinessPromise) {
    readinessPromise = (async () => {
      for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
        const key = resolveBdlKeySync();
        if (key) return key;
        await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
      }
      throw new Error("Ball Don't Lie API key missing");
    })();
  }
  return readinessPromise;
}

export async function authHeaders() {
  const key = await ensureBdlKeyReady();
  const authorization = normalizeAuthorization(key);
  return { Authorization: authorization };
}
