from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.parse import quote

from config import CONFIG_DIR, INFO_DIR, MYCARDS_DIR, NAVIGATION_CONFIG
from utils import read_json


SHORT_LINK_KEY_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")


def discover_bank_keys() -> list[str]:
    return sorted(
        (path.stem for path in INFO_DIR.rglob("*.json")),
        key=str.casefold,
    )


def asset_url(region: str, issuer: str, filename: object) -> str:
    text = str(filename or "").strip()
    if not text or text.startswith("assets/") or text.startswith(("http://", "https://", "/")):
        return text

    return "/".join(
        (
            "assets",
            "issuers",
            quote(region, safe=""),
            quote(issuer, safe=""),
            quote(text, safe="/"),
        )
    )


def load_issuer_data(info_path: Path) -> tuple[str, dict[str, object]]:
    region = info_path.parent.name
    issuer_key = info_path.stem
    raw = read_json(info_path)
    if not isinstance(raw, dict):
        raise ValueError(f"{info_path} must contain an object")

    issuer = raw.get("issuer")
    if not isinstance(issuer, dict):
        raise ValueError(f"{info_path} must contain an issuer object")

    bank = dict(issuer)
    bank.setdefault("english_name", issuer_key)
    bank["region"] = region
    if bank.get("logo"):
        bank["logo"] = asset_url(region, issuer_key, bank["logo"])

    cards = []
    for raw_card in raw.get("cards", []):
        if not isinstance(raw_card, dict) or not raw_card.get("name"):
            continue

        card = dict(raw_card)
        if card.get("image"):
            card["image"] = asset_url(region, issuer_key, card["image"])
        if card.get("alt_image"):
            card["alt_image"] = asset_url(region, issuer_key, card["alt_image"])
        cards.append(card)

    return issuer_key, {"bank": bank, "cards": cards}


def load_issuer_info() -> dict[str, object]:
    issuers: dict[str, object] = {}
    for info_path in sorted(INFO_DIR.rglob("*.json"), key=lambda path: path.as_posix().casefold()):
        bank_key, data = load_issuer_data(info_path)
        if bank_key in issuers:
            raise ValueError(f"Duplicate issuer name across regions: {bank_key}")
        issuers[bank_key] = data
    return issuers


def load_mycard_data() -> dict[str, object]:
    mycards: dict[str, object] = {}
    for mycard_path in sorted(MYCARDS_DIR.rglob("*.json"), key=lambda path: path.as_posix().casefold()):
        issuer_key = mycard_path.stem
        raw = read_json(mycard_path)
        if not isinstance(raw, dict) or not isinstance(raw.get("cards"), list):
            raise ValueError(f"{mycard_path} must contain a cards array")
        if issuer_key in mycards:
            raise ValueError(f"Duplicate mycards issuer name across regions: {issuer_key}")
        mycards[issuer_key] = {
            "cards": [
                card
                for card in raw["cards"]
                if isinstance(card, dict) and card.get("name")
            ]
        }
    return mycards


def site_data() -> dict[str, object]:
    issuer_info = load_issuer_info()

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "issuerKeys": list(issuer_info),
        "issuerInfo": issuer_info,
        "mycards": load_mycard_data(),
        "navigation": read_json(NAVIGATION_CONFIG),
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
