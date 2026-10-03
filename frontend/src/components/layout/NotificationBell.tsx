import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/queries';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';

/** Bell with unread count; toasts newly arrived notifications (realtime or polling). */
export function NotificationBell({ className }: { className?: string }) {
  const { data } = useNotifications({ unread: true });
  const toast = useToast();
  const seen = useRef<Set<string> | null>(null);
  const unread = data?.unread_count ?? 0;

  useEffect(() => {
    if (!data) return;
    if (seen.current === null) {
      seen.current = new Set(data.items.map((n) => n.id));
      return;
    }
    for (const n of data.items) {
      if (!seen.current.has(n.id)) {
        seen.current.add(n.id);
        toast({
          title: n.title,
          body: n.body,
          link: n.link,
          tone:
            n.type === 'NO_MATCH_ALERT' || n.type === 'NO_SHOW' || n.type === 'HANDOVER_LOCKED'
              ? 'warning'
              : 'info',
        });
      }
    }
  }, [data, toast]);

  return (
    <Link
      to="/notifications"
      className={cn(
        'relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-50 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        className,
      )}
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
    >
      <Bell size={20} />
      {unread > 0 && (
        <span className="absolute right-1 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red px-1 text-[10px] font-semibold leading-[18px] text-white ring-2 ring-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
