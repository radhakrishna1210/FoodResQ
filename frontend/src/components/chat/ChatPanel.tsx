import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { useMessages, useSendMessage } from '@/hooks/queries';
import { useAuth } from '@/lib/auth';
import { formatTime, formatIST } from '@/lib/format';
import { errorMessage } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import type { Allocation } from '@/types';

/** POST allowed only while allocation ACCEPTED/COLLECTED, or COMPLETED < 24 h (ARCHITECTURE §10.4). */
export function chatOpen(
  a: Pick<Allocation, 'status' | 'completed_at'>,
  now = Date.now(),
): boolean {
  if (a.status === 'ACCEPTED' || a.status === 'COLLECTED') return true;
  if (a.status === 'COMPLETED' && a.completed_at) {
    return now - new Date(a.completed_at).getTime() < 24 * 3600_000;
  }
  return false;
}

/** Plain per-allocation Donor ↔ Receiver chat (README D4; no AI). */
export function ChatPanel({
  allocation,
  otherPartyName,
  className,
}: {
  allocation: Pick<Allocation, 'id' | 'status' | 'completed_at'>;
  otherPartyName: string;
  className?: string;
}) {
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useMessages(allocation.id);
  const messages = data?.items ?? [];
  const send = useSendMessage(allocation.id);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  // Server decides (`open` on GET messages); fall back to the same rule while loading.
  const open = data?.open ?? chatOpen(allocation);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    send.mutate(body, { onSuccess: () => setText('') });
  };

  return (
    <div className={cn('card flex flex-col overflow-hidden', className)}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <MessageSquare size={18} className="text-primary" aria-hidden />
        <h2 className="font-heading text-sm font-semibold text-ink">Chat with {otherPartyName}</h2>
      </div>
      <div
        ref={listRef}
        className="h-72 space-y-2 overflow-y-auto bg-bg/50 px-4 py-3"
        aria-live="polite"
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="text-sm text-red-700">{errorMessage(error)}</p>
        ) : messages.length === 0 ? (
          <p className="pt-8 text-center text-sm text-slate">
            No messages yet. Say hello and share pickup details.
          </p>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === user?.id;
            const prev = messages[i - 1];
            const showDay =
              !prev ||
              formatIST(prev.created_at, 'yyyy-MM-dd') !== formatIST(m.created_at, 'yyyy-MM-dd');
            return (
              <div key={m.id}>
                {showDay && (
                  <p className="py-1 text-center text-[11px] text-slate">
                    {formatIST(m.created_at, 'd MMM')}
                  </p>
                )}
                <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
                      mine
                        ? 'rounded-br-sm bg-primary text-white'
                        : 'rounded-bl-sm bg-white text-ink ring-1 ring-line',
                    )}
                  >
                    {m.body}
                    <span
                      className={cn(
                        'mt-0.5 block text-right text-[10px]',
                        mine ? 'text-white/70' : 'text-slate',
                      )}
                    >
                      {formatTime(m.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {open ? (
        <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line p-3">
          <label htmlFor={`chat-${allocation.id}`} className="sr-only">
            Message
          </label>
          <input
            id={`chat-${allocation.id}`}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            className="h-10 flex-1 rounded-lg border border-line px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
          <button
            type="submit"
            disabled={!text.trim() || send.isPending}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-700 disabled:opacity-50"
            aria-label="Send message"
          >
            {send.isPending ? <Spinner size={16} className="text-white" /> : <Send size={16} />}
          </button>
        </form>
      ) : (
        <p className="border-t border-line px-4 py-3 text-center text-xs text-slate">
          Chat is closed for this pickup.
        </p>
      )}
      {send.isError && <p className="px-4 pb-3 text-xs text-red-700">{errorMessage(send.error)}</p>}
    </div>
  );
}
