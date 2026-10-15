/** @type {import('next').NextConfig} */
const dev = process.env.NODE_ENV !== 'production';
const supa = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
let connect = "'self'";
try { if (supa) { const u = new URL(supa); connect += ` ${u.origin} ${u.protocol === 'https:' ? 'wss' : 'ws'}://${u.host}`; } } catch { /* env inválida: ignora */ }
if (dev) connect += ' ws: http:';
const csp = [
  "default-src 'self'",
  // o Next injeta scripts inline de hidratação; sem nonce é preciso 'unsafe-inline'
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
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
].join('; ');

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Cabeçalhos estáticos (sem middleware: mais simples e sem ponto de falha no runtime Edge da Vercel).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};
export default nextConfig;
