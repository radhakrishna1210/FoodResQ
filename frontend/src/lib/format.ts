// IST display helpers (README D12: store UTC, display Asia/Kolkata) and countdown logic.
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const IST = 'Asia/Kolkata';

type DateLike = string | number | Date;
const toDate = (d: DateLike): Date => (d instanceof Date ? d : new Date(d));

export function formatIST(d: DateLike | null | undefined, pattern: string): string {
  if (d === null || d === undefined || d === '') return '—';
  const date = toDate(d);
  if (Number.isNaN(date.getTime())) return '—';
  return formatInTimeZone(date, IST, pattern);
}

/** "10:30 PM" */
export const formatTime = (d: DateLike | null | undefined) => formatIST(d, 'h:mm a');
/** "4 Oct, 10:30 PM" */
export const formatDateTime = (d: DateLike | null | undefined) => formatIST(d, 'd MMM, h:mm a');
/** "4 Oct 2026" */
export const formatDate = (d: DateLike | null | undefined) => formatIST(d, 'd MMM yyyy');

/** Value for <input type="datetime-local"> in IST. */
export function toISTInputValue(d: DateLike | null | undefined): string {
  if (!d) return '';
  return formatIST(d, "yyyy-MM-dd'T'HH:mm");
}

/** Parse a datetime-local value as IST wall time → UTC ISO string with Z. */
export function fromISTInputValue(value: string): string | null {
  if (!value) return null;
  const date = fromZonedTime(value.length === 16 ? `${value}:00` : value, IST);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Today's date in IST as yyyy-MM-dd. */
export const todayIST = (now: DateLike = Date.now()) => formatIST(now, 'yyyy-MM-dd');

export function timeAgo(d: DateLike, now: number = Date.now()): string {
  const diff = Math.max(0, now - toDate(d).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return formatDateTime(d);
}

// ---- Countdown (WALKTHROUGH §5.1) ----
export type CountdownTone = 'normal' | 'warning' | 'danger' | 'passed';

/** "1 h 56 m left" / "44 m left" / "Deadline passed" */
export function countdownLabel(msLeft: number): string {
  if (msLeft <= 0) return 'Deadline passed';
  const totalMin = Math.floor(msLeft / 60000);
  if (totalMin < 1) return 'Less than 1 m left';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} h ${m} m left` : `${m} m left`;
}

/** Gold under 45 min, red under 15 min, passed when over. */
export function countdownTone(msLeft: number): CountdownTone {
  if (msLeft <= 0) return 'passed';
  const min = msLeft / 60000;
  if (min < 15) return 'danger';
  if (min < 45) return 'warning';
  return 'normal';
}

/** Offer response countdown: "Respond in 7 min". */
export function respondLabel(msLeft: number): string {
  if (msLeft <= 0) return 'Response time over';
  const min = Math.ceil(msLeft / 60000);
  return `Respond in ${min} min`;
}

export function formatMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined || Number.isNaN(min)) return '—';
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} m`;
}

export function formatPercent(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

export const formatNumber = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('en-IN').format(n);

export const googleMapsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
