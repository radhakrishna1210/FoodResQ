import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ALLOCATION_STATUS_TONE,
  DONATION_STATUS_TONE,
  OFFER_STATUS_TONE,
  StatusBadge,
  statusBadgeInfo,
} from '@/components/ui/StatusBadge';
import { PRIORITY_TONE } from '@/components/ui/PriorityBadge';

describe('status badge mapping (WALKTHROUGH §5.1)', () => {
  it('maps every donation status to the documented colour', () => {
    expect(DONATION_STATUS_TONE).toEqual({
      POSTED: 'slate',
      MATCHED: 'teal',
      ACCEPTED: 'primary',
      COLLECTED: 'purple',
      COMPLETED: 'green',
      EXPIRED: 'expired',
      CANCELLED: 'cancelled',
      FLAGGED: 'gold',
    });
  });

  it('uses the documented offer labels', () => {
    expect(statusBadgeInfo({ kind: 'offer', status: 'PENDING' })).toEqual({
      tone: 'teal',
      label: 'Awaiting response',
    });
    expect(statusBadgeInfo({ kind: 'offer', status: 'ACCEPTED' }).tone).toBe('green');
    expect(statusBadgeInfo({ kind: 'offer', status: 'DECLINED' })).toEqual({
      tone: 'grey',
      label: 'Rejected',
    });
    expect(statusBadgeInfo({ kind: 'offer', status: 'TIMED_OUT' }).label).toBe('No response');
    expect(statusBadgeInfo({ kind: 'offer', status: 'SUPERSEDED' }).label).toBe(
      'Taken by another Receiver',
    );
    expect(statusBadgeInfo({ kind: 'offer', status: 'WITHDRAWN' }).label).toBe('Withdrawn');
    for (const s of ['DECLINED', 'TIMED_OUT', 'SUPERSEDED', 'WITHDRAWN'] as const) {
      expect(OFFER_STATUS_TONE[s]).toBe('grey');
    }
  });

  it('covers every allocation status and priority', () => {
    expect(Object.keys(ALLOCATION_STATUS_TONE).sort()).toEqual([
      'ACCEPTED',
      'CANCELLED',
      'COLLECTED',
      'COMPLETED',
      'NO_SHOW',
    ]);
    expect(PRIORITY_TONE).toEqual({ HIGH: 'red', MEDIUM: 'gold', LOW: 'slate' });
  });

  it('renders the label with the tone attribute', () => {
    render(<StatusBadge status="MATCHED" />);
    const el = screen.getByTestId('status-badge');
    expect(el).toHaveTextContent('Matched');
    expect(el).toHaveAttribute('data-tone', 'teal');
  });
});
