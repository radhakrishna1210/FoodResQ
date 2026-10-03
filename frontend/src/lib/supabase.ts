import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

/**
 * Supabase is used ONLY for auth, signed-URL uploads and realtime (README D10).
 * Exports `null` when env vars are missing so the app never crashes.
 */
function makeClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  } catch {
    return null;
  }
}

export const supabase: SupabaseClient | null = makeClient();
