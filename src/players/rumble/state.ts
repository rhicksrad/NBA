import type { MatchupState } from "./types";

function toBase64(value: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(value);
  }
  return Buffer.from(value, "utf8").toString("base64");
}

function fromBase64(value: string): string {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return window.atob(value);
  }
  return Buffer.from(value, "base64").toString("utf8");
}

function sanitizeIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }
  return ids
    .map((id) => (typeof id === "string" || typeof id === "number" ? String(id) : null))
    .filter((id): id is string => Boolean(id && id.trim().length));
}

export function encodeMatchup(state: MatchupState): string {
  const payload = {
    a: sanitizeIds(state.a),
    b: sanitizeIds(state.b),
    eraNorm: Boolean(state.eraNorm),
  };
  return toBase64(JSON.stringify(payload));
}

export function decodeMatchup(value: string | null | undefined): MatchupState | null {
  if (!value) {
    return null;
  }
  try {
    const raw = JSON.parse(fromBase64(value));
    return {
      a: sanitizeIds(raw?.a),
      b: sanitizeIds(raw?.b),
      eraNorm: Boolean(raw?.eraNorm),
    };
  } catch (error) {
    console.warn("Unable to decode rumble hash", error);
    return null;
  }
}

export function readHash(): MatchupState | null {
  const hash = window.location.hash.slice(1);
  if (!hash.startsWith("rumble=")) {
    return null;
  }
  const encoded = hash.slice("rumble=".length);
  return decodeMatchup(encoded);
}

export function writeHash(state: MatchupState): void {
  const encoded = encodeMatchup(state);
  const next = `#rumble=${encoded}`;
  if (window.location.hash === next) {
    return;
  }
  window.history.replaceState(
    {},
    "Roster Rumble",
    `${window.location.pathname}${window.location.search}${next}`
  );
}
