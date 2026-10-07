import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Page } from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import { useCurrentEvent } from "@/lib/data";
import type { EventRow } from "@/lib/types";

export function EventList() {
  const [events, setEvents] = useState<EventRow[]>([]);
  useEffect(() => { supabase?.from("events").select("*").order("start_date", { ascending: false }).then(({ data }) => setEvents((data ?? []) as EventRow[])); }, []);
  return (
    <Page title="Eventos">
      <ul className="grid gap-4 md:grid-cols-2">
        {events.map((e) => (
          <li key={e.id} className="border border-[#ff5a3c]/40 p-5">
            <Link to={`/eventos/${e.slug}`} className="font-display text-4xl">{e.name}</Link>
            <p className="opacity-70">{new Date(e.start_date).toLocaleDateString("pt-BR")}</p>
          </li>
        ))}
        {!events.length && <li className="opacity-70">Nenhum evento cadastrado.</li>}
      </ul>
    </Page>
  );
}

export function EventPage() {
  const { slug } = useParams();
  const { event, loading } = useCurrentEvent(slug);
  if (loading) return <Page title="…"><p>Carregando…</p></Page>;
  if (!event) return <Page title="Evento não encontrado"><Link to="/eventos" className="underline">Ver eventos</Link></Page>;
  const q = `?evento=${event.slug}`;
  return (
    <Page title={event.name}>
      {event.cover_image && <img src={event.cover_image} alt="" className="mb-4 max-h-96 w-full object-cover" />}
      <p className="mb-2 text-xl">{new Date(event.start_date).toLocaleDateString("pt-BR", { dateStyle: "long" })} — {new Date(event.end_date).toLocaleDateString("pt-BR", { dateStyle: "long" })}</p>
      <p className="mb-6 max-w-2xl opacity-80">{event.description}</p>
      <div className="flex flex-wrap gap-3">
        <Link className="btn" to={`/fotos${q}`}>Ver todas as fotos</Link>
        <Link className="btn-ghost" to="/videos">Vídeos</Link>
        <Link className="btn-ghost" to="/comunidade">Comunidade</Link>
      </div>
    </Page>
  );
}
