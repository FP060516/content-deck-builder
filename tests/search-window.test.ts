import { describe, expect, it } from "vitest";
import { resolveSearchWindow } from "@/lib/briefing/search-window";
import { buildAdLibrarySearchUrl } from "@/lib/adlibrary/url";

const now = new Date("2026-11-19T12:00:00");
const auto = { mode: "auto" as const, leadDays: 14 };

describe("resolveSearchWindow", () => {
  it("Kerst → December last year plus 14 days lead", () => {
    const w = resolveSearchWindow({ type: "moment", momentId: "christmas" }, auto, now);
    expect(w.target!.ranges[0]).toEqual({ from: "2026-12-24", to: "2026-12-26" });
    expect(w.ranges).toEqual([{ from: "2025-12-10", to: "2025-12-26" }]);
  });
  it("moving holiday is recomputed for last year (Black Friday)", () => {
    const w = resolveSearchWindow({ type: "moment", momentId: "black_friday" }, auto, now);
    expect(w.target!.ranges[0].from).toBe("2026-11-27");
    expect(w.ranges).toEqual([{ from: "2025-11-14", to: "2025-11-28" }]);
  });
  it("passed moment targets next year and searches this year", () => {
    const w = resolveSearchWindow({ type: "moment", momentId: "easter" }, auto, now);
    expect(w.target!.ranges[0].from).toBe("2027-03-28");
    expect(w.ranges[0]).toEqual({ from: "2026-03-22", to: "2026-04-06" });
  });
  it("skips years without the moment", () => {
    const w = resolveSearchWindow({ type: "moment", momentId: "football" }, auto, new Date("2027-01-10"));
    expect(w.target!.ranges[0].from).toBe("2028-06-09");
    expect(w.ranges[0].from).toBe("2026-05-28");
    expect(w.warnings.join()).toContain("2027");
  });
  it("quarter Q4", () => {
    const w = resolveSearchWindow({ type: "quarter", quarter: 4 }, { ...auto, leadDays: 0 }, now);
    expect(w.ranges).toEqual([{ from: "2025-10-01", to: "2025-12-31" }]);
  });
  it("sales period yields two ranges", () => {
    const w = resolveSearchWindow({ type: "season", seasonId: "sales_period" }, { ...auto, leadDays: 0 }, now);
    expect(w.ranges).toHaveLength(2);
    expect(w.ranges[0].from).toBe("2026-01-01");
  });
  it("winter spanning the new year", () => {
    const w = resolveSearchWindow({ type: "season", seasonId: "winter" }, { ...auto, leadDays: 0 }, now);
    expect(w.target!.ranges[0].from).toBe("2026-12-21");
    expect(w.ranges[0]).toEqual({ from: "2025-12-21", to: "2026-03-19" });
  });
  it("evergreen and last-90 use the last 90 days", () => {
    const w = resolveSearchWindow({ type: "evergreen" }, auto, now);
    expect(w.ranges).toEqual([{ from: "2026-08-21", to: "2026-11-19" }]);
  });
  it("custom future range shifts one year back", () => {
    const w = resolveSearchWindow({ type: "custom", from: "2027-02-01", to: "2027-02-28" }, { ...auto, leadDays: 0 }, now);
    expect(w.ranges).toEqual([{ from: "2026-02-01", to: "2026-02-28" }]);
  });
  it("manual window", () => {
    const w = resolveSearchWindow({ type: "evergreen" }, { mode: "manual", leadDays: 14, from: "2025-01-01", to: "2025-02-01" }, now);
    expect(w.ranges).toEqual([{ from: "2025-01-01", to: "2025-02-01" }]);
  });
});

describe("buildAdLibrarySearchUrl", () => {
  it("contains all EU parameters", () => {
    const url = new URL(buildAdLibrarySearchUrl({ country: "NL", q: "gouden sieraden", mediaType: "image", range: { from: "2025-12-01", to: "2025-12-31" } }));
    expect(url.searchParams.get("active_status")).toBe("all");
    expect(url.searchParams.get("search_type")).toBe("keyword_unordered");
    expect(url.searchParams.get("start_date[min]")).toBe("2025-12-01");
    expect(url.searchParams.get("start_date[max]")).toBe("2025-12-31");
    expect(url.searchParams.get("media_type")).toBe("image");
  });
});
