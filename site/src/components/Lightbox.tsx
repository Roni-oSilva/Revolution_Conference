import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { Media } from "@/lib/types";

export function Lightbox({ items, index, onClose, onIndex }: { items: Media[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const m = items[index];
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }, [index, items.length, onClose, onIndex]);
  if (!m) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={m.title} className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <img src={m.thumbnail_url?.replace("sz=w1000", "sz=w2000") ?? ""} alt={m.title} className="max-h-[78vh] max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
      <div className="mt-3 flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <button className="btn-ghost" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label="Anterior">←</button>
        <Link to={`/fotos/${m.id}`} className="btn">Curtir · Comentar</Link>
        <button className="btn-ghost" disabled={index === items.length - 1} onClick={() => onIndex(index + 1)} aria-label="Próxima">→</button>
        <button className="btn-ghost" onClick={onClose}>Fechar ✕</button>
      </div>
    </div>
  );
}
