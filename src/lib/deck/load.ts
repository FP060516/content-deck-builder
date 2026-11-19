import { db } from "../db";
import { CONTENT_TYPES } from "../briefing/options";
import { hydrateBriefing } from "../briefing/schema";
import { resolveSearchWindow } from "../briefing/search-window";
import { adLibraryAdUrl } from "../adlibrary/url";
import { parseJson } from "../utils";

export type DeckItemView = {
  id: string;
  position: number;
  contentType: string;
  contentTypeLabel: string;
  status: "pending" | "approved" | "rejected";
  pinned: boolean;
  whatYouSee: string;
  application: string;
  whyThis: string;
  funnelTag: string;
  candidateId: string;
  adId: string;
  advertiser: string;
  mediaType: string;
  bodyText: string;
  startDate: string | null;
  activeDays: number | null;
  variantCount: number;
  country: string;
  media: string; // local /media/... when downloaded, else the original URL
  mediaIsLocal: boolean;
  poster: string;
  mediaOriginal: string;
  scoreTotal: number;
  adLibraryUrl: string;
};

export type DeckView = {
  id: string;
  title: string;
  status: string;
  round: number;
  summary: string;
  clientId: string;
  clientName: string;
  clientSlug: string;
  periodLabel: string;
  items: DeckItemView[];
};

export const contentTypeLabel = (v: string) => CONTENT_TYPES.find((c) => c.value === v)?.label ?? v;
const ORDER = CONTENT_TYPES.map((c) => c.value as string);

export async function loadDeckView(deckId: string): Promise<DeckView | null> {
  const deck = await db.deck.findUnique({
    where: { id: deckId },
    include: { client: true, items: { include: { candidate: true } } },
  });
  if (!deck) return null;
  const b = hydrateBriefing(parseJson(deck.briefing, {}), deck.clientId);
  const items = deck.items
    .map((i): DeckItemView => {
      const c = i.candidate;
      const local = c.mediaUrlLocal.startsWith("/media/");
      return {
        id: i.id, position: i.position, contentType: i.contentType, contentTypeLabel: contentTypeLabel(i.contentType),
        status: (["pending", "approved", "rejected"].includes(i.status) ? i.status : "pending") as DeckItemView["status"],
        pinned: i.pinned, whatYouSee: i.whatYouSee, application: i.application, whyThis: i.whyThis, funnelTag: i.funnelTag,
        candidateId: c.id, adId: c.adId, advertiser: c.advertiser, mediaType: c.mediaType, bodyText: c.bodyText,
        startDate: c.startDate?.toISOString().slice(0, 10) ?? null, activeDays: c.activeDays, variantCount: c.variantCount, country: c.country,
        media: local ? c.mediaUrlLocal : c.mediaUrlOriginal, mediaIsLocal: local, poster: c.posterUrl, mediaOriginal: c.mediaUrlOriginal,
        scoreTotal: c.scoreTotal, adLibraryUrl: adLibraryAdUrl(c.adId),
      };
    })
    .sort((a, z) => ORDER.indexOf(a.contentType) - ORDER.indexOf(z.contentType) || a.position - z.position);
  return {
    id: deck.id, title: deck.title, status: deck.status, round: deck.round, summary: deck.summary,
    clientId: deck.clientId, clientName: deck.client.name, clientSlug: deck.client.slug,
    periodLabel: resolveSearchWindow(b.period, b.searchWindow).periodLabel, items,
  };
}

/** Items that go into an export: everything the marketer did not reject. */
export const exportable = (d: DeckView) => d.items.filter((i) => i.status !== "rejected");
