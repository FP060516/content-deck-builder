/** Pure parsing of the text inside one Ad Library card (EN + NL UI). */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januari: 1,
  feb: 2, february: 2, februari: 2,
  mar: 3, march: 3, mrt: 3, maart: 3,
  apr: 4, april: 4,
  may: 5, mei: 5,
  jun: 6, june: 6, juni: 6,
  jul: 7, july: 7, juli: 7,
  aug: 8, august: 8, augustus: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, okt: 10, oktober: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");
const MONTH_RE = "([A-Za-z]{3,9})\\.?";

/** Finds every date in a string: "12 Dec 2025", "12 dec. 2025", "Dec 12, 2025". Returns YYYY-MM-DD. */
export function findDates(text: string): string[] {
  const out: { i: number; d: string }[] = [];
  const dmy = new RegExp(`(\\d{1,2})\\s+${MONTH_RE}\\s+(\\d{4})`, "g");
  const mdy = new RegExp(`${MONTH_RE}\\s+(\\d{1,2}),?\\s+(\\d{4})`, "g");
  for (const m of text.matchAll(dmy)) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) out.push({ i: m.index!, d: `${m[3]}-${pad(mo)}-${pad(+m[1])}` });
  }
  for (const m of text.matchAll(mdy)) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo && !out.some((o) => Math.abs(o.i - m.index!) < 4)) out.push({ i: m.index!, d: `${m[3]}-${pad(mo)}-${pad(+m[2])}` });
  }
  return out.sort((a, b) => a.i - b.i).map((o) => o.d);
}

export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export type CardMeta = {
  adId: string | null;
  isActive: boolean | null;
  startDate: string | null;
  endDate: string | null;
  activeDays: number | null;
  variantCount: number;
};

const ID_RE = /(?:Library ID|Bibliotheek-ID|ID in bibliotheek|Bibliotheek ID)\s*:?\s*(\d{6,})/i;

export function parseCardMeta(text: string, today: string): CardMeta {
  const adId = text.match(ID_RE)?.[1] ?? null;
  let isActive: boolean | null = null;
  if (/\b(Inactive|Inactief|Niet actief)\b/i.test(text)) isActive = false;
  else if (/\b(Active|Actief)\b/.test(text)) isActive = true;

  // Date line: "Started running on 3 Dec 2025", "3 Dec 2025 - 20 Dec 2025", "Wordt sinds 3 dec 2025 weergegeven".
  const dateLine = text.split("\n").find((l) => findDates(l).length > 0 && !ID_RE.test(l)) ?? "";
  const dates = findDates(dateLine);
  const startDate = dates[0] ?? null;
  const endDate = dates.length > 1 ? dates[1] : null;
  const until = endDate ?? (isActive !== false ? today : null);
  const activeDays = startDate && until ? Math.max(1, daysBetween(startDate, until) + 1) : null;

  // "5 ads use this creative and text" / "5 advertenties gebruiken deze creatie en tekst"
  const variants = text.match(/(\d+)\s+(?:ads|advertenties)\s+(?:use|gebruiken)/i);
  const variantCount = variants ? Math.max(1, +variants[1]) : 1;

  return { adId, isActive, startDate, endDate, activeDays, variantCount };
}

/** Lines that are UI chrome, not ad copy. */
const CHROME = [
  /^(Library ID|Bibliotheek-ID|ID in bibliotheek)/i, /^(Active|Inactive|Actief|Inactief)$/i, /^(Sponsored|Gesponsord)$/i,
  /^(See ad details|See summary details|Advertentiegegevens bekijken|Details van samenvatting bekijken|Overzicht bekijken)$/i,
  /^(Platforms|Platformen)$/i, /(Started running|Wordt sinds|begonnen op|Liep van)/i, /(ads|advertenties) (use|gebruiken)/i,
  /^(Shop now|Shop Now|Learn more|Learn More|Nu shoppen|Meer informatie|Bestel nu|Sign up|Aanmelden|Download|Watch more|Meer bekijken|Contact us|Get offer|Aanbieding ontvangen)$/i,
  /^(Open Dropdown|This ad has multiple versions|Deze advertentie heeft meerdere versies)/i,
  /^\d+:\d+\s*\/\s*\d+:\d+$/, /^[​\s]*$/,
];

export function cleanBody(text: string, advertiser: string): string {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== advertiser && !CHROME.some((r) => r.test(l)) && findDates(l).length === 0)
    .join("\n")
    .slice(0, 1500);
}
