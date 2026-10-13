// Validação e extração de URLs externas (Google Drive e YouTube). Tudo aqui é puro e testado.
// Regra: só https, só domínios da lista; qualquer outra coisa é rejeitada.

const DRIVE_ID = /^[A-Za-z0-9_-]{10,120}$/;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export const DRIVE_HOSTS = ['drive.google.com', 'docs.google.com'] as const;
export const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com', 'youtube-nocookie.com'] as const;

/** Mapa incorporado (sem chave de API) a partir do endereço. Só google.com/maps. */
export function mapsEmbedUrl(query: string): string { return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`; }
export function mapsOpenUrl(query: string): string { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`; }

export function parseHttpsUrl(input: unknown): URL | null {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (s.length === 0 || s.length > 2048 || /[\s\u0000-\u001f]/.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

/** Qualquer https público (links de mapa/redes). Bloqueia javascript:, data:, http:, credenciais etc. */
export const isSafeHttpsUrl = (input: unknown): boolean => parseHttpsUrl(input) !== null;

export type DriveParse = { ok: true; fileId: string } | { ok: false; reason: 'invalid_url' | 'not_drive' | 'folder' | 'no_file_id' };

/** Aceita: /file/d/ID/view, /open?id=ID, /uc?id=ID (drive.google.com ou docs.google.com). Rejeita pastas. */
export function parseDriveUrl(input: unknown): DriveParse {
  const u = parseHttpsUrl(input);
  if (!u) return { ok: false, reason: 'invalid_url' };
  if (!(DRIVE_HOSTS as readonly string[]).includes(u.hostname)) return { ok: false, reason: 'not_drive' };
  if (/\/drive\/(u\/\d+\/)?folders\//.test(u.pathname) || u.pathname.startsWith('/folders/')) return { ok: false, reason: 'folder' };
  const m = /\/file\/d\/([^/]+)/.exec(u.pathname);
  const id = m?.[1] ?? u.searchParams.get('id') ?? '';
  if (!DRIVE_ID.test(id)) return { ok: false, reason: 'no_file_id' };
  return { ok: true, fileId: id };
}

export const driveThumbUrl = (fileId: string, width: number): string =>
  `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${Math.max(64, Math.min(2000, Math.round(width)))}`;

export type YouTubeParse = { ok: true; videoId: string } | { ok: false; reason: 'invalid_url' | 'not_youtube' | 'no_video_id' };

/** Aceita watch?v=, youtu.be/, /embed/, /live/, /shorts/ e o ID puro (11 caracteres). */
export function parseYouTube(input: unknown): YouTubeParse {
  if (typeof input === 'string' && YT_ID.test(input.trim())) return { ok: true, videoId: input.trim() };
  const u = parseHttpsUrl(input);
  if (!u) return { ok: false, reason: 'invalid_url' };
  if (!(YOUTUBE_HOSTS as readonly string[]).includes(u.hostname)) return { ok: false, reason: 'not_youtube' };
  let id = '';
  if (u.hostname === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? '';
  else {
    id = u.searchParams.get('v') ?? '';
    if (!id) id = /^\/(?:embed|live|shorts|v)\/([^/?]+)/.exec(u.pathname)?.[1] ?? '';
  }
  return YT_ID.test(id) ? { ok: true, videoId: id } : { ok: false, reason: 'no_video_id' };
}

export const youtubeEmbedUrl = (videoId: string): string =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1&playsinline=1`;
export const youtubeWatchUrl = (videoId: string): string => `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
export const youtubeThumbUrl = (videoId: string): string => `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;

export const DRIVE_ERRORS: Record<string, string> = {
  invalid_url: 'Informe um link https válido.',
  not_drive: 'O link precisa ser do Google Drive (drive.google.com).',
  folder: 'Este é um link de pasta. Cole o link de um arquivo de imagem (Compartilhar → Copiar link).',
  no_file_id: 'Não foi possível encontrar o ID do arquivo no link.',
};
export const YOUTUBE_ERRORS: Record<string, string> = {
  invalid_url: 'Informe um link https válido.',
  not_youtube: 'O link precisa ser do YouTube.',
  no_video_id: 'Não foi possível encontrar o ID do vídeo no link.',
};
