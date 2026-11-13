"""Application settings, read from environment variables (or a .env file)."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # General
    env: str = "development"  # development | test | production
    database_url: str = "sqlite:///./roktodoot.db"
    cors_origins: str = "http://localhost:3000"
    app_secret: str = "change-me-in-production-please-32b"

    # Auth
    dev_login_enabled: bool = True
    supabase_url: str = ""
    supabase_jwt_secret: str = ""  # legacy HS256 secret (optional)
    supabase_audience: str = "authenticated"
    admin_emails: str = "admin@demo.roktodoot.org"

    # LLM
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    # Notifications
    resend_api_key: str = ""
    email_from: str = "RoktoDoot <noreply@roktodoot.example>"

    # Agents / worker
    run_worker: bool = True
    worker_interval_seconds: float = 2.0
    # How many real seconds one "rule minute" lasts. 60 = real time; 3 = demo speed.
    seconds_per_minute: float = 60.0
    request_expiry_hours: int = 24
    demo_otp: str = "123456"

    # Rate limit for creating requests
    request_rate_limit: int = 5
    request_rate_window_seconds: int = 600

    @field_validator("dev_login_enabled")
    @classmethod
    def _no_dev_login_in_prod(cls, v, info):
        # Dev login can never be switched on in production.
        if info.data.get("env") == "production":
            return False
        return v

    @property
    def admin_email_list(self) -> list[str]:
        return [e.strip().lower() for e in self.admin_emails.split(",") if e.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
