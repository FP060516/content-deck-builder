import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { MEDIA_ROOT } from "../media/storage";
import { exportable, type DeckItemView, type DeckView } from "../deck/load";
import { slugify } from "../utils";

const FUNNEL: Record<string, string> = { tof: "TOF", mof: "MOF", bof: "BOF", retention: "Retentie" };

/** Name of the creative inside the ZIP, also used in the Markdown and CSV. */
export function mediaFileName(i: DeckItemView, nr: number): string {
  const ext = path.extname(i.media.split("?")[0]).slice(1).toLowerCase() || (i.mediaType === "video" ? "mp4" : "jpg");
  return `${String(nr).padStart(2, "0")}-${slugify(i.advertiser) || "ad"}-${i.adId}.${ext}`;
}

export function deckFileBase(d: DeckView): string {
  return slugify(`${d.clientName} ${d.title}`) || "deck";
}

export function toMarkdown(d: DeckView): string {
  const items = exportable(d);
  const out = [`# ${d.title}`, "", `**Klant:** ${d.clientName}  `, `**Periode:** ${d.periodLabel}  `, `**Aantal ads:** ${items.length}`, ""];
  if (d.summary.trim()) out.push("## Samenvatting", "", d.summary.trim(), "");
  let group = "";
  items.forEach((i, idx) => {
    if (i.contentTypeLabel !== group) { group = i.contentTypeLabel; out.push(`## ${group}`, ""); }
    out.push(
      `### ${idx + 1}. ${i.advertiser || "Onbekende adverteerder"}`,
      "",
      `- **Ad Library:** ${i.adLibraryUrl}`,
      `- **Creative:** media/${mediaFileName(i, idx + 1)}`,
      `- **Info:** ${[i.funnelTag && FUNNEL[i.funnelTag], i.activeDays !== null && `${i.activeDays} dagen actief`, i.variantCount > 1 && `${i.variantCount} varianten`, i.country].filter(Boolean).join(" · ")}`,
      "",
    );
    if (i.whatYouSee) out.push(`**Wat je ziet:** ${i.whatYouSee}`, "");
    if (i.application) out.push(`**Toepassing:** ${i.application}`, "");
    if (i.whyThis) out.push(`*Waarom deze:* ${i.whyThis}`, "");
  });
  return out.join("\n").trimEnd() + "\n";
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV for Canva Bulk Create / Excel (UTF-8 with BOM so Excel shows accents correctly). */
export function toCsv(d: DeckView): string {
  const header = ["nr", "contenttype", "adverteerder", "toepassing", "wat_je_ziet", "waarom", "funnel", "actieve_dagen", "varianten", "land", "ad_library_link", "bestand"];
  const rows = exportable(d).map((i, idx) => [
    idx + 1, i.contentTypeLabel, i.advertiser, i.application, i.whatYouSee, i.whyThis, FUNNEL[i.funnelTag] ?? i.funnelTag,
    i.activeDays ?? "", i.variantCount, i.country, i.adLibraryUrl, mediaFileName(i, idx + 1),
  ]);
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export async function readLocalMedia(url: string): Promise<Buffer | null> {
  if (!url.startsWith("/media/")) return null;
  const file = path.resolve(MEDIA_ROOT, ...url.slice("/media/".length).split("/"));
  if (!file.startsWith(MEDIA_ROOT + path.sep)) return null;
  return readFile(file).catch(() => null);
}

/** ZIP with the deck as Markdown and CSV plus all creatives (local copies; videos with their poster). */
export async function toZip(d: DeckView): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("deck.md", toMarkdown(d));
  zip.file("deck.csv", toCsv(d));
  const missing: string[] = [];
  for (const [idx, i] of exportable(d).entries()) {
    const name = mediaFileName(i, idx + 1);
    const buf = await readLocalMedia(i.media);
    if (buf) zip.file(`media/${name}`, buf);
    else missing.push(`${name}: niet lokaal opgeslagen, zie ${i.adLibraryUrl}`);
    if (i.mediaType === "video" && i.poster) {
      const p = await readLocalMedia(i.poster);
      if (p) zip.file(`media/${name.replace(/\.[^.]+$/, "")}-poster${path.extname(i.poster)}`, p);
    }
  }
  if (missing.length) zip.file("ONTBREKENDE-MEDIA.txt", missing.join("\n") + "\n");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
