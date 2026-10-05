import { useMemo, type ReactNode } from 'react';
import { ImageSlider } from '@/components/media/ImageSlider';
import { SLIDES } from '@/lib/media';
import { cn } from '@/lib/cn';

const TINT = {
  primary: 'from-[#124F87]/90 via-primary/70 to-primary/20',
  teal: 'from-[#14707E]/90 via-teal/65 to-teal/15',
  purple: 'from-[#3F2F73]/90 via-purple/70 to-purple/20',
} as const;

/**
 * Photo banner that opens each role's dashboard: a slow slideshow of food-rescue photos behind the
 * greeting. `offset` rotates the photo order so each role starts on a different image.
 */
export function DashboardBanner({
  icon,
  eyebrow,
  title,
  subtitle,
  actions,
  tone = 'primary',
  offset = 0,
  className,
}: {
  icon?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tone?: keyof typeof TINT;
  offset?: number;
  className?: string;
}) {
  const slides = useMemo(
    () => [...SLIDES.slice(offset % SLIDES.length), ...SLIDES.slice(0, offset % SLIDES.length)],
    [offset],
  );
  return (
    <div className={cn('animate-fade-in overflow-hidden rounded-2xl shadow-lift', className)}>
      <ImageSlider
        slides={slides}
        showCaption={false}
        overlay={TINT[tone]}
        className="min-h-[190px] sm:min-h-[210px]"
      >
        <div className="relative flex min-h-[190px] flex-col justify-between gap-5 p-5 sm:min-h-[210px] sm:flex-row sm:items-end sm:p-7">
          <div className="flex min-w-0 items-start gap-4 animate-fade-up">
            {icon && (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white ring-1 ring-inset ring-white/35 backdrop-blur">
                {icon}
              </div>
            )}
            <div className="min-w-0 text-white">
              {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                  {eyebrow}
                </p>
              )}
              <h1 className="mt-0.5 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                {title}
              </h1>
              {subtitle && <p className="mt-1.5 max-w-xl text-sm text-white/85">{subtitle}</p>}
            </div>
          </div>
          {actions && (
            <div
              className="flex flex-wrap gap-2 animate-fade-up"
              style={{ animationDelay: '120ms' }}
            >
              {actions}
            </div>
          )}
        </div>
      </ImageSlider>
    </div>
  );
}
