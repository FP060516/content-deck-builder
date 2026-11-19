import { describe, expect, it } from "vitest";
import { easterSunday, nthWeekday, addDays } from "@/lib/briefing/dates";
import { findMoment, MOMENTS, SEASONS } from "@/lib/briefing/moments";

describe("date helpers", () => {
  it("computes Easter correctly", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });
  it("computes nth weekday", () => {
    expect(nthWeekday(2026, 5, 0, 2)).toBe("2026-05-10"); // Moederdag 2026
    expect(nthWeekday(2025, 6, 0, 3)).toBe("2025-06-15"); // Vaderdag NL 2025
    expect(nthWeekday(2026, 1, 1, 3)).toBe("2026-01-19"); // Blue Monday 2026
    expect(nthWeekday(2026, 11, 4, -1)).toBe("2026-11-26");
  });
  it("adds days across month/year", () => {
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });
});

describe("moments", () => {
  const first = (id: string, y: number) => findMoment(id)!.compute(y)!.ranges[0];
  it("moving holidays", () => {
    expect(first("black_friday", 2025).from).toBe("2025-11-28");
    expect(first("black_friday", 2026).from).toBe("2026-11-27");
    expect(first("cyber_monday", 2025).from).toBe("2025-12-01");
    expect(first("ascension", 2026).from).toBe("2026-05-14");
    expect(first("pentecost", 2026).from).toBe("2026-05-24");
    expect(first("carnival", 2026)).toEqual({ from: "2026-02-15", to: "2026-02-17" });
    expect(first("kings_day", 2025).from).toBe("2025-04-26"); // 27 april = zondag
    expect(first("ramadan_start", 2026).from).toBe("2026-02-18");
  });
  it("tournaments are absent in odd years", () => {
    expect(findMoment("football")!.compute(2025)).toBeNull();
    expect(findMoment("football")!.compute(2026)).not.toBeNull();
  });
  it("every moment and season produces valid ranges for 2023-2030", () => {
    for (const def of [...MOMENTS, ...SEASONS]) {
      for (let y = 2023; y <= 2030; y++) {
        const o = def.compute(y);
        if (!o) continue;
        for (const r of o.ranges) {
          expect(r.from <= r.to, `${def.id} ${y}`).toBe(true);
          expect(r.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    }
  });
});
