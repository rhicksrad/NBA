import { request } from "./http.js";

const API_URL = "https://api.balldontlie.io/v1/player_injuries";
const MAX_PER_PAGE = 100;

export interface BdlPlayerSummary {
  id?: number;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  height?: string | null;
  weight?: string | null;
  jersey_number?: string | null;
  college?: string | null;
  country?: string | null;
  draft_year?: number | null;
  draft_round?: number | null;
  draft_number?: number | null;
  team_id?: number | null;
  team?: { id?: number | null; abbreviation?: string | null; full_name?: string | null } | null;
}

export interface BdlPlayerInjury {
  id?: number;
  player?: BdlPlayerSummary | null;
  return_date?: string | null;
  description?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface PlayerInjuryPage {
  data?: unknown;
  meta?: {
    next_cursor?: string | number | null;
    next_page?: number | null;
    current_page?: number | null;
    total_pages?: number | null;
    per_page?: number | null;
  } | null;
}

export interface PlayerInjuryFetchOptions {
  perPage?: number;
  pageLimit?: number;
  cursor?: string | number | null;
  maxItems?: number;
  teamIds?: Array<number | string>;
  playerIds?: Array<number | string>;
}

function clampPerPage(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return MAX_PER_PAGE;
  }
  const parsed = Math.floor(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return MAX_PER_PAGE;
  }
  return Math.min(Math.max(parsed, 1), MAX_PER_PAGE);
}

function isCursorLike(value: unknown): value is string | number {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return false;
}

function appendArrayParams(search: URLSearchParams, key: string, values: Array<number | string> | undefined) {
  if (!Array.isArray(values)) {
    return;
  }
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text.length) {
      search.append(`${key}[]`, text);
    }
  }
}

export async function fetchPlayerInjuries(options: PlayerInjuryFetchOptions = {}): Promise<BdlPlayerInjury[]> {
  const perPage = clampPerPage(options.perPage);
  const pageLimit = options.pageLimit && options.pageLimit > 0 ? Math.floor(options.pageLimit) : undefined;
  const maxItems = options.maxItems && options.maxItems > 0 ? Math.floor(options.maxItems) : undefined;

  const entries: BdlPlayerInjury[] = [];
  let cursor: string | number | null = isCursorLike(options.cursor) ? (options.cursor as string | number) : null;
  let nextPage: number | undefined;
  let attempts = 0;

  while (true) {
    attempts += 1;
    if (pageLimit && attempts > pageLimit) {
      break;
    }

    const search = new URLSearchParams();
    search.set("per_page", String(perPage));
    if (cursor !== null && cursor !== undefined) {
      search.set("cursor", String(cursor));
    } else if (nextPage !== undefined) {
      search.set("page", String(nextPage));
    }

    appendArrayParams(search, "team_ids", options.teamIds);
    appendArrayParams(search, "player_ids", options.playerIds);

    const url = `${API_URL}?${search.toString()}`;
    const payload = await request<PlayerInjuryPage>(url);
    const pageData = Array.isArray(payload?.data) ? (payload?.data as unknown[]) : [];

    for (const entry of pageData) {
      entries.push(entry as BdlPlayerInjury);
    }

    if (maxItems && entries.length >= maxItems) {
      break;
    }

    const meta = payload?.meta ?? {};
    const nextCursor = meta?.next_cursor;
    if (isCursorLike(nextCursor)) {
      cursor = nextCursor;
      nextPage = undefined;
      continue;
    }

    const rawNextPage = meta?.next_page;
    const metaNextPage = typeof rawNextPage === "number" && Number.isFinite(rawNextPage)
      ? rawNextPage
      : undefined;
    if (metaNextPage !== undefined) {
      cursor = null;
      nextPage = metaNextPage;
      continue;
    }

    const totalPages = typeof meta?.total_pages === "number" ? meta.total_pages : undefined;
    const currentPage = typeof meta?.current_page === "number" ? meta.current_page : undefined;
    if (totalPages !== undefined && currentPage !== undefined && currentPage < totalPages) {
      cursor = null;
      nextPage = currentPage + 1;
      continue;
    }

    break;
  }

  if (maxItems && entries.length > maxItems) {
    return entries.slice(0, maxItems);
  }

  return entries;
}
