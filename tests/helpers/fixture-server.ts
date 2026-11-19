import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AddressInfo } from "node:net";

const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".txt": "text/plain" };

/** Serves a fixture folder. `routes` maps URL paths to file names (default: the basename). */
export async function startFixtureServer(dir: string, routes: Record<string, string> = {}) {
  const server = http.createServer(async (req, res) => {
    const p = (req.url ?? "/").split("?")[0];
    const name = routes[p] ?? (path.basename(p) || "index.html");
    try {
      const body = await readFile(path.join(dir, name));
      res.writeHead(200, { "Content-Type": TYPES[path.extname(name)] ?? "application/octet-stream" }).end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, close: () => new Promise<void>((r) => server.close(() => r())) };
}
