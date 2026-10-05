"""FastAPI app: CORS, routers, scheduler startup."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.errors import install_error_handlers
from app.routers import admin, assistant, auth, auth_google, donor, internal, receiver, shared

log = logging.getLogger("foodresq")

# Placeholder values that must never survive into a real deployment. If ENVIRONMENT=production and
# any of these checks fail, the app refuses to start rather than run with an auth bypass or a
# guessable secret — a misconfigured dashboard field should crash loudly, not fail open.
_UNSAFE_PLACEHOLDERS = {"", "change-me", "local-dev-secret-change-me", "local-dev-app-secret-change-me"}


def validate_production_safety(settings) -> None:
    if settings.environment != "production":
        return
    problems = []
    if settings.dev_auth_enabled:
        problems.append("DEV_AUTH_ENABLED must be false in production (it's a full login bypass).")
    if settings.internal_tick_secret in _UNSAFE_PLACEHOLDERS:
        problems.append("INTERNAL_TICK_SECRET is still a placeholder value.")
    if settings.app_jwt_secret in _UNSAFE_PLACEHOLDERS or len(settings.app_jwt_secret) < 32:
        problems.append("APP_JWT_SECRET is missing, a placeholder, or too short (needs 32+ random chars).")
    if settings.dev_jwt_secret in _UNSAFE_PLACEHOLDERS:
        problems.append("DEV_JWT_SECRET is still the local-dev placeholder value.")
    if problems:
        raise RuntimeError(
            "Refusing to start with ENVIRONMENT=production and unsafe settings:\n- " + "\n- ".join(problems)
        )


def _start_scheduler():
    from apscheduler.schedulers.background import BackgroundScheduler

    from app.db import SessionLocal
    from app.services import jobs

    def run_tick():
        db = SessionLocal()
        try:
            jobs.tick(db)
        finally:
            db.close()

    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(run_tick, "interval", seconds=60, id="tick", max_instances=1, coalesce=True)
    scheduler.start()
    return scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    scheduler = None
    if get_settings().scheduler_enabled:
        try:
            scheduler = _start_scheduler()
        except Exception:  # never block startup on the scheduler
            log.exception("scheduler failed to start")
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


def create_app() -> FastAPI:
    settings = get_settings()
    validate_production_safety(settings)
    app = FastAPI(title="FoodResQ API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])
    install_error_handlers(app)

    @app.get("/health", tags=["internal"])
    def health():
        return {"status": "ok"}

    for r in (auth.router, auth_google.router, donor.router, receiver.router, shared.router, admin.router,
              internal.router, assistant.router):
        app.include_router(r, prefix="/api/v1")
    app.add_api_route("/api/v1/health", health, methods=["GET"], include_in_schema=False)
    return app


app = create_app()
