import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Brain, CheckCircle2, ScrollText, UserPlus, XCircle } from 'lucide-react';
import { useAdminDonation, useAdminMutation } from '@/hooks/queries';
import { api, errorMessage } from '@/lib/api';
import { EXCLUSION_LABELS, FACTOR_LABELS, FACTOR_ORDER } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState, InlineError } from '@/components/ui/ErrorState';
import { ReasonModal } from '@/components/ui/ReasonModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { DonationHeader, DonationOverview } from '@/components/donation/DonationOverview';
import type { AdminDonationDetail, Allocation, MatchRun } from '@/types';

function MatchRunCard({ run, index }: { run: MatchRun; index: number }) {
  const sorted = [...run.candidates].sort(
    (a, b) => Number(b.included) - Number(a.included) || (a.rank ?? 999) - (b.rank ?? 999),
  );
  return (
    <Card>
      <CardHeader
        icon={<Brain size={18} className="text-purple" />}
        title={`Match run #${index + 1} · ${run.trigger}`}
        subtitle={`${formatDateTime(run.run_at)} · radius ${run.search_radius_km} km · ${run.remaining_servings} servings remaining`}
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {FACTOR_ORDER.map((f) => (
            <span key={f} className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-700">
              {FACTOR_LABELS[f]} {Number(run.weights?.[f] ?? 0).toFixed(2)}
            </span>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="table-base min-w-[900px]">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Receiver</th>
                <th>Distance / ETA</th>
                <th>Capacity</th>
                {FACTOR_ORDER.map((f) => (
                  <th key={f} className="text-right">
                    {FACTOR_LABELS[f].slice(0, 5)}
                  </th>
                ))}
                <th className="text-right">Score</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.receiver_id} className={c.included ? '' : 'bg-bg/60 text-slate'}>
                  <td className="tabular-nums">{c.rank ?? '—'}</td>
                  <td>
                    <p className="font-medium text-ink">{c.org_name}</p>
                    {c.reasons?.length > 0 && (
                      <p className="max-w-[240px] text-xs text-slate">{c.reasons.join(' · ')}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap tabular-nums">
                    {c.distance_km ?? '—'} km · {c.eta_minutes ?? '—'} min
                  </td>
                  <td className="tabular-nums">{c.capacity_available ?? '—'}</td>
                  {FACTOR_ORDER.map((f) => (
                    <td key={f} className="text-right tabular-nums">
                      {c.factors?.[f] !== undefined ? Number(c.factors[f]).toFixed(2) : '—'}
                    </td>
                  ))}
                  <td className="text-right font-heading text-base font-semibold tabular-nums text-ink">
                    {c.match_score ?? '—'}
                  </td>
                  <td>
                    {c.included ? (
                      <Badge tone="green">Included</Badge>
                    ) : (
                      <Badge tone="grey">
                        {c.exclusion_code
                          ? (EXCLUSION_LABELS[c.exclusion_code] ?? c.exclusion_code)
                          : 'Excluded'}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {run.candidates.length === 0 && (
          <p className="text-sm text-slate">No Receivers evaluated in this run.</p>
        )}
      </CardBody>
    </Card>
  );
}

function AssignForm({ d }: { d: AdminDonationDetail }) {
  const toast = useToast();
  const assign = useAdminMutation((v: { receiver_id: string; servings: number; note: string }) =>
    api.adminAssign(d.id, v),
  );
  const candidates = d.match_runs
    .flatMap((r) => r.candidates)
    .filter((c, i, arr) => arr.findIndex((x) => x.receiver_id === c.receiver_id) === i);
  const [receiverId, setReceiverId] = useState('');
  const [servings, setServings] = useState(String(d.remaining_servings));
  const [note, setNote] = useState('');
  const n = Number(servings);
  const valid =
    receiverId.trim().length > 0 &&
    Number.isInteger(n) &&
    n >= 1 &&
    n <= d.remaining_servings &&
    note.trim().length >= 3;

  return (
    <Card id="assign">
      <CardHeader
        icon={<UserPlus size={18} className="text-purple" />}
        title="Manual assign"
        subtitle="Bypasses JEV filters except verification. A note is required."
      />
      <CardBody className="space-y-3">
        <Field
          label="Receiver"
          htmlFor="assign-receiver"
          hint="Pick an evaluated Receiver or paste a verified Receiver's user id"
        >
          <Select
            id="assign-receiver"
            value={candidates.some((c) => c.receiver_id === receiverId) ? receiverId : ''}
            onChange={(e) => setReceiverId(e.target.value)}
          >
            <option value="">Choose from match runs…</option>
            {candidates.map((c) => (
              <option key={c.receiver_id} value={c.receiver_id}>
                {c.org_name}
                {c.included
                  ? ''
                  : ` (${c.exclusion_code ? EXCLUSION_LABELS[c.exclusion_code] : 'excluded'})`}
              </option>
            ))}
          </Select>
          <Input
            className="mt-2"
            aria-label="Receiver user id"
            placeholder="Receiver user id"
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
          />
        </Field>
        <Field label="Servings" htmlFor="assign-servings" hint={`Up to ${d.remaining_servings}`}>
          <Input
            id="assign-servings"
            type="number"
            min={1}
            max={d.remaining_servings}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />
        </Field>
        <Field label="Note" htmlFor="assign-note" required>
          <Textarea
            id="assign-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <InlineError error={assign.error} />
        <Button
          variant="purple"
          block
          disabled={!valid || d.remaining_servings < 1}
          loading={assign.isPending}
          onClick={() =>
            assign.mutate(
              { receiver_id: receiverId.trim(), servings: n, note: note.trim() },
              {
                onSuccess: () => {
                  toast({ title: 'Receiver assigned', tone: 'success' });
                  setNote('');
                },
              },
            )
          }
        >
          Assign
        </Button>
      </CardBody>
    </Card>
  );
}

export default function AdminDonationPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const { data: d, isLoading, isError, error, refetch } = useAdminDonation(id);
  const approve = useAdminMutation((did: string) => api.adminApprove(did));
  const reject = useAdminMutation((v: { id: string; reason: string }) =>
    api.adminRejectDonation(v.id, v.reason),
  );
  const override = useAdminMutation((v: { id: string; reason: string }) =>
    api.adminOverrideCollect(v.id, v.reason),
  );
  const toast = useToast();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [overriding, setOverriding] = useState<Allocation | null>(null);

  useEffect(() => {
    if (d && location.hash === '#assign')
      document.getElementById('assign')?.scrollIntoView({ behavior: 'smooth' });
  }, [d, location.hash]);

  const back = (
    <Link
      to="/admin"
      className="mb-3 inline-flex items-center gap-1 text-sm text-slate hover:text-ink"
    >
      <ArrowLeft size={16} aria-hidden /> Overview
    </Link>
  );
  if (isLoading) return <PageSpinner />;
  if (isError || !d)
    return (
      <div>
        {back}
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        {back}
        <DonationHeader
          d={d}
          actions={
            <>
              <ButtonLink
                to={`/admin/audit-log?entity_id=${d.id}`}
                variant="secondary"
                icon={<ScrollText size={16} />}
              >
                Audit log
              </ButtonLink>
              {d.status === 'FLAGGED' && (
                <>
                  <Button
                    variant="secondary"
                    className="text-red-700"
                    icon={<XCircle size={16} />}
                    onClick={() => setRejectOpen(true)}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="success"
                    icon={<CheckCircle2 size={16} />}
                    loading={approve.isPending}
                    onClick={() =>
                      approve.mutate(d.id, {
                        onSuccess: () =>
                          toast({
                            title: 'Approved',
                            body: 'Matching has started.',
                            tone: 'success',
                          }),
                        onError: (e) =>
                          toast({
                            title: "Couldn't approve",
                            body: errorMessage(e),
                            tone: 'error',
                          }),
                      })
                    }
                  >
                    Approve
                  </Button>
                </>
              )}
            </>
          }
        />
        <p className="-mt-4 mb-6 text-sm text-slate">
          {d.donor_org_name} · priority score {Number(d.priority_score).toFixed(3)} · search radius{' '}
          {d.search_radius_km} km
        </p>
      </div>

      <DonationOverview
        d={d}
        mode="admin"
        onOverride={setOverriding}
        sideExtra={
          ['POSTED', 'MATCHED', 'ACCEPTED'].includes(d.status) && d.remaining_servings > 0 ? (
            <AssignForm d={d} />
          ) : undefined
        }
      />

      {d.offers?.length > 0 && (
        <Card>
          <CardHeader title="Offers" subtitle="All offers sent for this donation" />
          <CardBody className="overflow-x-auto p-0">
            <table className="table-base min-w-[720px]">
              <thead>
                <tr>
                  <th>Receiver</th>
                  <th>Rank</th>
                  <th className="text-right">Score</th>
                  <th className="text-right">Servings</th>
                  <th>Offered</th>
                  <th>Expires</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {d.offers.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium text-ink">{o.receiver_org_name}</td>
                    <td>{o.rank}</td>
                    <td className="text-right tabular-nums">{o.match_score}</td>
                    <td className="text-right tabular-nums">{o.offered_servings}</td>
                    <td className="whitespace-nowrap">{formatDateTime(o.offered_at)}</td>
                    <td className="whitespace-nowrap">{formatDateTime(o.expires_at)}</td>
                    <td>
                      <StatusBadge kind="offer" status={o.status} />
                      {o.decline_reason && (
                        <p className="mt-1 text-xs text-slate">{o.decline_reason}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-ink">
          JEV match runs ({d.match_runs?.length ?? 0})
        </h2>
        {(d.match_runs ?? []).length === 0 ? (
          <p className="text-sm text-slate">No match runs yet.</p>
        ) : (
          [...d.match_runs]
            .sort((a, b) => a.run_at.localeCompare(b.run_at))
            .map((r, i) => <MatchRunCard key={r.id} run={r} index={i} />)
        )}
      </section>

      <ReasonModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject this donation?"
        confirmLabel="Reject donation"
        loading={reject.isPending}
        error={reject.error}
        onConfirm={(reason) =>
          reject.mutate({ id: d.id, reason }, { onSuccess: () => setRejectOpen(false) })
        }
      />
      <ReasonModal
        open={!!overriding}
        onClose={() => setOverriding(null)}
        title="Override collection"
        description="Use only after calling both parties. Marks the allocation as COLLECTED."
        confirmLabel="Mark collected"
        variant="purple"
        loading={override.isPending}
        error={override.error}
        onConfirm={(reason) =>
          overriding &&
          override.mutate(
            { id: overriding.id, reason },
            {
              onSuccess: () => {
                setOverriding(null);
                toast({ title: 'Marked as collected', tone: 'success' });
              },
            },
          )
        }
      />
    </div>
  );
}
