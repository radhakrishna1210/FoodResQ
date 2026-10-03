import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { useHandover } from '@/hooks/queries';
import { Button } from '@/components/ui/Button';
import { InlineError } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';

/** Donor enters the Receiver's 4-digit code → COLLECTED. 5 attempts, then locked (server-enforced). */
export function HandoverEntry({
  allocationId,
  donationId,
}: {
  allocationId: string;
  donationId: string;
}) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const handover = useHandover(donationId);
  const toast = useToast();
  const code = digits.join('');

  const setAt = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 3) refs.current[i + 1]?.focus();
  };
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (t.length) {
      e.preventDefault();
      setDigits([0, 1, 2, 3].map((i) => t[i] ?? ''));
      refs.current[Math.min(t.length, 3)]?.focus();
    }
  };

  const submit = () => {
    handover.mutate(
      { allocationId, code },
      {
        onSuccess: () => {
          toast({
            title: 'Collected',
            body: 'Handover confirmed. Thank you for rescuing this food!',
            tone: 'success',
          });
          setDigits(['', '', '', '']);
        },
        onError: () => {
          setDigits(['', '', '', '']);
          refs.current[0]?.focus();
        },
      },
    );
  };

  return (
    <div className="rounded-lg border border-primary/25 bg-primary-50/50 p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <KeyRound size={16} className="text-primary" aria-hidden /> Enter handover code
      </p>
      <p className="mt-0.5 text-xs text-slate">Ask the Receiver to show their 4-digit code.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-2" role="group" aria-label="Handover code">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
              onPaste={onPaste}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              aria-label={`Digit ${i + 1}`}
              className="h-12 w-11 rounded-lg border border-line bg-white text-center font-heading text-xl font-semibold tabular-nums focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />
          ))}
        </div>
        <Button onClick={submit} disabled={code.length !== 4} loading={handover.isPending}>
          Confirm collection
        </Button>
      </div>
      {handover.isError && (
        <div className="mt-2">
          <InlineError error={handover.error} />
        </div>
      )}
    </div>
  );
}
