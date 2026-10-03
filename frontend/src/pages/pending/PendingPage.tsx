import { Ban, Hourglass, PencilLine, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ButtonLink } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ReceiverProfile } from '@/types';

export default function PendingPage() {
  const { user, profile } = useAuth();
  const rp = profile as ReceiverProfile | null;
  const status = user?.account_status ?? 'pending_verification';

  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="card overflow-hidden">
        <div
          className={
            status === 'rejected'
              ? 'h-1.5 bg-red'
              : status === 'suspended'
                ? 'h-1.5 bg-expired'
                : 'h-1.5 bg-gold'
          }
        />
        <div className="p-6 text-center sm:p-8">
          <div
            className={
              'mx-auto flex h-14 w-14 items-center justify-center rounded-full ' +
              (status === 'rejected'
                ? 'bg-red-50 text-red'
                : status === 'suspended'
                  ? 'bg-slate-50 text-expired'
                  : 'bg-gold-50 text-gold')
            }
          >
            {status === 'rejected' ? (
              <XCircle size={28} />
            ) : status === 'suspended' ? (
              <Ban size={28} />
            ) : (
              <Hourglass size={28} />
            )}
          </div>
          <div className="mt-4 flex justify-center">
            <StatusBadge kind="account" status={status} />
          </div>
          {status === 'rejected' ? (
            <>
              <h1 className="mt-3 font-heading text-xl font-semibold text-ink">
                Verification was not approved
              </h1>
              <p className="mt-2 text-sm text-slate">
                The FoodResQ team could not verify your organisation.
              </p>
              {rp?.rejection_reason && (
                <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-left text-sm text-red-700 ring-1 ring-inset ring-red/20">
                  <p className="font-medium">Reason</p>
                  <p className="mt-0.5">{rp.rejection_reason}</p>
                </div>
              )}
              <ButtonLink to="/receiver/profile" className="mt-6" icon={<PencilLine size={16} />}>
                Edit profile and resubmit
              </ButtonLink>
            </>
          ) : status === 'suspended' ? (
            <>
              <h1 className="mt-3 font-heading text-xl font-semibold text-ink">
                Your account is suspended
              </h1>
              <p className="mt-2 text-sm text-slate">Contact FoodResQ to resolve this.</p>
            </>
          ) : (
            <>
              <h1 className="mt-3 font-heading text-xl font-semibold text-ink">
                Verification pending
              </h1>
              <p className="mt-2 text-sm text-slate">
                Thanks! The FoodResQ team is verifying your organisation. You&apos;ll be notified
                when you can start receiving food.
              </p>
              <ButtonLink
                to="/receiver/profile"
                variant="secondary"
                className="mt-6"
                icon={<PencilLine size={16} />}
              >
                Review your profile
              </ButtonLink>
            </>
          )}
        </div>
      </div>
      {rp && (
        <dl className="card mt-4 divide-y divide-line px-5 text-sm">
          <div className="flex justify-between py-3">
            <dt className="text-slate">Organisation</dt>
            <dd className="font-medium text-ink">{rp.org_name}</dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="text-slate">FSSAI registration no.</dt>
            <dd className="font-medium tabular-nums text-ink">{rp.fssai_registration_no}</dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="text-slate">Verification document</dt>
            <dd className="font-medium text-ink">
              {rp.verification_doc_path ? 'Uploaded' : 'Not uploaded'}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
