import { z } from "zod";

/** prompts/search-plan.md */
export const SearchPlanSchema = z.object({
  queries: z.array(
    z.object({
      q: z.string(),
      country: z.string(),
      exactPhrase: z.boolean(),
      advertiserFilter: z.string(), // brand name to keep when searching one specific brand, else ""
      serves: z.enum(["static", "video_brand", "ugc", "creator", "third_party", "any"]),
      rationale: z.string(),
    }),
  ),
});
export type SearchPlan = z.infer<typeof SearchPlanSchema>;
export type PlannedQuery = SearchPlan["queries"][number];

/** prompts/classify.md: one entry per ad in the batch. */
export const ClassificationSchema = z.object({
  ads: z.array(
    z.object({
      adId: z.string(),
      relevant: z.boolean(),
      rejectReason: z.string(), // why it is noise, "" when relevant
      contentType: z.enum(["static", "video_brand", "ugc", "creator", "third_party"]),
      aiGenerated: z.boolean(),
      relevance: z.number(), // 0-10 fit with brand, industry, briefing
      quality: z.number(), // 0-10 creative craft and hook strength
      gapFit: z.number(), // 0-10 how well it fills a gap of the client
      funnel: z.enum(["tof", "mof", "bof", "retention"]),
      angles: z.array(z.string()),
      whatYouSee: z.string(), // one Dutch sentence describing the creative
    }),
  ),
});
export type Classification = z.infer<typeof ClassificationSchema>["ads"][number];

/** prompts/application.md */
export const CopySchema = z.object({
  items: z.array(
    z.object({
      adId: z.string(),
      application: z.string(), // 1-2 sentences, client tone, real product names
      whyThis: z.string(), // short marketer rationale
    }),
  ),
  summary: z.array(z.string()),
});
export type CopyResult = z.infer<typeof CopySchema>;
