import Link from "next/link";
import { db } from "@/lib/db";
import { getJobView } from "@/lib/jobs/queue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScraperClient } from "./scraper-client";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "success" | "warning" }> = {
  queued: { label: "In de wachtrij", variant: "secondary" },
  running: { label: "Bezig", variant: "default" },
  done: { label: "Klaar", variant: "success" },
  failed: { label: "Mislukt", variant: "warning" },
  cancelled: { label: "Geannuleerd", variant: "outline" },
};

export default async function ScraperPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { job: jobId } = await searchParams;
  const [recent, initialJob] = await Promise.all([
    db.job.findMany({ where: { type: "scrape" }, orderBy: { createdAt: "desc" }, take: 12 }),
    jobId ? getJobView(jobId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/90"><span className="size-1.5 rounded-full bg-primary" />Fase 2 · Ad Library-scraper</span>
        <h1 className="sc-heading text-3xl font-semibold tracking-tight md:text-4xl">Scraper</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Test hier het ophalen van ads uit de openbare Meta Ad Library. De creatives worden meteen gedownload en lokaal opgeslagen, want de links van Facebook verlopen na een paar dagen.
          Later doet de Genereer-knop dit automatisch op basis van de briefing.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <ScraperClient initialJob={initialJob} />
        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">Recente zoekopdrachten</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {recent.length === 0 && <p className="text-sm text-muted-foreground">Nog geen zoekopdrachten.</p>}
            {recent.map((j) => {
              const q = (() => { try { return JSON.parse(j.payload).queries?.[0]?.q as string; } catch { return "?"; } })();
              const s = STATUS[j.status] ?? STATUS.queued;
              return (
                <Link key={j.id} href={`/scraper?job=${j.id}`} className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-sm hover:bg-white/5 ${j.id === jobId ? "bg-white/5" : ""}`}>
                  <span className="min-w-0">
                    <span className="block truncate">{q}</span>
                    <span className="block text-xs text-muted-foreground">{j.createdAt.toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </span>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
