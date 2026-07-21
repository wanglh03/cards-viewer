from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from config import CONFIG_DIR, INFO_DIR, MYCARDS_DIR
from utils import read_json


SHORT_LINK_KEY_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
LOCAL_FIELDS = frozenset(
    {
        "status",
        "acquired",
        "branch",
        "virtual",
        "limit",
        "billing_day",
        "due_day",
    }
)


def discover_bank_keys() -> list[str]:
    return sorted(
        (path.stem for path in INFO_DIR.rglob("*.json") if path.is_file()),
        key=str.casefold,
    )


def info_path(bank_key: str) -> Path:
    matches = [path for path in INFO_DIR.rglob("*.json") if path.stem == bank_key]
    if len(matches) != 1:
        raise FileNotFoundError(f"Expected exactly one info file for {bank_key!r}")
    return matches[0]


def mycards_path(bank_key: str) -> Path:
    info_file = info_path(bank_key)
    return MYCARDS_DIR / info_file.relative_to(INFO_DIR)


def site_data() -> dict[str, object]:
    issuers: dict[str, object] = {}
    for bank_key in discover_bank_keys():
        source = read_json(info_path(bank_key))
        if not isinstance(source, dict):
            continue
        issuer = source.get("issuer", {})
        if isinstance(issuer, dict):
            source = {
                **source,
                "issuer": {
                    **issuer,
                    "region": info_path(bank_key).parent.name,
                },
            }
        issuers[bank_key] = source

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "issuers": issuers,
        "footerLinks": read_json(CONFIG_DIR / "footer-links.json"),
        "binOverlays": read_json(CONFIG_DIR / "bin-overlays.json"),
        "regions": read_json(CONFIG_DIR / "regions.json"),
    }


def card_id(bank_key: str, card: dict[str, object]) -> str:
    explicit_id = str(card.get("id") or "").strip()
    if explicit_id:
        return explicit_id
    return ":".join(
        (
            bank_key,
            str(card.get("type") or ""),
            str(card.get("bin") or ""),
            str(card.get("name") or ""),
        )
    )


def public_site_data() -> dict[str, object]:
    """Export public card information and derive each region from its folder."""
    source = site_data()
    public_issuers: dict[str, object] = {}
    for bank_key, raw_data in source["issuers"].items():
        data = raw_data if isinstance(raw_data, dict) else {}
        raw_issuer = data.get("issuer", {})
        public_issuer = (
            {
                key: value
                for key, value in raw_issuer.items()
                if key not in LOCAL_FIELDS and key != "english_name"
            }
            if isinstance(raw_issuer, dict)
            else {}
        )
        public_cards = []
        for raw_card in data.get("cards", []):
            if not isinstance(raw_card, dict):
                continue
            public_card = {
                key: value for key, value in raw_card.items() if key not in LOCAL_FIELDS
            }
            public_cards.append(public_card)
        public_issuers[bank_key] = {"issuer": public_issuer, "cards": public_cards}

    return {
        "generatedAt": source["generatedAt"],
        "issuers": public_issuers,
    }


def local_site_data() -> dict[str, object]:
    """Load account-specific card data from assets/mycards."""
    local_issuers: dict[str, object] = {}
    for bank_key in discover_bank_keys():
        path = mycards_path(bank_key)
        if not path.is_file():
            continue
        raw_data = read_json(path)
        if not isinstance(raw_data, dict):
            continue

        local_cards = []
        for raw_card in raw_data.get("cards", []):
            if not isinstance(raw_card, dict):
                continue
            local_card = {"name": raw_card.get("name", "")}
            local_card.update(
                (key, raw_card[key])
                for key in LOCAL_FIELDS
                if key in raw_card
            )
            local_cards.append(local_card)

        if local_cards:
            local_issuers[bank_key] = {"cards": local_cards}

    return {"issuers": local_issuers}


def site_data_index() -> dict[str, object]:
    """Return the small static payload needed before the KV request completes."""
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "issuerKeys": discover_bank_keys(),
        "footerLinks": read_json(CONFIG_DIR / "footer-links.json"),
        "regions": read_json(CONFIG_DIR / "regions.json"),
    }


def bin_overlays() -> object:
    return read_json(CONFIG_DIR / "bin-overlays.json")


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
