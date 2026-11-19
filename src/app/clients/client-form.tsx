"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OptionPicker } from "@/components/option-picker";
import { ChipInput } from "@/components/chip-input";
import { Segmented } from "@/components/ui/segmented";
import { COUNTRIES, INDUSTRIES, LANGUAGES, POSITIONINGS } from "@/lib/briefing/options";
import type { ClientInput, Product } from "@/lib/client-profile";
import { saveClient } from "../actions";
import { ProfileAssistant, type ProfilePatch } from "./profile-assistant";

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ClientForm({ id, initial }: { id: string | null; initial: ClientInput }) {
  const router = useRouter();
  const [c, setC] = React.useState<ClientInput>(initial);
  const [pending, start] = React.useTransition();
  // Textareas keep raw text so blank lines while typing don't vanish.
  const [raw, setRaw] = React.useState({
    toneExamples: initial.toneExamples.join("\n"),
    usps: initial.usps.join("\n"),
    forbiddenClaims: initial.forbiddenClaims.join("\n"),
  });
  const set = <K extends keyof ClientInput>(k: K, v: ClientInput[K]) => setC((p) => ({ ...p, [k]: v }));
  const setProduct = (i: number, patch: Partial<Product>) =>
    set("products", c.products.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  // Proposal from the profile assistant: lists also update the raw textarea text.
  const applyPatch = (patch: ProfilePatch) => {
    setC((p) => ({ ...p, ...patch }));
    setRaw((r) => ({
      toneExamples: patch.toneExamples ? patch.toneExamples.join("\n") : r.toneExamples,
      usps: patch.usps ? patch.usps.join("\n") : r.usps,
      forbiddenClaims: patch.forbiddenClaims ? patch.forbiddenClaims.join("\n") : r.forbiddenClaims,
    }));
  };
  // The assistant should see what is typed in the textareas, not the last saved lists.
  const current: ClientInput = { ...c, toneExamples: lines(raw.toneExamples), usps: lines(raw.usps), forbiddenClaims: lines(raw.forbiddenClaims) };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: ClientInput = {
      ...c,
      toneExamples: lines(raw.toneExamples),
      usps: lines(raw.usps),
      forbiddenClaims: lines(raw.forbiddenClaims),
      products: c.products.filter((p) => p.name.trim()),
    };
    start(async () => {
      const res = await saveClient(id, payload);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Klant opgeslagen");
      if (!id && res.data) router.push(`/clients/${res.data.id}`);
      else router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basis</CardTitle>
          <CardDescription>Wie is de klant en waar verkopen ze?</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Naam *"><Input value={c.name} onChange={(e) => set("name", e.target.value)} placeholder="Bijv. Goudsmid & Co" required /></Field>
          <Field label="Website-URL" hint="Gebruik daarna “Profiel automatisch invullen” hieronder.">
            <Input value={c.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Branche">
            <OptionPicker groups={[{ label: "", options: INDUSTRIES }]} value={c.industry || undefined} onChange={(v) => set("industry", v)} placeholder="Kies een branche" />
          </Field>
          <Field label="Pagina-naam in de Ad Library" hint="Exact zoals de adverteerder in de Ad Library heet. Nodig voor de gat-analyse.">
            <Input value={c.adLibraryPage} onChange={(e) => set("adLibraryPage", e.target.value)} />
          </Field>
          <Field label="Land">
            <OptionPicker groups={[{ label: "", options: COUNTRIES }]} value={c.country} onChange={(v) => set("country", v)} />
          </Field>
          <Field label="Taal">
            <OptionPicker groups={[{ label: "", options: LANGUAGES }]} value={c.language} onChange={(v) => set("language", v)} />
          </Field>
          <Field label="Positionering">
            <Segmented value={c.positioning} onChange={(v) => set("positioning", v as ClientInput["positioning"])} options={POSITIONINGS} />
          </Field>
        </CardContent>
      </Card>

      <ProfileAssistant client={current} onApply={applyPatch} />

      <Card>
        <CardHeader>
          <CardTitle>Tone of voice & merk</CardTitle>
          <CardDescription>Dit bepaalt hoe de toepassingsteksten klinken en wat ze nooit mogen beloven.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Samenvatting tone of voice">
            <Textarea value={c.toneSummary} onChange={(e) => set("toneSummary", e.target.value)} placeholder="Warm, persoonlijk, je-vorm, een tikje speels…" />
          </Field>
          <Field label="Voorbeeldzinnen" hint="Eén per regel.">
            <Textarea value={raw.toneExamples} onChange={(e) => setRaw((r) => ({ ...r, toneExamples: e.target.value }))} />
          </Field>
          <Field label="USP's" hint="Eén per regel.">
            <Textarea value={raw.usps} onChange={(e) => setRaw((r) => ({ ...r, usps: e.target.value }))} placeholder={"Gratis graveren\n14k goud\nVoor 23:00 besteld, morgen in huis"} />
          </Field>
          <Field label="Verboden woorden of claims" hint="Eén per regel. Komen nooit in de toepassingsteksten.">
            <Textarea value={raw.forbiddenClaims} onChange={(e) => setRaw((r) => ({ ...r, forbiddenClaims: e.target.value }))} placeholder={"'goedkoop'\nGeen 'levenslange garantie'"} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Concurrenten" hint="Enter of komma voegt toe. Wordt standaard ingevuld in nieuwe briefings.">
              <ChipInput value={c.competitors} onChange={(v) => set("competitors", v)} placeholder="Merknaam…" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div className="space-y-1">
            <CardTitle>Productcatalogus</CardTitle>
            <CardDescription>Echte productnamen voor de toepassingsteksten. Automatisch op te halen via de analyse hierboven, en met de hand aan te passen.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => set("products", [...c.products, { name: "", category: "", price: "", url: "" }])}>
            <Plus /> Product
          </Button>
        </CardHeader>
        <CardContent>
          {c.products.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nog geen producten.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[2fr_1fr_0.7fr_2fr_auto] gap-2 px-1 text-xs font-medium text-muted-foreground">
                <span>Naam</span><span>Categorie</span><span>Prijs</span><span>URL</span><span className="w-9" />
              </div>
              {c.products.map((p, i) => (
                <div key={i} className="grid grid-cols-[2fr_1fr_0.7fr_2fr_auto] gap-2">
                  <Input value={p.name} onChange={(e) => setProduct(i, { name: e.target.value })} placeholder="Ring 'Luna' 14k" />
                  <Input value={p.category} onChange={(e) => setProduct(i, { category: e.target.value })} placeholder="Ringen" />
                  <Input value={p.price} onChange={(e) => setProduct(i, { price: e.target.value })} placeholder="€ 149" />
                  <Input value={p.url} onChange={(e) => setProduct(i, { url: e.target.value })} placeholder="https://…" />
                  <Button type="button" variant="ghost" size="icon" aria-label="Verwijder product" onClick={() => set("products", c.products.filter((_, j) => j !== i))}><Trash2 /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Gat-analyse</CardTitle>
          <CardDescription>Wat doet de klant al in de Ad Library, en wat ontbreekt? Wordt voorgesteld door de analyse hierboven.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea className="min-h-28" value={c.gapAnalysisNotes} onChange={(e) => set("gapAnalysisNotes", e.target.value)} placeholder={"- Geen cadeau-content\n- Geen deadline-ads in december\n- Geen mannendoelgroep\n- Geen creators"} />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" size="lg" disabled={pending} className="shadow-lg">{pending ? "Opslaan…" : id ? "Wijzigingen opslaan" : "Klant aanmaken"}</Button>
      </div>
    </form>
  );
}
