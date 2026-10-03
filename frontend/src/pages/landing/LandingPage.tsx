import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock,
  HandHeart,
  KeyRound,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import { usePublicImpact } from '@/hooks/queries';
import { buttonClass } from '@/components/ui/Button';
import { ApiStatus } from '@/components/layout/StatusPills';
import { Skeleton } from '@/components/ui/Spinner';
import { formatNumber } from '@/lib/format';

function Counter({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <div className="rounded-card border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
      {loading ? (
        <Skeleton className="h-8 w-20 bg-white/20" />
      ) : (
        <p className="font-heading text-3xl font-semibold tabular-nums text-white">
          {formatNumber(value ?? 0)}
        </p>
      )}
      <p className="mt-1 text-sm text-white/80">{label}</p>
    </div>
  );
}

const STEPS = [
  {
    icon: Utensils,
    title: 'Donor posts',
    body: 'One form: food, servings, preparation time, storage, pickup deadline, location and a safety checklist.',
    color: 'bg-primary-50 text-primary',
  },
  {
    icon: Brain,
    title: 'JEV matches',
    body: 'Hard filters, then an 8-factor score. The best-fit verified Receiver gets an offer with plain-language reasons.',
    color: 'bg-purple-50 text-purple',
  },
  {
    icon: HandHeart,
    title: 'Receiver collects',
    body: 'The Receiver picks up directly from the Donor. A 4-digit handover code confirms it, so impact is measured.',
    color: 'bg-teal-50 text-teal-700',
  },
];

function StepIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <div className="card relative overflow-hidden p-5 shadow-lift">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
              <Utensils size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Veg pulao and dal</p>
              <p className="text-xs text-slate">120 servings · College A</p>
            </div>
          </div>
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red/25">
            High priority
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-xs text-slate">
          <Clock size={14} className="text-gold" /> Pickup by 10:30 PM · Last time of consumption
          11:00 PM
        </div>
        <div className="mt-4 space-y-2">
          {[
            { name: 'Receiver A', score: 91, note: 'Very close: 1.9 km (about 21 min)', on: true },
            {
              name: 'Receiver B',
              score: 52,
              note: 'Partial fit: can take 50 of 120 servings',
              on: false,
            },
          ].map((r) => (
            <div
              key={r.name}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 ${r.on ? 'border-teal/40 bg-teal-50/60' : 'border-line'}`}
            >
              <div>
                <p className="text-sm font-medium text-ink">{r.name}</p>
                <p className="text-xs text-slate">{r.note}</p>
              </div>
              <p
                className={`font-heading text-xl font-semibold ${r.on ? 'text-teal-700' : 'text-slate'}`}
              >
                {r.score}%
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-ink px-3 py-2.5 text-white">
          <span className="flex items-center gap-2 text-xs">
            <KeyRound size={14} /> Handover code
          </span>
          <span className="font-heading text-lg tracking-[0.4em]">4827</span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const impact = usePublicImpact();
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#124F87] via-primary to-[#1D8FB0]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-purple/30 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:px-8 md:py-20">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/25">
                SDG 2 · Zero Hunger
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/25">
                SDG 12.3 · Halve food waste
              </span>
            </div>
            <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              Surplus food → the right Receiver → rescued in time.
            </h1>
            <p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">
              FoodResQ connects restaurants, hostels and caterers with verified NGOs and shelters.
              Our JEV engine ranks the best-fit Receiver, not just the nearest, and every rescue is
              confirmed with a handover code.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/signup?role=donor"
                className={buttonClass(
                  'secondary',
                  'lg',
                  'border-transparent bg-white text-primary-700 hover:bg-primary-50',
                )}
              >
                <Utensils size={18} aria-hidden /> I have surplus food
              </Link>
              <Link
                to="/signup?role=receiver"
                className={buttonClass('teal', 'lg', 'ring-1 ring-inset ring-white/30')}
              >
                <HandHeart size={18} aria-hidden /> We collect food
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3" aria-live="polite">
              <Counter
                label="Meals rescued"
                value={impact.data?.meals_rescued}
                loading={impact.isLoading}
              />
              <Counter
                label="Rescues completed"
                value={impact.data?.rescues_completed}
                loading={impact.isLoading}
              />
              <Counter
                label="Verified Receivers"
                value={impact.data?.active_receivers}
                loading={impact.isLoading}
              />
            </div>
            {impact.isError && (
              <p className="mt-2 text-xs text-white/70">Live counters are unavailable right now.</p>
            )}
          </div>
          <StepIllustration />
        </div>
      </section>

      {/* 3 steps */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-2xl font-semibold text-ink sm:text-3xl">
            How a rescue works
          </h2>
          <p className="mt-2 text-slate">Three steps, minutes not hours. Every step is tracked.</p>
        </div>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card card-hover relative p-6">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.color}`}
                >
                  <s.icon size={22} aria-hidden />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate">{s.body}</p>
              {i < STEPS.length - 1 && (
                <ArrowRight
                  className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-line md:block"
                  size={28}
                  aria-hidden
                />
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Trust */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-3 md:px-8">
          {[
            {
              icon: ShieldCheck,
              title: 'Verified Receivers only',
              body: 'Every Receiver is checked by the FoodResQ team (FSSAI registration) before they get offers.',
            },
            {
              icon: Clock,
              title: 'Safe pickup deadlines',
              body: 'Conservative time windows based on how food is stored. We support a safer workflow; we never certify food.',
            },
            {
              icon: CheckCircle2,
              title: 'Measured, not estimated',
              body: 'Handover codes, distribution confirmation and FSSAI-style records for every rescue.',
            },
          ].map((f) => (
            <div key={f.title} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
                <f.icon size={20} aria-hidden />
              </span>
              <div>
                <h3 className="font-heading font-semibold text-ink">{f.title}</h3>
                <p className="mt-1 text-sm text-slate">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 text-center md:px-8">
        <h2 className="font-heading text-2xl font-semibold text-ink">
          Ready to rescue your next surplus?
        </h2>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/signup?role=donor" className={buttonClass('primary', 'lg')}>
            <Utensils size={18} aria-hidden /> I have surplus food
          </Link>
          <Link to="/signup?role=receiver" className={buttonClass('teal', 'lg')}>
            <HandHeart size={18} aria-hidden /> We collect food
          </Link>
        </div>
        <div className="mt-6 flex justify-center">
          <ApiStatus />
        </div>
      </section>
    </div>
  );
}
