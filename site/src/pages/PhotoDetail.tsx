import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Page } from "@/components/Layout";
import { Comments } from "@/components/Comments";
import { LikeButton } from "@/components/LikeButton";
import { ShareButton } from "@/components/ShareButton";
import { supabase } from "@/lib/supabase";
import { countOf } from "@/lib/data";
import type { Media } from "@/lib/types";

export default function PhotoDetail() {
  const { id } = useParams();
  const [m, setM] = useState<Media | null | undefined>(undefined);
  useEffect(() => {
    if (!supabase || !id) return setM(null);
    supabase.from("photos").select("*, likes(count), comments(count)").eq("id", id).maybeSingle()
      .then(({ data }) => setM((data as Media) ?? null));
  }, [id]);

  if (m === undefined) return <Page title="…"><p>Carregando…</p></Page>;
  if (m === null) return <Page title="Foto não encontrada"><Link to="/fotos" className="underline">Voltar às fotos</Link></Page>;
  return (
    <Page title={m.title}>
      <img src={m.thumbnail_url?.replace("sz=w1000", "sz=w2000") ?? ""} alt={m.title} className="mx-auto max-h-[75vh] w-auto max-w-full" />
      <p className="mt-3 opacity-70">{m.category} · {new Date(m.created_at).toLocaleDateString("pt-BR")}</p>
      <div className="my-4 flex flex-wrap gap-3">
        <LikeButton kind="photo" id={m.id} initial={countOf(m, "likes")} />
        <ShareButton path={`/fotos/${m.id}`} title={m.title} />
        <Link to="/fotos" className="btn-ghost">← Todas as fotos</Link>
      </div>
      <Comments kind="photo" id={m.id} />
    </Page>
  );
}
