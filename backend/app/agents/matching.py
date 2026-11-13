"""Matching Agent: finds eligible donors and ranks them.

Deterministic: bounding-box SQL pre-filter, then haversine distance and the
weighted score from SRS section 6.3.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..geo import bounding_box, haversine_km
from ..models import BloodRequest, DonorProfile, OutreachAttempt, User
from ..rules import compatible_donor_groups, get_rules


@dataclass
class Candidate:
    user_id: int
    blood_group: str
    distance_km: float
    score: float
    breakdown: dict


def in_cooldown(last_donation: date | None, today: date, cooldown_days: int) -> bool:
    return last_donation is not None and (today - last_donation).days < cooldown_days


def readiness(last_donation: date | None, today: date, cooldown_days: int) -> float:
    if last_donation is None:
        return 1.0
    return min((today - last_donation).days / (2 * cooldown_days), 1.0)


def response_rate(contacted: int, accepted: int, default: float) -> float:
    return accepted / contacted if contacted else default


def score_donor(distance_km: float, max_radius_km: float, rate: float, ready: float, exact: bool) -> tuple[float, dict]:
    w = get_rules()["ranking_weights"]
    parts = {
        "proximity": 1 - min(distance_km / max_radius_km, 1),
        "response_rate": rate,
        "readiness": ready,
        "exact_match": 1.0 if exact else 0.0,
    }
    total = sum(w[k] * v for k, v in parts.items())
    return round(total, 4), {k: round(v, 3) for k, v in parts.items()}


def find_candidates(
    db: Session,
    req: BloodRequest,
    radius_km: float,
    now: datetime,
    exclude_user_ids: set[int] | None = None,
) -> list[Candidate]:
    rules = get_rules()
    cooldown = rules["cooldown_days"]
    today = now.date()
    groups = compatible_donor_groups(req.blood_group or "")
    if not groups or req.lat is None or req.lng is None:
        return []

    min_lat, max_lat, min_lng, max_lng = bounding_box(req.lat, req.lng, radius_km)

    week_ago = now - timedelta(days=7)
    recent_contacts = (
        select(OutreachAttempt.donor_id, func.count().label("n"))
        .where(OutreachAttempt.sent_at >= week_ago)
        .group_by(OutreachAttempt.donor_id)
        .subquery()
    )

    rows = db.execute(
        select(DonorProfile, func.coalesce(recent_contacts.c.n, 0))
        .join(User, User.id == DonorProfile.user_id)
        .outerjoin(recent_contacts, recent_contacts.c.donor_id == DonorProfile.user_id)
        .where(
            DonorProfile.blood_group.in_(groups),
            DonorProfile.available.is_(True),
            DonorProfile.opt_out.is_(False),
            DonorProfile.lat.between(min_lat, max_lat),
            DonorProfile.lng.between(min_lng, max_lng),
            DonorProfile.user_id != req.requester_id,
        )
    ).all()

    exclude = exclude_user_ids or set()
    out: list[Candidate] = []
    for p, contacts_this_week in rows:
        if p.user_id in exclude:
            continue
        if contacts_this_week >= rules["max_contacts_per_week"]:
            continue  # FR-21: donor fatigue
        if in_cooldown(p.last_donation_date, today, cooldown):
            continue
        d = haversine_km(req.lat, req.lng, p.lat, p.lng)
        if d > radius_km:
            continue
        rate = response_rate(p.contacted_count, p.accepted_count, rules["default_response_rate"])
        s, parts = score_donor(
            d, radius_km, rate, readiness(p.last_donation_date, today, cooldown), p.blood_group == req.blood_group
        )
        out.append(Candidate(p.user_id, p.blood_group, round(d, 2), s, parts))

    # Exact group first is already rewarded by the score; ties broken by distance.
    out.sort(key=lambda c: (-c.score, c.distance_km))
    return out
