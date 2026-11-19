import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { rm } from "node:fs/promises";
import { runProfileJob, isOwnAd, type ProfileJobResult } from "@/lib/jobs/profile";
import { setClaudeRunnerForTests, type StructuredCall } from "@/lib/llm/claude";
import { gapToNotes, type GapAnalysis, type ProfileProposal } from "@/lib/profile/schemas";
import { buildPatch } from "@/lib/profile/patch";
import { EMPTY_CLIENT } from "@/lib/client-profile";
import { MEDIA_ROOT } from "@/lib/media/storage";
import type { JobContext } from "@/lib/jobs/worker";
import { startFixtureServer } from "./helpers/fixture-server";

const PROPOSAL: ProfileProposal = {
  industry: "Sieraden", positioning: "premium", language: "nl", country: "NL",
  toneSummary: "Warm en persoonlijk, je-vorm.", toneExamples: ["Jij kiest, wij graveren."], usps: ["Gratis graveren", "Voor 23:00 besteld, morgen in huis"],
  forbiddenClaims: ["goedkoopste"], competitors: ["Merk A"], notes: [],
};
const GAP: GapAnalysis = {
  summary: "Weinig video.", doesWell: ["Sterke productfoto's"], likelyWinners: ["Kerstcadeau-ad"],
  gaps: [{ gap: "Geen UGC", funnel: "mof", priority: "high" }, { gap: "Geen retentie-ads", funnel: "retention", priority: "low" }],
};

let shop: Awaited<ReturnType<typeof startFixtureServer>>;
let adlib: Awaited<ReturnType<typeof startFixtureServer>>;
const calls: StructuredCall<unknown>[] = [];

beforeAll(async () => {
  shop = await startFixtureServer(path.join(__dirname, "fixtures", "shop"), {
    "/": "index.html", "/over-ons": "over-ons.html", "/products.json": "products.json", "/robots.txt": "robots.txt",
  });
  adlib = await startFixtureServer(path.join(__dirname, "fixtures", "adlib"));
  process.env.AD_LIBRARY_FIXTURE_URL = `${adlib.base}/index.html`;
  setClaudeRunnerForTests(async (call) => {
    calls.push(call as StructuredCall<unknown>);
    const data = call.prompt === "client-profile" ? PROPOSAL : GAP;
    return { data: call.schema.parse(data), usage: { model: "stub", inputTokens: 1000, outputTokens: 200, costUsd: 0.006 } };
  });
}, 30_000);

afterAll(async () => {
  setClaudeRunnerForTests(null);
  delete process.env.AD_LIBRARY_FIXTURE_URL;
  await shop.close();
  await adlib.close();
  await rm(path.join(MEDIA_ROOT, "vitest-klant"), { recursive: true, force: true });
});

const ctx = (payload: unknown): JobContext => ({
  id: "test", payload, signal: new AbortController().signal, progress: async () => {}, log: async () => {},
});

describe("runProfileJob", () => {
  it("crawls, proposes a profile, finds own ads and writes a gap analysis", async () => {
    const r = (await runProfileJob(ctx({ clientName: "vitest klant", websiteUrl: shop.base, adLibraryPage: "Goudsmid & Co", country: "NL", useCache: false }))) as ProfileJobResult;
    expect(r.site).toMatchObject({ platform: "shopify", productsFound: 3 });
    expect(r.proposal?.industry).toBe("Sieraden");
    expect(r.gap?.adCount).toBe(1); // only Goudsmid & Co, not Zilverhuis / Ring Studio
    expect(r.gap?.ads[0].mediaUrlLocal).toMatch(/^\/media\/vitest-klant\/eigen-ads\/1111111111111\.svg$/);
    expect(r.gap?.notes).toContain("[MOF · hoog] Geen UGC");
    expect(r.costUsd).toBeCloseTo(0.012);
    const profileCall = calls.find((c) => c.prompt === "client-profile")!;
    expect(profileCall.vars.products).toContain("Ring Luna 14k | Ringen | € 149.00");
    expect(profileCall.vars.pages).toContain("met de hand");
    const gapCall = calls.find((c) => c.prompt === "gap-analysis")!;
    expect(gapCall.vars.ads).toContain("Het perfecte kerstcadeau");
  }, 60_000);

  it("skips steps with a clear warning when inputs are missing", async () => {
    const r = await runProfileJob(ctx({ clientName: "x", websiteUrl: "", adLibraryPage: "" }));
    expect(r.warnings.join(" ")).toMatch(/Geen website-URL/);
    expect(r.warnings.join(" ")).toMatch(/Geen pagina-naam/);
  });
});

describe("helpers", () => {
  it("matches own advertiser names loosely", () => {
    expect(isOwnAd("Goudsmid & Co", "Goudsmid & Co")).toBe(true);
    expect(isOwnAd("Goudsmid & Co NL", "goudsmid & co")).toBe(true);
    expect(isOwnAd("Zilverhuis", "Goudsmid & Co")).toBe(false);
    expect(isOwnAd("", "Goudsmid")).toBe(false);
  });
  it("sorts gaps by priority in the notes", () => {
    const n = gapToNotes(GAP, 3);
    expect(n.indexOf("Geen UGC")).toBeLessThan(n.indexOf("Geen retentie-ads"));
  });
  it("buildPatch merges lists and products instead of overwriting", () => {
    const current = { ...EMPTY_CLIENT, name: "K", usps: ["gratis graveren"], products: [{ name: "Ring Luna 14k", category: "", price: "", url: "" }] };
    const r: ProfileJobResult = { site: null, proposal: PROPOSAL, products: [{ name: "Ring Luna 14k", category: "Ringen", price: "", url: "" }, { name: "Ketting Stella", category: "", price: "", url: "" }], gap: null, usage: [], costUsd: 0, warnings: [] };
    const p = buildPatch(r, current, new Set(["usps", "products", "basics"]));
    expect(p.usps).toEqual(["gratis graveren", "Voor 23:00 besteld, morgen in huis"]);
    expect(p.products?.map((x) => x.name)).toEqual(["Ring Luna 14k", "Ketting Stella"]);
    expect(p.positioning).toBe("premium");
    expect(p.toneSummary).toBeUndefined();
  });
});
