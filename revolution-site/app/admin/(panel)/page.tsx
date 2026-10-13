import { requireAdmin } from '@/lib/admin/auth';
import { getSettings } from '@/lib/data';
import { hasServiceRole, publicEnv, serverEnv } from '@/lib/env';
import { REACTION_EMOJIS } from '@/lib/reactions';
import { computePhase, parseIsoMs } from '@/lib/phase';
import { formatEventDate } from '@/lib/format';

export default async function Page() {
  const { client } = await requireAdmin();
  const count = async (table: string, f?: (q: any) => any) => { let q = client.from(table).select('*', { count: 'exact', head: true }); if (f) q = f(q); const { count: n, error } = await q; return error ? null : n; };
  const [pub, draft, hid, media, mediaBad, vids, vidsBad, parts, counts, s] = await Promise.all([
    count('wall_posts', (q) => q.eq('status', 'published')), count('wall_posts', (q) => q.eq('status', 'draft')), count('wall_posts', (q) => q.eq('status', 'hidden')),
    count('media'), count('media', (q) => q.eq('availability', 'unavailable')), count('videos'), count('videos', (q) => q.eq('availability', 'unavailable')),
    count('post_reactions'), client.from('post_reaction_counts').select('emoji, count'), getSettings(client),
  ]);
  const per: Record<string, number> = {};
  for (const r of (counts.data ?? []) as { emoji: string; count: number }[]) per[r.emoji] = (per[r.emoji] ?? 0) + r.count;
  const ev = s.data?.event;
  const phase = ev ? computePhase(Date.now(), parseIsoMs(ev.opens_at ?? ev.starts_at), parseIsoMs(ev.ends_at)) : null;
  const n = (v: number | null) => (v == null ? '—' : String(v));
  const stat = (v: number | null, l: string) => <div className="card stat"><b>{n(v)}</b><span>{l}</span></div>;
  const status = (ok: boolean, label: string, help: string) => <tr><td>{ok ? '✅' : '⚠️'} {label}</td><td className="muted">{help}</td></tr>;
  const site = publicEnv().siteUrl;
  return (
    <>
      <h2>Dashboard</h2>
      <div className="stats">
        {stat(pub, 'Publicações no ar')}{stat(draft, 'Rascunhos')}{stat(hid, 'Ocultas')}{stat(parts, 'Reações (linhas)')}{stat(media, 'Fotos')}{stat(vids, 'Vídeos')}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Reações por emoji</h3>
        <p style={{ margin: 0 }}>{REACTION_EMOJIS.map((e) => `${e} ${per[e] ?? 0}`).join('   ')}</p>
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Contagem por ID anônimo de navegador — não por pessoa.</p>
      </div>
      <div className="card"><h3>Evento</h3>
        <p style={{ margin: 0 }}>Fase atual: <code>{phase ?? '—'}</code> · Abertura: {ev ? (formatEventDate(ev.opens_at ?? ev.starts_at, ev.timezone) || 'não definida') : '—'}</p>
        <p className="muted" style={{ margin: '6px 0 0' }}>Transmissão: {ev?.stream_enabled ? (ev.stream_video_id ? 'ligada' : 'ligada, mas sem vídeo válido') : 'desligada'}</p>
      </div>
      <div className="card scroll"><h3>Status das integrações</h3>
        <table className="t"><tbody>
          {status(true, 'Supabase (banco e Auth)', `${publicEnv().supabaseUrl ? 'URL definida' : '—'}; sessão de admin válida`)}
          {status(hasServiceRole(), 'Chave service_role (servidor)', hasServiceRole() ? 'Definida — usada só nas rotas /api/reactions e no convite de admins.' : 'NÃO definida: reações e convite de admins não funcionam.')}
          {status(serverEnv().rateLimitSalt.length >= 16, 'RATE_LIMIT_SALT', serverEnv().rateLimitSalt.length >= 16 ? 'Definido.' : 'Defina um sal longo para o hash do IP.')}
          {status(!site.includes('localhost'), 'NEXT_PUBLIC_SITE_URL', site)}
          {status((mediaBad ?? 0) === 0, 'Google Drive', mediaBad ? `${mediaBad} foto(s) marcadas como indisponíveis (não públicas).` : 'Nenhuma foto indisponível na última verificação.')}
          {status((vidsBad ?? 0) === 0, 'YouTube (vídeos)', vidsBad ? `${vidsBad} vídeo(s) indisponíveis (privados/removidos).` : 'Nenhum vídeo indisponível na última verificação.')}
          {status(true, 'Realtime', 'Ativado pela migração 0004 (post_reaction_counts e wall_posts). Se as contagens não atualizarem sozinhas, confira Database → Replication.')}
        </tbody></table>
      </div>
    </>
  );
}
