import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Brain, Check, CheckCircle2, MapPin, Timer, X } from 'lucide-react';
import type { Allocation, Offer } from '@/types';
import { useAcceptOffer } from '@/hooks/queries';
import { useNow } from '@/hooks/useNow';
import { errorMessage } from '@/lib/api';
import { respondLabel } from '@/lib/format';
import { FOOD_CATEGORY_LABELS } from '@/lib/labels';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { Countdown } from '@/components/ui/Countdown';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DietDot } from '@/components/ui/misc';
import { useToast } from '@/components/ui/Toast';
import { DeclineModal } from './DeclineModal';

/** §7.6 warnings start with these phrases. */
export const isWarning = (reason: string) => /^(Partial fit|Tight timing)/.test(reason);

export function splitReasons(reasons: string[]): { positives: string[]; warnings: string[] } {
  return {
    positives: reasons.filter((r) => !isWarning(r)).slice(0, 3),
    warnings: reasons.filter(isWarning),
  };
}

/** `POST /offers/{id}/accept` returns the new Allocation. */
export function allocationIdFrom(res: Allocation | undefined): string | null {
  return res?.id ?? null;
}

export function scoreTone(score: number): string {
  if (score >= 75) return 'text-green';
  if (score >= 50) return 'text-teal-700';
  return 'text-slate';
}

export function OfferReasons({ reasons }: { reasons: string[] }) {
  const { positives, warnings } = splitReasons(reasons);
  return (
    <ul className="space-y-1.5">
      {positives.map((r) => (
        <li key={r} className="flex items-start gap-2 text-sm text-ink">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green" aria-hidden />
          {r}
        </li>
      ))}
      {warnings.map((r) => (
        <li key={r} className="flex items-start gap-2 text-sm text-gold-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden />
          {r}
        </li>
      ))}
    </ul>
  );
}

export function useOfferActions(offer: Offer) {
  const accept = useAcceptOffer();
  const navigate = useNavigate();
  const toast = useToast();
  const doAccept = () =>
    accept.mutate(offer.id, {
      onSuccess: (res) => {
        toast({
          title: 'Offer accepted',
          body: `${offer.offered_servings} servings are yours. Head to the pickup.`,
          tone: 'success',
        });
        const aid = allocationIdFrom(res);
        navigate(aid ? `/receiver/pickups/${aid}` : '/receiver');
      },
      onError: (e) => toast({ title: "Couldn't accept", body: errorMessage(e), tone: 'error' }),
    });
  return { accept, doAccept };
}

/** Offer card (WALKTHROUGH §5.6) with a LARGE match score. */
export function OfferCard({ offer }: { offer: Offer }) {
  const now = useNow(5_000);
  const [declineOpen, setDeclineOpen] = useState(false);
  const { accept, doAccept } = useOfferActions(offer);
  const d = offer.donation;
  const msLeft = new Date(offer.expires_at).getTime() - now;
  const pending = offer.status === 'PENDING' && msLeft > 0;

  return (
    <article className="card overflow-hidden" aria-label={`Offer: ${d.title}`}>
      <div className="flex">
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge level={d.priority_level} />
            {offer.status !== 'PENDING' && <StatusBadge kind="offer" status={offer.status} />}
          </div>
          <Link
            to={`/receiver/offers/${offer.id}`}
            className="mt-2 block font-heading text-lg font-semibold text-ink hover:text-primary"
          >
            {d.title}
          </Link>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate">
            <span className="font-medium text-ink">{offer.offered_servings} servings offered</span>
            <span aria-hidden>·</span>
            <DietDot diet={d.diet_type} withLabel />
            <span aria-hidden>·</span>
            {FOOD_CATEGORY_LABELS[d.food_category]}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate">
            <MapPin size={14} aria-hidden />
            {d.donor_org_name} · {offer.distance_km} km · about {offer.eta_minutes} min
          </p>
          <div className="mt-3">
            <Countdown deadline={d.effective_deadline} prefix="Pickup by" showTime />
          </div>
          <div className="mt-3">
            <OfferReasons reasons={offer.reasons} />
          </div>
        </div>
        <div className="flex w-28 shrink-0 flex-col items-center justify-center border-l border-line bg-gradient-to-b from-teal-50 to-white px-2 sm:w-36">
          <Brain size={18} className="text-purple" aria-hidden />
          <p
            className={cn(
              'font-heading text-4xl font-bold tabular-nums sm:text-5xl',
              scoreTone(offer.match_score),
            )}
            data-testid="match-score"
          >
            {offer.match_score}%
          </p>
          <p className="text-center text-[11px] font-medium uppercase tracking-wide text-slate">
            JEV match
          </p>
          {offer.rank === 1 && (
            <span className="mt-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
              Recommended
            </span>
          )}
        </div>
      </div>
      {pending && (
        <div className="flex flex-col gap-3 border-t border-line bg-bg/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p
            className={cn(
              'flex items-center gap-1.5 text-sm font-medium',
              msLeft < 3 * 60_000 ? 'text-red-700' : 'text-teal-700',
            )}
            role="timer"
          >
            <Timer size={16} aria-hidden /> {respondLabel(msLeft)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={<X size={16} />}
              onClick={() => setDeclineOpen(true)}
              disabled={accept.isPending}
            >
              Decline
            </Button>
            <Button
              variant="success"
              icon={<Check size={16} />}
              onClick={doAccept}
              loading={accept.isPending}
              className="min-w-[120px]"
            >
              Accept
            </Button>
          </div>
        </div>
      )}
      {offer.status === 'SUPERSEDED' && (
        <p className="border-t border-line bg-bg/60 px-5 py-3 text-sm text-slate">
          This food was taken by another Receiver.
        </p>
      )}
      <DeclineModal offerId={offer.id} open={declineOpen} onClose={() => setDeclineOpen(false)} />
    </article>
  );
}
