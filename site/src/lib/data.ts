import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { EventRow, Media, Kind } from "./types";

/** Evento em destaque: o mais recente que não é rascunho (o RLS já esconde rascunhos). */
export function useCurrentEvent(slug?: string) {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let q = supabase.from("events").select("*");
    q = slug ? q.eq("slug", slug) : q.order("start_date", { ascending: false }).limit(1);
    q.then(({ data }) => { setEvent((data?.[0] as EventRow) ?? null); setLoading(false); });
  }, [slug]);
  return { event, loading };
}

export const table = (k: Kind) => (k === "photo" ? "photos" : "videos");
export const countOf = (m: Media, f: "likes" | "comments") => m[f]?.[0]?.count ?? 0;

export async function fetchMedia(kind: Kind, eventId: string, opts: { category?: string; from: number; to: number; featured?: boolean }) {
  if (!supabase) return [];
  let q = supabase.from(table(kind)).select("*, likes(count), comments(count)")
    .eq("event_id", eventId).order("created_at", { ascending: false }).range(opts.from, opts.to);
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.featured) q = q.eq("is_featured", true);
  const { data } = await q;
  return (data ?? []) as Media[];
}
