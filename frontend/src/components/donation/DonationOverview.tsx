import type { ReactNode } from 'react';
import { MapPin, Phone } from 'lucide-react';
import type { Allocation, DonationDetail } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { Countdown } from '@/components/ui/Countdown';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DietDot, InfoRow } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/EmptyState';
import { AllocationCard } from '@/components/allocation/AllocationCard';
import { FOOD_CATEGORY_LABELS, STORAGE_LABELS } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';
import { FssaiLabelCard } from './FssaiLabelCard';
import { Timeline } from './Timeline';
import { MatchingPanel } from './MatchingPanel';

const LIVE = new Set(['POSTED', 'MATCHED', 'ACCEPTED', 'FLAGGED']);

export function DonationHeader({ d, actions }: { d: DonationDetail; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink">{d.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={d.status} />
          <PriorityBadge level={d.priority_level} />
          {LIVE.has(d.status) && (
            <Countdown deadline={d.effective_deadline} prefix="Pickup by" showTime size="lg" />
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Body shared by the Donor detail page and the Admin donation page. */
export function DonationOverview({
  d,
  mode = 'donor',
  onOverride,
  sideExtra,
}: {
  d: DonationDetail;
  mode?: 'donor' | 'admin';
  onOverride?: (a: Allocation) => void;
  sideExtra?: ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <MatchingPanel donation={d} />
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-ink">Allocations</h2>
          {d.allocations.length === 0 ? (
            <EmptyState
              title="No Receiver yet"
              body={
                d.status === 'FLAGGED'
                  ? 'Matching starts after the FoodResQ team approves this post.'
                  : 'When a Receiver accepts, they appear here with their ETA.'
              }
            />
          ) : (
            <div className="space-y-3">
              {d.allocations.map((a) => (
                <AllocationCard
                  key={a.id}
                  allocation={a}
                  donationId={d.id}
                  mode={mode}
                  onOverride={onOverride}
                />
              ))}
            </div>
          )}
          {d.expired_servings > 0 && (
            <p className="text-sm text-slate">
              {d.expired_servings} servings expired before they could be matched.
            </p>
          )}
        </section>
        <Card>
          <CardHeader title="Details" />
          <CardBody className="py-2">
            <dl className="divide-y divide-line">
              <InfoRow label="Servings">
                {d.quantity_servings}
                {d.quantity_kg ? ` (${d.quantity_kg} kg)` : ''}
              </InfoRow>
              <InfoRow label="Remaining to match">{d.remaining_servings}</InfoRow>
              <InfoRow label="Category">{FOOD_CATEGORY_LABELS[d.food_category]}</InfoRow>
              <InfoRow label="Diet">
                <DietDot diet={d.diet_type} withLabel />
              </InfoRow>
              <InfoRow label="Storage">
                {STORAGE_LABELS[d.storage_condition]}
                {d.storage_condition === 'room_temp' && d.ambient_above_32c ? ' (above 32 °C)' : ''}
              </InfoRow>
              <InfoRow label="Pickup by">{formatDateTime(d.effective_deadline)}</InfoRow>
              <InfoRow label="Posted">{formatDateTime(d.posted_at)}</InfoRow>
              {d.cancel_reason && <InfoRow label="Cancel reason">{d.cancel_reason}</InfoRow>}
            </dl>
            {d.description && (
              <p className="border-t border-line py-3 text-sm text-slate">{d.description}</p>
            )}
          </CardBody>
        </Card>
        {d.photo_urls?.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {d.photo_urls.map((u) => (
              <img
                key={u}
                src={u}
                alt={`Photo of ${d.title}`}
                className="h-32 w-32 rounded-card border border-line object-cover"
              />
            ))}
          </div>
        )}
      </div>
      <aside className="space-y-6">
        <FssaiLabelCard
          title={d.title}
          source={d.donor_org_name}
          preparedAt={d.prepared_at}
          lastConsumptionAt={d.last_consumption_at}
          diet={d.diet_type}
          allergens={d.allergens}
        />
        <Card>
          <CardHeader title="Timeline" />
          <CardBody>
            <Timeline entries={d.timeline ?? []} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Pickup" />
          <CardBody className="space-y-2 text-sm">
            <p className="flex items-start gap-2 text-ink">
              <MapPin size={16} className="mt-0.5 shrink-0 text-slate" aria-hidden />
              {d.pickup_address}
            </p>
            {d.pickup_instructions && <p className="pl-6 text-slate">{d.pickup_instructions}</p>}
            <p className="flex items-center gap-2 text-ink">
              <Phone size={16} className="text-slate" aria-hidden /> {d.contact_phone}
            </p>
          </CardBody>
        </Card>
        {sideExtra}
      </aside>
    </div>
  );
}
