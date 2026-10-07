import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/** Cliente com service role — SOMENTE no servidor (variáveis sem prefixo VITE_). */
export function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado no servidor");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Valida o JWT do chamador e exige perfil ADMIN ativo. Responde 401/403 e devolve null se falhar. */
export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse,
  db: SupabaseClient,
): Promise<User | null> {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "Não autenticado" });
    return null;
  }
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Sessão inválida" });
    return null;
  }
  const { data: profile } = await db
    .from("profiles")
    .select("role,status")
    .eq("user_id", data.user.id)
    .single();
  if (profile?.role !== "ADMIN" || profile.status !== "active") {
    res.status(403).json({ error: "Acesso restrito a administradores" });
    return null;
  }
  return data.user;
}
