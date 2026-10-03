import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, XCircle } from 'lucide-react';
import { useCancelDonation, useDonation } from '@/hooks/queries';
import { downloadRecordCsv, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { ReasonModal } from '@/components/ui/ReasonModal';
import { useToast } from '@/components/ui/Toast';
import { DonationHeader, DonationOverview } from '@/components/donation/DonationOverview';

const CANCELLABLE = new Set(['POSTED', 'MATCHED', 'ACCEPTED', 'FLAGGED']);

export default function DonationDetailPage() {
  const { id = '' } = useParams();
  const { data: d, isLoading, isError, error, refetch } = useDonation(id);
  const cancel = useCancelDonation(id);
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const back = (
    <Link
      to="/donor"
      className="mb-3 inline-flex items-center gap-1 text-sm text-slate hover:text-ink"
    >
      <ArrowLeft size={16} aria-hidden /> Dashboard
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

  const anyCollected = d.allocations.some(
    (a) => a.status === 'COLLECTED' || a.status === 'COMPLETED',
  );
  const canCancel = CANCELLABLE.has(d.status) && !anyCollected;
  const hasRecord = d.status === 'COMPLETED' || d.allocations.some((a) => a.status === 'COMPLETED');

  const download = async () => {
    setDownloading(true);
    try {
      await downloadRecordCsv(d.id);
    } catch (e) {
      toast({ title: 'Download failed', body: errorMessage(e), tone: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      {back}
      <DonationHeader
        d={d}
        actions={
          <>
            {hasRecord && (
              <Button
                variant="secondary"
                icon={<Download size={16} />}
                onClick={download}
                loading={downloading}
              >
                Download record (CSV)
              </Button>
            )}
            {CANCELLABLE.has(d.status) && (
              <Button
                variant="secondary"
                className="text-red-700"
                icon={<XCircle size={16} />}
                onClick={() => setCancelOpen(true)}
                disabled={!canCancel}
                title={canCancel ? undefined : 'Cannot cancel once food has been collected'}
              >
                Cancel donation
              </Button>
            )}
          </>
        }
      />
      <DonationOverview d={d} />
      <ReasonModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this donation?"
        description="Pending offers will be withdrawn and any Receiver who accepted will be notified."
        confirmLabel="Cancel donation"
        loading={cancel.isPending}
        error={cancel.error}
        onConfirm={(reason) =>
          cancel.mutate(reason, {
            onSuccess: () => {
              setCancelOpen(false);
              toast({ title: 'Donation cancelled', tone: 'success' });
            },
          })
        }
      />
    </div>
  );
}
