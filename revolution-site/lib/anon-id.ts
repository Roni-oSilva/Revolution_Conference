'use client';
// ID aleatório persistente no navegador (localStorage). NÃO identifica pessoas: limpar o navegador gera outro ID.
const KEY = 'rv_anon_id';
let memory: string | null = null;

export function randomUuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const OK = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getAnonId(): string {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v && OK.test(v)) return v;
    const n = randomUuid();
    window.localStorage.setItem(KEY, n);
    return n;
  } catch {
    return (memory ??= randomUuid()); // armazenamento bloqueado: vale só durante a sessão
  }
}
