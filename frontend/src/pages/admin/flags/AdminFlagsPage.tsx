import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Flag, XCircle } from 'lucide-react';
import { useAdminFlags, useAdminMutation } from '@/hooks/queries';
import { api, errorMessage } from '@/lib/api';
import { FLAG_REASON_LABELS, FOOD_CATEGORY_LABELS } from '@/lib/labels';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Spinner';
import { Countdown } from '@/components/ui/Countdown';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { DietDot, PageHeader } from '@/components/ui/misc';
import { ReasonModal } from '@/components/ui/ReasonModal';
import { useToast } from '@/components/ui/Toast';
import type { Donation } from '@/types';

export default function AdminFlagsPage() {
  const { data = [], isLoading, isError, error, refetch } = useAdminFlags();
  const approve = useAdminMutation((id: string) => api.adminApprove(id));
  const reject = useAdminMutation((v: { id: string; reason: string }) =>
    api.adminRejectDonation(v.id, v.reason),
  );
  const toast = useToast();
  const [rejecting, setRejecting] = useState<Donation | null>(null);

  return (
    <div>
      <PageHeader
        icon={<Flag size={20} className="text-gold" />}
        title="Flagged donations"
        subtitle="Approve to start matching immediately, or reject with a reason."
      />
      {isLoading ? (
        <CardSkeleton rows={4} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={22} />}
          title="No flagged donations"
          body="Risky posts held for review appear here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((d) => (
            <article key={d.id} className="card overflow-hidden">
              <div className="flex gap-4 p-4">
                {d.photo_urls?.[0] ? (
                  <img
                    src={d.photo_urls[0]}
                    alt={`Photo of ${d.title}`}
                    className="h-24 w-24 shrink-0 rounded-lg border border-line object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-line bg-bg text-center text-xs text-slate">
                    No photo
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/admin/donations/${d.id}`}
                    className="font-heading font-semibold text-ink hover:text-primary"
                  >
                    {d.title}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-slate">
                    {d.donor_org_name} · {d.quantity_servings} servings ·{' '}
                    <DietDot diet={d.diet_type} withLabel /> ·{' '}
                    {FOOD_CATEGORY_LABELS[d.food_category]}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <PriorityBadge level={d.priority_level} />
                    <Countdown deadline={d.effective_deadline} prefix="Pickup by" />
                  </div>
                </div>
              </div>
              <ul className="space-y-1 border-t border-line bg-gold-50/40 px-4 py-3">
                {d.flag_reasons.map((r) => (
                  <li key={r} className="flex items-center gap-2 text-sm text-gold-700">
                    <AlertTriangle size={14} aria-hidden /> {FLAG_REASON_LABELS[r] ?? r}
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-red-700"
                  icon={<XCircle size={14} />}
                  onClick={() => setRejecting(d)}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="success"
                  icon={<CheckCircle2 size={14} />}
                  loading={approve.isPending && approve.variables === d.id}
                  onClick={() =>
                    approve.mutate(d.id, {
                      onSuccess: () =>
                        toast({
                          title: 'Approved',
                          body: 'Matching has started.',
                          tone: 'success',
                        }),
                      onError: (e) =>
                        toast({ title: "Couldn't approve", body: errorMessage(e), tone: 'error' }),
                    })
                  }
                >
                  Approve
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <ReasonModal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject this donation?"
        description="The Donor is notified with your reason. The donation is cancelled."
        confirmLabel="Reject donation"
        loading={reject.isPending}
        error={reject.error}
        onConfirm={(reason) =>
          rejecting &&
          reject.mutate(
            { id: rejecting.id, reason },
            {
              onSuccess: () => {
                setRejecting(null);
                toast({ title: 'Donation rejected' });
              },
            },
          )
        }
      />
    </div>
  );
}
