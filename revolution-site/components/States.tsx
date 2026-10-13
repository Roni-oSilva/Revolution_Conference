import type { ReactNode } from 'react';
export const StateBox = ({ title, children, kind = 'empty' }: { title: string; children?: ReactNode; kind?: 'empty' | 'error' }) => (
  <div className={`state ${kind === 'error' ? 'error' : ''}`} role={kind === 'error' ? 'alert' : 'status'}><strong>{title}</strong>{children}</div>
);
export const ConfigMissing = () => (
  <div className="wrap"><StateBox title="Site ainda não configurado" kind="error"><p>As variáveis do Supabase não foram definidas. Veja <code>docs/CONFIGURACAO.md</code>.</p></StateBox></div>
);
export const Skeletons = ({ n = 3 }: { n?: number }) => (<div className="feed" aria-hidden="true">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" />)}</div>);
