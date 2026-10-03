import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardCheck,
  Flag,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Utensils,
} from 'lucide-react';
import { useAdminOverview } from '@/hooks/queries';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Spinner';
import { Countdown } from '@/components/ui/Countdown';
import { PageHeader, Section } from '@/components/ui/misc';
import { formatNumber, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';

function Counter({
  to,
  label,
  value,
  icon,
  tone,
}: {
  to: string;
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Link
      to={to}
      className="card card-hover flex items-center gap-4 p-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-purple/20"
    >
      <span className={cn('flex h-11 w-11 items-center justify-center rounded-lg', tone)}>
        {icon}
      </span>
      <div>
        <p className="font-heading text-2xl font-semibold tabular-nums text-ink">
          {formatNumber(value)}
        </p>
        <p className="text-sm text-slate">{label}</p>
      </div>
    </Link>
  );
}

export default function AdminOverviewPage() {
  const { data, isLoading, isError, error, refetch } = useAdminOverview();
  return (
    <div className="space-y-8">
      <PageHeader
        icon={<ShieldCheck size={20} className="text-purple" />}
        title="Admin overview"
        subtitle="What needs your attention right now."
      />
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[84px] rounded-card" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Counter
              to="/admin/verifications"
              label="Pending verifications"
              value={data.pending_verifications}
              icon={<ClipboardCheck size={20} />}
              tone="bg-gold-50 text-gold"
            />
            <Counter
              to="/admin/flags"
              label="Flagged donations"
              value={data.flagged_donations}
              icon={<Flag size={20} />}
              tone="bg-gold-50 text-gold"
            />
            <Counter
              to="/admin/safety"
              label="Open safety reports"
              value={data.open_safety_reports}
              icon={<ShieldAlert size={20} />}
              tone="bg-red-50 text-red"
            />
            <Counter
              to="/admin/disputes"
              label="Open disputes"
              value={data.open_disputes}
              icon={<Scale size={20} />}
              tone="bg-purple-50 text-purple"
            />
            <Counter
              to="/admin/live"
              label="Active rescues"
              value={data.active_rescues}
              icon={<Truck size={20} />}
              tone="bg-teal-50 text-teal-700"
            />
            <Counter
              to="/admin/analytics"
              label="Meals rescued today"
              value={data.meals_rescued_today}
              icon={<Utensils size={20} />}
              tone="bg-green-50 text-green"
            />
          </div>
          <Section title="No-match alerts">
            {!data.recent_no_match_alerts || data.recent_no_match_alerts.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle size={22} />}
                title="No recent no-match alerts"
                body="Donations the JEV engine could not place show up here for manual assignment."
              />
            ) : (
              <div className="space-y-3">
                {data.recent_no_match_alerts.map((n) => (
                  <div
                    key={n.donation_id}
                    className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-ink">{n.title}</p>
                      <p className="text-sm text-slate">
                        {n.donor_org_name} · {n.remaining_servings} servings unmatched · alerted{' '}
                        {timeAgo(n.alerted_at)}
                      </p>
                      <div className="mt-1.5">
                        <Countdown deadline={n.effective_deadline} prefix="Pickup by" />
                      </div>
                    </div>
                    <ButtonLink
                      to={`/admin/donations/${n.donation_id}#assign`}
                      variant="purple"
                      size="sm"
                    >
                      Assign manually
                    </ButtonLink>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
