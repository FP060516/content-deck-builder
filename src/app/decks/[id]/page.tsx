import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/utils";
import { hydrateBriefing } from "@/lib/briefing/schema";
import { BriefingForm, type ClientLite } from "./briefing-form";

export const dynamic = "force-dynamic";

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await db.deck.findUnique({ where: { id } });
  if (!deck) notFound();

  const [clients, presets, used] = await Promise.all([
    db.client.findMany({ orderBy: { name: "asc" } }),
    db.briefingPreset.findMany({ orderBy: { createdAt: "desc" } }),
    db.usedAdvertiser.findMany({ where: { deckId: { not: deck.id } }, select: { clientId: true, advertiser: true }, distinct: ["clientId", "advertiser"] }),
  ]);

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

  return (
    <BriefingForm
      deckId={deck.id}
      initialTitle={deck.title}
      initialBriefing={hydrateBriefing(parseJson(deck.briefing, {}), deck.clientId)}
      status={deck.status}
      clients={clientsLite}
      userPresets={presets.map((p) => ({ id: p.id, name: p.name, briefing: parseJson(p.briefing, {}) }))}
    />
  );
}
