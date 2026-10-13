import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getGallery, getHighlights, getSettings } from '@/lib/data';
import { parseIsoMs, type Phase } from '@/lib/phase';
import { formatEventDate } from '@/lib/format';
import { isSafeHttpsUrl } from '@/lib/urls';
import { PhaseGate } from '../PhaseGate';
import { Countdown } from '../Countdown';
import { Gallery } from '../Gallery';
import { StateBox } from '../States';
import type { EventSettings } from '@/lib/types';

interface ViewOpts { client: SupabaseClient; preview?: boolean; forcePhase?: Phase }
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

export async function HomeView({ client, preview = false, forcePhase }: ViewOpts) {
  const s = await getSettings(client);
  if (!s.ok) return <div className="wrap"><StateBox title="Não foi possível carregar o site" kind="error"><p>Tente novamente em instantes.</p></StateBox></div>;
  const { site, event } = s.data;
  const [g, h] = await Promise.all([getGallery(client, preview, 24), getHighlights(client, preview)]);
  const serverNow = Date.now();
  const opensAt = parseIsoMs(event.opens_at ?? event.starts_at);
  const endsAt = parseIsoMs(event.ends_at);
  const live = streamReady(event);
  const liveHref = preview ? '/admin/preview/ao-vivo' : '/ao-vivo';
  const wallHref = preview ? '/admin/preview/mural' : '/mural';

  const hero = (variant: Phase) => (
    <section className="hero" aria-labelledby="home-title">
      <div className="hero-bg" aria-hidden="true" />
      {site.hero_image_url && isSafeHttpsUrl(site.hero_image_url) && (
        // eslint-disable-next-line @next/next/no-img-element
        <div className="hero-img" aria-hidden="true"><img src={site.hero_image_url} alt="" fetchPriority="high" referrerPolicy="no-referrer" /></div>
      )}
      <div className="hero-in">
        <span className="kicker">{variant === 'pre' ? 'Em breve' : variant === 'open' ? (live ? '● Ao vivo agora' : 'Começou') : 'Encerrada'}</span>
        <h1 id="home-title">{variant === 'ended' ? <>Obrigado por <span className="red">viver</span></> : <>{event.name}</>}</h1>
        {site.tagline && <p className="lead">{site.tagline}</p>}
        {variant === 'pre' && (opensAt ? <Countdown targetMs={opensAt} /> : <p className="muted">Data de abertura a confirmar.</p>)}
        <div className="btn-row">
          <Link className={`btn ${variant === 'open' && live ? 'solid' : ''}`} href={liveHref}>{variant === 'open' && live ? 'Assistir ao vivo' : 'Ao vivo'}</Link>
          <Link className="btn solid" href={wallHref}>Ver o mural</Link>
        </div>
      </div>
    </section>
  );

  const gallery = (g.data ?? []).map((m) => ({ id: m.id, fileId: m.drive_file_id, alt: m.alt || m.title, caption: m.caption || m.title, featured: m.is_featured }));
  const hl = h.data ?? [];

  return (
    <>
      <PhaseGate serverNow={serverNow} opensAt={opensAt} endsAt={endsAt} forcePhase={forcePhase} pre={hero('pre')} open={hero('open')} ended={hero('ended')} />
      <div className="wrap">
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
        <section aria-labelledby="gal" style={{ marginTop: 56 }}>
          <h2 id="gal" className="section-title">Galeria</h2>
          {!g.ok ? <StateBox title="Não foi possível carregar a galeria" kind="error" /> : gallery.length > 0 ? <Gallery items={gallery} /> : <StateBox title="Fotos em breve">As fotos oficiais aparecerão aqui.</StateBox>}
        </section>
      </div>
    </>
  );
}

