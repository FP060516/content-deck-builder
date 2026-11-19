"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { slugify, parseJson } from "@/lib/utils";
import { ClientInputSchema, toClientData, type ClientInput } from "@/lib/client-profile";
import { BriefingSchema, DEFAULT_BRIEFING, hydrateBriefing, type Briefing, type BriefingTemplate } from "@/lib/briefing/schema";
import { BUILT_IN_PRESETS } from "@/lib/briefing/presets";
import { periodLabel } from "@/lib/briefing/search-window";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function uniqueSlug(name: string, excludeId?: string) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const hit = await db.client.findUnique({ where: { slug } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
}

export async function saveClient(id: string | null, input: ClientInput): Promise<Result<{ id: string }>> {
  const parsed = ClientInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const data = toClientData(parsed.data);
  const slug = await uniqueSlug(parsed.data.name, id ?? undefined);
  const client = id
    ? await db.client.update({ where: { id }, data: { ...data, slug } })
    : await db.client.create({ data: { ...data, slug } });
  revalidatePath("/");
  revalidatePath(`/clients/${client.id}`);
  return { ok: true, data: { id: client.id } };
}

export async function deleteClient(id: string) {
  await db.client.delete({ where: { id } });
  revalidatePath("/");
  redirect("/");
}

/** Creates a draft deck for a client, optionally from a built-in ("builtin:<id>") or user preset id. */
export async function createDeck(clientId: string, presetRef?: string) {
  let template: BriefingTemplate = DEFAULT_BRIEFING;
  if (presetRef?.startsWith("builtin:")) {
    template = BUILT_IN_PRESETS.find((p) => "builtin:" + p.id === presetRef)?.briefing ?? template;
  } else if (presetRef) {
    const p = await db.briefingPreset.findUnique({ where: { id: presetRef } });
    if (p) template = hydrateBriefing(parseJson(p.briefing, {}));
  }
  const client = await db.client.findUniqueOrThrow({ where: { id: clientId } });
  const briefing = hydrateBriefing({ ...template, clientId });
  briefing.inspiration.competitors = parseJson<string[]>(client.competitors, []);
  const deck = await db.deck.create({
    data: { clientId, title: `${client.name} – ${periodLabel(briefing.period)}`, briefing: JSON.stringify(briefing) },
  });
  redirect(`/decks/${deck.id}`);
}

export async function saveBriefing(deckId: string, title: string, briefing: Briefing): Promise<Result> {
  const parsed = BriefingSchema.safeParse(briefing);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Briefing is onvolledig" };
  await db.deck.update({ where: { id: deckId }, data: { title: title.trim() || "Naamloos deck", briefing: JSON.stringify(parsed.data), clientId: parsed.data.clientId } });
  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/decks");
  return { ok: true };
}

export async function duplicateDeck(deckId: string) {
  const d = await db.deck.findUniqueOrThrow({ where: { id: deckId } });
  const copy = await db.deck.create({ data: { clientId: d.clientId, title: `${d.title} (kopie)`, briefing: d.briefing } });
  redirect(`/decks/${copy.id}`);
}

export async function deleteDeck(deckId: string) {
  const d = await db.deck.delete({ where: { id: deckId } });
  revalidatePath("/decks");
  redirect(`/clients/${d.clientId}`);
}

export async function savePreset(name: string, briefing: Briefing): Promise<Result> {
  if (!name.trim()) return { ok: false, error: "Geef de preset een naam" };
  const { clientId: _omit, ...template } = briefing;
  void _omit;
  template.inspiration = { ...template.inspiration, competitors: [], excludeBrands: [] };
  await db.briefingPreset.create({ data: { name: name.trim(), briefing: JSON.stringify(template) } });
  revalidatePath("/presets");
  return { ok: true };
}

export async function deletePreset(id: string) {
  await db.briefingPreset.delete({ where: { id } });
  revalidatePath("/presets");
}
