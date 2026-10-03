import { useState } from 'react';
import { History } from 'lucide-react';
import { useDonations } from '@/hooks/queries';
import { DonationCard } from '@/components/donation/DonationCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Spinner';
import { PageHeader, Pagination } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import type { DonationStatus } from '@/types';

const TABS: Array<{ label: string; status?: DonationStatus }> = [
  { label: 'All' },
  { label: 'Completed', status: 'COMPLETED' },
  { label: 'Collected', status: 'COLLECTED' },
  { label: 'Expired', status: 'EXPIRED' },
  { label: 'Cancelled', status: 'CANCELLED' },
];

export default function DonorHistoryPage() {
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);
  const status = TABS[tab].status;
  const { data, isLoading, isError, error, refetch } = useDonations({ status, page });

  return (
    <div>
      <PageHeader
        icon={<History size={20} />}
        title="Past donations"
        subtitle="Everything you have posted, newest first."
      />
      <div
        className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-white p-1 ring-1 ring-line"
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
              'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === i ? 'bg-primary text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<History size={22} />}
          title="Nothing here yet"
          body="Donations you post will appear here."
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {data.items.map((d) => (
              <DonationCard key={d.id} donation={d} to={`/donor/donations/${d.id}`} />
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
