import { useState } from 'react';
import { useDeclineOffer } from '@/hooks/queries';
import { DECLINE_REASON_LABELS } from '@/lib/labels';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { InlineError } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import type { DeclineReasonCode } from '@/types';

export const DECLINE_CODES: DeclineReasonCode[] = [
  'no_capacity',
  'too_far',
  'no_vehicle_now',
  'food_type',
  'other',
];

/** Decline with reason picker (ARCHITECTURE §7.10). UI label for DECLINED is "Rejected". */
export function DeclineModal({
  offerId,
  open,
  onClose,
  onDeclined,
}: {
  offerId: string;
  open: boolean;
  onClose: () => void;
  onDeclined?: () => void;
}) {
  const [reason, setReason] = useState<DeclineReasonCode | null>(null);
  const [note, setNote] = useState('');
  const decline = useDeclineOffer();
  const toast = useToast();

  const submit = () => {
    if (!reason) return;
    decline.mutate(
      { id: offerId, reason, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast({
            title: 'Offer declined',
            body: 'Thanks for letting us know. We will offer it to the next Receiver.',
          });
          onClose();
          onDeclined?.();
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Decline this offer?"
      description="The food will be offered to the next-best Receiver. Your reason is not shown to the Donor."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Back
          </Button>
          <Button variant="danger" onClick={submit} disabled={!reason} loading={decline.isPending}>
            Decline offer
          </Button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-ink">Reason</legend>
        {DECLINE_CODES.map((code) => (
          <label
            key={code}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
              reason === code
                ? 'border-primary bg-primary-50'
                : 'border-line hover:border-slate/40',
            )}
          >
            <input
              type="radio"
              name="decline-reason"
              value={code}
              checked={reason === code}
              onChange={() => setReason(code)}
              className="accent-[#1B70BE]"
            />
            {DECLINE_REASON_LABELS[code]}
          </label>
        ))}
      </fieldset>
      <Field label="Note" htmlFor="decline-note" hint="Optional" className="mt-4">
        <Input
          id="decline-note"
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <div className="mt-3">
        <InlineError error={decline.error} />
      </div>
    </Modal>
  );
}
