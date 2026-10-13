// Verificações de disponibilidade feitas NO SERVIDOR, quando o admin cadastra/atualiza uma mídia.
import { driveThumbUrl, youtubeWatchUrl } from './urls';

export type Availability = 'ok' | 'unavailable' | 'unknown';
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Foto do Drive: só é "ok" se a miniatura pública responder 200 com content-type de imagem.
 *  Arquivo privado redireciona para login do Google (302/303) ou responde 403/404 → "unavailable".
 *  Falha de rede → "unknown" (não afirmamos nada). */
export async function checkDriveImage(fileId: string, f: FetchLike = fetch): Promise<Availability> {
  try {
    const res = await f(driveThumbUrl(fileId, 64), { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'RevolutionConferenceBot/1.0 (+availability-check)' } });
    if (res.status === 200 && (res.headers.get('content-type') ?? '').toLowerCase().startsWith('image/')) return 'ok';
    if ([301, 302, 303, 307, 308, 401, 403, 404, 410].includes(res.status)) return 'unavailable';
    if (res.status === 200) return 'unavailable'; // HTML (página de login) em vez de imagem
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Vídeo do YouTube via oEmbed: 200 = existe e é público/incorporável; 401/403/404 = privado, removido ou sem permissão de incorporação. */
export async function checkYouTubeVideo(videoId: string, f: FetchLike = fetch): Promise<Availability> {
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeWatchUrl(videoId))}`;
    const res = await f(url, { method: 'GET', signal: AbortSignal.timeout(6000) });
    if (res.status === 200) return 'ok';
    if ([401, 403, 404].includes(res.status)) return 'unavailable';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
