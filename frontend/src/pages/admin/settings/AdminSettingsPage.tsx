import { useEffect, useState } from 'react';
import { Brain, CheckCircle2, Save, Settings, XCircle } from 'lucide-react';
import { useAdminConfig, useUpdateConfig } from '@/hooks/queries';
import { FACTOR_LABELS, FACTOR_ORDER } from '@/lib/labels';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorState, InlineError } from '@/components/ui/ErrorState';
import { PageSpinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/misc';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import type { AppConfig, JevWeights } from '@/types';

/** Server rejects weight sets that do not sum to 1.00 (±0.001) — ARCHITECTURE §7.5. */
export const weightsSum = (w: JevWeights) =>
  FACTOR_ORDER.reduce((s, f) => s + (Number(w[f]) || 0), 0);
export const weightsValid = (w: JevWeights) => Math.abs(weightsSum(w) - 1) <= 0.001;

function WeightSet({
  title,
  value,
  onChange,
}: {
  title: string;
  value: JevWeights;
  onChange: (w: JevWeights) => void;
}) {
  const sum = weightsSum(value);
  const ok = weightsValid(value);
  return (
    <Card>
      <CardHeader
        title={title}
        icon={<Brain size={18} className="text-purple" />}
        action={
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ring-1 ring-inset',
              ok
                ? 'bg-green-50 text-green-700 ring-green/25'
                : 'bg-red-50 text-red-700 ring-red/25',
            )}
            role="status"
            data-testid="weights-sum"
          >
            {ok ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}
            sum = {sum.toFixed(2)}
          </span>
        }
      />
      <CardBody className="space-y-3">
        {FACTOR_ORDER.map((f) => (
          <div key={f} className="grid grid-cols-[110px_1fr_72px] items-center gap-3">
            <label htmlFor={`${title}-${f}`} className="text-sm font-medium text-ink">
              {FACTOR_LABELS[f]}
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={value[f] ?? 0}
              onChange={(e) => onChange({ ...value, [f]: Number(e.target.value) })}
              className="accent-[#715BB0]"
              aria-label={`${FACTOR_LABELS[f]} weight slider`}
            />
            <input
              id={`${title}-${f}`}
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={value[f] ?? 0}
              onChange={(e) => onChange({ ...value, [f]: Number(e.target.value) })}
              className="h-9 rounded-lg border border-line px-2 text-right text-sm tabular-nums focus:border-purple focus:outline-none focus:ring-4 focus:ring-purple/15"
            />
          </div>
        ))}
        {!ok && (
          <p className="text-xs text-red-700">Weights must add up to 1.00 before you can save.</p>
        )}
      </CardBody>
    </Card>
  );
}

const TIMING_KEYS: Array<{ key: keyof AppConfig; label: string; step?: number }> = [
  { key: 'consumption_buffer_minutes', label: 'Consumption buffer (min)' },
  { key: 'min_rescue_window_minutes', label: 'Minimum rescue window (min)' },
  { key: 'packaged_expiry_buffer_hours', label: 'Packaged expiry buffer (h)' },
  { key: 'no_show_grace_minutes', label: 'No-show grace (min)' },
  { key: 'feedback_window_hours', label: 'Feedback window (h)' },
  { key: 'auto_complete_hours', label: 'Auto-complete after (h)' },
  { key: 'prep_buffer_minutes', label: 'Prep buffer (min)' },
  { key: 'avg_speed_kmph', label: 'Average speed (km/h)' },
  { key: 'road_factor', label: 'Road factor', step: 0.1 },
  { key: 'offer_timeout_fraction', label: 'Offer timeout fraction', step: 0.01 },
  { key: 'high_priority_batch_size', label: 'HIGH priority batch size' },
];

export default function AdminSettingsPage() {
  const { data, isLoading, isError, error, refetch } = useAdminConfig();
  const update = useUpdateConfig();
  const toast = useToast();
  const [cfg, setCfg] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (data && !cfg) setCfg(data);
  }, [data, cfg]);

  if (isLoading || (!cfg && !isError)) return <PageSpinner />;
  if (isError || !cfg) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const valid = weightsValid(cfg.jev_weights_default) && weightsValid(cfg.jev_weights_high);
  const setNum = (key: keyof AppConfig, v: string) =>
    setCfg({ ...cfg, [key]: Number(v) } as AppConfig);

  const save = () =>
    update.mutate(cfg, {
      onSuccess: (res) => {
        if (res) setCfg(res);
        toast({
          title: 'Settings saved',
          body: 'New values apply to the next match run.',
          tone: 'success',
        });
      },
    });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Settings size={20} className="text-purple" />}
        title="JEV settings"
        subtitle="Weights and timing constants from app_config. Changes apply to future match runs only."
        actions={
          <Button
            variant="purple"
            icon={<Save size={16} />}
            onClick={save}
            disabled={!valid}
            loading={update.isPending}
          >
            Save settings
          </Button>
        }
      />
      <InlineError error={update.error} />
      <div className="grid gap-6 lg:grid-cols-2">
        <WeightSet
          title="Default weights (MEDIUM / LOW)"
          value={cfg.jev_weights_default}
          onChange={(w) => setCfg({ ...cfg, jev_weights_default: w })}
        />
        <WeightSet
          title="HIGH-priority weights"
          value={cfg.jev_weights_high}
          onChange={(w) => setCfg({ ...cfg, jev_weights_high: w })}
        />
      </div>
      <Card>
        <CardHeader
          title="Timing constants"
          subtitle="Conservative product defaults. Review with a food-safety expert before a pilot."
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TIMING_KEYS.map(({ key, label, step }) => (
              <label key={key} className="text-sm">
                <span className="font-medium text-ink">{label}</span>
                <input
                  type="number"
                  step={step ?? 1}
                  value={Number(cfg[key] ?? 0)}
                  onChange={(e) => setNum(key, e.target.value)}
                  className="mt-1 block h-10 w-full rounded-lg border border-line px-3 tabular-nums focus:border-purple focus:outline-none focus:ring-4 focus:ring-purple/15"
                />
              </label>
            ))}
            {(['hot_held', 'room_temp', 'room_temp_hot_ambient', 'refrigerated'] as const).map(
              (k) => (
                <label key={k} className="text-sm">
                  <span className="font-medium text-ink">Safe window: {k} (h)</span>
                  <input
                    type="number"
                    step={0.5}
                    value={cfg.safe_window_hours?.[k] ?? 0}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        safe_window_hours: {
                          ...cfg.safe_window_hours,
                          [k]: Number(e.target.value),
                        },
                      })
                    }
                    className="mt-1 block h-10 w-full rounded-lg border border-line px-3 tabular-nums focus:border-purple focus:outline-none focus:ring-4 focus:ring-purple/15"
                  />
                </label>
              ),
            )}
          </div>
          <dl className="mt-5 grid gap-2 text-sm text-slate sm:grid-cols-3">
            <div>
              Search radius steps:{' '}
              <span className="font-medium text-ink">
                {(cfg.search_radius_steps_km ?? []).join(' → ')} km
              </span>
            </div>
            <div>
              Offer timeout:{' '}
              <span className="font-medium text-ink">
                {(cfg.offer_timeout_min_max ?? []).join('–')} min
              </span>
            </div>
            <div>
              Priority thresholds:{' '}
              <span className="font-medium text-ink">
                HIGH ≥ {cfg.priority_thresholds?.high} · MEDIUM ≥ {cfg.priority_thresholds?.medium}
              </span>
            </div>
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
