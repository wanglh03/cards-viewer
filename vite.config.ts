import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@mdx-js/rollup";
import { defineConfig } from "vite";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMarkdownImageAlt, resolveMarkdownImageSrc } from "./src/lib/markdown.js";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const docsRoot = resolve(projectRoot, "../cards-assets/docs");
const categoryPrefix = /^(\d+)[-_.\s]+/;

const normalizePath = (value: string) => value.replace(/\\/g, "/");

function firstHeading(source: string) {
  let fenced = false;
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = /^#\s+(.+?)\s*#*\s*$/.exec(trimmed);
    if (match) return match[1].replace(/[*_`]/g, "").trim();
  }
  return "";
}

/**
 * Docs live in the cards-assets project. The metadata needed by the docs index
 * comes from each file itself (folder = category, first heading = title), so
 * there is no separately maintained registry.
 */
const docsMetaPlugin = {
  name: "docs-meta",
  enforce: "pre" as const,
  buildStart() {
    if (!existsSync(docsRoot))
      this.error(`MDX docs directory not found: ${docsRoot}`);
  },
  transform(source: string, id: string) {
    const file = normalizePath(id).split("?")[0];
    if (!file.toLowerCase().endsWith(".mdx")) return;
    const pathInDocs = normalizePath(relative(docsRoot, file));
    if (!pathInDocs || pathInDocs.startsWith("..")) return;
    const segments = pathInDocs.split("/");
    const categoryFolder = segments.length > 1 ? segments[0] : "";
    const categoryMatch = categoryFolder.match(categoryPrefix);
    const category =
      (categoryMatch ? categoryFolder.slice(categoryMatch[0].length) : categoryFolder) ||
      "其他";
    const order = categoryMatch ? Number(categoryMatch[1]) : 999;
    const slug = basename(file, ".mdx");
    const title = firstHeading(source) || slug;
    const meta = { slug, title, category, order };
    return {
      code: `export const meta = ${JSON.stringify(meta)};\n\n${source}`,
      map: null,
    };
  },
};

const tableFallback = {
  name: "mdx-table-fallback",
  enforce: "pre" as const,
  transform(source: string, id: string) {
    if (!id.endsWith(".mdx")) return;
    const lines = source.split(/\r?\n/);
    const output: string[] = [];
    let changed = false;
    for (let index = 0; index < lines.length;) {
      if (!isTableLine(lines[index]) || !isTableLine(lines[index + 1] || "")) {
        output.push(lines[index]);
        index += 1;
        continue;
      }
      const start = index;
      while (index < lines.length && isTableLine(lines[index])) index += 1;
      output.push(pipeTableToHtml(lines.slice(start, index)));
      changed = true;
    }
    return changed ? { code: output.join("\n"), map: null } : undefined;
  },
};

function isTableLine(line: string) {
  const value = line.trim();
  return value.startsWith("|") && value.endsWith("|") && value.length > 2;
}

function parseTableRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

const tableSeparatorCell = /^:?-{1,}:?$/;

function isSeparatorRow(row: string[]) {
  return row.length > 0 && row.every((cell) => tableSeparatorCell.test(cell));
}

type HtmlTableCell = { value: string; row: number; col: number; alignment: "left" | "center" | "right"; rowspan: number; colspan: number };

function pipeTableToHtml(block: string[]) {
  const parsedRows = block.map(parseTableRow);
  const hasSeparator = isSeparatorRow(parsedRows[1] || []);
  const hasHeader = hasSeparator && (parsedRows[0] || []).some((cell) => cell !== "");
  const alignments = hasSeparator ? (parsedRows[1] || []).map(parseAlignment) : [];
  const header = hasHeader ? parsedRows[0] : [];
  const body = hasSeparator ? parsedRows.slice(2) : parsedRows;
  const rows = hasHeader ? [header, ...body] : body;
  const renderedRows = buildMergedRows(rows, alignments);
  const renderRow = (cells: HtmlTableCell[], tag: "th" | "td") => `<tr>${cells.map((cell) => {
    const span = `${cell.colspan > 1 ? ` colSpan="${cell.colspan}"` : ""}${cell.rowspan > 1 ? ` rowSpan="${cell.rowspan}"` : ""}`;
    return `<${tag}${span} data-align="${cell.alignment}">${inlineMarkdown(cell.value)}</${tag}>`;
  }).join("")}</tr>`;
  const headerHtml = hasHeader ? `<thead>${renderRow(renderedRows[0] || [], "th")}</thead>` : "";
  const bodyRows = hasHeader ? renderedRows.slice(1) : renderedRows;
  return `<table>${headerHtml}<tbody>${bodyRows.map((row) => renderRow(row, "td")).join("")}</tbody></table>`;
}

function parseAlignment(separator: string): "left" | "center" | "right" {
  const value = separator.trim();
  if (value.startsWith(":") && value.endsWith(":")) return "center";
  if (value.endsWith(":")) return "right";
  return "left";
}

function buildMergedRows(rows: string[][], alignments: Array<"left" | "center" | "right">) {
  const grid: Array<Array<HtmlTableCell | undefined>> = [];
  const renderedRows: HtmlTableCell[][] = [];
  rows.forEach((row, rowIndex) => {
    const rendered: HtmlTableCell[] = [];
    grid[rowIndex] ||= [];
    row.forEach((value, colIndex) => {
      const current = grid[rowIndex][colIndex];
      if (value === "^") {
        const above = grid[rowIndex - 1]?.[colIndex];
        if (above && current !== above) {
          above.rowspan += 1;
          grid[rowIndex][colIndex] = above;
        }
        return;
      }
      if (value === "<") {
        const left = grid[rowIndex][colIndex - 1];
        if (left) {
          left.colspan += 1;
          grid[rowIndex][colIndex] = left;
        }
        return;
      }
      if (current) return;
      const cell: HtmlTableCell = { value, row: rowIndex, col: colIndex, alignment: alignments[colIndex] || "left", rowspan: 1, colspan: 1 };
      grid[rowIndex][colIndex] = cell;
      rendered.push(cell);
    });
    renderedRows.push(rendered);
  });
  return renderedRows;
}

function inlineMarkdown(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, rawAlt, rawSrc) => {
      const image = parseMarkdownImageAlt(rawAlt);
      const src = resolveMarkdownImageSrc(rawSrc);
      const width = image.width ? ` style={{width: "${image.width}"}}` : "";
      return `<img className="markdown-image" src="${src}" alt="${image.alt}" loading="lazy"${width} />`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/&lt;br \/&gt;/g, "<br />");
}

const mdxPlugin: any = mdx();

const localPageData = {
  name: "local-page-data",
  configureServer(server: any) {
    const directory = process.env.CARDS_JSON_DIR;
    if (!directory) return;
    server.middlewares.use(async (request: any, response: any, next: () => void) => {
      const match = request.url?.split("?")[0].match(/^\/json\/(gallery|bin|withdrawal|my|wallet|collection|credit|myissuers)\.json$/);
      if (!match) return next();
      try {
        const body = await readFile(resolve(directory, `${match[1]}.json`));
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(body);
      } catch {
        response.statusCode = 404;
        response.end("Generated page data not found");
      }
    });
  },
};

export default defineConfig({
  plugins: [
    localPageData,
    docsMetaPlugin,
    tailwindcss(),
    tableFallback,
    mdxPlugin,
    react(),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssMinify: "esbuild",
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    fs: {
      allow: [projectRoot, resolve(projectRoot, ".."), docsRoot],
    },
    proxy: {
      "/export-logos": {
        target: "https://cards-cdn.gtbro.vip",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/export-logos\//, "/issuers/logo/"),
      },
      "/json": {
        target: "https://cards-cdn.gtbro.vip",
        changeOrigin: true,
      },
    },
  },
});
