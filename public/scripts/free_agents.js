const BDL_BASE = "https://bdlproxy.hicksrch.workers.dev"; // your Worker host

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function fetchBDL(path, retries = 3) {
  const url = `${BDL_BASE}${path}${path.includes("?") ? "&" : "?"}_=${Date.now()}`; // cache-bust
  for (let i = 0; i <= retries; i++) {
    const r = await fetch(url, { credentials: "omit", cache: "no-store" });
    if (r.status !== 429) return r;
    await sleep(500 * 2 ** i);
  }
  throw new Error("BDL 429 after retries");
}

async function* listActivePlayers(perPage = 100) {
  let cursor;
  while (true) {
    const qs = new URLSearchParams({ per_page: String(perPage) });
    if (cursor) qs.set("cursor", cursor);
    const res = await fetchBDL(`/bdl/v1/players/active?${qs}`);
    if (!res.ok) throw new Error(`BDL ${res.status} players/active`);
    const json = await res.json();
    for (const p of json.data) yield p;
    cursor = json.meta?.next_cursor;
    if (!cursor) break;
  }
}

// Pull authoritative “rostered right now” IDs by name search refresh.
// This corrects upstream lag in /players/active team=null records.
async function refreshPlayerTeamById(id) {
  const res = await fetchBDL(`/bdl/v1/players?player_ids[]=${id}&per_page=1`);
  if (!res.ok) return null;
  const { data } = await res.json();
  return data?.[0] || null;
}

// Optional: double-check with a specific search to fix known mismatches (like DeRozan).
async function searchByNameOnce(name) {
  const res = await fetchBDL(`/bdl/v1/players?search=${encodeURIComponent(name)}&per_page=5`);
  if (!res.ok) return [];
  const { data } = await res.json();
  return data || [];
}

// Build a set of current rostered IDs by sweeping teams → players.
async function rosterIdSet() {
  const ids = new Set();
  // 30 NBA team IDs per BDL; use players filter by team_ids to avoid hitting a separate roster endpoint
  const TEAM_IDS = [
    1610612737,1610612738,1610612739,1610612740,1610612741,1610612742,1610612743,1610612744,1610612745,1610612746,
    1610612747,1610612748,1610612749,1610612750,1610612751,1610612752,1610612753,1610612754,1610612755,1610612756,
    1610612757,1610612758,1610612759,1610612760,1610612761,1610612762,1610612763,1610612764,1610612765,1610612766
  ];
  // Chunk to stay under URL limits
  for (let i = 0; i < TEAM_IDS.length; i += 8) {
    const chunk = TEAM_IDS.slice(i, i + 8);
    let cursor;
    do {
      const qs = new URLSearchParams({ per_page: "100" });
      for (const id of chunk) qs.append("team_ids[]", String(id));
      if (cursor) qs.set("cursor", cursor);
      const r = await fetchBDL(`/bdl/v1/players?${qs.toString()}`);
      if (!r.ok) throw new Error(`BDL ${r.status} players team sweep`);
      const j = await r.json();
      for (const p of j.data) ids.add(p.id);
      cursor = j.meta?.next_cursor;
    } while (cursor);
  }
  return ids;
}

export async function getActiveFreeAgents() {
  // 1) primary source: /players/active where team==null
  const candidates = [];
  for await (const p of listActivePlayers(100)) {
    if (!p.team) candidates.push(p);
  }

  // 2) reconcile against current roster truth to catch stale team==null (e.g., DeRozan)
  const rostered = await rosterIdSet();

  // 3) per-player refresh for any “big name” or obviously wrong entries
  const mustRefreshByName = new Map([
    // Known mismatch examples; extend if you find others.
    [201942, "DeMar DeRozan"], // ID stable across BDL; adjust if different in your data
  ]);

  const refreshed = await Promise.all(
    candidates.map(async p => {
      if (rostered.has(p.id)) return { ...p, __exclude_reason: "on_roster_set" };
      // Quick one-shot refresh by ID
      const fresh = await refreshPlayerTeamById(p.id);
      if (fresh?.team) return { ...fresh, __exclude_reason: "team_present_after_refresh" };
      // Name-based rescue for known mismatches
      if (mustRefreshByName.has(p.id)) {
        const hits = await searchByNameOnce(mustRefreshByName.get(p.id));
        const exact = hits.find(h => h.id === p.id) || hits[0];
        if (exact?.team) return { ...exact, __exclude_reason: "team_present_after_name_search" };
      }
      return p;
    })
  );

  // 4) final list: only those still lacking a team after reconciliation
  const freeAgents = refreshed.filter(p => !p.team && !p.__exclude_reason);

  // Optional: annotate with lightweight recency signal
  const season = new Date().getUTCFullYear(); // crude, ok for display
  async function appearedThisSeason(id) {
    const r = await fetchBDL(`/bdl/v1/stats?player_ids[]=${id}&per_page=1&season=${season}`);
    if (!r.ok) return false;
    const j = await r.json();
    return Array.isArray(j.data) && j.data.length > 0;
  }
  const enriched = await Promise.all(freeAgents.map(async p => ({
    ...p,
    appeared_this_season: await appearedThisSeason(p.id).catch(() => false),
  })));

  return enriched;
}

// UI glue
export async function renderFreeAgents() {
  const list = document.querySelector("[data-free-agent-list]");
  const sub = document.querySelector("[data-free-agent-subtitle]");
  const foot = document.querySelector("[data-free-agent-footnote]");
  try {
    const fa = await getActiveFreeAgents();
    list.innerHTML = "";
    if (fa.length === 0) {
      list.innerHTML = `<li class="free-agent-radar__placeholder">No notable free agents right now.</li>`;
      sub.textContent = "Sourced from Ball Don't Lie and reconciled with current rosters.";
      foot.textContent = "We refresh hourly with cache-busting to avoid stale responses.";
      return;
    }
    for (const p of fa.slice(0, 20)) {
      const li = document.createElement("li");
      li.className = "free-agent-radar__item";
      const name = `${p.first_name} ${p.last_name}`;
      li.textContent = `${name}${p.appeared_this_season ? " · logged minutes this season" : ""}`;
      list.appendChild(li);
    }
    sub.textContent = "Active free agents after live roster reconciliation.";
    foot.textContent = `Source: Ball Don't Lie via Worker proxy at ${new Date().toLocaleString()}`;
  } catch (e) {
    list.innerHTML = `<li class="free-agent-radar__placeholder">Free agent board failed: ${String(e)}</li>`;
    sub.textContent = "Falling back disabled to avoid stale names.";
    foot.textContent = "";
  }
}
