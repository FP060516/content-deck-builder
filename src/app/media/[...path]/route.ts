import { stat, open } from "node:fs/promises";
import path from "node:path";
import { resolveMediaPath, TYPE_BY_EXT } from "@/lib/media/storage";

export const runtime = "nodejs";

/** Serves downloaded creatives from storage/media, with Range support so videos can seek. */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const file = resolveMediaPath((await params).path);
  if (!file) return new Response("Not found", { status: 404 });
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return new Response("Not found", { status: 404 });
  const type = TYPE_BY_EXT[path.extname(file).slice(1).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=86400" };

  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  let start = 0;
  let end = info.size - 1;
  let status = 200;
  if (range) {
    start = range[1] ? +range[1] : Math.max(0, info.size - +range[2]);
    end = range[1] && range[2] ? Math.min(+range[2], end) : end;
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
  }
  headers["Content-Length"] = String(end - start + 1);
  const fh = await open(file);
  const buf = Buffer.alloc(end - start + 1);
  await fh.read(buf, 0, buf.length, start);
  await fh.close();
  return new Response(buf, { status, headers });
}
