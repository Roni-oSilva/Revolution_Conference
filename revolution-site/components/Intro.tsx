'use client';
import { useEffect, useRef, useState } from 'react';

/** Entrada do site: "APAIXONADOS PELA PRESENÇA" surge suavemente e se DESINTEGRA em partículas, da esquerda para a direita.
 *  Canvas 2D (sem bibliotecas). Pula com clique/Enter/Esc/botão; some sozinha (CSS) mesmo se o JS falhar;
 *  não aparece para quem prefere movimento reduzido nem de novo na mesma sessão. */
const SEEN = 'rv_intro_seen';
const LINES = ['APAIXONADOS', 'PELA PRESENÇA'];
const T_IN = 1.5, T_HOLD = 2.5, T_WAVE = 2.3, T_END = 6.3;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c); };
const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
// ruído suave (soma de senos): arrasta as partículas em redemoinhos lentos
const flow = (x: number, y: number, t: number) => Math.sin(x * 2.1 + t * 0.9) * 0.55 + Math.sin(y * 1.7 - t * 1.3 + x) * 0.45;

export function Intro() {
  const [gone, setGone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<() => void>(() => {});

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN) === '1'; } catch { /* storage bloqueado: mostra */ }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mark = () => { try { sessionStorage.setItem(SEEN, '1'); } catch { /* ignore */ } };
    if (seen || reduce) { mark(); setGone(true); return; }

    const canvas = canvasRef.current!;
    const root = rootRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setGone(true); return; }

    let raf = 0, stopped = false, skipAt: number | null = null;
    const finish = () => {
      if (stopped) return; stopped = true; cancelAnimationFrame(raf); mark();
      root.style.opacity = '0';
      window.setTimeout(() => setGone(true), 750);
    };
    skipRef.current = () => { if (skipAt === null) skipAt = performance.now(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') skipRef.current(); };
    window.addEventListener('keydown', onKey);
    const safety = window.setTimeout(finish, 12000);

    (async () => {
      const fam = getComputedStyle(document.documentElement).getPropertyValue('--font-title').trim() || 'Plus Jakarta Sans';
      try { await Promise.race([document.fonts.load(`100px ${fam}`), new Promise((r) => setTimeout(r, 1500))]); } catch { /* fonte de reserva */ }
      if (stopped) return;
      const small = window.innerWidth < 700;
      const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      const W = (canvas.width = Math.round(window.innerWidth * dpr));
      const H = (canvas.height = Math.round(window.innerHeight * dpr));
      canvas.style.width = '100%'; canvas.style.height = '100%';

      // texto ajustado à largura
      const family = `${fam}, "Plus Jakarta Sans", "Segoe UI", sans-serif, sans-serif`;
      let fs = 100 * dpr;
      ctx.font = `${fs}px ${family}`;
      const widest = Math.max(...LINES.map((l) => ctx.measureText(l).width));
      fs = Math.min(fs * ((W * 0.84) / widest), (small ? 110 : 170) * dpr);
      const font = `${fs}px ${family}`;
      const lh = fs * 1.1;
      const cy0 = H / 2 - ((LINES.length - 1) * lh) / 2;

      // amostragem dos pixels do texto → partículas (ordenadas por x para a onda da esquerda para a direita)
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      const o = off.getContext('2d', { willReadFrequently: true })!;
      o.font = font; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#fff';
      LINES.forEach((l, i) => o.fillText(l, W / 2, cy0 + i * lh));
      const data = o.getImageData(0, 0, W, H).data;
      const step = Math.max(2, Math.round((small ? 3.4 : 2.6) * dpr));
      const pts: { x: number; y: number }[] = [];
      let x0 = W, x1 = 0;
      for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 140) { pts.push({ x, y }); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      }
      pts.sort((a, b) => a.x - b.x);

      interface P { x: number; y: number; vx: number; vy: number; age: number; life: number; s: number; tone: number }
      const live: P[] = [];
      let next = 0;                       // próximo ponto a se soltar
      const start = performance.now();
      let last = start;

      const frame = (now: number) => {
        if (stopped) return;
        const t = (now - start) / 1000;
        const dt = Math.min(0.04, (now - last) / 1000); last = now;
        let skipK = 0;
        if (skipAt !== null) { skipK = Math.min(1, (now - skipAt) / 450); if (skipK >= 1) { finish(); return; } }

        const appear = easeOutCubic(t / T_IN);                                  // surge suave
        const wave = easeInOut((t - T_HOLD) / T_WAVE);                           // 0 → 1: frente da desintegração
        const wx = x0 - step + (x1 - x0 + 2 * step) * wave;

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

        // brilho ambiente discreto atrás do nome
        const halo = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.55);
        const ha = 0.10 * appear * (1 - wave * 0.8);
        halo.addColorStop(0, `rgba(242,107,29,${ha})`); halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);

        // texto ainda intacto (à direita da frente da onda)
        if (wave < 1) {
          ctx.save();
          ctx.beginPath(); ctx.rect(Math.max(0, wx), 0, W, H); ctx.clip();
          ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const scale = 1.035 - 0.035 * appear;                                  // assenta suavemente
          LINES.forEach((l, i) => {
            const y = cy0 + i * lh + (1 - appear) * fs * 0.12 * (i + 1);
            ctx.save(); ctx.translate(W / 2, y); ctx.scale(scale, scale);
            ctx.globalAlpha = appear * (1 - skipK);
            ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(255,255,255,.35)'; ctx.shadowBlur = fs * 0.18 * appear;
            ctx.fillText(l, 0, 0); ctx.restore();
          });
          ctx.restore();
        }

        // solta as partículas que a onda alcançou
        while (next < pts.length && pts[next].x <= wx) {
          const p = pts[next++];
          const a = Math.random() * Math.PI * 2, v = (0.25 + Math.random() * 1.1) * 62 * dpr;
          live.push({ x: p.x, y: p.y, vx: Math.cos(a) * v * 0.6 + 40 * dpr, vy: Math.sin(a) * v - 30 * dpr, age: 0, life: 1.1 + Math.random() * 1.7, s: step * (0.45 + Math.random() * 0.5), tone: Math.random() });
        }

        // física suave: arrasto + redemoinho; desaparecem com fade
        for (let i = live.length - 1; i >= 0; i--) {
          const p = live[i];
          p.age += dt;
          if (p.age >= p.life) { live[i] = live[live.length - 1]; live.pop(); continue; }
          const f = flow(p.x * 0.004 / dpr, p.y * 0.004 / dpr, t);
          p.vx += f * 90 * dpr * dt; p.vy += (flow(p.y * 0.004 / dpr, p.x * 0.004 / dpr, t + 3) * 90 - 18) * dpr * dt;
          const drag = Math.pow(0.5, dt * 1.6);
          p.vx *= drag; p.vy *= drag;
          p.x += p.vx * dt; p.y += p.vy * dt;
          const k = p.age / p.life;
          ctx.globalAlpha = Math.pow(1 - k, 1.4) * 0.95 * (1 - skipK);
          ctx.fillStyle = p.tone > 0.9 ? '#f26b1d' : p.tone > 0.45 ? '#ffffff' : '#c9c9c9';
          const s = p.s * (1 - k * 0.55);
          ctx.fillRect(p.x, p.y, s, s);
        }
        ctx.globalAlpha = 1;

        if (t > T_END - 0.8) root.style.opacity = String(Math.max(0, 1 - (t - (T_END - 0.8)) / 0.8));
        if (skipAt !== null) root.style.opacity = String(Math.max(0, 1 - skipK));
        if (t >= T_END) { finish(); return; }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    })();

    return () => { stopped = true; cancelAnimationFrame(raf); clearTimeout(safety); window.removeEventListener('keydown', onKey); };
  }, []);

  if (gone) return null;
  return (
    <div id="intro" ref={rootRef} onClick={() => skipRef.current()} role="presentation">
      <canvas ref={canvasRef} aria-hidden="true" />
      <button type="button" className="intro-skip" onClick={(e) => { e.stopPropagation(); skipRef.current(); }}>Pular introdução</button>
      <noscript><style>{'#intro{display:none!important}'}</style></noscript>
    </div>
  );
}
