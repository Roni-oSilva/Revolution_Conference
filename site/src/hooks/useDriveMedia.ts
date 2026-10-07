import { useEffect, useState } from "react";
import type { HaloReelItem } from "@/components/ui/halo-reel";

const KEY = import.meta.env.VITE_DRIVE_API_KEY as string | undefined;
const FOLDER = import.meta.env.VITE_DRIVE_FOLDER_ID as string | undefined;

type DriveFile = { id: string; name: string; mimeType: string };

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Lê fotos e vídeos de uma pasta pública do Google Drive e devolve em ordem aleatória.
 *  Sem VITE_DRIVE_API_KEY / VITE_DRIVE_FOLDER_ID usa `fallback`. */
export function useDriveMedia(fallback: HaloReelItem[]) {
  const [items, setItems] = useState<HaloReelItem[]>(fallback);

  useEffect(() => {
    if (!KEY || !FOLDER) return;
    const ctrl = new AbortController();
    const q = encodeURIComponent(`'${FOLDER}' in parents and trashed=false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=200&fields=files(id,name,mimeType)&key=${KEY}`;

    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { files: DriveFile[] }) => {
        const media = data.files
          .filter((f) => f.mimeType.startsWith("image/") || f.mimeType.startsWith("video/"))
          .map<HaloReelItem>((f) => {
            const thumb = `https://drive.google.com/thumbnail?id=${f.id}&sz=w800`;
            return f.mimeType.startsWith("video/")
              ? {
                  src: thumb,
                  video: `https://drive.google.com/uc?export=download&id=${f.id}`,
                  alt: f.name,
                }
              : { src: thumb, alt: f.name };
          });
        if (media.length) setItems(shuffle(media));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  return items;
}
