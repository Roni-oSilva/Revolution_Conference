import { describe, it, expect } from 'vitest';
import { checkDriveImage, checkYouTubeVideo, type FetchLike } from '@/lib/availability';

const res = (status: number, headers: Record<string, string> = {}) => async () => new Response(status === 200 ? 'x' : null, { status, headers });
describe('disponibilidade do Drive (com fetch simulado — o Google não é consultado aqui)', () => {
  it('imagem pública → ok', async () => expect(await checkDriveImage('F'.repeat(20), res(200, { 'content-type': 'image/jpeg' }))).toBe('ok'));
  it('redirecionamento para login (arquivo privado) → unavailable', async () => expect(await checkDriveImage('F'.repeat(20), res(302, { location: 'https://accounts.google.com/' }))).toBe('unavailable'));
  it('403/404 → unavailable', async () => { expect(await checkDriveImage('F'.repeat(20), res(403))).toBe('unavailable'); expect(await checkDriveImage('F'.repeat(20), res(404))).toBe('unavailable'); });
  it('200 com HTML (página de login) → unavailable', async () => expect(await checkDriveImage('F'.repeat(20), res(200, { 'content-type': 'text/html' }))).toBe('unavailable'));
  it('erro de rede → unknown (não afirma nada)', async () => expect(await checkDriveImage('F'.repeat(20), (async () => { throw new Error('rede'); }) as FetchLike)).toBe('unknown'));
  it('5xx → unknown', async () => expect(await checkDriveImage('F'.repeat(20), res(503))).toBe('unknown'));
});
describe('disponibilidade do YouTube (oEmbed simulado)', () => {
  it('200 → ok', async () => expect(await checkYouTubeVideo('dQw4w9WgXcQ', res(200, { 'content-type': 'application/json' }))).toBe('ok'));
  it('401/403/404 (privado, removido, sem incorporação) → unavailable', async () => { for (const s of [401, 403, 404]) expect(await checkYouTubeVideo('dQw4w9WgXcQ', res(s))).toBe('unavailable'); });
  it('rede fora → unknown', async () => expect(await checkYouTubeVideo('dQw4w9WgXcQ', (async () => { throw new Error('x'); }) as FetchLike)).toBe('unknown'));
});
