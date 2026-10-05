import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { prefersReducedMotion } from '@/hooks/useInView';
import { cn } from '@/lib/cn';
import type { Slide } from '@/lib/media';

const INTERVAL_MS = 6000;

const ARROW =
  'flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-inset ring-white/30 backdrop-blur transition hover:bg-white/30 focus:outline-none focus-visible:ring-2';

/**
 * Cross-fading photo slider with a slow Ken Burns zoom. Pauses on hover/focus, honours
 * prefers-reduced-motion, and renders `children` above the photos (scrim included).
 */
export function ImageSlider({
  slides,
  className,
  children,
  showCaption = true,
  showControls = true,
  overlay = 'from-ink/80 via-ink/45 to-ink/10',
  barClassName,
}: {
  slides: Slide[];
  className?: string;
  children?: ReactNode;
  showCaption?: boolean;
  showControls?: boolean;
  /** Tailwind gradient stops for the readability scrim. */
  overlay?: string;
  /** Extra classes for the caption/controls bar (e.g. bottom padding to clear overlapping content). */
  barClassName?: string;
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = prefersReducedMotion();
  const count = slides.length;
  const go = useCallback((n: number) => setI(((n % count) + count) % count), [count]);

  useEffect(() => {
    if (paused || reduced || count < 2) return;
    const t = setTimeout(() => setI((v) => (v + 1) % count), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [i, paused, reduced, count]);

  const cur = slides[i]!;
  return (
    <div
      className={cn('group relative overflow-hidden bg-ink', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Food rescue photos"
    >
      {slides.map((s, idx) => (
        <img
          key={s.src}
          src={s.src}
          alt={idx === i ? s.alt : ''}
          aria-hidden={idx !== i}
          loading={idx === 0 ? 'eager' : 'lazy'}
          decoding="async"
          style={{ objectPosition: s.position }}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ease-in-out',
            idx === i ? 'opacity-100' : 'opacity-0',
            idx === i && !reduced && 'animate-ken-burns',
          )}
        />
      ))}
      <div className={cn('absolute inset-0 bg-gradient-to-r', overlay)} aria-hidden="true" />
      <div
        className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent"
        aria-hidden="true"
      />

      {children}

      {(showCaption || showControls) && count > 1 && (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-6',
            barClassName,
          )}
        >
          {showCaption ? (
            <div key={i} className="max-w-md animate-fade-up text-white">
              <p className="font-heading text-sm font-semibold sm:text-base">{cur.title}</p>
              <p className="mt-0.5 hidden text-xs text-white/80 sm:block sm:text-sm">
                {cur.caption}
              </p>
            </div>
          ) : (
            <span />
          )}
          {showControls && (
            <div className="pointer-events-auto flex items-center gap-3">
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose photo">
                {slides.map((s, idx) => (
                  <button
                    key={s.src}
                    type="button"
                    role="tab"
                    aria-selected={idx === i}
                    aria-label={`Photo ${idx + 1}: ${s.title}`}
                    onClick={() => go(idx)}
                    className="relative h-1.5 w-7 overflow-hidden rounded-full bg-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {idx === i && (
                      <span
                        key={`${i}-${paused}`}
                        className={cn(
                          'absolute inset-0 origin-left rounded-full bg-white',
                          !reduced && !paused && 'animate-progress',
                        )}
                        style={
                          reduced || paused ? undefined : { animationDuration: `${INTERVAL_MS}ms` }
                        }
                      />
                    )}
                  </button>
                ))}
              </div>
              <div className="hidden gap-1 sm:flex">
                <button
                  type="button"
                  onClick={() => go(i - 1)}
                  aria-label="Previous photo"
                  className={ARROW}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => go(i + 1)}
                  aria-label="Next photo"
                  className={ARROW}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
