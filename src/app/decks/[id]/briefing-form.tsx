"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays, ChevronDown, Copy, ExternalLink, Filter, Info, LayoutGrid, Megaphone, Save, Sparkles,
  Target, TriangleAlert, User, Wand2, Bookmark, Trash2, Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Segmented } from "@/components/ui/segmented";
import { Tooltip } from "@/components/ui/tooltip";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { OptionPicker } from "@/components/option-picker";
import { ChipInput } from "@/components/chip-input";
import { Stepper } from "@/components/stepper";
import { cn } from "@/lib/utils";
import {
  ANGLES, BREADTH_LEVELS, CONTENT_TYPES, COUNTRIES, FUNNEL_STAGES, GOAL_MAINS, LANGUAGES,
  goalGroupFor, type OptionGroup,
} from "@/lib/briefing/options";
import { BRAND_MOMENTS, MOMENTS, MONTH_LABELS, SEASONS } from "@/lib/briefing/moments";
import { formatRangeNL, todayYMD } from "@/lib/briefing/dates";
import { nextOccurrence, resolveSearchWindow } from "@/lib/briefing/search-window";
import { BriefingSchema, hydrateBriefing, totalAds, type Briefing, type BriefingTemplate, type Period } from "@/lib/briefing/schema";
import { BUILT_IN_PRESETS } from "@/lib/briefing/presets";
import { buildAdLibrarySearchUrl } from "@/lib/adlibrary/url";
import { deleteDeck, duplicateDeck, saveBriefing, savePreset } from "../../actions";

export type ClientLite = {
  id: string; name: string; industry: string; positioning: string; country: string; language: string;
  competitors: string[]; productCount: number; gapNotes: string; previousAdvertisers: string[];
};

type Props = {
  deckId: string;
  initialTitle: string;
  initialBriefing: Briefing;
  status: string;
  clients: ClientLite[];
  userPresets: { id: string; name: string; briefing: unknown }[];
};

// ---------- small layout helpers ----------
function Section({ icon: Icon, title, subtitle, summary, children, defaultOpen = true }: {
  icon: React.ElementType; title: string; subtitle?: string; summary?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-5 py-4 text-left cursor-pointer">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{title}</h2>
          {!open && summary ? <div className="truncate text-sm text-muted-foreground">{summary}</div> : subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-5 border-t px-5 py-5">{children}</div>}
    </section>
  );
}

function Field({ label, hint, info, children, className }: { label: string; hint?: React.ReactNode; info?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        {info && (
          <Tooltip content={info}><span className="text-muted-foreground hover:text-foreground cursor-help"><Info className="size-3.5" /></span></Tooltip>
        )}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const PERIOD_TYPES: { value: Period["type"]; label: string }[] = [
  { value: "moment", label: "Dag / moment" },
  { value: "season", label: "Periode / seizoen" },
  { value: "month", label: "Maand" },
  { value: "quarter", label: "Kwartaal" },
  { value: "custom", label: "Eigen bereik" },
  { value: "evergreen", label: "Evergreen" },
];

export function BriefingForm({ deckId, initialTitle, initialBriefing, status, clients, userPresets }: Props) {
  const router = useRouter();
  const [title, setTitle] = React.useState(initialTitle);
  const [b, setB] = React.useState<Briefing>(initialBriefing);
  const [savedSnapshot, setSavedSnapshot] = React.useState(() => JSON.stringify({ t: initialTitle, b: initialBriefing }));
  const [pending, start] = React.useTransition();
  const [presetDialog, setPresetDialog] = React.useState(false);
  const [presetName, setPresetName] = React.useState("");
  const [activePreset, setActivePreset] = React.useState<string | undefined>();

  const dirty = savedSnapshot !== JSON.stringify({ t: title, b });
  const client = clients.find((c) => c.id === b.clientId);
  const total = totalAds(b.structure);
  const sw = React.useMemo(() => resolveSearchWindow(b.period, b.searchWindow), [b.period, b.searchWindow]);
  const validation = BriefingSchema.safeParse(b);

  // Keep the auto-generated title in sync with client + period until the user edits it.
  const autoTitle = (c?: ClientLite, label = sw.periodLabel) => (c ? `${c.name} – ${label}` : label);
  const [titleTouched, setTitleTouched] = React.useState(() => initialTitle !== autoTitle(client));
  React.useEffect(() => {
    if (!titleTouched) setTitle(autoTitle(client, sw.periodLabel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, sw.periodLabel, titleTouched]);

  // ---------- updaters ----------
  const patch = (p: Partial<Briefing>) => setB((prev) => ({ ...prev, ...p }));
  const patchInsp = (p: Partial<Briefing["inspiration"]>) => setB((prev) => ({ ...prev, inspiration: { ...prev.inspiration, ...p } }));
  const patchPeriod = (p: Partial<Period>) => setB((prev) => ({ ...prev, period: { ...prev.period, ...p } }));
  const patchWindow = (p: Partial<Briefing["searchWindow"]>) => setB((prev) => ({ ...prev, searchWindow: { ...prev.searchWindow, ...p } }));

  const applyPreset = (ref: string) => {
    let tpl: BriefingTemplate | undefined;
    if (ref.startsWith("builtin:")) tpl = BUILT_IN_PRESETS.find((p) => "builtin:" + p.id === ref)?.briefing;
    else tpl = hydrateBriefing(userPresets.find((p) => p.id === ref)?.briefing);
    if (!tpl) return;
    setB((prev) => {
      const next = hydrateBriefing({ ...tpl, clientId: prev.clientId });
      // Keep client-specific choices.
      next.inspiration.competitors = prev.inspiration.competitors;
      next.inspiration.excludeBrands = prev.inspiration.excludeBrands;
      next.inspiration.extraContext = prev.inspiration.extraContext;
      return next;
    });
    setActivePreset(ref);
    toast.success("Preset toegepast");
  };

  const changeClient = (id: string) => {
    const c = clients.find((x) => x.id === id);
    setB((prev) => ({
      ...prev,
      clientId: id,
      inspiration: {
        ...prev.inspiration,
        competitors: c?.competitors ?? [],
        languages: prev.inspiration.languages.length ? prev.inspiration.languages : [c?.language ?? "nl"],
      },
    }));
  };

  const changeCountries = (countries: string[]) => {
    const langs = new Set(b.inspiration.languages);
    if (countries.includes("IE") && !b.inspiration.countries.includes("IE")) langs.add("en");
    if (countries.includes("DE") && !b.inspiration.countries.includes("DE")) langs.add("de");
    if (countries.includes("FR") && !b.inspiration.countries.includes("FR")) langs.add("fr");
    patchInsp({ countries, languages: [...langs] });
  };

  const changeGoalMain = (main: string) => {
    setB((prev) => ({ ...prev, goal: { main, subs: prev.goal.subs.filter((s) => s.startsWith(main + ".")) } }));
  };

  const save = () =>
    start(async () => {
      const res = await saveBriefing(deckId, title, b);
      if (!res.ok) return void toast.error(res.error);
      setSavedSnapshot(JSON.stringify({ t: title, b }));
      toast.success("Briefing opgeslagen");
      router.refresh();
    });

  const doSavePreset = () =>
    start(async () => {
      const res = await savePreset(presetName, b);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Preset "${presetName}" opgeslagen`);
      setPresetDialog(false);
      setPresetName("");
      router.refresh();
    });

  // ---------- option groups ----------
  const today = todayYMD();
  const momentGroups: OptionGroup[] = React.useMemo(() => {
    const groups = new Map<string, OptionGroup>();
    for (const m of MOMENTS) {
      if (!groups.has(m.group)) groups.set(m.group, { label: m.group, options: [] });
      const next = nextOccurrence(m, today);
      groups.get(m.group)!.options.push({
        value: m.id,
        label: m.label,
        description: next ? formatRangeNL({ from: next.occ.ranges[0].from, to: next.occ.ranges[next.occ.ranges.length - 1].to }) + (next.occ.approximate ? " (ca.)" : "") : undefined,
      });
    }
    return [...groups.values(), { label: "Merkmomenten (eigen datum)", options: BRAND_MOMENTS.map((bm) => ({ value: "brand:" + bm.id, label: bm.label })) }];
  }, [today]);

  const seasonGroups: OptionGroup[] = React.useMemo(() => {
    const groups = new Map<string, OptionGroup>();
    for (const s of SEASONS) {
      if (!groups.has(s.group)) groups.set(s.group, { label: s.group, options: [] });
      const next = nextOccurrence(s, today);
      groups.get(s.group)!.options.push({
        value: s.id, label: s.label,
        description: next ? next.occ.ranges.map((r) => formatRangeNL(r)).join(" en ") : undefined,
      });
    }
    return [...groups.values()];
  }, [today]);

  const presetGroups: OptionGroup[] = [
    { label: "Ingebouwd", options: BUILT_IN_PRESETS.map((p) => ({ value: "builtin:" + p.id, label: p.name, description: p.description })) },
    ...(userPresets.length ? [{ label: "Eigen presets", options: userPresets.map((p) => ({ value: p.id, label: p.name })) }] : []),
  ];

  const goalGroup = goalGroupFor(b.goal.main);
  const exampleUrl = sw.ranges[0]
    ? buildAdLibrarySearchUrl({
        country: b.inspiration.countries[0] ?? "NL",
        q: sw.periodLabel.replace(/\s*\(.*\)/, "").toLowerCase(),
        mediaType: b.inspiration.mediaType,
        range: sw.ranges[0],
      })
    : null;

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm text-muted-foreground">
            <Link href="/decks" className="hover:underline">Decks</Link>
            {client && <> / <Link href={`/clients/${client.id}`} className="hover:underline">{client.name}</Link></>}
            {" "}/ Briefing
          </p>
          <input value={title} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} aria-label="Titel van het deck"
            className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none focus:underline decoration-muted-foreground/40 underline-offset-4" />
        </div>
        <div className="flex items-center gap-2">
          <form action={duplicateDeck.bind(null, deckId)}><Button variant="ghost" size="sm"><Copy /> Dupliceren</Button></form>
          <form action={deleteDeck.bind(null, deckId)} onSubmit={(e) => { if (!confirm("Deck verwijderen?")) e.preventDefault(); }}>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"><Trash2 /> Verwijderen</Button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Presets */}
          <div className="rounded-xl border border-dashed bg-card/50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 text-sm font-medium"><Bookmark className="size-4 text-primary" /> Start met een preset</span>
              <div className="min-w-64 flex-1">
                <OptionPicker groups={presetGroups} value={activePreset} onChange={applyPreset} placeholder="Kies een preset…" />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setPresetDialog(true)}><Save /> Opslaan als preset</Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {BUILT_IN_PRESETS.slice(0, 4).map((p) => (
                <button key={p.id} type="button" onClick={() => applyPreset("builtin:" + p.id)}
                  className={cn("rounded-full border px-3 py-1 text-xs transition-colors hover:bg-accent cursor-pointer", activePreset === "builtin:" + p.id && "border-primary bg-primary/10 text-primary")}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* 1. Klant */}
          <Section icon={User} title="Klant" summary={client?.name}>
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <Field label="Klant">
                <OptionPicker groups={[{ label: "", options: clients.map((c) => ({ value: c.id, label: c.name, description: c.industry || undefined })) }]}
                  value={b.clientId || undefined} onChange={changeClient} placeholder="Kies een klant…" searchPlaceholder="Zoek klant…" />
              </Field>
              <Button asChild variant="outline"><Link href="/clients/new">+ Nieuwe klant + URL</Link></Button>
            </div>
            {client && (
              <div className="grid gap-3 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Branche</p><p>{client.industry || "–"}</p></div>
                <div><p className="text-xs text-muted-foreground">Positionering</p><p className="capitalize">{client.positioning}</p></div>
                <div><p className="text-xs text-muted-foreground">Producten in catalogus</p><p>{client.productCount}{client.productCount === 0 && <span className="text-warning"> · voeg toe voor betere teksten</span>}</p></div>
                {client.gapNotes && <div className="sm:col-span-3"><p className="text-xs text-muted-foreground">Gat-analyse</p><p className="line-clamp-3 whitespace-pre-line">{client.gapNotes}</p></div>}
              </div>
            )}
          </Section>

          {/* 2. Periode */}
          <Section icon={CalendarDays} title="Periode" subtitle="Verplicht. Bepaalt in welke periode van vorig jaar we zoeken." summary={sw.periodLabel}>
            <Field label="Type periode">
              <Segmented value={b.period.type} onChange={(type) => patch({ period: { type } })} options={PERIOD_TYPES} />
            </Field>

            {b.period.type === "moment" && (
              <div className="space-y-4">
                <Field label="Dag of moment" hint="Gegroepeerd per maand. Achter elk moment staat de eerstvolgende datum.">
                  <OptionPicker groups={momentGroups} value={b.period.momentId} onChange={(momentId) => patchPeriod({ momentId })} placeholder="Kies een moment…" searchPlaceholder="Zoek: kerst, black friday, moederdag…" />
                </Field>
                {b.period.momentId?.startsWith("brand:") && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Datum"><Input type="date" value={b.period.brandMomentDate ?? ""} onChange={(e) => patchPeriod({ brandMomentDate: e.target.value })} /></Field>
                    <Field label="Omschrijving"><Input value={b.period.brandMomentNote ?? ""} onChange={(e) => patchPeriod({ brandMomentNote: e.target.value })} placeholder="Bijv. lancering ringcollectie 'Aurora'" /></Field>
                  </div>
                )}
              </div>
            )}
            {b.period.type === "season" && (
              <Field label="Periode of seizoen">
                <OptionPicker groups={seasonGroups} value={b.period.seasonId} onChange={(seasonId) => patchPeriod({ seasonId })} placeholder="Kies een periode…" />
              </Field>
            )}
            {b.period.type === "month" && (
              <Field label="Maand">
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {MONTH_LABELS.map((m, i) => (
                    <button key={m} type="button" onClick={() => patchPeriod({ month: i + 1 })}
                      className={cn("rounded-md border px-2 py-2 text-sm capitalize transition-colors hover:bg-accent cursor-pointer", b.period.month === i + 1 && "border-primary bg-primary/10 font-medium text-primary")}>
                      {m}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            {b.period.type === "quarter" && (
              <Field label="Kwartaal">
                <Segmented value={b.period.quarter ?? 0} onChange={(quarter) => patchPeriod({ quarter })} options={[1, 2, 3, 4].map((q) => ({ value: q, label: `Q${q}` }))} />
              </Field>
            )}
            {b.period.type === "custom" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Van"><Input type="date" value={b.period.from ?? ""} onChange={(e) => patchPeriod({ from: e.target.value })} /></Field>
                <Field label="Tot"><Input type="date" value={b.period.to ?? ""} onChange={(e) => patchPeriod({ to: e.target.value })} /></Field>
              </div>
            )}
            {b.period.type === "evergreen" && (
              <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">Geen seizoensgebonden content. We zoeken standaard in de laatste 90 dagen en sluiten seizoensads uit.</p>
            )}

            {/* Resolved window */}
            <div className="rounded-lg border bg-primary/5 p-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deck voor</p>
                  <p className="font-medium">{sw.periodLabel}</p>
                  {sw.target && <p className="text-muted-foreground">{sw.target.ranges.map(formatRangeNL).join(" en ")}</p>}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Zoekvenster Ad Library</p>
                  {sw.ranges.length ? sw.ranges.map((r) => <p key={r.from} className="font-medium">{formatRangeNL(r)}</p>) : <p className="text-muted-foreground">–</p>}
                  <p className="text-xs text-muted-foreground">{sw.explanation}</p>
                </div>
              </div>
              {sw.warnings.map((w) => (
                <p key={w} className="mt-2 flex items-center gap-1.5 text-xs text-foreground"><TriangleAlert className="size-3.5 text-warning" /> {w}</p>
              ))}
            </div>

            {/* Advanced */}
            <details className="group rounded-lg border">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
                Geavanceerd: zoekvenster <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t p-4">
                <Field label="Zoekvenster">
                  <Segmented value={b.searchWindow.mode} onChange={(mode) => patchWindow({ mode })}
                    options={[{ value: "auto", label: "Zelfde periode vorig jaar" }, { value: "last_90_days", label: "Laatste 90 dagen" }, { value: "manual", label: "Handmatig" }]} />
                </Field>
                {b.searchWindow.mode === "auto" && (
                  <Field label="Aanloop (dagen vóór de periode)" hint="Ads starten vaak ruim voor het moment zelf.">
                    <Stepper value={b.searchWindow.leadDays} onChange={(leadDays) => patchWindow({ leadDays })} max={60} />
                  </Field>
                )}
                {b.searchWindow.mode === "manual" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Startdatum van"><Input type="date" value={b.searchWindow.from ?? ""} onChange={(e) => patchWindow({ from: e.target.value })} /></Field>
                    <Field label="Startdatum tot"><Input type="date" value={b.searchWindow.to ?? ""} onChange={(e) => patchWindow({ to: e.target.value })} /></Field>
                  </div>
                )}
                {exampleUrl && (
                  <a href={exampleUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <ExternalLink className="size-3.5" /> Voorbeeldzoekopdracht openen in de Ad Library
                  </a>
                )}
              </div>
            </details>
          </Section>

          {/* 3. Funnel */}
          <Section icon={Target} title="Funnelfase" subtitle="Stuurt de zoektermen, de beoordeling en de toon van de toepassingstekst."
            summary={b.funnel.map((f) => FUNNEL_STAGES.find((s) => s.value === f)?.short).join(" + ")}>
            <Field label="Fase(s)" info={<ul className="space-y-1.5">{FUNNEL_STAGES.map((s) => <li key={s.value}><b>{s.label}:</b> {s.description}</li>)}</ul>}>
              <OptionPicker multiple groups={[{ label: "", options: FUNNEL_STAGES.map((s) => ({ value: s.value, label: s.label, description: s.description })) }]}
                value={b.funnel} onChange={(v) => patch({ funnel: v as Briefing["funnel"] })} placeholder="Kies één of meer fases…" />
            </Field>
            <div className="flex flex-wrap gap-2">
              {FUNNEL_STAGES.map((s) => (
                <Tooltip key={s.value} content={s.description}>
                  <button type="button" onClick={() => patch({ funnel: (b.funnel.includes(s.value) ? b.funnel.filter((f) => f !== s.value) : [...b.funnel, s.value]) as Briefing["funnel"] })}
                    className={cn("rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer", b.funnel.includes(s.value) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}>
                    {s.short}
                  </button>
                </Tooltip>
              ))}
            </div>
          </Section>

          {/* 4. Doel */}
          <Section icon={Megaphone} title="Campagnedoel" subtitle="Eén hoofddoel plus optionele subdoelen." summary={GOAL_MAINS.find((g) => g.value === b.goal.main)?.label}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Hoofddoel">
                <OptionPicker groups={[{ label: "", options: GOAL_MAINS }]} value={b.goal.main || undefined} onChange={changeGoalMain} placeholder="Kies een hoofddoel…" />
              </Field>
              <Field label="Subdoelen" hint={goalGroup ? undefined : "Kies eerst een hoofddoel."}>
                <OptionPicker multiple disabled={!goalGroup} groups={goalGroup ? [{ ...goalGroup, label: "" }] : []} value={b.goal.subs}
                  onChange={(subs) => patch({ goal: { ...b.goal, subs } })} placeholder="Optioneel…" />
              </Field>
            </div>
          </Section>

          {/* 5. Angle */}
          <Section icon={Compass} title="Contenthoek / angle" subtitle="Optioneel. Leeg = Claude kiest de beste mix."
            summary={b.angles.length ? `${b.angles.length} gekozen` : "Claude kiest de beste mix"}>
            <OptionPicker multiple groups={ANGLES} value={b.angles} onChange={(angles) => patch({ angles })} placeholder="Leeg = Claude kiest de beste mix" searchPlaceholder="Zoek een angle…" />
          </Section>

          {/* 6. Structuur */}
          <Section icon={LayoutGrid} title="Structuur van het deck" summary={`${total} ads`}>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 px-4 py-3">
              <p className="text-sm"><span className="text-2xl font-semibold tabular-nums">{total}</span> <span className="text-muted-foreground">ads in totaal</span></p>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={b.overfetch} onCheckedChange={(overfetch) => patch({ overfetch })} />
                ×2 overvragen
                <span className="text-muted-foreground">({b.overfetch ? total * 2 : total} kandidaten)</span>
              </label>
            </div>
            <div className="divide-y rounded-lg border">
              {CONTENT_TYPES.map((t) => (
                <div key={t.value} className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("text-sm font-medium", b.structure[t.value] === 0 && "text-muted-foreground")}>{t.label}</span>
                      <Tooltip content={t.description}><span className="text-muted-foreground cursor-help"><Info className="size-3.5" /></span></Tooltip>
                      {b.structure[t.value] === 0 && <Badge variant="secondary">uit</Badge>}
                    </div>
                    <p className="hidden truncate text-xs text-muted-foreground sm:block">{t.description}</p>
                  </div>
                  <Stepper value={b.structure[t.value]} onChange={(v) => patch({ structure: { ...b.structure, [t.value]: v } })} label={t.label} />
                </div>
              ))}
            </div>
          </Section>

          {/* 7. Inspiratie */}
          <Section icon={Filter} title="Inspiratiebron en filters">
            <Field label="Inspiratiebreedte" info="De beste ideeën komen vaak van buiten de eigen branche.">
              <div className="px-1 pt-2">
                <Slider min={0} max={3} step={1} value={[b.inspiration.breadth]} onValueChange={([breadth]) => patchInsp({ breadth })} />
                <div className="mt-2 grid grid-cols-4 text-xs text-muted-foreground">
                  {BREADTH_LEVELS.map((l) => (
                    <button key={l.value} type="button" onClick={() => patchInsp({ breadth: l.value })}
                      className={cn("text-left last:text-right [&:nth-child(2)]:text-center [&:nth-child(3)]:text-center cursor-pointer", b.inspiration.breadth === l.value && "font-semibold text-foreground")}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Concurrenten" hint="Voorgesteld vanuit het klantprofiel. Aan te passen.">
                <ChipInput value={b.inspiration.competitors} onChange={(competitors) => patchInsp({ competitors })} placeholder="Merknaam…" suggestions={client?.competitors ?? []} />
              </Field>
              <Field label="Merken uitsluiten">
                <ChipInput value={b.inspiration.excludeBrands} onChange={(excludeBrands) => patchInsp({ excludeBrands })} placeholder="Merknaam…" />
              </Field>
              <Field label="Markten / landen" hint={b.inspiration.countries.includes("IE") ? "IE = Engelstalige inspiratie. VS-merken zijn in de EU soms niet zichtbaar." : "Tip: voeg Ierland toe voor Engelstalige inspiratie."}>
                <OptionPicker multiple groups={[{ label: "", options: COUNTRIES }]} value={b.inspiration.countries} onChange={changeCountries} />
              </Field>
              <Field label="Taal van de ads">
                <OptionPicker multiple groups={[{ label: "", options: LANGUAGES }]} value={b.inspiration.languages} onChange={(languages) => patchInsp({ languages })} />
              </Field>
              <Field label="Mediatype">
                <Segmented value={b.inspiration.mediaType} onChange={(mediaType) => patchInsp({ mediaType })}
                  options={[{ value: "all", label: "Alles" }, { value: "image", label: "Afbeelding" }, { value: "video", label: "Video" }]} />
              </Field>
              <Field label="Max. ads per adverteerder">
                <Stepper value={b.inspiration.maxPerAdvertiser} min={1} max={5} onChange={(maxPerAdvertiser) => patchInsp({ maxPerAdvertiser })} />
              </Field>
              <Field label="AI-gegenereerde inspiratie" info="Het deck bestaat nooit vanzelf alleen uit AI-content.">
                <Segmented value={b.inspiration.aiContent} onChange={(aiContent) => patchInsp({ aiContent })}
                  options={[{ value: "allow", label: "Toestaan" }, { value: "avoid", label: "Vermijden" }, { value: "mix", label: "Mix" }]} />
              </Field>
              <Field label="Positionering van de inspiratie">
                <Segmented value={b.inspiration.pricePositioning} onChange={(pricePositioning) => patchInsp({ pricePositioning })}
                  options={[{ value: "same", label: "Zelfde niveau" }, { value: "higher", label: "Hoger (aspirationeel)" }, { value: "all", label: "Alles" }]} />
              </Field>
              <Field label="Minimum aantal actieve dagen" hint="Optioneel. Lang lopende ads zijn vaak winnaars.">
                <Input type="number" min={0} className="w-32" value={b.inspiration.minActiveDays ?? ""} placeholder="–"
                  onChange={(e) => patchInsp({ minActiveDays: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} />
              </Field>
              <Field label="Merken uit eerdere decks uitsluiten" hint={client ? `${client.previousAdvertisers.length} merk(en) uit eerdere decks van ${client.name}.` : undefined}>
                <div className="flex h-9 items-center"><Switch checked={b.inspiration.excludePreviousAdvertisers} onCheckedChange={(excludePreviousAdvertisers) => patchInsp({ excludePreviousAdvertisers })} /></div>
              </Field>
            </div>
            <Field label="Extra context voor dit deck">
              <Textarea value={b.inspiration.extraContext} onChange={(e) => patchInsp({ extraContext: e.target.value })}
                placeholder="Bijv. 'focus op mannendoelgroep' of 'ze hebben net een nieuwe ringcollectie'" />
            </Field>
          </Section>
        </div>

        {/* Sidebar summary */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-primary" /> Samenvatting</h3>
            <dl className="space-y-3 text-sm">
              <SummaryRow label="Klant" value={client?.name ?? "–"} />
              <SummaryRow label="Periode" value={sw.periodLabel} />
              <SummaryRow label="Zoekvenster" value={sw.ranges.map(formatRangeNL).join(" + ") || "–"} />
              <SummaryRow label="Funnel" value={b.funnel.map((f) => FUNNEL_STAGES.find((s) => s.value === f)?.short).join(", ") || "–"} />
              <SummaryRow label="Doel" value={[GOAL_MAINS.find((g) => g.value === b.goal.main)?.label, b.goal.subs.length ? `+${b.goal.subs.length}` : ""].filter(Boolean).join(" ") || "–"} />
              <SummaryRow label="Angles" value={b.angles.length ? `${b.angles.length} gekozen` : "Claude kiest"} />
              <SummaryRow label="Markten" value={b.inspiration.countries.join(", ")} />
              <SummaryRow label="Breedte" value={BREADTH_LEVELS[b.inspiration.breadth].label} />
            </dl>
            <div className="space-y-1.5 border-t pt-3">
              {CONTENT_TYPES.filter((t) => b.structure[t.value] > 0).map((t) => (
                <div key={t.value} className="flex justify-between text-sm"><span className="text-muted-foreground">{t.label}</span><span className="tabular-nums">{b.structure[t.value]}</span></div>
              ))}
              <div className="flex justify-between border-t pt-1.5 text-sm font-semibold"><span>Totaal</span><span className="tabular-nums">{total}</span></div>
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-3">
          <p className="text-sm">
            <b className="tabular-nums">Totaal: {total} ads</b>
            {b.overfetch && <span className="text-muted-foreground"> · zoekt {total * 2} kandidaten</span>}
          </p>
          {!validation.success && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><TriangleAlert className="size-4 text-warning" />{validation.error.issues[0]?.message}</p>
          )}
          {total === 0 && validation.success && <p className="text-sm text-muted-foreground">Zet minimaal één contenttype aan.</p>}
          <div className="ml-auto flex items-center gap-2">
            {dirty && <span className="text-xs text-muted-foreground">Niet-opgeslagen wijzigingen</span>}
            <Button variant="outline" onClick={save} disabled={pending}><Save /> {pending ? "Opslaan…" : "Briefing opslaan"}</Button>
            <Tooltip content="Nog niet beschikbaar: het automatisch zoeken en samenstellen van ads wordt in de volgende stappen gebouwd.">
              <span><Button disabled><Wand2 /> Genereer <span className="text-xs opacity-70">(binnenkort)</span></Button></span>
            </Tooltip>
          </div>
        </div>
      </div>

      <Dialog open={presetDialog} onOpenChange={setPresetDialog}>
        <DialogContent title="Opslaan als preset" description="Alle keuzes behalve de klant, de concurrenten en de uitgesloten merken.">
          <Input autoFocus value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Bijv. Sieraden – Moederdag BOF"
            onKeyDown={(e) => e.key === "Enter" && doSavePreset()} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPresetDialog(false)}>Annuleren</Button>
            <Button onClick={doSavePreset} disabled={pending || !presetName.trim()}>Opslaan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {status !== "draft" && <p className="sr-only">Status: {status}</p>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
