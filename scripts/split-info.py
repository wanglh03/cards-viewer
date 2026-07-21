from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import INFO_DIR, MYCARDS_DIR


PERSONAL_FIELDS = (
    "status",
    "acquired",
    "branch",
    "virtual",
    "limit",
    "billing_day",
    "due_day",
)
PERSONAL_FIELD_SET = set(PERSONAL_FIELDS)


def read_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def split_file(source_path: Path) -> tuple[int, int]:
    source = read_json(source_path)
    raw_issuer = source.get("issuer", {})
    raw_cards = source.get("cards", [])
    if not isinstance(raw_issuer, dict) or not isinstance(raw_cards, list):
        raise ValueError(f"Invalid card info shape: {source_path}")

    public_issuer = {
        key: value
        for key, value in raw_issuer.items()
        if key not in {"english_name", "region"}
    }
    public_cards = []
    my_cards = []
    for raw_card in raw_cards:
        if not isinstance(raw_card, dict):
            continue
        public_cards.append(
            {
                key: value
                for key, value in raw_card.items()
                if key not in PERSONAL_FIELD_SET
            }
        )
        if not any(key in raw_card for key in PERSONAL_FIELDS):
            continue
        my_card = {"name": raw_card.get("name", "")}
        my_card.update(
            (key, raw_card[key])
            for key in PERSONAL_FIELDS
            if key in raw_card
        )
        my_cards.append(my_card)

    mycards_path = MYCARDS_DIR / source_path.relative_to(INFO_DIR)
    write_json(source_path, {"issuer": public_issuer, "cards": public_cards})
    if my_cards or not mycards_path.exists():
        write_json(mycards_path, {"cards": my_cards})
    return len(public_cards), len(my_cards)


def main() -> None:
    files = sorted(INFO_DIR.rglob("*.json"), key=lambda path: str(path).casefold())
    public_count = 0
    personal_count = 0
    for path in files:
        public, personal = split_file(path)
        public_count += public
        personal_count += personal
    print(
        f"Split {len(files)} issuer files, "
        f"{public_count} public cards and {personal_count} personal cards."
    )


if __name__ == "__main__":
    main()
