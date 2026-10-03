// Realtime (ARCHITECTURE §8.2). Supabase postgres_changes when a client exists; otherwise 15 s polling.
// Realtime payloads are never trusted: every event only invalidates React Query caches.
import { useEffect, useSyncExternalStore } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { UserRole } from '@/types';

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

/** Query key prefixes refreshed per table. */
const TABLE_KEYS: Record<string, string[][]> = {
  notifications: [['notifications']],
  messages: [['messages']],
  donations: [['donations'], ['donation'], ['impact']],
  offers: [['offers'], ['offer']],
  allocations: [['allocations'], ['allocation'], ['donation'], ['impact']],
};

export function invalidateForTable(qc: QueryClient, table: string): void {
  for (const key of TABLE_KEYS[table] ?? []) void qc.invalidateQueries({ queryKey: key });
  void qc.invalidateQueries({ queryKey: ['admin'] });
}

function invalidateAll(qc: QueryClient): void {
  Object.keys(TABLE_KEYS).forEach((t) => invalidateForTable(qc, t));
}

/**
 * Subscribe while a user is signed in. Mount once (in the app shell).
 * TODO(team): Supabase Realtime uses the Supabase session; in dev-auth mode there is no Supabase session,
 * so we poll.
 */
export function useRealtimeSync(userId: string | null, role: UserRole | null): void {
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
    const tables =
      role === 'receiver'
        ? ['notifications', 'messages', 'offers', 'allocations']
        : role === 'donor'
          ? ['notifications', 'messages', 'donations', 'allocations']
          : ['notifications'];

    let channel = client.channel(`foodresq-${userId}`);
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table } as never,
        () => invalidateForTable(qc, table),
      );
    }
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
  }, [qc, userId, role]);
}
