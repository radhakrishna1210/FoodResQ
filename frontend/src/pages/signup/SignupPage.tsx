import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck, UserPlus } from 'lucide-react';
import { setSignupPrefill, useAuth } from '@/lib/auth';
import { SUPABASE_URL } from '@/lib/env';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { InlineError } from '@/components/ui/ErrorState';
import { AuthCard } from '@/pages/login/LoginPage';
import { phoneSchema } from '@/lib/schemas';

const signupSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(100),
  phone: phoneSchema,
  email: z.string().trim().email('Enter a valid email'),
  password: z.string(),
});
type SignupValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const { signUp, devLogin, devMode } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const role =
    params.get('role') === 'receiver'
      ? 'receiver'
      : params.get('role') === 'donor'
        ? 'donor'
        : undefined;
  const usePassword = Boolean(SUPABASE_URL) && !devMode;
  const [error, setError] = useState<unknown>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFieldError,
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { full_name: '', phone: '', email: '', password: '' },
  });

  const onSubmit = async (v: SignupValues) => {
    setError(null);
    if (usePassword && v.password.length < 8) {
      setFieldError('password', { message: 'Use at least 8 characters' });
      return;
    }
    setSignupPrefill({ full_name: v.full_name, phone: v.phone, role });
    try {
      if (usePassword) {
        const { needsConfirmation } = await signUp(v.email, v.password);
        if (needsConfirmation) {
          setConfirmEmail(v.email);
          return;
        }
      } else {
        // TODO(team): dev auth — backend /dev/login must accept a new email for signup to work in demo mode.
        await devLogin(v.email);
      }
      navigate('/onboarding');
    } catch (e) {
      setError(e);
    }
  };

  if (confirmEmail) {
    return (
      <AuthCard title="Check your email" subtitle="One more step before you can continue.">
        <div className="flex flex-col items-center text-center">
          <MailCheck size={40} className="text-primary" aria-hidden />
          <p className="mt-3 text-sm text-slate">
            We sent a confirmation link to{' '}
            <span className="font-medium text-ink">{confirmEmail}</span>. Open it, then log in to
            finish setting up your organisation.
          </p>
          <Link to="/login" className="link mt-4">
            Go to log in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle={
        role === 'receiver'
          ? 'For NGOs, shelters and community organisations that collect food.'
          : role === 'donor'
            ? 'For restaurants, hotels, hostels, caterers and food businesses.'
            : 'You will choose Donor or Receiver in the next step.'
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="full_name" error={errors.full_name?.message} required>
          <Input
            id="full_name"
            autoComplete="name"
            invalid={!!errors.full_name}
            {...register('full_name')}
          />
        </Field>
        <Field
          label="Mobile number"
          htmlFor="phone"
          hint="10-digit Indian mobile"
          error={errors.phone?.message}
          required
        >
          <Input
            id="phone"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            invalid={!!errors.phone}
            {...register('phone')}
          />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...register('email')}
          />
        </Field>
        {usePassword && (
          <Field
            label="Password"
            htmlFor="password"
            hint="At least 8 characters"
            error={errors.password?.message}
            required
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              invalid={!!errors.password}
              {...register('password')}
            />
          </Field>
        )}
        {!usePassword && (
          <p className="rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-700 ring-1 ring-inset ring-gold/25">
            Demo mode: no password needed.
          </p>
        )}
        <InlineError error={error} />
        <Button type="submit" block size="lg" loading={isSubmitting} icon={<UserPlus size={18} />}>
          Sign up
        </Button>
        <p className="text-center text-sm text-slate">
          Already have an account?{' '}
          <Link to="/login" className="link">
            Log in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
