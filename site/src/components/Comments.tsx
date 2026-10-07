import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { CommentRow, Kind } from "@/lib/types";

const fmt = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function Comments({ kind, id }: { kind: Kind; id: string }) {
  const { session, profile } = useAuth();
  const col = kind === "photo" ? "photo_id" : "video_id";
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("comments").select("*, profiles(name, avatar_url)")
      .eq(col, id).eq("status", "visible").order("created_at");
    setRows((data ?? []) as CommentRow[]);
  }, [col, id]);
  useEffect(() => { load(); }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !session || !text.trim()) return;
    setError("");
    const { error } = await supabase.from("comments")
      .insert({ [col]: id, user_id: session.user.id, parent_id: replyTo, content: text });
    if (error) return setError(error.message);
    setText(""); setReplyTo(null); load();
  };

  const report = async (commentId: string) => {
    const reason = window.prompt("Por que você está denunciando este comentário?");
    if (!reason || !supabase || !session) return;
    const { error } = await supabase.from("reports").insert({ comment_id: commentId, user_id: session.user.id, reason });
    window.alert(error ? (error.code === "23505" ? "Você já denunciou este comentário." : error.message) : "Denúncia enviada. Obrigado!");
  };

  const remove = async (commentId: string) => {
    if (!supabase || !window.confirm("Excluir comentário?")) return;
    await supabase.from("comments").delete().eq("id", commentId);
    load();
  };

  const item = (c: CommentRow, nested = false) => (
    <li key={c.id} className={nested ? "ml-6 border-l border-[#ff5a3c]/30 pl-4" : ""}>
      <div className="py-3">
        <p className="text-sm opacity-70">{nested && "↳ "}<strong className="text-[#ff5a3c]">{c.profiles?.name ?? "Visitante"}</strong> · {fmt(c.created_at)}</p>
        {/* React escapa o conteúdo — nunca usar dangerouslySetInnerHTML aqui */}
        <p className="whitespace-pre-wrap break-words">“{c.content}”</p>
        <div className="mt-1 flex gap-4 text-sm opacity-70">
          {session && !nested && <button onClick={() => setReplyTo(c.id)}>Responder</button>}
          {session && c.user_id !== session.user.id && <button onClick={() => report(c.id)}>Denunciar</button>}
          {session && c.user_id === session.user.id && <button onClick={() => remove(c.id)}>Excluir</button>}
        </div>
      </div>
      {rows.filter((r) => r.parent_id === c.id).map((r) => item(r, true))}
    </li>
  );

  return (
    <section aria-label="Comentários">
      <h3 className="mb-2 text-2xl">💬 Comentários ({rows.length})</h3>
      {session && profile?.status === "active" ? (
        <form onSubmit={send} className="mb-4 space-y-2">
          {replyTo && <p className="text-sm">Respondendo… <button type="button" onClick={() => setReplyTo(null)} className="underline">cancelar</button></p>}
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={2}
            placeholder={`Comentar como ${profile.name}`} className="input w-full" />
          {error && <p role="alert" className="text-sm text-yellow-300">{error}</p>}
          <button className="btn">Publicar</button>
        </form>
      ) : profile?.status === "blocked" ? (
        <p className="mb-4 opacity-70">Sua conta está impedida de comentar.</p>
      ) : (
        <p className="mb-4"><Link to="/login" className="underline">Entre</Link> para comentar.</p>
      )}
      <ul className="divide-y divide-white/10">{rows.filter((r) => !r.parent_id).map((r) => item(r))}</ul>
    </section>
  );
}
