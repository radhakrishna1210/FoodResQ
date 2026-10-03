// Phase 6 — "Ask FoodResQ" (ARCHITECTURE §11, WALKTHROUGH §5.10). Read-only helper; never acts for the user.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Brain, FileEdit, MessageCircleQuestion, Send, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { DonationDraft } from '@/types';

export const ASSISTANT_PROMPTS = {
  donor: ['Where is my donation?', 'Why this Receiver?', 'Help me post food'],
  receiver: ['Explain this offer', 'What should I do at pickup?'],
} as const;

export const ASSISTANT_UNAVAILABLE = 'Assistant is unavailable right now';

interface ChatLine {
  id: number;
  from: 'user' | 'assistant' | 'error';
  text: string;
  draft?: DonationDraft | null;
}

export function AssistantLauncher({ role }: { role: 'donor' | 'receiver' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-[800] inline-flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-medium text-white shadow-lift transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 md:bottom-6 md:right-6"
        >
          <MessageCircleQuestion size={18} aria-hidden />
          Ask FoodResQ
        </button>
      )}
      {open && <AssistantPanel role={role} onClose={() => setOpen(false)} />}
    </>
  );
}

export function AssistantPanel({
  role,
  onClose,
}: {
  role: 'donor' | 'receiver';
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const idRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chat = useMutation({
    mutationFn: (message: string) =>
      api.assistantChat({ conversation_id: conversationId, message }),
    onSuccess: (res) => {
      setConversationId(res.conversation_id);
      setLines((l) => [
        ...l,
        { id: idRef.current++, from: 'assistant', text: res.reply, draft: res.draft },
      ]);
    },
    onError: () => {
      setLines((l) => [...l, { id: idRef.current++, from: 'error', text: ASSISTANT_UNAVAILABLE }]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines, chat.isPending]);

  const send = (text: string) => {
    const msg = text.trim().slice(0, 1000);
    if (!msg || chat.isPending) return;
    setLines((l) => [...l, { id: idRef.current++, from: 'user', text: msg }]);
    setInput('');
    chat.mutate(msg);
  };

  const openDraft = (draft: DonationDraft) => {
    // Checklist and declaration always stay unticked; nothing is saved until the Donor submits.
    navigate('/donor/donations/new', { state: { draft } });
    onClose();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[900] flex h-[80vh] flex-col rounded-t-2xl border border-line bg-white shadow-lift sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[560px] sm:w-[380px] sm:rounded-card"
      role="dialog"
      aria-label="Ask FoodResQ"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <Brain size={18} aria-hidden />
          </span>
          <div>
            <p className="font-heading text-sm font-semibold text-ink">Ask FoodResQ</p>
            <p className="text-xs text-slate">Explains and drafts. Never acts for you.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1.5 text-slate hover:bg-slate-50"
          aria-label="Close assistant"
        >
          <X size={18} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {lines.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {ASSISTANT_PROMPTS[role].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-sm text-ink hover:border-primary/40 hover:bg-primary-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {lines.map((line) => (
          <div
            key={line.id}
            className={cn('flex', line.from === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
                line.from === 'user' && 'rounded-br-sm bg-primary text-white',
                line.from === 'assistant' && 'rounded-bl-sm bg-bg text-ink ring-1 ring-line',
                line.from === 'error' && 'rounded-bl-sm bg-red-50 text-red-700 ring-1 ring-red/20',
              )}
            >
              {line.text}
              {line.draft && role === 'donor' && (
                <button
                  type="button"
                  onClick={() => openDraft(line.draft as DonationDraft)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-primary ring-1 ring-primary/30 hover:bg-primary-50"
                >
                  <FileEdit size={14} aria-hidden /> Review draft in the form
                </button>
              )}
            </div>
          </div>
        ))}
        {chat.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-bg px-3 py-2 text-sm text-slate ring-1 ring-line">
              Thinking…
            </div>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line p-3">
        <label htmlFor="assistant-input" className="sr-only">
          Message
        </label>
        <input
          id="assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
          placeholder="Ask a question…"
          className="h-10 flex-1 rounded-lg border border-line px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
        />
        <button
          type="submit"
          disabled={!input.trim() || chat.isPending}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-700 disabled:opacity-50"
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
