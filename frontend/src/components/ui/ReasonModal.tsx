import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Field, Textarea } from './Form';
import { InlineError } from './ErrorState';

/** Generic "reason required" confirmation dialog (cancel, reject, suspend…). */
export function ReasonModal({
  open,
  onClose,
  title,
  description,
  label = 'Reason',
  confirmLabel,
  variant = 'danger',
  minLength = 3,
  loading,
  error,
  onConfirm,
  warning,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  label?: string;
  confirmLabel: string;
  variant?: 'danger' | 'primary' | 'purple';
  minLength?: number;
  loading?: boolean;
  error?: unknown;
  onConfirm: (reason: string) => void;
  warning?: ReactNode;
}) {
  const [reason, setReason] = useState('');
  const ok = reason.trim().length >= minLength;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Back
          </Button>
          <Button
            variant={variant}
            disabled={!ok}
            loading={loading}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {warning && (
          <p className="rounded-lg bg-gold-50 px-3 py-2 text-sm text-gold-700 ring-1 ring-inset ring-gold/25">
            {warning}
          </p>
        )}
        <Field label={label} htmlFor="reason-input" required>
          <Textarea
            id="reason-input"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <InlineError error={error} />
      </div>
    </Modal>
  );
}
