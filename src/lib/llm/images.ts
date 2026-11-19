import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { MEDIA_ROOT } from "../media/storage";
import type { ImageInput } from "./claude";

const TYPES: Record<string, ImageInput["mediaType"]> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
const MAX_BYTES = 4_500_000;

/** Reads a downloaded creative (/media/... URL) as an image block for Claude, or null if unusable. */
export async function imageFromLocal(localUrl: string, label: string): Promise<ImageInput | null> {
  if (!localUrl.startsWith("/media/")) return null;
  const file = path.join(MEDIA_ROOT, ...localUrl.slice("/media/".length).split("/"));
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return null;
  const info = await stat(file).catch(() => null);
  if (!info || info.size > MAX_BYTES) return null;
  return { mediaType: type, base64: (await readFile(file)).toString("base64"), label };
}
