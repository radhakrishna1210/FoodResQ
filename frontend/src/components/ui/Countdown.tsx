import { Clock } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { countdownLabel, countdownTone, formatTime, type CountdownTone } from '@/lib/format';
import { cn } from '@/lib/cn';

const TONE_CLASS: Record<CountdownTone, string> = {
  normal: 'text-ink bg-slate-50 ring-line',
  warning: 'text-gold-700 bg-gold-50 ring-gold/30',
  danger: 'text-red-700 bg-red-50 ring-red/30',
  passed: 'text-white bg-expired ring-expired',
};

/** "1 h 56 m left" — gold < 45 min, red < 15 min, "Deadline passed" (WALKTHROUGH §5.1). */
export function Countdown({
  deadline,
  prefix,
  showTime,
  size = 'sm',
  className,
  now: nowOverride,
}: {
  deadline: string | Date;
  prefix?: string;
  showTime?: boolean;
  size?: 'sm' | 'lg';
  className?: string;
  now?: number;
}) {
  const ticking = useNow(10_000);
  const now = nowOverride ?? ticking;
  const target = deadline instanceof Date ? deadline.getTime() : new Date(deadline).getTime();
  const ms = target - now;
  const tone = countdownTone(ms);
  const label = countdownLabel(ms);
  const aria = prefix ? `${prefix} ${label}` : label;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium tabular-nums ring-1 ring-inset',
        size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs',
        TONE_CLASS[tone],
        className,
      )}
      data-tone={tone}
      role="timer"
      aria-label={aria}
    >
      <Clock size={size === 'lg' ? 15 : 12} aria-hidden="true" />
      {prefix && <span className="font-normal opacity-80">{prefix}</span>}
      <span>{label}</span>
      {showTime && tone !== 'passed' && (
        <span className="font-normal opacity-70">· {formatTime(deadline)}</span>
      )}
    </span>
  );
}
