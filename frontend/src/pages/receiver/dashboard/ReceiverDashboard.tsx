import { useEffect, useState } from 'react';
import { HandHeart, Inbox, Save, Truck } from 'lucide-react';
import {
  useAllocations,
  useOffers,
  useReceiverProfile,
  useSetAvailability,
  useSetNeeds,
} from '@/hooks/queries';
import { useAuth } from '@/lib/auth';
import { todayIST } from '@/lib/format';
import { errorMessage } from '@/lib/api';
import { OfferCard } from '@/components/offer/OfferCard';
import { PickupCard } from '@/components/allocation/PickupCard';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton, Skeleton } from '@/components/ui/Spinner';
import { PageHeader, Section } from '@/components/ui/misc';
import { useToast } from '@/components/ui/Toast';

function AvailabilityBar() {
  const { data: profile, isLoading } = useReceiverProfile();
  const setAvail = useSetAvailability();
  const setNeeds = useSetNeeds();
  const toast = useToast();
  const neededToday =
    profile && profile.meals_needed_set_on === todayIST() ? profile.meals_needed_today : null;
  const [meals, setMeals] = useState<string>('');

  useEffect(() => {
    setMeals(neededToday === null || neededToday === undefined ? '' : String(neededToday));
  }, [neededToday]);

  if (isLoading || !profile) return <Skeleton className="h-[92px] rounded-card" />;

  const saveMeals = () => {
    const n = Number(meals);
    if (!Number.isInteger(n) || n < 0) return;
    setNeeds.mutate(n, {
      onSuccess: () =>
        toast({ title: 'Saved', body: `Meals we need today: ${n}`, tone: 'success' }),
      onError: (e) => toast({ title: "Couldn't save", body: errorMessage(e), tone: 'error' }),
    });
  };

  return (
    <div className="card grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
      <div className={`rounded-lg p-3 ${profile.is_available_now ? 'bg-green-50' : 'bg-slate-50'}`}>
        <Toggle
          tone="green"
          checked={profile.is_available_now}
          disabled={setAvail.isPending}
          onChange={(v) =>
            setAvail.mutate(v, {
              onError: (e) =>
                toast({ title: "Couldn't update", body: errorMessage(e), tone: 'error' }),
            })
          }
          label="Available now"
          description={
            profile.is_available_now
              ? 'You are receiving food offers.'
              : 'Offers are paused until you turn this on.'
          }
        />
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          saveMeals();
        }}
      >
        <div className="flex-1">
          <label htmlFor="meals-needed" className="text-sm font-medium text-ink">
            Meals we need today
          </label>
          <input
            id="meals-needed"
            type="number"
            min={0}
            inputMode="numeric"
            value={meals}
            onChange={(e) => setMeals(e.target.value)}
            placeholder="e.g. 150"
            className="mt-1 h-10 w-full rounded-lg border border-line px-3 text-sm tabular-nums focus:border-teal focus:outline-none focus:ring-4 focus:ring-teal/15"
          />
        </div>
        <Button
          type="submit"
          variant="teal"
          icon={<Save size={16} />}
          loading={setNeeds.isPending}
          disabled={meals === ''}
        >
          Save
        </Button>
      </form>
    </div>
  );
}

export default function ReceiverDashboard() {
  const { receiverProfile } = useAuth();
  const offers = useOffers({ status: 'PENDING' });
  const accepted = useAllocations({ status: 'ACCEPTED' });
  const collected = useAllocations({ status: 'COLLECTED' });

  const pending = [...(offers.data?.items ?? [])]
    .filter((o) => new Date(o.expires_at).getTime() > Date.now() - 60_000)
    .sort(
      (a, b) =>
        new Date(a.donation.effective_deadline).getTime() -
          new Date(b.donation.effective_deadline).getTime() ||
        new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime(),
    );
  const pickups = [...(accepted.data?.items ?? []), ...(collected.data?.items ?? [])];

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<HandHeart size={20} className="text-teal-700" />}
        title={receiverProfile?.org_name ?? 'Receiver dashboard'}
        subtitle="Incoming food offers and your active pickups."
      />
      <AvailabilityBar />

      <Section title="Incoming offers">
        {offers.isLoading ? (
          <CardSkeleton rows={4} />
        ) : offers.isError ? (
          <ErrorState error={offers.error} onRetry={() => void offers.refetch()} />
        ) : pending.length === 0 ? (
          <EmptyState
            icon={<Inbox size={22} />}
            title="No offers right now"
            body="No offers right now. Keep 'Available now' on to receive food offers near you."
          />
        ) : (
          <div className="space-y-4">
            {pending.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Active pickups">
        {accepted.isLoading || collected.isLoading ? (
          <CardSkeleton />
        ) : accepted.isError ? (
          <ErrorState error={accepted.error} onRetry={() => void accepted.refetch()} />
        ) : pickups.length === 0 ? (
          <EmptyState
            icon={<Truck size={22} />}
            title="No active pickups"
            body="Accepted offers show up here until you confirm distribution."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pickups.map((a) => (
              <PickupCard key={a.id} allocation={a} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
