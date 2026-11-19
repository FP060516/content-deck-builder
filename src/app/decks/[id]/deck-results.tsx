"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Sparkles, Info, Film, Image as ImageIcon, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobPanel, isActive, useJob } from "@/components/job-panel";
import { CONTENT_TYPES } from "@/lib/briefing/options";
import { formatNL } from "@/lib/briefing/dates";
import type { JobView } from "@/lib/jobs/queue";
import type { GenerateResult } from "@/lib/jobs/generate";
import { cancelGenerate } from "./generate-actions";

export type ResultItem = {
  id: string;
  contentType: string;
  whatYouSee: string;
  application: string;
  whyThis: string;
  funnelTag: string;
  ad: {
    adId: string; advertiser: string; mediaType: string; bodyText: string; startDate: string | null; activeDays: number | null;
    variantCount: number; country: string; sourceQuery: string; media: string; poster: string; scoreTotal: number; adLibraryUrl: string;
  };
};
export type RejectedAd = { adId: string; advertiser: string; reason: string; scoreTotal: number; adLibraryUrl: string };

const FUNNEL: Record<string, string> = { tof: "TOF", mof: "MOF", bof: "BOF", retention: "Retentie" };

export function DeckResults({ job, summary, items, rejected }: { job: JobView | null; summary: string; items: ResultItem[]; rejected: RejectedAd[] }) {
  const router = useRouter();
  const [live] = useJob(job, () => router.refresh());
  const result = live?.status === "done" ? (live.result as GenerateResult) : null;
  const showJob = live && (isActive(live) || live.status === "failed" || live.status === "cancelled");

  if (!showJob && !items.length) return null;
  return (
    <section id="resultaten" className="scroll-mt-24 space-y-6 pb-24">
      <div className="space-y-2">
        <h2 className="sc-heading text-2xl font-semibold tracking-tight md:text-3xl">Resultaat</h2>
        {result && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{result.searches} zoekopdrachten</Badge>
            <Badge variant="outline">{result.found} ads gevonden</Badge>
            <Badge variant="outline">{result.classified} beoordeeld</Badge>
            <Badge variant="success">{result.selected} in het deck</Badge>
            <Badge variant="outline">Claude ≈ ${result.costUsd.toFixed(2)}</Badge>
          </div>
        )}
      </div>

      {showJob && <JobPanel key={live.id} job={live} onCancel={() => void cancelGenerate(live.id).then(() => router.refresh())} doneLabel="Deck klaar" />}
      {result?.warnings.map((w, i) => (
        <p key={i} className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm"><Info className="mt-0.5 size-4 shrink-0 text-warning" />{w}</p>
      ))}

      {summary && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Samenvatting</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">{summary.split("\n").map((l) => l.replace(/^-\s*/, "")).filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}</ul>
          </CardContent>
        </Card>
      )}

      {CONTENT_TYPES.map((ct) => {
        const group = items.filter((i) => i.contentType === ct.value);
        if (!group.length) return null;
        return (
          <div key={ct.value} className="space-y-3">
            <h3 className="text-lg font-semibold">{ct.label} <span className="text-sm font-normal text-muted-foreground">({group.length})</span></h3>
            <div className="grid gap-4 md:grid-cols-2">
              {group.map((it) => <ItemCard key={it.id} item={it} />)}
            </div>
          </div>
        );
      })}

      {rejected.length > 0 && (
        <details className="rounded-3xl border bg-card/60 p-5 text-sm">
          <summary className="cursor-pointer select-none font-medium">Niet geselecteerd ({rejected.length}): waarom niet?</summary>
          <ul className="mt-3 max-h-96 space-y-1 overflow-auto">
            {rejected.map((r) => (
              <li key={r.adId} className="flex flex-wrap items-baseline gap-x-2 text-muted-foreground">
                <a href={r.adLibraryUrl} target="_blank" rel="noreferrer" className="text-foreground hover:text-primary">{r.advertiser || r.adId}</a>
                {r.scoreTotal > 0 && <span className="tabular-nums">· {r.scoreTotal.toFixed(1)}</span>}
                <span>· {r.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function ItemCard({ item: it }: { item: ResultItem }) {
  const a = it.ad;
  const isVideo = a.mediaType === "video";
  const Icon = isVideo ? Film : a.mediaType === "carousel" ? Layers : ImageIcon;
  return (
    <Card className="flex flex-col overflow-hidden sm:flex-row">
      <div className="relative aspect-square shrink-0 bg-black sm:w-56">
        {isVideo && a.media ? (
          <video src={a.media} poster={a.poster || undefined} controls muted playsInline preload="metadata" className="size-full object-contain" />
        ) : a.media || a.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.media || a.poster} alt={`Ad van ${a.advertiser}`} loading="lazy" className="size-full object-contain" />
        ) : <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Geen media</div>}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs"><Icon className="size-3" />{a.mediaType}</span>
      </div>
      <CardContent className="flex flex-1 flex-col gap-2 pt-4 sm:pt-5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-tight">{a.advertiser || "Onbekende adverteerder"}</p>
          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs tabular-nums text-primary" title="Totaalscore (relevantie, winnaarssignalen, gat, kwaliteit)">{a.scoreTotal.toFixed(1)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {it.funnelTag && <Badge variant="default">{FUNNEL[it.funnelTag] ?? it.funnelTag}</Badge>}
          {a.activeDays !== null && <Badge variant="outline">{a.activeDays} dagen</Badge>}
          {a.variantCount > 1 && <Badge variant="outline">{a.variantCount} varianten</Badge>}
          {a.startDate && <Badge variant="outline">{formatNL(a.startDate)}</Badge>}
          <Badge variant="outline">{a.country}</Badge>
        </div>
        {it.whatYouSee && <p className="text-sm text-muted-foreground">{it.whatYouSee}</p>}
        {it.application && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-primary">Toepassing</p>
            {it.application}
          </div>
        )}
        {it.whyThis && <p className="text-xs text-muted-foreground">{it.whyThis}</p>}
        <a href={a.adLibraryUrl} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-1 pt-1 text-sm text-primary hover:underline">
          Bekijk in Ad Library <ExternalLink className="size-3.5" />
        </a>
      </CardContent>
    </Card>
  );
}
