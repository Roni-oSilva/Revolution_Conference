'use client';
import { useEffect, useRef, useState } from 'react';
import { DriveImage } from './DriveImage';
import { driveThumbUrl } from '@/lib/urls';

export interface GalleryItem { id: string; fileId: string; alt: string; caption: string; featured: boolean; album: string }

export function Gallery({ items: all, initialAlbum = '' }: { items: GalleryItem[]; initialAlbum?: string }) {
  const albums = [...new Set(all.map((i) => i.album).filter(Boolean))];
  const [album, setAlbum] = useState(albums.includes(initialAlbum) ? initialAlbum : '');
  const items = album ? all.filter((i) => i.album === album) : all;
  const [open, setOpen] = useState<number | null>(null);
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  const go = (delta: number) => { setBroken(false); setOpen((i) => (i === null ? i : (i + delta + items.length) % items.length)); };
  const cur = open !== null ? items[open] : null;

  return (
    <>
      {albums.length > 0 && (
        <div className="chips" role="group" aria-label="Álbuns">
          {['', ...albums].map((a) => <button key={a || 'todas'} type="button" className="chip" aria-pressed={album === a} onClick={() => { setAlbum(a); setOpen(null); }}>{a || 'Todas'}</button>)}
        </div>
      )}
      <ul className="gallery" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((it, i) => (
          <li key={it.id} style={{ display: 'contents' }}>
            <button type="button" className={`g${it.featured && i === 0 ? ' big' : ''}`} aria-label={`Ampliar foto${it.caption ? ': ' + it.caption : ''}`} onClick={() => { setBroken(false); setOpen(i); }}>
              <DriveImage fileId={it.fileId} alt={it.alt || it.caption} sizes={it.featured && i === 0 ? '(max-width: 640px) 100vw, 50vw' : '(max-width: 640px) 50vw, 25vw'} />
            </button>
          </li>
        ))}
      </ul>
      <dialog ref={ref} className="dlg" aria-label="Foto ampliada" onClose={() => setOpen(null)} onKeyDown={(e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}
        onClick={(e) => { if (e.target === ref.current) setOpen(null); }}>
        {cur && (
          <div className="dlg-in">
            <button type="button" className="dlg-close" aria-label="Fechar" onClick={() => setOpen(null)}>×</button>
            {broken
              ? <div className="img-fail" role="img" aria-label="Imagem indisponível"><span>Imagem indisponível</span></div>
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={driveThumbUrl(cur.fileId, 1600)} alt={cur.alt || cur.caption} onError={() => setBroken(true)} referrerPolicy="no-referrer" />}
            {cur.caption && <p style={{ margin: 0, textAlign: 'center' }}>{cur.caption}</p>}
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="btn small" onClick={() => go(-1)} aria-label="Foto anterior">←</button>
              <span className="muted" aria-live="polite">{(open ?? 0) + 1} / {items.length}</span>
              <button type="button" className="btn small" onClick={() => go(1)} aria-label="Próxima foto">→</button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
