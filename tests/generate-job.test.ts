import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { rm } from "node:fs/promises";
import { db } from "@/lib/db";
import { DEFAULT_BRIEFING } from "@/lib/briefing/schema";
import { runGenerateJob } from "@/lib/jobs/generate";
import { setClaudeRunnerForTests, type StructuredCall } from "@/lib/llm/claude";
import { MEDIA_ROOT } from "@/lib/media/storage";
import type { Classification } from "@/lib/pipeline/schemas";
import type { JobContext } from "@/lib/jobs/worker";
import { startFixtureServer } from "./helpers/fixture-server";

const SLUG = `vitest-generate-${Date.now()}`;
let adlib: Awaited<ReturnType<typeof startFixtureServer>>;
let clientId = "";
let deckId = "";
const calls: StructuredCall<unknown>[] = [];

// Fixture ads: 111… Goudsmid & Co (image), 222… Zilverhuis (video), 333… Ring Studio (carousel).
const CLS: Record<string, Partial<Classification>> = {
  "1111111111111": { contentType: "static", relevance: 9, funnel: "bof", whatYouSee: "Productfoto met graveer-aanbod." },
  "2222222222222": { contentType: "ugc", relevance: 7, funnel: "mof", whatYouSee: "Klant laat bedel zien." },
  "3333333333333": { contentType: "static", relevance: 8, aiGenerated: true, whatYouSee: "AI-gegenereerde carrousel." },
};

beforeAll(async () => {
  adlib = await startFixtureServer(path.join(__dirname, "fixtures", "adlib"));
  process.env.AD_LIBRARY_FIXTURE_URL = `${adlib.base}/index.html`;
  setClaudeRunnerForTests(async (call) => {
    calls.push(call as StructuredCall<unknown>);
    const usage = { model: "stub", inputTokens: 1000, outputTokens: 100, costUsd: 0.004 };
    if (call.prompt === "search-plan") {
      return { data: call.schema.parse({ queries: [
        { q: "sieraden cadeau", country: "NL", exactPhrase: false, advertiserFilter: "", serves: "static", rationale: "Thema" },
        { q: "vitest klant ringen", country: "NL", exactPhrase: false, advertiserFilter: "", serves: "any", rationale: "Eigen merk (moet eruit)" },
      ] }), usage };
    }
    const ids = [...String(call.vars.ads).matchAll(/adId (\d+)/g)].map((m) => m[1]);
    if (call.prompt === "classify") {
      return { data: call.schema.parse({ ads: ids.map((adId) => ({
        adId, relevant: true, rejectReason: "", contentType: "static", aiGenerated: false, relevance: 5, quality: 6, gapFit: 5, funnel: "tof", angles: ["gifting"], whatYouSee: "", ...CLS[adId],
      })) }), usage };
    }
    return { data: call.schema.parse({
      items: ids.map((adId) => ({ adId, application: `Toon de Ring Luna 14k zoals ad ${adId}. Goedkoopste deal!`, whyThis: "Lang actief." })),
      summary: ["Focus op cadeaus", "UGC vult het gat"],
    }), usage };
  });

  const client = await db.client.create({ data: { name: "Vitest Klant", slug: SLUG, forbiddenClaims: JSON.stringify(["'goedkoopste'"]) } });
  clientId = client.id;
  const briefing = {
    ...DEFAULT_BRIEFING, clientId,
    period: { type: "evergreen" },
    structure: { static: 1, video_brand: 0, ugc: 1, creator: 0, third_party: 0 },
    inspiration: { ...DEFAULT_BRIEFING.inspiration, countries: ["NL"], aiContent: "avoid" },
  };
  const deck = await db.deck.create({ data: { clientId, title: "Vitest deck", briefing: JSON.stringify(briefing), status: "generating" } });
  deckId = deck.id;
}, 30_000);

afterAll(async () => {
  setClaudeRunnerForTests(null);
  if (clientId) await db.client.delete({ where: { id: clientId } }).catch(() => {});
  await db.searchCache.deleteMany({ where: { key: { contains: "#fixture=" } } });
  delete process.env.AD_LIBRARY_FIXTURE_URL;
  await adlib?.close();
  await rm(path.join(MEDIA_ROOT, SLUG), { recursive: true, force: true });
});

const ctx = (): JobContext => ({ id: "t", payload: { deckId }, signal: new AbortController().signal, progress: async () => {}, log: async () => {} });

describe("runGenerateJob (fixture)", () => {
  it("plans, fetches, classifies, selects, writes texts and saves the deck", async () => {
    const r = await runGenerateJob(ctx());
    expect(r.searches).toBe(1); // the query with the client's own name is dropped
    expect(r.found).toBe(3);
    expect(r.selected).toBe(2);
    expect(r.shortfall).toEqual({});

    const deck = await db.deck.findUniqueOrThrow({ where: { id: deckId }, include: { items: { include: { candidate: true }, orderBy: { position: "asc" } }, candidates: true, usedAdvertisers: true } });
    expect(deck.status).toBe("review");
    expect(deck.summary).toBe("- Focus op cadeaus\n- UGC vult het gat");
    expect(deck.items.map((i) => [i.candidate.advertiser, i.contentType])).toEqual([["Goudsmid & Co", "static"], ["Zilverhuis", "ugc"]]);
    expect(deck.items[0].application).toContain("Ring Luna 14k");
    expect(deck.items[0].whyThis).toMatch(/Controleer: bevat mogelijk "goedkoopste"/);
    expect(deck.items[0].candidate.mediaUrlLocal).toBe(`/media/${SLUG}/${deckId}/1111111111111.svg`);
    const ring = deck.candidates.find((c) => c.adId === "3333333333333")!;
    expect(ring).toMatchObject({ rejected: true, rejectReason: "AI-content vermijden" });
    expect(deck.usedAdvertisers.map((u) => u.advertiser).sort()).toEqual(["Goudsmid & Co", "Zilverhuis"]);

    const copyCall = calls.find((c) => c.prompt === "application")!;
    expect(copyCall.model).toBe("copy");
    expect(copyCall.vars.ads).toContain("Klant laat bedel zien.");
  }, 90_000);

  it("regenerates: pinned ads stay, rejected ads never come back", async () => {
    const items = await db.deckItem.findMany({ where: { deckId }, include: { candidate: true } });
    const zilver = items.find((i) => i.candidate.advertiser === "Zilverhuis")!;
    const goud = items.find((i) => i.candidate.advertiser === "Goudsmid & Co")!;
    await db.deckItem.update({ where: { id: zilver.id }, data: { pinned: true, application: "Met de hand aangepast" } });
    await db.deckItem.update({ where: { id: goud.id }, data: { status: "rejected" } });
    const briefing = JSON.parse((await db.deck.findUniqueOrThrow({ where: { id: deckId } })).briefing);
    briefing.inspiration.aiContent = "mix"; // 2 ads in total → max 1 AI, the pinned one is not AI
    await db.deck.update({ where: { id: deckId }, data: { briefing: JSON.stringify(briefing) } });

    const r = await runGenerateJob(ctx());
    expect(r.selected).toBe(1);
    const deck = await db.deck.findUniqueOrThrow({ where: { id: deckId }, include: { items: { include: { candidate: true }, orderBy: { position: "asc" } }, candidates: true } });
    expect(deck.round).toBe(2);
    expect(deck.items.map((i) => [i.candidate.advertiser, i.pinned, i.position])).toEqual([["Zilverhuis", true, 0], ["Ring Studio", false, 1]]);
    expect(deck.items[0].application).toBe("Met de hand aangepast");
    expect(deck.candidates.find((c) => c.adId === "1111111111111")?.rejectReason).toBe("Eerder afgekeurd door de marketeer");
  }, 90_000);

  it("refuses an incomplete briefing with a clear message", async () => {
    await db.deck.update({ where: { id: deckId }, data: { briefing: JSON.stringify({ ...DEFAULT_BRIEFING, clientId, funnel: [] }) } });
    await expect(runGenerateJob(ctx())).rejects.toThrow(/briefing is niet compleet/);
    expect((await db.deck.findUniqueOrThrow({ where: { id: deckId } })).status).toBe("review"); // keeps earlier results
  });
});
