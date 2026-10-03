import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';
export interface ToastInput {
  title: string;
  body?: string;
  tone?: ToastTone;
  link?: string | null;
  durationMs?: number;
}
interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

const TONE: Record<ToastTone, { cls: string; icon: ReactNode }> = {
  info: { cls: 'border-l-primary', icon: <Bell size={18} className="text-primary" /> },
  success: { cls: 'border-l-green', icon: <CheckCircle2 size={18} className="text-green" /> },
  warning: { cls: 'border-l-gold', icon: <AlertTriangle size={18} className="text-gold" /> },
  error: { cls: 'border-l-red', icon: <Info size={18} className="text-red" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.durationMs ?? 6000);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-[1100] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end"
        aria-live="polite"
        role="region"
        aria-label="Notifications"
      >
        {items.map((t) => {
          const tone = TONE[t.tone ?? 'info'];
          const content = (
            <>
              <div className="mt-0.5 shrink-0">{tone.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.body && <p className="mt-0.5 text-sm text-slate">{t.body}</p>}
              </div>
            </>
          );
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm animate-[toastIn_.2s_ease-out] items-start gap-3 rounded-lg border border-l-4 border-line bg-white p-3 shadow-lift',
                tone.cls,
              )}
              role="status"
            >
              {t.link ? (
                <Link
                  to={t.link}
                  className="flex flex-1 items-start gap-3"
                  onClick={() => dismiss(t.id)}
                >
                  {content}
                </Link>
              ) : (
                <div className="flex flex-1 items-start gap-3">{content}</div>
              )}
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-slate hover:bg-slate-50 hover:text-ink"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (t: ToastInput) => void {
  const ctx = useContext(ToastContext);
  // Allow components to render outside the provider in tests.
  return ctx ?? (() => undefined);
}
