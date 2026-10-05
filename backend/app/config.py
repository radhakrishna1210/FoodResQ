from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # "development" (default, local-only) or "production". Gates the startup safety check below —
    # see validate_production_safety() in main.py.
    environment: str = "development"

    database_url: str = "postgresql+psycopg://foodresq:foodresq@localhost:5432/foodresq"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_jwks_url: str = ""
    cors_origins: str = "http://localhost:5173"
    app_timezone: str = "Asia/Kolkata"
    scheduler_enabled: bool = True
    internal_tick_secret: str = "change-me"
    gemini_api_key: str = ""
    gemini_model: str = ""

    # Optional alternative Stage-2 scorer (see services/matching/jev_adapter.py). "bridge" (default)
    # is this project's own deterministic weighted formula — the only engine the test suite assumes.
    # "jev" switches the final 0-100 match score to TypeSafe AI's Jev API; Stage 1 hard filters and
    # the factor measurements themselves are never delegated, and any Jev failure falls back to
    # Bridge's own formula for that candidate.
    matching_engine: str = "bridge"
    typesafe_jev_api_key: str = ""

    # Google Sign-In (direct OAuth 2.0 authorization-code flow, no Supabase involved).
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""  # must exactly match the redirect URI registered in Google Cloud Console
    app_jwt_secret: str = "change-me"  # signs real Google-verified sessions; separate from dev_jwt_secret
    frontend_base_url: str = "http://localhost:5173"
    email_notifications_enabled: bool = False
    # SMTP for email notifications (services/emailer.py). STARTTLS on 587 unless smtp_secure is true (SSL, 465).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_secure: bool = False
    smtp_user: str = ""
    smtp_password: str = ""
    email_from_name: str = "FoodResQ"
    email_from: str = ""

    # TODO(team): prototype-only dev login; must be false in any deployment.
    dev_auth_enabled: bool = False
    dev_jwt_secret: str = "local-dev-secret-change-me"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
