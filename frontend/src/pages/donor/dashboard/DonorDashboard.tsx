import { Clock, PlusCircle, Trophy, Utensils, CheckCircle2 } from 'lucide-react';
import { useDonations, useMyImpact } from '@/hooks/queries';
import { useAuth } from '@/lib/auth';
import { ButtonLink } from '@/components/ui/Button';
import { DonationCard } from '@/components/donation/DonationCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton, Skeleton } from '@/components/ui/Spinner';
import { PageHeader, Section, Stat } from '@/components/ui/misc';
import { formatMinutes, formatNumber } from '@/lib/format';
import { ACTIVE_DONATION_STATUSES } from '@/lib/labels';

export function ImpactStrip() {
  const { data, isLoading, isError } = useMyImpact();
  if (isError) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {isLoading ? (
        [0, 1, 2].map((i) => <Skeleton key={i} className="h-[84px] rounded-card" />)
      ) : (
        <>
          <Stat
            label="Meals rescued"
            value={formatNumber(data?.meals_rescued ?? 0)}
            icon={<Utensils size={20} />}
            tone="primary"
          />
          <Stat
            label="Successful rescues"
            value={formatNumber(data?.successful_rescues ?? 0)}
            icon={<CheckCircle2 size={20} />}
            tone="green"
          />
          <Stat
            label="Avg. time to acceptance"
            value={formatMinutes(data?.avg_time_to_acceptance_minutes)}
            icon={<Clock size={20} />}
            tone="teal"
          />
        </>
      )}
    </div>
  );
}

export default function DonorDashboard() {
  const { donorProfile, user } = useAuth();
  // TODO(team): GET /donations accepts a single `status`; we fetch the first page and filter active ones client-side.
  const { data, isLoading, isError, error, refetch } = useDonations({ page: 1 });
  const active = (data?.items ?? [])
    .filter((d) => (ACTIVE_DONATION_STATUSES as readonly string[]).includes(d.status))
    .sort(
      (a, b) => new Date(a.effective_deadline).getTime() - new Date(b.effective_deadline).getTime(),
    );

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<Utensils size={20} />}
        title={donorProfile?.org_name ?? 'Donor dashboard'}
        subtitle={`Hi ${user?.full_name?.split(' ')[0] ?? 'there'} — track your surplus food and rescues here.`}
        actions={
          <ButtonLink to="/donor/donations/new" size="lg" icon={<PlusCircle size={18} />}>
            Post surplus food
          </ButtonLink>
        }
      />
      {user?.account_status === 'suspended' && (
        <p
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red/20"
          role="alert"
        >
          Your account is suspended. Contact FoodResQ.
        </p>
      )}

      <Section title="Active donations">
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : active.length === 0 ? (
          <EmptyState
            icon={<Utensils size={22} />}
            title="No active donations"
            body="No active donations. When you have surplus food, post it here. It takes about a minute."
            action={
              <ButtonLink to="/donor/donations/new" icon={<PlusCircle size={16} />}>
                Post surplus food
              </ButtonLink>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((d) => (
              <DonationCard key={d.id} donation={d} to={`/donor/donations/${d.id}`} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Your impact"
        action={
          <ButtonLink to="/donor/impact" variant="ghost" size="sm" icon={<Trophy size={14} />}>
            See all
          </ButtonLink>
        }
      >
        <ImpactStrip />
      </Section>
    </div>
  );
}
