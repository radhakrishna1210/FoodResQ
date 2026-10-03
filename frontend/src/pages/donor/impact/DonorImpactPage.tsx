import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileSpreadsheet, Trophy } from 'lucide-react';
import { useDonations } from '@/hooks/queries';
import { downloadRecordCsv, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Spinner';
import { PageHeader, Pagination, Section } from '@/components/ui/misc';
import { useToast } from '@/components/ui/Toast';
import { ImpactStrip } from '@/pages/donor/dashboard/DonorDashboard';

export default function DonorImpactPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useDonations({ status: 'COMPLETED', page });
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (id: string) => {
    setBusy(id);
    try {
      await downloadRecordCsv(id);
    } catch (e) {
      toast({ title: 'Download failed', body: errorMessage(e), tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<Trophy size={20} />}
        title="Your impact"
        subtitle="Measured from confirmed handovers, not estimates."
      />
      <ImpactStrip />
      <Section title="FSSAI surplus food records">
        <p className="-mt-1 text-sm text-slate">
          Schedule-II style records, one CSV per completed donation.
        </p>
        {isLoading ? (
          <CardSkeleton rows={4} />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet size={22} />}
            title="No records yet"
            body="Records appear after a Receiver confirms distribution."
          />
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Food</th>
                  <th>Date</th>
                  <th className="text-right">Servings</th>
                  <th className="text-right">Record</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link to={`/donor/donations/${d.id}`} className="link">
                        {d.title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-slate">{formatDate(d.posted_at)}</td>
                    <td className="text-right tabular-nums">
                      {d.allocated_servings ?? d.quantity_servings}
                    </td>
                    <td className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Download size={14} />}
                        loading={busy === d.id}
                        onClick={() => download(d.id)}
                      >
                        CSV
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <Pagination
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            onPage={setPage}
          />
        )}
      </Section>
    </div>
  );
}
