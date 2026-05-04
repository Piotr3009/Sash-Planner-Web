import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(url && anonKey && !url.includes('your-project'));

export const supabase = hasSupabaseConfig
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  }
  return supabase;
}
