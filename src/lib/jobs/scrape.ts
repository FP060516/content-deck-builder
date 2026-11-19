import { db } from "../db";
import { getCached, putCached } from "../adsource/cache";
import { PlaywrightAdSource } from "../adsource/playwright-source";
import type { AdSource, RawAd } from "../adsource/types";
import { downloadMedia } from "../media/download";
import { ScrapePayloadSchema, type ScrapedAd, type ScrapeResult } from "./scrape-schema";
import type { JobContext } from "./worker";

/** Source factory. AD_LIBRARY_FIXTURE_URL points the scraper at a local test page (dev only). */
export function createAdSource(): AdSource {
  const fixture = process.env.AD_LIBRARY_FIXTURE_URL;
  return new PlaywrightAdSource(fixture ? { baseUrlOverride: () => fixture } : {});
}

export async function runScrapeJob(ctx: JobContext): Promise<ScrapeResult> {
  const p = ScrapePayloadSchema.parse(ctx.payload);
  const source = createAdSource();
  const warnings: string[] = [];
  const all = new Map<string, RawAd>();
  let fromCache = 0;
  const qn = p.queries.length;
  // 0-60% searching, 60-100% downloading.
  try {
    for (const [i, q] of p.queries.entries()) {
      if (ctx.signal.aborted) throw new Error("Geannuleerd");
      const label = `"${q.q}" (${q.country}${q.range ? `, ${q.range.from} t/m ${q.range.to}` : ""})`;
      let ads = p.useCache ? await getCached(q) : null;
      if (ads) {
        fromCache += ads.length;
        await ctx.log(`Uit cache (< 24 uur): ${label}, ${ads.length} ads`);
      } else {
        await ctx.log(`Zoeken: ${label}`);
        ads = await source.search(q, {
          signal: ctx.signal,
          maxAds: p.maxPerQuery,
          onProgress: (msg, f = 0) => void ctx.progress(((i + f) / qn) * 60, msg),
        });
        await putCached(q, ads);
        await ctx.log(`${ads.length} ads gevonden voor ${label}`, ads.length ? "info" : "warn");
        if (!ads.length) warnings.push(`Geen ads voor ${label}. Probeer een bredere zoekterm of een andere periode.`);
      }
      for (const a of ads.slice(0, p.maxPerQuery)) if (!all.has(a.adId)) all.set(a.adId, a);
      await ctx.progress(((i + 1) / qn) * 60);
    }
  } finally {
    await source.close?.();
  }

  const list = [...all.values()];
  const out: ScrapedAd[] = [];
  for (const [i, a] of list.entries()) {
    if (ctx.signal.aborted) throw new Error("Geannuleerd");
    const ad: ScrapedAd = { ...a, mediaUrlLocal: "", posterUrlLocal: "", mediaHash: "" };
    if (p.download && a.mediaUrls[0]) {
      try {
        const d = await downloadMedia(a.mediaUrls[0], p.client, p.folder, a.adId, ctx.signal);
        ad.mediaUrlLocal = d.localUrl;
        ad.mediaHash = d.hash;
        if (a.posterUrl) ad.posterUrlLocal = (await downloadMedia(a.posterUrl, p.client, p.folder, `${a.adId}-poster`, ctx.signal)).localUrl;
      } catch (e) {
        ad.downloadError = e instanceof Error ? e.message : String(e);
        await ctx.log(`Download mislukt voor ad ${a.adId}: ${ad.downloadError}. Het origineel blijft bewaard als reserve.`, "warn");
      }
    }
    out.push(ad);
    if (p.deckId) await saveCandidate(p.deckId, ad);
    await ctx.progress(60 + ((i + 1) / Math.max(1, list.length)) * 40, `Media downloaden ${i + 1}/${list.length}`);
  }
  const failed = out.filter((a) => a.downloadError).length;
  if (failed) warnings.push(`${failed} van de ${out.length} creatives konden niet worden gedownload.`);
  await ctx.log(`Klaar: ${out.length} unieke ads${fromCache ? `, waarvan ${fromCache} uit de cache` : ""}.`);
  return { ads: out, fromCache, warnings };
}

async function saveCandidate(deckId: string, a: ScrapedAd) {
  const data = {
    advertiser: a.advertiser,
    pageName: a.advertiser,
    mediaType: a.mediaType === "unknown" ? "image" : a.mediaType,
    bodyText: a.bodyText,
    startDate: a.startDate ? new Date(`${a.startDate}T00:00:00Z`) : null,
    activeDays: a.activeDays,
    variantCount: a.variantCount,
    country: a.country,
    sourceQuery: a.sourceQuery,
    mediaUrlOriginal: a.mediaUrls[0] ?? "",
    mediaUrlLocal: a.mediaUrlLocal,
    posterUrl: a.posterUrlLocal || a.posterUrl,
    mediaHash: a.mediaHash,
  };
  await db.adCandidate.upsert({ where: { deckId_adId: { deckId, adId: a.adId } }, create: { deckId, adId: a.adId, ...data }, update: data });
}
