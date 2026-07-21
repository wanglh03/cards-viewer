from __future__ import annotations

import argparse
import json
import os
import subprocess
import threading
import time
from pathlib import Path

from config import DEV_DIR, DIST, HTML_FILES, KV_EXPORT, ROOT
from data import (
    bin_overlays,
    local_site_data,
    public_site_data,
    site_data_index,
    discover_bank_keys,
    load_short_links,
)
from pages import (
    markdown_pages,
    markdown_to_html,
    write_generated_doc_pages,
    write_bin_overlays,
    write_local_data,
    write_html_files,
    write_root_markdown_pages,
    write_short_link_pages,
    write_static_data,
)
from server import (
    snapshot,
    iter_watch_files,
    run_dev_server,
    watch_and_rebuild,
)
from utils import (
    copy_static_files,
    finalize_html,
    prepare_output_dir,
    read_json,
    remove_path,
    write_text,
)


def to(output_dir: Path) -> None:
    prepare_output_dir(output_dir, HTML_FILES)
    copy_static_files(output_dir)
    write_static_data(output_dir, {**site_data_index(), "imageSource": "r2"})
    write_local_data(output_dir, local_site_data())
    write_bin_overlays(output_dir, bin_overlays())
    write_html_files(output_dir)
    write_root_markdown_pages(output_dir)
    write_generated_doc_pages(output_dir)
    write_short_link_pages(output_dir, load_short_links())
    if output_dir == DEV_DIR:
        write_text(output_dir / "__reload.txt", str(time.time_ns()))
    print(f"Built site at {output_dir}")


def run_dev(args: argparse.Namespace) -> None:
    to(DEV_DIR)

    watcher = threading.Thread(
        target=watch_and_rebuild,
        args=(DEV_DIR, to, max(args.interval, 0.2)),
        daemon=True,
    )
    watcher.start()
    if args.local:
        run_dev_server(DEV_DIR, args.host, args.port, not args.no_open)
        return

    npx = "npx.cmd" if os.name == "nt" else "npx"
    command = [
        npx,
        "wrangler",
        "pages",
        "dev",
        str(DEV_DIR.relative_to(ROOT)),
        "--ip",
        args.host,
        "--port",
        str(args.port),
    ]
    subprocess.run(command, cwd=ROOT, check=True)


def run_deploy(_: argparse.Namespace) -> None:
    to(DIST)


def run_kv(_: argparse.Namespace) -> None:
    KV_EXPORT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(public_site_data(), ensure_ascii=False, separators=(",", ":"))
    write_text(KV_EXPORT, payload)
    print(f"Exported public card info for Workers KV to {KV_EXPORT}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cards viewer workflow tools.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    deploy_parser = subparsers.add_parser(
        "deploy",
        help="Build the production site into dist/.",
    )
    deploy_parser.set_defaults(handler=run_deploy)

    kv_parser = subparsers.add_parser(
        "kv",
        help="Export the complete site data payload for Workers KV.",
    )
    kv_parser.set_defaults(handler=run_kv)

    dev_parser = subparsers.add_parser(
        "dev",
        help="Build, watch, serve, and open the site for local development.",
    )
    dev_parser.add_argument("--host", default="127.0.0.1")
    dev_parser.add_argument("--port", type=int, default=8000)
    dev_parser.add_argument("--interval", type=float, default=0.8)
    dev_parser.add_argument(
        "--no-open",
        action="store_true",
        help="Keep the local static server from opening a browser (only with --local).",
    )
    dev_parser.add_argument(
        "--local",
        action="store_true",
        help="Use the old Python static server without remote Cloudflare bindings.",
    )
    dev_parser.set_defaults(handler=run_dev)

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()
