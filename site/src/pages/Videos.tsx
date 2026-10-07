import { useEffect, useState } from "react";
import { Page } from "@/components/Layout";
import { Comments } from "@/components/Comments";
import { LikeButton } from "@/components/LikeButton";
import { ShareButton } from "@/components/ShareButton";
import { countOf, fetchMedia, useCurrentEvent } from "@/lib/data";
import type { Media } from "@/lib/types";

export default function Videos() {
  const { event } = useCurrentEvent();
  const [items, setItems] = useState<Media[]>([]);
  const [active, setActive] = useState<Media | null>(null);
  const [limit, setLimit] = useState(12);
  useEffect(() => { if (event) fetchMedia("video", event.id, { from: 0, to: limit - 1 }).then(setItems); }, [event, limit]);

  return (
    <Page title="Vídeos">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((v) => (
          <button key={v.id} onClick={() => setActive(v)} className="group relative aspect-video overflow-hidden bg-black/40 text-left">
            <img src={v.thumbnail_url ?? ""} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
            <span className="absolute inset-0 grid place-items-center text-6xl opacity-90">▶</span>
            <span className="absolute inset-x-0 bottom-0 bg-black/70 p-2">{v.title}<br /><small>❤️ {countOf(v, "likes")} · 💬 {countOf(v, "comments")}</small></span>
          </button>
        ))}
      </div>
      {!items.length && <p className="opacity-70">Nenhum vídeo sincronizado ainda.</p>}
      {items.length >= limit && <button className="btn mt-6" onClick={() => setLimit((l) => l + 12)}>Carregar mais</button>}

      {active && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] overflow-auto bg-black/90 p-4" onClick={() => setActive(null)}>
          <div className="mx-auto max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button className="btn-ghost mb-2" onClick={() => setActive(null)}>Fechar ✕</button>
            <iframe title={active.title} src={`https://drive.google.com/file/d/${active.drive_file_id}/preview`}
              className="aspect-video w-full" allow="autoplay; fullscreen" loading="lazy" />
            <h2 className="my-3 text-3xl">{active.title}</h2>
            <div className="mb-4 flex flex-wrap gap-3">
              <LikeButton kind="video" id={active.id} initial={countOf(active, "likes")} />
              <ShareButton path="/videos" title={active.title} />
            </div>
            <Comments kind="video" id={active.id} />
          </div>
        </div>
      )}
    </Page>
  );
}
