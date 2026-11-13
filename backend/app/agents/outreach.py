"""Outreach and Escalation Agent.

Contacts donors in waves. Wave deadlines are stored in the database, so a
restart never loses or stalls a running request (NFR-10).
"""

from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..config import get_settings
from ..events import record
from ..geo import haversine_km
from ..models import BloodBank, BloodRequest, DonorProfile, OutreachAttempt, RequestStatus, User
from ..notify import notify
from ..rules import last_wave_number, wave_config
from . import matching

WAVE_STATUS = {1: RequestStatus.WAVE_1, 2: RequestStatus.WAVE_2, 3: RequestStatus.WAVE_3}


def wave_timeout(wave: int, urgency: str) -> timedelta:
    cfg = wave_config(wave)
    minutes = cfg["timeout_min"]["critical" if urgency == "critical" else "normal"]
    return timedelta(seconds=minutes * get_settings().seconds_per_minute)


def start_wave(db: Session, req: BloodRequest, wave: int, now: datetime) -> None:
    """Start `wave`. If it finds nobody new, move straight on to the next one."""
    while True:
        if wave > last_wave_number():
            start_bank_fallback(db, req, now)
            return

        cfg = wave_config(wave)
        already = set(db.scalars(select(OutreachAttempt.donor_id).where(OutreachAttempt.request_id == req.id)))
        candidates = matching.find_candidates(db, req, cfg["radius_km"], now, exclude_user_ids=already)
        if cfg["size"]:
            candidates = candidates[: cfg["size"]]

        req.status = WAVE_STATUS[wave]
        req.current_wave = wave
        req.wave_deadline = now + wave_timeout(wave, req.urgency)
        hospital = req.hospital_name or "the hospital"

        for c in candidates:
            db.add(
                OutreachAttempt(
                    request_id=req.id,
                    donor_id=c.user_id,
                    wave=wave,
                    distance_km=c.distance_km,
                    score=c.score,
                    sent_at=now,
                )
            )
            prof = db.get(DonorProfile, c.user_id)
            prof.contacted_count += 1
            notify(
                db,
                db.get(User, c.user_id),
                "donor_request",
                sms=True,
                request_id=req.id,
                blood_group=req.blood_group,
                hospital=hospital,
                distance_km=c.distance_km,
                wave=wave,
            )

        record(
            db,
            req.id,
            "wave_started",
            f"Wave {wave} started: {len(candidates)} donor(s) within {cfg['radius_km']} km",
            {
                "wave": wave,
                "radius_km": cfg["radius_km"],
                "contacted": len(candidates),
                "deadline": req.wave_deadline.isoformat(),
                "ranked": [
                    {"score": c.score, "distance_km": c.distance_km, "group": c.blood_group, **c.breakdown}
                    for c in candidates[:10]
                ],
            },
            now=now,
        )
        db.flush()

        if candidates:
            return
        record(
            db,
            req.id,
            "wave_empty",
            f"No new eligible donors in wave {wave}; widening the search",
            {"wave": wave},
            now=now,
        )
        wave += 1


def start_bank_fallback(db: Session, req: BloodRequest, now: datetime) -> None:
    req.status = RequestStatus.BANK_FALLBACK
    req.current_wave = last_wave_number() + 1
    req.wave_deadline = None
    banks = nearest_banks(db, req)
    record(
        db,
        req.id,
        "bank_fallback",
        "No donor accepted in any wave. Showing nearest blood banks and alerting admins.",
        {
            "banks": [b["name"] for b in banks],
        },
        now=now,
    )
    notify(db, req.requester, "bank_fallback", email=True, request_id=req.id)
    for admin in db.scalars(select(User).where(User.role == "admin")):
        notify(db, admin, "bank_fallback", request_id=req.id)


def nearest_banks(db: Session, req: BloodRequest, limit: int = 5) -> list[dict]:
    banks = db.scalars(select(BloodBank)).all()
    if req.lat is None:
        return []
    ranked = sorted(banks, key=lambda b: haversine_km(req.lat, req.lng, b.lat, b.lng))[:limit]
    return [
        {
            "id": b.id,
            "name": b.name,
            "phone": b.phone,
            "lat": b.lat,
            "lng": b.lng,
            "distance_km": round(haversine_km(req.lat, req.lng, b.lat, b.lng), 1),
        }
        for b in ranked
    ]


def finish_wave_and_escalate(db: Session, req: BloodRequest, now: datetime, reason: str = "timeout") -> None:
    wave = req.current_wave
    db.execute(
        update(OutreachAttempt)
        .where(
            OutreachAttempt.request_id == req.id, OutreachAttempt.wave == wave, OutreachAttempt.response == "pending"
        )
        .values(response="timeout")
    )
    msg = f"Wave {wave} finished with no acceptance"
    if reason == "all_declined":
        msg = f"Everyone in wave {wave} declined"
    record(db, req.id, "wave_finished", msg, {"wave": wave, "reason": reason}, now=now)
    start_wave(db, req, wave + 1, now)


def respond(db: Session, req: BloodRequest, donor: User, accept: bool, now: datetime) -> str:
    """Record a donor's answer. Returns the resulting attempt response."""
    attempt = db.scalar(
        select(OutreachAttempt).where(OutreachAttempt.request_id == req.id, OutreachAttempt.donor_id == donor.id)
    )
    if attempt is None:
        raise PermissionError("You were not contacted for this request")
    if attempt.response not in ("pending", "timeout"):
        raise ValueError(f"Already answered ({attempt.response})")
    if req.status not in RequestStatus.SEARCHING:
        attempt.response = "closed"
        raise ValueError("This request is no longer looking for donors")

    label = db.get(DonorProfile, donor.id).label if db.get(DonorProfile, donor.id) else "donor"

    if not accept:
        attempt.response = "declined"
        attempt.responded_at = now
        record(db, req.id, "donor_declined", f"Donor {label} declined", {"wave": attempt.wave}, now=now)
        db.flush()
        pending = db.scalar(
            select(OutreachAttempt.id)
            .where(
                OutreachAttempt.request_id == req.id,
                OutreachAttempt.wave == req.current_wave,
                OutreachAttempt.response == "pending",
            )
            .limit(1)
        )
        if pending is None and req.status in (RequestStatus.WAVE_1, RequestStatus.WAVE_2, RequestStatus.WAVE_3):
            finish_wave_and_escalate(db, req, now, reason="all_declined")
        return "declined"

    # Accept: a conditional update makes sure only one donor can win, even if two
    # accept at the same moment.
    won = db.execute(
        update(BloodRequest)
        .where(BloodRequest.id == req.id, BloodRequest.status.in_(RequestStatus.SEARCHING))
        .values(status=RequestStatus.ACCEPTED, accepted_donor_id=donor.id, accepted_at=now, wave_deadline=None)
        .execution_options(synchronize_session=False)
    ).rowcount
    if not won:
        attempt.response = "closed"
        raise ValueError("Another donor has already accepted")
    db.refresh(req)

    attempt.response = "accepted"
    attempt.responded_at = now
    db.execute(
        update(OutreachAttempt)
        .where(
            OutreachAttempt.request_id == req.id,
            OutreachAttempt.id != attempt.id,
            OutreachAttempt.response.in_(["pending", "timeout"]),
        )
        .values(response="closed")
    )
    prof = db.get(DonorProfile, donor.id)
    if prof:
        prof.accepted_count += 1
    record(
        db, req.id, "donor_accepted", f"Donor {label} accepted in wave {attempt.wave}", {"wave": attempt.wave}, now=now
    )
    notify(db, req.requester, "donor_accepted", email=True, sms=True, request_id=req.id, donor_phone=donor.phone or "")
    return "accepted"
