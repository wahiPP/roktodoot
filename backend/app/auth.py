"""Authentication.

Two kinds of token are accepted:
  * Supabase access tokens (Google login). Verified with the project's JWKS
    (asymmetric keys) or, for older projects, the HS256 JWT secret.
  * Dev-login tokens signed with APP_SECRET. Only when dev login is enabled,
    which is always off in production.
"""

from datetime import timedelta

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .db import get_db, utcnow
from .models import User

DEV_ISSUER = "roktodoot-dev"
bearer = HTTPBearer(auto_error=False)

_jwks_clients: dict[str, jwt.PyJWKClient] = {}


class AuthError(Exception):
    pass


def create_dev_token(email: str, name: str, role: str, settings: Settings, minutes: int = 60 * 24) -> str:
    now = utcnow()
    payload = {
        "iss": DEV_ISSUER,
        "sub": email,
        "email": email,
        "name": name,
        "role_hint": role,
        "aud": settings.supabase_audience,
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, settings.app_secret, algorithm="HS256")


def _jwks_client(settings: Settings) -> jwt.PyJWKClient:
    url = settings.supabase_url.rstrip("/") + "/auth/v1/.well-known/jwks.json"
    if url not in _jwks_clients:
        _jwks_clients[url] = jwt.PyJWKClient(url, cache_keys=True)
    return _jwks_clients[url]


def decode_token(token: str, settings: Settings) -> dict:
    """Return verified claims or raise AuthError."""
    try:
        header = jwt.get_unverified_header(token)
        unverified = jwt.decode(token, options={"verify_signature": False})
    except jwt.PyJWTError as e:
        raise AuthError("Malformed token") from e

    opts = {"require": ["exp", "sub"]}
    aud = settings.supabase_audience

    try:
        if unverified.get("iss") == DEV_ISSUER:
            if not settings.dev_login_enabled:
                raise AuthError("Dev login is disabled")
            return jwt.decode(token, settings.app_secret, algorithms=["HS256"], audience=aud, options=opts)

        alg = header.get("alg", "")
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise AuthError("HS256 tokens are not accepted (no Supabase JWT secret configured)")
            return jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], audience=aud, options=opts)

        if alg in ("RS256", "ES256"):
            if not settings.supabase_url:
                raise AuthError("Supabase URL not configured")
            key = _jwks_client(settings).get_signing_key_from_jwt(token)
            return jwt.decode(token, key.key, algorithms=[alg], audience=aud, options=opts)
    except AuthError:
        raise
    except jwt.ExpiredSignatureError as e:
        raise AuthError("Token expired") from e
    except jwt.InvalidAudienceError as e:
        raise AuthError("Wrong audience") from e
    except jwt.PyJWTError as e:
        raise AuthError("Invalid token") from e

    raise AuthError(f"Unsupported algorithm {alg!r}")


def user_from_claims(db: Session, claims: dict, settings: Settings) -> User:
    email = (claims.get("email") or "").lower()
    if not email:
        raise AuthError("Token has no email")
    user = db.scalar(select(User).where(User.email == email))
    meta = claims.get("user_metadata") or {}
    name = claims.get("name") or meta.get("full_name") or meta.get("name") or email.split("@")[0]
    if user is None:
        user = User(email=email, name=name)
        db.add(user)
    is_admin = email in settings.admin_email_list or (
        claims.get("iss") == DEV_ISSUER and claims.get("role_hint") == "admin"
    )
    if is_admin:
        user.role = "admin"
    db.commit()
    db.refresh(user)
    return user


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    try:
        claims = decode_token(creds.credentials, settings)
        return user_from_claims(db, claims, settings)
    except AuthError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e)) from e


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins only")
    return user
