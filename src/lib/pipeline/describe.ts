import type { Client } from "@prisma/client";
import { ANGLES, BREADTH_LEVELS, CONTENT_TYPES, FUNNEL_STAGES, GOALS, labelOf } from "../briefing/options";
import type { Briefing } from "../briefing/schema";
import type { ResolvedWindow } from "../briefing/search-window";
import type { Product } from "../client-profile";
import { parseJson } from "../utils";

/** Market → search language. BE gets Dutch by default; French only when asked. */
export const LANGUAGE_FOR_COUNTRY: Record<string, string> = { NL: "nl", BE: "nl", IE: "en", DE: "de", AT: "de", FR: "fr", ES: "es", IT: "it", DK: "da", SE: "sv" };

/** Readable briefing for prompts (labels, not internal keys). */
export function briefingText(b: Briefing, w: ResolvedWindow): string {
  const ct = CONTENT_TYPES.filter((c) => b.structure[c.value] > 0).map((c) => `${c.label}: ${b.structure[c.value]}`);
  const lines = [
    `Periode: ${w.periodLabel}${w.target ? ` (doelperiode ${w.target.ranges.map((r) => `${r.from} t/m ${r.to}`).join(", ")})` : ""}`,
    `Zoekvenster in de Ad Library: ${w.ranges.map((r) => `${r.from} t/m ${r.to}`).join(" en ")}`,
    `Funnelfase: ${b.funnel.map((f) => FUNNEL_STAGES.find((s) => s.value === f)?.label ?? f).join(", ")}`,
    `Doel: ${labelOf(GOALS, b.goal.main)}${b.goal.subs.length ? ` – ${b.goal.subs.map((s) => labelOf(GOALS, s)).join(", ")}` : ""}`,
    `Angles: ${b.angles.length ? b.angles.map((a) => labelOf(ANGLES, a)).join(", ") : "vrij (Claude kiest)"}`,
    `Gewenste ads per contenttype: ${ct.join(", ")}`,
    `Inspiratiebreedte: ${BREADTH_LEVELS.find((l) => l.value === b.inspiration.breadth)?.label}`,
    `Markten: ${b.inspiration.countries.join(", ")} · talen: ${b.inspiration.languages.join(", ")}`,
    `Prijspositionering van inspiratie: ${{ same: "zelfde niveau als de klant", higher: "hoger (aspirationeel)", all: "maakt niet uit" }[b.inspiration.pricePositioning]}`,
    `AI-gegenereerde content: ${{ allow: "toegestaan", avoid: "vermijden", mix: "mag, maar niet de overhand" }[b.inspiration.aiContent]}`,
  ];
  if (b.inspiration.competitors.length) lines.push(`Concurrenten: ${b.inspiration.competitors.join(", ")}`);
  if (b.inspiration.extraContext.trim()) lines.push(`Extra context van de marketeer: ${b.inspiration.extraContext.trim()}`);
  return lines.join("\n");
}

export function clientText(c: Client, opts: { products?: number } = {}): string {
  const products = parseJson<Product[]>(c.products, []);
  const list = (s: string) => parseJson<string[]>(s, []);
  const lines = [
    `Naam: ${c.name}`,
    c.websiteUrl && `Website: ${c.websiteUrl}`,
    c.industry && `Branche: ${c.industry}`,
    `Positionering: ${c.positioning}`,
    `Land / taal: ${c.country} / ${c.language}`,
    c.toneSummary && `Tone of voice: ${c.toneSummary}`,
    list(c.toneExamples).length ? `Voorbeeldzinnen:\n${list(c.toneExamples).map((x) => `- ${x}`).join("\n")}` : "",
    list(c.usps).length ? `USP's: ${list(c.usps).join("; ")}` : "",
    list(c.forbiddenClaims).length ? `Nooit beloven of gebruiken: ${list(c.forbiddenClaims).join("; ")}` : "",
    products.length
      ? `Producten (${products.length}):\n${products.slice(0, opts.products ?? 40).map((p) => `- ${p.name}${p.category ? ` | ${p.category}` : ""}${p.price ? ` | ${p.price}` : ""}`).join("\n")}`
      : "Producten: (geen catalogus ingevuld)",
    c.gapAnalysisNotes && `Gat-analyse van de eigen ads:\n${c.gapAnalysisNotes}`,
  ];
  return lines.filter(Boolean).join("\n");
}
