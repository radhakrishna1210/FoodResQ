import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, HandHeart, ShieldCheck, Utensils } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { DEMO_ACCOUNTS, GOOGLE_LOGIN_ENABLED, GOOGLE_LOGIN_URL } from '@/lib/env';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { InlineError } from '@/components/ui/ErrorState';
import { cn } from '@/lib/cn';
import { Logo } from '@/components/layout/Logo';
import { ImageSlider } from '@/components/media/ImageSlider';
import { SLIDES } from '@/lib/media';

const ROLE_ICON = { admin: ShieldCheck, donor: Utensils, receiver: HandHeart } as const;

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-5xl items-stretch gap-0 px-4 py-10 sm:py-14 lg:grid-cols-[1fr_28rem]">
      <ImageSlider
        slides={SLIDES}
        showControls={false}
        overlay="from-primary/70 via-ink/40 to-ink/20"
        className="hidden rounded-l-2xl lg:block"
      >
        <div className="relative flex h-full flex-col justify-start p-8 text-white">
          <Logo light className="self-start" />
          <p className="mt-6 max-w-xs animate-fade-up font-heading text-2xl font-semibold leading-snug">
            Rescue surplus food. Feed someone today.
          </p>
        </div>
      </ImageSlider>
      <div className="card animate-fade-up p-6 shadow-lift sm:p-8 lg:rounded-l-none">
        <h1 className="font-heading text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-slate">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

/** Dev auth panel — prototype convenience. TODO(team): remove before pilot. */
function DemoAccounts() {
  const { devLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const login = async (value: string) => {
    setError(null);
    setBusy(value);
    try {
      await devLogin(value);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-700 ring-1 ring-inset ring-gold/25">
        <FlaskConical size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>Demo accounts (prototype only). Seeded by the backend; no password needed.</span>
      </div>
      <ul className="space-y-2">
        {DEMO_ACCOUNTS.map((a) => {
          const Icon = ROLE_ICON[a.role as keyof typeof ROLE_ICON] ?? Utensils;
          return (
            <li key={a.email}>
              <button
                type="button"
                onClick={() => login(a.email)}
                disabled={busy !== null}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border border-line bg-white px-3 py-2.5 text-left transition-colors',
                  'hover:border-primary/40 hover:bg-primary-50/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    a.role === 'admin'
                      ? 'bg-purple-50 text-purple'
                      : a.role === 'donor'
                        ? 'bg-primary-50 text-primary'
                        : 'bg-teal-50 text-teal-700',
                  )}
                >
                  <Icon size={16} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{a.label}</span>
                  <span className="block truncate text-xs text-slate">{a.email}</span>
                </span>
                {busy === a.email && <span className="text-xs text-slate">Signing in…</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) void login(email);
        }}
      >
        <label htmlFor="demo-email" className="sr-only">
          Email
        </label>
        <Input
          id="demo-email"
          type="email"
          placeholder="or type a demo email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" variant="secondary" loading={busy === email && email !== ''}>
          Go
        </Button>
      </form>
      <InlineError error={error} />
    </div>
  );
}

/** The only real login/signup method (README D6: Google Sign-In, direct OAuth, no Supabase/password auth). */
export function GoogleLoginButton() {
  return (
    <a
      href={GOOGLE_LOGIN_URL}
      className={cn(
        'flex w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium text-ink transition-colors',
        'hover:border-primary/40 hover:bg-primary-50/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/15',
      )}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.95v2.33A9 9 0 0 0 9 18Z"
        />
        <path
          fill="#FBBC05"
          d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.04l3.02-2.33Z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.96l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
        />
      </svg>
      Continue with Google
    </a>
  );
}

export default function LoginPage() {
  const { devMode } = useAuth();
  return (
    <AuthCard title="Welcome back" subtitle="Log in to post surplus food or collect it.">
      <div className="space-y-6">
        {GOOGLE_LOGIN_ENABLED && <GoogleLoginButton />}
        {GOOGLE_LOGIN_ENABLED && devMode && (
          <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
        )}
        {devMode && <DemoAccounts />}
        <p className="text-center text-sm text-slate">
          New to FoodResQ?{' '}
          <Link to="/signup" className="link">
            Create an account
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
