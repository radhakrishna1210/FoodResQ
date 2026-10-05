from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings

# pool_recycle: Supabase (and managed Postgres generally) can drop idle connections server-side;
# recycling proactively avoids handing out a connection that's about to be rejected mid-query (which
# pool_pre_ping's checkout-time check alone won't catch once a connection is already mid-request).
engine = create_engine(get_settings().database_url, pool_pre_ping=True, pool_recycle=300, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
