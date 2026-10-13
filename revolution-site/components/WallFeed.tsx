'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { REACTION_EMOJIS, REACTION_LABELS, type ReactionEmoji } from '@/lib/reactions';
import type { WallPost } from '@/lib/types';
import { getAnonId } from '@/lib/anon-id';
import { getBrowserClient } from '@/lib/supabase/browser';
import { formatShort } from '@/lib/format';
import { DriveImage } from './DriveImage';
import { ShareButton } from './ShareButton';

type Counts = Record<string, Partial<Record<ReactionEmoji, number>>>;
type Mine = Record<string, ReactionEmoji | null>;

const ERR: Record<string, string> = {
  rate_limited: 'Muitas reações em pouco tempo. Aguarde um instante e tente de novo.',
  disabled: 'As reações estão temporariamente desativadas.',
  not_found: 'Esta publicação não está mais disponível.',
  unavailable: 'Reações indisponíveis no momento.',
  network: 'Sem conexão. Sua reação não foi enviada.',
};

interface Props {
  posts: WallPost[]; supabaseUrl: string; anonKey: string; reactionsEnabled: boolean; timezone: string;
  readOnly?: boolean; single?: boolean;
}

export function WallFeed({ posts, supabaseUrl, anonKey, reactionsEnabled, timezone, readOnly = false, single = false }: Props) {
  const router = useRouter();
  const [counts, setCounts] = useState<Counts>(() => Object.fromEntries(posts.map((p) => [p.id, p.counts])));
  const [mine, setMine] = useState<Mine>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');
  const [hasNew, setHasNew] = useState(false);
  const ids = useRef<string[]>([]);
  ids.current = posts.map((p) => p.id);

  // contagens do servidor mudam quando a página é recarregada (router.refresh)
  useEffect(() => { setCounts(Object.fromEntries(posts.map((p) => [p.id, p.counts]))); }, [posts]);

  const say = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast(''), 3500); }, []);

  // minhas reações (fonte da verdade: servidor; ID anônimo vem do navegador)
  useEffect(() => {
    if (readOnly || !reactionsEnabled || posts.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/reactions/mine?postIds=${ids.current.join(',')}`, { headers: { 'x-anon-id': getAnonId() }, cache: 'no-store' });
        if (!res.ok) return;
        const { reactions } = (await res.json()) as { reactions: Record<string, ReactionEmoji> };
        if (!cancelled) setMine(reactions);
      } catch { /* sem rede: segue sem destacar a própria reação */ }
    })();
    return () => { cancelled = true; };
  }, [posts, readOnly, reactionsEnabled]);

  // Realtime: contagens + aviso de novas publicações. Se cair, cai para atualização periódica.
  useEffect(() => {
    if (readOnly || !supabaseUrl || !anonKey) return;
    const client = getBrowserClient(supabaseUrl, anonKey);
    let live = false;
    const channel = client.channel('mural')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reaction_counts' }, (payload: any) => {
        const row = payload.new && Object.keys(payload.new).length ? payload.new : null;
        if (!row || !ids.current.includes(row.post_id)) return;
        setCounts((c) => ({ ...c, [row.post_id]: { ...c[row.post_id], [row.emoji]: row.count } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wall_posts' }, (payload: any) => {
        if (payload.new?.status === 'published' && !ids.current.includes(payload.new.id)) setHasNew(true);
      })
      .subscribe((status: string) => { live = status === 'SUBSCRIBED'; });
    const poll = window.setInterval(async () => {
      if (live || document.visibilityState === 'hidden' || ids.current.length === 0) return;
      const { data } = await client.from('post_reaction_counts').select('post_id, emoji, count').in('post_id', ids.current);
      if (!data) return;
      setCounts((prev) => { const next: Counts = { ...prev }; for (const r of data) next[r.post_id] = { ...next[r.post_id], [r.emoji as ReactionEmoji]: r.count }; return next; });
    }, 20000);
    return () => { clearInterval(poll); void client.removeChannel(channel); };
  }, [supabaseUrl, anonKey, readOnly]);

  async function react(postId: string, emoji: ReactionEmoji) {
    if (readOnly || pending[postId]) return;
    const prev = mine[postId] ?? null;
    const next: ReactionEmoji | null = prev === emoji ? null : emoji;
    const bump = (c: Counts): Counts => {
      const cur = { ...(c[postId] ?? {}) };
      if (prev) cur[prev] = Math.max(0, (cur[prev] ?? 0) - 1);
      if (next) cur[next] = (cur[next] ?? 0) + 1;
      return { ...c, [postId]: cur };
    };
    const snapshotCounts = counts;
    setCounts(bump); setMine((m) => ({ ...m, [postId]: next })); setPending((p) => ({ ...p, [postId]: true }));
    try {
      const res = await fetch('/api/reactions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ postId, anonId: getAnonId(), emoji: next }) });
      if (!res.ok) {
        const code = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'unavailable';
        setCounts(snapshotCounts); setMine((m) => ({ ...m, [postId]: prev }));
        say(ERR[code] ?? ERR.unavailable);
      }
    } catch {
      setCounts(snapshotCounts); setMine((m) => ({ ...m, [postId]: prev }));
      say(ERR.network);
    } finally { setPending((p) => ({ ...p, [postId]: false })); }
  }

  return (
    <>
      {hasNew && <div className="newbar"><button type="button" className="btn solid small" onClick={() => { setHasNew(false); router.refresh(); }}>Há novas publicações — atualizar</button></div>}
      <div className="feed" aria-live="off">
        {posts.map((p) => (
          <article key={p.id} className={`post${p.is_highlight ? ' hl' : ''}`} data-post-id={p.id} aria-labelledby={`t-${p.id}`}>
            {p.media && p.media.availability !== 'unavailable' && <div className="post-img"><DriveImage fileId={p.media.drive_file_id} alt={p.media.alt || p.title} sizes="(max-width: 900px) 100vw, 1000px" /></div>}
            <div className="post-in">
              <div className="meta">
                {p.is_highlight && <span className="badge">Destaque</span>}
                {p.status !== 'published' && <span className="badge warn">{p.status === 'draft' ? 'Rascunho' : 'Oculta'}</span>}
                <time dateTime={p.published_at ?? p.created_at}>{formatShort(p.published_at ?? p.created_at, timezone)}</time>
              </div>
              {p.title ? <h2 id={`t-${p.id}`}>{single ? p.title : <a href={`/mural/${p.id}`} style={{ textDecoration: 'none' }}>{p.title}</a>}</h2> : <span id={`t-${p.id}`} className="sr-only">Publicação do mural</span>}
              <p className="body">{p.body}</p>
              {reactionsEnabled ? (
                <div className="reacts" role="group" aria-label="Reações">
                  {REACTION_EMOJIS.map((e) => {
                    const n = counts[p.id]?.[e] ?? 0;
                    const on = mine[p.id] === e;
                    return (
                      <button key={e} type="button" className="react" aria-pressed={on} disabled={readOnly} aria-busy={!!pending[p.id] || undefined} data-emoji={e}
                        aria-label={`${REACTION_LABELS[e]} (${n})${on ? ', sua reação' : ''}`} onClick={() => react(p.id, e)}>
                        <span className="e" aria-hidden="true">{e}</span><span data-count>{n}</span>
                      </button>
                    );
                  })}
                </div>
              ) : <p className="muted" style={{ fontSize: 13 }}>Reações desativadas.</p>}
              <div className="post-actions">
                <ShareButton path={`/mural/${p.id}`} title={p.title || 'Mural da Revolution Conference'} text={p.title || p.body.slice(0, 100)} />
                {!single && <a className="link-btn" href={`/mural/${p.id}`}>Abrir publicação</a>}
              </div>
            </div>
          </article>
        ))}
      </div>
      {toast && <div className="toast" role="alert">{toast}</div>}
    </>
  );
}
