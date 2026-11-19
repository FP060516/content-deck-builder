import path from "node:path";

export const MEDIA_ROOT = path.join(process.cwd(), "storage", "media");

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};
export const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
};

export function extFor(contentType: string | null, url: string): string {
  const t = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (EXT_BY_TYPE[t]) return EXT_BY_TYPE[t];
  const m = new URL(url).pathname.match(/\.(jpe?g|png|webp|gif|svg|mp4|mov|webm)$/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "bin";
}

/** Resolves a /media/... sub-path safely inside MEDIA_ROOT, or null if it escapes. */
export function resolveMediaPath(parts: string[]): string | null {
  const p = path.resolve(MEDIA_ROOT, ...parts);
  return p.startsWith(MEDIA_ROOT + path.sep) ? p : null;
}

export const safeSegment = (s: string) => s.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "x";
