import { siteData } from "./data";

export type DocEntry = {
  slug: string;
  title: string;
  category: string;
  order: number;
  file: string;
};

const CDN_ORIGIN = (
  siteData.assetOrigin || "https://cards-cdn.gtbro.vip"
).replace(/\/+$/, "");
const DOCS_PROXY = "/docs-data";

function encodeFilePath(file: string) {
  return file.split("/").map(encodeURIComponent).join("/");
}

/**
 * Load a file from the docs folder. In production the CDN is tried first (it
 * needs a CORS rule for the site origin); the Worker proxy is used as a
 * fallback. In development the Vite proxy is preferred to avoid a CORS error.
 */
async function fetchDocText(path: string) {
  const encoded = encodeFilePath(path);
  const cdnUrl = `${CDN_ORIGIN}/docs/${encoded}`;
  const proxyUrl = `${DOCS_PROXY}/${encoded}`;
  const urls = import.meta.env.DEV ? [proxyUrl, cdnUrl] : [cdnUrl, proxyUrl];
  let lastError: unknown;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json, text/plain, */*" },
        cache: path === "index.json" ? "no-store" : "default",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to load documentation");
}

let docsIndexPromise: Promise<DocEntry[]> | null = null;

export function loadDocsIndex() {
  if (!docsIndexPromise) {
    docsIndexPromise = fetchDocText("index.json")
      .then((text) => JSON.parse(text) as { docs?: unknown } | unknown[])
      .then((payload) => {
        const list = Array.isArray(payload) ? payload : payload?.docs;
        if (!Array.isArray(list)) throw new Error("Invalid docs manifest");
        return list
          .map((item) => {
            const value = item as Partial<DocEntry>;
            return {
              slug: String(value.slug || ""),
              title: String(value.title || value.slug || ""),
              category: String(value.category || "其他"),
              order: Number(value.order) || 999,
              file: String(value.file || ""),
            };
          })
          .filter((doc) => doc.slug && doc.file)
          .sort(
            (a, b) =>
              a.order - b.order ||
              a.title.localeCompare(b.title, "zh-Hans-CN"),
          );
      })
      .catch((error) => {
        docsIndexPromise = null;
        throw error;
      });
  }
  return docsIndexPromise;
}

const docSourceCache = new Map<string, Promise<string>>();

export function loadDocSource(file: string) {
  let promise = docSourceCache.get(file);
  if (!promise) {
    promise = fetchDocText(file).catch((error) => {
      docSourceCache.delete(file);
      throw error;
    });
    docSourceCache.set(file, promise);
  }
  return promise;
}
