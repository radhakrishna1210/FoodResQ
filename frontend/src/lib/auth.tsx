// Session context. Supabase Auth in normal mode; dev auth (POST /dev/login) when DEV_AUTH is on.
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
import { supabase } from './supabase';
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
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  devLogin: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Token provider for api.ts
  useEffect(() => {
    if (DEV_AUTH) {
      setTokenProvider(() => readLocal(DEV_TOKEN_KEY));
      setHasSession(Boolean(readLocal(DEV_TOKEN_KEY)));
      return;
    }
    if (!supabase) {
      setHasSession(false);
      return;
    }
    const client = supabase;
    setTokenProvider(async () => {
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    });
    client.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session)));
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
      if (!session) qc.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const signOut = useCallback(async () => {
    if (DEV_AUTH) writeLocal(DEV_TOKEN_KEY, null);
    else if (supabase) await supabase.auth.signOut();
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

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Login is not configured. Use a demo account.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message || 'Could not log in.');
    setHasSession(true);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Signup is not configured. Use a demo account.');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message || 'Could not sign up.');
    const needsConfirmation = !data.session;
    if (!needsConfirmation) setHasSession(true);
    return { needsConfirmation };
  }, []);

  const devLogin = useCallback(
    async (email: string) => {
      const { access_token } = await api.devLogin(email.trim().toLowerCase());
      writeLocal(DEV_TOKEN_KEY, access_token);
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
      signInWithPassword,
      signUp,
      devLogin,
      signOut,
    };
  }, [
    meQuery.data,
    meQuery.isError,
    meQuery.isLoading,
    meQuery.error,
    hasSession,
    refreshMe,
    signInWithPassword,
    signUp,
    devLogin,
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
