import { NextResponse, type NextRequest } from 'next/server';

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

  // Rotas /admin: sem o cookie de login → tela de login. (A validação completa do cookie é refeita no servidor em cada página/ação.)
  if (path.startsWith('/admin') && path !== '/admin/login' && !request.cookies.get('rv_admin')?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    const redirect = NextResponse.redirect(url);
    redirect.headers.set('Content-Security-Policy', csp);
    return redirect;
  }
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico|fonts/|icon.svg).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }] }],
};
