// Entrada: nome pegando fogo (mesmo algoritmo de components/Intro.tsx, em JS puro)
(function () {
  var intro = document.getElementById('intro'); if (!intro) return;
  var canvas = document.getElementById('introCanvas'), ctx = canvas.getContext('2d');
  var LINES = ['APAIXONADOS', 'PELA PRESENÇA'];
  var T_IGNITE = 0.55, T_SWEEP = 2.1, T_BURN_END = 4.7, T_END = 6.0;
  var ease = function (x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); };
  var easeOut = function (x) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3); };
  var noise = function (x, y, t) { return Math.sin(x * 1.7 + t * 1.9) * 0.5 + Math.sin(y * 1.3 - t * 2.3 + x * 0.6) * 0.35 + Math.sin((x + y) * 0.7 + t * 0.9) * 0.15; };
  var stopped = false, skipAt = null, raf = 0;
  function finish() { if (stopped) return; stopped = true; cancelAnimationFrame(raf); intro.style.opacity = '0'; setTimeout(function () { intro.remove(); document.documentElement.classList.remove('lock'); }, 750); }
  function skip() { if (skipAt === null) skipAt = performance.now(); }
  intro.addEventListener('click', skip); document.getElementById('introSkip').addEventListener('click', function (e) { e.stopPropagation(); skip(); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') skip(); });
  setTimeout(finish, 12000);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { intro.remove(); document.documentElement.classList.remove('lock'); return; }
  function sprites() {
    var out = [], stops = [[255, 244, 205], [255, 190, 80], [255, 120, 30], [225, 50, 14], [120, 18, 8]];
    for (var i = 0; i < 24; i++) {
      var f = (i / 23) * (stops.length - 1), a = stops[Math.floor(f)], b = stops[Math.min(stops.length - 1, Math.floor(f) + 1)], k = f - Math.floor(f);
      var c3 = [0, 1, 2].map(function (c) { return Math.round(a[c] + (b[c] - a[c]) * k); });
      var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d');
      var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(' + c3 + ',1)'); g.addColorStop(0.35, 'rgba(' + c3 + ',.55)'); g.addColorStop(1, 'rgba(' + c3 + ',0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64); out.push(c);
    }
    return out;
  }
  Promise.race([document.fonts.load('100px "Archivo Black"'), new Promise(function (r) { setTimeout(r, 1500); })]).then(function () {
    var small = innerWidth < 700, dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 2);
    var W = canvas.width = Math.round(innerWidth * dpr), H = canvas.height = Math.round(innerHeight * dpr);
    var family = '"Archivo Black", Impact, "Arial Black", sans-serif', fs = 100 * dpr;
    ctx.font = fs + 'px ' + family;
    var widest = Math.max.apply(null, LINES.map(function (l) { return ctx.measureText(l).width; }));
    fs = Math.min(fs * ((W * 0.86) / widest), (small ? 120 : 190) * dpr); ctx.font = fs + 'px ' + family;
    var lh = fs * 1.08, cy0 = H / 2 - ((LINES.length - 1) * lh) / 2;
    var off = document.createElement('canvas'); off.width = W; off.height = H;
    var o = off.getContext('2d', { willReadFrequently: true });
    o.font = ctx.font; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#fff';
    LINES.forEach(function (l, i) { o.fillText(l, W / 2, cy0 + i * lh); });
    var data = o.getImageData(0, 0, W, H).data, step = Math.max(2, Math.round(3 * dpr)), edge = [], inner = [], x0 = W, x1 = 0;
    for (var y = step; y < H; y += step) for (var x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 120) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); if (data[((y - step) * W + x) * 4 + 3] < 120) edge.push({ x: x, y: y }); else if (Math.random() < 0.06) inner.push({ x: x, y: y }); }
    }
    edge.sort(function (a, b) { return a.x - b.x; }); inner.sort(function (a, b) { return a.x - b.x; });
    var sp = sprites(), parts = [], MAX = small ? 850 : 1700, start = performance.now(), last = start, carry = 0;
    function spawn(e, ember, power) {
      if (parts.length >= MAX) return;
      var up = (ember ? 120 + Math.random() * 260 : 70 + Math.random() * 190) * dpr * power;
      parts.push({ x: e.x + (Math.random() - 0.5) * step * 1.5, y: e.y + (Math.random() - 0.5) * step, vx: (Math.random() - 0.5) * 60 * dpr, vy: -up, age: 0, life: ember ? 1.2 + Math.random() * 1.4 : 0.45 + Math.random() * 0.95, size: (ember ? 5 + Math.random() * 7 : 16 + Math.random() * 30) * dpr * (0.7 + 0.3 * power), ember: ember });
    }
    function prefix(arr, wx) { var lo = 0, hi = arr.length; while (lo < hi) { var m = (lo + hi) >> 1; if (arr[m].x <= wx) lo = m + 1; else hi = m; } return lo; }
    function frame(now) {
      if (stopped) return;
      var t = (now - start) / 1000, dt = Math.min(0.04, (now - last) / 1000); last = now;
      var skipK = 0; if (skipAt !== null) { skipK = Math.min(1, (now - skipAt) / 450); if (skipK >= 1) { finish(); return; } }
      var sweep = ease((t - T_IGNITE) / T_SWEEP), wx = x0 + (x1 - x0) * sweep, burnAway = easeOut((t - T_BURN_END + 0.2) / 1.3);
      var textA = (1 - burnAway) * (1 - skipK), pulse = 0.88 + 0.12 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      var glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6), ga = 0.22 * sweep * (1 - burnAway * 0.85);
      glow.addColorStop(0, 'rgba(255,110,30,' + ga + ')'); glow.addColorStop(0.5, 'rgba(160,30,10,' + ga * 0.45 + ')'); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      if (textA > 0.01 && sweep > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, Math.min(W, wx + fs * 0.035), H); ctx.clip(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        LINES.forEach(function (l, i) {
          var y = cy0 + i * lh - burnAway * fs * 0.075 * (i + 1), g = ctx.createLinearGradient(0, y - fs * 0.5, 0, y + fs * 0.5);
          g.addColorStop(0, '#fff6d6'); g.addColorStop(0.45, '#ffc15a'); g.addColorStop(1, '#ff4a1a');
          ctx.shadowColor = 'rgba(255,110,25,' + 0.95 * pulse + ')'; ctx.shadowBlur = fs * 0.42; ctx.globalAlpha = textA; ctx.fillStyle = g; ctx.fillText(l, W / 2, y);
        }); ctx.restore();
      }
      var nEdge = prefix(edge, wx), nInner = prefix(inner, wx), intensity = (1 - burnAway * 0.6) * (1 - skipK);
      carry += dt * (small ? 520 : 1100) * intensity * Math.min(1, 0.25 + sweep);
      while (carry >= 1 && nEdge > 0) { carry -= 1; spawn(edge[(Math.random() * nEdge) | 0], Math.random() < 0.08, 0.7 + 0.5 * Math.random() * pulse); }
      if (burnAway > 0 && nInner > 0) { var n = Math.round(dt * (small ? 380 : 800) * burnAway * (1 - burnAway * 0.5)); for (var i = 0; i < n; i++) spawn(inner[(Math.random() * nInner) | 0], Math.random() < 0.35, 1.05); }
      ctx.globalCompositeOperation = 'lighter';
      for (var j = parts.length - 1; j >= 0; j--) {
        var p = parts[j]; p.age += dt;
        if (p.age >= p.life) { parts[j] = parts[parts.length - 1]; parts.pop(); continue; }
        var k = p.age / p.life;
        p.vx += noise(p.x * 0.0035 / dpr, p.y * 0.0035 / dpr, t) * 520 * dpr * dt; p.vy *= p.ember ? 0.992 : 0.985; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt;
        var s = p.size * (p.ember ? 1 - k * 0.5 : (1 - k * 0.78) * (0.85 + 0.3 * Math.sin(k * 9 + p.x)));
        ctx.globalAlpha = Math.max(0, (p.ember ? 0.95 : 0.78) * Math.pow(1 - k, 1.25)) * (1 - skipK);
        ctx.drawImage(sp[Math.min(23, Math.floor(k * (p.ember ? 18 : 23)))], p.x - s, p.y - s, s * 2, s * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (t > T_END - 0.7) intro.style.opacity = String(Math.max(0, 1 - (t - (T_END - 0.7)) / 0.7));
      if (skipAt !== null) intro.style.opacity = String(Math.max(0, 1 - skipK));
      if (t >= T_END) { finish(); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  });
})();
