import { ProxyAgent, setGlobalDispatcher } from "undici";

import { loadSecret } from "../lib/secrets.js";

const DEFAULT_UPSTREAM = "https://api.balldontlie.io";
const PROXY_BASE = process.env.BDL_PROXY_BASE?.trim() || "";
export const BDL_BASE = PROXY_BASE || DEFAULT_UPSTREAM;

const proxyUrl =
  process.env.HTTPS_PROXY ??
  process.env.https_proxy ??
  process.env.HTTP_PROXY ??
  process.env.http_proxy ??
  null;

if (proxyUrl) {
  try {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  } catch (error) {
    console.warn(`Failed to configure proxy agent for ${proxyUrl}: ${String(error)}`);
  }
}

const MAX_RETRIES = 3;
const MIN_DELAY_MS = 1100;

const BDL_UPSTREAM_HOST_PATTERN = /\bballdontlie\.io$/i;

function normalizeBase(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

const normalizedProxyBase = PROXY_BASE ? normalizeBase(PROXY_BASE) : "";

function resolveBase(): string {
  return normalizedProxyBase || DEFAULT_UPSTREAM;
}

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

export function requireBallDontLieKey(): string {
  const key = resolveBdlKey();
  if (!key || key.length === 0) {
    throw new Error(
      "Missing BALLDONTLIE_API_KEY — set it or use BDL_PROXY_BASE to route via proxy.",
    );
  }
  return key;
}

export function formatBdlAuthHeader(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return trimmed;
  if (/^Bearer\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Bearer ${trimmed}`;
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (typeof (input as Request).url === "string") {
    return (input as Request).url;
  }
  throw new Error("Unsupported request input type for Ball Don't Lie request");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildUrl(path: string, search = ""): URL {
  const base = normalizeBase(resolveBase());
  const fullPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(`${base}${fullPath}${search}`);
}

function shouldAttachAuthorization(hostname: string): boolean {
  if (!hostname) {
    return false;
  }
  if (!normalizedProxyBase) {
    return BDL_UPSTREAM_HOST_PATTERN.test(hostname);
  }
  return false;
}

export async function execute<T = unknown>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const urlText = resolveRequestUrl(input);
  let target: URL;
  try {
    target = new URL(urlText);
  } catch {
    target = new URL(urlText, resolveBase());
  }

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  if (process.env.CI === "true" && !headers.has("Bdl-Ci")) {
    headers.set("Bdl-Ci", "1");
  }

  if (shouldAttachAuthorization(target.hostname) && !headers.has("Authorization")) {
    headers.set("Authorization", formatBdlAuthHeader(requireBallDontLieKey()));
  }

  const fetchUrl = target.toString();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(fetchUrl, { ...init, headers });
      const body = await response.text().catch(() => "");

      if (response.ok) {
        try {
          return JSON.parse(body) as T;
        } catch (error) {
          const snippet = body.slice(0, 300).replace(/\s+/g, " ");
          throw new Error(
            `Failed to parse JSON from ${fetchUrl} — ${(error as Error).message} — ${snippet}`,
          );
        }
      }

      const snippet = body.slice(0, 300).replace(/\s+/g, " ");
      if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES - 1) {
        await wait(400 * (attempt + 1));
        continue;
      }
      throw new Error(`${response.status} ${response.statusText} for ${fetchUrl} — ${snippet}`);
    } catch (error) {
      if (attempt >= MAX_RETRIES - 1) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Network error for ${fetchUrl} — ${reason}`);
      }
      await wait(400 * (attempt + 1));
    }
  }

  throw new Error(`Retries exhausted for ${fetchUrl}`);
}

export async function request<T>(url: string | URL, init?: RequestInit): Promise<T> {
  const target = typeof url === "string" ? url : url.toString();
  return enqueue(() => execute<T>(target, init));
}
