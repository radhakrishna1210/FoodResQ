import { AlertCircle, RefreshCw } from 'lucide-react';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from './Button';

/** Shows the API error `message`, never raw codes (WALKTHROUGH §5.1). */
export function ErrorState({
  error,
  title = "We couldn't load this",
  onRetry,
  className,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-card border border-red/20 bg-red-50/60 px-6 py-8 text-center',
        className,
      )}
      role="alert"
    >
      <AlertCircle className="mb-2 text-red" size={24} aria-hidden />
      <p className="font-heading font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-700">{errorMessage(error)}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          icon={<RefreshCw size={14} />}
          onClick={onRetry}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p
      className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
      role="alert"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
      {errorMessage(error)}
    </p>
  );
}
