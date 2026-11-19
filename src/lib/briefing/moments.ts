// Moments (specific days), seasons, months and quarters with per-year date logic.
import { addDays, easterSunday, lastDayOfMonth, nthWeekday, ymd, type DateRange } from "./dates";

export type Occurrence = { ranges: DateRange[]; approximate?: boolean };
export type PeriodDef = {
  id: string;
  label: string;
  group: string;
  /** Returns null when the moment doesn't happen in that year (e.g. no tournament). */
  compute: (year: number) => Occurrence | null;
  note?: string;
};

const day = (y: number, m: number, d: number): Occurrence => ({ ranges: [{ from: ymd(y, m, d), to: ymd(y, m, d) }] });
const span = (from: string, to: string, approximate?: boolean): Occurrence => ({ ranges: [{ from, to }], approximate });
const fromTable = (table: Record<number, string>, lengthDays = 1) => (y: number): Occurrence | null => {
  const d = table[y];
  return d ? span(d, addDays(d, lengthDays - 1)) : null;
};

// Lookup tables for dates that can't be computed reliably (lunar calendars, commercial events).
const RAMADAN_START: Record<number, string> = {
  2023: "2023-03-23", 2024: "2024-03-11", 2025: "2025-03-01", 2026: "2026-02-18",
  2027: "2027-02-08", 2028: "2028-01-28", 2029: "2029-01-16", 2030: "2030-01-06",
};
const EID_AL_FITR: Record<number, string> = {
  2023: "2023-04-21", 2024: "2024-04-10", 2025: "2025-03-30", 2026: "2026-03-20",
  2027: "2027-03-10", 2028: "2028-02-27", 2029: "2029-02-15", 2030: "2030-02-05",
};
const CHINESE_NEW_YEAR: Record<number, string> = {
  2023: "2023-01-22", 2024: "2024-02-10", 2025: "2025-01-29", 2026: "2026-02-17",
  2027: "2027-02-06", 2028: "2028-01-26", 2029: "2029-02-13", 2030: "2030-02-03",
};
const PRIME_DAY: Record<number, [string, string]> = {
  2023: ["2023-07-11", "2023-07-12"],
  2024: ["2024-07-16", "2024-07-17"],
  2025: ["2025-07-08", "2025-07-11"],
};
const FOOTBALL_TOURNAMENTS: Record<number, [string, string]> = {
  2024: ["2024-06-14", "2024-07-14"], // EK
  2026: ["2026-06-11", "2026-07-19"], // WK
  2028: ["2028-06-09", "2028-07-09"], // EK
  2030: ["2030-06-13", "2030-07-21"], // WK (indicatief)
};

const blackFriday = (y: number) => addDays(nthWeekday(y, 11, 4, 4), 1);
const koningsdag = (y: number) => {
  const d = ymd(y, 4, 27);
  return new Date(d + "T00:00:00Z").getUTCDay() === 0 ? ymd(y, 4, 26) : d;
};

export const MOMENTS: PeriodDef[] = [
  // Januari
  { id: "new_year", label: "Nieuwjaar", group: "Januari", compute: (y) => day(y, 1, 1) },
  { id: "blue_monday", label: "Blue Monday", group: "Januari", compute: (y) => { const d = nthWeekday(y, 1, 1, 3); return span(d, d); } },
  { id: "winter_sale", label: "Winter sale", group: "Januari", compute: (y) => span(ymd(y - 1, 12, 26), ymd(y, 1, 31)) },
  { id: "dry_january", label: "Dry January", group: "Januari", compute: (y) => span(ymd(y, 1, 1), ymd(y, 1, 31)) },
  { id: "chinese_new_year", label: "Chinees Nieuwjaar", group: "Januari", compute: fromTable(CHINESE_NEW_YEAR) },
  // Februari
  { id: "galentines", label: "Galentine's Day", group: "Februari", compute: (y) => day(y, 2, 13) },
  { id: "valentines", label: "Valentijnsdag", group: "Februari", compute: (y) => day(y, 2, 14) },
  { id: "carnival", label: "Carnaval", group: "Februari", compute: (y) => { const e = easterSunday(y); return span(addDays(e, -49), addDays(e, -47)); } },
  // Maart
  { id: "womens_day", label: "Internationale Vrouwendag", group: "Maart", compute: (y) => day(y, 3, 8) },
  { id: "ramadan_start", label: "Ramadan (start)", group: "Maart", compute: fromTable(RAMADAN_START), note: "Datum verschuift per jaar (maankalender)." },
  { id: "eid_al_fitr", label: "Suikerfeest", group: "Maart", compute: fromTable(EID_AL_FITR, 3) },
  { id: "spring_start", label: "Lente (start)", group: "Maart", compute: (y) => day(y, 3, 20) },
  { id: "world_water_day", label: "Wereld Waterdag", group: "Maart", compute: (y) => day(y, 3, 22) },
  // April
  { id: "easter", label: "Pasen", group: "April", compute: (y) => { const e = easterSunday(y); return span(e, addDays(e, 1)); } },
  { id: "kings_day", label: "Koningsdag", group: "April", compute: (y) => { const d = koningsdag(y); return span(d, d); } },
  { id: "earth_day", label: "Earth Day", group: "April", compute: (y) => day(y, 4, 22) },
  { id: "secretary_day", label: "Dag van de Secretaresse", group: "April", compute: (y) => { const d = nthWeekday(y, 4, 4, 3); return span(d, d); } },
  // Mei
  { id: "liberation_day", label: "Bevrijdingsdag", group: "Mei", compute: (y) => day(y, 5, 5) },
  { id: "mothers_day", label: "Moederdag (NL/BE)", group: "Mei", compute: (y) => { const d = nthWeekday(y, 5, 0, 2); return span(d, d); } },
  { id: "mothers_day_antwerp", label: "Moederdag (Antwerpen, 15 aug)", group: "Mei", compute: (y) => day(y, 8, 15) },
  { id: "ascension", label: "Hemelvaart", group: "Mei", compute: (y) => { const d = addDays(easterSunday(y), 39); return span(d, d); } },
  { id: "pentecost", label: "Pinksteren", group: "Mei", compute: (y) => { const d = addDays(easterSunday(y), 49); return span(d, addDays(d, 1)); } },
  { id: "festival_start", label: "Festivalseizoen (start)", group: "Mei", compute: (y) => span(ymd(y, 5, 1), ymd(y, 5, 31)) },
  // Juni
  { id: "fathers_day", label: "Vaderdag (NL)", group: "Juni", compute: (y) => { const d = nthWeekday(y, 6, 0, 3); return span(d, d); } },
  { id: "fathers_day_be", label: "Vaderdag (BE)", group: "Juni", compute: (y) => { const d = nthWeekday(y, 6, 0, 2); return span(d, d); } },
  { id: "pride_month", label: "Pride Month", group: "Juni", compute: (y) => span(ymd(y, 6, 1), ymd(y, 6, 30)) },
  { id: "summer_start", label: "Zomer (start)", group: "Juni", compute: (y) => day(y, 6, 21) },
  { id: "school_end", label: "Einde schooljaar / Dag van de Leraar", group: "Juni", compute: (y) => span(ymd(y, 6, 25), ymd(y, 7, 15), true) },
  { id: "football", label: "EK/WK (sporttoernooien)", group: "Juni", compute: (y) => { const t = FOOTBALL_TOURNAMENTS[y]; return t ? span(t[0], t[1]) : null; } },
  // Juli & augustus
  { id: "summer_sale", label: "Zomersale", group: "Juli & augustus", compute: (y) => span(ymd(y, 6, 25), ymd(y, 7, 31)) },
  {
    id: "prime_day", label: "Amazon Prime Day", group: "Juli & augustus",
    compute: (y) => {
      const t = PRIME_DAY[y];
      if (t) return span(t[0], t[1]);
      const d = nthWeekday(y, 7, 2, 2); // indicatief: 2e dinsdag van juli
      return span(d, addDays(d, 1), true);
    },
  },
  { id: "summer_holiday", label: "Zomervakantie", group: "Juli & augustus", compute: (y) => span(ymd(y, 7, 1), ymd(y, 8, 31)) },
  { id: "back_to_school", label: "Back to School", group: "Juli & augustus", compute: (y) => span(ymd(y, 8, 10), ymd(y, 9, 5)) },
  // September
  { id: "back_to_work", label: "Back to Work", group: "September", compute: (y) => span(ymd(y, 8, 25), ymd(y, 9, 15)) },
  { id: "autumn_start", label: "Herfst (start)", group: "September", compute: (y) => day(y, 9, 22) },
  // Oktober
  { id: "animal_day", label: "Dierendag", group: "Oktober", compute: (y) => day(y, 10, 4) },
  { id: "halloween", label: "Halloween", group: "Oktober", compute: (y) => day(y, 10, 31) },
  { id: "sustainability_week", label: "Week van de Duurzaamheid", group: "Oktober", compute: (y) => { const d = nthWeekday(y, 10, 1, 2); return span(d, addDays(d, 6), true); } },
  // November
  { id: "singles_day", label: "Singles Day (11.11)", group: "November", compute: (y) => day(y, 11, 11) },
  { id: "black_friday", label: "Black Friday", group: "November", compute: (y) => { const d = blackFriday(y); return span(d, d); } },
  { id: "cyber_monday", label: "Cyber Monday", group: "November", compute: (y) => { const d = addDays(blackFriday(y), 3); return span(d, d); } },
  { id: "black_week", label: "Black Week", group: "November", compute: (y) => { const bf = blackFriday(y); return span(addDays(bf, -4), addDays(bf, 3)); } },
  { id: "green_friday", label: "Green Friday", group: "November", compute: (y) => { const d = blackFriday(y); return span(d, d); } },
  { id: "giving_tuesday", label: "Giving Tuesday", group: "November", compute: (y) => { const d = addDays(blackFriday(y), 4); return span(d, d); } },
  { id: "sinterklaas_arrival", label: "Intocht Sinterklaas", group: "November", compute: (y) => { const d = nthWeekday(y, 11, 6, 3); return span(d, d, true); } },
  // December
  { id: "sinterklaas", label: "Sinterklaas (5 dec)", group: "December", compute: (y) => day(y, 12, 5) },
  { id: "christmas", label: "Kerst", group: "December", compute: (y) => span(ymd(y, 12, 24), ymd(y, 12, 26)) },
  { id: "last_minute", label: "Last-minute cadeaus / verzenddeadline", group: "December", compute: (y) => span(ymd(y, 12, 15), ymd(y, 12, 23)) },
  { id: "boxing_day", label: "Boxing Day", group: "December", compute: (y) => day(y, 12, 26) },
  { id: "new_years_eve", label: "Oudjaarsavond", group: "December", compute: (y) => day(y, 12, 31) },
  // Branchegebonden
  { id: "world_chocolate_day", label: "Wereld Chocoladedag", group: "Branchegebonden", compute: (y) => day(y, 7, 7) },
  { id: "day_of_love", label: "Dag van de Liefde", group: "Branchegebonden", compute: (y) => day(y, 2, 14) },
  { id: "coffee_day", label: "National Coffee Day", group: "Branchegebonden", compute: (y) => day(y, 9, 29) },
  { id: "pet_day", label: "Dag van het Huisdier", group: "Branchegebonden", compute: (y) => day(y, 4, 11) },
  { id: "world_health_day", label: "Wereld Gezondheidsdag", group: "Branchegebonden", compute: (y) => day(y, 4, 7) },
  { id: "yoga_day", label: "Wereld Yoga Dag", group: "Branchegebonden", compute: (y) => day(y, 6, 21) },
  { id: "wedding_season", label: "Dag van de Bruid / bruiloftsseizoen", group: "Branchegebonden", compute: (y) => span(ymd(y, 5, 1), ymd(y, 9, 30)) },
  { id: "car_season", label: "Kentekenwissel / autoseizoen", group: "Branchegebonden", compute: (y) => span(ymd(y, 3, 1), ymd(y, 3, 31), true) },
];

/** Brand moments: the user picks a date; the search window defaults to the last 90 days. */
export const BRAND_MOMENTS = [
  { id: "brand_birthday", label: "Verjaardag van het merk" },
  { id: "store_opening", label: "Winkelopening" },
  { id: "launch", label: "Lancering" },
  { id: "drop", label: "Drop" },
  { id: "restock", label: "Restock" },
  { id: "preorder", label: "Pre-order" },
  { id: "sample_sale", label: "Sample sale" },
  { id: "event", label: "Event" },
];

export const SEASONS: PeriodDef[] = [
  { id: "spring", label: "Lente", group: "Seizoen", compute: (y) => span(ymd(y, 3, 20), ymd(y, 6, 20)) },
  { id: "summer", label: "Zomer", group: "Seizoen", compute: (y) => span(ymd(y, 6, 21), ymd(y, 9, 21)) },
  { id: "autumn", label: "Herfst", group: "Seizoen", compute: (y) => span(ymd(y, 9, 22), ymd(y, 12, 20)) },
  { id: "winter", label: "Winter", group: "Seizoen", compute: (y) => span(ymd(y, 12, 21), ymd(y + 1, 3, 19)) },
  { id: "holiday_season", label: "Feestdagenperiode (nov–dec)", group: "Commercieel", compute: (y) => span(ymd(y, 11, 1), ymd(y, 12, 31)) },
  {
    id: "sales_period", label: "Salesperiode (jan / jul)", group: "Commercieel",
    compute: (y) => ({ ranges: [{ from: ymd(y, 1, 1), to: ymd(y, 1, 31) }, { from: ymd(y, 7, 1), to: ymd(y, 7, 31) }] }),
  },
  { id: "gift_season", label: "Cadeauseizoen (half nov – 24 dec)", group: "Commercieel", compute: (y) => span(ymd(y, 11, 15), ymd(y, 12, 24)) },
  { id: "wedding_season", label: "Bruiloftsseizoen", group: "Commercieel", compute: (y) => span(ymd(y, 5, 1), ymd(y, 9, 30)) },
  { id: "festival_season", label: "Festivalseizoen", group: "Commercieel", compute: (y) => span(ymd(y, 5, 15), ymd(y, 8, 31)) },
  { id: "vacation", label: "Vakantieperiode", group: "Commercieel", compute: (y) => span(ymd(y, 7, 1), ymd(y, 8, 31)) },
];

export const MONTH_LABELS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

export const monthPeriod = (m: number): PeriodDef => ({
  id: `month_${m}`,
  label: MONTH_LABELS[m - 1],
  group: "Maand",
  compute: (y) => span(ymd(y, m, 1), ymd(y, m, lastDayOfMonth(y, m))),
});

export const quarterPeriod = (q: number): PeriodDef => ({
  id: `q${q}`,
  label: `Q${q}`,
  group: "Kwartaal",
  compute: (y) => {
    const m1 = (q - 1) * 3 + 1;
    return span(ymd(y, m1, 1), ymd(y, m1 + 2, lastDayOfMonth(y, m1 + 2)));
  },
});

export const findMoment = (id: string) => MOMENTS.find((m) => m.id === id);
export const findSeason = (id: string) => SEASONS.find((s) => s.id === id);
