import type { ClientInput, Product } from "../client-profile";
import type { ProfileJobResult } from "../jobs/profile";

export type ProfilePatch = Partial<ClientInput>;

export type Section = "basics" | "tone" | "examples" | "usps" | "forbidden" | "competitors" | "products" | "gap";

/** Builds the patch for the sections the user ticked. Lists are merged, never thrown away. */
export function buildPatch(r: ProfileJobResult, current: ClientInput, pick: Set<Section>): ProfilePatch {
  const patch: ProfilePatch = {};
  const merge = (a: string[], b: string[]) => [...a, ...b.filter((x) => !a.some((y) => y.toLowerCase() === x.toLowerCase()))];
  const pr = r.proposal;
  if (pr) {
    if (pick.has("basics")) {
      if (pr.industry) patch.industry = pr.industry;
      patch.positioning = pr.positioning;
      if (pr.language) patch.language = pr.language.toLowerCase().slice(0, 2);
      if (pr.country) patch.country = pr.country.toUpperCase().slice(0, 2);
    }
    if (pick.has("tone") && pr.toneSummary) patch.toneSummary = pr.toneSummary;
    if (pick.has("examples")) patch.toneExamples = merge(current.toneExamples, pr.toneExamples);
    if (pick.has("usps")) patch.usps = merge(current.usps, pr.usps);
    if (pick.has("forbidden")) patch.forbiddenClaims = merge(current.forbiddenClaims, pr.forbiddenClaims);
    if (pick.has("competitors")) patch.competitors = merge(current.competitors, pr.competitors);
  }
  if (pick.has("products") && r.products.length) {
    const known = new Set(current.products.map((p) => p.name.toLowerCase()));
    patch.products = [...current.products, ...r.products.filter((p: Product) => !known.has(p.name.toLowerCase()))];
  }
  if (pick.has("gap") && r.gap?.notes) patch.gapAnalysisNotes = r.gap.notes;
  return patch;
}

