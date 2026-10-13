import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publicEnv, isSupabaseConfigured } from '../env';

/** Cliente com a sessão do usuário (cookies). Todas as consultas rodam COM o JWT do admin → o RLS é a barreira real. */
export async function createSessionClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  const store = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* chamado de Server Component: a sessão é renovada no middleware */ }
      },
    },
  });
}
