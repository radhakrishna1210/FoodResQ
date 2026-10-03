import type { AccountStatus, AllocationStatus, DonationStatus, OfferStatus } from '@/types';
import {
  ACCOUNT_STATUS_LABELS,
  ALLOCATION_STATUS_LABELS,
  DONATION_STATUS_LABELS,
  OFFER_STATUS_LABELS,
} from '@/lib/labels';
import { Badge, type BadgeTone } from './Badge';

// WALKTHROUGH §5.1 — same everywhere.
export const DONATION_STATUS_TONE: Record<DonationStatus, BadgeTone> = {
  POSTED: 'slate',
  MATCHED: 'teal',
  ACCEPTED: 'primary',
  COLLECTED: 'purple',
  COMPLETED: 'green',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  FLAGGED: 'gold',
};

export const OFFER_STATUS_TONE: Record<OfferStatus, BadgeTone> = {
  PENDING: 'teal',
  ACCEPTED: 'green',
  DECLINED: 'grey',
  TIMED_OUT: 'grey',
  SUPERSEDED: 'grey',
  WITHDRAWN: 'grey',
};

export const ALLOCATION_STATUS_TONE: Record<AllocationStatus, BadgeTone> = {
  ACCEPTED: 'primary',
  COLLECTED: 'purple',
  COMPLETED: 'green',
  NO_SHOW: 'red',
  CANCELLED: 'cancelled',
};

export const ACCOUNT_STATUS_TONE: Record<AccountStatus, BadgeTone> = {
  active: 'green',
  pending_verification: 'gold',
  rejected: 'red',
  suspended: 'expired',
};

type Props =
  | { kind?: 'donation'; status: DonationStatus }
  | { kind: 'offer'; status: OfferStatus }
  | { kind: 'allocation'; status: AllocationStatus }
  | { kind: 'account'; status: AccountStatus };

export function statusBadgeInfo(props: Props): { tone: BadgeTone; label: string } {
  switch (props.kind) {
    case 'offer':
      return { tone: OFFER_STATUS_TONE[props.status], label: OFFER_STATUS_LABELS[props.status] };
    case 'allocation':
      return {
        tone: ALLOCATION_STATUS_TONE[props.status],
        label: ALLOCATION_STATUS_LABELS[props.status],
      };
    case 'account':
      return {
        tone: ACCOUNT_STATUS_TONE[props.status],
        label: ACCOUNT_STATUS_LABELS[props.status],
      };
    default:
      return {
        tone: DONATION_STATUS_TONE[props.status],
        label: DONATION_STATUS_LABELS[props.status],
      };
  }
}

export function StatusBadge(props: Props) {
  const { tone, label } = statusBadgeInfo(props);
  return (
    <Badge tone={tone} dot>
      <span data-testid="status-badge" data-tone={tone}>
        {label}
      </span>
    </Badge>
  );
}
