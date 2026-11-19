import { DEFAULT_BRIEFING, type BriefingTemplate } from "./schema";

export type BuiltInPreset = { id: string; name: string; description: string; briefing: BriefingTemplate };

const base = DEFAULT_BRIEFING;
const insp = (o: Partial<BriefingTemplate["inspiration"]>) => ({ ...base.inspiration, ...o });

export const BUILT_IN_PRESETS: BuiltInPreset[] = [
  {
    id: "q4_gifting_bof",
    name: "Q4 Gifting – BOF",
    description: "Cadeauseizoen, conversie: deadlines, gift guides, bundels.",
    briefing: {
      ...base,
      period: { type: "season", seasonId: "gift_season" },
      funnel: ["bof"],
      goal: { main: "promo", subs: ["promo.bundle", "promo.gwp", "promo.giftcard"] },
      angles: ["gifting", "urgency", "audience_targeted", "seasonal_mood"],
      structure: { static: 10, video_brand: 5, ugc: 3, creator: 2, third_party: 0 },
      inspiration: insp({ breadth: 2 }),
    },
  },
  {
    id: "new_collection_tof",
    name: "Nieuwe collectie – TOF",
    description: "Lancering voor nieuw publiek: sfeer, styling en creators.",
    briefing: {
      ...base,
      period: { type: "evergreen" },
      funnel: ["tof"],
      goal: { main: "launch", subs: ["launch.collection"] },
      angles: ["lifestyle", "grwm_styling", "founder_bts", "trend_sound"],
      structure: { static: 5, video_brand: 5, ugc: 2, creator: 3, third_party: 0 },
      inspiration: insp({ breadth: 2, pricePositioning: "higher" }),
    },
  },
  {
    id: "black_friday_bof",
    name: "Black Friday – BOF",
    description: "Korting, urgentie en schaarste rond Black Week.",
    briefing: {
      ...base,
      period: { type: "moment", momentId: "black_week" },
      funnel: ["bof"],
      goal: { main: "promo", subs: ["promo.sale"] },
      angles: ["urgency", "scarcity", "social_proof"],
      structure: { static: 8, video_brand: 4, ugc: 2, creator: 0, third_party: 0 },
    },
  },
  {
    id: "valentines_mof_bof",
    name: "Valentijn – MOF/BOF",
    description: "Cadeau-inspiratie en deadline-ads voor 14 februari.",
    briefing: {
      ...base,
      period: { type: "moment", momentId: "valentines" },
      funnel: ["mof", "bof"],
      goal: { main: "promo", subs: ["promo.bundle", "promo.gwp"] },
      angles: ["gifting", "audience_targeted", "personalisation", "urgency"],
      structure: { static: 6, video_brand: 4, ugc: 2, creator: 2, third_party: 0 },
    },
  },
  {
    id: "mothers_day",
    name: "Moederdag – gifting",
    description: "Van TOF tot BOF rond Moederdag (NL/BE).",
    briefing: {
      ...base,
      period: { type: "moment", momentId: "mothers_day" },
      funnel: ["tof", "bof"],
      goal: { main: "promo", subs: ["promo.giftcard"] },
      angles: ["gifting", "audience_targeted", "personalisation"],
      structure: { static: 6, video_brand: 4, ugc: 2, creator: 2, third_party: 0 },
    },
  },
  {
    id: "leadgen_newsletter",
    name: "Leadgen – nieuwsbrief",
    description: "Inschrijvingen met korting, giveaways en early access.",
    briefing: {
      ...base,
      period: { type: "evergreen" },
      funnel: ["tof", "mof"],
      goal: { main: "leads", subs: ["leads.newsletter", "leads.giveaway", "leads.early_access"] },
      angles: [],
      structure: { static: 6, video_brand: 2, ugc: 2, creator: 0, third_party: 0 },
      inspiration: insp({ breadth: 3, countries: ["NL", "BE", "IE"], languages: ["nl", "en"] }),
    },
  },
  {
    id: "always_on_mof",
    name: "Always-on – MOF",
    description: "Bestsellers en hero-producten: demo's, reviews, USP's.",
    briefing: {
      ...base,
      period: { type: "evergreen" },
      funnel: ["mof"],
      goal: { main: "always", subs: ["always.bestseller", "always.hero"] },
      angles: ["product_demo", "social_proof", "problem_solution", "comparison"],
      structure: { static: 5, video_brand: 3, ugc: 4, creator: 2, third_party: 1 },
    },
  },
];
