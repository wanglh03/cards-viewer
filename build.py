from __future__ import annotations

import argparse
import threading
import time
from pathlib import Path

from config import DEV_DIR, DIST, HTML_FILES
from data import site_data, discover_bank_keys, load_short_links
from pages import (
    markdown_pages,
    markdown_to_html,
    write_generated_doc_pages,
    write_html_files,
    write_root_markdown_pages,
    write_short_link_pages,
    write_site_data,
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
    write_site_data(output_dir, site_data())
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
    run_dev_server(DEV_DIR, args.host, args.port, not args.no_open)


def run_deploy(_: argparse.Namespace) -> None:
    to(DIST)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cards viewer workflow tools.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    deploy_parser = subparsers.add_parser(
        "deploy",
        help="Build the production site into dist/.",
    )
    deploy_parser.set_defaults(handler=run_deploy)

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
        help="Start the dev server without opening a browser window.",
    )
    dev_parser.set_defaults(handler=run_dev)

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()
