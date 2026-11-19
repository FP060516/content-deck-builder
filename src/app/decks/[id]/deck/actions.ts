"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hasApiKey } from "@/lib/llm/claude";
import { writeCopyFor, type CopyAd } from "@/lib/pipeline/copy";
import type { Classification } from "@/lib/pipeline/schemas";
import { adLibraryAdUrl } from "@/lib/adlibrary/url";
import { contentTypeLabel } from "@/lib/deck/load";
import { forbiddenHits } from "@/lib/pipeline/rank";
import { parseJson } from "@/lib/utils";

type Result<T = undefined> = { ok: true; data?: T; warning?: string } | { ok: false; error: string };

const MARKETER_REPLACED = "Vervangen door marketeer";

const clsOf = (scores: string): Classification | null => {
  try { return (JSON.parse(scores) as { cls?: Classification }).cls ?? null; } catch { return null; }
};
const refresh = (deckId: string) => revalidatePath(`/decks/${deckId}/deck`);

export async function updateItem(itemId: string, patch: { status?: "pending" | "approved" | "rejected"; pinned?: boolean; application?: string; whatYouSee?: string; whyThis?: string }): Promise<Result> {
  const data = { ...patch };
  if (patch.application !== undefined) {
    // Re-check forbidden claims against the edited text so the warning stays truthful.
    const cur = await db.deckItem.findUniqueOrThrow({ where: { id: itemId }, include: { deck: { include: { client: true } } } });
    const hits = forbiddenHits(patch.application, parseJson<string[]>(cur.deck.client.forbiddenClaims, []));
    const base = (patch.whyThis ?? cur.whyThis).replace(/\s*⚠ Controleer:[\s\S]*$/, "");
    data.whyThis = [base, hits.length ? `⚠ Controleer: bevat mogelijk "${hits.join('", "')}".` : ""].filter(Boolean).join(" ");
  }
  const item = await db.deckItem.update({ where: { id: itemId }, data });
  refresh(item.deckId);
  return { ok: true };
}

/** Moves an item one place up or down within its content type. */
export async function moveItem(itemId: string, dir: -1 | 1): Promise<Result> {
  const item = await db.deckItem.findUniqueOrThrow({ where: { id: itemId } });
  const group = await db.deckItem.findMany({ where: { deckId: item.deckId, contentType: item.contentType }, orderBy: { position: "asc" } });
  const i = group.findIndex((g) => g.id === itemId);
  const other = group[i + dir];
  if (!other) return { ok: true };
  await db.$transaction([
    db.deckItem.update({ where: { id: item.id }, data: { position: other.position } }),
    db.deckItem.update({ where: { id: other.id }, data: { position: item.position === other.position ? other.position + dir : item.position } }),
  ]);
  refresh(item.deckId);
  return { ok: true };
}

export async function updateSummary(deckId: string, summary: string): Promise<Result> {
  await db.deck.update({ where: { id: deckId }, data: { summary } });
  refresh(deckId);
  return { ok: true };
}

export async function setDeckDone(deckId: string, done: boolean): Promise<Result> {
  await db.deck.update({ where: { id: deckId }, data: { status: done ? "done" : "review" } });
  refresh(deckId);
  revalidatePath("/decks");
  return { ok: true };
}

export type Alternative = {
  candidateId: string; adId: string; advertiser: string; mediaType: string; contentType: string; contentTypeLabel: string;
  media: string; poster: string; scoreTotal: number; whatYouSee: string; reason: string; activeDays: number | null; variantCount: number; adLibraryUrl: string;
};

/** Ads that were relevant but not chosen, best first; same content type first. */
export async function getAlternatives(itemId: string): Promise<Result<Alternative[]>> {
  const item = await db.deckItem.findUniqueOrThrow({ where: { id: itemId } });
  const cands = await db.adCandidate.findMany({ where: { deckId: item.deckId, rejected: true }, orderBy: { scoreTotal: "desc" } });
  const list = cands
    .map((c) => ({ c, cls: clsOf(c.scores) }))
    .filter(({ c, cls }) => cls?.relevant && c.rejectReason !== MARKETER_REPLACED)
    .map(({ c, cls }): Alternative => ({
      candidateId: c.id, adId: c.adId, advertiser: c.advertiser, mediaType: c.mediaType, contentType: cls!.contentType, contentTypeLabel: contentTypeLabel(cls!.contentType),
      media: c.mediaUrlLocal || c.mediaUrlOriginal, poster: c.posterUrl, scoreTotal: c.scoreTotal, whatYouSee: c.scoreReason, reason: c.rejectReason,
      activeDays: c.activeDays, variantCount: c.variantCount, adLibraryUrl: adLibraryAdUrl(c.adId),
    }))
    .sort((a, b) => Number(b.contentType === item.contentType) - Number(a.contentType === item.contentType) || b.scoreTotal - a.scoreTotal)
    .slice(0, 24);
  return { ok: true, data: list };
}

function copyAdFrom(c: { adId: string; advertiser: string; mediaType: string; country: string; activeDays: number | null; variantCount: number; bodyText: string; mediaUrlLocal: string; posterUrl: string }, whatYouSee: string, contentType: string): CopyAd {
  return {
    adId: c.adId, advertiser: c.advertiser, mediaType: c.mediaType, country: c.country, activeDays: c.activeDays, variantCount: c.variantCount,
    bodyText: c.bodyText, whatYouSee, contentType, image: c.mediaType === "video" ? c.posterUrl : c.mediaUrlLocal,
  };
}

/** Swaps the ad of an item for another candidate and writes a new application text. */
export async function replaceItem(itemId: string, candidateId: string): Promise<Result> {
  const item = await db.deckItem.findUniqueOrThrow({ where: { id: itemId }, include: { candidate: true } });
  const next = await db.adCandidate.findUniqueOrThrow({ where: { id: candidateId } });
  if (next.deckId !== item.deckId) return { ok: false, error: "Deze ad hoort niet bij dit deck." };
  const cls = clsOf(next.scores);
  const contentType = cls?.contentType ?? item.contentType;
  await db.$transaction([
    db.adCandidate.update({ where: { id: item.candidateId }, data: { rejected: true, rejectReason: MARKETER_REPLACED } }),
    db.adCandidate.update({ where: { id: next.id }, data: { rejected: false, rejectReason: "" } }),
    db.deckItem.update({ where: { id: itemId }, data: { candidateId: next.id, contentType, whatYouSee: cls?.whatYouSee ?? next.scoreReason, application: "", whyThis: "", funnelTag: cls?.funnel ?? "", status: "pending", pinned: false } }),
  ]);
  const deck = await db.deck.findUniqueOrThrow({ where: { id: item.deckId } });
  await db.usedAdvertiser.upsert({
    where: { clientId_deckId_advertiser: { clientId: deck.clientId, deckId: deck.id, advertiser: next.advertiser } },
    create: { clientId: deck.clientId, deckId: deck.id, advertiser: next.advertiser }, update: {},
  }).catch(() => {});
  let warning: string | undefined;
  if (await hasApiKey()) {
    try {
      const { items } = await writeCopyFor(item.deckId, [copyAdFrom(next, cls?.whatYouSee ?? next.scoreReason, contentType)], "Deze ad vervangt een ad die de marketeer niet goed vond.");
      const t = items.get(next.adId);
      if (t) await db.deckItem.update({ where: { id: itemId }, data: t });
    } catch (e) {
      warning = `Ad vervangen, maar de tekst kon niet worden geschreven: ${e instanceof Error ? e.message : e}`;
    }
  } else warning = "Ad vervangen. Zonder API-sleutel is er geen nieuwe toepassingstekst geschreven.";
  refresh(item.deckId);
  return { ok: true, warning };
}

/** Rewrites the application text of one item, optionally with an instruction from the marketer. */
export async function rewriteItem(itemId: string, instruction: string): Promise<Result<{ application: string; whyThis: string }>> {
  if (!(await hasApiKey())) return { ok: false, error: "Vul eerst je API-sleutel in bij Instellingen." };
  const item = await db.deckItem.findUniqueOrThrow({ where: { id: itemId }, include: { candidate: true } });
  try {
    const notes = [`Huidige tekst: ${item.application || "(leeg)"}`, instruction.trim() ? `Opdracht van de marketeer: ${instruction.trim()}` : "Schrijf een nieuwe, betere variant."].join("\n");
    const { items } = await writeCopyFor(item.deckId, [copyAdFrom(item.candidate, item.whatYouSee, item.contentType)], notes);
    const t = items.get(item.candidate.adId);
    if (!t) return { ok: false, error: "Claude gaf geen tekst terug." };
    await db.deckItem.update({ where: { id: itemId }, data: t });
    refresh(item.deckId);
    return { ok: true, data: t };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
