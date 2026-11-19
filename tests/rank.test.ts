import { describe, expect, it } from "vitest";
import { DEFAULT_BRIEFING, type Briefing } from "@/lib/briefing/schema";
import { aiCap, forbiddenHits, pickForClassification, selectAds, winnerScore, type RankInput } from "@/lib/pipeline/rank";
import type { Classification } from "@/lib/pipeline/schemas";
import { mediaTypeFor, sanitizePlan } from "@/lib/jobs/generate";

const brief = (o: Partial<Briefing> = {}, insp: Partial<Briefing["inspiration"]> = {}): Briefing => ({
  ...DEFAULT_BRIEFING, clientId: "c", ...o, inspiration: { ...DEFAULT_BRIEFING.inspiration, ...insp },
});
const cls = (o: Partial<Classification> = {}): Classification => ({
  adId: "x", relevant: true, rejectReason: "", contentType: "static", aiGenerated: false,
  relevance: 7, quality: 6, gapFit: 5, funnel: "tof", angles: [], whatYouSee: "", ...o,
});
const ad = (adId: string, advertiser: string, c: Partial<Classification> | null, extra: Partial<RankInput> = {}): RankInput => ({
  adId, advertiser, activeDays: 30, variantCount: 1, mediaHash: adId, cls: c ? cls({ adId, ...c }) : null, ...extra,
});

describe("winnerScore", () => {
  it("rises with run time and variants, capped at 10", () => {
    expect(winnerScore(0, 1)).toBe(0);
    expect(winnerScore(10, 1)).toBeLessThan(winnerScore(60, 1));
    expect(winnerScore(60, 1)).toBeLessThan(winnerScore(60, 4));
    expect(winnerScore(500, 50)).toBe(10);
  });
});

describe("aiCap", () => {
  it("never lets a deck be only AI by itself", () => {
    expect(aiCap("avoid", 10)).toBe(0);
    expect(aiCap("mix", 10)).toBe(5);
    expect(aiCap("allow", 10)).toBe(9);
    expect(aiCap("allow", 1)).toBe(0);
  });
});

describe("selectAds", () => {
  const structure = { static: 2, video_brand: 0, ugc: 1, creator: 0, third_party: 0 };

  it("fills slots per content type by score", () => {
    const r = selectAds([
      ad("1", "A", { relevance: 9 }), ad("2", "B", { relevance: 3 }), ad("3", "C", { relevance: 8 }),
      ad("4", "D", { contentType: "ugc", relevance: 6 }), ad("5", "E", { contentType: "ugc", relevance: 9 }),
    ], brief({ structure }));
    const picked = r.decisions.filter((d) => d.selected).map((d) => d.adId).sort();
    expect(picked).toEqual(["1", "3", "5"]);
    expect(r.decisions.find((d) => d.adId === "2")?.reason).toMatch(/hogere score/);
    expect(r.shortfall).toEqual({});
  });

  it("respects max per advertiser, duplicate creatives, noise and min days", () => {
    const r = selectAds([
      ad("1", "Merk", { relevance: 9 }), ad("2", "merk ", { relevance: 9 }), ad("3", "Merk", { relevance: 9 }),
      ad("4", "Z", { relevance: 9 }, { mediaHash: "1" }),
      ad("5", "N", { relevant: false, rejectReason: "Museum" }),
      ad("6", "Kort", { relevance: 9 }, { activeDays: 2 }),
      ad("7", "Niet beoordeeld", null),
    ], brief({ structure: { ...structure, static: 5 } }, { maxPerAdvertiser: 2, minActiveDays: 7 }));
    const by = Object.fromEntries(r.decisions.map((d) => [d.adId, d]));
    expect([by["1"].selected, by["2"].selected, by["3"].selected]).toEqual([true, true, false]);
    expect(by["3"].reason).toMatch(/Al 2 ads/);
    expect(by["4"].reason).toMatch(/Dezelfde creative/);
    expect(by["5"].reason).toBe("Ruis: Museum");
    expect(by["6"].reason).toMatch(/Minder dan 7/);
    expect(by["7"].reason).toMatch(/Niet beoordeeld/);
    expect(r.shortfall).toEqual({ static: 3, ugc: 1 });
  });

  it("applies the AI-content setting", () => {
    const ads = [ad("1", "A", { aiGenerated: true, relevance: 10 }), ad("2", "B", { aiGenerated: true, relevance: 9 }), ad("3", "C", { relevance: 2 })];
    const s = { static: 2, video_brand: 0, ugc: 0, creator: 0, third_party: 0 };
    const pick = (mode: Briefing["inspiration"]["aiContent"]) => selectAds(ads, brief({ structure: s }, { aiContent: mode })).decisions.filter((d) => d.selected).map((d) => d.adId);
    expect(pick("avoid")).toEqual(["3"]);
    expect(pick("mix")).toEqual(["1", "3"]);
    expect(pick("allow")).toEqual(["1", "3"]); // 2 slots, max 1 AI: never only AI
  });
});

describe("helpers", () => {
  it("classifies the strongest winner signals first", () => {
    const r = pickForClassification([{ id: 1, activeDays: 3, variantCount: 1 }, { id: 2, activeDays: 80, variantCount: 3 }, { id: 3, activeDays: 20, variantCount: 1 }], 2);
    expect(r.map((x) => x.id)).toEqual([2, 3]);
  });
  it("flags forbidden claims", () => {
    expect(forbiddenHits("De goedkoopste ring van NL!", ["'goedkoopste'", "Geen 'levenslange garantie'"])).toEqual(["goedkoopste"]);
    expect(forbiddenHits("Met levenslange garantie", ["Geen 'levenslange garantie'"])).toEqual(["levenslange garantie"]);
  });
  it("chooses the media type from the structure", () => {
    expect(mediaTypeFor(brief({ structure: { static: 3, video_brand: 0, ugc: 0, creator: 0, third_party: 0 } }))).toBe("image");
    expect(mediaTypeFor(brief({ structure: { static: 0, video_brand: 2, ugc: 1, creator: 0, third_party: 0 } }))).toBe("video");
    expect(mediaTypeFor(brief({ structure: { static: 1, video_brand: 1, ugc: 0, creator: 0, third_party: 0 } }))).toBe("all");
  });
  it("sanitizes the search plan", () => {
    const q = (o: Partial<Parameters<typeof sanitizePlan>[0][number]>) => ({ q: "kerstcadeau", country: "NL", exactPhrase: false, advertiserFilter: "", serves: "any" as const, rationale: "", ...o });
    const out = sanitizePlan([q({}), q({}), q({ country: "US" }), q({ q: "Goudsmid ringen" })], brief({}, { countries: ["NL", "BE"], breadth: 0, competitors: ["Merk X"] }), ["Goudsmid"]);
    expect(out.map((x) => `${x.q}|${x.country}|${x.exactPhrase}`)).toEqual(["kerstcadeau|NL|false", "Merk X|NL|true"]);
  });
});
