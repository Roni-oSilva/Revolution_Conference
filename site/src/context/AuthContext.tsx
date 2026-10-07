import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

interface Ctx {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  const loadProfile = async (s: Session | null) => {
    if (!supabase || !s) return setProfile(null);
    const { data } = await supabase.from("profiles").select("*").eq("user_id", s.user.id).single();
    setProfile((data as Profile) ?? null);
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => loadProfile(s), 0); // evita deadlock dentro do callback do supabase-js
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: Ctx = {
    session, profile, loading,
    isAdmin: profile?.role === "ADMIN" && profile.status === "active",
    signIn: async (email, password) => {
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      return error ? "E-mail ou senha incorretos." : null;
    },
    signUp: async (name, email, password) => {
      const { error } = await supabase!.auth.signUp({ email, password, options: { data: { name: name.trim() } } });
      return error ? error.message : null;
    },
    signOut: async () => { await supabase?.auth.signOut(); },
    refreshProfile: () => loadProfile(session),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
