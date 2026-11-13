"""Database tables (SRS section 8)."""

from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, utcnow


class RequestStatus:
    PARSED = "PARSED"
    HELD = "HELD"
    REJECTED = "REJECTED"
    WAVE_1 = "WAVE_1"
    WAVE_2 = "WAVE_2"
    WAVE_3 = "WAVE_3"
    BANK_FALLBACK = "BANK_FALLBACK"
    ACCEPTED = "ACCEPTED"
    FULFILLED = "FULFILLED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"

    SEARCHING = {WAVE_1, WAVE_2, WAVE_3, BANK_FALLBACK}
    OPEN = {PARSED, HELD, WAVE_1, WAVE_2, WAVE_3, BANK_FALLBACK, ACCEPTED}
    CLOSED = {REJECTED, FULFILLED, CANCELLED, EXPIRED}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    role: Mapped[str] = mapped_column(String(20), default="user")  # user | admin
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    donor_profile: Mapped["DonorProfile | None"] = relationship(back_populates="user", uselist=False)


class DonorProfile(Base):
    __tablename__ = "donor_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    blood_group: Mapped[str] = mapped_column(String(3), index=True)
    lat: Mapped[float] = mapped_column(Float, index=True)
    lng: Mapped[float] = mapped_column(Float, index=True)
    area: Mapped[str] = mapped_column(String(120), default="")
    last_donation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    opt_out: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    contacted_count: Mapped[int] = mapped_column(Integer, default=0)
    accepted_count: Mapped[int] = mapped_column(Integer, default=0)
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    # Random public label shown on the map instead of the donor's name.
    label: Mapped[str] = mapped_column(String(16), default="")

    user: Mapped[User] = relationship(back_populates="donor_profile")


class Hospital(Base):
    __tablename__ = "hospitals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    city: Mapped[str] = mapped_column(String(80), default="Dhaka")
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    verified: Mapped[bool] = mapped_column(Boolean, default=True)


class BloodRequest(Base):
    __tablename__ = "blood_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    blood_group: Mapped[str | None] = mapped_column(String(3), nullable=True)
    units: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hospital_id: Mapped[int | None] = mapped_column(ForeignKey("hospitals.id"), nullable=True)
    hospital_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    needed_by: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    urgency: Mapped[str] = mapped_column(String(10), default="normal")  # normal | critical
    contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=RequestStatus.PARSED, index=True)
    trust_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trust_reasons: Mapped[list] = mapped_column(JSON, default=list)
    raw_text: Mapped[str] = mapped_column(Text, default="")
    parsed: Mapped[dict] = mapped_column(JSON, default=dict)
    current_wave: Mapped[int] = mapped_column(Integer, default=0)
    wave_deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    accepted_donor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    hospital: Mapped[Hospital | None] = relationship()
    requester: Mapped[User] = relationship(foreign_keys=[requester_id])
    accepted_donor: Mapped[User | None] = relationship(foreign_keys=[accepted_donor_id])


class OutreachAttempt(Base):
    __tablename__ = "outreach_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("blood_requests.id"), index=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    wave: Mapped[int] = mapped_column(Integer)
    distance_km: Mapped[float] = mapped_column(Float)
    score: Mapped[float] = mapped_column(Float)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    # pending | accepted | declined | timeout | closed
    response: Mapped[str] = mapped_column(String(10), default="pending")
    responded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    donor: Mapped[User] = relationship()


class Donation(Base):
    __tablename__ = "donations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("blood_requests.id"))
    donor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    confirmed_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    donated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RequestEvent(Base):
    """Audit trail of every agent decision. Also feeds the map timeline."""

    __tablename__ = "request_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("blood_requests.id"), index=True)
    type: Mapped[str] = mapped_column(String(40))
    message: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class BloodBank(Base):
    __tablename__ = "blood_banks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(80), default="Dhaka")
    phone: Mapped[str] = mapped_column(String(20))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
