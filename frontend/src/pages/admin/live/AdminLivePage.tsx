import { Link } from 'react-router-dom';
import { Map as MapIcon, Truck, Utensils } from 'lucide-react';
import { useAdminLive } from '@/hooks/queries';
import { PickupMap, type MapPin } from '@/components/map/PickupMap';
import { Countdown } from '@/components/ui/Countdown';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminLivePage() {
  const { data, isLoading, isError, error, refetch } = useAdminLive();
  const donations = data?.donations ?? [];
  const allocations = data?.allocations ?? [];
  const pins: MapPin[] = [
    ...donations.map((d) => ({
      id: `d-${d.id}`,
      lat: d.pickup_lat,
      lng: d.pickup_lng,
      color: 'gold' as const,
      label: d.title,
      popup: (
        <div className="space-y-1">
          <Link to={`/admin/donations/${d.id}`} className="font-semibold text-primary">
            {d.title}
          </Link>
          <p className="text-xs">
            {d.donor_org_name} · {d.remaining_servings}/{d.quantity_servings} servings left
          </p>
          <Countdown deadline={d.effective_deadline} />
        </div>
      ),
    })),
    ...allocations.map((a) => ({
      id: `a-${a.id}`,
      lat: a.receiver_lat ?? a.pickup_lat,
      lng: a.receiver_lng ?? a.pickup_lng,
      color: 'teal' as const,
      label: `${a.receiver_org_name} pickup`,
      popup: (
        <div className="space-y-1">
          <Link to={`/admin/donations/${a.donation_id}`} className="font-semibold text-primary">
            {a.receiver_org_name}
          </Link>
          <p className="text-xs">
            {a.servings} servings{a.donation_title ? ` · ${a.donation_title}` : ''}
          </p>
          <Countdown deadline={a.effective_deadline} />
        </div>
      ),
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<MapIcon size={20} className="text-purple" />}
        title="Live map"
        subtitle="Active donations (gold) and active pickups (teal). Refreshes every 15 seconds."
      />
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-gold" aria-hidden /> Active donations (
          {donations.length})
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-teal" aria-hidden /> Active pickups (
          {allocations.length})
        </span>
      </div>
      {isLoading ? (
        <Skeleton className="h-[460px] rounded-card" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <PickupMap pins={pins} height={460} />
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 font-heading font-semibold text-ink">
                <Utensils size={16} className="text-gold" aria-hidden /> Donations
              </h2>
              {donations.length === 0 ? (
                <EmptyState title="No active donations" />
              ) : (
                donations.map((d) => (
                  <Link
                    key={d.id}
                    to={`/admin/donations/${d.id}`}
                    className="card card-hover flex items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{d.title}</p>
                      <p className="truncate text-xs text-slate">{d.donor_org_name}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={d.status} />
                      <Countdown deadline={d.effective_deadline} />
                    </div>
                  </Link>
                ))
              )}
            </section>
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 font-heading font-semibold text-ink">
                <Truck size={16} className="text-teal-700" aria-hidden /> Pickups
              </h2>
              {allocations.length === 0 ? (
                <EmptyState title="No active pickups" />
              ) : (
                allocations.map((a) => (
                  <Link
                    key={a.id}
                    to={`/admin/donations/${a.donation_id}`}
                    className="card card-hover flex items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{a.receiver_org_name}</p>
                      <p className="truncate text-xs text-slate">{a.servings} servings</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge kind="allocation" status={a.status} />
                      <Countdown deadline={a.effective_deadline} />
                    </div>
                  </Link>
                ))
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
