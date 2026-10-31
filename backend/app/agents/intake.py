"""Intake Agent: turns free text into a structured blood request.

The LLM (Gemini) is used only to understand language. Its output is never trusted
directly: it must pass the Pydantic schema below, and the requester confirms the
result before anything happens. If the LLM is unavailable or returns junk, the
rule-based parser is used instead (NFR-02).
"""

import hashlib
import json
import logging
from collections import OrderedDict
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, field_validator

from ..config import get_settings
from ..rules import BLOOD_GROUPS
from . import rule_parser

log = logging.getLogger("roktodoot.intake")

REQUIRED_FIELDS = ["blood_group", "units", "hospital", "contact_phone"]

FOLLOW_UP = {
    "blood_group": {
        "en": "Which blood group is needed? (for example O+, B-)",
        "bn": "কোন গ্রুপের রক্ত লাগবে? (যেমন O+, B-)",
    },
    "units": {"en": "How many bags are needed?", "bn": "কত ব্যাগ রক্ত লাগবে?"},
    "hospital": {"en": "Which hospital is the patient in?", "bn": "রোগী কোন হাসপাতালে আছেন?"},
    "contact_phone": {
        "en": "Which phone number should the donor call?",
        "bn": "রক্তদাতা কোন নম্বরে ফোন করবেন?",
    },
}


class LLMParse(BaseModel):
    """Schema the LLM must fill. Anything else is rejected."""

    blood_group: Literal["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"] | None = None
    units: int | None = Field(default=None, ge=1, le=10)
    hospital_text: str | None = None
    city: str | None = None
    hours_until_needed: float | None = Field(default=None, ge=0, le=168)
    urgency: Literal["normal", "critical"] = "normal"
    contact_phone: str | None = None

    @field_validator("contact_phone")
    @classmethod
    def _phone(cls, v):
        if v is None:
            return v
        p = rule_parser.parse_phone(rule_parser.normalize(v))
        return p  # invalid numbers become None


LLM_PROMPT = """You extract blood donation requests from Bangladesh. The text may be Bangla,
English or Banglish (Bangla written in English letters).
Return JSON with these fields (use null when the text does not say):
- blood_group: one of O-, O+, A-, A+, B-, B+, AB-, AB+
- units: number of bags
- hospital_text: the hospital name exactly as written
- city
- hours_until_needed: hours from now until the blood is needed
- urgency: "critical" if urgent/emergency or needed within 6 hours, else "normal"
- contact_phone: Bangladeshi mobile number
Do not guess. Text:
"""

LLMClient = Callable[[str], dict]

_cache: "OrderedDict[str, dict]" = OrderedDict()
_CACHE_MAX = 256


def gemini_client() -> LLMClient | None:
    s = get_settings()
    if not s.gemini_api_key:
        return None

    def call(text: str) -> dict:
        from google import genai  # imported lazily so tests never need it

        client = genai.Client(api_key=s.gemini_api_key)
        resp = client.models.generate_content(
            model=s.gemini_model,
            contents=LLM_PROMPT + text,
            config={"response_mime_type": "application/json", "response_schema": LLMParse},
        )
        return json.loads(resp.text)

    return call


def _cached_llm(client: LLMClient, text: str) -> dict:
    key = hashlib.sha256(text.encode()).hexdigest()
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]
    out = client(text)
    _cache[key] = out
    if len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)
    return out


def parse_request(
    text: str,
    hospitals: list[dict],
    now: datetime,
    llm: LLMClient | None = None,
    use_default_llm: bool = True,
) -> dict:
    """Return parsed fields, the list of missing fields and a follow-up question."""
    rules = rule_parser.parse(text, hospitals, now)
    result = {
        "blood_group": rules.blood_group,
        "units": rules.units,
        "hospital_id": rules.hospital_id,
        "hospital_name": rules.hospital_name,
        "city": rules.city,
        "needed_by": rules.needed_by,
        "urgency": rules.urgency,
        "contact_phone": rules.contact_phone,
        "source": "rules",
    }

    client = llm or (gemini_client() if use_default_llm else None)
    if client is not None:
        try:
            data = LLMParse.model_validate(_cached_llm(client, text))
            result["source"] = "llm"
            # LLM values win where present and valid; rules fill the gaps.
            if data.blood_group:
                result["blood_group"] = data.blood_group
            if data.units:
                result["units"] = data.units
            if data.hospital_text:
                h = rule_parser.match_hospital(rule_parser.normalize(data.hospital_text), hospitals)
                if h:
                    result.update(hospital_id=h["id"], hospital_name=h["name"], city=h.get("city"))
                elif not result["hospital_name"]:
                    result["hospital_name"] = data.hospital_text
            if data.city and not result["city"]:
                result["city"] = data.city
            if data.hours_until_needed is not None:
                result["needed_by"] = now + timedelta(hours=data.hours_until_needed)
            if data.urgency == "critical":
                result["urgency"] = "critical"
            if data.contact_phone:
                result["contact_phone"] = data.contact_phone
        except (ValidationError, ValueError, KeyError, TypeError) as e:
            log.warning("LLM output rejected, using rule-based parser: %s", e)
            result["source"] = "rules"
        except Exception as e:  # network errors, quota, etc.
            log.warning("LLM unavailable, using rule-based parser: %s", e)
            result["source"] = "rules"

    if result["blood_group"] not in BLOOD_GROUPS:
        result["blood_group"] = None
    return result


def missing_fields(fields: dict) -> list[str]:
    missing = []
    if not fields.get("blood_group"):
        missing.append("blood_group")
    if not fields.get("units"):
        missing.append("units")
    if not fields.get("hospital_id") and not fields.get("hospital_name"):
        missing.append("hospital")
    if not fields.get("contact_phone"):
        missing.append("contact_phone")
    return missing


def follow_up_question(missing: list[str]) -> dict | None:
    return FOLLOW_UP[missing[0]] if missing else None
