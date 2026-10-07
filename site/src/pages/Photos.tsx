import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Page } from "@/components/Layout";
import { Lightbox } from "@/components/Lightbox";
import { countOf, fetchMedia, useCurrentEvent } from "@/lib/data";
import { CATEGORIES, type Media } from "@/lib/types";

const PAGE = 24;

export default function Photos() {
  const [params, setParams] = useSearchParams();
  const { event } = useCurrentEvent(params.get("evento") ?? undefined);
  const category = params.get("categoria") ?? "";
  const [items, setItems] = useState<Media[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const page = useRef(0);

  const loadMore = useCallback(async () => {
    if (!event || loading || done) return;
    setLoading(true);
    const rows = await fetchMedia("photo", event.id, { category: category || undefined, from: page.current * PAGE, to: page.current * PAGE + PAGE - 1 });
    page.current += 1;
    setItems((prev) => [...prev, ...rows]);
    if (rows.length < PAGE) setDone(true);
    setLoading(false);
  }, [event, category, loading, done]);

  // reinicia ao trocar filtro/evento
  useEffect(() => { page.current = 0; setItems([]); setDone(false); }, [event?.id, category]);
  // scroll infinito
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && loadMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const setCat = (c: string) => { const p = new URLSearchParams(params); c ? p.set("categoria", c) : p.delete("categoria"); setParams(p); };

  return (
    <Page title="Fotos">
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filtros">
        {["", ...CATEGORIES].map((c) => (
          <button key={c} role="tab" aria-selected={category === c} onClick={() => setCat(c)}
            className={`btn-ghost ${category === c ? "bg-[#e11d0c] text-white" : ""}`}>{c || "Todos"}</button>
        ))}
      </div>
      {/* masonry: colunas CSS, 2 no celular */}
      <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
        {items.map((m, i) => (
          <figure key={m.id} className="relative mb-3 break-inside-avoid overflow-hidden bg-black/30">
            <button onClick={() => setOpen(i)} className="block w-full" aria-label={`Abrir ${m.title}`}>
              <img src={m.thumbnail_url ?? ""} alt={m.title} loading="lazy" decoding="async" className="w-full" />
            </button>
            <figcaption className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/80 to-transparent p-2 text-sm">
              <Link to={`/fotos/${m.id}`}>❤️ {countOf(m, "likes")} · 💬 {countOf(m, "comments")}</Link>
            </figcaption>
          </figure>
        ))}
      </div>
      <div ref={sentinel} className="py-10 text-center opacity-70">
        {loading ? "Carregando…" : done ? (items.length ? "Isso é tudo por enquanto." : "Nenhuma foto sincronizada ainda.") : ""}
      </div>
      {open !== null && <Lightbox items={items} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />}
    </Page>
  );
}
