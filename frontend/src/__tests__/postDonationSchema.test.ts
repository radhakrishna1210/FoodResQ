import { describe, expect, it } from 'vitest';
import { makePostDonationSchema } from '@/lib/schemas';
import { fromISTInputValue } from '@/lib/format';

const now = () => new Date(fromISTInputValue('2026-10-04T20:34') as string);
const schema = makePostDonationSchema(now);

const valid = () => ({
  title: 'Veg pulao and dal (120 meals)',
  food_category: 'cooked_meal',
  diet_type: 'veg',
  quantity_servings: 120,
  quantity_kg: NaN,
  allergens: '',
  description: '',
  prepared_at: '2026-10-04T19:00',
  storage_condition: 'hot_held',
  ambient_above_32c: true,
  packaged_expiry_date: '',
  donor_pickup_by: '2026-10-04T22:30',
  pickup_address: 'Bibwewadi, Pune',
  pickup_lat: 18.4636,
  pickup_lng: 73.8682,
  pickup_instructions: 'Main canteen, gate 2',
  contact_phone: '9000000001',
  batch_no: '',
  temperature_c: NaN,
  checklist: {
    hygienic_handling: true,
    not_served_from_plates: true,
    covered_containers: true,
    segregated_from_waste: true,
    no_spoilage_signs: true,
  },
  declaration_accepted: true,
  photo_paths: ['donor/abc.jpg'],
});

describe('post-donation zod schema', () => {
  it('accepts the golden demo values', () => {
    const r = schema.safeParse(valid());
    expect(r.success).toBe(true);
  });

  it('rejects an unticked checklist item with a field error', () => {
    const v = valid();
    v.checklist.not_served_from_plates = false;
    const r = schema.safeParse(v);
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('checklist.not_served_from_plates');
    }
  });

  it('rejects an unaccepted declaration', () => {
    expect(schema.safeParse({ ...valid(), declaration_accepted: false }).success).toBe(false);
  });

  it('rejects food too close to its safe limit', () => {
    const r = schema.safeParse({
      ...valid(),
      storage_condition: 'room_temp',
      ambient_above_32c: true,
      prepared_at: '2026-10-04T19:54',
      donor_pickup_by: '2026-10-04T21:30',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.message)).toContain(
        'This food is too close to its safe limit to be rescued safely.',
      );
    }
  });

  it('rejects an invalid phone and a pickup less than 30 min away', () => {
    const r = schema.safeParse({
      ...valid(),
      contact_phone: '12345',
      donor_pickup_by: '2026-10-04T20:50',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'));
      expect(paths).toEqual(expect.arrayContaining(['contact_phone', 'donor_pickup_by']));
    }
  });
});
