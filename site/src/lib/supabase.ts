import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** `null` quando as variáveis não estão definidas — o site abre, mas sem comunidade. */
export const supabase = url && anon ? createClient(url, anon) : null;
export const isConfigured = Boolean(supabase);
