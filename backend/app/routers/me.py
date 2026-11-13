from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import Settings, get_settings
from ..db import get_db
from ..models import User
from ..schemas import MeUpdate, PhoneVerify
from ..views import user_view

router = APIRouter(prefix="/me", tags=["me"])


@router.get("")
def get_me(user: User = Depends(get_current_user)):
    return user_view(user)


@router.patch("")
def update_me(body: MeUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.name is not None:
        user.name = body.name
    if body.phone is not None and body.phone != user.phone:
        user.phone = body.phone
        user.phone_verified = False
    db.commit()
    return user_view(user)


@router.post("/phone/verify")
def verify_phone(
    body: PhoneVerify,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Demo OTP: SMS is mocked, so the code is fixed (DEMO_OTP)."""
    if not user.phone:
        raise HTTPException(400, "Add a phone number first")
    if body.code != settings.demo_otp:
        raise HTTPException(400, "Wrong code")
    user.phone_verified = True
    db.commit()
    return user_view(user)
