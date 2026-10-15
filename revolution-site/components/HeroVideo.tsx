'use client';
import { useEffect, useRef } from 'react';
import { initHeroScrub } from '@/lib/herovideo';

/** Fundo em vídeo do herói. Centro = rola para a cabeça levantar; bordas laterais = giram sozinhas em loop. */
export function HeroVideo() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current; const section = root?.closest('section');
    if (!root || !section) return;
    return initHeroScrub(section as HTMLElement, root.querySelector<HTMLVideoElement>('video.hv-scrub')!, root.querySelector<HTMLVideoElement>('video.hv-side'));
  }, []);
  return (
    <div className="hv-media" ref={ref} aria-hidden="true">
      <video className="hv-scrub" src="/hero.mp4" poster="/hero-poster.jpg" muted playsInline preload="auto" tabIndex={-1} />
      <video className="hv-side" src="/hero.mp4" muted loop playsInline autoPlay preload="auto" tabIndex={-1} />
      <div className="hv-scrim" />
      <div className="hv-hint">Role</div>
    </div>
  );
}
