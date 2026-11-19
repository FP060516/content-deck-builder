import type { Browser, BrowserContext, Page } from "playwright";
import { buildAdLibrarySearchUrl, adLibraryAdUrl } from "../adlibrary/url";
import { todayYMD } from "../briefing/dates";
import { extractCardsInPage, type ExtractedCard } from "./extract-in-page";
import { cleanBody, parseCardMeta } from "./parse";
import type { AdSearchQuery, AdSource, RawAd, SearchProgress } from "./types";

const SCROLLS = 7; // lesson 6: 6-8 scrolls
const SCROLL_PAUSE_MS = 1500; // lesson 6: ~1.5 s
const MIN_GAP_BETWEEN_SEARCHES_MS = 5000; // keep a low, polite pace

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new Error("Geannuleerd")); }, { once: true });
  });

/** Turns one extracted card into a RawAd. Exported for tests. */
export function toRawAd(card: ExtractedCard, query: AdSearchQuery, today = todayYMD()): RawAd {
  const meta = parseCardMeta(card.text, today);
  const videos = card.videos.filter((v) => v.src);
  const images = Array.from(new Set(card.images));
  const mediaType: RawAd["mediaType"] =
    videos.length + images.length > 1 && videos.length !== 1 ? "carousel" : videos.length ? "video" : images.length ? "image" : "unknown";
  return {
    adId: card.adId,
    advertiser: card.advertiser,
    pageUrl: card.pageUrl,
    bodyText: cleanBody(card.body, card.advertiser),
    mediaType,
    mediaUrls: videos.length ? videos.map((v) => v.src) : images,
    posterUrl: card.videos[0]?.poster || (videos.length ? images[0] ?? "" : ""),
    isActive: meta.isActive,
    startDate: meta.startDate,
    endDate: meta.endDate,
    activeDays: meta.activeDays,
    variantCount: meta.variantCount,
    country: query.country,
    sourceQuery: query.q,
    adLibraryUrl: adLibraryAdUrl(card.adId),
  };
}

async function dismissDialogs(page: Page) {
  const labels = [
    /Decline optional cookies|Optionele cookies weigeren|Only allow essential cookies|Alleen essentiële cookies toestaan/i,
    /Allow all cookies|Alle cookies toestaan/i,
  ];
  for (const re of labels) {
    const btn = page.getByRole("button", { name: re }).first();
    if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); await page.waitForTimeout(800); break; }
  }
  const ok = page.getByRole("dialog").getByRole("button", { name: /^(OK|Sluiten|Close)$/ }).first();
  if (await ok.isVisible().catch(() => false)) await ok.click().catch(() => {});
}

export class PlaywrightAdSource implements AdSource {
  readonly name = "playwright";
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private lastSearchAt = 0;

  constructor(private opts: { headless?: boolean; baseUrlOverride?: (q: AdSearchQuery) => string } = {}) {}

  private async ctx(): Promise<BrowserContext> {
    if (this.context) return this.context;
    const { chromium } = await import("playwright");
    this.browser = await chromium.launch({ headless: this.opts.headless ?? process.env.SCRAPER_HEADLESS !== "false" });
    this.context = await this.browser.newContext({ locale: "en-GB", viewport: { width: 1366, height: 1000 } });
    return this.context;
  }

  async search(query: AdSearchQuery, o: { onProgress?: SearchProgress; signal?: AbortSignal; maxAds?: number } = {}): Promise<RawAd[]> {
    const wait = this.lastSearchAt + MIN_GAP_BETWEEN_SEARCHES_MS - Date.now();
    if (wait > 0) await sleep(wait, o.signal);
    this.lastSearchAt = Date.now();

    const url = this.opts.baseUrlOverride?.(query) ?? buildAdLibrarySearchUrl(query);
    const page = await (await this.ctx()).newPage();
    try {
      o.onProgress?.(`Ad Library openen: "${query.q}" (${query.country})`, 0);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(2500);
      await dismissDialogs(page);
      await page.waitForTimeout(1500);

      const byId = new Map<string, ExtractedCard>();
      const collect = async () => {
        for (const c of await page.evaluate(extractCardsInPage)) if (!byId.has(c.adId)) byId.set(c.adId, c);
      };
      await collect();
      for (let i = 0; i < SCROLLS; i++) {
        if (o.signal?.aborted) throw new Error("Geannuleerd");
        if (o.maxAds && byId.size >= o.maxAds) break;
        await page.mouse.wheel(0, 2500);
        await sleep(SCROLL_PAUSE_MS, o.signal);
        await collect();
        o.onProgress?.(`Scrollen ${i + 1}/${SCROLLS}: ${byId.size} ads gevonden`, (i + 1) / SCROLLS);
      }
      const today = todayYMD();
      const ads = [...byId.values()].map((c) => toRawAd(c, query, today));
      return o.maxAds ? ads.slice(0, o.maxAds) : ads;
    } finally {
      await page.close().catch(() => {});
    }
  }

  async close() {
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.context = null;
    this.browser = null;
  }
}
