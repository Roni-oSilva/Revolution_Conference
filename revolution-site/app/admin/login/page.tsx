import type { Metadata } from 'next';
import { loginAction } from '../actions';
import { Flash } from '../(panel)/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Entrar', robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  return (
    <div className="adm" style={{ maxWidth: 440 }}>
      <h1>Painel</h1>
      <Flash code={m} />
      <form action={loginAction} className="card" style={{ display: 'grid', gap: 12 }}>
        <div className="field"><label htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" autoFocus inputMode="numeric" required maxLength={200} /></div>
        <button className="btn solid" type="submit">Entrar</button>
      </form>
      <p className="muted" style={{ fontSize: 13 }}>Acesso restrito à equipe.</p>
    </div>
  );
}
