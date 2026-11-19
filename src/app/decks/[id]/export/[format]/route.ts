import { loadDeckView } from "@/lib/deck/load";
import { deckFileBase, toCsv, toMarkdown, toZip } from "@/lib/export/formats";
import { toPptx } from "@/lib/export/pptx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = {
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  zip: "application/zip",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

/** Downloads: /decks/<id>/export/md | csv | zip | pptx */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; format: string }> }) {
  const { id, format } = await params;
  if (!(format in TYPES)) return new Response("Onbekend formaat", { status: 404 });
  const deck = await loadDeckView(id);
  if (!deck) return new Response("Deck niet gevonden", { status: 404 });
  const f = format as keyof typeof TYPES;
  const body: string | Buffer =
    f === "md" ? toMarkdown(deck) : f === "csv" ? toCsv(deck) : f === "zip" ? await toZip(deck) : await toPptx(deck);
  return new Response(typeof body === "string" ? body : new Uint8Array(body), {
    headers: { "Content-Type": TYPES[f], "Content-Disposition": `attachment; filename="${deckFileBase(deck)}.${f}"`, "Cache-Control": "no-store" },
  });
}
