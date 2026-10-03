import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Scale } from 'lucide-react';
import { useAdminDisputes, useAdminMutation } from '@/hooks/queries';
import { api } from '@/lib/api';
import { DISPUTE_REASON_LABELS } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/misc';
import { ReasonModal } from '@/components/ui/ReasonModal';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { Dispute } from '@/types';

export default function AdminDisputesPage() {
  const { data = [], isLoading, isError, error, refetch } = useAdminDisputes();
  const resolve = useAdminMutation((v: { id: string; resolution: string }) =>
    api.adminResolveDispute(v.id, v.resolution),
  );
  const toast = useToast();
  const [viewing, setViewing] = useState<Dispute | null>(null);
  const [resolving, setResolving] = useState<Dispute | null>(null);
  const sorted = [...data].sort(
    (a, b) =>
      Number(b.status === 'open') - Number(a.status === 'open') ||
      b.created_at.localeCompare(a.created_at),
  );

  return (
    <div>
      <PageHeader
        icon={<Scale size={20} className="text-purple" />}
        title="Disputes"
        subtitle="Raised by Donors or Receivers about a specific pickup."
      />
      {isLoading ? (
        <CardSkeleton rows={4} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={22} />}
          title="No disputes"
          body="Disputes raised on allocations appear here."
        />
      ) : (
        <ul className="space-y-3">
          {sorted.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setViewing(d)}
                className="card card-hover flex w-full items-start justify-between gap-4 p-4 text-left"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{DISPUTE_REASON_LABELS[d.reason]}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate">{d.description}</p>
                  <p className="mt-1 text-xs text-slate">
                    {d.raised_by_name
                      ? `${d.raised_by_name}${d.raised_by_role ? ` (${d.raised_by_role})` : ''} · `
                      : ''}
                    {formatDateTime(d.created_at)}
                  </p>
                </div>
                <Badge tone={d.status === 'open' ? 'gold' : 'green'}>
                  {d.status === 'open' ? 'Open' : 'Resolved'}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? DISPUTE_REASON_LABELS[viewing.reason] : ''}
        description={
          viewing
            ? `Raised ${formatDateTime(viewing.created_at)} · allocation ${viewing.allocation_id.slice(0, 8)}`
            : undefined
        }
        footer={
          viewing?.status === 'open' ? (
            <Button
              variant="purple"
              onClick={() => {
                setResolving(viewing);
                setViewing(null);
              }}
            >
              Resolve
            </Button>
          ) : undefined
        }
      >
        {viewing && (
          <div className="space-y-3 text-sm">
            <p className="whitespace-pre-wrap rounded-lg bg-bg p-3 text-ink">
              {viewing.description}
            </p>
            {viewing.donation_id && (
              <Link
                to={`/admin/donations/${viewing.donation_id}`}
                className="font-medium text-primary hover:underline"
              >
                Open donation
              </Link>
            )}
            {viewing.resolution && (
              <div className="rounded-lg border border-green/30 bg-green-50 p-3">
                <p className="font-medium text-green-700">Resolution</p>
                <p className="mt-1 text-ink">{viewing.resolution}</p>
                <p className="mt-1 text-xs text-slate">{formatDateTime(viewing.resolved_at)}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
      <ReasonModal
        open={!!resolving}
        onClose={() => setResolving(null)}
        title="Resolve dispute"
        description="Both parties are notified with your resolution."
        label="Resolution"
        confirmLabel="Resolve"
        variant="purple"
        loading={resolve.isPending}
        error={resolve.error}
        onConfirm={(resolution) =>
          resolving &&
          resolve.mutate(
            { id: resolving.id, resolution },
            {
              onSuccess: () => {
                setResolving(null);
                toast({ title: 'Dispute resolved', tone: 'success' });
              },
            },
          )
        }
      />
    </div>
  );
}
