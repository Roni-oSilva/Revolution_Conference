// Testes E2E: Chromium real → app Next.js (produção) → PostgREST real → Postgres (PGlite) com as migrações e o RLS.
// Auth e Realtime são SIMULADOS/ausentes (ver tests/e2e/infra.mjs e docs/TESTES.md).
import { createRequire } from 'node:module';
import { startInfra, USERS, ANON_KEY, SERVICE_KEY } from './infra.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const results = [];
const only = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, m) => { if (!c) throw new Error(m || 'asserção falhou'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m || 'esperado'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); };
async function waitFor(fn, ms = 10000, step = 120, what = 'condição') {
  const t = Date.now(); let last;
  for (;;) { try { const v = await fn(); if (v) return v; } catch (e) { last = e; } if (Date.now() - t > ms) throw new Error(`timeout esperando ${what}${last ? ': ' + last.message.split('\n')[0] : ''}`); await sleep(step); }
}
async function test(name, fn) {
  if (only && !only.test(name)) return;
  const t0 = Date.now();
  try { await fn(); results.push([true, name]); console.log(`  ✔ ${name} (${Date.now() - t0} ms)`); }
  catch (e) { results.push([false, name, e]); console.log(`  ✘ ${name}\n      ${String(e.message).split('\n')[0]}`); if (process.env.DEBUG_E2E) console.log(e.stack); }
}
const group = (t) => console.log(`\n${t}`);

const infra = await startInfra();
const { db, base, apiBase, control } = infra;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });

// ───────────── utilidades ─────────────
const EXTERNAL = /(drive\.google\.com|googleusercontent|ytimg|youtube|fonts\.g)/;
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1280, height: 800 }, isMobile: !!opts.mobile, hasTouch: !!opts.mobile, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: opts.reducedMotion });
  // a entrada com fogo é testada à parte; nos demais testes ela é marcada como "já vista" nesta sessão
  if (!opts.intro) await ctx.addInitScript(`try{sessionStorage.setItem('rv_intro_seen','1')}catch(e){}`);
  if (opts.init) await ctx.addInitScript(opts.init);
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location().url || '';
    if (EXTERNAL.test(url) || /WebSocket|net::ERR|Failed to load resource/.test(m.text())) return; // rede externa/realtime não existem no ambiente de teste
    page.problems.push('console: ' + m.text());
  });
  return page;
}
const done = async (page) => { await page.context().close(); };
const noProblems = (page) => eq(page.problems, [], 'erros de console/página (incl. violações de CSP)');

async function reset() {
  control.down = false; control.authFail = false;
  await db.exec(`
    delete from public.post_reactions; delete from public.rate_limits; delete from public.wall_posts; delete from public.media; delete from public.videos;
    update public.event_settings set name='Revolution Conference', description='', timezone='America/Sao_Paulo', starts_at = now() + interval '30 days', opens_at = now() + interval '30 days', ends_at = null,
      location_name = null, address = null, maps_url = null, stream_enabled = false, stream_url = null, stream_video_id = null, stream_note = '';
    update public.site_settings set site_title='Revolution Conference', tagline='', seo_description='', hero_image_url=null, instagram_url=null, youtube_channel_url=null, whatsapp_url=null, privacy_text=null,
      reactions_enabled = true, reaction_limit_per_minute = 20, reaction_limit_per_ip_minute = 120;`);
}
let seq = 0;
async function post(o = {}) {
  seq++;
  const r = await db.query(`insert into public.wall_posts (title, body, status, position, is_highlight, created_at) values ($1,$2,$3,$4,$5, now() - ($6 || ' seconds')::interval) returning id`,
    [o.title ?? '', o.body ?? `Texto ${seq}`, o.status ?? 'published', o.position ?? 0, !!o.highlight, String(o.ageSec ?? (1000 - seq))]);
  return r.rows[0].id;
}
const setOpen = (sql) => db.exec(`update public.event_settings set opens_at = ${sql}, starts_at = ${sql}`);
async function login(page, user) {
  await page.goto(`${base}/admin/login`);
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha').fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}
const loginOk = async (page, user) => { await login(page, user); await waitFor(() => new URL(page.url()).pathname === '/admin', 15000, 150, 'ir ao dashboard'); };
const flash = async (page) => (await page.locator('.msg').first().textContent({ timeout: 8000 }))?.trim();
const countRows = async (sql, params = []) => Number((await db.query(sql, params)).rows[0].c);
const jsonPost = (path, body, headers = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base, ...headers }, body: JSON.stringify(body) });
const A = (n) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
const restHeaders = (key = ANON_KEY, extra = {}) => ({ apikey: ANON_KEY, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...extra });
async function userToken(u) {
  const r = await fetch(`${apiBase}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: u.email, password: u.password }) });
  return (await r.json()).access_token;
}

// ═════════════════════════ 1. Navegação, abas e estados vazios ═════════════════════════
group('Navegação e páginas públicas');
await reset();

await test('só 3 abas públicas (Início, Ao Vivo, Mural), navegação e aba ativa; sem erros/CSP', async () => {
  const page = await newPage();
  await page.goto(base);
  eq(await page.locator('nav[aria-label="Principal"] a').allTextContents(), ['Início', 'Ao Vivo', 'Mural']);
  eq(await page.locator('nav a[aria-current="page"]').textContent(), 'Início');
  await page.getByRole('link', { name: 'Ao Vivo' }).first().click();
  await waitFor(() => new URL(page.url()).pathname === '/ao-vivo');
  eq(await page.locator('nav a[aria-current="page"]').textContent(), 'Ao Vivo');
  await page.getByRole('link', { name: 'Mural' }).first().click();
  await waitFor(() => new URL(page.url()).pathname === '/mural');
  eq(await page.locator('nav a[aria-current="page"]').textContent(), 'Mural');
  await page.waitForLoadState('networkidle');
  noProblems(page);
  await done(page);
});

await test('cabeçalhos de segurança: CSP com nonce, sem iframe externo, nosniff, frame DENY', async () => {
  const r = await fetch(base);
  const csp = r.headers.get('content-security-policy') ?? '';
  ok(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/.test(csp), 'script-src com nonce: ' + csp);
  ok(csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'") && csp.includes('frame-src https://www.youtube-nocookie.com'));
  ok(!/unsafe-eval/.test(csp), 'sem unsafe-eval em produção');
  eq(r.headers.get('x-content-type-options'), 'nosniff'); eq(r.headers.get('x-frame-options'), 'DENY');
  ok(!r.headers.has('x-powered-by'));
});

await test('estados vazios: início, ao vivo e mural', async () => {
  const page = await newPage();
  await page.goto(base); await page.getByText('Fotos em breve').waitFor();
  await page.goto(`${base}/ao-vivo`); await page.getByText('Nenhuma transmissão no momento').waitFor(); await page.getByText('Ainda não há vídeos').waitFor();
  await page.goto(`${base}/mural`); await page.getByText('O mural ainda está vazio').waitFor();
  eq(await page.locator('iframe').count(), 0);
  await done(page);
});

await test('páginas utilitárias: privacidade, robots, sitemap, 404, UUID inválido', async () => {
  const page = await newPage();
  await page.goto(`${base}/privacidade`); await page.getByRole('heading', { name: 'Privacidade' }).waitFor();
  ok((await page.locator('main').innerText()).includes('não é possível garantir uma única reação por pessoa'));
  const robots = await (await fetch(`${base}/robots.txt`)).text();
  ok(/Disallow: \/admin/.test(robots) && /Disallow: \/api/.test(robots) && /Sitemap:/.test(robots), robots);
  const sm = await (await fetch(`${base}/sitemap.xml`)).text();
  ok(sm.includes('/ao-vivo') && sm.includes('/mural') && !sm.includes('/admin'));
  eq((await fetch(`${base}/mural/nao-e-uuid`)).status, 404);
  const unknown = await fetch(`${base}/mural/99999999-9999-4999-8999-999999999999`); // UUID válido mas inexistente: página com aviso + noindex
  ok(unknown.status === 200 || unknown.status === 404); ok((await unknown.text()).includes('noindex'), 'noindex na publicação inexistente');
  await page.goto(`${base}/mural/99999999-9999-4999-8999-999999999999`); await page.getByText('Publicação não encontrada').waitFor();
  eq((await fetch(`${base}/rota-inexistente`)).status, 404);
  await done(page);
});

await test('SEO básico: título, descrição, Open Graph e lang', async () => {
  await db.exec(`update public.site_settings set site_title='Revolution Conference 2026', seo_description='Site oficial', hero_image_url='https://exemplo.com/banner.jpg'`);
  const page = await newPage();
  await page.goto(base);
  eq(await page.locator('html').getAttribute('lang'), 'pt-BR');
  ok((await page.title()).includes('Revolution Conference 2026'));
  eq(await page.locator('meta[name="description"]').getAttribute('content'), 'Site oficial');
  eq(await page.locator('meta[property="og:image"]').getAttribute('content'), 'https://exemplo.com/banner.jpg');
  eq(await page.locator('meta[property="og:locale"]').getAttribute('content'), 'pt_BR');
  await done(page);
  await reset();
});

// ═════════════════════════ 2. Responsividade, mobile, teclado ═════════════════════════
group('Responsividade e acessibilidade');
await test('sem rolagem horizontal em 360, 768 e 1280 px (3 páginas)', async () => {
  const id = await post({ title: 'Olá', body: 'a'.repeat(300), highlight: true });
  for (const w of [360, 768, 1280]) {
    const page = await newPage({ viewport: { width: w, height: 800 } });
    for (const path of ['/', '/ao-vivo', '/mural', `/mural/${id}`]) {
      await page.goto(base + path); await page.waitForLoadState('networkidle');
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(over <= 1, `${w}px ${path}: overflow ${over}`);
    }
    await done(page);
  }
});

await test('celular: abas visíveis, alvos de toque ≥ 44px nas reações', async () => {
  await reset(); await post({ title: 'Mobile' });
  const page = await newPage({ viewport: { width: 390, height: 844 }, mobile: true });
  await page.goto(`${base}/mural`);
  ok(await page.getByRole('link', { name: 'Mural' }).first().isVisible());
  const boxes = await page.locator('.react').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }));
  ok(boxes.length === 5 && boxes.every(([w, h]) => w >= 44 && h >= 44), JSON.stringify(boxes));
  await done(page);
});

await test('teclado: primeiro Tab vai ao "Pular para o conteúdo"; reação por Enter/Espaço; diálogo da galeria abre e fecha com Esc', async () => {
  await db.exec(`insert into public.media (original_url, drive_file_id, is_published, availability) values ('https://drive.google.com/file/d/AAAAAAAAAAAAAA/view','AAAAAAAAAAAAAA', true, 'ok')`);
  const id = await post({ title: 'Teclado' });
  const page = await newPage();
  await page.goto(base);
  await page.keyboard.press('Tab');
  eq(await page.evaluate(() => document.activeElement?.textContent), 'Pular para o conteúdo');
  await page.locator('.gallery button.g').first().focus();
  await page.keyboard.press('Enter');
  await waitFor(() => page.locator('dialog[open]').count());
  await page.keyboard.press('Escape');
  await waitFor(async () => (await page.locator('dialog[open]').count()) === 0);
  await page.goto(`${base}/mural`);
  const fire = page.locator(`[data-post-id="${id}"] .react[data-emoji="🔥"]`);
  await fire.focus(); await page.keyboard.press('Enter');
  await waitFor(async () => (await fire.getAttribute('aria-pressed')) === 'true');
  await page.keyboard.press('Space'); // alterna (remove)
  await waitFor(async () => (await fire.getAttribute('aria-pressed')) === 'false');
  await done(page);
  await reset();
});

// ═════════════════════════ 3. Contagem e troca de fase ═════════════════════════
group('Contagem regressiva e troca de fase');
await test('contagem correta a partir do horário do servidor (2d 3h 4m)', async () => {
  await setOpen(`now() + interval '2 days 3 hours 4 minutes 30 seconds'`);
  const page = await newPage();
  await page.goto(base);
  const label = await page.locator('[role="timer"]').getAttribute('aria-label');
  ok(/^Faltam 2 dias, 3 horas, 4 minutos e \d+ segundos$/.test(label ?? ''), label ?? 'sem timer');
  const first = await page.locator('.count b').allTextContents();
  eq(first.slice(0, 3), ['02', '03', '04']);
  await sleep(1500);
  const second = await page.locator('.count b').last().textContent();
  ok(second !== first[3], 'os segundos avançam');
  await done(page);
});

await test('troca de fase automática SEM recarregar (pré → pós-abertura)', async () => {
  await setOpen(`now() + interval '7 seconds'`);
  const page = await newPage();
  await page.goto(base);
  await page.getByText('Em breve', { exact: true }).first().waitFor();
  await page.evaluate(() => { window.__naoRecarregou = 'sim'; });
  eq(await page.locator('[role="timer"]').count(), 1);
  await page.locator('.hero .kicker', { hasText: /Começou|Ao vivo agora/ }).waitFor({ timeout: 20000 });
  eq(await page.evaluate(() => window.__naoRecarregou), 'sim', 'a página não foi recarregada');
  eq(await page.locator('[role="timer"]').count(), 0, 'contagem some na nova fase');
  ok(await page.getByRole('link', { name: 'Ver o mural' }).isVisible());
  await done(page);
});

await test('abrir ou atualizar depois do horário mostra direto a fase nova', async () => {
  await setOpen(`now() - interval '1 hour'`);
  const page = await newPage();
  await page.goto(base);
  await page.locator('.hero .kicker', { hasText: 'Começou' }).waitFor();
  eq(await page.locator('[role="timer"]').count(), 0);
  await page.reload();
  await page.locator('.hero .kicker', { hasText: 'Começou' }).waitFor();
  await done(page);
});

await test('relógio do visitante errado (+10 dias / −10 dias): vale a hora do servidor', async () => {
  await setOpen(`now() + interval '1 hour'`);
  for (const shift of [10 * 86400e3, -10 * 86400e3]) {
    const page = await newPage({ init: `(()=>{const R=Date.now.bind(Date);Date.now=()=>R()+(${shift});})();` });
    await page.goto(base);
    await page.waitForLoadState('networkidle'); await sleep(1200);
    eq(await page.locator('.hero .kicker').first().textContent(), 'Em breve', `deslocamento ${shift}`);
    const label = await page.locator('[role="timer"]').getAttribute('aria-label');
    ok(/^Faltam 0 dias, 0 horas, (5\d|4\d) minutos/.test(label ?? ''), label ?? '');
    await done(page);
  }
});

await test('aba suspensa: ao voltar a ficar visível ressincroniza e aplica a fase correta', async () => {
  await setOpen(`now() + interval '1 hour'`);
  const page = await newPage();
  await page.goto(base);
  await page.locator('.hero .kicker', { hasText: 'Em breve' }).waitFor();
  await setOpen(`now() - interval '1 minute'`); // enquanto a aba "dormia", a abertura passou (admin antecipou)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.locator('.hero .kicker', { hasText: 'Começou' }).waitFor({ timeout: 15000 });
  await done(page);
});

await test('fase "encerrada" quando há data de fim', async () => {
  await db.exec(`update public.event_settings set opens_at = now() - interval '2 hours', ends_at = now() - interval '1 hour'`);
  const page = await newPage();
  await page.goto(base);
  await page.getByRole('heading', { name: /Obrigado por viver/i }).waitFor();
  await done(page);
});

await test('sem data de abertura nunca antecipa a fase nova', async () => {
  await db.exec(`update public.event_settings set opens_at = null, starts_at = null`);
  const page = await newPage();
  await page.goto(base);
  await page.locator('.hero .kicker', { hasText: 'Em breve' }).waitFor();
  await page.getByText('Data de abertura a confirmar').waitFor();
  await done(page);
});

await test('informações do evento e fuso configurável', async () => {
  await db.exec(`update public.event_settings set name='Revolution 2026', description='Uma conferência', timezone='America/Sao_Paulo', starts_at='2026-10-17T22:30:00Z', opens_at = now() + interval '1 day', location_name='Igreja Central', address='Rua A, 100', maps_url='https://maps.app.goo.gl/abc'`);
  const page = await newPage();
  await page.goto(base);
  const text = await page.locator('.info').first().innerText();
  ok(/sábado, 17 de outubro de 2026/i.test(text) && text.includes('19:30'), text);
  ok(text.includes('Igreja Central') && text.includes('Rua A, 100'));
  eq(await page.getByRole('link', { name: /Ver no mapa/ }).getAttribute('href'), 'https://maps.app.goo.gl/abc');
  await db.exec(`update public.event_settings set timezone='Europe/Lisbon'`);
  await page.reload();
  ok((await page.locator('.info').first().innerText()).includes('23:30'), 'horário muda com o fuso');
  await done(page);
});

// ═════════════════════════ 4. Mural ═════════════════════════
group('Mural');
await reset();
await test('mural lista só publicadas; rascunho e oculta não aparecem nem pelo link', async () => {
  const p = await post({ title: 'Publicada' }); const d = await post({ title: 'Rascunho', status: 'draft' }); const h = await post({ title: 'Oculta', status: 'hidden' });
  const page = await newPage();
  await page.goto(`${base}/mural`);
  eq(await page.locator('.post h2').allTextContents(), ['Publicada']);
  await page.goto(`${base}/mural/${p}`); await page.getByRole('heading', { name: 'Publicada' }).waitFor();
  for (const id of [d, h]) { await page.goto(`${base}/mural/${id}`); await page.getByText('Publicação não encontrada').waitFor(); }
  await done(page);
});

await test('ordenação por posição e paginação (10 por página)', async () => {
  await reset();
  for (let i = 1; i <= 13; i++) await post({ title: `P${String(i).padStart(2, '0')}`, position: i });
  const page = await newPage();
  await page.goto(`${base}/mural`);
  const t1 = await page.locator('.post h2').allTextContents();
  eq(t1.length, 10); eq(t1[0], 'P01'); eq(t1[9], 'P10');
  await page.getByRole('link', { name: /Mais antigas/ }).click();
  await waitFor(() => page.url().includes('page=2'));
  eq(await page.locator('.post h2').allTextContents(), ['P11', 'P12', 'P13']);
  await page.getByText('Página 2 de 2').waitFor();
  await page.goto(`${base}/mural?page=99`); await page.getByText('Não há publicações nesta página').waitFor();
  await page.goto(`${base}/mural?page=abc`); eq((await page.locator('.post').count()), 10);
  await done(page);
});

await test('texto do mural é exibido como texto (HTML/script não executa)', async () => {
  await reset();
  await post({ title: '<img src=x onerror=window.__xss=1>', body: '<script>window.__xss=1</script><b>negrito?</b>' });
  const page = await newPage();
  await page.goto(`${base}/mural`);
  await page.waitForLoadState('networkidle');
  eq(await page.evaluate(() => window.__xss), undefined);
  ok((await page.locator('.post .body').textContent()).includes('<script>'));
  eq(await page.locator('.post .body b').count(), 0);
  noProblems(page);
  await done(page);
});

await test('compartilhar: copia o link da publicação', async () => {
  await reset();
  const id = await post({ title: 'Compartilhe' });
  const page = await newPage();
  await page.goto(`${base}/mural`);
  await page.getByRole('button', { name: 'Compartilhar' }).click();
  await page.getByText('Link copiado!').waitFor();
  eq(await page.evaluate(() => navigator.clipboard.readText()), `${base}/mural/${id}`);
  await done(page);
});

await test('destaques aparecem na home com link para a publicação', async () => {
  await reset(); await setOpen(`now() + interval '1 day'`);
  const id = await post({ title: 'Em destaque', highlight: true }); await post({ title: 'Comum' });
  const page = await newPage();
  await page.goto(base);
  await page.getByRole('heading', { name: 'Destaques' }).waitFor();
  eq(await page.locator('#dest ~ .info h3').allTextContents(), ['Em destaque']);
  await page.getByRole('link', { name: /Abrir publicação/ }).click();
  await waitFor(() => page.url().endsWith(`/mural/${id}`));
  await done(page);
});

// ═════════════════════════ 4b. Entrada (fogo) e pastas ═════════════════════════
group('Entrada com o nome pegando fogo e pastas');
await test('entrada: desenha fogo no canvas, pode ser pulada, libera o site e não repete na sessão', async () => {
  await reset(); await setOpen(`now() + interval '1 day'`);
  const page = await newPage({ intro: true });
  await page.goto(base);
  await page.locator('#intro canvas').waitFor();
  await sleep(2600);
  const warm = await page.evaluate(() => { const c = document.querySelector('#intro canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) { if (d[i] > 200 && d[i + 1] > 60 && d[i + 2] < 130) n++; } return n; });
  ok(warm > 300, 'pixels de fogo no canvas: ' + warm);
  ok(await page.getByRole('button', { name: 'Pular introdução' }).isVisible());
  eq(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'hidden', 'rolagem travada durante a entrada');
  await page.getByRole('button', { name: 'Pular introdução' }).click();
  await waitFor(async () => (await page.locator('#intro').count()) === 0, 6000, 150, 'entrada sumir');
  eq(await page.evaluate(() => sessionStorage.getItem('rv_intro_seen')), '1');
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  await page.reload(); await sleep(900);
  eq(await page.locator('#intro').count(), 0, 'não repete na mesma sessão');
  noProblems(page);
  await done(page);
});

await test('entrada: termina sozinha (≈6 s) e revela o site', async () => {
  const page = await newPage({ intro: true });
  await page.goto(base);
  await page.locator('#intro').waitFor();
  const t0 = Date.now();
  await waitFor(async () => (await page.locator('#intro').count()) === 0, 12000, 200, 'fim automático');
  const secs = (Date.now() - t0) / 1000;
  ok(secs > 3 && secs < 10, 'duração ' + secs);
  ok(await page.locator('.hero').isVisible());
  await done(page);
});

await test('entrada: não aparece com movimento reduzido nem fora da página inicial', async () => {
  const a = await newPage({ intro: true, reducedMotion: 'reduce' });
  await a.goto(base); await waitFor(async () => (await a.locator('#intro').count()) === 0, 4000, 100, 'sem entrada');
  await done(a);
  const b = await newPage({ intro: true });
  await b.goto(`${base}/mural`); await b.waitForLoadState('networkidle'); eq(await b.locator('#intro').count(), 0);
  await done(b);
});

await test('pastas Vídeos e Fotos: abrem, só então os atalhos ficam focáveis, e levam às categorias/álbuns', async () => {
  await reset(); await setOpen(`now() + interval '1 day'`);
  const v = (title, id, cat) => db.query(`insert into public.videos (title, url, youtube_id, category, availability) values ($1,$2,$3,$4,'ok')`, [title, `https://youtu.be/${id}`, id, cat]);
  await v('V1', 'aaaaaaaaaaa', 'Pregações'); await v('V2', 'bbbbbbbbbbb', 'Pregações'); await v('V3', 'ccccccccccc', 'Melhores momentos');
  const m = (id, album) => db.query(`insert into public.media (original_url, drive_file_id, is_published, availability, album) values ($1,$2,true,'ok',$3)`, [`https://drive.google.com/file/d/${id}/view`, id, album]);
  await m('1111111111AAAA', 'Dia 1'); await m('2222222222BBBB', 'Dia 1'); await m('3333333333CCCC', 'Dia 2');
  const page = await newPage();
  await page.goto(base);
  const folderV = page.locator('.fo.v'), folderF = page.locator('.fo.f');
  eq(await folderV.locator('.fr i').textContent(), '3 itens'); eq(await folderF.locator('.fr i').textContent(), '3 itens');
  eq(await folderV.locator('.fl a').first().getAttribute('tabindex'), '-1', 'fechada: atalhos fora da ordem de tabulação');
  await folderV.getByRole('button', { name: /Vídeos/ }).click();
  eq(await folderV.locator('.fr').getAttribute('aria-expanded'), 'true');
  eq(await folderV.locator('.fl a').first().getAttribute('tabindex'), '0');
  eq(await folderV.locator('.fl a').allTextContents(), ['Pregações2 vídeos', 'Melhores momentos1 vídeo', 'Ao vivoYouTube']);
  eq(await folderV.locator('.fl a').first().getAttribute('href'), '/ao-vivo#pregacoes');
  await folderF.getByRole('button', { name: /Fotos/ }).click();
  eq(await folderF.locator('.fl a').first().getAttribute('href'), '/?album=Dia%201#galeria');
  await folderF.locator('.fl a').first().click({ force: true });
  await page.waitForURL(/album=Dia%201/);
  await waitFor(async () => (await page.locator('.gallery button.g').count()) === 2, 8000, 150, 'só as 2 fotos do Dia 1');
  eq(await page.locator('.chip[aria-pressed="true"]').textContent(), 'Dia 1');
  await page.locator('.chip', { hasText: 'Todas' }).click();
  await waitFor(async () => (await page.locator('.gallery button.g').count()) === 3);
  await page.goto(`${base}/ao-vivo#pregacoes`); await page.locator('#pregacoes').waitFor();
  await done(page);
});

// ═════════════════════════ 5. Reações ═════════════════════════
group('Reações anônimas');
await reset();
const fireBtn = (page, id, e = '🔥') => page.locator(`[data-post-id="${id}"] .react[data-emoji="${e}"]`);
const cnt = async (page, id, e = '🔥') => Number(await fireBtn(page, id, e).locator('[data-count]').textContent());
const dbCount = async (id, e) => Number((await db.query(`select coalesce(sum(count),0) c from public.post_reaction_counts where post_id=$1 and emoji=$2`, [id, e])).rows[0].c);

await test('registrar, persistir após recarregar, trocar e remover', async () => {
  await reset(); const id = await post({ title: 'R' });
  const page = await newPage();
  await page.goto(`${base}/mural`);
  await fireBtn(page, id).click();
  await waitFor(async () => (await cnt(page, id)) === 1 && (await fireBtn(page, id).getAttribute('aria-pressed')) === 'true');
  await waitFor(async () => (await dbCount(id, '🔥')) === 1, 5000, 100, 'gravar no banco');
  eq(await countRows(`select count(*) c from public.post_reactions where post_id=$1`, [id]), 1);
  // persiste: o servidor devolve a reação do mesmo ID anônimo
  await page.reload();
  await waitFor(async () => (await fireBtn(page, id).getAttribute('aria-pressed')) === 'true', 8000, 150, 'reação destacada após reload');
  eq(await cnt(page, id), 1);
  // trocar
  await fireBtn(page, id, '🙌').click();
  await waitFor(async () => (await cnt(page, id, '🙌')) === 1 && (await cnt(page, id, '🔥')) === 0);
  await waitFor(async () => (await dbCount(id, '🙌')) === 1 && (await dbCount(id, '🔥')) === 0, 5000);
  eq(await countRows(`select count(*) c from public.post_reactions where post_id=$1`, [id]), 1, 'continua 1 linha por ID');
  // remover
  await fireBtn(page, id, '🙌').click();
  await waitFor(async () => (await cnt(page, id, '🙌')) === 0 && (await fireBtn(page, id, '🙌').getAttribute('aria-pressed')) === 'false');
  await waitFor(async () => (await countRows(`select count(*) c from public.post_reactions where post_id=$1`, [id])) === 0, 5000);
  await done(page);
});

await test('IDs anônimos diferentes somam; o ID persiste no navegador e não vai a cookies', async () => {
  await reset(); const id = await post();
  const p1 = await newPage(); const p2 = await newPage();
  await p1.goto(`${base}/mural`); await p2.goto(`${base}/mural`);
  await fireBtn(p1, id, '❤️').click(); await waitFor(async () => (await dbCount(id, '❤️')) === 1);
  await fireBtn(p2, id, '❤️').click(); await waitFor(async () => (await dbCount(id, '❤️')) === 2);
  const anon1 = await p1.evaluate(() => localStorage.getItem('rv_anon_id')); const anon2 = await p2.evaluate(() => localStorage.getItem('rv_anon_id'));
  ok(anon1 && anon2 && anon1 !== anon2, 'IDs distintos');
  ok(/^[0-9a-f-]{36}$/.test(anon1));
  eq((await p1.context().cookies()).filter((c) => /anon|react/i.test(c.name)).length, 0);
  await p1.reload(); eq(await p1.evaluate(() => localStorage.getItem('rv_anon_id')), anon1, 'ID persistente');
  await done(p1); await done(p2);
});

await test('duplicidade: cliques repetidos rápidos geram no máximo 1 reação por ID', async () => {
  await reset(); const id = await post();
  const page = await newPage();
  await page.goto(`${base}/mural`);
  const b = fireBtn(page, id, '👏');
  await Promise.all([b.click(), b.click({ force: true, noWaitAfter: true }).catch(() => {}), b.click({ force: true, noWaitAfter: true }).catch(() => {})]);
  await sleep(1500);
  ok((await countRows(`select count(*) c from public.post_reactions where post_id=$1`, [id])) <= 1);
  // via API: mesma reação repetida é idempotente
  const aid = A(1);
  for (let i = 0; i < 3; i++) { const r = await jsonPost('/api/reactions', { postId: id, anonId: aid, emoji: '😍' }); eq(r.status, 200); }
  eq(await countRows(`select count(*) c from public.post_reactions where post_id=$1 and anon_id=$2`, [id, aid]), 1);
  eq(await dbCount(id, '😍'), 1);
  await done(page);
});

await test('API de reações recusa: origem estranha, emoji inválido, corpo inválido/grande, post oculto/inexistente', async () => {
  await reset(); const id = await post(); const hid = await post({ status: 'hidden' }); const dr = await post({ status: 'draft' });
  eq((await jsonPost('/api/reactions', { postId: id, anonId: A(2), emoji: '🔥' }, { origin: 'https://evil.example' })).status, 403);
  eq((await fetch(`${base}/api/reactions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ postId: id, anonId: A(2), emoji: '🔥' }) })).status, 403, 'sem Origin');
  eq((await jsonPost('/api/reactions', { postId: id, anonId: A(2), emoji: '💩' })).status, 400);
  eq((await jsonPost('/api/reactions', { postId: 'x', anonId: A(2), emoji: '🔥' })).status, 400);
  eq((await jsonPost('/api/reactions', { postId: id, anonId: A(2), emoji: '🔥', admin: true })).status, 400);
  eq((await fetch(`${base}/api/reactions`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: '{"x":"' + 'a'.repeat(5000) + '"}' })).status, 413);
  for (const x of [hid, dr, '99999999-9999-4999-8999-999999999999']) eq((await jsonPost('/api/reactions', { postId: x, anonId: A(2), emoji: '🔥' })).status, 404);
  eq((await fetch(`${base}/api/reactions`)).status, 405);
  eq(await countRows(`select count(*) c from public.post_reactions`), 0, 'nada gravado');
});

await test('abuso: limite por ID e por IP → 429 e a interface desfaz a reação', async () => {
  await reset(); const id = await post();
  await db.exec(`update public.site_settings set reaction_limit_per_minute = 3, reaction_limit_per_ip_minute = 6`);
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await jsonPost('/api/reactions', { postId: id, anonId: A(10), emoji: i % 2 ? '🔥' : '🙌' })).status);
  eq(codes, [200, 200, 200, 429, 429]);
  const ip = [];
  for (let i = 0; i < 5; i++) ip.push((await jsonPost('/api/reactions', { postId: id, anonId: A(20 + i), emoji: '🔥' })).status);
  ok(ip.includes(429), 'limite por IP: ' + ip.join(','));
  const r429 = await jsonPost('/api/reactions', { postId: id, anonId: A(10), emoji: '🔥' });
  eq(r429.headers.get('retry-after'), '30');
  // interface: usuário novo passa do limite e vê o aviso + rollback
  await db.exec(`delete from public.rate_limits; delete from public.post_reactions; update public.site_settings set reaction_limit_per_minute = 2, reaction_limit_per_ip_minute = 100`);
  const page = await newPage();
  await page.goto(`${base}/mural`);
  const emojis = ['🔥', '🙌', '👏'];
  for (const e of emojis) { await fireBtn(page, id, e).click(); await sleep(450); }
  await page.getByText('Muitas reações em pouco tempo').waitFor({ timeout: 8000 });
  await sleep(500);
  const ui = [];
  for (const e of emojis) ui.push(await cnt(page, id, e));
  const dbv = [];
  for (const e of emojis) dbv.push(await dbCount(id, e));
  eq(ui, dbv, 'o que a tela mostra = banco (rollback aplicado)');
  await done(page);
});

await test('limite em RATE LIMIT não vaza: tabela rate_limits guarda só hash, nunca IP/ID em claro', async () => {
  const rows = (await db.query(`select key from public.rate_limits`)).rows.map((r) => r.key);
  ok(rows.length > 0);
  for (const k of rows) ok(!/\d+\.\d+\.\d+\.\d+/.test(k) && !k.includes('::1') && !k.includes('127.0.0.1'), 'chave: ' + k);
  ok(rows.some((k) => k.startsWith('react:ip:') && /^react:ip:[0-9a-f]{32}$/.test(k)), rows.join(','));
});

await test('reações desativadas no painel → UI informa e API recusa', async () => {
  await reset(); const id = await post();
  await db.exec(`update public.site_settings set reactions_enabled = false`);
  const page = await newPage();
  await page.goto(`${base}/mural`);
  await page.getByText('Reações desativadas.').waitFor();
  eq(await page.locator('.react').count(), 0);
  eq((await jsonPost('/api/reactions', { postId: id, anonId: A(3), emoji: '🔥' })).status, 403);
  await done(page);
});

await test('falha de rede ao reagir → aviso e desfaz; falha em "minhas reações" não quebra a página', async () => {
  await reset(); const id = await post();
  const page = await newPage();
  await page.route('**/api/reactions/mine*', (r) => r.abort());
  await page.goto(`${base}/mural`);
  await page.locator('.post').first().waitFor();
  await page.route('**/api/reactions', (r) => (r.request().method() === 'POST' ? r.abort() : r.continue()));
  await fireBtn(page, id).click();
  await page.getByText('Sem conexão. Sua reação não foi enviada.').waitFor();
  eq(await cnt(page, id), 0, 'contagem voltou a 0');
  eq(await fireBtn(page, id).getAttribute('aria-pressed'), 'false');
  await done(page);
});

await test('contagens atualizam sozinhas sem Realtime (fallback por consulta periódica ≤ 25 s)', async () => {
  await reset(); const id = await post();
  const page = await newPage();
  await page.goto(`${base}/mural`);
  await db.exec(`insert into public.post_reactions (post_id, anon_id, emoji) values ('${id}', '${A(77)}', '🔥')`);
  await waitFor(async () => (await cnt(page, id)) === 1, 28000, 500, 'contagem via polling');
  await done(page);
});

// ═════════════════════════ 6. Visitantes não escrevem (RLS via PostgREST real) ═════════════════════════
group('Bloqueio de escrita por visitantes (RLS via API real)');
await test('mural não tem formulário, campo de texto, upload, comentário nem resposta', async () => {
  await reset(); await post({ title: 'Oficial' });
  const page = await newPage();
  for (const path of ['/mural', '/', '/ao-vivo']) {
    await page.goto(base + path); await page.waitForLoadState('networkidle');
    eq(await page.locator('form, textarea, input:not([type="hidden"]), input[type=file]').count(), 0, `${path}: sem campos de entrada`);
    eq(await page.getByRole('button', { name: /comentar|responder|enviar|postar|publicar/i }).count(), 0);
  }
  await done(page);
});

await test('anon NÃO consegue inserir/alterar/apagar posts, mídia, vídeos, configurações nem admins pela API', async () => {
  await reset(); const id = await post({ title: 'Original' });
  await db.exec(`insert into public.media (original_url, drive_file_id, is_published) values ('https://drive.google.com/file/d/AAAAAAAAAAAAAA/view','AAAAAAAAAAAAAA', true)`);
  const H = restHeaders();
  const attempts = [
    ['POST', 'wall_posts', { body: 'invasão', status: 'published' }], ['PATCH', `wall_posts?id=eq.${id}`, { title: 'HACK' }], ['DELETE', `wall_posts?id=eq.${id}`],
    ['POST', 'media', { original_url: 'https://drive.google.com/file/d/ZZZZZZZZZZZZZZ/view', drive_file_id: 'ZZZZZZZZZZZZZZ' }], ['PATCH', 'media?is_published=eq.true', { is_published: false }], ['DELETE', 'media?is_published=eq.true'],
    ['POST', 'videos', { title: 'x', url: 'https://youtu.be/dQw4w9WgXcQ', youtube_id: 'dQw4w9WgXcQ' }],
    ['PATCH', 'event_settings?id=eq.1', { name: 'HACK' }], ['PATCH', 'site_settings?id=eq.1', { site_title: 'HACK', reactions_enabled: false }],
    ['POST', 'admin_users', { user_id: USERS.plain.id, role: 'owner' }],
    ['POST', 'post_reactions', { post_id: id, anon_id: A(5), emoji: '🔥' }], ['POST', 'post_reaction_counts', { post_id: id, emoji: '🔥', count: 9999 }],
    ['PATCH', 'post_reaction_counts', { count: 9999 }], ['DELETE', 'post_reaction_counts'],
  ];
  for (const [method, path, body] of attempts) {
    const r = await fetch(`${apiBase}/rest/v1/${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    const txt = await r.text();
    ok(!(r.status >= 200 && r.status < 300) || txt === '' || txt === '[]', `${method} ${path} → ${r.status} ${txt.slice(0, 80)}`);
  }
  eq((await db.query(`select title from public.wall_posts where id=$1`, [id])).rows[0].title, 'Original');
  eq(await countRows(`select count(*) c from public.wall_posts`), 1);
  eq(await countRows(`select count(*) c from public.media where is_published`), 1);
  eq(await countRows(`select count(*) c from public.videos`), 0);
  eq(await countRows(`select count(*) c from public.admin_users`), 2);
  eq(await countRows(`select count(*) c from public.post_reactions`), 0);
  eq(await countRows(`select count(*) c from public.post_reaction_counts where count > 0`), 0);
  eq((await db.query(`select name, reactions_enabled from public.event_settings, public.site_settings`)).rows[0].name, 'Revolution Conference');
  eq(await countRows(`select count(*) c from public.site_settings where reactions_enabled`), 1);
});

await test('anon NÃO lê rate_limits, reações brutas, admin_users e NÃO executa a função de reação', async () => {
  await reset(); const id = await post();
  await jsonPost('/api/reactions', { postId: id, anonId: A(8), emoji: '🔥' });
  const H = restHeaders();
  for (const t of ['rate_limits', 'post_reactions', 'admin_users']) {
    const r = await fetch(`${apiBase}/rest/v1/${t}?select=*`, { headers: H });
    const body = await r.text();
    ok(r.status >= 400 || body === '[]', `${t}: ${r.status} ${body.slice(0, 60)}`);
  }
  const rpc = await fetch(`${apiBase}/rest/v1/rpc/react_to_post`, { method: 'POST', headers: H, body: JSON.stringify({ p_post_id: id, p_anon_id: A(9), p_emoji: '🔥', p_ip_hash: 'x' }) });
  ok(rpc.status >= 400, 'rpc react_to_post como anon: ' + rpc.status);
  eq(await countRows(`select count(*) c from public.post_reactions where anon_id=$1`, [A(9)]), 0);
});

await test('usuário logado SEM permissão de admin também não escreve (JWT real verificado pelo PostgREST)', async () => {
  await reset(); const id = await post({ title: 'Original' });
  const tok = await userToken(USERS.plain);
  const H = restHeaders(tok);
  for (const [method, path, body] of [['POST', 'wall_posts', { body: 'x', status: 'published' }], ['PATCH', `wall_posts?id=eq.${id}`, { title: 'HACK' }], ['DELETE', `wall_posts?id=eq.${id}`], ['PATCH', 'event_settings?id=eq.1', { name: 'HACK' }], ['POST', 'admin_users', { user_id: USERS.plain.id, role: 'owner' }]]) {
    await fetch(`${apiBase}/rest/v1/${path}`, { method, headers: H, body: JSON.stringify(body) });
  }
  eq((await db.query(`select title from public.wall_posts where id=$1`, [id])).rows[0].title, 'Original');
  eq(await countRows(`select count(*) c from public.admin_users`), 2);
  eq((await db.query(`select name from public.event_settings`)).rows[0].name, 'Revolution Conference');
  // JWT adulterado/expirado é recusado
  const bad = await fetch(`${apiBase}/rest/v1/site_settings?select=id`, { headers: restHeaders(tok.slice(0, -3) + 'abc') });
  eq(bad.status, 401);
});

await test('service_role só no servidor: a chave não aparece em HTML, JS nem respostas públicas', async () => {
  const urls = ['/', '/ao-vivo', '/mural', '/privacidade', '/admin/login'];
  const page = await newPage();
  const seen = [];
  page.on('response', async (r) => { const t = r.headers()['content-type'] ?? ''; if (/text|javascript|json/.test(t) && r.url().startsWith(base)) { try { seen.push(await r.text()); } catch {} } });
  for (const u of urls) { await page.goto(base + u); await page.waitForLoadState('networkidle'); }
  const blob = seen.join('\n');
  ok(blob.length > 1000);
  ok(!blob.includes(SERVICE_KEY), 'SERVICE_ROLE vazou');
  ok(!blob.includes('sal-de-teste-sal-de-teste'), 'RATE_LIMIT_SALT vazou');
  ok(blob.includes(ANON_KEY) || true);
  await done(page);
});

// ═════════════════════════ 7. Ao vivo e vídeos ═════════════════════════
group('Ao vivo, vídeos e links');
await test('transmissão: sem configuração, ligada (player nocookie, sem autoplay) e desligada', async () => {
  await reset();
  const page = await newPage();
  await page.goto(`${base}/ao-vivo`); await page.getByText('Nenhuma transmissão no momento').waitFor(); eq(await page.locator('iframe').count(), 0);
  // URL salva mas DESLIGADA → continua sem player
  await db.exec(`update public.event_settings set stream_url='https://www.youtube.com/watch?v=dQw4w9WgXcQ', stream_video_id='dQw4w9WgXcQ', stream_enabled=false`);
  await page.reload(); eq(await page.locator('iframe').count(), 0, 'URL sozinha não liga a transmissão');
  await db.exec(`update public.event_settings set stream_enabled=true, stream_note='Bem-vindos'`);
  await page.reload();
  const src = await page.locator('iframe[title^="Transmissão"]').getAttribute('src');
  ok(src.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), src); ok(!/autoplay/i.test(src), 'sem autoplay');
  await page.getByText('Bem-vindos').waitFor();
  eq(await page.getByRole('link', { name: /Abrir no YouTube/ }).getAttribute('href'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  ok(await page.locator('.badge.live').isVisible());
  await db.exec(`update public.event_settings set stream_enabled=false`);
  await page.reload(); await page.getByText('Nenhuma transmissão no momento').waitFor();
  await done(page);
});

await test('vídeos gravados: agrupados por categoria, ordenados, descrição; indisponíveis e não publicados ficam de fora', async () => {
  await reset();
  const v = (t, id, cat, pos, pub = true, av = 'ok', d = '') => db.query(`insert into public.videos (title, url, youtube_id, category, position, is_published, availability, description) values ($1,$2,$3,$4,$5,$6,$7,$8)`, [t, `https://youtu.be/${id}`, id, cat, pos, pub, av, d]);
  await v('Segunda', 'bbbbbbbbbbb', 'Pregações', 2, true, 'ok', 'Descrição B'); await v('Primeira', 'aaaaaaaaaaa', 'Pregações', 1); await v('Louvor 1', 'ccccccccccc', 'Louvor', 1);
  await v('Privado', 'ddddddddddd', 'Louvor', 2, true, 'unavailable'); await v('Rascunho', 'eeeeeeeeeee', 'Louvor', 3, false); await v('Desconhecido', 'fffffffffff', 'Louvor', 4, true, 'unknown');
  const page = await newPage();
  await page.goto(`${base}/ao-vivo`);
  eq(await page.locator('.cat').allTextContents(), ['Louvor', 'Pregações']);
  eq(await page.locator('.vcard h3').allTextContents(), ['Louvor 1', 'Desconhecido', 'Primeira', 'Segunda']);
  await page.getByText('Descrição B').waitFor();
  eq(await page.getByRole('link', { name: /Abrir no YouTube/ }).first().getAttribute('href'), 'https://www.youtube.com/watch?v=ccccccccccc');
  await page.getByRole('button', { name: 'Assistir: Primeira' }).click();
  await waitFor(() => page.locator('dialog[open] iframe').count());
  ok((await page.locator('dialog[open] iframe').getAttribute('src')).startsWith('https://www.youtube-nocookie.com/embed/aaaaaaaaaaa'));
  ok(!/autoplay/.test(await page.locator('dialog[open] iframe').getAttribute('src')));
  await page.keyboard.press('Escape');
  await done(page);
});

await test('links inválidos não viram player: URL/ID fora do padrão é recusada pelo banco', async () => {
  const bad = ['https://evil.example/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'http://youtube.com/watch?v=dQw4w9WgXcQ'];
  for (const u of bad) { let failed = false; try { await db.query(`update public.event_settings set stream_url=$1`, [u]); } catch { failed = true; } ok(failed, u); }
  let failedId = false; try { await db.query(`update public.event_settings set stream_video_id='<script>'`); } catch { failedId = true; } ok(failedId);
});

// ═════════════════════════ 8. Drive ═════════════════════════
group('Google Drive (fotos)');
await test('galeria: mostra publicadas e não indisponíveis; imagem que falha vira "Imagem indisponível" sem quebrar o resto', async () => {
  await reset(); await setOpen(`now() + interval '1 day'`);
  const m = (id, pub, av, feat = false, pos = 0, cap = '') => db.query(`insert into public.media (original_url, drive_file_id, is_published, availability, is_featured, position, caption) values ($1,$2,$3,$4,$5,$6,$7)`, [`https://drive.google.com/file/d/${id}/view`, id, pub, av, feat, pos, cap]);
  await m('1111111111AAAA', true, 'ok', true, 0, 'Destaque'); await m('2222222222BBBB', true, 'unknown', false, 1, 'Segunda'); await m('3333333333CCCC', true, 'unavailable', false, 2); await m('4444444444DDDD', false, 'ok', false, 3);
  const page = await newPage();
  await page.goto(base);
  await page.locator('.gallery button.g').first().waitFor();
  eq(await page.locator('.gallery button.g').count(), 2, 'só 2 visíveis (a indisponível e a não publicada ficam fora)');
  ok((await page.locator('.gallery button.g').first().getAttribute('class')).includes('big'), 'destaque grande');
  await waitFor(async () => (await page.locator('.gallery .img-fail').count()) >= 1, 15000, 300, 'fallback de imagem (Google inacessível neste ambiente)');
  const srcs = await page.locator('.gallery img').evaluateAll((els) => els.map((e) => e.getAttribute('src') ?? ''));
  ok(srcs.every((s) => s.startsWith('https://drive.google.com/thumbnail?id=')), srcs.join(','));
  await page.getByRole('button', { name: /Ampliar foto/ }).first().click();
  await waitFor(() => page.locator('dialog[open]').count());
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Escape');
  noProblems(page);
  await done(page);
});

// ═════════════════════════ 9. Admin ═════════════════════════
group('Painel administrativo');
await test('rotas /admin: sem login redireciona; token falso não entra; usuário comum cai em "acesso negado"; admin entra', async () => {
  await reset();
  const page = await newPage();
  for (const p of ['/admin', '/admin/mural', '/admin/midia', '/admin/evento', '/admin/seguranca', '/admin/preview', '/admin/preview/mural']) {
    await page.goto(base + p); await waitFor(() => new URL(page.url()).pathname === '/admin/login', 8000, 100, `redirecionar ${p}`);
  }
  await page.getByLabel('E-mail').fill(USERS.owner.email); await page.getByLabel('Senha').fill('errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByText('E-mail ou senha incorretos.').waitFor();
  // cookie forjado
  await page.context().addCookies([{ name: 'sb-localhost-auth-token', value: 'forjado', url: base }]);
  await page.goto(base + '/admin'); await waitFor(() => new URL(page.url()).pathname === '/admin/login');
  await done(page);

  const plain = await newPage();
  await login(plain, USERS.plain);
  await waitFor(() => new URL(plain.url()).pathname === '/admin/negado', 15000, 150, 'acesso negado');
  await plain.getByText('não tem permissão de administrador').waitFor();
  for (const p of ['/admin', '/admin/mural', '/admin/preview/mural']) { await plain.goto(base + p); await waitFor(() => new URL(plain.url()).pathname === '/admin/negado', 8000, 100, `negar ${p}`); }
  await done(plain);

  const adm = await newPage();
  await loginOk(adm, USERS.owner);
  await adm.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await done(adm);
});

await test('admin faz logout e perde o acesso', async () => {
  const page = await newPage();
  await loginOk(page, USERS.editor);
  await page.getByRole('button', { name: 'Sair' }).click();
  await waitFor(() => new URL(page.url()).pathname === '/admin/login');
  await page.goto(base + '/admin/mural'); await waitFor(() => new URL(page.url()).pathname === '/admin/login');
  await done(page);
});

await test('dashboard mostra números reais do banco e o status das integrações', async () => {
  await reset();
  await post({ status: 'published' }); await post({ status: 'published' }); await post({ status: 'draft' }); await post({ status: 'hidden' });
  const id = await post({ status: 'published' });
  await db.exec(`insert into public.post_reactions (post_id, anon_id, emoji) values ('${id}','${A(31)}','🔥'),('${id}','${A(32)}','🔥'),('${id}','${A(33)}','🙌')`);
  await db.exec(`insert into public.media (original_url, drive_file_id, availability) values ('https://drive.google.com/file/d/AAAAAAAAAAAAAA/view','AAAAAAAAAAAAAA','unavailable')`);
  const page = await newPage();
  await loginOk(page, USERS.owner);
  const stats = await page.locator('.stat').allInnerTexts();
  const get = (label) => Number(stats.find((s) => s.includes(label)).split('\n')[0]);
  eq(get('Publicações no ar'), 3); eq(get('Rascunhos'), 1); eq(get('Ocultas'), 1); eq(get('Reações (linhas)'), 3); eq(get('Fotos'), 1);
  const text = await page.locator('main, .adm').first().innerText();
  ok(text.includes('🔥 2') && text.includes('🙌 1'), 'reações por emoji');
  ok(text.includes('1 foto(s) marcadas como indisponíveis'), 'status do Drive');
  ok(text.includes('Chave service_role (servidor)') && text.includes('Definida'), 'status da service_role');
  await done(page);
});

await test('CRUD do mural pelo painel: criar rascunho → pré-visualizar → publicar → editar → ordenar → ocultar → restaurar → excluir', async () => {
  await reset(); await setOpen(`now() - interval '1 hour'`);
  const page = await newPage();
  await loginOk(page, USERS.editor);
  await page.goto(`${base}/admin/mural`);
  const createForm = page.locator('details.card form').first();
  await createForm.getByLabel('Título (opcional)').fill('Aviso importante');
  await createForm.getByLabel('Texto').fill('Cultos às 19h30.');
  await createForm.getByRole('button', { name: 'Criar publicação' }).click();
  await page.getByText('Criado com sucesso.').waitFor();
  const row = await db.query(`select id, status from public.wall_posts where title='Aviso importante'`);
  eq(row.rows.length, 1); eq(row.rows[0].status, 'draft');
  const id = row.rows[0].id;
  // público não vê; prévia do admin vê
  const pub = await newPage();
  await pub.goto(`${base}/mural`); await pub.getByText('O mural ainda está vazio').waitFor();
  await page.goto(`${base}/admin/preview/mural/${id}`); await page.getByRole('heading', { name: 'Aviso importante' }).waitFor(); await page.getByText('Rascunho').first().waitFor();
  // publicar
  await page.goto(`${base}/admin/mural`);
  await page.locator(`[data-admin-post="${id}"]`).getByRole('button', { name: 'Publicar' }).click();
  await page.getByText('Publicado.').waitFor();
  await pub.goto(`${base}/mural`); await pub.getByRole('heading', { name: 'Aviso importante' }).waitFor();
  // editar
  await page.locator(`[data-admin-post="${id}"] summary`, { hasText: 'Editar' }).click();
  await page.locator(`[data-admin-post="${id}"] form`).filter({ hasText: 'Salvar alterações' }).getByLabel('Texto').fill('Cultos às 20h.');
  await page.locator(`[data-admin-post="${id}"] form`).filter({ hasText: 'Salvar alterações' }).getByRole('button', { name: 'Salvar alterações' }).click();
  await page.getByText('Salvo com sucesso.').waitFor();
  await pub.reload(); await pub.getByText('Cultos às 20h.').waitFor();
  // ocultar / restaurar
  await page.locator(`[data-admin-post="${id}"]`).getByRole('button', { name: 'Ocultar' }).click(); await page.getByText('Publicação ocultada.').waitFor();
  await pub.reload(); await pub.getByText('O mural ainda está vazio').waitFor();
  await page.locator(`[data-admin-post="${id}"]`).getByRole('button', { name: 'Restaurar' }).click(); await page.getByText('Publicação restaurada.').waitFor();
  await pub.reload(); await pub.getByRole('heading', { name: 'Aviso importante' }).waitFor();
  // excluir (com confirmação)
  await page.locator(`[data-admin-post="${id}"] summary`, { hasText: 'Excluir' }).click();
  await page.locator(`[data-admin-post="${id}"]`).getByRole('button', { name: /Confirmar: excluir/ }).click();
  await page.getByText('Excluído.').waitFor();
  eq(await countRows(`select count(*) c from public.wall_posts where id=$1`, [id]), 0);
  await done(page); await done(pub);
});

await test('reordenar publicações no painel muda a ordem do site', async () => {
  await reset();
  const a = await post({ title: 'A', position: 0 }); const b = await post({ title: 'B', position: 1 }); const c = await post({ title: 'C', position: 2 });
  const page = await newPage(); await loginOk(page, USERS.owner);
  await page.goto(`${base}/admin/mural`);
  await page.locator(`[data-admin-post="${a}"]`).getByRole('button', { name: 'Descer' }).click();
  await page.getByText('Ordem atualizada.').waitFor();
  const pub = await newPage(); await pub.goto(`${base}/mural`);
  eq(await pub.locator('.post h2').allTextContents(), ['B', 'A', 'C']);
  await page.locator(`[data-admin-post="${c}"]`).getByRole('button', { name: 'Subir' }).click();
  await page.getByText('Ordem atualizada.').waitFor();
  await pub.reload(); eq(await pub.locator('.post h2').allTextContents(), ['B', 'C', 'A']);
  await done(page); await done(pub);
});

await test('validação do painel: texto vazio e 2001 caracteres são recusados', async () => {
  await reset();
  const page = await newPage(); await loginOk(page, USERS.editor);
  await page.goto(`${base}/admin/mural`);
  const f = page.locator('details.card form').first();
  await f.getByLabel('Texto').evaluate((el) => el.removeAttribute('required'));
  await f.getByLabel('Texto').evaluate((el) => el.removeAttribute('maxlength'));
  await f.getByLabel('Texto').fill('x'.repeat(2001));
  await f.getByRole('button', { name: 'Criar publicação' }).click();
  await page.getByText('Dados inválidos. Revise os campos.').waitFor();
  eq(await countRows(`select count(*) c from public.wall_posts`), 0);
  await done(page);
});

await test('mídia: link do Drive (válido, pasta, domínio errado, duplicado) e YouTube (válido e inválido) pelo painel', async () => {
  await reset();
  const page = await newPage(); await loginOk(page, USERS.editor);
  await page.goto(`${base}/admin/midia`);
  const driveForm = page.locator('form').filter({ hasText: 'Adicionar foto' });
  const addDrive = async (url) => { await page.goto(`${base}/admin/midia`); const f = page.locator('form').filter({ hasText: 'Adicionar foto' }); await f.getByLabel('Link do arquivo no Drive').fill(url); await f.getByRole('button', { name: /Adicionar foto/ }).click(); };
  await addDrive('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQ'); await page.getByText('Link de pasta não serve').waitFor();
  await addDrive('https://evil.example/file/d/1AbCdEfGhIjKlMnOpQ/view'); await page.getByText('Link inválido ou fora dos domínios permitidos.').waitFor();
  eq(await countRows(`select count(*) c from public.media`), 0);
  await addDrive('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=sharing');
  const msg = await flash(page);
  ok(/Criado com sucesso|Drive não entregou|não foi possível verificar/.test(msg), msg); // Google é inacessível neste ambiente → "não foi possível verificar"
  const m = (await db.query(`select * from public.media`)).rows[0];
  eq(m.drive_file_id, '1AbCdEfGhIjKlMnOpQrStUv'); eq(m.is_published, m.availability === 'ok', 'só publica automaticamente se verificada como pública');
  await addDrive('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUv'); await page.getByText('Este item já está cadastrado.').waitFor();
  eq(await countRows(`select count(*) c from public.media`), 1);
  // YouTube
  const addYt = async (url, title) => { await page.goto(`${base}/admin/midia`); const f = page.locator('form').filter({ hasText: 'Adicionar vídeo' }); await f.getByLabel('Link do vídeo').fill(url); await f.getByLabel('Título').fill(title); await f.getByRole('button', { name: /Adicionar vídeo/ }).click(); };
  await addYt('https://evil.example/watch?v=dQw4w9WgXcQ', 'Falso'); await page.getByText('Link inválido ou fora dos domínios permitidos.').waitFor();
  await addYt('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ', 'Falso2'); await page.getByText('Link inválido').waitFor();
  eq(await countRows(`select count(*) c from public.videos`), 0);
  await addYt('https://youtu.be/dQw4w9WgXcQ?si=abc', 'Vídeo bom');
  const msg2 = await flash(page); ok(/Criado com sucesso|YouTube indica|não foi possível verificar/.test(msg2), msg2);
  const v = (await db.query(`select * from public.videos`)).rows[0];
  eq(v.youtube_id, 'dQw4w9WgXcQ'); eq(v.url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await done(page);
  void driveForm;
});

await test('mídia: editar, destacar, publicar, ordenar e remover foto; vídeo: editar e remover', async () => {
  await reset();
  await db.exec(`insert into public.media (original_url, drive_file_id, availability, is_published, position, title) values ('https://drive.google.com/file/d/AAAAAAAAAAAAAA/view','AAAAAAAAAAAAAA','ok',false,0,'F1'),('https://drive.google.com/file/d/BBBBBBBBBBBBBB/view','BBBBBBBBBBBBBB','ok',false,1,'F2')`);
  const page = await newPage(); await loginOk(page, USERS.editor);
  await page.goto(`${base}/admin/midia`);
  const id1 = (await db.query(`select id from public.media where title='F1'`)).rows[0].id;
  const art = page.locator(`[data-media-id="${id1}"]`);
  await art.locator('summary', { hasText: 'Editar' }).click();
  await art.getByLabel('Legenda').fill('Legenda nova');
  await art.getByLabel('Publicada').check(); await art.getByLabel('Foto de destaque').check();
  await art.getByRole('button', { name: 'Salvar' }).click(); await page.getByText('Salvo com sucesso.').waitFor();
  const r = (await db.query(`select caption, is_published, is_featured from public.media where id=$1`, [id1])).rows[0];
  eq(r, { caption: 'Legenda nova', is_published: true, is_featured: true });
  await page.locator(`[data-media-id="${id1}"]`).getByRole('button', { name: 'Descer' }).click(); await page.getByText('Ordem atualizada.').waitFor();
  eq((await db.query(`select title from public.media order by position`)).rows.map((x) => x.title), ['F2', 'F1']);
  await page.locator(`[data-media-id="${id1}"] summary`, { hasText: 'Excluir' }).click();
  await page.locator(`[data-media-id="${id1}"]`).getByRole('button', { name: /Confirmar/ }).click(); await page.getByText('Excluído.').waitFor();
  eq(await countRows(`select count(*) c from public.media`), 1);
  await done(page);
});

await test('transmissão pelo painel: URL inválida recusada; ligar sem vídeo recusado; ligar com link válido publica o player', async () => {
  await reset();
  const page = await newPage(); await loginOk(page, USERS.owner);
  const submit = async (input, enable) => {
    await page.goto(`${base}/admin/midia`);
    const f = page.locator('form').filter({ hasText: 'Salvar transmissão' });
    await f.getByLabel('Link ou ID do vídeo/live no YouTube').fill(input);
    if (enable) await f.getByLabel(/Transmissão LIGADA/).check();
    await f.getByRole('button', { name: 'Salvar transmissão' }).click();
  };
  await submit('https://evil.example/live', true); await page.getByText('Link inválido').waitFor();
  await submit('', true); await page.getByText('Dados inválidos').waitFor();
  eq(await countRows(`select count(*) c from public.event_settings where stream_enabled`), 0);
  await submit('https://www.youtube.com/live/dQw4w9WgXcQ?feature=share', true);
  ok(/Salvo com sucesso|YouTube indica|não foi possível verificar/.test(await flash(page)));
  const ev = (await db.query(`select stream_enabled, stream_video_id from public.event_settings`)).rows[0];
  eq(ev, { stream_enabled: true, stream_video_id: 'dQw4w9WgXcQ' });
  const pub = await newPage(); await pub.goto(`${base}/ao-vivo`);
  ok((await pub.locator('iframe[title^="Transmissão"]').getAttribute('src')).includes('dQw4w9WgXcQ'));
  await done(page); await done(pub);
});

await test('configurações do evento e da home pelo painel (fuso, datas, links https)', async () => {
  await reset();
  const page = await newPage(); await loginOk(page, USERS.editor);
  await page.goto(`${base}/admin/evento`);
  const ev = page.locator('form').filter({ hasText: 'Salvar evento' });
  await ev.getByLabel('Nome do evento').fill('Revolution 2026');
  await ev.getByLabel(/Abertura/).fill('2026-10-17T00:00');
  await ev.getByLabel('Local', { exact: true }).fill('Igreja Central');
  await ev.getByLabel('Link do mapa (https)').fill('javascript:alert(1)');
  await ev.getByLabel('Link do mapa (https)').evaluate((el) => { el.type = 'text'; });
  await ev.getByRole('button', { name: 'Salvar evento' }).click(); await page.getByText('Dados inválidos').waitFor();
  eq((await db.query(`select name from public.event_settings`)).rows[0].name, 'Revolution Conference', 'nada salvo com link malicioso');
  await page.goto(`${base}/admin/evento`);
  const ev2 = page.locator('form').filter({ hasText: 'Salvar evento' });
  await ev2.getByLabel('Nome do evento').fill('Revolution 2026'); await ev2.getByLabel(/Abertura/).fill('2026-10-17T00:00'); await ev2.getByLabel('Local', { exact: true }).fill('Igreja Central');
  await ev2.getByRole('button', { name: 'Salvar evento' }).click(); await page.getByText('Salvo com sucesso.').waitFor();
  const r = (await db.query(`select name, location_name, opens_at from public.event_settings`)).rows[0];
  eq(r.name, 'Revolution 2026'); eq(r.location_name, 'Igreja Central'); eq(new Date(r.opens_at).toISOString(), '2026-10-17T03:00:00.000Z', 'meia-noite de Brasília = 03:00Z');
  await page.goto(`${base}/admin/evento`);
  const site = page.locator('form').filter({ hasText: 'Salvar home e site' });
  await site.getByLabel('Frase de destaque (banner)').fill('Algo novo começa'); await site.getByLabel('Instagram (link)').fill('https://instagram.com/revolution');
  await site.getByRole('button', { name: 'Salvar home e site' }).click(); await page.getByText('Salvo com sucesso.').waitFor();
  const pub = await newPage(); await pub.goto(base);
  await pub.getByText('Algo novo começa').waitFor();
  eq(await pub.getByRole('link', { name: 'Instagram' }).getAttribute('href'), 'https://instagram.com/revolution');
  await done(page); await done(pub);
});

await test('pré-visualização: fases forçadas só no painel; o site público não muda', async () => {
  await reset(); await setOpen(`now() - interval '1 hour'`);
  await post({ title: 'Rascunho secreto', status: 'draft' });
  await db.exec(`insert into public.media (original_url, drive_file_id, is_published, availability) values ('https://drive.google.com/file/d/AAAAAAAAAAAAAA/view','AAAAAAAAAAAAAA', false, 'ok')`);
  const page = await newPage(); await loginOk(page, USERS.editor);
  await page.goto(`${base}/admin/preview/inicio?fase=pre`);
  await page.locator('.hero .kicker', { hasText: 'Em breve' }).waitFor(); await page.getByText('PRÉ-VISUALIZAÇÃO (somente admin)').waitFor();
  eq(await page.locator('.gallery button.g').count(), 1, 'a foto não publicada aparece na prévia');
  await page.goto(`${base}/admin/preview/inicio?fase=ended`); await page.getByRole('heading', { name: /Obrigado por viver/i }).waitFor();
  await page.goto(`${base}/admin/preview/mural`); await page.getByRole('heading', { name: 'Rascunho secreto' }).waitFor();
  const pub = await newPage();
  await pub.goto(base); await pub.locator('.hero .kicker', { hasText: 'Começou' }).waitFor(); eq(await pub.locator('.gallery button.g').count(), 0);
  await pub.goto(`${base}/mural`); await pub.getByText('O mural ainda está vazio').waitFor();
  await pub.goto(`${base}/?fase=pre`); await pub.locator('.hero .kicker', { hasText: 'Começou' }).waitFor(); // parâmetro público é ignorado
  eq((await pub.goto(`${base}/admin/preview/mural`), new URL(pub.url()).pathname), '/admin/login');
  await done(page); await done(pub);
});

await test('segurança: editor NÃO altera limites nem admins; owner altera e gerencia', async () => {
  await reset();
  const ed = await newPage(); await loginOk(ed, USERS.editor);
  await ed.goto(`${base}/admin/seguranca`);
  await ed.getByText('Somente owners gerenciam administradores.').waitFor();
  eq(await ed.getByRole('button', { name: 'Adicionar administrador' }).count(), 0);
  const f = ed.locator('form').filter({ hasText: 'Salvar limites' });
  await f.getByLabel(/Limite por ID anônimo/).fill('250'); await f.getByRole('button', { name: 'Salvar limites' }).click();
  await ed.locator('.msg.err').waitFor();
  eq((await db.query(`select reaction_limit_per_minute from public.site_settings`)).rows[0].reaction_limit_per_minute, 20, 'banco recusou');
  await done(ed);
  const ow = await newPage(); await loginOk(ow, USERS.owner);
  await ow.goto(`${base}/admin/seguranca`);
  const g = ow.locator('form').filter({ hasText: 'Salvar limites' });
  await g.getByLabel(/Limite por ID anônimo/).fill('55'); await g.getByRole('button', { name: 'Salvar limites' }).click();
  await ow.getByText('Salvo com sucesso.').waitFor();
  eq((await db.query(`select reaction_limit_per_minute from public.site_settings`)).rows[0].reaction_limit_per_minute, 55);
  // convidar admin (service_role só localiza o usuário; a escrita usa a sessão do owner)
  const inv = ow.locator('form').filter({ hasText: 'Adicionar administrador' });
  await inv.getByLabel(/E-mail de um usuário/).fill('ninguem@teste.dev'); await inv.getByRole('button', { name: 'Adicionar administrador' }).click();
  await ow.getByText('Nenhum usuário com este e-mail.').waitFor();
  await ow.goto(`${base}/admin/seguranca`);
  const inv2 = ow.locator('form').filter({ hasText: 'Adicionar administrador' });
  await inv2.getByLabel(/E-mail de um usuário/).fill(USERS.plain.email); await inv2.getByRole('button', { name: 'Adicionar administrador' }).click();
  await ow.getByText('Salvo com sucesso.').waitFor();
  eq((await db.query(`select role from public.admin_users where user_id=$1`, [USERS.plain.id])).rows[0].role, 'editor');
  await db.exec(`delete from public.admin_users where user_id='${USERS.plain.id}'`);
  await done(ow);
});

await test('mural e home continuam coerentes depois de várias edições do painel (revalidação)', async () => {
  await reset(); await setOpen(`now() - interval '1 hour'`);
  const page = await newPage(); await loginOk(page, USERS.owner);
  const pub = await newPage(); await pub.goto(base); await pub.locator('.hero .kicker', { hasText: 'Começou' }).waitFor();
  await page.goto(`${base}/admin/evento`);
  const f = page.locator('form').filter({ hasText: 'Salvar evento' });
  await f.getByLabel('Nome do evento').fill('Nome Atualizado'); await f.getByRole('button', { name: 'Salvar evento' }).click(); await page.getByText('Salvo com sucesso.').waitFor();
  await pub.reload(); await pub.getByRole('heading', { name: 'Nome Atualizado' }).waitFor();
  await done(page); await done(pub);
});

// ═════════════════════════ 10. Falhas de infraestrutura ═════════════════════════
group('Falhas de rede e do Supabase');
await test('Supabase indisponível: páginas respondem com estado de erro amigável, sem quebrar', async () => {
  await reset(); await post({ title: 'X' });
  control.down = true;
  const page = await newPage();
  for (const [p, txt] of [['/', 'Não foi possível carregar o site'], ['/mural', 'Não foi possível carregar o mural'], ['/ao-vivo', 'Não foi possível carregar a transmissão']]) {
    const r = await page.goto(base + p);
    ok(r.status() < 500, `${p} status ${r.status()}`);
    await page.getByText(txt).first().waitFor({ timeout: 10000 });
  }
  eq(await page.locator('.state.error').count() > 0, true);
  control.down = false;
  await page.goto(`${base}/mural`); await page.getByRole('heading', { name: 'X' }).waitFor();
  noProblems(page);
  await done(page);
});

await test('Supabase fora → reação não é registrada e a UI avisa (sem travar)', async () => {
  await reset(); const id = await post();
  const page = await newPage();
  await page.goto(`${base}/mural`);
  control.down = true;
  await fireBtn(page, id).click();
  await page.getByText(/Reações indisponíveis|Sem conexão/).waitFor({ timeout: 10000 });
  eq(await cnt(page, id), 0);
  control.down = false;
  await fireBtn(page, id).click();
  await waitFor(async () => (await cnt(page, id)) === 1 && (await dbCount(id, '🔥')) === 1, 8000);
  await done(page);
});

await test('login do admin com Auth indisponível não derruba o painel', async () => {
  control.authFail = true;
  const page = await newPage();
  await login(page, USERS.owner);
  await page.getByText('E-mail ou senha incorretos.').waitFor({ timeout: 10000 });
  control.authFail = false;
  await done(page);
});

// ───────────── resultado ─────────────
await browser.close();
await infra.stop();
const failed = results.filter((r) => !r[0]);
console.log(`\n${results.length - failed.length}/${results.length} testes E2E passaram`);
if (failed.length) { for (const f of failed) console.log(`FALHOU: ${f[1]}\n   ${String(f[2].message).split('\n')[0]}`); process.exit(1); }
process.exit(0);
