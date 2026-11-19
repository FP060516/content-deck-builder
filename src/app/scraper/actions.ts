"use server";
import { revalidatePath } from "next/cache";
import { enqueueJob, cancelJob } from "@/lib/jobs/queue";
import { ScrapePayloadSchema } from "@/lib/jobs/scrape-schema";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function startScrape(input: unknown): Promise<Result<{ jobId: string }>> {
  const parsed = ScrapePayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const job = await enqueueJob("scrape", parsed.data, parsed.data.deckId);
  revalidatePath("/scraper");
  return { ok: true, data: { jobId: job.id } };
}

export async function cancelScrape(jobId: string) {
  await cancelJob(jobId);
  revalidatePath("/scraper");
}
