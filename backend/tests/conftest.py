"""DB-backed tests run only when TEST_DATABASE_URL points at a disposable PostgreSQL database.

    TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/foodresq_test pytest

The schema is rebuilt with Alembic at session start; each test starts from the seed (WALKTHROUGH §2).
Pure tests (engine, formulas) need no database.
"""

import os

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
if TEST_DB:
    os.environ["DATABASE_URL"] = TEST_DB
    os.environ["DEV_AUTH_ENABLED"] = "true"
    os.environ["SCHEDULER_ENABLED"] = "false"
    os.environ["SUPABASE_URL"] = ""
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
    os.environ["GEMINI_API_KEY"] = ""


def pytest_collection_modifyitems(config, items):
    if TEST_DB:
        return
    skip = pytest.mark.skip(reason="TEST_DATABASE_URL not set")
    for item in items:
        if "db" in item.keywords:
            item.add_marker(skip)


@pytest.fixture(scope="session")
def _schema():
    from alembic.config import Config

    from alembic import command

    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "alembic"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield


@pytest.fixture()
def seeded(_schema):
    from app.db import SessionLocal
    from app.services import app_config, ratelimit
    from scripts import seed

    db = SessionLocal()
    users = seed.seed_users(db)
    seed.reset(db, users)
    users = seed.seed_users(db)
    db.commit()
    db.close()
    ratelimit.reset()
    app_config.invalidate_cache()
    return {email: u.id for email, u in users.items()}


@pytest.fixture()
def client(seeded):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def as_user(client):
    tokens: dict[str, str] = {}

    def headers(email: str) -> dict[str, str]:
        if email not in tokens:
            r = client.post("/api/v1/dev/login", json={"email": email})
            assert r.status_code == 200, r.text
            tokens[email] = r.json()["access_token"]
        return {"Authorization": f"Bearer {tokens[email]}"}

    return headers
