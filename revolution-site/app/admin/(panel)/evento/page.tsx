import { requireAdmin } from '@/lib/admin/auth';
import { getSettings } from '@/lib/data';
import { utcToZonedLocalInput } from '@/lib/tz';
import { saveEventAction, saveSiteAction } from '../../actions';
import { Field, Flash } from '../ui';

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { client } = await requireAdmin();
  const { m } = await searchParams;
  const s = await getSettings(client);
  if (!s.ok) return <div className="msg err" role="alert">Não foi possível carregar as configurações.</div>;
  const { site, event } = s.data;
  const tz = event.timezone;
  return (
    <>
      <Flash code={m} />
      <h2>Evento</h2>
      <form action={saveEventAction} className="card f">
        <Field label="Nome do evento" name="name" defaultValue={event.name} required max={120} />
        <Field label="Fuso horário (IANA)" name="timezone" defaultValue={tz} required help="Ex.: America/Sao_Paulo. Os horários abaixo são interpretados neste fuso." />
        <Field label="Data e hora do evento (exibição)" name="starts_local" type="datetime-local" defaultValue={utcToZonedLocalInput(event.starts_at, tz)} />
        <Field label="Abertura (fim da contagem e troca de fase)" name="opens_local" type="datetime-local" defaultValue={utcToZonedLocalInput(event.opens_at, tz)} help="No instante exato, o site muda de “pré-evento” para “pós-abertura” em todos os visitantes, sem recarregar." />
        <Field label="Encerramento (opcional)" name="ends_local" type="datetime-local" defaultValue={utcToZonedLocalInput(event.ends_at, tz)} />
        <Field label="Local" name="location_name" defaultValue={event.location_name} max={160} />
        <Field label="Endereço" name="address" defaultValue={event.address} max={300} wide />
        <Field label="Link do mapa (https)" name="maps_url" type="url" defaultValue={event.maps_url} wide />
        <Field label="Descrição" name="description" rows={4} defaultValue={event.description} max={2000} wide />
        <div className="field wide"><button className="btn solid" type="submit">Salvar evento</button></div>
      </form>

      <h2>Home e site</h2>
      <form action={saveSiteAction} className="card f">
        <Field label="Título do site" name="site_title" defaultValue={site.site_title} required max={120} />
        <Field label="Frase de destaque (banner)" name="tagline" defaultValue={site.tagline} max={200} />
        <Field label="Imagem do banner (link https)" name="hero_image_url" type="url" defaultValue={site.hero_image_url} wide help="Qualquer imagem https pública. Para fotos do Drive, use a área Mídia." />
        <Field label="Descrição para buscadores (SEO)" name="seo_description" rows={2} defaultValue={site.seo_description} max={300} wide />
        <Field label="Instagram (link)" name="instagram_url" type="url" defaultValue={site.instagram_url} />
        <Field label="Canal do YouTube (link)" name="youtube_channel_url" type="url" defaultValue={site.youtube_channel_url} />
        <Field label="WhatsApp (link)" name="whatsapp_url" type="url" defaultValue={site.whatsapp_url} />
        <Field label="Texto da política de privacidade (vazio = texto padrão)" name="privacy_text" rows={8} defaultValue={site.privacy_text} max={20000} wide />
        <div className="field wide"><button className="btn solid" type="submit">Salvar home e site</button></div>
      </form>
    </>
  );
}
