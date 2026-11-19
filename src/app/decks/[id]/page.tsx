import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/utils";
import { hydrateBriefing } from "@/lib/briefing/schema";
import { adLibraryAdUrl } from "@/lib/adlibrary/url";
import { getJobView } from "@/lib/jobs/queue";
import { BriefingForm, type ClientLite } from "./briefing-form";
import { DeckResults, type RejectedAd, type ResultItem } from "./deck-results";

export const dynamic = "force-dynamic";

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await db.deck.findUnique({ where: { id } });
  if (!deck) notFound();

  const [clients, presets, used, items, rejected, lastJob] = await Promise.all([
    db.client.findMany({ orderBy: { name: "asc" } }),
    db.briefingPreset.findMany({ orderBy: { createdAt: "desc" } }),
    db.usedAdvertiser.findMany({ where: { deckId: { not: deck.id } }, select: { clientId: true, advertiser: true }, distinct: ["clientId", "advertiser"] }),
    db.deckItem.findMany({ where: { deckId: deck.id }, orderBy: { position: "asc" }, include: { candidate: true } }),
    db.adCandidate.findMany({ where: { deckId: deck.id, rejected: true }, orderBy: { scoreTotal: "desc" }, take: 150 }),
    db.job.findFirst({ where: { deckId: deck.id, type: "generate" }, orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);
  const job = lastJob ? await getJobView(lastJob.id) : null;

  const clientsLite: ClientLite[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    industry: c.industry,
    positioning: c.positioning,
    country: c.country,
    language: c.language,
    competitors: parseJson<string[]>(c.competitors, []),
    productCount: parseJson<unknown[]>(c.products, []).length,
    gapNotes: c.gapAnalysisNotes,
    previousAdvertisers: used.filter((u) => u.clientId === c.id).map((u) => u.advertiser),
  }));

  const resultItems: ResultItem[] = items.map((i) => ({
    id: i.id,
    contentType: i.contentType,
    whatYouSee: i.whatYouSee,
    application: i.application,
    whyThis: i.whyThis,
    funnelTag: i.funnelTag,
    ad: {
      adId: i.candidate.adId,
      advertiser: i.candidate.advertiser,
      mediaType: i.candidate.mediaType,
      bodyText: i.candidate.bodyText,
      startDate: i.candidate.startDate?.toISOString().slice(0, 10) ?? null,
      activeDays: i.candidate.activeDays,
      variantCount: i.candidate.variantCount,
      country: i.candidate.country,
      sourceQuery: i.candidate.sourceQuery,
      media: i.candidate.mediaUrlLocal || i.candidate.mediaUrlOriginal,
      poster: i.candidate.posterUrl,
      scoreTotal: i.candidate.scoreTotal,
      adLibraryUrl: adLibraryAdUrl(i.candidate.adId),
    },
  }));
  const rejectedAds: RejectedAd[] = rejected.map((r) => ({ adId: r.adId, advertiser: r.advertiser, reason: r.rejectReason || "Niet geselecteerd", scoreTotal: r.scoreTotal, adLibraryUrl: adLibraryAdUrl(r.adId) }));

  return (
    <>
      <BriefingForm
        deckId={deck.id}
        initialTitle={deck.title}
        initialBriefing={hydrateBriefing(parseJson(deck.briefing, {}), deck.clientId)}
        status={deck.status}
        clients={clientsLite}
        userPresets={presets.map((p) => ({ id: p.id, name: p.name, briefing: parseJson(p.briefing, {}) }))}
        hasItems={items.length > 0}
      />
      <DeckResults key={job?.id ?? "none"} job={job} summary={deck.summary} items={resultItems} rejected={rejectedAds} />
    </>
  );
}
