// Period → target occurrence → Ad Library search window.
// Core rule (lesson 1): a deck for December searches ads that ran LAST year in December,
// recomputed for moving holidays, plus a lead-in period (default 14 days).
import { addDays, formatRangeNL, todayYMD, yearOf, type DateRange, type YMD } from "./dates";
import {
  BRAND_MOMENTS, findMoment, findSeason, monthPeriod, quarterPeriod,
  type Occurrence, type PeriodDef,
} from "./moments";
import type { Period, SearchWindowSettings } from "./schema";

export type ResolvedWindow = {
  periodLabel: string;
  target: Occurrence | null; // the upcoming occurrence the deck is for
  reference: Occurrence | null; // the occurrence we look back at
  ranges: DateRange[]; // final search ranges for start_date[min]/[max]
  mode: SearchWindowSettings["mode"];
  explanation: string;
  warnings: string[];
};

const lastEnd = (o: Occurrence) => o.ranges[o.ranges.length - 1].to;

export function periodDefFor(p: Period): PeriodDef | null {
  switch (p.type) {
    case "moment":
      return p.momentId && !p.momentId.startsWith("brand:") ? findMoment(p.momentId) ?? null : null;
    case "season":
      return p.seasonId ? findSeason(p.seasonId) ?? null : null;
    case "month":
      return p.month ? monthPeriod(p.month) : null;
    case "quarter":
      return p.quarter ? quarterPeriod(p.quarter) : null;
    default:
      return null;
  }
}

/** First occurrence that hasn't ended yet. */
export function nextOccurrence(def: PeriodDef, today: YMD): { year: number; occ: Occurrence } | null {
  const y0 = yearOf(today);
  for (let y = y0 - 1; y <= y0 + 4; y++) {
    const occ = def.compute(y);
    if (occ && lastEnd(occ) >= today) return { year: y, occ };
  }
  return null;
}

/** Most recent occurrence strictly before the target year (skips years without the moment). */
export function previousOccurrence(def: PeriodDef, targetYear: number): { year: number; occ: Occurrence } | null {
  for (let y = targetYear - 1; y >= targetYear - 5; y--) {
    const occ = def.compute(y);
    if (occ) return { year: y, occ };
  }
  return null;
}

export function periodLabel(p: Period): string {
  if (p.type === "evergreen") return "Altijd geldig (evergreen)";
  if (p.type === "custom") return p.from && p.to ? `Eigen bereik: ${formatRangeNL({ from: p.from, to: p.to })}` : "Eigen datumbereik";
  if (p.type === "moment" && p.momentId?.startsWith("brand:")) {
    const bm = BRAND_MOMENTS.find((b) => "brand:" + b.id === p.momentId);
    return `${bm?.label ?? "Merkmoment"}${p.brandMomentNote ? ` – ${p.brandMomentNote}` : ""}`;
  }
  return periodDefFor(p)?.label ?? "Geen periode gekozen";
}

const last90 = (today: YMD): DateRange[] => [{ from: addDays(today, -90), to: today }];

export function resolveSearchWindow(p: Period, s: SearchWindowSettings, now: Date = new Date()): ResolvedWindow {
  const today = todayYMD(now);
  const label = periodLabel(p);
  const warnings: string[] = [];
  let target: Occurrence | null = null;
  let reference: Occurrence | null = null;
  let autoRanges: DateRange[] = [];
  let explanation = "";

  if (p.type === "evergreen") {
    autoRanges = last90(today);
    explanation = "Evergreen: de ads van de laatste 90 dagen.";
  } else if (p.type === "moment" && p.momentId?.startsWith("brand:")) {
    if (p.brandMomentDate) target = { ranges: [{ from: p.brandMomentDate, to: p.brandMomentDate }] };
    autoRanges = last90(today);
    explanation = "Merkmoment: thema-gedreven, dus we zoeken in de laatste 90 dagen.";
  } else if (p.type === "custom") {
    if (p.from && p.to) {
      target = { ranges: [{ from: p.from, to: p.to }] };
      if (p.to <= today) {
        autoRanges = [{ from: addDays(p.from, -s.leadDays), to: p.to }];
        explanation = "Het bereik ligt in het verleden, dus we zoeken in dat bereik zelf.";
      } else {
        const shift = (d: YMD) => `${yearOf(d) - 1}${d.slice(4)}`.replace(/-02-29$/, "-02-28");
        autoRanges = [{ from: addDays(shift(p.from), -s.leadDays), to: shift(p.to) }];
        explanation = "Hetzelfde bereik vorig jaar, plus aanloop.";
      }
    } else warnings.push("Vul een begin- en einddatum in.");
  } else {
    const def = periodDefFor(p);
    if (!def) warnings.push("Kies een waarde voor de periode.");
    else {
      const next = nextOccurrence(def, today);
      if (next) {
        target = next.occ;
        const prev = previousOccurrence(def, next.year);
        if (prev) {
          reference = prev.occ;
          autoRanges = prev.occ.ranges.map((r) => ({ from: addDays(r.from, -s.leadDays), to: r.to }));
          explanation = `Zelfde moment in ${prev.year} (opnieuw berekend), plus ${s.leadDays} dagen aanloop.`;
          if (next.year - prev.year > 1) warnings.push(`In ${next.year - 1} was er geen "${def.label}"; we kijken naar ${prev.year}.`);
        }
      }
      if (target?.approximate || reference?.approximate) warnings.push("De datum is een benadering. Pas hem zo nodig handmatig aan.");
    }
  }

  // Never search in the future.
  const clamp = (rs: DateRange[]) => rs.map((r) => ({ from: r.from, to: r.to > today ? today : r.to })).filter((r) => r.from <= r.to);

  let ranges: DateRange[];
  if (s.mode === "last_90_days") {
    ranges = last90(today);
    explanation = "Handmatig gekozen: de laatste 90 dagen.";
  } else if (s.mode === "manual") {
    ranges = s.from && s.to ? [{ from: s.from, to: s.to }] : [];
    explanation = "Handmatig zoekvenster.";
    if (!ranges.length) warnings.push("Vul het handmatige zoekvenster in.");
  } else ranges = clamp(autoRanges);

  return { periodLabel: label, target, reference, ranges, mode: s.mode, explanation, warnings };
}
