import type { DateRange } from "../briefing/dates";

export type AdSearchQuery = {
  country: string;
  q: string;
  exactPhrase?: boolean;
  mediaType?: "all" | "image" | "video";
  range?: DateRange;
};

/** One ad as read from the public Ad Library, before classification. */
export type RawAd = {
  adId: string;
  advertiser: string;
  pageUrl: string;
  bodyText: string;
  mediaType: "image" | "video" | "carousel" | "unknown";
  mediaUrls: string[]; // first is the main creative
  posterUrl: string;
  isActive: boolean | null;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  activeDays: number | null;
  variantCount: number;
  country: string;
  sourceQuery: string;
  adLibraryUrl: string;
};

export type SearchProgress = (msg: string, fraction?: number) => void;

/** A source of ads. Playwright scraping today; the official Ad Library API can plug in later. */
export interface AdSource {
  readonly name: string;
  search(query: AdSearchQuery, opts?: { onProgress?: SearchProgress; signal?: AbortSignal; maxAds?: number }): Promise<RawAd[]>;
  close?(): Promise<void>;
}
