import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import Link from 'next/link';
import './globals.css';
import { NavTabs } from '@/components/NavTabs';
import { createPublicClient } from '@/lib/supabase/public';
import { getSettings } from '@/lib/data';
import { publicEnv } from '@/lib/env';
import { isSafeHttpsUrl } from '@/lib/urls';
import type { SiteSettings } from '@/lib/types';

const anton = localFont({ src: '../public/fonts/anton.ttf', variable: '--font-anton', display: 'swap' });
const archivo = localFont({
  src: [{ path: '../public/fonts/archivo-400.ttf', weight: '400' }, { path: '../public/fonts/archivo-700.ttf', weight: '700' }],
  variable: '--font-archivo', display: 'swap',
});

export const dynamic = 'force-dynamic';

async function loadSite(): Promise<Pick<SiteSettings, 'site_title' | 'tagline' | 'seo_description' | 'hero_image_url' | 'instagram_url' | 'youtube_channel_url' | 'whatsapp_url'> | null> {
  const c = createPublicClient();
  if (!c) return null;
  try { const r = await getSettings(c); return r.data?.site ?? null; } catch { return null; }
}

export async function generateMetadata(): Promise<Metadata> {
  const site = await loadSite();
  const title = site?.site_title || 'Revolution Conference';
  const description = site?.seo_description || site?.tagline || 'Site oficial da Revolution Conference: informações, transmissão ao vivo e mural.';
  const og = site?.hero_image_url && isSafeHttpsUrl(site.hero_image_url) ? [site.hero_image_url] : ['/logo.jpg'];
  return {
    metadataBase: new URL(publicEnv().siteUrl),
    title: { default: title, template: `%s · ${title}` },
    description,
    openGraph: { type: 'website', siteName: title, title, description, locale: 'pt_BR', images: og },
    twitter: { card: 'summary_large_image', title, description, images: og },
    icons: { icon: '/logo.jpg' },
  };
}
export const viewport: Viewport = { themeColor: '#0a0a0a', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await loadSite();
  const social = [
    ['Instagram', site?.instagram_url], ['YouTube', site?.youtube_channel_url], ['WhatsApp', site?.whatsapp_url],
  ].filter((x): x is [string, string] => !!x[1] && isSafeHttpsUrl(x[1]));
  return (
    <html lang="pt-BR" className={`${anton.variable} ${archivo.variable}`}>
      <body>
        <a className="skip" href="#conteudo">Pular para o conteúdo</a>
        <header className="top">
          <div className="top-in">
            <Link href="/" className="brand" aria-label={`${site?.site_title || 'Revolution Conference'} — início`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpg" alt="" width={34} height={34} />
              <span>{site?.site_title || 'Revolution'}</span>
            </Link>
            <NavTabs />
          </div>
        </header>
        <main id="conteudo" tabIndex={-1}>{children}</main>
        <footer className="foot">
          <div className="foot-in">
            <span>© {new Date().getFullYear()} {site?.site_title || 'Revolution Conference'}</span>
            <span style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {social.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)}
              <Link href="/privacidade">Política de privacidade</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
