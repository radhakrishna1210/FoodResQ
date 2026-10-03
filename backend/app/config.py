from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://foodresq:foodresq@localhost:5432/foodresq"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_jwks_url: str = ""
    cors_origins: str = "http://localhost:5173"
    app_timezone: str = "Asia/Kolkata"
    scheduler_enabled: bool = True
    internal_tick_secret: str = "change-me"
    anthropic_api_key: str = ""
    anthropic_model: str = ""
    email_notifications_enabled: bool = False

    # TODO(team): prototype-only dev login; must be false in any deployment.
    dev_auth_enabled: bool = False
    dev_jwt_secret: str = "local-dev-secret-change-me"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
