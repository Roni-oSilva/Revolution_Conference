import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '../supabase/service';
import { ADMIN_COOKIE, verifyAdminToken } from './session';

export interface AdminCtx { client: SupabaseClient; user: { email: string }; role: 'owner' }

/** Painel protegido por UMA senha (variável ADMIN_PASSWORD no servidor). Depois do login, o servidor grava no banco com a
 *  chave de serviço (service_role). Sem ADMIN_PASSWORD o painel fica desligado. */
export async function requireAdmin(): Promise<AdminCtx> {
  const secret = process.env.ADMIN_PASSWORD ?? '';
  if (!secret) redirect('/admin/login?m=config');
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!(await verifyAdminToken(secret, token))) redirect('/admin/login');
  const client = createServiceClient();
  if (!client) redirect('/admin/login?m=no_service');
  return { client: client!, user: { email: 'Administrador' }, role: 'owner' };
}
