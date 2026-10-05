import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock,
  HandHeart,
  KeyRound,
  MapPin,
  ShieldCheck,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { usePublicImpact } from '@/hooks/queries';
import { buttonClass } from '@/components/ui/Button';
import { ApiStatus } from '@/components/layout/StatusPills';
import { ImageSlider } from '@/components/media/ImageSlider';
import { CountUp } from '@/components/ui/CountUp';
import { Reveal } from '@/components/ui/Reveal';
import { Skeleton } from '@/components/ui/Spinner';
import { IMG, SLIDES } from '@/lib/media';

const STEPS = [
  {
    icon: Utensils,
    title: 'Donor posts',
    body: 'One form: food, servings, preparation time, storage, pickup deadline, location and a safety checklist.',
    color: 'bg-primary text-white',
    image: IMG.cookedMeal,
    alt: 'A plate of cooked rice with vegetables',
  },
  {
    icon: Brain,
    title: 'Smart matching',
    body: 'Our engine checks every verified Receiver and finds the best fit for your food, not just the nearest one, then sends an offer with clear reasons.',
    color: 'bg-purple text-white',
    image: IMG.sorting,
    alt: 'Volunteers sorting donated food',
  },
  {
    icon: HandHeart,
    title: 'Receiver collects',
    body: 'The Receiver picks up directly from the Donor. A 4-digit handover code confirms it, so impact is measured.',
    color: 'bg-teal text-white',
    image: IMG.handingPlate,
    alt: 'Two women sharing a plate of food',
  },
];

const FOOD_TYPES = [
  'Cooked meals',
  'Bakery',
  'Dairy',
  'Fresh produce',
  'Sweets',
  'Packaged food',
  'Hostel mess surplus',
  'Wedding & event leftovers',
  'Canteen surplus',
];

function ImpactStat({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <div className="px-4 py-5 text-center sm:px-8">
      {loading ? (
        <Skeleton className="mx-auto h-9 w-24" />
      ) : (
        <p className="font-heading text-3xl font-semibold text-ink sm:text-4xl">
          <CountUp value={value ?? 0} />
        </p>
      )}
      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate sm:text-sm">
        {label}
      </p>
    </div>
  );
}

/** A glass "live offer" card that floats over the hero photos. */
function LiveOfferCard() {
  return (
    <div className="relative hidden w-full max-w-sm animate-float lg:block" aria-hidden="true">
      <div className="rounded-2xl border border-white/30 bg-white/90 p-5 shadow-glow backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-teal" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal" />
            </span>
            Live offer
          </span>
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red/25">
            High priority
          </span>
        </div>
        <p className="mt-3 font-heading text-lg font-semibold text-ink">Veg pulao and dal</p>
        <p className="text-sm text-slate">120 servings · College canteen</p>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-xs text-slate">
          <Clock size={14} className="text-gold" /> Pickup by 10:30 PM
        </div>
        <div className="mt-4 space-y-2">
          {[
            { name: 'Asha Shelter', score: 91, note: '1.9 km · about 21 min', on: true },
            { name: 'Seva Kitchen', score: 52, note: 'Partial fit · 50 of 120', on: false },
          ].map((r) => (
            <div
              key={r.name}
              className={`rounded-lg border px-3 py-2 ${r.on ? 'border-teal/40 bg-teal-50/70' : 'border-line bg-white'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">{r.name}</p>
                <p
                  className={`font-heading text-lg font-semibold ${r.on ? 'text-teal-700' : 'text-slate'}`}
                >
                  {r.score}%
                </p>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full origin-left animate-progress rounded-full ${r.on ? 'bg-teal' : 'bg-slate/40'}`}
                  style={{ width: `${r.score}%`, animationDuration: '1.6s' }}
                />
              </div>
              <p className="mt-1 text-xs text-slate">{r.note}</p>
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
    <div className="overflow-x-clip">
      {/* Hero: full-bleed photo slider */}
      <section className="relative">
        <ImageSlider
          slides={SLIDES}
          className="h-[620px] sm:h-[680px] lg:h-[720px]"
          barClassName="pb-24 sm:pb-24"
        >
          <div className="relative mx-auto flex h-full max-w-6xl items-center px-4 pb-24 pt-10 md:px-8">
            <div className="grid w-full items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="mb-5 flex animate-fade-up flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/30 backdrop-blur">
                    <Sparkles size={13} aria-hidden /> SDG 2 · Zero Hunger
                  </span>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/30 backdrop-blur">
                    SDG 12.3 · Halve food waste
                  </span>
                </div>
                <h1
                  className="animate-fade-up font-heading text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl"
                  style={{ animationDelay: '80ms' }}
                >
                  Surplus food,
                  <br />
                  <span className="bg-gradient-to-r from-teal-100 via-white to-teal-100 bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer">
                    rescued in time.
                  </span>
                </h1>
                <p
                  className="mt-5 max-w-xl animate-fade-up text-base text-white/85 sm:text-lg"
                  style={{ animationDelay: '160ms' }}
                >
                  FoodResQ connects restaurants, hostels and caterers with verified NGOs and
                  shelters. Our engine finds the best-fit Receiver, not just the nearest one, and
                  every rescue is confirmed with a handover code.
                </p>
                <div
                  className="mt-8 flex animate-fade-up flex-col gap-3 sm:flex-row"
                  style={{ animationDelay: '240ms' }}
                >
                  <Link
                    to="/signup?role=donor"
                    className={buttonClass(
                      'secondary',
                      'lg',
                      'group border-transparent bg-white text-primary-700 shadow-lift hover:-translate-y-0.5 hover:bg-primary-50 transition-all',
                    )}
                  >
                    <Utensils size={18} aria-hidden /> I have surplus food
                    <ArrowRight
                      size={16}
                      aria-hidden
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </Link>
                  <Link
                    to="/signup?role=receiver"
                    className={buttonClass(
                      'teal',
                      'lg',
                      'ring-1 ring-inset ring-white/30 shadow-lift hover:-translate-y-0.5 transition-all',
                    )}
                  >
                    <HandHeart size={18} aria-hidden /> We collect food
                  </Link>
                </div>
              </div>
              <div className="flex justify-end">
                <LiveOfferCard />
              </div>
            </div>
          </div>
        </ImageSlider>

        {/* Impact strip overlapping the hero edge */}
        <div className="relative z-10 mx-auto -mt-14 max-w-4xl px-4 md:px-8" aria-live="polite">
          <div className="grid animate-fade-up grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-white shadow-lift">
            <ImpactStat
              label="Meals rescued"
              value={impact.data?.meals_rescued}
              loading={impact.isLoading}
            />
            <ImpactStat
              label="Rescues completed"
              value={impact.data?.rescues_completed}
              loading={impact.isLoading}
            />
            <ImpactStat
              label="Verified Receivers"
              value={impact.data?.active_receivers}
              loading={impact.isLoading}
            />
          </div>
          {impact.isError && (
            <p className="mt-2 text-center text-xs text-slate">
              Live counters are unavailable right now.
            </p>
          )}
        </div>
      </section>

      {/* Marquee of what gets rescued */}
      <section className="mt-12 border-y border-line bg-white py-4" aria-label="Food we rescue">
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent" />
          <ul className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
            {[...FOOD_TYPES, ...FOOD_TYPES].map((t, idx) => (
              <li
                key={`${t}-${idx}`}
                aria-hidden={idx >= FOOD_TYPES.length}
                className="flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-bg px-4 py-1.5 text-sm font-medium text-slate-700"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-teal" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3 steps */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
            How it works
          </p>
          <h2 className="mt-2 font-heading text-3xl font-semibold text-ink sm:text-4xl">
            From kitchen to table in three steps
          </h2>
          <p className="mt-3 text-slate">Minutes, not hours. Every step is tracked.</p>
        </Reveal>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 120}>
              <div className="card group h-full overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-glow">
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={s.image}
                    alt={s.alt}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/55 to-transparent" />
                  <span
                    className={`absolute bottom-3 left-4 flex h-11 w-11 items-center justify-center rounded-xl shadow-lift ${s.color}`}
                  >
                    <s.icon size={22} aria-hidden />
                  </span>
                  <span className="absolute right-4 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-ink backdrop-blur">
                    Step {i + 1}
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="font-heading text-xl font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate">{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Photo collage + promise */}
      <section className="bg-gradient-to-b from-primary-50/60 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:px-8 lg:grid-cols-2">
          <Reveal className="relative mx-auto grid w-full max-w-lg h-[26rem] grid-cols-6 grid-rows-6 gap-3 sm:h-[30rem]">
            <div className="col-span-4 row-span-4 overflow-hidden rounded-2xl shadow-lift">
              <img
                src={IMG.vegMarket}
                alt="A market stall piled with fresh vegetables"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="col-span-2 row-span-3 animate-float-slow overflow-hidden rounded-2xl shadow-lift">
              <img
                src={IMG.packingBags}
                alt="Volunteers packing food into paper bags"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="col-span-2 row-span-3 overflow-hidden rounded-2xl shadow-lift">
              <img
                src={IMG.truckProduce}
                alt="Volunteers loading produce crates onto a truck"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="col-span-4 row-span-2 overflow-hidden rounded-2xl shadow-lift">
              <img
                src={IMG.kitchenTeam}
                alt="A kitchen team preparing meals"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-5 -left-3 flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-lift">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green">
                <MapPin size={18} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Matched in minutes</p>
                <p className="text-xs text-slate">Nearest safe fit, ranked</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
              Built for trust
            </p>
            <h2 className="mt-2 font-heading text-3xl font-semibold text-ink sm:text-4xl">
              Safe, verified and measurable
            </h2>
            <p className="mt-3 text-slate">
              Food rescue only works when everyone can rely on it. FoodResQ keeps every handover
              accountable, from the first post to the last plate.
            </p>
            <ul className="mt-8 space-y-5">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Verified Receivers only',
                  body: 'Every Receiver is checked by the FoodResQ team (FSSAI registration) before they get offers.',
                  tone: 'bg-primary-50 text-primary',
                },
                {
                  icon: Clock,
                  title: 'Safe pickup deadlines',
                  body: 'Conservative time windows based on how food is stored. We support a safer workflow; we never certify food.',
                  tone: 'bg-gold-50 text-gold',
                },
                {
                  icon: CheckCircle2,
                  title: 'Measured, not estimated',
                  body: 'Handover codes, distribution confirmation and FSSAI-style records for every rescue.',
                  tone: 'bg-green-50 text-green',
                },
              ].map((f) => (
                <li key={f.title} className="flex gap-4">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${f.tone}`}
                  >
                    <f.icon size={22} aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-heading font-semibold text-ink">{f.title}</h3>
                    <p className="mt-0.5 text-sm text-slate">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Closing CTA over a photo */}
      <section className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl shadow-glow">
            <img
              src={IMG.packingFood}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#124F87]/95 via-primary/85 to-teal/70" />
            <div className="relative px-6 py-14 text-center sm:px-12 sm:py-16">
              <h2 className="font-heading text-3xl font-semibold text-white sm:text-4xl">
                Ready to rescue your next surplus?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-white/85">
                Join the donors and receivers turning leftovers into meals today.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  to="/signup?role=donor"
                  className={buttonClass(
                    'secondary',
                    'lg',
                    'border-transparent bg-white text-primary-700 shadow-lift transition-all hover:-translate-y-0.5 hover:bg-primary-50',
                  )}
                >
                  <Utensils size={18} aria-hidden /> I have surplus food
                </Link>
                <Link
                  to="/signup?role=receiver"
                  className={buttonClass(
                    'ghost',
                    'lg',
                    'text-white ring-1 ring-inset ring-white/50 transition-all hover:-translate-y-0.5 hover:bg-white/15',
                  )}
                >
                  <HandHeart size={18} aria-hidden /> We collect food
                </Link>
              </div>
              <div className="mt-6 flex justify-center">
                <ApiStatus />
              </div>
            </div>
          </div>
        </Reveal>
        <p className="mt-4 text-center text-xs text-slate">
          Photography from{' '}
          <a
            href="https://unsplash.com"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-ink"
          >
            Unsplash
          </a>
          .
        </p>
      </section>
    </div>
  );
}
