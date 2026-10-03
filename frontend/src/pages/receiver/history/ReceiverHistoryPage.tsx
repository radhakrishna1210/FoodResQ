import { useState } from 'react';
import { CheckCircle2, Clock, History, ShieldCheck, Utensils } from 'lucide-react';
import { useAllocations, useMyImpact } from '@/hooks/queries';
import { PickupCard } from '@/components/allocation/PickupCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton, Skeleton } from '@/components/ui/Spinner';
import { PageHeader, Pagination, Stat } from '@/components/ui/misc';
import { formatMinutes, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { AllocationStatus } from '@/types';

const TABS: Array<{ label: string; status?: AllocationStatus }> = [
  { label: 'All' },
  { label: 'Completed', status: 'COMPLETED' },
  { label: 'Collected', status: 'COLLECTED' },
  { label: 'No-show', status: 'NO_SHOW' },
  { label: 'Cancelled', status: 'CANCELLED' },
];

function ReceiverImpact() {
  const { data, isLoading, isError } = useMyImpact();
  if (isError) return null;
  if (isLoading) return <Skeleton className="h-[84px] rounded-card" />;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label="Meals rescued"
        value={formatNumber(data?.meals_rescued ?? 0)}
        icon={<Utensils size={20} />}
        tone="teal"
      />
      <Stat
        label="Successful rescues"
        value={formatNumber(data?.successful_rescues ?? 0)}
        icon={<CheckCircle2 size={20} />}
        tone="green"
      />
      <Stat
        label="On-time pickups"
        value={formatPercent(data?.on_time_pickup_rate)}
        icon={<Clock size={20} />}
        tone="primary"
      />
      <Stat
        label="Reliability"
        value={
          data?.reliability_score !== undefined && data?.reliability_score !== null
            ? Number(data.reliability_score).toFixed(2)
            : '—'
        }
        icon={<ShieldCheck size={20} />}
        tone="purple"
        hint={
          data?.avg_time_to_acceptance_minutes
            ? `Avg. acceptance ${formatMinutes(data.avg_time_to_acceptance_minutes)}`
            : undefined
        }
      />
    </div>
  );
}

export default function ReceiverHistoryPage() {
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useAllocations({
    status: TABS[tab].status,
    page,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<History size={20} className="text-teal-700" />}
        title="Pickup history"
        subtitle="Your past allocations and impact."
      />
      <ReceiverImpact />
      <div
        className="flex gap-1 overflow-x-auto rounded-lg bg-white p-1 ring-1 ring-line"
        role="tablist"
        aria-label="Filter by status"
      >
        {TABS.map((t, i) => (
          <button
            key={t.label}
            role="tab"
            aria-selected={tab === i}
            onClick={() => {
              setTab(i);
              setPage(1);
            }}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium',
              tab === i ? 'bg-teal text-white' : 'text-slate-700 hover:bg-slate-50',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <CardSkeleton />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<History size={22} />}
          title="No pickups yet"
          body="Accepted offers appear here."
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {data.items.map((a) => (
              <PickupCard key={a.id} allocation={a} />
            ))}
          </div>
          <Pagination
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
