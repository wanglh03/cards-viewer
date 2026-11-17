import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const origin = (
  process.env.DOCS_CDN_ORIGIN || "https://cards-cdn.gtbro.vip"
).replace(/\/+$/, "");
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const cacheDir = resolve(projectRoot, ".docs-cache");

function encodePath(file) {
  return file.split("/").map(encodeURIComponent).join("/");
}

const indexUrl = `${origin}/docs/index.json`;
const indexResponse = await fetch(indexUrl);
if (!indexResponse.ok) {
  throw new Error(
    `[docs] failed to load ${indexUrl}: HTTP ${indexResponse.status}`,
  );
}
const manifest = await indexResponse.json();
const docs = Array.isArray(manifest) ? manifest : manifest?.docs;
if (!Array.isArray(docs) || docs.length === 0) {
  throw new Error(`[docs] ${indexUrl} does not contain any documents`);
}

await rm(cacheDir, { recursive: true, force: true });
let count = 0;
for (const doc of docs) {
  if (!doc || typeof doc.file !== "string" || !doc.file) {
    throw new Error("[docs] manifest entry is missing a file path");
  }
  const target = resolve(cacheDir, doc.file);
  if (!target.startsWith(`${cacheDir}${sep}`)) {
    throw new Error(`[docs] unsafe path in manifest: ${doc.file}`);
  }
  const url = `${origin}/docs/${encodePath(doc.file)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `[docs] failed to load ${doc.file}: HTTP ${response.status}`,
    );
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, await response.text(), "utf8");
  count += 1;
}

console.log(`[docs] synced ${count} MDX files from ${origin}/docs`);
