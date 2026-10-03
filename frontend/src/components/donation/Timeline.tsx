import type { TimelineEntry } from '@/types';
import { DONATION_STATUS_LABELS } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';
import { DONATION_STATUS_TONE } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/cn';

const DOT: Record<string, string> = {
  slate: 'bg-slate',
  teal: 'bg-teal',
  primary: 'bg-primary',
  purple: 'bg-purple',
  green: 'bg-green',
  expired: 'bg-expired',
  cancelled: 'bg-cancelled',
  gold: 'bg-gold',
};

/** Status timeline with IST times (WALKTHROUGH §3.9). */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (!entries.length) return <p className="text-sm text-slate">No status changes yet.</p>;
  return (
    <ol className="relative space-y-4">
      {entries.map((e, i) => {
        const tone = DONATION_STATUS_TONE[e.status];
        const last = i === entries.length - 1;
        return (
          <li key={`${e.status}-${e.at}-${i}`} className="relative flex gap-3">
            {!last && (
              <span
                className="absolute left-[7px] top-4 h-[calc(100%+4px)] w-px bg-line"
                aria-hidden
              />
            )}
            <span
              className={cn(
                'relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full ring-4 ring-white',
                DOT[tone],
              )}
              aria-hidden
            />
            <div className="flex flex-1 items-baseline justify-between gap-3">
              <span className={cn('text-sm', last ? 'font-semibold text-ink' : 'text-ink')}>
                {DONATION_STATUS_LABELS[e.status]}
              </span>
              <span className="text-xs tabular-nums text-slate">{formatDateTime(e.at)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
