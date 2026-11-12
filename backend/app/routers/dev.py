"""Demo helpers: simulate donors and skip wave timers.

Only mounted when dev login is enabled, so they never exist in production.
"""

import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..agents import outreach
from ..auth import require_admin
from ..db import get_db, utcnow
from ..models import BloodRequest, OutreachAttempt, RequestStatus, User

router = APIRouter(prefix="/dev", tags=["dev (demo only)"])


@router.post("/requests/{request_id}/skip-wave")
def skip_wave(request_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """End the current wave now, as if its timer ran out."""
    req = db.get(BloodRequest, request_id)
    if req is None or req.status not in (RequestStatus.WAVE_1, RequestStatus.WAVE_2, RequestStatus.WAVE_3):
        raise HTTPException(409, "Request is not in a wave")
    outreach.finish_wave_and_escalate(db, req, utcnow(), reason="timeout")
    db.commit()
    return {"status": req.status, "wave": req.current_wave}


@router.post("/requests/{request_id}/simulate")
def simulate(
    request_id: int, action: str = "accept", admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    """Make one contacted donor accept or decline (action=accept|decline)."""
    req = db.get(BloodRequest, request_id)
    if req is None or req.status not in RequestStatus.SEARCHING:
        raise HTTPException(409, "Request is not searching")
    pending = db.scalars(
        select(OutreachAttempt).where(OutreachAttempt.request_id == req.id, OutreachAttempt.response == "pending")
    ).all()
    if not pending:
        raise HTTPException(409, "No donor is waiting to answer")
    attempt = random.choice(pending)
    donor = db.get(User, attempt.donor_id)
    result = outreach.respond(db, req, donor, action == "accept", utcnow())
    db.commit()
    return {"donor_id": donor.id, "response": result, "status": req.status}
