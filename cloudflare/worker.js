function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Bdl-Ci");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function checkLimit(env, key) {
  try {
    if (!env.RATE_LIMIT || !env.RATE_LIMIT.idFromName) {
      return { allowed: true, remaining: 60, reset: Date.now() + 60_000 };
    }
    const id = env.RATE_LIMIT.idFromName(key);
    const stub = env.RATE_LIMIT.get(id);
    const res = await stub.fetch("https://limit/check");
    if (!res.ok) {
      return { allowed: true, remaining: 60, reset: Date.now() + 60_000 };
    }
    return await res.json();
  } catch {
    return { allowed: true, remaining: 60, reset: Date.now() + 60_000 };
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }

    if (!/^\/bdl(\/|$)/.test(url.pathname)) {
      const notFound = new Response("Not found", { status: 404 });
      notFound.headers.set("x-proxy", "bdlproxy");
      return cors(notFound);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      const methodError = new Response("Method not allowed", { status: 405 });
      methodError.headers.set("x-proxy", "bdlproxy");
      return cors(methodError);
    }

    const isCi = request.headers.get("Bdl-Ci") === "1";

    if (!isCi) {
      const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
      const group = url.pathname.split("/").slice(0, 4).join("/");
      const { allowed, remaining, reset } = await checkLimit(env, `${ip}:${group}`);
      if (!allowed) {
        const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        const limited = new Response("Too Many Requests", {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": "60",
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(Math.floor(reset / 1000)),
          },
        });
        limited.headers.set("x-proxy", "bdlproxy");
        return cors(limited);
      }
    }

    const upstreamPath = url.pathname.replace(/^\/bdl/, "");
    const upstreamUrl = new URL(`https://api.balldontlie.io${upstreamPath}${url.search}`);

    const cache = caches.default;
    const cacheKey = new Request(upstreamUrl.toString(), { method: "GET" });
    const method = request.method;

    if (method === "GET" || method === "HEAD") {
      const cached = await cache.match(cacheKey);
      if (cached && cached.ok) {
        const headers = new Headers(cached.headers);
        headers.set("x-proxy", "bdlproxy");
        const cachedResponse =
          method === "HEAD"
            ? new Response(null, {
                status: cached.status,
                statusText: cached.statusText,
                headers,
              })
            : new Response(cached.body, {
                status: cached.status,
                statusText: cached.statusText,
                headers,
              });
        return cors(cachedResponse);
      }
    }

    const upstreamReq = new Request(upstreamUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.BDL_API_KEY}`,
        Accept: "application/json",
      },
    });

    const upstreamRes = await fetch(upstreamReq);
    const cloneForCache = upstreamRes.clone();

    const headers = new Headers(upstreamRes.headers);
    headers.set("x-proxy", "bdlproxy");

    if (upstreamRes.ok) {
      headers.set("Cache-Control", "public, max-age=60");
    } else {
      headers.delete("Cache-Control");
    }

    const proxied =
      method === "HEAD"
        ? new Response(null, {
            status: upstreamRes.status,
            statusText: upstreamRes.statusText,
            headers,
          })
        : new Response(upstreamRes.body, {
            status: upstreamRes.status,
            statusText: upstreamRes.statusText,
            headers,
          });

    if (upstreamRes.ok) {
      const cacheHeaders = new Headers(cloneForCache.headers);
      cacheHeaders.set("Cache-Control", "public, max-age=60");
      cacheHeaders.set("x-proxy", "bdlproxy");
      const cacheResponse = new Response(cloneForCache.body, {
        status: cloneForCache.status,
        statusText: cloneForCache.statusText,
        headers: cacheHeaders,
      });
      ctx.waitUntil(cache.put(cacheKey, cacheResponse));
    }

    return cors(proxied);
  },
};
