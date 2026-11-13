"""Turns database rows into API responses. Privacy rules live here."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .agents import intake
from .models import BloodRequest, DonorProfile, OutreachAttempt, RequestEvent, RequestStatus, User


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() + "Z" if dt else None


def user_view(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "name": u.name,
        "role": u.role,
        "phone": u.phone,
        "phone_verified": u.phone_verified,
        "is_donor": u.donor_profile is not None,
    }


def donor_view(p: DonorProfile) -> dict:
    return {
        "blood_group": p.blood_group,
        "lat": p.lat,
        "lng": p.lng,
        "area": p.area,
        "last_donation_date": p.last_donation_date.isoformat() if p.last_donation_date else None,
        "available": p.available,
        "opt_out": p.opt_out,
        "consent_at": iso(p.consent_at),
        "contacted_count": p.contacted_count,
        "accepted_count": p.accepted_count,
        "label": p.label,
    }


def can_view_private(req: BloodRequest, viewer: User) -> bool:
    return viewer.role == "admin" or viewer.id == req.requester_id


def request_view(db: Session, req: BloodRequest, viewer: User) -> dict:
    fields = {
        "blood_group": req.blood_group,
        "units": req.units,
        "hospital_id": req.hospital_id,
        "hospital_name": req.hospital_name,
        "contact_phone": req.contact_phone,
    }
    missing = intake.missing_fields(fields)
    out = {
        "id": req.id,
        "status": req.status,
        "blood_group": req.blood_group,
        "units": req.units,
        "hospital_id": req.hospital_id,
        "hospital_name": req.hospital_name,
        "city": req.city,
        "lat": req.lat,
        "lng": req.lng,
        "needed_by": iso(req.needed_by),
        "urgency": req.urgency,
        "current_wave": req.current_wave,
        "wave_deadline": iso(req.wave_deadline),
        "trust_score": req.trust_score,
        "created_at": iso(req.created_at),
        "accepted_at": iso(req.accepted_at),
        "fulfilled_at": iso(req.fulfilled_at),
        "is_mine": viewer.id == req.requester_id,
        "donor_contact": None,
        "requester_contact": None,
    }
    private = can_view_private(req, viewer)
    if private:
        out.update(
            raw_text=req.raw_text,
            contact_phone=req.contact_phone,
            parse_source=(req.parsed or {}).get("source"),
            missing=missing,
            follow_up=intake.follow_up_question(missing),
        )
        # FR-12: donor contact only after the donor accepts.
        if req.status in (RequestStatus.ACCEPTED, RequestStatus.FULFILLED) and req.accepted_donor_id:
            donor = db.get(User, req.accepted_donor_id)
            prof = db.get(DonorProfile, donor.id)
            out["donor_contact"] = {
                "name": donor.name.split(" ")[0] if donor.name else "Donor",
                "phone": donor.phone,
                "blood_group": prof.blood_group if prof else None,
                "label": prof.label if prof else None,
            }
    elif req.accepted_donor_id == viewer.id and req.status in (RequestStatus.ACCEPTED, RequestStatus.FULFILLED):
        # The donor who accepted can reach the family.
        out["requester_contact"] = {"phone": req.contact_phone}

    if viewer.role == "admin":
        out.update(
            trust_reasons=req.trust_reasons,
            trust_note=(req.parsed or {}).get("trust_note"),
            requester_id=req.requester_id,
        )
    return out


def inbox_item(db: Session, attempt: OutreachAttempt) -> dict:
    req = db.get(BloodRequest, attempt.request_id)
    return {
        "request_id": req.id,
        "blood_group": req.blood_group,
        "units": req.units,
        "hospital_name": req.hospital_name,
        "city": req.city,
        "urgency": req.urgency,
        "needed_by": iso(req.needed_by),
        "distance_km": attempt.distance_km,
        "wave": attempt.wave,
        "status": req.status,
        "response": attempt.response,
        "sent_at": iso(attempt.sent_at),
        # never the requester's phone here (FR-12)
    }


def event_view(e: RequestEvent) -> dict:
    return {"id": e.id, "type": e.type, "message": e.message, "payload": e.payload, "created_at": iso(e.created_at)}


def events_for(db: Session, request_id: int) -> list[RequestEvent]:
    return list(db.scalars(select(RequestEvent).where(RequestEvent.request_id == request_id).order_by(RequestEvent.id)))
