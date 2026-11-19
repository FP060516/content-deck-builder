import Link from "next/link";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { DeckStatusBadge } from "@/components/deck-status";

export const dynamic = "force-dynamic";

export default async function DecksPage() {
  const decks = await db.deck.findMany({ orderBy: { updatedAt: "desc" }, include: { client: true } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Decks</h1>
      <Card className="divide-y">
        {decks.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nog geen decks. Start er een vanaf een klant.</p>}
        {decks.map((d) => (
          <Link key={d.id} href={`/decks/${d.id}`} className="flex items-center gap-4 p-4 hover:bg-accent/40">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{d.title}</p>
              <p className="text-xs text-muted-foreground">{d.client.name} · {d.updatedAt.toLocaleDateString("nl-NL")} · ronde {d.round}</p>
            </div>
            <DeckStatusBadge status={d.status} />
          </Link>
        ))}
      </Card>
    </div>
  );
}
