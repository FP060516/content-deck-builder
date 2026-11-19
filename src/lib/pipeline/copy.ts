import { db } from "../db";
import { BriefingSchema, hydrateBriefing } from "../briefing/schema";
import { resolveSearchWindow } from "../briefing/search-window";
import { callStructured, type ImageInput, type Usage } from "../llm/claude";
import { imageFromLocal } from "../llm/images";
import { parseJson } from "../utils";
import { briefingText, clientText } from "./describe";
import { forbiddenHits } from "./rank";
import { CopySchema } from "./schemas";

export type CopyAd = {
  adId: string;
  advertiser: string;
  mediaType: string;
  country: string;
  activeDays: number | null;
  variantCount: number;
  bodyText: string;
  whatYouSee: string;
  contentType: string;
  image: string; // local /media/... URL of the creative or video poster
};

export function copyAdLine(a: CopyAd): string {
  return `- adId ${a.adId} | ${a.advertiser || "?"} | ${a.mediaType} | ${a.country} | ${a.activeDays ?? "?"} dagen | ${a.variantCount} variant(en)\n   Tekst: ${a.bodyText.replace(/\s+/g, " ").slice(0, 350) || "(geen)"}\n   Wat je ziet: ${a.whatYouSee || "-"}\n   Contenttype: ${a.contentType}`;
}

/** Writes application texts for a few ads of an existing deck (replace / rewrite in the deck screen). */
export async function writeCopyFor(deckId: string, ads: CopyAd[], notes: string): Promise<{ items: Map<string, { application: string; whyThis: string }>; usage: Usage }> {
  const deck = await db.deck.findUniqueOrThrow({ where: { id: deckId }, include: { client: true } });
  const b = BriefingSchema.parse(hydrateBriefing(parseJson(deck.briefing, {}), deck.clientId));
  const w = resolveSearchWindow(b.period, b.searchWindow);
  const forbidden = parseJson<string[]>(deck.client.forbiddenClaims, []);
  const images = (await Promise.all(ads.map((a) => imageFromLocal(a.image, `adId ${a.adId}:`)))).filter((x): x is ImageInput => !!x);
  const { data, usage } = await callStructured({
    prompt: "application",
    schema: CopySchema,
    model: "copy",
    effort: "medium",
    images,
    vars: {
      clientName: deck.client.name,
      client: clientText(deck.client, { products: 80 }),
      briefing: briefingText(b, w),
      count: String(ads.length),
      ads: ads.map(copyAdLine).join("\n"),
      notes: notes || "-",
    },
  });
  const items = new Map<string, { application: string; whyThis: string }>();
  for (const x of data.items) {
    const hits = forbiddenHits(x.application, forbidden);
    items.set(x.adId, { application: x.application, whyThis: [x.whyThis, hits.length ? `⚠ Controleer: bevat mogelijk "${hits.join('", "')}".` : ""].filter(Boolean).join(" ") });
  }
  return { items, usage };
}
