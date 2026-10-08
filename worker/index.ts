import shortLinks from "../src/config/short-links.json";

const CDN_ORIGIN = "https://cards-cdn.gtbro.vip";
const JSON_PROXY_URLS = new Map([
  ["/json/allcards.json", `${CDN_ORIGIN}/json/allcards.json`],
  ["/json/mycards.json", `${CDN_ORIGIN}/json/mycards.json`],
  ["/json/mydata.json", `${CDN_ORIGIN}/json/mydata.json`],
  ["/json/myissuers.json", `${CDN_ORIGIN}/json/myissuers.json`],
  ["/json/allissuers.json", `${CDN_ORIGIN}/json/allissuers.json`],
  ["/json/bin-overlays.json", `${CDN_ORIGIN}/json/bin-overlays.json`],
]);
function corsHeaders(): Headers {
  return new Headers({
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "access-control-allow-origin": "*",
  });
}

async function proxyResponse(
  request: Request,
  sourceUrl: string,
  cacheControl: string,
): Promise<Response> {
  const upstream = await fetch(sourceUrl, {
    method: request.method,
  });
  const headers = new Headers(upstream.headers);
  corsHeaders().forEach((value, key) => headers.set(key, value));
  headers.set("cache-control", cacheControl);
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

function methodNotAllowed() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "GET, HEAD, OPTIONS" },
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
        return proxyResponse(request, jsonSourceUrl, "public, max-age=300");
      }
      return methodNotAllowed();
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
