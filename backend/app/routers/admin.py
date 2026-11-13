from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..agents import orchestrator
from ..auth import require_admin
from ..db import get_db, utcnow
from ..events import record
from ..models import BloodRequest, DonorProfile, RequestStatus, User
from ..notify import notify
from ..rules import get_rules
from ..schemas import Decision
from ..views import event_view, events_for, request_view

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/requests")
def list_requests(status: str | None = None, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = select(BloodRequest).order_by(BloodRequest.id.desc()).limit(200)
    if status:
        q = q.where(BloodRequest.status == status.upper())
    return [request_view(db, r, admin) for r in db.scalars(q)]


@router.post("/requests/{request_id}/decision")
def decide(request_id: int, body: Decision, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    req = db.get(BloodRequest, request_id)
    if req is None:
        raise HTTPException(404, "Request not found")
    if req.status != RequestStatus.HELD:
        raise HTTPException(409, "Only held requests can be reviewed")
    now = utcnow()
    if body.approve:
        record(
            db,
            req.id,
            "approved",
            f"Approved by admin {admin.name}" + (f": {body.reason}" if body.reason else ""),
            now=now,
        )
        orchestrator.approve_held(db, req, now)
    else:
        req.status = RequestStatus.REJECTED
        reason = body.reason or "Rejected after review"
        record(db, req.id, "rejected", f"Rejected by admin {admin.name}: {reason}", now=now)
        notify(db, req.requester, "request_rejected", email=True, request_id=req.id, reason=reason)
    db.commit()
    return request_view(db, req, admin)


@router.get("/requests/{request_id}/events")
def request_events(request_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.get(BloodRequest, request_id) is None:
        raise HTTPException(404, "Request not found")
    return [event_view(e) for e in events_for(db, request_id)]


@router.get("/stats")
def stats(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    by_group = dict(
        db.execute(
            select(BloodRequest.blood_group, func.count())
            .where(BloodRequest.status != RequestStatus.PARSED)
            .group_by(BloodRequest.blood_group)
        ).all()
    )
    by_status = dict(db.execute(select(BloodRequest.status, func.count()).group_by(BloodRequest.status)).all())
    fulfilled = by_status.get(RequestStatus.FULFILLED, 0)
    finished = fulfilled + by_status.get(RequestStatus.EXPIRED, 0) + by_status.get(RequestStatus.CANCELLED, 0)
    accepted = db.execute(
        select(BloodRequest.created_at, BloodRequest.accepted_at).where(BloodRequest.accepted_at.is_not(None))
    ).all()
    avg_min = (sum((a - c).total_seconds() for c, a in accepted) / len(accepted) / 60) if accepted else None
    donors_by_group = dict(
        db.execute(select(DonorProfile.blood_group, func.count()).group_by(DonorProfile.blood_group)).all()
    )
    available = db.scalar(
        select(func.count())
        .select_from(DonorProfile)
        .where(DonorProfile.available.is_(True), DonorProfile.opt_out.is_(False))
    )
    return {
        "requests_by_blood_group": {k or "unknown": v for k, v in by_group.items()},
        "requests_by_status": by_status,
        "fulfilment_rate": round(fulfilled / finished, 3) if finished else None,
        "avg_minutes_to_accept": round(avg_min, 1) if avg_min is not None else None,
        "donors_by_blood_group": donors_by_group,
        "donors_available": available,
        "donors_total": sum(donors_by_group.values()),
    }


@router.get("/config")
def config(admin: User = Depends(require_admin)):
    return get_rules()
