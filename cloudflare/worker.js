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
    const isSeasonAverages = upstream.pathname.endsWith("/season_averages");
    const seasonParam = upstream.searchParams.get("season");
    const currentYear = new Date().getFullYear();
    const isHistoricalSeason = isSeasonAverages && seasonParam && Number(seasonParam) < currentYear;

    const cache = caches.default;
    const cacheKey = new Request(upstream.toString(), { method: "GET" });

    if (request.method === "GET" && isHistoricalSeason) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const cachedHeaders = new Headers(cached.headers);
        const cachedResponse = new Response(cached.body, {
          status: cached.status,
          headers: cachedHeaders
        });
        return cors(cachedResponse);
      }
    }

    const apiKey = env.BALLDONTLIE_API_KEY ?? env.BDL_API_KEY ?? "";
    const headers = new Headers({ Accept: "application/json" });
    if (apiKey) {
      headers.set("Authorization", `Bearer ${apiKey}`);
    }

    const upstreamResponse = await fetch(upstream.toString(), {
      method: request.method,
      headers
    });

    if (upstreamResponse.status === 429) {
      const retryHeaders = new Headers(upstreamResponse.headers);
      if (!retryHeaders.has("Retry-After")) {
        retryHeaders.set("Retry-After", "1");
      }
      const retryResponse = new Response(upstreamResponse.body, {
        status: 429,
        headers: retryHeaders
      });
      return cors(retryResponse);
    }

    const responseHeaders = new Headers(upstreamResponse.headers);
    let response = new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders
    });

    if (upstreamResponse.ok) {
      if (request.method === "GET" && isHistoricalSeason) {
        responseHeaders.set(
          "Cache-Control",
          "public, max-age=86400, stale-while-revalidate=604800"
        );
        response = new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          headers: responseHeaders
        });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      } else {
        responseHeaders.set("Cache-Control", "public, max-age=60");
        response = new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          headers: responseHeaders
        });
      }
    } else {
      responseHeaders.delete("Cache-Control");
      responseHeaders.set("x-proxy", "bdlproxy");
      response = new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders
      });
    }

    return cors(response);
  }
};
