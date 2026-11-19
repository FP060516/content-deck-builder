import { db } from "../db";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type JobLogEntry = { t: string; level: "info" | "warn" | "error"; msg: string };

export type JobView = {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  message: string;
  log: JobLogEntry[];
  result: unknown;
  error: string;
  createdAt: string;
  finishedAt: string | null;
};

const parse = <T,>(s: string, fallback: T): T => { try { return JSON.parse(s) as T; } catch { return fallback; } };

export async function enqueueJob(type: string, payload: unknown, deckId?: string) {
  return db.job.create({ data: { type, payload: JSON.stringify(payload), deckId: deckId ?? null } });
}

export async function cancelJob(id: string) {
  await db.job.updateMany({ where: { id, status: { in: ["queued", "running"] } }, data: { status: "cancelled", finishedAt: new Date(), message: "Geannuleerd" } });
}

export async function getJobView(id: string): Promise<JobView | null> {
  const j = await db.job.findUnique({ where: { id } });
  if (!j) return null;
  return {
    id: j.id, type: j.type, status: j.status as JobStatus, progress: j.progress, message: j.message,
    log: parse<JobLogEntry[]>(j.log, []), result: parse<unknown>(j.result, {}), error: j.error,
    createdAt: j.createdAt.toISOString(), finishedAt: j.finishedAt?.toISOString() ?? null,
  };
}
