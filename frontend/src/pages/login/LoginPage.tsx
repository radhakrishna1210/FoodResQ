import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, HandHeart, LogIn, ShieldCheck, Utensils } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { DEMO_ACCOUNTS, SUPABASE_URL } from '@/lib/env';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { InlineError } from '@/components/ui/ErrorState';
import { cn } from '@/lib/cn';

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
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <div className="card p-6 sm:p-8">
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

function PasswordLogin() {
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(email.trim(), password);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email" required>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <InlineError error={error} />
      <Button type="submit" block size="lg" loading={busy} icon={<LogIn size={18} />}>
        Log in
      </Button>
    </form>
  );
}

export default function LoginPage() {
  const { devMode } = useAuth();
  const hasSupabase = Boolean(SUPABASE_URL);
  return (
    <AuthCard title="Welcome back" subtitle="Log in to post surplus food or collect it.">
      <div className="space-y-6">
        {/* Dev auth replaces Supabase login entirely so api.ts sends a single, consistent token. */}
        {devMode ? <DemoAccounts /> : hasSupabase ? <PasswordLogin /> : null}
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
