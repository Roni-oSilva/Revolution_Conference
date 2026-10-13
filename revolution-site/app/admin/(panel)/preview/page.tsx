import Link from 'next/link';
export default function Page() {
  return (
    <>
      <h2>Pré-visualizar antes de publicar</h2>
      <p className="muted">As telas abaixo mostram o site <strong>como ele ficará</strong>, incluindo rascunhos, publicações ocultas e fotos/vídeos ainda não publicados. Só você (admin autenticado) as vê; o site público não muda.</p>
      <div className="card"><h3>Início</h3><div className="btn-row" style={{ marginTop: 0 }}>
        <Link className="btn small" href="/admin/preview/inicio?fase=pre">Fase pré-evento</Link><Link className="btn small" href="/admin/preview/inicio?fase=open">Fase pós-abertura</Link><Link className="btn small" href="/admin/preview/inicio?fase=ended">Fase encerrada</Link></div></div>
      <div className="card"><h3>Ao vivo</h3><Link className="btn small" href="/admin/preview/ao-vivo">Abrir</Link></div>
      <div className="card"><h3>Mural</h3><Link className="btn small" href="/admin/preview/mural">Abrir (com rascunhos)</Link></div>
    </>
  );
}
