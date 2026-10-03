import { WifiOff } from 'lucide-react';
import { useHealth } from '@/hooks/queries';
import { useRealtimeStatus } from '@/lib/realtime';
import { cn } from '@/lib/cn';

/** "Reconnecting…" pill when the realtime channel drops (WALKTHROUGH §6.14). */
export function ReconnectingPill() {
  const status = useRealtimeStatus();
  if (status !== 'disconnected') return null;
  return (
    <div
      className="fixed bottom-20 left-1/2 z-[900] -translate-x-1/2 md:bottom-6"
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-2 rounded-full bg-ink/90 px-3 py-1.5 text-xs font-medium text-white shadow-lift">
        <WifiOff size={14} aria-hidden />
        Reconnecting…
      </span>
    </div>
  );
}

/** Phase 0 acceptance: frontend calls /health and shows "API connected". */
export function ApiStatus({ className }: { className?: string }) {
  const { data, isLoading, isError } = useHealth();
  const ok = data?.status === 'ok';
  const label = isLoading
    ? 'Checking API…'
    : ok
      ? 'API connected'
      : isError
        ? 'API offline'
        : 'API status unknown';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        ok
          ? 'bg-green-50 text-green-700 ring-green/25'
          : isLoading
            ? 'bg-slate-50 text-slate ring-line'
            : 'bg-red-50 text-red-700 ring-red/25',
        className,
      )}
      role="status"
      data-testid="api-status"
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          ok ? 'bg-green' : isLoading ? 'animate-pulse bg-slate' : 'bg-red',
        )}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
