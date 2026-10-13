'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
/** Cliente anônimo do navegador — usado SOMENTE para Realtime (leitura). Sem persistência de sessão. */
export function getBrowserClient(url: string, anonKey: string): SupabaseClient {
  if (!client) client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, realtime: { params: { eventsPerSecond: 5 } } });
  return client;
}
