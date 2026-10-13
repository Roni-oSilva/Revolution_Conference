import { describe, it, expect } from 'vitest';
import { computePhase, countdownParts, parseIsoMs } from '@/lib/phase';
import { zonedLocalToUtcMs, utcToZonedLocalInput, isValidTimeZone } from '@/lib/tz';

const T = Date.parse('2030-06-15T00:00:00-03:00');
describe('fase do site', () => {
  it('antes da abertura = pre; na abertura = open; após fim = ended', () => {
    expect(computePhase(T - 1, T, null)).toBe('pre');
    expect(computePhase(T, T, null)).toBe('open');
    expect(computePhase(T + 1e9, T, null)).toBe('open');
    expect(computePhase(T + 5000, T, T + 5000)).toBe('ended');
    expect(computePhase(T + 4999, T, T + 5000)).toBe('open');
  });
  it('sem data válida nunca antecipa a abertura', () => {
    expect(computePhase(Date.now() + 1e12, null, null)).toBe('pre');
    expect(computePhase(Date.now(), Number.NaN, null)).toBe('pre');
    expect(parseIsoMs('lixo')).toBeNull();
    expect(parseIsoMs(null)).toBeNull();
  });
  it('contagem regressiva', () => {
    const p = countdownParts(2 * 86400e3 + 3 * 3600e3 + 4 * 60e3 + 5e3 + 999);
    expect([p.days, p.hours, p.minutes, p.seconds, p.done]).toEqual([2, 3, 4, 5, false]);
    expect(countdownParts(-1).done).toBe(true);
    expect(countdownParts(0).seconds).toBe(0);
  });
});
describe('fusos', () => {
  it('meia-noite em São Paulo = 03:00 UTC', () => expect(new Date(zonedLocalToUtcMs('2030-06-15T00:00', 'America/Sao_Paulo')).toISOString()).toBe('2030-06-15T03:00:00.000Z'));
  it('respeita horário de verão histórico', () => expect(new Date(zonedLocalToUtcMs('2018-01-10T12:00', 'America/Sao_Paulo')).toISOString()).toBe('2018-01-10T14:00:00.000Z'));
  it('outros fusos', () => expect(new Date(zonedLocalToUtcMs('2030-06-15T00:00', 'Europe/Lisbon')).toISOString()).toBe('2030-06-14T23:00:00.000Z'));
  it('ida e volta', () => expect(utcToZonedLocalInput('2030-06-15T03:00:00.000Z', 'America/Sao_Paulo')).toBe('2030-06-15T00:00'));
  it('inválidos', () => {
    expect(Number.isNaN(zonedLocalToUtcMs('lixo', 'America/Sao_Paulo'))).toBe(true);
    expect(Number.isNaN(zonedLocalToUtcMs('2030-06-15T00:00', 'Marte/Olimpo'))).toBe(true);
    expect(isValidTimeZone('Marte/Olimpo')).toBe(false);
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true);
    expect(utcToZonedLocalInput(null, 'America/Sao_Paulo')).toBe('');
  });
});
