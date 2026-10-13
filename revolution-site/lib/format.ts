export function formatEventDate(iso: string | null, timeZone: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
  } catch {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' }).format(d);
  }
}
export function formatShort(iso: string | null, timeZone = 'America/Sao_Paulo'): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(+d) ? '' : new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}

/** "17 · 18" (dias do evento no fuso) e "19h30" (horário de início). Vazio quando não há data. */
export function formatDays(startIso: string | null, endIso: string | null, timeZone: string): string {
  if (!startIso || Number.isNaN(+new Date(startIso))) return '';
  const day = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit' }).format(new Date(iso));
  const a = day(startIso);
  const b = endIso && !Number.isNaN(+new Date(endIso)) ? day(endIso) : a;
  const mon = new Intl.DateTimeFormat('pt-BR', { timeZone, month: 'short' }).format(new Date(startIso)).replace('.', '');
  return `${a === b ? a : `${a} · ${b}`} ${mon}`;
}
export function formatTimeH(iso: string | null, timeZone: string): string {
  if (!iso || Number.isNaN(+new Date(iso))) return '';
  const p = new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return `${g('hour')}h${g('minute') === '00' ? '' : g('minute')}`;
}
