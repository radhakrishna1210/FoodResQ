// Client-side mirror of ARCHITECTURE §6.2 (preview only — the server remains the authority).
import { fromZonedTime } from 'date-fns-tz';
import type { StorageCondition } from '@/types';
import { IST } from './format';

/** Defaults from app_config (§16). */
export const DEADLINE_DEFAULTS = {
  safe_window_hours: { hot_held: 4, room_temp: 2, room_temp_hot_ambient: 1, refrigerated: 12 },
  packaged_expiry_buffer_hours: 12,
  consumption_buffer_minutes: 30,
  min_rescue_window_minutes: 30,
};
export type DeadlineConfig = typeof DEADLINE_DEFAULTS;

export interface DeadlineInput {
  storage_condition: StorageCondition;
  ambient_above_32c: boolean;
  prepared_at: Date;
  donor_pickup_by: Date;
  packaged_expiry_date?: string | null; // yyyy-MM-dd (IST date)
}

export interface DeadlineResult {
  /** prepared_at + window − buffer (or expiry-based for packaged) */
  safe_pickup_deadline: Date;
  /** min(donor_pickup_by, safe_pickup_deadline) — shown as "Pickup by" */
  effective_deadline: Date;
  /** prepared_at + window (or expiry 23:59 IST for packaged) — "Last time of consumption" */
  last_consumption_at: Date;
  window_hours: number | null;
}

const H = 3600_000;
const M = 60_000;

export function safeWindowHours(
  storage: StorageCondition,
  ambientAbove32c: boolean,
  cfg: DeadlineConfig = DEADLINE_DEFAULTS,
): number | null {
  switch (storage) {
    case 'hot_held':
      return cfg.safe_window_hours.hot_held;
    case 'room_temp':
      return ambientAbove32c
        ? cfg.safe_window_hours.room_temp_hot_ambient
        : cfg.safe_window_hours.room_temp;
    case 'refrigerated':
      return cfg.safe_window_hours.refrigerated;
    case 'packaged_sealed':
      return null;
  }
}

export function computeDeadlines(
  input: DeadlineInput,
  cfg: DeadlineConfig = DEADLINE_DEFAULTS,
): DeadlineResult | null {
  const { storage_condition, ambient_above_32c, prepared_at, donor_pickup_by } = input;
  if (Number.isNaN(donor_pickup_by.getTime())) return null;

  if (storage_condition === 'packaged_sealed') {
    if (!input.packaged_expiry_date) return null;
    const expiry = fromZonedTime(`${input.packaged_expiry_date}T23:59:00`, IST);
    if (Number.isNaN(expiry.getTime())) return null;
    const safe = new Date(expiry.getTime() - cfg.packaged_expiry_buffer_hours * H);
    return {
      safe_pickup_deadline: safe,
      effective_deadline: new Date(Math.min(donor_pickup_by.getTime(), safe.getTime())),
      last_consumption_at: expiry,
      window_hours: null,
    };
  }

  if (Number.isNaN(prepared_at.getTime())) return null;
  const windowH = safeWindowHours(storage_condition, ambient_above_32c, cfg) as number;
  const last = new Date(prepared_at.getTime() + windowH * H);
  const safe = new Date(last.getTime() - cfg.consumption_buffer_minutes * M);
  return {
    safe_pickup_deadline: safe,
    effective_deadline: new Date(Math.min(donor_pickup_by.getTime(), safe.getTime())),
    last_consumption_at: last,
    window_hours: windowH,
  };
}

/** True when the effective deadline leaves less than min_rescue_window_minutes (§6.1). */
export function isTooCloseToSafeLimit(
  effective: Date,
  now: Date = new Date(),
  cfg: DeadlineConfig = DEADLINE_DEFAULTS,
): boolean {
  return effective.getTime() < now.getTime() + cfg.min_rescue_window_minutes * M;
}

export const TOO_CLOSE_MESSAGE = 'This food is too close to its safe limit to be rescued safely.';
