import { getJobView } from "@/lib/jobs/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-Sent Events: pushes the job state whenever it changes, closes when the job ends. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let last = "";
      let closed = false;
      req.signal.addEventListener("abort", () => { closed = true; });
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      while (!closed) {
        const job = await getJobView(id);
        if (!job) { send("error", { error: "Taak niet gevonden" }); break; }
        const snap = JSON.stringify([job.status, job.progress, job.message, job.log.length]);
        if (snap !== last) { send("job", job); last = snap; }
        if (["done", "failed", "cancelled"].includes(job.status)) break;
        await new Promise((r) => setTimeout(r, 700));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
