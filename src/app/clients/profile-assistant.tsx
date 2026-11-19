"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Wand2, Check, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JobPanel, isActive, queuedJob, useJob } from "@/components/job-panel";
import type { ClientInput } from "@/lib/client-profile";
import { buildPatch, type ProfilePatch, type Section } from "@/lib/profile/patch";
export type { ProfilePatch };
import type { ProfileJobResult } from "@/lib/jobs/profile";
import { cn } from "@/lib/utils";
import { cancelProfileJob, startProfileJob } from "./profile-actions";

const POS: Record<string, string> = { budget: "Budget", mid: "Mid", premium: "Premium", luxury: "Luxe" };

export function ProfileAssistant({ client, onApply }: { client: ClientInput; onApply: (patch: ProfilePatch) => void }) {
  const [doWebsite, setDoWebsite] = React.useState(true);
  const [doGap, setDoGap] = React.useState(true);
  const [pending, start] = React.useTransition();
  const [job, setJob] = useJob(null);
  const result = job?.status === "done" ? (job.result as ProfileJobResult) : null;

  const run = () =>
    start(async () => {
      const profileHint = [
        `Naam: ${client.name}`, client.industry && `Branche: ${client.industry}`, `Positionering: ${client.positioning}`,
        client.toneSummary && `Tone of voice: ${client.toneSummary}`, client.usps.length ? `USP's: ${client.usps.join("; ")}` : "",
        client.products.length ? `Producten: ${client.products.slice(0, 15).map((p) => p.name).join(", ")}` : "",
      ].filter(Boolean).join("\n");
      const res = await startProfileJob({
        clientName: client.name, websiteUrl: client.websiteUrl, adLibraryPage: client.adLibraryPage, country: client.country,
        profileHint: client.toneSummary ? profileHint : "", doWebsite, doGap,
      });
      if (!res.ok) return void toast.error(res.error);
      setJob(queuedJob(res.jobId, "profile"));
    });

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wand2 className="size-4 text-primary" /> Profiel automatisch invullen</CardTitle>
        <CardDescription>
          Leest de website (tekst en producten) en de eigen ads van de klant in de Ad Library. Claude doet daarna een voorstel. Jij kiest wat je overneemt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <label className="flex items-center gap-2"><Switch checked={doWebsite} onCheckedChange={setDoWebsite} /> Website analyseren {!client.websiteUrl && <span className="text-muted-foreground">(vul de URL in)</span>}</label>
          <label className="flex items-center gap-2"><Switch checked={doGap} onCheckedChange={setDoGap} /> Eigen ads + gat-analyse {!client.adLibraryPage && <span className="text-muted-foreground">(vul de pagina-naam in)</span>}</label>
        </div>
        <Button type="button" onClick={run} disabled={pending || isActive(job) || (!doWebsite && !doGap)}><Wand2 /> {pending ? "Starten…" : "Analyseren"}</Button>
        {job && <JobPanel job={job} onCancel={() => void cancelProfileJob(job.id)} doneLabel="Analyse klaar" />}
        {result && <ProposalReview result={result} client={client} onApply={(p) => { onApply(p); toast.success("Overgenomen in het formulier. Vergeet niet op te slaan."); }} />}
      </CardContent>
    </Card>
  );
}

function ProposalReview({ result: r, client, onApply }: { result: ProfileJobResult; client: ClientInput; onApply: (p: ProfilePatch) => void }) {
  const pr = r.proposal;
  const newProducts = r.products.filter((p) => !client.products.some((c) => c.name.toLowerCase() === p.name.toLowerCase()));
  const available: Section[] = [
    ...(pr ? (["basics", "tone", "examples", "usps", "forbidden", "competitors"] as Section[]) : []),
    ...(newProducts.length ? (["products"] as Section[]) : []),
    ...(r.gap?.notes ? (["gap"] as Section[]) : []),
  ];
  const [pick, setPick] = React.useState<Set<Section>>(new Set(available));
  const toggle = (s: Section) => setPick((p) => { const n = new Set(p); if (n.has(s)) n.delete(s); else n.add(s); return n; });

  const Row = ({ id, title, children }: { id: Section; title: string; children: React.ReactNode }) => (
    <label className={cn("flex cursor-pointer gap-3 rounded-2xl border p-3 transition-colors", pick.has(id) ? "border-primary/40 bg-primary/5" : "opacity-60")}>
      <input type="checkbox" className="mt-1 accent-[#00df82]" checked={pick.has(id)} onChange={() => toggle(id)} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </label>
  );
  const List = ({ items }: { items: string[] }) => items.length ? <ul className="list-disc space-y-0.5 pl-4">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <span>Niets gevonden.</span>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        {r.site && <Badge variant="outline">{r.site.pagesRead} pagina&apos;s · {r.site.productsFound} producten · {r.site.platform}</Badge>}
        {r.gap && <Badge variant="outline">{r.gap.adCount} eigen ads</Badge>}
        {r.costUsd > 0 && <Badge variant="outline">Claude ≈ ${r.costUsd.toFixed(3)}</Badge>}
      </div>
      {r.warnings.map((w, i) => (
        <p key={i} className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>{w} {w.includes("Instellingen") && <Link href="/settings" className="text-primary underline">Naar Instellingen</Link>}</span>
        </p>
      ))}

      {pr && (
        <>
          <Row id="basics" title="Branche, positionering, taal en land">
            {pr.industry || "–"} · {POS[pr.positioning]} · {pr.language} · {pr.country}
          </Row>
          <Row id="tone" title="Tone of voice (vervangt de huidige samenvatting)">{pr.toneSummary}</Row>
          <Row id="examples" title="Voorbeeldzinnen van de site (worden toegevoegd)"><List items={pr.toneExamples} /></Row>
          <Row id="usps" title="USP's (worden toegevoegd)"><List items={pr.usps} /></Row>
          <Row id="forbidden" title="Niet beloven (worden toegevoegd)"><List items={pr.forbiddenClaims} /></Row>
          <Row id="competitors" title="Concurrenten (suggestie van Claude, worden toegevoegd)">{pr.competitors.join(", ") || "Geen suggesties."}</Row>
          {pr.notes.length > 0 && <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm"><p className="mb-1 font-medium">Om te controleren</p><List items={pr.notes} /></div>}
        </>
      )}
      {newProducts.length > 0 && (
        <Row id="products" title={`${newProducts.length} nieuwe producten toevoegen aan de catalogus`}>
          {newProducts.slice(0, 8).map((p) => p.name).join(", ")}{newProducts.length > 8 ? ` en ${newProducts.length - 8} meer` : ""}
        </Row>
      )}
      {r.gap && r.gap.ads.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Eigen ads in de Ad Library</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {r.gap.ads.slice(0, 16).map((a) => (
              <a key={a.adId} href={a.adLibraryUrl} target="_blank" rel="noreferrer" className="group relative size-24 shrink-0 overflow-hidden rounded-xl border bg-black" title={a.bodyText.slice(0, 140)}>
                {a.mediaUrlLocal ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.mediaUrlLocal} alt="" className="size-full object-cover" />
                ) : <span className="flex size-full items-center justify-center text-xs text-muted-foreground">{a.mediaType}</span>}
                <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-[10px]">{a.activeDays ?? "?"} d · {a.variantCount}×</span>
                <ExternalLink className="absolute right-1 top-1 size-3 opacity-0 group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </div>
      )}
      {r.gap?.notes && <Row id="gap" title="Gat-analyse (vervangt de huidige notities)"><pre className="whitespace-pre-wrap font-sans">{r.gap.notes}</pre></Row>}

      {available.length > 0 ? (
        <Button type="button" onClick={() => onApply(buildPatch(r, client, pick))} disabled={pick.size === 0}><Check /> Overnemen in formulier</Button>
      ) : (
        <p className="text-sm text-muted-foreground">Er is niets om over te nemen.</p>
      )}
    </div>
  );
}
