"""FastAPI app: CORS, routers, scheduler startup."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.errors import install_error_handlers
from app.routers import admin, assistant, auth, donor, internal, receiver, shared

log = logging.getLogger("foodresq")


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
    app = FastAPI(title="FoodResQ API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])
    install_error_handlers(app)

    @app.get("/health", tags=["internal"])
    def health():
        return {"status": "ok"}

    for r in (auth.router, donor.router, receiver.router, shared.router, admin.router, internal.router,
              assistant.router):
        app.include_router(r, prefix="/api/v1")
    app.add_api_route("/api/v1/health", health, methods=["GET"], include_in_schema=False)
    return app


app = create_app()
