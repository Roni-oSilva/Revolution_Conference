import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import Link from 'next/link';
import './globals.css';
import { CARVEX_URL, INSTAGRAM_URL } from '@/lib/links';
import { Motion } from '@/components/Motion';
import { Logo } from '@/components/Logo';
import { NavTabs } from '@/components/NavTabs';
import { createPublicClient } from '@/lib/supabase/public';
import { getSettings } from '@/lib/data';
import { publicEnv } from '@/lib/env';
import { isSafeHttpsUrl } from '@/lib/urls';
import type { SiteSettings } from '@/lib/types';

const title = localFont({ src: '../public/fonts/jakarta-800.woff2', variable: '--font-title', display: 'swap', weight: '400' });
const body = localFont({
  src: [{ path: '../public/fonts/jakarta-300.woff2', weight: '300' }, { path: '../public/fonts/jakarta-400.woff2', weight: '400' }, { path: '../public/fonts/jakarta-600.woff2', weight: '600' }],
  variable: '--font-body', display: 'swap',
});

const INSTAGRAM = INSTAGRAM_URL;
const CARVEX = CARVEX_URL;

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
  const og = site?.hero_image_url && isSafeHttpsUrl(site.hero_image_url) ? [site.hero_image_url] : undefined;
  return {
    metadataBase: new URL(publicEnv().siteUrl),
    title: { default: title, template: `%s · ${title}` },
    description,
    openGraph: { type: 'website', siteName: title, title, description, locale: 'pt_BR', images: og },
    twitter: { card: 'summary_large_image', title, description, images: og },
  };
}
export const viewport: Viewport = { themeColor: '#0a0a0a', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await loadSite();
  const social = [
    ['Instagram', site?.instagram_url || INSTAGRAM], ['YouTube', site?.youtube_channel_url], ['WhatsApp', site?.whatsapp_url],
  ].filter((x): x is [string, string] => !!x[1] && isSafeHttpsUrl(x[1]));
  return (
    <html lang="pt-BR" className={`${title.variable} ${body.variable}`}>
      <body>
        <Motion />
        <a className="skip" href="#conteudo">Pular para o conteúdo</a>
        <header className="top">
          <Link href="/" className="brand" aria-label={`${site?.site_title || 'Revolution Conference'} — início`}>
            <Logo />
          </Link>
          <NavTabs />
        </header>
        <main id="conteudo" tabIndex={-1}>{children}</main>
        <footer className="foot">
          <div className="foot-logo"><Logo size="xl" /></div>
          <div className="foot-follow">
            <a className="btn solid" href={site?.instagram_url || INSTAGRAM} target="_blank" rel="noopener noreferrer">Siga @revolucaojovemiep no Instagram <span aria-hidden="true">↗</span></a>
          </div>
          <div className="foot-in">
            <span>© {new Date().getFullYear()} {site?.site_title || 'Revolution Conference'}</span>
            <span style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {social.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)}
              <Link href="/privacidade">Política de privacidade</Link>
            </span>
          </div>
          <p className="foot-credit">Desenvolvido por <a href={CARVEX} target="_blank" rel="noopener noreferrer">@carvex_lab</a> • Obrigado por dar vida a essa visão.</p>
        </footer>
      </body>
    </html>
  );
}
