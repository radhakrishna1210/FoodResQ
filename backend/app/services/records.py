"""FSSAI Schedule-II style surplus food record (CSV) — ARCHITECTURE §14.1."""

import csv
import io
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Allocation, Donation, DonorProfile, ReceiverProfile
from app.services.app_config import get_config
from app.services.deadlines import compute_deadlines
from app.utils.time import fmt_ist

COLUMNS = ["donor_name_address", "receiver_name_address", "donation_date", "food_item", "batch_no",
           "manufacturing_date", "best_before_or_expiry", "quantity_donated", "temperature_c",
           "quantity_distributed", "distribution_area", "distribution_date"]


def rows_for_donation(db: Session, donation_id: uuid.UUID) -> list[dict[str, str]]:
    d = db.get(Donation, donation_id)
    dp = db.get(DonorProfile, d.donor_id)
    cfg = get_config(db)
    if d.storage_condition == "packaged_sealed" and d.packaged_expiry_date:
        best_before = d.packaged_expiry_date.strftime("%d-%m-%Y")
    else:
        dl = compute_deadlines(storage_condition=d.storage_condition, ambient_above_32c=d.ambient_above_32c,
                               prepared_at=d.prepared_at, packaged_expiry_date=d.packaged_expiry_date,
                               donor_pickup_by=d.donor_pickup_by, cfg=cfg)
        best_before = fmt_ist(dl.last_consumption_at)
    allocs = db.execute(select(Allocation).where(Allocation.donation_id == d.id, Allocation.status == "COMPLETED")
                        .order_by(Allocation.accepted_at)).scalars().all()
    out = []
    for a in allocs:
        rp = db.get(ReceiverProfile, a.receiver_id)
        out.append({
            "donor_name_address": f"{dp.org_name}, {d.pickup_address}",
            "receiver_name_address": f"{rp.org_name}, {rp.address}" if rp else "",
            "donation_date": fmt_ist(d.posted_at, "%d-%m-%Y"),
            "food_item": d.title,
            "batch_no": d.batch_no or "N/A",
            "manufacturing_date": fmt_ist(d.prepared_at),
            "best_before_or_expiry": best_before,
            "quantity_donated": f"{a.servings} servings",
            "temperature_c": str(d.temperature_c) if d.temperature_c is not None else "Not recorded",
            "quantity_distributed": f"{a.servings_distributed} servings" if a.servings_distributed is not None
            else "Unconfirmed",
            "distribution_area": a.distribution_area or "Unconfirmed",
            "distribution_date": fmt_ist(a.distributed_at, "%d-%m-%Y") if a.distributed_at else "Unconfirmed",
        })
    return out


def to_csv(rows: list[dict[str, str]]) -> str:
    buf = io.StringIO()
    buf.write("﻿")  # BOM so Excel opens UTF-8 correctly
    w = csv.DictWriter(buf, fieldnames=COLUMNS)
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue()
