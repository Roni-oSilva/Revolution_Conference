/** Animações do site (sem biblioteca): revelar ao rolar, barra de progresso, paralaxe e brilho que segue o mouse.
 *  Tudo é opcional: sem JS ou com "reduzir movimento" o conteúdo aparece normalmente. */
const REVEAL = [
  '.kicker', '.section-title', '.page-title', '.folders-head > *', '.livebox', '.day', '.slots li', '.where > *', '.fs > *',
  '.info > *', '.feed > *', '.vgrid > *', '.state', '.gallery li', '.chips', '.pager', '.lb-head',
].join(',');
const GLOW = '.card, .post, .vcard, .glass-card, .livebox, .where-card, .hero-card';

export function initMotion(): () => void {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const root = document.documentElement;
  root.classList.add('motion');

  // 1) revelar ao rolar (só o que ainda está fora da tela; o que já aparece usa as animações de entrada em CSS)
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  const seen = new WeakSet<Element>();
  const scan = () => {
    document.querySelectorAll<HTMLElement>(REVEAL).forEach((el) => {
      if (seen.has(el) || el.closest('.hero, #intro, dialog')) return;
      seen.add(el);
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
      const i = Array.prototype.indexOf.call(el.parentElement?.children ?? [], el);
      el.style.setProperty('--d', `${Math.min(Math.max(i, 0), 7) * 80}ms`);
      el.classList.add('rv');
      io.observe(el);
    });
  };
  scan();
  let t = 0;
  const mo = new MutationObserver(() => { clearTimeout(t); t = window.setTimeout(scan, 60); });
  const main = document.getElementById('conteudo');
  if (main) mo.observe(main, { childList: true, subtree: true });

  // 2) barra de progresso + paralaxe (variáveis CSS, uma vez por quadro)
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const max = Math.max(1, root.scrollHeight - window.innerHeight);
      root.style.setProperty('--sy', String(Math.round(window.scrollY)));
      root.style.setProperty('--p', (window.scrollY / max).toFixed(4));
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 3) brilho que segue o mouse nos cartões
  const onMove = (e: PointerEvent) => {
    const el = (e.target as Element | null)?.closest<HTMLElement>(GLOW);
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  document.addEventListener('pointermove', onMove, { passive: true });

  return () => { io.disconnect(); mo.disconnect(); window.removeEventListener('scroll', onScroll); document.removeEventListener('pointermove', onMove); root.classList.remove('motion'); };
}
