import { describe, expect, it } from 'vitest';
import { formatDays, formatTimeH } from '@/lib/format';
import { mapsEmbedUrl } from '@/lib/urls';

describe('datas do evento', () => {
  it('dois dias e horário no fuso do evento', () => {
    const a = '2030-10-17T22:30:00Z', b = '2030-10-18T22:30:00Z';
    expect(formatDays(a, b, 'America/Sao_Paulo')).toBe('17 · 18 out');
    expect(formatTimeH(a, 'America/Sao_Paulo')).toBe('19h30');
  });
  it('um dia só e sem data', () => {
    expect(formatDays('2030-10-17T22:00:00Z', null, 'America/Sao_Paulo')).toBe('17 out');
    expect(formatDays(null, null, 'America/Sao_Paulo')).toBe('');
    expect(formatTimeH('2030-10-17T22:00:00Z', 'America/Sao_Paulo')).toBe('19h');
  });
  it('mapa só em google.com/maps e com a consulta codificada', () => {
    expect(mapsEmbedUrl('Rua A, 1 & 2')).toBe('https://www.google.com/maps?q=Rua%20A%2C%201%20%26%202&output=embed');
  });
});
