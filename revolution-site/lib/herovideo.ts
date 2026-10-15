/** Herói em vídeo: o vídeo do centro (cabeça) só anda quando o visitante ROLA a página (progresso da rolagem → tempo do vídeo).
 *  A cópia que fica por fora do círculo (as bordas laterais) roda em loop sozinha. */
const END = 6.0;                                  // segundo do vídeo em que a cabeça termina de levantar
const clamp = (x: number) => Math.min(1, Math.max(0, x));

export function initHeroScrub(section: HTMLElement, scrub: HTMLVideoElement, side?: HTMLVideoElement | null): () => void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let target = 0, cur = 0, raf = 0, ready = false;
  const seek = (t: number) => { try { if (!scrub.seeking) scrub.currentTime = t; } catch { /* ainda sem dados */ } };

  const progress = () => {
    const r = section.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - window.innerHeight));
  };
  const apply = () => {
    raf = 0;
    const p = progress();
    section.style.setProperty('--hp', p.toFixed(3));
    section.classList.toggle('hv-done', p > 0.72);
    target = p * END;
    cur += (target - cur) * 0.2;
    if (Math.abs(target - cur) < 0.004) cur = target;
    if (ready && Math.abs(scrub.currentTime - cur) > 0.008) seek(cur);
    if (cur !== target) raf = requestAnimationFrame(apply);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(apply); };

  const onReady = () => { ready = true; scrub.pause(); if (reduce) seek(END * 0.6); else { cur = progress() * END; seek(cur); } kick(); };
  scrub.pause();
  if (scrub.readyState >= 1) onReady(); else scrub.addEventListener('loadedmetadata', onReady, { once: true });

  if (side) { if (reduce) side.pause(); else void side.play().catch(() => { /* autoplay bloqueado: fica parado */ }); }
  if (!reduce) { window.addEventListener('scroll', kick, { passive: true }); window.addEventListener('resize', kick); }
  kick();
  return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', kick); window.removeEventListener('resize', kick); };
}
