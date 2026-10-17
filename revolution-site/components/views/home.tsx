import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getHighlights, getSchedule, getSettings } from '@/lib/data';
import { parseIsoMs, type Phase } from '@/lib/phase';
import { formatDays, formatShort, formatTimeH } from '@/lib/format';
import { isSafeHttpsUrl, mapsEmbedUrl, mapsOpenUrl, youtubeEmbedUrl, youtubeWatchUrl } from '@/lib/urls';
import { REGISTRATION_URL } from '@/lib/links';
import { HeroVideo } from '../HeroVideo';
import { VaporCountdown } from '../ui/countdown-vapor-digits';
import { Logo } from '../Logo';
import { PhaseGate } from '../PhaseGate';
import { StateBox } from '../States';
import { DayGallery, type DayPhoto } from '../DayGallery';
import type { EventSettings } from '@/lib/types';

const DIA1: DayPhoto[] = Array.from({ length: 16 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return { src: `/galeria/dia1/${n}.jpg`, thumb: `/galeria/dia1/t${n}.jpg`, alt: `Revolution Conference — primeiro dia, foto ${i + 1}` };
});

interface ViewOpts { client: SupabaseClient; preview?: boolean; forcePhase?: Phase; album?: string }
const streamReady = (e: EventSettings) => e.stream_enabled && !!e.stream_video_id;

function Where({ event }: { event: EventSettings }) {
  const query = [event.location_name, event.address].filter(Boolean).join(', ');
  const days = formatDays(event.starts_at, event.ends_at, event.timezone);
  const time = formatTimeH(event.starts_at, event.timezone);
  if (!query && !days) return <StateBox title="Local e data em breve">As informações do evento serão divulgadas aqui.</StateBox>;
  const open = event.maps_url && isSafeHttpsUrl(event.maps_url) ? event.maps_url : query ? mapsOpenUrl(query) : null;
  return (
    <div className="where">
      {query && <div className="map"><iframe title={`Mapa: ${query}`} src={mapsEmbedUrl(query)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>}
      <div className="where-card">
        <span className="kicker">Local</span>
        <h3>{event.location_name || 'Local da conferência'}</h3>
        {event.address && <p className="where-addr">{event.address}</p>}
        {(days || time) && (
          <dl className="where-meta">
            {days && <div><dt>Data</dt><dd>{days}</dd></div>}
            {time && <div><dt>Horário</dt><dd>{time}</dd></div>}
          </dl>
        )}
        {open && <a className="btn solid where-btn" href={open} target="_blank" rel="noopener noreferrer">Abrir no mapa <span aria-hidden="true">→</span></a>}
        {event.description && <p className="where-about">{event.description}</p>}
      </div>
    </div>
  );
}

export async function HomeView({ client, preview = false, forcePhase, album = '' }: ViewOpts) {
  const s = await getSettings(client);
  if (!s.ok) return <div className="wrap"><StateBox title="Não foi possível carregar o site" kind="error"><p>Tente novamente em instantes.</p></StateBox></div>;
  const { site, event } = s.data;
  const [h, sch] = await Promise.all([getHighlights(client, preview), getSchedule(client, preview)]);
  const days = new Map<string, NonNullable<typeof sch.data>>();
  for (const it of sch.data ?? []) (days.get(it.day_label) ?? days.set(it.day_label, []).get(it.day_label)!).push(it);
  const serverNow = Date.now();
  const opensAt = parseIsoMs(event.opens_at ?? event.starts_at);
  const endsAt = parseIsoMs(event.ends_at);
  const live = streamReady(event);
  const liveHref = preview ? '/admin/preview/ao-vivo' : '/ao-vivo';
  const wallHref = preview ? '/admin/preview/mural' : '/mural';

  const hero = (variant: Phase) => {
    const when = event.starts_at ? formatShort(event.starts_at, event.timezone) : '';
    const place = event.location_name || '';
    return (
      <section className="hero big hv" aria-labelledby="home-title">
        <div className="hv-stage">
        <HeroVideo />
        <div className="hero-in hero-grid">
          <div className="hero-main">
            <Logo size="xl" />
            <span className="kicker">{variant === 'pre' ? 'Em breve' : variant === 'open' ? (live ? '● Ao vivo agora' : 'Começou') : 'Encerrada'}</span>
            <h1 id="home-title">{variant === 'ended' ? <>Obrigado por <span className="red">viver</span></> : <>{event.name}</>}</h1>
            {site.tagline && <p className="lead">{site.tagline}</p>}
            <div className="btn-row">
              <Link className={`btn ${variant === 'open' && live ? 'solid' : ''}`} href={liveHref}>{variant === 'open' && live ? 'Assistir ao vivo' : 'Ao vivo'}</Link>
              <Link className="btn" href={wallHref}>Ver o mural</Link>
              {variant !== 'ended' && <a className="btn solid" href={REGISTRATION_URL} target="_blank" rel="noopener noreferrer">Ainda não fez a inscrição? <span aria-hidden="true">↗</span></a>}
            </div>
          </div>
          <aside className="hero-card" aria-label="Status do evento">
            <span className="kicker">{variant === 'pre' ? (opensAt ? 'Começa em' : 'Próximo encontro') : variant === 'open' ? 'Agora' : 'Obrigado'}</span>
            {variant === 'pre' && opensAt != null && <VaporCountdown targetDate={opensAt} />}
            <p className="hc-big">{when || (variant === 'pre' ? 'Data a confirmar' : variant === 'open' ? (live ? 'Transmissão no ar' : 'Programação em andamento') : 'Até a próxima')}</p>
            {place && <p className="hc-sub">{place}</p>}
            {event.address && <p className="hc-sub muted">{event.address}</p>}
            {variant === 'open' && live && <span className="badge live">● Ao vivo</span>}
          </aside>
        </div>
        </div>
      </section>
    );
  };

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
        <section id="programacao" aria-labelledby="prog" className="schedule" style={{ scrollMarginTop: 90 }}>
          <span className="kicker">Dia a dia</span>
          <h2 id="prog" className="section-title">Programação</h2>
          {!sch.ok ? <StateBox title="Não foi possível carregar a programação" kind="error" /> : days.size === 0 ? <StateBox title="Programação em breve">Os horários de cada dia serão divulgados aqui.</StateBox> : (
            <div className="days">
              {[...days.entries()].map(([label, items]) => (
                <div key={label} className="day glass-card">
                  <h3 className="day-title">{label}</h3>
                  <ol className="slots">
                    {items.map((it) => (
                      <li key={it.id}><span className="slot-time">{it.time_label || '—'}</span><div><strong>{it.title}</strong>{it.description && <p>{it.description}</p>}</div></li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </section>
        <section id="onde" aria-labelledby="onde-t" style={{ marginTop: 64, scrollMarginTop: 90 }}>
          <span className="kicker">Acontecendo</span>
          <h2 id="onde-t" className="section-title">Onde está acontecendo</h2>
          <Where event={event} />
        </section>
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
        <section aria-labelledby="momentos" style={{ marginTop: 64 }}>
          <span className="kicker">Fotos e vídeos</span>
          <h2 id="momentos" className="section-title">Reviva cada momento</h2>
          <h3 className="section-title" style={{ fontSize: 'clamp(20px, 2.6vw, 28px)', margin: '8px 0 16px' }}>Primeiro dia</h3>
          <DayGallery photos={DIA1} />
          <div style={{ marginTop: 20 }}><StateBox title="Vídeos indisponíveis no momento">Os vídeos serão liberados em breve.</StateBox></div>
        </section>
      </div>
    </>
  );
}

