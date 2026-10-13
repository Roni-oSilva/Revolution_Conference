import Link from 'next/link';
export default function NotFound() {
  return <div className="wrap"><div className="state"><strong>Página não encontrada</strong><p><Link className="link-btn" href="/">Voltar ao início</Link></p></div></div>;
}
