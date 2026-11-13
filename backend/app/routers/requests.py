import time
from collections import defaultdict, deque
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..agents import followup, intake, orchestrator, outreach
from ..auth import get_current_user
from ..config import Settings, get_settings
from ..db import get_db, utcnow
from ..events import record
from ..mapview import snapshot
from ..models import BloodRequest, Hospital, OutreachAttempt, RequestStatus, User
from ..notify import notify
from ..schemas import RequestCreate, RequestUpdate, Respond
from ..views import request_view

router = APIRouter(prefix="/requests", tags=["requests"])

_rate: dict[int, deque] = defaultdict(deque)


def _rate_limit(user_id: int, settings: Settings) -> None:
    now = time.monotonic()
    q = _rate[user_id]
    while q and now - q[0] > settings.request_rate_window_seconds:
        q.popleft()
    if len(q) >= settings.request_rate_limit:
        raise HTTPException(429, "Too many requests. Please wait a few minutes.")
    q.append(now)


def _naive_utc(dt: datetime | None) -> datetime | None:
    if dt is None or dt.tzinfo is None:
        return dt
    return dt.astimezone(UTC).replace(tzinfo=None)


def hospital_dicts(db: Session) -> list[dict]:
    return [
        {"id": h.id, "name": h.name, "aliases": h.aliases or [], "city": h.city} for h in db.scalars(select(Hospital))
    ]


def _apply_hospital(db: Session, req: BloodRequest, hospital_id: int) -> None:
    h = db.get(Hospital, hospital_id)
    if h is None:
        raise HTTPException(422, "Unknown hospital")
    req.hospital_id, req.hospital_name, req.city, req.lat, req.lng = h.id, h.name, h.city, h.lat, h.lng


def get_request_or_404(db: Session, request_id: int) -> BloodRequest:
    req = db.get(BloodRequest, request_id)
    if req is None:
        raise HTTPException(404, "Request not found")
    return req


def require_owner_or_admin(req: BloodRequest, user: User) -> None:
    if user.role != "admin" and req.requester_id != user.id:
        raise HTTPException(403, "Not your request")


@router.post("", status_code=201)
def create_request(
    body: RequestCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    if not body.text.strip() and not body.blood_group:
        raise HTTPException(422, "Describe the need or fill in the form")
    _rate_limit(user.id, settings)
    now = utcnow()
    parsed = (
        intake.parse_request(body.text, hospital_dicts(db), now)
        if body.text.strip()
        else {
            "blood_group": None,
            "units": None,
            "hospital_id": None,
            "hospital_name": None,
            "city": None,
            "needed_by": None,
            "urgency": "normal",
            "contact_phone": None,
            "source": "form",
        }
    )

    req = BloodRequest(
        requester_id=user.id,
        raw_text=body.text.strip(),
        status=RequestStatus.PARSED,
        created_at=now,
        blood_group=body.blood_group or parsed["blood_group"],
        units=body.units or parsed["units"],
        hospital_name=parsed["hospital_name"],
        city=parsed["city"],
        needed_by=_naive_utc(body.needed_by) or parsed["needed_by"],
        urgency=body.urgency or parsed["urgency"],
        contact_phone=body.contact_phone or parsed["contact_phone"] or user.phone,
        parsed={
            "source": parsed["source"],
            "needed_by": parsed["needed_by"].isoformat() if parsed["needed_by"] else None,
        },
    )
    db.add(req)
    db.flush()
    hid = body.hospital_id or parsed["hospital_id"]
    if hid:
        _apply_hospital(db, req, hid)
    record(
        db,
        req.id,
        "parsed",
        f"Intake agent parsed the request ({parsed['source']})",
        {
            "source": parsed["source"],
            "blood_group": req.blood_group,
            "units": req.units,
            "hospital": req.hospital_name,
            "urgency": req.urgency,
        },
        now=now,
    )
    db.commit()
    return request_view(db, req, user)


@router.get("/mine")
def my_requests(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reqs = db.scalars(select(BloodRequest).where(BloodRequest.requester_id == user.id).order_by(BloodRequest.id.desc()))
    return [request_view(db, r, user) for r in reqs]


@router.get("/{request_id}")
def get_request(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = get_request_or_404(db, request_id)
    if user.role != "admin" and req.requester_id != user.id:
        contacted = db.scalar(
            select(OutreachAttempt.id).where(OutreachAttempt.request_id == req.id, OutreachAttempt.donor_id == user.id)
        )
        if not contacted:
            raise HTTPException(403, "Not your request")
    return request_view(db, req, user)


@router.patch("/{request_id}")
def edit_request(
    request_id: int, body: RequestUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    req = get_request_or_404(db, request_id)
    require_owner_or_admin(req, user)
    if req.status != RequestStatus.PARSED:
        raise HTTPException(409, "Only unconfirmed requests can be edited")
    data = body.model_dump(exclude_unset=True)
    if "hospital_id" in data and data["hospital_id"]:
        _apply_hospital(db, req, data.pop("hospital_id"))
    if "needed_by" in data:
        data["needed_by"] = _naive_utc(data["needed_by"])
    for k, v in data.items():
        if v is not None:
            setattr(req, k, v)
    db.commit()
    return request_view(db, req, user)


@router.post("/{request_id}/confirm")
def confirm_request(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = get_request_or_404(db, request_id)
    if req.requester_id != user.id:
        raise HTTPException(403, "Only the requester can confirm")
    if req.status != RequestStatus.PARSED:
        raise HTTPException(409, f"Request is already {req.status}")
    missing = intake.missing_fields(
        {
            "blood_group": req.blood_group,
            "units": req.units,
            "hospital_id": req.hospital_id,
            "hospital_name": req.hospital_name,
            "contact_phone": req.contact_phone,
        }
    )
    if req.lat is None and "hospital" not in missing:
        missing.append("hospital")  # we need a known hospital to search around
    if missing:
        raise HTTPException(
            422,
            {
                "message": "Some details are missing",
                "missing": missing,
                "follow_up": intake.follow_up_question(missing),
            },
        )
    decision = orchestrator.run_confirm(db, req, utcnow())
    db.commit()
    return {"decision": decision, "request": request_view(db, req, user)}


@router.get("/{request_id}/map")
def request_map(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = get_request_or_404(db, request_id)
    require_owner_or_admin(req, user)
    return snapshot(db, req)


@router.post("/{request_id}/respond")
def respond(request_id: int, body: Respond, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = get_request_or_404(db, request_id)
    try:
        result = outreach.respond(db, req, user, body.accept, utcnow())
    except PermissionError as e:
        raise HTTPException(403, str(e)) from e
    except ValueError as e:
        db.commit()
        raise HTTPException(409, str(e)) from e
    db.commit()
    return {"response": result, "request": request_view(db, req, user)}


@router.post("/{request_id}/fulfil")
def fulfil(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = get_request_or_404(db, request_id)
    require_owner_or_admin(req, user)
    try:
        followup.confirm_donation(db, req, user, utcnow())
    except ValueError as e:
        raise HTTPException(409, str(e)) from e
    db.commit()
    return request_view(db, req, user)


@router.post("/{request_id}/cancel")
def cancel(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = get_request_or_404(db, request_id)
    require_owner_or_admin(req, user)
    if req.status in RequestStatus.CLOSED:
        raise HTTPException(409, f"Request is already {req.status}")
    now = utcnow()
    req.status = RequestStatus.CANCELLED
    req.wave_deadline = None
    for a in db.scalars(
        select(OutreachAttempt).where(
            OutreachAttempt.request_id == req.id, OutreachAttempt.response.in_(["pending", "timeout"])
        )
    ):
        a.response = "closed"
    who = "admin" if user.role == "admin" and user.id != req.requester_id else "requester"
    record(db, req.id, "cancelled", f"Cancelled by {who}", now=now)
    if who == "admin":
        notify(db, req.requester, "status_change", request_id=req.id, status="CANCELLED")
    db.commit()
    return request_view(db, req, user)
