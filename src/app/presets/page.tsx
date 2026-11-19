import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { BUILT_IN_PRESETS } from "@/lib/briefing/presets";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deletePreset } from "../actions";

export const dynamic = "force-dynamic";

export default async function PresetsPage() {
  const own = await db.briefingPreset.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="sc-heading text-3xl font-semibold tracking-tight md:text-4xl">Presets</h1>
        <p className="text-sm text-muted-foreground">Je kiest presets bovenaan het briefingscherm. Eigen presets sla je op vanuit een briefing.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {own.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex-row items-start justify-between">
              <div className="space-y-1"><CardTitle>{p.name}</CardTitle><Badge>Eigen</Badge></div>
              <form action={deletePreset.bind(null, p.id)}><Button variant="ghost" size="icon-sm" aria-label="Verwijder"><Trash2 className="size-3.5" /></Button></form>
            </CardHeader>
          </Card>
        ))}
        {BUILT_IN_PRESETS.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>{p.description}</CardDescription>
            </CardHeader>
            <CardContent><Badge variant="secondary">Ingebouwd</Badge></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
