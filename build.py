from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
ASSETS_DIR = ROOT / "assets"
HTML_FILES = ("index.html", "credit.html", "referral.html")
STATIC_DIRS = ("assets", "css", "js")
PRELOADED_SCRIPT = '<script src="js/generated/site-data.js"></script>'
PRELOADED_MARKER = '<script src="js/common.js"></script>'


def read_json(path: Path) -> object:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


def clean_dist() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True, exist_ok=True)


def copy_static_files() -> None:
    for directory in STATIC_DIRS:
        shutil.copytree(ROOT / directory, DIST / directory)


def build_site_data() -> dict[str, object]:
    manifest = read_json(ASSETS_DIR / "manifest.json")
    if not isinstance(manifest, list):
        raise ValueError("assets/manifest.json must be an array")

    banks: dict[str, object] = {}
    for item in manifest:
        bank_key = str(item).strip()
        if not bank_key:
            continue
        banks[bank_key] = read_json(ASSETS_DIR / bank_key / "data.json")

    referral = read_json(ASSETS_DIR / "referral.json")
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "manifest": manifest,
        "banks": banks,
        "referral": referral,
    }


def write_site_data(data: dict[str, object]) -> None:
    payload = json.dumps(
        data,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    content = f"window.__CARDS_VIEWER_DATA__ = {payload};\n"
    write_text(DIST / "js" / "generated" / "site-data.js", content)


def write_html_files() -> None:
    for name in HTML_FILES:
        source = (ROOT / name).read_text(encoding="utf-8")
        if PRELOADED_SCRIPT not in source and PRELOADED_MARKER in source:
            source = source.replace(
                PRELOADED_MARKER,
                f"{PRELOADED_SCRIPT}\n    {PRELOADED_MARKER}",
                1,
            )
        write_text(DIST / name, source)


def main() -> None:
    clean_dist()
    copy_static_files()
    write_site_data(build_site_data())
    write_html_files()
    print(f"Built static site at {DIST}")


if __name__ == "__main__":
    main()
