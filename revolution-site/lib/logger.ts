// Log estruturado SEM dados pessoais: chaves sensíveis são removidas e strings longas truncadas.
const SENSITIVE = /(ip|email|mail|anon|token|authorization|cookie|password|senha|secret|key|user)/i;

export function redact(value: unknown, depth = 0): unknown {
  if (value == null || depth > 3) return value ?? null;
  if (typeof value === 'string') return value.length > 200 ? value.slice(0, 200) + '…' : value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = SENSITIVE.test(k) ? '[removido]' : redact(v, depth + 1);
  return out;
}

type Level = 'info' | 'warn' | 'error';
function write(level: Level, event: string, data?: Record<string, unknown>) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...(data ? { data: redact(data) } : {}) });
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}
export const logger = {
  info: (e: string, d?: Record<string, unknown>) => write('info', e, d),
  warn: (e: string, d?: Record<string, unknown>) => write('warn', e, d),
  error: (e: string, d?: Record<string, unknown>) => write('error', e, d),
};
