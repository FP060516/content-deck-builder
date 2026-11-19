import { getSetting, maskKey } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [key, model, modelCopy] = await Promise.all([getSetting("anthropicApiKey"), getSetting("anthropicModel"), getSetting("anthropicModelCopy")]);
  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-3">
        <h1 className="sc-heading text-3xl font-semibold tracking-tight md:text-4xl">Instellingen</h1>
        <p className="text-sm text-muted-foreground">Claude analyseert websites, eigen ads en schrijft later de toepassingsteksten. Daarvoor is een API-sleutel van Anthropic nodig.</p>
      </div>
      <SettingsForm maskedKey={maskKey(key)} model={model} modelCopy={modelCopy} />
    </div>
  );
}
