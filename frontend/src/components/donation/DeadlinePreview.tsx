import { AlertTriangle, Clock } from 'lucide-react';
import type { StorageCondition } from '@/types';
import { computeDeadlines, isTooCloseToSafeLimit, TOO_CLOSE_MESSAGE } from '@/lib/deadline';
import { formatTime, fromISTInputValue, formatIST } from '@/lib/format';
import { useNow } from '@/hooks/useNow';

/** Live "Pickup by · Last time of consumption" preview (WALKTHROUGH §5.4). The server remains the authority. */
export function DeadlinePreview({
  storage,
  ambientAbove32c,
  preparedAt,
  pickupBy,
  expiryDate,
}: {
  storage: StorageCondition | '' | undefined;
  ambientAbove32c: boolean;
  preparedAt: string | undefined;
  pickupBy: string | undefined;
  expiryDate: string | undefined;
}) {
  const now = useNow(30_000);
  const preparedIso = preparedAt ? fromISTInputValue(preparedAt) : null;
  const pickupIso = pickupBy ? fromISTInputValue(pickupBy) : null;
  const result =
    storage && pickupIso && (preparedIso || storage === 'packaged_sealed')
      ? computeDeadlines({
          storage_condition: storage,
          ambient_above_32c: ambientAbove32c,
          prepared_at: preparedIso ? new Date(preparedIso) : new Date(NaN),
          donor_pickup_by: new Date(pickupIso),
          packaged_expiry_date: expiryDate || null,
        })
      : null;

  if (!result) {
    return (
      <div
        className="flex items-center gap-3 rounded-card border border-dashed border-line bg-bg px-4 py-3 text-sm text-slate"
        aria-live="polite"
      >
        <Clock size={18} aria-hidden />
        Fill in preparation time, storage and pickup time to see the safe pickup deadline.
      </div>
    );
  }
  const tooClose = isTooCloseToSafeLimit(result.effective_deadline, new Date(now));
  const sameDay = (d: Date) => formatIST(d, 'yyyy-MM-dd') === formatIST(now, 'yyyy-MM-dd');
  const fmt = (d: Date) => (sameDay(d) ? formatTime(d) : formatIST(d, 'd MMM, h:mm a'));
  const limitedBySafety =
    result.safe_pickup_deadline.getTime() < new Date(pickupIso as string).getTime();

  return (
    <div
      className={`rounded-card border px-4 py-3 ${tooClose ? 'border-red/40 bg-red-50' : 'border-primary/30 bg-primary-50/60'}`}
      aria-live="polite"
      data-testid="deadline-preview"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-heading text-base font-semibold text-ink">
        <Clock size={18} className={tooClose ? 'text-red' : 'text-primary'} aria-hidden />
        <span>Pickup by: {fmt(result.effective_deadline)}</span>
        <span className="text-slate" aria-hidden>
          ·
        </span>
        <span>Last time of consumption: {fmt(result.last_consumption_at)}</span>
      </p>
      {tooClose ? (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-red-700" role="alert">
          <AlertTriangle size={14} aria-hidden /> {TOO_CLOSE_MESSAGE}
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate">
          {limitedBySafety
            ? 'Pickup time is limited by the safe window for this storage condition.'
            : 'Computed with the same rules as the server. Conservative defaults, not food-safety certification.'}
        </p>
      )}
    </div>
  );
}
