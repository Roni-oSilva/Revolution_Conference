import { requireAdmin } from '@/lib/admin/auth';
import { getSettings } from '@/lib/data';
import { driveThumbUrl, youtubeWatchUrl } from '@/lib/urls';
import { addMediaAction, addVideoAction, deleteMediaAction, deleteVideoAction, moveMediaAction, moveVideoAction, recheckMediaAction, recheckVideoAction, saveStreamAction, updateMediaAction, updateVideoAction } from '../../actions';
import { Check, Confirm, Field, Flash } from '../ui';
import type { MediaRow, VideoRow } from '@/lib/types';

const CATS = ['Pregações', 'Louvor', 'Bastidores', 'Entrevistas', 'Melhores momentos', 'Geral'];
const AV = { ok: '✅ Pública', unavailable: '⚠️ Indisponível', unknown: '❔ Não verificada' } as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { client } = await requireAdmin();
  const { m } = await searchParams;
  const [s, media, videos] = await Promise.all([getSettings(client), client.from('media').select('*').order('position').order('created_at', { ascending: false }), client.from('videos').select('*').order('position').order('created_at', { ascending: false })]);
  const ev = s.data?.event;
  const ml = (media.data ?? []) as MediaRow[]; const vl = (videos.data ?? []) as VideoRow[];
  return (
    <>
      <Flash code={m} />
      <h2>Transmissão ao vivo (YouTube)</h2>
      <form action={saveStreamAction} className="card f">
        <Field label="Link ou ID do vídeo/live no YouTube" name="stream_input" defaultValue={ev?.stream_url ?? ''} wide help="Aceita youtube.com/watch?v=…, youtu.be/…, /live/… ou o ID de 11 caracteres. Só o player oficial (youtube-nocookie) é incorporado." />
        <Field label="Aviso exibido na página (opcional)" name="stream_note" defaultValue={ev?.stream_note} max={500} wide />
        <Check label="Transmissão LIGADA (mostra o player no AO VIVO)" name="stream_enabled" checked={ev?.stream_enabled} />
        <div className="field wide"><p className="muted" style={{ margin: 0, fontSize: 13 }}>Desligada = o site mostra “Nenhuma transmissão no momento”. Ter um link salvo não liga a transmissão.</p><button className="btn solid small" type="submit" style={{ marginTop: 8 }}>Salvar transmissão</button></div>
      </form>

      <h2>Fotos (Google Drive)</h2>
      <div className="card"><p style={{ marginTop: 0 }}>No Drive: clique com o botão direito na foto → <strong>Compartilhar</strong> → “Qualquer pessoa com o link” (Leitor) → copiar link. Pastas não são aceitas — cole o link de cada arquivo. O site só exibe fotos que o Drive entrega publicamente.</p>
        <form action={addMediaAction} className="f">
          <Field label="Link do arquivo no Drive" name="url" type="url" required wide placeholder="https://drive.google.com/file/d/…/view" />
          <Field label="Título" name="title" max={120} /><Field label="Texto alternativo (acessibilidade)" name="alt" max={200} /><Field label="Legenda" name="caption" max={300} wide />
          <div className="field wide"><button className="btn solid small" type="submit">Adicionar foto (verifica se está pública)</button></div>
        </form></div>
      {ml.length === 0 && <div className="state"><strong>Nenhuma foto cadastrada</strong></div>}
      {ml.map((x, i) => (
        <article key={x.id} className="card" data-media-id={x.id}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={driveThumbUrl(x.drive_file_id, 160)} alt="" width={80} height={60} style={{ objectFit: 'cover', borderRadius: 8, background: '#222' }} referrerPolicy="no-referrer" />
              <div><strong>{x.title || x.drive_file_id}</strong><br /><span className="muted" style={{ fontSize: 13 }}>{AV[x.availability]} · {x.is_published ? 'Publicada' : 'Não publicada'}{x.is_featured ? ' · Destaque' : ''}</span></div>
            </div>
            <div className="row">
              <form action={moveMediaAction}><input type="hidden" name="id" value={x.id} /><button name="dir" value="up" className="btn small" type="submit" aria-label="Subir" disabled={i === 0}>↑</button> <button name="dir" value="down" className="btn small" type="submit" aria-label="Descer" disabled={i === ml.length - 1}>↓</button></form>
              <form action={recheckMediaAction}><input type="hidden" name="id" value={x.id} /><button className="btn small" type="submit">Verificar de novo</button></form>
            </div>
          </div>
          {x.availability === 'unavailable' && <div className="msg err">Esta foto não está pública no Drive e fica fora do site até ser compartilhada com “Qualquer pessoa com o link”.</div>}
          <details style={{ marginTop: 10 }}><summary className="btn small" style={{ listStyle: 'none' }}>Editar</summary>
            <form action={updateMediaAction} className="f" style={{ marginTop: 10 }}>
              <input type="hidden" name="id" value={x.id} />
              <Field label="Título" name="title" defaultValue={x.title} /><Field label="Texto alternativo" name="alt" defaultValue={x.alt} /><Field label="Legenda" name="caption" defaultValue={x.caption} wide />
              <Field label="Posição" name="position" type="number" defaultValue={x.position} />
              <Check label="Publicada" name="is_published" checked={x.is_published} /><Check label="Foto de destaque" name="is_featured" checked={x.is_featured} />
              <div className="field wide"><button className="btn solid small" type="submit">Salvar</button></div>
            </form></details>
          <div style={{ marginTop: 10 }}><Confirm action={deleteMediaAction} id={x.id} /></div>
        </article>
      ))}

      <h2>Vídeos gravados (YouTube)</h2>
      <form action={addVideoAction} className="card f">
        <Field label="Link do vídeo" name="url" type="url" required wide placeholder="https://www.youtube.com/watch?v=…" />
        <Field label="Título" name="title" required max={160} />
        <div className="field"><label htmlFor="cat">Categoria</label><input id="cat" name="category" list="cats" defaultValue="Geral" required maxLength={60} /><datalist id="cats">{CATS.map((c) => <option key={c} value={c} />)}</datalist></div>
        <Field label="Descrição" name="description" rows={3} max={1000} wide />
        <div className="field wide"><button className="btn solid small" type="submit">Adicionar vídeo (verifica no YouTube)</button></div>
      </form>
      {vl.length === 0 && <div className="state"><strong>Nenhum vídeo cadastrado</strong></div>}
      {vl.map((x, i) => (
        <article key={x.id} className="card" data-video-id={x.id}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><strong>{x.title}</strong><br /><span className="muted" style={{ fontSize: 13 }}>{x.category} · {AV[x.availability]} · {x.is_published ? 'Publicado' : 'Oculto'} · <a href={youtubeWatchUrl(x.youtube_id)} target="_blank" rel="noopener noreferrer">YouTube ↗</a></span></div>
            <div className="row">
              <form action={moveVideoAction}><input type="hidden" name="id" value={x.id} /><button name="dir" value="up" className="btn small" type="submit" aria-label="Subir" disabled={i === 0}>↑</button> <button name="dir" value="down" className="btn small" type="submit" aria-label="Descer" disabled={i === vl.length - 1}>↓</button></form>
              <form action={recheckVideoAction}><input type="hidden" name="id" value={x.id} /><button className="btn small" type="submit">Verificar de novo</button></form>
            </div>
          </div>
          {x.availability === 'unavailable' && <div className="msg err">O YouTube indica que este vídeo está privado, removido ou sem incorporação; ele fica fora do site.</div>}
          <details style={{ marginTop: 10 }}><summary className="btn small" style={{ listStyle: 'none' }}>Editar</summary>
            <form action={updateVideoAction} className="f" style={{ marginTop: 10 }}>
              <input type="hidden" name="id" value={x.id} />
              <Field label="Título" name="title" defaultValue={x.title} required /><Field label="Categoria" name="category" defaultValue={x.category} required /><Field label="Descrição" name="description" rows={3} defaultValue={x.description} wide />
              <Field label="Posição" name="position" type="number" defaultValue={x.position} /><Check label="Publicado" name="is_published" checked={x.is_published} />
              <div className="field wide"><button className="btn solid small" type="submit">Salvar</button></div>
            </form></details>
          <div style={{ marginTop: 10 }}><Confirm action={deleteVideoAction} id={x.id} /></div>
        </article>
      ))}
    </>
  );
}
