import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { INDUSTRIES } from "../briefing/options";
import type { Product } from "../client-profile";
import { callStructured, hasApiKey, type ImageInput, type Usage } from "../llm/claude";
import { getCached, putCached } from "../adsource/cache";
import type { AdSearchQuery, RawAd } from "../adsource/types";
import { downloadMedia } from "../media/download";
import { MEDIA_ROOT } from "../media/storage";
import { GapAnalysisSchema, ProfileProposalSchema, gapToNotes, type GapAnalysis, type ProfileProposal } from "../profile/schemas";
import { crawlSite } from "../site/crawl";
import { slugify } from "../utils";
import { createAdSource } from "./scrape";
import type { JobContext } from "./worker";

export const ProfilePayloadSchema = z.object({
  clientId: z.string().optional(),
  clientName: z.string().default(""),
  websiteUrl: z.string().default(""),
  adLibraryPage: z.string().default(""),
  country: z.string().default("NL"),
  profileHint: z.string().default(""), // current profile fields, used for the gap analysis
  doWebsite: z.boolean().default(true),
  doGap: z.boolean().default(true),
  useCache: z.boolean().default(true),
});
export type ProfilePayload = z.infer<typeof ProfilePayloadSchema>;

export type OwnAd = Pick<RawAd, "adId" | "advertiser" | "bodyText" | "mediaType" | "startDate" | "activeDays" | "variantCount" | "isActive" | "adLibraryUrl"> & { mediaUrlLocal: string };

export type ProfileJobResult = {
  site: { url: string; siteName: string; platform: string; pagesRead: number; productsFound: number } | null;
  proposal: ProfileProposal | null;
  products: Product[];
  gap: { adCount: number; ads: OwnAd[]; analysis: GapAnalysis | null; notes: string } | null;
  usage: Usage[];
  costUsd: number;
  warnings: string[];
};

const PAGES_CHAR_BUDGET = 30_000;
const MAX_OWN_ADS = 40;
const MAX_IMAGES = 6;

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Exact-phrase search also returns other advertisers that mention the name: keep the client's own page. */
export function isOwnAd(advertiser: string, page: string): boolean {
  const a = normName(advertiser);
  const p = normName(page);
  return !!a && !!p && (a.includes(p) || p.includes(a));
}

export async function runProfileJob(ctx: JobContext): Promise<ProfileJobResult> {
  const p = ProfilePayloadSchema.parse(ctx.payload);
  const out: ProfileJobResult = { site: null, proposal: null, products: [], gap: null, usage: [], costUsd: 0, warnings: [] };
  const llm = await hasApiKey();
  if (!llm) out.warnings.push("Geen Anthropic API-sleutel ingesteld: de website en eigen ads zijn wel opgehaald, maar niet geanalyseerd. Vul de sleutel in bij Instellingen.");
  const track = (u: Usage) => { out.usage.push(u); out.costUsd += u.costUsd; };

  // 1. Website (0-45%)
  if (p.doWebsite && p.websiteUrl) {
    await ctx.progress(2, "Website lezen…");
    const site = await crawlSite(p.websiteUrl, { signal: ctx.signal, onProgress: (m) => void ctx.log(m) });
    out.products = site.products;
    out.warnings.push(...site.warnings);
    out.site = { url: site.url, siteName: site.siteName, platform: site.platform, pagesRead: site.pages.length, productsFound: site.products.length };
    await ctx.log(`${site.pages.length} pagina's gelezen, ${site.products.length} producten gevonden (${site.platform}).`);
    await ctx.progress(30);

    if (llm) {
      await ctx.progress(32, "Claude analyseert merk en tone of voice…");
      let budget = PAGES_CHAR_BUDGET;
      const pages = site.pages
        .map((pg) => {
          const t = pg.text.slice(0, Math.max(0, budget));
          budget -= t.length;
          return t ? `### ${pg.title || pg.url}\n${pg.url}\n${t}` : "";
        })
        .filter(Boolean)
        .join("\n\n");
      const { data, usage } = await callStructured({
        prompt: "client-profile",
        schema: ProfileProposalSchema,
        vars: {
          industries: INDUSTRIES.map((i) => i.value).join(", "),
          url: site.url,
          siteName: site.siteName,
          description: site.description || "-",
          language: site.language || "-",
          platform: site.platform,
          productCount: String(site.products.length),
          products: site.products.slice(0, 40).map((x) => `- ${x.name}${x.category ? ` | ${x.category}` : ""}${x.price ? ` | ${x.price}` : ""}`).join("\n") || "(geen gevonden)",
          pages,
        },
      });
      if (!INDUSTRIES.some((i) => i.value === data.industry)) data.industry = "";
      out.proposal = data;
      track(usage);
      await ctx.log(`Profielvoorstel klaar (≈ $${usage.costUsd.toFixed(3)}).`);
    }
  } else if (p.doWebsite) {
    out.warnings.push("Geen website-URL ingevuld: websiteanalyse overgeslagen.");
  }
  await ctx.progress(45);

  // 2. Own ads + gap analysis (45-100%)
  if (p.doGap && p.adLibraryPage.trim()) {
    const page = p.adLibraryPage.trim();
    const q: AdSearchQuery = { country: p.country || "NL", q: page, exactPhrase: true, mediaType: "all" };
    let ads = p.useCache ? await getCached(q) : null;
    if (ads) await ctx.log(`Eigen ads uit cache (< 24 uur): ${ads.length}`);
    else {
      await ctx.log(`Eigen ads zoeken in de Ad Library: "${page}" (${q.country})`);
      const source = createAdSource();
      try {
        ads = await source.search(q, { signal: ctx.signal, maxAds: 80, onProgress: (m, f = 0) => void ctx.progress(45 + f * 25, m) });
      } finally {
        await source.close?.();
      }
      if (p.useCache) await putCached(q, ads);
    }
    const own = ads
      .filter((a) => isOwnAd(a.advertiser, page))
      .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))
      .slice(0, MAX_OWN_ADS);
    await ctx.log(`${own.length} eigen ads van "${page}" (van ${ads.length} resultaten).`);
    if (!own.length) out.warnings.push(`Geen eigen ads gevonden voor "${page}" in ${q.country}. Controleer of de paginanaam exact klopt zoals in de Ad Library.`);

    const folder = slugify(p.clientName || page) || "klant";
    const ownAds: OwnAd[] = [];
    for (const [i, a] of own.entries()) {
      let local = "";
      const src = a.mediaType === "video" ? a.posterUrl || a.mediaUrls[0] : a.mediaUrls[0];
      if (src) {
        try {
          local = (await downloadMedia(src, folder, "eigen-ads", a.adId, ctx.signal)).localUrl;
        } catch {
          // the original URL stays as fallback
        }
      }
      ownAds.push({ adId: a.adId, advertiser: a.advertiser, bodyText: a.bodyText, mediaType: a.mediaType, startDate: a.startDate, activeDays: a.activeDays, variantCount: a.variantCount, isActive: a.isActive, adLibraryUrl: a.adLibraryUrl, mediaUrlLocal: local });
      await ctx.progress(70 + ((i + 1) / own.length) * 12, `Creatives downloaden ${i + 1}/${own.length}`);
    }
    out.gap = { adCount: ownAds.length, ads: ownAds, analysis: null, notes: "" };

    if (llm && ownAds.length) {
      await ctx.progress(84, "Claude maakt de gat-analyse…");
      const winners = [...ownAds].sort((a, b) => (b.activeDays ?? 0) * b.variantCount - (a.activeDays ?? 0) * a.variantCount);
      const images = await loadImages(winners.slice(0, MAX_IMAGES));
      const profile = p.profileHint || (out.proposal ? JSON.stringify(out.proposal, null, 2) : `Naam: ${p.clientName}`);
      const { data, usage } = await callStructured({
        prompt: "gap-analysis",
        schema: GapAnalysisSchema,
        images,
        vars: {
          profile,
          adCount: String(ownAds.length),
          ads: ownAds
            .map((a, i) => `${i + 1}. [${a.mediaType}] ${a.isActive ? "actief" : "inactief"}, start ${a.startDate ?? "?"}, ${a.activeDays ?? "?"} dagen, ${a.variantCount} variant(en), ID ${a.adId}\n   ${a.bodyText.replace(/\n/g, " ").slice(0, 400) || "(geen tekst)"}`)
            .join("\n"),
        },
      });
      out.gap.analysis = data;
      out.gap.notes = gapToNotes(data, ownAds.length);
      track(usage);
      await ctx.log(`Gat-analyse klaar (≈ $${usage.costUsd.toFixed(3)}).`);
    }
  } else if (p.doGap) {
    out.warnings.push("Geen pagina-naam in de Ad Library ingevuld: gat-analyse overgeslagen.");
  }

  if (out.usage.length) await ctx.log(`Totale kosten Claude: ≈ $${out.costUsd.toFixed(3)}`);
  return out;
}

const IMG_TYPES: Record<string, ImageInput["mediaType"]> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };

async function loadImages(ads: OwnAd[]): Promise<ImageInput[]> {
  const out: ImageInput[] = [];
  for (const a of ads) {
    if (!a.mediaUrlLocal) continue;
    const file = path.join(MEDIA_ROOT, ...a.mediaUrlLocal.replace(/^\/media\//, "").split("/"));
    const type = IMG_TYPES[path.extname(file).toLowerCase()];
    if (!type) continue;
    const info = await stat(file).catch(() => null);
    if (!info || info.size > 4_500_000) continue;
    out.push({ mediaType: type, base64: (await readFile(file)).toString("base64"), label: `Creative van ad ${a.adId} (${a.activeDays ?? "?"} dagen actief, ${a.variantCount} varianten):` });
  }
  return out;
}
