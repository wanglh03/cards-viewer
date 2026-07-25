from __future__ import annotations

import json
import shutil
from pathlib import Path

from config import (
    DEV_DIR,
    DEV_RELOAD_SCRIPT,
    HTML_FILES,
    ROOT,
    STATIC_DIRS,
)


def read_json(path: Path) -> object:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


def finalize_html(content: str, output_dir: Path) -> str:
    if output_dir == DEV_DIR and DEV_RELOAD_SCRIPT not in content:
        return content.replace("</body>", f"  {DEV_RELOAD_SCRIPT}\n  </body>")
    return content


def recreate_directory(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
    path.mkdir(parents=True, exist_ok=True)


def remove_path(path: Path) -> None:
    if path.is_dir():
        shutil.rmtree(path, ignore_errors=True)
    elif path.exists():
        path.unlink(missing_ok=True)


def same_file(source: Path, target: Path) -> bool:
    if not target.exists() or not target.is_file():
        return False

    source_stat = source.stat()
    target_stat = target.stat()
    return (
        source_stat.st_size == target_stat.st_size
        and source_stat.st_mtime_ns == target_stat.st_mtime_ns
    )


def sync_directory(source_dir: Path, target_dir: Path) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)

    for source_path in source_dir.rglob("*"):
        relative_path = source_path.relative_to(source_dir)
        target_path = target_dir / relative_path

        if source_path.is_dir():
            target_path.mkdir(parents=True, exist_ok=True)
            continue

        if same_file(source_path, target_path):
            continue

        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, target_path)


def prepare_output_dir(
    output_dir: Path,
    html_files: tuple[str, ...] = HTML_FILES,
) -> None:
    if output_dir == DEV_DIR:
        output_dir.mkdir(parents=True, exist_ok=True)
        for name in html_files:
            remove_path(output_dir / name)
        remove_path(output_dir / "__reload.txt")
        return

    recreate_directory(output_dir)


def copy_static_files(output_dir: Path) -> None:
    if output_dir == DEV_DIR:
        remove_path(output_dir / "config")

    for directory in STATIC_DIRS:
        if output_dir == DEV_DIR:
            sync_directory(ROOT / directory, output_dir / directory)
            continue
        shutil.copytree(ROOT / directory, output_dir / directory)
