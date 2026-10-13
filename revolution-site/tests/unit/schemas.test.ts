import { describe, it, expect } from 'vitest';
import { eventSchema, mediaSchema, postSchema, securitySchema, siteSchema, streamSchema, videoSchema } from '@/lib/admin/schemas';
import { reactionBodySchema, mineQuerySchema } from '@/lib/reactions';

const UUID = '11111111-1111-4111-8111-111111111111';
describe('formulários do admin', () => {
  it('post: exige texto, limita tamanho, valida status', () => {
    expect(postSchema.safeParse({ title: '', body: '  ', status: 'draft', position: '0' }).success).toBe(false);
    expect(postSchema.safeParse({ title: 'x', body: 'a'.repeat(2001), status: 'draft', position: '0' }).success).toBe(false);
    expect(postSchema.safeParse({ title: 'x', body: 'ok', status: 'xyz', position: '0' }).success).toBe(false);
    const ok = postSchema.safeParse({ title: 'T', body: 'texto', status: 'published', position: '3', is_highlight: 'on', image_media_id: '' });
    expect(ok.success && ok.data).toMatchObject({ is_highlight: true, position: 3, image_media_id: null });
  });
  it('site: links só https (bloqueia javascript:)', () => {
    const base = { site_title: 'X', tagline: '', seo_description: '' };
    expect(siteSchema.safeParse({ ...base, hero_image_url: 'javascript:alert(1)' }).success).toBe(false);
    expect(siteSchema.safeParse({ ...base, instagram_url: 'http://x.y' }).success).toBe(false);
    expect(siteSchema.safeParse({ ...base, whatsapp_url: 'data:text/html,x' }).success).toBe(false);
    const ok = siteSchema.safeParse({ ...base, hero_image_url: '', instagram_url: 'https://instagram.com/x' });
    expect(ok.success && ok.data.hero_image_url).toBeNull();
  });
  it('evento: fuso e datas', () => {
    const ok = { name: 'Rev', description: '', timezone: 'America/Sao_Paulo', opens_local: '2030-06-15T00:00', ends_local: '2030-06-17T00:00' };
    expect(eventSchema.safeParse(ok).success).toBe(true);
    expect(eventSchema.safeParse({ ...ok, timezone: 'Marte/X' }).success).toBe(false);
    expect(eventSchema.safeParse({ ...ok, opens_local: 'amanhã' }).success).toBe(false);
    expect(eventSchema.safeParse({ ...ok, ends_local: '2030-06-14T00:00' }).success).toBe(false); // fim antes da abertura
    expect(eventSchema.safeParse({ ...ok, maps_url: 'javascript:alert(1)' }).success).toBe(false);
  });
  it('vídeo, mídia, transmissão e segurança', () => {
    expect(videoSchema.safeParse({ url: 'https://youtu.be/x', title: '', description: '', category: 'Louvor' }).success).toBe(false);
    expect(mediaSchema.safeParse({ url: 'https://drive.google.com/x', title: 't', alt: '', caption: '' }).success).toBe(true);
    expect(streamSchema.safeParse({ stream_enabled: 'on', stream_input: '', stream_note: '' }).success).toBe(true);
    expect(securitySchema.safeParse({ reaction_limit_per_minute: '0', reaction_limit_per_ip_minute: '10' }).success).toBe(false);
    expect(securitySchema.safeParse({ reaction_limit_per_minute: '20', reaction_limit_per_ip_minute: '120' }).success).toBe(true);
  });
});
describe('corpo da reação', () => {
  it('aceita apenas os 5 emojis (ou null) e UUIDs', () => {
    for (const e of ['❤️', '🙌', '🔥', '👏', '😍', null]) expect(reactionBodySchema.safeParse({ postId: UUID, anonId: UUID, emoji: e }).success).toBe(true);
    for (const e of ['💩', '', 'x', 1, undefined]) expect(reactionBodySchema.safeParse({ postId: UUID, anonId: UUID, emoji: e }).success).toBe(false);
    expect(reactionBodySchema.safeParse({ postId: 'x', anonId: UUID, emoji: '🔥' }).success).toBe(false);
    expect(reactionBodySchema.safeParse({ postId: UUID, anonId: UUID, emoji: '🔥', extra: 1 }).success).toBe(false);
  });
  it('consulta de minhas reações limita a 50 IDs', () => {
    expect(mineQuerySchema.safeParse({ anonId: UUID, postIds: Array(51).fill(UUID) }).success).toBe(false);
    expect(mineQuerySchema.safeParse({ anonId: UUID, postIds: [UUID] }).success).toBe(true);
    expect(mineQuerySchema.safeParse({ anonId: UUID, postIds: [] }).success).toBe(false);
  });
});
