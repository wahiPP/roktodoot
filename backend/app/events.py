"""Audit log helpers. Every agent step is stored as a RequestEvent."""

from sqlalchemy.orm import Session

from .db import utcnow
from .models import RequestEvent


def record(
    db: Session, request_id: int, type_: str, message: str, payload: dict | None = None, now=None
) -> RequestEvent:
    ev = RequestEvent(
        request_id=request_id,
        type=type_,
        message=message,
        payload=payload or {},
        created_at=now or utcnow(),
    )
    db.add(ev)
    return ev
