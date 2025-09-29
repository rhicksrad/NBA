
type PlayersIndex = {
  fetched_at: string;
  source: string;
  count: number;
  players: Array<{
    id: number;
    name: string;
    team_abbr: string;
    position: string | null;
    jersey: string | null;
    height: string | null;
    weight: string | null;
  }>;
};

type PlayerRow = PlayersIndex["players"][number];

type AppState = {
  index: PlayersIndex | null;
  loading: boolean;
  error: string | null;
  searchTerm: string;
  teamFilter: string;
  anchorApplied: boolean;
};

async function loadIndex(): Promise<PlayersIndex> {
  const response = await fetch(`data/players_index.json?cb=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as PlayersIndex;
}

const app = document.getElementById("players-app");

if (!app) {
  throw new Error("Missing #players-app container");
}

const params = new URLSearchParams(window.location.search);
const initialTeam = (params.get("team") ?? "").toUpperCase();
const initialSearch = params.get("search") ?? "";

const state: AppState = {
  index: null,
  loading: true,
  error: null,
  searchTerm: initialSearch,
  teamFilter: initialTeam,
  anchorApplied: false,
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function formatRelativeTime(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return iso;
  }

  const now = Date.now();
  const diffSeconds = Math.round((timestamp - now) / 1000);
  const divisions: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.34524, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ];

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let duration = diffSeconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return formatter.format(Math.round(duration), "year");
}

function matchesSearch(player: PlayerRow, query: string): boolean {
  if (!query) {
    return true;
  }
  const lower = query.toLowerCase();
  const name = player.name.toLowerCase();
  const jersey = player.jersey ? `#${player.jersey}`.toLowerCase() : "";
  return name.includes(lower) || jersey.includes(lower);
}

function updateUrl(paramsToSet: Record<string, string | null>) {
  const url = new URL(window.location.href);
  Object.entries(paramsToSet).forEach(([key, value]) => {
    if (value && value.length) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
  });
  window.history.replaceState({}, "", url.toString());
}

function teamLabel(abbr: string): string {
  if (abbr === "FA") {
    return "Free agents";
  }
  return abbr;
}

function sortTeams(a: string, b: string): number {
  if (a === "FA" && b !== "FA") {
    return 1;
  }
  if (b === "FA" && a !== "FA") {
    return -1;
  }
  return a.localeCompare(b);
}

function buildTeams(players: PlayerRow[]): Array<{ abbr: string; players: PlayerRow[] }> {
  const map = new Map<string, PlayerRow[]>();
  for (const player of players) {
    const abbr = player.team_abbr || "FA";
    const roster = map.get(abbr);
    if (roster) {
      roster.push(player);
    } else {
      map.set(abbr, [player]);
    }
  }
  return [...map.entries()]
    .map(([abbr, roster]) => ({ abbr, players: roster }))
    .sort((lhs, rhs) => sortTeams(lhs.abbr, rhs.abbr));
}

function renderLoading() {
  app.innerHTML = `
    <div class="roster-status">
      <p>Loading active rosters…</p>
    </div>
  `;
}

function renderError(message: string) {
  app.innerHTML = `
    <div class="roster-status roster-status--error">
      <p>${escapeHtml(message)}</p>
      <button type="button" class="roster-button" data-roster-retry>Retry</button>
    </div>
  `;
  const retry = app.querySelector<HTMLButtonElement>("[data-roster-retry]");
  if (retry) {
    retry.addEventListener("click", () => fetchIndex());
  }
}

function renderDoc(index: PlayersIndex) {
  const teams = buildTeams(index.players);
  const selectedTeam = state.teamFilter;
  if (selectedTeam && !teams.some((team) => team.abbr === selectedTeam)) {
    state.teamFilter = "";
    updateUrl({ team: null });
  }
  const effectiveTeam = state.teamFilter;
  const visibleTeams = teams.filter(
    (team) => !effectiveTeam || team.abbr === effectiveTeam,
  );
  const teamOptions = ["", ...teams.map((team) => team.abbr)];

  const hasTeams = teams.length > 0;
  const lastUpdatedText = hasTeams
    ? formatRelativeTime(index.fetched_at)
    : "not yet available";
  const timestampTitle = hasTeams
    ? new Date(index.fetched_at).toLocaleString()
    : "No roster snapshot cached yet";
  const sourceLabel = index.source?.trim() || "Unknown";

  const headerHtml = `
    <div class="roster-controls">
      <div class="roster-controls__filters">
        <label class="roster-controls__field">
          <span class="roster-controls__label">Search</span>
          <input
            id="roster-search"
            class="roster-input"
            type="search"
            placeholder="Search by name or jersey"
            value="${escapeHtml(state.searchTerm)}"
            autocomplete="off"
          />
        </label>
        <label class="roster-controls__field">
          <span class="roster-controls__label">Team</span>
          <select id="roster-team" class="roster-select">
            ${teamOptions
              .map((code) => {
                const label = code || "All teams";
                const selected = code === effectiveTeam ? "selected" : "";
                return `<option value="${code}">${label}</option>`;
              })
              .join("")}
          </select>
        </label>
      </div>
      <div class="roster-controls__meta">
        <small title="${timestampTitle}">
          Last updated: ${lastUpdatedText} • Source: ${escapeHtml(sourceLabel)}
        </small>
        <button type="button" class="roster-button" data-roster-refresh>Refresh</button>
      </div>
    </div>
  `;

  const sections = visibleTeams
    .map((team) => {
      const players = team.players.filter((player) =>
        matchesSearch(player, state.searchTerm),
      );
      const items = players
        .map((player) => {
          const jersey = player.jersey ? `#${player.jersey}` : "";
          const pieces = [player.position ?? "", jersey].filter(Boolean).join(" · ");
          const meta = [player.height ?? "", player.weight ? `${player.weight} lb` : ""]
            .filter(Boolean)
            .join(" • ");
          return `
            <li class="roster-player">
              <span class="roster-player__name">${escapeHtml(player.name)}</span>
              ${pieces ? `<span class="roster-player__role">${escapeHtml(pieces)}</span>` : ""}
              ${meta ? `<span class="roster-player__meta">${escapeHtml(meta)}</span>` : ""}
            </li>
          `;
        })
        .join("");

      const emptyMessage = players.length
        ? ""
        : `<li class="roster-player roster-player--empty">No players match this filter.</li>`;

      const subtitle = `${escapeHtml(teamLabel(team.abbr))} · ${players.length} players`;

      return `
        <section class="roster-team" data-team-anchor="${team.abbr}">
          <header class="roster-team__header">
            <h3 id="team-${team.abbr}">${team.abbr}</h3>
            <p>${subtitle}</p>
          </header>
          <ul class="roster-list">
            ${items || emptyMessage}
          </ul>
        </section>
      `;
    })
    .join("");

  let noTeamsMessage = "";
  if (!hasTeams) {
    noTeamsMessage = `<div class="roster-status roster-status--empty"><p>Rosters are not cached yet. Use Refresh to try again.</p></div>`;
  } else if (!visibleTeams.length) {
    noTeamsMessage = `<div class="roster-status roster-status--empty"><p>No teams match the current filter.</p></div>`;
  }

  app.innerHTML = `${headerHtml}<div class="roster-teams">${sections}${noTeamsMessage}</div>`;

  const searchInput = document.getElementById("roster-search") as HTMLInputElement | null;
  const teamSelect = document.getElementById("roster-team") as HTMLSelectElement | null;
  const refreshButton = app.querySelector<HTMLButtonElement>("[data-roster-refresh]");

  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      const value = (event.target as HTMLInputElement).value;
      state.searchTerm = value;
      updateUrl({ search: value });
      render();
    });
  }

  if (teamSelect) {
    teamSelect.addEventListener("change", (event) => {
      const value = (event.target as HTMLSelectElement).value.toUpperCase();
      state.teamFilter = value;
      state.anchorApplied = !value;
      updateUrl({ team: value });
      render();
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", () => fetchIndex());
  }

  if (!state.anchorApplied && state.teamFilter) {
    const anchor = app.querySelector(`[data-team-anchor="${state.teamFilter}"]`);
    if (anchor) {
      anchor.scrollIntoView({ behavior: "smooth", block: "start" });
      state.anchorApplied = true;
    }
  }
}

function render() {
  if (state.loading) {
    renderLoading();
    return;
  }
  if (state.error) {
    renderError(state.error);
    return;
  }
  if (state.index) {
    renderDoc(state.index);
  }
}

async function fetchIndex() {
  state.loading = true;
  state.error = null;
  render();
  try {
    const index = await loadIndex();
    if (!index || !Array.isArray(index.players)) {
      throw new Error("Malformed players index payload");
    }
    state.index = index;
    state.loading = false;
    render();
  } catch (error) {
    state.loading = false;
    state.error = error instanceof Error ? error.message : "Unable to load players.";
    render();
  }
}

fetchIndex();
