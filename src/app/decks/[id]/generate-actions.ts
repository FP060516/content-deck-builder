"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { cancelJob, enqueueJob } from "@/lib/jobs/queue";
import { hasApiKey } from "@/lib/llm/claude";

export async function startGenerate(deckId: string): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  if (!(await hasApiKey())) return { ok: false, error: "Vul eerst je Anthropic API-sleutel in bij Instellingen." };
  const running = await db.job.findFirst({ where: { deckId, type: "generate", status: { in: ["queued", "running"] } } });
  if (running) return { ok: true, jobId: running.id };
  const job = await enqueueJob("generate", { deckId }, deckId);
  await db.deck.update({ where: { id: deckId }, data: { status: "generating" } });
  revalidatePath(`/decks/${deckId}`);
  return { ok: true, jobId: job.id };
}

export async function cancelGenerate(jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId } });
  await cancelJob(jobId);
  if (job?.deckId) {
    const items = await db.deckItem.count({ where: { deckId: job.deckId } });
    await db.deck.update({ where: { id: job.deckId }, data: { status: items ? "review" : "draft" } });
    revalidatePath(`/decks/${job.deckId}`);
  }
}
