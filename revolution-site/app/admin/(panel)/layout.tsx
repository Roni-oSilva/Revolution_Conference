import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { logoutAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Painel', robots: { index: false, follow: false } };

const NAV = [['/admin', 'Dashboard'], ['/admin/evento', 'Evento e home'], ['/admin/mural', 'Mural'], ['/admin/programacao', 'Programação'], ['/admin/midia', 'Mídia'], ['/admin/seguranca', 'Segurança'], ['/admin/preview', 'Pré-visualizar']] as const;

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireAdmin();
  return (
    <div className="adm">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Painel</h1>
        <form action={logoutAction} className="row"><span className="muted" style={{ fontSize: 13 }}>{user.email}</span><button className="btn small" type="submit">Sair</button></form>
      </div>
      <nav className="adm-nav" aria-label="Painel">{NAV.map(([h, l]) => <Link key={h} href={h}>{l}</Link>)}</nav>
      {children}
    </div>
  );
}
