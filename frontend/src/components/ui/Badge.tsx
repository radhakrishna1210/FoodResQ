import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone =
  | 'slate'
  | 'teal'
  | 'primary'
  | 'purple'
  | 'green'
  | 'gold'
  | 'red'
  | 'expired'
  | 'cancelled'
  | 'grey';

export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  slate: 'bg-slate-50 text-slate-700 ring-slate/25',
  teal: 'bg-teal-50 text-teal-700 ring-teal/30',
  primary: 'bg-primary-50 text-primary-700 ring-primary/25',
  purple: 'bg-purple-50 text-purple-700 ring-purple/25',
  green: 'bg-green-50 text-green-700 ring-green/25',
  gold: 'bg-gold-50 text-gold-700 ring-gold/30',
  red: 'bg-red-50 text-red-700 ring-red/25',
  expired: 'bg-expired text-white ring-expired',
  cancelled: 'bg-slate-50 text-cancelled ring-cancelled/40',
  grey: 'bg-slate-50 text-slate ring-cancelled/40',
};

export function Badge({
  tone = 'slate',
  icon,
  children,
  className,
  dot,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        BADGE_TONE_CLASS[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {icon}
      {children}
    </span>
  );
}
