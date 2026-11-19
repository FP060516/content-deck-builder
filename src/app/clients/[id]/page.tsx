import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, FileText, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { toClientInput } from "@/lib/client-profile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientForm } from "../client-form";
import { createDeck, deleteClient, duplicateDeck } from "../../actions";
import { DeckStatusBadge } from "@/components/deck-status";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await db.client.findUnique({
    where: { id },
    include: { decks: { orderBy: { createdAt: "desc" } }, usedAdvertisers: { distinct: ["advertiser"], orderBy: { advertiser: "asc" } } },
  });
  if (!client) notFound();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground"><Link href="/" className="hover:underline">Klanten</Link> / {client.name}</p>
            <h1 className="sc-heading text-3xl font-semibold tracking-tight md:text-4xl">{client.name}</h1>
          </div>
          <form action={deleteClient.bind(null, client.id)}>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"><Trash2 /> Verwijderen</Button>
          </form>
        </div>
        <ClientForm id={client.id} initial={toClientInput(client)} />
      </div>

      <aside className="space-y-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Decks</CardTitle>
            <form action={createDeck.bind(null, client.id, undefined)}>
              <Button size="sm"><Plus /> Nieuw deck</Button>
            </form>
          </CardHeader>
          <CardContent className="space-y-2">
            {client.decks.length === 0 && <p className="text-sm text-muted-foreground">Nog geen decks.</p>}
            {client.decks.map((d) => (
              <div key={d.id} className="flex items-center gap-2 rounded-lg border p-3 hover:bg-accent/40">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <Link href={`/decks/${d.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.createdAt.toLocaleDateString("nl-NL")} · ronde {d.round}</p>
                </Link>
                <DeckStatusBadge status={d.status} />
                <form action={duplicateDeck.bind(null, d.id)}>
                  <Button variant="ghost" size="icon-sm" aria-label="Dupliceer als nieuwe briefing" title="Dupliceer als nieuwe briefing"><Copy className="size-3.5" /></Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gebruikte adverteerders</CardTitle>
            <CardDescription>Worden standaard uitgesloten in nieuwe rondes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {client.usedAdvertisers.length === 0 ? <p className="text-sm text-muted-foreground">Nog geen.</p> :
              client.usedAdvertisers.map((u) => <Badge key={u.id} variant="secondary">{u.advertiser}</Badge>)}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
