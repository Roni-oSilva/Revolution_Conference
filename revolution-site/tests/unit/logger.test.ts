import { describe, it, expect, vi } from 'vitest';
import { redact, logger } from '@/lib/logger';

describe('logs sem dados pessoais', () => {
  it('remove chaves sensíveis e trunca textos longos', () => {
    const r = redact({ ip: '1.2.3.4', email: 'a@b.c', anonId: 'x', token: 't', Authorization: 'Bearer x', ok: 'visível', nested: { password: 'p', n: 1 }, long: 'a'.repeat(500) }) as any;
    expect(r.ip).toBe('[removido]'); expect(r.email).toBe('[removido]'); expect(r.anonId).toBe('[removido]');
    expect(r.token).toBe('[removido]'); expect(r.Authorization).toBe('[removido]'); expect(r.nested.password).toBe('[removido]');
    expect(r.ok).toBe('visível'); expect(r.nested.n).toBe(1); expect((r.long as string).length).toBeLessThan(250);
  });
  it('imprime JSON em linha', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('teste', { ip: '9.9.9.9', action: 'added' });
    const line = String(spy.mock.calls[0][0]);
    expect(line).not.toContain('9.9.9.9');
    expect(JSON.parse(line)).toMatchObject({ level: 'info', event: 'teste', data: { action: 'added' } });
    spy.mockRestore();
  });
});
