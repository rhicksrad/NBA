const MAX_ATTEMPTS = 5;
const POLL_DELAY_MS = 10;
let readinessPromise = null;

function normalizeAuthorization(key) {
  const trimmed = String(key ?? '').trim();
  if (!trimmed) {
    return null;
  }
  if (/^Bearer\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Bearer ${trimmed}`;
}

export function resolveBdlKeySync() {
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="bdl-api-key"]');
    const content = meta?.getAttribute('content')?.trim();
    if (content) {
      return content;
    }
  }

  const inline = globalThis?.BDL_CREDENTIALS?.key;
  if (typeof inline === 'string' && inline.trim()) {
    return inline.trim();
  }

  return null;
}

export async function ensureBdlKeyReady() {
  if (!readinessPromise) {
    readinessPromise = (async () => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const key = resolveBdlKeySync();
        if (key) {
          return key;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
      }
      throw new Error("Ball Don't Lie API key missing");
    })();
  }

  return readinessPromise;
}

export async function authHeaders() {
  const key = await ensureBdlKeyReady();
  const authorization = normalizeAuthorization(key);
  if (!authorization) {
    throw new Error("Ball Don't Lie API key missing");
  }
  return { Authorization: authorization };
}
