import { Link } from 'react-router-dom';
import { ChevronRight, Truck } from 'lucide-react';
import type { Allocation } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Countdown } from '@/components/ui/Countdown';
import { formatDateTime } from '@/lib/format';

/** Active / past pickup card for Receivers. */
export function PickupCard({ allocation: a }: { allocation: Allocation }) {
  const live = a.status === 'ACCEPTED';
  return (
    <Link
      to={`/receiver/pickups/${a.id}`}
      className="card card-hover group flex items-center gap-4 p-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal/20"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
        <Truck size={20} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink group-hover:text-teal-700">
          {a.donation?.title ?? 'Pickup'}
        </p>
        <p className="truncate text-sm text-slate">
          {a.servings} servings · {a.donor_org_name}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusBadge kind="allocation" status={a.status} />
          {live ? (
            <Countdown deadline={a.effective_deadline} prefix="Pickup by" />
          ) : (
            <span className="text-xs text-slate">Accepted {formatDateTime(a.accepted_at)}</span>
          )}
        </div>
      </div>
      <ChevronRight
        size={20}
        className="shrink-0 text-slate group-hover:text-teal-700"
        aria-hidden
      />
    </Link>
  );
}
