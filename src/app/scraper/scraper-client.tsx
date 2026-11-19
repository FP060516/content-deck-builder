"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Search, Film, Image as ImageIcon, Layers } from "lucide-react";
import { JobPanel, isActive, queuedJob, useJob } from "@/components/job-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { OptionPicker } from "@/components/option-picker";
import { COUNTRIES } from "@/lib/briefing/options";
import { addDays, todayYMD, formatNL } from "@/lib/briefing/dates";
import { buildAdLibrarySearchUrl } from "@/lib/adlibrary/url";
import type { JobView } from "@/lib/jobs/queue";
import type { ScrapeResult, ScrapedAd } from "@/lib/jobs/scrape-schema";
import { startScrape, cancelScrape } from "./actions";

type Form = { q: string; country: string; mediaType: "all" | "image" | "video"; exactPhrase: boolean; from: string; to: string; max: number; useCache: boolean };

function defaultForm(): Form {
  // Default: same period last year (lesson 1), the coming 30 days shifted back one year.
  const today = todayYMD();
  const from = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  return { q: "", country: "NL", mediaType: "all", exactPhrase: false, from, to: addDays(from, 30), max: 30, useCache: true };
}

export function ScraperClient({ initialJob }: { initialJob: JobView | null }) {
  const router = useRouter();
  const [f, setF] = React.useState<Form>(defaultForm);
  const [job, setJob] = useJob(initialJob, () => router.refresh());
  const [pending, start] = React.useTransition();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  // Opening another job from "Recente zoekopdrachten" swaps the shown job, keeps the form.
  React.useEffect(() => {
    if (initialJob && initialJob.id !== job?.id) setJob(initialJob);
  }, [initialJob?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = { country: f.country, q: f.q.trim(), exactPhrase: f.exactPhrase, mediaType: f.mediaType, range: f.from && f.to ? { from: f.from, to: f.to } : undefined };
  const running = isActive(job);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await startScrape({ queries: [query], maxPerQuery: f.max, useCache: f.useCache, client: "test", folder: "scraper" });
      if (!res.ok || !res.data) return void toast.error(res.ok ? "Onbekende fout" : res.error);
      setJob(queuedJob(res.data.jobId, "scrape"));
      router.replace(`/scraper?job=${res.data.jobId}`, { scroll: false });
    });
  };

  const result = job?.status === "done" ? (job.result as ScrapeResult) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Zoekopdracht</CardTitle>
          <CardDescription>Zoek op thema, niet op merknaam. Wil je één specifiek merk? Zet dan &ldquo;exacte zin&rdquo; aan.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Zoekterm</Label>
              <Input value={f.q} onChange={(e) => set("q", e.target.value)} placeholder="Bijv. sieraden cadeau, kerstcadeau voor haar, black friday korting" />
            </div>
            <div className="space-y-1.5">
              <Label>Land</Label>
              <OptionPicker groups={[{ label: "", options: COUNTRIES }]} value={f.country} onChange={(v) => set("country", v)} />
              <p className="text-xs text-muted-foreground">Engelstalige inspiratie? Kies Ierland (IE).</p>
            </div>
            <div className="space-y-1.5">
              <Label>Media</Label>
              <div><Segmented value={f.mediaType} onChange={(v) => set("mediaType", v)} options={[{ value: "all", label: "Alles" }, { value: "image", label: "Beeld" }, { value: "video", label: "Video" }]} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Gestart vanaf</Label>
              <Input type="date" value={f.from} onChange={(e) => set("from", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Gestart tot en met</Label>
              <Input type="date" value={f.to} onChange={(e) => set("to", e.target.value)} />
              <p className="text-xs text-muted-foreground">Tip: voor een deck voor december zoek je in december van vorig jaar.</p>
            </div>
            <div className="flex flex-wrap items-center gap-6 md:col-span-2">
              <label className="flex items-center gap-2 text-sm"><Switch checked={f.exactPhrase} onCheckedChange={(v) => set("exactPhrase", v)} /> Exacte zin</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={f.useCache} onCheckedChange={(v) => set("useCache", v)} /> Cache gebruiken (24 uur)</label>
              <label className="flex items-center gap-2 text-sm">Max. ads
                <Input type="number" min={1} max={100} value={f.max} onChange={(e) => set("max", Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="h-8 w-20" />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <Button type="submit" disabled={pending || !!running || f.q.trim().length < 2}><Search /> {pending ? "Starten…" : "Zoeken"}</Button>
              {f.q.trim().length >= 2 && (
                <a href={buildAdLibrarySearchUrl(query)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  Zelf bekijken in de Ad Library <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {job && <JobPanel job={job} onCancel={() => start(async () => { await cancelScrape(job.id); })} />}
      {result && <ContactSheet result={result} />}
    </div>
  );
}

type Sort = "days" | "variants" | "recent";

function ContactSheet({ result }: { result: ScrapeResult }) {
  const [sort, setSort] = React.useState<Sort>("days");
  const ads = [...result.ads].sort((a, b) =>
    sort === "days" ? (b.activeDays ?? 0) - (a.activeDays ?? 0)
    : sort === "variants" ? b.variantCount - a.variantCount
    : (b.startDate ?? "").localeCompare(a.startDate ?? ""));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Contactsheet</h2>
          <p className="text-sm text-muted-foreground">{result.ads.length} ads{result.fromCache ? ` · ${result.fromCache} uit de cache` : ""}. Lang lopende ads en ads met veel varianten zijn vaak winnaars.</p>
        </div>
        <Segmented value={sort} onChange={setSort} options={[{ value: "days", label: "Langst actief" }, { value: "variants", label: "Meeste varianten" }, { value: "recent", label: "Nieuwste" }]} />
      </div>
      {result.warnings.map((w, i) => <p key={i} className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">{w}</p>)}
      {ads.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Geen ads gevonden.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ads.map((a) => <AdTile key={a.adId} ad={a} />)}
        </div>
      )}
    </div>
  );
}

function AdTile({ ad }: { ad: ScrapedAd }) {
  const src = ad.mediaUrlLocal || ad.mediaUrls[0] || "";
  const poster = ad.posterUrlLocal || ad.posterUrl || undefined;
  const isVideo = ad.mediaType === "video" || /\.(mp4|mov|webm)$/i.test(src);
  const Icon = ad.mediaType === "video" ? Film : ad.mediaType === "carousel" ? Layers : ImageIcon;
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative aspect-square bg-black">
        {src ? (
          isVideo ? <video src={src} poster={poster} controls muted playsInline preload="metadata" className="size-full object-contain" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={src} alt={`Ad van ${ad.advertiser}`} loading="lazy" className="size-full object-contain" />
        ) : <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Geen media</div>}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs"><Icon className="size-3" />{ad.mediaType}</span>
        {!ad.mediaUrlLocal && src && <span className="absolute right-2 top-2 rounded-full bg-warning/90 px-2 py-0.5 text-xs text-black">niet lokaal</span>}
      </div>
      <CardContent className="flex flex-1 flex-col gap-2 pt-4">
        <p className="font-semibold leading-tight">{ad.advertiser || "Onbekende adverteerder"}</p>
        <div className="flex flex-wrap gap-1.5">
          {ad.isActive !== null && <Badge variant={ad.isActive ? "success" : "outline"}>{ad.isActive ? "Actief" : "Inactief"}</Badge>}
          {ad.activeDays !== null && <Badge variant="outline">{ad.activeDays} dagen</Badge>}
          {ad.variantCount > 1 && <Badge variant="default">{ad.variantCount} varianten</Badge>}
          {ad.startDate && <Badge variant="outline">sinds {formatNL(ad.startDate)}</Badge>}
        </div>
        {ad.bodyText && <p className="line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{ad.bodyText}</p>}
        <a href={ad.adLibraryUrl} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-1 pt-1 text-sm text-primary hover:underline">
          Bekijk in Ad Library <ExternalLink className="size-3.5" />
        </a>
      </CardContent>
    </Card>
  );
}
