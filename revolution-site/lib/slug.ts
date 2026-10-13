/** "Melhores momentos" -> "melhores-momentos" (ancoras e ids). */
export const slugify = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'categoria';
