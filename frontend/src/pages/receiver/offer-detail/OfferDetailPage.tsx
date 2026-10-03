import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Brain, Check, Timer, X } from 'lucide-react';
import { useOffer } from '@/hooks/queries';
import { useNow } from '@/hooks/useNow';
import { useAuth } from '@/lib/auth';
import { respondLabel } from '@/lib/format';
import { FACTOR_LABELS, FACTOR_ORDER, FOOD_CATEGORY_LABELS, STORAGE_LABELS } from '@/lib/labels';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Countdown } from '@/components/ui/Countdown';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DietDot, InfoRow } from '@/components/ui/misc';
import { PickupMap } from '@/components/map/PickupMap';
import { FssaiLabelCard } from '@/components/donation/FssaiLabelCard';
import { OfferReasons, scoreTone, useOfferActions } from '@/components/offer/OfferCard';
import { DeclineModal } from '@/components/offer/DeclineModal';
import { cn } from '@/lib/cn';
import type { Offer } from '@/types';

export function FactorBars({
  factors,
}: {
  factors: Partial<Record<string, number>> | null | undefined;
}) {
  if (!factors) return null;
  return (
    <ul className="space-y-2.5">
      {FACTOR_ORDER.filter((f) => factors[f] !== undefined).map((f) => {
        const v = Math.max(0, Math.min(1, factors[f] ?? 0));
        return (
          <li key={f}>
            <div className="flex justify-between text-xs">
              <span className="font-medium text-ink">{FACTOR_LABELS[f]}</span>
              <span className="tabular-nums text-slate">{v.toFixed(2)}</span>
            </div>
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={v}
              aria-label={FACTOR_LABELS[f]}
            >
              <div
                className={cn(
                  'h-full rounded-full',
                  v >= 0.7 ? 'bg-green' : v >= 0.4 ? 'bg-teal' : 'bg-gold',
                )}
                style={{ width: `${v * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Actions({ offer }: { offer: Offer }) {
  const now = useNow(5_000);
  const [declineOpen, setDeclineOpen] = useState(false);
  const { accept, doAccept } = useOfferActions(offer);
  const msLeft = new Date(offer.expires_at).getTime() - now;
  if (offer.status !== 'PENDING' || msLeft <= 0) return null;
  return (
    <div className="sticky bottom-16 z-10 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:rounded-card md:border md:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          className={cn(
            'flex items-center gap-1.5 font-medium',
            msLeft < 3 * 60_000 ? 'text-red-700' : 'text-teal-700',
          )}
          role="timer"
        >
          <Timer size={18} aria-hidden /> {respondLabel(msLeft)}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="lg"
            icon={<X size={18} />}
            onClick={() => setDeclineOpen(true)}
          >
            Decline
          </Button>
          <Button
            variant="success"
            size="lg"
            icon={<Check size={18} />}
            onClick={doAccept}
            loading={accept.isPending}
            className="flex-1 sm:flex-none"
          >
            Accept
          </Button>
        </div>
      </div>
      <DeclineModal offerId={offer.id} open={declineOpen} onClose={() => setDeclineOpen(false)} />
    </div>
  );
}

export default function OfferDetailPage() {
  const { id = '' } = useParams();
  const { data: offer, isLoading, isError, error, refetch } = useOffer(id);
  const { receiverProfile } = useAuth();
  const back = (
    <Link
      to="/receiver"
      className="mb-3 inline-flex items-center gap-1 text-sm text-slate hover:text-ink"
    >
      <ArrowLeft size={16} aria-hidden /> Offers
    </Link>
  );
  if (isLoading) return <PageSpinner />;
  if (isError || !offer)
    return (
      <div>
        {back}
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  const d = offer.donation;
  const pins = [
    {
      id: 'pickup',
      lat: d.pickup_lat,
      lng: d.pickup_lng,
      color: 'gold' as const,
      label: `Pickup: ${d.donor_org_name}`,
    },
    ...(receiverProfile
      ? [
          {
            id: 'me',
            lat: receiverProfile.lat,
            lng: receiverProfile.lng,
            color: 'teal' as const,
            label: 'You',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {back}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge level={d.priority_level} />
            <StatusBadge kind="offer" status={offer.status} />
          </div>
          <h1 className="mt-2 font-heading text-2xl font-semibold text-ink">{d.title}</h1>
          <p className="mt-1 text-sm text-slate">
            From {d.donor_org_name} · {offer.distance_km} km · about {offer.eta_minutes} min
          </p>
          <div className="mt-2">
            <Countdown deadline={d.effective_deadline} prefix="Pickup by" showTime size="lg" />
          </div>
        </div>
        <div className="card flex items-center gap-4 px-5 py-4">
          <Brain size={28} className="text-purple" aria-hidden />
          <div>
            <p
              className={cn(
                'font-heading text-5xl font-bold tabular-nums',
                scoreTone(offer.match_score),
              )}
            >
              {offer.match_score}%
            </p>
            <p className="text-xs font-medium uppercase tracking-wide text-slate">
              JEV match score
            </p>
          </div>
        </div>
      </div>

      {offer.status === 'SUPERSEDED' && (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-line">
          This food was taken by another Receiver.
        </p>
      )}

      <Actions offer={offer} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Why you were matched"
              icon={<Brain size={18} className="text-purple" />}
            />
            <CardBody className="grid gap-6 sm:grid-cols-2">
              <OfferReasons reasons={offer.reasons} />
              <FactorBars factors={offer.factor_scores} />
            </CardBody>
          </Card>
          <PickupMap pins={pins} height={300} />
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Offer" />
            <CardBody className="py-2">
              <dl className="divide-y divide-line">
                <InfoRow label="Servings offered">{offer.offered_servings}</InfoRow>
                <InfoRow label="Category">{FOOD_CATEGORY_LABELS[d.food_category]}</InfoRow>
                <InfoRow label="Diet">
                  <DietDot diet={d.diet_type} withLabel />
                </InfoRow>
                {d.storage_condition && (
                  <InfoRow label="Storage">{STORAGE_LABELS[d.storage_condition]}</InfoRow>
                )}
                <InfoRow label="Rank">#{offer.rank}</InfoRow>
              </dl>
            </CardBody>
          </Card>
          <FssaiLabelCard
            title={d.title}
            source={d.donor_org_name}
            preparedAt={d.prepared_at}
            lastConsumptionAt={d.last_consumption_at}
            diet={d.diet_type}
            allergens={d.allergens}
          />
        </aside>
      </div>
    </div>
  );
}
