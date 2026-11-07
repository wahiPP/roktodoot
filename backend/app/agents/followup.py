"""Follow-up Agent: confirms donations, restarts cooldowns, sends thanks and
eligibility reminders, and expires requests that found nobody."""

from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..config import get_settings
from ..events import record
from ..models import BloodRequest, Donation, DonorProfile, OutreachAttempt, RequestStatus, User
from ..notify import notify
from ..rules import get_rules


def confirm_donation(db: Session, req: BloodRequest, confirmed_by: User, now: datetime) -> None:
    if req.status != RequestStatus.ACCEPTED or req.accepted_donor_id is None:
        raise ValueError("Only an accepted request can be marked as fulfilled")
    db.add(Donation(request_id=req.id, donor_id=req.accepted_donor_id, confirmed_by=confirmed_by.id, donated_at=now))
    prof = db.get(DonorProfile, req.accepted_donor_id)
    if prof:
        prof.last_donation_date = now.date()
        prof.reminder_sent = False
    req.status = RequestStatus.FULFILLED
    req.fulfilled_at = now
    cooldown = get_rules()["cooldown_days"]
    record(
        db,
        req.id,
        "fulfilled",
        f"Donation confirmed. Donor rests for {cooldown} days.",
        {"cooldown_days": cooldown},
        now=now,
    )
    donor = db.get(User, req.accepted_donor_id)
    notify(db, donor, "thanks", email=True, request_id=req.id)
    minutes = int((now - req.created_at).total_seconds() // 60)
    notify(
        db,
        req.requester,
        "status_change",
        email=True,
        request_id=req.id,
        status="FULFILLED",
        summary=f"Donor found and donation confirmed {minutes} min after the request.",
    )


def expire_requests(db: Session, now: datetime) -> int:
    cutoff = now - timedelta(hours=get_settings().request_expiry_hours)
    stale = db.scalars(
        select(BloodRequest).where(
            BloodRequest.status.in_(RequestStatus.SEARCHING | {RequestStatus.HELD, RequestStatus.PARSED}),
            BloodRequest.created_at <= cutoff,
        )
    ).all()
    for req in stale:
        req.status = RequestStatus.EXPIRED
        req.wave_deadline = None
        db.execute(
            update(OutreachAttempt)
            .where(OutreachAttempt.request_id == req.id, OutreachAttempt.response.in_(["pending", "timeout"]))
            .values(response="closed")
        )
        record(db, req.id, "expired", f"Request expired after {get_settings().request_expiry_hours} hours", now=now)
        notify(db, req.requester, "status_change", request_id=req.id, status="EXPIRED")
    return len(stale)


def send_eligibility_reminders(db: Session, now: datetime) -> int:
    cooldown = get_rules()["cooldown_days"]
    eligible_since = now.date() - timedelta(days=cooldown)
    profiles = db.scalars(
        select(DonorProfile).where(
            DonorProfile.reminder_sent.is_(False),
            DonorProfile.last_donation_date.is_not(None),
            DonorProfile.last_donation_date <= eligible_since,
            DonorProfile.opt_out.is_(False),
        )
    ).all()
    for p in profiles:
        notify(db, p.user, "eligible_again", email=True)
        p.reminder_sent = True
    return len(profiles)
