const rawBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();

export const API_BASE_URL = (rawBase || 'http://localhost:8000/api/v1').replace(/\/+$/, '');

/** `/health` lives at the backend root: strip a trailing `/api/v1`. */
export const HEALTH_URL = `${API_BASE_URL.replace(/\/api\/v1$/, '')}/health`;

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

/**
 * Dev auth (prototype convenience). TODO(team): remove before the pilot.
 * Enabled when Supabase is not configured OR VITE_DEV_AUTH=true.
 */
export const DEV_AUTH = !SUPABASE_URL || import.meta.env.VITE_DEV_AUTH === 'true';

export const DEMO_ACCOUNTS: Array<{ email: string; label: string; role: string }> = [
  { email: 'admin@foodresq.demo', label: 'FoodResQ Admin', role: 'admin' },
  { email: 'college.a@foodresq.demo', label: 'College A (Demo)', role: 'donor' },
  { email: 'receiver.a@foodresq.demo', label: 'Receiver A (Demo NGO)', role: 'receiver' },
  { email: 'receiver.b@foodresq.demo', label: 'Receiver B (Demo Shelter)', role: 'receiver' },
  {
    email: 'receiver.c@foodresq.demo',
    label: 'Receiver C (Demo Community Pantry)',
    role: 'receiver',
  },
  { email: 'receiver.pending@foodresq.demo', label: 'Demo Pending NGO', role: 'receiver' },
];
