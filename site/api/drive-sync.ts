import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleAuth } from "google-auth-library";
import { requireAdmin, serviceClient } from "./_lib/admin.js";

type DriveFile = { id: string; name: string; mimeType: string; description?: string; createdTime?: string };
type Row = {
  event_id: string;
  drive_file_id: string;
  title: string;
  category: string | null;
  drive_url: string;
  thumbnail_url: string;
  album_id?: string | null;
  description?: string | null;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";
const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

function driveAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurado no servidor");
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return new GoogleAuth({ credentials: JSON.parse(json), scopes: ["https://www.googleapis.com/auth/drive.readonly"] });
}

async function listChildren(auth: GoogleAuth, folderId: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId.replace(/'/g, "")}' in parents and trashed=false`,
      fields: "nextPageToken,files(id,name,mimeType,description,createdTime)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const r = await auth.request<{ files: DriveFile[]; nextPageToken?: string }>({
      url: `https://www.googleapis.com/drive/v3/files?${params}`,
    });
    out.push(...r.data.files);
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  let db;
  try {
    db = serviceClient();
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
  const admin = await requireAdmin(req, res, db);
  if (!admin) return;

  const eventId = String(req.body?.eventId ?? "");
  const { data: event } = await db.from("events").select("id,drive_folder_id").eq("id", eventId).single();
  if (!event?.drive_folder_id) return res.status(400).json({ error: "Evento sem pasta do Drive configurada" });

  // rate limit: uma sincronização por vez / no mínimo 30s entre execuções
  const { data: last } = await db
    .from("drive_sync_runs").select("status,started_at").eq("event_id", eventId)
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (last && Date.now() - new Date(last.started_at).getTime() < 30_000) {
    return res.status(429).json({ error: "Aguarde 30 segundos entre sincronizações" });
  }

  const { data: run } = await db
    .from("drive_sync_runs").insert({ event_id: eventId, started_by: admin.id }).select("id").single();

  const errors: string[] = [];
  const photos: Row[] = [];
  const videos: Row[] = [];
  let found = 0;

  try {
    const auth = driveAuth();
    const root = await listChildren(auth, event.drive_folder_id);

    // pastas de topo: FOTOS e VIDEOS; subpastas = categorias
    for (const top of root.filter((f) => f.mimeType === FOLDER_MIME)) {
      const kind = /^fotos?$/i.test(top.name) ? "photo" : /^v[ií]deos?$/i.test(top.name) ? "video" : null;
      if (!kind) continue;

      const level1 = await listChildren(auth, top.id);
      const targets: { category: string | null; folderId: string | null; files: DriveFile[] }[] = [
        { category: null, folderId: null, files: level1.filter((f) => f.mimeType !== FOLDER_MIME) },
      ];
      for (const sub of level1.filter((f) => f.mimeType === FOLDER_MIME)) {
        try {
          targets.push({ category: sub.name, folderId: sub.id, files: await listChildren(auth, sub.id) });
        } catch (e) {
          errors.push(`${sub.name}: ${(e as Error).message}`);
        }
      }

      for (const t of targets) {
        let albumId: string | null = null;
        if (kind === "photo" && t.folderId && t.category) {
          const { data: album } = await db.from("albums")
            .upsert({ event_id: eventId, name: t.category, slug: slugify(t.category), drive_folder_id: t.folderId },
              { onConflict: "drive_folder_id" })
            .select("id").single();
          albumId = album?.id ?? null;
        }
        for (const f of t.files) {
          found++;
          const isImg = f.mimeType.startsWith("image/");
          const isVid = f.mimeType.startsWith("video/");
          if ((kind === "photo" && !isImg) || (kind === "video" && !isVid)) continue;
          const row: Row = {
            event_id: eventId,
            drive_file_id: f.id,
            title: f.name.replace(/\.[^.]+$/, ""),
            category: t.category,
            drive_url: `https://drive.google.com/file/d/${f.id}/view`,
            thumbnail_url: `https://drive.google.com/thumbnail?id=${f.id}&sz=w1000`,
            description: f.description ?? null,
            ...(kind === "photo" ? { album_id: albumId } : {}),
          };
          (kind === "photo" ? photos : videos).push(row);
        }
      }
    }

    // sem duplicar: novos entram com título; existentes só atualizam links/categoria/álbum
    const counts = { photos: 0, videos: 0 };
    for (const [table, rows, key] of [["photos", photos, "photos"], ["videos", videos, "videos"]] as const) {
      const ids = rows.map((r) => r.drive_file_id);
      const existing = new Set<string>();
      for (const part of chunk(ids, 200)) {
        const { data } = await db.from(table).select("drive_file_id").in("drive_file_id", part);
        data?.forEach((d) => existing.add(d.drive_file_id));
      }
      const fresh = rows.filter((r) => !existing.has(r.drive_file_id));
      const known = rows.filter((r) => existing.has(r.drive_file_id)).map(({ title: _t, description: _d, ...rest }) => rest);
      for (const part of chunk(fresh, 300)) {
        const { error } = await db.from(table).insert(part);
        if (error) errors.push(`${table}: ${error.message}`);
        else counts[key] += part.length;
      }
      for (const part of chunk(known, 300)) {
        const { error } = await db.from(table).upsert(part, { onConflict: "drive_file_id" });
        if (error) errors.push(`${table} (atualização): ${error.message}`);
      }
    }

    const result = { files_found: found, photos_imported: counts.photos, videos_imported: counts.videos, errors };
    await db.from("drive_sync_runs").update({
      ...result, status: errors.length ? "completed_with_errors" : "completed", finished_at: new Date().toISOString(),
    }).eq("id", run?.id);
    await db.from("admin_logs").insert({
      admin_id: admin.id, action: "drive_sync", entity: "event", entity_id: eventId, details: result,
    });
    return res.status(200).json(result);
  } catch (e) {
    const message = (e as Error).message;
    await db.from("drive_sync_runs").update({
      status: "failed", errors: [message], finished_at: new Date().toISOString(),
    }).eq("id", run?.id);
    return res.status(500).json({ error: message });
  }
}
