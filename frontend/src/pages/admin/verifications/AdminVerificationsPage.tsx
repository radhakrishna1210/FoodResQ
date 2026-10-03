import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, ExternalLink, MapPin, XCircle } from 'lucide-react';
import { useAdminMutation, useAdminVerifications } from '@/hooks/queries';
import { api, errorMessage } from '@/lib/api';
import { RECEIVER_TYPE_LABELS } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/misc';
import { ReasonModal } from '@/components/ui/ReasonModal';
import { Modal } from '@/components/ui/Modal';
import { PickupMap } from '@/components/map/PickupMap';
import { useToast } from '@/components/ui/Toast';
import type { VerificationItem } from '@/types';

export default function AdminVerificationsPage() {
  const { data = [], isLoading, isError, error, refetch } = useAdminVerifications();
  const verify = useAdminMutation((id: string) => api.adminVerify(id));
  const reject = useAdminMutation((v: { id: string; reason: string }) =>
    api.adminReject(v.id, v.reason),
  );
  const toast = useToast();
  const [rejecting, setRejecting] = useState<VerificationItem | null>(null);
  const [mapFor, setMapFor] = useState<VerificationItem | null>(null);

  return (
    <div>
      <PageHeader
        icon={<ClipboardCheck size={20} className="text-purple" />}
        title="Receiver verifications"
        subtitle="Check FSSAI registration and documents before a Receiver can get offers."
      />
      {isLoading ? (
        <CardSkeleton rows={5} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={22} />}
          title="All caught up"
          body="No Receivers are waiting for verification."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base min-w-[860px]">
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Type</th>
                <th>FSSAI no.</th>
                <th>Darpan ID</th>
                <th>Document</th>
                <th>Location</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((v) => (
                <tr key={v.user.id}>
                  <td>
                    <p className="font-medium text-ink">{v.profile.org_name}</p>
                    <p className="text-xs text-slate">
                      {v.user.full_name} · {v.user.phone}
                    </p>
                    <p className="text-xs text-slate">
                      Signed up {formatDateTime(v.user.created_at)}
                    </p>
                  </td>
                  <td>{RECEIVER_TYPE_LABELS[v.profile.receiver_type]}</td>
                  <td className="tabular-nums">{v.profile.fssai_registration_no}</td>
                  <td>{v.profile.ngo_darpan_id ?? '—'}</td>
                  <td>
                    {v.doc_url ? (
                      <a
                        href={v.doc_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link inline-flex items-center gap-1"
                      >
                        View <ExternalLink size={12} aria-hidden />
                      </a>
                    ) : (
                      <span className="text-slate">Not uploaded</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link inline-flex items-center gap-1"
                      onClick={() => setMapFor(v)}
                    >
                      <MapPin size={12} aria-hidden /> Map
                    </button>
                    <p className="max-w-[180px] truncate text-xs text-slate">{v.profile.address}</p>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        icon={<CheckCircle2 size={14} />}
                        loading={verify.isPending && verify.variables === v.user.id}
                        onClick={() =>
                          verify.mutate(v.user.id, {
                            onSuccess: () =>
                              toast({
                                title: 'Receiver verified',
                                body: v.profile.org_name,
                                tone: 'success',
                              }),
                            onError: (e) =>
                              toast({
                                title: "Couldn't verify",
                                body: errorMessage(e),
                                tone: 'error',
                              }),
                          })
                        }
                      >
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-red-700"
                        icon={<XCircle size={14} />}
                        onClick={() => setRejecting(v)}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ReasonModal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.profile.org_name ?? ''}?`}
        description="The Receiver will see this reason and can edit their profile and resubmit."
        confirmLabel="Reject"
        loading={reject.isPending}
        error={reject.error}
        onConfirm={(reason) =>
          rejecting &&
          reject.mutate(
            { id: rejecting.user.id, reason },
            {
              onSuccess: () => {
                setRejecting(null);
                toast({ title: 'Receiver rejected' });
              },
            },
          )
        }
      />
      <Modal
        open={!!mapFor}
        onClose={() => setMapFor(null)}
        title={mapFor?.profile.org_name ?? ''}
        description={mapFor?.profile.address}
        size="lg"
      >
        {mapFor && (
          <PickupMap
            pins={[
              {
                id: 'r',
                lat: mapFor.profile.lat,
                lng: mapFor.profile.lng,
                color: 'teal',
                label: mapFor.profile.org_name,
              },
            ]}
            height={320}
          />
        )}
      </Modal>
    </div>
  );
}
