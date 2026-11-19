import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { getSetting } from "../settings";
import { loadPrompt } from "./prompts";

/** USD per 1M tokens (input, output). Used for the cost estimate shown in the app. */
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-fable-5-2": [8, 40],
};

export type Usage = { model: string; inputTokens: number; outputTokens: number; costUsd: number };
export type ImageInput = { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string; label?: string };

export type StructuredCall<T> = {
  prompt: string; // file name in /prompts without .md
  vars: Record<string, string>;
  schema: z.ZodType<T>;
  images?: ImageInput[];
  model?: "analysis" | "copy";
  effort?: "low" | "medium" | "high";
};

export class MissingApiKeyError extends Error {
  constructor() { super("Geen Anthropic API-sleutel ingesteld. Vul die in bij Instellingen."); }
}

export function costOf(model: string, input: number, output: number): number {
  const [pi, po] = PRICES[model] ?? [4, 20];
  return (input * pi + output * po) / 1_000_000;
}

type Runner = <T>(call: StructuredCall<T>) => Promise<{ data: T; usage: Usage }>;
let override: Runner | null = null;
/** Tests replace the real API call with a stub. */
export function setClaudeRunnerForTests(r: Runner | null) { override = r; }

export async function hasApiKey(): Promise<boolean> {
  return override !== null || !!(await getSetting("anthropicApiKey")) || !!process.env.ANTHROPIC_AUTH_TOKEN;
}

/** One structured call: prompt from /prompts, JSON output validated against the zod schema. */
export async function callStructured<T>(call: StructuredCall<T>): Promise<{ data: T; usage: Usage }> {
  if (override) return override(call);
  const apiKey = await getSetting("anthropicApiKey");
  if (!apiKey && !process.env.ANTHROPIC_AUTH_TOKEN) throw new MissingApiKeyError();
  const model = await getSetting(call.model === "copy" ? "anthropicModelCopy" : "anthropicModel");
  const client = new Anthropic(apiKey ? { apiKey } : {});
  const { system, user } = await loadPrompt(call.prompt, call.vars);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const img of call.images ?? []) {
    if (img.label) content.push({ type: "text", text: img.label });
    content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } });
  }
  content.push({ type: "text", text: user });

  try {
    const res = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      system,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // a refused request is re-run on a fallback model automatically
      output_config: { effort: call.effort ?? "medium", format: betaZodOutputFormat(call.schema) },
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal") throw new Error("Claude weigerde dit verzoek. Pas de invoer aan en probeer opnieuw.");
    if (res.stop_reason === "max_tokens") throw new Error("Het antwoord van Claude was te lang en is afgebroken.");
    if (!res.parsed_output) throw new Error("Claude gaf geen geldig antwoord terug.");
    const inputTokens = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
    const outputTokens = res.usage.output_tokens;
    return { data: res.parsed_output as T, usage: { model: res.model, inputTokens, outputTokens, costUsd: costOf(res.model, inputTokens, outputTokens) } };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("De API-sleutel wordt niet geaccepteerd. Controleer hem bij Instellingen.");
    if (e instanceof Anthropic.RateLimitError) throw new Error("Te veel verzoeken tegelijk bij Anthropic. Probeer het over een minuut opnieuw.");
    if (e instanceof Anthropic.APIConnectionError) throw new Error("Geen verbinding met Anthropic. Controleer je internet.");
    if (e instanceof Anthropic.APIError) throw new Error(`Fout van Anthropic (${e.status}): ${e.message}`);
    throw e;
  }
}
