import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'teal' | 'purple';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-700 focus-visible:ring-primary/40 shadow-sm',
  secondary:
    'bg-white text-ink border border-line hover:bg-slate-50 hover:border-slate-100 focus-visible:ring-primary/30',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-50 focus-visible:ring-primary/30',
  danger: 'bg-red text-white hover:bg-red-700 focus-visible:ring-red/40 shadow-sm',
  success: 'bg-green text-white hover:bg-green-700 focus-visible:ring-green/40 shadow-sm',
  teal: 'bg-teal text-white hover:bg-teal-700 focus-visible:ring-teal/40 shadow-sm',
  purple: 'bg-purple text-white hover:bg-purple-700 focus-visible:ring-purple/40 shadow-sm',
};
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', extra?: string) =>
  cn(
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150',
    'focus:outline-none focus-visible:ring-4 disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap',
    VARIANTS[variant],
    SIZES[size],
    extra,
  );

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    icon,
    block,
    className,
    children,
    disabled,
    type,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={buttonClass(variant, size, cn(block && 'w-full', className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={16} className="text-current" /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
