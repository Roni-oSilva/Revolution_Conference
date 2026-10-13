'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSessionClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/admin/auth';
import { eventSchema, formToObject, inviteSchema, mediaEditSchema, mediaSchema, postSchema, securitySchema, siteSchema, streamSchema, videoEditSchema, videoSchema } from '@/lib/admin/schemas';
import { parseDriveUrl, parseYouTube } from '@/lib/urls';
import { checkDriveImage, checkYouTubeVideo, type Availability } from '@/lib/availability';
import { zonedLocalToUtcMs } from '@/lib/tz';
import { logger } from '@/lib/logger';

type Err = { code?: string; message?: string } | null;
const dbCode = (e: Err): string => (e?.code === '42501' ? 'forbidden' : e?.code === '23505' ? 'duplicate' : e?.code === '23514' && /owner/i.test(e.message ?? '') ? 'last_owner' : 'db');
const back = (path: string, code: string): never => redirect(`${path}${path.includes('?') ? '&' : '?'}m=${encodeURIComponent(code)}`);
const refresh = () => { for (const p of ['/', '/ao-vivo', '/mural']) revalidatePath(p); };
const iso = (local: string | null | undefined, tz: string) => (local ? new Date(zonedLocalToUtcMs(local, tz)).toISOString() : null);
const availCode = (a: Availability, kind: 'drive' | 'yt', ok: string) => (a === 'unavailable' ? (kind === 'drive' ? 'drive_unavailable' : 'yt_unavailable') : a === 'unknown' ? 'check_unknown' : ok);

// ───────────────────────── Sessão ─────────────────────────
export async function loginAction(fd: FormData) {
  const client = await createSessionClient();
  if (!client) back('/admin/login', 'config');
  const email = String(fd.get('email') ?? '').trim();
  const password = String(fd.get('password') ?? '');
  if (!email || !password || email.length > 254 || password.length > 200) back('/admin/login', 'bad_login');
  const { error } = await client!.auth.signInWithPassword({ email, password });
  if (error) { logger.warn('admin.login_failed'); back('/admin/login', 'bad_login'); }
  redirect('/admin');
}
export async function logoutAction() {
  const client = await createSessionClient();
  await client?.auth.signOut();
  redirect('/admin/login');
}

// ───────────────────────── Evento / site / segurança ─────────────────────────
export async function saveEventAction(fd: FormData) {
  const { client } = await requireAdmin();
  const p = eventSchema.safeParse(formToObject(fd));
  if (!p.success) return back('/admin/evento', 'validation');
  const v = p.data;
  const { error } = await client.from('event_settings').update({
    name: v.name, description: v.description, timezone: v.timezone,
    starts_at: iso(v.starts_local, v.timezone), opens_at: iso(v.opens_local, v.timezone), ends_at: iso(v.ends_local, v.timezone),
    location_name: v.location_name, address: v.address, maps_url: v.maps_url,
  }).eq('id', 1);
  if (error) { logger.error('admin.event_save', { code: error.code }); return back('/admin/evento', dbCode(error)); }
  refresh(); back('/admin/evento', 'saved');
}

export async function saveSiteAction(fd: FormData) {
  const { client } = await requireAdmin();
  const p = siteSchema.safeParse(formToObject(fd));
  if (!p.success) return back('/admin/evento', 'validation');
  const { error } = await client.from('site_settings').update(p.data).eq('id', 1);
  if (error) { logger.error('admin.site_save', { code: error.code }); return back('/admin/evento', dbCode(error)); }
  refresh(); back('/admin/evento', 'saved');
}

export async function saveStreamAction(fd: FormData) {
  const { client } = await requireAdmin();
  const p = streamSchema.safeParse(formToObject(fd));
  if (!p.success) return back('/admin/midia', 'validation');
  const { stream_enabled, stream_input, stream_note } = p.data;
  let url: string | null = null, id: string | null = null;
  if (stream_input) {
    const y = parseYouTube(stream_input);
    if (!y.ok) return back('/admin/midia', 'invalid_url');
    id = y.videoId; url = `https://www.youtube.com/watch?v=${id}`;
  }
  if (stream_enabled && !id) return back('/admin/midia', 'validation'); // não liga a transmissão sem vídeo válido
  const { error } = await client.from('event_settings').update({ stream_enabled, stream_url: url, stream_video_id: id, stream_note }).eq('id', 1);
  if (error) return back('/admin/midia', dbCode(error));
  const a = id ? await checkYouTubeVideo(id) : 'ok';
  refresh(); back('/admin/midia', a === 'ok' ? 'saved' : availCode(a, 'yt', 'saved'));
}

export async function saveSecurityAction(fd: FormData) {
  const { client } = await requireAdmin();
  const p = securitySchema.safeParse(formToObject(fd));
  if (!p.success) return back('/admin/seguranca', 'validation');
  const { error } = await client.from('site_settings').update(p.data).eq('id', 1);
  if (error) { logger.warn('admin.security_save', { code: error.code }); return back('/admin/seguranca', dbCode(error)); }
  back('/admin/seguranca', 'saved');
}

// ───────────────────────── Mural ─────────────────────────
function postRow(fd: FormData) {
  const p = postSchema.safeParse(formToObject(fd));
  return p.success ? p.data : null;
}
export async function savePostAction(fd: FormData) {
  const { client } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  const v = postRow(fd);
  if (!v) return back('/admin/mural', 'validation');
  const res = id ? await client.from('wall_posts').update(v).eq('id', id) : await client.from('wall_posts').insert(v);
  if (res.error) { logger.error('admin.post_save', { code: res.error.code }); return back('/admin/mural', dbCode(res.error)); }
  refresh(); back('/admin/mural', id ? 'saved' : 'created');
}
export async function setPostStatusAction(fd: FormData) {
  const { client } = await requireAdmin();
  const id = String(fd.get('id') ?? ''); const status = String(fd.get('status') ?? '');
  if (!['draft', 'published', 'hidden'].includes(status) || !id) return back('/admin/mural', 'validation');
  const { error } = await client.from('wall_posts').update({ status }).eq('id', id);
  if (error) return back('/admin/mural', dbCode(error));
  refresh(); back('/admin/mural', status === 'hidden' ? 'hidden' : status === 'published' ? (fd.get('restore') ? 'restored' : 'published') : 'saved');
}
export async function movePostAction(fd: FormData) { return moveGeneric('wall_posts', fd, '/admin/mural'); }
export async function deletePostAction(fd: FormData) {
  const { client } = await requireAdmin();
  const { error } = await client.from('wall_posts').delete().eq('id', String(fd.get('id') ?? ''));
  if (error) return back('/admin/mural', dbCode(error));
  refresh(); back('/admin/mural', 'deleted');
}

/** Reordena trocando `position` com o vizinho (lista já ordenada por position). */
async function moveGeneric(table: 'wall_posts' | 'media' | 'videos', fd: FormData, path: string) {
  const { client } = await requireAdmin();
  const id = String(fd.get('id') ?? ''); const dir = fd.get('dir') === 'up' ? -1 : 1;
  const { data, error } = await client.from(table).select('id, position').order('position').order('created_at', { ascending: false });
  if (error || !data) return back(path, 'db');
  // normaliza posições 0..n-1 para evitar empates e então troca com o vizinho
  const list = data.map((r, i) => ({ id: r.id as string, position: i }));
  const i = list.findIndex((r) => r.id === id); const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return back(path, 'moved');
  [list[i], list[j]] = [list[j], list[i]];
  for (let k = 0; k < list.length; k++) {
    const { error: e } = await client.from(table).update({ position: k }).eq('id', list[k].id);
    if (e) return back(path, dbCode(e));
  }
  refresh(); back(path, 'moved');
}

// ───────────────────────── Fotos (Drive) ─────────────────────────
export async function addMediaAction(fd: FormData) {
  const { client } = await requireAdmin();
  const p = mediaSchema.safeParse(formToObject(fd));
  if (!p.success) return back('/admin/midia', 'validation');
  const d = parseDriveUrl(p.data.url);
  if (!d.ok) return back('/admin/midia', d.reason === 'folder' ? 'folder' : 'invalid_url');
  const availability = await checkDriveImage(d.fileId);
  const { error } = await client.from('media').insert({
    original_url: p.data.url, drive_file_id: d.fileId, title: p.data.title, alt: p.data.alt, caption: p.data.caption, album: p.data.album,
    is_published: availability === 'ok', availability, checked_at: new Date().toISOString(), position: 9999,
  });
  if (error) { logger.error('admin.media_add', { code: error.code }); return back('/admin/midia', dbCode(error)); }
  refresh(); back('/admin/midia', availCode(availability, 'drive', 'created'));
}
export async function updateMediaAction(fd: FormData) {
  const { client } = await requireAdmin();
  const p = mediaEditSchema.safeParse(formToObject(fd));
  if (!p.success) return back('/admin/midia', 'validation');
  const { error } = await client.from('media').update(p.data).eq('id', String(fd.get('id') ?? ''));
  if (error) return back('/admin/midia', dbCode(error));
  refresh(); back('/admin/midia', 'saved');
}
export async function recheckMediaAction(fd: FormData) {
  const { client } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  const { data } = await client.from('media').select('drive_file_id').eq('id', id).maybeSingle();
  if (!data) return back('/admin/midia', 'db');
  const availability = await checkDriveImage(data.drive_file_id);
  const { error } = await client.from('media').update({ availability, checked_at: new Date().toISOString() }).eq('id', id);
  if (error) return back('/admin/midia', dbCode(error));
  refresh(); back('/admin/midia', availability === 'ok' ? 'rechecked' : availCode(availability, 'drive', 'rechecked'));
}
export async function moveMediaAction(fd: FormData) { return moveGeneric('media', fd, '/admin/midia'); }
export async function deleteMediaAction(fd: FormData) {
  const { client } = await requireAdmin();
  const { error } = await client.from('media').delete().eq('id', String(fd.get('id') ?? ''));
  if (error) return back('/admin/midia', dbCode(error));
  refresh(); back('/admin/midia', 'deleted');
}

// ───────────────────────── Vídeos (YouTube) ─────────────────────────
export async function addVideoAction(fd: FormData) {
  const { client } = await requireAdmin();
  const p = videoSchema.safeParse(formToObject(fd));
  if (!p.success) return back('/admin/midia', 'validation');
  const y = parseYouTube(p.data.url);
  if (!y.ok) return back('/admin/midia', 'invalid_url');
  const availability = await checkYouTubeVideo(y.videoId);
  const { error } = await client.from('videos').insert({
    title: p.data.title, description: p.data.description, category: p.data.category, youtube_id: y.videoId,
    url: `https://www.youtube.com/watch?v=${y.videoId}`, availability, checked_at: new Date().toISOString(), position: 9999,
  });
  if (error) return back('/admin/midia', dbCode(error));
  refresh(); back('/admin/midia', availCode(availability, 'yt', 'created'));
}
export async function updateVideoAction(fd: FormData) {
  const { client } = await requireAdmin();
  const p = videoEditSchema.safeParse(formToObject(fd));
  if (!p.success) return back('/admin/midia', 'validation');
  const { error } = await client.from('videos').update(p.data).eq('id', String(fd.get('id') ?? ''));
  if (error) return back('/admin/midia', dbCode(error));
  refresh(); back('/admin/midia', 'saved');
}
export async function recheckVideoAction(fd: FormData) {
  const { client } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  const { data } = await client.from('videos').select('youtube_id').eq('id', id).maybeSingle();
  if (!data) return back('/admin/midia', 'db');
  const availability = await checkYouTubeVideo(data.youtube_id);
  const { error } = await client.from('videos').update({ availability, checked_at: new Date().toISOString() }).eq('id', id);
  if (error) return back('/admin/midia', dbCode(error));
  refresh(); back('/admin/midia', availability === 'ok' ? 'rechecked' : availCode(availability, 'yt', 'rechecked'));
}
export async function moveVideoAction(fd: FormData) { return moveGeneric('videos', fd, '/admin/midia'); }
export async function deleteVideoAction(fd: FormData) {
  const { client } = await requireAdmin();
  const { error } = await client.from('videos').delete().eq('id', String(fd.get('id') ?? ''));
  if (error) return back('/admin/midia', dbCode(error));
  refresh(); back('/admin/midia', 'deleted');
}

// ───────────────────────── Administradores (somente owner; o banco também exige) ─────────────────────────
export async function inviteAdminAction(fd: FormData) {
  const { client, role } = await requireAdmin();
  if (role !== 'owner') return back('/admin/seguranca', 'forbidden');
  const p = inviteSchema.safeParse(formToObject(fd));
  if (!p.success) return back('/admin/seguranca', 'validation');
  const svc = createServiceClient();
  if (!svc) return back('/admin/seguranca', 'no_service');
  // service_role é usada SÓ para localizar o usuário pelo e-mail; a escrita em admin_users usa a sessão do owner (RLS).
  let userId: string | null = null;
  for (let page = 1; page <= 10 && !userId; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) break;
    userId = data.users.find((u) => u.email?.toLowerCase() === p.data.email.toLowerCase())?.id ?? null;
    if (data.users.length < 200) break;
  }
  if (!userId) return back('/admin/seguranca', 'not_found_user');
  const { error } = await client.from('admin_users').upsert({ user_id: userId, role: p.data.role });
  if (error) return back('/admin/seguranca', dbCode(error));
  logger.info('admin.invited', { role: p.data.role });
  back('/admin/seguranca', 'saved');
}
export async function removeAdminAction(fd: FormData) {
  const { client } = await requireAdmin();
  const { error } = await client.from('admin_users').delete().eq('user_id', String(fd.get('user_id') ?? ''));
  if (error) return back('/admin/seguranca', dbCode(error));
  back('/admin/seguranca', 'deleted');
}
export async function setAdminRoleAction(fd: FormData) {
  const { client } = await requireAdmin();
  const role = fd.get('role') === 'owner' ? 'owner' : 'editor';
  const { error } = await client.from('admin_users').update({ role }).eq('user_id', String(fd.get('user_id') ?? ''));
  if (error) return back('/admin/seguranca', dbCode(error));
  back('/admin/seguranca', 'saved');
}
