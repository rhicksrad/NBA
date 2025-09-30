export const BDL_BASE = "https://bdlproxy.hicksrch.workers.dev/bdl";

export async function bdl(path, init = {}) {
  const url = `${BDL_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init.headers || {}) }
  });
  if (!res.ok) throw new Error(`BDL ${res.status} ${res.statusText} for ${path}`);
  return res.json();
}
