"use server";
import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { getSetting, setSetting } from "@/lib/settings";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function saveSettings(input: { apiKey?: string; model: string; modelCopy: string }): Promise<Result> {
  if (input.apiKey !== undefined) {
    const k = input.apiKey.trim();
    if (k && !k.startsWith("sk-ant-")) return { ok: false, error: "Een Anthropic API-sleutel begint met sk-ant-." };
    await setSetting("anthropicApiKey", k);
  }
  await setSetting("anthropicModel", input.model.trim());
  await setSetting("anthropicModelCopy", input.modelCopy.trim());
  revalidatePath("/settings");
  return { ok: true };
}

/** Cheapest possible check that the key works: list one model. No tokens are used. */
export async function testApiKey(): Promise<Result> {
  const apiKey = await getSetting("anthropicApiKey");
  if (!apiKey) return { ok: false, error: "Er is nog geen API-sleutel ingesteld." };
  try {
    const client = new Anthropic({ apiKey });
    const model = await client.models.retrieve(await getSetting("anthropicModel"));
    return { ok: true, message: `Verbinding werkt. Model: ${model.display_name}.` };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: "De sleutel wordt niet geaccepteerd." };
    if (e instanceof Anthropic.NotFoundError) return { ok: false, error: "De sleutel werkt, maar het gekozen model bestaat niet of is niet beschikbaar." };
    if (e instanceof Anthropic.APIConnectionError) return { ok: false, error: "Geen verbinding met Anthropic." };
    return { ok: false, error: e instanceof Error ? e.message : "Onbekende fout" };
  }
}
