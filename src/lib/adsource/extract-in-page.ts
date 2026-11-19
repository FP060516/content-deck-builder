/**
 * Runs INSIDE the Ad Library page (passed to page.evaluate). Must stay self-contained:
 * no imports, no closures over module scope.
 *
 * Card detection (lesson 6): find "Library ID: 123" / "Bibliotheek-ID: 123", walk up the
 * parents until a parent holds more than one ID, and keep the last ancestor that still has
 * exactly one ID plus "Sponsored/Gesponsord" and media. Media comes straight from the card
 * (lesson 5): video.src / video.poster, or img with naturalWidth > 250.
 */
export type ExtractedCard = {
  adId: string;
  text: string;
  advertiser: string;
  pageUrl: string;
  body: string;
  videos: { src: string; poster: string }[];
  images: string[];
};

export function extractCardsInPage(): ExtractedCard[] {
  const ID_RE = /(?:Library ID|Bibliotheek-ID|ID in bibliotheek|Bibliotheek ID)\s*:?\s*(\d{6,})/i;
  const SPONSORED_RE = /(^|\s)(Sponsored|Gesponsord)$/i;
  const idsIn = (el: Element): Set<string> => {
    const set = new Set<string>();
    const re = new RegExp(ID_RE.source, "gi");
    const t = (el as HTMLElement).innerText || el.textContent || "";
    for (const m of t.matchAll(re)) set.add(m[1]);
    return set;
  };
  const mediaOf = (el: Element) => {
    const videos = Array.from(el.querySelectorAll("video")).map((v) => ({
      src: v.currentSrc || v.src || (v.querySelector("source") as HTMLSourceElement | null)?.src || "",
      poster: v.poster || "",
    })).filter((v) => v.src || v.poster);
    const images = Array.from(el.querySelectorAll("img"))
      .filter((i) => (i.naturalWidth || Number(i.getAttribute("width")) || 0) > 250)
      .map((i) => i.currentSrc || i.src)
      .filter((s) => s && !s.startsWith("data:"));
    return { videos, images };
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const anchors: Element[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (ID_RE.test(n.textContent || "") && n.parentElement) anchors.push(n.parentElement);
  }

  const seen = new Set<string>();
  const cards: ExtractedCard[] = [];
  for (const a of anchors) {
    const adId = (a.textContent || "").match(ID_RE)?.[1];
    if (!adId || seen.has(adId)) continue;
    let card: Element | null = null;
    for (let el: Element | null = a; el && el !== document.body; el = el.parentElement) {
      if (idsIn(el).size > 1) break;
      const lines = ((el as HTMLElement).innerText || "").split("\n").map((l) => l.trim());
      const m = mediaOf(el);
      if (lines.some((l) => SPONSORED_RE.test(l)) && (m.videos.length || m.images.length)) card = el;
    }
    if (!card) continue;
    seen.add(adId);

    const text = (card as HTMLElement).innerText || "";
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const sIdx = lines.findIndex((l) => SPONSORED_RE.test(l));
    // "Sponsored" is either its own line (advertiser on the line above) or follows the name on one line.
    const sLine = sIdx >= 0 ? lines[sIdx] : "";
    const inline = sLine.replace(/\s*(Sponsored|Gesponsord)$/i, "").trim();
    let advertiser = inline || (sIdx > 0 ? lines[sIdx - 1] : "");
    let pageUrl = "";
    for (const link of Array.from(card.querySelectorAll("a[href]")) as HTMLAnchorElement[]) {
      const t = link.innerText.trim();
      const href = link.href;
      if (!t || /ads\/library|l\.facebook\.com/.test(href)) continue;
      if (!advertiser) advertiser = t;
      if (t === advertiser) { pageUrl = href; break; }
    }
    const body = sIdx >= 0 ? lines.slice(sIdx + 1).join("\n") : "";
    const { videos, images } = mediaOf(card);
    cards.push({ adId, text, advertiser, pageUrl, body, videos, images });
  }
  return cards;
}
