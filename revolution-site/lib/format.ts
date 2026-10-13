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
