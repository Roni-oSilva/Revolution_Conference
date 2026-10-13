'use client';
import { useEffect } from 'react';
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('ui.error', error.digest ?? ''); }, [error]);
  return (
    <div className="wrap"><div className="state error" role="alert"><strong>Algo deu errado</strong><p>Não conseguimos carregar esta página agora.</p>
      <button type="button" className="btn solid small" onClick={reset}>Tentar de novo</button></div></div>
  );
}
