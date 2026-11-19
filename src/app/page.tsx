import Link from "next/link";
import { Plus, Globe, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createDeck } from "./actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const clients = await db.client.findMany({ orderBy: { updatedAt: "desc" }, include: { decks: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { decks: true } } } });
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/90"><span className="size-1.5 rounded-full bg-primary" />Short Commerce · Content decks</span>
          <h1 className="sc-heading text-3xl font-semibold tracking-tight md:text-4xl">Klanten</h1>
          <p className="text-sm text-muted-foreground">Kies een klant en start een nieuw content deck.</p>
        </div>
        <Button asChild><Link href="/clients/new"><Plus /> Nieuwe klant</Link></Button>
      </div>

      {clients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="font-medium">Nog geen klanten</p>
            <p className="max-w-sm text-sm text-muted-foreground">Maak een klant aan met website, tone of voice en producten. Daarna kun je een briefing invullen.</p>
            <Button asChild><Link href="/clients/new"><Plus /> Eerste klant aanmaken</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Card key={c.id} className="flex flex-col transition-colors hover:border-primary/40">
              <CardHeader>
                <Link href={`/clients/${c.id}`} className="hover:underline"><CardTitle>{c.name}</CardTitle></Link>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {c.industry && <Badge variant="secondary">{c.industry}</Badge>}
                  <Badge variant="outline">{c.country}</Badge>
                  <Badge variant="outline" className="capitalize">{c.positioning}</Badge>
                </div>
              </CardHeader>
              <CardContent className="mt-auto space-y-3 text-sm">
                {c.websiteUrl && <p className="flex items-center gap-1.5 truncate text-muted-foreground"><Globe className="size-3.5" />{c.websiteUrl.replace(/^https?:\/\//, "")}</p>}
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="size-3.5" />{c._count.decks} deck{c._count.decks === 1 ? "" : "s"} · {parseJson<unknown[]>(c.products, []).length} producten
                </p>
                <div className="flex gap-2">
                  <form action={createDeck.bind(null, c.id, undefined)} className="flex-1"><Button className="w-full" size="sm"><Plus /> Nieuw deck</Button></form>
                  <Button asChild variant="outline" size="sm"><Link href={`/clients/${c.id}`}>Profiel</Link></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
