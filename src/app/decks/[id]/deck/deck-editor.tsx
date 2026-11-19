"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check, X, Pin, PinOff, ArrowUp, ArrowDown, Replace, PenLine, ExternalLink, Download, FileText, FileSpreadsheet,
  FileArchive, Presentation, Film, Image as ImageIcon, Layers, CircleCheckBig, Sparkles, Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CONTENT_TYPES } from "@/lib/briefing/options";
import { formatNL } from "@/lib/briefing/dates";
import type { DeckItemView, DeckView } from "@/lib/deck/load";
import { cn } from "@/lib/utils";
import { getAlternatives, moveItem, replaceItem, rewriteItem, setDeckDone, updateItem, updateSummary, type Alternative } from "./actions";

const FUNNEL: Record<string, string> = { tof: "TOF", mof: "MOF", bof: "BOF", retention: "Retentie" };

export function DeckEditor({ deck, rejectedCount }: { deck: DeckView; rejectedCount: number }) {
  const router = useRouter();
  const [summary, setSummary] = React.useState(deck.summary);
  const [replaceFor, setReplaceFor] = React.useState<DeckItemView | null>(null);
  const [rewriteFor, setRewriteFor] = React.useState<DeckItemView | null>(null);
  const counts = {
    approved: deck.items.filter((i) => i.status === "approved").length,
    pending: deck.items.filter((i) => i.status === "pending").length,
    rejected: deck.items.filter((i) => i.status === "rejected").length,
  };
  const done = deck.status === "done";

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="sc-heading text-3xl font-semibold tracking-tight md:text-4xl">{deck.title}</h1>
          <p className="text-sm text-muted-foreground">
            <Link href={`/clients/${deck.clientId}`} className="hover:text-foreground">{deck.clientName}</Link> · {deck.periodLabel} · ronde {deck.round}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="success">{counts.approved} goedgekeurd</Badge>
            <Badge variant="outline">{counts.pending} te beoordelen</Badge>
            {counts.rejected > 0 && <Badge variant="warning">{counts.rejected} afgekeurd</Badge>}
            {done && <Badge variant="default">Afgerond</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={done ? "outline" : "default"} onClick={async () => { await setDeckDone(deck.id, !done); toast.success(done ? "Deck weer open voor bewerken" : "Deck afgerond"); router.refresh(); }}>
            {done ? <><Undo2 /> Heropenen</> : <><CircleCheckBig /> Deck afronden</>}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Download className="size-4 text-primary" /> Exporteren</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <ExportButton deckId={deck.id} format="pptx" icon={Presentation} label="PowerPoint (voor Canva)" primary />
            <ExportButton deckId={deck.id} format="zip" icon={FileArchive} label="ZIP met alle creatives" />
            <ExportButton deckId={deck.id} format="csv" icon={FileSpreadsheet} label="CSV (Canva Bulk Create)" />
            <ExportButton deckId={deck.id} format="md" icon={FileText} label="Markdown" />
          </div>
          <p className="text-xs text-muted-foreground">Afgekeurde ads gaan niet mee. In Canva: Maken → Importeren → kies het .pptx-bestand.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="size-4 text-primary" /> Samenvatting</CardTitle></CardHeader>
        <CardContent>
          <Textarea className="min-h-28" value={summary} onChange={(e) => setSummary(e.target.value)}
            onBlur={() => summary !== deck.summary && updateSummary(deck.id, summary).then(() => toast.success("Samenvatting opgeslagen"))} />
        </CardContent>
      </Card>

      {CONTENT_TYPES.map((ct) => {
        const group = deck.items.filter((i) => i.contentType === ct.value);
        if (!group.length) return null;
        return (
          <section key={ct.value} className="space-y-3">
            <h2 className="text-xl font-semibold">{ct.label} <span className="text-sm font-normal text-muted-foreground">({group.length})</span></h2>
            {group.map((it, idx) => (
              <ItemEditor key={it.id} item={it} first={idx === 0} last={idx === group.length - 1}
                onReplace={() => setReplaceFor(it)} onRewrite={() => setRewriteFor(it)} />
            ))}
          </section>
        );
      })}

      <p className="text-sm text-muted-foreground">
        {rejectedCount} andere ads zijn bekeken maar niet gekozen. Gebruik <b>Vervangen</b> bij een ad om er een te kiezen. Wil je een heel nieuwe ronde? Ga terug naar de{" "}
        <Link href={`/decks/${deck.id}`} className="text-primary underline">briefing</Link> en klik op Opnieuw genereren: vastgepinde ads blijven staan, afgekeurde komen niet terug.
      </p>

      <ReplaceDialog item={replaceFor} onClose={() => setReplaceFor(null)} />
      <RewriteDialog item={rewriteFor} onClose={() => setRewriteFor(null)} />
    </div>
  );
}

function ExportButton({ deckId, format, icon: Icon, label, primary }: { deckId: string; format: string; icon: React.ElementType; label: string; primary?: boolean }) {
  return (
    <Button asChild variant={primary ? "default" : "outline"} size="sm">
      <a href={`/decks/${deckId}/export/${format}`} download><Icon /> {label}</a>
    </Button>
  );
}

function Media({ item: i }: { item: DeckItemView }) {
  const Icon = i.mediaType === "video" ? Film : i.mediaType === "carousel" ? Layers : ImageIcon;
  return (
    <div className="relative aspect-square shrink-0 bg-black md:w-64">
      {i.mediaType === "video" && i.media ? (
        <video src={i.media} poster={i.poster || undefined} controls muted playsInline preload="metadata" className="size-full object-contain" />
      ) : i.media || i.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={i.media || i.poster} alt={`Ad van ${i.advertiser}`} loading="lazy" className="size-full object-contain" />
      ) : <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Geen media</div>}
      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs"><Icon className="size-3" />{i.mediaType}</span>
      {!i.mediaIsLocal && i.media && <span className="absolute right-2 top-2 rounded-full bg-warning/90 px-2 py-0.5 text-xs text-black" title="Niet lokaal opgeslagen; de Facebook-link kan verlopen">niet lokaal</span>}
    </div>
  );
}

function ItemEditor({ item: i, first, last, onReplace, onRewrite }: { item: DeckItemView; first: boolean; last: boolean; onReplace: () => void; onRewrite: () => void }) {
  const router = useRouter();
  const [application, setApplication] = React.useState(i.application);
  const [whatYouSee, setWhatYouSee] = React.useState(i.whatYouSee);
  React.useEffect(() => { setApplication(i.application); setWhatYouSee(i.whatYouSee); }, [i.application, i.whatYouSee]);
  const act = (p: Promise<unknown>) => p.then(() => router.refresh());
  const save = (patch: { application?: string; whatYouSee?: string }) => updateItem(i.id, patch).then(() => { toast.success("Opgeslagen"); router.refresh(); });

  return (
    <Card className={cn("overflow-hidden transition-opacity", i.status === "rejected" && "opacity-45", i.status === "approved" && "border-primary/40")}>
      <div className="flex flex-col md:flex-row">
        <Media item={i} />
        <CardContent className="flex flex-1 flex-col gap-3 pt-4 md:pt-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1.5">
              <p className="flex items-center gap-2 font-semibold">{i.pinned && <Pin className="size-3.5 text-primary" />}{i.advertiser || "Onbekende adverteerder"}
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-normal tabular-nums text-primary">{i.scoreTotal.toFixed(1)}</span></p>
              <div className="flex flex-wrap gap-1.5">
                {i.funnelTag && <Badge variant="default">{FUNNEL[i.funnelTag] ?? i.funnelTag}</Badge>}
                {i.activeDays !== null && <Badge variant="outline">{i.activeDays} dagen</Badge>}
                {i.variantCount > 1 && <Badge variant="outline">{i.variantCount} varianten</Badge>}
                {i.startDate && <Badge variant="outline">{formatNL(i.startDate)}</Badge>}
                <Badge variant="outline">{i.country}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button size="sm" variant={i.status === "approved" ? "default" : "outline"} onClick={() => act(updateItem(i.id, { status: i.status === "approved" ? "pending" : "approved" }))}><Check /> Goed</Button>
              <Button size="sm" variant="outline" className={cn(i.status === "rejected" && "border-destructive text-destructive")} onClick={() => act(updateItem(i.id, { status: i.status === "rejected" ? "pending" : "rejected" }))}><X /> Af</Button>
              <Button size="icon-sm" variant="ghost" title={i.pinned ? "Losmaken" : "Vastpinnen (blijft staan bij opnieuw genereren)"} onClick={() => act(updateItem(i.id, { pinned: !i.pinned }))}>{i.pinned ? <PinOff /> : <Pin />}</Button>
              <Button size="icon-sm" variant="ghost" title="Omhoog" disabled={first} onClick={() => act(moveItem(i.id, -1))}><ArrowUp /></Button>
              <Button size="icon-sm" variant="ghost" title="Omlaag" disabled={last} onClick={() => act(moveItem(i.id, 1))}><ArrowDown /></Button>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Toepassing</p>
            <Textarea className="min-h-20 border-primary/30 bg-primary/5" value={application} onChange={(e) => setApplication(e.target.value)}
              onBlur={() => application !== i.application && save({ application })} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wat je ziet</p>
            <Textarea className="min-h-12 text-muted-foreground" value={whatYouSee} onChange={(e) => setWhatYouSee(e.target.value)}
              onBlur={() => whatYouSee !== i.whatYouSee && save({ whatYouSee })} />
          </div>
          {i.whyThis && <p className="text-xs text-muted-foreground">{i.whyThis}</p>}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={onRewrite}><PenLine /> Tekst herschrijven</Button>
            <Button size="sm" variant="outline" onClick={onReplace}><Replace /> Vervangen</Button>
            <a href={i.adLibraryUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm text-primary hover:underline">Ad Library <ExternalLink className="size-3.5" /></a>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function ReplaceDialog({ item, onClose }: { item: DeckItemView | null; onClose: () => void }) {
  const router = useRouter();
  const [alts, setAlts] = React.useState<Alternative[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  React.useEffect(() => {
    setAlts(null);
    if (item) getAlternatives(item.id).then((r) => setAlts(r.ok ? r.data ?? [] : []));
  }, [item]);
  const choose = async (a: Alternative) => {
    if (!item) return;
    setBusy(a.candidateId);
    const r = await replaceItem(item.id, a.candidateId);
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    if (r.warning) toast.warning(r.warning); else toast.success("Vervangen, met een nieuwe toepassingstekst");
    onClose();
    router.refresh();
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl" title="Ad vervangen" description={item ? `Kies een andere ad voor de plek van ${item.advertiser}. Zelfde contenttype staat bovenaan.` : ""}>
        {alts === null ? <p className="text-sm text-muted-foreground">Alternatieven laden…</p> : alts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen bruikbare alternatieven meer. Genereer opnieuw met een ruimere briefing.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alts.map((a) => (
              <div key={a.candidateId} className="flex flex-col overflow-hidden rounded-2xl border bg-white/[0.02]">
                <div className="aspect-square bg-black">
                  {a.mediaType === "video" && a.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.poster} alt="" className="size-full object-contain" />
                  ) : a.media ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.media} alt="" className="size-full object-contain" />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-3 text-sm">
                  <p className="font-medium">{a.advertiser} <span className="text-xs text-primary tabular-nums">{a.scoreTotal.toFixed(1)}</span></p>
                  <p className="text-xs text-muted-foreground">{a.contentTypeLabel} · {a.activeDays ?? "?"} dagen · {a.variantCount}×</p>
                  {a.whatYouSee && <p className="line-clamp-3 text-xs text-muted-foreground">{a.whatYouSee}</p>}
                  {a.reason && <p className="text-xs text-warning">Eerder niet gekozen: {a.reason}</p>}
                  <div className="mt-auto flex items-center gap-2 pt-1">
                    <Button size="sm" disabled={!!busy} onClick={() => choose(a)}>{busy === a.candidateId ? "Bezig…" : "Kies deze"}</Button>
                    <a href={a.adLibraryUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground">Ad Library</a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RewriteDialog({ item, onClose }: { item: DeckItemView | null; onClose: () => void }) {
  const router = useRouter();
  const [instruction, setInstruction] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setInstruction(""), [item]);
  const go = async () => {
    if (!item) return;
    setBusy(true);
    const r = await rewriteItem(item.id, instruction);
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Nieuwe tekst geschreven");
    onClose();
    router.refresh();
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Tekst herschrijven" description="Claude schrijft een nieuwe toepassingstekst in de tone of voice van de klant.">
        <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Optioneel: bijv. korter, noem de Ring Luna, meer urgentie, minder emoji" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annuleren</Button>
          <Button onClick={go} disabled={busy}><PenLine /> {busy ? "Schrijven…" : "Herschrijven"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
