// Fase do site, calculada a partir do horário (do servidor) — nunca de um "botão".
export type Phase = 'pre' | 'open' | 'ended';

export function computePhase(nowMs: number, opensAtMs: number | null, endsAtMs: number | null): Phase {
  if (opensAtMs == null || !Number.isFinite(opensAtMs)) return 'pre'; // sem data válida nunca antecipamos a abertura
  if (nowMs < opensAtMs) return 'pre';
  if (endsAtMs != null && Number.isFinite(endsAtMs) && nowMs >= endsAtMs) return 'ended';
  return 'open';
}

export function countdownParts(msLeft: number) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor(s / 3600) % 24, minutes: Math.floor(s / 60) % 60, seconds: s % 60, done: s <= 0 };
}

/** Relógio corrigido: offset = (agora no servidor) − (agora no cliente) medido no mesmo instante. */
export const correctedNow = (clientNowMs: number, offsetMs: number): number => clientNowMs + offsetMs;

export function parseIsoMs(v: string | null | undefined): number | null {
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}
