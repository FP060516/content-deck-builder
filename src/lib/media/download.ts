import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MEDIA_ROOT, extFor, safeSegment } from "./storage";

const MAX_BYTES = 80 * 1024 * 1024;

export type Downloaded = { localUrl: string; hash: string; bytes: number };

/**
 * Downloads one media URL right away (fbcdn links expire after a few days, lesson 4) to
 * storage/media/<client>/<folder>/<name>.<ext>. Returns the /media/... URL served by the app.
 */
export async function downloadMedia(url: string, client: string, folder: string, name: string, signal?: AbortSignal): Promise<Downloaded> {
  const res = await fetch(url, { signal, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error("Bestand te groot");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("Bestand te groot");
  const ext = extFor(res.headers.get("content-type"), url);
  const segs = [safeSegment(client), safeSegment(folder)];
  const dir = path.join(MEDIA_ROOT, ...segs);
  await mkdir(dir, { recursive: true });
  const file = `${safeSegment(name)}.${ext}`;
  await writeFile(path.join(dir, file), buf);
  return { localUrl: `/media/${segs.join("/")}/${file}`, hash: createHash("sha1").update(buf).digest("hex"), bytes: buf.length };
}
