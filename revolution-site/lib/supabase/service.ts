import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv, serverEnv } from '../env';

/** ⚠️ service_role: SOMENTE em código de servidor (rotas /api e ações administrativas já autorizadas). Nunca importar em componentes de cliente. */
export function createServiceClient(): SupabaseClient | null {
  const { supabaseUrl } = publicEnv();
  const { serviceRoleKey } = serverEnv();
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
