// Timezone-safe date helpers on ISO "YYYY-MM-DD" strings (computed in UTC).

export type YMD = string; // "2026-12-24"
export type DateRange = { from: YMD; to: YMD };

export const ymd = (y: number, m: number, d: number): YMD => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
};

export const toDate = (s: YMD) => new Date(s + "T00:00:00Z");

export const addDays = (s: YMD, n: number): YMD => {
  const dt = toDate(s);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

export const todayYMD = (now: Date = new Date()): YMD =>
  ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());

export const yearOf = (s: YMD) => Number(s.slice(0, 4));

export const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** n-th weekday of a month. weekday: 0 = Sunday … 6 = Saturday. n = -1 → last. */
export function nthWeekday(y: number, m: number, weekday: number, n: number): YMD {
  if (n === -1) {
    const last = lastDayOfMonth(y, m);
    for (let d = last; d > last - 7; d--) {
      if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === weekday) return ymd(y, m, d);
    }
  }
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - firstDow + 7) % 7) + (n - 1) * 7;
  return ymd(y, m, day);
}

/** Easter Sunday (Gregorian, anonymous computus). */
export function easterSunday(y: number): YMD {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}

const NL_MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export function formatNL(s: YMD, withYear = true): string {
  const [y, m, d] = s.split("-").map(Number);
  return `${d} ${NL_MONTHS[m - 1]}${withYear ? " " + y : ""}`;
}

export function formatRangeNL(r: DateRange): string {
  if (r.from === r.to) return formatNL(r.from);
  const sameYear = yearOf(r.from) === yearOf(r.to);
  return `${formatNL(r.from, !sameYear)} – ${formatNL(r.to)}`;
}
