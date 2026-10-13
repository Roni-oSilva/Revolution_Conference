// Leitura centralizada de variáveis de ambiente. Nada aqui expõe valores — só presença.
export const publicEnv = () => ({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
});
export const isSupabaseConfigured = () => {
  const e = publicEnv();
  return Boolean(e.supabaseUrl && e.supabaseAnonKey);
};
/** Somente servidor. */
export const serverEnv = () => ({
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  rateLimitSalt: process.env.RATE_LIMIT_SALT ?? '',
});
export const hasServiceRole = () => Boolean(serverEnv().serviceRoleKey);
