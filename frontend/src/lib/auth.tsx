// Session context. Google Sign-In and the dev-login demo panel both resolve to a plain bearer
// token stored locally (README D6 — no Supabase Auth / password login). Supabase itself is still
// used elsewhere for storage uploads and realtime (see lib/supabase.ts, lib/realtime.ts).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, setTokenProvider, setUnauthorizedHandler } from './api';
import { DEV_AUTH } from './env';
import type { DonorProfile, MeResponse, ReceiverProfile, User, UserRole } from '@/types';

const DEV_TOKEN_KEY = 'foodresq.dev_token';
const PREFILL_KEY = 'foodresq.signup_prefill';

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable
  }
}

export interface SignupPrefill {
  full_name: string;
  phone: string;
  role?: 'donor' | 'receiver';
}
export function getSignupPrefill(): SignupPrefill | null {
  const raw = readLocal(PREFILL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SignupPrefill;
  } catch {
    return null;
  }
}
export function setSignupPrefill(p: SignupPrefill | null): void {
  writeLocal(PREFILL_KEY, p ? JSON.stringify(p) : null);
}

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

export interface AuthContextValue {
  status: AuthStatus;
  devMode: boolean;
  me: MeResponse | undefined;
  meLoading: boolean;
  meError: unknown;
  user: User | null;
  role: UserRole | null;
  profile: DonorProfile | ReceiverProfile | null;
  donorProfile: DonorProfile | null;
  receiverProfile: ReceiverProfile | null;
  onboarded: boolean;
  refreshMe: () => Promise<void>;
  devLogin: (email: string) => Promise<void>;
  completeGoogleLogin: (token: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Token provider for api.ts. DEV_TOKEN_KEY holds either a dev-login token or a real
  // Google-login token (routers/auth_google.py) — both are plain bearer tokens to the API client.
  useEffect(() => {
    setTokenProvider(() => readLocal(DEV_TOKEN_KEY));
    setHasSession(Boolean(readLocal(DEV_TOKEN_KEY)));
  }, []);

  const signOut = useCallback(async () => {
    writeLocal(DEV_TOKEN_KEY, null);
    setHasSession(false);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
    enabled: hasSession === true,
    staleTime: 30_000,
  });

  const refreshMe = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['me'] });
    await qc.refetchQueries({ queryKey: ['me'] });
  }, [qc]);

  const devLogin = useCallback(
    async (email: string) => {
      const { access_token } = await api.devLogin(email.trim().toLowerCase());
      writeLocal(DEV_TOKEN_KEY, access_token);
      qc.removeQueries({ queryKey: ['me'] });
      setHasSession(true);
    },
    [qc],
  );

  /** Called by the /auth/callback page after a real Google login redirect. */
  const completeGoogleLogin = useCallback(
    (token: string) => {
      writeLocal(DEV_TOKEN_KEY, token);
      setTokenProvider(() => readLocal(DEV_TOKEN_KEY));
      qc.removeQueries({ queryKey: ['me'] });
      setHasSession(true);
    },
    [qc],
  );

  const value = useMemo<AuthContextValue>(() => {
    const me = meQuery.data;
    const onboarded = Boolean(me && me.onboarded);
    const user = me && me.onboarded ? me.user : null;
    const profile = me && me.onboarded ? me.profile : null;
    const role = user?.role ?? null;
    let status: AuthStatus = 'loading';
    if (hasSession === false) status = 'anonymous';
    else if (hasSession === true && (me || meQuery.isError)) status = 'authenticated';
    return {
      status,
      devMode: DEV_AUTH,
      me,
      meLoading: meQuery.isLoading,
      meError: meQuery.error,
      user,
      role,
      profile,
      donorProfile: role === 'donor' ? (profile as DonorProfile | null) : null,
      receiverProfile: role === 'receiver' ? (profile as ReceiverProfile | null) : null,
      onboarded,
      refreshMe,
      devLogin,
      completeGoogleLogin,
      signOut,
    };
  }, [
    meQuery.data,
    meQuery.isError,
    meQuery.isLoading,
    meQuery.error,
    hasSession,
    refreshMe,
    devLogin,
    completeGoogleLogin,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Home route for a given user (role + status). */
export function homeFor(user: User | null, onboarded: boolean): string {
  if (!onboarded || !user) return '/onboarding';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'donor') return '/donor';
  return user.account_status === 'active' ? '/receiver' : '/pending';
}
