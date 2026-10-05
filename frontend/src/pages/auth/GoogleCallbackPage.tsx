import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { AuthCard } from '@/pages/login/LoginPage';
import { PageSpinner } from '@/components/ui/Spinner';
import { InlineError } from '@/components/ui/ErrorState';

const ERROR_MESSAGES: Record<string, string> = {
  google_denied: 'Google sign-in was cancelled or could not be verified. Please try again.',
  google_token_exchange_failed: 'Google sign-in failed. Please try again.',
  google_invalid_token: "We couldn't verify that Google account. Please try again.",
  google_email_unverified: 'That Google account has no verified email address.',
};

/** Lands here after the backend's /auth/google/callback redirect (ARCHITECTURE-adjacent, Google login). */
export default function GoogleCallbackPage() {
  const [params] = useSearchParams();
  const { completeGoogleLogin } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    const errorCode = params.get('error');
    if (token) {
      completeGoogleLogin(token);
      return;
    }
    setError(ERROR_MESSAGES[errorCode ?? ''] ?? 'Something went wrong signing you in with Google.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <AuthCard title="Couldn't sign you in" subtitle="">
        <InlineError error={new Error(error)} />
        <a href="/login" className="link mt-4 inline-block text-sm">
          Back to login
        </a>
      </AuthCard>
    );
  }
  return <PageSpinner label="Signing you in…" />;
}
