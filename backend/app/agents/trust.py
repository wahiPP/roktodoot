"""Trust Agent: scores how genuine a request looks and decides publish / hold / reject.

The score comes from weighted rules only (explainable, testable). A short note is
written for admins explaining which signals fired.
"""

from datetime import datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..models import BloodRequest, Hospital, RequestStatus, User
from ..rules import get_rules

PUBLISH, HOLD, REJECT = "publish", "hold", "reject"

_DUPLICATE_STATUSES = RequestStatus.SEARCHING | {RequestStatus.HELD, RequestStatus.ACCEPTED}


def evaluate(db: Session, req: BloodRequest, now: datetime) -> dict:
    cfg = get_rules()["trust"]
    score = cfg["base"]
    reasons: list[dict] = [{"signal": "base", "effect": cfg["base"], "detail": "Starting score"}]

    def add(signal: str, effect: int, detail: str):
        nonlocal score
        score += effect
        reasons.append({"signal": signal, "effect": effect, "detail": detail})

    requester = db.get(User, req.requester_id)

    if requester and requester.phone_verified:
        add("phone_verified", cfg["phone_verified"], "Requester's phone number is verified")

    hospital = db.get(Hospital, req.hospital_id) if req.hospital_id else None
    if hospital and hospital.verified:
        add("known_hospital", cfg["known_hospital"], f"Hospital matches known list: {hospital.name}")

    if req.blood_group and req.units and req.needed_by and req.contact_phone:
        add("complete", cfg["complete"], "Blood group, units, deadline and contact are all present")

    fulfilled_before = db.scalar(
        select(func.count())
        .select_from(BloodRequest)
        .where(
            BloodRequest.requester_id == req.requester_id,
            BloodRequest.status == RequestStatus.FULFILLED,
            BloodRequest.id != req.id,
        )
    )
    if fulfilled_before:
        add("fulfilled_history", cfg["fulfilled_history"], f"Requester has {fulfilled_before} fulfilled request(s)")

    same_place = (
        BloodRequest.hospital_id == req.hospital_id
        if req.hospital_id
        else BloodRequest.hospital_name == req.hospital_name
    )
    same_person = [BloodRequest.requester_id == req.requester_id]
    if req.contact_phone:
        same_person.append(BloodRequest.contact_phone == req.contact_phone)
    duplicate = db.scalar(
        select(BloodRequest.id)
        .where(
            BloodRequest.id != req.id,
            BloodRequest.status.in_(_DUPLICATE_STATUSES),
            BloodRequest.blood_group == req.blood_group,
            same_place,
            or_(*same_person),
        )
        .limit(1)
    )
    if duplicate:
        add("duplicate", cfg["duplicate"], f"Looks like a duplicate of open request #{duplicate}")

    window_start = now - timedelta(hours=cfg["too_many_window_hours"])
    recent = db.scalar(
        select(func.count())
        .select_from(BloodRequest)
        .where(
            BloodRequest.requester_id == req.requester_id,
            BloodRequest.id != req.id,
            BloodRequest.status != RequestStatus.PARSED,
            BloodRequest.created_at >= window_start,
        )
    )
    if recent >= cfg["too_many_threshold"]:
        add(
            "too_many_requests",
            cfg["too_many_requests"],
            f"{recent} other requests in the last {cfg['too_many_window_hours']} h",
        )

    score = max(0, min(100, score))
    if score >= cfg["publish_at"]:
        decision = PUBLISH
    elif score >= cfg["hold_at"]:
        decision = HOLD
    else:
        decision = REJECT

    return {"score": score, "reasons": reasons, "decision": decision, "note": admin_note(score, reasons, decision)}


def admin_note(score: int, reasons: list[dict], decision: str) -> str:
    plus = [r["detail"] for r in reasons if r["effect"] > 0 and r["signal"] != "base"]
    minus = [r["detail"] for r in reasons if r["effect"] < 0]
    parts = [f"Score {score}/100, decision: {decision}."]
    if plus:
        parts.append("In favour: " + "; ".join(plus) + ".")
    if minus:
        parts.append("Against: " + "; ".join(minus) + ".")
    if not minus and decision != PUBLISH:
        parts.append("Not enough positive signals (e.g. unverified phone or unknown hospital).")
    return " ".join(parts)
