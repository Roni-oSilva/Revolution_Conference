// Acesso a dados (somente leitura) compartilhado entre o site público e a pré-visualização do admin.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventSettings, MediaRow, ScheduleRow, SiteSettings, VideoRow, WallPost } from './types';
import { REACTION_EMOJIS, type ReactionEmoji } from './reactions';

export const WALL_PAGE_SIZE = 10;
export type Result<T> = { ok: true; data: T; error: null } | { ok: false; data: null; error: string };
const fail = <T,>(e: { message?: string } | null | undefined): Result<T> => ({ ok: false, data: null, error: e?.message ?? 'erro desconhecido' });

export async function getSettings(c: SupabaseClient): Promise<Result<{ site: SiteSettings; event: EventSettings }>> {
  const [s, e] = await Promise.all([
    c.from('site_settings').select('*').eq('id', 1).maybeSingle(),
    c.from('event_settings').select('*').eq('id', 1).maybeSingle(),
  ]);
  if (s.error || e.error) return fail(s.error ?? e.error);
  if (!s.data || !e.data) return { ok: false, data: null, error: 'configurações não encontradas (rode as migrações)' };
  return { ok: true, data: { site: s.data as SiteSettings, event: e.data as EventSettings }, error: null };
}

/** Público: só publicadas e NÃO marcadas como indisponíveis. Pré-visualização do admin (`preview`): tudo que o RLS permitir. */
export async function getGallery(c: SupabaseClient, preview = false, limit = 60): Promise<Result<MediaRow[]>> {
  let q = c.from('media').select('*');
  if (!preview) q = q.eq('is_published', true).neq('availability', 'unavailable');
  const { data, error } = await q.order('is_featured', { ascending: false }).order('position').order('created_at', { ascending: false }).limit(limit);
  return error ? fail(error) : { ok: true, data: (data ?? []) as MediaRow[], error: null };
}

export async function getVideos(c: SupabaseClient, preview = false): Promise<Result<VideoRow[]>> {
  let q = c.from('videos').select('*');
  if (!preview) q = q.eq('is_published', true).neq('availability', 'unavailable');
  const { data, error } = await q.order('category').order('position').order('created_at', { ascending: false });
  return error ? fail(error) : { ok: true, data: (data ?? []) as VideoRow[], error: null };
}

export async function getSchedule(c: SupabaseClient, preview = false): Promise<Result<ScheduleRow[]>> {
  let q = c.from('schedule_items').select('*');
  if (!preview) q = q.eq('is_published', true);
  const { data, error } = await q.order('position').order('created_at');
  return error ? fail(error) : { ok: true, data: (data ?? []) as ScheduleRow[], error: null };
}

const POST_SELECT = '*, media:image_media_id(drive_file_id, alt, availability), post_reaction_counts(emoji, count)';
function shapePost(row: any): WallPost {
  const counts: Partial<Record<ReactionEmoji, number>> = {};
  for (const r of row.post_reaction_counts ?? []) if ((REACTION_EMOJIS as readonly string[]).includes(r.emoji)) counts[r.emoji as ReactionEmoji] = r.count;
  const { post_reaction_counts: _c, ...rest } = row;
  return { ...rest, media: row.media ?? null, counts } as WallPost;
}

function visible(c: SupabaseClient, includeUnpublished: boolean) {
  let q = c.from('wall_posts').select(POST_SELECT, { count: 'exact' });
  if (!includeUnpublished) q = q.eq('status', 'published');
  return q;
}

export async function getWallPage(c: SupabaseClient, page: number, includeUnpublished = false): Promise<Result<{ posts: WallPost[]; total: number }>> {
  const p = Math.max(1, Math.floor(page) || 1);
  const { data, error, count } = await visible(c, includeUnpublished)
    .order('position', { ascending: true }).order('created_at', { ascending: false })
    .range((p - 1) * WALL_PAGE_SIZE, p * WALL_PAGE_SIZE - 1);
  if (error) return fail(error);
  return { ok: true, data: { posts: (data ?? []).map(shapePost), total: count ?? 0 }, error: null };
}

export async function getWallPost(c: SupabaseClient, id: string, includeUnpublished = false): Promise<Result<WallPost | null>> {
  let q = c.from('wall_posts').select(POST_SELECT).eq('id', id);
  if (!includeUnpublished) q = q.eq('status', 'published');
  const { data, error } = await q.maybeSingle();
  if (error) return fail(error);
  return { ok: true, data: data ? shapePost(data) : null, error: null };
}

export async function getHighlights(c: SupabaseClient, includeUnpublished = false): Promise<Result<WallPost[]>> {
  let q = c.from('wall_posts').select(POST_SELECT).eq('is_highlight', true);
  if (!includeUnpublished) q = q.eq('status', 'published');
  const { data, error } = await q.order('position').order('created_at', { ascending: false }).limit(3);
  return error ? fail(error) : { ok: true, data: (data ?? []).map(shapePost), error: null };
}
