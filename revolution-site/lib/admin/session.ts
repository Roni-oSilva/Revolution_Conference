/** Sessão simples do painel: um cookie assinado (HMAC-SHA256) com validade. Usa Web Crypto → funciona no middleware e no servidor. */
export const ADMIN_COOKIE = 'rv_admin';
export const ADMIN_TTL_MS = 12 * 3600e3;

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(`rv-admin-v1:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
const same = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

export async function createAdminToken(secret: string, now = Date.now()): Promise<string> {
  const exp = String(now + ADMIN_TTL_MS);
  return `${exp}.${await sign(secret, exp)}`;
}
export async function verifyAdminToken(secret: string, token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!secret || !token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  return same(sig, await sign(secret, exp));
}
export const safeEqual = same;
