from __future__ import annotations

import re
from datetime import datetime, timezone
from urllib.parse import urlparse

from config import BANKS_DIR, CONFIG_DIR
from utils import read_json


SHORT_LINK_KEY_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")


def discover_bank_keys() -> list[str]:
    return sorted(
        (path.name for path in BANKS_DIR.iterdir() if path.is_dir()),
        key=str.casefold,
    )


def site_data() -> dict[str, object]:
    banks: dict[str, object] = {}
    for bank_key in discover_bank_keys():
        banks[bank_key] = read_json(BANKS_DIR / bank_key / "data.json")

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "banks": banks,
        "footerLinks": read_json(CONFIG_DIR / "footer-links.json"),
        "binOverlays": read_json(CONFIG_DIR / "bin-overlays.json"),
        "regions": read_json(CONFIG_DIR / "regions.json"),
    }


def load_short_links() -> dict[str, str]:
    raw_links = read_json(CONFIG_DIR / "short-links.json")
    if not isinstance(raw_links, dict):
        raise ValueError("config/short-links.json must be an object")

    short_links: dict[str, str] = {}
    for raw_key, raw_url in raw_links.items():
        key = str(raw_key).strip().strip("/")
        url = str(raw_url).strip()
        parsed_url = urlparse(url)
        if not SHORT_LINK_KEY_PATTERN.fullmatch(key):
            raise ValueError(
                f"Invalid short link key {raw_key!r}; use a single URL-safe path segment"
            )
        if parsed_url.scheme.lower() not in {"http", "https"} or not parsed_url.netloc:
            raise ValueError(
                f"Invalid short link target for {key!r}; use an absolute http(s) URL"
            )
        if key in short_links:
            raise ValueError(f"Duplicate short link path: /{key}")
        short_links[key] = url

    return short_links
