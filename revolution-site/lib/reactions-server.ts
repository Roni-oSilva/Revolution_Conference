import 'server-only';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { reactionBodySchema, mineQuerySchema } from './reactions';
import { logger } from './logger';

export interface ServiceLike {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: any; error: { message: string } | null }>;
}
export interface Deps { service: ServiceLike | null; salt: string }

const MAX_BODY = 2048;

/** Aceita apenas requisições do próprio site (cabeçalho Origin igual ao Host ou ao NEXT_PUBLIC_SITE_URL). */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    if (host && o.host === host) return true;
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    return Boolean(site && new URL(site).host === o.host);
  } catch { return false; }
}

export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  return (xf ? xf.split(',')[0] : req.headers.get('x-real-ip') ?? '').trim() || 'unknown';
}
/** Hash salgado e truncado: o IP em claro nunca é armazenado nem registrado em log. */
export const hashIp = (ip: string, salt: string): string => createHash('sha256').update(`${salt}|${ip}`).digest('hex').slice(0, 32);

const json = (body: unknown, status = 200, headers?: Record<string, string>) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export async function handleReactionPost(req: Request, deps: Deps): Promise<Response> {
  if (!isSameOrigin(req)) return json({ error: 'forbidden' }, 403);
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return json({ error: 'too_large' }, 413);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: 'too_large' }, 413);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return json({ error: 'invalid_json' }, 400); }
  const body = reactionBodySchema.safeParse(parsed);
  if (!body.success) return json({ error: 'invalid_body' }, 400);
  if (!deps.service) { logger.error('reactions.service_unavailable'); return json({ error: 'unavailable' }, 503); }

  const { data, error } = await deps.service.rpc('react_to_post', {
    p_post_id: body.data.postId, p_anon_id: body.data.anonId, p_emoji: body.data.emoji, p_ip_hash: hashIp(clientIp(req), deps.salt),
  });
  if (error) { logger.error('reactions.rpc_failed', { message: error.message }); return json({ error: 'upstream' }, 502); }
  if (data?.error === 'rate_limited') return json({ error: 'rate_limited' }, 429, { 'Retry-After': '30' });
  if (data?.error === 'not_found') return json({ error: 'not_found' }, 404);
  if (data?.error === 'disabled') return json({ error: 'disabled' }, 403);
  if (data?.error === 'invalid_emoji') return json({ error: 'invalid_body' }, 400);
  if (data?.error) return json({ error: 'upstream' }, 502);
  logger.info('reactions.ok', { action: data?.action });
  return json({ ok: true, action: data?.action, emoji: body.data.emoji });
}

export async function handleMineGet(req: Request, deps: Deps): Promise<Response> {
  if (!isSameOrigin(req) && req.headers.get('sec-fetch-site') !== 'same-origin') return json({ error: 'forbidden' }, 403);
  const url = new URL(req.url);
  const ids = (url.searchParams.get('postIds') ?? '').split(',').filter(Boolean);
  const q = mineQuerySchema.safeParse({ anonId: req.headers.get('x-anon-id') ?? '', postIds: ids });
  if (!q.success) return json({ error: 'invalid_query' }, 400);
  if (!deps.service) return json({ error: 'unavailable' }, 503);
  const { data, error } = await deps.service.rpc('my_reactions', { p_anon_id: q.data.anonId, p_post_ids: q.data.postIds });
  if (error) { logger.error('reactions.mine_failed', { message: error.message }); return json({ error: 'upstream' }, 502); }
  const map: Record<string, string> = {};
  for (const r of (data ?? []) as { post_id: string; emoji: string }[]) map[r.post_id] = r.emoji;
  return json({ reactions: map });
}
