import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, HandHeart, MessageSquare, Phone, ShieldCheck, Star } from 'lucide-react';
import type { Allocation } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button, buttonClass } from '@/components/ui/Button';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { formatDateTime, formatTime } from '@/lib/format';
import { HandoverEntry } from './HandoverEntry';
import { DisputeModal } from './DisputeModal';

/** One allocation as seen by the Donor (WALKTHROUGH §5.5) or Admin. */
export function AllocationCard({
  allocation: a,
  donationId,
  mode = 'donor',
  onOverride,
}: {
  allocation: Allocation;
  donationId: string;
  mode?: 'donor' | 'admin';
  onOverride?: (a: Allocation) => void;
}) {
  const [chat, setChat] = useState(false);
  const [dispute, setDispute] = useState(false);
  const locked = a.handover_attempts >= 5;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <HandHeart size={18} aria-hidden />
          </span>
          <div>
            <p className="font-medium text-ink">{a.receiver_org_name}</p>
            <p className="text-sm text-slate">
              {a.servings} servings
              {a.status === 'ACCEPTED' && <> · ETA about {formatTime(a.eta_at)}</>}
              {a.collected_at && <> · Collected {formatTime(a.collected_at)}</>}
            </p>
          </div>
        </div>
        <StatusBadge kind="allocation" status={a.status} />
      </div>

      {a.status === 'COMPLETED' && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Distributed {a.servings_distributed ?? '—'} servings
          {a.distribution_area ? ` · ${a.distribution_area}` : ''}
          {a.completion_unconfirmed && ' (auto-completed, unconfirmed)'}
        </p>
      )}
      {a.status === 'CANCELLED' && a.cancel_reason && (
        <p className="mt-3 text-sm text-slate">Cancelled: {a.cancel_reason}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {a.receiver_phone &&
          (a.status === 'ACCEPTED' || a.status === 'COLLECTED' || mode === 'admin') && (
            <a href={`tel:${a.receiver_phone}`} className={buttonClass('secondary', 'sm')}>
              <Phone size={14} aria-hidden /> Call {a.receiver_phone}
            </a>
          )}
        {mode === 'donor' && a.status !== 'CANCELLED' && a.status !== 'NO_SHOW' && (
          <Button
            size="sm"
            variant="secondary"
            icon={<MessageSquare size={14} />}
            onClick={() => setChat((v) => !v)}
            aria-expanded={chat}
          >
            {chat ? 'Hide chat' : 'Chat'}
          </Button>
        )}
        {mode === 'donor' && a.status === 'COMPLETED' && !a.feedback_submitted_by_me && (
          <Link to={`/allocations/${a.id}/feedback`} className={buttonClass('primary', 'sm')}>
            <Star size={14} aria-hidden /> Give feedback
          </Link>
        )}
        {mode === 'donor' && a.status === 'COMPLETED' && a.feedback_submitted_by_me && (
          <Link to={`/allocations/${a.id}/feedback`} className={buttonClass('ghost', 'sm')}>
            View feedback
          </Link>
        )}
        {mode === 'donor' && a.status !== 'CANCELLED' && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Flag size={14} />}
            onClick={() => setDispute(true)}
          >
            Raise dispute
          </Button>
        )}
        {mode === 'admin' && a.status === 'ACCEPTED' && onOverride && (
          <Button
            size="sm"
            variant="purple"
            icon={<ShieldCheck size={14} />}
            onClick={() => onOverride(a)}
          >
            Override collect
          </Button>
        )}
      </div>

      {mode === 'donor' && a.status === 'ACCEPTED' && (
        <div className="mt-3">
          {locked ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              Handover entry is locked after 5 wrong attempts. The FoodResQ team has been notified.
            </p>
          ) : (
            <HandoverEntry allocationId={a.id} donationId={donationId} />
          )}
        </div>
      )}
      {mode === 'admin' && (
        <p className="mt-2 text-xs text-slate">
          Accepted {formatDateTime(a.accepted_at)} · handover attempts {a.handover_attempts}/5
        </p>
      )}

      {chat && (
        <div className="mt-3">
          <ChatPanel allocation={a} otherPartyName={a.receiver_org_name} />
        </div>
      )}
      <DisputeModal allocationId={a.id} open={dispute} onClose={() => setDispute(false)} />
    </div>
  );
}
