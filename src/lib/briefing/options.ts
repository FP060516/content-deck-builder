// All selectable briefing options. Labels are Dutch (UI), keys are English.

export type Option = { value: string; label: string; description?: string };
export type OptionGroup = { label: string; options: Option[] };

export const flatten = (groups: OptionGroup[]): Option[] => groups.flatMap((g) => g.options);
export const labelOf = (groups: OptionGroup[], value: string) =>
  flatten(groups).find((o) => o.value === value)?.label ?? value;

// ---------- Funnel ----------
export const FUNNEL_STAGES = [
  {
    value: "tof",
    label: "TOF (Awareness)",
    short: "TOF",
    description:
      "Nieuw publiek: hook-gedreven, merkverhaal, lifestyle, entertainment, creators. Geen hard aanbod.",
  },
  {
    value: "mof",
    label: "MOF (Consideration)",
    short: "MOF",
    description:
      "Productdemo, USP's, vergelijkingen, reviews en social proof, uitleg, 'hoe draag/gebruik je het', bundels.",
  },
  {
    value: "bof",
    label: "BOF (Conversion)",
    short: "BOF",
    description:
      "Aanbod, korting, urgentie en deadline, schaarste, garantie, gratis verzending, retargeting ('nog in je mandje').",
  },
  {
    value: "retention",
    label: "Retentie / Loyaliteit",
    short: "RET",
    description:
      "Bestaande klanten: cross-sell, aanvulling, loyaliteitsprogramma, VIP early access, winback.",
  },
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number]["value"];

// ---------- Campaign goal ----------
export const GOALS: OptionGroup[] = [
  {
    label: "Awareness / Bereik",
    options: [
      { value: "awareness.brand_intro", label: "Merkintroductie" },
      { value: "awareness.new_market", label: "Nieuwe markt of land" },
      { value: "awareness.brand_story", label: "Merkverhaal" },
      { value: "awareness.rebrand", label: "Rebranding" },
    ],
  },
  {
    label: "Traffic / Engagement",
    options: [
      { value: "traffic.content", label: "Blog of content" },
      { value: "traffic.quiz", label: "Quiz" },
      { value: "traffic.community", label: "Community" },
      { value: "traffic.social_follow", label: "Social follow" },
    ],
  },
  {
    label: "Leadgeneratie",
    options: [
      { value: "leads.newsletter", label: "Nieuwsbriefinschrijving (met korting)" },
      { value: "leads.giveaway", label: "Giveaway / winactie" },
      { value: "leads.waitlist", label: "Wachtlijst" },
      { value: "leads.early_access", label: "Early access" },
      { value: "leads.free_sample", label: "Gratis sample" },
      { value: "leads.consult", label: "Gratis consult of advies" },
      { value: "leads.lookbook", label: "Catalogus of lookbook downloaden" },
      { value: "leads.advent", label: "Adventskalender-actie" },
      { value: "leads.savings", label: "Spaaractie" },
    ],
  },
  {
    label: "Sales – lancering",
    options: [
      { value: "launch.collection", label: "Nieuwe collectie" },
      { value: "launch.product", label: "Nieuw product" },
      { value: "launch.collab", label: "Collab of capsule" },
      { value: "launch.limited", label: "Limited edition" },
      { value: "launch.drop", label: "Drop" },
      { value: "launch.preorder", label: "Pre-order" },
      { value: "launch.restock", label: "Restock / 'weer op voorraad'" },
    ],
  },
  {
    label: "Sales – promotie",
    options: [
      { value: "promo.sale", label: "Korting of sale" },
      { value: "promo.bundle", label: "Bundel of set" },
      { value: "promo.gwp", label: "Gift with purchase" },
      { value: "promo.free_shipping", label: "Gratis verzending vanaf een bedrag" },
      { value: "promo.b2g1", label: "Koop er 2, betaal 1" },
      { value: "promo.giftcard", label: "Cadeaubon" },
      { value: "promo.price_drop", label: "Prijsverlaging" },
      { value: "promo.outlet", label: "Outlet" },
    ],
  },
  {
    label: "Sales – always on",
    options: [
      { value: "always.bestseller", label: "Bestseller pushen" },
      { value: "always.hero", label: "Hero-product" },
      { value: "always.cross_upsell", label: "Cross-sell en upsell" },
      { value: "always.category", label: "Categorie pushen" },
    ],
  },
  {
    label: "Retentie",
    options: [
      { value: "retention.winback", label: "Winback" },
      { value: "retention.loyalty", label: "Loyaliteitsprogramma" },
      { value: "retention.review", label: "Review vragen" },
      { value: "retention.replenish", label: "Aanvulling of abonnement" },
    ],
  },
  {
    label: "Offline / overig",
    options: [
      { value: "offline.store_visit", label: "Winkelbezoek" },
      { value: "offline.event", label: "Event of opening" },
      { value: "offline.app_install", label: "App-installaties" },
    ],
  },
];

/** Main goals are the group labels; sub goals are the items in that group. */
export const GOAL_MAINS: Option[] = GOALS.map((g) => ({
  value: g.options[0].value.split(".")[0],
  label: g.label,
}));
export const goalGroupFor = (main: string) =>
  GOALS.find((g) => g.options[0].value.startsWith(main + "."));

// ---------- Angles ----------
export const ANGLES: OptionGroup[] = [
  {
    label: "Product & bewijs",
    options: [
      { value: "problem_solution", label: "Probleem → oplossing" },
      { value: "social_proof", label: "Social proof / reviews" },
      { value: "product_demo", label: "Productdemo / close-up" },
      { value: "before_after", label: "Voor en na" },
      { value: "comparison", label: "Vergelijking ('wij vs. zij')" },
      { value: "educational", label: "Educatief / tips" },
      { value: "press", label: "Persvermeldingen / autoriteit" },
    ],
  },
  {
    label: "Merk & verhaal",
    options: [
      { value: "founder_bts", label: "Founder story / achter de schermen" },
      { value: "lifestyle", label: "Lifestyle / sfeer" },
      { value: "sustainability", label: "Duurzaamheid / waarden" },
      { value: "seasonal_mood", label: "Seizoenssfeer" },
    ],
  },
  {
    label: "Creator & community",
    options: [
      { value: "unboxing", label: "Unboxing" },
      { value: "grwm_styling", label: "GRWM / styling" },
      { value: "ugc_compilation", label: "Community / UGC-compilatie" },
      { value: "trend_sound", label: "Trend / sound" },
      { value: "humor", label: "Humor / meme" },
    ],
  },
  {
    label: "Aanbod & doelgroep",
    options: [
      { value: "gifting", label: "Cadeau / gifting" },
      { value: "urgency", label: "Urgentie / deadline" },
      { value: "scarcity", label: "Schaarste / limited" },
      { value: "personalisation", label: "Personalisatie" },
      { value: "audience_targeted", label: "Doelgroepgericht ('voor hem', 'voor moeders')" },
    ],
  },
];

// ---------- Content types (deck structure) ----------
export const CONTENT_TYPES = [
  {
    value: "static",
    label: "Statics",
    description:
      "Afbeelding of carrousel gemaakt door het merk zelf (productfoto, editorial, grafisch, tekst-op-beeld).",
  },
  {
    value: "video_brand",
    label: "Video (merk)",
    description: "Video geproduceerd door het merk: campagnefilm, productvideo, motion, studio.",
  },
  {
    value: "ugc",
    label: "UGC",
    description:
      "Video in de stijl van een gewone klant: selfie, telefoon, review, unboxing; niet gepolijst.",
  },
  {
    value: "creator",
    label: "Creator content",
    description:
      "Een herkenbare influencer of creator, vaak vanaf hun eigen account of als partnership ('X met Merk'), GRWM, haul.",
  },
  {
    value: "third_party",
    label: "Third-party content",
    description:
      "Van of via derden: partnership ads/whitelisting vanaf een andere pagina, retailers die het merk adverteren, pers/media, affiliate- of reviewpagina's.",
  },
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number]["value"];

// ---------- Markets ----------
export const COUNTRIES: Option[] = [
  { value: "NL", label: "Nederland" },
  { value: "BE", label: "België" },
  { value: "DE", label: "Duitsland" },
  { value: "IE", label: "Ierland (Engelstalig)" },
  { value: "FR", label: "Frankrijk" },
  { value: "ES", label: "Spanje" },
  { value: "IT", label: "Italië" },
  { value: "AT", label: "Oostenrijk" },
  { value: "DK", label: "Denemarken" },
  { value: "SE", label: "Zweden" },
];

export const LANGUAGES: Option[] = [
  { value: "nl", label: "Nederlands" },
  { value: "en", label: "Engels" },
  { value: "de", label: "Duits" },
  { value: "fr", label: "Frans" },
];

export const BREADTH_LEVELS = [
  { value: 0, label: "Alleen directe concurrenten" },
  { value: 1, label: "Eigen branche" },
  { value: 2, label: "Aangrenzende branches" },
  { value: 3, label: "Alles (out of the box)" },
];

export const POSITIONINGS: Option[] = [
  { value: "budget", label: "Budget" },
  { value: "mid", label: "Mid" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxe" },
];

export const INDUSTRIES: Option[] = [
  "Sieraden",
  "Mode – dames",
  "Mode – heren",
  "Schoenen",
  "Tassen & accessoires",
  "Brillen",
  "Beauty & skincare",
  "Parfum",
  "Haarverzorging",
  "Wonen & interieur",
  "Tuin",
  "Food & drinks",
  "Koffie & thee",
  "Chocolade & zoetwaren",
  "Supplementen & gezondheid",
  "Sport & outdoor",
  "Kinderen & baby",
  "Speelgoed",
  "Huisdieren",
  "Elektronica",
  "Cadeaus & gepersonaliseerd",
  "Bloemen & planten",
  "Boeken & papier",
  "Auto & mobiliteit",
  "Bruiloft",
  "Overig",
].map((l) => ({ value: l, label: l }));
