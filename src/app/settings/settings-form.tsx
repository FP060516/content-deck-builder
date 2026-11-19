"use client";
import * as React from "react";
import { toast } from "sonner";
import { KeyRound, PlugZap, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveSettings, testApiKey } from "./actions";

export function SettingsForm({ maskedKey, model, modelCopy }: { maskedKey: string; model: string; modelCopy: string }) {
  const [apiKey, setApiKey] = React.useState("");
  const [m, setM] = React.useState(model);
  const [mc, setMc] = React.useState(modelCopy);
  const [pending, start] = React.useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveSettings({ apiKey: apiKey ? apiKey : undefined, model: m, modelCopy: mc });
      if (!res.ok) return void toast.error(res.error);
      setApiKey("");
      toast.success("Instellingen opgeslagen");
    });
  };
  const test = () => start(async () => {
    const res = await testApiKey();
    if (res.ok) toast.success(res.message ?? "Werkt");
    else toast.error(res.error);
  });

  return (
    <form onSubmit={save} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /> Anthropic API-sleutel</CardTitle>
          <CardDescription>
            Maak een sleutel aan op platform.claude.com (API keys) en plak hem hieronder. Hij wordt alleen op deze computer opgeslagen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">Huidige sleutel: {maskedKey ? <code className="rounded bg-white/5 px-1.5 py-0.5">{maskedKey}</code> : <span className="text-warning">nog niet ingesteld</span>}</p>
          <Input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-…" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={test} disabled={pending || !maskedKey}><PlugZap /> Verbinding testen</Button>
            <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">Sleutel aanmaken <ExternalLink className="size-3.5" /></a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modellen</CardTitle>
          <CardDescription>Laat dit staan, tenzij je weet wat je wijzigt.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Analyse (profiel, gat-analyse, classificatie)</Label>
            <Input value={m} onChange={(e) => setM(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Teksten (toepassingsteksten)</Label>
            <Input value={mc} onChange={(e) => setMc(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>{pending ? "Opslaan…" : "Opslaan"}</Button>
    </form>
  );
}
