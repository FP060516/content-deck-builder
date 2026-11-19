import * as cheerio from "cheerio";
import type { Product } from "../client-profile";

export type SitePage = { url: string; title: string; text: string };
export type SiteSnapshot = {
  url: string;
  siteName: string;
  description: string;
  language: string;
  platform: "shopify" | "woocommerce" | "jsonld" | "none";
  pages: SitePage[];
  products: Product[];
  warnings: string[];
};

const UA = "Mozilla/5.0 (compatible; ContentDeckBuilder/1.0; internal inspiration tool)";
const PAGE_TEXT_LIMIT = 6000;
const MAX_PRODUCTS = 250;
const PAUSE_MS = 700;

/** Pages that say most about brand, tone and USPs, in priority order. */
const PRIORITY = [
  /over-ons|about|ons-verhaal|our-story|wie-zijn-wij|merk|brand/i,
  /collect|categor|shop|winkel|assortiment/i,
  /verzend|shipping|bezorg|delivery|retour|return/i,
  /faq|veelgestelde|klantenservice|service/i,
  /review|ervaring/i,
];

export function normalizeUrl(input: string): string {
  const s = input.trim();
  const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  u.hash = "";
  return u.toString();
}

async function get(url: string, signal?: AbortSignal): Promise<Response | null> {
  try {
    const ctrl = AbortSignal.timeout(15_000);
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/json;q=0.9,*/*;q=0.8" }, redirect: "follow", signal: signal ? AbortSignal.any([signal, ctrl]) : ctrl });
    return res.ok ? res : null;
  } catch {
    if (signal?.aborted) throw new Error("Geannuleerd");
    return null;
  }
}

/** Very small robots.txt check: honours "Disallow" rules for User-agent: *. */
export function robotsAllows(robots: string, path: string): boolean {
  let applies = false;
  const rules: string[] = [];
  for (const line of robots.split(/\r?\n/)) {
    const [k, ...rest] = line.split(":");
    const v = rest.join(":").trim();
    const key = k.trim().toLowerCase();
    if (key === "user-agent") applies = v === "*";
    else if (applies && key === "disallow" && v) rules.push(v);
  }
  return !rules.some((r) => path.startsWith(r.replace(/\*.*$/, "")));
}

export function pageText(html: string): { title: string; text: string; description: string; siteName: string; lang: string } {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const siteName = $('meta[property="og:site_name"]').attr("content")?.trim() ?? "";
  const lang = ($("html").attr("lang") ?? "").slice(0, 2).toLowerCase();
  $("script, style, noscript, svg, iframe, template").remove();
  const text = $("body").text().replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{2,}/g, "\n").trim();
  return { title, description, siteName, lang, text: text.slice(0, PAGE_TEXT_LIMIT) };
}

export function jsonLdProducts(html: string, pageUrl: string): Product[] {
  const $ = cheerio.load(html);
  const out: Product[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const o = node as Record<string, unknown>;
    if (o["@graph"]) visit(o["@graph"]);
    const type = o["@type"];
    if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) {
      const offers = (Array.isArray(o.offers) ? o.offers[0] : o.offers) as Record<string, unknown> | undefined;
      const price = offers?.price ?? offers?.lowPrice;
      out.push({
        name: String(o.name ?? "").trim(),
        category: String(o.category ?? "").trim(),
        price: price ? `€ ${price}` : "",
        url: String(o.url ?? pageUrl),
      });
    }
    if (o.itemListElement) visit(o.itemListElement);
    if (o.item) visit(o.item);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try { visit(JSON.parse($(el).text())); } catch { /* ignore broken JSON-LD */ }
  });
  return out.filter((p) => p.name);
}

type ShopifyProduct = { title: string; handle: string; product_type?: string; variants?: { price?: string }[] };
async function shopifyProducts(origin: string, signal?: AbortSignal): Promise<Product[] | null> {
  const res = await get(`${origin}/products.json?limit=250`, signal);
  if (!res) return null;
  try {
    const data = (await res.json()) as { products?: ShopifyProduct[] };
    if (!Array.isArray(data.products)) return null;
    return data.products.map((p) => ({
      name: p.title.trim(),
      category: p.product_type?.trim() ?? "",
      price: p.variants?.[0]?.price ? `€ ${p.variants[0].price}` : "",
      url: `${origin}/products/${p.handle}`,
    }));
  } catch { return null; }
}

type WooProduct = { name: string; permalink: string; prices?: { price?: string; currency_minor_unit?: number }; categories?: { name: string }[] };
async function wooProducts(origin: string, signal?: AbortSignal): Promise<Product[] | null> {
  const res = await get(`${origin}/wp-json/wc/store/v1/products?per_page=100`, signal);
  if (!res) return null;
  try {
    const data = (await res.json()) as WooProduct[];
    if (!Array.isArray(data)) return null;
    return data.map((p) => {
      const minor = p.prices?.currency_minor_unit ?? 2;
      const price = p.prices?.price ? (Number(p.prices.price) / 10 ** minor).toFixed(2).replace(".", ",") : "";
      return { name: cheerio.load(p.name).text().trim(), category: p.categories?.[0]?.name ?? "", price: price ? `€ ${price}` : "", url: p.permalink };
    });
  } catch { return null; }
}

const dedupe = (ps: Product[]) => {
  const seen = new Set<string>();
  return ps.filter((p) => { const k = p.name.toLowerCase(); if (!p.name || seen.has(k)) return false; seen.add(k); return true; });
};

/**
 * Reads a webshop politely: homepage plus a handful of brand/service pages (robots.txt honoured,
 * pause between requests) and the product catalogue via Shopify / WooCommerce endpoints or JSON-LD.
 */
export async function crawlSite(input: string, o: { maxPages?: number; signal?: AbortSignal; onProgress?: (msg: string) => void } = {}): Promise<SiteSnapshot> {
  const url = normalizeUrl(input);
  const origin = new URL(url).origin;
  const warnings: string[] = [];
  const pause = () => new Promise((r) => setTimeout(r, PAUSE_MS));

  const robots = (await (await get(`${origin}/robots.txt`, o.signal))?.text().catch(() => "")) ?? "";
  o.onProgress?.(`Homepage lezen: ${origin}`);
  const home = await get(url, o.signal);
  if (!home) throw new Error(`De website ${origin} kon niet worden geopend.`);
  const homeHtml = await home.text();
  const h = pageText(homeHtml);
  const pages: SitePage[] = [{ url, title: h.title, text: h.text }];
  let products: Product[] = jsonLdProducts(homeHtml, url);

  // Candidate internal links, best first.
  const $ = cheerio.load(homeHtml);
  const links = new Set<string>();
  $("a[href]").each((_, a) => {
    try {
      const u = new URL($(a).attr("href")!, url);
      if (u.origin === origin && u.pathname !== new URL(url).pathname) { u.hash = ""; u.search = ""; links.add(u.toString()); }
    } catch { /* ignore */ }
  });
  const score = (l: string) => { const i = PRIORITY.findIndex((r) => r.test(new URL(l).pathname)); return i === -1 ? 99 : i; };
  const productLinks = [...links].filter((l) => /\/(products?|produkt|artikel)\//i.test(new URL(l).pathname)).slice(0, 3);
  const candidates = [...links].filter((l) => score(l) < 99).sort((a, b) => score(a) - score(b));
  const queue = [...new Set([...candidates.slice(0, (o.maxPages ?? 6) - 1), ...productLinks])];

  for (const link of queue) {
    const path = new URL(link).pathname;
    if (!robotsAllows(robots, path)) { warnings.push(`Overgeslagen volgens robots.txt: ${path}`); continue; }
    await pause();
    o.onProgress?.(`Pagina lezen: ${path}`);
    const res = await get(link, o.signal);
    if (!res) continue;
    const html = await res.text();
    const p = pageText(html);
    pages.push({ url: link, title: p.title, text: p.text });
    products.push(...jsonLdProducts(html, link));
  }

  let platform: SiteSnapshot["platform"] = products.length ? "jsonld" : "none";
  o.onProgress?.("Productcatalogus zoeken…");
  const shopify = await shopifyProducts(origin, o.signal);
  if (shopify?.length) { products = shopify; platform = "shopify"; }
  else {
    const woo = await wooProducts(origin, o.signal);
    if (woo?.length) { products = woo; platform = "woocommerce"; }
  }
  products = dedupe(products).slice(0, MAX_PRODUCTS);
  if (!products.length) warnings.push("Geen producten automatisch gevonden. Vul de belangrijkste producten met de hand in.");

  return { url, siteName: h.siteName || h.title.split(/[|–-]/)[0].trim(), description: h.description, language: h.lang, platform, pages, products, warnings };
}
