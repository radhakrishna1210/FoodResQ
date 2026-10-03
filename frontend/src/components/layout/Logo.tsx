import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1B70BE" />
      <path d="M18 34c0-8 6-14 14-14s14 6 14 14H18z" fill="#fff" />
      <rect x="14" y="36" width="36" height="5" rx="2.5" fill="#27B5C9" />
      <path d="M29 15h6v6h-6z" fill="#fff" />
      <circle cx="32" cy="46" r="3" fill="#B8860B" />
    </svg>
  );
}

export function Logo({
  to = '/',
  className,
  light,
}: {
  to?: string;
  className?: string;
  light?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        className,
      )}
      aria-label="FoodResQ home"
    >
      <LogoMark />
      <span
        className={cn(
          'font-heading text-lg font-semibold tracking-tight',
          light ? 'text-white' : 'text-ink',
        )}
      >
        Food<span className={light ? 'text-teal-100' : 'text-primary'}>ResQ</span>
      </span>
    </Link>
  );
}
