import type { ContentType } from "../briefing/options";
import type { Briefing } from "../briefing/schema";
import type { Classification } from "./schemas";

export type RankInput = {
  adId: string;
  advertiser: string;
  activeDays: number | null;
  variantCount: number;
  mediaHash: string;
  cls: Classification | null; // null = not classified (e.g. over budget)
};

export type Scores = { relevance: number; quality: number; gapFit: number; winner: number; total: number };
export type Decision = { adId: string; selected: boolean; contentType: ContentType | null; scores: Scores | null; reason: string };

export const CONTENT_ORDER: ContentType[] = ["static", "video_brand", "ugc", "creator", "third_party"];

const clamp = (n: number) => Math.max(0, Math.min(10, Number.isFinite(n) ? n : 0));

/**
 * Winner proxy (lesson 12): long-running ads and ads with several variants are probably winners.
 * 0-10. Days saturate around 90, variants around 8.
 */
export function winnerScore(activeDays: number | null, variants: number): number {
  const d = Math.min(1, Math.log1p(Math.max(0, activeDays ?? 0)) / Math.log1p(90));
  const v = Math.min(1, Math.log2(Math.max(1, variants)) / 3);
  return Math.round((0.65 * d + 0.35 * v) * 100) / 10;
}

/** Weights: briefing fit first, then winner proxy, gap fit (lesson 11) and craft. */
export function scoreOf(c: Classification, activeDays: number | null, variants: number): Scores {
  const relevance = clamp(c.relevance);
  const quality = clamp(c.quality);
  const gapFit = clamp(c.gapFit);
  const winner = winnerScore(activeDays, variants);
  const total = Math.round((0.35 * relevance + 0.25 * winner + 0.2 * gapFit + 0.2 * quality) * 100) / 100;
  return { relevance, quality, gapFit, winner, total };
}

/** Max number of AI-generated ads in a deck of `total` (lesson 13: never only AI by itself). */
export function aiCap(mode: Briefing["inspiration"]["aiContent"], total: number): number {
  if (mode === "avoid") return 0;
  if (mode === "mix") return Math.floor(total / 2);
  return Math.max(0, total - 1);
}

export type Selection = { decisions: Decision[]; shortfall: Partial<Record<ContentType, number>> };

/**
 * Fills the content-type slots from the structure, best score first, with max ads per advertiser
 * (lesson 8), no duplicate creatives, the AI cap and the minimum active days.
 */
export function selectAds(inputs: RankInput[], b: Briefing, preset: { advertisers?: string[]; hashes?: string[]; aiCount?: number } = {}): Selection {
  const quota = { ...b.structure } as Record<ContentType, number>;
  const total = CONTENT_ORDER.reduce((s, t) => s + quota[t], 0);
  // The AI cap counts over the whole deck, including items that are already in it (pinned).
  const fixed = preset.advertisers?.length ?? 0;
  const maxAi = Math.max(0, aiCap(b.inspiration.aiContent, total + fixed) - (preset.aiCount ?? 0));
  const minDays = b.inspiration.minActiveDays;

  const decisions = new Map<string, Decision>();
  const pool: { input: RankInput; scores: Scores; type: ContentType }[] = [];
  for (const i of inputs) {
    if (!i.cls) { decisions.set(i.adId, { adId: i.adId, selected: false, contentType: null, scores: null, reason: "Niet beoordeeld (buiten het budget voor classificatie)" }); continue; }
    const scores = scoreOf(i.cls, i.activeDays, i.variantCount);
    const base = { adId: i.adId, selected: false, contentType: i.cls.contentType, scores };
    if (!i.cls.relevant) { decisions.set(i.adId, { ...base, reason: `Ruis: ${i.cls.rejectReason || "niet relevant"}` }); continue; }
    if (minDays && (i.activeDays ?? 0) < minDays) { decisions.set(i.adId, { ...base, reason: `Minder dan ${minDays} actieve dagen` }); continue; }
    if (b.inspiration.aiContent === "avoid" && i.cls.aiGenerated) { decisions.set(i.adId, { ...base, reason: "AI-content vermijden" }); continue; }
    pool.push({ input: i, scores, type: i.cls.contentType });
  }

  pool.sort((a, b2) => b2.scores.total - a.scores.total);
  const key0 = (s: string) => s.trim().toLowerCase();
  const perAdvertiser = new Map<string, number>();
  for (const a of preset.advertisers ?? []) perAdvertiser.set(key0(a), (perAdvertiser.get(key0(a)) ?? 0) + 1); // e.g. pinned items
  const hashes = new Set<string>(preset.hashes ?? []);
  const filled: Record<ContentType, number> = { static: 0, video_brand: 0, ugc: 0, creator: 0, third_party: 0 };
  let ai = 0;
  const key = (s: string) => s.trim().toLowerCase();

  for (const { input, scores, type } of pool) {
    const base = { adId: input.adId, contentType: type, scores };
    const reject = (reason: string) => decisions.set(input.adId, { ...base, selected: false, reason });
    if (filled[type] >= quota[type]) { reject(quota[type] ? `Genoeg ${type} gevonden met een hogere score` : `Contenttype ${type} niet gevraagd`); continue; }
    if ((perAdvertiser.get(key(input.advertiser)) ?? 0) >= b.inspiration.maxPerAdvertiser) { reject(`Al ${b.inspiration.maxPerAdvertiser} ads van ${input.advertiser}`); continue; }
    if (input.mediaHash && hashes.has(input.mediaHash)) { reject("Dezelfde creative staat er al in"); continue; }
    if (input.cls!.aiGenerated && ai >= maxAi) { reject("Maximum aan AI-content bereikt"); continue; }
    filled[type]++;
    perAdvertiser.set(key(input.advertiser), (perAdvertiser.get(key(input.advertiser)) ?? 0) + 1);
    if (input.mediaHash) hashes.add(input.mediaHash);
    if (input.cls!.aiGenerated) ai++;
    decisions.set(input.adId, { ...base, selected: true, reason: "" });
  }

  const shortfall: Partial<Record<ContentType, number>> = {};
  for (const t of CONTENT_ORDER) if (filled[t] < quota[t]) shortfall[t] = quota[t] - filled[t];
  return { decisions: inputs.map((i) => decisions.get(i.adId)!), shortfall };
}

/** Which ads get classified when there are more than the budget: best winner proxy first. */
export function pickForClassification<T extends { activeDays: number | null; variantCount: number }>(ads: T[], budget: number): T[] {
  return [...ads].sort((a, b) => winnerScore(b.activeDays, b.variantCount) - winnerScore(a.activeDays, a.variantCount)).slice(0, budget);
}

/** Flags forbidden claims that slipped into a text (case-insensitive, quotes ignored). */
export function forbiddenHits(text: string, forbidden: string[]): string[] {
  const t = text.toLowerCase();
  return forbidden
    .map((f) => f.replace(/^geen\s+/i, "").replace(/['"‘’“”]/g, "").trim())
    .filter((f) => f.length >= 3 && t.includes(f.toLowerCase()));
}
