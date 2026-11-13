"""Loads the configurable decision rules from rules.json."""

import json
from functools import lru_cache
from pathlib import Path

BLOOD_GROUPS = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]


@lru_cache
def get_rules() -> dict:
    return json.loads((Path(__file__).parent / "rules.json").read_text(encoding="utf-8"))


def compatible_donor_groups(recipient: str) -> list[str]:
    return get_rules()["compatibility"].get(recipient, [])


def wave_config(wave: int) -> dict | None:
    for w in get_rules()["waves"]:
        if w["wave"] == wave:
            return w
    return None


def last_wave_number() -> int:
    return max(w["wave"] for w in get_rules()["waves"])
