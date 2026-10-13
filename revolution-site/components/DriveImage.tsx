'use client';
import { useState } from 'react';
import { driveThumbUrl } from '@/lib/urls';

/** Foto do Drive em tamanhos otimizados (miniaturas do próprio Drive). Se falhar, mostra aviso em vez de imagem quebrada. */
export function DriveImage({ fileId, alt, sizes = '(max-width: 640px) 50vw, 25vw', eager = false }: { fileId: string; alt: string; sizes?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="img-fail" role="img" aria-label={alt || 'Imagem indisponível'}><span>Imagem indisponível</span></div>;
  const srcSet = [400, 800, 1200, 1600].map((w) => `${driveThumbUrl(fileId, w)} ${w}w`).join(', ');
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={driveThumbUrl(fileId, 800)} srcSet={srcSet} sizes={sizes} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
