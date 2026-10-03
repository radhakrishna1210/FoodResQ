import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ScrollText, Search } from 'lucide-react';
import { useAdminAudit } from '@/hooks/queries';
import { itemsOf } from '@/lib/api';
import { formatIST } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Spinner';
import { PageHeader, Pagination } from '@/components/ui/misc';
import type { AuditRow } from '@/types';

function Json({ value }: { value: Record<string, unknown> | null }) {
  if (!value) return <span className="text-slate">—</span>;
  return (
    <pre className="max-h-40 max-w-[280px] overflow-auto whitespace-pre-wrap break-all rounded bg-bg p-2 text-[11px] text-ink">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function AdminAuditLogPage() {
  const [params, setParams] = useSearchParams();
  const entityId = params.get('entity_id') ?? '';
  const [input, setInput] = useState(entityId);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useAdminAudit({
    entity_id: entityId || undefined,
    page,
  });
  const rows: AuditRow[] = itemsOf(data);
  const paged = data && !Array.isArray(data) ? data : null;

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setParams(input.trim() ? { entity_id: input.trim() } : {});
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<ScrollText size={20} className="text-purple" />}
        title="Audit log"
        subtitle="Every status change and Admin action."
      />
      <form onSubmit={onSearch} className="flex max-w-xl gap-2">
        <Input
          aria-label="Filter by entity id"
          placeholder="Filter by entity id (donation, offer, allocation…)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" variant="secondary" icon={<Search size={16} />}>
          Filter
        </Button>
      </form>
      {isLoading ? (
        <CardSkeleton rows={6} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ScrollText size={22} />} title="No audit rows" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base min-w-[900px]">
            <thead>
              <tr>
                <th>Time (IST)</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap tabular-nums">
                    {formatIST(r.created_at, 'd MMM, HH:mm:ss')}
                  </td>
                  <td className="font-medium text-ink">{r.action}</td>
                  <td>
                    <p>{r.entity_type}</p>
                    <button
                      type="button"
                      className="link text-xs"
                      onClick={() => setParams({ entity_id: r.entity_id })}
                    >
                      {r.entity_id.slice(0, 8)}…
                    </button>
                  </td>
                  <td className="text-xs text-slate">
                    {r.actor_id ? `${r.actor_id.slice(0, 8)}…` : 'System'}
                  </td>
                  <td>
                    <Json value={r.before} />
                  </td>
                  <td>
                    <Json value={r.after} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {paged && (
        <Pagination
          page={paged.page}
          pageSize={paged.page_size}
          total={paged.total}
          onPage={setPage}
        />
      )}
    </div>
  );
}
