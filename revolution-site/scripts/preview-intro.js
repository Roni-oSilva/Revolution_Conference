// Entrada: o nome surge e se desintegra em partículas (mesmo algoritmo de components/Intro.tsx, em JS puro)
(function () {
  var intro = document.getElementById('intro'); if (!intro) return;
  var canvas = document.getElementById('introCanvas'), ctx = canvas.getContext('2d');
  var LINES = ['APAIXONADOS', 'PELA PRESENÇA'], T_IN = 1.5, T_HOLD = 2.5, T_WAVE = 2.3, T_END = 6.3;
  var c01 = function (x) { return Math.min(1, Math.max(0, x)); };
  var easeInOut = function (x) { var c = c01(x); return c * c * (3 - 2 * c); };
  var easeOut = function (x) { return 1 - Math.pow(1 - c01(x), 3); };
  var flow = function (x, y, t) { return Math.sin(x * 2.1 + t * 0.9) * 0.55 + Math.sin(y * 1.7 - t * 1.3 + x) * 0.45; };
  var stopped = false, skipAt = null, raf = 0;
  function finish() { if (stopped) return; stopped = true; cancelAnimationFrame(raf); intro.style.opacity = '0'; setTimeout(function () { intro.remove(); document.documentElement.classList.remove('lock'); }, 750); }
  function skip() { if (skipAt === null) skipAt = performance.now(); }
  intro.addEventListener('click', skip); document.getElementById('introSkip').addEventListener('click', function (e) { e.stopPropagation(); skip(); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') skip(); });
  setTimeout(finish, 12000);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { intro.remove(); document.documentElement.classList.remove('lock'); return; }
  Promise.race([document.fonts.load('100px "Archivo Black"'), new Promise(function (r) { setTimeout(r, 1500); })]).then(function () {
    var small = innerWidth < 700, dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 2);
    var W = canvas.width = Math.round(innerWidth * dpr), H = canvas.height = Math.round(innerHeight * dpr);
    var family = '"Archivo Black", Impact, "Arial Black", sans-serif', fs = 100 * dpr;
    ctx.font = fs + 'px ' + family;
    var widest = Math.max.apply(null, LINES.map(function (l) { return ctx.measureText(l).width; }));
    fs = Math.min(fs * ((W * 0.84) / widest), (small ? 110 : 170) * dpr);
    var font = fs + 'px ' + family, lh = fs * 1.1, cy0 = H / 2 - ((LINES.length - 1) * lh) / 2;
    var off = document.createElement('canvas'); off.width = W; off.height = H;
    var o = off.getContext('2d', { willReadFrequently: true });
    o.font = font; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#fff';
    LINES.forEach(function (l, i) { o.fillText(l, W / 2, cy0 + i * lh); });
    var data = o.getImageData(0, 0, W, H).data, step = Math.max(2, Math.round((small ? 3.4 : 2.6) * dpr)), pts = [], x0 = W, x1 = 0;
    for (var y = 0; y < H; y += step) for (var x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 140) { pts.push({ x: x, y: y }); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    pts.sort(function (a, b) { return a.x - b.x; });
    var live = [], next = 0, start = performance.now(), last = start;
    function frame(now) {
      if (stopped) return;
      var t = (now - start) / 1000, dt = Math.min(0.04, (now - last) / 1000); last = now;
      var skipK = 0; if (skipAt !== null) { skipK = Math.min(1, (now - skipAt) / 450); if (skipK >= 1) { finish(); return; } }
      var appear = easeOut(t / T_IN), wave = easeInOut((t - T_HOLD) / T_WAVE), wx = x0 - step + (x1 - x0 + 2 * step) * wave;
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      var halo = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.55), ha = 0.10 * appear * (1 - wave * 0.8);
      halo.addColorStop(0, 'rgba(223,37,49,' + ha + ')'); halo.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
      if (wave < 1) {
        ctx.save(); ctx.beginPath(); ctx.rect(Math.max(0, wx), 0, W, H); ctx.clip(); ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var scale = 1.035 - 0.035 * appear;
        LINES.forEach(function (l, i) {
          var yy = cy0 + i * lh + (1 - appear) * fs * 0.12 * (i + 1);
          ctx.save(); ctx.translate(W / 2, yy); ctx.scale(scale, scale); ctx.globalAlpha = appear * (1 - skipK); ctx.fillStyle = '#fff';
          ctx.shadowColor = 'rgba(255,255,255,.35)'; ctx.shadowBlur = fs * 0.18 * appear; ctx.fillText(l, 0, 0); ctx.restore();
        }); ctx.restore();
      }
      while (next < pts.length && pts[next].x <= wx) {
        var p0 = pts[next++], a = Math.random() * Math.PI * 2, v = (0.25 + Math.random() * 1.1) * 62 * dpr;
        live.push({ x: p0.x, y: p0.y, vx: Math.cos(a) * v * 0.6 + 40 * dpr, vy: Math.sin(a) * v - 30 * dpr, age: 0, life: 1.1 + Math.random() * 1.7, s: step * (0.45 + Math.random() * 0.5), tone: Math.random() });
      }
      for (var i = live.length - 1; i >= 0; i--) {
        var p = live[i]; p.age += dt;
        if (p.age >= p.life) { live[i] = live[live.length - 1]; live.pop(); continue; }
        var f = flow(p.x * 0.004 / dpr, p.y * 0.004 / dpr, t);
        p.vx += f * 90 * dpr * dt; p.vy += (flow(p.y * 0.004 / dpr, p.x * 0.004 / dpr, t + 3) * 90 - 18) * dpr * dt;
        var drag = Math.pow(0.5, dt * 1.6); p.vx *= drag; p.vy *= drag; p.x += p.vx * dt; p.y += p.vy * dt;
        var k = p.age / p.life; ctx.globalAlpha = Math.pow(1 - k, 1.4) * 0.95 * (1 - skipK);
        ctx.fillStyle = p.tone > 0.9 ? '#df2531' : p.tone > 0.45 ? '#ffffff' : '#c9c9c9';
        var s = p.s * (1 - k * 0.55); ctx.fillRect(p.x, p.y, s, s);
      }
      ctx.globalAlpha = 1;
      if (t > T_END - 0.8) intro.style.opacity = String(Math.max(0, 1 - (t - (T_END - 0.8)) / 0.8));
      if (skipAt !== null) intro.style.opacity = String(Math.max(0, 1 - skipK));
      if (t >= T_END) { finish(); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  });
})();
