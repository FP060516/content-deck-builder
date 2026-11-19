import type { DateRange } from "../briefing/dates";

export type AdLibraryQuery = {
  country: string;
  q: string;
  exactPhrase?: boolean;
  mediaType?: "all" | "image" | "video";
  range?: DateRange;
};

/** Builds a public Meta Ad Library search URL (EU: inactive ads included via active_status=all). */
export function buildAdLibrarySearchUrl(query: AdLibraryQuery): string {
  const p = new URLSearchParams();
  p.set("active_status", "all");
  p.set("ad_type", "all");
  p.set("country", query.country);
  p.set("q", query.q);
  p.set("search_type", query.exactPhrase ? "keyword_exact_phrase" : "keyword_unordered");
  p.set("media_type", query.mediaType ?? "all");
  if (query.range) {
    p.set("start_date[min]", query.range.from);
    p.set("start_date[max]", query.range.to);
  }
  return `https://www.facebook.com/ads/library/?${p.toString()}`;
}

export const adLibraryAdUrl = (adId: string) => `https://www.facebook.com/ads/library/?id=${adId}`;
