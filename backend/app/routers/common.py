from sqlalchemy import func, select
from sqlalchemy.orm import Session


def paginate(db: Session, stmt, page: int, page_size: int):
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    total = db.execute(select(func.count()).select_from(stmt.order_by(None).subquery())).scalar_one()
    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).scalars().all()
    return rows, page, page_size, total
