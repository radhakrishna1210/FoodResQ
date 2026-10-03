import { Flame } from 'lucide-react';
import type { PriorityLevel } from '@/types';
import { PRIORITY_LABELS } from '@/lib/labels';
import { Badge, type BadgeTone } from './Badge';

// WALKTHROUGH §5.1: HIGH red, MEDIUM gold, LOW slate.
export const PRIORITY_TONE: Record<PriorityLevel, BadgeTone> = {
  HIGH: 'red',
  MEDIUM: 'gold',
  LOW: 'slate',
};

export function PriorityBadge({ level, short }: { level: PriorityLevel; short?: boolean }) {
  return (
    <Badge
      tone={PRIORITY_TONE[level]}
      icon={level === 'HIGH' ? <Flame size={12} aria-hidden /> : undefined}
    >
      {short ? level : PRIORITY_LABELS[level]}
    </Badge>
  );
}
