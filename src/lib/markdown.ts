import { marked } from "marked";

const ASSET_ORIGIN = "https://cards-cdn.gtbro.vip";

export function parseMarkdownImageAlt(value: string) {
  const match = value.trim().match(/^w:(\d+(?:\.\d+)?)px$/i);
  return {
    alt: match ? "" : value,
    width: match ? `${match[1]}px` : undefined,
  };
}

export function resolveMarkdownImageSrc(value: string) {
  const source = value.trim();
  if (/^\/issuers\//i.test(source)) {
    return `${ASSET_ORIGIN}${encodeURI(source)}`;
  }
  return source;
}

function isTableLine(line: string) {
  const value = line.trim();
  return value.startsWith("|") && value.endsWith("|") && value.length > 2;
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

const tableSeparatorCell = /^:?-{1,}:?$/;

function isSeparatorRow(row: string[]) {
  return row.length > 0 && row.every((cell) => tableSeparatorCell.test(cell));
}

type HtmlTableCell = {
  value: string;
  row: number;
  col: number;
  alignment: "left" | "center" | "right";
  rowspan: number;
  colspan: number;
};

function parseAlignment(separator: string): "left" | "center" | "right" {
  const value = separator.trim();
  if (value.startsWith(":") && value.endsWith(":")) return "center";
  if (value.endsWith(":")) return "right";
  return "left";
}

function inlineMarkdown(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, rawAlt, rawSrc) => {
      const image = parseMarkdownImageAlt(rawAlt);
      const src = resolveMarkdownImageSrc(rawSrc);
      const width = image.width ? ` style="width: ${image.width}"` : "";
      return `<img class="markdown-image" src="${src}" alt="${image.alt}" loading="lazy"${width} />`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/&lt;br \/&gt;/g, "<br />");
}

function buildMergedRows(
  rows: string[][],
  alignments: Array<"left" | "center" | "right">,
) {
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
      const cell: HtmlTableCell = {
        value,
        row: rowIndex,
        col: colIndex,
        alignment: alignments[colIndex] || "left",
        rowspan: 1,
        colspan: 1,
      };
      grid[rowIndex][colIndex] = cell;
      rendered.push(cell);
    });
    renderedRows.push(rendered);
  });
  return renderedRows;
}

function pipeTableToHtml(block: string[]) {
  const parsedRows = block.map(parseTableRow);
  const hasSeparator = isSeparatorRow(parsedRows[1] || []);
  const hasHeader =
    hasSeparator && (parsedRows[0] || []).some((cell) => cell !== "");
  const alignments = hasSeparator
    ? (parsedRows[1] || []).map(parseAlignment)
    : [];
  const header = hasHeader ? parsedRows[0] : [];
  const body = hasSeparator ? parsedRows.slice(2) : parsedRows;
  const rows = hasHeader ? [header, ...body] : body;
  const renderedRows = buildMergedRows(rows, alignments);
  const renderRow = (cells: HtmlTableCell[], tag: "th" | "td") =>
    `<tr>${cells
      .map((cell) => {
        const span = `${cell.colspan > 1 ? ` colSpan="${cell.colspan}"` : ""}${
          cell.rowspan > 1 ? ` rowSpan="${cell.rowspan}"` : ""
        }`;
        return `<${tag}${span} data-align="${cell.alignment}">${inlineMarkdown(cell.value)}</${tag}>`;
      })
      .join("")}</tr>`;
  const headerHtml = hasHeader
    ? `<thead>${renderRow(renderedRows[0] || [], "th")}</thead>`
    : "";
  const bodyRows = hasHeader ? renderedRows.slice(1) : renderedRows;
  return `<table>${headerHtml}<tbody>${bodyRows
    .map((row) => renderRow(row, "td"))
    .join("")}</tbody></table>`;
}

/**
 * Convert a docs Markdown/MDX file to HTML. Tables are pre-converted because
 * the docs use a custom `^` / `<` merged-cell syntax on top of GFM tables.
 */
export function markdownToHtml(source: string) {
  const lines = source.split(/\r?\n/);
  const output: string[] = [];
  for (let index = 0; index < lines.length; ) {
    if (!isTableLine(lines[index]) || !isTableLine(lines[index + 1] || "")) {
      output.push(lines[index]);
      index += 1;
      continue;
    }
    const start = index;
    while (index < lines.length && isTableLine(lines[index])) index += 1;
    output.push("", pipeTableToHtml(lines.slice(start, index)), "");
  }
  return marked.parse(output.join("\n"), {
    gfm: true,
    async: false,
  }) as string;
}
