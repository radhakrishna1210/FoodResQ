"""Receiver dashboard feed: every open donation this Receiver could realistically take.

Only the top-ranked Receivers are notified (offers, email); everyone else can still SEE the donation here.
Read-only: acceptance still goes through an offer. Uses the same Stage-1 hard filters as the JEV engine
(except `already_offered`, which is reported as `offer_status` instead).
"""

from dataclasses import replace
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Donation, DonorProfile, Offer, User
from app.services.app_config import get_config
from app.services.matching.engine import donation_ctx, load_receivers
from app.services.matching.filters import first_failure
from app.services.matching.geo import eta_minutes, road_distance_km
from app.utils.serialize import iso
from app.utils.time import now_utc


def nearby_donations(db: Session, receiver: User, limit: int = 30) -> list[dict]:
    now = now_utc()
    cfg = get_config(db)
    donations = db.execute(
        select(Donation)
        .where(Donation.status.in_(("POSTED", "MATCHED")), Donation.remaining_servings > 0,
               Donation.effective_deadline > now)
        .order_by(Donation.effective_deadline)
        .limit(200)
    ).scalars().all()
    my_offers = {o.donation_id: o for o in db.execute(select(Offer).where(Offer.receiver_id == receiver.id)).scalars()}
    out: list[dict] = []
    for d in donations:
        ctxs = load_receivers(db, d.id, now, only_receiver_id=receiver.id)
        if not ctxs:
            return []
        r = ctxs[0]
        r = replace(r, already_offered=False)
        dist = road_distance_km(d.pickup_lat, d.pickup_lng, r.lat, r.lng, cfg["road_factor"])
        eta = eta_minutes(dist, cfg["prep_buffer_minutes"], cfg["avg_speed_kmph"])
        dctx = donation_ctx(d)
        # The feed ignores the donation's current (possibly still narrow) search radius: show anything within
        # the Receiver's own service radius so nearby food is never hidden just because matching hasn't widened.
        dctx = replace(dctx, search_radius_km=max(dctx.search_radius_km, r.service_radius_km))
        if first_failure(dctx, r, dist, now + timedelta(minutes=eta)) is not None:
            continue
        offer = my_offers.get(d.id)
        dp = db.get(DonorProfile, d.donor_id)
        out.append({
            "donation_id": d.id,
            "title": d.title,
            "food_category": d.food_category,
            "diet_type": d.diet_type,
            "remaining_servings": d.remaining_servings,
            "priority_level": d.priority_level,
            "effective_deadline": iso(d.effective_deadline),
            "posted_at": iso(d.posted_at),
            "donor_org_name": dp.org_name if dp else None,
            "distance_km": dist,
            "eta_minutes": eta,
            "offer_id": offer.id if offer else None,
            "offer_status": offer.status if offer else None,
        })
        if len(out) >= limit:
            break
    return out
