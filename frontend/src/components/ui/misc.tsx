import type { ReactNode } from 'react';
import { Star } from 'lucide-react';
import type { DietType } from '@/types';
import { DIET_DOT_CLASS, DIET_LABELS } from '@/lib/labels';
import { cn } from '@/lib/cn';

/** Diet dot — green veg, yellow egg, red non-veg. */
export function DietDot({ diet, withLabel }: { diet: DietType; withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
      <span
        className={cn(
          'inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border-2',
          diet === 'veg' ? 'border-green' : diet === 'egg' ? 'border-yellow-400' : 'border-red',
        )}
        aria-hidden="true"
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', DIET_DOT_CLASS[diet])} />
      </span>
      {withLabel ? DIET_LABELS[diet] : <span className="sr-only">{DIET_LABELS[diet]}</span>}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && <div className="mb-3">{back}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-card ring-1 ring-line">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  icon,
  tone = 'primary',
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: 'primary' | 'teal' | 'purple' | 'gold' | 'red' | 'green' | 'slate';
  hint?: ReactNode;
}) {
  const toneCls = {
    primary: 'bg-primary-50 text-primary',
    teal: 'bg-teal-50 text-teal-700',
    purple: 'bg-purple-50 text-purple',
    gold: 'bg-gold-50 text-gold',
    red: 'bg-red-50 text-red',
    green: 'bg-green-50 text-green',
    slate: 'bg-slate-50 text-slate',
  }[tone];
  return (
    <div className="card flex items-start gap-3 p-4">
      {icon && (
        <div
          className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', toneCls)}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate">{label}</p>
        <p className="mt-0.5 font-heading text-2xl font-semibold tabular-nums text-ink">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate">{hint}</p>}
      </div>
    </div>
  );
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-slate">{label}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

export function StarRating({
  value,
  onChange,
  size = 28,
  label = 'Overall rating',
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  label?: string;
}) {
  return (
    <div
      className="flex gap-1"
      role={onChange ? 'radiogroup' : 'img'}
      aria-label={onChange ? label : `${value} of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        const star = (
          <Star
            size={size}
            className={on ? 'fill-gold text-gold' : 'text-line'}
            aria-hidden="true"
          />
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}

export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between pt-2 text-sm" aria-label="Pagination">
      <span className="text-slate">
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-lg border border-line bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-50"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </button>
        <button
          type="button"
          className="rounded-lg border border-line bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-50"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
