import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { EventRow, Media, Profile } from "@/lib/types";

const TABS = ["Dashboard", "Google Drive", "Denúncias", "Testemunhos", "Usuários", "Eventos", "Destaques"] as const;
type Tab = (typeof TABS)[number];

const log = (action: string, entity: string, entity_id: string, details?: object) =>
  supabase!.from("admin_logs").insert({ action, entity, entity_id, details });

export default function Admin() {
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("Dashboard");
  if (loading) return <Page title="Admin"><p>Carregando…</p></Page>;
  // A checagem real é feita pelo RLS e pela API; isto só evita mostrar telas inúteis.
  if (!isAdmin) return <Page title="Acesso restrito"><p>Esta área é só para administradores. <Link to="/login" className="underline">Entrar</Link></p></Page>;
  return (
    <Page title="Admin">
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`btn-ghost ${tab === t ? "bg-[#e11d0c] text-white" : ""}`}>{t}</button>)}
      </div>
      {tab === "Dashboard" && <Dashboard />}
      {tab === "Google Drive" && <DriveSync />}
      {tab === "Denúncias" && <Reports />}
      {tab === "Testemunhos" && <Testimonials />}
      {tab === "Usuários" && <Users />}
      {tab === "Eventos" && <Events />}
      {tab === "Destaques" && <Featured />}
    </Page>
  );
}

function Dashboard() {
  const [c, setC] = useState<Record<string, number>>({});
  useEffect(() => {
    const t = ["profiles", "photos", "videos", "comments", "reports", "testimonials", "events", "albums"];
    Promise.all(t.map((n) => supabase!.from(n).select("*", { count: "exact", head: true }).then(({ count }) => [n, count ?? 0] as const)))
      .then((r) => setC(Object.fromEntries(r)));
  }, []);
  const labels: Record<string, string> = { profiles: "Usuários", photos: "Fotos", videos: "Vídeos", comments: "Comentários", reports: "Denúncias", testimonials: "Testemunhos", events: "Eventos", albums: "Álbuns" };
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Object.entries(labels).map(([k, l]) => (
        <div key={k} className="border border-[#ff5a3c]/40 p-4"><div className="font-display text-5xl">{c[k] ?? "…"}</div>{l}</div>
      ))}
    </div>
  );
}

interface Run { id: string; status: string; files_found: number; photos_imported: number; videos_imported: number; errors: string[]; started_at: string; finished_at: string | null }

function DriveSync() {
  const { session } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState("");
  const [folder, setFolder] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const loadRun = useCallback(async (id: string) => {
    const { data } = await supabase!.from("drive_sync_runs").select("*").eq("event_id", id).order("started_at", { ascending: false }).limit(1).maybeSingle();
    setRun(data as Run | null);
  }, []);
  useEffect(() => { supabase!.from("events").select("*").order("start_date", { ascending: false }).then(({ data }) => {
    const e = (data ?? []) as EventRow[]; setEvents(e); if (e[0]) { setEventId(e[0].id); setFolder(e[0].drive_folder_id ?? ""); } }); }, []);
  useEffect(() => { if (eventId) { loadRun(eventId); setFolder(events.find((e) => e.id === eventId)?.drive_folder_id ?? ""); } }, [eventId, events, loadRun]);

  const saveFolder = async () => {
    const id = folder.trim().match(/[-\w]{20,}/)?.[0] ?? ""; // aceita link completo ou só o ID
    const { error } = await supabase!.from("events").update({ drive_folder_id: id || null }).eq("id", eventId);
    setErr(error?.message ?? ""); setFolder(id);
    setEvents((p) => p.map((e) => (e.id === eventId ? { ...e, drive_folder_id: id } : e)));
    if (!error) log("set_drive_folder", "event", eventId, { folder: id });
  };

  const sync = async () => {
    setBusy(true); setErr("");
    const r = await fetch("/api/drive-sync", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ eventId }) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) setErr(body.error ?? "Falha na sincronização");
    await loadRun(eventId); setBusy(false);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-3xl">Sincronização do Google Drive</h2>
      <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
      <div className="flex gap-2"><input className="input flex-1" placeholder="Link ou ID da pasta CONFERÊNCIA 2026" value={folder} onChange={(e) => setFolder(e.target.value)} /><button className="btn-ghost" onClick={saveFolder}>Salvar pasta</button></div>
      <button className="btn" disabled={busy || !eventId} onClick={sync}>{busy ? "Sincronizando…" : "SINCRONIZAR AGORA"}</button>
      {err && <p role="alert" className="text-yellow-300">{err}</p>}
      <dl className="grid grid-cols-2 gap-2 border border-white/20 p-4">
        <dt>Status</dt><dd>{run?.status ?? "—"}</dd>
        <dt>Última sincronização</dt><dd>{run?.finished_at ? new Date(run.finished_at).toLocaleString("pt-BR") : "—"}</dd>
        <dt>Arquivos encontrados</dt><dd>{run?.files_found ?? "—"}</dd>
        <dt>Fotos importadas</dt><dd>{run?.photos_imported ?? "—"}</dd>
        <dt>Vídeos importados</dt><dd>{run?.videos_imported ?? "—"}</dd>
        <dt>Erros</dt><dd>{run?.errors?.length ? <ul>{run.errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : "0"}</dd>
      </dl>
    </div>
  );
}

interface Rep { id: string; reason: string; status: string; comments: { id: string; content: string; user_id: string; status: string; profiles: { name: string } | null } | null; profiles: { name: string } | null }

function Reports() {
  const [rows, setRows] = useState<Rep[]>([]);
  const load = useCallback(() => { supabase!.from("reports").select("*, profiles(name), comments(id,content,user_id,status,profiles(name))").eq("status", "open").order("created_at").then(({ data }) => setRows((data ?? []) as unknown as Rep[])); }, []);
  useEffect(load, [load]);
  const act = async (r: Rep, what: "delete" | "dismiss" | "block") => {
    const c = r.comments;
    if (what === "delete" && c) await supabase!.from("comments").update({ status: "deleted" }).eq("id", c.id);
    if (what === "block" && c) { await supabase!.from("profiles").update({ status: "blocked" }).eq("user_id", c.user_id); await supabase!.from("comments").update({ status: "deleted" }).eq("id", c.id); }
    await supabase!.from("reports").update({ status: what === "dismiss" ? "dismissed" : "reviewed" }).eq("id", r.id);
    log(`report_${what}`, "report", r.id); load();
  };
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.id} className="border border-white/20 p-4">
          <p className="text-sm opacity-70">Denunciado por {r.profiles?.name}: {r.reason}</p>
          <p className="my-2"><strong>{r.comments?.profiles?.name}</strong>: “{r.comments?.content}” {r.comments?.status !== "visible" && <em>({r.comments?.status})</em>}</p>
          <div className="flex flex-wrap gap-2"><button className="btn-ghost" onClick={() => act(r, "delete")}>Excluir comentário</button><button className="btn-ghost" onClick={() => act(r, "block")}>Bloquear usuário</button><button className="btn-ghost" onClick={() => act(r, "dismiss")}>Ignorar</button></div>
        </li>
      ))}
      {!rows.length && <li className="opacity-70">Nenhuma denúncia aberta.</li>}
    </ul>
  );
}

interface Tst { id: string; content: string; profiles: { name: string } | null }
function Testimonials() {
  const [rows, setRows] = useState<Tst[]>([]);
  const load = useCallback(() => { supabase!.from("testimonials").select("id,content,profiles(name)").eq("status", "pending").order("created_at").then(({ data }) => setRows((data ?? []) as unknown as Tst[])); }, []);
  useEffect(load, [load]);
  const set = async (id: string, status: "approved" | "rejected") => { await supabase!.from("testimonials").update({ status }).eq("id", id); log(`testimonial_${status}`, "testimonial", id); load(); };
  return (
    <ul className="space-y-4">
      {rows.map((t) => (
        <li key={t.id} className="border border-white/20 p-4"><p>“{t.content}”</p><p className="text-sm text-[#ff5a3c]">— {t.profiles?.name}</p>
          <div className="mt-2 flex gap-2"><button className="btn-ghost" onClick={() => set(t.id, "approved")}>Aprovar</button><button className="btn-ghost" onClick={() => set(t.id, "rejected")}>Rejeitar</button></div></li>
      ))}
      {!rows.length && <li className="opacity-70">Nenhum testemunho pendente.</li>}
    </ul>
  );
}

function Users() {
  const { profile: me } = useAuth();
  const [rows, setRows] = useState<Profile[]>([]);
  const load = useCallback(() => { supabase!.from("profiles").select("*").order("created_at", { ascending: false }).limit(200).then(({ data }) => setRows((data ?? []) as Profile[])); }, []);
  useEffect(load, [load]);
  const patch = async (u: Profile, v: Partial<Profile>) => { await supabase!.from("profiles").update(v).eq("user_id", u.user_id); log("update_user", "profile", u.user_id, v); load(); };
  return (
    <table className="w-full text-left"><thead><tr><th>Nome</th><th>Perfil</th><th>Status</th><th /></tr></thead>
      <tbody>{rows.map((u) => (
        <tr key={u.id} className="border-t border-white/10"><td className="py-2">{u.name}</td><td>{u.role}</td><td>{u.status}</td>
          <td className="space-x-2 text-right">{u.user_id !== me?.user_id && <>
            <button className="btn-ghost" onClick={() => patch(u, { status: u.status === "active" ? "blocked" : "active" })}>{u.status === "active" ? "Bloquear" : "Desbloquear"}</button>
            <button className="btn-ghost" onClick={() => patch(u, { role: u.role === "ADMIN" ? "USER" : "ADMIN" })}>{u.role === "ADMIN" ? "Remover admin" : "Tornar admin"}</button></>}</td></tr>
      ))}</tbody></table>
  );
}

function Events() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [f, setF] = useState({ name: "", slug: "", start: "", end: "" });
  const [err, setErr] = useState("");
  const load = useCallback(() => { supabase!.from("events").select("*").order("start_date", { ascending: false }).then(({ data }) => setRows((data ?? []) as EventRow[])); }, []);
  useEffect(load, [load]);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase!.from("events").insert({ name: f.name, slug: f.slug.toLowerCase().replace(/[^a-z0-9-]/g, ""), start_date: f.start, end_date: f.end, status: "upcoming" });
    setErr(error?.message ?? ""); if (!error) { setF({ name: "", slug: "", start: "", end: "" }); load(); }
  };
  const setStatus = async (id: string, status: string) => { await supabase!.from("events").update({ status }).eq("id", id); load(); };
  return (
    <div className="space-y-6">
      <form onSubmit={create} className="grid max-w-2xl gap-2 md:grid-cols-2">
        <input className="input" placeholder="Nome (ex.: Conferência 2027)" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input" placeholder="slug (ex.: 2027)" required value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
        <input className="input" type="datetime-local" required value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
        <input className="input" type="datetime-local" required value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
        <button className="btn md:col-span-2">Criar evento</button>{err && <p className="text-yellow-300">{err}</p>}
      </form>
      <ul className="space-y-2">{rows.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-3 border border-white/20 p-3"><strong>{e.name}</strong> /eventos/{e.slug}
          <select className="input" value={e.status} onChange={(ev) => setStatus(e.id, ev.target.value)}>{["draft", "upcoming", "live", "past"].map((s) => <option key={s}>{s}</option>)}</select></li>
      ))}</ul>
    </div>
  );
}

function Featured() {
  const [rows, setRows] = useState<(Media & { kind: "photos" | "videos" })[]>([]);
  const load = useCallback(async () => {
    const [p, v] = await Promise.all([
      supabase!.from("photos").select("*").order("created_at", { ascending: false }).limit(60),
      supabase!.from("videos").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    setRows([...((p.data ?? []) as Media[]).map((m) => ({ ...m, kind: "photos" as const })), ...((v.data ?? []) as Media[]).map((m) => ({ ...m, kind: "videos" as const }))]);
  }, []);
  useEffect(() => { load(); }, [load]);
  const toggle = async (m: Media & { kind: "photos" | "videos" }) => { await supabase!.from(m.kind).update({ is_featured: !m.is_featured }).eq("id", m.id); log("toggle_featured", m.kind, m.id); load(); };
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
      {rows.map((m) => (
        <button key={m.id} onClick={() => toggle(m)} className={`relative aspect-square overflow-hidden ${m.is_featured ? "ring-4 ring-yellow-300" : ""}`} title={m.title}>
          <img src={m.thumbnail_url ?? ""} alt={m.title} loading="lazy" className="h-full w-full object-cover" />
          {m.kind === "videos" && <span className="absolute left-1 top-1 bg-black/70 px-1">▶</span>}
          {m.is_featured && <span className="absolute bottom-1 right-1 bg-yellow-300 px-1 text-black">★</span>}
        </button>
      ))}
      {!rows.length && <p className="opacity-70">Sincronize o Drive primeiro.</p>}
    </div>
  );
}
