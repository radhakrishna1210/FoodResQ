import { useState } from 'react';
import { useRaiseDispute } from '@/hooks/queries';
import { DISPUTE_REASON_LABELS } from '@/lib/labels';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/Form';
import { InlineError } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import type { DisputeReason } from '@/types';

const REASONS = Object.keys(DISPUTE_REASON_LABELS) as DisputeReason[];

export function DisputeModal({
  allocationId,
  open,
  onClose,
}: {
  allocationId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<DisputeReason | ''>('');
  const [description, setDescription] = useState('');
  const dispute = useRaiseDispute();
  const toast = useToast();
  const valid =
    reason !== '' && description.trim().length >= 10 && description.trim().length <= 1000;

  const submit = () => {
    if (!valid || !reason) return;
    dispute.mutate(
      { allocationId, reason, description: description.trim() },
      {
        onSuccess: () => {
          toast({
            title: 'Dispute raised',
            body: 'The FoodResQ team will review it.',
            tone: 'success',
          });
          setReason('');
          setDescription('');
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Raise a dispute"
      description="Tell the FoodResQ team what went wrong with this pickup."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} disabled={!valid} loading={dispute.isPending}>
            Raise dispute
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Reason" htmlFor="dispute-reason" required>
          <Select
            id="dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as DisputeReason)}
          >
            <option value="" disabled>
              Choose…
            </option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {DISPUTE_REASON_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="What happened?" htmlFor="dispute-desc" hint="10–1000 characters" required>
          <Textarea
            id="dispute-desc"
            rows={4}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <InlineError error={dispute.error} />
      </div>
    </Modal>
  );
}
