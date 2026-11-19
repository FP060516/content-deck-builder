import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { crawlSite, normalizeUrl, pageText, robotsAllows } from "@/lib/site/crawl";
import { startFixtureServer } from "./helpers/fixture-server";

const ROUTES = {
  "/": "index.html", "/over-ons": "over-ons.html", "/collections/ringen": "ringen.html", "/pages/verzending": "verzending.html",
  "/products/ring-luna": "ring-luna.html", "/products.json": "products.json", "/robots.txt": "robots.txt",
};
let srv: Awaited<ReturnType<typeof startFixtureServer>>;
beforeAll(async () => { srv = await startFixtureServer(path.join(__dirname, "fixtures", "shop"), ROUTES); });
afterAll(async () => { await srv.close(); });

describe("crawl helpers", () => {
  it("normalizes URLs", () => {
    expect(normalizeUrl("goudsmid.nl")).toBe("https://goudsmid.nl/");
    expect(normalizeUrl(" https://x.nl/a#b ")).toBe("https://x.nl/a");
  });
  it("honours robots.txt for *", () => {
    const r = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin\n";
    expect(robotsAllows(r, "/admin/login")).toBe(false);
    expect(robotsAllows(r, "/over-ons")).toBe(true);
  });
  it("extracts visible text without scripts", () => {
    const t = pageText("<html lang='nl-NL'><head><title>T</title></head><body><p>Hallo</p><script>x()</script></body></html>");
    expect(t).toMatchObject({ title: "T", lang: "nl", text: "Hallo" });
  });
});

describe("crawlSite (fixture shop)", () => {
  it("reads brand pages and the Shopify catalogue, skips robots-disallowed pages", async () => {
    const s = await crawlSite(srv.base);
    expect(s.siteName).toBe("Goudsmid & Co");
    expect(s.language).toBe("nl");
    expect(s.platform).toBe("shopify");
    expect(s.products.map((p) => p.name)).toEqual(["Ring Luna 14k", "Ketting Stella", "Oorbellen Nova"]);
    expect(s.products[0]).toMatchObject({ category: "Ringen", price: "€ 149.00", url: `${srv.base}/products/ring-luna` });
    const urls = s.pages.map((p) => new URL(p.url).pathname);
    expect(urls[0]).toBe("/");
    expect(urls).toContain("/over-ons");
    expect(urls).not.toContain("/admin/login");
    expect(s.pages.find((p) => p.url.endsWith("/over-ons"))?.text).toContain("met de hand");
    expect(s.pages[0].text).not.toContain("not text");
  }, 30_000);
});
