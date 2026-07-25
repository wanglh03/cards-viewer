const ISSUER_INFO_KEY = "issuer-info.json";
const CHANGE_LOG_KEY = "changeLog.json";
const KV_READ_TIMEOUT_MS = 8000;
const MAX_EDIT_BODY_BYTES = 64 * 1024;
const R2_IMAGE_PREFIXES = ["issuers/", "logo/"];
const EDITABLE_CARD_FIELDS = new Set([
  "name",
  "issuer",
  "organization",
  "tier",
  "type",
  "bin",
  "desc",
  "benefit",
  "ftf",
  "length",
  "currency",
]);
type WorkerEnv = Env & {
  TURNSTILE_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
};

function corsHeaders(): Headers {
  return new Headers({
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, HEAD, OPTIONS, PUT",
    "access-control-allow-origin": "*",
  });
}

function jsonResponse(value: unknown, status = 200, cacheControl = "no-store"): Response {
  const headers = corsHeaders();
  headers.set("cache-control", cacheControl);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(value), { status, headers });
}

function getR2Key(pathname: string): string | null {
  try {
    const decodedKey = decodeURIComponent(pathname.replace(/^\/+/, ""));
    if (!R2_IMAGE_PREFIXES.some((prefix) => decodedKey.startsWith(prefix))) {
      return null;
    }
    if (!decodedKey || decodedKey.includes("..") || decodedKey.includes("\\")) {
      return null;
    }
    return decodedKey;
  } catch {
    return null;
  }
}

function contentTypeForKey(key: string): string | null {
  const extension = key.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    avif: "image/avif",
    gif: "image/gif",
    ico: "image/x-icon",
    jfif: "image/jpeg",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    svg: "image/svg+xml",
    webp: "image/webp",
  };
  return extension ? types[extension] || null : null;
}

async function serveR2Image(
  request: Request,
  bucket: R2Bucket,
  key: string,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  const object = await bucket.get(key);
  if (!object) return new Response("Not Found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.has("content-type")) {
    const contentType = contentTypeForKey(key);
    if (contentType) headers.set("content-type", contentType);
  }
  if (Number.isFinite(object.size)) headers.set("content-length", String(object.size));
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  headers.set("access-control-allow-origin", "*");
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(request.method === "HEAD" ? null : object.body, {
    headers,
  });
}

async function serveIssuerInfo(kv: KVNamespace): Promise<Response> {
  try {
    const value = await Promise.race([
      kv.get(ISSUER_INFO_KEY),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("KV read timed out")),
          KV_READ_TIMEOUT_MS,
        );
      }),
    ]);
    if (value === null) return new Response("Not Found", { status: 404, headers: corsHeaders() });

    const headers = corsHeaders();
    headers.set("cache-control", "no-store");
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(value, {
      headers,
    });
  } catch (error) {
    console.error("KV issuer info read failed", error);
    const headers = corsHeaders();
    headers.set("cache-control", "no-store");
    return new Response("KV unavailable", {
      status: 503,
      headers,
    });
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeFilename(name: string): string {
  return String(name || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(value);
}

function getStoredImageKey(
  issuerKey: string,
  region: string,
  card: Record<string, unknown>,
): string | null {
  let reference = typeof card.image === "string" ? card.image.trim() : "";
  if (!reference && typeof card.ext === "string" && card.ext.trim()) {
    reference = `${sanitizeFilename(String(card.name || ""))}.${card.ext.replace(/^\./, "")}`;
  }
  if (!reference) return null;

  try {
    if (/^https?:\/\//i.test(reference)) {
      reference = new URL(reference).pathname;
    }
    reference = decodeURIComponent(reference)
      .replace(/^\/+/, "")
      .replace(/^assets\//i, "");
  } catch {
    return null;
  }
  const issuerFolder = [region, issuerKey].filter(Boolean).join("/");
  const relativePath = reference.includes("/")
    ? reference
    : [issuerFolder, reference].filter(Boolean).join("/");
  const key = reference.startsWith("issuers/")
    ? reference
    : `issuers/${relativePath}`;
  return R2_IMAGE_PREFIXES.some((prefix) => key.startsWith(prefix)) ? key : null;
}

function renamedImageKey(oldKey: string, newName: string): string | null {
  const slash = oldKey.lastIndexOf("/");
  const dot = oldKey.lastIndexOf(".");
  if (slash < 0 || dot <= slash + 1) return null;
  return `${oldKey.slice(0, slash + 1)}${sanitizeFilename(newName)}${oldKey.slice(dot)}`;
}

function updateImageReference(
  reference: string,
  newKey: string,
): string {
  if (reference.startsWith("/")) return `/${newKey}`;
  if (/^https?:\/\//i.test(reference)) return newKey;
  if (reference.replace(/^\/+/, "").startsWith("assets/")) return `assets/${newKey}`;
  if (reference.replace(/^\/+/, "").startsWith("issuers/")) return newKey;
  return newKey.slice(newKey.lastIndexOf("/") + 1);
}

function collectIssuerNames(issuerDocument: Record<string, unknown>): Set<string> {
  const names = new Set<string>();
  Object.values(issuerDocument).forEach((value) => {
    if (!isPlainObject(value)) return;
    const bank = isPlainObject(value.bank) ? value.bank : null;
    for (const name of [bank?.native_name, bank?.english_name]) {
      if (typeof name === "string" && name.trim()) names.add(name.trim());
    }
    if (!Array.isArray(value.cards)) return;
    value.cards.forEach((entry) => {
      const card = isPlainObject(entry) && isPlainObject(entry.card) ? entry.card : entry;
      if (!isPlainObject(card)) return;
      if (typeof card.issuer === "string" && card.issuer.trim()) names.add(card.issuer.trim());
    });
  });
  return names;
}

function getRequestIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",", 1)[0]?.trim() ||
    "unknown";
}

function getCardChanges(
  oldCard: Record<string, unknown>,
  newCard: Record<string, unknown>,
): Record<string, { before: unknown; after: unknown }> {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([...Object.keys(oldCard), ...Object.keys(newCard)]);
  keys.forEach((key) => {
    const before = oldCard[key];
    const after = newCard[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) changes[key] = { before, after };
  });
  return changes;
}

async function appendChangeLog(
  kv: KVNamespace,
  entry: Record<string, unknown>,
): Promise<void> {
  const raw = await kv.get(CHANGE_LOG_KEY);
  let entries: Record<string, unknown>[] = [];
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) entries = parsed.filter(isPlainObject);
    else if (isPlainObject(parsed) && Array.isArray(parsed.entries)) {
      entries = parsed.entries.filter(isPlainObject);
    }
  }
  const lastTimestamp = entries.length ? Date.parse(String(entries[entries.length - 1].timestamp || "")) : NaN;
  const timestamp = new Date(Math.max(Date.now(), Number.isFinite(lastTimestamp) ? lastTimestamp + 1 : 0)).toISOString();
  entries.push({ ...entry, timestamp });
  entries.sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
  await kv.put(CHANGE_LOG_KEY, JSON.stringify(entries));
}

async function updateIssuerInfo(request: Request, env: WorkerEnv): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_EDIT_BODY_BYTES) {
    return jsonResponse({ error: "Request body is too large" }, 413);
  }

  let payload: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_EDIT_BODY_BYTES) {
      return jsonResponse({ error: "Request body is too large" }, 413);
    }
    payload = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (
    !isPlainObject(payload) ||
    typeof payload.issuerKey !== "string" ||
    typeof payload.turnstileToken !== "string" ||
    !isPlainObject(payload.patch)
  ) {
    return jsonResponse({ error: "issuerKey, turnstileToken and patch are required" }, 400);
  }
  const turnstileSecret = env.TURNSTILE_SECRET || env.TURNSTILE_SECRET_KEY;
  if (!turnstileSecret) {
    return jsonResponse({ error: "Turnstile is not configured" }, 503);
  }
  if (!(await verifyTurnstile(request, payload.turnstileToken, turnstileSecret))) {
    return jsonResponse({ error: "Bot verification failed" }, 403);
  }
  const issuerKey = payload.issuerKey.trim();
  const cardName = typeof payload.cardName === "string" ? payload.cardName : "";
  const cardIndex = Number.isInteger(payload.cardIndex) ? Number(payload.cardIndex) : -1;
  if (!issuerKey || issuerKey.length > 200 || cardName.length > 500 || cardIndex < -1) {
    return jsonResponse({ error: "Invalid card identifier" }, 400);
  }

  const patch = payload.patch;
  const patchKeys = Object.keys(patch);
  if (!patchKeys.length || patchKeys.some((key) => !EDITABLE_CARD_FIELDS.has(key))) {
    return jsonResponse({ error: "Unsupported card field" }, 400);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (key === "currency") {
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length > 50)) {
        return jsonResponse({ error: `Invalid value for ${key}` }, 400);
      }
      continue;
    }
    if (typeof value !== "string" || value.length > 5000) {
      return jsonResponse({ error: `Invalid value for ${key}` }, 400);
    }
  }
  if (typeof patch.name === "string" && !patch.name.trim()) {
    return jsonResponse({ error: "Card name cannot be empty" }, 400);
  }

  let document: unknown;
  try {
    const value = await env.KV.get(ISSUER_INFO_KEY);
    if (!value) return jsonResponse({ error: "Issuer info not found" }, 404);
    document = JSON.parse(value);
  } catch (error) {
    console.error("KV issuer info update read failed", error);
    return jsonResponse({ error: "KV unavailable" }, 503);
  }
  if (!isPlainObject(document)) {
    return jsonResponse({ error: "Issuer data is invalid" }, 422);
  }
  let issuerDocument = document;
  for (const wrapper of ["issuerInfo", "issuers"]) {
    if (isPlainObject(document[wrapper])) {
      issuerDocument = document[wrapper];
      break;
    }
  }
  if (!isPlainObject(issuerDocument[issuerKey])) {
    return jsonResponse({ error: "Issuer not found" }, 404);
  }

  const issuer = issuerDocument[issuerKey];
  if (!Array.isArray(issuer.cards)) return jsonResponse({ error: "Issuer cards not found" }, 404);
  const issuerBank = isPlainObject(issuer.bank) ? issuer.bank : {};
  const issuerRegion = typeof issuerBank.region === "string" ? issuerBank.region.trim() : "";
  if (typeof patch.issuer === "string" && !collectIssuerNames(issuerDocument).has(patch.issuer.trim())) {
    return jsonResponse({ error: "Issuer must match an existing issuer" }, 422);
  }
  let targetIndex = cardIndex >= 0 && cardIndex < issuer.cards.length ? cardIndex : -1;
  const entryAtIndex = targetIndex >= 0 ? issuer.cards[targetIndex] : null;
  const cardAtIndex = isPlainObject(entryAtIndex) && isPlainObject(entryAtIndex.card)
    ? entryAtIndex.card
    : isPlainObject(entryAtIndex) ? entryAtIndex : null;
  if (targetIndex < 0 || (cardName && cardAtIndex?.name !== cardName)) {
    targetIndex = issuer.cards.findIndex((entry) => {
      const card = isPlainObject(entry) && isPlainObject(entry.card)
        ? entry.card
        : isPlainObject(entry) ? entry : null;
      return card?.name === cardName;
    });
  }
  if (targetIndex < 0) return jsonResponse({ error: "Card not found" }, 404);

  const entry = issuer.cards[targetIndex];
  const card = isPlainObject(entry) && isPlainObject(entry.card)
    ? entry.card
    : isPlainObject(entry) ? entry : null;
  if (!card) return jsonResponse({ error: "Card data is invalid" }, 422);
  const oldCard = cloneRecord(card);
  const oldImageReference = typeof card.image === "string" ? card.image : "";
  let oldImageKey: string | null = null;
  let newImageKey: string | null = null;
  if (typeof patch.name === "string" && patch.name !== String(card.name || "")) {
    oldImageKey = getStoredImageKey(issuerKey, issuerRegion, card);
    newImageKey = oldImageKey ? renamedImageKey(oldImageKey, patch.name) : null;
    if (oldImageKey && newImageKey && oldImageKey !== newImageKey) {
      const sourceExists = await env.R2.head(oldImageKey);
      if (sourceExists) {
        if (await env.R2.head(newImageKey)) {
          return jsonResponse({ error: "The new R2 image name already exists" }, 409);
        }
        const source = await env.R2.get(oldImageKey);
        if (!source) return jsonResponse({ error: "R2 image disappeared during rename" }, 503);
        try {
          await env.R2.put(newImageKey, source.body, {
            httpMetadata: source.httpMetadata,
            customMetadata: source.customMetadata,
          });
        } catch (error) {
          console.error("R2 image rename failed", error);
          return jsonResponse({ error: "R2 image rename failed" }, 503);
        }
      } else {
        oldImageKey = null;
        newImageKey = null;
      }
    }
  }
  Object.assign(card, patch);
  if (oldImageKey && newImageKey && oldImageReference) {
    card.image = updateImageReference(oldImageReference, newImageKey);
  }
  const newCard = cloneRecord(card);

  try {
    await env.KV.put(ISSUER_INFO_KEY, JSON.stringify(document));
  } catch (error) {
    console.error("KV issuer info update write failed", error);
    return jsonResponse({ error: "KV write failed" }, 503);
  }
  try {
    await appendChangeLog(env.KV, {
      ip: getRequestIp(request),
      issuerKey,
      cardIndex: targetIndex,
      cardName: String(newCard.name || oldCard.name || cardName),
      oldInfo: oldCard,
      newInfo: newCard,
      changes: getCardChanges(oldCard, newCard),
    });
  } catch (error) {
    console.error("KV change log write failed", error);
    return jsonResponse({ error: "Change log write failed" }, 503);
  }
  if (oldImageKey && newImageKey) {
    try {
      await env.R2.delete(oldImageKey);
    } catch (error) {
      console.error("Old R2 image cleanup failed", error);
    }
  }
  return jsonResponse({
    ok: true,
    issuerKey,
    cardIndex: targetIndex,
    imageRenamed: Boolean(oldImageKey && newImageKey),
    card,
  });
}

async function verifyTurnstile(request: Request, token: string, secret: string): Promise<boolean> {
  if (!token || token.length > 4096) return false;
  try {
    const remoteIp = request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For")?.split(",", 1)[0]?.trim() ||
      "";
    const body = new URLSearchParams({
      secret,
      response: token,
      remoteip: remoteIp,
    });
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean };
    return result.success === true;
  } catch (error) {
    console.error("Turnstile verification failed", error);
    return false;
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const r2Key = getR2Key(url.pathname);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === "/api/issuer-info") {
      if (request.method !== "PUT") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
      }
      return updateIssuerInfo(request, env);
    }

    if (url.pathname === "/js/generated/issuer-info.json") {
      return serveIssuerInfo(env.KV);
    }

    const shortLinkMatch = url.pathname.match(/^\/s\/([^/]+)\/?$/);
    if (shortLinkMatch && shortLinkMatch[1] !== "index.html") {
      const shortLinkUrl = new URL(request.url);
      shortLinkUrl.pathname = "/s/index.html";
      shortLinkUrl.search = `?key=${encodeURIComponent(shortLinkMatch[1])}`;
      return env.ASSETS.fetch(new Request(shortLinkUrl, request));
    }

    if (r2Key) {
      return serveR2Image(request, env.R2, r2Key);
    }

    return env.ASSETS.fetch(request);
  },
};
