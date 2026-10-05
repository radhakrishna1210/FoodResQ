// Realtime (ARCHITECTURE §8.2) via Supabase Realtime Broadcast, pushed by our own backend
// (services/realtime.py) whenever something notification-worthy happens.
//
// We don't use Supabase Auth (README D6), so the browser's Supabase client has no session and
// connects as the `anon` role — the RLS-gated `postgres_changes` feature would silently deliver
// nothing to a connection like that (worse: it can report "connected" while receiving zero events,
// which would wrongly turn off the polling fallback). Broadcast sidesteps RLS/auth entirely: we
// subscribe to our own per-user channel, and on any ping — the payload is never trusted — just
// invalidate every query key and let the normal authenticated REST calls refetch the real data.
import { useEffect, useSyncExternalStore } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'polling';

// ---- tiny external store for the connection status ----
let currentStatus: RealtimeStatus = 'idle';
const listeners = new Set<() => void>();
function setStatus(s: RealtimeStatus) {
  if (s === currentStatus) return;
  currentStatus = s;
  listeners.forEach((l) => l());
}
export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentStatus,
    () => currentStatus,
  );
}

export const POLL_INTERVAL_MS = 15_000;

const QUERY_PREFIXES = [
  ['notifications'],
  ['messages'],
  ['donations'],
  ['donation'],
  ['offers'],
  ['offer'],
  ['allocations'],
  ['allocation'],
  ['impact'],
  ['admin'],
  ['me'],
];

function invalidateAll(qc: QueryClient): void {
  for (const key of QUERY_PREFIXES) void qc.invalidateQueries({ queryKey: key });
}

/** Subscribe while a user is signed in. Mount once (in the app shell). */
export function useRealtimeSync(userId: string | null): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) {
      setStatus('idle');
      return;
    }

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => invalidateAll(qc), POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    if (!supabase) {
      setStatus('polling');
      startPolling();
      return () => {
        stopPolling();
        setStatus('idle');
      };
    }

    setStatus('connecting');
    const client = supabase;
    const channel = client
      .channel(`user:${userId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'change' }, () => invalidateAll(qc));

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        setStatus('connected');
        stopPolling();
        invalidateAll(qc);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setStatus('disconnected');
        startPolling();
      }
    });

    return () => {
      stopPolling();
      void client.removeChannel(channel);
      setStatus('idle');
    };
  }, [qc, userId]);
}
