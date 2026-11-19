import { z } from "zod";

export const PeriodSchema = z.object({
  type: z.enum(["moment", "season", "month", "quarter", "custom", "evergreen"]),
  momentId: z.string().optional(), // MOMENTS id, or "brand:<id>" for brand moments
  brandMomentDate: z.string().optional(), // YMD, for brand moments
  brandMomentNote: z.string().optional(),
  seasonId: z.string().optional(),
  month: z.number().int().min(1).max(12).optional(),
  quarter: z.number().int().min(1).max(4).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type Period = z.infer<typeof PeriodSchema>;

export const SearchWindowSchema = z.object({
  mode: z.enum(["auto", "last_90_days", "manual"]).default("auto"),
  leadDays: z.number().int().min(0).max(60).default(14),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type SearchWindowSettings = z.infer<typeof SearchWindowSchema>;

export const StructureSchema = z.object({
  static: z.number().int().min(0).max(10),
  video_brand: z.number().int().min(0).max(10),
  ugc: z.number().int().min(0).max(10),
  creator: z.number().int().min(0).max(10),
  third_party: z.number().int().min(0).max(10),
});
export type Structure = z.infer<typeof StructureSchema>;

export const InspirationSchema = z.object({
  breadth: z.number().int().min(0).max(3),
  competitors: z.array(z.string()),
  excludeBrands: z.array(z.string()),
  countries: z.array(z.string()).min(1, "Kies minimaal één markt"),
  languages: z.array(z.string()),
  mediaType: z.enum(["all", "image", "video"]),
  maxPerAdvertiser: z.number().int().min(1).max(5),
  excludePreviousAdvertisers: z.boolean(),
  aiContent: z.enum(["allow", "avoid", "mix"]),
  pricePositioning: z.enum(["same", "higher", "all"]),
  minActiveDays: z.number().int().min(0).nullable(),
  extraContext: z.string(),
});

export const BriefingSchema = z.object({
  clientId: z.string().min(1, "Kies een klant"),
  period: PeriodSchema,
  searchWindow: SearchWindowSchema,
  funnel: z.array(z.enum(["tof", "mof", "bof", "retention"])).min(1, "Kies minimaal één funnelfase"),
  goal: z.object({ main: z.string().min(1, "Kies een hoofddoel"), subs: z.array(z.string()) }),
  angles: z.array(z.string()),
  structure: StructureSchema,
  overfetch: z.boolean(),
  inspiration: InspirationSchema,
});
export type Briefing = z.infer<typeof BriefingSchema>;

/** Briefing without client, as stored in presets. */
export type BriefingTemplate = Omit<Briefing, "clientId">;

export const DEFAULT_BRIEFING: BriefingTemplate = {
  period: { type: "moment", momentId: "christmas" },
  searchWindow: { mode: "auto", leadDays: 14 },
  funnel: ["tof"],
  goal: { main: "promo", subs: [] },
  angles: [],
  structure: { static: 5, video_brand: 5, ugc: 0, creator: 0, third_party: 0 },
  overfetch: true,
  inspiration: {
    breadth: 1,
    competitors: [],
    excludeBrands: [],
    countries: ["NL", "BE"],
    languages: ["nl"],
    mediaType: "all",
    maxPerAdvertiser: 2,
    excludePreviousAdvertisers: true,
    aiContent: "mix",
    pricePositioning: "same",
    minActiveDays: null,
    extraContext: "",
  },
};

export const totalAds = (s: Structure) =>
  s.static + s.video_brand + s.ugc + s.creator + s.third_party;

/** Merge a (possibly partial / older) stored briefing with defaults so the form never breaks. */
export function hydrateBriefing(raw: unknown, clientId = ""): Briefing {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Briefing>;
  return {
    clientId: r.clientId ?? clientId,
    period: { ...DEFAULT_BRIEFING.period, ...(r.period ?? {}) },
    searchWindow: { ...DEFAULT_BRIEFING.searchWindow, ...(r.searchWindow ?? {}) },
    funnel: r.funnel ?? DEFAULT_BRIEFING.funnel,
    goal: { ...DEFAULT_BRIEFING.goal, ...(r.goal ?? {}) },
    angles: r.angles ?? [],
    structure: { ...DEFAULT_BRIEFING.structure, ...(r.structure ?? {}) },
    overfetch: r.overfetch ?? DEFAULT_BRIEFING.overfetch,
    inspiration: { ...DEFAULT_BRIEFING.inspiration, ...(r.inspiration ?? {}) },
  };
}
