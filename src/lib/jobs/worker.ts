import { db } from "../db";
import type { JobLogEntry } from "./queue";
import { runScrapeJob } from "./scrape";
import { runProfileJob } from "./profile";
import { runGenerateJob } from "./generate";

export type JobContext = {
  id: string;
  payload: unknown;
  signal: AbortSignal;
  progress: (pct: number, message?: string) => Promise<void>;
  log: (msg: string, level?: JobLogEntry["level"]) => Promise<void>;
};

type Handler = (ctx: JobContext) => Promise<unknown>;
const HANDLERS: Record<string, Handler> = { scrape: runScrapeJob, profile: runProfileJob, generate: runGenerateJob };

const POLL_MS = 1000;
const MAX_LOG = 300;

const g = globalThis as unknown as { __cdbWorker?: { started: boolean } };

/** Starts the single in-process worker (idempotent). One job at a time keeps the pace low. */
export function startWorker() {
  if (g.__cdbWorker?.started) return;
  g.__cdbWorker = { started: true };
  void (async () => {
    await db.job.updateMany({ where: { status: "running" }, data: { status: "failed", error: "De app is herstart terwijl deze taak liep.", finishedAt: new Date() } }).catch(() => {});
    for (;;) {
      try {
        const ran = await tick();
        if (!ran) await new Promise((r) => setTimeout(r, POLL_MS));
      } catch (e) {
        console.error("[worker]", e);
        await new Promise((r) => setTimeout(r, POLL_MS * 3));
      }
    }
  })();
}

async function tick(): Promise<boolean> {
  const next = await db.job.findFirst({ where: { status: "queued" }, orderBy: { createdAt: "asc" } });
  if (!next) return false;
  const claimed = await db.job.updateMany({ where: { id: next.id, status: "queued" }, data: { status: "running", startedAt: new Date(), progress: 0 } });
  if (claimed.count === 0) return true;

  const controller = new AbortController();
  const watch = setInterval(async () => {
    const j = await db.job.findUnique({ where: { id: next.id }, select: { status: true } }).catch(() => null);
    if (j?.status === "cancelled") controller.abort();
  }, 1500);

  const logs: JobLogEntry[] = [];
  const ctx: JobContext = {
    id: next.id,
    payload: JSON.parse(next.payload),
    signal: controller.signal,
    progress: async (pct, message) => {
      await db.job.update({ where: { id: next.id }, data: { progress: Math.round(Math.max(0, Math.min(100, pct))), ...(message !== undefined ? { message } : {}) } });
    },
    log: async (msg, level = "info") => {
      logs.push({ t: new Date().toISOString(), level, msg });
      if (logs.length > MAX_LOG) logs.splice(0, logs.length - MAX_LOG);
      await db.job.update({ where: { id: next.id }, data: { log: JSON.stringify(logs), message: msg } });
    },
  };

  try {
    const handler = HANDLERS[next.type];
    if (!handler) throw new Error(`Onbekend taaktype: ${next.type}`);
    const result = await handler(ctx);
    await db.job.updateMany({ where: { id: next.id, status: "running" }, data: { status: "done", progress: 100, result: JSON.stringify(result ?? {}), finishedAt: new Date() } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.job.updateMany({ where: { id: next.id, status: "running" }, data: { status: "failed", error: msg, message: msg, finishedAt: new Date() } });
  } finally {
    clearInterval(watch);
  }
  return true;
}
