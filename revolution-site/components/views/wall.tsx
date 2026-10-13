import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSettings, getWallPage, getWallPost, WALL_PAGE_SIZE } from '@/lib/data';
import { publicEnv } from '@/lib/env';
import { WallFeed } from '../WallFeed';
import { StateBox } from '../States';

interface ViewOpts { client: SupabaseClient; preview?: boolean; basePath?: string }

function Pager({ page, total, base }: { page: number; total: number; base: string }) {
  const pages = Math.max(1, Math.ceil(total / WALL_PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Paginação">
      {page > 1 ? <Link className="btn small" href={`${base}?page=${page - 1}`} rel="prev">← Anteriores</Link> : <span />}
      <span className="muted" aria-current="page">Página {page} de {pages}</span>
      {page < pages ? <Link className="btn small" href={`${base}?page=${page + 1}`} rel="next">Mais antigas →</Link> : <span />}
    </nav>
  );
}

export async function WallView({ client, preview = false, page = 1, basePath = '/mural' }: ViewOpts & { page?: number }) {
  const s = await getSettings(client);
  if (!s.ok) return <div className="wrap"><StateBox title="Não foi possível carregar o mural" kind="error"><p>Tente novamente em instantes.</p></StateBox></div>;
  const { site, event } = s.data;
  const w = await getWallPage(client, page, preview);
  const env = publicEnv();
  return (
    <div className="wrap">
      <span className="kicker">Publicações oficiais</span>
      <h1 className="page-title">O <span className="red">mural</span></h1>
      {!w.ok ? <StateBox title="Não foi possível carregar o mural" kind="error"><p>Tente novamente em instantes.</p></StateBox>
        : w.data.posts.length === 0 ? <StateBox title={page > 1 ? 'Não há publicações nesta página' : 'O mural ainda está vazio'}>{page > 1 ? <p><Link className="link-btn" href={basePath}>Voltar ao início do mural</Link></p> : <p>As publicações oficiais aparecerão aqui.</p>}</StateBox>
        : (<>
          <WallFeed posts={w.data.posts} supabaseUrl={env.supabaseUrl} anonKey={env.supabaseAnonKey} reactionsEnabled={site.reactions_enabled} timezone={event.timezone} readOnly={preview} />
          <Pager page={page} total={w.data.total} base={basePath} />
        </>)}
    </div>
  );
}

export async function PostView({ client, id, preview = false, basePath = '/mural' }: ViewOpts & { id: string }) {
  const s = await getSettings(client);
  if (!s.ok) return <div className="wrap"><StateBox title="Não foi possível carregar" kind="error" /></div>;
  const { site, event } = s.data;
  const r = await getWallPost(client, id, preview);
  const env = publicEnv();
  return (
    <div className="wrap">
      <p><Link className="link-btn" href={basePath}>← Voltar ao mural</Link></p>
      {!r.ok ? <StateBox title="Não foi possível carregar a publicação" kind="error" />
        : !r.data ? <StateBox title="Publicação não encontrada"><p>Ela pode ter sido removida ou ainda não foi publicada.</p></StateBox>
        : <WallFeed posts={[r.data]} supabaseUrl={env.supabaseUrl} anonKey={env.supabaseAnonKey} reactionsEnabled={site.reactions_enabled} timezone={event.timezone} readOnly={preview} single />}
    </div>
  );
}

