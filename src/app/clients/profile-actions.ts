"use server";
import { enqueueJob, cancelJob } from "@/lib/jobs/queue";
import { ProfilePayloadSchema } from "@/lib/jobs/profile";

export async function startProfileJob(input: unknown): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const p = ProfilePayloadSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Ongeldige invoer" };
  if (p.data.doWebsite && !p.data.websiteUrl && p.data.doGap && !p.data.adLibraryPage)
    return { ok: false, error: "Vul eerst een website-URL of een pagina-naam in de Ad Library in." };
  const job = await enqueueJob("profile", p.data);
  return { ok: true, jobId: job.id };
}

export async function cancelProfileJob(id: string) {
  await cancelJob(id);
}
