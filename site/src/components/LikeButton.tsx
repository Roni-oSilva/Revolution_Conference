import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Kind } from "@/lib/types";

export function LikeButton({ kind, id, initial }: { kind: Kind; id: string; initial: number }) {
  const { session } = useAuth();
  const col = kind === "photo" ? "photo_id" : "video_id";
  const [count, setCount] = useState(initial);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase || !session) return setLiked(false);
    supabase.from("likes").select("id").eq(col, id).eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setLiked(Boolean(data)));
  }, [session, id, col]);

  if (!session) return <Link to="/login" className="btn-ghost" title="Entre para curtir">❤️ {count}</Link>;

  const toggle = async () => {
    if (busy || !supabase) return;
    setBusy(true);
    const wasLiked = liked;
    setLiked(!wasLiked); setCount((c) => c + (wasLiked ? -1 : 1)); // otimista
    const { error } = wasLiked
      ? await supabase.from("likes").delete().eq(col, id).eq("user_id", session.user.id)
      : await supabase.from("likes").insert({ [col]: id, user_id: session.user.id });
    // 23505 = já curtiu (constraint única) → mantém estado curtido
    if (error && error.code !== "23505") { setLiked(wasLiked); setCount((c) => c + (wasLiked ? 1 : -1)); }
    setBusy(false);
  };
  return (
    <button onClick={toggle} aria-pressed={liked} className={`btn-ghost ${liked ? "text-[#ff5a3c]" : ""}`}>
      {liked ? "❤️" : "🤍"} {count}
    </button>
  );
}
