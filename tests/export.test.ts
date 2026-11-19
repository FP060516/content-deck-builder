import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import { MEDIA_ROOT } from "@/lib/media/storage";
import type { DeckItemView, DeckView } from "@/lib/deck/load";
import { mediaFileName, toCsv, toMarkdown, toZip } from "@/lib/export/formats";
import { toPptx } from "@/lib/export/pptx";

const DIR = "vitest-export";
// 1x1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

const item = (o: Partial<DeckItemView>): DeckItemView => ({
  id: "i", position: 0, contentType: "static", contentTypeLabel: "Statics", status: "pending", pinned: false,
  whatYouSee: "Productfoto", application: "Toon de Ring Luna 14k, met \"gratis\" graveren, ook in goud.", whyThis: "Lang actief", funnelTag: "bof",
  candidateId: "c", adId: "111", advertiser: "Goudsmid & Co", mediaType: "image", bodyText: "", startDate: "2025-12-03", activeDays: 40, variantCount: 2, country: "NL",
  media: `/media/${DIR}/d/111.png`, mediaIsLocal: true, poster: "", mediaOriginal: "https://x/1.png", scoreTotal: 7.5, adLibraryUrl: "https://www.facebook.com/ads/library/?id=111", ...o,
});

const deck: DeckView = {
  id: "d", title: "Kerst 2026", status: "review", round: 1, summary: "- Focus op cadeaus\n- UGC vult het gat", clientId: "k", clientName: "Goudsmid", clientSlug: "goudsmid",
  periodLabel: "Kerst",
  items: [
    item({}),
    item({ id: "i2", adId: "222", advertiser: "Zilverhuis", contentType: "ugc", contentTypeLabel: "UGC", mediaType: "video", media: `/media/${DIR}/d/222.mp4`, poster: `/media/${DIR}/d/222-poster.png` }),
    item({ id: "i3", adId: "333", advertiser: "Weg", status: "rejected" }),
    item({ id: "i4", adId: "444", advertiser: "Extern", media: "https://scontent.example/4.jpg", mediaIsLocal: false }),
  ],
};

beforeAll(async () => {
  const d = path.join(MEDIA_ROOT, DIR, "d");
  await mkdir(d, { recursive: true });
  await writeFile(path.join(d, "111.png"), PNG);
  await writeFile(path.join(d, "222.mp4"), Buffer.from("fake-video"));
  await writeFile(path.join(d, "222-poster.png"), PNG);
});
afterAll(async () => { await rm(path.join(MEDIA_ROOT, DIR), { recursive: true, force: true }); });

describe("exports", () => {
  it("names media files predictably", () => {
    expect(mediaFileName(deck.items[0], 1)).toBe("01-goudsmid-co-111.png");
    expect(mediaFileName(deck.items[3], 3)).toBe("03-extern-444.jpg");
  });

  it("markdown leaves rejected items out and groups by content type", () => {
    const md = toMarkdown(deck);
    expect(md).toContain("# Kerst 2026");
    expect(md).toContain("## Samenvatting\n\n- Focus op cadeaus");
    expect(md).toContain("## Statics");
    expect(md).toContain("## UGC");
    expect(md).toContain("**Toepassing:** Toon de Ring Luna 14k");
    expect(md).not.toContain("Weg");
    expect(md).toContain("media/01-goudsmid-co-111.png");
  });

  it("csv escapes quotes and commas, with BOM", () => {
    const csv = toCsv(deck);
    expect(csv.startsWith("﻿nr,contenttype,adverteerder,toepassing")).toBe(true);
    expect(csv).toContain('"Toon de Ring Luna 14k, met ""gratis"" graveren, ook in goud."');
    expect(csv.trim().split("\r\n")).toHaveLength(4); // header + 3 (rejected excluded)
  });

  it("zip contains deck files, local media, video posters and a list of missing media", async () => {
    const zip = await JSZip.loadAsync(await toZip(deck));
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(expect.arrayContaining(["deck.md", "deck.csv", "media/01-goudsmid-co-111.png", "media/02-zilverhuis-222.mp4", "media/02-zilverhuis-222-poster.png", "ONTBREKENDE-MEDIA.txt"]));
    expect(await zip.file("ONTBREKENDE-MEDIA.txt")!.async("string")).toContain("03-extern-444.jpg");
  });

  it("pptx has a title slide, a summary slide and one slide per ad", async () => {
    const zip = await JSZip.loadAsync(await toPptx(deck));
    const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    expect(slides).toHaveLength(2 + 3);
    const s3 = await zip.file("ppt/slides/slide3.xml")!.async("string");
    expect(s3).toContain("Goudsmid &amp; Co");
    expect(s3).toContain("TOEPASSING");
    expect(Object.keys(zip.files).some((n) => n.startsWith("ppt/media/"))).toBe(true);
  });
});
