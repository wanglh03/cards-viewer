from __future__ import annotations

import os
import threading
import time
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse

from config import ROOT, WATCH_DIRECTORIES, WATCH_FILE_SUFFIXES


def iter_watch_files() -> list[Path]:
    files: list[Path] = [ROOT / "build.py"]
    files.extend(ROOT.glob("*.py"))

    for directory in WATCH_DIRECTORIES:
        root = ROOT / directory
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in WATCH_FILE_SUFFIXES:
                files.append(path)

    return sorted(set(files))


def snapshot() -> dict[str, tuple[int, int]]:
    snapshot: dict[str, tuple[int, int]] = {}
    for path in iter_watch_files():
        stat = path.stat()
        snapshot[str(path)] = (stat.st_mtime_ns, stat.st_size)
    return snapshot


def watch_and_rebuild(
    output_dir: Path,
    to: Callable[[Path], None],
    interval: float,
) -> None:
    previous = snapshot()
    print(f"Watching for changes every {interval:.1f}s ...")

    while True:
        time.sleep(interval)
        current = snapshot()
        if current == previous:
            continue

        changed = sorted(set(previous) ^ set(current))
        if not changed:
            changed = [
                name for name, state in current.items() if previous.get(name) != state
            ]

        preview = ", ".join(
            Path(name).relative_to(ROOT).as_posix() for name in changed[:5]
        )
        if len(changed) > 5:
            preview += ", ..."
        print(f"Detected changes: {preview}")

        to(output_dir)
        previous = current


class QuietDevRequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        request_path = urlparse(self.path).path
        if request_path.startswith("/s/"):
            self.path = "/s/index.html"
        super().do_GET()

    def log_message(self, format: str, *args: object) -> None:
        # Keep the dev server quiet; rebuild messages are enough signal.
        return


def run_dev_server(
    output_dir: Path,
    host: str,
    port: int,
    open_browser: bool,
) -> None:
    handler = partial(QuietDevRequestHandler, directory=os.fspath(output_dir))
    server = ThreadingHTTPServer((host, port), handler)
    url = f"http://{host if host != '0.0.0.0' else '127.0.0.1'}:{port}/index.html"

    print(f"Serving {output_dir} at {url}")
    if open_browser:
        print("Opening browser ...")
        threading.Timer(0.3, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    finally:
        server.server_close()
