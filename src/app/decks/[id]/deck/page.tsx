import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadDeckView } from "@/lib/deck/load";
import { DeckTabs } from "@/components/deck-tabs";
import { DeckEditor } from "./deck-editor";

export const dynamic = "force-dynamic";

export default async function DeckReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await loadDeckView(id);
  if (!deck) notFound();
  const rejected = await db.adCandidate.count({ where: { deckId: id, rejected: true } });
  return (
    <div>
      <DeckTabs deckId={id} active="deck" itemCount={deck.items.length} />
      <DeckEditor deck={deck} rejectedCount={rejected} />
    </div>
  );
}
