"""Rule-based parser for blood requests written in Bangla, English or Banglish.

Used when the LLM is unavailable (NFR-02), and to fill any gaps the LLM leaves.
Every function here is deterministic and unit-tested.
"""

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta, timezone

DHAKA_TZ = timezone(timedelta(hours=6))

BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")

NUMBER_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "ek": 1,
    "dui": 2,
    "duita": 2,
    "tin": 3,
    "teen": 3,
    "char": 4,
    "pach": 5,
    "panch": 5,
    "এক": 1,
    "দুই": 2,
    "তিন": 3,
    "চার": 4,
    "পাঁচ": 5,
}

UNIT_WORDS = r"(?:bags?|bottles?|units?|pints?|packets?|bag|ব্যাগ|ব্যাগ|ইউনিট|বোতল|পিন্ট)"

CRITICAL_WORDS = [
    "urgent",
    "emergency",
    "asap",
    "critical",
    "immediately",
    "right now",
    "jaruri",
    "joruri",
    "jorori",
    "zaruri",
    "ekhoni",
    "akhoni",
    "ekhuni",
    "khub dorkar",
    "জরুরি",
    "জরুরী",
    "এখনই",
    "এখুনি",
    "ইমার্জেন্সি",
    "ইমারজেন্সি",
    "অতি জরুরি",
]

CITIES = {
    "dhaka": "Dhaka",
    "ঢাকা": "Dhaka",
    "chittagong": "Chattogram",
    "chattogram": "Chattogram",
    "ctg": "Chattogram",
    "চট্টগ্রাম": "Chattogram",
    "sylhet": "Sylhet",
    "সিলেট": "Sylhet",
    "rajshahi": "Rajshahi",
    "রাজশাহী": "Rajshahi",
    "khulna": "Khulna",
    "খুলনা": "Khulna",
    "barishal": "Barishal",
    "barisal": "Barishal",
    "বরিশাল": "Barishal",
    "rangpur": "Rangpur",
    "রংপুর": "Rangpur",
    "mymensingh": "Mymensingh",
    "ময়মনসিংহ": "Mymensingh",
}


@dataclass
class RuleParse:
    blood_group: str | None = None
    units: int | None = None
    hospital_id: int | None = None
    hospital_name: str | None = None
    city: str | None = None
    needed_by: datetime | None = None  # naive UTC
    urgency: str = "normal"
    contact_phone: str | None = None
    notes: list[str] = field(default_factory=list)


def normalize(text: str) -> str:
    t = unicodedata.normalize("NFC", text).translate(BN_DIGITS).lower()
    t = t.replace("−", "-").replace("–", "-").replace("＋", "+")
    return t


# ---------- blood group ----------

_EN_GROUP = re.compile(r"(?<![a-z])(ab|a|b|o)\s*\(?\s*(\+|-|positive|pos|negative|neg)\s*(?:ve)?\s*\)?(?![a-z])")
_EN_GROUP_VE = re.compile(r"(?<![a-z])(ab|a|b|o)\s*(\+|-)\s*ve(?![a-z])")
_BN_GROUP = re.compile(r"(?<![ঀ-৿])(এবি|এ|বি|ও)\s*\(?\s*(\+|-|পজিটিভ|পজেটিভ|পজিটিব|পজ|নেগেটিভ|নেগেটিব|নেগ)\s*\)?")
_BN_LETTER = {"এবি": "AB", "এ": "A", "বি": "B", "ও": "O"}


def _sign(token: str) -> str:
    return "+" if token in ("+", "positive", "pos", "পজিটিভ", "পজেটিভ", "পজিটিব", "পজ") else "-"


def parse_blood_group(t: str) -> str | None:
    for rx in (_EN_GROUP_VE, _EN_GROUP):
        m = rx.search(t)
        if m:
            return m.group(1).upper() + _sign(m.group(2))
    m = _BN_GROUP.search(t)
    if m:
        return _BN_LETTER[m.group(1)] + _sign(m.group(2))
    return None


# ---------- units ----------

_UNITS_NUM = re.compile(r"(\d{1,2})\s*(?:ta|টা|টি)?\s*(?:-|\s)?\s*" + UNIT_WORDS)
_UNITS_WORD = re.compile(
    r"(?<![a-zঀ-৿])(" + "|".join(sorted(NUMBER_WORDS, key=len, reverse=True)) + r")\s*(?:ta|টা|টি)?\s*" + UNIT_WORDS
)


def parse_units(t: str) -> int | None:
    m = _UNITS_NUM.search(t)
    if m:
        n = int(m.group(1))
        return n if 1 <= n <= 10 else None
    m = _UNITS_WORD.search(t)
    if m:
        return NUMBER_WORDS[m.group(1)]
    return None


# ---------- hospital ----------


def match_hospital(t: str, hospitals: list[dict]) -> dict | None:
    """Return the hospital whose name or alias appears in the text (longest match wins)."""
    best, best_len = None, 0
    for h in hospitals:
        for alias in [h["name"], *h.get("aliases", [])]:
            a = unicodedata.normalize("NFC", alias).lower().strip()
            if not a:
                continue
            if re.search(r"[a-z]", a):
                found = re.search(r"(?<![a-z])" + re.escape(a) + r"(?![a-z])", t) is not None
            else:
                found = a in t
            if found and len(a) > best_len:
                best, best_len = h, len(a)
    return best


# ---------- phone ----------

_PHONE = re.compile(r"(?:\+?88)?(01[3-9]\d{8})(?!\d)")


def parse_phone(t: str) -> str | None:
    compact = re.sub(r"(?<=\d)[\s-](?=\d)", "", t)
    m = _PHONE.search(compact)
    return m.group(1) if m else None


# ---------- deadline / urgency ----------

_HOURS = re.compile(r"(\d{1,2})\s*(?:ghontar|ghonta|hours?|hrs?|h\b|ঘণ্টার|ঘণ্টা|ঘন্টার|ঘন্টা)")
_CLOCK = re.compile(
    r"(?<!\d)(\d{1,2})(?::(\d{2}))?\s*(am|pm|ta|tay|টা|টায়|টায়)(?!\s*(?:ta\s*)?(?:bags?|ব্যাগ|ব্যাগ|units?|bottles?|ইউনিট))"
)
_TONIGHT = re.compile(r"(aj|ajke|aaj|today|আজ|আজকে)\s*(raate|rate|rat|raat|night|রাতে|রাত)|tonight")
_TODAY = re.compile(r"(?<![a-z])(aj|ajke|aaj|today)(?![a-z])|আজকে|আজ(?![ঀ-৿])")
_TOMORROW = re.compile(r"(?<![a-z])(kal|kalke|tomorrow|agamikal)(?![a-z])|আগামীকাল|কালকে|কাল(?![ঀ-৿])")
_MORNING = re.compile(r"sokal|shokal|morning|সকাল")
_EVENING = re.compile(r"bikal|bikel|afternoon|evening|sondha|shondha|বিকাল|বিকেল|সন্ধ্যা")


def _to_utc(local: datetime) -> datetime:
    return local.replace(tzinfo=DHAKA_TZ).astimezone(UTC).replace(tzinfo=None)


def parse_deadline(t: str, now_utc: datetime) -> datetime | None:
    now_local = now_utc.replace(tzinfo=UTC).astimezone(DHAKA_TZ).replace(tzinfo=None)

    m = _HOURS.search(t)
    if m:
        return now_utc + timedelta(hours=int(m.group(1)))

    day = None
    if _TONIGHT.search(t):
        day, default_hour = now_local.date(), 22
    elif _TOMORROW.search(t):
        day, default_hour = (now_local + timedelta(days=1)).date(), 10
    elif _TODAY.search(t):
        day, default_hour = now_local.date(), 20

    hour = None
    c = _CLOCK.search(t)
    if c:
        hour = int(c.group(1)) % 24
        minute = int(c.group(2) or 0)
        suffix = c.group(3)
        if suffix == "pm" and hour < 12:
            hour += 12
        elif suffix in ("ta", "tay", "টা", "টায়", "টায়"):
            if _EVENING.search(t) or (_TONIGHT.search(t) and hour < 12):
                hour = hour + 12 if hour < 12 else hour
            elif not _MORNING.search(t) and hour < 7:
                hour += 12  # "5ta" with no context most likely means 5 pm
        if day is None:
            day = now_local.date()
            if datetime.combine(day, datetime.min.time()).replace(hour=hour, minute=minute) <= now_local:
                day = (now_local + timedelta(days=1)).date()
        return _to_utc(datetime.combine(day, datetime.min.time()).replace(hour=hour, minute=minute))

    if day is not None:
        if _MORNING.search(t):
            default_hour = 9
        elif _EVENING.search(t):
            default_hour = 17
        return _to_utc(datetime.combine(day, datetime.min.time()).replace(hour=default_hour))
    return None


def parse_urgency(t: str, needed_by: datetime | None, now_utc: datetime) -> str:
    if any(w in t for w in CRITICAL_WORDS):
        return "critical"
    if needed_by is not None and needed_by - now_utc <= timedelta(hours=6):
        return "critical"
    return "normal"


def parse_city(t: str) -> str | None:
    for k, v in CITIES.items():
        if re.search(r"[a-z]", k):
            if re.search(r"(?<![a-z])" + k + r"(?![a-z])", t):
                return v
        elif k in t:
            return v
    return None


def parse(text: str, hospitals: list[dict], now_utc: datetime) -> RuleParse:
    t = normalize(text)
    out = RuleParse()
    out.blood_group = parse_blood_group(t)
    out.units = parse_units(t)
    h = match_hospital(t, hospitals)
    if h:
        out.hospital_id = h["id"]
        out.hospital_name = h["name"]
        out.city = h.get("city")
    out.city = out.city or parse_city(t)
    out.needed_by = parse_deadline(t, now_utc)
    out.urgency = parse_urgency(t, out.needed_by, now_utc)
    out.contact_phone = parse_phone(t)
    return out
