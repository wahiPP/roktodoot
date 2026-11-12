"""Live escalation map snapshot (SRS 6.5).

Privacy (FR-20): donor positions rounded to ~1 km, random labels only,
no names and no phone numbers anywhere in this payload.
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .agents.outreach import nearest_banks
from .db import utcnow
from .geo import approx
from .models import BloodRequest, DonorProfile, OutreachAttempt, RequestStatus
from .rules import get_rules
from .views import event_view, events_for, iso

STATUS_MAP = {
    "pending": "waiting",
    "accepted": "accepted",
    "declined": "declined",
    "timeout": "no_reply",
    "closed": "closed",
}

TIMELINE_TYPES = {
    "parsed",
    "confirmed",
    "trust_scored",
    "held",
    "approved",
    "rejected",
    "wave_started",
    "wave_empty",
    "wave_finished",
    "donor_accepted",
    "donor_declined",
    "bank_fallback",
    "fulfilled",
    "cancelled",
    "expired",
}


def snapshot(db: Session, req: BloodRequest, now: datetime | None = None) -> dict:
    now = now or utcnow()
    rings = []
    for w in get_rules()["waves"]:
        if req.current_wave > w["wave"] or req.status in (RequestStatus.BANK_FALLBACK,):
            state = "done"
        elif req.current_wave == w["wave"] and req.status in RequestStatus.SEARCHING:
            state = "active"
        elif req.current_wave == w["wave"]:
            state = "done"
        else:
            state = "pending"
        rings.append({"wave": w["wave"], "radius_km": w["radius_km"], "state": state})

    donors = []
    rows = db.execute(
        select(OutreachAttempt, DonorProfile)
        .join(DonorProfile, DonorProfile.user_id == OutreachAttempt.donor_id)
        .where(OutreachAttempt.request_id == req.id)
        .order_by(OutreachAttempt.id)
    ).all()
    for a, p in rows:
        donors.append(
            {
                "label": p.label,
                "lat": approx(p.lat),
                "lng": approx(p.lng),
                "status": STATUS_MAP.get(a.response, a.response),
                "wave": a.wave,
                "distance_km": round(a.distance_km, 1),
            }
        )

    seconds_left = None
    if req.wave_deadline and req.status in RequestStatus.SEARCHING:
        seconds_left = max(0, int((req.wave_deadline - now).total_seconds()))

    return {
        "request_id": req.id,
        "status": req.status,
        "blood_group": req.blood_group,
        "urgency": req.urgency,
        "hospital": {"name": req.hospital_name, "lat": req.lat, "lng": req.lng},
        "current_wave": req.current_wave,
        "rings": rings,
        "donors": donors,
        "wave_deadline": iso(req.wave_deadline),
        "seconds_left": seconds_left,
        "blood_banks": nearest_banks(db, req) if req.status == RequestStatus.BANK_FALLBACK else [],
        "timeline": [
            {k: v for k, v in event_view(e).items() if k != "payload"}
            for e in events_for(db, req.id)
            if e.type in TIMELINE_TYPES
        ],
    }
