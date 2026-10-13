'use client';
import { useEffect, useRef, useState } from 'react';

/** Entrada do site: "APAIXONADOS PELA PRESENÇA" é acendido da esquerda para a direita, queima e se desfaz em brasas.
 *  Canvas 2D com partículas aditivas (sem bibliotecas). Pula com clique/Enter/Esc/botão; some sozinha (CSS) mesmo se o JS falhar;
 *  não aparece para quem prefere movimento reduzido nem de novo na mesma sessão. */
const SEEN = 'rv_intro_seen';
const LINES = ['APAIXONADOS', 'PELA PRESENÇA'];
const T_IGNITE = 0.55, T_SWEEP = 2.1, T_BURN_END = 4.7, T_END = 6.0;

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

// ruído suave e barato (soma de senos) → movimento fluido das chamas
const noise = (x: number, y: number, t: number) =>
  Math.sin(x * 1.7 + t * 1.9) * 0.5 + Math.sin(y * 1.3 - t * 2.3 + x * 0.6) * 0.35 + Math.sin((x + y) * 0.7 + t * 0.9) * 0.15;

interface P { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; ember: boolean }

function makeSprites(): HTMLCanvasElement[] {
  // 24 estágios de cor: branco-amarelo → laranja → vermelho → brasa escura
  const out: HTMLCanvasElement[] = [];
  const stops = [[255, 244, 205], [255, 190, 80], [255, 120, 30], [225, 50, 14], [120, 18, 8]];
  for (let i = 0; i < 24; i++) {
    const f = (i / 23) * (stops.length - 1);
    const a = stops[Math.floor(f)], b = stops[Math.min(stops.length - 1, Math.floor(f) + 1)], k = f - Math.floor(f);
    const [r, g, bl] = [0, 1, 2].map((c) => Math.round(a[c] + (b[c] - a[c]) * k));
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${r},${g},${bl},1)`); grad.addColorStop(0.35, `rgba(${r},${g},${bl},.55)`); grad.addColorStop(1, `rgba(${r},${g},${bl},0)`);
    x.fillStyle = grad; x.fillRect(0, 0, 64, 64);
    out.push(c);
  }
  return out;
}

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
      try { await Promise.race([document.fonts.load('100px "Archivo Black"'), new Promise((r) => setTimeout(r, 1500))]); } catch { /* usa fonte de reserva */ }
      if (stopped) return;
      const small = window.innerWidth < 700;
      const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      const W = (canvas.width = Math.round(window.innerWidth * dpr));
      const H = (canvas.height = Math.round(window.innerHeight * dpr));
      canvas.style.width = '100%'; canvas.style.height = '100%';

      // layout do texto (ajusta para caber)
      const family = '"Archivo Black", Impact, "Arial Black", sans-serif';
      let fs = 100 * dpr;
      ctx.font = `${fs}px ${family}`;
      const widest = Math.max(...LINES.map((l) => ctx.measureText(l).width));
      fs = Math.min(fs * ((W * 0.86) / widest), (small ? 120 : 190) * dpr);
      ctx.font = `${fs}px ${family}`;
      const lh = fs * 1.08;
      const cy0 = H / 2 - ((LINES.length - 1) * lh) / 2;

      // máscara do texto → pontos emissores (borda superior + um pouco do miolo)
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      const o = off.getContext('2d', { willReadFrequently: true })!;
      o.font = ctx.font; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#fff';
      LINES.forEach((l, i) => o.fillText(l, W / 2, cy0 + i * lh));
      const data = o.getImageData(0, 0, W, H).data;
      const step = Math.max(2, Math.round(3 * dpr));
      const edge: { x: number; y: number }[] = [];
      const inner: { x: number; y: number }[] = [];
      let x0 = W, x1 = 0;
      for (let y = step; y < H; y += step) for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 120) {
          x0 = Math.min(x0, x); x1 = Math.max(x1, x);
          const above = data[((y - step) * W + x) * 4 + 3];
          if (above < 120) edge.push({ x, y }); else if (Math.random() < 0.06) inner.push({ x, y });
        }
      }
      edge.sort((a, b) => a.x - b.x); inner.sort((a, b) => a.x - b.x);
      const sprites = makeSprites();
      const parts: P[] = [];
      const MAX = small ? 850 : 1700;
      const start = performance.now();
      let last = start, carry = 0;

      const spawn = (e: { x: number; y: number }, ember: boolean, power: number) => {
        if (parts.length >= MAX) return;
        const up = (ember ? 120 + Math.random() * 260 : 70 + Math.random() * 190) * dpr * power;
        parts.push({
          x: e.x + (Math.random() - 0.5) * step * 1.5, y: e.y + (Math.random() - 0.5) * step,
          vx: (Math.random() - 0.5) * 60 * dpr, vy: -up,
          age: 0, life: ember ? 1.2 + Math.random() * 1.4 : 0.45 + Math.random() * 0.95,
          size: (ember ? 5 + Math.random() * 7 : 16 + Math.random() * 30) * dpr * (0.7 + 0.3 * power), ember,
        });
      };
      const prefix = (arr: { x: number }[], wx: number) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].x <= wx) lo = m + 1; else hi = m; } return lo; };

      const frame = (now: number) => {
        if (stopped) return;
        const t = (now - start) / 1000;
        const dt = Math.min(0.04, (now - last) / 1000); last = now;
        let skipK = 0;
        if (skipAt !== null) { skipK = Math.min(1, (now - skipAt) / 450); if (skipK >= 1) { finish(); return; } }

        const sweep = ease((t - T_IGNITE) / T_SWEEP);
        const wx = x0 + (x1 - x0) * sweep;
        const burnAway = easeOut((t - T_BURN_END + 0.2) / 1.3);          // 0 → 1 (texto se desfaz)
        const textA = (1 - burnAway) * (1 - skipK);
        const pulse = 0.88 + 0.12 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1);

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        // halo ambiente quente que cresce com a chama
        const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
        const ga = 0.22 * sweep * (1 - burnAway * 0.85);
        glow.addColorStop(0, `rgba(255,110,30,${ga})`); glow.addColorStop(0.5, `rgba(160,30,10,${ga * 0.45})`); glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

        // texto: revelado pela varredura de fogo (borda suave) e depois consumido
        if (textA > 0.01 && sweep > 0) {
          ctx.save();
          const edgeSoft = fs * 0.35;
          ctx.beginPath(); ctx.rect(0, 0, Math.min(W, wx + edgeSoft * 0.1), H); ctx.clip();
          ctx.font = ctx.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          LINES.forEach((l, i) => {
            const y = cy0 + i * lh - burnAway * fs * 0.25 * (i + 1) * 0.3;
            const g = ctx.createLinearGradient(0, y - fs * 0.5, 0, y + fs * 0.5);
            g.addColorStop(0, '#fff6d6'); g.addColorStop(0.45, '#ffc15a'); g.addColorStop(1, '#ff4a1a');
            ctx.shadowColor = `rgba(255,110,25,${0.95 * pulse})`; ctx.shadowBlur = fs * 0.42;
            ctx.globalAlpha = textA; ctx.fillStyle = g; ctx.fillText(l, W / 2, y);
          });
          ctx.restore();
        }

        // emissão de chamas (só onde o fogo já passou) e brasas
        const nEdge = prefix(edge, wx), nInner = prefix(inner, wx);
        const intensity = (1 - burnAway * 0.6) * (1 - skipK);
        carry += dt * (small ? 520 : 1100) * intensity * Math.min(1, 0.25 + sweep);
        while (carry >= 1 && nEdge > 0) {
          carry -= 1;
          const e = edge[(Math.random() * nEdge) | 0];
          spawn(e, Math.random() < 0.08, 0.7 + 0.5 * Math.random() * pulse);
        }
        // fase final: o miolo das letras também vira brasa
        if (burnAway > 0 && nInner > 0) {
          const n = Math.round(dt * (small ? 380 : 800) * burnAway * (1 - burnAway * 0.5));
          for (let i = 0; i < n; i++) spawn(inner[(Math.random() * nInner) | 0], Math.random() < 0.35, 1.05);
        }

        // atualização + desenho aditivo
        ctx.globalCompositeOperation = 'lighter';
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.age += dt;
          if (p.age >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
          const k = p.age / p.life;
          p.vx += noise(p.x * 0.0035 / dpr, p.y * 0.0035 / dpr, t) * 520 * dpr * dt;
          p.vy *= p.ember ? 0.992 : 0.985; p.vx *= 0.985;
          p.x += p.vx * dt; p.y += p.vy * dt;
          const s = p.size * (p.ember ? 1 - k * 0.5 : (1 - k * 0.78) * (0.85 + 0.3 * Math.sin(k * 9 + p.x)));
          ctx.globalAlpha = Math.max(0, (p.ember ? 0.95 : 0.78) * Math.pow(1 - k, 1.25)) * (1 - skipK);
          const sp = sprites[Math.min(23, Math.floor(k * (p.ember ? 18 : 23)))];
          ctx.drawImage(sp, p.x - s, p.y - s, s * 2, s * 2);
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

        if (t > T_END - 0.7) root.style.opacity = String(Math.max(0, 1 - (t - (T_END - 0.7)) / 0.7));
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
      <p className="intro-static" aria-hidden="true">Apaixonados<br />pela Presença</p>
      <button type="button" className="intro-skip" onClick={(e) => { e.stopPropagation(); skipRef.current(); }}>Pular introdução</button>
      <noscript><style>{'#intro{display:none!important}'}</style></noscript>
    </div>
  );
}
