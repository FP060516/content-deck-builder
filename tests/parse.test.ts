import { describe, expect, it } from "vitest";
import { cleanBody, findDates, parseCardMeta } from "@/lib/adsource/parse";

describe("findDates", () => {
  it("reads EN and NL formats", () => {
    expect(findDates("Started running on 3 Dec 2025")).toEqual(["2025-12-03"]);
    expect(findDates("Started running on Nov 28, 2025")).toEqual(["2025-11-28"]);
    expect(findDates("1 dec. 2025 - 20 dec. 2025")).toEqual(["2025-12-01", "2025-12-20"]);
    expect(findDates("Wordt sinds 5 mrt 2026 weergegeven")).toEqual(["2026-03-05"]);
    expect(findDates("geen datum")).toEqual([]);
  });
});

describe("parseCardMeta", () => {
  it("active EN card: days until today, variants", () => {
    const m = parseCardMeta("Active\nLibrary ID: 1111111111111\nStarted running on 3 Dec 2025\n2 ads use this creative and text", "2025-12-12");
    expect(m).toEqual({ adId: "1111111111111", isActive: true, startDate: "2025-12-03", endDate: null, activeDays: 10, variantCount: 2 });
  });
  it("inactive NL card: start-end range", () => {
    const m = parseCardMeta("Inactief\nBibliotheek-ID: 2222222222222\n1 dec 2025 - 20 dec 2025\n3 advertenties gebruiken deze creatie en tekst", "2026-11-19");
    expect(m).toMatchObject({ adId: "2222222222222", isActive: false, startDate: "2025-12-01", endDate: "2025-12-20", activeDays: 20, variantCount: 3 });
  });
});

describe("cleanBody", () => {
  it("drops UI chrome and keeps ad copy", () => {
    expect(cleanBody("Goudsmid & Co\nHet perfecte kerstcadeau\nShop now\nSee ad details\nGratis graveren", "Goudsmid & Co")).toBe("Het perfecte kerstcadeau\nGratis graveren");
  });
});
