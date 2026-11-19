"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { JobPanel, isActive, useJob } from "@/components/job-panel";
import type { JobView } from "@/lib/jobs/queue";
import type { GenerateResult } from "@/lib/jobs/generate";
import { cancelGenerate } from "./generate-actions";

/** Progress of the generate job under the briefing; opens the deck screen when it is done. */
export function DeckResults({ deckId, job, itemCount }: { deckId: string; job: JobView | null; itemCount: number }) {
  const router = useRouter();
  const [live] = useJob(job, (j) => (j.status === "done" ? router.push(`/decks/${deckId}/deck`) : router.refresh()));
  const result = live?.status === "done" ? (live.result as GenerateResult) : null;
  const showJob = live && (isActive(live) || live.status === "failed" || live.status === "cancelled");
  if (!showJob && !itemCount) return null;

  return (
    <section id="resultaten" className="scroll-mt-24 space-y-4 pb-24">
      <h2 className="sc-heading text-2xl font-semibold tracking-tight md:text-3xl">Resultaat</h2>
      {showJob && <JobPanel key={live.id} job={live} onCancel={() => void cancelGenerate(live.id).then(() => router.refresh())} doneLabel="Deck klaar" />}
      {result?.warnings.map((w, i) => (
        <p key={i} className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm"><Info className="mt-0.5 size-4 shrink-0 text-warning" />{w}</p>
      ))}
      {itemCount > 0 && !isActive(live) && (
        <Card className="border-primary/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
            <div className="space-y-1.5">
              <p className="font-medium">Het deck staat klaar: {itemCount} ads.</p>
              {result && (
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <Badge variant="outline">{result.searches} zoekopdrachten</Badge>
                  <Badge variant="outline">{result.found} gevonden</Badge>
                  <Badge variant="outline">{result.classified} beoordeeld</Badge>
                  <Badge variant="outline">Claude ≈ ${result.costUsd.toFixed(2)}</Badge>
                </div>
              )}
            </div>
            <Button asChild><Link href={`/decks/${deckId}/deck`}>Deck bekijken en exporteren <ArrowRight /></Link></Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
