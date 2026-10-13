// Infraestrutura dos testes de integração/E2E.
//  REAL:      Postgres (PGlite) com as migrações, PostgREST 12 com RLS, o app Next.js em produção (`next build && next start`), Chromium.
//  SIMULADO:  o Auth (GoTrue) — um servidor mínimo que valida senha e emite JWT HS256 assinado com o MESMO segredo do PostgREST
//             (o PostgREST verifica a assinatura de verdade). Realtime (WebSocket) NÃO existe aqui.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn, execFileSync } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PORTS = { pg: 54329, rest: 54330, api: 54321, app: 3000 };
export const SECRET = 'test-secret-test-secret-test-secret-1234';
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
export const signJwt = (claims, exp = 3600) => {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + exp, ...claims });
  return `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`;
};
export const verifyJwt = (tok) => {
  const [h, p, s] = String(tok || '').split('.');
  if (!h || !p || !s) return null;
  if (createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null;
  const c = JSON.parse(Buffer.from(p, 'base64url').toString());
  return c.exp && c.exp < Date.now() / 1000 ? null : c;
};
export const ANON_KEY = signJwt({ role: 'anon' }, 3600 * 24 * 365);
export const SERVICE_KEY = signJwt({ role: 'service_role' }, 3600 * 24 * 365);

export const USERS = {
  owner: { id: '00000000-0000-4000-8000-0000000000a1', email: 'owner@teste.dev', password: 'senha-owner-123' },
  editor: { id: '00000000-0000-4000-8000-0000000000a2', email: 'editor@teste.dev', password: 'senha-editor-123' },
  plain: { id: '00000000-0000-4000-8000-0000000000a3', email: 'comum@teste.dev', password: 'senha-comum-123' },
};
const userJson = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });
const sessionFor = (u) => {
  const access = signJwt({ sub: u.id, role: 'authenticated', email: u.email, aud: 'authenticated' }, 3600);
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `rt-${u.id}`, user: userJson(u) };
};

/** Exclusão mútua simples: o PGlite tem UMA sessão; o PostgREST mantém transações abertas entre mensagens, então
 *  consultas diretas dos testes não podem se intercalar com requisições REST. */
function createMutex() {
  let tail = Promise.resolve();
  return { run(fn) { const next = tail.then(fn, fn); tail = next.then(() => {}, () => {}); return next; } };
}

export async function startInfra({ chrome } = {}) {
  const db = await PGlite.create();
  await db.exec(readFileSync(join(ROOT, 'tests/db/shim.sql'), 'utf8'));
  for (const f of readdirSync(join(ROOT, 'supabase/migrations')).filter((n) => n.endsWith('.sql')).sort()) await db.exec(readFileSync(join(ROOT, 'supabase/migrations', f), 'utf8'));
  for (const u of Object.values(USERS)) await db.query('insert into auth.users (id, email) values ($1, $2)', [u.id, u.email]);
  await db.exec(`insert into public.admin_users (user_id, role) values ('${USERS.owner.id}', 'owner'), ('${USERS.editor.id}', 'editor');`);

  const pgSock = new PGLiteSocketServer({ db, port: PORTS.pg, host: '127.0.0.1' });
  await pgSock.start();

  const postgrestBin = process.env.POSTGREST_BIN || join(ROOT, '.tools', 'postgrest');
  if (!existsSync(postgrestBin)) throw new Error(`PostgREST não encontrado em ${postgrestBin}. Rode: npm run tools:postgrest`);
  const rest = spawn(postgrestBin, [], { env: { ...process.env, PGRST_DB_URI: `postgres://authenticator:pw@127.0.0.1:${PORTS.pg}/postgres`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: SECRET, PGRST_SERVER_PORT: String(PORTS.rest), PGRST_DB_POOL: '1', PGRST_DB_PREPARED_STATEMENTS: 'false', PGRST_DB_CHANNEL_ENABLED: 'false', PGRST_DB_CONFIG: 'false', PGRST_LOG_LEVEL: 'error' } });
  rest.stderr.on('data', (d) => { if (process.env.DEBUG_E2E) process.stdout.write('[postgrest] ' + d); });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORTS.rest}/site_settings`); if (r.ok) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }

  // proxy "Supabase": /rest/v1 → PostgREST ; /auth/v1 → Auth simulado
  const control = { down: false, authFail: false, requests: [] };
  const mutex = createMutex();
  const sdb = { exec: (s) => mutex.run(() => db.exec(s)), query: (s, p) => mutex.run(() => db.query(s, p)) };
  const api = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    control.requests.push(`${req.method} ${url.pathname}`);
    res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', '*'); res.setHeader('access-control-allow-methods', '*'); res.setHeader('access-control-expose-headers', '*');
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    if (control.down) { res.statusCode = 503; return res.end(JSON.stringify({ message: 'indisponível (simulado)' })); }
    const json = (code, body) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
    if (url.pathname.startsWith('/rest/v1/')) {
      // LIMITAÇÃO do banco de teste: o PGlite derruba a conexão a cada erro SQL; o PostgREST responde 503 (PGRST001) ou 500 e
      // se recupera na chamada seguinte. O proxy repete só o 503. Negações do RLS que geram ERRO SQL (ex.: insert negado)
      // aparecem como 5xx aqui, em vez de 401/403 do Supabase real — por isso os testes checam "status ≥ 400 + banco intacto".
      const chunks = []; req.on('data', (c) => chunks.push(c));
      req.on('end', async () => {
        const body = Buffer.concat(chunks);
        for (let attempt = 0; attempt < 4; attempt++) {
          const out = await mutex.run(() => new Promise((resolve) => {
            const target = httpRequest({ host: '127.0.0.1', port: PORTS.rest, path: url.pathname.replace('/rest/v1', '') + url.search, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${PORTS.rest}`, 'content-length': String(body.length) } }, (pr) => {
              const parts = []; pr.on('data', (c) => parts.push(c)); pr.on('end', () => resolve({ status: pr.statusCode, headers: pr.headers, body: Buffer.concat(parts) }));
            });
            target.on('error', () => resolve({ status: 502, headers: {}, body: Buffer.from('{"message":"postgrest fora do ar"}') }));
            target.end(body);
          }));
          if (process.env.DEBUG_E2E) console.log('[proxy]', url.pathname + url.search.slice(0, 60), attempt, out.status, out.body.toString().slice(0, 160));
          const txt = out.body.toString(); const transient = (out.status === 503 && /PGRST00[01]/.test(txt));
          if (transient && attempt < 3) { await new Promise((r) => setTimeout(r, 250)); continue; }
          const { 'transfer-encoding': _te, connection: _c, ...hdrs } = out.headers; res.writeHead(out.status, { ...hdrs, 'content-length': out.body.length }); return res.end(out.body);
        }
      });
      return;
    }
    if (url.pathname.startsWith('/auth/v1/')) {
      let body = ''; req.on('data', (c) => (body += c));
      req.on('end', () => {
        const data = body ? JSON.parse(body) : {};
        const bearer = (req.headers.authorization || '').replace(/^Bearer /, '');
        if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
          if (control.authFail) return json(500, { message: 'auth indisponível' });
          const u = Object.values(USERS).find((x) => x.email === data.email && x.password === data.password);
          return u ? json(200, sessionFor(u)) : json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
        }
        if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
          const u = Object.values(USERS).find((x) => `rt-${x.id}` === data.refresh_token);
          return u ? json(200, sessionFor(u)) : json(400, { error: 'invalid_grant' });
        }
        if (url.pathname === '/auth/v1/user') {
          const c = verifyJwt(bearer);
          const u = c && Object.values(USERS).find((x) => x.id === c.sub);
          return u ? json(200, userJson(u)) : json(401, { message: 'invalid JWT' });
        }
        if (url.pathname === '/auth/v1/logout') { res.statusCode = 204; return res.end(); }
        if (url.pathname === '/auth/v1/admin/users') {
          const c = verifyJwt(bearer);
          if (!c || c.role !== 'service_role') return json(401, { message: 'not admin' });
          return json(200, { users: Object.values(USERS).map(userJson), aud: 'authenticated' });
        }
        return json(404, { message: 'rota de auth não simulada' });
      });
      return;
    }
    json(404, { message: 'não simulado' });
  });
  await new Promise((r) => api.listen(PORTS.api, '127.0.0.1', r));

  // app Next.js (produção)
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${PORTS.api}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, NEXT_PUBLIC_SITE_URL: `http://localhost:${PORTS.app}`, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, RATE_LIMIT_SALT: 'sal-de-teste-sal-de-teste' };
  if (!process.env.SKIP_BUILD) execFileSync('npx', ['next', 'build'], { cwd: ROOT, env, stdio: process.env.DEBUG_E2E ? 'inherit' : 'ignore' });
  const app = spawn('npx', ['next', 'start', '-p', String(PORTS.app)], { cwd: ROOT, env });
  app.stdout.on('data', (d) => { if (process.env.DEBUG_E2E) process.stdout.write('[next] ' + d); });
  app.stderr.on('data', (d) => { if (process.env.DEBUG_E2E) process.stdout.write('[next!] ' + d); });
  for (let i = 0; i < 120; i++) { try { const r = await fetch(`http://localhost:${PORTS.app}/api/time`); if (r.ok) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }

  return {
    db: sdb, rawDb: db, control, base: `http://localhost:${PORTS.app}`, apiBase: `http://localhost:${PORTS.api}`,
    async stop() { app.kill(); rest.kill(); await new Promise((r) => api.close(r)); await pgSock.stop(); await db.close(); },
  };
}
