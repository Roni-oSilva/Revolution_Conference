import { describe, expect, it } from 'vitest';
import { createAdminToken, verifyAdminToken } from '@/lib/admin/session';

describe('sessão do painel (cookie assinado)', () => {
  it('aceita o token válido e recusa adulterado, expirado, de outra senha e vazio', async () => {
    const t = await createAdminToken('segredo', 1_000);
    expect(await verifyAdminToken('segredo', t, 2_000)).toBe(true);
    expect(await verifyAdminToken('outra', t, 2_000)).toBe(false);
    expect(await verifyAdminToken('segredo', t.slice(0, -1) + (t.endsWith('0') ? '1' : '0'), 2_000)).toBe(false);
    expect(await verifyAdminToken('segredo', t, 1_000 + 13 * 3600e3)).toBe(false);
    expect(await verifyAdminToken('segredo', undefined, 2_000)).toBe(false);
    expect(await verifyAdminToken('', t, 2_000)).toBe(false);
    expect(await verifyAdminToken('segredo', 'abc.def', 2_000)).toBe(false);
  });
});
