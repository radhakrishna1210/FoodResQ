import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Save, UserCog } from 'lucide-react';
import { useReceiverProfile, useUpdateReceiverProfile } from '@/hooks/queries';
import { useAuth } from '@/lib/auth';
import { emptyToNull, receiverProfileSchema, type ReceiverProfileValues } from '@/lib/schemas';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState, InlineError } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/misc';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { ReceiverProfileFields } from '@/components/profile/ProfileFields';
import type { OperatingHours, ReceiverProfile, ReceiverProfileInput } from '@/types';

function toValues(p: ReceiverProfile): ReceiverProfileValues {
  return {
    org_name: p.org_name,
    receiver_type: p.receiver_type,
    fssai_registration_no: p.fssai_registration_no,
    ngo_darpan_id: p.ngo_darpan_id ?? '',
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    service_radius_km: Number(p.service_radius_km),
    max_capacity_servings: p.max_capacity_servings,
    diet_accepted: p.diet_accepted,
    accepted_categories: p.accepted_categories,
    has_vehicle: p.has_vehicle,
    has_storage: p.has_storage,
    has_reheating: p.has_reheating,
    operating_hours: p.operating_hours,
    verification_doc_path: p.verification_doc_path,
  };
}

export default function ReceiverProfilePage() {
  const { data: profile, isLoading, isError, error, refetch } = useReceiverProfile();
  const { user, refreshMe } = useAuth();
  const update = useUpdateReceiverProfile();
  const toast = useToast();
  const form = useForm<ReceiverProfileValues>({ resolver: zodResolver(receiverProfileSchema) });

  useEffect(() => {
    if (profile) form.reset(toValues(profile));
  }, [profile, form]);

  if (isLoading) return <PageSpinner />;
  if (isError || !profile) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const onSubmit = form.handleSubmit(() => {
    const v = receiverProfileSchema.parse(form.getValues());
    const body: Partial<ReceiverProfileInput> = {
      ...v,
      ngo_darpan_id: emptyToNull(v.ngo_darpan_id),
      verification_doc_path: v.verification_doc_path ?? null,
      operating_hours: v.operating_hours as OperatingHours,
    };
    update.mutate(body, {
      onSuccess: async () => {
        toast({ title: 'Profile saved', tone: 'success' });
        await refreshMe();
      },
    });
  });

  const resetsVerification =
    form.watch('fssai_registration_no') !== profile.fssai_registration_no ||
    form.watch('address') !== profile.address;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={<UserCog size={20} className="text-teal-700" />}
        title="Organisation profile"
        subtitle="Capacity, food types, hours and service area decide which offers you receive."
        actions={user && <StatusBadge kind="account" status={user.account_status} />}
      />
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <ReceiverProfileFields form={form} />
        {resetsVerification && user?.account_status === 'active' && (
          <p
            className="flex items-start gap-2 rounded-lg bg-gold-50 px-4 py-3 text-sm text-gold-700 ring-1 ring-inset ring-gold/25"
            role="alert"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            Changing your FSSAI registration number or address sends your profile back for
            verification. You won&apos;t receive offers until the FoodResQ team verifies it again.
          </p>
        )}
        <InlineError error={update.error} />
        <div className="flex justify-end">
          <Button type="submit" size="lg" icon={<Save size={18} />} loading={update.isPending}>
            {/* TODO(team): confirm how a rejected Receiver resubmits (ARCHITECTURE only says FSSAI/address edits reset to pending). */}
            {user?.account_status === 'rejected' ? 'Save and resubmit' : 'Save profile'}
          </Button>
        </div>
      </form>
    </div>
  );
}
