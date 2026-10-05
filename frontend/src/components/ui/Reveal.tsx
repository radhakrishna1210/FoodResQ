import type { CSSProperties, ElementType, ReactNode } from 'react';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/cn';

/** Fades and lifts its children into place the first time they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  as,
  className,
}: {
  children: ReactNode;
  /** Stagger in milliseconds. */
  delay?: number;
  as?: ElementType;
  className?: string;
}) {
  const { ref, seen } = useInView<HTMLElement>();
  const Tag = (as ?? 'div') as ElementType;
  const style: CSSProperties = { animationDelay: `${delay}ms` };
  return (
    <Tag
      ref={ref}
      style={seen ? style : undefined}
      className={cn(seen ? 'animate-fade-up' : 'opacity-0', className)}
    >
      {children}
    </Tag>
  );
}
