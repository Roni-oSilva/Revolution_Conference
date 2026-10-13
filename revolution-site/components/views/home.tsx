import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getGallery, getHighlights, getSettings, getVideos } from '@/lib/data';
import { Folder, type FolderItem } from '../Folders';
import { slugify } from '@/lib/slug';
import { parseIsoMs, type Phase } from '@/lib/phase';
import { formatEventDate, formatShort } from '@/lib/format';
import { isSafeHttpsUrl, youtubeEmbedUrl, youtubeWatchUrl } from '@/lib/urls';
import { PhaseGate } from '../PhaseGate';
import { Gallery } from '../Gallery';
import { StateBox } from '../States';
import type { EventSettings } from '@/lib/types';

interface ViewOpts { client: SupabaseClient; preview?: boolean; forcePhase?: Phase; album?: string }
const streamReady = (e: EventSettings) => e.stream_enabled && !!e.stream_video_id;

function EventInfo({ event }: { event: EventSettings }) {
  const when = formatEventDate(event.starts_at, event.timezone);
  const hasPlace = event.location_name || event.address;
  if (!when && !hasPlace && !event.description) return <StateBox title="Informações em breve">As informações do evento serão divulgadas aqui.</StateBox>;
  return (
    <div className="info">
      {when && <div className="card"><span className="kicker">Quando</span><h2 style={{ marginTop: 10 }}>{when}</h2><p className="muted" style={{ margin: 0 }}>Horário de Brasília ({event.timezone})</p></div>}
      {hasPlace && (
        <div className="card"><span className="kicker">Onde</span><h2 style={{ marginTop: 10 }}>{event.location_name || 'Local'}</h2>
          {event.address && <p className="muted" style={{ margin: 0 }}>{event.address}</p>}
          {event.maps_url && isSafeHttpsUrl(event.maps_url) && <p style={{ margin: '10px 0 0' }}><a className="link-btn" href={event.maps_url} target="_blank" rel="noopener noreferrer">Ver no mapa ↗</a></p>}
        </div>
      )}
      {event.description && <div className="card"><span className="kicker">Sobre</span><p style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>{event.description}</p></div>}
    </div>
  );
}

export async function HomeView({ client, preview = false, forcePhase, album = '' }: ViewOpts) {
  const s = await getSettings(client);
  if (!s.ok) return <div className="wrap"><StateBox title="Não foi possível carregar o site" kind="error"><p>Tente novamente em instantes.</p></StateBox></div>;
  const { site, event } = s.data;
  const [g, h, vids] = await Promise.all([getGallery(client, preview, 60), getHighlights(client, preview), getVideos(client, preview)]);
  const serverNow = Date.now();
  const opensAt = parseIsoMs(event.opens_at ?? event.starts_at);
  const endsAt = parseIsoMs(event.ends_at);
  const live = streamReady(event);
  const liveHref = preview ? '/admin/preview/ao-vivo' : '/ao-vivo';
  const wallHref = preview ? '/admin/preview/mural' : '/mural';

  const nameLoop = site.site_title || event.name;
  const hero = (variant: Phase) => {
    const when = event.starts_at ? formatShort(event.starts_at, event.timezone) : '';
    const place = event.location_name || '';
    return (
      <section className="hero big" aria-labelledby="home-title">
        <div className="hero-bg" aria-hidden="true" />
        <span className="orb o1" aria-hidden="true" /><span className="orb o2" aria-hidden="true" /><span className="orb o3" aria-hidden="true" />
        {site.hero_image_url && isSafeHttpsUrl(site.hero_image_url) && (
          // eslint-disable-next-line @next/next/no-img-element
          <div className="hero-img" aria-hidden="true"><img src={site.hero_image_url} alt="" fetchPriority="high" referrerPolicy="no-referrer" /></div>
        )}
        <div className="hero-in hero-grid">
          <div className="hero-main">
            <span className="kicker">{variant === 'pre' ? 'Em breve' : variant === 'open' ? (live ? '● Ao vivo agora' : 'Começou') : 'Encerrada'}</span>
            <h1 id="home-title">{variant === 'ended' ? <>Obrigado por <span className="red">viver</span></> : <>{event.name}</>}</h1>
            {site.tagline && <p className="lead">{site.tagline}</p>}
            <div className="btn-row">
              <Link className={`btn ${variant === 'open' && live ? 'solid' : ''}`} href={liveHref}>{variant === 'open' && live ? 'Assistir ao vivo' : 'Ao vivo'}</Link>
              <Link className="btn solid" href={wallHref}>Ver o mural</Link>
            </div>
          </div>
          <aside className="hero-card" aria-label="Status do evento">
            <span className="kicker">{variant === 'pre' ? 'Próximo encontro' : variant === 'open' ? 'Agora' : 'Obrigado'}</span>
            <p className="hc-big">{when || (variant === 'pre' ? 'Data a confirmar' : variant === 'open' ? (live ? 'Transmissão no ar' : 'Programação em andamento') : 'Até a próxima')}</p>
            {place && <p className="hc-sub">{place}</p>}
            {event.address && <p className="hc-sub muted">{event.address}</p>}
            {variant === 'open' && live && <span className="badge live">● Ao vivo</span>}
          </aside>
        </div>
        <div className="marquee" aria-hidden="true"><div className="track">{Array.from({ length: 6 }, (_, i) => <span key={i}>{nameLoop} <i>•</i> {site.tagline || event.name} <i>•</i> </span>)}</div></div>
      </section>
    );
  };

  const gallery = (g.data ?? []).map((m) => ({ id: m.id, fileId: m.drive_file_id, alt: m.alt || m.title, caption: m.caption || m.title, featured: m.is_featured, album: m.album }));
  const liveBase = preview ? '/admin/preview/ao-vivo' : '/ao-vivo';
  const cats = new Map<string, number>();
  for (const v of vids.data ?? []) cats.set(v.category, (cats.get(v.category) ?? 0) + 1);
  const videoItems: FolderItem[] = [...cats.entries()].slice(0, 2).map(([c, n]) => ({ label: c, hint: `${n} vídeo${n > 1 ? 's' : ''}`, href: `${liveBase}#${slugify(c)}` }));
  videoItems.push({ label: 'Ao vivo', hint: 'YouTube', href: liveBase });
  const albumCount = new Map<string, number>();
  for (const m of gallery) if (m.album) albumCount.set(m.album, (albumCount.get(m.album) ?? 0) + 1);
  const homeBase = preview ? '/admin/preview/inicio' : '/';
  const photoItems: FolderItem[] = [...albumCount.entries()].slice(0, 2).map(([a, n]) => ({ label: a, hint: `${n} foto${n > 1 ? 's' : ''}`, href: `${homeBase}?album=${encodeURIComponent(a)}#galeria` }));
  photoItems.push({ label: 'Galeria completa', hint: 'Drive', href: '#galeria' });
  const nVideos = (vids.data ?? []).length;
  const plural = (n: number) => `${n} ${n === 1 ? 'item' : 'itens'}`;
  const hl = h.data ?? [];

  return (
    <>
      <PhaseGate serverNow={serverNow} opensAt={opensAt} endsAt={endsAt} forcePhase={forcePhase} pre={hero('pre')} open={hero('open')} ended={hero('ended')} />
      <div className="wrap">
        <section className="livebox glass" aria-labelledby="lb-title">
          <div className="lb-head">
            <h2 id="lb-title" className="section-title" style={{ margin: 0 }}>Vídeo ao vivo</h2>
            {live ? <span className="badge live">● Ao vivo</span> : <span className="badge">Aguardando</span>}
          </div>
          {live ? (
            <>
              <div className="player"><iframe title="Transmissão ao vivo — Revolution Conference" src={youtubeEmbedUrl(event.stream_video_id!)} allow="encrypted-media; picture-in-picture; web-share" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div>
              <div className="links"><a className="btn small" href={youtubeWatchUrl(event.stream_video_id!)} target="_blank" rel="noopener noreferrer">Abrir no YouTube ↗</a></div>
              {event.stream_note && <p className="muted">{event.stream_note}</p>}
            </>
          ) : (
            <div className="player lb-empty"><div><strong>A transmissão aparecerá aqui</strong><span>Quando o AO VIVO começar, o vídeo do YouTube é exibido nesta caixa.</span>{site.youtube_channel_url && isSafeHttpsUrl(site.youtube_channel_url) && <a className="link-btn" href={site.youtube_channel_url} target="_blank" rel="noopener noreferrer">Ir ao canal no YouTube ↗</a>}</div></div>
          )}
        </section>
        <EventInfo event={event} />
        {hl.length > 0 && (
          <section aria-labelledby="dest" style={{ marginTop: 56 }}>
            <h2 id="dest" className="section-title">Destaques</h2>
            <div className="info">
              {hl.map((p) => (
                <article key={p.id} className="card hl">
                  <span className="badge">Destaque</span>
                  <h3 style={{ marginTop: 12 }}>{p.title || 'Mural'}</h3>
                  <p className="muted" style={{ margin: '0 0 12px' }}>{p.body.length > 140 ? p.body.slice(0, 140) + '…' : p.body}</p>
                  <Link className="link-btn" href={`${preview ? '/admin/preview/mural' : '/mural'}/${p.id}`}>Abrir publicação →</Link>
                </article>
              ))}
            </div>
          </section>
        )}
        <section aria-labelledby="pastas" className="glow-section" style={{ marginTop: 64 }}>
          <div className="folders-head"><span className="kicker">Dois dias</span><h2 id="pastas" className="section-title" style={{ marginTop: 12 }}>Reviva cada momento</h2><p>Vídeos e fotos oficiais, reunidos em duas pastas.</p></div>
          <div className="fs">
            <Folder kind="v" title="Vídeos" count={plural(nVideos)} items={videoItems} />
            <Folder kind="f" title="Fotos" count={plural(gallery.length)} items={photoItems} />
          </div>
        </section>
        <section id="galeria" aria-labelledby="gal" style={{ marginTop: 40, scrollMarginTop: 90 }}>
          <h2 id="gal" className="section-title">Galeria</h2>
          {!g.ok ? <StateBox title="Não foi possível carregar a galeria" kind="error" /> : gallery.length > 0 ? <Gallery items={gallery} initialAlbum={album} /> : <StateBox title="Fotos em breve">As fotos oficiais aparecerão aqui.</StateBox>}
        </section>
      </div>
    </>
  );
}

