import type { OperatingHours, Weekday } from '@/types';
import { WEEKDAYS, WEEKDAY_LABELS } from '@/lib/labels';
import { cn } from '@/lib/cn';

const timeInput =
  'h-9 w-full rounded-lg border border-line bg-white px-2 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:bg-slate-50 disabled:text-slate';

/** Editor for receiver_profiles.operating_hours (ARCHITECTURE §4.3). Times are IST; close may be 24:00. */
export function OperatingHoursEditor({
  value,
  onChange,
}: {
  value: OperatingHours;
  onChange: (v: OperatingHours) => void;
}) {
  const setDay = (day: Weekday, w: OperatingHours[Weekday]) => onChange({ ...value, [day]: w });
  const allDay = () =>
    onChange(
      Object.fromEntries(
        WEEKDAYS.map((d) => [d, { open: '00:00', close: '24:00' }]),
      ) as OperatingHours,
    );
  const copyMonday = () =>
    onChange(
      Object.fromEntries(
        WEEKDAYS.map((d) => [d, value.mon ? { ...value.mon } : null]),
      ) as OperatingHours,
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={allDay}
          className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-ink hover:bg-slate-50"
        >
          Open 24 hours, every day
        </button>
        <button
          type="button"
          onClick={copyMonday}
          className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-ink hover:bg-slate-50"
        >
          Copy Monday to all days
        </button>
      </div>
      <div className="divide-y divide-line rounded-card border border-line bg-white">
        {WEEKDAYS.map((day) => {
          const w = value[day];
          const open = w !== null;
          return (
            <div
              key={day}
              className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2 sm:grid-cols-[120px_auto_1fr_1fr]"
            >
              <span className="text-sm font-medium text-ink">{WEEKDAY_LABELS[day]}</span>
              <label className="flex items-center gap-2 text-xs text-slate sm:justify-self-start">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#1B70BE]"
                  checked={open}
                  onChange={(e) =>
                    setDay(day, e.target.checked ? { open: '09:00', close: '21:00' } : null)
                  }
                />
                {open ? 'Open' : 'Closed'}
              </label>
              <div
                className={cn(
                  'col-span-2 grid grid-cols-2 gap-2 sm:col-span-2',
                  !open && 'opacity-50',
                )}
              >
                <label className="sr-only" htmlFor={`${day}-open`}>
                  {WEEKDAY_LABELS[day]} opens
                </label>
                <input
                  id={`${day}-open`}
                  type="time"
                  className={timeInput}
                  disabled={!open}
                  value={w?.open ?? ''}
                  onChange={(e) => w && setDay(day, { ...w, open: e.target.value })}
                />
                <label className="sr-only" htmlFor={`${day}-close`}>
                  {WEEKDAY_LABELS[day]} closes
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id={`${day}-close`}
                    type="time"
                    className={timeInput}
                    disabled={!open || w?.close === '24:00'}
                    value={w?.close === '24:00' ? '23:59' : (w?.close ?? '')}
                    onChange={(e) => w && setDay(day, { ...w, close: e.target.value })}
                  />
                  <button
                    type="button"
                    disabled={!open}
                    onClick={() =>
                      w && setDay(day, { ...w, close: w.close === '24:00' ? '21:00' : '24:00' })
                    }
                    className={cn(
                      'h-9 shrink-0 rounded-lg border px-2 text-xs font-medium',
                      w?.close === '24:00'
                        ? 'border-primary bg-primary-50 text-primary-700'
                        : 'border-line text-slate',
                    )}
                    aria-pressed={w?.close === '24:00'}
                    title="Open until midnight"
                  >
                    24:00
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate">
        Times are IST. A closing time earlier than opening means you stay open past midnight.
      </p>
    </div>
  );
}
