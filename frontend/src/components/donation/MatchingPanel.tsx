import { Brain, Search, ShieldQuestion } from 'lucide-react';
import type { DonationDetail } from '@/types';
import { FLAG_REASON_LABELS } from '@/lib/labels';
import { progressText } from './DonationCard';

/** Copy from WALKTHROUGH §5.5. Donors never see names of Receivers who have not accepted. */
export function matchingMessage(
  d: Pick<DonationDetail, 'status' | 'pending_offers_count'>,
): string | null {
  if (d.status === 'FLAGGED') return 'Under review by FoodResQ team';
  if (d.status === 'MATCHED' && d.pending_offers_count > 0) {
    const n = d.pending_offers_count;
    return `Offered to ${n} Receiver${n === 1 ? '' : 's'}. Waiting for acceptance.`;
  }
  if (d.status === 'POSTED' || d.status === 'MATCHED') return 'Finding the best Receiver…';
  return null;
}

export function MatchingPanel({ donation }: { donation: DonationDetail }) {
  const msg = matchingMessage(donation);
  if (!msg) return null;
  const flagged = donation.status === 'FLAGGED';
  const progress = progressText(donation);
  return (
    <div
      className={`card flex items-start gap-3 p-4 ${flagged ? 'border-gold/40 bg-gold-50/50' : 'border-teal/30 bg-teal-50/40'}`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${flagged ? 'bg-gold-50 text-gold' : 'bg-white text-teal-700'}`}
      >
        {flagged ? (
          <ShieldQuestion size={20} aria-hidden />
        ) : donation.pending_offers_count > 0 ? (
          <Brain size={20} aria-hidden />
        ) : (
          <Search size={20} className="animate-pulse" aria-hidden />
        )}
      </span>
      <div className="min-w-0">
        <p className="font-medium text-ink" role="status">
          {msg}
        </p>
        {flagged && donation.flag_reasons.length > 0 && (
          <ul className="mt-1 list-inside list-disc text-sm text-slate">
            {donation.flag_reasons.map((r) => (
              <li key={r}>{FLAG_REASON_LABELS[r] ?? r}</li>
            ))}
          </ul>
        )}
        {!flagged && (
          <p className="mt-0.5 text-sm text-slate">
            {progress ?? 'The JEV engine ranks verified Receivers by fit, not just distance.'}
            {donation.search_radius_km > 10 &&
              ` Search radius widened to ${donation.search_radius_km} km.`}
          </p>
        )}
      </div>
    </div>
  );
}
