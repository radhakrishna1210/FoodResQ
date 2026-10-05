import { Link } from 'react-router-dom';
import { Bell, Clock, MapPin } from 'lucide-react';
import type { NearbyDonation } from '@/types';
import { FOOD_CATEGORY_LABELS } from '@/lib/labels';
import { formatMinutes } from '@/lib/format';
import { Countdown } from '@/components/ui/Countdown';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { DietDot } from '@/components/ui/misc';

/** Read-only card: food posted near you. Only the top-ranked Receivers get an offer; this is for awareness. */
export function NearbyFoodCard({ item }: { item: NearbyDonation }) {
  const hasOffer = item.offer_id !== null && item.offer_status === 'PENDING';
  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-heading font-semibold text-ink">{item.title}</p>
          <p className="text-sm text-slate">{item.donor_org_name ?? 'A donor'}</p>
        </div>
        <PriorityBadge level={item.priority_level} short />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate">
        <span className="inline-flex items-center gap-1.5">
          <DietDot diet={item.diet_type} /> {FOOD_CATEGORY_LABELS[item.food_category]}
        </span>
        <span>{item.remaining_servings} servings</span>
        <span className="inline-flex items-center gap-1">
          <MapPin size={14} aria-hidden /> {item.distance_km} km · {formatMinutes(item.eta_minutes)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock size={14} aria-hidden />
          <Countdown deadline={item.effective_deadline} prefix="Pickup by " />
        </span>
      </div>
      {hasOffer ? (
        <Link
          to={`/receiver/offers/${item.offer_id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline"
        >
          <Bell size={14} aria-hidden /> You've been sent an offer — open it
        </Link>
      ) : (
        <p className="text-xs text-slate">
          Offered to the top-matched Receivers first. If they pass, it may be offered to you.
        </p>
      )}
    </div>
  );
}
