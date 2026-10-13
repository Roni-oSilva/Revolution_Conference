import type { SupabaseClient } from '@supabase/supabase-js';
import { getSettings, getVideos } from '@/lib/data';
import { youtubeEmbedUrl, youtubeWatchUrl, isSafeHttpsUrl } from '@/lib/urls';
import { VideoCard } from '../VideoCard';
import { StateBox } from '../States';
import { slugify } from '@/lib/slug';
import type { EventSettings } from '@/lib/types';

interface ViewOpts { client: SupabaseClient; preview?: boolean }
const streamReady = (e: EventSettings) => e.stream_enabled && !!e.stream_video_id;

export async function LiveView({ client, preview = false }: ViewOpts) {
  const s = await getSettings(client);
  if (!s.ok) return <div className="wrap"><StateBox title="Não foi possível carregar a transmissão" kind="error"><p>Tente novamente em instantes.</p></StateBox></div>;
  const { site, event } = s.data;
  const v = await getVideos(client, preview);
  const ready = streamReady(event);
  const videos = v.data ?? [];
  const byCat = new Map<string, typeof videos>();
  for (const x of videos) (byCat.get(x.category) ?? byCat.set(x.category, []).get(x.category)!).push(x);

  return (
    <div className="wrap">
      <span className="kicker">Transmissão</span>
      <h1 className="page-title">Ao <span className="red">vivo</span></h1>
      {ready ? (
        <section aria-label="Transmissão ao vivo">
          <div className="player"><iframe title="Transmissão ao vivo — Revolution Conference" src={youtubeEmbedUrl(event.stream_video_id!)} allow="encrypted-media; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
          <div className="links"><span className="badge live">● Ao vivo</span><a className="btn small" href={youtubeWatchUrl(event.stream_video_id!)} target="_blank" rel="noopener noreferrer">Abrir no YouTube ↗</a></div>
          {event.stream_note && <p className="muted">{event.stream_note}</p>}
          <p className="muted" style={{ fontSize: 13 }}>Se o player não abrir (bloqueio do YouTube ou da sua rede), use o botão “Abrir no YouTube”.</p>
        </section>
      ) : (
        <StateBox title="Nenhuma transmissão no momento">
          <p>A transmissão aparecerá aqui quando o AO VIVO começar.</p>
          {event.stream_note && <p>{event.stream_note}</p>}
          {site.youtube_channel_url && isSafeHttpsUrl(site.youtube_channel_url) && <p><a className="link-btn" href={site.youtube_channel_url} target="_blank" rel="noopener noreferrer">Ir ao canal no YouTube ↗</a></p>}
        </StateBox>
      )}
      <section aria-labelledby="gravados" style={{ marginTop: 56 }}>
        <h2 id="gravados" className="section-title">Vídeos gravados</h2>
        {!v.ok ? <StateBox title="Não foi possível carregar os vídeos" kind="error"><p>Tente novamente em instantes.</p></StateBox>
          : videos.length === 0 ? <StateBox title="Ainda não há vídeos">As gravações aparecerão aqui.</StateBox>
          : [...byCat.entries()].map(([cat, list]) => (
            <div key={cat}>
              <h3 className="cat" id={slugify(cat)} style={{ scrollMarginTop: 90 }}>{cat}</h3>
              <div className="vgrid">{list.map((x) => <VideoCard key={x.id} id={x.id} youtubeId={x.youtube_id} title={x.title} description={x.description} category={x.category} />)}</div>
            </div>
          ))}
      </section>
    </div>
  );
}

