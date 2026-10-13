import { requireAdmin } from '@/lib/admin/auth';
import { addScheduleAction, deleteScheduleAction, moveScheduleAction, updateScheduleAction } from '../../actions';
import { Check, Confirm, Field, Flash } from '../ui';
import type { ScheduleRow } from '@/lib/types';

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { client } = await requireAdmin();
  const { m } = await searchParams;
  const { data } = await client.from('schedule_items').select('*').order('position').order('created_at');
  const list = (data ?? []) as ScheduleRow[];
  return (
    <>
      <Flash code={m} />
      <h2>Programação dos dias</h2>
      <div className="card">
        <p style={{ marginTop: 0 }}>Cada item pertence a um dia (ex.: “Dia 1 · 17 de outubro”). Itens com o mesmo nome de dia ficam juntos no site, na ordem desta lista.</p>
        <form action={addScheduleAction} className="f">
          <Field label="Dia" name="day_label" required max={60} placeholder="Dia 1 · 17 de outubro" />
          <Field label="Horário" name="time_label" max={20} placeholder="19h30" />
          <Field label="Título" name="title" required max={160} wide />
          <Field label="Descrição (opcional)" name="description" max={600} wide />
          <div className="field wide"><button className="btn solid small" type="submit">Adicionar à programação</button></div>
        </form>
      </div>
      {list.length === 0 && <div className="state"><strong>Nenhum item cadastrado</strong></div>}
      {list.map((x, i) => (
        <article key={x.id} className="card" data-schedule-id={x.id}>
          <form action={updateScheduleAction} className="f">
            <input type="hidden" name="id" value={x.id} /><input type="hidden" name="position" value={i} />
            <Field label="Dia" name="day_label" defaultValue={x.day_label} required max={60} />
            <Field label="Horário" name="time_label" defaultValue={x.time_label} max={20} />
            <Field label="Título" name="title" defaultValue={x.title} required max={160} wide />
            <Field label="Descrição" name="description" defaultValue={x.description} max={600} wide />
            <Check label="Publicado" name="is_published" checked={x.is_published} />
            <div className="field wide row"><button className="btn solid small" type="submit">Salvar</button></div>
          </form>
          <div className="row" style={{ marginTop: 8 }}>
            <form action={moveScheduleAction}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="dir" value="up" /><button className="btn small" type="submit" disabled={i === 0} aria-label="Subir">↑</button></form>
            <form action={moveScheduleAction}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="dir" value="down" /><button className="btn small" type="submit" disabled={i === list.length - 1} aria-label="Descer">↓</button></form>
            <Confirm action={deleteScheduleAction} id={x.id} />
          </div>
        </article>
      ))}
    </>
  );
}
