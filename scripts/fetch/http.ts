import { loadSecret } from "../lib/secrets.js";

const MAX_ATTEMPTS = 5;
// Ball Don't Lie free tier allows at most 60 requests per minute.
// Enforce a ~1.1s delay between calls so we stay comfortably under the limit.
const MIN_DELAY_MS = 1100;

interface QueueTask<T> {
  execute: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

const queue: QueueTask<unknown>[] = [];
let processing = false;
let lastRunAt = 0;

function enqueue<T>(execute: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({ execute, resolve, reject });
    processQueue();
  });
}

async function processQueue(): Promise<void> {
  if (processing) {
    return;
  }
  processing = true;

  while (queue.length) {
    const task = queue.shift();
    if (!task) {
      continue;
    }
    const now = Date.now();
    const wait = Math.max(0, lastRunAt + MIN_DELAY_MS - now);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastRunAt = Date.now();

    try {
      const result = await task.execute();
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    }
  }

  processing = false;
}

function resolveBdlKey(): string | undefined {
  const candidates = [
    process.env.BDL_API_KEY,
    process.env.BALLDONTLIE_API_KEY,
    process.env.BALL_DONT_LIE_API_KEY,
  ];

  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  const fileKey = loadSecret("bdl_api_key", {
    aliases: ["ball_dont_lie_api_key", "balldontlie_api_key", "ball-dont-lie"],
  });

  return fileKey?.trim() || undefined;
}

function ensureKey(url: URL): string {
  const key = resolveBdlKey();
  const isBdlHost = /\bballdontlie\.io$/i.test(url.hostname);
  if (isBdlHost && (!key || key.length === 0)) {
    throw new Error(
      "Missing BDL_API_KEY — set your Ball Don't Lie All-Star key or enable USE_BDL_CACHE=1",
    );
  }
  return key ?? "";
}

function safeUrl(url: URL): string {
  return url.toString();
}

async function executeRequest<T>(input: string, init: RequestInit | undefined, attempt: number): Promise<T> {
  const url = new URL(input);
  const headers = new Headers(init?.headers);
  const key = ensureKey(url);

  if (/\bballdontlie\.io$/i.test(url.hostname) && key) {
    headers.set("Authorization", key);
  }

  const requestInit: RequestInit = {
    ...init,
    headers,
  };

  let response: Response;
  try {
    response = await fetch(url, requestInit);
  } catch (error) {
    if (attempt >= MAX_ATTEMPTS) {
      throw error;
    }
    const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.random() * 250;
    console.warn(`Network error for ${safeUrl(url)} — retrying in ${Math.round(backoff)}ms (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
    await new Promise((resolve) => setTimeout(resolve, backoff));
    return executeRequest<T>(input, init, attempt + 1);
  }

  if (response.status === 429 || response.status >= 500) {
    if (attempt >= MAX_ATTEMPTS) {
      const body = await response.text();
      const snippet = body.slice(0, 300);
      throw new Error(`${response.status} ${response.statusText} for ${safeUrl(url)} — ${snippet}`);
    }
    const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.random() * 250;
    console.warn(`${response.status} ${response.statusText} for ${safeUrl(url)} — backing off; attempt ${attempt + 1}/${MAX_ATTEMPTS}`);
    await new Promise((resolve) => setTimeout(resolve, backoff));
    return executeRequest<T>(input, init, attempt + 1);
  }

  if (!response.ok) {
    const body = await response.text();
    const snippet = body.slice(0, 300);
    let hint = snippet;
    if (response.status === 401) {
      hint = "missing/invalid BDL_API_KEY or tier mismatch";
    }
    throw new Error(`${response.status} ${response.statusText} for ${safeUrl(url)} — ${hint}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${safeUrl(url)} — ${(error as Error).message}`);
  }
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  return enqueue(() => executeRequest<T>(url, init, 1));
}
