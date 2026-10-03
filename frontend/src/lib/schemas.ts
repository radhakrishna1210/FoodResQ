// Zod schemas mirroring backend Pydantic rules (ARCHITECTURE §2, §4.2, §6.1).
import { z } from 'zod';
import type { OperatingHours } from '@/types';
import { computeDeadlines, isTooCloseToSafeLimit, TOO_CLOSE_MESSAGE } from './deadline';
import { fromISTInputValue, todayIST } from './format';

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9][0-9]{9}$/, 'Enter a 10-digit Indian mobile number');

const fourteenDigits = /^[0-9]{14}$/;

const nanToUndefined = (v: unknown) =>
  v === '' || v === null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v;

const optionalNumber = (schema: z.ZodNumber) => z.preprocess(nanToUndefined, schema.optional());
const requiredNumber = (msg: string) =>
  z.preprocess(nanToUndefined, z.number({ required_error: msg, invalid_type_error: msg }));

const optionalText = (max?: number) =>
  z
    .string()
    .trim()
    .max(max ?? 10_000, max ? `Keep it under ${max} characters` : undefined)
    .optional()
    .or(z.literal(''));

export const FOOD_CATEGORIES = [
  'cooked_meal',
  'bakery',
  'sweets',
  'dairy',
  'raw_produce',
  'packaged',
] as const;
export const DIET_TYPES = ['veg', 'egg', 'non_veg'] as const;
export const STORAGE_CONDITIONS = [
  'hot_held',
  'room_temp',
  'refrigerated',
  'packaged_sealed',
] as const;
export const DONOR_TYPES = [
  'restaurant',
  'hotel',
  'college_hostel',
  'caterer_event',
  'other_business',
] as const;
export const RECEIVER_TYPES = ['ngo', 'shelter', 'community_org', 'food_distributor'] as const;
export const DIET_ACCEPTANCES = ['veg_only', 'veg_egg', 'all'] as const;

const mustTick = (msg = 'Please confirm this item') =>
  z.boolean().refine((v) => v === true, { message: msg });

const latSchema = requiredNumber('Drop a pin on the map').pipe(
  z.number().min(6, 'Location must be inside India').max(38, 'Location must be inside India'),
);
const lngSchema = requiredNumber('Drop a pin on the map').pipe(
  z.number().min(68, 'Location must be inside India').max(98, 'Location must be inside India'),
);

// ---------------- Post donation ----------------
export function makePostDonationSchema(now: () => Date = () => new Date()) {
  return z
    .object({
      title: z
        .string()
        .trim()
        .min(3, 'Food name must be 3–80 characters')
        .max(80, 'Food name must be 3–80 characters'),
      food_category: z.enum(FOOD_CATEGORIES, {
        errorMap: () => ({ message: 'Choose a category' }),
      }),
      diet_type: z.enum(DIET_TYPES, {
        errorMap: () => ({ message: 'Choose Veg, Egg or Non-veg' }),
      }),
      quantity_servings: requiredNumber('Enter the number of servings').pipe(
        z
          .number()
          .int('Whole servings only')
          .min(1, 'Between 1 and 1000 servings')
          .max(1000, 'Between 1 and 1000 servings'),
      ),
      quantity_kg: optionalNumber(z.number().positive('Must be more than 0').max(99999)),
      allergens: optionalText(200),
      description: optionalText(500),
      prepared_at: z.string().min(1, 'When was the food prepared?'),
      storage_condition: z.enum(STORAGE_CONDITIONS, {
        errorMap: () => ({ message: 'How is the food stored?' }),
      }),
      ambient_above_32c: z.boolean(),
      packaged_expiry_date: z.string().optional().or(z.literal('')),
      donor_pickup_by: z.string().min(1, 'By when must it be picked up?'),
      pickup_address: z.string().trim().min(3, 'Enter the pickup address'),
      pickup_lat: latSchema,
      pickup_lng: lngSchema,
      pickup_instructions: optionalText(300),
      contact_phone: phoneSchema,
      batch_no: optionalText(60),
      temperature_c: optionalNumber(z.number().min(-30).max(100)),
      checklist: z.object({
        hygienic_handling: mustTick(),
        not_served_from_plates: mustTick(),
        covered_containers: mustTick(),
        segregated_from_waste: mustTick(),
        no_spoilage_signs: mustTick(),
      }),
      declaration_accepted: mustTick('Please accept the declaration'),
      photo_paths: z.array(z.string()),
    })
    .superRefine((v, ctx) => {
      const n = now();
      const prepared = v.prepared_at ? fromISTInputValue(v.prepared_at) : null;
      const pickupBy = v.donor_pickup_by ? fromISTInputValue(v.donor_pickup_by) : null;
      const isPackaged = v.storage_condition === 'packaged_sealed';

      if (prepared) {
        const p = new Date(prepared).getTime();
        if (p > n.getTime() + 2 * 60_000) {
          ctx.addIssue({
            code: 'custom',
            path: ['prepared_at'],
            message: 'Preparation time cannot be in the future',
          });
        } else if (!isPackaged && p < n.getTime() - 24 * 3600_000) {
          ctx.addIssue({
            code: 'custom',
            path: ['prepared_at'],
            message: 'Cooked food older than 24 hours cannot be posted',
          });
        }
      }
      if (isPackaged) {
        if (!v.packaged_expiry_date) {
          ctx.addIssue({
            code: 'custom',
            path: ['packaged_expiry_date'],
            message: 'Enter the expiry date on the pack',
          });
        } else if (v.packaged_expiry_date < todayIST(n)) {
          ctx.addIssue({
            code: 'custom',
            path: ['packaged_expiry_date'],
            message: 'This pack has already expired',
          });
        }
      }
      if (pickupBy) {
        const t = new Date(pickupBy).getTime();
        if (t < n.getTime() + 30 * 60_000) {
          ctx.addIssue({
            code: 'custom',
            path: ['donor_pickup_by'],
            message: 'Pickup time must be at least 30 minutes from now',
          });
        } else if (t > n.getTime() + 48 * 3600_000) {
          ctx.addIssue({
            code: 'custom',
            path: ['donor_pickup_by'],
            message: 'Pickup time must be within 48 hours',
          });
        }
      }
      if (prepared && pickupBy && v.storage_condition) {
        const d = computeDeadlines({
          storage_condition: v.storage_condition,
          ambient_above_32c: v.ambient_above_32c,
          prepared_at: new Date(prepared),
          donor_pickup_by: new Date(pickupBy),
          packaged_expiry_date: v.packaged_expiry_date || null,
        });
        if (d && isTooCloseToSafeLimit(d.effective_deadline, n)) {
          ctx.addIssue({ code: 'custom', path: ['storage_condition'], message: TOO_CLOSE_MESSAGE });
        }
      }
    });
}

export const postDonationSchema = makePostDonationSchema();
export type PostDonationValues = z.input<typeof postDonationSchema>;
export type PostDonationOutput = z.output<typeof postDonationSchema>;

// ---------------- Profiles ----------------
const hhmm = /^([01][0-9]|2[0-3]):[0-5][0-9]$|^24:00$/;
const hoursWindow = z
  .object({
    open: z.string().regex(hhmm, 'Use HH:MM'),
    close: z.string().regex(hhmm, 'Use HH:MM'),
  })
  .nullable();

export const operatingHoursSchema = z.object({
  mon: hoursWindow,
  tue: hoursWindow,
  wed: hoursWindow,
  thu: hoursWindow,
  fri: hoursWindow,
  sat: hoursWindow,
  sun: hoursWindow,
});

export const DEFAULT_HOURS: OperatingHours = {
  mon: { open: '09:00', close: '21:00' },
  tue: { open: '09:00', close: '21:00' },
  wed: { open: '09:00', close: '21:00' },
  thu: { open: '09:00', close: '21:00' },
  fri: { open: '09:00', close: '21:00' },
  sat: { open: '09:00', close: '21:00' },
  sun: { open: '09:00', close: '21:00' },
};

export const personSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(100),
  phone: phoneSchema,
});

export const donorProfileSchema = z.object({
  org_name: z.string().trim().min(2, 'Organisation name must be 2–120 characters').max(120),
  donor_type: z.enum(DONOR_TYPES, { errorMap: () => ({ message: 'Choose a type' }) }),
  fssai_license_no: z
    .string()
    .trim()
    .regex(fourteenDigits, 'FSSAI licence number has 14 digits')
    .optional()
    .or(z.literal('')),
  address: z.string().trim().min(3, 'Enter the address'),
  lat: latSchema,
  lng: lngSchema,
});
export type DonorProfileValues = z.input<typeof donorProfileSchema>;

export const receiverProfileSchema = z.object({
  org_name: z.string().trim().min(2, 'Organisation name must be 2–120 characters').max(120),
  receiver_type: z.enum(RECEIVER_TYPES, { errorMap: () => ({ message: 'Choose a type' }) }),
  fssai_registration_no: z
    .string()
    .trim()
    .regex(fourteenDigits, 'FSSAI registration number has 14 digits'),
  ngo_darpan_id: z.string().trim().max(40).optional().or(z.literal('')),
  address: z.string().trim().min(3, 'Enter the address'),
  lat: latSchema,
  lng: lngSchema,
  service_radius_km: requiredNumber('Choose a radius').pipe(z.number().min(1).max(20)),
  max_capacity_servings: requiredNumber('Enter max servings per pickup').pipe(
    z
      .number()
      .int('Whole servings only')
      .min(1, 'Between 1 and 2000')
      .max(2000, 'Between 1 and 2000'),
  ),
  diet_accepted: z.enum(DIET_ACCEPTANCES, {
    errorMap: () => ({ message: 'Choose what you accept' }),
  }),
  accepted_categories: z.array(z.enum(FOOD_CATEGORIES)).min(1, 'Choose at least one food category'),
  has_vehicle: z.boolean(),
  has_storage: z.boolean(),
  has_reheating: z.boolean(),
  operating_hours: operatingHoursSchema,
  verification_doc_path: z.string().nullable().optional(),
});
export type ReceiverProfileValues = z.input<typeof receiverProfileSchema>;

export const emptyToNull = (v: string | undefined | null): string | null => {
  const t = (v ?? '').trim();
  return t ? t : null;
};
