import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Flag,
  KeyRound,
  MapPin,
  Phone,
  Star,
  XCircle,
} from 'lucide-react';
import { useAllocation, useCancelAllocation } from '@/hooks/queries';
import { useAuth } from '@/lib/auth';
import { googleMapsUrl, formatDateTime, formatTime } from '@/lib/format';
import { Button, buttonClass } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Countdown } from '@/components/ui/Countdown';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ReasonModal } from '@/components/ui/ReasonModal';
import { useToast } from '@/components/ui/Toast';
import { PickupMap } from '@/components/map/PickupMap';
import { FssaiLabelCard } from '@/components/donation/FssaiLabelCard';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ConfirmDistributionModal } from '@/components/allocation/ConfirmDistributionModal';
import { DisputeModal } from '@/components/allocation/DisputeModal';

/** "Show this code to the donor: 4 8 2 7" */
export function HandoverCodeDisplay({ code }: { code: string }) {
  return (
    <div className="overflow-hidden rounded-card bg-ink text-white shadow-lift">
      <div className="flex items-center gap-2 px-5 pt-4 text-sm text-white/80">
        <KeyRound size={16} aria-hidden /> Show this code to the donor:
      </div>
      <p
        className="px-5 pb-5 pt-1 text-center font-heading text-5xl font-bold tabular-nums tracking-[0.3em] sm:text-6xl"
        aria-label={`Handover code ${code.split('').join(' ')}`}
        data-testid="handover-code"
      >
        {code.split('').join(' ')}
      </p>
    </div>
  );
}

export default function PickupPage() {
  const { allocationId = '' } = useParams();
  const { data: a, isLoading, isError, error, refetch } = useAllocation(allocationId);
  const cancel = useCancelAllocation(allocationId);
  const { receiverProfile } = useAuth();
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const back = (
    <Link
      to="/receiver"
      className="mb-3 inline-flex items-center gap-1 text-sm text-slate hover:text-ink"
    >
      <ArrowLeft size={16} aria-hidden /> Dashboard
    </Link>
  );
  if (isLoading) return <PageSpinner />;
  if (isError || !a)
    return (
      <div>
        {back}
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );

  const rLat = a.receiver_lat ?? receiverProfile?.lat;
  const rLng = a.receiver_lng ?? receiverProfile?.lng;
  const pins = [
    {
      id: 'pickup',
      lat: a.pickup_lat,
      lng: a.pickup_lng,
      color: 'gold' as const,
      label: `Pickup: ${a.donor_org_name}`,
    },
    ...(typeof rLat === 'number' && typeof rLng === 'number'
      ? [{ id: 'me', lat: rLat, lng: rLng, color: 'teal' as const, label: 'Your location' }]
      : []),
  ];

  return (
    <div className="space-y-6">
      {back}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <StatusBadge kind="allocation" status={a.status} />
          <h1 className="mt-2 font-heading text-2xl font-semibold text-ink">
            {a.donation?.title ?? 'Pickup'}
          </h1>
          <p className="mt-1 text-sm text-slate">
            {a.servings} servings from {a.donor_org_name}
          </p>
          {a.status === 'ACCEPTED' && (
            <div className="mt-2">
              <Countdown deadline={a.effective_deadline} prefix="Pickup by" showTime size="lg" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {a.status === 'COLLECTED' && (
            <Button
              variant="success"
              size="lg"
              icon={<CheckCircle2 size={18} />}
              onClick={() => setCompleteOpen(true)}
            >
              Confirm distribution
            </Button>
          )}
          {a.status === 'COMPLETED' && !a.feedback_submitted_by_me && (
            <Link to={`/allocations/${a.id}/feedback`} className={buttonClass('primary', 'lg')}>
              <Star size={18} aria-hidden /> Give feedback
            </Link>
          )}
        </div>
      </div>

      {a.status === 'ACCEPTED' && a.handover_code && <HandoverCodeDisplay code={a.handover_code} />}
      {a.status === 'COMPLETED' && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          Completed {formatDateTime(a.completed_at)} · {a.servings_distributed ?? '—'} servings
          distributed
          {a.distribution_area ? ` in ${a.distribution_area}` : ''}.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="space-y-2">
            <PickupMap pins={pins} height={300} />
            <a
              href={googleMapsUrl(a.pickup_lat, a.pickup_lng)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass('secondary', 'md')}
            >
              <ExternalLink size={16} aria-hidden /> Open in Google Maps
            </a>
          </div>
          {a.status !== 'CANCELLED' && a.status !== 'NO_SHOW' && (
            <ChatPanel allocation={a} otherPartyName={a.donor_org_name} />
          )}
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader title={a.donor_org_name} subtitle="Donor" />
            <CardBody className="space-y-3 text-sm">
              <p className="flex items-start gap-2 text-ink">
                <MapPin size={16} className="mt-0.5 shrink-0 text-slate" aria-hidden />
                {a.pickup_address}
              </p>
              {a.pickup_instructions && (
                <p className="rounded-lg bg-bg px-3 py-2 text-slate">{a.pickup_instructions}</p>
              )}
              {a.donor_phone && (
                <a
                  href={`tel:${a.donor_phone}`}
                  className={buttonClass('secondary', 'md', 'w-full')}
                >
                  <Phone size={16} aria-hidden /> Call {a.donor_phone}
                </a>
              )}
              <p className="text-xs text-slate">
                Accepted {formatTime(a.accepted_at)} · expected arrival about {formatTime(a.eta_at)}
              </p>
            </CardBody>
          </Card>
          <FssaiLabelCard
            title={a.donation?.title ?? ''}
            source={a.donor_org_name}
            preparedAt={a.donation?.prepared_at}
            lastConsumptionAt={a.donation?.last_consumption_at}
            diet={a.donation?.diet_type ?? 'veg'}
            allergens={a.donation?.allergens}
          />
          <div className="flex flex-col gap-2">
            {a.status === 'ACCEPTED' && (
              <Button
                variant="secondary"
                className="text-red-700"
                icon={<XCircle size={16} />}
                onClick={() => setCancelOpen(true)}
              >
                Cancel pickup
              </Button>
            )}
            {a.status !== 'CANCELLED' && (
              <Button
                variant="ghost"
                icon={<Flag size={16} />}
                onClick={() => setDisputeOpen(true)}
              >
                Raise dispute
              </Button>
            )}
          </div>
        </aside>
      </div>

      <ReasonModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this pickup?"
        warning="Cancelling affects your reliability score"
        confirmLabel="Cancel pickup"
        loading={cancel.isPending}
        error={cancel.error}
        onConfirm={(reason) =>
          cancel.mutate(reason, {
            onSuccess: () => {
              setCancelOpen(false);
              toast({ title: 'Pickup cancelled', body: 'The Donor has been notified.' });
            },
          })
        }
      />
      <ConfirmDistributionModal
        allocationId={a.id}
        servings={a.servings}
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
      />
      <DisputeModal allocationId={a.id} open={disputeOpen} onClose={() => setDisputeOpen(false)} />
    </div>
  );
}
