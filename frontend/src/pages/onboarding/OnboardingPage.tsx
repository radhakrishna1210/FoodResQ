import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Check, HandHeart, Utensils } from 'lucide-react';
import { api } from '@/lib/api';
import { getSignupPrefill, homeFor, setSignupPrefill, useAuth } from '@/lib/auth';
import {
  DEFAULT_HOURS,
  donorProfileSchema,
  emptyToNull,
  personSchema,
  receiverProfileSchema,
  type DonorProfileValues,
  type ReceiverProfileValues,
} from '@/lib/schemas';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { InlineError } from '@/components/ui/ErrorState';
import {
  DonorProfileFields,
  FormSection,
  ReceiverProfileFields,
} from '@/components/profile/ProfileFields';
import { cn } from '@/lib/cn';
import type { DonorProfileInput, OperatingHours, ReceiverProfileInput } from '@/types';
import { z } from 'zod';

type Role = 'donor' | 'receiver';

function RoleCard({
  role,
  selected,
  onSelect,
}: {
  role: Role;
  selected: boolean;
  onSelect: () => void;
}) {
  const donor = role === 'donor';
  const Icon = donor ? Utensils : HandHeart;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'card card-hover relative flex w-full flex-col items-start p-6 text-left transition-all focus:outline-none focus-visible:ring-4',
        donor ? 'focus-visible:ring-primary/20' : 'focus-visible:ring-teal/20',
        selected && (donor ? 'border-primary ring-2 ring-primary' : 'border-teal ring-2 ring-teal'),
      )}
    >
      {selected && (
        <span
          className={cn(
            'absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full text-white',
            donor ? 'bg-primary' : 'bg-teal',
          )}
        >
          <Check size={14} aria-hidden />
        </span>
      )}
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl',
          donor ? 'bg-primary-50 text-primary' : 'bg-teal-50 text-teal-700',
        )}
      >
        <Icon size={24} aria-hidden />
      </span>
      <span className="mt-4 font-heading text-lg font-semibold text-ink">
        {donor ? 'Donor' : 'Receiver'}
      </span>
      <span className="mt-1 text-sm text-slate">
        {donor
          ? 'Restaurants, hotels, colleges and hostels, caterers and event organisers, other food businesses.'
          : 'NGOs, shelters, community organisations and food distributors that collect food directly from Donors.'}
      </span>
      <span className="mt-3 text-xs font-medium text-slate">
        {donor
          ? 'Post as soon as you finish your profile.'
          : 'Offers start after the FoodResQ team verifies you.'}
      </span>
    </button>
  );
}

function PersonFields({ form }: { form: ReturnType<typeof usePersonForm> }) {
  const {
    register,
    formState: { errors },
  } = form;
  return (
    <FormSection title="About you" description="The contact person for this organisation.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="full_name" error={errors.full_name?.message} required>
          <Input
            id="full_name"
            autoComplete="name"
            invalid={!!errors.full_name}
            {...register('full_name')}
          />
        </Field>
        <Field
          label="Mobile number"
          htmlFor="phone"
          hint="10-digit Indian mobile"
          error={errors.phone?.message}
          required
        >
          <Input
            id="phone"
            inputMode="numeric"
            maxLength={10}
            invalid={!!errors.phone}
            {...register('phone')}
          />
        </Field>
      </div>
    </FormSection>
  );
}

function usePersonForm() {
  const prefill = getSignupPrefill();
  return useForm<z.input<typeof personSchema>>({
    resolver: zodResolver(personSchema),
    defaultValues: { full_name: prefill?.full_name ?? '', phone: prefill?.phone ?? '' },
  });
}

export default function OnboardingPage() {
  const [params] = useSearchParams();
  const prefill = getSignupPrefill();
  const initialRole = (params.get('role') as Role | null) ?? prefill?.role ?? null;
  const [role, setRole] = useState<Role | null>(
    initialRole === 'donor' || initialRole === 'receiver' ? initialRole : null,
  );
  const [step, setStep] = useState<1 | 2>(1);
  const { refreshMe, signOut } = useAuth();
  const navigate = useNavigate();

  const personForm = usePersonForm();
  const donorForm = useForm<DonorProfileValues>({
    resolver: zodResolver(donorProfileSchema),
    defaultValues: { org_name: '', donor_type: '' as never, fssai_license_no: '', address: '' },
  });
  const receiverForm = useForm<ReceiverProfileValues>({
    resolver: zodResolver(receiverProfileSchema),
    defaultValues: {
      org_name: '',
      receiver_type: '' as never,
      fssai_registration_no: '',
      ngo_darpan_id: '',
      address: '',
      service_radius_km: 10,
      max_capacity_servings: undefined,
      diet_accepted: '' as never,
      accepted_categories: [],
      has_vehicle: false,
      has_storage: false,
      has_reheating: false,
      operating_hours: DEFAULT_HOURS,
      verification_doc_path: null,
    },
  });

  const submit = useMutation({
    mutationFn: api.onboarding,
    onSuccess: async (res) => {
      setSignupPrefill(null);
      await refreshMe();
      if (res && res.onboarded) navigate(homeFor(res.user, true), { replace: true });
      else navigate(role === 'receiver' ? '/pending' : '/donor', { replace: true });
    },
  });

  const onSubmit = async () => {
    const personOk = await personForm.trigger();
    const profileForm = role === 'donor' ? donorForm : receiverForm;
    const profileOk = await (profileForm as typeof donorForm | typeof receiverForm).trigger();
    if (!personOk || !profileOk || !role) return;
    const person = personSchema.parse(personForm.getValues());
    let profile: DonorProfileInput | ReceiverProfileInput;
    if (role === 'donor') {
      const v = donorProfileSchema.parse(donorForm.getValues());
      profile = { ...v, fssai_license_no: emptyToNull(v.fssai_license_no) };
    } else {
      const v = receiverProfileSchema.parse(receiverForm.getValues());
      profile = {
        ...v,
        ngo_darpan_id: emptyToNull(v.ngo_darpan_id),
        verification_doc_path: v.verification_doc_path ?? null,
        operating_hours: v.operating_hours as OperatingHours,
      };
    }
    submit.mutate({ role, full_name: person.full_name, phone: person.phone, profile });
  };

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <span className="font-heading text-lg font-semibold text-ink">
            Food<span className="text-primary">ResQ</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <ol className="mb-6 flex items-center gap-3 text-sm" aria-label="Progress">
          {['Choose role', 'Profile'].map((label, i) => {
            const active = step === i + 1;
            const done = step > i + 1;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                    active
                      ? 'bg-primary text-white'
                      : done
                        ? 'bg-green text-white'
                        : 'bg-white text-slate ring-1 ring-line',
                  )}
                >
                  {done ? <Check size={14} aria-hidden /> : i + 1}
                </span>
                <span className={active ? 'font-medium text-ink' : 'text-slate'}>{label}</span>
                {i === 0 && <span className="mx-1 h-px w-8 bg-line" aria-hidden />}
              </li>
            );
          })}
        </ol>

        {step === 1 && (
          <div>
            <h1 className="font-heading text-2xl font-semibold text-ink">
              How will you use FoodResQ?
            </h1>
            <p className="mt-1 text-sm text-slate">
              One account has one role. You cannot change it later.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <RoleCard
                role="donor"
                selected={role === 'donor'}
                onSelect={() => setRole('donor')}
              />
              <RoleCard
                role="receiver"
                selected={role === 'receiver'}
                onSelect={() => setRole('receiver')}
              />
            </div>
            <div className="mt-6 flex justify-end">
              <Button size="lg" disabled={!role} onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 2 && role && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit();
            }}
            className="space-y-5"
            noValidate
          >
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowLeft size={16} />}
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <h1 className="font-heading text-2xl font-semibold text-ink">
                {role === 'donor' ? 'Donor profile' : 'Receiver profile'}
              </h1>
            </div>
            <PersonFields form={personForm} />
            {role === 'donor' ? (
              <FormSection
                title="Organisation"
                description="Your default pickup location is prefilled on every donation."
              >
                <DonorProfileFields form={donorForm} />
              </FormSection>
            ) : (
              <ReceiverProfileFields form={receiverForm} />
            )}
            <InlineError error={submit.error} />
            <div className="flex justify-end">
              <Button type="submit" size="lg" loading={submit.isPending}>
                {role === 'donor' ? 'Finish and go to dashboard' : 'Submit for verification'}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
