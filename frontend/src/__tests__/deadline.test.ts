import { describe, expect, it } from 'vitest';
import { computeDeadlines, isTooCloseToSafeLimit } from '@/lib/deadline';
import { formatTime, fromISTInputValue } from '@/lib/format';

const ist = (local: string) => new Date(fromISTInputValue(local) as string);

describe('lib/deadline — ARCHITECTURE §6.2', () => {
  it('reproduces the golden demo (WALKTHROUGH §3.3)', () => {
    const r = computeDeadlines({
      storage_condition: 'hot_held',
      ambient_above_32c: true,
      prepared_at: ist('2026-10-04T19:00'),
      donor_pickup_by: ist('2026-10-04T22:30'),
    });
    expect(r).not.toBeNull();
    expect(formatTime(r!.safe_pickup_deadline)).toBe('1:00 AM');
    expect(formatTime(r!.effective_deadline)).toBe('10:30 PM'); // donor's earlier "Pickup by"
    expect(formatTime(r!.last_consumption_at)).toBe('5:00 AM'); // safe pickup 1:00 AM + 4 h

  });

  it('room_temp above 32 °C uses a 6 h pickup window', () => {
    const r = computeDeadlines({
      storage_condition: 'room_temp',
      ambient_above_32c: true,
      prepared_at: ist('2026-10-04T19:00'),
      donor_pickup_by: ist('2026-10-04T23:00'),
    })!;
    expect(r.window_hours).toBe(6);
    expect(formatTime(r.effective_deadline)).toBe('11:00 PM'); // donor's earlier time
    expect(formatTime(r.safe_pickup_deadline)).toBe('1:00 AM');
    expect(formatTime(r.last_consumption_at)).toBe('5:00 AM');
  });

  it('room_temp at or below 32 °C uses 6 h; refrigerated uses 12 h', () => {
    const prepared = ist('2026-10-04T19:00');
    const rt = computeDeadlines({
      storage_condition: 'room_temp',
      ambient_above_32c: false,
      prepared_at: prepared,
      donor_pickup_by: ist('2026-10-05T19:00'),
    })!;
    expect(rt.window_hours).toBe(6);
    const fr = computeDeadlines({
      storage_condition: 'refrigerated',
      ambient_above_32c: false,
      prepared_at: prepared,
      donor_pickup_by: ist('2026-10-06T19:00'),
    })!;
    expect(formatTime(fr.safe_pickup_deadline)).toBe('7:00 AM');
    expect(formatTime(fr.last_consumption_at)).toBe('11:00 AM');
  });

  it('packaged_sealed uses expiry 23:59 IST minus 18 h', () => {
    const r = computeDeadlines({
      storage_condition: 'packaged_sealed',
      ambient_above_32c: false,
      prepared_at: new Date(NaN),
      donor_pickup_by: ist('2026-10-06T20:00'),
      packaged_expiry_date: '2026-10-05',
    })!;
    expect(r.safe_pickup_deadline.toISOString()).toBe(ist('2026-10-05T05:59').toISOString());
    expect(r.effective_deadline.toISOString()).toBe(ist('2026-10-05T05:59').toISOString());
  });

  it('flags food too close to its safe limit (room_temp, prepared 5 h 40 min ago)', () => {
    const now = ist('2026-10-05T01:00');
    const r = computeDeadlines({
      storage_condition: 'room_temp',
      ambient_above_32c: true,
      prepared_at: ist('2026-10-04T19:20'),
      donor_pickup_by: ist('2026-10-05T03:00'),
    })!;
    expect(isTooCloseToSafeLimit(r.effective_deadline, now)).toBe(true);
  });
});
