from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings

# pool_recycle: Supabase (and managed Postgres generally) can drop idle connections server-side;
# recycling proactively avoids handing out a connection that's about to be rejected mid-query (which
# pool_pre_ping's checkout-time check alone won't catch once a connection is already mid-request).
#
# prepare_threshold=None: DATABASE_URL points at Supabase's Transaction Pooler (Supavisor), which can
# route different queries from the same logical connection to different physical backend processes.
# psycopg3 auto-prepares repeated statements server-side by default, but a prepared statement only
# exists on the specific backend it was prepared on — under transaction pooling this surfaces as
# "prepared statement ... already exists" / "does not exist" errors. Disabling server-side prepare
# entirely is the standard fix for this known PgBouncer/Supavisor transaction-mode incompatibility.
engine = create_engine(get_settings().database_url, pool_pre_ping=True, pool_recycle=300,
                       connect_args={"prepare_threshold": None}, future=True)
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
