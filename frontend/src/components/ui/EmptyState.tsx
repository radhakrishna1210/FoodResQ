import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-white px-6 py-10 text-center',
        className,
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary">
        {icon ?? <Inbox size={22} aria-hidden />}
      </div>
      <p className="font-heading text-base font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-md text-sm text-slate">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
