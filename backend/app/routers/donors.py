import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db, utcnow
from ..models import BloodRequest, DonorProfile, OutreachAttempt, RequestStatus, User
from ..schemas import Availability, DonorIn
from ..views import donor_view, inbox_item

router = APIRouter(prefix="/donors", tags=["donors"])


def new_label() -> str:
    return "D-" + secrets.token_hex(2).upper()


@router.post("")
def upsert_donor(body: DonorIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prof = db.get(DonorProfile, user.id)
    if prof is None:
        prof = DonorProfile(
            user_id=user.id,
            label=new_label(),
            consent_at=utcnow(),
            blood_group=body.blood_group,
            lat=body.lat,
            lng=body.lng,
        )
        db.add(prof)
    prof.blood_group = body.blood_group
    prof.lat, prof.lng = body.lat, body.lng
    prof.area = body.area
    prof.last_donation_date = body.last_donation_date
    prof.available = body.available
    prof.opt_out = False
    prof.consent_at = prof.consent_at or utcnow()
    if user.phone != body.phone:
        user.phone = body.phone
        user.phone_verified = False
    db.commit()
    return donor_view(prof)


@router.get("/me")
def get_my_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prof = db.get(DonorProfile, user.id)
    if prof is None:
        raise HTTPException(404, "You are not registered as a donor")
    return donor_view(prof)


@router.patch("/me/availability")
def set_availability(body: Availability, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prof = db.get(DonorProfile, user.id)
    if prof is None:
        raise HTTPException(404, "You are not registered as a donor")
    prof.available = body.available
    db.commit()
    return donor_view(prof)


@router.delete("/me")
def delete_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Opt out and delete donor data (NFR-04, US-09)."""
    prof = db.get(DonorProfile, user.id)
    if prof is None:
        raise HTTPException(404, "You are not registered as a donor")
    # Close any open outreach so this donor is never contacted again.
    for a in db.scalars(
        select(OutreachAttempt).where(
            OutreachAttempt.donor_id == user.id, OutreachAttempt.response.in_(["pending", "timeout"])
        )
    ):
        a.response = "closed"
    db.delete(prof)
    user.phone = None
    user.phone_verified = False
    db.commit()
    return {"deleted": True}


@router.get("/inbox")
def inbox(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    attempts = db.scalars(
        select(OutreachAttempt)
        .join(BloodRequest, BloodRequest.id == OutreachAttempt.request_id)
        .where(OutreachAttempt.donor_id == user.id)
        .order_by(OutreachAttempt.sent_at.desc())
        .limit(50)
    ).all()
    items = [inbox_item(db, a) for a in attempts]
    open_items = [
        i for i in items if i["status"] in RequestStatus.SEARCHING and i["response"] in ("pending", "timeout")
    ]
    history = [i for i in items if i not in open_items]
    return {"open": open_items, "history": history}
