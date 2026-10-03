import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

export const inputClass = (invalid?: boolean, extra?: string) =>
  cn(
    'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink placeholder:text-slate/60',
    'transition-colors focus:outline-none focus:ring-4',
    invalid
      ? 'border-red focus:border-red focus:ring-red/15'
      : 'border-line hover:border-slate/40 focus:border-primary focus:ring-primary/15',
    'disabled:bg-slate-50 disabled:text-slate',
    extra,
  );

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-red" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ invalid, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={inputClass(invalid, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ invalid, className, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={inputClass(invalid, cn('resize-y', className))}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ invalid, className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={inputClass(invalid, cn('pr-8', className))}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
});

/** Accessible switch. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  tone = 'primary',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  tone?: 'primary' | 'teal' | 'green' | 'red';
}) {
  const id = useId();
  const onCls = { primary: 'bg-primary', teal: 'bg-teal', green: 'bg-green', red: 'bg-red' }[tone];
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {description && <p className="text-xs text-slate">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:opacity-50',
          checked ? onCls : 'bg-slate-100 ring-1 ring-inset ring-line',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export const Checkbox = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; invalid?: boolean }
>(function Checkbox({ label, invalid, className, id, ...rest }, ref) {
  const autoId = useId();
  const cid = id ?? autoId;
  return (
    <label
      htmlFor={cid}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
        invalid ? 'border-red/50 bg-red-50/40' : 'border-line bg-white hover:border-primary/40',
        className,
      )}
    >
      <input
        ref={ref}
        id={cid}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-primary accent-[#1B70BE] focus:ring-primary/30"
        {...rest}
      />
      <span className="text-ink">{label}</span>
    </label>
  );
});

/** Multi-select chips. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  labels,
  ariaLabel,
}: {
  options: readonly T[];
  value: T[];
  onChange: (v: T[]) => void;
  labels: Record<T, string>;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const on = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== opt) : [...value, opt])}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
              on
                ? 'border-primary bg-primary-50 text-primary-700'
                : 'border-line bg-white text-slate-700 hover:border-slate/40',
            )}
          >
            {labels[opt]}
          </button>
        );
      })}
    </div>
  );
}

/** Segmented single choice. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  render,
  ariaLabel,
}: {
  options: readonly T[];
  value: T | undefined;
  onChange: (v: T) => void;
  render: (v: T) => ReactNode;
  ariaLabel: string;
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 4)}, minmax(0, 1fr))` }}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const on = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(opt)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
              on
                ? 'border-primary bg-primary-50 text-primary-700'
                : 'border-line bg-white text-slate-700 hover:border-slate/40',
            )}
          >
            {render(opt)}
          </button>
        );
      })}
    </div>
  );
}
