import { z } from "zod";
import type { RawAd } from "../adsource/types";

const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const AdSearchQuerySchema = z.object({
  country: z.string().length(2),
  q: z.string().trim().min(2, "Vul een zoekterm in (min. 2 tekens)."),
  exactPhrase: z.boolean().optional(),
  mediaType: z.enum(["all", "image", "video"]).optional(),
  range: z.object({ from: YMD, to: YMD }).optional(),
});

export const ScrapePayloadSchema = z.object({
  queries: z.array(AdSearchQuerySchema).min(1).max(20),
  client: z.string().default("test"),
  folder: z.string().default("scraper"),
  maxPerQuery: z.number().int().min(1).max(100).default(30),
  download: z.boolean().default(true),
  useCache: z.boolean().default(true),
  deckId: z.string().optional(),
});
export type ScrapePayload = z.infer<typeof ScrapePayloadSchema>;

export type ScrapedAd = RawAd & { mediaUrlLocal: string; posterUrlLocal: string; mediaHash: string; downloadError?: string };
export type ScrapeResult = { ads: ScrapedAd[]; fromCache: number; warnings: string[] };
