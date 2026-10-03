import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Countdown } from '@/components/ui/Countdown';
import { countdownLabel, countdownTone, respondLabel } from '@/lib/format';

const MIN = 60_000;

describe('countdown labels and thresholds (WALKTHROUGH §5.1)', () => {
  it('formats "1 h 56 m left"', () => {
    expect(countdownLabel(116 * MIN)).toBe('1 h 56 m left');
    expect(countdownLabel(44 * MIN + 30_000)).toBe('44 m left');
    expect(countdownLabel(0)).toBe('Deadline passed');
    expect(countdownLabel(-5 * MIN)).toBe('Deadline passed');
  });

  it('turns gold under 45 min and red under 15 min', () => {
    expect(countdownTone(46 * MIN)).toBe('normal');
    expect(countdownTone(45 * MIN)).toBe('normal');
    expect(countdownTone(44 * MIN)).toBe('warning');
    expect(countdownTone(15 * MIN)).toBe('warning');
    expect(countdownTone(14 * MIN)).toBe('danger');
    expect(countdownTone(0)).toBe('passed');
  });

  it('formats the offer response countdown', () => {
    expect(respondLabel(6 * MIN + 10_000)).toBe('Respond in 7 min');
  });

  it('renders the component with the right tone', () => {
    const now = Date.UTC(2026, 9, 4, 15, 4);
    const { rerender } = render(<Countdown deadline={new Date(now + 116 * MIN)} now={now} />);
    expect(screen.getByRole('timer')).toHaveTextContent('1 h 56 m left');
    expect(screen.getByRole('timer')).toHaveAttribute('data-tone', 'normal');
    rerender(<Countdown deadline={new Date(now + 30 * MIN)} now={now} />);
    expect(screen.getByRole('timer')).toHaveAttribute('data-tone', 'warning');
    rerender(<Countdown deadline={new Date(now + 10 * MIN)} now={now} />);
    expect(screen.getByRole('timer')).toHaveAttribute('data-tone', 'danger');
    rerender(<Countdown deadline={new Date(now - MIN)} now={now} />);
    expect(screen.getByRole('timer')).toHaveTextContent('Deadline passed');
  });
});
