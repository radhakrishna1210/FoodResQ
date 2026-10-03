import { useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { useCreateDonation } from '@/hooks/queries';
import { useAuth } from '@/lib/auth';
import {
  DIET_TYPES,
  FOOD_CATEGORIES,
  STORAGE_CONDITIONS,
  emptyToNull,
  postDonationSchema,
  type PostDonationOutput,
  type PostDonationValues,
} from '@/lib/schemas';
import {
  CHECKLIST_ITEMS,
  DECLARATION_TEXT,
  DIET_LABELS,
  FOOD_CATEGORY_LABELS,
  STORAGE_LABELS,
} from '@/lib/labels';
import { fromISTInputValue, toISTInputValue } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, Segmented, Select, Textarea, Toggle } from '@/components/ui/Form';
import { DietDot, PageHeader } from '@/components/ui/misc';
import { InlineError } from '@/components/ui/ErrorState';
import { FormSection } from '@/components/profile/ProfileFields';
import { PinPicker } from '@/components/map/PinPicker';
import { FileUpload } from '@/components/profile/FileUpload';
import { DeadlinePreview } from '@/components/donation/DeadlinePreview';
import type { DonationCreateInput, DonationDraft, StorageCondition } from '@/types';

const EMPTY_CHECKLIST = {
  hygienic_handling: false,
  not_served_from_plates: false,
  covered_containers: false,
  segregated_from_waste: false,
  no_spoilage_signs: false,
};

export function toCreateInput(v: PostDonationOutput): DonationCreateInput {
  return {
    title: v.title.trim(),
    description: emptyToNull(v.description),
    food_category: v.food_category,
    diet_type: v.diet_type,
    quantity_servings: v.quantity_servings,
    quantity_kg: v.quantity_kg ?? null,
    allergens: emptyToNull(v.allergens),
    storage_condition: v.storage_condition,
    ambient_above_32c: v.storage_condition === 'room_temp' ? v.ambient_above_32c : false,
    prepared_at: fromISTInputValue(v.prepared_at) as string,
    packaged_expiry_date:
      v.storage_condition === 'packaged_sealed' ? emptyToNull(v.packaged_expiry_date) : null,
    donor_pickup_by: fromISTInputValue(v.donor_pickup_by) as string,
    pickup_address: v.pickup_address.trim(),
    pickup_lat: v.pickup_lat,
    pickup_lng: v.pickup_lng,
    pickup_instructions: emptyToNull(v.pickup_instructions),
    contact_phone: v.contact_phone,
    batch_no: emptyToNull(v.batch_no),
    temperature_c: v.temperature_c ?? null,
    checklist: {
      hygienic_handling: true,
      not_served_from_plates: true,
      covered_containers: true,
      segregated_from_waste: true,
      no_spoilage_signs: true,
    },
    declaration_accepted: true,
    photo_paths: v.photo_paths,
  };
}

export default function PostDonationPage() {
  const { donorProfile, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const draft = (location.state as { draft?: DonationDraft } | null)?.draft ?? null;
  const create = useCreateDonation();

  const defaults = useMemo<PostDonationValues>(
    () => ({
      title: draft?.title ?? '',
      food_category: (draft?.food_category ?? '') as never,
      diet_type: (draft?.diet_type ?? '') as never,
      quantity_servings: draft?.quantity_servings ?? (undefined as never),
      quantity_kg: draft?.quantity_kg ?? undefined,
      allergens: draft?.allergens ?? '',
      description: draft?.description ?? '',
      prepared_at: draft?.prepared_at ? toISTInputValue(draft.prepared_at) : '',
      // Storage condition is always chosen by the Donor (WALKTHROUGH §8).
      storage_condition: (draft?.storage_condition ?? '') as never,
      ambient_above_32c: true,
      packaged_expiry_date: '',
      donor_pickup_by: draft?.donor_pickup_by ? toISTInputValue(draft.donor_pickup_by) : '',
      pickup_address: donorProfile?.address ?? '',
      pickup_lat: donorProfile?.lat as number,
      pickup_lng: donorProfile?.lng as number,
      pickup_instructions: draft?.pickup_instructions ?? '',
      contact_phone: user?.phone ?? '',
      batch_no: '',
      temperature_c: undefined,
      // Checklist and declaration are ALWAYS unticked, even from an assistant draft (ARCHITECTURE §11.2).
      checklist: EMPTY_CHECKLIST,
      declaration_accepted: false,
      photo_paths: [],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const form = useForm<PostDonationValues>({
    // zodResolver returns the parsed (output) values; typed as input for the form fields.
    resolver: zodResolver(postDonationSchema) as unknown as Resolver<PostDonationValues>,
    defaultValues: defaults,
    mode: 'onTouched',
  });
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (!form.getValues('pickup_address') && donorProfile) {
      form.setValue('pickup_address', donorProfile.address);
      form.setValue('pickup_lat', donorProfile.lat);
      form.setValue('pickup_lng', donorProfile.lng);
    }
  }, [donorProfile, form]);

  const storage = watch('storage_condition') as StorageCondition | '';
  const ambient = watch('ambient_above_32c');
  const preparedAt = watch('prepared_at');
  const pickupBy = watch('donor_pickup_by');
  const expiry = watch('packaged_expiry_date');
  const photos = watch('photo_paths');

  const onSubmit = (values: PostDonationValues) => {
    const v = values as unknown as PostDonationOutput;
    create.mutate(toCreateInput(v), {
      onSuccess: (d) => navigate(`/donor/donations/${d.id}`, { replace: true }),
    });
  };

  const checklistErrors = errors.checklist as Record<string, { message?: string }> | undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link
            to="/donor"
            className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink"
          >
            <ArrowLeft size={16} aria-hidden /> Back to dashboard
          </Link>
        }
        title="Post surplus food"
        subtitle="One form, about a minute. FoodResQ checks it and finds the best-fit Receiver."
      />
      {draft && (
        <div className="mb-5 flex items-start gap-2 rounded-card border border-purple/30 bg-purple-50 px-4 py-3 text-sm text-purple-700">
          <Sparkles size={16} className="mt-0.5 shrink-0" aria-hidden />
          Prefilled from your assistant draft. Please review every field, choose the storage
          condition, tick the safety checklist yourself, and post.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* 1. Food */}
        <FormSection title="1. Food">
          <Field
            label="Food name"
            htmlFor="title"
            hint='For example "Veg pulao and dal (120 meals)"'
            error={errors.title?.message}
            required
          >
            <Input id="title" maxLength={80} invalid={!!errors.title} {...register('title')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Category"
              htmlFor="food_category"
              error={errors.food_category?.message}
              required
            >
              <Select
                id="food_category"
                invalid={!!errors.food_category}
                {...register('food_category')}
              >
                <option value="" disabled>
                  Choose…
                </option>
                {FOOD_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {FOOD_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Controller
              control={control}
              name="diet_type"
              render={({ field }) => (
                <Field label="Diet" error={errors.diet_type?.message} required>
                  <Segmented
                    ariaLabel="Diet"
                    options={DIET_TYPES}
                    value={field.value || undefined}
                    onChange={field.onChange}
                    render={(d) => (
                      <>
                        <DietDot diet={d} />
                        {DIET_LABELS[d]}
                      </>
                    )}
                  />
                </Field>
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Servings"
              htmlFor="quantity_servings"
              hint="One serving = one meal for one person"
              error={errors.quantity_servings?.message}
              required
            >
              <Input
                id="quantity_servings"
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                invalid={!!errors.quantity_servings}
                {...register('quantity_servings', { valueAsNumber: true })}
              />
            </Field>
            <Field
              label="Weight (kg)"
              htmlFor="quantity_kg"
              hint="Optional, informational only"
              error={errors.quantity_kg?.message}
            >
              <Input
                id="quantity_kg"
                type="number"
                step="0.1"
                min={0}
                invalid={!!errors.quantity_kg}
                {...register('quantity_kg', { valueAsNumber: true })}
              />
            </Field>
          </div>
          <Field
            label="Allergens"
            htmlFor="allergens"
            hint="Optional, e.g. nuts, dairy, gluten"
            error={errors.allergens?.message}
          >
            <Input id="allergens" invalid={!!errors.allergens} {...register('allergens')} />
          </Field>
          <Field
            label="Description"
            htmlFor="description"
            hint="Optional · up to 500 characters"
            error={errors.description?.message}
          >
            <Textarea
              id="description"
              maxLength={500}
              invalid={!!errors.description}
              {...register('description')}
            />
          </Field>
        </FormSection>

        {/* 2. Timing and storage */}
        <FormSection title="2. Timing and storage">
          <Field
            label="Prepared at"
            htmlFor="prepared_at"
            hint="IST"
            error={errors.prepared_at?.message}
            required
          >
            <Input
              id="prepared_at"
              type="datetime-local"
              invalid={!!errors.prepared_at}
              {...register('prepared_at')}
            />
          </Field>
          <Controller
            control={control}
            name="storage_condition"
            render={({ field }) => (
              <Field label="Storage" error={errors.storage_condition?.message} required>
                <div
                  className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                  role="radiogroup"
                  aria-label="Storage"
                >
                  {STORAGE_CONDITIONS.map((s) => {
                    const on = field.value === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => field.onChange(s)}
                        className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
                          on
                            ? 'border-primary bg-primary-50 text-primary-700'
                            : 'border-line bg-white text-slate-700 hover:border-slate/40'
                        }`}
                      >
                        {STORAGE_LABELS[s]}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}
          />
          {storage === 'room_temp' && (
            <Controller
              control={control}
              name="ambient_above_32c"
              render={({ field }) => (
                <div className="rounded-card border border-line bg-bg/50 p-4">
                  <Toggle
                    checked={field.value}
                    onChange={field.onChange}
                    label="Is it above 32 °C where the food is kept?"
                    description={
                      field.value ? 'Yes — 1 hour safe window' : 'No — 2 hour safe window'
                    }
                  />
                </div>
              )}
            />
          )}
          {storage === 'packaged_sealed' && (
            <Field
              label="Packaged expiry date"
              htmlFor="packaged_expiry_date"
              error={errors.packaged_expiry_date?.message}
              required
            >
              <Input
                id="packaged_expiry_date"
                type="date"
                invalid={!!errors.packaged_expiry_date}
                {...register('packaged_expiry_date')}
              />
            </Field>
          )}
          <Field
            label="Pickup by"
            htmlFor="donor_pickup_by"
            hint="IST · at least 30 minutes from now, within 48 hours"
            error={errors.donor_pickup_by?.message}
            required
          >
            <Input
              id="donor_pickup_by"
              type="datetime-local"
              invalid={!!errors.donor_pickup_by}
              {...register('donor_pickup_by')}
            />
          </Field>
          <DeadlinePreview
            storage={storage}
            ambientAbove32c={ambient}
            preparedAt={preparedAt}
            pickupBy={pickupBy}
            expiryDate={expiry}
          />
        </FormSection>

        {/* 3. Pickup and safety */}
        <FormSection title="3. Pickup and safety">
          <Field
            label="Pickup address"
            htmlFor="pickup_address"
            error={errors.pickup_address?.message}
            required
          >
            <Input
              id="pickup_address"
              invalid={!!errors.pickup_address}
              {...register('pickup_address')}
            />
          </Field>
          <Controller
            control={control}
            name="pickup_lat"
            render={({ field: latF }) => (
              <Controller
                control={control}
                name="pickup_lng"
                render={({ field: lngF }) => (
                  <Field
                    label="Pickup location"
                    hint="Prefilled from your profile. Drag the pin to adjust."
                    error={errors.pickup_lat?.message ?? errors.pickup_lng?.message}
                    required
                  >
                    <PinPicker
                      value={
                        typeof latF.value === 'number' && typeof lngF.value === 'number'
                          ? { lat: latF.value, lng: lngF.value }
                          : null
                      }
                      onChange={(p) => {
                        latF.onChange(p.lat);
                        lngF.onChange(p.lng);
                      }}
                      height={220}
                    />
                  </Field>
                )}
              />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Instructions"
              htmlFor="pickup_instructions"
              hint='e.g. "Main canteen, gate 2"'
              error={errors.pickup_instructions?.message}
            >
              <Input
                id="pickup_instructions"
                maxLength={300}
                invalid={!!errors.pickup_instructions}
                {...register('pickup_instructions')}
              />
            </Field>
            <Field
              label="Contact phone"
              htmlFor="contact_phone"
              error={errors.contact_phone?.message}
              required
            >
              <Input
                id="contact_phone"
                inputMode="numeric"
                maxLength={10}
                invalid={!!errors.contact_phone}
                {...register('contact_phone')}
              />
            </Field>
          </div>
          <details className="rounded-card border border-line bg-bg/40 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              Optional record details (batch no., temperature)
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Batch no." htmlFor="batch_no" error={errors.batch_no?.message}>
                <Input id="batch_no" {...register('batch_no')} />
              </Field>
              <Field
                label="Temperature (°C)"
                htmlFor="temperature_c"
                error={errors.temperature_c?.message}
              >
                <Input
                  id="temperature_c"
                  type="number"
                  step="0.1"
                  {...register('temperature_c', { valueAsNumber: true })}
                />
              </Field>
            </div>
          </details>
          <Controller
            control={control}
            name="photo_paths"
            render={({ field }) => (
              <Field
                label="Photo"
                hint="Recommended. Posts without a photo need a quick review before matching"
              >
                <FileUpload
                  bucket="donation-photos"
                  accept="image/jpeg,image/png,image/webp"
                  label="Add a photo of the food"
                  value={field.value[0] ?? null}
                  onUploaded={(p) => field.onChange([p])}
                  onClear={() => field.onChange([])}
                  image
                />
              </Field>
            )}
          />
          {photos.length === 0 && (
            <p className="-mt-2 text-xs text-gold-700">
              Posts without a photo need a quick review before matching.
            </p>
          )}

          <fieldset className="space-y-2">
            <legend className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <ShieldCheck size={16} className="text-green" aria-hidden /> Safety checklist
              <span className="text-red" aria-hidden>
                *
              </span>
            </legend>
            {CHECKLIST_ITEMS.map((item) => (
              <div key={item.key}>
                <Checkbox
                  label={item.label}
                  invalid={!!checklistErrors?.[item.key]}
                  {...register(`checklist.${item.key}` as const)}
                />
                {checklistErrors?.[item.key]?.message && (
                  <p className="mt-1 text-xs text-red-700" role="alert">
                    {checklistErrors[item.key].message}
                  </p>
                )}
              </div>
            ))}
          </fieldset>

          <div>
            <Checkbox
              label={<span className="text-sm leading-relaxed">{DECLARATION_TEXT}</span>}
              invalid={!!errors.declaration_accepted}
              className="bg-bg/60"
              {...register('declaration_accepted')}
            />
            {errors.declaration_accepted?.message && (
              <p className="mt-1 text-xs text-red-700" role="alert">
                {errors.declaration_accepted.message}
              </p>
            )}
          </div>
        </FormSection>

        <InlineError error={create.error} />
        <div className="sticky bottom-16 z-10 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
          <Button
            type="submit"
            size="lg"
            block
            loading={create.isPending}
            icon={<Send size={18} />}
          >
            Post and find a Receiver
          </Button>
        </div>
      </form>
    </div>
  );
}
