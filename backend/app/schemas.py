"""Request bodies, validated by Pydantic."""

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, Field, field_validator

from .agents.rule_parser import normalize, parse_phone

BloodGroup = Literal["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]


def _clean_phone(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    p = parse_phone(normalize(v))
    if not p:
        raise ValueError("Enter a valid Bangladeshi mobile number, e.g. 01712345678")
    return p


Phone = Annotated[str | None, BeforeValidator(_clean_phone)]


class DevLogin(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    name: str = Field(default="", max_length=120)
    role: Literal["user", "admin"] = "user"


class MeUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    phone: Phone = None


class PhoneVerify(BaseModel):
    code: str


class DonorIn(BaseModel):
    blood_group: BloodGroup
    lat: float = Field(ge=20.0, le=27.0)  # Bangladesh bounds
    lng: float = Field(ge=88.0, le=93.0)
    area: str = Field(default="", max_length=120)
    phone: Annotated[str, BeforeValidator(_clean_phone)]
    last_donation_date: date | None = None
    available: bool = True
    consent: bool

    @field_validator("consent")
    @classmethod
    def _consent(cls, v):
        if not v:
            raise ValueError("Consent to be contacted is required")
        return v

    @field_validator("last_donation_date")
    @classmethod
    def _past(cls, v):
        if v and v > date.today():
            raise ValueError("Last donation date cannot be in the future")
        return v


class Availability(BaseModel):
    available: bool


class RequestCreate(BaseModel):
    text: str = Field(default="", max_length=1000)
    # Optional structured form fields (FR-04); they override what the parser finds.
    blood_group: BloodGroup | None = None
    units: int | None = Field(default=None, ge=1, le=10)
    hospital_id: int | None = None
    needed_by: datetime | None = None
    urgency: Literal["normal", "critical"] | None = None
    contact_phone: Phone = None


class RequestUpdate(BaseModel):
    blood_group: BloodGroup | None = None
    units: int | None = Field(default=None, ge=1, le=10)
    hospital_id: int | None = None
    needed_by: datetime | None = None
    urgency: Literal["normal", "critical"] | None = None
    contact_phone: Phone = None


class Respond(BaseModel):
    accept: bool


class Decision(BaseModel):
    approve: bool
    reason: str = Field(default="", max_length=300)
