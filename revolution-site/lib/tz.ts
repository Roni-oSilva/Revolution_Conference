// Converte "YYYY-MM-DDTHH:mm" (hora local de um fuso IANA) em instante UTC. Usa Intl: respeita horário de verão.
export function zonedLocalToUtcMs(local: string, tz: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!m) return NaN;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return NaN; }
  const offsetAt = (utc: number) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(utc / 1000) * 1000;
  };
  let guess = asUtc - offsetAt(asUtc);
  guess = asUtc - offsetAt(guess);
  return guess;
}

/** ISO (UTC) → valor para <input type="datetime-local"> no fuso informado. */
export function utcToZonedLocalInput(iso: string | null, tz: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  } catch { return ''; }
}

export const isValidTimeZone = (tz: string): boolean => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };
