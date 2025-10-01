function cors(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type,Bdl-Ci");
  return res;
}

async function checkLimit(env, key) {
  try {
    if (!env.RATE_LIMIT || !env.RATE_LIMIT.idFromName) {
      return { allowed: true, remaining: 60, reset: Date.now() + 60_000 };
    }
    const id = env.RATE_LIMIT.idFromName(key);
    const stub = env.RATE_LIMIT.get(id);
    const r = await stub.fetch("https://limit/check");
    if (!r.ok) return { allowed: true, remaining: 60, reset: Date.now() + 60_000 };
    return await r.json();
  } catch {
    return { allowed: true, remaining: 60, reset: Date.now() + 60_000 };
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (!/^\/bdl(\/|$)/.test(url.pathname)) return new Response("Not found", { status: 404 });
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });

    // Optional CI bypass for IP gates
    const isCi = request.headers.get("Bdl-Ci") === "1";

    // Per-IP limiter (skip if not bound or CI)
    if (!isCi) {
      const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
      const group = url.pathname.split("/").slice(0, 4).join("/");
      const { allowed, remaining, reset } = await checkLimit(env, `${ip}:${group}`);
      if (!allowed) {
        return cors(new Response("Too Many Requests", {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
            "X-RateLimit-Limit": "60",
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(Math.floor(reset / 1000))
          }
        }));
      }
    }

    const upstream = new URL("https://api.balldontlie.io" + url.pathname.replace(/^\/bdl/, "") + url.search);
    const upstreamReq = new Request(upstream.toString(), {
      method: "GET",
      headers: { "Authorization": `Bearer ${env.BDL_API_KEY}`, "Accept": "application/json" }
    });

    const cache = caches.default;
    const cacheKey = new Request(upstream.toString(), { method: "GET" });

    const up = await fetch(upstreamReq);
    let res = new Response(up.body, up);
    if (up.ok) {
      res.headers.set("Cache-Control", "public, max-age=60");
      ctx.waitUntil(cache.put(cacheKey, res.clone()));
    } else {
      res.headers.delete("Cache-Control"); // never cache failures
      res.headers.set("x-proxy", "bdlproxy");
    }
    return cors(res);
  }
};
