import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV !== 'production';
  const supa = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  let connect = "'self'";
  if (supa) {
    try { const u = new URL(supa); connect += ` ${u.origin} ${u.protocol === 'https:' ? 'wss' : 'ws'}://${u.host}`; } catch { /* env inválida: ignora */ }
  }
  if (dev) connect += ' ws: http:';
  const https = (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://');
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    `connect-src ${connect}`,
    'frame-src https://www.youtube-nocookie.com https://www.google.com',
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https && !dev ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const path = request.nextUrl.pathname;

  // /mural/<algo que não é UUID>: 404 de verdade (o streaming do Next devolveria 200 depois de iniciar a resposta).
  const muralId = /^\/mural\/([^/]+)\/?$/.exec(path)?.[1];
  if (muralId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(muralId)) {
    return new NextResponse('Publicação não encontrada', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'Content-Security-Policy': csp } });
  }

  // Rotas /admin: renova a sessão e exige usuário logado. (A checagem de PERMISSÃO de admin é feita no servidor
  // — requireAdmin() em cada página/ação — e, por fim, pelo RLS do banco.)
  if (path.startsWith('/admin') && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    let user = null;
    try { user = (await supabase.auth.getUser()).data.user; } catch { user = null; }
    if (!user && path !== '/admin/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = '';
      const redirect = NextResponse.redirect(url);
      redirect.headers.set('Content-Security-Policy', csp);
      return redirect;
    }
  }
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico|fonts/|icon.svg).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }] }],
};
