import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { setSignupPrefill, useAuth } from '@/lib/auth';
import { AuthCard, GoogleLoginButton } from '@/pages/login/LoginPage';
import { DemoAccountsHint } from '@/components/auth/DemoAccountsHint';

/** Signup and login are the same action with Google (README D6) — onboarding collects the rest. */
export default function SignupPage() {
  const { devMode } = useAuth();
  const [params] = useSearchParams();
  const role =
    params.get('role') === 'receiver'
      ? 'receiver'
      : params.get('role') === 'donor'
        ? 'donor'
        : undefined;

  useEffect(() => {
    if (role) setSignupPrefill({ full_name: '', phone: '', role });
  }, [role]);

  return (
    <AuthCard
      title="Create your account"
      subtitle={
        role === 'receiver'
          ? 'For NGOs, shelters and community organisations that collect food.'
          : role === 'donor'
            ? 'For restaurants, hotels, hostels, caterers and food businesses.'
            : 'Sign up with Google, then choose Donor or Receiver in the next step.'
      }
    >
      <div className="space-y-6">
        <GoogleLoginButton />
        {devMode && <DemoAccountsHint />}
      </div>
    </AuthCard>
  );
}
