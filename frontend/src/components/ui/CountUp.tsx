import { useEffect, useState } from 'react';
import { prefersReducedMotion, useInView } from '@/hooks/useInView';
import { formatNumber } from '@/lib/format';

/** Counts from 0 to `value` with an ease-out curve once visible. */
export function CountUp({ value, duration = 1400 }: { value: number; duration?: number }) {
  const { ref, seen } = useInView<HTMLSpanElement>(0.3);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!seen) return;
    if (prefersReducedMotion()) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, value, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {formatNumber(n)}
    </span>
  );
}
