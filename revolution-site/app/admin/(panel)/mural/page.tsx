import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { formatShort } from '@/lib/format';
import { deletePostAction, movePostAction, savePostAction, setPostStatusAction } from '../../actions';
import { Check, Confirm, Field, Flash } from '../ui';
import type { MediaRow, WallPostRow } from '@/lib/types';

const STATUS = { draft: 'Rascunho', published: 'Publicada', hidden: 'Oculta' } as const;

function PostForm({ post, media }: { post?: WallPostRow; media: Pick<MediaRow, 'id' | 'title' | 'drive_file_id'>[] }) {
  return (
    <form action={savePostAction} className="f">
      {post && <input type="hidden" name="id" value={post.id} />}
      <Field label="Título (opcional)" name="title" defaultValue={post?.title} max={120} />
      <div className="field"><label>Situação</label>
        <select name="status" defaultValue={post?.status ?? 'draft'}><option value="draft">Rascunho</option><option value="published">Publicada</option><option value="hidden">Oculta</option></select></div>
      <Field label="Texto" name="body" rows={5} defaultValue={post?.body} required max={2000} wide help="Texto simples (sem HTML). Máx. 2000 caracteres." />
      <div className="field"><label>Foto (opcional)</label>
        <select name="image_media_id" defaultValue={post?.image_media_id ?? ''}><option value="">Sem foto</option>{media.map((m) => <option key={m.id} value={m.id}>{m.title || m.drive_file_id}</option>)}</select></div>
      <Field label="Posição" name="position" type="number" defaultValue={post?.position ?? 0} help="Menor aparece primeiro." />
      <Check label="Destaque na home" name="is_highlight" checked={post?.is_highlight} />
      <div className="field wide"><button className="btn solid small" type="submit">{post ? 'Salvar alterações' : 'Criar publicação'}</button></div>
    </form>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { client } = await requireAdmin();
  const { m } = await searchParams;
  const [posts, media, counts] = await Promise.all([
    client.from('wall_posts').select('*').order('position').order('created_at', { ascending: false }),
    client.from('media').select('id, title, drive_file_id').order('position'),
    client.from('post_reaction_counts').select('post_id, count'),
  ]);
  const total: Record<string, number> = {};
  for (const r of (counts.data ?? []) as { post_id: string; count: number }[]) total[r.post_id] = (total[r.post_id] ?? 0) + r.count;
  const list = (posts.data ?? []) as WallPostRow[];
  return (
    <>
      <Flash code={m} />
      <h2>Mural</h2>
      <details className="card" open={list.length === 0}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>+ Nova publicação</summary><div style={{ marginTop: 14 }}><PostForm media={media.data ?? []} /></div></details>
      {posts.error && <div className="msg err" role="alert">Não foi possível carregar as publicações.</div>}
      {list.length === 0 && !posts.error && <div className="state"><strong>Nenhuma publicação</strong>Crie a primeira acima.</div>}
      {list.map((p, i) => (
        <article key={p.id} className="card" data-admin-post={p.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div><span className="badge">{STATUS[p.status]}</span> {p.is_highlight && <span className="badge">Destaque</span>} <span className="muted" style={{ fontSize: 13 }}>#{i + 1} · {formatShort(p.created_at)} · {total[p.id] ?? 0} reações</span></div>
            <div className="row">
              <form action={movePostAction}><input type="hidden" name="id" value={p.id} /><button name="dir" value="up" className="btn small" type="submit" aria-label="Subir" disabled={i === 0}>↑</button> <button name="dir" value="down" className="btn small" type="submit" aria-label="Descer" disabled={i === list.length - 1}>↓</button></form>
              <Link className="btn small" href={`/admin/preview/mural/${p.id}`}>Pré-visualizar</Link>
            </div>
          </div>
          <h3 style={{ marginTop: 10 }}>{p.title || '(sem título)'}</h3>
          <p style={{ whiteSpace: 'pre-wrap', margin: '0 0 12px' }}>{p.body.length > 240 ? p.body.slice(0, 240) + '…' : p.body}</p>
          <div className="row">
            {p.status !== 'published' && <form action={setPostStatusAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="published" />{p.status === 'hidden' && <input type="hidden" name="restore" value="1" />}<button className="btn small solid" type="submit">{p.status === 'hidden' ? 'Restaurar' : 'Publicar'}</button></form>}
            {p.status === 'published' && <form action={setPostStatusAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="hidden" /><button className="btn small" type="submit">Ocultar</button></form>}
            <details><summary className="btn small" style={{ listStyle: 'none' }}>Editar</summary><div style={{ marginTop: 10 }}><PostForm post={p} media={media.data ?? []} /></div></details>
            <Confirm action={deletePostAction} id={p.id} />
          </div>
        </article>
      ))}
    </>
  );
}
