import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useMarkRead, useNotifications } from '@/hooks/queries';
import { timeAgo } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardSkeleton } from '@/components/ui/Spinner';
import { PageHeader, Pagination } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import type { AppNotification } from '@/types';

const WARN = new Set([
  'NO_MATCH_ALERT',
  'NO_SHOW',
  'HANDOVER_LOCKED',
  'SAFETY_REPORT',
  'DONATION_EXPIRED',
  'DONATION_REJECTED',
  'ALLOCATION_CANCELLED',
  'DONATION_CANCELLED',
]);
const GOOD = new Set([
  'OFFER_ACCEPTED',
  'COLLECTED',
  'COMPLETED',
  'DONATION_APPROVED',
  'VERIFICATION_RESULT',
]);

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useNotifications({
    unread: unreadOnly || undefined,
    page,
  });
  const markRead = useMarkRead();
  const navigate = useNavigate();

  const open = (n: AppNotification) => {
    if (!n.read_at) markRead.mutate({ ids: [n.id] });
    if (n.link) navigate(n.link);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={<Bell size={20} />}
        title="Notifications"
        actions={
          <>
            <Button
              variant={unreadOnly ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setUnreadOnly((v) => !v);
                setPage(1);
              }}
              aria-pressed={unreadOnly}
            >
              Unread only
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<CheckCheck size={14} />}
              loading={markRead.isPending}
              onClick={() => markRead.mutate({ all: true })}
            >
              Mark all read
            </Button>
          </>
        }
      />
      {isLoading ? (
        <CardSkeleton rows={5} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<Bell size={22} />}
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          body="Offers, pickups and updates will appear here."
        />
      ) : (
        <>
          <ul className="card divide-y divide-line overflow-hidden">
            {data.items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-bg focus:outline-none focus-visible:bg-bg',
                    !n.read_at && 'bg-primary-50/40',
                  )}
                >
                  <span
                    className={cn(
                      'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                      n.read_at
                        ? 'bg-transparent'
                        : WARN.has(n.type)
                          ? 'bg-gold'
                          : GOOD.has(n.type)
                            ? 'bg-green'
                            : 'bg-primary',
                    )}
                    aria-label={n.read_at ? undefined : 'Unread'}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', n.read_at ? 'text-ink' : 'font-semibold text-ink')}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-sm text-slate">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate">{timeAgo(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Pagination
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
