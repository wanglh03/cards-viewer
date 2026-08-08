const ISSUER_INFO_URL = "https://cards-cdn.gtbro.vip/json/issuer-info.json";
const JSON_PROXY_URLS = new Map([
  ["/json/issuer-info.json", ISSUER_INFO_URL],
  [
    "/json/issuer-mydata.json",
    "https://cards-cdn.gtbro.vip/json/issuer-mydata.json",
  ],
  ["/json/mydata.json", "https://cards-cdn.gtbro.vip/json/mydata.json"],
  [
    "/json/myissuers.json",
    "https://cards-cdn.gtbro.vip/json/myissuers.json",
  ],
  [
    "/json/bin-overlays.json",
    "https://cards-cdn.gtbro.vip/json/bin-overlays.json",
  ],
  ["/issuer-info.json", ISSUER_INFO_URL],
]);

function corsHeaders(): Headers {
  return new Headers({
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "access-control-allow-origin": "*",
  });
}

async function proxyJson(request: Request, sourceUrl: string): Promise<Response> {
  const upstream = await fetch(sourceUrl, {
    method: request.method,
  });
  const headers = new Headers(upstream.headers);
  corsHeaders().forEach((value, key) => headers.set(key, value));
  headers.set("cache-control", "public, max-age=300");
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const shortLinkMatch = url.pathname.match(/^\/s\/([^/]+)\/?$/);

    const jsonSourceUrl = JSON_PROXY_URLS.get(url.pathname);
    if (jsonSourceUrl) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
      if (request.method === "GET" || request.method === "HEAD") {
        return proxyJson(request, jsonSourceUrl);
      }
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD, OPTIONS" },
      });
    }

    if (shortLinkMatch && shortLinkMatch[1] !== "index.html") {
      const shortLinkUrl = new URL(request.url);
      shortLinkUrl.pathname = "/s/index.html";
      shortLinkUrl.search = `?key=${encodeURIComponent(shortLinkMatch[1])}`;
      return env.ASSETS.fetch(new Request(shortLinkUrl, request));
    }

    return env.ASSETS.fetch(request);
  },
};
