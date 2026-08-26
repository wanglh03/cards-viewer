import shortLinks from "../src/config/short-links.json";

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
const ISSUER_LOGO_PROXY_PREFIX = "/proxy/issuer-logo/";

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

async function proxyIssuerLogo(request: Request, pathname: string): Promise<Response> {
  const logoPath = pathname.slice(ISSUER_LOGO_PROXY_PREFIX.length);
  if (!logoPath || logoPath.includes("..")) {
    return new Response("Bad Request", { status: 400, headers: corsHeaders() });
  }

  const upstream = await fetch(
    `https://cards-cdn.gtbro.vip/issuers/logo/${logoPath}`,
    { method: request.method },
  );
  const headers = new Headers(upstream.headers);
  corsHeaders().forEach((value, key) => headers.set(key, value));
  headers.set("cache-control", "public, max-age=86400");
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

    if (url.pathname.startsWith(ISSUER_LOGO_PROXY_PREFIX)) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
      if (request.method === "GET" || request.method === "HEAD") {
        return proxyIssuerLogo(request, url.pathname);
      }
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD, OPTIONS" },
      });
    }

    if (shortLinkMatch) {
      const target = shortLinks[shortLinkMatch[1] as keyof typeof shortLinks];
      if (target) {
        return Response.redirect(new URL(target, request.url), 302);
      }
      return Response.redirect(new URL("/", request.url), 302);
    }

    // Static files and SPA routes are handled by the Static Assets binding.
    // API, proxy, and short-link paths are routed here by wrangler.jsonc.
    return env.ASSETS.fetch(request);
  },
};
