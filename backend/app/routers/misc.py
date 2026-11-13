from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import BloodBank, Hospital, Notification, User
from ..views import iso

router = APIRouter(tags=["misc"])


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/hospitals")
def hospitals(db: Session = Depends(get_db)):
    return [
        {"id": h.id, "name": h.name, "city": h.city, "lat": h.lat, "lng": h.lng, "verified": h.verified}
        for h in db.scalars(select(Hospital).order_by(Hospital.name))
    ]


@router.get("/blood-banks")
def blood_banks(db: Session = Depends(get_db)):
    return [
        {"id": b.id, "name": b.name, "city": b.city, "phone": b.phone, "lat": b.lat, "lng": b.lng}
        for b in db.scalars(select(BloodBank))
    ]


@router.get("/notifications")
def notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(50)
    )
    return [
        {"id": n.id, "type": n.type, "payload": n.payload, "read": n.read, "created_at": iso(n.created_at)}
        for n in rows
    ]


@router.post("/notifications/{nid}/read")
def mark_read(nid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, nid)
    if n is None or n.user_id != user.id:
        raise HTTPException(404, "Not found")
    n.read = True
    db.commit()
    return {"ok": True}
