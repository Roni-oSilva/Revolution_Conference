'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [{ href: '/', label: 'Início' }, { href: '/ao-vivo', label: 'Ao Vivo' }, { href: '/mural', label: 'Mural' }];
export function NavTabs() {
  const path = usePathname() ?? '/';
  return (
    <nav className="tabs" aria-label="Principal">
      {TABS.map((t) => {
        const active = t.href === '/' ? path === '/' : path === t.href || path.startsWith(t.href + '/');
        return <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}>{t.label}</Link>;
      })}
    </nav>
  );
}
