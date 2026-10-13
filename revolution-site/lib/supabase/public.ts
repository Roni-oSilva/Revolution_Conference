import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv, isSupabaseConfigured } from '../env';

/** Cliente anônimo (sem sessão/cookies) para leitura pública em componentes de servidor. O RLS decide o que é visível. */
export function createPublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  return createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
