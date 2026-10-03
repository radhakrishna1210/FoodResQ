import { useState } from 'react';
import { useCompleteAllocation } from '@/hooks/queries';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { InlineError } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';

export function ConfirmDistributionModal({
  allocationId,
  servings,
  open,
  onClose,
}: {
  allocationId: string;
  servings: number;
  open: boolean;
  onClose: () => void;
}) {
  const [count, setCount] = useState(String(servings));
  const [area, setArea] = useState('');
  const complete = useCompleteAllocation(allocationId);
  const toast = useToast();
  const n = Number(count);
  const valid = Number.isInteger(n) && n >= 0 && n <= servings && area.trim().length >= 2;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm distribution"
      description="Tell us how many servings reached people and where. This completes the rescue."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Back
          </Button>
          <Button
            variant="success"
            disabled={!valid}
            loading={complete.isPending}
            onClick={() =>
              complete.mutate(
                { servings_distributed: n, distribution_area: area.trim() },
                {
                  onSuccess: () => {
                    toast({
                      title: 'Rescue completed',
                      body: 'Thank you! Please leave feedback for the Donor.',
                      tone: 'success',
                    });
                    onClose();
                  },
                },
              )
            }
          >
            Confirm distribution
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Servings distributed"
          htmlFor="servings-distributed"
          hint={`Up to ${servings}`}
          required
        >
          <Input
            id="servings-distributed"
            type="number"
            min={0}
            max={servings}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </Field>
        <Field
          label="Distribution area"
          htmlFor="distribution-area"
          hint='e.g. "Shelter, Market Yard"'
          required
        >
          <Input
            id="distribution-area"
            maxLength={200}
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </Field>
        <InlineError error={complete.error} />
      </div>
    </Modal>
  );
}
