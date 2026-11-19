import { z } from "zod";
import type { Client } from "@prisma/client";
import { parseJson } from "./utils";

export const ProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().default(""),
  price: z.string().default(""),
  url: z.string().default(""),
});
export type Product = z.infer<typeof ProductSchema>;

export const ClientInputSchema = z.object({
  name: z.string().trim().min(1, "Naam is verplicht"),
  websiteUrl: z.string().trim().default(""),
  industry: z.string().default(""),
  country: z.string().default("NL"),
  language: z.string().default("nl"),
  positioning: z.enum(["budget", "mid", "premium", "luxury"]).default("mid"),
  toneSummary: z.string().default(""),
  toneExamples: z.array(z.string()).default([]),
  products: z.array(ProductSchema).default([]),
  usps: z.array(z.string()).default([]),
  forbiddenClaims: z.array(z.string()).default([]),
  competitors: z.array(z.string()).default([]),
  adLibraryPage: z.string().default(""),
  gapAnalysisNotes: z.string().default(""),
});
export type ClientInput = z.infer<typeof ClientInputSchema>;

export const EMPTY_CLIENT: ClientInput = { ...ClientInputSchema.parse({ name: "x" }), name: "" };

export function toClientInput(c: Client): ClientInput {
  return {
    name: c.name,
    websiteUrl: c.websiteUrl,
    industry: c.industry,
    country: c.country,
    language: c.language,
    positioning: c.positioning as ClientInput["positioning"],
    toneSummary: c.toneSummary,
    toneExamples: parseJson(c.toneExamples, []),
    products: parseJson(c.products, []),
    usps: parseJson(c.usps, []),
    forbiddenClaims: parseJson(c.forbiddenClaims, []),
    competitors: parseJson(c.competitors, []),
    adLibraryPage: c.adLibraryPage,
    gapAnalysisNotes: c.gapAnalysisNotes,
  };
}

export function toClientData(i: ClientInput) {
  return {
    ...i,
    toneExamples: JSON.stringify(i.toneExamples),
    products: JSON.stringify(i.products),
    usps: JSON.stringify(i.usps),
    forbiddenClaims: JSON.stringify(i.forbiddenClaims),
    competitors: JSON.stringify(i.competitors),
  };
}
