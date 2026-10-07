import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { countOf, useCurrentEvent } from "@/lib/data";
import type { Media } from "@/lib/types";

interface Recent { id: string; content: string; created_at: string; photo_id: string | null; profiles: { name: string } | null }
interface Testi { id: string; content: string; created_at: string; profiles: { name: string } | null }

export default function Community() {
  const { event } = useCurrentEvent();
  const { session, profile } = useAuth();
  const [recent, setRecent] = useState<Recent[]>([]);
  const [testis, setTestis] = useState<Testi[]>([]);
  const [popular, setPopular] = useState<Media[]>([]);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!supabase || !event) return;
    supabase.from("comments").select("id,content,created_at,photo_id,profiles(name)").eq("status", "visible")
      .order("created_at", { ascending: false }).limit(8).then(({ data }) => setRecent((data ?? []) as unknown as Recent[]));
    supabase.from("testimonials").select("id,content,created_at,profiles(name)").eq("event_id", event.id).eq("status", "approved")
      .order("created_at", { ascending: false }).limit(12).then(({ data }) => setTestis((data ?? []) as unknown as Testi[]));
    supabase.from("photos").select("*, likes(count), comments(count)").eq("event_id", event.id)
      .order("created_at", { ascending: false }).limit(200).then(({ data }) => {
        const rows = (data ?? []) as Media[];
        setPopular(rows.sort((a, b) => countOf(b, "likes") - countOf(a, "likes")).slice(0, 8));
      });
  }, [event]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !session || !event) return;
    const { error } = await supabase.from("testimonials").insert({ user_id: session.user.id, event_id: event.id, content: text });
    setMsg(error ? error.message : "Obrigado! Seu testemunho será publicado após aprovação.");
    if (!error) setText("");
  };

  return (
    <Page title="Comunidade">
      <h2 className="mb-3 text-3xl">🔥 Momentos populares</h2>
      <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {popular.map((m) => (
          <Link key={m.id} to={`/fotos/${m.id}`} className="relative block aspect-square overflow-hidden">
            <img src={m.thumbnail_url ?? ""} alt={m.title} loading="lazy" className="h-full w-full object-cover" />
            <span className="absolute bottom-1 left-1 bg-black/70 px-2 text-sm">❤️ {countOf(m, "likes")}</span>
          </Link>
        ))}
        {!popular.length && <p className="opacity-70">Ainda sem momentos populares.</p>}
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-3xl">💬 Comentários recentes</h2>
          <ul className="space-y-3">
            {recent.map((c) => (
              <li key={c.id}><strong className="text-[#ff5a3c]">{c.profiles?.name ?? "Visitante"}</strong>
                <p>“{c.content}”</p>
                {c.photo_id && <Link className="text-sm underline" to={`/fotos/${c.photo_id}`}>ver foto</Link>}
              </li>
            ))}
            {!recent.length && <li className="opacity-70">Seja o primeiro a comentar.</li>}
          </ul>
        </section>

        <section id="testemunhos">
          <h2 className="mb-3 text-3xl">🕊️ Testemunhos</h2>
          <ul className="mb-6 space-y-4">
            {testis.map((t) => (
              <li key={t.id} className="border-l-2 border-[#ff5a3c] pl-3"><p>“{t.content}”</p><p className="text-sm text-[#ff5a3c]">— {t.profiles?.name}</p></li>
            ))}
            {!testis.length && <li className="opacity-70">Nenhum testemunho publicado ainda.</li>}
          </ul>
          {session && profile?.status === "active" ? (
            <form onSubmit={send} className="space-y-2">
              <textarea className="input w-full" rows={4} minLength={10} maxLength={2000} required value={text} onChange={(e) => setText(e.target.value)} placeholder="Conte o que Deus fez em você nesta conferência" />
              {msg && <p role="status">{msg}</p>}
              <button className="btn">Enviar testemunho</button>
            </form>
          ) : <p><Link to="/login" className="underline">Entre</Link> para enviar seu testemunho.</p>}
        </section>
      </div>
    </Page>
  );
}
