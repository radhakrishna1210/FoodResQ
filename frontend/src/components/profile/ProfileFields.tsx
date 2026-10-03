import { Controller, type UseFormReturn } from 'react-hook-form';
import { Field, Input, Select, ChipGroup, Toggle } from '@/components/ui/Form';
import { PinPicker } from '@/components/map/PinPicker';
import {
  DIET_ACCEPTANCE_LABELS,
  DONOR_TYPE_LABELS,
  FOOD_CATEGORY_LABELS,
  RECEIVER_TYPE_LABELS,
} from '@/lib/labels';
import {
  DIET_ACCEPTANCES,
  DONOR_TYPES,
  FOOD_CATEGORIES,
  RECEIVER_TYPES,
  type DonorProfileValues,
  type ReceiverProfileValues,
} from '@/lib/schemas';
import { OperatingHoursEditor } from './OperatingHoursEditor';
import { FileUpload } from './FileUpload';
import type { OperatingHours } from '@/types';

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-heading text-base font-semibold text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

export function DonorProfileFields({ form }: { form: UseFormReturn<DonorProfileValues> }) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Organisation name"
          htmlFor="org_name"
          error={errors.org_name?.message}
          required
        >
          <Input id="org_name" invalid={!!errors.org_name} {...register('org_name')} />
        </Field>
        <Field label="Type" htmlFor="donor_type" error={errors.donor_type?.message} required>
          <Select id="donor_type" invalid={!!errors.donor_type} {...register('donor_type')}>
            <option value="" disabled>
              Choose…
            </option>
            {DONOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {DONOR_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field
        label="FSSAI licence no."
        htmlFor="fssai_license_no"
        hint="Optional · 14 digits"
        error={errors.fssai_license_no?.message}
      >
        <Input
          id="fssai_license_no"
          inputMode="numeric"
          maxLength={14}
          invalid={!!errors.fssai_license_no}
          {...register('fssai_license_no')}
        />
      </Field>
      <Field label="Address" htmlFor="address" error={errors.address?.message} required>
        <Input
          id="address"
          autoComplete="street-address"
          invalid={!!errors.address}
          {...register('address')}
        />
      </Field>
      <Controller
        control={control}
        name="lat"
        render={({ field: latField }) => (
          <Controller
            control={control}
            name="lng"
            render={({ field: lngField }) => (
              <Field
                label="Pickup location (map pin)"
                error={errors.lat?.message ?? errors.lng?.message}
                required
              >
                <PinPicker
                  value={
                    typeof latField.value === 'number' && typeof lngField.value === 'number'
                      ? { lat: latField.value, lng: lngField.value }
                      : null
                  }
                  onChange={(p) => {
                    latField.onChange(p.lat);
                    lngField.onChange(p.lng);
                  }}
                  invalid={!!errors.lat}
                />
              </Field>
            )}
          />
        )}
      />
    </>
  );
}

export function ReceiverProfileFields({
  form,
  showDocUpload = true,
}: {
  form: UseFormReturn<ReceiverProfileValues>;
  showDocUpload?: boolean;
}) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;
  const radius = watch('service_radius_km');
  return (
    <>
      <FormSection
        title="Organisation"
        description="Verified by the FoodResQ team before you receive offers."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Organisation name"
            htmlFor="org_name"
            error={errors.org_name?.message}
            required
          >
            <Input id="org_name" invalid={!!errors.org_name} {...register('org_name')} />
          </Field>
          <Field
            label="Type"
            htmlFor="receiver_type"
            error={errors.receiver_type?.message}
            required
          >
            <Select
              id="receiver_type"
              invalid={!!errors.receiver_type}
              {...register('receiver_type')}
            >
              <option value="" disabled>
                Choose…
              </option>
              {RECEIVER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RECEIVER_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="FSSAI registration no."
            htmlFor="fssai_registration_no"
            hint="14 digits"
            error={errors.fssai_registration_no?.message}
            required
          >
            <Input
              id="fssai_registration_no"
              inputMode="numeric"
              maxLength={14}
              invalid={!!errors.fssai_registration_no}
              {...register('fssai_registration_no')}
            />
          </Field>
          <Field
            label="NGO Darpan ID"
            htmlFor="ngo_darpan_id"
            hint="Optional"
            error={errors.ngo_darpan_id?.message}
          >
            <Input
              id="ngo_darpan_id"
              invalid={!!errors.ngo_darpan_id}
              {...register('ngo_darpan_id')}
            />
          </Field>
        </div>
        {showDocUpload && (
          <Controller
            control={control}
            name="verification_doc_path"
            render={({ field }) => (
              <Field
                label="Verification document"
                hint="FSSAI certificate or registration proof · PDF, JPG, PNG or WebP · max 5 MB"
              >
                <FileUpload
                  bucket="verification-docs"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  label="Upload document"
                  value={field.value}
                  onUploaded={(p) => field.onChange(p)}
                  onClear={() => field.onChange(null)}
                />
              </Field>
            )}
          />
        )}
      </FormSection>

      <FormSection title="Location and service area">
        <Field label="Address" htmlFor="address" error={errors.address?.message} required>
          <Input
            id="address"
            autoComplete="street-address"
            invalid={!!errors.address}
            {...register('address')}
          />
        </Field>
        <Controller
          control={control}
          name="lat"
          render={({ field: latField }) => (
            <Controller
              control={control}
              name="lng"
              render={({ field: lngField }) => (
                <Field label="Map pin" error={errors.lat?.message ?? errors.lng?.message} required>
                  <PinPicker
                    value={
                      typeof latField.value === 'number' && typeof lngField.value === 'number'
                        ? { lat: latField.value, lng: lngField.value }
                        : null
                    }
                    onChange={(p) => {
                      latField.onChange(p.lat);
                      lngField.onChange(p.lng);
                    }}
                    invalid={!!errors.lat}
                  />
                </Field>
              )}
            />
          )}
        />
        <Field
          label={`Service radius: ${Number(radius ?? 10)} km`}
          htmlFor="service_radius_km"
          hint="How far you can travel to collect (1–20 km)"
        >
          <input
            id="service_radius_km"
            type="range"
            min={1}
            max={20}
            step={1}
            className="w-full accent-[#27B5C9]"
            {...register('service_radius_km', { valueAsNumber: true })}
          />
        </Field>
      </FormSection>

      <FormSection title="What you can take">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Max servings per pickup"
            htmlFor="max_capacity_servings"
            error={errors.max_capacity_servings?.message}
            required
          >
            <Input
              id="max_capacity_servings"
              type="number"
              min={1}
              max={2000}
              invalid={!!errors.max_capacity_servings}
              {...register('max_capacity_servings', { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Diet accepted"
            htmlFor="diet_accepted"
            error={errors.diet_accepted?.message}
            required
          >
            <Select
              id="diet_accepted"
              invalid={!!errors.diet_accepted}
              {...register('diet_accepted')}
            >
              <option value="" disabled>
                Choose…
              </option>
              {DIET_ACCEPTANCES.map((d) => (
                <option key={d} value={d}>
                  {DIET_ACCEPTANCE_LABELS[d]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Controller
          control={control}
          name="accepted_categories"
          render={({ field }) => (
            <Field label="Food categories" error={errors.accepted_categories?.message} required>
              <ChipGroup
                ariaLabel="Food categories"
                options={FOOD_CATEGORIES}
                labels={FOOD_CATEGORY_LABELS}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            </Field>
          )}
        />
        <div className="space-y-3 rounded-card border border-line bg-bg/50 p-4">
          {(['has_vehicle', 'has_storage', 'has_reheating'] as const).map((k) => (
            <Controller
              key={k}
              control={control}
              name={k}
              render={({ field }) => (
                <Toggle
                  tone="teal"
                  checked={Boolean(field.value)}
                  onChange={field.onChange}
                  label={
                    k === 'has_vehicle'
                      ? 'We have a vehicle'
                      : k === 'has_storage'
                        ? 'We have storage'
                        : 'We can reheat food'
                  }
                />
              )}
            />
          ))}
        </div>
      </FormSection>

      <FormSection title="Operating hours">
        <Controller
          control={control}
          name="operating_hours"
          render={({ field }) => (
            <OperatingHoursEditor value={field.value as OperatingHours} onChange={field.onChange} />
          )}
        />
      </FormSection>
    </>
  );
}
