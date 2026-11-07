"""Background worker. Everything it needs lives in the database, so it is
restart-safe and can run in more than one process."""

import asyncio
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import db as dbmod
from .agents import followup, orchestrator
from .db import utcnow
from .models import BloodRequest, RequestStatus

log = logging.getLogger("roktodoot.worker")


def run_due_jobs(db: Session, now: datetime | None = None) -> dict:
    now = now or utcnow()
    due = db.scalars(
        select(BloodRequest).where(
            BloodRequest.status.in_([RequestStatus.WAVE_1, RequestStatus.WAVE_2, RequestStatus.WAVE_3]),
            BloodRequest.wave_deadline <= now,
        )
    ).all()
    escalated = 0
    for req in due:
        if orchestrator.run_escalation_check(db, req, now) == "escalate":
            escalated += 1
        db.commit()
    expired = followup.expire_requests(db, now)
    reminders = followup.send_eligibility_reminders(db, now)
    db.commit()
    return {"escalated": escalated, "expired": expired, "reminders": reminders}


def _tick() -> None:
    with dbmod.SessionLocal() as db:
        try:
            run_due_jobs(db)
        except Exception:  # keep the loop alive
            db.rollback()
            log.exception("Worker tick failed")


async def worker_loop(interval: float) -> None:
    log.info("Worker started (every %.1fs)", interval)
    while True:
        await asyncio.to_thread(_tick)
        await asyncio.sleep(interval)
