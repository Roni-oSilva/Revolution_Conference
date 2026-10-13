import { z } from 'zod';
import { isSafeHttpsUrl } from '../urls';
import { isValidTimeZone, zonedLocalToUtcMs } from '../tz';

const emptyToNull = (v: unknown) => (v === undefined || (typeof v === 'string' && v.trim() === '') ? null : v);
const optHttps = z.preprocess(emptyToNull, z.string().trim().max(2048).refine(isSafeHttpsUrl, 'link https inválido').nullable());
const optText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable());
const text = (max: number) => z.string().trim().max(max);
const bool = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());
const int = (min: number, max: number) => z.preprocess((v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v === '' ? 0 : v), z.number().int().min(min).max(max));
const uuidOrNull = z.preprocess(emptyToNull, z.string().uuid().nullable());

export const postSchema = z.object({
  title: text(120), body: z.string().trim().min(1, 'texto obrigatório').max(2000),
  status: z.enum(['draft', 'published', 'hidden']), is_highlight: bool, image_media_id: uuidOrNull, position: int(-9999, 9999),
});

export const mediaSchema = z.object({ url: z.string().trim().max(2048), title: text(120), alt: text(200), caption: text(300), album: text(60) });
export const mediaEditSchema = z.object({ title: text(120), alt: text(200), caption: text(300), album: text(60), position: int(-9999, 9999), is_featured: bool, is_published: bool });

export const videoSchema = z.object({ url: z.string().trim().max(2048), title: z.string().trim().min(1).max(160), description: text(1000), category: z.string().trim().min(1).max(60) });
export const videoEditSchema = z.object({ title: z.string().trim().min(1).max(160), description: text(1000), category: z.string().trim().min(1).max(60), position: int(-9999, 9999), is_published: bool });

export const siteSchema = z.object({
  site_title: z.string().trim().min(1).max(120), tagline: text(200), seo_description: text(300),
  hero_image_url: optHttps, instagram_url: optHttps, youtube_channel_url: optHttps, whatsapp_url: optHttps, privacy_text: optText(20000),
});

export const eventSchema = z.object({
  name: z.string().trim().min(1).max(120), description: text(2000),
  timezone: z.string().trim().refine(isValidTimeZone, 'fuso inválido'),
  starts_local: optText(32), opens_local: optText(32), ends_local: optText(32),
  location_name: optText(160), address: optText(300), maps_url: optHttps,
}).superRefine((v, ctx) => {
  for (const k of ['starts_local', 'opens_local', 'ends_local'] as const) {
    const s = v[k];
    if (s && !Number.isFinite(zonedLocalToUtcMs(s, v.timezone))) ctx.addIssue({ code: 'custom', path: [k], message: 'data inválida' });
  }
  const o = v.opens_local ? zonedLocalToUtcMs(v.opens_local, v.timezone) : NaN;
  const e = v.ends_local ? zonedLocalToUtcMs(v.ends_local, v.timezone) : NaN;
  if (Number.isFinite(o) && Number.isFinite(e) && e <= o) ctx.addIssue({ code: 'custom', path: ['ends_local'], message: 'o fim deve ser depois da abertura' });
});

export const streamSchema = z.object({ stream_enabled: bool, stream_input: optText(2048), stream_note: text(500) });
export const securitySchema = z.object({ reactions_enabled: bool, reaction_limit_per_minute: int(1, 300), reaction_limit_per_ip_minute: int(1, 3000) });
export const inviteSchema = z.object({ email: z.string().trim().email().max(254), role: z.enum(['owner', 'editor']) });

export const formToObject = (fd: FormData): Record<string, FormDataEntryValue> => {
  const o: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of fd.entries()) if (!k.startsWith('$ACTION')) o[k] = v;
  return o;
};
