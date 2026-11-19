import { z } from "zod";

/** What Claude proposes for the client profile from the website (prompts/client-profile.md). */
export const ProfileProposalSchema = z.object({
  industry: z.string(),
  positioning: z.enum(["budget", "mid", "premium", "luxury"]),
  language: z.string(),
  country: z.string(),
  toneSummary: z.string(),
  toneExamples: z.array(z.string()),
  usps: z.array(z.string()),
  forbiddenClaims: z.array(z.string()),
  competitors: z.array(z.string()),
  notes: z.array(z.string()),
});
export type ProfileProposal = z.infer<typeof ProfileProposalSchema>;

/** Gap analysis of the client's own ads (prompts/gap-analysis.md). */
export const GapAnalysisSchema = z.object({
  summary: z.string(),
  doesWell: z.array(z.string()),
  gaps: z.array(z.object({
    gap: z.string(),
    funnel: z.enum(["tof", "mof", "bof", "retention", "general"]),
    priority: z.enum(["high", "medium", "low"]),
  })),
  likelyWinners: z.array(z.string()),
});
export type GapAnalysis = z.infer<typeof GapAnalysisSchema>;

/** Turns the gap analysis into the editable notes field on the client. */
export function gapToNotes(g: GapAnalysis, adCount: number): string {
  const fl: Record<string, string> = { tof: "TOF", mof: "MOF", bof: "BOF", retention: "Retentie", general: "Algemeen" };
  const pr: Record<string, string> = { high: "hoog", medium: "midden", low: "laag" };
  const order = { high: 0, medium: 1, low: 2 } as const;
  const lines = [
    `Op basis van ${adCount} eigen ads in de Ad Library.`,
    g.summary,
    "",
    "Gaten:",
    ...[...g.gaps].sort((a, b) => order[a.priority] - order[b.priority]).map((x) => `- [${fl[x.funnel]} · ${pr[x.priority]}] ${x.gap}`),
  ];
  if (g.doesWell.length) lines.push("", "Gaat al goed:", ...g.doesWell.map((x) => `- ${x}`));
  if (g.likelyWinners.length) lines.push("", "Waarschijnlijke winnaars:", ...g.likelyWinners.map((x) => `- ${x}`));
  return lines.join("\n").trim();
}
