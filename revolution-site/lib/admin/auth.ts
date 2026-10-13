import 'server-only';
import { redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSessionClient } from '../supabase/server';

export interface AdminCtx { client: SupabaseClient; user: User; role: 'owner' | 'editor' }

/** Autorização no SERVIDOR, a cada página e a cada ação:
 *  1) getUser() valida o JWT junto ao Auth (não confia só no cookie);
 *  2) is_admin() é avaliada no banco. Mesmo que isto fosse burlado, o RLS continua barrando as escritas. */
export async function requireAdmin(): Promise<AdminCtx> {
  const client = await createSessionClient();
  if (!client) redirect('/admin/login?erro=config');
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect('/admin/login');
  const [a, o] = await Promise.all([client.rpc('is_admin'), client.rpc('is_owner')]);
  if (a.error || a.data !== true) redirect('/admin/negado');
  return { client, user: data.user, role: o.data === true ? 'owner' : 'editor' };
}
