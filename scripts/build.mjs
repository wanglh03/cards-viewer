import {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const HTML_FILES = ["index.html", "collection.html", "credit.html", "bin.html", "withdrawal.html", "luhn.html", "embed.html"];
const SHORT_LINK_MARKER = "<!-- cards-viewer-short-link -->";

const readText = (file) => readFile(file, "utf8");
const readJson = async (file) => JSON.parse(await readText(file).then((value) => value.replace(/^\uFEFF/, "")));

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(file)));
    else files.push(file);
  }
  return files;
}

function jsonPayload(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function normalizeOrigin(value) {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

function encodeUrl(value) {
  const url = String(value).trim();
  try {
    return encodeURI(url);
  } catch {
    return url.replace(/\s/g, "%20");
  }
}

function renderInline(value) {
  const images = [];
  const source = String(value).trim().replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (_, alt, destination) => {
    let src = destination.trim();
    let title = "";
    const titleMatch = src.match(/^(.*)\s+["']([^"']*)["']$/);
    if (titleMatch) {
      src = titleMatch[1].trim();
      title = titleMatch[2];
    }
    const width = alt.match(/^w:(\d+(?:\.\d+)?)px$/i);
    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
    const widthAttribute = width ? ` style="width: ${width[1]}px"` : "";
    const imageAlt = width ? "" : alt;
    images.push(`<img src="${escapeHtml(encodeUrl(src))}" alt="${escapeHtml(imageAlt)}"${widthAttribute}${titleAttribute} loading="lazy" decoding="async" />`);
    return `@@markdown-image-${images.length - 1}@@`;
  });
  const codeSpans = [];
  let rendered = escapeHtml(source);
  rendered = rendered.replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `@@markdown-code-${codeSpans.length - 1}@@`;
  });
  rendered = rendered.replace(/&lt;br\s*\/?&gt;/gi, "<br />");
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  rendered = rendered.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const encodedHref = encodeUrl(href);
    const external = /^(https?:)?\/\/|^\/s\//i.test(href);
    const className = external ? ' class="external-link"' : "";
    return `<a${className} href="${encodedHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  rendered = rendered.replace(/(?<!["=])(https?:\/\/[^\s<]+)/g, (url) =>
    `<a class="external-link" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  );
  rendered = rendered.replace(/@@markdown-image-(\d+)@@/g, (_, index) => images[Number(index)]);
  return rendered.replace(/@@markdown-code-(\d+)@@/g, (_, index) => codeSpans[Number(index)]);
}

function splitTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return null;
  const normalized = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return normalized.split("|").map((cell) => cell.trim());
}

function tableSeparator(line) {
  const cells = splitTableRow(line);
  return Boolean(cells?.length) && cells.every((cell) => /^:?-+:?$/.test(cell));
}

function tableAlignment(cell) {
  if (cell.startsWith(":") && cell.endsWith(":")) return "center";
  if (cell.endsWith(":")) return "right";
  if (cell.startsWith(":")) return "left";
  return "";
}

function renderTableSection(rows, tagName, alignments) {
  const columnCount = Math.max(alignments.length, ...rows.map((row) => row.length), 0);
  const activeColumns = Array(columnCount).fill(null);
  const renderedRows = [];

  for (const row of rows) {
    const rowCoverage = Array(columnCount).fill(null);
    const visibleCells = [];
    for (let index = 0; index < columnCount; index += 1) {
      const cell = (row[index] || "").trim();
      const leftCell = rowCoverage[index - 1];
      if (cell === "<" && leftCell) {
        leftCell.colspan += 1;
        rowCoverage[index] = leftCell;
        continue;
      }
      if (cell === "^" && activeColumns[index]) {
        activeColumns[index].rowspan += 1;
        rowCoverage[index] = activeColumns[index];
        continue;
      }
      const align = alignments[index] ? ` class="align-${alignments[index]}"` : "";
      const state = { align, colspan: 1, rowspan: 1, content: renderInline(cell), tagName };
      visibleCells.push(state);
      rowCoverage[index] = state;
    }
    activeColumns.splice(0, activeColumns.length, ...rowCoverage);
    renderedRows.push(visibleCells);
  }
  return renderedRows.map((row) => `<tr>${row.map((cell) => {
      const colspan = cell.colspan > 1 ? ` colspan="${cell.colspan}"` : "";
      const rowspan = cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : "";
      return `<${cell.tagName}${cell.align}${colspan}${rowspan}>${cell.content}</${cell.tagName}>`;
    }).join("")}</tr>`).join("");
}

function renderTable(lines, startIndex) {
  if (startIndex + 1 >= lines.length) return null;
  const headerCells = splitTableRow(lines[startIndex]);
  if (!headerCells || !tableSeparator(lines[startIndex + 1])) return null;
  const alignments = splitTableRow(lines[startIndex + 1]).map(tableAlignment);
  const bodyRows = [];
  let index = startIndex + 2;
  while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
    const row = splitTableRow(lines[index]);
    if (!row) break;
    bodyRows.push(row);
    index += 1;
  }
  const hasHeader = headerCells.some((cell) => cell.trim());
  const header = hasHeader ? `<thead>${renderTableSection([headerCells], "th", alignments)}</thead>` : "";
  return [
    `<div class="markdown-table-wrap"><table class="markdown-table">${header}<tbody>${renderTableSection(bodyRows, "td", alignments)}</tbody></table></div>`,
    index,
  ];
}

function markdownToHtml(markdown) {
  const blocks = [];
  const paragraph = [];
  const listItems = [];
  let listTag = null;
  const tocItems = [];
  const lines = markdown.split(/\r?\n/);
  let skippedFirstTitle = false;
  const headingNumbers = Array(6).fill(0);

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const content = paragraph.join(" ").trim();
    if (content) blocks.push(`<p>${renderInline(content)}</p>`);
    paragraph.length = 0;
  };
  const flushList = () => {
    if (!listItems.length) {
      listTag = null;
      return;
    }
    const items = listItems.filter((item) => item.trim()).map((item) => `<li>${renderInline(item)}</li>`).join("");
    if (items) blocks.push(`<${listTag || "ul"}>${items}</${listTag || "ul"}>`);
    listItems.length = 0;
    listTag = null;
  };

  for (let index = 0; index < lines.length;) {
    const stripped = lines[index].trim();
    if (!stripped) {
      flushParagraph();
      flushList();
      index += 1;
      continue;
    }
    const table = renderTable(lines, index);
    if (table) {
      flushParagraph();
      flushList();
      blocks.push(table[0]);
      index = table[1];
      continue;
    }
    if (/^(?:- |\* )/.test(stripped)) {
      flushParagraph();
      if (listTag !== "ul") flushList();
      listTag = "ul";
      listItems.push(stripped.slice(2));
      index += 1;
      continue;
    }
    const ordered = stripped.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      if (listTag !== "ol") flushList();
      listTag = "ol";
      listItems.push(ordered[1]);
      index += 1;
      continue;
    }
    const heading = stripped.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      if (!skippedFirstTitle && level === 1) {
        skippedFirstTitle = true;
        index += 1;
        continue;
      }
      headingNumbers[level - 1] += 1;
      for (let number = level; number < headingNumbers.length; number += 1) headingNumbers[number] = 0;
      const numbering = headingNumbers.slice(0, level).filter(Boolean).join(".");
      const displayText = `${numbering} ${heading[2].trim()}`;
      const id = displayText.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `section-${tocItems.length + 1}`;
      tocItems.push({ level, id, text: displayText });
      blocks.push(`<h${level} id="${id}">${renderInline(displayText)}</h${level}>`);
      index += 1;
      continue;
    }
    paragraph.push(stripped);
    index += 1;
  }
  flushParagraph();
  flushList();
  const toc = tocItems.length
    ? `<nav class="markdown-toc" aria-label="页面目录"><div class="markdown-toc-card"><p class="markdown-toc-title">目录</p><ol>${tocItems.map((item) => `<li class="markdown-toc-item level-${item.level}"><a href="#${item.id}">${escapeHtml(item.text)}</a></li>`).join("")}</ol></div></nav>`
    : "";
  return { content: blocks.join("\n"), toc };
}

function parseFrontMatter(markdown) {
  const match = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return { content: markdown, metadata: {} };
  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (["author", "date"].includes(key) && value) metadata[key] = value;
  }
  return { content: markdown.slice(match[0].length).trimStart(), metadata };
}

function formatTemplate(template, values) {
  let result = template;
  for (const [key, value] of Object.entries(values)) result = result.replaceAll(`{${key}}`, value ?? "");
  return result.replaceAll("{{", "{").replaceAll("}}", "}");
}

function relativePrefix(outputPath) {
  const relativeParent = path.relative(DIST, path.dirname(outputPath));
  const depth = relativeParent ? relativeParent.split(path.sep).length : 0;
  return "../".repeat(depth);
}

function documentTitle(markdown, fallback) {
  const title = markdown.split(/\r?\n/).find((line) => line.trim().startsWith("#"));
  return title ? title.trim().replace(/^#+\s*/, "") : fallback;
}

function parseDate(value) {
  const match = String(value || "").match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2] || 1) - 1, Number(match[3] || 1))) : null;
}

function renderDocumentTimeline(entries) {
  entries.sort((a, b) => {
    if (Boolean(a.date) !== Boolean(b.date)) return a.date ? -1 : 1;
    if (a.date && b.date && a.date.getTime() !== b.date.getTime()) return b.date - a.date;
    return b.title.localeCompare(a.title);
  });
  const years = new Map();
  for (const entry of entries) {
    const year = entry.date ? String(entry.date.getUTCFullYear()) : "未标注日期";
    const month = entry.date ? `${String(entry.date.getUTCMonth() + 1).padStart(2, "0")}月` : "未标注月份";
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(entry);
  }
  return [...years].map(([year, months]) => `<section class="docs-timeline-year"><h2 class="docs-timeline-year-title">${escapeHtml(year)}</h2><div class="docs-timeline-year-content">${[...months].map(([month, monthEntries]) => `<section class="docs-timeline-month"><h3 class="docs-timeline-month-title">${escapeHtml(month)}</h3><ol class="docs-timeline-entries">${monthEntries.map((entry) => `<li class="docs-timeline-entry"><a class="docs-timeline-link" href="${escapeHtml(entry.href)}"><time class="docs-timeline-date">${escapeHtml(entry.dateText)}</time><span class="docs-timeline-title">${escapeHtml(entry.title)}</span></a></li>`).join("")}</ol></section>`).join("")}</div></section>`).join("");
}

async function loadMycards() {
  const root = path.join(ROOT, "assets", "mycards");
  const files = (await filesIn(root)).filter((file) => file.toLowerCase().endsWith(".json"));
  const mycards = {};
  for (const file of files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))) {
    const value = await readJson(file);
    const issuer = path.basename(file, ".json");
    if (!value || !Array.isArray(value.cards)) throw new Error(`${file} must contain a cards array`);
    if (mycards[issuer]) throw new Error(`Duplicate mycards issuer name: ${issuer}`);
    mycards[issuer] = {
      ...(value.issuer && typeof value.issuer === "object" && !Array.isArray(value.issuer)
        ? { issuer: value.issuer }
        : {}),
      cards: value.cards.filter((card) => card && card.name),
    };
  }
  return mycards;
}

async function loadSiteData() {
  const config = (name) => path.join(ROOT, "config", name);
  return {
    generatedAt: new Date().toISOString(),
    mycards: await loadMycards(),
    navigation: await readJson(config("navigation.json")),
    footerLinks: await readJson(config("footer-links.json")),
    binOverlays: await readJson(config("bin-overlays.json")),
    regions: await readJson(config("regions.json")),
  };
}

async function writeSiteData(siteData) {
  const generated = path.join(DIST, "js", "generated");
  await mkdir(generated, { recursive: true });
  await writeFile(path.join(generated, "mycards.json"), `${jsonPayload(siteData.mycards)}\n`);
  const clientData = { ...siteData };
  delete clientData.mycards;
  const dataOrigin = normalizeOrigin(process.env.CARDS_VIEWER_DATA_ORIGIN?.trim());
  clientData.issuerInfoUrl = dataOrigin
    ? `${dataOrigin}/js/generated/issuer-info.json`
    : "js/generated/issuer-info.json";
  clientData.issuerInfoEditUrl = dataOrigin
    ? `${dataOrigin}/api/issuer-info`
    : "api/issuer-info";
  if (dataOrigin) clientData.assetOrigin = dataOrigin;
  clientData.mycardsUrl = "js/generated/mycards.json";
  await writeFile(path.join(generated, "site-data.js"), `window.__CARDS_VIEWER_DATA__ = ${jsonPayload(clientData)};\n`);
}

async function writeMarkdownPage(sourcePath, outputPath, page) {
  const raw = await readText(sourcePath);
  const { content: markdown, metadata } = parseFrontMatter(raw);
  const { content, toc } = markdownToHtml(markdown);
  const title = documentTitle(markdown, path.basename(sourcePath, path.extname(sourcePath)));
  const metadataItems = [metadata.author ? `作者：${escapeHtml(metadata.author)}` : "", metadata.date ? `日期：${escapeHtml(metadata.date)}` : ""].filter(Boolean);
  const prefix = relativePrefix(outputPath);
  const template = await readText(path.join(ROOT, "templates", "doc-page.html"));
  const html = formatTemplate(template, {
    title: escapeHtml(title),
    page,
    base_path: prefix,
    root_path: `${prefix}index.html`,
    content: content || '<p class="markdown-status">文件为空。</p>',
    toc,
    metadata: metadataItems.length ? `<div class="markdown-meta">${metadataItems.map((item) => `<span>${item}</span>`).join("")}</div>` : "",
  }).replace(`    <script src="${prefix}js/common.js"></script>`, `    <script src="${prefix}js/generated/site-data.js"></script>\n    <script src="${prefix}js/common.js"></script>`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html);
}

async function writeDocsIndex(entries) {
  const template = await readText(path.join(ROOT, "templates", "docs-index.html"));
  const html = template.replace("{timeline}", renderDocumentTimeline(entries));
  await writeFile(path.join(DIST, "docs", "index.html"), html);
}

async function writeShortLinks() {
  const raw = await readJson(path.join(ROOT, "config", "short-links.json"));
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("config/short-links.json must be an object");
  const links = {};
  for (const [rawKey, rawUrl] of Object.entries(raw)) {
    const key = String(rawKey).trim().replace(/^\/+|\/+$/g, "");
    const url = String(rawUrl).trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(key)) throw new Error(`Invalid short link key: ${rawKey}`);
    const relativeTarget = url.startsWith("/") && !url.startsWith("//");
    if (!relativeTarget) {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname) throw new Error(`Invalid short link target: ${key}`);
    }
    links[key] = url;
  }
  const content = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8" /><meta name="robots" content="noindex" /><title>Redirecting</title></head><body><p>Redirecting...</p><script>${SHORT_LINK_MARKER}
const shortLinks = ${jsonPayload(links)};
const path = window.location.pathname.replace(/\\/+$/, "");
const match = path.match(/^(.*)\\/s\\/([^/]+)$/);
const queryKey = new URLSearchParams(window.location.search).get("key");
let key = "";
try { key = queryKey || (match ? decodeURIComponent(match[2]) : ""); } catch { key = ""; }
const target = shortLinks[key];
if (target) window.location.replace(target);
else window.location.replace((match ? match[1] || "" : "") + "/index.html");
  </script></body></html>`;
  await mkdir(path.join(DIST, "s"), { recursive: true });
  await writeFile(path.join(DIST, "s", "index.html"), content);
  await Promise.all(
    Object.keys(links).map(async (key) => {
      const directory = path.join(DIST, "s", key);
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, "index.html"), content);
      await writeFile(path.join(DIST, "s", `${key}.html`), content);
    }),
  );
}

export async function build() {
  await mkdir(DIST, { recursive: true });
  for (const entry of await readdir(DIST)) {
    try {
      await rm(path.join(DIST, entry), { recursive: true, force: true });
    } catch (error) {
      if (error.code !== "EBUSY" && error.code !== "EPERM") throw error;
      console.warn(`Could not remove locked dist entry: ${entry}`);
    }
  }
  for (const directory of ["assets", "css", "js"]) {
    await cp(path.join(ROOT, directory), path.join(DIST, directory), { recursive: true });
  }
  const siteData = await loadSiteData();
  await writeSiteData(siteData);
  for (const name of HTML_FILES) {
    let html = await readText(path.join(ROOT, "html", name));
    html = html.replace("    <script src=\"js/common.js\"></script>", "    <script src=\"js/generated/site-data.js\"></script>\n    <script src=\"js/common.js\"></script>");
    await writeFile(path.join(DIST, name), html);
  }
  await writeMarkdownPage(path.join(ROOT, "docs", "link.md"), path.join(DIST, "link.html"), "link");
  const entries = [];
  for (const file of (await filesIn(path.join(ROOT, "docs"))).filter((item) => item.endsWith(".md"))) {
    if (path.basename(file) === "link.md") continue;
    const raw = await readText(file);
    const { content, metadata } = parseFrontMatter(raw);
    const relative = path.relative(ROOT, file).replaceAll(path.sep, "/");
    const outputPath = path.join(DIST, relative.replace(/\.md$/, ".html"));
    await writeMarkdownPage(file, outputPath, relative === "docs/about.md" ? "about" : "doc");
    const date = parseDate(metadata.date);
    entries.push({ title: documentTitle(content, path.basename(file, ".md")), date, dateText: metadata.date || "未标注日期", href: path.relative(path.join(DIST, "docs"), outputPath).replaceAll(path.sep, "/") });
  }
  await writeDocsIndex(entries);
  await writeShortLinks();
  console.log(`Built ${path.relative(ROOT, DIST)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href && process.argv.includes("--watch")) {
  let timer;
  let building = false;
  let pending = false;
  const rebuild = async () => {
    if (building) {
      pending = true;
      return;
    }
    building = true;
    try { await build(); } finally {
      building = false;
      if (pending) {
        pending = false;
        rebuild();
      }
    }
  };
  await rebuild();
  const watcher = (await import("node:fs")).watch(ROOT, { recursive: true }, (_, fileName) => {
    let relative = String(fileName || "");
    if (path.isAbsolute(relative)) relative = path.relative(ROOT, relative);
    relative = relative.replaceAll("\\", "/");
    if (!relative || relative === "dist" || relative.startsWith("dist/") || relative.startsWith("node_modules/") || relative.startsWith(".git/") || relative.startsWith(".wrangler/") || relative.startsWith(".wrangler-config/")) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 150);
  });
  process.on("SIGINT", () => { watcher.close(); process.exit(0); });
} else if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await build();
}
