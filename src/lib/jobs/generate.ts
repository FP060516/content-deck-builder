import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { ANGLES, flatten, type ContentType } from "../briefing/options";
import { BriefingSchema, hydrateBriefing, totalAds, type Briefing } from "../briefing/schema";
import { resolveSearchWindow } from "../briefing/search-window";
import { getCached, putCached } from "../adsource/cache";
import type { AdSearchQuery, RawAd } from "../adsource/types";
import { callStructured, hasApiKey, MissingApiKeyError, type ImageInput, type Usage } from "../llm/claude";
import { imageFromLocal } from "../llm/images";
import { downloadMedia } from "../media/download";
import { briefingText, clientText, LANGUAGE_FOR_COUNTRY } from "../pipeline/describe";
import { CONTENT_ORDER, forbiddenHits, pickForClassification, selectAds, type Decision } from "../pipeline/rank";
import { ClassificationSchema, CopySchema, SearchPlanSchema, type Classification, type PlannedQuery } from "../pipeline/schemas";
import { parseJson } from "../utils";
import { isOwnAd } from "./profile";
import { createAdSource } from "./scrape";
import type { JobContext } from "./worker";

export const GeneratePayloadSchema = z.object({ deckId: z.string() });

const MAX_QUERIES = 10;
const MAX_SEARCHES = 16;
const ADS_PER_SEARCH = 30;
const MARKETER_REPLACED = "Vervangen door marketeer";
const MARKETER_REJECTED = "Eerder afgekeurd door de marketeer";
const CLASSIFY_BATCH = 10;
const MAX_COPY_IMAGES = 24;

type Found = RawAd & { query: string; localThumb: string; localMedia: string; mediaHash: string };

export type GenerateResult = {
  searches: number;
  found: number;
  classified: number;
  selected: number;
  shortfall: Partial<Record<ContentType, number>>;
  costUsd: number;
  warnings: string[];
};

const norm = (s: string) => s.trim().toLowerCase();

/** Media type per search: only statics asked → images; only video types → videos. */
export function mediaTypeFor(b: Briefing): AdSearchQuery["mediaType"] {
  const s = b.structure;
  const video = s.video_brand + s.ugc + s.creator;
  if (b.inspiration.mediaType !== "all") return b.inspiration.mediaType;
  if (s.static > 0 && video === 0 && s.third_party === 0) return "image";
  if (s.static === 0 && video > 0 && s.third_party === 0) return "video";
  return "all";
}

/** Keeps the plan within the briefing: allowed markets, no duplicates, competitor searches at breadth 0. */
export function sanitizePlan(queries: PlannedQuery[], b: Briefing, clientNames: string[]): PlannedQuery[] {
  const countries = b.inspiration.countries;
  const seen = new Set<string>();
  const out: PlannedQuery[] = [];
  const push = (q: PlannedQuery) => {
    const k = `${norm(q.q)}|${q.country}|${q.exactPhrase}`;
    if (!q.q.trim() || seen.has(k)) return;
    if (clientNames.some((n) => n && norm(q.q).includes(norm(n)))) return; // never search the client itself
    seen.add(k);
    out.push(q);
  };
  for (const q of queries) push({ ...q, country: countries.includes(q.country.toUpperCase()) ? q.country.toUpperCase() : countries[0] });
  if (b.inspiration.breadth === 0) {
    for (const c of b.inspiration.competitors) {
      if (!out.some((q) => q.exactPhrase && norm(q.advertiserFilter) === norm(c))) {
        push({ q: c, country: countries[0], exactPhrase: true, advertiserFilter: c, serves: "any", rationale: "Directe concurrent" });
      }
    }
  }
  return out.slice(0, MAX_QUERIES + b.inspiration.competitors.length);
}

export async function runGenerateJob(ctx: JobContext): Promise<GenerateResult> {
  const { deckId } = GeneratePayloadSchema.parse(ctx.payload);
  const deck = await db.deck.findUnique({ where: { id: deckId }, include: { client: true } });
  if (!deck) throw new Error("Deck niet gevonden.");
  try {
    return await generate(ctx, deck);
  } catch (e) {
    await db.deck.update({ where: { id: deckId }, data: { status: (await db.deckItem.count({ where: { deckId } })) ? "review" : "draft" } });
    throw e;
  }
}

async function generate(ctx: JobContext, deck: Prisma.DeckGetPayload<{ include: { client: true } }>): Promise<GenerateResult> {
  const client = deck.client;
  const parsed = BriefingSchema.safeParse(hydrateBriefing(parseJson(deck.briefing, {}), deck.clientId));
  if (!parsed.success) throw new Error(`De briefing is niet compleet: ${parsed.error.issues[0]?.message}`);
  const b = parsed.data;
  if (!(await hasApiKey())) throw new MissingApiKeyError();

  const w = resolveSearchWindow(b.period, b.searchWindow);
  if (!w.ranges.length) throw new Error(`Geen zoekvenster: ${w.warnings.join(" ") || "controleer de periode."}`);
  if (!totalAds(b.structure)) throw new Error("Zet minimaal één contenttype aan.");

  // Regenerating: pinned items stay and take their slot; ads the marketer rejected or replaced never come back.
  const prevItems = await db.deckItem.findMany({ where: { deckId: deck.id }, include: { candidate: true } });
  const pinned = prevItems.filter((i) => i.pinned);
  const pinnedIds = new Set(pinned.map((i) => i.candidate.adId));
  const replaced = await db.adCandidate.findMany({ where: { deckId: deck.id, rejectReason: MARKETER_REPLACED }, select: { adId: true } });
  const rejectedBefore = new Set([...prevItems.filter((i) => i.status === "rejected").map((i) => i.candidate.adId), ...replaced.map((r) => r.adId)]);
  const structure = { ...b.structure };
  for (const p of pinned) if (p.contentType in structure) structure[p.contentType as ContentType] = Math.max(0, structure[p.contentType as ContentType] - 1);
  const bSel: Briefing = { ...b, structure };
  const total = totalAds(structure);
  if (!total) throw new Error("Alle plekken in het deck zijn al gevuld met vastgepinde ads.");
  const target = total * (b.overfetch ? 2 : 1);
  const warnings: string[] = [...w.warnings];
  const usage: Usage[] = [];
  const track = (u: Usage) => usage.push(u);
  const cText = clientText(client);
  const bText = briefingText(b, w);
  const folder = deck.id;
  const clientFolder = client.slug || client.name;
  const forbidden = parseJson<string[]>(client.forbiddenClaims, []);

  // 1. Search plan (0-8%)
  await ctx.progress(2, "Zoekplan maken…");
  const langRules = b.inspiration.countries.map((c) => `${c} → ${LANGUAGE_FOR_COUNTRY[c] ?? "local language"}`).join(", ");
  const plan = await callStructured({
    prompt: "search-plan",
    schema: SearchPlanSchema,
    effort: "medium",
    vars: { client: cText, briefing: bText, languageRules: langRules, countries: b.inspiration.countries.join(", "), minQueries: "4", maxQueries: String(MAX_QUERIES) },
  });
  track(plan.usage);
  const queries = sanitizePlan(plan.data.queries, b, [client.name, client.adLibraryPage]);
  if (!queries.length) throw new Error("Claude kon geen zoektermen bedenken. Vul de briefing of het klantprofiel aan.");
  await ctx.log(`Zoekplan: ${queries.map((q) => `"${q.q}" (${q.country})`).join(", ")}`);

  // 2. Fetch: every query in every search window (8-45%)
  const mediaType = mediaTypeFor(b);
  const searches: AdSearchQuery[] = [];
  const meta = new Map<AdSearchQuery, PlannedQuery>();
  for (const range of w.ranges) for (const q of queries) {
    const s: AdSearchQuery = { country: q.country, q: q.q, exactPhrase: q.exactPhrase, mediaType, range };
    searches.push(s);
    meta.set(s, q);
  }
  if (searches.length > MAX_SEARCHES) warnings.push(`Zoekplan ingekort tot ${MAX_SEARCHES} zoekopdrachten om Meta niet te belasten.`);
  const run = searches.slice(0, MAX_SEARCHES);
  const found = new Map<string, Found>();
  const source = createAdSource();
  try {
    for (const [i, s] of run.entries()) {
      if (ctx.signal.aborted) throw new Error("Geannuleerd");
      const label = `"${s.q}" (${s.country}, ${s.range?.from} t/m ${s.range?.to})`;
      let ads = await getCached(s);
      if (ads) await ctx.log(`Uit cache: ${label}, ${ads.length} ads`);
      else {
        ads = await source.search(s, { signal: ctx.signal, maxAds: ADS_PER_SEARCH, onProgress: (m, f = 0) => void ctx.progress(8 + ((i + f) / run.length) * 37, m) });
        await putCached(s, ads);
        await ctx.log(`${ads.length} ads voor ${label}`, ads.length ? "info" : "warn");
      }
      const filter = meta.get(s)!.advertiserFilter;
      for (const a of ads) {
        if (pinnedIds.has(a.adId)) continue; // already in the deck
        if (filter && !isOwnAd(a.advertiser, filter)) continue; // lesson 3: exact phrase, then filter on advertiser
        if (!found.has(a.adId)) found.set(a.adId, { ...a, query: s.q, localThumb: "", localMedia: "", mediaHash: "" });
      }
      await ctx.progress(8 + ((i + 1) / run.length) * 37, `Zoeken ${i + 1}/${run.length}: ${found.size} unieke ads`);
    }
  } finally {
    await source.close?.();
  }

  // 3. Pre-filter in code (45%)
  const excluded = new Set(b.inspiration.excludeBrands.map(norm));
  if (b.inspiration.excludePreviousAdvertisers) {
    const prev = await db.usedAdvertiser.findMany({ where: { clientId: client.id, deckId: { not: deck.id } }, select: { advertiser: true } });
    prev.forEach((p) => excluded.add(norm(p.advertiser)));
  }
  const ownNames = [client.adLibraryPage, client.name].filter(Boolean);
  const preRejected = new Map<string, string>();
  for (const a of found.values()) {
    if (rejectedBefore.has(a.adId)) preRejected.set(a.adId, MARKETER_REJECTED);
    else if (!a.mediaUrls.length) preRejected.set(a.adId, "Geen media in de kaart");
    else if (ownNames.some((n) => isOwnAd(a.advertiser, n))) preRejected.set(a.adId, "Eigen ad van de klant");
    else if (excluded.has(norm(a.advertiser))) preRejected.set(a.adId, "Uitgesloten merk of al gebruikt in een eerder deck");
  }
  const eligible = [...found.values()].filter((a) => !preRejected.has(a.adId));
  await ctx.log(`${found.size} ads gevonden, ${eligible.length} over na uitsluitingen.`);
  if (!eligible.length) throw new Error("Geen bruikbare ads gevonden. Probeer een ruimere periode, meer markten of een grotere inspiratiebreedte.");

  // 4. Download thumbnails for the ads we will classify (45-52%)
  const budget = Math.max(20, Math.min(90, target * 3));
  const toClassify = pickForClassification(eligible, budget);
  if (eligible.length > budget) await ctx.log(`${budget} van ${eligible.length} ads worden beoordeeld (beste winnaarssignalen eerst).`);
  for (const [i, a] of toClassify.entries()) {
    const thumb = a.mediaType === "video" ? a.posterUrl : a.mediaUrls[0];
    if (thumb) {
      try {
        const d = await downloadMedia(thumb, clientFolder, folder, a.mediaType === "video" ? `${a.adId}-poster` : a.adId, ctx.signal);
        a.localThumb = d.localUrl;
        if (a.mediaType !== "video") { a.localMedia = d.localUrl; a.mediaHash = d.hash; }
        else a.mediaHash = d.hash;
      } catch { /* the original URL stays as fallback */ }
    }
    await ctx.progress(45 + ((i + 1) / toClassify.length) * 7, `Creatives downloaden ${i + 1}/${toClassify.length}`);
  }

  // 5. Classify in batches with images (52-80%)
  const angleKeys = flatten(ANGLES).map((a) => a.value).join(", ");
  const cls = new Map<string, Classification>();
  for (let i = 0; i < toClassify.length; i += CLASSIFY_BATCH) {
    if (ctx.signal.aborted) throw new Error("Geannuleerd");
    const batch = toClassify.slice(i, i + CLASSIFY_BATCH);
    const images = (await Promise.all(batch.map((a) => imageFromLocal(a.localThumb, `adId ${a.adId}:`)))).filter((x): x is ImageInput => !!x);
    const res = await callStructured({
      prompt: "classify",
      schema: ClassificationSchema,
      images,
      effort: "low",
      vars: { client: cText, briefing: bText, angleKeys, count: String(batch.length), ads: batch.map(adLine).join("\n") },
    });
    track(res.usage);
    for (const c of res.data.ads) if (batch.some((a) => a.adId === c.adId)) cls.set(c.adId, c);
    await ctx.progress(52 + ((i + batch.length) / toClassify.length) * 28, `Beoordelen ${Math.min(i + batch.length, toClassify.length)}/${toClassify.length}`);
  }
  const noise = [...cls.values()].filter((c) => !c.relevant).length;
  await ctx.log(`${cls.size} ads beoordeeld, ${noise} als ruis verwijderd.`);

  // 6. Rank and select (80%)
  const sel = selectAds(eligible.map((a) => ({ adId: a.adId, advertiser: a.advertiser, activeDays: a.activeDays, variantCount: a.variantCount, mediaHash: a.mediaHash, cls: cls.get(a.adId) ?? null })), bSel, {
    advertisers: pinned.map((p) => p.candidate.advertiser), hashes: pinned.map((p) => p.candidate.mediaHash).filter(Boolean),
    aiCount: pinned.filter((p) => parseJson<{ cls?: { aiGenerated?: boolean } }>(p.candidate.scores, {}).cls?.aiGenerated).length,
  });
  const decisions = new Map<string, Decision>(sel.decisions.map((d) => [d.adId, d]));
  const chosen = eligible
    .filter((a) => decisions.get(a.adId)?.selected)
    .sort((x, y) => CONTENT_ORDER.indexOf(decisions.get(x.adId)!.contentType!) - CONTENT_ORDER.indexOf(decisions.get(y.adId)!.contentType!) || decisions.get(y.adId)!.scores!.total - decisions.get(x.adId)!.scores!.total);
  const shortNote = Object.entries(sel.shortfall).map(([t, n]) => `${n}× ${t}`).join(", ");
  if (shortNote) warnings.push(`Niet genoeg passende ads gevonden voor: ${shortNote}.`);
  if (!chosen.length) throw new Error("Geen enkele ad kwam door de selectie. Verruim de briefing (periode, markten, breedte).");
  await ctx.log(`${chosen.length} ads geselecteerd.${shortNote ? ` Tekort: ${shortNote}.` : ""}`);

  // 7. Download the full videos of the chosen video ads (80-84%)
  for (const [i, a] of chosen.entries()) {
    if (a.mediaType === "video" && a.mediaUrls[0]) {
      try { a.localMedia = (await downloadMedia(a.mediaUrls[0], clientFolder, folder, a.adId, ctx.signal)).localUrl; }
      catch (e) { await ctx.log(`Video ${a.adId} niet gedownload: ${e instanceof Error ? e.message : e}. Origineel blijft als reserve.`, "warn"); }
    }
    await ctx.progress(80 + ((i + 1) / chosen.length) * 4, `Video's downloaden ${i + 1}/${chosen.length}`);
  }

  // 8. Application texts + summary (84-96%)
  await ctx.progress(85, "Toepassingsteksten schrijven…");
  const copyImages = (await Promise.all(chosen.slice(0, MAX_COPY_IMAGES).map((a) => imageFromLocal(a.localThumb, `adId ${a.adId}:`)))).filter((x): x is ImageInput => !!x);
  const copy = await callStructured({
    prompt: "application",
    schema: CopySchema,
    model: "copy",
    effort: "medium",
    images: copyImages,
    vars: {
      clientName: client.name,
      client: clientText(client, { products: 80 }),
      briefing: bText,
      count: String(chosen.length),
      ads: chosen.map((a) => `${adLine(a)}\n   Wat je ziet: ${cls.get(a.adId)?.whatYouSee ?? "-"}\n   Contenttype: ${decisions.get(a.adId)!.contentType}`).join("\n"),
      notes: [...warnings, `Gevonden: ${found.size} ads, beoordeeld: ${cls.size}, ruis: ${noise}.`].join("\n"),
    },
  });
  track(copy.usage);
  const texts = new Map(copy.data.items.map((x) => [x.adId, x]));

  // 9. Save (96-100%)
  await ctx.progress(96, "Deck opslaan…");
  const round = deck.round + (prevItems.length ? 1 : 0);
  await db.$transaction(async (tx) => {
    await tx.deckItem.deleteMany({ where: { deckId: deck.id, pinned: false } });
    await tx.adCandidate.deleteMany({ where: { deckId: deck.id, id: { notIn: pinned.map((p) => p.candidateId) } } });
    for (const [pos, p] of pinned.entries()) await tx.deckItem.update({ where: { id: p.id }, data: { position: pos } });
    await tx.usedAdvertiser.deleteMany({ where: { deckId: deck.id } });
    const all = [...found.values()];
    for (const a of all) {
      const d = decisions.get(a.adId);
      const pre = preRejected.get(a.adId);
      await tx.adCandidate.create({
        data: {
          deckId: deck.id, adId: a.adId, advertiser: a.advertiser, pageName: a.advertiser,
          mediaType: a.mediaType === "unknown" ? "image" : a.mediaType, contentType: d?.contentType ?? null,
          bodyText: a.bodyText, startDate: a.startDate ? new Date(`${a.startDate}T00:00:00Z`) : null,
          activeDays: a.activeDays, variantCount: a.variantCount, country: a.country, sourceQuery: a.query,
          mediaUrlOriginal: a.mediaUrls[0] ?? "", mediaUrlLocal: a.localMedia, posterUrl: a.localThumb && a.mediaType === "video" ? a.localThumb : a.posterUrl,
          mediaHash: a.mediaHash, scores: JSON.stringify({ ...(d?.scores ?? {}), cls: cls.get(a.adId) ?? null }),
          scoreTotal: d?.scores?.total ?? 0, scoreReason: cls.get(a.adId)?.whatYouSee ?? "",
          rejected: !d?.selected, rejectReason: pre ?? d?.reason ?? "", round,
        },
      });
    }
    const candidates = await tx.adCandidate.findMany({ where: { deckId: deck.id, rejected: false }, select: { id: true, adId: true } });
    const idOf = new Map(candidates.map((c) => [c.adId, c.id]));
    for (const [pos, a] of chosen.entries()) {
      const t = texts.get(a.adId);
      const application = t?.application ?? "";
      const hits = forbiddenHits(application, forbidden);
      const why = [t?.whyThis ?? "", hits.length ? `⚠ Controleer: bevat mogelijk "${hits.join('", "')}".` : ""].filter(Boolean).join(" ");
      await tx.deckItem.create({
        data: {
          deckId: deck.id, candidateId: idOf.get(a.adId)!, contentType: decisions.get(a.adId)!.contentType!, position: pinned.length + pos,
          whatYouSee: cls.get(a.adId)?.whatYouSee ?? "", application, whyThis: why, funnelTag: cls.get(a.adId)?.funnel ?? "",
        },
      });
    }
    for (const adv of new Set([...chosen.map((a) => a.advertiser), ...pinned.map((p) => p.candidate.advertiser)].filter(Boolean))) {
      await tx.usedAdvertiser.create({ data: { clientId: client.id, deckId: deck.id, advertiser: adv } });
    }
    await tx.deck.update({ where: { id: deck.id }, data: { status: "review", round, summary: copy.data.summary.map((s) => `- ${s}`).join("\n") } });
  }, { timeout: 60_000 });

  const costUsd = usage.reduce((s, u) => s + u.costUsd, 0);
  if (pinned.length) await ctx.log(`${pinned.length} vastgepinde ads zijn blijven staan.`);
  await ctx.log(`Klaar: ${chosen.length} ads in het deck. Kosten Claude ≈ $${costUsd.toFixed(2)}.`);
  return { searches: run.length, found: found.size, classified: cls.size, selected: chosen.length, shortfall: sel.shortfall, costUsd, warnings };
}

function adLine(a: Found): string {
  return `- adId ${a.adId} | ${a.advertiser || "?"} | ${a.mediaType} | ${a.country} | ${a.isActive === false ? "inactief" : "actief"} | ${a.activeDays ?? "?"} dagen | ${a.variantCount} variant(en) | zoekterm "${a.query}"\n   Tekst: ${a.bodyText.replace(/\s+/g, " ").slice(0, 350) || "(geen)"}`;
}
