function decodePathPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getObjectKey(params) {
  const rawPath = Array.isArray(params.path) ? params.path : [params.path];
  const parts = rawPath.filter(Boolean).map(decodePathPart);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) {
    return null;
  }
  return parts.join("/");
}

function responseHeaders(object) {
  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType || "application/octet-stream",
  );
  headers.set("Content-Length", String(object.size));
  headers.set("Cache-Control", "public, max-age=86400");
  if (object.httpEtag) headers.set("ETag", object.httpEtag);
  return headers;
}

export async function onRequest({ request, env, params }) {
  if (!env.CARDS_IMAGES) {
    return new Response("CARDS_IMAGES binding is not configured", { status: 503 });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const key = getObjectKey(params);
  if (!key || key.includes("\\") || key.includes("..")) {
    return new Response("Invalid object key", { status: 400 });
  }

  const object =
    request.method === "HEAD"
      ? await env.CARDS_IMAGES.head(key)
      : await env.CARDS_IMAGES.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(request.method === "HEAD" ? null : object.body, {
    headers: responseHeaders(object),
  });
}
