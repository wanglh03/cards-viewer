from __future__ import annotations

import html
import json
import re
from datetime import date, datetime
from os import path as os_path
from pathlib import Path

from config import (
    DOCS_DIR,
    HTML_DIR,
    HTML_FILES,
    PRELOADED_MARKER,
    PRELOADED_SCRIPT,
    ROOT_MARKDOWN_PAGES,
    SHORT_LINK_MARKER,
    TEMPLATES_DIR,
)
from utils import finalize_html, remove_path, write_text


def write_site_data(output_dir: Path, data: dict[str, object]) -> None:
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    write_text(output_dir / "js" / "generated" / "site-data.js", f"window.__CARDS_VIEWER_DATA__ = {payload};\n")


def write_html_files(output_dir: Path) -> None:
    for name in HTML_FILES:
        source = (HTML_DIR / name).read_text(encoding="utf-8")
        if PRELOADED_SCRIPT not in source and PRELOADED_MARKER in source:
            source = source.replace(
                PRELOADED_MARKER,
                f"{PRELOADED_SCRIPT}\n    {PRELOADED_MARKER}",
                1,
            )
        write_text(output_dir / name, finalize_html(source, output_dir))


def remove_generated_short_link_pages(output_dir: Path) -> None:
    generated_pages = []
    generated_files = []
    candidates = list(output_dir.rglob("index.html"))
    candidates.extend(output_dir.rglob("404.html"))
    for page_path in candidates:
        if not page_path.is_file():
            continue
        try:
            content = page_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if SHORT_LINK_MARKER not in content:
            continue
        if page_path.name == "404.html":
            generated_files.append(page_path)
        else:
            generated_pages.append(page_path.parent)

    for page_dir in generated_pages:
        remove_path(page_dir)
    for page_path in generated_files:
        remove_path(page_path)

    short_link_root = output_dir / "s"
    if short_link_root.is_dir() and not any(short_link_root.iterdir()):
        remove_path(short_link_root)


def write_short_link_pages(output_dir: Path, short_links: dict[str, str]) -> None:
    remove_generated_short_link_pages(output_dir)

    route_root = output_dir / "s"
    if route_root.exists():
        raise ValueError("Short link path conflicts with existing output: /s/")

    targets = (
        json.dumps(short_links, ensure_ascii=False, separators=(",", ":"))
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )
    content = f"""<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="robots" content="noindex" />
    <title>Redirecting</title>
  </head>
  <body>
    <p>Redirecting...</p>
    <script>{SHORT_LINK_MARKER}
      const shortLinks = {targets};
      const path = window.location.pathname.replace(/\\/+$/, "");
      const match = path.match(/^(.*)\\/s\\/([^/]+)$/);
      const queryKey = new URLSearchParams(window.location.search).get("key");
      let key = "";
      try {{
        key = queryKey || (match ? decodeURIComponent(match[2]) : "");
      }} catch {{
        key = "";
      }}
      const target = shortLinks[key];
      if (target) {{
        window.location.replace(target);
      }} else {{
        const siteRoot = match ? match[1] || "" : "";
        window.location.replace(`${{siteRoot}}/index.html`);
      }}
    </script>
  </body>
</html>
"""
    write_text(route_root / "index.html", content)


def read_template(name: str) -> str:
    return (TEMPLATES_DIR / name).read_text(encoding="utf-8")


def extract_markdown_title(markdown: str, fallback: str) -> str:
    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            title = stripped.lstrip("#").strip()
            if title:
                return title
    return fallback


FRONT_MATTER_PATTERN = re.compile(
    r"\A---\s*\r?\n(?P<body>.*?)\r?\n---\s*(?:\r?\n|$)",
    re.DOTALL,
)


def parse_markdown_metadata(markdown: str) -> tuple[str, dict[str, str]]:
    match = FRONT_MATTER_PATTERN.match(markdown)
    if not match:
        return markdown, {}

    metadata: dict[str, str] = {}
    for line in match.group("body").splitlines():
        key, separator, value = line.partition(":")
        if not separator:
            continue
        normalized_key = key.strip().lower()
        normalized_value = value.strip().strip("\"'")
        if normalized_key in {"author", "date"} and normalized_value:
            metadata[normalized_key] = normalized_value

    return markdown[match.end() :].lstrip("\r\n"), metadata


INLINE_CODE_PATTERN = re.compile(r"`([^`]+)`")
STRONG_PATTERN = re.compile(r"\*\*([^*]+)\*\*")
MARKDOWN_LINK_PATTERN = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
BARE_URL_PATTERN = re.compile(r'(?<!["])(https?://[^\s<]+)')


def escape_html(value: object) -> str:
    return html.escape(str(value), quote=True)


def render_markdown_link(match: re.Match[str]) -> str:
    href = match.group(2)
    class_attr = (
        ' class="external-link"'
        if re.match(r"^(https?:)?//|^/s/", href, re.IGNORECASE)
        else ""
    )
    return (
        f'<a{class_attr} href="{escape_html(href)}" target="_blank" '
        f'rel="noopener noreferrer">{match.group(1)}</a>'
    )


def render_inline(text: str) -> str:
    rendered = escape_html(text.strip())
    rendered = INLINE_CODE_PATTERN.sub(
        lambda match: f"<code>{escape_html(match.group(1))}</code>",
        rendered,
    )
    rendered = STRONG_PATTERN.sub(
        lambda match: f"<strong>{escape_html(match.group(1))}</strong>",
        rendered,
    )
    rendered = MARKDOWN_LINK_PATTERN.sub(render_markdown_link, rendered)
    rendered = BARE_URL_PATTERN.sub(
        lambda match: (
            f'<a class="external-link" href="{match.group(1)}" target="_blank" '
            f'rel="noopener noreferrer">{match.group(1)}</a>'
        ),
        rendered,
    )
    return rendered


def split_table_row(line: str) -> list[str] | None:
    trimmed = line.strip()
    if "|" not in trimmed:
        return None

    normalized = trimmed.removeprefix("|").removesuffix("|")
    return [cell.strip() for cell in normalized.split("|")]


def is_table_separator(line: str) -> bool:
    cells = split_table_row(line)
    return bool(cells) and all(re.fullmatch(r":?-+:?", cell) for cell in cells)


def get_table_alignment(cell: str) -> str:
    if cell.startswith(":") and cell.endswith(":"):
        return "center"
    if cell.endswith(":"):
        return "right"
    if cell.startswith(":"):
        return "left"
    return ""


def render_table_section(
    rows: list[list[str]],
    tag_name: str,
    alignments: list[str],
) -> str:
    logical_column_count = max([len(alignments), *(len(row) for row in rows), 0])
    active_columns: list[dict[str, object] | None] = [None] * logical_column_count
    rendered_rows: list[list[dict[str, object]]] = []

    for row in rows:
        visible_cells: list[dict[str, object]] = []
        row_coverage: list[dict[str, object] | None] = [None] * logical_column_count

        for column_index in range(logical_column_count):
            cell = (row[column_index] if column_index < len(row) else "").strip()
            left_cell = row_coverage[column_index - 1] if column_index > 0 else None

            if cell == "<" and left_cell:
                left_cell["colspan"] = int(left_cell["colspan"]) + 1
                row_coverage[column_index] = left_cell
                continue

            if cell == "^" and active_columns[column_index]:
                upper_cell = active_columns[column_index]
                upper_cell["rowspan"] = int(upper_cell["rowspan"]) + 1
                row_coverage[column_index] = upper_cell
                continue

            align = alignments[column_index] if column_index < len(alignments) else ""
            cell_state: dict[str, object] = {
                "align": f' class="align-{align}"' if align else "",
                "colspan": 1,
                "rowspan": 1,
                "content": render_inline(cell),
                "tag_name": tag_name,
            }
            visible_cells.append(cell_state)
            row_coverage[column_index] = cell_state

        active_columns = row_coverage[:]
        rendered_rows.append(visible_cells)

    return "".join(
        "<tr>"
        + "".join(
            (
                f'<{cell_state["tag_name"]}{cell_state["align"]}'
                f'{f" colspan={chr(34)}{cell_state["colspan"]}{chr(34)}" if int(cell_state["colspan"]) > 1 else ""}'
                f'{f" rowspan={chr(34)}{cell_state["rowspan"]}{chr(34)}" if int(cell_state["rowspan"]) > 1 else ""}'
                f'>{cell_state["content"]}</{cell_state["tag_name"]}>'
            )
            for cell_state in visible_cells
        )
        + "</tr>"
        for visible_cells in rendered_rows
    )


def render_table(lines: list[str], start_index: int) -> tuple[str, int] | None:
    if start_index + 1 >= len(lines):
        return None

    header_cells = split_table_row(lines[start_index])
    separator_line = lines[start_index + 1].strip()
    if not header_cells or not is_table_separator(separator_line):
        return None

    alignments = [
        get_table_alignment(cell)
        for cell in split_table_row(separator_line) or []
    ]
    has_visible_header = any(cell.strip() for cell in header_cells)
    body_rows: list[list[str]] = []
    index = start_index + 2

    while index < len(lines):
        candidate = lines[index].strip()
        if not candidate or "|" not in candidate:
            break
        row_cells = split_table_row(candidate)
        if not row_cells:
            break
        body_rows.append(row_cells)
        index += 1

    header_html = (
        render_table_section([header_cells], "th", alignments)
        if has_visible_header
        else ""
    )
    body_html = render_table_section(body_rows, "td", alignments)
    html_output = (
        '<div class="markdown-table-wrap"><table class="markdown-table">'
        + (f"<thead>{header_html}</thead>" if has_visible_header else "")
        + f"<tbody>{body_html}</tbody></table></div>"
    )
    return html_output, index


def markdown_to_html(markdown: str) -> tuple[str, str]:
    blocks: list[str] = []
    paragraph_lines: list[str] = []
    list_items: list[str] = []
    list_tag: str | None = None
    toc_items: list[dict[str, str | int]] = []
    lines = markdown.splitlines()
    skipped_first_title = False
    heading_numbers = [0] * 6

    def flush_paragraph() -> None:
        if not paragraph_lines:
            return
        content = " ".join(line.strip() for line in paragraph_lines if line.strip())
        if content:
            blocks.append(f"<p>{render_inline(content)}</p>")
        paragraph_lines.clear()

    def flush_list() -> None:
        nonlocal list_tag
        if not list_items:
            list_tag = None
            return
        items = "".join(
            f"<li>{render_inline(item)}</li>" for item in list_items if item.strip()
        )
        if items:
            tag_name = list_tag or "ul"
            blocks.append(f"<{tag_name}>{items}</{tag_name}>")
        list_items.clear()
        list_tag = None

    index = 0
    while index < len(lines):
        stripped = lines[index].rstrip().strip()

        if not stripped:
            flush_paragraph()
            flush_list()
            index += 1
            continue

        table = render_table(lines, index)
        if table:
            flush_paragraph()
            flush_list()
            table_html, next_index = table
            blocks.append(table_html)
            index = next_index
            continue

        if stripped.startswith("- ") or stripped.startswith("* "):
            flush_paragraph()
            if list_tag != "ul":
                flush_list()
            list_tag = "ul"
            list_items.append(stripped[2:])
            index += 1
            continue

        ordered_match = re.match(r"^\d+\.\s+(.*)$", stripped)
        if ordered_match:
            flush_paragraph()
            if list_tag != "ol":
                flush_list()
            list_tag = "ol"
            list_items.append(ordered_match.group(1))
            index += 1
            continue

        heading_match = re.match(r"^(#{1,6})\s+(.*)$", stripped)
        if heading_match:
            flush_paragraph()
            flush_list()
            level = len(heading_match.group(1))
            if not skipped_first_title and level == 1:
                skipped_first_title = True
                index += 1
                continue
            heading_numbers[level - 1] += 1
            for heading_index in range(level, len(heading_numbers)):
                heading_numbers[heading_index] = 0
            numbering = ".".join(
                str(value) for value in heading_numbers[:level] if value > 0
            )
            heading_text = heading_match.group(2).strip()
            display_text = f"{numbering} {heading_text}"
            heading_id = re.sub(r"[^a-z0-9]+", "-", display_text.lower()).strip("-")
            if not heading_id:
                heading_id = f"section-{len(toc_items) + 1}"
            toc_items.append(
                {
                    "level": level,
                    "id": heading_id,
                    "text": display_text,
                }
            )
            blocks.append(f'<h{level} id="{heading_id}">{render_inline(display_text)}</h{level}>')
            index += 1
            continue

        paragraph_lines.append(stripped)
        index += 1

    flush_paragraph()
    flush_list()
    toc_html = ""
    if toc_items:
        toc_links = "".join(
            (
                f'<li class="markdown-toc-item level-{item["level"]}">'
                f'<a href="#{item["id"]}">{html.escape(str(item["text"]))}</a>'
                "</li>"
            )
            for item in toc_items
        )
        toc_html = (
            '<nav class="markdown-toc" aria-label="页面目录">'
            '<div class="markdown-toc-card">'
            '<p class="markdown-toc-title">目录</p>'
            f"<ol>{toc_links}</ol>"
            "</div>"
            "</nav>"
        )
    return "\n".join(blocks), toc_html


def relative_prefix(output_dir: Path, path: Path) -> str:
    depth = len(path.relative_to(output_dir).parts)
    return "../" * depth


def parse_document_date(value: str) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None

    for date_format in ("%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            parsed = datetime.strptime(text, date_format)
            return parsed.date()
        except ValueError:
            continue
    return None


def get_document_entries(output_dir: Path) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    docs_index_dir = output_dir / "docs"

    for markdown_path in sorted(DOCS_DIR.rglob("*.md")):
        relative_markdown = markdown_path.relative_to(Path(__file__).resolve().parent)
        relative_name = relative_markdown.as_posix()
        output_path = output_dir / relative_markdown.with_suffix(".html")
        if relative_name == "docs/link.md":
            output_path = output_dir / "link.html"

        markdown = markdown_path.read_text(encoding="utf-8")
        content, metadata = parse_markdown_metadata(markdown)
        published_text = metadata.get("date", "").strip()
        published_date = parse_document_date(published_text)
        entries.append(
            {
                "title": extract_markdown_title(content, markdown_path.stem),
                "date": published_date,
                "date_text": published_text or "未标注日期",
                "href": os_path.relpath(output_path, docs_index_dir).replace(
                    os_path.sep, "/"
                ),
            }
        )

    entries.sort(
        key=lambda entry: (
            entry["date"] is not None,
            entry["date"] or date.min,
            str(entry["title"]),
        ),
        reverse=True,
    )
    return entries


def render_document_timeline(entries: list[dict[str, object]]) -> str:
    years: dict[str, list[dict[str, object]]] = {}
    for entry in entries:
        published_date = entry["date"]
        year = str(published_date.year) if published_date else "未标注日期"
        years.setdefault(year, []).append(entry)

    year_blocks: list[str] = []
    for year, year_entries in years.items():
        month_groups: dict[str, list[dict[str, object]]] = {}
        for entry in year_entries:
            published_date = entry["date"]
            month = f"{published_date.month:02d}月" if published_date else "未标注月份"
            month_groups.setdefault(month, []).append(entry)

        month_blocks: list[str] = []
        for month, month_entries in month_groups.items():
            item_html = "".join(
                (
                    '<li class="docs-timeline-entry">'
                    f'<a class="docs-timeline-link" href="{escape_html(entry["href"])}">'
                    f'<time class="docs-timeline-date">{escape_html(entry["date_text"])}'
                    "</time>"
                    f'<span class="docs-timeline-title">{escape_html(entry["title"])}'
                    "</span>"
                    "</a></li>"
                )
                for entry in month_entries
            )
            month_blocks.append(
                '<section class="docs-timeline-month">'
                f'<h3 class="docs-timeline-month-title">{escape_html(month)}</h3>'
                f'<ol class="docs-timeline-entries">{item_html}</ol>'
                "</section>"
            )

        year_blocks.append(
            '<section class="docs-timeline-year">'
            f'<h2 class="docs-timeline-year-title">{escape_html(year)}</h2>'
            f'<div class="docs-timeline-year-content">{"".join(month_blocks)}</div>'
            "</section>"
        )

    return "".join(year_blocks)


def write_docs_index(output_dir: Path) -> None:
    entries = get_document_entries(output_dir)
    template = read_template("docs-index.html")
    content = template.format(timeline=render_document_timeline(entries))
    write_text(output_dir / "docs" / "index.html", finalize_html(content, output_dir))


def markdown_pages(
    output_dir: Path,
    markdown_path: Path,
    output_path: Path,
    page: str,
) -> str:
    template = read_template("doc-page.html")
    prefix = relative_prefix(output_dir, output_path.parent)
    markdown = markdown_path.read_text(encoding="utf-8")
    markdown, metadata = parse_markdown_metadata(markdown)
    title = extract_markdown_title(markdown, markdown_path.stem)
    content, toc = markdown_to_html(markdown)
    content = content or '<p class="markdown-status">文件为空。</p>'
    metadata_items = []
    if metadata.get("author"):
        metadata_items.append(f'作者：{escape_html(metadata["author"])}')
    if metadata.get("date"):
        metadata_items.append(f'日期：{escape_html(metadata["date"])}')
    metadata_html = (
        f'<div class="markdown-meta">{"".join(f"<span>{item}</span>" for item in metadata_items)}</div>'
        if metadata_items
        else ""
    )
    rendered = template.format(
        title=title,
        page=page,
        base_path=prefix,
        root_path=f"{prefix}index.html",
        content=content,
        toc=toc,
        metadata=metadata_html,
    )
    common_script = f'<script src="{prefix}js/common.js"></script>'
    preloaded_script = f'<script src="{prefix}js/generated/site-data.js"></script>'
    return rendered.replace(
        common_script,
        f'{preloaded_script}\n    {common_script}',
        1,
    )


def write_root_markdown_pages(output_dir: Path) -> None:
    for markdown_path_text, output_name, page in ROOT_MARKDOWN_PAGES:
        markdown_path = Path(__file__).resolve().parent / markdown_path_text
        output_path = output_dir / output_name
        content = markdown_pages(output_dir, markdown_path, output_path, page)
        write_text(output_path, finalize_html(content, output_dir))


def write_generated_doc_pages(output_dir: Path) -> None:
    generated_outputs: set[Path] = set()
    docs_index_path = output_dir / "docs" / "index.html"
    generated_outputs.add(docs_index_path)

    for markdown_path in DOCS_DIR.rglob("*.md"):
        relative_markdown = markdown_path.relative_to(Path(__file__).resolve().parent)
        if relative_markdown.as_posix() == "docs/link.md":
            continue

        output_path = output_dir / relative_markdown.with_suffix(".html")
        generated_outputs.add(output_path)
        page = "about" if relative_markdown.as_posix() == "docs/about.md" else "doc"
        content = markdown_pages(output_dir, markdown_path, output_path, page)
        write_text(output_path, finalize_html(content, output_dir))

    docs_output_dir = output_dir / "docs"
    if docs_output_dir.exists():
        for html_path in docs_output_dir.rglob("*.html"):
            if html_path not in generated_outputs:
                html_path.unlink(missing_ok=True)

    write_docs_index(output_dir)
