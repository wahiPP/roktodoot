from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import create_dev_token, decode_token, user_from_claims
from ..config import Settings, get_settings
from ..db import get_db
from ..schemas import DevLogin
from ..views import user_view

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/config")
def auth_config(settings: Settings = Depends(get_settings)):
    return {"dev_login_enabled": settings.dev_login_enabled, "supabase": bool(settings.supabase_url)}


@router.post("/dev-login")
def dev_login(body: DevLogin, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    """Local development and demos only. Always disabled in production."""
    if not settings.dev_login_enabled:
        raise HTTPException(404, "Not found")
    token = create_dev_token(body.email.lower(), body.name or body.email.split("@")[0], body.role, settings)
    user = user_from_claims(db, decode_token(token, settings), settings)
    return {"access_token": token, "token_type": "bearer", "user": user_view(user)}
