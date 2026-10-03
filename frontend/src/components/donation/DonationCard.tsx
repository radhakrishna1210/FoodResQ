import { Link } from 'react-router-dom';
import { ChevronRight, Utensils } from 'lucide-react';
import type { Donation } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { Countdown } from '@/components/ui/Countdown';
import { DietDot } from '@/components/ui/misc';
import { FOOD_CATEGORY_LABELS } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';

const ACTIVE = new Set(['POSTED', 'MATCHED', 'ACCEPTED', 'FLAGGED']);

export function progressText(
  d: Pick<Donation, 'status' | 'allocated_servings' | 'quantity_servings'>,
): string | null {
  const allocated = d.allocated_servings ?? 0;
  if ((d.status === 'POSTED' || d.status === 'MATCHED') && allocated > 0) {
    return `Partially accepted: ${allocated} of ${d.quantity_servings} servings`;
  }
  if (allocated > 0) return `Accepted ${allocated} of ${d.quantity_servings}`;
  return null;
}

export function DonationCard({ donation: d, to }: { donation: Donation; to: string }) {
  const progress = progressText(d);
  const pct = Math.min(
    100,
    Math.round(((d.allocated_servings ?? 0) / Math.max(1, d.quantity_servings)) * 100),
  );
  return (
    <Link
      to={to}
      className="card card-hover group block p-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary sm:flex">
            <Utensils size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-heading text-base font-semibold text-ink group-hover:text-primary">
              {d.title}
            </h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate">
              <span className="font-medium text-ink">{d.quantity_servings} servings</span>
              <span aria-hidden>·</span>
              <DietDot diet={d.diet_type} withLabel />
              <span aria-hidden>·</span>
              <span>{FOOD_CATEGORY_LABELS[d.food_category]}</span>
            </p>
          </div>
        </div>
        <ChevronRight
          size={20}
          className="mt-1 shrink-0 text-slate group-hover:text-primary"
          aria-hidden
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={d.status} />
        <PriorityBadge level={d.priority_level} />
        {ACTIVE.has(d.status) ? (
          <Countdown deadline={d.effective_deadline} prefix="Pickup by" />
        ) : (
          <span className="text-xs text-slate">Posted {formatDateTime(d.posted_at)}</span>
        )}
      </div>
      {progress && (
        <div className="mt-3">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-ink">{progress}</span>
            <span className="text-slate">{pct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {/* TODO(team): list rows have no receiver name; matched Receiver names are shown on the detail page. */}
    </Link>
  );
}
