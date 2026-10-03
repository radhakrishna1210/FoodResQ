import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAdminSafety, useResolveSafety } from '@/hooks/queries';
import { REPORT_STATUS_LABELS } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, InlineError } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Field, Textarea } from '@/components/ui/Form';
import { PageHeader } from '@/components/ui/misc';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import type { ReportStatus, SafetyReport } from '@/types';

const TONE = { open: 'red', resolved_valid: 'gold', resolved_invalid: 'grey' } as const;

function ResolveModal({ report, onClose }: { report: SafetyReport | null; onClose: () => void }) {
  const resolve = useResolveSafety();
  const toast = useToast();
  const [status, setStatus] = useState<Exclude<ReportStatus, 'open'>>('resolved_valid');
  const [notes, setNotes] = useState('');
  if (!report) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title="Safety report"
      description={`Reported ${formatDateTime(report.created_at)}`}
      size="lg"
      footer={
        report.status === 'open' ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="purple"
              disabled={notes.trim().length < 3}
              loading={resolve.isPending}
              onClick={() =>
                resolve.mutate(
                  { id: report.id, status, admin_notes: notes.trim() },
                  {
                    onSuccess: () => {
                      toast({ title: 'Report resolved', tone: 'success' });
                      onClose();
                    },
                  },
                )
              }
            >
              Resolve
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-bg p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate">Description</p>
          <p className="mt-1 whitespace-pre-wrap text-ink">{report.description}</p>
        </div>
        <p className="text-sm text-slate">
          Donor:{' '}
          <span className="font-medium text-ink">{report.donor_org_name ?? report.donor_id}</span> ·{' '}
          <Link to={`/admin/donations/${report.donation_id}`} className="link">
            {report.donation_title ?? 'Open donation'}
          </Link>
        </p>
        {report.photo_url && (
          <img
            src={report.photo_url}
            alt="Reported food"
            className="max-h-64 rounded-lg border border-line"
          />
        )}
        {report.status === 'open' ? (
          <>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-medium text-ink">Outcome</legend>
              {(['resolved_valid', 'resolved_invalid'] as const).map((s) => (
                <label
                  key={s}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                    status === s ? 'border-purple bg-purple-50' : 'border-line',
                  )}
                >
                  <input
                    type="radio"
                    name="report-status"
                    checked={status === s}
                    onChange={() => setStatus(s)}
                    className="accent-[#715BB0]"
                  />
                  {REPORT_STATUS_LABELS[s]}
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-slate">
              A valid report lowers the Donor&apos;s quality score; two valid reports in 30 days
              suspend the Donor.
            </p>
            <Field label="Admin notes" htmlFor="admin-notes" required>
              <Textarea id="admin-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <InlineError error={resolve.error} />
          </>
        ) : (
          <div className="rounded-lg border border-line p-3 text-sm">
            <p className="font-medium text-ink">{REPORT_STATUS_LABELS[report.status]}</p>
            {report.admin_notes && <p className="mt-1 text-slate">{report.admin_notes}</p>}
            <p className="mt-1 text-xs text-slate">{formatDateTime(report.resolved_at)}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function AdminSafetyPage() {
  const { data = [], isLoading, isError, error, refetch } = useAdminSafety();
  const [selected, setSelected] = useState<SafetyReport | null>(null);
  const sorted = [...data].sort(
    (a, b) =>
      Number(b.status === 'open') - Number(a.status === 'open') ||
      b.created_at.localeCompare(a.created_at),
  );

  return (
    <div>
      <PageHeader
        icon={<ShieldAlert size={20} className="text-red" />}
        title="Safety reports"
        subtitle="Reported by Receivers through feedback. Donation status does not change."
      />
      {isLoading ? (
        <CardSkeleton rows={4} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={22} />}
          title="No safety reports"
          body="Reports from Receivers appear here."
        />
      ) : (
        <ul className="space-y-3">
          {sorted.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className="card card-hover flex w-full items-start justify-between gap-4 p-4 text-left"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {r.donation_title ?? 'Donation'} · {r.donor_org_name ?? 'Donor'}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate">{r.description}</p>
                  <p className="mt-1 text-xs text-slate">{formatDateTime(r.created_at)}</p>
                </div>
                <Badge tone={TONE[r.status]}>{REPORT_STATUS_LABELS[r.status]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ResolveModal report={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
