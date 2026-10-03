import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogOut, Save, Settings, ShieldPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  useDonorProfile,
  useUpdateDonorProfile,
  useUpdateMe,
  useAdminMutation,
} from '@/hooks/queries';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  donorProfileSchema,
  emptyToNull,
  personSchema,
  phoneSchema,
  type DonorProfileValues,
} from '@/lib/schemas';
import { ROLE_LABEL } from './roleLabel';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { InlineError } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/misc';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { DonorProfileFields, FormSection } from '@/components/profile/ProfileFields';

function AccountForm() {
  const { user, refreshMe } = useAuth();
  const update = useUpdateMe();
  const toast = useToast();
  const form = useForm<z.input<typeof personSchema>>({
    resolver: zodResolver(personSchema),
    defaultValues: { full_name: user?.full_name ?? '', phone: user?.phone ?? '' },
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = form;
  return (
    <FormSection title="Account" description={user?.email}>
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit((v) =>
          update.mutate(v, {
            onSuccess: async () => {
              toast({ title: 'Account updated', tone: 'success' });
              await refreshMe();
              form.reset(v);
            },
          }),
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="acc-name" error={errors.full_name?.message} required>
            <Input id="acc-name" invalid={!!errors.full_name} {...register('full_name')} />
          </Field>
          <Field label="Mobile number" htmlFor="acc-phone" error={errors.phone?.message} required>
            <Input
              id="acc-phone"
              inputMode="numeric"
              maxLength={10}
              invalid={!!errors.phone}
              {...register('phone')}
            />
          </Field>
        </div>
        <InlineError error={update.error} />
        <div className="flex justify-end">
          <Button
            type="submit"
            icon={<Save size={16} />}
            loading={update.isPending}
            disabled={!isDirty}
          >
            Save
          </Button>
        </div>
      </form>
    </FormSection>
  );
}

function DonorProfileSection() {
  const { data, isLoading } = useDonorProfile();
  const update = useUpdateDonorProfile();
  const toast = useToast();
  const form = useForm<DonorProfileValues>({ resolver: zodResolver(donorProfileSchema) });
  useEffect(() => {
    if (data)
      form.reset({
        org_name: data.org_name,
        donor_type: data.donor_type,
        fssai_license_no: data.fssai_license_no ?? '',
        address: data.address,
        lat: data.lat,
        lng: data.lng,
      });
  }, [data, form]);
  if (isLoading || !data) return null;
  return (
    <FormSection
      title="Organisation profile"
      description={
        data.is_verified
          ? 'Verified by FoodResQ'
          : 'Your default pickup location is prefilled on every donation.'
      }
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={form.handleSubmit(() => {
          const v = donorProfileSchema.parse(form.getValues());
          update.mutate(
            { ...v, fssai_license_no: emptyToNull(v.fssai_license_no) },
            { onSuccess: () => toast({ title: 'Profile saved', tone: 'success' }) },
          );
        })}
      >
        <DonorProfileFields form={form} />
        <InlineError error={update.error} />
        <div className="flex justify-end">
          <Button type="submit" icon={<Save size={16} />} loading={update.isPending}>
            Save profile
          </Button>
        </div>
      </form>
    </FormSection>
  );
}

const newAdminSchema = z.object({
  user_id: z.string().trim().uuid('Enter the Supabase Auth user ID'),
  email: z.string().trim().email('Enter a valid email'),
  full_name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
});

function CreateAdminSection() {
  const toast = useToast();
  const create = useAdminMutation((v: z.output<typeof newAdminSchema>) => api.adminCreateAdmin(v));
  const [v, setV] = useState({ user_id: '', email: '', full_name: '', phone: '' });
  const parsed = newAdminSchema.safeParse(v);
  return (
    <FormSection
      title="Create another Admin"
      description="Admin accounts are never created through public signup. Create the login in Supabase Auth first, then paste its user ID here."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supabase Auth user ID" htmlFor="na-uid">
          <Input
            id="na-uid"
            value={v.user_id}
            onChange={(e) => setV({ ...v, user_id: e.target.value })}
          />
        </Field>
        <Field label="Email" htmlFor="na-email">
          <Input
            id="na-email"
            type="email"
            value={v.email}
            onChange={(e) => setV({ ...v, email: e.target.value })}
          />
        </Field>
        <Field label="Full name" htmlFor="na-name">
          <Input
            id="na-name"
            value={v.full_name}
            onChange={(e) => setV({ ...v, full_name: e.target.value })}
          />
        </Field>
        <Field label="Mobile" htmlFor="na-phone">
          <Input
            id="na-phone"
            inputMode="numeric"
            maxLength={10}
            value={v.phone}
            onChange={(e) => setV({ ...v, phone: e.target.value })}
          />
        </Field>
      </div>
      <InlineError error={create.error} />
      <div className="flex justify-end">
        <Button
          variant="purple"
          icon={<ShieldPlus size={16} />}
          disabled={!parsed.success}
          loading={create.isPending}
          onClick={() =>
            parsed.success &&
            create.mutate(parsed.data, {
              onSuccess: () => {
                toast({ title: 'Admin created', tone: 'success' });
                setV({ user_id: '', email: '', full_name: '', phone: '' });
              },
            })
          }
        >
          Create Admin
        </Button>
      </div>
    </FormSection>
  );
}

export default function SettingsPage() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        icon={<Settings size={20} />}
        title="Account settings"
        subtitle={role ? `${ROLE_LABEL[role]} account · role cannot be changed` : undefined}
        actions={user && <StatusBadge kind="account" status={user.account_status} />}
      />
      <AccountForm />
      {role === 'donor' && <DonorProfileSection />}
      {role === 'admin' && <CreateAdminSection />}
      <div className="flex justify-end">
        <Button
          variant="secondary"
          className="text-red-700"
          icon={<LogOut size={16} />}
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
        >
          Log out
        </Button>
      </div>
    </div>
  );
}
