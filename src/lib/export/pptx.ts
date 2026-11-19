import PptxGenJS from "pptxgenjs";
import { exportable, type DeckView } from "../deck/load";
import { readLocalMedia } from "./formats";

// House style (shortcommerce.nl): near-black, white text, neon green accent.
const BG = "050506";
const CARD = "121316";
const TEXT = "FFFFFF";
const MUTED = "A6A6A6";
const GREEN = "00DF82";
const FONT = "Arial";
const FUNNEL: Record<string, string> = { tof: "TOF", mof: "MOF", bof: "BOF", retention: "Retentie" };

const IMAGE_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif" };

async function imageData(url: string): Promise<string | null> {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  const type = IMAGE_TYPES[ext];
  if (!type) return null; // webp/svg/video are not reliable in PowerPoint
  const buf = await readLocalMedia(url);
  return buf ? `data:${type};base64,${buf.toString("base64")}` : null;
}

/** 16:9 deck: title, summary, then one slide per ad (creative left, texts right). Ready to import in Canva. */
export async function toPptx(d: DeckView): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.title = d.title;
  pptx.company = "Short Commerce";
  const items = exportable(d);

  const title = pptx.addSlide();
  title.background = { color: BG };
  title.addShape(pptx.ShapeType.ellipse, { x: 3.2, y: -3.6, w: 7, h: 5, fill: { color: GREEN, transparency: 82 }, line: { color: BG, width: 0 } });
  title.addText("CONTENT DECK", { x: 0.8, y: 2.2, w: 11, h: 0.4, fontFace: FONT, fontSize: 14, color: GREEN, bold: true, charSpacing: 4 });
  title.addText(d.title, { x: 0.8, y: 2.7, w: 11.5, h: 1.4, fontFace: FONT, fontSize: 40, color: TEXT, bold: true, valign: "top" });
  title.addText(`${d.clientName} · ${d.periodLabel} · ${items.length} ads`, { x: 0.8, y: 4.2, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 16, color: MUTED });

  if (d.summary.trim()) {
    const s = pptx.addSlide();
    s.background = { color: BG };
    s.addText("Samenvatting", { x: 0.8, y: 0.6, w: 11, h: 0.8, fontFace: FONT, fontSize: 30, color: TEXT, bold: true });
    const bullets = d.summary.split("\n").map((l) => l.replace(/^[-*]\s*/, "").trim()).filter(Boolean);
    s.addText(bullets.map((b) => ({ text: b, options: { bullet: { indent: 18 }, paraSpaceAfter: 10 } })), {
      x: 0.8, y: 1.6, w: 11.6, h: 5.2, fontFace: FONT, fontSize: 18, color: TEXT, valign: "top",
    });
  }

  for (const [idx, i] of items.entries()) {
    const s = pptx.addSlide();
    s.background = { color: BG };
    s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 0.5, w: 5.6, h: 6.5, fill: { color: CARD }, line: { color: "2A2A2E", width: 0.75 }, rectRadius: 0.2 });
    const img = (await imageData(i.mediaType === "video" ? i.poster : i.media)) ?? (await imageData(i.poster));
    if (img) s.addImage({ data: img, x: 0.7, y: 0.7, w: 5.2, h: 6.1, sizing: { type: "contain", w: 5.2, h: 6.1 } });
    else s.addText("Creative: zie Ad Library", { x: 0.7, y: 3.4, w: 5.2, h: 0.6, align: "center", fontFace: FONT, fontSize: 14, color: MUTED });
    if (i.mediaType === "video") s.addText("▶ VIDEO", { x: 0.8, y: 0.8, w: 1.3, h: 0.35, fontFace: FONT, fontSize: 10, bold: true, color: BG, fill: { color: GREEN }, align: "center" });

    const meta = [i.contentTypeLabel, FUNNEL[i.funnelTag], i.activeDays !== null ? `${i.activeDays} dagen actief` : "", i.variantCount > 1 ? `${i.variantCount} varianten` : "", i.country].filter(Boolean).join("  ·  ");
    s.addText(`${String(idx + 1).padStart(2, "0")}`, { x: 6.6, y: 0.5, w: 1, h: 0.5, fontFace: FONT, fontSize: 14, color: GREEN, bold: true });
    s.addText(i.advertiser || "Onbekende adverteerder", { x: 6.6, y: 0.95, w: 6.2, h: 0.7, fontFace: FONT, fontSize: 26, color: TEXT, bold: true, fit: "shrink" });
    s.addText(meta, { x: 6.6, y: 1.65, w: 6.2, h: 0.4, fontFace: FONT, fontSize: 12, color: MUTED });
    if (i.whatYouSee) s.addText(i.whatYouSee, { x: 6.6, y: 2.2, w: 6.2, h: 1.1, fontFace: FONT, fontSize: 13, color: MUTED, valign: "top", fit: "shrink" });
    s.addShape(pptx.ShapeType.roundRect, { x: 6.6, y: 3.45, w: 6.2, h: 2.5, fill: { color: "06150E" }, line: { color: GREEN, width: 1 }, rectRadius: 0.15 });
    s.addText("TOEPASSING", { x: 6.85, y: 3.6, w: 5.8, h: 0.35, fontFace: FONT, fontSize: 11, color: GREEN, bold: true, charSpacing: 2 });
    s.addText(i.application || "–", { x: 6.85, y: 3.95, w: 5.75, h: 1.9, fontFace: FONT, fontSize: 16, color: TEXT, valign: "top", fit: "shrink" });
    s.addText("Bekijk in de Ad Library →", { x: 6.6, y: 6.3, w: 6.2, h: 0.4, fontFace: FONT, fontSize: 13, color: GREEN, hyperlink: { url: i.adLibraryUrl } });
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
