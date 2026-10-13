import { describe, it, expect, vi } from 'vitest';
import { handleReactionPost, handleMineGet, hashIp, isSameOrigin, type ServiceLike } from '@/lib/reactions-server';

const UUID = '11111111-1111-4111-8111-111111111111';
const POST = '22222222-2222-4222-8222-222222222222';
const mk = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost:3000/api/reactions', { method: 'POST', headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9, 10.0.0.1', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const svc = (data: any = { ok: true, action: 'added' }, error: any = null) => { const rpc = vi.fn(async () => ({ data, error })); return { service: { rpc } as ServiceLike, rpc }; };
const valid = { postId: POST, anonId: UUID, emoji: '🔥' };

describe('POST /api/reactions', () => {
  it('registra e envia hash do IP (nunca o IP)', async () => {
    const { service, rpc } = svc();
    const r = await handleReactionPost(mk(valid), { service, salt: 'sal-secreto' });
    expect(r.status).toBe(200);
    const args = rpc.mock.calls[0] as any[];
    expect(args[0]).toBe('react_to_post');
    expect(args[1]).toMatchObject({ p_post_id: POST, p_anon_id: UUID, p_emoji: '🔥', p_ip_hash: hashIp('203.0.113.9', 'sal-secreto') });
    expect(JSON.stringify(args)).not.toContain('203.0.113.9');
  });
  it('remoção (emoji null) é aceita', async () => {
    const { service, rpc } = svc({ ok: true, action: 'removed' });
    expect((await handleReactionPost(mk({ ...valid, emoji: null }), { service, salt: 's' })).status).toBe(200);
    expect((rpc.mock.calls[0] as any[])[1].p_emoji).toBeNull();
  });
  it('rejeita origem estranha ou ausente (403)', async () => {
    const { service, rpc } = svc();
    expect((await handleReactionPost(mk(valid, { origin: 'https://evil.example' }), { service, salt: 's' })).status).toBe(403);
    const noOrigin = new Request('http://localhost:3000/api/reactions', { method: 'POST', headers: { host: 'localhost:3000' }, body: JSON.stringify(valid) });
    expect((await handleReactionPost(noOrigin, { service, salt: 's' })).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejeita corpo inválido, JSON quebrado, emoji fora da lista e corpo grande', async () => {
    const { service, rpc } = svc();
    expect((await handleReactionPost(mk('{quebrado'), { service, salt: 's' })).status).toBe(400);
    expect((await handleReactionPost(mk({ ...valid, emoji: '💩' }), { service, salt: 's' })).status).toBe(400);
    expect((await handleReactionPost(mk({ ...valid, postId: 'x' }), { service, salt: 's' })).status).toBe(400);
    expect((await handleReactionPost(mk({ ...valid, extra: 1 }), { service, salt: 's' })).status).toBe(400);
    expect((await handleReactionPost(mk('x'.repeat(5000)), { service, salt: 's' })).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('mapeia respostas do banco: 429, 404, 403, 502, 503', async () => {
    const cases: [any, any, number][] = [[{ error: 'rate_limited' }, null, 429], [{ error: 'not_found' }, null, 404], [{ error: 'disabled' }, null, 403], [null, { message: 'db' }, 502]];
    for (const [data, error, status] of cases) {
      const { service } = svc(data, error);
      const r = await handleReactionPost(mk(valid), { service, salt: 's' });
      expect(r.status).toBe(status);
      if (status === 429) expect(r.headers.get('retry-after')).toBe('30');
    }
    expect((await handleReactionPost(mk(valid), { service: null, salt: 's' })).status).toBe(503);
  });
  it('não grava IP nem ID nos logs', async () => {
    const out: string[] = [];
    const spies = (['log', 'warn', 'error'] as const).map((m) => vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { out.push(String(a[0])); }));
    await handleReactionPost(mk(valid), { service: svc().service, salt: 's' });
    await handleReactionPost(mk(valid), { service: svc(null, { message: 'falha' }).service, salt: 's' });
    spies.forEach((s) => s.mockRestore());
    const all = out.join('\n');
    expect(all).not.toContain('203.0.113.9'); expect(all).not.toContain(UUID); expect(all.length).toBeGreaterThan(0);
  });
  it('hash do IP é estável, salgado e não reversível trivialmente', () => {
    expect(hashIp('1.1.1.1', 'a')).toBe(hashIp('1.1.1.1', 'a'));
    expect(hashIp('1.1.1.1', 'a')).not.toBe(hashIp('1.1.1.1', 'b'));
    expect(hashIp('1.1.1.1', 'a')).toMatch(/^[0-9a-f]{32}$/);
  });
  it('isSameOrigin considera host e NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://site.example';
    expect(isSameOrigin(new Request('https://site.example/api', { headers: { origin: 'https://site.example', host: 'outro' } }))).toBe(true);
    expect(isSameOrigin(new Request('https://site.example/api', { headers: { origin: 'https://evil.example', host: 'site.example' } }))).toBe(false);
  });
});
describe('GET /api/reactions/mine', () => {
  const get = (ids: string, anon: string | null, extra: Record<string, string> = {}) =>
    new Request(`http://localhost:3000/api/reactions/mine?postIds=${ids}`, { headers: { host: 'localhost:3000', 'sec-fetch-site': 'same-origin', ...(anon ? { 'x-anon-id': anon } : {}), ...extra } });
  it('devolve o mapa de reações do ID', async () => {
    const { service } = svc([{ post_id: POST, emoji: '🙌' }]);
    const r = await handleMineGet(get(POST, UUID), { service, salt: 's' });
    expect(await r.json()).toEqual({ reactions: { [POST]: '🙌' } });
  });
  it('valida ID anônimo e quantidade; bloqueia origem estranha', async () => {
    const { service } = svc([]);
    expect((await handleMineGet(get(POST, null), { service, salt: 's' })).status).toBe(400);
    expect((await handleMineGet(get(Array(51).fill(POST).join(','), UUID), { service, salt: 's' })).status).toBe(400);
    expect((await handleMineGet(get(POST, UUID, { 'sec-fetch-site': 'cross-site' }), { service, salt: 's' })).status).toBe(403);
  });
});
