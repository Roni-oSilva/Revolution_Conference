'use client';
import { useEffect, useRef, useState } from 'react';
import { youtubeEmbedUrl, youtubeThumbUrl, youtubeWatchUrl } from '@/lib/urls';

export function VideoCard({ id, youtubeId, title, description, category }: { id: string; youtubeId: string; title: string; description: string; category: string }) {
  const [open, setOpen] = useState(false);
  const [thumbOk, setThumbOk] = useState(true);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (
    <article className="vcard" data-video-id={id}>
      <button type="button" className="vthumb" onClick={() => setOpen(true)} aria-label={`Assistir: ${title}`}>
        {thumbOk
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={youtubeThumbUrl(youtubeId)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setThumbOk(false)} />
          : <div className="img-fail"><span>Miniatura indisponível</span></div>}
        <span className="play" aria-hidden="true">▶</span>
      </button>
      <div className="vmeta">
        <span className="badge">{category}</span>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
        <a className="link-btn" href={youtubeWatchUrl(youtubeId)} target="_blank" rel="noopener noreferrer">Abrir no YouTube ↗</a>
      </div>
      <dialog ref={ref} className="dlg" aria-label={title} onClose={() => setOpen(false)} onClick={(e) => { if (e.target === ref.current) setOpen(false); }}>
        {open && (
          <div className="dlg-in">
            <button type="button" className="dlg-close" aria-label="Fechar" onClick={() => setOpen(false)}>×</button>
            <div className="player"><iframe title={title} src={youtubeEmbedUrl(youtubeId)} allow="encrypted-media; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
            <a className="link-btn" href={youtubeWatchUrl(youtubeId)} target="_blank" rel="noopener noreferrer">Não abriu? Assistir no YouTube ↗</a>
          </div>
        )}
      </dialog>
    </article>
  );
}
