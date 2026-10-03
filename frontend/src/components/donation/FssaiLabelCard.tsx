import { FileText } from 'lucide-react';
import type { DietType } from '@/types';
import { DietDot } from '@/components/ui/misc';
import { formatDateTime } from '@/lib/format';

/** FSSAI label card — Section 6(3) fields (README §11). */
export function FssaiLabelCard({
  title,
  source,
  preparedAt,
  lastConsumptionAt,
  diet,
  allergens,
}: {
  title: string;
  source: string;
  preparedAt?: string | null;
  lastConsumptionAt?: string | null;
  diet: DietType;
  allergens?: string | null;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-dashed border-line bg-bg px-4 py-2.5">
        <FileText size={16} className="text-slate" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate">
          Food label (FSSAI)
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
        <div className="col-span-2">
          <dt className="text-xs text-slate">Name of food</dt>
          <dd className="font-medium text-ink">{title}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-slate">Source</dt>
          <dd className="font-medium text-ink">{source}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate">Prepared at</dt>
          <dd className="font-medium tabular-nums text-ink">{formatDateTime(preparedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate">Last time of consumption</dt>
          <dd className="font-medium tabular-nums text-ink">{formatDateTime(lastConsumptionAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate">Veg / Egg / Non-veg</dt>
          <dd className="mt-0.5">
            <DietDot diet={diet} withLabel />
          </dd>
        </div>
        {allergens && (
          <div>
            <dt className="text-xs text-slate">Allergens</dt>
            <dd className="font-medium text-ink">{allergens}</dd>
          </div>
        )}
      </dl>
      <p className="border-t border-line px-4 py-2 text-[11px] text-slate">
        Conservative product defaults, not food-safety certification.
      </p>
    </div>
  );
}
