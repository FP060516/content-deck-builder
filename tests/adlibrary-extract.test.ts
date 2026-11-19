import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { chromium, type Browser } from "playwright";
import { extractCardsInPage } from "@/lib/adsource/extract-in-page";
import { toRawAd } from "@/lib/adsource/playwright-source";

const DIR = path.join(__dirname, "fixtures", "adlib");
let server: http.Server;
let base = "";
let browser: Browser;

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const name = (req.url ?? "/").split("?")[0].replace(/^\/+/, "") || "index.html";
    try {
      const body = await readFile(path.join(DIR, path.basename(name)));
      res.writeHead(200, { "Content-Type": name.endsWith(".svg") ? "image/svg+xml" : "text/html" }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  browser = await chromium.launch();
}, 30_000);

afterAll(async () => { await browser?.close(); server?.close(); });

describe("extractCardsInPage (fixture)", () => {
  it("finds the three real cards, skips the one without media", async () => {
    const page = await browser.newPage();
    await page.goto(`${base}/index.html`, { waitUntil: "load" });
    const cards = await page.evaluate(extractCardsInPage);
    expect(cards.map((c) => c.adId)).toEqual(["1111111111111", "2222222222222", "3333333333333"]);

    const q = { country: "NL", q: "sieraden cadeau" };
    const [a, b, c] = cards.map((card) => toRawAd(card, q, "2025-12-12"));
    expect(a).toMatchObject({ advertiser: "Goudsmid & Co", pageUrl: "https://www.facebook.com/goudsmidco", mediaType: "image", isActive: true, startDate: "2025-12-03", activeDays: 10, variantCount: 2 });
    expect(a.mediaUrls).toEqual([`${base}/img1.svg`]); // avatar (32px) excluded
    expect(a.bodyText).toBe("Het perfecte kerstcadeau ✨\nGratis graveren tot 20 december.\nGOUDSMID.NL");
    expect(b).toMatchObject({ advertiser: "Zilverhuis", mediaType: "video", isActive: false, activeDays: 20, variantCount: 3, posterUrl: `${base}/img2.svg` });
    expect(b.mediaUrls).toEqual([`${base}/clip.mp4`]);
    expect(c).toMatchObject({ advertiser: "Ring Studio", mediaType: "carousel", startDate: "2025-11-28" });
    expect(c.adLibraryUrl).toBe("https://www.facebook.com/ads/library/?id=3333333333333");
    await page.close();
  }, 30_000);
});
