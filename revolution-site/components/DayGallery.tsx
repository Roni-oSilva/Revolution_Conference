'use client';
import { useEffect, useRef, useState } from 'react';

export interface DayPhoto { src: string; thumb: string; alt: string }

export function DayGallery({ photos }: { photos: DayPhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  const go = (delta: number) => setOpen((i) => (i === null ? i : (i + delta + photos.length) % photos.length));
  const cur = open !== null ? photos[open] : null;

  return (
    <>
      <ul className="gallery" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {photos.map((p, i) => (
          <li key={p.src} style={{ display: 'contents' }}>
            <button type="button" className="g" aria-label={`Ampliar foto ${i + 1}`} onClick={() => setOpen(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb} alt={p.alt} loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>
      <dialog ref={ref} className="dlg" aria-label="Foto ampliada" onClose={() => setOpen(null)} onKeyDown={(e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}
        onClick={(e) => { if (e.target === ref.current) setOpen(null); }}>
        {cur && (
          <div className="dlg-in">
            <button type="button" className="dlg-close" aria-label="Fechar" onClick={() => setOpen(null)}>×</button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.src} alt={cur.alt} />
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="btn small" onClick={() => go(-1)} aria-label="Foto anterior">←</button>
              <span className="muted" aria-live="polite">{(open ?? 0) + 1} / {photos.length}</span>
              <button type="button" className="btn small" onClick={() => go(1)} aria-label="Próxima foto">→</button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
