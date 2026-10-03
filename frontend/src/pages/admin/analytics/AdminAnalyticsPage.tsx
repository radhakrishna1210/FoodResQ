import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useAdminAnalytics } from '@/hooks/queries';
import { formatIST, formatMinutes, formatNumber, formatPercent } from '@/lib/format';
import { FOOD_CATEGORY_LABELS } from '@/lib/labels';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/EmptyState';
import { BarChart, ChartTable, LineChart } from '@/components/charts/Charts';

const DAY = 86_400_000;
const isoDay = (t: number) => formatIST(t, 'yyyy-MM-dd');

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [from, setFrom] = useState(() => isoDay(Date.now() - 29 * DAY));
  const [to, setTo] = useState(() => isoDay(Date.now()));
  // Backend takes datetimes; send whole IST days so `to` includes that day.
  const { data, isLoading, isError, error, refetch } = useAdminAnalytics({
    from: from ? `${from}T00:00:00+05:30` : undefined,
    to: to ? `${to}T23:59:59.999+05:30` : undefined,
  });

  const perDay = (data?.meals_per_day ?? []).map((p) => ({
    label: formatIST(`${p.date}T12:00:00Z`, 'd MMM'),
    value: p.meals,
  }));
  const byCat = (data?.donations_by_category ?? []).map((c) => ({
    label: FOOD_CATEGORY_LABELS[c.food_category] ?? c.food_category,
    value: c.count,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<BarChart3 size={20} className="text-purple" />}
        title="Analytics"
        subtitle="Success metrics measured from confirmed handovers (README §10)."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate">
              From
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 block h-9 rounded-lg border border-line bg-white px-2 text-sm text-ink"
              />
            </label>
            <label className="text-xs text-slate">
              To
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 block h-9 rounded-lg border border-line bg-white px-2 text-sm text-ink"
              />
            </label>
          </div>
        }
      />
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-card" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Meals rescued" value={formatNumber(data.meals_rescued)} />
            <Metric label="Successful rescues" value={formatNumber(data.successful_rescues)} />
            <Metric label="Donations posted" value={formatNumber(data.donations_posted)} />
            <Metric label="Fully matched" value={formatPercent(data.fully_matched_rate)} />
            <Metric label="Expiry rate" value={formatPercent(data.expiry_rate)} />
            <Metric
              label="Avg. time to acceptance"
              value={formatMinutes(data.avg_time_to_acceptance_minutes)}
            />
            <Metric
              label="Offer acceptance rate"
              value={formatPercent(data.offer_acceptance_rate)}
            />
            <Metric label="No-shows" value={formatNumber(data.no_show_count)} />
            <Metric label="Good condition" value={formatPercent(data.good_condition_rate)} />
            <Metric label="Active Donors" value={formatNumber(data.active_donors)} />
            <Metric label="Active Receivers" value={formatNumber(data.active_receivers)} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Meals rescued per day" />
              <CardBody>
                {perDay.length === 0 ? (
                  <EmptyState title="No data for this range" />
                ) : (
                  <LineChart data={perDay} unit=" meals" />
                )}
                {perDay.length > 0 && <ChartTable data={perDay} valueLabel="Meals" />}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Donations by food category" />
              <CardBody>
                {byCat.length === 0 ? (
                  <EmptyState title="No data for this range" />
                ) : (
                  <BarChart data={byCat} unit=" donations" />
                )}
                {byCat.length > 0 && <ChartTable data={byCat} valueLabel="Donations" />}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
