import { db } from "../db";
import { buildAdLibrarySearchUrl } from "../adlibrary/url";
import type { AdSearchQuery, RawAd } from "./types";

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Search URL; results from the test fixture page get their own key so they never mix with real ones. */
export const cacheKey = (q: AdSearchQuery) => {
  const fixture = process.env.AD_LIBRARY_FIXTURE_URL;
  return fixture ? `${buildAdLibrarySearchUrl(q)}#fixture=${fixture}` : buildAdLibrarySearchUrl(q);
};

export async function getCached(q: AdSearchQuery, now = Date.now()): Promise<RawAd[] | null> {
  const row = await db.searchCache.findUnique({ where: { key: cacheKey(q) } });
  if (!row || now - row.fetchedAt.getTime() > CACHE_TTL_MS) return null;
  try { return JSON.parse(row.results) as RawAd[]; } catch { return null; }
}

export async function putCached(q: AdSearchQuery, ads: RawAd[]) {
  const key = cacheKey(q);
  const data = { url: key, results: JSON.stringify(ads), fetchedAt: new Date() };
  await db.searchCache.upsert({ where: { key }, create: { key, ...data }, update: data });
}
